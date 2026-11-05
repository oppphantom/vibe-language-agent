'use strict';
const assert=require('node:assert/strict');
const {createServer}=require('../backend/server');
const planner=require('../backend/agent/planner');
const {fallbackDungeon}=require('../backend/agent/dungeon-agent');

const dynamicSong={
  id:'smoke-live-ja',title:'また会えた日',artist:'冒烟测试歌手',language:'ja',version:'smoke-v1',durationMs:120000,
  provider:'netease',providerId:'123456',playbackVerified:true,source:{kind:'lrclib',id:999}
};
const dynamicLines=[1,2,3,4].map(index=>({
  id:`${dynamicSong.id}-${index}`,songId:dynamicSong.id,
  text:['今日、また君に会えた。','雨のあとも、また歩こう。','昨日の言葉を覚えている。','明日もここで待ってる。'][index-1],
  startMs:index*5000,endMs:index*5000+4000,source:{kind:'lrclib',id:999},reviewStatus:'unverified'
}));
const nodeTypes=['listening','meaning','story','culture','rest','challenge'];
const fakePlan={
  targetExpression:'また',title:'また：真实歌曲冒烟课程',
  nodes:nodeTypes.map((type,index)=>({
    type,skill:`技能 ${index+1}`,title:`第 ${index+1} 站`,prompt:`第 ${index+1} 站题面`,
    options:['正确选项','干扰选项一','干扰选项二'],correctIndex:0,
    explanation:'依据同步歌词中的表达与行动。',remedial:'回到包含「また」的两行歌词。',
    evidenceLineIds:[dynamicLines[0].id,dynamicLines[1].id]
  }))
};

