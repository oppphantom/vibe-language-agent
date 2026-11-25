'use strict';
const {execFile,execFileSync,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {dirname,join,resolve}=require('node:path');
const {homedir}=require('node:os');
const {cpSync,existsSync,mkdirSync,readdirSync,readlinkSync,renameSync,statSync}=require('node:fs');
const neteaseLibrary=require('./netease-library');
const runFile=promisify(execFile);
const script=join(__dirname,'windows-media-session.ps1');
const labels={qqmusic:'QQ 音乐',netease:'网易云音乐'};
const clean=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const localAppData=()=>process.env.LOCALAPPDATA||join(homedir(),'AppData/Local');
const songIdFromPlayId=playId=>{const id=String(playId||'').split('_')[0];return /^\d{1,20}$/.test(id)?id:''};

function executable(candidates,label){const found=candidates.find(existsSync);if(!found)throw Error(`找不到 ${label} 客户端`);return found}
function qqPath(){return executable([
  join(process.env.ProgramFiles||'C:/Program Files','Tencent/QQMusic/QQMusic.exe'),
  join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Tencent/QQMusic/QQMusic.exe'),
  'D:/Program Files/Tencent/QQMusic/QQMusic.exe',
],'QQ 音乐')}
function isStorePath(path){return /\\WindowsApps\\/i.test(String(path||''))}
function bridgeDir(){return join(localAppData(),'vibe-language-agent','netease-cdp')}
function bridgeExePath(){return join(bridgeDir(),'cloudmusic.exe')}
function runningNeteasePath(){
  try{
    const stdout=execFileSync('powershell.exe',[
      '-NoProfile','-Command',
      '(Get-Process cloudmusic -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)'
    ],{encoding:'utf8',timeout:4000,windowsHide:true,maxBuffer:1024*1024});
    const path=String(stdout||'').trim();
    return path&&existsSync(path)?path:null;
  }catch{return null}
}
function storePackageCloudMusic(){
  const packages=join(localAppData(),'Packages');
  if(!existsSync(packages))return null;
  try{
    for(const name of readdirSync(packages)){
      if(!/1F8B0F94/i.test(name))continue;
      const root=join(packages,name,'LocalCache/Local/NetEase/CloudMusic');
      if(existsSync(join(root,'Library/webdb.dat')))return root;
    }
  }catch{}
  return null;
}
function storeExePath(){
  const running=runningNeteasePath();
  if(running&&isStorePath(running))return running;
  try{
    const stdout=execFileSync('powershell.exe',[
      '-NoProfile','-Command',
      "$p=Get-AppxPackage -Name '1F8B0F94.122165AE053F' -ErrorAction SilentlyContinue; if($p){Join-Path $p.InstallLocation 'VFS\\ProgramFilesX86\\Netease\\CloudMusic\\cloudmusic.exe'}"
    ],{encoding:'utf8',timeout:6000,windowsHide:true,maxBuffer:1024*1024});
    const path=String(stdout||'').trim();
    return path&&existsSync(path)?path:null;
  }catch{return null}
}
function ensureBridgeBinary(sourceExe){
  const dest=bridgeExePath();
  if(existsSync(dest))return dest;
  if(!sourceExe||!existsSync(sourceExe))throw Error('找不到可复制的商店版网易云程序');
  const dir=bridgeDir();
  mkdirSync(dir,{recursive:true});
  cpSync(dirname(sourceExe),dir,{recursive:true});
  if(!existsSync(dest))throw Error('商店版网易云调试副本创建失败');
  return dest;
}
function ensureStoreDataLink(){
  const store=storePackageCloudMusic();
  if(!store)return false;
  const classic=join(localAppData(),'NetEase','CloudMusic');
  const classicDb=join(classic,'Library','webdb.dat');
  const storeDb=join(store,'Library','webdb.dat');
  const storeSize=statSync(storeDb).size;
  if(existsSync(classic)){
    try{
      const target=resolve(readlinkSync(classic));
      if(target===resolve(store))return true;
    }catch{}
    const classicSize=existsSync(classicDb)?statSync(classicDb).size:0;
    if(classicSize>=Math.max(storeSize*0.5,1024))return false;
    renameSync(classic,`${classic}.vibe-backup-${Date.now()}`);
  }else mkdirSync(dirname(classic),{recursive:true});
  execFileSync('cmd.exe',['/c','mklink','/J',classic,store],{windowsHide:true});
  return true;
}
function killCloudMusic(){
  try{
    execFileSync('powershell.exe',[
      '-NoProfile','-Command',
      'Get-Process cloudmusic -ErrorAction SilentlyContinue | Stop-Process -Force'
    ],{timeout:8000,windowsHide:true});
  }catch{}
}
async function cdpReady(port=9222,fetchImpl=fetch){
  try{
    const response=await fetchImpl(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1500)});
    if(!response.ok)return false;
    const pages=await response.json();
    return Array.isArray(pages)&&pages.some(item=>String(item.url||'').endsWith('/app.html'));
  }catch{return false}
}
function neteasePath(){
  if(existsSync(bridgeExePath()))return bridgeExePath();
  const running=runningNeteasePath();
  if(running&&!isStorePath(running))return running;
  if(running&&isStorePath(running))return ensureBridgeBinary(running);
  const store=storeExePath();
  if(store)return ensureBridgeBinary(store);
  return executable([
    join(process.env.ProgramFiles||'C:/Program Files','NetEase/CloudMusic/cloudmusic.exe'),
    join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','NetEase/CloudMusic/cloudmusic.exe'),
  ],'网易云音乐');
}
function detached(file,args,options={}){
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true,cwd:options.cwd});
  child.unref();
}
function openProtocol(url){detached('cmd.exe',['/c','start','',url])}
function sessions(value){if(!value)return [];return Array.isArray(value)?value:[value]}
function orpheusPlayCommand(trackId){
  return 'orpheus://'+Buffer.from(JSON.stringify({type:'song',id:String(trackId),cmd:'play'})).toString('base64');
}

