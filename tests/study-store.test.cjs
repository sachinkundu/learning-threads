const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,validate,KEY,BOOK}=require('../web/study-store.js');

function storage(){
  const data=new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
}
function fixture(){
  const root=page=>({id:'p'+page,title:'Paragraph '+(page+1),page,parent:null,path:[],messages:[],draft:'',quote:''});
  const p0=root(0),p1=root(1);
  const first={id:'b1',title:'Wrist',restoreJoint:'S',restoreValues:[25,20,15]};
  const second={id:'b2',title:'Actuation',restoreJoint:'S',restoreValues:[25,20,15]};
  return {
    page:1,activeId:'b2',joint:'S',states:{R:[40],P:[35],H:[90],C:[40,30],U:[25,20],S:[25,20,15]},
    read:[0],notes:['A hinge has one axis.','Check the wrist.'],noteOpen:[false,true],
    highlights:[[{start:0,end:5,quote:'Joint'}],[]],design:{layout:'Visual below',textSize:22,surrounding:false},
    conversations:[p0,p1,
      {...root(1),id:'b1',title:'Wrist',parent:'p1',path:[first],sourceAnchor:{id:'highlight-b1',book:BOOK,page:1,start:0,end:5,quote:'Joint'},messages:[{id:'m1',role:'user',text:'Why three motors?'},{id:'m2',role:'assistant',text:'One for each axis.',note:'Actuation differs from freedom.'}]},
      {...root(1),id:'b2',title:'Actuation',parent:'b1',path:[first,second],draft:'Where does torque come from?',replyTo:'m3',quote:'Motor',scrollY:640,messages:[{id:'m3',role:'assistant',text:'Motor torque.'},{id:'m4',role:'assistant',text:'Visual',visualization:{type:'wrist',sourceMessage:'m3',values:[30,50,10]}}]}
    ]
  };
}

test('a new store restores nested study, notes, controls, draft, and exact source link',()=>{
  const disk=storage(),first=create(()=>disk),state=fixture();
  assert.equal(first.load(),null);assert.equal(first.save(state),1);
  const reopened=create(()=>disk);assert.deepEqual(reopened.load(),state);
  assert.equal(reopened.save(state),1,'unchanged state does not create a revision');
  state.conversations[3].draft+=' And gearing?';assert.equal(reopened.save(state),2);
  assert.deepEqual(create(()=>disk).load(),state);
});
test('a failed write keeps the last good study and exports unsaved work',()=>{
  const disk=storage(),store=create(()=>disk),state=fixture();store.load();store.save(state);
  const good=disk.getItem(KEY);disk.setItem=()=>{throw new DOMException('Quota reached','QuotaExceededError')};
  state.notes[0]='New unsaved note';
  assert.throws(()=>store.save(state),e=>e.cause?.name==='QuotaExceededError' && /Export a backup/.test(e.message));
  assert.equal(disk.getItem(KEY),good);assert.deepEqual(store.backup(state).state,state);
  assert.equal(store.backup(state).stored,good);
});
test('a stale tab cannot silently overwrite a newer saved session',()=>{
  const disk=storage(),a=create(()=>disk);a.load();a.save(fixture());
  const b=create(()=>disk),bState=b.load(),aState=fixture();
  aState.notes[1]='First tab edit';a.save(aState);
  bState.notes[1]='Other tab edit';
  assert.throws(()=>b.save(bState),/another tab/);
  assert.deepEqual(create(()=>disk).load(),aState);
  assert.equal(b.backup(bState).state.notes[1],'Other tab edit');
});
test('corruption and future formats are not silently reset',()=>{
  for(const raw of ['{broken',JSON.stringify({version:3,book:BOOK,state:fixture()})]){
    const disk=storage();disk.setItem(KEY,raw);const store=create(()=>disk);
    assert.throws(()=>store.load(),/left untouched/);
    assert.throws(()=>store.save(fixture()),/could not be opened/);
    assert.equal(disk.getItem(KEY),raw);assert.equal(store.backup(fixture()).stored,raw);
  }
});
test('a broken parent path or another edition is rejected before a write',()=>{
  for(const change of [s=>s.conversations[2].parent='b2',s=>s.conversations[2].sourceAnchor.book='another-edition',s=>s.conversations[3].path.pop(),s=>s.conversations[3].messages[0].id='m2']){
    const state=fixture();change(state);assert.throws(()=>validate(state));
  }
});
test('blocked browser storage reports the original error and still permits a backup',()=>{
  const cause=new DOMException('Denied','SecurityError');const store=create(()=>{throw cause});
  assert.throws(()=>store.load(),e=>e.cause===cause && /Export a backup/.test(e.message));
  const backup=store.backup(fixture());assert.match(backup.storageError,/unavailable/);assert.deepEqual(backup.state,fixture());
});

