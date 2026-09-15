import {spawn} from 'node:child_process';
import {readFile,writeFile,open,lstat,rename} from 'node:fs/promises';
import {instructions,resultSchema,summarizeEvents,redact,validFilename} from './protocol.mjs';

// The same durable job may reconnect after a lost exec acknowledgement. Never
// start a second Codex process for it in the surviving container.
try{await (await open('/learning/started','wx',0o600)).close()}catch(error){if(error.code==='EEXIST')process.exit(0);throw error}
const job=JSON.parse(await readFile('/learning/job.json','utf8'));
const authPath='/root/.codex/auth.json';
const originalAuth=JSON.parse(await readFile(authPath,'utf8'));
const secrets=[...Object.values(originalAuth.tokens||{}),originalAuth.OPENAI_API_KEY];
let transcript='',stderr='',timedOut=false,result;
const events=[];
try{
  if(originalAuth.auth_mode!=='chatgpt'||originalAuth.OPENAI_API_KEY||!originalAuth.tokens?.refresh_token)throw new Error('A ChatGPT OAuth login with refresh credentials is required. API keys are not accepted.');
  await writeFile('/learning/schema.json',JSON.stringify(resultSchema));
  await writeFile('/root/.codex/config.toml','forced_login_method = "chatgpt"\ncli_auth_credentials_store = "file"\n');
  const child=spawn('codex',['exec','-','--json','--skip-git-repo-check','--dangerously-bypass-approvals-and-sandbox','--model',job.configuration.model,'--config',`model_reasoning_effort=${JSON.stringify(job.configuration.reasoning)}`,'--output-schema','/learning/schema.json','--output-last-message','/learning/final.json'],{
    cwd:'/learning',env:{PATH:process.env.PATH,HOME:'/root',CODEX_HOME:'/root/.codex',PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH||'/root/.cache/ms-playwright'},stdio:['pipe','pipe','pipe'],detached:true
  });
  const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}},12*60*1000);
  child.stdin.end(instructions);
  child.stdout.on('data',chunk=>{transcript+=chunk;if(transcript.length>8_000_000)child.kill('SIGKILL')});
  child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>1_000_000)child.kill('SIGKILL')});
  const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)}).finally(()=>clearTimeout(timer));
  for(const line of transcript.split('\n').filter(Boolean)){try{events.push(JSON.parse(line))}catch(error){throw new Error('Invalid Codex event stream.',{cause:error})}}
  const summary=summarizeEvents(events);
  if(timedOut||exit!==0)throw new Error(summary.error||`Codex exited ${exit}${timedOut?' after the time limit':''}: ${stderr.slice(-2000)}`);
  const answer=JSON.parse(await readFile('/learning/final.json','utf8'));
  if(typeof answer.text!=='string'||!answer.text.trim()||answer.text.length>100000||!Array.isArray(answer.visuals)||answer.visuals.length>4)throw new Error('Codex did not return a complete teaching answer.');
  const artifacts=[];
  for(const visual of answer.visuals){
    if(!validFilename(visual.filename)||typeof visual.title!=='string'||visual.title.length>200)throw new Error('Codex returned an invalid visual name.');
    const path='/learning/output/'+visual.filename,stat=await lstat(path);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>524288)throw new Error('The visual file is invalid or exceeds 512 KB.');
    artifacts.push({...visual,html:await readFile(path,'utf8')});
  }
  result={status:'completed',text:answer.text,artifacts,...summary};
}catch(error){result={status:'failed',error:error.stack||String(error),...summarizeEvents(events)};if(!result.error)result.error=error.stack||String(error)}
// Read the auth file again even after failure. Codex can rotate tokens before a
// later tool/model failure; the Worker must persist that rotation before cleanup.
try{const auth=JSON.parse(await readFile(authPath,'utf8'));secrets.push(...Object.values(auth.tokens||{}))}catch(error){result.authReadError=error.message}
result={...result,model:job.configuration.model,reasoning:job.configuration.reasoning,provider:'codex-oauth',auth_mode:'chatgpt',cost_usd:null,cost_kind:'subscription',finished:new Date().toISOString()};
await writeFile('/learning/transcript.jsonl',redact(transcript,secrets),{mode:0o600});
await writeFile('/learning/stderr.txt',redact(stderr,secrets),{mode:0o600});
await writeFile('/learning/result.tmp',redact(JSON.stringify(result),secrets),{mode:0o600});
await rename('/learning/result.tmp','/learning/result.json');
