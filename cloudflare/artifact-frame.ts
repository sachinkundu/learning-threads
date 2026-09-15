// Presentation adapter only: the original visual source stays immutable in R2.
// Its opaque frame reports its natural content height without parent DOM access.
export const frameAdapter=`<script>(()=>{let last=0;const report=()=>{const h=Math.ceil(document.body.getBoundingClientRect().height);if(h>0&&h!==last){last=h;parent.postMessage({type:'lt-visual-size',height:h},'*')}};new ResizeObserver(report).observe(document.body);addEventListener('load',report);report()})()</script>`;
export async function frameResponse(response:Response){
  if(!response.ok)return response;
  const html=await response.text(),headers=new Headers(response.headers);headers.delete('Content-Length');
  return new Response(html+frameAdapter,{status:response.status,headers});
}
