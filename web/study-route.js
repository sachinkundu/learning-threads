(function(scope){
  'use strict';
  const validId=value=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(value);
  function parse(url){
    const params=new URL(url).searchParams;
    if(!['book','thread','message'].some(key=>params.has(key)))return null;
    if(['book','thread','message'].some(key=>params.getAll(key).length>1))throw new Error('This discussion link is invalid.');
    const route={book:params.get('book'),thread:params.get('thread'),message:params.get('message')};
    if(!validId(route.book)||!validId(route.thread)||(route.message!==null&&!validId(route.message)))throw new Error('This discussion link is invalid.');
    return route;
  }
  function href(base,route){
    const url=new URL(base);url.search='';url.hash='';
    url.searchParams.set('book',route.book);url.searchParams.set('thread',route.thread);
    if(route.message)url.searchParams.set('message',route.message);
    return url.href;
  }
  function resolve(route,book,nodes){
    if(route.book!==book)throw new Error('This book is not available in this library.');
    const node=nodes.get(route.thread);
    if(!node)throw new Error('This thread was not found in your saved study.');
    const message=route.message?node.messages.find(m=>m.id===route.message):null;
    if(route.message&&!message)throw new Error('This question or answer was not found in the thread.');
    return {node,message};
  }
  const api={parse,href,resolve};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else scope.LearningStudyRoute=api;
})(globalThis);
