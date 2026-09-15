const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../web/study-sync.js');
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}}
function server(){
  let head=null,seq=0;const versions=new Map();
  async function request(path,options){
    let data,status=200;
    if(options.method==='POST'){
      const body=JSON.parse(options.body);
      let version=versions.get(body.id);
      if(!version){version={...body,version:++seq,accepted:body.base===(head?.version||0)};versions.set(body.id,version);if(version.accepted)head=version}
      data={accepted:version.accepted,version:version.version,head};status=version.accepted?200:409;
    }else data={head};
    return {ok:status===200,status,json:async()=>JSON.parse(JSON.stringify(data))};
  }
  return {request,versions,head:()=>head};
}
function client(remote,disk=storage(),extra={}){
  const received=[],statuses=[];
  const sync=create({book:'book',storage:()=>disk,request:remote.request,apply:s=>received.push(s),status:s=>statuses.push(s),...extra});
  return {sync,disk,received,statuses};
}
test('a new device reads the cloud copy without writing its empty initial state',async()=>{
  const remote=server(),a=client(remote),b=client(remote);
  await a.sync.start({notes:'Saved question and exact highlight'},true);
  await b.sync.start({notes:''},false);
  assert.deepEqual(b.received.at(-1),{notes:'Saved question and exact highlight'});
  assert.equal(remote.versions.size,1);a.sync.stop();b.sync.stop();
});
test('conflicting device edits retain both copies until the learner chooses',async()=>{
  const remote=server(),a=client(remote),b=client(remote);
  await a.sync.start({notes:'Original'},true);await b.sync.start({notes:''},false);
  a.sync.observe({notes:'Computer edit'});await a.sync.flush();
  b.sync.observe({notes:'Tablet edit'});await b.sync.flush();
  assert.equal(remote.head().state.notes,'Computer edit');
  assert.equal(b.statuses.at(-1).conflict,true);
  assert.ok([...remote.versions.values()].some(v=>v.state.notes==='Tablet edit'&&!v.accepted));
  b.sync.observe({notes:'Tablet edit after the warning'});await b.sync.resolve('cloud');
  assert.ok([...remote.versions.values()].some(v=>v.state.notes==='Tablet edit after the warning'));
  assert.equal(b.received.at(-1).notes,'Computer edit');a.sync.stop();b.sync.stop();
});
test('a lost acknowledgement reuses its request ID after reopening',async()=>{
  const remote=server(),disk=storage();let drop=true;
  const unreliable={request:async(path,opts)=>{const response=await remote.request(path,opts);if(opts.method==='POST'&&drop){drop=false;throw new Error('Connection lost after commit')}return response}};
  const a=client(unreliable,disk);await a.sync.start({notes:'Committed once'},true);a.sync.stop();
  const b=client(remote,disk);await b.sync.start({notes:'Committed once'},true);
  assert.equal(remote.versions.size,1);assert.equal(remote.head().state.notes,'Committed once');b.sync.stop();
});
test('edits made while a save is in flight are sent after that save',async()=>{
  const remote=server(),a=client(remote);await a.sync.start({notes:'Original'},true);
  let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const disk=a.disk;a.sync.stop();
  const b=client({request:async(path,opts)=>{if(opts.method==='POST'){entered();await gate}return remote.request(path,opts)}},disk);
  await b.sync.start({notes:'Original'},true);b.sync.observe({notes:'First edit'});
  const pending=b.sync.flush();await started;b.sync.observe({notes:'Second edit'});release();await pending;await b.sync.flush();
  assert.equal(remote.head().state.notes,'Second edit');b.sync.stop();
});
test('restore preserves the current study before changing the head',async()=>{
  const remote=server(),a=client(remote);await a.sync.start({notes:'Current'},true);
  a.sync.observe({notes:'Latest unsynced work'});await a.sync.restore({notes:'Restored from file'});
  assert.ok([...remote.versions.values()].some(v=>v.state.notes==='Latest unsynced work'));
  assert.equal(remote.head().state.notes,'Restored from file');assert.equal(a.received.at(-1).notes,'Restored from file');a.sync.stop();
});
test('a viewport scroll adjustment does not conflict with a new note',async()=>{
  const remote=server(),a=client(remote),b=client(remote),initial={notes:'Original',conversations:[{scrollY:400}]};
  await a.sync.start(initial,true);await b.sync.start({},false);
  b.sync.observe({...initial,conversations:[{scrollY:240}]});await b.sync.flush();
  a.sync.observe({...initial,notes:'Edited on the computer'});await a.sync.flush();
  assert.equal(remote.head().state.notes,'Edited on the computer');assert.equal(a.statuses.at(-1).conflict,false);a.sync.stop();b.sync.stop();
});

test('a chapter migration adopts newer remote edits and durably saves the upgraded state',async()=>{
  const remote=server(),disk=storage(),old=client(remote,disk);
  await old.sync.start({notes:'Original'},true);old.sync.stop();
  const other=client(remote);await other.sync.start({},false);
  other.sync.observe({notes:'Newer tablet note'});await other.sync.flush();other.sync.stop();
  const normalize=s=>({...s,readingVersion:1});
  const updated=client(remote,disk,{normalize});
  await updated.sync.start({notes:'Original',readingVersion:1},true);await updated.sync.flush();
  assert.deepEqual(updated.received.at(-1),{notes:'Newer tablet note',readingVersion:1});
  assert.equal(remote.head().state.readingVersion,1);assert.equal(updated.statuses.at(-1).conflict,false);updated.sync.stop();
});
test('a migration retries an unacknowledged save unchanged before saving the new format',async()=>{
  const remote=server(),disk=storage();let drop=true;const bodies=[];
  const wrapped={request:async(path,opts)=>{
    if(opts.method==='POST')bodies.push(JSON.parse(opts.body));
    const response=await remote.request(path,opts);
    if(opts.method==='POST'&&drop){drop=false;throw new Error('Lost acknowledgement')}
    return response;
  }};
  const old=client(wrapped,disk);await old.sync.start({notes:'Keep this'},true);old.sync.stop();
  const updated=client(wrapped,disk,{normalize:s=>({...s,readingVersion:1})});
  await updated.sync.start({notes:'Keep this',readingVersion:1},true);await updated.sync.flush();
  assert.deepEqual(bodies[0],bodies[1]);assert.equal(remote.head().state.readingVersion,1);
  assert.equal(remote.versions.size,2);updated.sync.stop();
});