async function ensureNeteaseDebug({fetchImpl=fetch,wait=sleep,port=9222,launch=detached,resolveNeteasePath=neteasePath}={}){
  if(await cdpReady(port,fetchImpl))return {ok:true,reused:true};
  const running=runningNeteasePath();
  const store=isStorePath(running)||!!storeExePath()||!!storePackageCloudMusic();
  if(!store)throw Error(`网易云原生控制端口不可用；请用 --remote-debugging-port=${port} 启动 cloudmusic.exe`);
  ensureStoreDataLink();
  const source=storeExePath()||running;
  const exe=ensureBridgeBinary(source);
  killCloudMusic();
  await wait(1200);
  launch(exe,[`--remote-debugging-port=${port}`],{cwd:dirname(exe)});
  for(let i=0;i<24;i++){
    await wait(500);
    if(await cdpReady(port,fetchImpl))return {ok:true,reused:false,path:exe};
  }
  // keep resolve helper warm for callers that only need a launchable exe
  try{resolveNeteasePath()}catch{}
  throw Error('已尝试以调试模式启动商店版网易云，但控制端口仍未就绪');
}

function createCdp({fetchImpl=fetch,WebSocketImpl=globalThis.WebSocket,wait=sleep,port=9222,getSong=async id=>(await neteaseLibrary.library()).find(song=>song.id===String(id)),evaluateImpl}={}){
  let lastSongId='';
  async function evaluateDom(expression,timeoutMs=10000){
    if(typeof WebSocketImpl!=='function')throw Error('Windows 网易云原生控制需要 Node.js 22 或更高版本');
    let pages;try{const response=await fetchImpl(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2500)});pages=await response.json()}catch{throw Error(`网易云原生控制端口不可用；请用 --remote-debugging-port=${port} 启动 cloudmusic.exe`)}
    const page=pages.find(item=>String(item.url||'').endsWith('/app.html'));
    if(!page?.webSocketDebuggerUrl)throw Error('网易云主页面尚未就绪');
    return new Promise((resolvePromise,reject)=>{
      const ws=new WebSocketImpl(page.webSocketDebuggerUrl,{headers:{Origin:'http://127.0.0.1'}}),timer=setTimeout(()=>{try{ws.close()}catch{}reject(Error('网易云原生控制超时'))},timeoutMs);
      const finish=(fn,value)=>{clearTimeout(timer);try{ws.close()}catch{}fn(value)};
      ws.addEventListener('open',()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}})));
      ws.addEventListener('message',event=>{try{const message=JSON.parse(String(event.data));if(message.id!==1)return;if(message.error||message.result?.exceptionDetails)return finish(reject,Error('网易云页面控制失败'));finish(resolvePromise,message.result?.result?.value)}catch(error){finish(reject,error)}});
      ws.addEventListener('error',()=>finish(reject,Error('无法连接网易云原生控制页面')));
    });
  }
  const evaluate=evaluateImpl||evaluateDom;
  async function currentProgress(ensurePlaying=true){
    return evaluate(`new Promise(resolve=>{let done=false;const callback=function(){if(done)return;done=true;legacyNativeCmder.removeRegisterCall('PlayProgress','audioplayer',callback);resolve({playId:String(arguments[0]),positionSeconds:Number(arguments[1]),force:Number(arguments[2])})};legacyNativeCmder.appendRegisterCall('PlayProgress','audioplayer',callback);${ensurePlaying?`setTimeout(()=>{if(done)return;const controls=Array.from(document.querySelectorAll('[title*="Ctrl + P"]'));const visible=()=>controls.find(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});const button=visible();if(!button)return;const stale=/暂停|pause/i.test(button.title||'');button.click();if(stale)setTimeout(()=>{if(!done){const next=visible();if(next)next.click()}},250)},700);`:''}setTimeout(()=>{if(!done){done=true;legacyNativeCmder.removeRegisterCall('PlayProgress','audioplayer',callback);resolve(null)}},4000)})`,6500);
  }
  async function currentTrack(){
    const item=await evaluate(`(() => {
      const parse=e=>{try{return JSON.parse(e.getAttribute('data-log')||'{}')}catch{return {}}};
      const idOf=e=>{const p=parse(e).params||{};return String(p.s_cid||p.s_songId||'')};
      const rows=Array.from(document.querySelectorAll('[data-testid=tid_table_viewer_row]'));
      // 行内播放按钮只在播放中显示“暂停”；底部播放栏在句末暂停后仍保留当前歌曲 ID。
      let playbar=document.querySelector('[data-testid=tid_playbar_play_btn]'),currentId='';
      for(let depth=0;playbar&&depth<10&&!currentId;depth++,playbar=playbar.parentElement)currentId=idOf(playbar);
      const row=currentId?rows.find(e=>idOf(e)===currentId):rows.find(e=>{
        const b=e.querySelector('button.play');return b&&(/暂停|pause/i.test(b.title||'')||b.classList.contains('pause'))
      });
      const id=currentId||(row?idOf(row):'');
      if(!id)return null;
      const button=row?.querySelector('button.play');
      return {id,playing:Boolean(button&&(/暂停|pause/i.test(button.title||'')||button.classList.contains('pause')))};
    })()`);
    let resolved=item&&/^\d{1,20}$/.test(String(item.id||''))?item:null;
    let playing=Boolean(resolved?.playing);
    if(!resolved){
      try{
        const progress=await currentProgress(false);
        const id=songIdFromPlayId(progress?.playId);
        if(id){resolved={id,playing:true};playing=true;lastSongId=id}
      }catch{}
    }
    if(!resolved&&lastSongId)resolved={id:lastSongId,playing:false};
    if(resolved?.id)lastSongId=String(resolved.id);
    if(!resolved?.id)return null;
    const song=await getSong(resolved.id);
    return song?{...song,playing}:{id:resolved.id,title:'',artist:'',album:'',durationMs:0,provider:'netease',playing};
  }
  async function seek(positionMs){
    if(!Number.isFinite(positionMs)||positionMs<0)throw Error('跳转时间无效');
    const progress=await currentProgress(true);if(!progress)throw Error('网易云没有发布播放进度');
    const seekId=`vibe-${Date.now().toString(36)}`,seconds=positionMs/1000;
    const result=await evaluate(`new Promise(resolve=>{const cb=function(){legacyNativeCmder.removeRegisterCall('Seek','audioplayer',cb);resolve({playId:String(arguments[0]),seekId:String(arguments[1]),code:Number(arguments[2]),positionSeconds:Number(arguments[3])})};legacyNativeCmder.appendRegisterCall('Seek','audioplayer',cb);legacyNativeCmder.call('audioplayer.seek',${JSON.stringify(progress.playId)},${JSON.stringify(seekId)},${seconds});setTimeout(()=>{legacyNativeCmder.removeRegisterCall('Seek','audioplayer',cb);resolve(null)},5000)})`);
    if(!result||result.code!==0)throw Error('网易云原生跳转失败');
    const id=songIdFromPlayId(result.playId);if(id)lastSongId=id;
    return result;
  }
  async function state(playId,action){
    const requestId=`vibe-${action}-${Date.now().toString(36)}`;
    const result=await evaluate(`new Promise(resolve=>{const cb=function(){legacyNativeCmder.removeRegisterCall('PlayState','audioplayer',cb);resolve({playId:String(arguments[0]),requestId:String(arguments[1]),state:Number(arguments[2])})};legacyNativeCmder.appendRegisterCall('PlayState','audioplayer',cb);legacyNativeCmder.call('audioplayer.${action}',${JSON.stringify(playId)},${JSON.stringify(requestId)});setTimeout(()=>{legacyNativeCmder.removeRegisterCall('PlayState','audioplayer',cb);resolve(null)},5000)})`);
    if(!result)throw Error(`网易云原生${action==='play'?'播放':'暂停'}超时`);
    const id=songIdFromPlayId(result.playId||playId);if(id)lastSongId=id;
    return result;
  }
  async function playRange(startMs,endMs){const result=await seek(startMs);await state(result.playId,'play');await wait(Math.max(0,endMs-startMs+80));await state(result.playId,'pause');return {ok:true,position:startMs/1000,autoPauseAt:endMs/1000}}
  async function jump(playlistId,trackId,trackIndex){
    const index=Number.isInteger(trackIndex)?trackIndex:'null';
    const result=await evaluate(`new Promise(async resolve=>{const parse=e=>{try{return JSON.parse(e.getAttribute('data-log')||'{}')}catch{return {}}};const hasId=(e,id)=>{const p=(parse(e).params||{});return String(p.s_cid||p.s_playlistId||'')===id};const close=document.querySelector('.close-button');if(close)close.click();await new Promise(r=>setTimeout(r,150));const playlistId=${JSON.stringify(String(playlistId))},trackId=${JSON.stringify(String(trackId))},trackIndex=${index};const playlist=Array.from(document.querySelectorAll('[data-log]')).find(e=>hasId(e,playlistId));if(!playlist)return resolve({ok:false,stage:'playlist-not-rendered'});playlist.click();const waitFor=async(fn,timeout)=>{const end=Date.now()+timeout;let value;while(Date.now()<end){if((value=fn()))return value;await new Promise(r=>setTimeout(r,200))}return null};const first=await waitFor(()=>document.querySelector('[data-testid=tid_table_viewer_row]'),7000);if(!first)return resolve({ok:false,stage:'playlist-load-timeout'});const grid=first.closest('.ReactVirtualized__List');if(grid&&trackIndex!==null){grid.scrollTop=Math.max(0,trackIndex*56-112);grid.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,350))}const row=await waitFor(()=>Array.from(document.querySelectorAll('[data-testid=tid_table_viewer_row]')).find(e=>hasId(e,trackId)),3500);const button=row&&(row.querySelector('[data-testid=tid_tableindex_play_btn]')||row.querySelector('button.play'));if(!button)return resolve({ok:false,stage:'track-not-rendered'});const active=button.classList.contains('pause')||/暂停|pause/i.test(button.title||'');let done=false;const cb=function(){if(done)return;done=true;legacyNativeCmder.removeRegisterCall('PlayProgress','audioplayer',cb);resolve({ok:true,playId:String(arguments[0]),positionSeconds:Number(arguments[1])})};legacyNativeCmder.appendRegisterCall('PlayProgress','audioplayer',cb);const click=()=>{const current=row.querySelector('[data-testid=tid_tableindex_play_btn]')||row.querySelector('button.play');if(current)current.click()};if(active)setTimeout(()=>{if(!done){click();setTimeout(click,250)}},600);else click();setTimeout(()=>{if(!done){done=true;legacyNativeCmder.removeRegisterCall('PlayProgress','audioplayer',cb);resolve({ok:false,stage:'play-timeout'})}},7000)})`,13000);
    if(!result?.ok)throw Error(`网易云无法跳转到歌曲（${result?.stage||'unknown'}）`);
    const id=songIdFromPlayId(result.playId)||String(trackId);if(id)lastSongId=id;
    return result;
  }
  async function queueStep(direction){
    const before=await currentTrack(),pattern=direction==='next'?'下一首|next':'上一首|previous';
    const clicked=await evaluate(`(() => {const re=/${pattern}/i,e=Array.from(document.querySelectorAll('[title]')).find(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.height>0&&re.test(x.title||'')});if(!e)return false;e.click();return true})()`);
    if(!clicked)throw Error('网易云页面没有找到切歌按钮');
    for(let i=0;i<16;i++){await wait(300);const after=await currentTrack();if(after?.id&&after.id!==before?.id)return after}
    throw Error('网易云已收到切歌命令，但未确认歌曲变化');
  }
  return {evaluate,currentTrack,currentProgress,seek,state,playRange,jump,queueStep};
}

