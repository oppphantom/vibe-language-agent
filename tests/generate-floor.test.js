'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateFloorDraft}=require('../content/validate-floor-draft');
const {collectStyleWarnings}=require('../shared/copy-style');
const {normalizeInput,parseModelJson,generateFloor}=require('../backend/agent/generate-floor');

function item(id,evidenceLineIds,extra={}){
  return {
    id,
    type:'context_choice',
    prompt:'「아직」在这句里指什么？',
    options:['还没做完或仍在持续','已经全部结束','与歌词无关'],
    correctIndex:0,
    explanation:'看否定或持续状态词。',
    remedial:'回到证据句，圈出아직后面的动词。',
    morphologyNote:'连续字符命中，未做词形分析。',
    target:{expression:'아직',skill:'语境理解',evidenceLineIds},
    ...extra
  };
}

function validDraft(){
  const c1Items=[item('c1a',['w2']),item('c1b',['w4']),item('c1c',['w2']),item('c1d',['w2','w4'],{contrastAxis:'残留 vs 未睡'})];
  const eliteItems=[
    item('e1',['w2','b2'],{contrastAxis:'持续残留 vs 尚未到达'}),
    item('e2',['b2']),item('e3',['r2']),item('e4',['r4']),item('e5',['w2','b2'],{contrastAxis:'持续 vs 尚未'})
  ];
  const bossItems=[1,2,3,4,5,6].map(n=>item('b'+n,['l2'],{transfer:true}));
  return {
    schemaVersion:2,
    expression:'아직',
    baseMeaning:'还 / 尚未',
    learningGoal:'区分持续与尚未',
    unverifiedClaims:['情绪强弱'],
    rooms:[
      {id:'gen-c1',roomType:'combat',personaId:'polysemy_tutor',title:'窗边',encounter:{items:c1Items}},
      {id:'gen-elite',roomType:'elite',personaId:'polysemy_tutor',title:'对照',encounter:{items:eliteItems}},
      {id:'gen-boss',roomType:'boss',personaId:'polysemy_tutor',title:'汇合',encounter:{items:bossItems}}
    ],
    graph:{
      startNodeId:'gen-c1',
      edges:[
        {from:'gen-c1',to:'gen-elite',when:'on_clear',label:'前进'},
        {from:'gen-elite',to:'gen-boss',when:'on_clear',label:'Boss'}
      ]
    }
  };
}

const lineIds=['w2','w4','b2','r2','r4','l2'];

test('normalizeInput rejects thin lyric bags',()=>{
  assert.throws(()=>normalizeInput({expression:'아직',lines:[{id:'a',text:'x'}]}));
  const ok=normalizeInput({
    expression:'아직',
    lines:[{id:'w2',text:'네 목소리는 아직 귀에 남아.'},{id:'b2',text:'아직 집에 도착하지 못했어.'}]
  });
  assert.equal(ok.lines.length,2);
});

test('validateFloorDraft accepts mini combat-elite-boss floor',()=>{
  const result=validateFloorDraft(validDraft(),lineIds);
  assert.equal(result.ok,true);
  assert.deepEqual(result.styleWarnings,[]);
});

test('validateFloorDraft rejects short combat packs',()=>{
  const draft=validDraft();
  draft.rooms[0].encounter.items=draft.rooms[0].encounter.items.slice(0,2);
  assert.throws(()=>validateFloorDraft(draft,lineIds),/题量/);
});

test('validateFloorDraft rejects unknown evidence ids',()=>{
  const draft=validDraft();
  draft.rooms[0].encounter.items[0].target.evidenceLineIds=['missing'];
  assert.throws(()=>validateFloorDraft(draft,lineIds),/证据行/);
});

test('style warnings catch banned marketing copy',()=>{
  const warnings=collectStyleWarnings(['值得注意的是这句','普通短句']);
  assert.equal(warnings.some(w=>w.includes('值得注意的是')),true);
});

test('parseModelJson strips markdown fences',()=>{
  const obj=parseModelJson('```json\n{"a":1}\n```');
  assert.equal(obj.a,1);
});

test('generateFloor validates model payload via mock fetch',async()=>{
  const prev={
    key:process.env.VIBE_MODEL_API_KEY,
    name:process.env.VIBE_MODEL_NAME,
    endpoint:process.env.VIBE_MODEL_ENDPOINT
  };
  process.env.VIBE_MODEL_API_KEY='test-key';
  process.env.VIBE_MODEL_NAME='test-model';
  process.env.VIBE_MODEL_ENDPOINT='https://example.com/v1/chat/completions';
  try{
    const draft=validDraft();
    const fake=async()=>({
      ok:true,
      json:async()=>({choices:[{message:{content:JSON.stringify(draft)}}]})
    });
    const result=await generateFloor({
      expression:'아직',
      lines:[
        {id:'w2',songId:'s',text:'네 목소리는 아직 귀에 남아.'},
        {id:'w4',songId:'s',text:'나는 아직 잠들지 못했어.'},
        {id:'b2',songId:'s',text:'아직 집에 도착하지 못했어.'},
        {id:'r2',songId:'s',text:'거리는 아직 젖어 있어.'},
        {id:'r4',songId:'s',text:'아직 나가지 않을래.'},
        {id:'l2',songId:'s',text:'내 마음은 아직 정리되지 않았으니까.'}
      ]
    },fake);
    assert.equal(result.draft.needsHumanReview,true);
    assert.equal(result.draft.rooms.length,3);
    assert.equal(result.origin.includes('未人工核对'),true);
  }finally{
    for(const [k,v] of [['VIBE_MODEL_API_KEY',prev.key],['VIBE_MODEL_NAME',prev.name],['VIBE_MODEL_ENDPOINT',prev.endpoint]]){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
});

test('generateFloor without config is unavailable',async()=>{
  const prev={
    key:process.env.VIBE_MODEL_API_KEY,
    name:process.env.VIBE_MODEL_NAME,
    endpoint:process.env.VIBE_MODEL_ENDPOINT
  };
  delete process.env.VIBE_MODEL_API_KEY;
  delete process.env.VIBE_MODEL_NAME;
  delete process.env.VIBE_MODEL_ENDPOINT;
  try{
    await assert.rejects(
      ()=>generateFloor({expression:'아직',lines:[{id:'a',text:'아직'},{id:'b',text:'이미'}]}),
      (err)=>err.code==='MODEL_UNAVAILABLE'
    );
  }finally{
    for(const [k,v] of [['VIBE_MODEL_API_KEY',prev.key],['VIBE_MODEL_NAME',prev.name],['VIBE_MODEL_ENDPOINT',prev.endpoint]]){
      if(v===undefined)delete process.env[k];else process.env[k]=v;
    }
  }
});
