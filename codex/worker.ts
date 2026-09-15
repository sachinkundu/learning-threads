import {DurableObject} from 'cloudflare:workers';
import {getSandbox} from '@cloudflare/sandbox';
import {decryptAuth,persistRefreshedAuth} from './vault.ts';
import {validFilename} from './protocol.mjs';
import Models from '../web/assistant-models.js';
export {Sandbox} from '@cloudflare/sandbox';

interface RunnerEnv extends CodexEnv {CODEX_AUTH_ENCRYPTION_KEY:string}

type Packet={configuration:{model:string;reasoning:string};question:string;context:Record<string,unknown>};
type Job={id:string;tenant:string;packet:string;status:string;phase:string;created:number;started:number|null;process:string|null;auth_etag:string|null;auth_saved:number;result:string|null;error:string|null};
type Visual={filename:string;title:string;html:string};
type Result={status:string;text?:string;error?:string;artifacts?:Visual[];[key:string]:unknown};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const keyOf=(tenant:string,id:string)=>`${tenant}/${id}`;
const view=(job:Job):Record<string,unknown>=>({id:job.id,status:job.status==='starting'?'running':job.status,...JSON.parse(job.packet).configuration,...(job.result?JSON.parse(job.result):{})});

// One coordinator per login, shared by the private QA and production service
// bindings. Only alarms launch/collect processes, serializing token refresh.
export class CodexAccount extends DurableObject<RunnerEnv>{
  constructor(ctx:DurableObjectState,env:RunnerEnv){
    super(ctx,env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS jobs (
      id TEXT NOT NULL,tenant TEXT NOT NULL,packet TEXT NOT NULL,status TEXT NOT NULL,
      phase TEXT NOT NULL,created INTEGER NOT NULL,started INTEGER,process TEXT,
      auth_etag TEXT,auth_saved INTEGER NOT NULL DEFAULT 0,result TEXT,error TEXT,
      PRIMARY KEY(tenant,id))`);
  }
  private row(tenant:string,id:string){return this.ctx.storage.sql.exec<Job>('SELECT * FROM jobs WHERE tenant=? AND id=?',tenant,id).toArray()[0]||null}
  private async wake(){if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+1000)}
  async submit(tenant:string,id:string,packet:Packet):Promise<Record<string,unknown>>{
    const serialized=JSON.stringify(packet),old=this.row(tenant,id);
    if(old){if(old.packet!==serialized)throw new Error('This Codex job ID belongs to different context.');await this.wake();return view(old)}
    if(!Models.valid(packet.configuration)||typeof packet.question!=='string'||!packet.question.trim()||!packet.context||serialized.length>300000)throw new Error('Invalid Codex learning packet.');
    if(!this.env.CODEX_AUTH_ENCRYPTION_KEY||!await this.env.FILES.head('credentials/auth.v1.enc'))throw new Error('Codex login is not configured. Reconnect the cloud Codex login.');
    this.ctx.storage.sql.exec("INSERT INTO jobs (id,tenant,packet,status,phase,created) VALUES (?,?,?,'queued','queued',?)",id,tenant,serialized,Date.now());
    await this.wake();return view(this.row(tenant,id)!);
  }
  async status(tenant:string,id:string):Promise<Record<string,unknown>|null>{const row=this.row(tenant,id);if(row&&['queued','starting','running'].includes(row.status))await this.wake();return row?view(row):null}
  private patch(job:Job,values:Partial<Job>){
    const entries=Object.entries(values);this.ctx.storage.sql.exec('UPDATE jobs SET '+entries.map(([k])=>k+'=?').join(',')+' WHERE tenant=? AND id=?',...entries.map(([,v])=>v),job.tenant,job.id);
    Object.assign(job,values);
  }
  private async previous(job:Job,sandbox:ReturnType<typeof getSandbox>){
    const packet=JSON.parse(job.packet) as Packet,found=new Map<string,{jobId:string;filename:string}>();
    const visit=(value:unknown)=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){value.forEach(visit);return}
      const v=value as Record<string,unknown>;
      if(typeof v.jobId==='string'&&validFilename(v.filename)&&typeof v.filename==='string')found.set(v.jobId+'/'+v.filename,{jobId:v.jobId,filename:v.filename});
      Object.values(v).forEach(visit);
    };
    visit(packet.context);if(found.size>24)throw new Error('This question refers to more than 24 visuals. Start a closer follow-up.');
    const manifest=[];
    for(const ref of found.values()){
      const prior=this.row(job.tenant,ref.jobId);
      if(!prior||prior.status!=='completed'||!JSON.parse(prior.result||'{}').artifacts?.some((a:{filename:string})=>a.filename===ref.filename))throw new Error('A referenced visual is not part of this saved study.');
      const object=await this.env.FILES.get('artifacts/'+keyOf(job.tenant,ref.jobId)+'/'+ref.filename);
      if(!object)throw new Error('A prior visual file is missing.');
      const path='/learning/previous/'+ref.jobId+'-'+ref.filename;
      await sandbox.writeFile(path,await object.text());manifest.push({...ref,path});
    }
    await sandbox.writeFile('/learning/previous/manifest.json',JSON.stringify(manifest));
  }
  async alarm(){
    // Set the next wake before external I/O, including cold container startup.
    // Cloudflare serializes alarm handlers; HTTP status calls never launch work.
    let job=this.ctx.storage.sql.exec<Job>("SELECT * FROM jobs WHERE status IN ('starting','running') ORDER BY created LIMIT 1").toArray()[0];
    if(!job)job=this.ctx.storage.sql.exec<Job>("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").toArray()[0];
    const cleanup=this.ctx.storage.sql.exec<Job>("SELECT * FROM jobs WHERE phase='cleanup'").toArray();
    if(!job&&!cleanup.length)return;
    await this.ctx.storage.setAlarm(Date.now()+5000);
    for(const old of cleanup){
      try{await getSandbox(this.env.Sandbox,'lt-'+old.tenant+'-'+old.id).destroy();this.patch(old,{phase:'finished'})}
      catch(error){console.error('Codex sandbox cleanup retry failed',old.id,error)}
    }
    if(!job)return;
    const sandbox=getSandbox(this.env.Sandbox,'lt-'+job.tenant+'-'+job.id,{keepAlive:true});
    try{
      if(job.phase==='queued')this.patch(job,{status:'starting',phase:'preparing',started:Date.now()});
      if(job.phase==='preparing'){
        const auth=await this.env.FILES.get('credentials/auth.v1.enc');
        if(!auth)throw new Error('Codex OAuth credentials are missing.');
        const plaintext=await decryptAuth(await auth.text(),this.env.CODEX_AUTH_ENCRYPTION_KEY);
        const packet=JSON.parse(job.packet) as Packet;
        await sandbox.setKeepAlive(true);
        await sandbox.mkdir('/root/.codex',{recursive:true});
        await sandbox.mkdir('/learning/output',{recursive:true});
        await sandbox.mkdir('/learning/previous',{recursive:true});
        await sandbox.writeFile('/root/.codex/auth.json',plaintext);
        await sandbox.writeFile('/learning/job.json',JSON.stringify({configuration:packet.configuration}));
        await sandbox.writeFile('/learning/context.json',JSON.stringify(packet.context));
        await sandbox.writeFile('/learning/question.txt',packet.question);
        await this.previous(job,sandbox);
        this.patch(job,{phase:'launching',auth_etag:auth.etag});
        const process=await sandbox.exec(['node','/opt/learning/supervisor.mjs'],{cwd:'/learning',timeout:13*60*1000});
        this.patch(job,{status:'running',phase:'running',process:process.id});
        return;
      }
      if(job.phase==='launching'){
        // An ambiguous launch is recovered from the existing process, never
        // repeated in a new container where its completion cannot be proved.
        const process=(await sandbox.listProcesses()).find(p=>p.command.includes('/opt/learning/supervisor.mjs'));
        if(!process)throw new Error('Codex launch could not be recovered. The job was not sent again.');
        this.patch(job,{status:'running',phase:'running',process:process.id});
      }
      if(job.phase==='running'){
        const process=job.process?await sandbox.getProcess(job.process):null;
        if(!process)throw new Error('The Codex container stopped before the answer was collected. Retry the saved question.');
        const status=await process.status();
        if(status.state==='running'){
          if(Date.now()-job.started!>14*60*1000){await process.kill(9);throw new Error('Codex exceeded the 14-minute job limit.')}
          return;
        }
        this.patch(job,{phase:'collecting'});
      }
      if(job.phase==='collecting'){
        // Persist refresh before publishing the answer or permitting the next
        // job. Retrying collection cannot spend tokens a second time.
        await this.persistAuth(job,sandbox);
        const raw=(await sandbox.readFile('/learning/result.json',{encoding:'utf8'})).content;
        if(raw.length>2_500_000)throw new Error('Codex output exceeds the supported size.');
        const result=JSON.parse(raw) as Result,artifacts=[];
        for(const visual of result.artifacts||[]){
          if(!validFilename(visual.filename)||typeof visual.html!=='string'||new TextEncoder().encode(visual.html).length>524288)throw new Error('Invalid visual output.');
          const path='artifacts/'+keyOf(job.tenant,job.id)+'/'+visual.filename;
          await this.env.FILES.put(path,visual.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
          const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(visual.html));
          artifacts.push({jobId:job.id,filename:visual.filename,title:visual.title,sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),url:'/api/artifacts/'+job.id+'/'+visual.filename});
        }
        const transcript=(await sandbox.readFile('/learning/transcript.jsonl',{encoding:'utf8'})).content;
        await this.env.FILES.put('private/'+keyOf(job.tenant,job.id)+'/transcript.jsonl',transcript);
        await this.env.FILES.put('private/'+keyOf(job.tenant,job.id)+'/context.json',job.packet);
        const saved={...result,artifacts,auth_persisted:true,auth_rotated:job.auth_saved===2,cloud_runtime_ms:Date.now()-job.started!};
        this.patch(job,{status:result.status==='completed'?'completed':'failed',phase:'cleanup',result:JSON.stringify(saved)});
      }
    }catch(error){
      const detail=error instanceof Error?error.stack||error.message:String(error);
      console.error('Codex job step failed',job.id,job.phase,detail);
      this.patch(job,{error:detail});
      // Short control-plane outages retry the same phase. A lost process or
      // exhausted deadline ends the job, with the original error preserved.
      if(Date.now()-job.started!<15*60*1000&&!/could not be recovered|container stopped|job limit|referenced visual|prior visual|OAuth credentials are missing/.test(detail))return;
      let authError:string|null=null;
      try{await this.persistAuth(job,sandbox)}catch(refreshError){authError=refreshError instanceof Error?refreshError.message:String(refreshError);console.error('Codex credential recovery failed',job.id,authError)}
      const packet=JSON.parse(job.packet) as Packet;
      this.patch(job,{status:'failed',phase:'cleanup',result:JSON.stringify({error:detail,...packet.configuration,provider:'codex-oauth',cost_kind:'subscription',cost_usd:null,usage:null,auth_recovery_error:authError,finished:new Date().toISOString()})});
    }
    if(job.phase==='cleanup'){
      try{await sandbox.destroy();this.patch(job,{phase:'finished'})}
      catch(error){console.error('Codex sandbox cleanup failed',job.id,error)}
    }
  }

  private async persistAuth(job:Job,sandbox:ReturnType<typeof getSandbox>){
    if(job.auth_saved||!job.auth_etag)return;
    const raw=(await sandbox.readFile('/root/.codex/auth.json',{encoding:'utf8'})).content;
    const saved=await persistRefreshedAuth(this.env.FILES,this.env.CODEX_AUTH_ENCRYPTION_KEY,job.auth_etag,raw);
    this.patch(job,{auth_saved:saved.rotated?2:1});
  }
  async artifact(tenant:string,id:string,filename:string):Promise<string|null>{
    const job=this.row(tenant,id);
    if(!job||job.status!=='completed'||!JSON.parse(job.result||'{}').artifacts?.some((a:{filename:string})=>a.filename===filename))return null;
    const object=await this.env.FILES.get('artifacts/'+keyOf(tenant,id)+'/'+filename);
    return object?await object.text():null;
  }
}
export default {
  async fetch(request:Request,env:RunnerEnv){
    // This Worker has no public route. Only private service bindings can call it.
    const parts=new URL(request.url).pathname.split('/').filter(Boolean),[tenant,kind,id,filename]=parts;
    if(!['qa','production'].includes(tenant)||!id||!/^[-a-zA-Z0-9]{12,100}$/.test(id))return json({error:'Invalid job path.'},400);
    const account=env.ACCOUNT.getByName('owner');
    try{
      if(kind==='jobs'&&request.method==='POST')return json(await account.submit(tenant,id,await request.json() as Packet),202);
      if(kind==='jobs'&&request.method==='GET'){const job=await account.status(tenant,id);return job?json(job):json({error:'Codex reply not found.'},404)}
      if(kind==='artifacts'&&request.method==='GET'&&validFilename(filename)){
        const html=await account.artifact(tenant,id,filename);return html===null?json({error:'Visual not found.'},404):new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",'X-Content-Type-Options':'nosniff'}});
      }
      return json({error:'Not found.'},404);
    }catch(error){console.error('Codex service request failed',error);return json({error:error instanceof Error?error.message:String(error)},503)}
  }
} satisfies ExportedHandler<RunnerEnv>;
