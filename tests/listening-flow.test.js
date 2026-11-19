'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {create}=require('../frontend/playback-retry');
function setup(){
  const nodes=new Map();
  const element=()=>({hidden:false,children:[],dataset:{},disabled:false,isConnected:true,
    append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},
    querySelectorAll(){return this.children},classList:{add(){}}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const challenge={id:'q',kind:'note',lineId:'line',options:['one','two','three'],prompt:'听原声选歌词'};
  const state={session:{id:'s',status:'active'},node:{material:{lines:[{id:'line',songId:'song'}],
    songs:[{id:'song',provider:'apple'}]},room:{pending:{objectId:'q'}}},modalId:null};
  $('gameModal').hidden=true;
  const pending=[];
  const context={$ ,state,document:{createElement:element},
    window:{vibeMusic:{playEvidence:()=>new Promise(resolve=>pending.push(resolve))},
      VibePlaybackRetry:{create:options=>create({...options,delay:()=>100000})}},
    text:()=>element(),learnerCopy:x=>x,respondChallenge(){},setTimeout,clearTimeout};
  const source=fs.readFileSync(require.resolve('../frontend/app.js'),'utf8');
  vm.runInNewContext(source.slice(source.indexOf('function stopNotePlaybackRetry(){'),
    source.indexOf('function applyServerNode(')),context);
  return {context,challenge,$,pending};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('audio-to-lyrics locks answers until playback succeeds and during replay',async()=>{
  const {context,challenge,$,pending}=setup();
  try{
    context.showChallenge(challenge);await tick();
    assert.ok($('modalOptions').children.every(button=>button.disabled));
    pending.shift()(true);await tick();
    assert.ok($('modalOptions').children.every(button=>!button.disabled));
    const replay=$('modalAudioChoices').children[0];
    replay.onclick();await tick();
    assert.ok(replay.disabled);
    assert.ok($('modalOptions').children.every(button=>button.disabled));
    pending.shift()(true);await tick();
    assert.ok($('modalOptions').children.every(button=>!button.disabled));
    const metrics=context.metricsFor(challenge);
    assert.equal(metrics.playRequests,2);assert.equal(metrics.playSuccesses,2);
  }finally{context.stopNotePlaybackRetry()}
});
test('failed initial playback leaves answers locked and closing prevents stale updates',async()=>{
  const {context,challenge,$,pending}=setup();
  try{
    context.showChallenge(challenge);await tick();
    pending.shift()(false);await tick();
    assert.ok($('modalOptions').children.every(button=>button.disabled));
    assert.equal(context.metricsFor(challenge).playFailures,1);
    context.stopNotePlaybackRetry();
    context.startNotePlaybackRetry(challenge);await tick();
    context.closeGameModal();
    pending.shift()(true);await tick();
    assert.equal($('modalAudioStatus').textContent,'');
    assert.equal($('gameModal').hidden,true);
  }finally{context.stopNotePlaybackRetry()}
});

test('an in-flight clip cannot be credited to a different audio option',async()=>{
  const {context,challenge,pending}=setup();
  try{
    const song={id:'song',provider:'apple'};
    const first=context.playQuestion(challenge,song,{id:'line'});await tick();
    assert.equal(await context.playQuestion(challenge,song,{id:'other'}),false);
    assert.equal(pending.length,1);
    pending.shift()(true);assert.equal(await first,true);
    assert.equal(context.metricsFor(challenge).playSuccesses,1);
  }finally{context.stopNotePlaybackRetry()}
});
