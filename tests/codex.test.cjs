const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,readdirSync}=require('node:fs');
const {assistant,advance,aggregateUsage}=require('../cloudflare/assistant.ts');
const {encryptAuth,decryptAuth,validateAuth,persistRefreshedAuth}=require('../codex/vault.ts');
const {frameResponse,frameAdapter}=require('../cloudflare/artifact-frame.ts');
const {summarizeEvents,redact}=require('../codex/protocol.mjs');
const {artifactHtml}=require('../web/assistant-client.js');
const {saveSettings}=require('../cloudflare/settings.ts');
function database(service){
 const raw=new DatabaseSync(':memory:');for(const name of readdirSync('cloudflare/migrations').sort())raw.exec(readFileSync('cloudflare/migrations/'+name,'utf8'));
 const DB={prepare(sql){return {bind(...values){this.values=values;return this},async first(){return raw.prepare(sql).get(...(this.values||[]))||null},async all(){return {results:raw.prepare(sql).all(...(this.values||[]))}},async run(){const r=raw.prepare(sql).run(...(this.values||[]));return {meta:{changes:Number(r.changes)}}}}}};
 return {raw,DB,CODEX_RUNNER:service,RUNNER_SCOPE:'qa',OPENAI_API_KEY:'must-never-be-used'};
}
const context={passage:'A rotation has an axis and angle.',selectedText:'axis and angle',sourceAnchor:{id:'highlight-original',start:15,end:29},ancestorConversations:[{messages:[{text:'Previous explanation',note:'Remember this'}]}],currentConversation:[]};
const payload=id=>({id,question:'Visualize this please, animation if possible',context});
const post=new Request('https://example.com/api/replies',{method:'POST'});
const ctx={waitUntil(p){p.catch(()=>{})}};
test('new replies use only OAuth, keep exact context/settings, and recover one job after a lost acknowledgement',async()=>{
 const jobs=new Map(),seen=[],original=global.fetch;global.fetch=()=>{throw new Error('Paid API calls are forbidden')};
 let lose=true;
 const env=database({async fetch(url,options){
   const id=url.split('/').pop();seen.push(url);
   if(options?.method==='POST'){const p=JSON.parse(options.body);if(jobs.has(id))assert.deepEqual(jobs.get(id).packet,p);else jobs.set(id,{packet:p});if(lose){lose=false;throw new Error('Lost acknowledgement')}}
   const packet=jobs.get(id).packet;return Response.json({id,status:'completed',text:'An animated rotation.',provider:'codex-oauth',...packet.configuration,usage:{input_tokens:1000,output_tokens:300},cost_usd:null,cost_kind:'subscription',artifacts:[{jobId:id,filename:'rotation.html',url:'/api/artifacts/'+id+'/rotation.html',title:'Rotation'}]});
 }});
 try{
   await assert.rejects(()=>assistant(post,env,'/api/replies',async()=>payload('codex-question-0001'),ctx),/Lost acknowledgement/);
   await saveSettings(env.DB,{version:0,configuration:{model:'gpt-5.6-sol',reasoning:'medium'}});
   const answer=await (await assistant(post,env,'/api/replies',async()=>payload('codex-question-0001'),ctx)).json();
   assert.equal(jobs.size,1);assert.deepEqual(jobs.values().next().value.packet.context,context);assert.equal(answer.model,'gpt-5.6-luna');assert.equal(answer.reasoning,'high');assert.equal(answer.cost_usd,null);assert.equal(answer.artifacts[0].filename,'rotation.html');
   const changed=await assistant(post,env,'/api/replies',async()=>({...payload('codex-question-0001'),question:'Changed'}),ctx);assert.equal(changed.status,409);
   const later=await (await assistant(post,env,'/api/replies',async()=>payload('codex-question-0002'),ctx)).json();assert.equal(later.model,'gpt-5.6-sol');assert.equal(later.reasoning,'medium');
   const ledger=aggregateUsage([answer,later]);assert.equal(ledger.totals.input_tokens,2000);assert.equal(ledger.cost_usd,null);assert.ok(seen.every(url=>url.includes('/qa/jobs/')));
 }finally{global.fetch=original;env.raw.close()}
});
test('OAuth failures do not fall back to an API and never resubmit legacy queued API work',async()=>{
 const env=database({fetch:async()=>Response.json({error:'Codex quota reached'},{status:503})}),original=global.fetch;let apiCalls=0;global.fetch=async()=>{apiCalls++;throw new Error('Forbidden')};
 try{
   await assert.rejects(()=>assistant(post,env,'/api/replies',async()=>payload('codex-quota-00001'),ctx),/Codex quota reached/);
   env.raw.prepare("INSERT INTO assistant_calls (id,payload,digest,status,created,provider) VALUES (?,?,'old','queued',?,'openai')").run('old-paid-job-001','{}',new Date().toISOString());
   const old=await advance(env,'old-paid-job-001');assert.equal(old.status,'failed');assert.equal(apiCalls,0);
 }finally{global.fetch=original;env.raw.close()}
});
test('OAuth credentials are authenticated encrypted data and API credentials cannot be seeded',async()=>{
 const raw=JSON.stringify({auth_mode:'chatgpt',tokens:{access_token:'secret-access-token',refresh_token:'secret-refresh-token'}}),key='k'.repeat(40);
 const encrypted=await encryptAuth(raw,key);assert.ok(!encrypted.includes('secret'));assert.equal(await decryptAuth(encrypted,key),raw);
 await assert.rejects(()=>decryptAuth(encrypted,'different'.repeat(8)));await assert.rejects(()=>encryptAuth(JSON.stringify({auth_mode:'apikey',OPENAI_API_KEY:'sk-private'}),key));
 assert.throws(()=>validateAuth('{}'),/OAuth/);
});
test('Codex usage sums complete turns without counting reasoning or cached input twice',()=>{
 const result=summarizeEvents([{type:'thread.started',thread_id:'session'},...Array.from({length:2},()=>({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:60,output_tokens:20,reasoning_output_tokens:5}}))]);
 assert.deepEqual(result.usage,{input_tokens:200,cached_input_tokens:120,output_tokens:40,reasoning_output_tokens:10,cache_write_tokens:null});assert.equal(result.session,'session');
 assert.equal(redact('failure secret-refresh-token',['secret-refresh-token']),'failure [redacted]');
});
test('refreshed credentials survive collection retries and cannot replace a newer login',async()=>{
 const auth=token=>JSON.stringify({auth_mode:'chatgpt',tokens:{access_token:'access-'+token,refresh_token:token}}),key='k'.repeat(40);
 let current={etag:'initial',value:await encryptAuth(auth('initial-refresh'),key)},lose=false;
 const files={async get(){return current?{etag:current.etag,text:async()=>current.value}:null},async put(_path,value,options){
   if(options.onlyIf.etagMatches!==current?.etag)return null;
   current={etag:current.etag+'-next',value};if(lose){lose=false;throw new Error('Lost write acknowledgement')}return {etag:current.etag};
 }};
 assert.deepEqual(await persistRefreshedAuth(files,key,'initial',auth('rotated-refresh')),{rotated:true});
 assert.equal(await decryptAuth(current.value,key),auth('rotated-refresh'));
 assert.deepEqual(await persistRefreshedAuth(files,key,'initial',auth('initial-refresh')),{rotated:false});
 assert.equal(await decryptAuth(current.value,key),auth('rotated-refresh'));
 const lease=current.etag;lose=true;
 await assert.rejects(()=>persistRefreshedAuth(files,key,lease,auth('second-refresh')),/Lost write acknowledgement/);
 await persistRefreshedAuth(files,key,lease,auth('second-refresh'));
 assert.equal(await decryptAuth(current.value,key),auth('second-refresh'));
 current={etag:'new-login',value:await encryptAuth(auth('fresh-login'),key)};
 await persistRefreshedAuth(files,key,lease,auth('second-refresh'));
 assert.equal(await decryptAuth(current.value,key),auth('fresh-login'));
});
test('frame sizing preserves the visual source and its isolation policy',async()=>{
 const source='<!doctype html><html><body>A visual</body></html>',csp="sandbox allow-scripts; connect-src 'none'";
 const response=await frameResponse(new Response(source,{headers:{'Content-Security-Policy':csp,'Content-Length':String(source.length)}}));
 assert.equal(await response.text(),source+frameAdapter);assert.equal(response.headers.get('Content-Security-Policy'),csp);assert.equal(response.headers.has('Content-Length'),false);
 const missing=new Response('Missing',{status:404});assert.equal(await frameResponse(missing),missing);
});
test('visual embeds use only immutable local paths and opaque script-only frames',()=>{
 const html=artifactHtml([{jobId:'codex-question-0001',filename:'rotation.html',title:'<script>',url:'https://evil.example'}]);
 assert.ok(html.includes('sandbox="allow-scripts"'));assert.ok(!html.includes('allow-same-origin'));assert.ok(html.includes('/api/artifacts/codex-question-0001/rotation.html'));assert.ok(!html.includes('evil.example'));assert.ok(!html.includes('<script>'));
 assert.equal(artifactHtml([{jobId:'../../secret',filename:'auth.html'}]),'');assert.equal(artifactHtml([{jobId:'codex-question-0001',filename:'../auth.html'}]),'');
});
