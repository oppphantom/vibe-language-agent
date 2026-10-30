'use strict';
/**
 * Validates an Agent-generated single-floor draft (V2).
 * Soft style issues → styleWarnings; structural problems throw RUN_DRAFT_INVALID.
 */
const {collectStyleWarnings}=require('../shared/copy-style');

const ROOM_TYPES=new Set(['combat','elite','boss','rest','event','shop','treasure']);
const COMBAT_TYPES=new Set(['combat','elite','boss']);
const MIN_ITEMS={combat:4,elite:5,boss:6};
const PERSONAS=new Set(['polysemy_tutor','story_npc','culture_guide','listening_coach']);
const TEXT_LIMITS={prompt:120,option:120,explanation:160,remedial:160,title:40,contrastAxis:80};

function fail(message){
  throw Object.assign(new Error(message),{code:'RUN_DRAFT_INVALID'});
}

function requireText(text,label,max){
  if(typeof text!=='string'||!text.trim())fail(label+' 无效');
  if(text.length>max)fail(label+' 过长（>'+max+'）');
  return text.trim();
}

function validateItem(item,knownLines,roomType){
  if(!item||typeof item!=='object')fail('题目无效');
  requireText(item.id||'','题目 id',80);
  if(item.type&&item.type!=='context_choice')fail('题目 type 仅支持 context_choice');
  requireText(item.prompt,'prompt',TEXT_LIMITS.prompt);
  if(!Array.isArray(item.options)||item.options.length!==3)fail('options 必须恰好 3 个');
  item.options.forEach((opt,i)=>requireText(opt,'option'+i,TEXT_LIMITS.option));
  if(!Number.isInteger(item.correctIndex)||item.correctIndex<0||item.correctIndex>2)fail('correctIndex 无效');
  requireText(item.explanation,'explanation',TEXT_LIMITS.explanation);
  requireText(item.remedial,'remedial',TEXT_LIMITS.remedial);
  if(typeof item.morphologyNote!=='string'||!item.morphologyNote.trim())fail('缺少 morphologyNote');
  const target=item.target;
  if(!target||typeof target.expression!=='string'||!target.expression.trim())fail('缺少 target.expression');
  if(!Array.isArray(target.evidenceLineIds)||target.evidenceLineIds.length<1)fail('缺少 evidenceLineIds');
  for(const lineId of target.evidenceLineIds){
    if(knownLines.size&&!knownLines.has(lineId))fail('证据行不在材料中: '+lineId);
  }
  if(roomType==='boss'&&item.transfer!==true)fail('boss 题须 transfer:true');
  if(roomType==='elite'&&target.evidenceLineIds.length>=2){
    requireText(item.contrastAxis||'','contrastAxis',TEXT_LIMITS.contrastAxis);
  }else if(typeof item.contrastAxis==='string'&&item.contrastAxis){
    requireText(item.contrastAxis,'contrastAxis',TEXT_LIMITS.contrastAxis);
  }
}

function validateFloorDraft(draft,lineIds){
  if(!draft||typeof draft!=='object')fail('draft 无效');
  if(Number(draft.schemaVersion)!==2)fail('floor draft 需要 schemaVersion 2');
  if(typeof draft.expression!=='string'||!draft.expression.trim())fail('缺少 expression');
  if(!Array.isArray(draft.rooms)||draft.rooms.length<1)fail('缺少 rooms');

  const knownLines=new Set(lineIds||[]);
  const roomIds=new Set();
  let combatRooms=0;
  const styleTexts=[];

  for(const room of draft.rooms){
    if(!room||typeof room!=='object')fail('房间无效');
    requireText(room.id||'','房间 id',80);
    if(roomIds.has(room.id))fail('房间 id 重复: '+room.id);
    roomIds.add(room.id);
    if(!ROOM_TYPES.has(room.roomType))fail('roomType 无效: '+room.roomType);
    if(room.personaId&&!PERSONAS.has(room.personaId))fail('personaId 无效: '+room.personaId);
    if(room.title){
      requireText(room.title,'房间 title',TEXT_LIMITS.title);
      styleTexts.push(room.title);
    }

    const enc=room.encounter;
    if(!enc||typeof enc!=='object')fail('房间缺少 encounter: '+room.id);

    if(!COMBAT_TYPES.has(room.roomType))continue;
    combatRooms+=1;
    const items=enc.items;
    const min=MIN_ITEMS[room.roomType];
    if(!Array.isArray(items)||items.length<min)fail(room.roomType+' 题量须 ≥'+min+'（房间 '+room.id+'）');
    for(const item of items){
      validateItem(item,knownLines,room.roomType);
      styleTexts.push(item.prompt,item.explanation,item.remedial,...item.options);
      if(item.contrastAxis)styleTexts.push(item.contrastAxis);
    }
  }

  if(combatRooms<1)fail('至少需要一个战斗向房间');

  if(draft.graph){
    const g=draft.graph;
    if(typeof g.startNodeId!=='string'||!roomIds.has(g.startNodeId))fail('graph.startNodeId 无效');
    if(!Array.isArray(g.edges))fail('graph.edges 无效');
    for(const edge of g.edges){
      if(!roomIds.has(edge.from)||!roomIds.has(edge.to))fail('边引用未知房间');
    }
    const reachable=new Set([g.startNodeId]);
    let grew=true;
    while(grew){
      grew=false;
      for(const edge of g.edges){
        if(reachable.has(edge.from)&&!reachable.has(edge.to)){
          reachable.add(edge.to);
          grew=true;
        }
      }
    }
    for(const id of roomIds){
      if(!reachable.has(id))fail('房间不可达: '+id);
    }
  }

  return {ok:true,styleWarnings:collectStyleWarnings(styleTexts)};
}

module.exports={validateFloorDraft,MIN_ITEMS,ROOM_TYPES,TEXT_LIMITS};
