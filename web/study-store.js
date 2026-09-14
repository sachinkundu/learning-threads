/* Browser persistence for one book. Cloud storage will sit behind this boundary. */
(function (scope) {
  'use strict';
  const BOOK = 'modern-robotics-2019-preprint';
  const KEY = 'learning-threads:study:' + BOOK;
  class StudyStorageError extends Error {
    constructor(message, cause) { super(message, { cause }); this.name = 'StudyStorageError'; }
  }
  const check = (condition, message) => { if (!condition) throw new StudyStorageError(message); };
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const isPage = value => value === 0 || value === 1;
  const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/i.test(value);
  const checkHistory = history => check(history===undefined || (Array.isArray(history) && history.every(r=>isObject(r)&&typeof r.text==='string'&&typeof r.at==='string'&&Number.isFinite(Date.parse(r.at)))), 'Saved revision history is invalid.');
  function checkAnchor(a,page){
    check(isObject(a)&&validId(a.id)&&a.book===BOOK&&a.page===page&&typeof a.quote==='string'&&Number.isInteger(a.start)&&a.start>=0&&a.end===a.start+a.quote.length&&a.quote.length>0,'Saved source highlight is invalid.');
    check(a.kind===undefined||['book','message'].includes(a.kind),'Saved source type is invalid.');
    if(a.kind==='message')check(validId(a.nodeId)&&validId(a.messageId)&&a.sourceRevision===0,'Saved reply source is invalid.');
  }
  const limits = {R:[[-140,140]],P:[[0,100]],H:[[0,360]],C:[[-140,140],[0,100]],U:[[-60,60],[-60,60]],S:[[-60,60],[-60,60],[-140,140]]};
  function checkVisual(visual) {
    check(isObject(visual) && Object.hasOwn(limits, visual.joint), 'Saved joint is invalid.');
    const bounds=limits[visual.joint];
    check(Array.isArray(visual.values) && visual.values.length === bounds.length && visual.values.every((v,i)=>Number.isFinite(v) && v>=bounds[i][0] && v<=bounds[i][1]), 'Saved joint controls are invalid.');
  }
  function validate(state) {
    check(isObject(state) && isPage(state.page), 'Saved reading place is invalid.');
    check(Array.isArray(state.notes) && state.notes.length===2 && state.notes.every(n=>typeof n==='string'), 'Saved notes are invalid.');
    if(state.noteHistory!==undefined){check(Array.isArray(state.noteHistory)&&state.noteHistory.length===2,'Saved note history is invalid.');state.noteHistory.forEach(checkHistory)}
    if(state.noteEdits!==undefined)check(Array.isArray(state.noteEdits)&&state.noteEdits.length===2&&state.noteEdits.every(n=>n===null||typeof n==='string'),'Saved note edit is invalid.');
    check(Array.isArray(state.noteOpen) && state.noteOpen.length===2 && state.noteOpen.every(n=>typeof n==='boolean'), 'Saved note view is invalid.');
    check(Array.isArray(state.read) && state.read.every(isPage), 'Saved read marks are invalid.');
    check(Array.isArray(state.highlights) && state.highlights.length===2 && state.highlights.every(list=>Array.isArray(list) && list.every(h=>isObject(h) && Number.isInteger(h.start) && h.start>=0 && Number.isInteger(h.end) && h.end>h.start && typeof h.quote==='string' && h.quote.length===h.end-h.start)), 'Saved highlights are invalid.');
    checkVisual({joint:state.joint, values:state.states?.[state.joint]});
    for (const joint of Object.keys(limits)) checkVisual({joint,values:state.states?.[joint]});
    check(isObject(state.design) && ['Side by side','Visual below'].includes(state.design.layout) && Number.isFinite(state.design.textSize) && state.design.textSize>=17 && state.design.textSize<=24 && typeof state.design.surrounding==='boolean', 'Saved reading view is invalid.');
    check(Array.isArray(state.conversations) && state.conversations.length>=2, 'Saved threads are missing.');
    const nodes=new Map(), messageIds=new Set();
    for (const node of state.conversations) {
      check(isObject(node) && validId(node.id) && !nodes.has(node.id) && isPage(node.page), 'Saved thread identity is invalid.');
      check(typeof node.title==='string' && typeof node.draft==='string' && typeof node.quote==='string' && Array.isArray(node.messages) && Array.isArray(node.path), 'Saved thread content is invalid.');
      if (node.visual) checkVisual(node.visual);
      if(node.sourceAnchor)checkAnchor(node.sourceAnchor,node.page);
      if(node.pendingAnchor)checkAnchor(node.pendingAnchor,node.page);
      for (const m of node.messages) {
        check(isObject(m) && validId(m.id) && !messageIds.has(m.id) && ['user','assistant'].includes(m.role) && typeof m.text==='string', 'Saved reply is invalid.');
        check(m.note===undefined || typeof m.note==='string', 'Saved reply note is invalid.');
        checkHistory(m.noteHistory);checkHistory(m.history);
        check(m.noteEditBase===undefined||typeof m.noteEditBase==='string','Saved note edit is invalid.');
        check(m.editDraft===undefined||typeof m.editDraft==='string','Saved question edit is invalid.');
        if(m.request)check(isObject(m.request)&&validId(m.request.id)&&['connecting','queued','running','completed','failed','waiting'].includes(m.request.state)&&isObject(m.request.payload)&&m.request.payload.id===m.request.id&&typeof m.request.payload.question==='string'&&isObject(m.request.payload.context),'Saved assistant request is invalid.');
        if(m.requestId)check(validId(m.requestId),'Saved assistant reply identity is invalid.');
        if(m.sourceAnchor)checkAnchor(m.sourceAnchor,node.page);
        check(m.example===undefined || ['wrist','actuation','torque'].includes(m.example), 'Saved reply example is unknown.');
        if (m.visualization) check(['wrist','actuation','torque'].includes(m.visualization.type) && validId(m.visualization.sourceMessage) && Array.isArray(m.visualization.values) && m.visualization.values.length===3 && m.visualization.values.every(v=>Number.isFinite(v) && Math.abs(v)<=180), 'Saved reply visual is invalid.');
        messageIds.add(m.id);
      }
      nodes.set(node.id,node);
    }
    check(nodes.get('p0')?.page===0 && !nodes.get('p0').parent && nodes.get('p1')?.page===1 && !nodes.get('p1').parent, 'Saved paragraph threads are missing.');
    for (const node of nodes.values()) {
      for(const a of [node.sourceAnchor,node.pendingAnchor,...node.messages.map(m=>m.sourceAnchor)].filter(Boolean)){
        if(a.kind==='message'){
          const source=nodes.get(a.nodeId),message=source?.messages.find(m=>m.id===a.messageId);
          check(source?.page===node.page&&message?.role==='assistant','A saved highlight has lost its reply.');
        }
      }
      const seen=new Set(); let cursor=node;
      while (cursor.parent) {
        check(!seen.has(cursor.id), 'Saved threads contain a cycle.'); seen.add(cursor.id);
        cursor=nodes.get(cursor.parent);
        check(cursor && cursor.page===node.page, 'A saved thread has lost its parent.');
      }
      check(cursor.id==='p'+node.page, 'A saved thread has lost its paragraph.');
      check(node.path.length===seen.size, 'Saved thread path is invalid.');
      let previous='p'+node.page;
      for (const step of node.path) {
        check(isObject(step) && nodes.get(step.id)?.parent===previous && typeof step.title==='string', 'Saved thread path is invalid.');
        checkVisual({joint:step.restoreJoint,values:step.restoreValues}); previous=step.id;
      }
      check(previous===node.id, 'Saved thread path points elsewhere.');
      check(!node.replyTo || node.messages.some(m=>m.id===node.replyTo), 'Saved reply selection is missing.');
    }
    check(nodes.has(state.activeId) && nodes.get(state.activeId).page===state.page, 'Saved active thread is missing.');
    return state;
  }
  function create(getStorage) {
    let baseline=null, loaded=false, revision=0, previousState=null;
    function read() {
      try { return getStorage().getItem(KEY); }
      catch (error) { throw new StudyStorageError('Browser storage is unavailable. Your changes are still on this page. Export a backup.',error); }
    }
    return {
      load() {
        const raw=read();
        if (raw===null) { baseline=null;loaded=true;return null; }
        try {
          const envelope=JSON.parse(raw);
          check([1,2].includes(envelope.version) && envelope.book===BOOK && Number.isSafeInteger(envelope.revision) && envelope.revision>0, 'Saved study format is not supported.');
          const state=validate(envelope.state);
          baseline=raw;revision=envelope.revision;previousState=JSON.stringify(state);loaded=true;
          return state;
        } catch(error) { throw new StudyStorageError('Saved study could not be opened. The saved copy has been left untouched. Export a backup.',error); }
      },
      save(state) {
        check(loaded, 'Saved study could not be opened. Export a backup before restoring it.');
        validate(state);
        check(read()===baseline, 'Study changed in another tab. Export this tab’s work before reloading.');
        const serialized=JSON.stringify(state);
        if (serialized===previousState) return revision;
        const next=JSON.stringify({version:2,book:BOOK,revision:revision+1,updatedAt:new Date().toISOString(),state});
        try { getStorage().setItem(KEY,next); }
        catch(error) { throw new StudyStorageError('Could not save study in this browser. Your changes are still on this page. Export a backup and free some storage, then retry.',error); }
        baseline=next;previousState=serialized;revision++;return revision;
      },
      backup(state) {
        let stored=null,error=null;
        try { stored=read(); } catch(e) { error=e.message; }
        return {version:2,book:BOOK,exportedAt:new Date().toISOString(),state,stored,storageError:error};
      }
    };
  }
  const api={create,validate,KEY,BOOK,StudyStorageError};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else scope.LearningStudyStore=api;
})(globalThis);
