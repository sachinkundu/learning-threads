import {RequestError} from './errors.ts';
import {MODEL,PRICES,OpenAIError,openaiRequest,responseBody,resultOf} from './openai.ts';
import type {LearningPayload,OpenAIResponse,Price,TokenUsage} from './openai.ts';
export interface AssistantEnv {DB:D1Database;OPENAI_API_KEY?:string}
export type Call={id:string;payload:string;digest:string;status:string;created:string;result:string|null;provider:string;provider_id:string|null;submission_started:string|null;poll_after:number;poll_lease_until:number;pricing:string|null};
type SavedResult={text?:string;usage?:Partial<TokenUsage>|null;cost_usd?:number|null;model?:string;[key:string]:unknown};
const fields=['input_tokens','cached_input_tokens','cache_write_tokens','output_tokens','reasoning_output_tokens'] as const;
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const expose=(call:Call)=>({id:call.id,status:call.status,created:call.created,provider:call.provider,...(call.result?JSON.parse(call.result) as SavedResult:{})});
const get=(db:D1Database,id:string)=>db.prepare('SELECT * FROM assistant_calls WHERE id=?').bind(id).first<Call>();
const pending=(call:{status:string})=>['queued','running'].includes(call.status);
function payload(value:unknown):{id:string;data:LearningPayload}{
  const v=value as {id?:unknown;question?:unknown;context?:unknown}|null;
  if(!v||typeof v.id!=='string'||!/^[-a-zA-Z0-9]{12,100}$/.test(v.id))throw new RequestError('The request ID is invalid.');
  if(typeof v.question!=='string'||!v.question.trim()||v.question.length>12000||!v.context||typeof v.context!=='object'||Array.isArray(v.context))throw new RequestError('The question or reading context is invalid.');
  const data={question:v.question,context:v.context as Record<string,unknown>};
  if(new TextEncoder().encode(JSON.stringify(data)).length>250000)throw new RequestError('Send a question smaller than 250 KB.',413);
  return {id:v.id,data};
}
function apiKey(env:AssistantEnv){
  if(!env.OPENAI_API_KEY)throw new RequestError('The OpenAI API key is not configured. Add OPENAI_API_KEY to the Worker secrets, then reconnect this question.',503);
  return env.OPENAI_API_KEY;
}
async function fail(db:D1Database,id:string,error:string,extra:Record<string,unknown>={}){
  await db.prepare("UPDATE assistant_calls SET status='failed',result=?,poll_lease_until=0 WHERE id=? AND status IN ('queued','running')")
    .bind(JSON.stringify({error,usage:null,cost_usd:null,finished:new Date().toISOString(),...extra}),id).run();
}
async function saveResponse(env:AssistantEnv,call:Call,response:OpenAIResponse){
  const price:Price=call.pricing?JSON.parse(call.pricing):PRICES,result=resultOf(response,price);
  await env.DB.prepare("UPDATE assistant_calls SET provider_id=?,status=?,result=?,poll_after=?,poll_lease_until=0 WHERE id=? AND provider='openai' AND status IN ('queued','running')")
    .bind(response.id,result.status,JSON.stringify(result),Date.now()+1000,call.id).run();
}
export async function advance(env:AssistantEnv,id:string,request:typeof fetch=fetch):Promise<Call>{
  const key=apiKey(env),db=env.DB;let call=await get(db,id);
  if(!call)throw new RequestError('Reply not found.',404);
  if(!pending(call))return call;
  if(call.provider!=='openai'){
    // Never run a pre-cutover CLI job again through a paid API automatically.
    await fail(db,id,'This reply was interrupted before the switch to OpenAI. Retry the saved question.');
    return (await get(db,id))!;
  }
  if(!call.submission_started){
    const claim=await db.prepare("UPDATE assistant_calls SET status='running',submission_started=? WHERE id=? AND provider='openai' AND submission_started IS NULL AND status='queued'")
      .bind(new Date().toISOString(),id).run();
    if(claim.meta.changes){
      // Claim before the network call. Uncertain submissions are never reissued,
      // including after a lost browser acknowledgement or a Worker restart.
      let response:OpenAIResponse;
      try{response=await openaiRequest(key,'',responseBody(JSON.parse(call.payload),id),id,request)}
      catch(error){
        const detail=error instanceof Error?error.message:String(error);
        const rejected=error instanceof OpenAIError&&[400,401,403,404,422,429].includes(error.status);
        await fail(db,id,rejected?`OpenAI: ${detail}`:`OpenAI did not confirm this request: ${detail} It has not been sent again; a charge may still appear in OpenAI usage.`,
          {provider:'openai',model:MODEL,submission_uncertain:!rejected,provider_request_id:error instanceof OpenAIError?error.requestId:null});
        return (await get(db,id))!;
      }
      // A D1 fault here must not be mistaken for a rejected OpenAI request.
      await saveResponse(env,call,response);
      return (await get(db,id))!;
    }
    call=(await get(db,id))!;
  }
  if(!call.provider_id){
    if(call.submission_started&&Date.now()-Date.parse(call.submission_started)>60000)
      await fail(db,id,'OpenAI submission could not be recovered. It has not been sent again; a charge may still appear in OpenAI usage.',{provider:'openai',model:MODEL,submission_uncertain:true});
    return (await get(db,id))!;
  }
  if(call.poll_after>Date.now())return call;
  const claim=await db.prepare("UPDATE assistant_calls SET poll_lease_until=? WHERE id=? AND status='running' AND poll_lease_until<? AND poll_after<=?")
    .bind(Date.now()+25000,id,Date.now(),Date.now()).run();
  if(!claim.meta.changes)return (await get(db,id))!;
  try{
    const response=await openaiRequest(key,'/'+encodeURIComponent(call.provider_id),undefined,id,request);
    await saveResponse(env,call,response);
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);
    if(error instanceof OpenAIError&&error.status===404){
      await fail(db,id,`OpenAI could not retrieve the saved reply: ${detail}`,{provider:'openai',model:MODEL,provider_response_id:call.provider_id});
    }else{
      await db.prepare('UPDATE assistant_calls SET poll_lease_until=0,poll_after=? WHERE id=?').bind(Date.now()+15000,id).run();
      throw error;
    }
  }
  return (await get(db,id))!;
}
export async function collectReplies(env:AssistantEnv){
  if(!env.OPENAI_API_KEY)return;
  const {results}=await env.DB.prepare("SELECT id FROM assistant_calls WHERE status IN ('queued','running') ORDER BY created LIMIT 4").all<{id:string}>();
  const resultsByCall=await Promise.allSettled(results.map(({id})=>advance(env,id)));
  resultsByCall.forEach((result,i)=>{if(result.status==='rejected')console.error('Assistant collection failed',results[i].id,result.reason)});
}
export async function assistant(request:Request,env:AssistantEnv,path:string,body:()=>Promise<unknown>,ctx:ExecutionContext):Promise<Response>{
  const db=env.DB;
  if(path==='/api/usage'&&request.method==='GET'){
    const {results}=await db.prepare('SELECT * FROM assistant_calls ORDER BY created DESC').all<Call>();
    const calls=results.map(c=>{const call={...expose(c),question:(JSON.parse(c.payload) as LearningPayload).question};delete call.text;return call});
    const totals=Object.fromEntries(fields.map(k=>{const reported=calls.map(c=>c.usage?.[k]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);return [k,reported.length?reported.reduce((a,b)=>a+b,0):calls.length?null:0]}));
    const known=calls.filter(c=>typeof c.cost_usd==='number'&&Number.isFinite(c.cost_usd)&&c.cost_usd>=0);
    return json({calls,totals,unreported_calls:calls.filter(c=>!c.usage).length,
      cost_usd:known.length?known.reduce((sum,c)=>sum+c.cost_usd!,0):null,cost_kind:'estimated',
      unpriced_calls:calls.filter(c=>!pending(c)&&c.cost_usd==null).length});
  }
  if(/^\/api\/replies\/[-a-zA-Z0-9]+$/.test(path)&&request.method==='GET'){
    const call=await get(db,path.split('/').pop()!);if(!call)return json({error:'Reply not found.'},404);
    if(!pending(call))return json(expose(call));
    const work=advance(env,call.id);ctx.waitUntil(work);return json(expose(await work));
  }
  if(path==='/api/replies'&&request.method==='POST'){
    const {id,data}=payload(await body()),digest=canonical(data);
    const existing=await get(db,id);
    if(existing){
      if(existing.digest!==digest)return json({error:'This request ID belongs to another question.'},409);
      if(!pending(existing))return json(expose(existing));
      const work=advance(env,id);ctx.waitUntil(work);return json(expose(await work));
    }
    apiKey(env);
    await db.prepare("INSERT INTO assistant_calls (id,payload,digest,status,created,provider,pricing) SELECT ?,?,?,'queued',?,'openai',? WHERE (SELECT count(*) FROM assistant_calls WHERE status IN ('queued','running'))<4 ON CONFLICT(id) DO NOTHING")
      .bind(id,JSON.stringify(data),digest,new Date().toISOString(),JSON.stringify(PRICES)).run();
    const call=await get(db,id);
    if(!call)return json({error:'Four replies are in progress. Try again when one finishes.'},429);
    if(call.digest!==digest)return json({error:'This request ID belongs to another question.'},409);
    const work=advance(env,id);ctx.waitUntil(work);return json(expose(await work),202);
  }
  return json({error:'Not found.'},404);
}
