'use strict';
const {fallbackDungeon}=require('./dungeon-agent');

const width=19,height=9;
const personas={
  listening_coach:{id:'listening_coach',name:'回声教练',glyph:'♪',tone:'听清原唱，再辨歌词'},
  polysemy_tutor:{id:'polysemy_tutor',name:'语义侦探',glyph:'◈',tone:'从上下文寻找证据'},
  story_npc:{id:'story_npc',name:'故事旅人',glyph:'☾',tone:'在人物关系里理解表达'},
  culture_guide:{id:'culture_guide',name:'文化向导',glyph:'◎',tone:'区分材料支持与过度推断'},
  campfire_keeper:{id:'campfire_keeper',name:'营火看守',glyph:'✦',tone:'收集知识，带进下一关'},
  final_narrator:{id:'final_narrator',name:'旋律守望者',glyph:'★',tone:'按旋律顺序拼回歌词'}
};
const layouts={
  gallery:{walls:[[4,2],[5,2],[12,2],[12,3],[7,5],[8,5],[13,5],[14,5]],enemies:[[14,6]]},
  crossroads:{walls:[[4,2],[4,3],[13,2],[14,2],[7,5],[12,5]],enemies:[[15,6]]},
  garden:{walls:[[5,2],[6,2],[11,2],[12,2],[5,6],[6,6],[11,6],[12,6]],enemies:[[14,3]]},
  spiral:{walls:[[3,3],[4,3],[5,3],[12,3],[13,3],[14,3],[8,5],[9,5]],enemies:[[14,6]]},
  ambush:{walls:[[4,2],[9,2],[14,2],[4,5],[9,5],[14,5],[10,3]],enemies:[[14,6],[14,3]]}
};
const slots=[[5,1],[10,1],[15,1],[7,2],[8,3],[7,6],[10,6],[15,6]];

function isFloor(x,y,walls){return x>0&&x<width-1&&y>0&&y<height-1&&!walls.has(`${x},${y}`)}

function seededRandom(seed) {
  let value=2166136261;
  for(const char of String(seed))value=Math.imul(value^char.codePointAt(0),16777619);
  return function(){
    value+=0x6D2B79F5;
    let next=value;
    next=Math.imul(next^next>>>15,next|1);
    next^=next+Math.imul(next^next>>>7,next|61);
    return ((next^next>>>14)>>>0)/4294967296;
  };
}

function scatterPositions(walls,enemies,count,seed) {
  const blocked=new Set(enemies.map(([x,y])=>`${x},${y}`));
  blocked.add('1,1');blocked.add('17,7');
  const candidates=[];
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    if(isFloor(x,y,walls)&&!blocked.has(`${x},${y}`))candidates.push([x,y]);
  }
  const random=seededRandom(seed);
  for(let index=candidates.length-1;index>0;index--){
    const swap=Math.floor(random()*(index+1));
    [candidates[index],candidates[swap]]=[candidates[swap],candidates[index]];
  }
  if(candidates.length<count)throw Error('最终关没有足够空间散布歌词字符');
  return candidates.slice(0,count);
}

function makeNode(level,index,count,course) {
  const evidence=new Set(level.entities.filter(entity=>entity.lineId).map(entity=>entity.lineId));
  const position={x:6+88*index/Math.max(1,count-1),y:index%2?165:90};
  return {
    id:`${course.id}-${level.id}`,
    type:'level',interaction:'dungeon',stage:level.title,skill:level.theme,title:level.title,
    target:{expression:course.targetExpression,skill:level.theme,evidenceLineIds:[...evidence],prerequisites:[]},
    prompt:level.theme,options:[],correctIndex:null,explanation:level.theme,remedial:'检查角色、歌词和知识卡。',
    evidenceLineIds:[...evidence],personaId:level.personaId,layout:level.layout,entities:level.entities,nextNodeId:null,position,xp:35
  };
}

