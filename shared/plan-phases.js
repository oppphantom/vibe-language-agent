'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vibePlanPhases=api;
})(typeof window!=='undefined'?window:null,()=>({
  PLAN_PHASES:['queued','analyzing_lyrics','generating_teaching','designing_dungeon','completed','failed'],
  PLAN_PHASE_LABELS:{
    queued:'正在准备课程材料…',
    analyzing_lyrics:'正在分析歌词并选择学习表达…',
    generating_teaching:'正在生成教学目标与练习…',
    designing_dungeon:'正在生成并校验地下城关卡…'
  }
}));
