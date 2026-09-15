/* Stable paragraph slots keep previously saved source offsets and thread IDs intact. */
(function(scope){
  'use strict';
  const data=typeof module!=='undefined'&&module.exports?require('./books/modern-robotics.json'):scope.LearningBookData;
  const order=data.chapters.flatMap(c=>c.paragraphs),first=order[0];
  const api={...data,order,first,
    figuresFor(page){
      const references=[...data.paragraphs[page].text.matchAll(/\b[Ff]ig(?:ure)?\.?\s+(\d+\.\d+)/g)].map(match=>match[1]);
      return [...new Set(references)].map(id=>data.figures?.[id]).filter(Boolean);
    },
    next(page){return order[order.indexOf(page)+1]??null},
    previous(page){return order[order.indexOf(page)-1]??null},
    label(page){const p=data.paragraphs[page];return `Chapter ${p.chapter} · ${p.section} · paragraph ${p.number}`},
    root(page){const p=data.paragraphs[page];return {id:'p'+page,title:`Paragraph ${p.number}`,page,parent:null,path:[],messages:[],draft:'',quote:'',replyTo:null,status:'',busy:false,visual:null}},
    upgrade(state){
      const value=JSON.parse(JSON.stringify(state));
      if(value.readingVersion===data.revision)return value;
      // The first full chapter replaces the sample starting place, not its work.
      const factories={notes:()=>'',noteOpen:()=>false,highlights:()=>[],noteHistory:()=>[],noteEdits:()=>null};
      for(const [key,make] of Object.entries(factories)){
        value[key]??=Array.from({length:value.notes.length},make);
        while(value[key].length<data.paragraphs.length)value[key].push(make());
      }
      const ids=new Set(value.conversations.map(n=>n.id));
      for(let page=0;page<data.paragraphs.length;page++)if(!ids.has('p'+page))value.conversations.push(api.root(page));
      value.visits??=[{page:value.page,at:new Date(0).toISOString()}];
      value.page=first;value.activeId='p'+first;value.readingVersion=data.revision;
      return value;
    }
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningBook=api;
})(globalThis);
