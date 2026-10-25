'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {findQqLyrics}=require('../backend/media/qq-lyrics');

const song={id:'461885252',songmid:'003Do8be0UUbfy',title:'Love 119',artist:'RIIZE (라이즈)',album:'Love 119',durationMs:173000,provider:'qqmusic'};
test('QQ lyrics match the local song ID and decode timed LRC',async()=>{
  const fetchImpl=async url=>{
    assert.equal(url.searchParams.get('songmid'),song.songmid);
    return {ok:true,json:async()=>({code:0,lyric:Buffer.from('[00:00.00]Love 119 - RIIZE (라이즈)\n[00:02.00]词：someone\n[00:12.10]뺏긴 my heart\n[00:15.20]시작됐지').toString('base64')})};
  };
  const result=await findQqLyrics({title:'Love 119',artist:'RIIZE',durationMs:173489,providerId:song.id},{libraryImpl:async()=>[song],fetchImpl,fallback:()=>{throw Error('unexpected fallback')}});
  assert.equal(result.source,'QQ 音乐');
  assert.equal(result.song.source.id,song.songmid);
  assert.equal(result.lines.length,2);
  assert.equal(result.lines[0].startMs,12100);
  assert.equal(result.lines[0].endMs,15200);
  assert.equal(result.lines[0].source.kind,'qqmusic');
});
test('QQ lyrics reject a selected ID that is not the matching local version',async()=>{
  const result=await findQqLyrics({title:'Love 119',artist:'RIIZE',durationMs:173489,providerId:'999'},{libraryImpl:async()=>[song],fallback:()=>{throw Error('unexpected fallback')}});
  assert.equal(result.status,'no_matched_version');
});
test('QQ lyrics reject a selected ID from a different album with the same title and duration',async()=>{
  const result=await findQqLyrics({title:'Love 119',artist:'RIIZE',album:'RIIZING',durationMs:173489,providerId:song.id},
    {libraryImpl:async()=>[song],fallback:()=>{throw Error('unexpected fallback')}});
  assert.equal(result.status,'no_matched_version');
});
test('QQ lyrics omit opening production credits and retain the first sung line boundary',async()=>{
  const raw='[00:00.00]Original Lyrics by：someone\n[00:01.00]Vocal Directed by：someone\n[00:03.00]Korean Lyrics by：someone\n[00:07.00]뺏긴 my heart\n[00:09.00]시작됐지';
  const result=await findQqLyrics({title:'Love 119',artist:'RIIZE',durationMs:173000,providerId:song.id},
    {libraryImpl:async()=>[song],fetchImpl:async()=>({ok:true,json:async()=>({code:0,lyric:Buffer.from(raw).toString('base64')})}),fallback:()=>{throw Error('unexpected fallback')}});
  assert.deepEqual(result.lines.map(line=>line.text),['뺏긴 my heart','시작됐지']);
  assert.equal(result.lines[0].startMs,7000);
  assert.equal(result.lines[0].endMs,9000);
});
