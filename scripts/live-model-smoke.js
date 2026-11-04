'use strict';
const {loadEnv}=require('../backend/env');
const {plan}=require('../backend/agent/planner');
const session=require('../backend/agent/session');

const song={
  id:'live-model-smoke-ja',title:'また会えた日',artist:'VIBE 原创测试材料',language:'ja',version:'smoke-v1',
  durationMs:120000,source:{kind:'original_demo',id:'live-model-smoke'}
};
const texts=[
  '今日、また君に会えた。',
  '雨のあとも、また歩こう。',
  '昨日は言えなかった。',
  '明日また話そう。'
];
const lines=texts.map((text,index)=>({
  id:`${song.id}-${index+1}`,songId:song.id,text,startMs:index*5000,endMs:index*5000+4500,
  source:{kind:'original_demo',id:'live-model-smoke'},reviewStatus:'original'
}));

loadEnv();
plan({song,lines,language:'ja'}).then(result=>{
  const created=session.begin({courseId:result.courseId}),first=session.node(created.id);
  if(first.map.length!==result.levelCount||first.interaction!=='dungeon'||first.room?.tiles?.length!==9)throw Error('ASCII 地下城没有正确生成');
  console.log(`真实模型地下城生成通过：${result.languageLabel} / ${result.targetExpression} / ${result.levelCount} 关 / ${result.mode}`);
}).catch(error=>{
  console.error(`真实模型联调失败：${error.code||'UNKNOWN'} / ${String(error.message||'未知错误').slice(0,200)}`);
  process.exitCode=1;
});
