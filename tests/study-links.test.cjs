const {test}=require('node:test');
const assert=require('node:assert/strict');
const {anchor,segments,revise}=require('../web/study-links.js');

test('exact offsets distinguish repeated phrases and preserve surrounding context',()=>{
  const text='One joint turns. A second joint also turns.';
  const start=text.lastIndexOf('joint');const source=anchor(text,start,start+5,{kind:'book',page:0});
  assert.equal(source.start,26);assert.equal(source.quote,'joint');assert.equal(source.prefix,'One joint turns. A second ');assert.equal(source.suffix,' also turns.');
  assert.notEqual(source.start,text.indexOf(source.quote));
});
test('invalid and empty selections cannot silently attach elsewhere',()=>{
  for(const [start,end] of [[-1,3],[2,2],[3,9],[0.5,2]])assert.throws(()=>anchor('joint',start,end,{}));
});
test('overlapping ranges remain separately reachable and leave the remaining text alone',()=>{
  const entries=[{anchor:{id:'a',start:1,end:5}},{anchor:{id:'b',start:3,end:7}},{anchor:{id:'c',start:3,end:5}}];
  assert.deepEqual(segments(9,entries).map(s=>[s.start,s.end,s.entries.map(e=>e.anchor.id)]),[
    [0,1,[]],[1,3,['a']],[3,5,['a','b','c']],[5,7,['b']],[7,9,[]]
  ]);
});
test('completed edits keep the old text, including a deletion, without duplicate history entries',()=>{
  const history=[];const at='2026-09-14T12:00:00.000Z';
  assert.equal(revise(history,'','First note',at),'First note');assert.equal(history.length,0);
  revise(history,'First note','Second note',at);revise(history,'Second note','Second note',at);
  revise(history,'Second note','',at);
  assert.deepEqual(history.map(r=>r.text),['First note','Second note']);
});
