const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderText,usageHtml}=require('../web/assistant-client.js');
test('model text cannot insert HTML, scripts, or unsafe links',()=>{
  const html=renderText('<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n**Torque** and `x < y`\n\n[source](https://example.com/?x="y")');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('<strong>Torque</strong>'));assert.ok(html.includes('x &lt; y'));
  assert.ok(html.includes('&quot;y&quot;'));assert.ok(html.includes('noopener noreferrer'));
});
test('text diagrams preserve whitespace without executing markup',()=>{
  const html=renderText('```text\n motor  -->  joint\n <img src=x>\n```');
  assert.equal(html,'<pre><code> motor  --&gt;  joint\n &lt;img src=x&gt;</code></pre>');
});
test('missing token and dollar charges are never presented as zero',()=>{
  const html=usageHtml({usage:{input_tokens:12,cached_input_tokens:0,output_tokens:null}});
  assert.ok(html.includes('<dd>12</dd>'));assert.ok(html.includes('<dd>0</dd>'));
  assert.ok(html.includes('<dt>Output tokens</dt><dd>Not reported</dd>'));
  assert.ok(html.includes('<dt>Cost</dt><dd>Not reported</dd>'));
});
