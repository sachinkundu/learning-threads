const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const book=require('../web/book.js');
const source=fs.readFileSync(path.join(__dirname,'../web/reading.html'),'utf8');
const pause=()=>new Promise(resolve=>setTimeout(resolve,30));
function fixture(){
 const blank=make=>book.paragraphs.map(make),step={id:'b5',title:'Sphere',type:'custom',restoreJoint:'C',restoreValues:[40,30]};
 return {readingVersion:book.revision,page:2,activeId:'p2',visits:[],joint:'C',states:{R:[40],P:[35],H:[90],C:[40,30],U:[25,20],S:[25,20,15]},read:[],notes:blank(()=>''),noteOpen:blank(()=>false),noteHistory:blank(()=>[]),noteEdits:blank(()=>null),highlights:blank(()=>[]),design:{layout:'Side by side',textSize:19,surrounding:false},conversations:[...book.paragraphs.map((_,i)=>book.root(i)),{...book.root(12),id:'b5',title:'Sphere',parent:'p12',path:[step],messages:[{id:'m19',role:'user',kind:'question',text:'Why?'},{id:'m20',role:'assistant',kind:'live',text:String.raw`A sphere: \(x^2+y^2+z^2=1\).`}]}]};
}
async function app(query){
 const dom=new JSDOM(source,{url:'https://learn.example/'+query,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,errors=[],writes=[];let release;
 w.addEventListener('error',e=>errors.push(e.error));
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true'};
 w.ResizeObserver=class{observe(){}};
 w.fetch=async(url,options={})=>{
  if(url==='/api/study'&&!options.method){await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({head:{version:7,state:fixture()}})}}
  if(url==='/api/study'){writes.push(JSON.parse(options.body));return {ok:true,json:async()=>({accepted:true,version:8})}}
  if(url==='/api/settings')return {ok:true,text:async()=>JSON.stringify({version:0,configuration:{model:'gpt-5.6-luna',reasoning:'high'}})};
  throw new Error('Unexpected test request: '+url);
 };
 w.LearningBookData=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/books/modern-robotics.json')));
 w.katex=require('katex');
 for(const file of ['book','study-store','study-sync','study-route','assistant-client','assistant-context','assistant-models','study-links','thread-examples'])w.eval(fs.readFileSync(path.join(__dirname,'../web/'+file+'.js'),'utf8'));
 for(const script of [...w.document.querySelectorAll('script:not([src])')])w.eval(script.textContent);
 await pause();
 return {w,dom,errors,writes,release:async()=>{release();await pause();await pause()}};
}
test('a fresh device waits for cloud study before opening an exact saved answer',async()=>{
 const a=await app('?book='+book.id+'&thread=b5&message=m20');
 try{
  assert.equal(a.w.document.querySelector('.lt-route-error').hidden,true);
  assert.equal(a.w.document.querySelector('#lt-message-m20'),null);
  await a.release();
  assert.equal(a.w.document.querySelector('h2').textContent,'Sphere');
  assert.equal(a.w.document.activeElement.id,'lt-message-m20');
  assert.ok(a.w.document.querySelector('#lt-message-m20 .katex'));
  assert.equal(a.writes.length,0,'initial empty state must not be uploaded');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
});
test('question links, browser history, and new nested threads keep the address bar in step',async()=>{
 const a=await app('?book='+book.id+'&thread=b5&message=m20');
 try{
  await a.release();const {w}=a;
  w.document.querySelector('#lt-message-m19 [data-discussion-link]').click();await pause();
  assert.equal(new URL(w.location.href).searchParams.get('message'),'m19');
  w.history.back();await pause();assert.equal(w.document.activeElement.id,'lt-message-m20');
  w.history.forward();await pause();assert.equal(w.document.activeElement.id,'lt-message-m19');
  w.document.querySelector('[data-branch-message="m20"]').click();await pause();
  const nested=new URL(w.location.href).searchParams.get('thread');assert.match(nested,/^b-[a-f0-9-]{36}$/);
  assert.equal(new URL(w.location.href).searchParams.has('message'),false);
  w.LearningAssistant.run=async payload=>({id:payload.id,status:'completed',text:String.raw`Longitude is \(\lambda\).`});
  const input=w.document.querySelector('#lt-question');input.value='What is longitude?';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('.lt-compose').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();
  const question=new URL(w.location.href).searchParams.get('message');assert.match(question,/^m-[a-f0-9-]{36}$/);
  assert.equal(w.document.querySelector('#lt-message-'+question).classList.contains('lt-user'),true);
  assert.equal(w.document.querySelectorAll('.lt-message').length,2);
  assert.ok(w.document.querySelector('.lt-message .katex'));
  const back=[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Back to highlight');back.click();await pause();
  assert.equal(new URL(w.location.href).searchParams.get('message'),'m20');
  assert.equal(w.document.querySelector('.lt-storage-error').hidden,true);
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
});
test('live visuals stay outside highlight text, save controls, and travel with follow-ups',async()=>{
 const a=await app('?book='+book.id+'&thread=b5&message=m20');
 try{
  await a.release();const {w}=a;let captured;
  w.LearningAssistant.run=async p=>{captured=p;return {id:p.id,status:'completed',text:'Rotate the frame.',artifacts:[{jobId:'codex-question-0001',filename:'rotation.html',title:'Rotation'}]}};
  const input=w.document.querySelector('#lt-question');input.value='Animate this';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('.lt-compose').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();
  const frame=w.document.querySelector('.lt-live-visual'),answer=frame.closest('[data-message]');
  assert.equal(frame.getAttribute('sandbox'),'allow-scripts');assert.equal(answer.querySelector('.lt-message-content').textContent,'Rotate the frame.');
  w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,data:{type:'lt-visual-size',height:1000}}));assert.equal(frame.style.height,'1002px');
  w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{type:'lt-visual-size',height:9000}}));assert.equal(frame.style.height,'1002px');
  w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,data:{type:'lt-visual-state',state:{angle:42,playing:false}}}));
  w.dispatchEvent(new w.MessageEvent('message',{source:w,data:{type:'lt-visual-state',state:{angle:999}}}));
  answer.querySelector('[data-follow]').click();await pause();
  input.value='Tilt that axis';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('.lt-compose').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await pause();
  const prior=captured.context.currentConversation.find(m=>m.id===answer.dataset.message);
  assert.equal(prior.artifacts[0].filename,'rotation.html');assert.deepEqual(JSON.parse(JSON.stringify(prior.artifactStates)),{'rotation.html':{angle:42,playing:false}});
  assert.equal(captured.context.replyTo,answer.dataset.message);assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
});
test('missing saved links show an error only after sync and can return to the reading place',async()=>{
 const a=await app('?book='+book.id+'&thread=b-missing');
 try{
  await a.release();const {w}=a;
  assert.equal(w.document.querySelector('.lt-route-error').hidden,false);
  assert.match(w.document.querySelector('.lt-route-error p').textContent,/not found/);
  w.document.querySelector('[data-action="leave-route"]').click();await pause();
  assert.equal(w.document.querySelector('.lt-route-error').hidden,true);
  assert.equal(new URL(w.location.href).searchParams.get('thread'),'p2');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
});

test('settings preserve a discussion URL through open, Back, and direct reload',async()=>{
 const a=await app('?book='+book.id+'&thread=b5&message=m20#settings');
 try{
  await a.release();const {w}=a;
  assert.equal(w.location.hash,'#settings');
  assert.equal(new URL(w.location.href).searchParams.get('message'),'m20');
  const back=w.document.querySelector('[data-action="back-settings"]');
  if(back)back.click();
  else throw new Error('Settings return action missing');
  await pause();
  assert.equal(w.location.hash,'');
  assert.equal(new URL(w.location.href).searchParams.get('message'),'m20');
  w.document.querySelector('[data-action="settings"]').click();await pause();
  assert.equal(w.location.hash,'#settings');
  w.history.back();await pause();
  assert.equal(w.location.hash,'');
  assert.equal(w.document.activeElement.id,'lt-message-m20');
  assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
});