async function main(){
  const originalPlan=planner.plan;
  planner.plan=(input,{onProgress}={})=>originalPlan(input,{
    completeJsonImpl:async()=>structuredClone(fakePlan),
    dungeonGenerator:(course,{lines})=>Promise.resolve(fallbackDungeon(course,lines)),
    onProgress
  });
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  try{
    assert.equal((await call('/api/health')).data.ok,true);
    const catalog=(await call('/api/songs')).data;
    assert.deepEqual(catalog.languages.map(item=>item.code),['ko','ja','zh']);
    assert.equal(catalog.songs.length,6);
    assert.ok(catalog.songs.every(song=>song.languageLabel));

    const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    function playerPosition(node){for(let y=0;y<node.room.cells.length;y++)for(let x=0;x<node.room.cells[y].length;x++)if(node.room.cells[y][x]==='player')return {x,y};throw Error('player missing')}
    function routeTo(node,target){
      const start=playerPosition(node),queue=[{...start,path:[]}],seen=new Set([`${start.x},${start.y}`]);
      while(queue.length){
        const current=queue.shift();
        if(current.x===target.x&&current.y===target.y)return current.path;
        for(const [direction,[dx,dy]] of Object.entries(vectors)){
          const x=current.x+dx,y=current.y+dy,key=`${x},${y}`,kind=node.room.cells[y]?.[x];
          if(seen.has(key)||!kind||kind==='wall'||kind==='noise'||
            (kind==='char'&&(x!==target.x||y!==target.y))||
            ((kind==='exit'||kind==='locked-exit')&&(x!==target.x||y!==target.y)))continue;
          seen.add(key);queue.push({x,y,path:[...current.path,direction]});
        }
      }
      throw Error('room target unreachable');
    }
    async function walkTo(id,node,target,moveState){
      for(const direction of routeTo(node,target)){
        const moved=await call('/api/moves','POST',{sessionId:id,nodeId:node.id,submissionId:`${id}-${moveState.count++}`,direction});
        assert.equal(moved.status,200,moved.data.error?.message||'move failed');
        node=moved.data.node;
        if(moved.data.event.type==='noise')return {node,noise:true};
        if(moved.data.event.type==='challenge')return {node,challenge:true};
        if(node.id!==target.nodeId)return {node,completed:true};
      }
      return {node,noise:false};
    }
    async function finishTeaching(id,node,counter){
      let wrongChoice=0;
      while(node.teaching.phase!=='ready'){
        const phase=node.teaching.phase,action=phase==='check'?'answer':'continue';
        const taught=await call('/api/teach','POST',{sessionId:id,nodeId:node.id,
          submissionId:`${id}-teach-${counter.count++}`,action,...(action==='answer'?{choice:wrongChoice}:{})});
        assert.equal(taught.status,200,taught.data.error?.message||'teaching failed');
        node=taught.data.node;
        if(taught.data.event.type==='teaching-remedial')wrongChoice++;
      }
      return node;
    }
    async function complete(song,{branch=0,includeErrors=false}={}){
      const created=await call('/api/sessions','POST',{songId:song.id});
      assert.equal(created.status,201);assert.equal(created.data.language,song.language);
      const id=created.data.id;let node=(await call(`/api/sessions/${id}/node`)).data;
      const earlyRestart=await call(`/api/sessions/${id}/restart`,'POST');
      assert.equal(earlyRestart.status,409);assert.equal(earlyRestart.data.error.code,'RUN_INCOMPLETE');
      assert.ok(node.map.length>=3);assert.equal(node.room.tiles.length,9);assert.ok(!Object.hasOwn(node,'correctIndex'));
      const moveState={count:0},teachState={count:0};
      let responseCount=0;
      for(let turns=0;turns<300&&(await call(`/api/sessions/${id}`)).data.status!=='completed';turns++){
        node=(await call(`/api/sessions/${id}/node`)).data;
        if(node.teaching.phase!=='ready'){node=await finishTeaching(id,node,teachState);continue}
        if(node.room.pending){
          const challenge=node.room.pending.challenge;
          let choice=0;
          if(challenge.kind==='note'){
            const line=node.material.lines.find(item=>item.id===challenge.lineId);
            choice=challenge.options.findIndex(option=>option===line?.text);
          }
          const answered=await call('/api/respond','POST',{sessionId:id,nodeId:node.id,
            submissionId:`${id}-respond-${responseCount++}`,choice:Math.max(0,choice)});
          assert.equal(answered.data.event.type,'correct');
          continue;
        }
        let target=null;
        if(node.interaction==='path'){
          target=node.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='portal'&&node.room.tiles[item.y][item.x]===(branch===0?'S':'C'));
        }else if(node.interaction==='final'){
          const line=node.material.lines.find(item=>item.id===node.room.loopLineId);
          const expected=Array.from(String(line?.text||'').replace(/\s+/g,''))[node.room.charProgress];
          const nextChar=(node.room.charObjects||[]).find(item=>item.char===expected);
          if(nextChar)target={kind:'char',x:nextChar.x,y:nextChar.y};
          else{
            target=node.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='exit');
          }
        }else{
          const objectKinds=new Set(['note','sound','evidence','npc','relic','campfire','card']);
          target=node.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>objectKinds.has(item.kind));
          if(!target)target=node.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='exit');
        }
        if(!target)throw Error(`No target in ${node.id}`);
        target.nodeId=node.id;
        const walked=await walkTo(id,node,target,moveState);
        if(walked.noise||walked.challenge)continue;
        node=walked.node;
      }
      const finished=await call(`/api/sessions/${id}`);
      assert.equal(finished.data.status,'completed',`movement smoke stalled at ${node.id} in ${node.interaction}: ${node.room.collected}/${node.room.total}; ${node.room.tiles.join('|')}`);assert.equal(finished.data.language,song.language);
      assert.ok(finished.data.game.cards.length>=1);assert.equal(finished.data.mastery.status,'mastered');
      if(includeErrors){
        const after=await call('/api/moves','POST',{
          sessionId:id,nodeId:finished.data.route[finished.data.route.length-1],submissionId:`${id}-after`,direction:'right'
        });
        assert.equal(after.status,409);assert.equal(after.data.error.code,'ALREADY_COMPLETED');
      }
      return finished.data;
    }

    const korean=await complete(catalog.songs.find(song=>song.language==='ko'),{branch:0,includeErrors:true});
    assert.ok(korean.history.length>=korean.progress.total);
    const restarted=await call(`/api/sessions/${korean.id}/restart`,'POST');
    assert.equal(restarted.status,201);assert.equal(restarted.data.session.status,'active');
    assert.notEqual(restarted.data.session.id,korean.id);assert.equal(restarted.data.session.game.xp,0);
    assert.equal(restarted.data.node.room.tiles.length,9);
    const japanese=await complete(catalog.songs.find(song=>song.language==='ja'),{branch:1});
    assert.ok(japanese.history.length>=japanese.progress.total);
    const chinese=await complete(catalog.songs.find(song=>song.language==='zh'),{branch:0});
    assert.ok(chinese.history.length>=chinese.progress.total);
    const startedPlan=await call('/api/agent/plan-jobs','POST',{song:dynamicSong,lines:dynamicLines,language:'ja'});
    assert.equal(startedPlan.status,202);assert.equal(startedPlan.data.status,'queued');
    let planned=startedPlan.data;
    for(let poll=0;poll<50&&!['completed','failed'].includes(planned.status);poll++){
      await new Promise(resolve=>setTimeout(resolve,5));
      const response=await call(`/api/agent/plan-jobs/${planned.id}`);assert.equal(response.status,200);planned=response.data;
    }
    assert.equal(planned.status,'completed',planned.error?.message);assert.equal(planned.result.nodeCount,6);
    assert.ok(!Object.hasOwn(planned.result,'nodes'));assert.match(planned.result.provenance,/AI 生成/);
    const dynamicCreated=await call('/api/sessions','POST',{courseId:planned.result.courseId});
    assert.equal(dynamicCreated.status,201);assert.equal(dynamicCreated.data.mode,'ai_generated');
    const dynamicId=dynamicCreated.data.id;
    const dynamicMoveState={count:0},dynamicTeachState={count:0};
    let dynamicResponseCount=0;
    for(let turns=0;turns<300&&(await call(`/api/sessions/${dynamicId}`)).data.status!=='completed';turns++){
      const current=(await call(`/api/sessions/${dynamicId}/node`)).data;
      if(current.teaching.phase!=='ready'){
        await finishTeaching(dynamicId,current,dynamicTeachState);continue;
      }
      if(current.room.pending){
        const challenge=current.room.pending.challenge;
        let choice=0;
        if(challenge.kind==='note'){
          const line=current.material.lines.find(item=>item.id===challenge.lineId);
          choice=challenge.options.findIndex(option=>option===line?.text);
        }
        const answered=await call('/api/respond','POST',{sessionId:dynamicId,nodeId:current.id,
          submissionId:`${dynamicId}-respond-${dynamicResponseCount++}`,choice:Math.max(0,choice)});
        assert.equal(answered.data.event.type,'correct');
        continue;
      }
      let target;
      if(current.interaction==='path'){
        target=current.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='portal');
      }else if(current.interaction==='final'){
        const line=current.material.lines.find(item=>item.id===current.room.loopLineId);
        const expected=Array.from(String(line?.text||'').replace(/\s+/g,''))[current.room.charProgress];
        const nextChar=(current.room.charObjects||[]).find(item=>item.char===expected);
        target=nextChar?{kind:'char',x:nextChar.x,y:nextChar.y}:current.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='exit');
        if(!target)target=current.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='exit');
      }else{
        const kinds=new Set(['note','sound','evidence','npc','relic','campfire','card']);
        target=current.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>kinds.has(item.kind));
        if(!target)target=current.room.cells.flatMap((row,y)=>row.map((kind,x)=>({kind,x,y}))).find(item=>item.kind==='exit');
      }
      if(!target)throw Error(`dynamic room target missing at ${current.id}/${current.interaction}: ${current.room.tiles.join('|')}`);
      target.nodeId=current.id;
      const walked=await walkTo(dynamicId,current,target,dynamicMoveState);
      if(walked.noise||walked.challenge)continue;
    }
    const dynamicFinished=(await call(`/api/sessions/${dynamicId}`)).data;
    assert.equal(dynamicFinished.status,'completed');assert.ok(dynamicFinished.game.cards.length>=1);
    const invalidLanguage=await call('/api/lyrics/search','POST',{title:'Song',artist:'Artist',durationMs:120000,language:'en'});
    assert.equal(invalidLanguage.status,400);assert.equal(invalidLanguage.data.error.code,'INVALID_INPUT');
    console.log('HTTP smoke passed: ko/ja/zh + AI dungeon → notes/NPCs/cards → scattered character chain');
  }finally{planner.plan=originalPlan;await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
