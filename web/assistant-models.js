/* Shared API capabilities and standard prices, checked against OpenAI docs. */
(function(scope){
  'use strict';
  const efforts=['none','low','medium','high','xhigh','max'];
  const price=(model,input,output)=>({model,input,cached:input/10,write:input*1.25,output,
    source:'https://developers.openai.com/api/docs/pricing',checked:'2026-09-15'});
  const models=[
    {id:'gpt-6-astra',label:'Astra',efforts:efforts.slice(1),price:price('gpt-6-astra',10,50)},
    {id:'gpt-5.6-sol',label:'Sol',efforts,price:price('gpt-5.6-sol',4,20)},
    {id:'gpt-5.6-terra',label:'Terra',efforts,price:price('gpt-5.6-terra',2,12)},
    {id:'gpt-5.6-luna',label:'Luna',efforts,price:price('gpt-5.6-luna',0.2,1.2)}
  ];
  const defaults={model:'gpt-5.6-luna',reasoning:'high'};
  const legacy={model:'gpt-6-astra',reasoning:'low'};
  const labels={none:'None',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Maximum'};
  const valid=value=>!!value&&models.some(m=>m.id===value.model&&m.efforts.includes(value.reasoning));
  const api={models,defaults,legacy,labels,valid};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningAssistantModels=api;
})(globalThis);
