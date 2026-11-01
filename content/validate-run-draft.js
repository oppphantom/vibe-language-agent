'use strict';
/**
 * Validates a RunDraft / gold fixture shape for P0 (and P1 prelude fields).
 * Used by tests; B can reuse when wiring Agent generation.
 */
const PERSONAS_P0=new Set(['polysemy_tutor']);
const MAP_P0=new Set(['context','final_challenge']);
const TYPES_P0=new Set(['context_choice']);

function fail(message){throw Object.assign(new Error(message),{code:'RUN_DRAFT_INVALID'});}

function validateRunDraftP0(draft,lineIds){
  if(!draft||typeof draft!=='object')fail('draft 无效');
  if(!Array.isArray(draft.route)||draft.route.length<1)fail('route 无效');
  if(!Array.isArray(draft.nodes)||draft.nodes.length!==draft.route.length)fail('nodes 与 route 长度不一致');
  if(draft.branching===true)fail('P0 校验不允许 branching=true');
  if(Array.isArray(draft.cards)&&draft.cards.length>0)fail('P0 校验要求 cards 为空');
  const byId=Object.fromEntries(draft.nodes.map(n=>[n.id,n]));
  const knownLines=new Set(lineIds||[]);
  draft.route.forEach((id,index)=>{
    const node=byId[id];
    if(!node)fail('route 引用未知节点 '+id);
    if(draft.nodes[index].id!==id)fail('nodes 顺序须与 route 一致');
    if(!MAP_P0.has(node.mapNode))fail('mapNode 不在 P0 允许集: '+node.mapNode);
    if(!TYPES_P0.has(node.type))fail('type 不在 P0 允许集: '+node.type);
    if(node.personaId&&!PERSONAS_P0.has(node.personaId))fail('personaId 不在 P0 允许集: '+node.personaId);
    if(!node.target||node.target.expression==null)fail('缺少 target.expression');
    if(!Array.isArray(node.target.evidenceLineIds)||node.target.evidenceLineIds.length<1)fail('缺少 evidenceLineIds');
    for(const lineId of node.target.evidenceLineIds){
      if(knownLines.size&&!knownLines.has(lineId))fail('证据行不在材料中: '+lineId);
    }
    if(!Array.isArray(node.options)||node.options.length!==3)fail('options 必须恰好 3 个');
    if(!Number.isInteger(node.correctIndex)||node.correctIndex<0||node.correctIndex>2)fail('correctIndex 无效');
    if(typeof node.prompt!=='string'||!node.prompt.trim())fail('prompt 无效');
    if(typeof node.explanation!=='string'||!node.explanation.trim())fail('explanation 无效');
    if(typeof node.remedial!=='string'||!node.remedial.trim())fail('remedial 无效');
    if(typeof node.morphologyNote!=='string'||!node.morphologyNote.trim())fail('P1 预备：须有 morphologyNote');
    const multiEvidence=node.target.evidenceLineIds.length>=2;
    if(multiEvidence&&node.mapNode==='context'){
      if(typeof node.contrastAxis!=='string'||!node.contrastAxis.trim())fail('跨语境 context 关须有 contrastAxis');
    }
    if(node.mapNode==='final_challenge'&&node.transfer!==true)fail('最终挑战须标 transfer:true');
  });
  return true;
}

function draftFromFixture(fixture){
  const {songs,lines,lessons,route}=fixture;
  return {
    schemaVersion:1,
    pathTemplate:'p0_linear_three',
    branching:false,
    expression:lessons[0].target.expression,
    baseMeaning:'再次、重新（again）',
    learningGoal:'能根据前后句判断目标表达连接的具体事件',
    unverifiedClaims:['情绪强弱、关系是否和好等主观推断'],
    startSongId:songs[0].id,
    route:route.slice(),
    nodes:lessons.map(lesson=>({...lesson})),
    cards:[],
    provenance:{generator:'fixture',status:'original',sourceLineIds:lines.map(l=>l.id)},
    needsHumanReview:false
  };
}

module.exports={validateRunDraftP0,draftFromFixture,PERSONAS_P0,MAP_P0};
