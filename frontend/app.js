'use strict';
const $=id=>document.getElementById(id);
const state={session:null,node:null,attempt:1,lines:[],song:null,active:null,audioUrl:null};
function updateProgress(){const p=state.session?.progress;if(!p)return;const pct=p.total>0?Math.round(p.completed/p.total*100):0;const bar=$('progressBar'),fill=$('progressFill');if(bar)bar.setAttribute('aria-valuenow',String(pct));if(fill)fill.style.width=pct+'%';}
async function api(path,method='GET',body){const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'请求失败');return data;}
function mode(name){$('music').hidden=name!=='music';$('demo').hidden=name!=='demo';$('live').hidden=name!=='live';for(const item of ['music','demo','live'])$(item+'Tab').classList.toggle('active',name===item);}
$('musicTab').onclick=()=>mode('music');$('demoTab').onclick=()=>mode('demo');$('liveTab').onclick=()=>mode('live');
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
async function init(){try{const data=await api('/api/songs');for(const song of data.songs){const card=document.createElement('article');card.className='song-card';card.append(text('small','ORIGINAL DEMO'),text('h2',song.title),text('p','VIBE 原创教学样例 · 韩语'));const button=text('button','从这首歌开始');button.onclick=()=>start(song.id);card.append(button);$('songs').append(card)}const id=localStorage.getItem('vibe-starter-session');if(id){try{state.session=await api('/api/sessions/'+encodeURIComponent(id));state.node=await api('/api/sessions/'+encodeURIComponent(id)+'/node');state.attempt=state.session.history.length+1;renderNode()}catch{localStorage.removeItem('vibe-starter-session')}}}catch(e){$('songs').textContent=e.message}}
async function start(songId){try{state.session=await api('/api/sessions','POST',{songId});state.node=await api('/api/sessions/'+state.session.id+'/node');state.attempt=1;localStorage.setItem('vibe-starter-session',state.session.id);renderNode()}catch(e){$('feedback').textContent=e.message}}
function renderNode(){const node=state.node;$('lesson').hidden=false;$('source').replaceChildren();for(const song of node.material.songs){const box=document.createElement('article');box.append(text('strong',song.title+' / 原创样例'));for(const line of node.material.lines.filter(x=>x.songId===song.id))box.append(text('p',line.text,'korean'));$('source').append(box)}$('prompt').textContent=node.prompt;$('progress').textContent=state.session.progress.completed+' / '+state.session.progress.total+' 已完成';$('choices').replaceChildren();for(let i=0;i<node.options.length;i++){const b=text('button',`${String.fromCharCode(65+i)} · ${node.options[i]}`);b.disabled=state.session.progress.completed>0;b.onclick=()=>submit(i);$('choices').append(b)}$('feedback').textContent=state.session.progress.completed?'已完成。你可以选择另一首样例开启新回合。':'';$('feedback').classList.remove('is-correct','is-retry');$('retry').hidden=true;updateProgress();}
async function submit(choice){try{const result=await api('/api/answers','POST',{sessionId:state.session.id,nodeId:state.node.id,submissionId:crypto.randomUUID(),choice,attempt:state.attempt,hintUsed:state.attempt>1});state.session=result.session;state.attempt++;const verdict=result.feedback.verdict,feedback=$('feedback');feedback.textContent=(verdict==='correct'?'答对了。':'再试一次。')+result.feedback.explanation+'\n'+result.feedback.nextAction.reason;feedback.classList.toggle('is-correct',verdict==='correct');feedback.classList.toggle('is-retry',verdict!=='correct');for(const b of $('choices').children)b.classList.remove('is-selected','is-wrong');const picked=$('choices').children[choice];if(picked)picked.classList.add(verdict==='correct'?'is-selected':'is-wrong');$('retry').hidden=verdict==='correct';$('progress').textContent=state.session.progress.completed+' / '+state.session.progress.total+' 已完成';if(verdict==='correct')for(const b of $('choices').children)b.disabled=true;updateProgress();}catch(e){$('feedback').classList.remove('is-correct','is-retry');$('feedback').textContent=e.message}}
$('retry').onclick=()=>{$('retry').hidden=true;$('feedback').textContent='再看两首样例中「다시」连接的前后事件，然后选一次。';};
const fmt=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
$('lookup').onsubmit=async event=>{event.preventDefault();$('liveStatus').textContent='正在检索和核对版本…';$('liveLines').replaceChildren();try{const data=await api('/api/lyrics/search','POST',{title:$('title').value.trim(),artist:$('artist').value.trim(),durationMs:Math.round(Number($('duration').value)*1000)});if(data.status!=='unverified'){$('liveStatus').textContent='没有找到时长匹配的同步歌词。';return}state.song=data.song;state.lines=data.lines;$('liveStatus').textContent=`找到 ${data.lines.length} 行；来源 ${data.source}，尚未人工核对。请确认音频版本。`;renderLines()}catch(e){$('liveStatus').textContent=e.message}};
function renderLines(){$('liveLines').replaceChildren();for(const line of state.lines){const b=document.createElement('button');b.type='button';b.append(text('span',fmt(line.startMs)),text('strong',line.text));b.disabled=!$('audio').src||line.endMs===null;b.title=line.endMs===null?'缺少句末时间':'播放这一句';b.onclick=()=>playLine(line);$('liveLines').append(b)}}
$('audioFile').onchange=()=>{const file=$('audioFile').files[0];if(state.audioUrl)URL.revokeObjectURL(state.audioUrl);state.audioUrl=file?URL.createObjectURL(file):null;$('audio').src=state.audioUrl||'';$('playStatus').textContent=file?'已关联本地音频；请先核对歌词版本和时间偏移。':'没有音源时，逐句播放不可用。';renderLines()};
$('speed').onchange=()=>$('audio').playbackRate=Number($('speed').value);
function playLine(line){const audio=$('audio'),offset=Number($('offset').value)*1000||0,start=(line.startMs+offset)/1000,end=(line.endMs+offset)/1000;if(!audio.src||start<0||end<=start){$('playStatus').textContent='音频或时间范围不可用。';return}state.active={start,end};audio.currentTime=start;audio.playbackRate=Number($('speed').value);audio.play().then(()=>$('playStatus').textContent='正在播放 '+fmt(line.startMs)+'，句末自动暂停。').catch(e=>$('playStatus').textContent=e.message)}
$('audio').ontimeupdate=()=>{const a=$('audio');if(state.active&&a.currentTime>=state.active.end-0.04){if($('loop').checked){a.currentTime=state.active.start;a.play()}else{a.pause();state.active=null;$('playStatus').textContent='这一句已播放完。'}}};
$('explain').onclick=async()=>{const expression=$('expression').value.trim();if(!expression||!state.lines.length){$('explanation').textContent='先检索真实歌词，再输入表达。';return}$('explanation').textContent='正在调用已配置模型…';try{const data=await api('/api/agent/explain','POST',{expression,lines:state.lines.slice(0,6).map(x=>x.text)});$('explanation').textContent=`${data.origin}\n基本意思：${data.meaning}\n当前语境：${data.context}\n不确定之处：${data.uncertainty}`}catch(e){$('explanation').textContent=e.message}};
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
  if(control&&!(control.matches('button')&&control.disabled))initCodeEffect(control,600);
},{passive:true});
mode('music');init();
