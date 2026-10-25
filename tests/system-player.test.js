'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBridge}=require('../backend/media/system-player');
function fake(source='netease'){
  const calls=[];let position=12,playing=false;
  const bundle=source==='netease'?'com.netease.163music':'com.tencent.QQMusicMac';
  const run=async args=>{
    calls.push(args);
    if(args[0]==='pause')playing=false;
    if(args[0]==='play')playing=true;
    if(args[0]==='seek')position=Number(args[1]);
    return args[0]==='get-raw'?JSON.stringify({kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:bundle,kMRMediaRemoteNowPlayingInfoTitle:'Honestly',kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',kMRMediaRemoteNowPlayingInfoDuration:194,kMRMediaRemoteNowPlayingInfoElapsedTime:position,kMRMediaRemoteNowPlayingInfoPlaybackRate:playing?1:0}):'';
  };
  return {calls,bridge:createBridge({run,schedule:()=>0,cancel:()=>{}})};
}
test('system player refuses to control a different music app',async()=>{
  const {bridge,calls}=fake('netease');
  await assert.rejects(bridge.playLine('qqmusic',20,'Honestly','RIIZE',22),/当前播放来源/);
  assert.deepEqual(calls.map(x=>x[0]),['get-raw']);
});
test('system player refuses a different album or duration under the same title',async()=>{
  const {bridge,calls}=fake('netease');
  await assert.rejects(bridge.playLine('netease',20,'Honestly','RIIZE',22,{album:'Wrong Album',durationMs:194000}),/专辑版本/);
  await assert.rejects(bridge.control('netease','pause','Honestly','RIIZE',undefined,{durationMs:182000}),/时长版本/);
  assert.deepEqual(calls.map(x=>x[0]),['get-raw','get-raw']);
});
test('system player checks track then pauses, seeks, plays and schedules line end',async()=>{
  const {bridge,calls}=fake();
  const result=await bridge.playLine('netease',20,'Honestly','RIIZE',22);
  assert.equal(result.ok,true);
  assert.deepEqual(calls.map(x=>x[0]),['get-raw','pause','seek','get-raw','play','get-raw']);
  assert.equal(calls[2][1],'20');
});
test('manual jump verifies the target song and position before resuming',async()=>{
  const {bridge,calls}=fake('qqmusic');
  const result=await bridge.control('qqmusic','jump','Honestly','RIIZE',42.5);
  assert.equal(result.ok,true);
  assert.deepEqual(calls.map(x=>x[0]),['get-raw','pause','seek','get-raw','play','get-raw']);
  assert.equal(calls[2][1],'42.5');
});
test('QQ status marks playback and position as unreliable',async()=>{
  const {bridge}=fake('qqmusic');
  const result=await bridge.status('qqmusic');
  assert.equal(result.playbackStateReliable,false);
  assert.equal(result.positionReliable,false);
});
test('QQ accepts a play command when its media playback flag stays stale',async()=>{
  const calls=[];let position=12;
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==='seek')position=Number(args[1]);
    return args[0]==='get-raw'?JSON.stringify({
      kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:'com.tencent.QQMusicMac',
      kMRMediaRemoteNowPlayingInfoTitle:'Honestly',kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',
      kMRMediaRemoteNowPlayingInfoDuration:194,kMRMediaRemoteNowPlayingInfoElapsedTime:position,
      kMRMediaRemoteNowPlayingInfoPlaybackRate:0,
    }):'';
  };
  const bridge=createBridge({run,schedule:()=>1,cancel:()=>{}});
  const result=await bridge.playLine('qqmusic',20,'Honestly','RIIZE',22);
  assert.equal(result.ok,true);
  assert.ok(calls.includes('play'));
});
test('QQ auto-pause uses elapsed wall time when its playback flag becomes stale',async()=>{
  const calls=[],ticks=[];let position=12,reportedPlaying=false,clock=0;
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==='seek')position=Number(args[1]);
    if(args[0]==='play')reportedPlaying=true;
    if(args[0]==='pause')reportedPlaying=false;
    return args[0]==='get-raw'?JSON.stringify({
      kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:'com.tencent.QQMusicMac',
      kMRMediaRemoteNowPlayingInfoTitle:'Honestly',kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',
      kMRMediaRemoteNowPlayingInfoDuration:194,kMRMediaRemoteNowPlayingInfoElapsedTime:position,
      kMRMediaRemoteNowPlayingInfoPlaybackRate:reportedPlaying?1:0,
    }):'';
  };
  const bridge=createBridge({run,now:()=>clock,schedule:fn=>{ticks.push(fn);return 1},cancel:()=>{}});
  await bridge.playLine('qqmusic',20,'Honestly','RIIZE',22);
  reportedPlaying=false;
  clock=2200;
  await ticks.shift()();
  assert.equal(calls.at(-1),'pause');
  assert.equal(ticks.length,0);
});
test('auto-pause retries after one transient status read failure',async()=>{
  const calls=[],ticks=[];let position=12,playing=false,clock=0,statusReads=0;
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==='seek')position=Number(args[1]);
    if(args[0]==='play')playing=true;
    if(args[0]==='pause')playing=false;
    if(args[0]==='get-raw'){
      statusReads++;
      if(statusReads===4)throw Error('temporary read failure');
      return JSON.stringify({kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:'com.netease.163music',
        kMRMediaRemoteNowPlayingInfoTitle:'Honestly',kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',
        kMRMediaRemoteNowPlayingInfoDuration:194,kMRMediaRemoteNowPlayingInfoElapsedTime:position,
        kMRMediaRemoteNowPlayingInfoPlaybackRate:playing?1:0});
    }
    return '';
  };
  const bridge=createBridge({run,now:()=>clock,schedule:fn=>{ticks.push(fn);return 1},cancel:()=>{}});
  await bridge.playLine('netease',20,'Honestly','RIIZE',22);
  clock=1000;
  const previous=console.error;console.error=()=>{};
  try{await ticks.shift()()}finally{console.error=previous}
  assert.equal(ticks.length,1);
  clock=2200;
  await ticks.shift()();
  assert.equal(calls.at(-1),'pause');
});
test('a new pause request cancels the previous line-end timer immediately',async()=>{
  const calls=[],ticks=[];let position=12,playing=false,clock=0;
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==='seek')position=Number(args[1]);
    if(args[0]==='play')playing=true;
    if(args[0]==='pause')playing=false;
    return args[0]==='get-raw'?JSON.stringify({
      kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:'com.netease.163music',
      kMRMediaRemoteNowPlayingInfoTitle:'Honestly',kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',
      kMRMediaRemoteNowPlayingInfoDuration:194,kMRMediaRemoteNowPlayingInfoElapsedTime:position,
      kMRMediaRemoteNowPlayingInfoPlaybackRate:playing?1:0,
    }):'';
  };
  const bridge=createBridge({run,now:()=>clock,schedule:fn=>{ticks.push(fn);return 1},cancel:()=>{}});
  await bridge.playLine('netease',20,'Honestly','RIIZE',22);
  const oldTick=ticks.shift();
  const pausing=bridge.control('netease','pause','Honestly','RIIZE');
  clock=2200;
  await oldTick();
  await pausing;
  assert.equal(calls.filter(action=>action==='pause').length,2);
  assert.equal(ticks.length,0);
});
test('queue next returns the verified new song and album for matching its lyrics',async()=>{
  const calls=[];let title='Honestly',album='Get A Guitar',duration=194;
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==='next'){title='Love 119';album='Love 119';duration=173.5}
    return args[0]==='get-raw'?JSON.stringify({kMRMediaRemoteNowPlayingInfoClientBundleIdentifier:'com.netease.163music',kMRMediaRemoteNowPlayingInfoTitle:title,kMRMediaRemoteNowPlayingInfoArtist:'RIIZE',kMRMediaRemoteNowPlayingInfoAlbum:album,kMRMediaRemoteNowPlayingInfoDuration:duration}):'';
  };
  const bridge=createBridge({run,wait:async()=>{}});
  const result=await bridge.queueStep('netease','next','Honestly','RIIZE');
  assert.deepEqual(result.song,{title:'Love 119',artist:'RIIZE',album:'Love 119',durationMs:173500,provider:'netease'});
  assert.deepEqual(calls,['get-raw','next','get-raw']);
});
test('queue step never claims success when the app keeps reporting the old track',async()=>{
  const {bridge}=fake();
  await assert.rejects(bridge.queueStep('netease','next','Honestly','RIIZE'),/无法确认/);
});
