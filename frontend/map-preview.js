'use strict';
let data=null;
let character=null;
let state=null; // runState

const TYPE_COLOR={
  combat:'#6db3a8',elite:'#d4a574',boss:'#d4c36a',
  event:'#7f9ad4',rest:'#8fbf7a',shop:'#c49b6c',treasure:'#b8a0d4'
};

async function boot(){
  const res=await fetch('/roguelike-sample.json');
  if(!res.ok)throw new Error('无法加载样本');
  data=await res.json();
  if(!Array.isArray(data.rooms))throw new Error('需要 V2 rooms 样本，请重启 npm start');
  document.getElementById('title').textContent=data.title||'尖塔预览';
  document.getElementById('designNote').textContent=data.designNote||'';
  document.getElementById('footerNote').textContent=
    '目标「'+data.expression+'」· '+data.learningGoal+' 预览含专注值结算，正式 Agent 会话仍由 B 接线。角色说明：docs/lessons/CHARACTERS.md';
  renderChars();
  document.getElementById('startRun').onclick=()=>{
    if(!character)return;
    beginRun();
  };
  document.getElementById('resetRun').onclick=()=>{
    document.getElementById('runUi').hidden=true;
    document.getElementById('pickChar').hidden=false;
    character=null;state=null;
    renderChars();
  };
}

function renderChars(){
  const box=document.getElementById('chars');
  box.replaceChildren();
  for(const c of data.characters||[]){
    const btn=document.createElement('button');
    btn.type='button';btn.className='char'+(character&&character.id===c.id?' selected':'');
    if(c.id==='listening_coach')btn.title=c.disabledReason||'';
    btn.innerHTML='<h3>'+esc(c.name)+'</h3><div class="tag">'+esc(c.tagline)+'</div><p>'+esc(c.blurb)+'</p><p><strong>弱：</strong>'+esc(c.weakness)+'</p>';
    btn.onclick=()=>{
      character=c;
      document.getElementById('startRun').disabled=false;
      renderChars();
    };
    box.append(btn);
  }
}

function beginRun(){
  const rules=data.runRules||{maxHp:5,startingHp:5};
  state={
    hp:rules.startingHp,
    maxHp:rules.maxHp,
    insight:character.startingInsight||0,
    relics:[...(character.startingRelics||[])],
    cards:[...(character.startingCards||[])],
    perks:new Set(character.perks||[]),
    currentRoomId:data.graph.startNodeId,
    cleared:new Set(),
    itemIndex:0,
    hintCharges:0,
    layerMissForgiven:false,
    path:[data.graph.startNodeId]
  };
  document.getElementById('pickChar').hidden=true;
  document.getElementById('runUi').hidden=false;
  document.getElementById('charChip').innerHTML='<strong>'+esc(character.name)+'</strong>';
  syncHud();
  drawMap();
  enterRoom(state.currentRoomId);
}

function roomById(id){return (data.rooms||[]).find(r=>r.id===id);}
function lineById(id){return (data.lines||[]).find(l=>l.id===id);}
function relicById(id){return (data.relicsCatalog||[]).find(r=>r.id===id);}

function syncHud(){
  const pct=Math.max(0,Math.round(100*state.hp/state.maxHp));
  document.getElementById('hpBar').style.width=pct+'%';
  document.getElementById('hpText').textContent=state.hp+'/'+state.maxHp;
  document.getElementById('insightBar').style.width=Math.min(100,state.insight*20)+'%';
  document.getElementById('insightText').textContent=String(state.insight);
  const rel=document.getElementById('relics');
  rel.replaceChildren();
  for(const id of state.relics){
    const r=relicById(id);
    const s=document.createElement('span');
    s.className='chip';s.textContent=r?r.name:id;s.title=r?r.effect:'';
    rel.append(s);
  }
  for(const id of state.cards){
    const c=(data.cards||[]).find(x=>x.id===id);
    const s=document.createElement('span');
    s.className='chip';s.textContent=c?('卡:'+c.title):id;
    rel.append(s);
  }
}

function reachableIds(){
  if(!state)return new Set();
  const set=new Set();
  if(!state.cleared.has(state.currentRoomId)){
    set.add(state.currentRoomId);
    return set;
  }
  for(const e of data.graph.edges||[]){
    if(e.from===state.currentRoomId)set.add(e.to);
  }
  return set;
}

