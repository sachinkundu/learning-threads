const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {renderText}=require('../web/assistant-client.js');
const links=require('../web/study-links.js');
const tradeoff=`| Representation | Main advantage | Main disadvantage |
|---|---|---|
| Explicit | Minimal and efficient | Singularities and discontinuities |
| Implicit | Globally well-behaved and geometrically robust | Extra variables and constraints |`;
function content(text,options){return new JSDOM('<main>'+renderText(text,options)+'</main>').window.document.querySelector('main')}
function visible(node){const copy=node.cloneNode(true);for(const syntax of copy.querySelectorAll('[hidden]'))syntax.remove();return copy.textContent.trim()}
function canonical(text){return content(text,{math:false,tables:false}).textContent}
test('the saved tradeoff renders as a semantic three-column table without changing its source',()=>{
 const text='## Main tradeoff\n\n'+tradeoff+'\n\nAfter the table.',node=content(text);
 assert.deepEqual([...node.querySelectorAll('thead th')].map(visible),['Representation','Main advantage','Main disadvantage']);
 assert.equal(node.querySelectorAll('tbody tr').length,2);
 assert.equal(node.querySelectorAll('tbody td').length,6);
 assert.equal(visible(node.querySelector('tbody tr:last-child td:last-child')),'Extra variables and constraints');
 assert.equal(links.textOf(node),canonical(text));
 assert.ok(!visible(node).includes('|---|'));
});
test('old highlights inside and after a table still link to the exact source and new cell selections match',()=>{
 const text=tradeoff+'\n\nAfter the table.',node=content(text),source=canonical(text);
 const cell=[...node.querySelectorAll('td')].find(td=>visible(td)==='Minimal and efficient'),range=node.ownerDocument.createRange();
 const words=[...cell.childNodes].find(n=>n.nodeType===3);range.setStart(words,1);range.setEnd(words,22);
 const selected=links.capture(node,range,{});assert.equal(selected.quote,'Minimal and efficient');assert.equal(selected.start,source.indexOf(selected.quote));
 const entries=['Minimal and efficient','Implicit','After the table'].map((quote,i)=>({title:quote,nodeId:'b'+i,anchor:links.anchor(source,source.indexOf(quote),source.indexOf(quote)+quote.length,{id:'a'+i})}));
 links.decorate(node,entries,e=>'https://learn.voxdez.com/?thread='+e.nodeId);
 for(const e of entries)assert.equal(visible(node.querySelector('[data-source-links="'+e.anchor.id+'"]')),e.anchor.quote);
 assert.equal(links.textOf(node),source);assert.equal(node.querySelectorAll('table').length,1);
});
test('table cells support alignment, inline markup, escaped pipes, code, and math without executing HTML',()=>{
 const text=String.raw`Name | Relation | Source
:--- | :---: | ---:
**A** | \( |x| < y \) | [Book](https://example.com/)
B\|C | `+'`x|y`'+String.raw` | <script>alert(1)</script>`;
 const node=content(text);assert.equal(node.querySelectorAll('th').length,3);
 assert.equal(node.querySelectorAll('th')[1].style.textAlign,'center');assert.equal(node.querySelectorAll('th')[2].style.textAlign,'right');
 assert.equal(node.querySelectorAll('.katex').length,1);assert.equal(node.querySelector('code').textContent,'x|y');
 assert.equal(visible(node.querySelector('tbody tr:last-child td')),'B|C');
 assert.equal(node.querySelector('strong').textContent,'A');assert.equal(node.querySelectorAll('script').length,0);
 assert.equal(node.querySelector('a').href,'https://example.com/');assert.equal(links.textOf(node),canonical(text));
});
test('fenced examples and malformed tables stay text, with no lost paragraphs around valid tables',()=>{
 for(const text of ['```markdown\n'+tradeoff+'\n```','A | B\n---|bad\nX | Y','**A | B**\n---|---\nX | Y'])assert.equal(content(text).querySelectorAll('table').length,0);
 for(const text of ['Before\n'+tradeoff+'\nAfter',tradeoff+'\nWrong | width','| A |\n|---|','| A |\n|---|\nEnd'])assert.equal(links.textOf(content(text)),canonical(text));
});
