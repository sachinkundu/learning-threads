const {test}=require('node:test');
const assert=require('node:assert/strict');
const routes=require('../web/study-route.js');
const book='modern-robotics-2019-preprint';
const nodes=new Map([['p12',{id:'p12',messages:[]}],['b5',{id:'b5',messages:[{id:'m20',text:'Saved answer'}]}]]);
test('existing discussion and exact answer URLs round trip without changing their IDs',()=>{
 const url=routes.href('https://learn.voxdez.com/?example=wrist#settings',{book,thread:'b5',message:'m20'});
 assert.equal(url,'https://learn.voxdez.com/?book='+book+'&thread=b5&message=m20');
 assert.equal(routes.resolve(routes.parse(url),book,nodes).message.text,'Saved answer');
 assert.equal(routes.resolve(routes.parse(routes.href(url,{book,thread:'p12'})),book,nodes).node.id,'p12');
});
test('unknown or malformed links never silently open another discussion',()=>{
 assert.equal(routes.parse('https://learn.voxdez.com/'),null);
 for(const query of ['thread=b5','book='+book+'&thread=b5&thread=p12','book='+book+'&thread=%3Cscript%3E','book='+book+'&thread=b5&message='])assert.throws(()=>routes.parse('https://learn.voxdez.com/?'+query));
 for(const route of [{book:'another-book',thread:'b5'},{book,thread:'missing'},{book,thread:'b5',message:'missing'}])assert.throws(()=>routes.resolve(route,book,nodes));
});