function drawMap(){
  const svg=document.getElementById('map');
  svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const rooms=data.rooms||[];
  const maxRow=Math.max(...rooms.map(r=>r.row||0),1);
  const positions={};
  for(const r of rooms){
    const x=40+(r.col||0)*90;
    const y=30+(r.row||0)*95;
    positions[r.id]={x:x+45,y:y+28};
  }

  const defs=document.createElementNS(ns,'defs');
  const marker=document.createElementNS(ns,'marker');
  marker.setAttribute('id','arrow');marker.setAttribute('viewBox','0 0 10 10');
  marker.setAttribute('refX','8');marker.setAttribute('refY','5');
  marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');
  marker.setAttribute('orient','auto-start-reverse');
  const tip=document.createElementNS(ns,'path');
  tip.setAttribute('d','M0 0 L10 5 L0 10 z');tip.setAttribute('fill','#6a7d94');
  marker.append(tip);defs.append(marker);svg.append(defs);

  const h=Math.max(620, (maxRow+1)*95+40);
  svg.setAttribute('viewBox','0 0 260 '+h);

  for(const e of data.graph.edges||[]){
    const a=positions[e.from],b=positions[e.to];
    if(!a||!b)continue;
    const path=document.createElementNS(ns,'path');
    const midY=(a.y+b.y)/2;
    path.setAttribute('d',`M ${a.x} ${a.y+20} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y-20}`);
    path.setAttribute('fill','none');
    path.setAttribute('stroke',e.when==='player_choice'?'#8aa0bc':'#5f738c');
    path.setAttribute('stroke-width','1.5');
    if(e.when==='player_choice')path.setAttribute('stroke-dasharray','4 3');
    path.setAttribute('marker-end','url(#arrow)');
    svg.append(path);
  }

  const reach=reachableIds();
  for(const r of rooms){
    const p=positions[r.id];
    const g=document.createElementNS(ns,'g');
    let cls='node';
    if(state&&state.currentRoomId===r.id)cls+=' active';
    if(state&&state.cleared.has(r.id))cls+=' cleared';
    if(reach.has(r.id))cls+=' reachable';
    g.setAttribute('class',cls);
    const rect=document.createElementNS(ns,'rect');
    rect.setAttribute('x',p.x-42);rect.setAttribute('y',p.y-22);
    rect.setAttribute('width',84);rect.setAttribute('height',44);
    rect.setAttribute('fill','#1a2330');
    rect.setAttribute('stroke',TYPE_COLOR[r.roomType]||'#6db3a8');
    rect.setAttribute('stroke-width',reach.has(r.id)?'2.5':'1.2');
    const t1=document.createElementNS(ns,'text');
    t1.setAttribute('x',p.x);t1.setAttribute('y',p.y-2);t1.setAttribute('text-anchor','middle');
    t1.textContent=short(r.roomType,8);
    const t2=document.createElementNS(ns,'text');
    t2.setAttribute('class','sub');t2.setAttribute('x',p.x);t2.setAttribute('y',p.y+14);t2.setAttribute('text-anchor','middle');
    t2.textContent=short((r.title||'').replace(/^[^·]*·\s*/,''),8);
    g.append(rect,t1,t2);
    g.onclick=()=>{
      if(!state)return;
      if(reach.has(r.id)){
        if(r.id!==state.currentRoomId){
          state.currentRoomId=r.id;
          state.itemIndex=0;
          state.path.push(r.id);
        }
        drawMap();
        enterRoom(r.id);
      }
    };
    svg.append(g);
  }
}

function enterRoom(id){
  const room=roomById(id);
  const play=document.getElementById('play');
  if(!room){play.textContent='房间不存在';return;}
  const enc=room.encounter||{};
  let html='<h2>'+esc(room.title)+'</h2>';
  html+='<p class="muted">'+esc(room.roomType)+' · 主持 '+esc(room.personaId);
  if(enc.items)html+=' · 题包 '+enc.items.length+' 题';
  html+='</p>';

  if(enc.kind==='dialogue_choice'){
    html+=renderEvent(room,enc);
  }else if(enc.kind==='rest'){
    html+=renderRest(room,enc);
  }else if(enc.kind==='shop'){
    html+=renderShop(room,enc);
  }else if(enc.kind==='treasure'){
    html+=renderTreasure(room,enc);
  }else if(Array.isArray(enc.items)&&enc.items.length){
    html+=renderCombat(room,enc);
  }else{
    html+='<p class="muted">空房间</p>';
  }
  play.innerHTML=html;
  bindPlayHandlers(room);
}

