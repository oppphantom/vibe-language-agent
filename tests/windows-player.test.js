'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBridge,createCdp}=require('../backend/media/windows-player');
test('Windows QQ bridge maps media status and delegates exact line playback',async()=>{
  const calls=[];
  const runPowerShell=async(action,provider,options)=>{calls.push({action,provider,options});return action==='list'?[{title:'晴天',artist:'周杰伦',album:'叶惠美',endMs:269000,positionMs:10000,playbackStatus:'Paused'}]:[]};
  const bridge=createBridge({runPowerShell,launch:()=>{},cdp:{},resolveQqPath:()=>'/mock/QQMusic.exe'});
  const status=await bridge.status('qqmusic');assert.equal(status.title,'晴天');assert.equal(status.duration,269);
  const result=await bridge.playLine('qqmusic',10,'晴天','周杰伦',12,{album:'叶惠美',durationMs:269000});
  assert.equal(result.autoPauseAt,12);assert.equal(calls[2].action,'play-range');assert.equal(calls[2].options.positionMs,10000);assert.equal(calls[2].options.endPositionMs,12000);assert.equal(calls[2].options.playerPath,'/mock/QQMusic.exe');
});

test('Windows NetEase bridge uses native playlist jump context',async()=>{
  const jumps=[],cdp={currentTrack:async()=>({id:'2',title:'歌曲',artist:'歌手',album:'专辑',durationMs:180000}),currentProgress:async()=>null,jump:async(...args)=>{jumps.push(args);return {ok:true}}};
  const bridge=createBridge({runPowerShell:async()=>[],launch:()=>{},cdp,ensureDebug:async()=>({ok:true}),fetchImpl:async()=>({ok:true,json:async()=>[{url:'orpheus://orpheus/pub/app.html'}]})});
  await bridge.openTrack('netease',{id:'2',playlistId:'10',trackIndex:3});
  assert.deepEqual(jumps,[['10','2',3]]);
});

test('Windows NetEase falls back to webcmd when playlist jump is unavailable',async()=>{
  const launches=[];
  let progressCalls=0;
  const cdp={
    jump:async()=>{throw Error('playlist-load-timeout')},
    currentProgress:async()=>{
      progressCalls++;
      return progressCalls>1?{playId:'2_ABC',positionSeconds:1.2}:null;
    }
  };
  const bridge=createBridge({
    runPowerShell:async()=>[],
    launch:(file,args)=>launches.push({file,args}),
    cdp,
    resolveNeteasePath:()=>'/mock/cloudmusic.exe',
    ensureDebug:async()=>({ok:true}),
    fetchImpl:async()=>({ok:true,json:async()=>[{url:'orpheus://orpheus/pub/app.html'}]}),
    wait:async()=>{}
  });
  const result=await bridge.openTrack('netease',{id:'2',playlistId:'10',trackIndex:0});
  assert.equal(result.ok,true);
  assert.equal(launches.length,1);
  assert.match(String(launches[0].args[0]),/^--webcmd=orpheus:\/\//);
});

test('NetEase remains identifiable after automatic pause changes the row button to play',async()=>{
  let expression='';
  const cdp=createCdp({
    evaluateImpl:async source=>{expression=source;return {id:'2',playing:false}},
    getSong:async id=>({id,title:'歌曲',artist:'歌手',album:'专辑',durationMs:180000,provider:'netease'})
  });
  const track=await cdp.currentTrack();
  assert.equal(track.id,'2');assert.equal(track.playing,false);assert.equal(track.title,'歌曲');
  assert.match(expression,/tid_playbar_play_btn/);
  assert.match(expression,/parentElement/);

  const bridge=createBridge({
    runPowerShell:async()=>{throw Error('paused NetEase should not depend on Windows media-session fallback')},
    cdp:{currentTrack:async()=>track,currentProgress:async()=>null},
    ensureDebug:async()=>({ok:true}),
    fetchImpl:async()=>({ok:true,json:async()=>[{url:'orpheus://orpheus/pub/app.html'}]})
  });
  const status=await bridge.status('netease');
  assert.equal(status.running,true);assert.equal(status.title,'歌曲');assert.equal(status.playing,false);
});

test('NetEase currentTrack can recover song id from play progress on Store UI',async()=>{
  let calls=0;
  const cdp=createCdp({
    evaluateImpl:async source=>{
      calls++;
      if(String(source).includes('PlayProgress'))return {playId:'5022593_7ZNOLP',positionSeconds:3,force:0};
      return null;
    },
    getSong:async id=>({id,title:'Seaside Retreat',artist:'Dan Gibson',album:'Seaside Retreat',durationMs:449000,provider:'netease'})
  });
  const track=await cdp.currentTrack();
  assert.equal(track.id,'5022593');
  assert.equal(track.title,'Seaside Retreat');
  assert.equal(track.playing,true);
  assert.ok(calls>=2);
});

test('a second NetEase line request can start after the first line was auto-paused',async()=>{
  let ranges=0;
  const track={id:'2',title:'歌曲',artist:'歌手',album:'专辑',durationMs:180000,provider:'netease'};
  const cdp={
    currentTrack:async()=>track,
    currentProgress:async ensurePlaying=>ensurePlaying?{playId:'2',positionSeconds:10}:null,
    playRange:async(startMs,endMs)=>{ranges++;return {ok:true,position:startMs/1000,autoPauseAt:endMs/1000}}
  };
  const bridge=createBridge({runPowerShell:async()=>[],cdp,ensureDebug:async()=>({ok:true}),fetchImpl:async()=>({ok:true,json:async()=>[{url:'orpheus://orpheus/pub/app.html'}]})});
  await bridge.playLine('netease',10,'歌曲','歌手',12);
  await bridge.playLine('netease',20,'歌曲','歌手',22);
  assert.equal(ranges,2);
});

test('Windows line playback serializes so an older auto-pause cannot silence the next note',async()=>{
  let ranges=0,releaseFirst;
  const track=[{title:'歌曲',artist:'歌手',album:'专辑',endMs:180000,positionMs:0,playbackStatus:'Paused'}];
  const runPowerShell=async action=>{
    if(action==='list')return track;
    if(action==='play-range'){
      ranges++;
      if(ranges===1)await new Promise(resolve=>{releaseFirst=resolve});
      return [];
    }
    return [];
  };
  const bridge=createBridge({runPowerShell,launch:()=>{},cdp:{},resolveQqPath:()=>'/mock/QQMusic.exe'});
  const first=bridge.playLine('qqmusic',10,'歌曲','歌手',12);
  while(!releaseFirst)await new Promise(resolve=>setTimeout(resolve,0));
  const second=bridge.playLine('qqmusic',20,'歌曲','歌手',22);
  assert.equal(ranges,1);
  releaseFirst();
  await Promise.all([first,second]);
  assert.equal(ranges,2);
});
