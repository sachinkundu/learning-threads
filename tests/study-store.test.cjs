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
  for(const raw of ['{broken',JSON.stringify({version:2,book:BOOK,state:fixture()})]){
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
