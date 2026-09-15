const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderText,usageHtml}=require('../web/assistant-client.js');
test('model text cannot insert HTML, scripts, or unsafe links',()=>{
  const html=renderText('<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n**Torque** and `x < y`\n\n[source](https://example.com/?x="y")');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('<strong>Torque</strong>'));assert.ok(html.includes('x &lt; y'));
  assert.ok(html.includes('&quot;y&quot;'));assert.ok(html.includes('noopener noreferrer'));
});
test('rejected questions can be edited while uncertain network outcomes retain their ID',async()=>{
  const client=require('../web/assistant-client.js'),original=global.fetch;
  try{
    global.fetch=async()=>({ok:false,status:400,text:async()=>JSON.stringify({error:'Question is too long.'})});
    await assert.rejects(()=>client.request('/api/replies',{question:'Invalid'}),error=>error.definitiveFailure===true&&error.message==='Question is too long.');
    global.fetch=async()=>({ok:false,status:503,text:async()=>JSON.stringify({error:'OpenAI is temporarily unavailable.'})});
    await assert.rejects(()=>client.request('/api/replies/existing-id'),error=>error.definitiveFailure===false);
  }finally{global.fetch=original}
});
test('text diagrams preserve whitespace without executing markup',()=>{
  const html=renderText('```text\n motor  -->  joint\n <img src=x>\n```');
  assert.equal(html,'<pre><code> motor  --&gt;  joint\n &lt;img src=x&gt;</code></pre>');
});
test('usage shows only model sums and a total, without question lists or unpriced counts',()=>{
 const html=usageHtml({models:[{model:'gpt-6-astra',usage:{input_tokens:20,output_tokens:4},cost_usd:0.01},{model:'gpt-5.6-luna',usage:{input_tokens:30,output_tokens:6},cost_usd:0.000006}],totals:{input_tokens:50,output_tokens:10},cost_usd:0.010006,calls:[{question:'Never list this question'}],unpriced_calls:6});
 for(const expected of ['Astra','Luna','Total','50','10','$0.000006','$0.010006'])assert.ok(html.includes(expected));
 for(const omitted of ['Never list this question','Unpriced','<details>','Sol','Terra'])assert.ok(!html.includes(omitted));
});
test('usage keeps unknown values distinct from zero and escapes unexpected model names',()=>{
 const html=usageHtml({models:[{model:'<img src=x>',usage:{input_tokens:0,output_tokens:null},cost_usd:null}],totals:{input_tokens:0,output_tokens:null},cost_usd:null});
 assert.ok(html.includes('<td>0</td>'));assert.ok(html.includes('<td>—</td>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('$0.0000'));
});
