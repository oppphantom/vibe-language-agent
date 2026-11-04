'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {journey,lines}=require('../content/fixtures/demo');
const {fallbackDungeon,validateDungeon}=require('../backend/agent/dungeon-agent');
const {createDungeonGame,createRoom,moveRoom,respondRoom,roomView}=require('../backend/agent/dungeon');

const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function find(room,kind){return room.objects.find(object=>object.kind===kind&&!room.resolved.includes(object.id))}
function walk(room,node,target,onObject){
  const start={x:room.player.x,y:room.player.y},queue=[{...start,path:[]}],seen=new Set([`${start.x},${start.y}`]);
  while(queue.length){
    const current=queue.shift();
    if(current.x===target.x&&current.y===target.y){
      let state=room,last=null;
      for(const direction of current.path){const moved=moveRoom(node,state,direction);state=moved.room;last=moved;if(moved.event.type==='challenge'||moved.event.type==='card')break}
      return {room:state,last};
    }
    for(const [direction,[dx,dy]] of Object.entries(vectors)){
      const x=current.x+dx,y=current.y+dy,key=`${x},${y}`,wall=room.walls.has(key);
      if(seen.has(key)||wall||x<1||x>17||y<1||y>7)continue;
      seen.add(key);queue.push({x,y,path:[...current.path,direction]});
    }
  }
  throw Error('target unreachable');
}

test('fallback dungeon is generated from song knowledge and always adds a final character room',()=>{
  const dungeon=fallbackDungeon(journey,lines),game=createDungeonGame({...journey,materials:{songs:[],lines}},lines);
  assert.ok(dungeon.levels.length>=2);
  for(const level of dungeon.levels){
    assert.ok(level.entities.length>=3);
    assert.ok(level.entities.filter(entity=>entity.kind==='note'||entity.kind==='npc').length>=2);
    assert.ok(level.entities.some(entity=>entity.kind==='card'));
  }
  assert.equal(game.nodes.length,dungeon.levels.length+1);
  assert.equal(game.nodes.at(-1).interaction,'final');
  assert.ok(game.nodes.at(-1).chars.length>=2);
});

test('note collision pauses movement and returns a three-line listening challenge',()=>{
  const game=createDungeonGame({...journey,materials:{songs:[],lines}},lines),node=game.nodes[0],room=createRoom(node);room.enemies=[];
  const note=find(room,'note'),result=walk(room,node,note);
  assert.equal(result.last.event.type,'challenge');
  assert.equal(result.last.event.challenge.kind,'note');
  assert.equal(result.last.event.challenge.options.length,3);
  assert.equal(result.room.pending.objectId,note.id);
  const blocked=moveRoom(node,result.room,'right');
  assert.equal(blocked.event.type,'pending');
  const wrong=respondRoom(node,result.room,(note.entity.correctIndex+1)%3);
  assert.equal(wrong.event.type,'retry');
  const right=respondRoom(node,result.room,note.entity.correctIndex);
  assert.equal(right.event.type,'correct');assert.equal(right.room.pending,null);
});

test('knowledge cards reveal reading meaning usage and example',()=>{
  const game=createDungeonGame({...journey,materials:{songs:[],lines}},lines),node=game.nodes[0],room=createRoom(node);room.enemies=[];
  const card=find(room,'card');room.objects=[card];
  const result=walk(room,node,card);
  assert.equal(result.last.event.type,'card');
  for(const key of ['term','reading','meaning','usage','example'])assert.ok(result.last.event.card[key]);
});

test('final room scatters exact character tiles and requires lyric order',()=>{
  const game=createDungeonGame({...journey,materials:{songs:[],lines}},lines),node=game.nodes.at(-1),room=createRoom(node);room.enemies=[];
  const chars=room.objects.filter(object=>object.kind==='char');
  assert.deepEqual(chars.map(object=>object.char),node.chars);
  assert.ok(new Set(chars.map(object=>object.y)).size>=2);
  assert.ok(chars.some((object,index)=>index>0&&object.x<chars[index-1].x));
  const firstChar=chars.find(object=>object.char===node.chars[0]);
  const first=walk(room,node,firstChar);
  assert.equal(first.last.event.type,'char');
  const exit=walk(first.room,node,{x:17,y:7});
  assert.equal(exit.last.event.type,'locked');
  const view=roomView(node,first.room);
  assert.equal(view.phrase,node.chars[0]);
  assert.equal(Object.hasOwn(view,'charLegend'),false);
  assert.deepEqual(view.charObjects.map(item=>item.char).sort(),node.chars.slice(1).sort());
  assert.ok(!view.objective.includes(node.chars.join(' ')));
  assert.ok(view.tiles.join('').includes(node.chars[1]));
  assert.ok(!view.tiles.join('').includes('◇'));
});

test('dungeon validator rejects missing content types and missing scatter seed',()=>{
  const valid=fallbackDungeon(journey,lines);
  const withoutCards=structuredClone(valid);
  withoutCards.levels.forEach(level=>{level.entities=level.entities.filter(entity=>entity.kind!=='card')});
  assert.throws(()=>validateDungeon(withoutCards,journey,lines),error=>error.code==='MODEL_OUTPUT');
  const broken=structuredClone(valid);broken.final.scatterSeed='';
  assert.throws(()=>validateDungeon(broken,journey,lines),error=>error.code==='MODEL_OUTPUT');
  const sparse=structuredClone(valid);sparse.levels[0].entities=[sparse.levels[0].entities[0]];
  assert.throws(()=>validateDungeon(sparse,journey,lines),error=>error.code==='MODEL_OUTPUT');
});
