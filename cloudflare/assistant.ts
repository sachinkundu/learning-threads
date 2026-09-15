import {RequestError} from './errors.ts';
import {getSettings,saveSettings,configuration} from './settings.ts';
import {advance as legacyAdvance,aggregateUsage} from './legacy-openai.ts';
import type {Call} from './legacy-openai.ts';
import {frameResponse} from './artifact-frame.ts';
export {aggregateUsage};
export interface AssistantEnv {DB:D1Database;CODEX_RUNNER?:Fetcher;RUNNER_SCOPE?:string;OPENAI_API_KEY?:string}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const get=(db:D1Database,id:string)=>db.prepare('SELECT * FROM assistant_calls WHERE id=?').bind(id).first<Call>();
const pending=(call:Call)=>['queued','running'].includes(call.status);
const canonical=(value:unknown):string=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const expose=(call:Call)=>({id:call.id,status:call.status,created:call.created,provider:call.provider,...(call.configuration?JSON.parse(call.configuration):{}),...(call.result?JSON.parse(call.result):{})});
function runner(env:AssistantEnv){if(!env.CODEX_RUNNER||!['qa','production'].includes(env.RUNNER_SCOPE||''))throw new RequestError('The cloud Codex runner is not connected.',503);return env.CODEX_RUNNER}
async function finish(db:D1Database,id:string,result:Record<string,unknown>){
  await db.prepare("UPDATE assistant_calls SET status=?,result=?,poll_after=?,poll_lease_until=0,provider_id=? WHERE id=? AND status IN ('queued','running')")
    .bind(result.status==='completed'?'completed':result.status==='failed'?'failed':result.status==='queued'?'queued':'running',JSON.stringify(result),Date.now()+1000,id,id).run();
}
export async function advance(env:AssistantEnv,id:string){
  const call=await get(env.DB,id);if(!call)throw new RequestError('Reply not found.',404);if(!pending(call))return call;
  if(call.provider!=='codex-oauth'){
    // Retrieve submitted API results; never submit or resubmit paid API work.
    if(call.provider==='openai'&&call.provider_id)return legacyAdvance(env,id);
    await finish(env.DB,id,{status:'failed',error:'This question predates the cloud Codex switch. Retry the saved question.',cost_usd:null,usage:null});
    return (await get(env.DB,id))!;
  }
  if(call.poll_after>Date.now())return call;
  const service=runner(env),packet={...JSON.parse(call.payload),configuration:configuration(JSON.parse(call.configuration!))};
  const response=await service.fetch('https://codex.internal/'+env.RUNNER_SCOPE+'/jobs/'+id,call.provider_id?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet)});
  const result=await response.json() as Record<string,unknown>;
  if(!response.ok)throw new RequestError(String(result.error||'Codex is temporarily unavailable.'),503);
  if(!['queued','running','completed','failed'].includes(String(result.status)))throw new Error('The Codex runner returned an invalid job status.');
  await finish(env.DB,id,result);return (await get(env.DB,id))!;
}
export async function collectReplies(env:AssistantEnv){
  if(!env.CODEX_RUNNER)return;
  const {results}=await env.DB.prepare("SELECT id FROM assistant_calls WHERE status IN ('queued','running') ORDER BY created LIMIT 4").all<{id:string}>();
  const settled=await Promise.allSettled(results.map(row=>advance(env,row.id)));
  settled.forEach((r,i)=>{if(r.status==='rejected')console.error('Codex collection failed',results[i].id,r.reason)});
}
export async function assistant(request:Request,env:AssistantEnv,path:string,body:()=>Promise<unknown>,ctx:ExecutionContext):Promise<Response>{
  if(path==='/api/settings'&&request.method==='GET')return json(await getSettings(env.DB));
  if(path==='/api/settings'&&request.method==='POST')return json(await saveSettings(env.DB,await body()));
  if(path==='/api/usage'&&request.method==='GET'){
    const {results}=await env.DB.prepare('SELECT * FROM assistant_calls ORDER BY created DESC').all<Call>();return json(aggregateUsage(results.map(expose)));
  }
  const artifact=path.match(/^\/api\/artifacts\/([-a-zA-Z0-9]{12,100})\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\.html)$/);
  if(artifact&&request.method==='GET'){
    const call=await get(env.DB,artifact[1]);
    if(!call||call.status!=='completed'||!JSON.parse(call.result||'{}').artifacts?.some((a:{filename:string})=>a.filename===artifact[2]))return json({error:'Visual not found.'},404);
    return frameResponse(await runner(env).fetch('https://codex.internal/'+env.RUNNER_SCOPE+'/artifacts/'+artifact[1]+'/'+artifact[2]));
  }
  if(/^\/api\/replies\/[-a-zA-Z0-9]+$/.test(path)&&request.method==='GET'){
    const call=await get(env.DB,path.split('/').pop()!);if(!call)return json({error:'Reply not found.'},404);
    if(!pending(call))return json(expose(call));
    const work=advance(env,call.id);ctx.waitUntil(work);return json(expose(await work));
  }
  if(path==='/api/replies'&&request.method==='POST'){
    const value=await body() as {id?:unknown;question?:unknown;context?:unknown}|null;
    if(!value||typeof value.id!=='string'||!/^[-a-zA-Z0-9]{12,100}$/.test(value.id))throw new RequestError('The request ID is invalid.');
    if(typeof value.question!=='string'||!value.question.trim()||value.question.length>12000||!value.context||typeof value.context!=='object'||Array.isArray(value.context))throw new RequestError('The question or reading context is invalid.');
    const data={question:value.question,context:value.context},digest=canonical(data);
    if(new TextEncoder().encode(JSON.stringify(data)).length>250000)throw new RequestError('Send a question smaller than 250 KB.',413);
    let call=await get(env.DB,value.id);
    if(call&&call.digest!==digest)return json({error:'This request ID belongs to another question.'},409);
    if(!call){
      runner(env);const {configuration:choice}=await getSettings(env.DB);
      await env.DB.prepare("INSERT INTO assistant_calls (id,payload,digest,status,created,provider,configuration) SELECT ?,?,?,'queued',?,'codex-oauth',? WHERE (SELECT count(*) FROM assistant_calls WHERE status IN ('queued','running'))<4 ON CONFLICT(id) DO NOTHING")
        .bind(value.id,JSON.stringify(data),digest,new Date().toISOString(),JSON.stringify(choice)).run();
      call=await get(env.DB,value.id);if(!call)return json({error:'Four replies are in progress. Try again when one finishes.'},429);
      if(call.digest!==digest)return json({error:'This request ID belongs to another question.'},409);
    }
    if(!pending(call))return json(expose(call));
    const work=advance(env,call.id);ctx.waitUntil(work);return json(expose(await work),202);
  }
  return json({error:'Not found.'},404);
}
