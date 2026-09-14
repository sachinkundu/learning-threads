import {RequestError} from './errors';
type Call={id:string;payload:string;digest:string;status:string;created:string;result:string|null};
const fields=['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens'];
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const expose=(call:Call)=>({id:call.id,status:call.status,created:call.created,...(call.result?JSON.parse(call.result):{})});
async function alive(db:D1Database){const row=await db.prepare('SELECT seen FROM assistant_bridge WHERE id=1').first<{seen:string}>();return !!row&&Date.now()-Date.parse(row.seen)<90_000}
function payload(value:any){
  if(!value||typeof value.id!=='string'||!/^[-a-zA-Z0-9]{12,100}$/.test(value.id))throw new RequestError('The request ID is invalid.');
  if(typeof value.question!=='string'||!value.question.trim()||value.question.length>12000||!value.context||typeof value.context!=='object'||Array.isArray(value.context))throw new RequestError('The question or reading context is invalid.');
  const p={question:value.question,context:value.context};if(new TextEncoder().encode(JSON.stringify(p)).length>250000)throw new RequestError('Send a question smaller than 250 KB.',413);return p;
}
export async function assistant(request:Request,db:D1Database,path:string,body:()=>Promise<any>,internal:boolean):Promise<Response>{
  if(internal&&path==='/api/replies/next'&&request.method==='GET'){
    await db.prepare('INSERT INTO assistant_bridge VALUES (1,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen').bind(new Date().toISOString()).run();
    const call=await db.prepare("SELECT * FROM assistant_calls WHERE status IN ('queued','running') ORDER BY created LIMIT 1").first<Call>();
    return json({call:call?{id:call.id,...JSON.parse(call.payload)}:null});
  }
  if(internal&&path==='/api/replies/record'&&request.method==='POST'){
    const value=await body(),p=payload({id:value.id,...value.payload}),digest=canonical(p);
    if(!['queued','running','completed','failed'].includes(value.status)||typeof value.created!=='string'||!Number.isFinite(Date.parse(value.created)))return json({error:'Invalid assistant record.'},400);
    const result={...value.result};delete result.diagnostics;delete result.id;delete result.status;delete result.created;
    await db.prepare(`INSERT INTO assistant_calls VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,result=excluded.result,created=excluded.created WHERE assistant_calls.digest=excluded.digest AND assistant_calls.status NOT IN ('completed','failed')`).bind(value.id,JSON.stringify(p),digest,value.status,value.created,JSON.stringify(result)).run();
    const row=await db.prepare('SELECT digest FROM assistant_calls WHERE id=?').bind(value.id).first<{digest:string}>();
    return json(row?.digest===digest?{saved:true}:{error:'This request ID belongs to another question.'},row?.digest===digest?200:409);
  }
  if(internal)return json({error:'Not found.'},404);
  if(path==='/api/usage'&&request.method==='GET'){
    const {results}=await db.prepare('SELECT * FROM assistant_calls ORDER BY created DESC').all<Call>();
    const calls=results.map(c=>{const call={...expose(c),question:JSON.parse(c.payload).question};delete call.text;return call});
    const totals=Object.fromEntries(fields.map(k=>{const reported=calls.map(c=>c.usage?.[k]).filter(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0);return [k,reported.length?reported.reduce((a,b)=>a+b,0):calls.length?null:0]}));
    return json({calls,totals,unreported_calls:calls.filter(c=>!c.usage).length,cost_usd:null});
  }
  if(/^\/api\/replies\/[-a-zA-Z0-9]+$/.test(path)&&request.method==='GET'){
    const call=await db.prepare('SELECT * FROM assistant_calls WHERE id=?').bind(path.split('/').pop()).first<Call>();
    if(!call)return json({error:'Reply not found.'},404);
    if(['queued','running'].includes(call.status)&&!await alive(db))return json({error:'The Mac assistant is offline. Reconnect the Mac, then reconnect this question.'},503);
    return json(expose(call));
  }
  if(path==='/api/replies'&&request.method==='POST'){
    const value=await body(),p=payload(value),digest=canonical(p);
    const existing=await db.prepare('SELECT * FROM assistant_calls WHERE id=?').bind(value.id).first<Call>();
    if(existing)return existing.digest===digest?json(expose(existing)):json({error:'This request ID belongs to another question.'},409);
    if(!await alive(db))return json({error:'The Mac assistant is offline. Reconnect the Mac and retry.'},503);
    await db.prepare("INSERT INTO assistant_calls SELECT ?,?,?,'queued',?,NULL WHERE (SELECT count(*) FROM assistant_calls WHERE status IN ('queued','running'))<4 ON CONFLICT(id) DO NOTHING").bind(value.id,JSON.stringify(p),digest,new Date().toISOString()).run();
    const call=await db.prepare('SELECT * FROM assistant_calls WHERE id=?').bind(value.id).first<Call>();
    if(!call)return json({error:'Four replies are in progress. Try again when one finishes.'},429);
    return call.digest===digest?json(expose(call),202):json({error:'This request ID belongs to another question.'},409);
  }
  return json({error:'Not found.'},404);
}
