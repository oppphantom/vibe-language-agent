'use strict';
const {randomUUID}=require('node:crypto');
const {VERSION,validateAnswer,validateMove,validateRespond,validateTeach,validateLessonNode,validateLearningSession}=require('../../shared/contract');
const {languageInfo}=require('../../shared/languages');
const {getCourse,getCourseById,publicNode}=require('./curriculum');
const {masteryView}=require('./evaluation');
const {personas,createDungeonGame,createRoom,moveRoom,respondRoom,roomView,mapView}=require('./dungeon');
const dungeonAgent=require('./dungeon-agent');
const {lines:demoLines}=require('../../content/fixtures/demo');
const {fail}=require('./errors');
const sessions=new Map();

function materialLines(course){return course.materials?.lines||demoLines}
function currentItem(session){
  return session.status==='completed'
    ?session.game.nodes[session.game.nodes.length-1]
    :session.game.nodesById.get(session.run.currentNodeId);
}
function ensureRoom(session,item){
  if(!session.run.room||session.run.room.nodeId!==item.id)session.run.room=createRoom(item);
  return session.run.room;
}
function publicGame(run){
  return {xp:run.xp,streak:run.streak,cards:run.cards.map(card=>({...card})),route:[...run.route]};
}
function createTeaching(item){return {nodeId:item.id,phase:'brief',attempts:0,feedback:''}}
function teachingView(item,teaching){
  const lesson=item.lesson,phase=teaching.phase;
  return {phase,goal:lesson.goal,reason:lesson.reason,lineId:lesson.lineId,
    chunks:['reading','context','check','ready'].includes(phase)?lesson.chunks:[],
    translation:['context','check','ready'].includes(phase)?lesson.translation:null,
    context:['context','check','ready'].includes(phase)?lesson.context:null,
    cultureNote:['context','check','ready'].includes(phase)?lesson.cultureNote:null,
    check:phase==='check'?{prompt:lesson.check.prompt,options:[...lesson.check.options]}:null,
    attempts:teaching.attempts,feedback:teaching.feedback};
}
function view(session){
  const course=session.course,run=session.run,finished=session.status==='completed';
  return validateLearningSession({
    id:session.id,schemaVersion:VERSION,mode:course.mode||'offline_demo',status:session.status,
    language:course.language,languageLabel:languageInfo(course.language).label,courseId:course.id,courseTitle:course.title,
    currentNodeId:finished?null:run.currentNodeId,route:[...run.route],history:session.history.map(item=>({...item})),
    progress:{completed:run.completedNodeIds.size,total:session.game.routeTotal,
      current:finished?session.game.routeTotal:Math.min(run.completedNodeIds.size+1,session.game.routeTotal)},
    mastery:masteryView(course,session.history,{courseCompleted:finished,nodes:session.game.nodes}),
    game:publicGame(run),songId:session.songId,startedAt:session.startedAt,updatedAt:session.updatedAt
  });
}
function requireSession(id){
  if(typeof id!=='string'||!id.trim()||id.length>100)fail('会话 ID 无效');
  const session=sessions.get(id);if(!session)fail('会话不存在或服务已重启','NOT_FOUND');return session;
}
function begin(target){
  let course;
  if(typeof target==='string')course=getCourse(target);
  else if(target&&typeof target==='object'&&target.courseId)course=getCourseById(target.courseId);
  else if(target&&typeof target==='object'&&target.songId)course=getCourse(target.songId);
  else fail('歌曲或课程 ID 无效');
  const game=createDungeonGame(course,materialLines(course));
  return view(createSession(course,game));
}

