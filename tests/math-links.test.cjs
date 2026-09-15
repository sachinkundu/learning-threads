const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {renderText}=require('../web/assistant-client.js');
const links=require('../web/study-links.js');
const equation=String.raw`\[
p(\lambda,\phi) = (\cos\phi\cos\lambda,\ \cos\phi\sin\lambda,\ \sin\phi)
\]`;
function content(html){const document=new JSDOM('<main>'+html+'</main>').window.document;return document.querySelector('main')}
const answer='Before.\n\n'+equation+'\n\nAfter the equation, **longitude** is undefined at the poles.';
test('saved sphere equation renders accessibly while canonical source text stays unchanged',()=>{
 const node=content(renderText(answer));
 assert.equal(node.querySelectorAll('.katex').length,1);
 assert.ok(node.querySelector('math'));
 assert.equal(node.querySelector('[data-math-source]').dataset.mathSource,equation);
 assert.equal(links.textOf(node),content(renderText(answer,{math:false})).textContent);
});
test('legacy highlights after and within an equation survive rendering and keep their links',()=>{
 const node=content(renderText(answer)),text=content(renderText(answer,{math:false})).textContent;
 const after=text.indexOf('longitude'),within=text.indexOf('cos');
 const entries=[{anchor:links.anchor(text,after,after+9,{id:'after'}),title:'Poles',nodeId:'b5'},
 {anchor:links.anchor(text,within,within+3,{id:'formula'}),title:'Cosine',nodeId:'b6'}];
 links.decorate(node,entries,e=>'https://learn.voxdez.com/?thread='+e.nodeId);
 assert.equal(node.querySelector('[data-source-links="after"]').textContent,'longitude');
 assert.equal(node.querySelector('[data-source-links="formula"] .katex')!==null,true);
 assert.equal(node.querySelector('[data-source-links="after"]').href,'https://learn.voxdez.com/?thread=b5');
 assert.equal(links.textOf(node),text);
 assert.equal(node.querySelectorAll('a a').length,0);
});
test('new selections count original formula offsets and select formulas atomically',()=>{
 const node=content(renderText(answer)),document=node.ownerDocument,text=links.textOf(node);
 const range=document.createRange(),longitude=node.querySelector('strong').firstChild;
 range.setStart(longitude,0);range.setEnd(longitude,longitude.length);
 assert.equal(links.capture(node,range,{}).start,text.indexOf('longitude'));
 const glyph=node.querySelector('.katex-html .mord');range.selectNodeContents(glyph);
 const selected=links.capture(node,range,{});
 assert.equal(selected.quote,equation);
 assert.equal(selected.start,text.indexOf(equation));
});
test('inline and dollar display math render; code, unsafe commands, and invalid math stay safe',()=>{
 const source=String.raw`Inline \(x^2+y^2=1\) and $$x < y$$.`;
 const node=content(renderText(source));assert.equal(node.querySelectorAll('.katex').length,2);
 assert.equal(links.textOf(node),source);
 const code='`'+equation+'`\n\n```latex\n'+equation+'\n```';
 assert.ok(!renderText(code).includes('data-math-source'));
 const unsafe=content(renderText(String.raw`\(\href{javascript:alert(1)}{x}\) \(\includegraphics{https://example.com/x}\) \(\badcommand{x}\)`));
 assert.equal(unsafe.querySelectorAll('a,img,script').length,0);
 assert.ok(unsafe.textContent.includes('badcommand'));
});

test('math never consumes Markdown element boundaries or changes legacy source text',()=>{
 for(const source of [String.raw`\[x

y\]`,String.raw`\(\text{**bold**}\)`]){
  const node=content(renderText(source));
  assert.equal(links.textOf(node),content(renderText(source,{math:false})).textContent);
 }
});
