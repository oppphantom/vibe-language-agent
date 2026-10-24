const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const runFile = promisify(execFile);
let pauseTimer = null;
let playGeneration = 0;
let playbackQueue = Promise.resolve();
let latestPlayRequest = 0;
const clean = x => String(x || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const isSameTrack = (current, title, artist) => clean(current.title) === clean(title) && clean(current.artist).includes(clean(artist));
const isTransientMusicError = error => /\(-28\)/.test(String(error?.message || ''));
async function pauseIfSameTrack(title, artist, endSeconds) {
  const source='on run argv\nset wantedTitle to item 1 of argv\nset wantedArtist to item 2 of argv\nset wantedEnd to item 3 of argv as real\ntell application "Music"\nif player state is not playing then return "STOP"\nset t to current track\nif (name of t as text) is not wantedTitle or (artist of t as text) is not wantedArtist then return "STOP"\nset actualPosition to player position\nif actualPosition < wantedEnd - 0.1 then return "WAIT" & tab & (actualPosition as text)\npause\nreturn "PAUSED"\nend tell\nend run';
  const {stdout}=await runFile('/usr/bin/osascript',['-e',source,title,artist,String(endSeconds)],{timeout:5000,maxBuffer:1024});
  return stdout.trim();
}

async function script(source) {
  const {stdout} = await runFile('/usr/bin/osascript', ['-e', source], {timeout: 6000, maxBuffer: 4096});
  return stdout.trim();
}

async function status() {
  if ((await script('application "Music" is running')) !== 'true') return {running:false};
  const output = await script('tell application "Music"\ntry\nset t to current track\nreturn (name of t) & linefeed & (artist of t) & linefeed & (duration of t as text) & linefeed & (player position as text) & linefeed & (player state as text)\non error\nreturn "STOPPED"\nend try\nend tell');
  if (output === 'STOPPED') return {running:true, playing:false};
  const [title,artist,duration,position,state] = output.split(/\r?\n/);
  return {running:true,playing:state==='playing',title,artist,duration:Number(duration),position:Number(position)};
}

async function seek(seconds, expectedTitle, expectedArtist, endSeconds) {
  const current = await status();
  if (!current.running || !current.title) throw Error('请先在 Mac 的「音乐」应用中播放这首歌');
  if (!isSameTrack(current, expectedTitle, expectedArtist)) {
    throw Error(`「音乐」当前播放的是 ${current.title} · ${current.artist}，请先切换到 ${expectedTitle}`);
  }
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > current.duration + 3) throw Error('歌词时间超出歌曲范围');
  playGeneration++;
  if(pauseTimer)clearTimeout(pauseTimer);
  // Music can reset a seek to zero while a newly selected streaming track loads.
  // Start it first, then verify its real position before claiming playback worked.
  let verified = null;
  let transientFailures = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await script(`tell application "Music"\nplay\nset player position to ${seconds.toFixed(2)}\nend tell`);
    } catch (error) {
      if (!isTransientMusicError(error)) throw error;
      transientFailures++;
      await sleep(250 + attempt * 100);
      continue;
    }
    await sleep(attempt === 0 ? 180 : 260);
    const observed = await status();
    if (isSameTrack(observed, expectedTitle, expectedArtist) && observed.playing && Math.abs(observed.position - seconds) < 1.2) {
      verified = observed;
      break;
    }
  }
  if (!verified) throw Error(transientFailures
    ? 'Mac「音乐」暂时无法播放或定位这一句（错误 -28）。请确认这首歌能在「音乐」里正常播放，再点一次。'
    : '「音乐」未能跳到这一句，请稍后重试');
  if(Number.isFinite(endSeconds)&&endSeconds>seconds+0.3&&endSeconds<=current.duration+1){
    const generation=playGeneration;
    const check=async()=>{
      if(generation!==playGeneration)return;
      try{
        const [result,position]= (await pauseIfSameTrack(current.title,current.artist,endSeconds)).split('\t');
        if(result==='WAIT' && generation===playGeneration){
          pauseTimer=setTimeout(check,Math.max(100,Math.min(450,(endSeconds-Number(position))*1000-150)));
        }
      }catch(error){console.error('Music auto-pause:',error.message)}
    };
    pauseTimer=setTimeout(check,Math.max(100,Math.min(450,(endSeconds-verified.position)*1000-150)));
  }
  return {ok:true, title:current.title, position:verified.position, autoPauseAt:Number.isFinite(endSeconds)?endSeconds:null};
}

