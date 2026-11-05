'use strict';
const $=id=>document.getElementById(id);
const state={session:null,node:null,attempt:1,lines:[],song:null,active:null,audioUrl:null,languages:[],demoSongs:[],learningLanguage:'ko',roomLog:[],moving:false,moveQueue:[],modalId:null,finalPlaybackToken:0,finalPlaybackNodeId:null,finalPlayback:null,noteRetry:null,restarting:false};
function updateProgress(){const p=state.session?.progress;if(!p)return;const pct=p.total>0?Math.round(p.completed/p.total*100):0;const bar=$('progressBar'),fill=$('progressFill');if(bar)bar.setAttribute('aria-valuenow',String(pct));if(fill)fill.style.width=pct+'%';}
async function api(path,method='GET',body){const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'请求失败');return data;}
function mode(name){
  if(state.restarting)return;
  if(name!=='study'){state.finalPlaybackToken++;stopNotePlaybackRetry();if(!$('gameModal').hidden)closeGameModal()}
  $('music').hidden=name!=='music';$('demo').hidden=name!=='demo';$('live').hidden=name!=='live';$('study').hidden=name!=='study';
  for(const item of ['music','demo','live','study'])$(item+'Tab').classList.toggle('active',name===item);
}
$('musicTab').onclick=()=>mode('music');$('demoTab').onclick=()=>mode('demo');$('liveTab').onclick=()=>mode('live');
$('studyTab').onclick=()=>{mode('study');if(!state.session)$('studyProvenance').textContent='还没有学习会话。请从离线样例或真实歌词开始生成课程。'};
$('studyBack').onclick=()=>mode('music');
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function selectedLanguage(){return $('learningLanguage').value||'ko'}
function languageLabel(code){
  return state.languages.find(item=>item.code===code)?.label||{ko:'韩语',ja:'日语',zh:'中文'}[code]||'韩语';
}
function languageClass(code){return `language-text language-${['ko','ja','zh'].includes(code)?code:'ko'}`}
function renderDemoSongs(){
  const language=selectedLanguage();
  const matches=state.demoSongs.filter(item=>item.song.language===language);
  $('songs').replaceChildren(...matches.map(item=>item.card));
  if(!matches.length)$('songs').textContent=`暂无${languageLabel(language)}原创教学样例。`;
}
function updateLanguageControls(){
  const language=selectedLanguage(),label=languageLabel(language),examples={ko:'다시',ja:'また',zh:'再见'};
  state.learningLanguage=language;localStorage.setItem('vibe-learning-language',language);
  if(state.session&&state.session.language!==language){
    state.session=null;state.node=null;$('lesson').hidden=true;localStorage.removeItem('vibe-starter-session');
    mode('demo');
  }
  if(state.song&&state.song.language!==language){
    state.song=null;state.lines=[];$('liveLines').replaceChildren();$('liveStatus').textContent='学习语言已切换，请按新语言重新检索歌词。';
  }
  $('languageStatus').textContent=`当前学习${label}；课程、歌词检索与模型解释使用这个语言`;
  const currentExample=$('discoverQuery').value.trim();
  if(!currentExample||Object.values(examples).includes(currentExample))$('discoverQuery').value=examples[language];
  $('discoverQuery').placeholder=`例如 ${examples[language]}`;
  $('expression').placeholder=`输入要理解的表达，如 ${examples[language]}`;
  renderDemoSongs();
  document.dispatchEvent(new CustomEvent('learning-language-change',{detail:{language}}));
}
function currentNodeAttempt(){
  if(!state.session||!state.node)return 1;
  return state.session.history.filter(item=>item.nodeId===state.node.id).length+1;
}
function renderMap(){
  const labels={completed:'已通关',active:'当前关卡',locked:'尚未到达',skipped:'本轮未选择'};
  $('journeyMap').replaceChildren();
  for(const item of state.node.map) {
    const step=text('li', '', `mission-node is-${item.status} is-${item.interaction}`);
    step.style.left=(item.position?.x||0)+'%';
    step.style.top=(item.position?.y||0)+'px';
    step.append(text('span',item.persona?.glyph||'•','mission-node__glyph'),text('small',item.stage),text('strong',item.title),text('em',labels[item.status]));
    if(item.status==='active')step.setAttribute('aria-current','step');
    $('journeyMap').append(step);
  }
  const edges=$('adventureEdges');
  edges.replaceChildren();
  const positions=new Map(state.node.map.map(item=>[item.id,item.position]));
  for(const edge of state.node.edges||[]) {
    const from=positions.get(edge.from),to=positions.get(edge.to);
    if(!from||!to)continue;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',String((from.x||0)*10));
    line.setAttribute('y1',String((from.y||0)+36));
    line.setAttribute('x2',String((to.x||0)*10));
    line.setAttribute('y2',String((to.y||0)+36));
    line.setAttribute('class','adventure-edge');
    edges.append(line);
  }
}
function renderGameState(){
  const game=state.node.game||state.session.game||{xp:0,streak:0,cards:[]};
  $('gameXp').textContent=String(game.xp||0);
  $('gameStreak').textContent=String(game.streak||0);
  $('gameCards').textContent=String(game.cards?.length||0);
  renderInventory(game.cards||[]);
}
function renderInventory(cards){
  $('gameInventory').replaceChildren();
  if(!cards.length){$('gameInventory').append(text('p','还没有收集知识卡。'));return}
  for(const card of cards) {
    const item=document.createElement('article');
    item.className=`inventory-card is-${card.kind}`;
    item.append(text('small',card.kind),text('strong',card.title),text('p',card.body));
    $('gameInventory').append(item);
  }
}
async function init(){
  try{
    const data=await api('/api/songs');
    state.languages=data.languages||[];
    const storedLanguage=localStorage.getItem('vibe-learning-language')||'ko';
    $('learningLanguage').replaceChildren();
    for(const language of state.languages)$('learningLanguage').append(new Option(language.label,language.code));
    $('learningLanguage').value=state.languages.some(language=>language.code===storedLanguage)?storedLanguage:'ko';
    $('learningLanguage').onchange=updateLanguageControls;
    for(const song of data.songs) {
      const card=document.createElement('article');
      card.className='song-card';
      card.dataset.language=song.language;
      card.append(text('small','ORIGINAL DEMO'),text('h2',song.title),text('p',`VIBE 原创教学样例 · ${song.languageLabel||languageLabel(song.language)}`));
      const button=text('button','从这首歌开始');
      button.onclick=()=>start(song.id);
      card.append(button);
      state.demoSongs.push({song,card});
    }
    updateLanguageControls();
    const id=localStorage.getItem('vibe-starter-session');
    if(id) {
      try{
        state.session=await api('/api/sessions/'+encodeURIComponent(id));
        state.node=await api('/api/sessions/'+encodeURIComponent(id)+'/node');
        $('learningLanguage').value=state.session.language||'ko';
        updateLanguageControls();
        state.attempt=currentNodeAttempt();
        renderNode();
        mode('study');
      }catch{
        localStorage.removeItem('vibe-starter-session');
      }
    }
  }catch(e){$('songs').textContent=e.message}
}
async function startSession(body){
  state.session=await api('/api/sessions','POST',body);
  state.node=await api('/api/sessions/'+state.session.id+'/node');
  state.attempt=currentNodeAttempt();
  localStorage.setItem('vibe-starter-session',state.session.id);
  renderNode();
  mode('study');
  return state.session;
}
async function start(songId){
  try{
    await startSession({songId});
  }catch(e){$('feedback').textContent=e.message}
}
window.vibeStudy={startCourse:courseId=>startSession({courseId})};
const interactionLabels={listen:'听辨挑战',context:'语境推理',path:'路线岔路',story:'剧情剧场',culture:'文化放大镜',card:'营火复盘',final:'最终挑战'};
function renderAscii(room){
  const map=$('asciiMap');
  map.replaceChildren();
  room.tiles.forEach((line,rowIndex)=>{
    const row=text('div','','map-row');
    Array.from(line).forEach((char,columnIndex)=>{
      row.append(text('span',char,`map-cell is-${room.cells[rowIndex][columnIndex]}`));
    });
    map.append(row);
  });
  $('roomObjective').textContent=room.objective;
  $('roomProgress').textContent=room.exitOpen?`目标已点亮 · 前往出口 >`:`目标进度 ${room.collected}/${room.total} · 出口 ▯`;
  $('roomPhrase').hidden=!room.phrase;
  $('roomPhrase').textContent=room.phrase?`已接上 ${room.charProgress}/${room.charTotal}：${room.phrase}`:'';
  const legend=$('asciiLegend');
  legend.replaceChildren();
  for(const [label,value] of Object.entries(room.legend))legend.append(text('span',`${value} ${label}`));
}
function renderRoomLog(){
  $('roomLog').replaceChildren();
  if(!state.roomLog.length){$('roomLog').append(text('li','探索刚刚开始。移动 @ 收集线索吧。'));return}
  for(const message of state.roomLog.slice(0,8))$('roomLog').append(text('li',message));
}
function addRoomLog(message){
  if(!message)return;
  if(state.roomLog[0]!==message)state.roomLog.unshift(message);
  state.roomLog=state.roomLog.slice(0,8);
  renderRoomLog();
}
function setRestartLock(locked){
  state.restarting=locked;
  const main=document.querySelector('main');
  if(main)main.inert=locked;
  document.body.classList.toggle('is-restarting',locked);
  $('gameModal').classList.toggle('is-busy',locked);
  $('gameModal').setAttribute('aria-busy',String(locked));
  $('modalClose').disabled=locked;
  for(const button of $('modalOptions').children)button.disabled=locked;
}
function stopNotePlaybackRetry(){
  state.noteRetry?.cancel();state.noteRetry=null;
  if($('modalAudioStatus'))$('modalAudioStatus').textContent='';
}
function startNotePlaybackRetry(challenge){
  stopNotePlaybackRetry();
  if(challenge.kind!=='note')return;
  const line=state.node?.material?.lines?.find(item=>item.id===challenge.lineId);
  const song=line&&state.node.material.songs.find(item=>item.id===line.songId);
  if(!line||!song||!song.provider){
    $('modalAudioStatus').textContent='当前样例没有可控音源，无法自动回听。';
    return;
  }
  if(!window.VibePlaybackRetry||!window.vibeMusic?.playEvidence){
    $('modalAudioStatus').textContent='播放器尚未就绪，请稍后重试。';return;
  }
  const controller=window.VibePlaybackRetry.create({
    play:()=>window.vibeMusic.playEvidence(song,line),
    shouldContinue:()=>state.modalId===challenge.id&&!$('gameModal').hidden&&!$('study').hidden&&
      state.session?.status==='active'&&state.node?.room?.pending?.objectId===challenge.id,
    onAttempt:count=>{$('modalAudioStatus').textContent=count===1?'正在自动播放歌词…':`回听暂未成功，正在自动重试（第 ${count} 次）…`},
    onSuccess:()=>{$('modalAudioStatus').textContent='回听成功，可以作答。'},
    onFailure:count=>{$('modalAudioStatus').textContent=`还没有成功播放，将自动重试（已尝试 ${count} 次）。`}
  });
  state.noteRetry=controller;controller.start();
}
function closeGameModal(){
  if(state.restarting)return;
  stopNotePlaybackRetry();
  $('gameModal').hidden=true;state.modalId=null;$('modalFeedback').textContent='';
}
function showKnowledgeCard(card){
  stopNotePlaybackRetry();
  state.modalId=card.id||'knowledge-card';
  $('gameModal').hidden=false;$('modalKind').textContent='KNOWLEDGE CARD';
  $('modalTitle').textContent=card.term||'知识卡';
  $('modalPrompt').textContent='这张卡片已收入探索行囊。';
  $('modalOptions').replaceChildren();$('modalFeedback').textContent='';
  const body=$('modalCard');body.hidden=false;body.replaceChildren();
  body.append(text('strong',card.term||'知识卡'));
  const list=document.createElement('dl');
  for(const [label,value] of [['读音',card.reading],['意思',card.meaning],['用法',card.usage],['例句',card.example]]){
    if(!value)continue;list.append(text('dt',label),text('dd',value));
  }
  body.append(list);
}
function showChallenge(challenge){
  const sameOpenChallenge=state.modalId===challenge.id&&!$('gameModal').hidden;
  if(!sameOpenChallenge)stopNotePlaybackRetry();
  state.modalId=challenge.id;
  $('gameModal').hidden=false;
  $('modalKind').textContent=challenge.kind==='note'?'LISTEN & CHOOSE':'STORY ENCOUNTER';
  $('modalTitle').textContent=challenge.kind==='note'?'听音辨词':'情境抉择';
  $('modalPrompt').textContent=challenge.prompt;
  $('modalCard').hidden=true;$('modalFeedback').textContent='';
  $('modalOptions').replaceChildren();
  challenge.options.forEach((option,index)=>{
    const button=text('button',`${String.fromCharCode(65+index)} · ${option}`);
    button.type='button';button.onclick=()=>respondChallenge(challenge,index,button);
    $('modalOptions').append(button);
  });
  if(challenge.kind==='note'&&!sameOpenChallenge)startNotePlaybackRetry(challenge);
}
function applyServerNode(result){
  state.session=result.session;state.node=result.node;
  renderNode();renderGameState();renderMap();updateProgress();
}
async function respondChallenge(challenge,choice,button){
  const buttons=[...$('modalOptions').children];if(buttons.some(item=>item.disabled))return;
  buttons.forEach(item=>item.disabled=true);
  try{
    const result=await api('/api/respond','POST',{sessionId:state.session.id,nodeId:state.node.id,
      submissionId:crypto.randomUUID(),choice});
    const correct=result.event.type==='correct';
    button.classList.add(correct?'is-correct':'is-wrong');
    $('modalFeedback').textContent=result.event.message+(result.event.xpEarned?`　经验 +${result.event.xpEarned}`:'');
    if(correct){
      stopNotePlaybackRetry();
      applyServerNode(result);
      addRoomLog('回答正确：'+result.event.message);
      closeGameModal();
    }else{
      state.session=result.session;state.node=result.node;renderGameState();renderMap();
      buttons.forEach(item=>item.disabled=false);
      button.classList.add('is-wrong');
    }
  }catch(error){
    $('modalFeedback').textContent='提交失败：'+error.message;
    buttons.forEach(item=>item.disabled=false);
  }
}
async function restartAdventure(button){
  if(state.restarting)return;
  const buttons=[...$('modalOptions').children];
  const audioStatus=$('modalAudioStatus');
  setRestartLock(true);
  $('modalTitle').textContent='正在重新生成地下城…';
  $('modalPrompt').textContent='新的知识关卡生成完成前，页面不会响应其它操作。';
  audioStatus.textContent='正在重新生成知识关卡…';
  $('modalFeedback').textContent='';
  try{
    const result=await api(`/api/sessions/${encodeURIComponent(state.session.id)}/restart`,'POST');
    setRestartLock(false);
    state.session=result.session;state.node=result.node;
    state.roomLog=[];state.attempt=1;state.finalPlaybackNodeId=null;state.finalPlaybackToken++;state.finalPlayback=null;
    localStorage.setItem('vibe-starter-session',state.session.id);
    renderNode();
    mode('study');
    addRoomLog('新的地下城已经生成。');
  }catch(error){
    setRestartLock(false);
    showFinishChoice();
    $('modalAudioStatus').textContent='';
    $('modalFeedback').textContent='重新生成失败：'+error.message;
    buttons.forEach(item=>item.disabled=false);
  }
}
function showFinishChoice(){
  if(state.session?.status!=='completed')return;
  stopNotePlaybackRetry();
  state.modalId='run-complete';
  $('gameModal').hidden=false;
  $('modalKind').textContent='DUNGEON COMPLETE';
  $('modalTitle').textContent='本轮地下城已通关';
  $('modalPrompt').textContent='接下来想重新生成一套知识关卡，还是返回音乐界面继续听歌？';
  $('modalCard').hidden=true;$('modalAudioStatus').textContent='';
  $('modalFeedback').textContent=state.session.mastery?.summary||'';
  $('modalOptions').replaceChildren();
  const restart=text('button','重新来一遍（重新生成一遍知识关卡）');
  restart.type='button';restart.onclick=()=>restartAdventure(restart);
  const back=text('button','返回音乐界面');
  back.type='button';back.onclick=()=>{closeGameModal();mode('music')};
  $('modalOptions').append(restart,back);
}
function finalLineEvidence(node){
  if(node.interaction!=='final'||node.status==='completed'||!node.room.loopLineId)return null;
  const line=node.material.lines.find(item=>item.id===node.room.loopLineId);
  const song=line&&node.material.songs.find(item=>item.id===line.songId);
  return line&&song?{line,song}:null;
}
async function playFinalOnce(node,{automatic=false}={}){
  const evidence=finalLineEvidence(node),button=$('playFinalLine');
  if(!evidence||!window.vibeMusic?.playEvidence)return;
  const {line,song}=evidence;
  if(!song.provider){$('studyPlayback').textContent='当前样例没有可播放音源。';return}
  if(!state.finalPlayback)state.finalPlayback=window.VibePlayOnce.create({play:()=>window.vibeMusic.playEvidence(song,line)});
  if(state.finalPlayback.running)return;
  const token=++state.finalPlaybackToken;
  button.disabled=true;
  $('studyPlayback').textContent=automatic?'正在播放任务歌词…':'正在重播这句歌词…';
  const played=await state.finalPlayback.run();
  if(token!==state.finalPlaybackToken||$('study').hidden||state.session.status==='completed')return;
  button.disabled=false;
  button.textContent='▶ 再听一遍';
  if(played)$('studyPlayback').textContent='正在播放一遍，句末会自动暂停。需要时可点“再听一遍”。';
}
function renderFinalPlayback(node){
  const evidence=finalLineEvidence(node),controls=$('finalPlaybackControls'),button=$('playFinalLine');
  controls.hidden=!evidence;
  if(!evidence)return;
  button.disabled=!evidence.song.provider||Boolean(state.finalPlayback?.running);
  button.title=evidence.song.provider?'重新播放这句，句末自动暂停':'当前材料没有可播放音源';
  button.onclick=()=>playFinalOnce(node);
}
function renderNode(){
  const node=state.node;
  const playbackNodeChanged=state.finalPlaybackNodeId!==node.id||node.status==='completed';
  if(playbackNodeChanged){state.finalPlaybackToken++;state.finalPlaybackNodeId=node.id;state.finalPlayback=null}
  closeGameModal();
  $('lesson').hidden=false;
  $('studyCourseTitle').textContent=`${state.session.courseTitle||'歌曲语境学习'} · ${state.session.languageLabel||languageLabel(state.session.language)}`;
  $('studyProvenance').textContent=node.provenance;
  $('studyPlayback').textContent='';
  $('rewardToast').hidden=true;
  $('levelStage').className=`level-stage is-${node.interaction}`;
  $('levelType').textContent=interactionLabels[node.interaction]||'语境挑战';
  $('personaGlyph').textContent=node.persona?.glyph||'◈';
  $('personaName').textContent=node.persona?.name||'语境向导';
  $('personaTone').textContent=node.persona?.tone||'';
  renderFinalPlayback(node);
  renderGameState();
  renderMap();
  renderAscii(node.room);
  renderRoomLog();
  $('source').replaceChildren();
  for(const song of node.material.songs) {
    const box=document.createElement('article');
    const sourceLabel=song.source?.kind==='original_demo'?'原创样例':'外部同步歌词';
    box.append(text('strong',`${song.title} · ${song.artist} / ${sourceLabel}`));
    for(const line of node.material.lines.filter(item=>item.songId===song.id)) {
      const row=text('div','','study-line');
      row.append(text('p',line.text,languageClass(song.language)));
      const play=text('button','听这一句','study-line__play');
      play.type='button';
      play.disabled=!song.provider||!Number.isInteger(line.startMs)||!Number.isInteger(line.endMs);
      play.title=play.disabled?'当前材料没有可控制的同步音源':'从证据位置播放到句末';
      play.onclick=async()=>{
        if(!window.vibeMusic?.playEvidence)return;
        $('studyPlayback').textContent='正在定位这一句…';
        try{
          await window.vibeMusic.playEvidence(song,line);
        }catch(error){$('studyPlayback').textContent='播放失败：'+error.message}
      };
      row.append(play);
      box.append(row);
    }
    $('source').append(box);
  }
  $('progress').textContent=state.session.progress.completed+' / '+state.session.progress.total+' 已完成';
  $('feedback').textContent=node.status==='completed'?`本轮探索已完成。${state.session.mastery.summary}`:'';
  $('feedback').className='room-event';
  updateProgress();
  if(node.room.pending?.challenge&&$('gameModal').hidden)setTimeout(()=>showChallenge(node.room.pending.challenge),0);
  if(playbackNodeChanged&&finalLineEvidence(node))setTimeout(()=>playFinalOnce(node,{automatic:true}),250);
  if(state.session.status==='completed')setTimeout(showFinishChoice,0);
}
async function movePlayer(direction){
  if(state.restarting)return;
  if(!$('gameModal').hidden){
    if(state.node.room.pending?.challenge)showChallenge(state.node.room.pending.challenge);
    return;
  }
  if(state.moving){if(state.moveQueue.length<2)state.moveQueue.push(direction);return}
  state.moving=true;
  const previousNodeId=state.node.id;
  try{
    const result=await api('/api/moves','POST',{
      sessionId:state.session.id,nodeId:state.node.id,submissionId:crypto.randomUUID(),direction
    });
    state.session=result.session;
    if(previousNodeId!==result.node.id)state.roomLog=[];
    state.node=result.node;
    renderNode();
    const event=result.event||{type:'move',message:'继续探索'};
    const good=['lyric','knowledge','card','glyph','char','portal','complete','correct','challenge'].includes(event.type);
    const bad=['noise','locked','wrong-glyph','wrong-char'].includes(event.type);
    $('feedback').textContent=event.message;
    $('feedback').className=`room-event${good?' is-good':''}${bad?' is-bad':''}`;
    addRoomLog(event.message);
    if(event.type==='challenge'&&event.challenge){
      showChallenge(event.challenge);
    }
    if(['lyric','knowledge'].includes(event.type)&&event.lineId){
      const line=state.node.material.lines.find(item=>item.id===event.lineId);
      const song=line&&state.node.material.songs.find(item=>item.id===line.songId);
      if(line&&song&&window.vibeMusic?.playEvidence){
        $('studyPlayback').textContent='正在播放这一幕的歌词回声…';
        window.vibeMusic.playEvidence(song,line).catch(error=>{$('studyPlayback').textContent='回听失败：'+error.message});
      }
    }
    if(event.card){
      showKnowledgeCard(event.card);
      $('rewardToast').hidden=false;
      $('rewardToast').replaceChildren(text('small','NEW KNOWLEDGE CARD'),text('strong',event.card.term),text('p',event.card.meaning||''));
    }else if(event.reward){
      const reward=event.reward;
      $('rewardToast').hidden=false;
      $('rewardToast').replaceChildren(text('small','NEW KNOWLEDGE CARD'),text('strong',reward.title),text('p',reward.body));
    }
    if(event.xpEarned)$('feedback').textContent+=`　经验 +${event.xpEarned}`;
    if(event.type==='complete')$('feedback').textContent+=event.reward?`　获得「${event.reward.title}」`:'';
    if(state.session.status==='completed')$('feedback').textContent+=`\n${state.session.mastery.summary}`;
    renderGameState();
    renderMap();
    updateProgress();
  }catch(e){
    $('feedback').textContent=e.message;$('feedback').className='room-event is-bad';
  }finally{
    state.moving=false;
    const nextDirection=state.moveQueue.shift();
    if(nextDirection)movePlayer(nextDirection);
  }
}
document.addEventListener('keydown',event=>{
  if(state.restarting){event.preventDefault();event.stopImmediatePropagation()}
},true);
document.addEventListener('keydown',event=>{
  if($('study').hidden||!$('gameModal').hidden||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;
  const directions={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  const direction=directions[event.key];
  if(!direction)return;
  event.preventDefault();movePlayer(direction);
});
for(const button of document.querySelectorAll('.move-pad button'))button.onclick=()=>movePlayer(button.dataset.direction);
$('modalClose').onclick=closeGameModal;
$('gameModal').addEventListener('click',event=>{if(event.target===$('gameModal'))closeGameModal()});
const fmt=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
$('lookup').onsubmit=async event=>{event.preventDefault();$('liveStatus').textContent='正在检索和核对版本…';state.song=null;state.lines=[];$('liveLines').replaceChildren();$('liveLearning').hidden=true;$('livePlanStatus').textContent='';try{const language=selectedLanguage();const data=await api('/api/lyrics/search','POST',{title:$('title').value.trim(),artist:$('artist').value.trim(),durationMs:Math.round(Number($('duration').value)*1000),language});if(data.status!=='unverified'){$('liveStatus').textContent='没有找到时长匹配的同步歌词。';return}state.song=data.song;state.lines=data.lines;$('liveStatus').textContent=`找到 ${data.lines.length} 行${languageLabel(language)}歌词；来源 ${data.source}，语言由你选择且尚未自动核验。请确认音频版本。`;renderLines();$('liveLearning').hidden=false}catch(e){$('liveStatus').textContent=e.message}};
$('planLiveSong').onclick=async()=>{
  if(!state.song||!state.lines.length){$('livePlanStatus').textContent='请先检索同步歌词。';return}
  const button=$('planLiveSong');button.disabled=true;$('livePlanStatus').textContent='AI 正在分析歌词并校验探索关卡，可能需要几十秒…';
  try{
    const plan=await api('/api/agent/plan','POST',{song:state.song,lines:state.lines,language:state.song.language||selectedLanguage()});
    $('livePlanStatus').textContent=`${plan.provenance}；正在打开「${plan.title}」。`;
    await startSession({courseId:plan.courseId});
  }catch(error){$('livePlanStatus').textContent='课程生成失败：'+error.message}
  finally{button.disabled=false}
};
function renderLines(){$('liveLines').replaceChildren();for(const line of state.lines){const b=document.createElement('button');b.type='button';b.append(text('span',fmt(line.startMs)),text('strong',line.text,languageClass(state.song?.language||selectedLanguage())));b.disabled=!$('audio').src||line.endMs===null;b.title=line.endMs===null?'缺少句末时间':'播放这一句';b.onclick=()=>playLine(line);$('liveLines').append(b)}}
$('audioFile').onchange=()=>{const file=$('audioFile').files[0];if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=file?URL.createObjectURL(file):null;$('audio').src=state.audioUrl||'';$('playStatus').textContent=file?'已关联本地音频；请先核对歌词版本和时间偏移。':'没有音源时，逐句播放不可用。';renderLines()};
$('speed').onchange=()=>$('audio').playbackRate=Number($('speed').value);
function playLine(line){const audio=$('audio'),offset=Number($('offset').value)*1000||0,start=(line.startMs+offset)/1000,end=(line.endMs+offset)/1000;if(!audio.src||start<0||end<=start){$('playStatus').textContent='音频或时间范围不可用。';return}state.active={start,end};audio.currentTime=start;audio.playbackRate=Number($('speed').value);audio.play().then(()=>$('playStatus').textContent='正在播放 '+fmt(line.startMs)+'，句末自动暂停。').catch(e=>$('playStatus').textContent=e.message)}
$('audio').ontimeupdate=()=>{const a=$('audio');if(state.active&&a.currentTime>=state.active.end-0.04){if($('loop').checked){a.currentTime=state.active.start;a.play()}else{a.pause();state.active=null;$('playStatus').textContent='这一句已播放完。'}}};
$('explain').onclick=async()=>{const expression=$('expression').value.trim();if(!expression||!state.lines.length){$('explanation').textContent='先检索真实歌词，再输入表达。';return}$('explanation').textContent='正在调用已配置模型…';try{const language=state.song?.language||selectedLanguage();const data=await api('/api/agent/explain','POST',{expression,language,lines:state.lines.slice(0,6).map(x=>x.text)});$('explanation').textContent=`${data.origin}\n语言：${data.languageLabel||languageLabel(language)}\n基本意思：${data.meaning}\n当前语境：${data.context}\n不确定之处：${data.uncertainty}`}catch(e){$('explanation').textContent=e.message}};
const CODE_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]()<>/*+-=&|!?;:';
const codeHosts=new WeakSet();
const canHover=window.matchMedia('(hover:hover)').matches;
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function randomCode(length){let value='';for(let i=0;i<length;i++)value+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];return value}
function initCodeEffect(host,length){
  if(!canHover||reduceMotion||codeHosts.has(host))return;
  codeHosts.add(host);
  const tag=host.matches('button,.client-play-link')?'span':'div';
  const glow=document.createElement(tag);
  glow.className='card-glow';glow.setAttribute('aria-hidden','true');
  const code=document.createElement(tag);
  code.className='card-code';code.setAttribute('aria-hidden','true');code.textContent=randomCode(length);
  host.prepend(glow);host.prepend(code);host.classList.add('has-code');
  let targetX=0,targetY=0,currentX=0,currentY=0,frame=0,lastCode=0;
  const paint=()=>{host.style.setProperty('--mx',currentX+'px');host.style.setProperty('--my',currentY+'px')};
  const tick=()=>{
    currentX+=(targetX-currentX)*.2;currentY+=(targetY-currentY)*.2;paint();
    frame=Math.abs(targetX-currentX)>.5||Math.abs(targetY-currentY)>.5?requestAnimationFrame(tick):0;
  };
  host.addEventListener('pointerenter',event=>{
    const rect=host.getBoundingClientRect();
    targetX=currentX=Math.max(0,event.clientX-rect.left);
    targetY=currentY=Math.max(0,event.clientY-rect.top);
    paint();code.textContent=randomCode(length);
  });
  host.addEventListener('pointermove',event=>{
    const rect=host.getBoundingClientRect();
    targetX=event.clientX-rect.left;targetY=event.clientY-rect.top;
    if(!frame)frame=requestAnimationFrame(tick);
    if(event.timeStamp-lastCode>220){lastCode=event.timeStamp;code.textContent=randomCode(length)}
  });
}
document.addEventListener('pointerover',event=>{
  if(!(event.target instanceof Element))return;
  const card=event.target.closest('.song-card');
  if(card)initCodeEffect(card,1200);
  const control=event.target.closest('button,.client-play-link');
  // 弹窗内部有自己的层级和固定关闭按钮，不应用卡片悬浮代码装饰。
  if(control&&!control.closest('.game-modal')&&!(control.matches('button')&&control.disabled))initCodeEffect(control,600);
},{passive:true});
mode('music');init();