function renderCombat(room,enc){
  if(state.cleared.has(room.id)){
    return '<p class="muted">本房已通关。请在地图选择下一间高亮房间。</p><div class="actions"><button type="button" data-act="next">查看可去之路</button></div>';
  }
  const item=enc.items[state.itemIndex];
  if(!item)return '<p class="muted">题包异常</p>';
  const useHint=state.hintCharges>0;
  const showAxis=(item.contrastAxis)&&(state.perks.has('contrast_axis_visible')||state.relics.includes('relic-sticky-notes')||useHint);
  let html='<div class="q" data-qid="'+esc(item.id)+'">';
  html+='<div class="muted">第 '+(state.itemIndex+1)+' / '+enc.items.length+' 题'+(state.hintCharges?' · 提示券×'+state.hintCharges:'')+'</div>';
  html+='<p><strong>'+esc(item.prompt)+'</strong></p>';
  if(showAxis&&item.contrastAxis)html+='<p class="muted">对照轴：'+esc(item.contrastAxis)+'</p>';
  else if(useHint)html+='<p class="muted">提示：先看证据句里的时间词/否定词，再判断「还在」还是「还没」。本提示将在作答后消耗 1 张券。</p>';
  html+='<p class="muted">'+esc(item.morphologyNote||'')+'</p>';
  const ev=item.target&&item.target.evidenceLineIds||[];
  for(const lid of ev){
    const L=lineById(lid);
    if(L)html+='<div class="line">'+esc(L.text)+'</div>';
  }
  item.options.forEach((opt,i)=>{
    html+='<button type="button" data-choice="'+i+'">'+String.fromCharCode(65+i)+' · '+esc(opt)+'</button>';
  });
  html+='<p class="muted" id="qFeedback"></p></div>';
  return html;
}

function renderEvent(room,enc){
  if(state.cleared.has(room.id))return '<p class="muted">事件已完成。选择下一房间。</p>';
  let html='<p><strong>'+esc(enc.speaker||'')+'</strong>：'+esc(enc.line||'')+'</p>';
  for(const c of enc.choices||[]){
    if(c.requirePerk&&!state.perks.has(c.requirePerk))continue;
    html+='<button type="button" data-event="'+esc(c.id)+'" style="display:block;width:100%;margin:6px 0;padding:8px 10px;border-radius:8px;border:1px solid #3b4b61;background:#243041;color:#fff;cursor:pointer">'+esc(c.reply);
    if(c.hint)html+=' <span class="muted">('+esc(c.hint)+')</span>';
    html+='</button>';
  }
  return html;
}

function renderRest(room,enc){
  if(state.cleared.has(room.id))return '<p class="muted">已休息过。</p>';
  let html='<p class="muted">回复专注值。旅人额外 +1。</p>';
  for(const o of enc.options||[]){
    html+='<button type="button" data-rest="'+esc(o.id)+'" style="display:block;width:100%;margin:6px 0;padding:8px 10px;border-radius:8px;border:1px solid #3b4b61;background:#243041;color:#fff;cursor:pointer">'+esc(o.label)+' — '+esc(o.note||'')+'</button>';
  }
  return html;
}

function renderShop(room,enc){
  let html='<p class="muted">花洞察购买。下面每项都写了用途；买完可继续逛，点「离开商店」再往下一房走。</p>';
  html+='<p class="muted">当前洞察 <strong>'+state.insight+'</strong>'+(state.hintCharges?' · 提示券剩余 '+state.hintCharges:'')+'</p>';
  for(const s of enc.stock||[]){
    const owned=s.relicId&&state.relics.includes(s.relicId);
    html+='<div class="q" style="margin:8px 0">';
    html+='<p><strong>'+esc(s.name)+'</strong> · 洞察 '+s.cost+(owned?' · 已拥有':'')+'</p>';
    html+='<p class="muted">'+esc(s.blurb||'（暂无说明）')+'</p>';
    html+='<button type="button" data-buy="'+esc(s.id)+'" '+(owned?'disabled':'')+' style="display:block;width:100%;margin:6px 0;padding:8px 10px;border-radius:8px;border:1px solid #3b4b61;background:#243041;color:#fff;cursor:pointer">'+(owned?'已持有该遗物':'购买')+'</button>';
    html+='</div>';
  }
  html+='<div class="actions"><button type="button" data-act="leave-shop">离开商店（标记通关）</button></div>';
  return html;
}

function renderTreasure(room,enc){
  if(state.cleared.has(room.id))return '<p class="muted">宝箱已空。</p>';
  return '<p>发现遗物与卡片。</p><div class="actions"><button type="button" data-act="open-treasure">打开</button></div>';
}

