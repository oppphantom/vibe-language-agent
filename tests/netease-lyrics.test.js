'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {findNeteaseLyrics}=require('../backend/media/netease-lyrics');
const {validateLine}=require('../shared/contract');
test('Netease lyrics use a matching catalog version and keep timed Korean lines',async()=>{
  const fetchImpl=async url=>({ok:true,json:async()=>url.pathname.includes('/search/')?
    {code:200,result:{songs:[{id:123,name:'Love 119',artists:[{name:'RIIZE'}],duration:173489}]}}:
    {code:200,lrc:{lyric:'[00:00.00] 作词 : credit\n[00:10.44]첫 줄\n[00:13.20]둘째 줄'}}});
  const result=await findNeteaseLyrics({title:'Love 119',artist:'RIIZE',durationMs:173500,providerId:'123'},fetchImpl);
  assert.equal(result.source,'网易云音乐');assert.equal(result.lines.length,2);
  assert.equal(result.lines[0].startMs,10440);assert.equal(result.lines[0].endMs,13200);
  result.lines.forEach(validateLine);
});
test('Netease lyrics refuse a different version id',async()=>{
  let fetchedLyrics=false;
  const fetchImpl=async url=>{if(url.pathname.includes('/song/lyric'))fetchedLyrics=true;return {ok:true,json:async()=>({code:200,result:{songs:[{id:123,name:'Love 119',artists:[{name:'RIIZE'}],duration:173489}]}})}};
  const result=await findNeteaseLyrics({title:'Love 119',artist:'RIIZE',durationMs:173500,providerId:'456'},fetchImpl);
  assert.equal(result.status,'no_matched_version');assert.equal(fetchedLyrics,false);
});
test('Netease lyrics do not pair a preview with another album of the same title and duration',async()=>{
  let fetchedLyrics=false;
  const fetchImpl=async url=>{
    if(url.pathname.includes('/song/lyric'))fetchedLyrics=true;
    return {ok:true,json:async()=>({code:200,result:{songs:[
      {id:123,name:'Love 119',artists:[{name:'RIIZE'}],album:{name:'Love 119'},duration:173489},
      {id:456,name:'Love 119',artists:[{name:'RIIZE'}],album:{name:'RIIZING'},duration:173489},
    ]}})};
  };
  const result=await findNeteaseLyrics({title:'Love 119',artist:'RIIZE',album:'RIIZING',durationMs:173500,providerId:'123'},fetchImpl);
  assert.equal(result.status,'no_matched_version');assert.equal(fetchedLyrics,false);
});
