/* Exact source ranges and reversible edit records. No model calls. */
(function(scope){
  'use strict';
  function anchor(text,start,end,source){
    if(typeof text!=='string'||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||end<=start)throw new Error('Select text within one passage or reply.');
    const quote=text.slice(start,end);
    return {...source,start,end,quote,prefix:text.slice(Math.max(0,start-40),start),suffix:text.slice(end,end+40)};
  }
  function textOf(node){
    if(node.nodeType===3)return node.data;
    if(node.nodeType===1&&node.hasAttribute('data-math-source'))return node.getAttribute('data-math-source');
    return [...node.childNodes].map(textOf).join('');
  }
  function boundary(container,node,offset,end){
    const math=(node.nodeType===1?node:node.parentElement)?.closest('[data-math-source]');
    const before=container.ownerDocument.createRange();before.selectNodeContents(container);
    if(math&&container.contains(math)){before.setEndBefore(math);return textOf(before.cloneContents()).length+(end?textOf(math).length:0)}
    before.setEnd(node,offset);return textOf(before.cloneContents()).length;
  }
  function capture(container,range,source){
    if(!container.contains(range.startContainer)||!container.contains(range.endContainer))throw new Error('Select text within one passage or reply.');
    const text=textOf(container),from=boundary(container,range.startContainer,range.startOffset,false),to=boundary(container,range.endContainer,range.endOffset,true);
    const raw=text.slice(from,to),start=from+raw.length-raw.trimStart().length;
    return anchor(text,start,start+raw.trim().length,source);
  }
  function segments(length,entries){
    const points=[...new Set([0,length,...entries.flatMap(e=>[e.anchor.start,e.anchor.end])])].sort((a,b)=>a-b);
    return points.slice(0,-1).map((start,i)=>({start,end:points[i+1],entries:entries.filter(e=>e.anchor.start<=start&&e.anchor.end>=points[i+1])})).filter(s=>s.end>s.start);
  }
  function revise(history,before,after,at=new Date().toISOString()){
    if(before!==after&&before.trim()&&history.at(-1)?.text!==before)history.push({text:before,at});
    return after;
  }
  function decorate(container,entries,href=entry=>'#'+entry.anchor.id){
    if(!entries.length)return;
    const document=container.ownerDocument,text=textOf(container);
    for(const entry of entries)if(text.slice(entry.anchor.start,entry.anchor.end)!==entry.anchor.quote)throw new Error('A thread highlight no longer matches its source.');
    const controls=[];
    for(const control of [...container.querySelectorAll('a,button')]){
      const before=document.createRange();before.selectNodeContents(container);before.setEndBefore(control);
      const start=textOf(before.cloneContents()).length,end=start+textOf(control).length;
      if(!entries.some(e=>e.anchor.start<end&&e.anchor.end>start))continue;
      const action=control.dataset.joint?{joint:control.dataset.joint}:control.dataset.concept?{concept:control.dataset.concept}:control.tagName==='A'?{href:control.getAttribute('href')}:null;
      controls.push({start,end,element:control.cloneNode(false),action});
      control.replaceWith(...control.childNodes);
    }
    // Split text nodes at all boundaries. Overlapping highlights share one link
    // segment instead of creating nested links or damaging the source markup.
    const boundaries=new Set(segments(text.length,entries).flatMap(s=>[s.start,s.end]));
    for(const c of controls){boundaries.add(c.start);boundaries.add(c.end)}
    const nodes=[];let offset=0;
    function walk(node){
      const math=node.nodeType===1&&node.hasAttribute('data-math-source');
      if(math||node.nodeType===3){const length=textOf(node).length;nodes.push({node,math,start:offset,end:offset+length});offset+=length}
      else for(const child of node.childNodes)walk(child);
    }
    walk(container);
    for(const part of nodes){
      if(part.math){
        const linked=entries.filter(e=>e.anchor.start<part.end&&e.anchor.end>part.start);
        if(linked.length){const link=document.createElement('a'),mark=document.createElement('mark');link.href=href(linked[0]);link.className='lt-highlight-origin';link.dataset.sourceLinks=linked.map(e=>e.anchor.id).join(' ');link.setAttribute('aria-label','Highlighted equation: '+linked.map(e=>e.title).join('; '));part.node.replaceWith(link);mark.append(part.node);link.append(mark)}
        continue;
      }
      const cuts=[part.start,...[...boundaries].filter(p=>p>part.start&&p<part.end).sort((a,b)=>a-b),part.end];
      const fragment=document.createDocumentFragment();
      for(let i=0;i<cuts.length-1;i++){
        const start=cuts[i],end=cuts[i+1],value=text.slice(start,end);
        if(end<=start)continue;
        const linked=entries.filter(e=>e.anchor.start<=start&&e.anchor.end>=end);
        const control=controls.find(c=>c.start<=start&&c.end>=end);
        let element;
        if(linked.length){
          element=document.createElement('a');element.href=href(linked[0]);element.draggable=false;element.className='lt-highlight-origin';element.dataset.sourceLinks=linked.map(e=>e.anchor.id).join(' ');
          element.setAttribute('aria-label','Highlighted text: '+value+'. '+linked.map(e=>e.title).join('; '));
          if(control?.action)element.dataset.sourceAction=JSON.stringify(control.action);
          const mark=document.createElement('mark');mark.textContent=value;element.append(mark);
        }else if(control){element=control.element.cloneNode(false);element.removeAttribute('id');element.textContent=value}
        else element=document.createTextNode(value);
        fragment.append(element);
      }
      part.node.replaceWith(fragment);
    }
  }
  const api={anchor,capture,segments,revise,decorate,textOf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningStudyLinks=api;
})(globalThis);
