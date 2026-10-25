'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateLine,validateAnswer}=require('../shared/contract');
const {parseSyncedLrc,findLyrics}=require('../backend/media/lyrics');
const session=require('../backend/agent/session');
const {capabilities}=require('../backend/server');
test('line times and source are validated',()=>{
  const line={id:'l1',songId:'s1',text:'다시',startMs:1000,endMs:2000,source:{kind:'original_demo'},reviewStatus:'original'};
  assert.equal(validateLine(line).startMs,1000);
  assert.throws(()=>validateLine({...line,endMs:900}));
  assert.throws(()=>validateLine({...line,source:{kind:'unknown'}}));
  assert.throws(()=>validateAnswer({sessionId:'s',nodeId:'n',submissionId:'x',choice:3,attempt:1}));
});
test('LRC milliseconds and final unknown end are preserved',()=>{
  const lines=parseSyncedLrc('[00:01.50]첫 줄\n[00:04.250]둘째 줄','s','source');
  assert.equal(lines[0].startMs,1500);assert.equal(lines[0].endMs,4250);assert.equal(lines[1].endMs,null);
  lines.forEach(validateLine);
});
test('version mismatch does not expose a wrong lyric',async()=>{
  const fake=async()=>({ok:true,json:async()=>[{id:4,trackName:'Song',artistName:'Artist',duration:190,syncedLyrics:'[00:01.00]text'}]});
  const result=await findLyrics('Song','Artist',120000,fake);
  assert.equal(result.status,'no_matched_version');assert.deepEqual(result.lines,[]);
});
test('source failure is visible',async()=>{
  await assert.rejects(()=>findLyrics('Song','Artist',120000,async()=>{throw Error('offline')}),/offline/);
});
test('temporary lyric upstream failure is retried once',async()=>{
  let attempts=0;
  const fake=async()=>++attempts===1?{ok:false,status:503}:{ok:true,json:async()=>[{id:4,trackName:'Song',artistName:'Artist',duration:120,syncedLyrics:'[00:01.00]text'}]};
  const result=await findLyrics('Song','Artist',120000,fake);
  assert.equal(attempts,2);assert.equal(result.lines.length,1);
});
test('wrong answer causes remediation, duplicate is idempotent, correct answer completes',()=>{
  const s=session.begin('demo-morning');
  const wrong={sessionId:s.id,nodeId:'demo-dasi',submissionId:'one',choice:1,attempt:1,hintUsed:false};
  const first=session.answer(wrong);assert.equal(first.feedback.nextAction.type,'remediate');assert.equal(first.session.progress.completed,0);
  assert.deepEqual(session.answer(wrong),first);assert.equal(session.get(s.id).history.length,1);
  const second=session.answer({...wrong,submissionId:'two',choice:0,attempt:2,hintUsed:true});
  assert.equal(second.session.progress.completed,1);assert.equal(session.get(s.id).history.length,2);
});
test('platform capabilities never claim unsupported word audio or speed',()=>{
  assert.equal(capabilities('offline').seek,false);assert.equal(capabilities('local_audio').wordSeek,false);
  assert.equal(capabilities('mac_music').speed,false);
});
