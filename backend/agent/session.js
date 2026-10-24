'use strict';
const {randomUUID}=require('node:crypto');
const {VERSION,validateAnswer}=require('../../shared/contract');
const {songs,lines,lesson}=require('../../content/fixtures/demo');
const sessions=new Map();
function view(session){
  return {id:session.id,schemaVersion:VERSION,mode:'offline_demo',currentNodeId:session.completed?null:lesson.id,route:[lesson.id],history:session.history,
    progress:{completed:session.completed?1:0,total:1},songId:session.songId};
}
function begin(songId){
  if (!songs.some(s=>s.id===songId)) throw Object.assign(Error('找不到演示歌曲'),{code:'NOT_FOUND'});
  const session={id:randomUUID(),songId,history:[],completed:false,submissions:new Map()};
  sessions.set(session.id,session);return view(session);
}
function get(id){const session=sessions.get(id);if(!session)throw Object.assign(Error('会话不存在或服务已重启'),{code:'NOT_FOUND'});return view(session);}
function node(id){get(id);return {id:lesson.id,type:lesson.type,target:lesson.target,prompt:lesson.prompt,options:lesson.options,
  material:{songs,lines},status:sessions.get(id).completed?'completed':'active',
  provenance:'固定的原创教学样例；非实时 Agent 生成'};}
function answer(raw){
  const input=validateAnswer(raw),session=sessions.get(input.sessionId);
  if(!session)throw Object.assign(Error('会话不存在或服务已重启'),{code:'NOT_FOUND'});
  if(input.nodeId!==lesson.id)throw Object.assign(Error('节点无效'),{code:'NOT_FOUND'});
  if(session.submissions.has(input.submissionId))return session.submissions.get(input.submissionId);
  if(session.completed)throw Object.assign(Error('这一节点已完成'),{code:'ALREADY_COMPLETED'});
  const correct=input.choice===lesson.correctIndex;
  const feedback={verdict:correct?'correct':'retry',explanation:lesson.explanation,errorType:correct?null:'context_misread',
    evidenceLineIds:lesson.target.evidenceLineIds,nextAction:correct?{type:'continue',reason:'回到两首歌，比较「다시」连接的前后事件。'}:{type:'remediate',reason:lesson.remedial},
    toolLog:[{tool:'grade_demo_answer',status:'ok',summary:'按人工编写的样例答案核对'}]};
  session.history.push({nodeId:lesson.id,choice:input.choice,correct,attempt:input.attempt,hintUsed:input.hintUsed,at:new Date().toISOString()});
  if(correct)session.completed=true;
  const result={feedback,session:view(session)};session.submissions.set(input.submissionId,result);return result;
}
module.exports={begin,get,node,answer};