function createSession(course,game){
  const now=new Date().toISOString();
  const run={currentNodeId:game.startNodeId,completedNodeIds:new Set(),cards:[],xp:0,streak:0,
    route:[game.startNodeId],room:createRoom(game.nodes[0]),teaching:createTeaching(game.nodes[0])};
  const session={id:randomUUID(),songId:course.songIds[0],course,game,run,status:'active',history:[],
    moves:new Map(),responses:new Map(),teachingResponses:new Map(),startedAt:now,updatedAt:now};
  sessions.set(session.id,session);return session;
}
function get(id){return view(requireSession(id))}
function publicSessionNode(session){
  const game=session.game,run=session.run,item=currentItem(session),room=ensureRoom(session,item);
  return validateLessonNode({
    ...publicNode(session.course,item,session.status==='completed'?'completed':'active'),
    interaction:item.interaction,persona:personas[item.personaId],reward:null,
    map:mapView(game,run),edges:game.edges,game:publicGame(run),room:roomView(item,room,personas),
    teaching:teachingView(item,run.teaching)
  });
}
function node(id){return publicSessionNode(requireSession(id))}
function addCard(run,card,at){
  if(!card)return;
  const value={id:card.id,title:card.term,kind:'knowledge',
    body:[card.reading,card.meaning,card.usage,card.example].filter(Boolean).join(' · '),card:{...card},earnedAt:at};
  if(!run.cards.some(item=>item.id===value.id))run.cards.push(value);
}
function advance(session,item,at){
  session.run.streak+=1;
  const xpEarned=item.xp+session.run.streak*3;
  session.run.xp+=xpEarned;session.run.completedNodeIds.add(item.id);
  session.run.currentNodeId=item.nextNodeId;
  if(item.nextNodeId){
    session.run.route.push(item.nextNodeId);
    const nextItem=session.game.nodesById.get(item.nextNodeId);
    session.run.room=createRoom(nextItem);session.run.teaching=createTeaching(nextItem);
  }else session.status='completed';
  session.history.push({nodeId:item.id,stage:item.stage,skill:item.skill,interaction:item.interaction,
    choice:null,correct:true,attempt:1,hintUsed:false,errorType:null,turns:session.run.room?.turn||0,at});
  return xpEarned;
}
function move(raw){
  const input=validateMove(raw),session=requireSession(input.sessionId);
  if(session.moves.has(input.submissionId))return session.moves.get(input.submissionId);
  if(session.status==='completed')fail('这一轮地下城已经完成','ALREADY_COMPLETED');
  const item=currentItem(session);if(input.nodeId!==item.id)fail('当前关卡已变化，请刷新后继续','STALE_NODE');
  if(session.run.teaching.phase!=='ready')fail('请先完成本关教学，再进入地图测试','TEACHING_REQUIRED');
  const room=ensureRoom(session,item),moved=moveRoom(item,room,input.direction);
  session.run.room=moved.room;if(moved.noise)session.run.streak=0;
  const at=new Date().toISOString();let xpEarned=0;
  if(moved.event.card)addCard(session.run,moved.event.card,at);
  if(moved.completed)xpEarned=advance(session,item,at);
  session.updatedAt=at;
  const result={event:{...moved.event,xpEarned},session:view(session),node:publicSessionNode(session),
    map:mapView(session.game,session.run),edges:session.game.edges};
  session.moves.set(input.submissionId,result);return result;
}
function respond(raw){
  const input=validateRespond(raw),session=requireSession(input.sessionId);
  if(session.responses.has(input.submissionId))return session.responses.get(input.submissionId);
  if(session.status==='completed')fail('这一轮地下城已经完成','ALREADY_COMPLETED');
  const item=currentItem(session);if(input.nodeId!==item.id)fail('当前关卡已变化，请刷新后继续','STALE_NODE');
  const room=ensureRoom(session,item),answered=respondRoom(item,room,input.choice);
  session.run.room=answered.room;
  const at=new Date().toISOString();let xpEarned=0;
  if(answered.correct){session.run.streak+=1;xpEarned=10+session.run.streak*2;session.run.xp+=xpEarned}
  else session.run.streak=0;
  session.updatedAt=at;
  const result={event:{...answered.event,xpEarned},session:view(session),node:publicSessionNode(session),
    map:mapView(session.game,session.run),edges:session.game.edges};
  session.responses.set(input.submissionId,result);return result;
}
function teach(raw){
  const input=validateTeach(raw),session=requireSession(input.sessionId);
  if(session.teachingResponses.has(input.submissionId))return session.teachingResponses.get(input.submissionId);
  if(session.status==='completed')fail('这一轮地下城已经完成','ALREADY_COMPLETED');
  const item=currentItem(session);if(input.nodeId!==item.id)fail('当前关卡已变化，请刷新后继续','STALE_NODE');
  const teaching=session.run.teaching,at=new Date().toISOString();
  let event;
  if(input.action==='continue'){
    const next={brief:'reading',reading:'context',context:'check'}[teaching.phase];
    if(!next)fail('当前教学阶段不能继续','TEACHING_STATE');
    teaching.phase=next;teaching.feedback='';
    event={type:'teaching-progress',message:next==='reading'?'开始拆分读音。':next==='context'?'把词块放回歌词语境。':'完成一道带提示的检查后即可进入地图。'};
  }else{
    if(teaching.phase!=='check')fail('当前还没有进入引导检查','TEACHING_STATE');
    teaching.attempts++;
    const correct=input.choice===item.lesson.check.correctIndex;
    session.history.push({nodeId:item.id,stage:'关卡教学',skill:item.skill,interaction:'teaching',choice:input.choice,
      correct,attempt:teaching.attempts,hintUsed:correct&&teaching.attempts>1,errorType:correct?null:'teaching_gap',at});
    if(correct){
      teaching.phase='ready';teaching.feedback=item.lesson.check.explanation;
      event={type:'teaching-complete',message:item.lesson.check.explanation};
    }else{
      teaching.phase='reading';teaching.feedback=`${item.lesson.check.explanation}　先回到读音和词义，再尝试一次。`;
      event={type:'teaching-remedial',message:teaching.feedback};
    }
  }
  session.updatedAt=at;
  const result={event,session:view(session),node:publicSessionNode(session)};
  session.teachingResponses.set(input.submissionId,result);return result;
}
function answer(raw){
  const input=validateAnswer(raw);
  return respond({sessionId:input.sessionId,nodeId:input.nodeId,submissionId:input.submissionId,choice:input.choice});
}

async function restart(id){
  const previous=requireSession(id);
  if(previous.status!=='completed')fail('完成全部关卡后才能重新开始','RUN_INCOMPLETE');
  if(previous.restartPromise)return previous.restartPromise;
  previous.restartPromise=(async()=>{
    const course=previous.course,lines=materialLines(course);
    if(course.mode==='ai_generated'){
      const song=course.materials?.songs?.[0];
      if(!song)fail('动态课程缺少歌曲材料','COURSE_INVALID');
      course.dungeon=await dungeonAgent.generate(course,{song,lines});
    }
    const game=createDungeonGame(course,lines),session=createSession(course,game);
    return {session:view(session),node:publicSessionNode(session)};
  })();
  try{
    return await previous.restartPromise;
  }finally{
    previous.restartPromise=null;
  }
}

module.exports={begin,get,node,move,respond,teach,answer,restart};
