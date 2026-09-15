const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync}=require('node:fs');
const {responseBody,resultOf,estimateCost,tokenUsage,MODEL,PRICES,openaiRequest}=require('../cloudflare/openai.ts');
const {assistant,advance,collectReplies}=require('../cloudflare/assistant.ts');
const {build}=require('../web/assistant-context.js');
const Book=require('../web/book.js');
function database(){
  const raw=new DatabaseSync(':memory:');
  for(const name of ['0001_study.sql','0002_assistant.sql','0003_openai_assistant.sql'])raw.exec(readFileSync(new URL('../cloudflare/migrations/'+name,'file://'+__filename),'utf8'));
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
 const env=database(),original=global.fetch;let creates=0;global.fetch=async()=>{creates++;return response(done())};
 const tasks=[],ctx={waitUntil:p=>tasks.push(p)},id='call-request-0001',req=new Request('https://example.com/api/replies',{method:'POST'});
 try{
  const a=await assistant(req,env,'/api/replies',async()=>packet(id),ctx);assert.equal(a.status,202);
  const b=await assistant(req,env,'/api/replies',async()=>packet(id),ctx);assert.equal(b.status,200);
  const c=await assistant(req,env,'/api/replies',async()=>({...packet(id),context:{...context,selectedText:'Changed'}}),ctx);assert.equal(c.status,409);assert.equal(creates,1);
  const ledger=await (await assistant(new Request('https://example.com/api/usage'),env,'/api/usage',async()=>null,ctx)).json();assert.equal(ledger.calls.length,1);assert.ok(ledger.cost_usd>0);
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