function createDungeonGame(course,lineCatalog) {
  const dungeon=course.dungeon||fallbackDungeon(course,lineCatalog);
  const nodes=dungeon.levels.map((level,index)=>makeNode(level,index,dungeon.levels.length+1,course));
  const finalLine=lineCatalog.find(line=>line.id===dungeon.final.lineId);
  if(!finalLine)throw Error('串词成句歌词不存在');
  const finalIndex=nodes.length;
  nodes.push({
    id:`${course.id}-final`,type:'final',interaction:'final',stage:'终局',skill:'串词成句',title:dungeon.final.title,
    target:{expression:course.targetExpression,skill:'串词成句',evidenceLineIds:[finalLine.id],prerequisites:[]},
    prompt:dungeon.final.title,options:[],correctIndex:null,explanation:'按顺序踩中歌词单字。',remedial:'听完整句，再从头按顺序踩。',
    evidenceLineIds:[finalLine.id],personaId:'final_narrator',chars:dungeon.final.chars,
    scatterSeed:dungeon.final.scatterSeed,loopLineId:finalLine.id,
    nextNodeId:null,position:{x:94,y:finalIndex%2?165:90},xp:80
  });
  nodes.forEach((node,index)=>{node.nextNodeId=nodes[index+1]?.id||null});
  const edges=nodes.slice(0,-1).map((node,index)=>({from:node.id,to:nodes[index+1].id}));
  return {courseId:course.id,dungeon,nodes,nodesById:new Map(nodes.map(node=>[node.id,node])),edges,
    startNodeId:nodes[0].id,routeTotal:nodes.length};
}

function createRoom(node) {
  const layout=layouts[node.layout||'gallery'];
  const walls=new Set(layout.walls.map(([x,y])=>`${x},${y}`));
  const initialEnemies=node.type==='final'?[]:layout.enemies;
  const objects=[];
  if(node.type==='final'){
    const positions=scatterPositions(walls,initialEnemies,node.chars.length,node.scatterSeed);
    node.chars.forEach((char,index)=>{
      const [x,y]=positions[index];
      objects.push({id:`${node.id}-char-${index}`,kind:'char',x,y,char,index});
    });
  }else{
    node.entities.forEach((entity,index)=>{
      const [x,y]=slots[index];
      objects.push({id:`${node.id}-entity-${index}`,kind:entity.kind,x,y,entity,resolved:false});
    });
  }
  for(const item of objects)if(!isFloor(item.x,item.y,walls))throw Error(`地下城对象落在墙体：${node.id}/${item.id}`);
  return {
    nodeId:node.id,
    layout:node.layout||'gallery',
    walls,
    player:{x:1,y:1},
    enemies:initialEnemies.map(([x,y],index)=>({x,y,direction:index%2?-1:1})),
    objects,
    resolved:[],
    pending:null,
    charProgress:0,
    turn:0
  };
}

function objectAt(room,x,y){return room.objects.find(object=>object.x===x&&object.y===y&&!room.resolved.includes(object.id))}
function allResolved(room){return room.objects.every(object=>room.resolved.includes(object.id))}
function publicChallenge(object){
  if(object.kind==='note'||object.kind==='npc'){
    const entity=object.entity;
    return {id:object.id,kind:object.kind,label:entity.label||'',prompt:entity.prompt,options:[...entity.options],lineId:entity.lineId};
  }
  return null;
}

function moveRoom(node,room,direction) {
  if(room.pending)return {room,event:{type:'pending',message:'先完成眼前的问题，再继续移动。'},completed:false,noise:false};
  const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];
  if(!delta)throw Error('移动方向无效');
  const next={...room,player:{...room.player},enemies:room.enemies.map(enemy=>({...enemy})),
    walls:new Set(room.walls),objects:room.objects.map(object=>({...object})),resolved:[...room.resolved]};
  const x=next.player.x+delta[0],y=next.player.y+delta[1];
  if(!isFloor(x,y,next.walls))return {room:next,event:{type:'wall',message:'前面是墙。'},completed:false,noise:false};
  if(next.enemies.some(enemy=>enemy.x===x&&enemy.y===y))return {room:next,event:{type:'noise',message:'噪声精灵挡住了你，退回一步。'},completed:false,noise:true};
  next.player={x,y};next.turn++;
  const object=objectAt(next,x,y);
  let event={type:'move',message:'继续探索'};
  if(object){
    if(object.kind==='note'||object.kind==='npc'){
      next.pending={objectId:object.id,kind:object.kind,challenge:publicChallenge(object)};
      event={type:'challenge',message:object.kind==='note'?'听音辨词开始。':'角色提出了一个情境问题。',challenge:publicChallenge(object)};
    }else if(object.kind==='card'){
      next.resolved.push(object.id);
      event={type:'card',message:`获得知识卡「${object.entity.card.term}」`,card:{id:object.id,...object.entity.card}};
    }else if(object.kind==='char'){
      if(object.char===node.chars[next.charProgress]){
        next.resolved.push(object.id);next.charProgress++;
        event={type:'char',message:`接上「${object.char}」`,char:object.char};
      }else{
        next.resolved=next.resolved.filter(id=>!id.includes('-char-'));next.charProgress=0;
        event={type:'wrong-char',message:'顺序断了，从第一个字重新开始。'};
      }
    }
  }
  for(const enemy of next.enemies){const nx=enemy.x+enemy.direction;if(isFloor(nx,enemy.y,next.walls))enemy.x=nx;else enemy.direction*=-1}
  if(next.enemies.some(enemy=>enemy.x===next.player.x&&enemy.y===next.player.y)){
    next.player={...room.player};
    if(event.type!=='move')return {room:next,event:{...event,message:event.message+' 噪声精灵又把脚步推了回去。'},completed:false,noise:true};
    return {room:next,event:{type:'noise',message:'噪声精灵撞了回来，退回一步。'},completed:false,noise:true};
  }
  const atExit=x===17&&y===7;
  if(atExit&&!allResolved(next))event={type:'locked',message:'出口仍被噪声封住，还有线索没有完成。'};
  else if(atExit){
    return {room:next,event:{type:'complete',message:'本关知识已全部点亮。'},completed:true,noise:false};
  }
  return {room:next,event,completed:false,noise:false};
}

