'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBridge}=require('../backend/media/windows-player');
test('Windows QQ bridge maps media status and delegates exact line playback',async()=>{
  const calls=[];
  const runPowerShell=async(action,provider,options)=>{calls.push({action,provider,options});return action==='list'?[{title:'晴天',artist:'周杰伦',album:'叶惠美',endMs:269000,positionMs:10000,playbackStatus:'Paused'}]:[]};
  const bridge=createBridge({runPowerShell,launch:()=>{},cdp:{}});
  const status=await bridge.status('qqmusic');assert.equal(status.title,'晴天');assert.equal(status.duration,269);
  const result=await bridge.playLine('qqmusic',10,'晴天','周杰伦',12,{album:'叶惠美',durationMs:269000});
  assert.equal(result.autoPauseAt,12);assert.equal(calls[2].action,'play-range');assert.equal(calls[2].options.positionMs,10000);assert.equal(calls[2].options.endPositionMs,12000);
});

test('Windows NetEase bridge uses native playlist jump context',async()=>{
  const jumps=[],cdp={currentTrack:async()=>({id:'2',title:'歌曲',artist:'歌手',album:'专辑',durationMs:180000}),currentProgress:async()=>null,jump:async(...args)=>{jumps.push(args);return {ok:true}}};
  const bridge=createBridge({runPowerShell:async()=>[],launch:()=>{},cdp});
  await bridge.openTrack('netease',{id:'2',playlistId:'10',trackIndex:3});
  assert.deepEqual(jumps,[['10','2',3]]);
});
