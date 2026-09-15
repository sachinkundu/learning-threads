/* The learning graph stays in our study store, independent of the model harness. */
(function(scope){
  'use strict';
  function build({paragraph,node,message,nodes,paragraphNote,visual,messageText}){
    const publicMessage=m=>({id:m.id,role:m.role,text:messageText(m),sourceAnchor:m.sourceAnchor||null,
      note:m.note||null,replyTo:m.replyTo||null,visualization:m.visualization||null,artifacts:m.artifacts||[],artifactStates:m.artifactStates||{}});
    const ancestors=[];let parent=node;
    while(parent.parent){parent=nodes.get(parent.parent);ancestors.unshift({id:parent.id,title:parent.title,
      sourceQuote:parent.sourceAnchor?.quote||parent.sourceQuote||null,sourceAnchor:parent.sourceAnchor||null,visual:parent.visual||null,
      messages:parent.messages.map(publicMessage)})}
    return {contextVersion:2,book:'Modern Robotics, Lynch and Park',chapter:paragraph.chapter,
      chapterTitle:paragraph.chapterTitle,section:paragraph.section,sourcePage:paragraph.sourcePages[0],
      sourcePages:paragraph.sourcePages,pdfPages:paragraph.sourcePages.map(p=>p+20),paragraph:paragraph.number,
      paragraphId:paragraph.id,passage:paragraph.text,paragraphNote:paragraphNote||null,
      learningPath:[paragraph.section,...node.path.map(s=>s.title)],threadId:node.id,
      branchSourceText:node.sourceAnchor?.quote||node.sourceQuote||null,branchSourceAnchor:node.sourceAnchor||null,
      sourceAnchor:message.sourceAnchor||node.sourceAnchor||null,
      selectedText:message.sourceAnchor?.quote||null,replyTo:message.replyTo||null,
      ancestorConversations:ancestors,currentConversation:node.messages.slice(0,node.messages.indexOf(message)).map(publicMessage),visual};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={build};else scope.LearningAssistantContext={build};
})(globalThis);