function respondRoom(node,room,choice) {
  if(!room.pending)throw Error('当前没有需要回答的题目');
  const object=room.objects.find(item=>item.id===room.pending.objectId);
  if(!object)throw Error('题目对象不存在');
  const entity=object.entity,correct=choice===entity.correctIndex;
  if(!correct)return {room,correct:false,event:{type:'retry',message:entity.explanation,challenge:publicChallenge(object)}};
  const next={...room,pending:null,resolved:[...room.resolved,object.id]};
  return {room:next,correct:true,event:{type:'correct',message:entity.explanation,lineId:entity.lineId||null}};
}

function roomView(node,room,personasView) {
  const tiles=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>isFloor(x,y,room.walls)?'.':'#'));
  const cells=Array.from({length:height},(_,y)=>Array.from({length:width},()=> 'floor'));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(tiles[y][x]==='#')cells[y][x]='wall';
  const open=allResolved(room);
  tiles[7][17]=open?'>':'▯';cells[7][17]=open?'exit':'locked-exit';
  for(const object of room.objects){
    if(room.resolved.includes(object.id))continue;
    const glyph=object.kind==='note'?'♪':object.kind==='npc'?'?':object.kind==='card'?'✦':object.char;
    tiles[object.y][object.x]=glyph;cells[object.y][object.x]=object.kind;
  }
  for(const enemy of room.enemies){tiles[enemy.y][enemy.x]='x';cells[enemy.y][enemy.x]='noise'}
  tiles[room.player.y][room.player.x]='@';cells[room.player.y][room.player.x]='player';
  return {
    tiles:tiles.map(row=>row.join('')),cells,
    objective:node.type==='final'?'听一遍歌词，按演唱顺序踩中地图上的字':`完成 ${room.objects.length} 个地图事件并抵达出口`,
    collected:room.resolved.length,total:room.objects.length,exitOpen:open,turn:room.turn,
    phrase:node.type==='final'?node.chars.slice(0,room.charProgress).join(''):'',charProgress:room.charProgress,
    charTotal:node.type==='final'?node.chars.length:0,
    charObjects:node.type==='final'?room.objects.filter(object=>object.kind==='char'&&!room.resolved.includes(object.id))
      .map(object=>({id:object.id,x:object.x,y:object.y,char:object.char})):[],
    loopLineId:node.loopLineId||null,pending:room.pending,
    legend:{wall:'#',player:'@',note:'♪',npc:'?',card:'✦',exit:'▯/>',noise:'x',text:'目标文字'}
  };
}

function mapView(game,run) {
  return game.nodes.map(node=>({
    id:node.id,type:node.type,interaction:node.interaction,stage:node.stage,title:node.title,
    persona:personas[node.personaId],position:node.position,status:
      run.completedNodeIds.has(node.id)?'completed':run.currentNodeId===node.id?'active':'locked'
  }));
}

module.exports={personas,createDungeonGame,createRoom,moveRoom,respondRoom,roomView,mapView};
