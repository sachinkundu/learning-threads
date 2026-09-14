(function(scope){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(text){
    const pattern=/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    return text.split(pattern).map(part=>{
      if(part.startsWith('`')&&part.endsWith('`'))return '<code>'+escape(part.slice(1,-1))+'</code>';
      if(part.startsWith('**')&&part.endsWith('**'))return '<strong>'+escape(part.slice(2,-2))+'</strong>';
      const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if(link)return `<a href="${escape(link[2])}" target="_blank" rel="noopener noreferrer">${escape(link[1])}</a>`;
      return escape(part);
    }).join('');
  }
  function renderText(text){
    const lines=String(text).split('\n'),blocks=[];let paragraph=[],list=[],code=null;
    const flush=()=>{if(paragraph.length){blocks.push('<p>'+inline(paragraph.join('\n'))+'</p>');paragraph=[]}if(list.length){blocks.push('<ul>'+list.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');list=[]}};
    for(const line of lines){
      if(line.trimStart().startsWith('```')){flush();if(code!==null){blocks.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');code=null}else code=[];continue}
      if(code!==null){code.push(line);continue}
      if(!line.trim()){flush();continue}
      const heading=line.match(/^#{1,6}\s+(.+)$/),item=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if(heading){flush();blocks.push('<h3>'+inline(heading[1])+'</h3>')}
      else if(item){if(paragraph.length)flush();list.push(item[1])}
      else{if(list.length)flush();paragraph.push(line)}
    }
    flush();if(code!==null)blocks.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');return blocks.join('');
  }
  async function request(path,body){
    let response;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{response=await fetch(path,{method:body?'POST':'GET',headers:{'X-Learning-Threads':'1',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal})}
    catch(error){throw new Error('Could not reach the assistant: '+error.message,{cause:error})}
    finally{clearTimeout(timeout)}
    const text=await response.text();let data;
    try{data=JSON.parse(text)}catch{throw new Error('Could not read the assistant response (HTTP '+response.status+'). Reload and retry.')}
    if(!response.ok){const error=new Error(data.error||'Assistant request failed (HTTP '+response.status+').');error.definitiveFailure=!!body&&[400,413,422,429].includes(response.status);throw error}
    return data;
  }
  async function run(payload,onUpdate){
    let job=await request('/api/replies',payload);onUpdate(job);
    while(['queued','running'].includes(job.status)){
      await new Promise(resolve=>setTimeout(resolve,1500));
      job=await request('/api/replies/'+encodeURIComponent(payload.id));onUpdate(job);
    }
    return job;
  }
  function usageHtml(call){
    const u=call?.usage, count=k=>u?.[k]===null||u?.[k]===undefined?'Not reported':u[k].toLocaleString();
    return `<dl><dt>Input tokens</dt><dd>${count('input_tokens')}</dd><dt>Cached input</dt><dd>${count('cached_input_tokens')}</dd><dt>Output tokens</dt><dd>${count('output_tokens')}</dd><dt>Reasoning output</dt><dd>${count('reasoning_output_tokens')}</dd><dt>Cost</dt><dd>Not reported</dd>${call?.model?`<dt>Model</dt><dd>${escape(call.model)}</dd>`:''}</dl>`;
  }
  const api={renderText,run,request,usageHtml};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningAssistant=api;
})(globalThis);
