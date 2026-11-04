'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const session=require('../backend/agent/session');
const planner=require('../backend/agent/planner');
const {completeJson}=require('../backend/agent/llm');
const {fallbackDungeon}=require('../backend/agent/dungeon-agent');
const {loadEnv}=require('../backend/env');

const song={
  id:'live-ja-test',title:'また会えた日',artist:'测试歌手',language:'ja',version:'test-v1',durationMs:120000,
  provider:'qqmusic',providerId:'123456',playbackVerified:true,source:{kind:'lrclib',id:22}
};
const lines=[1,2,3,4].map(index=>({
  id:`${song.id}-${index}`,
  songId:song.id,
  text:['今日、また君に会えた。','雨のあとも、また歩こう。','昨日の言葉を覚えている。','明日もここで待ってる。'][index-1],
  startMs:index*5000,
  endMs:index*5000+4000,
  source:{kind:'lrclib',id:22},
  reviewStatus:'unverified'
}));
const types=['listening','meaning','story','culture','rest','challenge'];
const fakeCourse={
  targetExpression:'また',
  title:'また：再次见面的语境',
  nodes:types.map((type,index)=>({
    type,
    skill:['听辨定位','语境推断','情境运用','文化解读','证据复盘','表达迁移'][index],
    title:`第 ${index+1} 站`,
    prompt:`这是第 ${index+1} 站的题面`,
    options:['正确选项','干扰选项一','干扰选项二'],
    correctIndex:0,
    explanation:'依据两行歌词中的「また」以及前后行动。',
    remedial:'先只比较包含「また」的句子，再看它连接的行动。',
    evidenceLineIds:[lines[0].id,lines[1].id]
  }))
};

test('.env loading preserves existing process variables and accepts quoted values',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vibe-env-'));
  const file=path.join(directory,'.env');
  const existingKey='VIBE_TEST_ENV_EXISTING',newKey='VIBE_TEST_ENV_NEW';
  const oldExisting=process.env[existingKey],oldNew=process.env[newKey];
  process.env[existingKey]='from-process';
  delete process.env[newKey];
  fs.writeFileSync(file,`${existingKey}=from-file\n${newKey}="from-file"\n`,'utf8');
  try{
    assert.equal(loadEnv(file),true);
    assert.equal(process.env[existingKey],'from-process');
    assert.equal(process.env[newKey],'from-file');
  }finally{
    if(oldExisting===undefined)delete process.env[existingKey];else process.env[existingKey]=oldExisting;
    if(oldNew===undefined)delete process.env[newKey];else process.env[newKey]=oldNew;
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

test('model adapter rejects unsafe endpoints and unusable JSON responses',async()=>{
  const keys=['VIBE_MODEL_ENDPOINT','VIBE_MODEL_NAME','VIBE_MODEL_API_KEY'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  process.env.VIBE_MODEL_NAME='test-model';process.env.VIBE_MODEL_API_KEY='test-key';
  try{
    process.env.VIBE_MODEL_ENDPOINT='http://127.0.0.1:9999/chat';
    await assert.rejects(()=>completeJson({system:'system',user:'user'},async()=>{
      throw Error('must not be called');
    }),error=>error.code==='MODEL_CONFIG');
    process.env.VIBE_MODEL_ENDPOINT='https://model.example/v1/chat/completions';
    await assert.rejects(()=>completeJson({system:'system',user:'user'},async()=>({
      ok:true,json:async()=>({choices:[]})
    })),error=>error.code==='MODEL_OUTPUT');
  }finally{
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
  }
});

test('planner turns real-song material into a private variable-level dungeon plan',async()=>{
  let request;
  const result=await planner.plan({song,lines,language:'ja'},{
    completeJsonImpl:async input=>{
      request=input;
      return structuredClone(fakeCourse);
    },
    dungeonGenerator:(course,{lines:material})=>Promise.resolve(fallbackDungeon(course,material))
  });
  assert.equal(result.nodeCount,6);assert.equal(result.language,'ja');
  assert.ok(result.levelCount>=3);
  assert.equal(Object.hasOwn(result,'nodes'),false);assert.equal(Object.hasOwn(result,'correctIndex'),false);
  assert.match(request.system,/listening、meaning、story、culture、rest、challenge/);
  const sentMaterial=JSON.parse(request.user);
  assert.equal(sentMaterial.song.title,song.title);assert.equal(sentMaterial.lines.length,4);

  const created=session.begin({courseId:result.courseId});
  assert.equal(created.mode,'ai_generated');assert.equal(created.courseTitle,fakeCourse.title);
  const first=session.node(created.id);
  assert.match(first.provenance,new RegExp(result.provenance.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal(first.material.songs[0].provider,'qqmusic');
  assert.equal(first.material.songs[0].providerId,'123456');
  assert.equal(Object.hasOwn(first,'correctIndex'),false);
  assert.equal(first.interaction,'dungeon');
  assert.equal(first.room.tiles.length,9);assert.ok(first.room.tiles.every(row=>row.length===19));
});

test('planner rejects insufficient material before calling the model',async()=>{
  let called=false;
  await assert.rejects(()=>planner.plan({song,lines:lines.slice(0,2),language:'ja'},{
    completeJsonImpl:async()=>{called=true;return fakeCourse}
  }),error=>error.code==='INVALID_INPUT');
  assert.equal(called,false);
});

test('planner rejects model courses with fabricated evidence',async()=>{
  const invalid=structuredClone(fakeCourse);invalid.nodes[0].evidenceLineIds=['does-not-exist'];
  await assert.rejects(()=>planner.plan({song,lines,language:'ja'},{
    completeJsonImpl:async()=>invalid,
    dungeonGenerator:(course,{lines:material})=>Promise.resolve(fallbackDungeon(course,material))
  }),error=>error.code==='MODEL_OUTPUT');
});