function bindPlayHandlers(room){
  const play=document.getElementById('play');
  play.querySelectorAll('[data-choice]').forEach(btn=>{
    btn.onclick=()=>answerItem(room,Number(btn.getAttribute('data-choice')),btn);
  });
  play.querySelectorAll('[data-event]').forEach(btn=>{
    btn.onclick=()=>pickEvent(room,btn.getAttribute('data-event'));
  });
  play.querySelectorAll('[data-rest]').forEach(btn=>{
    btn.onclick=()=>doRest(room,btn.getAttribute('data-rest'));
  });
  play.querySelectorAll('[data-buy]').forEach(btn=>{
    btn.onclick=()=>doBuy(room,btn.getAttribute('data-buy'));
  });
  const leave=play.querySelector('[data-act="leave-shop"]');
  if(leave)leave.onclick=()=>{clearRoom(room);enterRoom(room.id);drawMap();};
  const treasure=play.querySelector('[data-act="open-treasure"]');
  if(treasure)treasure.onclick=()=>openTreasure(room);
  const next=play.querySelector('[data-act="next"]');
  if(next)next.onclick=()=>drawMap();
}

function answerItem(room,choice,btn){
  const items=room.encounter.items;
  const item=items[state.itemIndex];
  const fb=document.getElementById('qFeedback');
  const correct=choice===item.correctIndex;
  const play=document.getElementById('play');
  if(state.hintCharges>0){state.hintCharges-=1;syncHud();}
  play.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);
  btn.classList.add(correct?'ok':'bad');
  if(correct){
    fb.textContent='答对。'+item.explanation;
    state.insight+=room.insightReward&&state.itemIndex===items.length-1?0:0;
    state.itemIndex+=1;
    if(state.itemIndex>=items.length){
      state.insight+=(room.insightReward||0);
      if(room.relicReward&&!state.relics.includes(room.relicReward))state.relics.push(room.relicReward);
      clearRoom(room);
      fb.textContent+=' 房间通关！地图上选择下一间。';
      syncHud();drawMap();
      setTimeout(()=>enterRoom(room.id),600);
    }else{
      syncHud();
      setTimeout(()=>enterRoom(room.id),500);
    }
  }else{
    fb.textContent='答错。'+item.remedial;
    loseHp();
    syncHud();
    play.querySelectorAll('[data-choice]').forEach(b=>b.disabled=false);
    btn.disabled=false;
  }
}

function loseHp(){
  if(state.relics.includes('relic-knife')&&!state.layerMissForgiven){
    state.layerMissForgiven=true;
    return;
  }
  state.hp-=(data.runRules&&data.runRules.wrongAnswerHpLoss)||1;
  if(state.hp<=0){
    state.hp=0;
    alert('专注值归零：本局失败（预览）。可点「重开」。');
  }
}

function clearRoom(room){
  state.cleared.add(room.id);
}

function pickEvent(room,choiceId){
  const c=(room.encounter.choices||[]).find(x=>x.id===choiceId);
  if(!c)return;
  if(c.effect&&c.effect.insight)state.insight+=c.effect.insight;
  if(c.effect&&c.effect.hp)state.hp=Math.min(state.maxHp,state.hp+c.effect.hp);
  clearRoom(room);
  syncHud();drawMap();enterRoom(room.id);
}

function doRest(room,optId){
  const o=(room.encounter.options||[]).find(x=>x.id===optId);
  if(!o)return;
  let heal=(data.runRules&&data.runRules.restHeal)||1;
  if(optId==='heal'){
    if(state.perks.has('rest_heal_bonus'))heal+=(data.runRules.restHealBonusStory||1);
    state.hp=Math.min(state.maxHp,state.hp+heal);
  }
  clearRoom(room);
  syncHud();drawMap();enterRoom(room.id);
}

function doBuy(room,stockId){
  const s=(room.encounter.stock||[]).find(x=>x.id===stockId);
  if(!s)return;
  if(s.relicId&&state.relics.includes(s.relicId)){alert('已拥有该遗物');return;}
  if(state.insight<s.cost){alert('洞察不足');return;}
  state.insight-=s.cost;
  if(s.relicId)state.relics.push(s.relicId);
  if(s.effect&&s.effect.hp)state.hp=Math.min(state.maxHp,state.hp+s.effect.hp);
  if(s.effect&&s.effect.hintCharges)state.hintCharges+=(s.effect.hintCharges||0);
  syncHud();
  enterRoom(room.id);
  alert('已购买：'+s.name+(s.blurb?'\n'+s.blurb:''));
}

function openTreasure(room){
  const enc=room.encounter;
  if(enc.relicId&&!state.relics.includes(enc.relicId))state.relics.push(enc.relicId);
  for(const cid of enc.cardIds||[])if(!state.cards.includes(cid))state.cards.push(cid);
  clearRoom(room);
  syncHud();drawMap();enterRoom(room.id);
}

function short(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}

boot().catch(err=>{
  document.getElementById('designNote').textContent=err.message;
});
