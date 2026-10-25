'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const runFile=promisify(execFile);
const bundles={qqmusic:'com.tencent.QQMusicMac',netease:'com.netease.163music'};
const labels={qqmusic:'QQ 音乐',netease:'网易云音乐'};
const binary=process.env.NOWPLAYING_CLI||'nowplaying-cli';
const clean=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function createBridge({run=async args=>(await runFile(binary,args,{timeout:5000,maxBuffer:8*1024*1024})).stdout,wait=sleep,now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){
  let generation=0,timer=null,queue=Promise.resolve(),latest=0;
  function stopTimer(){generation++;if(timer)cancel(timer);timer=null;}
  async function command(...args){try{return await run(args)}catch(error){if(error.code==='ENOENT')throw Error('缺少 nowplaying-cli，请先运行 brew install nowplaying-cli');throw Error(`系统媒体控制失败：${String(error.message||error).slice(0,160)}`)}}
  async function status(source){
    if(!bundles[source])throw Error('不支持的音乐来源');
    let data;try{data=JSON.parse(await command('get-raw'))}catch(error){if(error instanceof SyntaxError)throw Error('无法读取系统当前播放信息');throw error}
    const bundle=data.kMRMediaRemoteNowPlayingInfoClientBundleIdentifier;
    const activeSource=Object.keys(bundles).find(key=>bundles[key]===bundle)||null;
    const field=name=>data[`kMRMediaRemoteNowPlayingInfo${name}`];
    return {running:bundle===bundles[source],source,activeSource,title:field('Title')||'',artist:field('Artist')||'',album:field('Album')||'',duration:Number(field('Duration'))||0,position:Number(field('ElapsedTime'))||0,playing:Number(field('PlaybackRate'))>0,playbackStateReliable:source!=='qqmusic',positionReliable:source!=='qqmusic'};
  }
  function assertTrack(current,source,title,artist,identity={}){
    if(!current.running)throw Error(`系统当前播放来源${current.activeSource?`是${labels[current.activeSource]}`:'不是所选客户端'}；请先在${labels[source]}播放目标歌曲，再点击网页「连接当前音乐来源」。`);
    if(clean(current.title)!==clean(title)||clean(current.artist)!==clean(artist))throw Error(`${labels[source]}当前是 ${current.title} · ${current.artist}，请先切到 ${title}`);
    if(identity.album&&clean(current.album)!==clean(identity.album))throw Error(`${labels[source]}当前播放的不是所选专辑版本，请重新连接当前歌曲`);
    if(identity.durationMs&&Math.abs(current.duration*1000-identity.durationMs)>3000)throw Error(`${labels[source]}当前播放的不是所选时长版本，请重新连接当前歌曲`);
  }
  async function playLineNow(source,start,title,artist,end,identity,request){
    const initial=await status(source);assertTrack(initial,source,title,artist,identity);
    if(request!==latest)return {ok:false,reason:'superseded'};
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>initial.duration+2)throw Error('歌词时间超出歌曲范围');
    stopTimer();const mine=generation;
    await command('pause');
    if(request!==latest)return {ok:false,reason:'superseded'};
    await command('seek',String(start));
    if(request!==latest)return {ok:false,reason:'superseded'};
    let positioned=null;
    for(let i=0;i<5;i++){
      const observed=await status(source);assertTrack(observed,source,title,artist,identity);
      if(request!==latest)return {ok:false,reason:'superseded'};
      if(Math.abs(observed.position-start)<1.5){positioned=observed;break}
      await wait(180);
    }
    if(!positioned)throw Error('播放器未能定位到这一句，请稍后重试');
    const playIssuedAt=now();
    await command('play');
    if(request!==latest)return {ok:false,reason:'superseded'};
    const started=await status(source);assertTrack(started,source,title,artist,identity);
    if(request!==latest)return {ok:false,reason:'superseded'};
    if(started.playbackStateReliable&&!started.playing)throw Error('播放器没有开始播放');
    let remaining=(end-start)*1000,last=playIssuedAt,statusFailures=0;
    async function tick(){
      if(mine!==generation)return;
      try{
        const current=await status(source);
        if(mine!==generation||!current.running)return;
        try{assertTrack(current,source,title,artist,identity)}catch{return}
        statusFailures=0;
        const instant=now();if(source==='qqmusic'||current.playing)remaining-=Math.max(0,instant-last);last=instant;
        if(remaining<=0){if(source==='qqmusic'||current.playing)await command('pause');return}
        timer=schedule(tick,Math.max(80,Math.min(250,remaining)));
      }catch(error){
        if(mine!==generation)return;
        statusFailures++;
        console.error('系统播放器自动暂停：',error.message);
        if(statusFailures<4)timer=schedule(tick,120);
      }
    }
    timer=schedule(tick,Math.max(80,Math.min(250,remaining-(now()-playIssuedAt))));
    return {ok:true,source,title,position:positioned.position,autoPauseAt:end};
  }
  function playLine(source,start,title,artist,end,identity={}){
    if(!bundles[source])throw Error('不支持的音乐来源');
    const request=++latest;stopTimer();
    const pending=queue.then(()=>request===latest?playLineNow(source,start,title,artist,end,identity,request):{ok:false,reason:'superseded'});
    queue=pending.catch(()=>{});return pending;
  }
  function control(source,action,title,artist,seconds,identity={}){
    if(!bundles[source]||!['play','pause','jump'].includes(action))throw Error('播放控制参数无效');
    const request=++latest;stopTimer();
    const pending=queue.then(async()=>{
      if(request!==latest)return {ok:false,reason:'superseded'};
      const current=await status(source);assertTrack(current,source,title,artist,identity);
      if(request!==latest)return {ok:false,reason:'superseded'};
      stopTimer();
      if(action==='jump'){
        if(!Number.isFinite(seconds)||seconds<0||seconds>current.duration)throw Error('跳转时间超出歌曲范围');
        await command('pause');if(request!==latest)return {ok:false,reason:'superseded'};
        await command('seek',String(seconds));if(request!==latest)return {ok:false,reason:'superseded'};
        let verified=false;
        for(let i=0;i<5;i++){
          const observed=await status(source);assertTrack(observed,source,title,artist,identity);
          if(request!==latest)return {ok:false,reason:'superseded'};
          if(Math.abs(observed.position-seconds)<1.5){verified=true;break}
          await wait(180);
        }
        if(!verified)throw Error('播放器未能跳到指定位置');
        await command('play');
      }else await command(action);
      if(request!==latest)return {ok:false,reason:'superseded'};
      const observed=await status(source);assertTrack(observed,source,title,artist,identity);
      if(request!==latest)return {ok:false,reason:'superseded'};
      return {ok:true,source,action,position:observed.position};
    });
    queue=pending.catch(()=>{});return pending;
  }
  function queueStep(source,direction,title,artist,identity={}){
    if(!bundles[source]||!['next','previous'].includes(direction))throw Error('切歌参数无效');
    const request=++latest;stopTimer();
    const pending=queue.then(async()=>{
      if(request!==latest)return {ok:false,reason:'superseded'};
      const before=await status(source);assertTrack(before,source,title,artist,identity);
      if(request!==latest)return {ok:false,reason:'superseded'};
      stopTimer();
      await command(direction);
      for(let attempt=0;attempt<16;attempt++){
        const after=await status(source);
        if(request!==latest)return {ok:false,reason:'superseded'};
        if(!after.running)throw Error(`${labels[source]}不再是系统当前播放来源，未确认切歌成功`);
        if(clean(after.title)!==clean(before.title)||clean(after.artist)!==clean(before.artist)||clean(after.album)!==clean(before.album)||Math.abs(after.duration-before.duration)>1){
          if(!after.title||!after.artist||!after.duration)throw Error('已切歌，但新歌曲信息尚不完整；请重新连接');
          return {ok:true,source,direction,song:{title:after.title,artist:after.artist,album:after.album,durationMs:Math.round(after.duration*1000),provider:source}};
        }
        await wait(300);
      }
      throw Error('已发出切歌命令，但无法确认切到了不同歌曲；请检查客户端播放列表');
    });
    queue=pending.catch(()=>{});return pending;
  }
  return {status,playLine,control,queueStep,stopTimer};
}
module.exports={createBridge,bundles};