function createBridge({runPowerShell,launch=detached,wait=sleep,cdp=createCdp(),resolveQqPath=qqPath,resolveNeteasePath=neteasePath,ensureDebug=ensureNeteaseDebug,fetchImpl=fetch}={}){
  let playbackQueue=Promise.resolve(),playbackRequest=0,debugReady=null;
  async function media(action,provider,options={}){
    if(runPowerShell)return runPowerShell(action,provider,options);
    const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Action',action,'-Provider',provider];
    if(options.positionMs!==undefined)args.push('-PositionMs',String(Math.round(options.positionMs)));
    if(options.endPositionMs!==undefined)args.push('-EndPositionMs',String(Math.round(options.endPositionMs)));
    if(options.playerPath)args.push('-PlayerPath',options.playerPath);
    const timeout=action==='play-range'?Math.max(15000,(options.endPositionMs-options.positionMs)+12000):10000;
    const {stdout}=await runFile('powershell.exe',args,{timeout,maxBuffer:4*1024*1024,windowsHide:true});
    try{return sessions(JSON.parse(stdout||'[]'))}catch{throw Error('Windows 媒体会话返回了无效数据')}
  }
  function assertTrack(current,source,title,artist,identity={}){
    if(!current.running)throw Error(`未检测到${labels[source]}当前歌曲`);
    if(title&&clean(current.title)!==clean(title))throw Error(`${labels[source]}当前是 ${current.title}，不是 ${title}`);
    const a=clean(current.artist),wanted=clean(artist);if(artist&&a!==wanted&&!a.includes(wanted)&&!wanted.includes(a))throw Error(`${labels[source]}当前歌手是 ${current.artist}`);
    if(identity.album&&current.album&&clean(current.album)!==clean(identity.album))throw Error(`${labels[source]}当前播放的不是所选专辑版本`);
    if(identity.durationMs&&current.duration&&Math.abs(current.duration*1000-identity.durationMs)>3500)throw Error(`${labels[source]}当前播放的不是所选时长版本`);
  }
  async function prepareNetease(force=false){
    if(await cdpReady(9222,fetchImpl)){
      debugReady=Promise.resolve({ok:true,reused:true});
      return debugReady;
    }
    if(!force&&debugReady)return debugReady;
    debugReady=ensureDebug({fetchImpl,wait,launch,resolveNeteasePath}).catch(error=>{debugReady=null;throw error});
    return debugReady;
  }
  async function playViaWebcmd(trackId){
    const command=orpheusPlayCommand(trackId);
    const exe=resolveNeteasePath();
    try{launch(exe,[`--webcmd=${command}`],{cwd:dirname(exe)})}
    catch{openProtocol(command)}
    for(let i=0;i<16;i++){
      await wait(400);
      try{
        const progress=await cdp.currentProgress(false);
        if(songIdFromPlayId(progress?.playId)===String(trackId))return progress;
      }catch{}
    }
    return null;
  }
  async function status(source){
    if(!labels[source])throw Error('不支持的音乐来源');
    if(source==='netease'){
      try{
        await prepareNetease(false);
        const track=await cdp.currentTrack();
        if(track){
          let progress=null;try{progress=await cdp.currentProgress(false)}catch{}
          return {running:true,source,activeSource:'netease',title:track.title,artist:track.artist,album:track.album,duration:track.durationMs/1000,position:progress?.positionSeconds||0,playing:Boolean(progress),playbackStateReliable:true,positionReliable:Boolean(progress),providerId:track.id};
        }
      }catch{}
    }
    const result=await media('list',source),item=result[0];
    return {running:Boolean(item),source,activeSource:item?source:null,title:item?.title||'',artist:item?.artist||'',album:item?.album||'',duration:Number(item?.endMs||0)/1000,position:Number(item?.positionMs||0)/1000,playing:item?.playbackStatus==='Playing',playbackStateReliable:source!=='qqmusic',positionReliable:source!=='qqmusic'};
  }
  async function openTrack(source,song){
    if(!labels[source]||!/^\d{1,20}$/.test(String(song?.id||'')))throw Error('歌曲 ID 无效');
    if(source==='qqmusic'){
      launch(resolveQqPath(),['/playbysongid',`cmd_count==1&&id_0==${song.id}&&songtype_0==0`]);
      return {ok:true,source,trackId:String(song.id)};
    }
    await prepareNetease(true);
    if(song.playlistId&&song.playlistId!=='current-queue'){
      try{
        await cdp.jump(song.playlistId,song.id,Number.isInteger(song.trackIndex)?song.trackIndex:undefined);
        return {ok:true,source,trackId:String(song.id)};
      }catch{}
    }
    const progress=await playViaWebcmd(song.id);
    if(!progress)throw Error('已向网易云发送点播命令，但未确认开始播放');
    return {ok:true,source,trackId:String(song.id)};
  }
  async function playLine(source,start,title,artist,end,identity={}){
    const request=++playbackRequest;
    const pending=playbackQueue.then(async()=>{
      if(request!==playbackRequest)return {ok:false,reason:'superseded'};
      if(source==='netease')await prepareNetease(true);
      const current=await status(source);assertTrack(current,source,title,artist,identity);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||(current.duration&&end>current.duration+2))throw Error('歌词时间超出歌曲范围');
      if(source==='qqmusic'){
        await media('play-range',source,{positionMs:start*1000,endPositionMs:end*1000,playerPath:resolveQqPath()});
        return {ok:true,source,title,position:start,autoPauseAt:end};
      }
      return {...await cdp.playRange(start*1000,end*1000),source,title};
    });
    playbackQueue=pending.catch(()=>{});
    return pending;
  }
  async function control(source,action,title,artist,seconds,identity={}){
    if(source==='netease')await prepareNetease(true);
    const current=await status(source);assertTrack(current,source,title,artist,identity);
    if(action==='jump'&&(!Number.isFinite(seconds)||seconds<0||(current.duration&&seconds>current.duration)))throw Error('跳转时间超出歌曲范围');
    if(source==='qqmusic'){
      if(action==='jump'){launch(resolveQqPath(),['/seekto',String(seconds)]);await wait(250);await media('play',source)}else await media(action,source);
    }else if(action==='jump'){const result=await cdp.seek(seconds*1000);await cdp.state(result.playId,'play')}
    else if(action==='play'){const progress=await cdp.currentProgress(true);if(!progress)throw Error('网易云没有恢复播放')}
    else {const progress=await cdp.currentProgress(false);if(progress)await cdp.state(progress.playId,'pause')}
    return {ok:true,source,action,position:action==='jump'?seconds:current.position};
  }
  async function queueStep(source,direction,title,artist,identity={}){
    if(source==='netease')await prepareNetease(true);
    const before=await status(source);assertTrack(before,source,title,artist,identity);
    if(source==='netease'){const song=await cdp.queueStep(direction);return {ok:true,source,direction,song:{...song,playbackVerified:true}}}
    await media(direction,source);
    for(let i=0;i<16;i++){await wait(300);const after=await status(source);if(after.title&&(clean(after.title)!==clean(before.title)||clean(after.artist)!==clean(before.artist)))return {ok:true,source,direction,song:{title:after.title,artist:after.artist,album:after.album,durationMs:Math.round(after.duration*1000),provider:source}}}
    throw Error('已发出切歌命令，但无法确认切到了不同歌曲');
  }
  return {status,openTrack,playLine,control,queueStep,cdp};
}
module.exports={createBridge,createCdp,qqPath,neteasePath,ensureNeteaseDebug,bridgeExePath,songIdFromPlayId};
