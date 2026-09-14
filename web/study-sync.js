/* Optimistic cloud revisions. Conflicting snapshots stay available for recovery. */
(function(scope){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const content=value=>{const copy=clone(value);for(const node of copy?.conversations||[])delete node.scrollY;return copy};
  const newId=()=> 's-'+(scope.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  function create({book,storage,apply,status,canApply=()=>true,request=fetch}) {
    const key='learning-threads:sync:'+book;
    let meta={base:0,last:null,pending:null},latest=null,ready=false,working=false,conflict=null,timer;
    function persist(){storage().setItem(key,JSON.stringify(meta))}
    async function api(path,options={}){
      const response=await request('/api/study'+path,{cache:'no-store',...options,headers:{'X-Learning-Threads':'1',...(options.body?{'Content-Type':'application/json'}:{})}});
      const value=await response.json();
      if(!response.ok&&!(response.status===409&&value.head))throw new Error(value.error||'Could not sync study. Keep this page open or export a backup.');
      return value;
    }
    function report(error=null){status({error:error?.message||null,conflict:!!conflict})}
    function acceptHead(head){
      // Apply validates source offsets before changing the saved reading state.
      apply(clone(head.state));latest=clone(head.state);
      meta={base:head.version,last:clone(head.state),pending:null};persist();conflict=null;report();
    }
    async function send(attempt=0){
      if(!meta.pending){meta.pending={id:newId(),book,base:meta.base,state:clone(latest)};persist()}
      const pending=meta.pending,result=await api('',{method:'POST',body:JSON.stringify(pending)});
      if(result.accepted){meta={base:result.version,last:pending.state,pending:null};persist();conflict=null;report();return true}
      // Different viewport heights can update scroll positions just after a
      // resume. They must not create a conflict with a new note or question.
      if(attempt<2&&meta.last&&same(content(result.head.state),content(meta.last))){meta.base=result.head.version;meta.pending=null;persist();return send(attempt+1)}
      if(meta.last&&same(content(latest),content(meta.last))&&canApply()){acceptHead(result.head);return true}
      conflict=result;meta.pending=null;persist();report();return false;
    }
    async function run(fn){
      if(working)return;working=true;
      try{return await fn()}catch(error){report(error)}finally{working=false}
    }
    async function flush(){
      if(!ready||conflict)return;
      await run(async()=>{
        if(meta.pending||!same(latest,meta.last))await send();
      });
      if(!working&&!conflict&&!meta.pending&&!same(latest,meta.last))schedule();
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(flush,800)}
    async function refresh(){
      if(!ready)return;
      if(meta.pending||!same(latest,meta.last)){await flush();return}
      if(!canApply())return;
      await run(async()=>{
        const before=clone(latest),result=await api('');
        if(!same(before,latest)||!canApply())return;
        if(result.head&&result.head.version!==meta.base)acceptHead(result.head);
        else if(!conflict)report();
      });
    }
    return {
      async start(state,hadLocal){
        latest=clone(state);
        await run(async()=>{
          const raw=storage().getItem(key);
          if(raw){meta=JSON.parse(raw);if(!Number.isSafeInteger(meta.base)||meta.base<0)throw new Error('The saved sync state is invalid. Export a backup.')}
          if(meta.pending)await send();
          const atStart=clone(latest),result=await api('');
          if(conflict)return;
          if(!result.head){meta.base=0;await send();return}
          if(same(content(latest),content(result.head.state))){meta={base:result.head.version,last:clone(latest),pending:null};persist();return}
          if((!hadLocal||same(latest,meta.last))&&same(atStart,latest)&&canApply())acceptHead(result.head);
          else await send();
        });
        ready=true;
      },
      observe(state){latest=clone(state);if(ready)schedule()},
      stop(){clearTimeout(timer)},
      refresh,flush,
      async resolve(choice){
        if(working){report(new Error('A save is still running. Try again in a moment.'));return}
        await run(async()=>{
          // Keep the latest local work even if it changed after conflict detection.
          await api('',{method:'POST',body:JSON.stringify({id:newId(),book,base:0,state:latest})});
          const result=await api('');
          if(choice==='cloud'){acceptHead(result.head);return}
          meta.base=result.head?.version||0;meta.pending=null;conflict=null;persist();await send();
        });
      },
      async versions(before){return api('/versions'+(before?'?before='+before:''))},
      async copy(version){return api('/versions/'+version)},
      async restore(state){
        if(working)throw new Error('A save is still running. Try again in a moment.');
        working=true;
        try{
          await api('',{method:'POST',body:JSON.stringify({id:newId(),book,base:0,state:latest})});
          const result=await api(''),body={id:newId(),book,base:result.head?.version||0,state};
          const saved=await api('',{method:'POST',body:JSON.stringify(body)});
          if(!saved.accepted){conflict=saved;report();throw new Error('Study changed on another device. Both copies are saved. Choose a copy before restoring.')}
          acceptHead(saved.head);
        }finally{working=false}
      }
    };
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningStudySync=api;
})(globalThis);