async function playLineNow(seconds, title, artist, endSeconds) {
  let current = await status();
  let savedVolume = null;
  if (!isSameTrack(current, title, artist)) {
    const switched = await startLibraryTrack(title, artist);
    if (!switched.ok) return switched;
    savedVolume = switched.volume;
  }
  try {
    if (savedVolume !== null) {
      for (let attempt = 0; attempt < 40; attempt++) {
        current = await status();
        if (isSameTrack(current, title, artist)) break;
        await sleep(200);
      }
      if (!isSameTrack(current, title, artist)) throw Error('「音乐」尚未准备好这首歌，请稍后重试');
    }
    return await seek(seconds, title, artist, endSeconds);
  } catch (error) {
    if (savedVolume !== null) await pauseIfSameTrack(title, artist, 0).catch(() => {});
    throw error;
  } finally {
    if (savedVolume !== null) await script(`tell application "Music"\nset sound volume to ${savedVolume}\nend tell`);
  }
}

function playLine(seconds, title, artist, endSeconds) {
  const request = ++latestPlayRequest;
  const pending = playbackQueue.then(() => request === latestPlayRequest
    ? playLineNow(seconds, title, artist, endSeconds)
    : {ok:false,reason:'superseded'});
  playbackQueue = pending.catch(() => {});
  return pending;
}

async function startLibraryTrack(title, artist) {
  const source='on run argv\nset wantedTitle to item 1 of argv\nset wantedArtist to item 2 of argv\ntell application "Music"\nset matches to search library playlist 1 for wantedArtist only songs\nrepeat with t in matches\nset isMatch to false\ntry\nif (name of t as text) is wantedTitle and (artist of t as text) is wantedArtist then set isMatch to true\nend try\nif isMatch then\nset oldVolume to sound volume\nset sound volume to 0\ntry\nplay t\non error errMsg number errNum\nset sound volume to oldVolume\nerror errMsg number errNum\nend try\nreturn "READY" & tab & (oldVolume as text)\nend if\nend repeat\nreturn "NOT_FOUND"\nend tell\nend run';
  let stdout;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      ({stdout}=await runFile('/usr/bin/osascript',['-e',source,title,artist],{timeout:8000,maxBuffer:1024}));
      break;
    } catch (error) {
      if (!isTransientMusicError(error)) throw error;
      if (attempt===2) throw Error('Mac「音乐」暂时无法打开这首歌（错误 -28）。请在「音乐」里确认歌曲可以播放后重试。');
      await sleep(300*(attempt+1));
    }
  }
  const [result,volume]=stdout.trim().split('\t');
  if(result!=='READY')return {ok:false,reason:'not_in_library'};
  playGeneration++;
  if(pauseTimer)clearTimeout(pauseTimer);
  return {ok:true,volume:Number(volume)};
}

async function playLibraryTrack(title, artist){
  const source='on run argv\nset wantedTitle to item 1 of argv\nset wantedArtist to item 2 of argv\ntell application "Music"\nset matches to search library playlist 1 for wantedArtist only songs\nrepeat with t in matches\ntry\nif (name of t as text) is wantedTitle and (artist of t as text) is wantedArtist then\nset oldVolume to sound volume\nset sound volume to 0\ntry\nplay t\npause\non error errMsg\nset sound volume to oldVolume\nerror errMsg\nend try\nset sound volume to oldVolume\nreturn "READY"\nend if\nend try\nend repeat\nreturn "NOT_FOUND"\nend tell\nend run';
  const {stdout}=await runFile('/usr/bin/osascript',['-e',source,title,artist],{timeout:8000,maxBuffer:1024});
  if(stdout.trim()!=='READY')return {ok:false,reason:'not_in_library'};
  playGeneration++;
  if(pauseTimer)clearTimeout(pauseTimer);
  return {ok:true};
}
async function libraryTracks(query){
  if(!query || query.length>80)throw Error('查询无效');
  const source='on run argv\nset queryText to item 1 of argv\ntell application "Music"\nset matches to search library playlist 1 for queryText only songs\nset output to ""\nrepeat with t in matches\ntry\nset output to output & (name of t as text) & tab & (artist of t as text) & tab & (duration of t as text) & linefeed\nend try\nend repeat\nreturn output\nend tell\nend run';
  const {stdout}=await runFile('/usr/bin/osascript',['-e',source,query],{timeout:12000,maxBuffer:100000});
  const seen=new Set();
  return stdout.trim().split(/\r?\n/).flatMap(row=>{const [title,artist,duration]=row.split('\t');if(!title||!artist||!Number.isFinite(Number(duration)))return[];const key=`${title}\u0000${artist}\u0000${Math.round(Number(duration))}`;if(seen.has(key))return[];seen.add(key);return[{title,artist,duration:Number(duration)}]}).slice(0,60);
}
async function openCatalog(url){
  const target=new URL(url);
  if(target.protocol!=='https:'||target.hostname!=='music.apple.com'||!target.pathname.includes('/album/'))throw Error('Apple Music 歌曲链接无效');
  await runFile('/usr/bin/open',['-a','Music',target.href],{timeout:5000,maxBuffer:1024});
  return {ok:true};
}
module.exports={status,seek,playLine,playLibraryTrack,openCatalog,libraryTracks};
