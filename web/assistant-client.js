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
  const unescape=text=>text.replace(/&(?:amp|lt|gt|quot|#39);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[e]));
  const plain=html=>unescape(html.replace(/<[^>]+>/g,''));
  const syntax=text=>text?`<span hidden aria-hidden="true" data-source-syntax>${escape(text)}</span>`:'';
  function tableRow(line){
    // Pipes inside escaped text, code, and delimited math belong to the cell.
    const pipes=[...line.matchAll(/`[^`]*`|\\\([^\n]*?\\\)|\\\[[^\n]*?\\\]|\$\$[^\n]*?\$\$|\\[\s\S]|\|/g)].filter(m=>m[0]==='|').map(m=>m.index);
    if(!pipes.length)return null;
    let start=0,end=line.length;
    if(!line.slice(0,pipes[0]).trim())start=pipes.shift()+1;
    if(pipes.length&&!line.slice(pipes.at(-1)+1).trim())end=pipes.pop();
    const bounds=[start,...pipes.flatMap(p=>[p,p+1]),end],cells=[];
    for(let i=0;i<bounds.length;i+=2)cells.push({start:bounds[i],end:bounds[i+1],text:line.slice(bounds[i],bounds[i+1])});
    return {line,cells};
  }
  function tableCells(row,tag,alignment,after=''){
    return row.cells.map((cell,i)=>{
      const prefix=i===0?row.line.slice(0,cell.start):'',suffix=row.line.slice(cell.end,row.cells[i+1]?.start??row.line.length)+(i===row.cells.length-1?after:'');
      const value=inline(cell.text).replace(/<[^>]+>|\\\|/g,part=>part==='\\|'?syntax('\\')+'|':part);
      return `<${tag}${tag==='th'?' scope="col"':''} style="text-align:${alignment[i]}">${syntax(prefix)}${value}${syntax(suffix)}</${tag}>`;
    }).join('');
  }
  function paragraphHtml(text,tables=true){
    const fallback='<p>'+inline(text)+'</p>';
    if(!tables)return fallback;
    const lines=text.split('\n'),blocks=[];let pending=[];
    const flush=()=>{if(pending.length){blocks.push('<p>'+inline(pending.join('\n'))+'</p>');pending=[]}};
    for(let i=0;i<lines.length;){
      const header=tableRow(lines[i]),separator=i+1<lines.length?tableRow(lines[i+1]):null;
      if(!header||!separator||header.cells.length!==separator.cells.length||!separator.cells.every(c=>/^:?-{3,}:?$/.test(c.text.trim()))){pending.push(lines[i++]);continue}
      const alignment=separator.cells.map(c=>c.text.trim().endsWith(':')?(c.text.trim().startsWith(':')?'center':'right'):'left');
      const body=[];let end=i+2;
      while(end<lines.length){const row=tableRow(lines[end]);if(!row||row.cells.length!==header.cells.length)break;body.push(row);end++}
      if(pending.length){pending[pending.length-1]+='\n';flush()}
      const headSuffix='\n'+lines[i+1]+(i+2<lines.length?'\n':'');
      blocks.push('<div class="lt-table-scroll" tabindex="0" role="region" aria-label="Answer table"><table><thead><tr>'+tableCells(header,'th',alignment,headSuffix)+'</tr></thead><tbody>'+body.map((row,j)=>'<tr>'+tableCells(row,'td',alignment,i+2+j<lines.length-1?'\n':'')+'</tr>').join('')+'</tbody></table></div>');
      i=end;
    }
    flush();const html=blocks.join('');
    // Malformed Markdown that crosses cell boundaries must never shift a saved
    // source range. Hidden syntax retains pipes, separator rows, and newlines.
    return plain(html)===plain(fallback)?html:fallback;
  }
  const katex=typeof module!=='undefined'&&module.exports?require('katex'):scope.katex;
  function renderMath(html){
    // Work on escaped Markdown text, leaving tags and code samples intact. The
    // original text is retained for existing source ranges and future highlights.
    return html.replace(/<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>|<[^>]+>|\\\[[^<]*?\\\]|\\\([^<]*?\\\)|\$\$[^<]*?\$\$/g,part=>{
      if(part.startsWith('<')||!katex)return part;
      const source=unescape(part);
      const display=!source.startsWith('\\(');
      try{
        const math=katex.renderToString(source.slice(2,-2),{displayMode:display,output:'htmlAndMathml',throwOnError:true,trust:false,strict:'ignore',maxSize:10,maxExpand:1000,macros:{}});
        return `<span class="lt-math${display?' lt-math-display':''}" data-math-source="${escape(source)}">${math}</span>`;
      }catch{return part}
    });
  }
  function renderText(text,options={}){
    const lines=String(text).split('\n'),blocks=[];let paragraph=[],list=[],code=null;
    const flush=()=>{if(paragraph.length){blocks.push(paragraphHtml(paragraph.join('\n'),options.tables!==false));paragraph=[]}if(list.length){blocks.push('<ul>'+list.map(x=>'<li>'+inline(x)+'</li>').join('')+'</ul>');list=[]}};
    for(const line of lines){
      if(line.trimStart().startsWith('```')){flush();if(code!==null){blocks.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');code=null}else code=[];continue}
      if(code!==null){code.push(line);continue}
      if(!line.trim()){flush();continue}
      const heading=line.match(/^#{1,6}\s+(.+)$/),item=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if(heading){flush();blocks.push('<h3>'+inline(heading[1])+'</h3>')}
      else if(item){if(paragraph.length)flush();list.push(item[1])}
      else{if(list.length)flush();paragraph.push(line)}
    }
    flush();if(code!==null)blocks.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');const html=blocks.join('');return options.math===false?html:renderMath(html);
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
  function usageHtml(ledger){
    const models=typeof module!=='undefined'&&module.exports?require('./assistant-models.js'):scope.LearningAssistantModels;
    const count=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value.toLocaleString():'—';
    const money=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:6}).format(value):'—';
    const row=(label,usage,cost)=>`<tr><th scope="row">${escape(label)}</th><td>${count(usage?.input_tokens)}</td><td>${count(usage?.output_tokens)}</td><td>${money(cost)}</td></tr>`;
    return '<h3>Usage</h3><div class="lt-usage-scroll"><table aria-label="Usage by model"><thead><tr><th scope="col">Model</th><th scope="col">Input tokens</th><th scope="col">Output tokens</th><th scope="col" aria-label="Recorded estimated API cost in USD">Recorded cost</th></tr></thead><tbody>'+(ledger.models||[]).map(m=>row(models?.models.find(choice=>choice.id===m.model)?.label||m.model,m.usage,m.cost_usd)).join('')+'</tbody><tfoot>'+row('Total',ledger.totals,ledger.cost_usd)+'</tfoot></table></div>';
  }
  const api={renderText,run,request,usageHtml};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningAssistant=api;
})(globalThis);
