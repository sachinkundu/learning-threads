const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync}=require('node:fs');
const {responseBody,resultOf,estimateCost,tokenUsage,pricing,openaiRequest}=require('../cloudflare/openai.ts');
const Models=require('../web/assistant-models.js');
const {getSettings,saveSettings}=require('../cloudflare/settings.ts');
const MODEL=Models.legacy.model,PRICES=pricing(MODEL);
const {assistant,advance,collectReplies}=require('../cloudflare/assistant.ts');
const {build}=require('../web/assistant-context.js');
const Book=require('../web/book.js');
function database(){
  const raw=new DatabaseSync(':memory:');
  for(const name of ['0001_study.sql','0002_assistant.sql','0003_openai_assistant.sql','0004_assistant_settings.sql'])raw.exec(readFileSync(new URL('../cloudflare/migrations/'+name,'file://'+__filename),'utf8'));
  const db={prepare(sql){return {bind(...values){this.values=values;return this},async first(){return raw.prepare(sql).get(...(this.values||[]))||null},async all(){return {results:raw.prepare(sql).all(...(this.values||[]))}},async run(){const r=raw.prepare(sql).run(...(this.values||[]));return {meta:{changes:Number(r.changes)}}}}}};
  return {DB:db,OPENAI_API_KEY:'test-key',raw};
}
const done=(id='resp_test')=>({id,status:'completed',model:MODEL,service_tier:'default',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'The prior answer describes motor torque.'}]}],usage:{input_tokens:1000,input_tokens_details:{cached_tokens:200,cache_write_tokens:300},output_tokens:100,output_tokens_details:{reasoning_tokens:30}}});
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','x-request-id':'req_test'}});
const context={book:'Modern Robotics',passage:'Motors move links.',selectedText:'Motors',replyTo:'m2',ancestorConversations:[{messages:[{role:'assistant',text:'A remembered explanation'}]}],currentConversation:[{role:'user',text:'How?'},{role:'assistant',text:'With torque.'}]};
const packet=id=>({id,question:'How does this relate to the previous answer?',context});
function insert(env,id='call-test-000001',overrides={}){
 const body=packet(id),payload={question:body.question,context:body.context};
 const values={id,payload:JSON.stringify(payload),digest:'unused',status:'queued',created:new Date().toISOString(),provider:'openai',pricing:JSON.stringify(PRICES),...overrides};
 const keys=Object.keys(values);env.raw.prepare('INSERT INTO assistant_calls ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...Object.values(values));return id;
}
test('a nested follow-up carries the exact book, highlight, notes, ancestors, and reply visuals',()=>{
 const paragraph=Book.paragraphs[2],root=Book.root(2),branch={...Book.root(2),id:'b1',parent:'p2',path:[{title:'Movement'}],sourceQuote:'An older preview quote',sourceAnchor:{quote:'robots'}};
 root.messages=[{id:'m1',role:'user',text:'Why?'},{id:'m2',role:'assistant',text:'Because',note:'My thought',visualization:{type:'wrist',values:[1,2,3]}}];
 const question={id:'m5',role:'user',text:'Explain that',replyTo:'m4',sourceAnchor:{kind:'message',nodeId:'b1',messageId:'m4',start:3,end:9,quote:'torque'}};
 branch.messages=[{id:'m3',role:'user',text:'How?'},{id:'m4',role:'assistant',text:'By torque'},question];
 const built=build({paragraph,node:branch,message:question,nodes:new Map([['p2',root],['b1',branch]]),paragraphNote:'Remember the physical body.',visual:{joint:'R',angle:40},messageText:m=>m.text});
 assert.equal(built.passage,paragraph.text);assert.equal(built.paragraphId,paragraph.id);assert.equal(built.paragraphNote,'Remember the physical body.');
 assert.deepEqual(built.sourceAnchor,question.sourceAnchor);assert.equal(built.replyTo,'m4');assert.equal(built.currentConversation.length,2);
 assert.equal(built.branchSourceText,'robots');assert.deepEqual(built.branchSourceAnchor,branch.sourceAnchor);
 assert.equal(built.ancestorConversations[0].messages[1].note,'My thought');assert.deepEqual(built.ancestorConversations[0].messages[1].visualization,{type:'wrist',values:[1,2,3]});
 const body=responseBody({question:question.text,context:built},'call-context-0001');
 assert.deepEqual(JSON.parse(body.input[0].content.split('\n').slice(1).join('\n')),built);
 assert.equal(body.input[1].content,'Learner question:\nExplain that');assert.equal(body.truncation,'disabled');assert.equal(body.previous_response_id,undefined);
});
test('cost counts ordinary, cached, and written input once, and reasoning as part of output',()=>{
 const result=resultOf(done());assert.deepEqual(result.usage,{input_tokens:1000,cached_input_tokens:200,cache_write_tokens:300,output_tokens:100,reasoning_output_tokens:30});
 assert.ok(Math.abs(result.cost_usd-0.01395)<1e-12);assert.equal(result.cost_kind,'estimated');
 const long=estimateCost({...result.usage,input_tokens:300000},MODEL,'default');assert.equal(long.rates.input,20);assert.equal(long.rates.output,75);
 assert.equal(estimateCost({...result.usage,cached_input_tokens:null},MODEL,'default'),null);
 assert.equal(estimateCost(result.usage,MODEL,'priority'),null);assert.equal(estimateCost(result.usage,'unknown-model','default'),null);
 assert.equal(tokenUsage(null),null);assert.equal(resultOf({...done(),status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}).status,'failed');
});
test('concurrent callers start one OpenAI response and later recover its exact result',async()=>{
 const env=database(),id=insert(env);let creates=0,polls=0,release;const gate=new Promise(r=>release=r);
 const fetcher=async(url,options)=>{if(options.method==='POST'){creates++;await gate;return response({id:'resp_test',status:'queued',model:MODEL})}polls++;return response(done())};
 const first=advance(env,id,fetcher);await new Promise(r=>setImmediate(r));const second=await advance(env,id,fetcher);assert.equal(second.status,'running');release();await first;
 assert.equal(creates,1);env.raw.prepare('UPDATE assistant_calls SET poll_after=0').run();
 const final=await advance(env,id,fetcher);assert.equal(final.status,'completed');assert.equal(polls,1);assert.equal(final.provider_id,'resp_test');
 await advance(env,id,fetcher);assert.equal(creates,1);assert.equal(polls,1);env.raw.close();
});
test('a lost submission is not silently sent again, and its uncertainty is retained',async()=>{
 const env=database(),id=insert(env);let creates=0;
 const network=async()=>{creates++;throw new TypeError('Connection lost')};
 const call=await advance(env,id,network);assert.equal(call.status,'failed');assert.equal(JSON.parse(call.result).submission_uncertain,true);
 await advance(env,id,network);assert.equal(creates,1);env.raw.close();
});
test('an interrupted submission remains recoverable without another paid request',async()=>{
 const env=database(),id=insert(env,'call-interrupt-001',{status:'running',submission_started:'2026-01-01T00:00:00Z'});
 const call=await advance(env,id,async()=>{throw new Error('Must not send')});assert.equal(call.status,'failed');assert.equal(JSON.parse(call.result).submission_uncertain,true);env.raw.close();
});
test('a transient retrieval error retains the provider ID for a safe reconnect',async()=>{
 const env=database(),id=insert(env,'call-retrieve-001',{status:'running',provider_id:'resp_test',submission_started:new Date().toISOString()});
 await assert.rejects(()=>advance(env,id,async()=>{throw new TypeError('Offline')}),/Offline/);
 const row=env.raw.prepare('SELECT * FROM assistant_calls').get();assert.equal(row.status,'running');assert.equal(row.provider_id,'resp_test');
 env.raw.prepare('UPDATE assistant_calls SET poll_after=0').run();assert.equal((await advance(env,id,async()=>response(done()))).status,'completed');env.raw.close();
});
test('duplicate request IDs cannot change the context or create another charge',async()=>{
 const env=database(),original=global.fetch;let creates=0;global.fetch=async(_url,options)=>{creates++;const body=JSON.parse(options.body);return response({...done(),model:body.model,reasoning:body.reasoning})};
 const tasks=[],ctx={waitUntil:p=>tasks.push(p)},id='call-request-0001',req=new Request('https://example.com/api/replies',{method:'POST'});
 try{
  const a=await assistant(req,env,'/api/replies',async()=>packet(id),ctx);assert.equal(a.status,202);
  const b=await assistant(req,env,'/api/replies',async()=>packet(id),ctx);assert.equal(b.status,200);
  const c=await assistant(req,env,'/api/replies',async()=>({...packet(id),context:{...context,selectedText:'Changed'}}),ctx);assert.equal(c.status,409);assert.equal(creates,1);
  const ledger=await (await assistant(new Request('https://example.com/api/usage'),env,'/api/usage',async()=>null,ctx)).json();assert.equal(env.raw.prepare('SELECT COUNT(*) AS count FROM assistant_calls').get().count,1);assert.equal(ledger.models.length,1);assert.ok(ledger.cost_usd>0);
 }finally{await Promise.allSettled(tasks);global.fetch=original;env.raw.close()}
});
test('the scheduled collector saves answers with no browser and no Mac',async()=>{
 const env=database(),id=insert(env,'call-background-001',{status:'running',provider_id:'resp_test',submission_started:new Date().toISOString()}),original=global.fetch;
 try{global.fetch=async()=>response(done());await collectReplies(env);assert.equal(env.raw.prepare('SELECT status FROM assistant_calls WHERE id=?').get(id).status,'completed')}
 finally{global.fetch=original;env.raw.close()}
});
test('legacy completed answers remain available, while interrupted CLI calls are not rerun',async()=>{
 const env=database();insert(env,'call-legacy-0001',{provider:'codex',status:'completed',result:JSON.stringify({text:'Keep my answer',usage:{input_tokens:12},cost_usd:null})});
 const id=insert(env,'call-legacy-0002',{provider:'codex'});const call=await advance(env,id,async()=>{throw new Error('Do not reissue')});assert.equal(call.status,'failed');
 assert.equal(JSON.parse(env.raw.prepare('SELECT result FROM assistant_calls WHERE id=?').get('call-legacy-0001').result).text,'Keep my answer');env.raw.close();
});
test('OpenAI errors preserve the provider reason and request ID but redact credentials',async()=>{
 await assert.rejects(()=>openaiRequest('sk-private-key','',{},'call-test',async()=>response({error:{message:'Incorrect API key: sk-private-key'}},401)),error=>error.message==='Incorrect API key: [redacted]'&&error.requestId==='req_test');
});
test('settings default to Luna high and accept only each model’s supported API efforts',async()=>{
 const env=database();
 try{
  assert.deepEqual(await getSettings(env.DB),{version:0,configuration:{model:'gpt-5.6-luna',reasoning:'high'}});
  let version=0;
  for(const model of Models.models)for(const reasoning of model.efforts){
   const configuration={model:model.id,reasoning};
   const saved=await saveSettings(env.DB,{version,configuration});version=saved.version;
   assert.deepEqual((await getSettings(env.DB)).configuration,configuration);
   const body=responseBody(packet('supported-model'), 'supported-model',configuration);
   assert.equal(body.model,model.id);assert.equal(body.reasoning.effort,reasoning);
  }
  for(const configuration of [{model:MODEL,reasoning:'none'},{model:'invented',reasoning:'high'},{model:'gpt-5.6-luna',reasoning:'ultra'}])
   await assert.rejects(()=>saveSettings(env.DB,{version,configuration}),/supported model and reasoning/);
  assert.equal((await getSettings(env.DB)).version,version);
 }finally{env.raw.close()}
});
test('two devices cannot silently overwrite settings and a lost save acknowledgement can be retried',async()=>{
 const env=database();
 try{
  const first=await getSettings(env.DB),second=await getSettings(env.DB);
  const a={...first,configuration:{model:'gpt-5.6-terra',reasoning:'medium'}};
  const saved=await saveSettings(env.DB,a);assert.equal(saved.version,1);
  assert.deepEqual(await saveSettings(env.DB,a),saved);
  await assert.rejects(()=>saveSettings(env.DB,{...second,configuration:{model:MODEL,reasoning:'low'}}),e=>e.status===409);
  assert.deepEqual(await getSettings(env.DB),saved);
 }finally{env.raw.close()}
});
test('settings changes affect new replies while a pending reply keeps its context, model, reasoning, and price',async()=>{
 const env=database(),original=global.fetch,creates=[],tasks=[],ctx={waitUntil:p=>tasks.push(p)};
 const post=new Request('https://example.com/api/replies',{method:'POST'}),settingsPost=new Request('https://example.com/api/settings',{method:'POST'});
 global.fetch=async(_url,options)=>{
  if(options.method==='POST'){const body=JSON.parse(options.body);creates.push(body);return response({id:'resp_'+creates.length,status:'queued',model:body.model,reasoning:body.reasoning})}
  return response({...done('resp_1'),model:'gpt-5.6-luna',reasoning:{effort:'high'}});
 };
 try{
  const id='call-settings-0001';
  const first=await (await assistant(post,env,'/api/replies',async()=>packet(id),ctx)).json();
  assert.equal(first.model,'gpt-5.6-luna');assert.equal(first.reasoning,'high');
  assert.deepEqual(JSON.parse(creates[0].input[0].content.split('\n').slice(1).join('\n')),context);
  const saved=await (await assistant(settingsPost,env,'/api/settings',async()=>({version:0,configuration:{model:'gpt-5.6-sol',reasoning:'medium'}}),ctx)).json();
  assert.equal(saved.configuration.model,'gpt-5.6-sol');
  env.raw.prepare('UPDATE assistant_calls SET poll_after=0').run();
  const recovered=await (await assistant(post,env,'/api/replies',async()=>packet(id),ctx)).json();
  assert.equal(recovered.status,'completed');assert.equal(recovered.model,'gpt-5.6-luna');assert.equal(recovered.reasoning,'high');
  assert.ok(Math.abs(recovered.cost_usd-0.000299)<1e-12);assert.equal(creates.length,1);
  await assistant(post,env,'/api/replies',async()=>packet('call-settings-0002'),ctx);
  assert.equal(creates.length,2);assert.equal(creates[1].model,'gpt-5.6-sol');assert.equal(creates[1].reasoning.effort,'medium');
  const row=env.raw.prepare('SELECT * FROM assistant_calls WHERE id=?').get(id);
  assert.deepEqual(JSON.parse(row.configuration),Models.defaults);assert.equal(JSON.parse(row.pricing).model,'gpt-5.6-luna');
  assert.deepEqual(JSON.parse(row.payload).context,context);
 }finally{await Promise.allSettled(tasks);global.fetch=original;env.raw.close()}
});
test('pre-settings OpenAI jobs retain Astra low after the new Luna default',async()=>{
 const env=database(),id=insert(env);let submitted;
 try{
  await saveSettings(env.DB,{version:0,configuration:{model:'gpt-5.6-luna',reasoning:'high'}});
  const call=await advance(env,id,async(_url,options)=>{submitted=JSON.parse(options.body);return response(done())});
  assert.equal(submitted.model,MODEL);assert.equal(submitted.reasoning.effort,'low');
  const result=JSON.parse(call.result);assert.equal(result.reasoning,'low');assert.ok(Math.abs(result.cost_usd-0.01395)<1e-12);
 }finally{env.raw.close()}
});
test('each model uses its own price and a different returned model cannot be charged at the requested model’s rate',()=>{
 const usage=tokenUsage(done().usage);
 for(const [model,expected] of [['gpt-6-astra',0.01395],['gpt-5.6-sol',0.00558],['gpt-5.6-terra',0.00299],['gpt-5.6-luna',0.000299]]){
  const cost=estimateCost(usage,model+'-2026-09-15','default',pricing(model));
  assert.ok(Math.abs(cost.usd-expected)<1e-12);
  const long=estimateCost({...usage,input_tokens:300000},model,'default');
  assert.equal(long.rates.input,pricing(model).input*2);assert.equal(long.rates.output,pricing(model).output*1.5);
 }
 assert.equal(estimateCost(usage,MODEL,'default',pricing('gpt-5.6-luna')),null);
});

test('usage sums each used model and all recorded charges, including failed charged calls',async()=>{
 const env=database();
 insert(env,'usage-astra-0001',{status:'completed',result:JSON.stringify({model:'gpt-6-astra',usage:{input_tokens:100,output_tokens:10,cached_input_tokens:20},cost_usd:0.003})});
 insert(env,'usage-astra-0002',{status:'completed',provider:'codex',result:JSON.stringify({model:'gpt-6-astra',usage:{input_tokens:40,output_tokens:5},cost_usd:null})});
 insert(env,'usage-luna-00001',{status:'completed',result:JSON.stringify({model:'gpt-5.6-luna',usage:{input_tokens:200,output_tokens:30,reasoning_output_tokens:10},cost_usd:0.0001})});
 insert(env,'usage-luna-00002',{status:'failed',result:JSON.stringify({model:'gpt-5.6-luna',usage:{input_tokens:20,output_tokens:2},cost_usd:0.00001})});
 insert(env,'usage-sol-pending',{configuration:JSON.stringify({model:'gpt-5.6-sol',reasoning:'high'})});
 const response=await assistant(new Request('https://learn.example/api/usage'),env,'/api/usage',async()=>null,{waitUntil(){}}),ledger=await response.json();
 assert.deepEqual(ledger.models.map(m=>m.model),['gpt-6-astra','gpt-5.6-luna']);
 assert.equal(ledger.models[0].usage.input_tokens,140);assert.equal(ledger.models[1].usage.input_tokens,220);
 assert.equal(ledger.models[1].usage.output_tokens,32);assert.equal(ledger.models[1].usage.reasoning_output_tokens,10);
 assert.equal(ledger.totals.input_tokens,360);assert.equal(ledger.totals.output_tokens,47);
 assert.ok(Math.abs(ledger.cost_usd-0.00311)<1e-12);
 assert.equal(ledger.unpriced_calls,undefined);assert.deepEqual(ledger.calls,[]);
 assert.ok(!JSON.stringify(ledger).includes('How does this relate'));
 env.raw.close();
});
test('usage has no unused model rows and does not invent zero costs for old unpriced records',()=>{
 const {aggregateUsage}=require('../cloudflare/assistant.ts');
 assert.deepEqual(aggregateUsage([]).models,[]);assert.equal(aggregateUsage([]).cost_usd,0);assert.deepEqual(aggregateUsage([{status:'completed',usage:null,cost_usd:null}]).models,[]);
 const ledger=aggregateUsage([{status:'completed',model:'gpt-6-astra',usage:{input_tokens:10},cost_usd:null}]);
 assert.equal(ledger.models[0].cost_usd,null);assert.equal(ledger.cost_usd,null);assert.equal(ledger.totals.output_tokens,null);
});
