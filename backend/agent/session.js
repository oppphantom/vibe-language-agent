'use strict';
const {randomUUID}=require('node:crypto');
const {VERSION,validateAnswer}=require('../../shared/contract');
const {songs,lines,route,lessonById}=require('../../content/fixtures/demo');
const sessions=new Map();
function currentLesson(session){
  if(session.routeIndex>=route.length)return null;
  return lessonById[route[session.routeIndex]];
}
function view(session){
  const lesson=currentLesson(session);
  return {
    id:session.id,
    schemaVersion:VERSION,
    mode:'offline_demo',
    currentNodeId:lesson?lesson.id:null,
    route:route.slice(),
    history:session.history,
    progress:{completed:session.routeIndex,total:route.length},
    songId:session.songId
  };
}
function publicNode(lesson,status){
  return {
    id:lesson.id,
    type:lesson.type,
    mapNode:lesson.mapNode||null,
    personaId:lesson.personaId||null,
    morphologyNote:lesson.morphologyNote||null,
    contrastAxis:lesson.contrastAxis||null,
    transfer:lesson.transfer===true,
    target:lesson.target,
    prompt:lesson.prompt,
    options:lesson.options,
    material:{songs,lines},
    status,
    provenance:'固定的原创教学样例；非实时 Agent 生成'
  };
}
function begin(songId){
  if(!songs.some(s=>s.id===songId))throw Object.assign(Error('找不到演示歌曲'),{code:'NOT_FOUND'});
  const session={id:randomUUID(),songId,history:[],routeIndex:0,submissions:new Map()};
  sessions.set(session.id,session);
  return view(session);
}
function get(id){
  const session=sessions.get(id);
  if(!session)throw Object.assign(Error('会话不存在或服务已重启'),{code:'NOT_FOUND'});
  return view(session);
}
function node(id){
  const session=sessions.get(id);
  if(!session)throw Object.assign(Error('会话不存在或服务已重启'),{code:'NOT_FOUND'});
  const lesson=currentLesson(session);
  if(!lesson){
    const last=lessonById[route[route.length-1]];
    return publicNode(last,'completed');
  }
  return publicNode(lesson,'active');
}
function answer(raw){
  const input=validateAnswer(raw);
  const session=sessions.get(input.sessionId);
  if(!session)throw Object.assign(Error('会话不存在或服务已重启'),{code:'NOT_FOUND'});
  if(session.submissions.has(input.submissionId))return session.submissions.get(input.submissionId);
  const lesson=currentLesson(session);
  if(!lesson)throw Object.assign(Error('这一路径已完成'),{code:'ALREADY_COMPLETED'});
  if(input.nodeId!==lesson.id)throw Object.assign(Error('节点无效'),{code:'NOT_FOUND'});
  const correct=input.choice===lesson.correctIndex;
  const atEnd=session.routeIndex===route.length-1;
  let nextAction;
  if(!correct){
    nextAction={type:'remediate',reason:lesson.remedial};
  }else if(atEnd){
    nextAction={type:'continue',reason:'路径完成。你可以回到两首歌，复习「다시」连接的不同事件。'};
  }else{
    nextAction={type:'continue',reason:'进入下一关，继续比较「다시」的语境。'};
  }
  const feedback={
    verdict:correct?'correct':'retry',
    explanation:lesson.explanation,
    errorType:correct?null:'context_misread',
    evidenceLineIds:lesson.target.evidenceLineIds,
    nextAction,
    toolLog:[{tool:'grade_demo_answer',status:'ok',summary:'按人工编写的样例答案核对'}]
  };
  session.history.push({
    nodeId:lesson.id,
    choice:input.choice,
    correct,
    attempt:input.attempt,
    hintUsed:input.hintUsed,
    at:new Date().toISOString()
  });
  if(correct)session.routeIndex+=1;
  const result={feedback,session:view(session)};
  session.submissions.set(input.submissionId,result);
  return result;
}
module.exports={begin,get,node,answer};
