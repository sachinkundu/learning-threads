import {createRemoteJWKSet, jwtVerify} from 'jose';
import StudyStore from '../web/study-store.js';
import {assistant} from './assistant';
import {RequestError} from './errors';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BRIDGE_TOKEN: string;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  OWNER_EMAIL: string;
}
type Version = {seq:number;id:string;book:string;base:number;state:string;created:string;accepted:number};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const expose=(row:Version|null)=>row?{version:row.seq,id:row.id,base:row.base,state:JSON.parse(row.state),created:row.created,accepted:!!row.accepted}:null;

async function machine(request:Request,env:Env) {
  const sent=request.headers.get('Authorization')||'';
  if(!env.BRIDGE_TOKEN||env.BRIDGE_TOKEN.length<32)return false;
  const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const a=await digest(sent),b=await digest('Bearer '+env.BRIDGE_TOKEN);
  return a.reduce((diff,v,i)=>diff|(v^b[i]),0)===0;
}
async function owner(request:Request,env:Env) {
  // No Access configuration means no public reader or source assets.
  if(!env.ACCESS_AUD||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER))return false;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)return false;
  try {
    const keys=createRemoteJWKSet(new URL(env.ACCESS_ISSUER+'/cdn-cgi/access/certs'));
    const {payload}=await jwtVerify(token,keys,{issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUD,algorithms:['RS256']});
    return typeof payload.email==='string'&&payload.email.toLowerCase()===env.OWNER_EMAIL.toLowerCase();
  } catch {return false}
}
async function body(request:Request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new RequestError('Send JSON.');
  const reader=request.body?.getReader();if(!reader)throw new RequestError('The request is missing.');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000){await reader.cancel();throw new RequestError('This request exceeds 2 MB. Export a backup.',413)}chunks.push(value)}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function head(env:Env,book:string) {
  return env.DB.prepare('SELECT v.* FROM study_versions v JOIN study_heads h ON h.seq=v.seq WHERE h.book=?').bind(book).first<Version>();
}
async function study(request:Request,env:Env,path:string) {
  const book=StudyStore.BOOK;
  if(path==='/api/study'&&request.method==='GET')return json({head:expose(await head(env,book))});
  if(path==='/api/study/versions'&&request.method==='GET'){
    const before=Number(new URL(request.url).searchParams.get('before')||Number.MAX_SAFE_INTEGER);
    if(!Number.isSafeInteger(before)||before<1)return json({error:'Invalid history page.'},400);
    const {results}=await env.DB.prepare('SELECT seq AS version,created,accepted FROM study_versions WHERE book=? AND seq<? ORDER BY seq DESC LIMIT 50').bind(book,before).all();
    return json({versions:results});
  }
  if(/^\/api\/study\/versions\/\d+$/.test(path)&&request.method==='GET'){
    const value=await env.DB.prepare('SELECT * FROM study_versions WHERE book=? AND seq=?').bind(book,Number(path.split('/').pop())).first<Version>();
    return value?json(expose(value)):json({error:'Saved copy not found.'},404);
  }
  if(path!=='/api/study'||request.method!=='POST')return json({error:'Not found.'},404);
  const value=await body(request);
  if(!value||value.book!==book||typeof value.id!=='string'||!/^s-[a-zA-Z0-9-]{12,100}$/.test(value.id)||!Number.isSafeInteger(value.base)||value.base<0)throw new RequestError('Invalid study revision.');
  StudyStore.validate(value.state);
  const serialized=JSON.stringify(value.state),created=new Date().toISOString();
  // D1 batch is transactional. Retain each submitted copy before comparing the
  // head, so concurrent/offline edits are recoverable even after a conflict.
  const batch=await env.DB.batch([
    env.DB.prepare('INSERT INTO study_versions (id,book,base,state,created) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(value.id,book,value.base,serialized,created),
    env.DB.prepare('INSERT INTO study_heads (book,seq) VALUES (?,0) ON CONFLICT(book) DO NOTHING').bind(book),
    env.DB.prepare('UPDATE study_heads SET seq=(SELECT seq FROM study_versions WHERE id=?) WHERE book=? AND seq=? AND EXISTS (SELECT 1 FROM study_versions WHERE id=? AND book=? AND base=? AND state=? AND accepted=0)').bind(value.id,book,value.base,value.id,book,value.base,serialized),
    env.DB.prepare('UPDATE study_versions SET accepted=1 WHERE id=? AND seq=(SELECT seq FROM study_heads WHERE book=?)').bind(value.id,book),
    env.DB.prepare('SELECT * FROM study_versions WHERE id=?').bind(value.id),
    env.DB.prepare('SELECT v.* FROM study_versions v JOIN study_heads h ON h.seq=v.seq WHERE h.book=?').bind(book)
  ]);
  const own=batch[4].results[0] as Version,current=batch[5].results[0] as Version;
  if(own.state!==serialized||own.base!==value.base||own.book!==book)return json({error:'This revision ID belongs to another saved copy.'},409);
  return json({version:own.seq,accepted:!!own.accepted,head:expose(current)},own.accepted?200:409);
}
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const url=new URL(request.url),internal=url.pathname.startsWith('/internal/');
    try {
      if(internal){
        if(!await machine(request,env))return json({error:'Sign-in required.'},401);
        // The Mac can sync study and relay replies, never fetch public assets.
        const path=url.pathname.replace('/internal/','/api/');
        return path.startsWith('/api/study')?await study(request,env,path):await assistant(request,env.DB,path,()=>body(request),true);
      }
      if(!await owner(request,env))return json({error:'Sign-in required.'},401);
      if(url.pathname.startsWith('/api/')){
        if(request.headers.get('X-Learning-Threads')!=='1'||request.headers.get('Sec-Fetch-Site')==='cross-site'||(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin))return json({error:'Open the reading app to continue.'},403);
        return url.pathname.startsWith('/api/study')?await study(request,env,url.pathname):await assistant(request,env.DB,url.pathname,()=>body(request),false);
      }
      const result=await env.ASSETS.fetch(request);
      const response=new Response(result.body,result);response.headers.set('Cache-Control','private, no-store');return response;
    } catch(error) {
      // Validation messages help recover work. Provider faults retain their exact
      // error in Worker logs, without returning private request bodies.
      if(error instanceof RequestError)return json({error:error.message},error.status);
      if(error instanceof StudyStore.StudyStorageError||error instanceof SyntaxError)return json({error:error.message},400);
      console.error(error);
      return json({error:error instanceof Error?error.message:'The study copy could not be saved.'},500);
    }
  }
} satisfies ExportedHandler<Env>;