test('version 1 study opens without a reset and upgrades only on a successful save',()=>{
  const disk=storage(),state=fixture();
  const original=JSON.stringify({version:1,book:BOOK,revision:7,state});disk.setItem(KEY,original);
  const store=create(()=>disk);assert.deepEqual(store.load(),state);assert.equal(disk.getItem(KEY),original);
  state.noteHistory=[[],[]];state.noteEdits=[null,null];store.save(state);
  assert.equal(JSON.parse(disk.getItem(KEY)).version,2);
  assert.equal(JSON.parse(disk.getItem(KEY)).revision,8);
  assert.deepEqual(create(()=>disk).load().conversations,state.conversations);
});
test('reply anchors and revision histories survive reopening and reject missing source replies',()=>{
  const disk=storage(),store=create(()=>disk),state=fixture();store.load();
  state.conversations[3].sourceAnchor={id:'highlight-b2',book:BOOK,page:1,kind:'message',nodeId:'b1',messageId:'m2',sourceRevision:0,start:0,end:3,quote:'One'};
  state.noteHistory=[[{text:'My first thought',at:'2026-09-14T10:00:00.000Z'}],[]];state.noteEdits=[state.notes[0],null];
  state.conversations[2].messages[0].history=[{text:'An earlier question',at:'2026-09-14T10:01:00.000Z'}];
  store.save(state);assert.deepEqual(create(()=>disk).load(),state);
  state.conversations[3].sourceAnchor.messageId='missing';assert.throws(()=>store.save(state),/lost its reply/);
  assert.equal(create(()=>disk).load().conversations[3].sourceAnchor.messageId,'m2');
});

const Book=require('../web/book.js');
const {upgrade}=require('../web/study-store.js');
test('the full chapter migration preserves all old work and runs only once',()=>{
  const old=fixture(),before=structuredClone(old),state=upgrade(old);
  assert.deepEqual(old,before,'migration cannot mutate a saved copy');
  assert.equal(state.page,Book.first);assert.equal(state.activeId,'p'+Book.first);
  assert.deepEqual(state.conversations.slice(0,old.conversations.length),old.conversations);
  for(const key of ['notes','noteOpen','highlights'])assert.deepEqual(state[key].slice(0,2),old[key]);
  assert.equal(state.notes.length,43);assert.equal(state.readingVersion,1);
  state.page=Book.next(Book.first);state.activeId='p'+state.page;
  assert.deepEqual(upgrade(state),state,'reopening keeps the chosen paragraph');
  for(const mutate of [s=>s.page=43,s=>s.read.push(-1),s=>s.highlights.pop(),s=>s.readingVersion=2,s=>s.visits.push({page:999,at:'2026-09-15T10:00:00Z'})]){
    const bad=structuredClone(state);mutate(bad);assert.throws(()=>validate(bad));
  }
});
test('Chapter 1 follows all 41 paragraphs without jumping to the old Chapter 2 sample',()=>{
  const visited=[];for(let p=Book.first;p!==null;p=Book.next(p))visited.push(p);
  assert.deepEqual(visited,Book.chapters[0].paragraphs);assert.equal(visited.length,41);
  assert.equal(Book.previous(Book.first),null);assert.equal(Book.next(visited.at(-1)),null);
  assert.equal(new Set(Book.paragraphs.map(p=>p.id)).size,43);
  for(const [i,p] of visited.entries()){
    const passage=Book.paragraphs[p];assert.equal(passage.chapter,1);assert.equal(passage.number,i+1);
    assert.ok(passage.text.trim().length);assert.ok(passage.sourcePages.every(n=>n>=1&&n<=10));
    if(i)assert.equal(Book.previous(p),visited[i-1]);
  }
  assert.deepEqual(Book.paragraphs[5].sourcePages,[1,2]);
  assert.ok(Book.figuresFor(4)[0].asset.endsWith('figure-1-1.png'));
  assert.deepEqual(Book.figuresFor(11),Book.figuresFor(4));
  assert.equal(Book.figuresFor(11).length,1);
  assert.deepEqual(Book.figuresFor(12),[]);
  assert.match(Book.paragraphs[15].text,/ω̂/);
});
