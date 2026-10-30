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
test('gold fixture validates as P0 RunDraft with P1 prelude fields',()=>{
  const fixture=require('../content/fixtures/demo');
  const {validateRunDraftP0,draftFromFixture}=require('../content/validate-run-draft');
  const draft=draftFromFixture(fixture);
  assert.equal(validateRunDraftP0(draft,fixture.lines.map(l=>l.id)),true);
  assert.equal(draft.nodes[1].contrastAxis.includes('走路'),true);
  assert.equal(draft.nodes[2].transfer,true);
  assert.throws(()=>validateRunDraftP0({...draft,cards:[{id:'x'}]},fixture.lines.map(l=>l.id)));
});
test('wrong answer causes remediation, duplicate is idempotent, path advances across three nodes',()=>{
  const s=session.begin('demo-morning');
  assert.equal(s.progress.total,3);assert.equal(s.currentNodeId,'demo-dasi');
  const wrong={sessionId:s.id,nodeId:'demo-dasi',submissionId:'one',choice:1,attempt:1,hintUsed:false};
  const first=session.answer(wrong);assert.equal(first.feedback.nextAction.type,'remediate');assert.equal(first.session.progress.completed,0);
  assert.deepEqual(session.answer(wrong),first);assert.equal(session.get(s.id).history.length,1);
  const n1=session.answer({...wrong,submissionId:'two',choice:0,attempt:2,hintUsed:true});
  assert.equal(n1.session.progress.completed,1);assert.equal(n1.session.currentNodeId,'demo-dasi-contrast');
  const n2=session.answer({sessionId:s.id,nodeId:'demo-dasi-contrast',submissionId:'three',choice:0,attempt:1,hintUsed:false});
  assert.equal(n2.session.progress.completed,2);assert.equal(n2.session.currentNodeId,'demo-dasi-final');
  const n3=session.answer({sessionId:s.id,nodeId:'demo-dasi-final',submissionId:'four',choice:0,attempt:1,hintUsed:false});
  assert.equal(n3.session.progress.completed,3);assert.equal(n3.session.currentNodeId,null);
  assert.equal(session.get(s.id).history.length,4);
});
test('platform capabilities never claim unsupported word audio or speed',()=>{
  assert.equal(capabilities('offline').seek,false);assert.equal(capabilities('local_audio').wordSeek,false);
  assert.equal(capabilities('mac_music').speed,false);
});
