'use strict';
// Offline Spire-like floor sample for design preview. Original Korean teaching text only.
const song=(id,title,durationMs)=>({
  id,title,artist:'VIBE 原创教学样例',language:'ko',version:'sample-v2',durationMs,
  source:{kind:'original_demo',label:'原创教学文本'},
  audio:{available:false,reason:'未附可授权音源'}
});
const line=(id,songId,text,startMs,endMs)=>({
  id,songId,text,startMs,endMs,
  source:{kind:'original_demo',label:'原创教学文本'},reviewStatus:'original'
});
const morph='本关依据连续字符命中目标表达，未做韩语词形分析；命中≠义项已变。';

const songs=[
  song('sample-window','窗边的夜',32000),
  song('sample-bus','末班车',28000),
  song('sample-letter','未寄出的信',24000),
  song('sample-rain','雨停之后',26000)
];
const lines=[
  line('w1','sample-window','불을 끄지 못한 채 앉아 있어.',1000,4500),
  line('w2','sample-window','네 목소리는 아직 귀에 남아.',5000,9000),
  line('w3','sample-window','창밖은 이미 조용해졌는데.',9500,13500),
  line('w4','sample-window','나는 아직 잠들지 못했어.',14000,18000),
  line('b1','sample-bus','버스는 떠났고 나는 남았어.',1000,4500),
  line('b2','sample-bus','아직 집에 도착하지 못했어.',5000,9000),
  line('b3','sample-bus','다음 차는 언제 올까.',9500,12500),
  line('b4','sample-bus','발이 아직 계단에 있어.',13000,16500),
  line('l1','sample-letter','편지를 썼지만 보내지 않았어.',1000,4500),
  line('l2','sample-letter','내 마음은 아직 정리되지 않았으니까.',5000,9500),
  line('l3','sample-letter','잉크는 이미 말랐는데.',10000,13500),
  line('r1','sample-rain','비가 그쳤어.',1000,3500),
  line('r2','sample-rain','거리는 아직 젖어 있어.',4000,8000),
  line('r3','sample-rain','우산은 이미 접었지만.',8500,12000),
  line('r4','sample-rain','아직 나가지 않을래.',12500,16000)
];

function q(id,prompt,options,correctIndex,evidenceLineIds,explanation,remedial,extra={}){
  return {
    id,type:'context_choice',prompt,options,correctIndex,
    target:{expression:'아직',skill:extra.skill||'语境理解',evidenceLineIds,prerequisites:extra.prerequisites||['知道 아직 ≈ 还/仍然/尚未']},
    explanation,remedial,morphologyNote:morph,
    contrastAxis:extra.contrastAxis||null,transfer:extra.transfer===true
  };
}

const characters=[
  {
    id:'polysemy_tutor',name:'义项侦探',tagline:'抠词义、做对照',
    blurb:'适合认真练「持续 vs 尚未」。对照题会显示对照轴。',
    startingRelics:[],startingCards:[],startingInsight:0,
    perks:['contrast_axis_visible','combat_focus'],
    weakness:'事件房没有额外安全选项'
  },
  {
    id:'story_npc',name:'剧情旅人',tagline:'走支线、少挨揍',
    blurb:'事件房多一条安全回复；休息回血多 1 点。',
    startingRelics:[],startingCards:[],startingInsight:0,
    perks:['event_safe_option','rest_heal_bonus'],
    weakness:'对照题不自动显示对照轴'
  },
  {
    id:'culture_guide',name:'文化向导',tagline:'拾卡片、逛文化房',
    blurb:'开局带文化卡片；文化/探索不花洞察。',
    startingRelics:[],startingCards:['card-time-contrast'],startingInsight:0,
    perks:['free_culture','start_card'],
    weakness:'没有首次答错免伤'
  },
  {
    id:'listening_coach',name:'听感教练',tagline:'靠耳朵（需音源）',
    blurb:'有音源时听辨首次答错免伤，开局 +1 洞察。本离线样本无音源，该加成基本无效。',
    startingRelics:[],startingCards:[],startingInsight:1,
    perks:['listening_forgiveness','start_insight'],
    weakness:'无音源时几乎无优势',disabledReason:'本样本歌曲均无授权音源'
  }
];

const relicsCatalog=[
  {id:'relic-sticky-notes',name:'双色便签',effect:'对照题显示 contrastAxis（与侦探叠加无额外效果）'},
  {id:'relic-knife',name:'消歧小刀',effect:'本层第一次答错不扣专注值'},
  {id:'relic-echo',name:'回声贝',effect:'允许重听证据句（需音源；本样本无效）'},
  {id:'relic-glasses',name:'怀疑眼镜',effect:'导师质疑房提示增强（本层未投放）'}
];

const rooms=[
  {
    id:'f1-c1',roomType:'combat',mapNode:'context',personaId:'polysemy_tutor',
    title:'战斗 · 窗边余音',row:0,col:1,
    hpRisk:1,insightReward:1,
    encounter:{
      title:'义项扫荡 · 窗边',minItems:4,
      items:[
        q('c1-1','「네 목소리는 아직 귀에 남아」中「아직」更接近？',
          ['声音仍留在耳边（持续）','声音还没出现','窗外更吵了'],0,['w2','w3'],
          '「남아」=留下；对比「이미 조용해졌는데」。','并看아직与이미。',{skill:'语境理解'}),
        q('c1-2','下一句「창밖은 이미 조용해졌는데」里的「이미」作用是？',
          ['标出「已经安静」，与아직形成对举','表示尚未安静','表示明天才会安静'],0,['w2','w3'],
          '이미=已经，用来衬托声音还在。','找이미修饰的状态。'),
        q('c1-3','「나는 아직 잠들지 못했어」里「아직」？',
          ['还没睡着（尚未完成）','已经睡得很沉','只在说关灯'],0,['w4'],
          '잠들지 못했어是否定完成+아직。','看못했어。'),
        q('c1-4','窗边两句「목소리가 아직 남아」和「아직 잠들지 못했어」共同点？',
          ['都用아직表达「仍未结束的状态」','都表示已经全部结束','都与公交车有关'],0,['w2','w4'],
          '一为残留持续，一为未入睡；同属未结束。','问：什么事还没完？',{contrastAxis:'残留持续 vs 尚未入睡',skill:'跨语境对照'})
      ]
    }
  },
  {
    id:'f1-c2',roomType:'combat',mapNode:'context',personaId:'polysemy_tutor',
    title:'战斗 · 站台未到',row:1,col:0,
    hpRisk:1,insightReward:1,
    encounter:{
      title:'义项扫荡 · 末班车',minItems:4,
      items:[
        q('c2-1','「아직 집에 도착하지 못했어」？',
          ['还没到家','已经到家','声音还在耳边'],0,['b2'],
          '도착하지 못했어+아직=尚未到达。','盯住도착。'),
        q('c2-2','「발이 아직 계단에 있어」？',
          ['脚还在楼梯上（位置仍在）','脚已经离开车站','信已经寄出'],0,['b4'],
          '있어表示仍处于楼梯。','看장소에 있어。'),
        q('c2-3','末班车里「아직」主要连着什么？',
          ['尚未完成的位移/离开','窗外安静','墨水已干'],0,['b2','b4'],
          '到家、脚离阶都未完成。','两句的动词各是什么？'),
        q('c2-4','若把「아직」改成「이미」在「아직 집에 도착하지 못했어」会怎样？',
          ['与「没能到达」冲突，句子不通顺','意思完全不变','变成在说声音'],0,['b2'],
          '이미与否定完成连用会别扭。','이미≈已经完成。')
      ]
    }
  },
  {
    id:'f1-event',roomType:'event',mapNode:'galgame',personaId:'story_npc',
    title:'事件 · 站台对话',row:1,col:2,
    hpRisk:0,insightReward:0,
    encounter:{
      title:'短剧',minItems:0,
      kind:'dialogue_choice',
      speaker:'朋友',
      line:'末班车走了。你还要在这儿等吗？',
      choices:[
        {id:'wait',reply:'嗯……我还没到家，再等一班。',hint:'呼应尚未到达',effect:{insight:1}},
        {id:'echo',reply:'你的声音好像还在我耳朵里。',hint:'呼应持续残留',effect:{insight:1}},
        {id:'safe',reply:'先找个地方坐会儿吧。',hint:'安全支线（旅人专属可见）',effect:{hp:0},requirePerk:'event_safe_option'},
        {id:'shrug',reply:'算了，今天什么都不想了。',hint:'中性推进',effect:{}}
      ]
    }
  },
  {
    id:'f1-elite',roomType:'elite',mapNode:'context',personaId:'polysemy_tutor',
    title:'精英 · 持续 vs 尚未',row:2,col:0,
    hpRisk:1,insightReward:2,relicReward:'relic-knife',
    encounter:{
      title:'精英对照',minItems:5,
      items:[
        q('e1','比较「목소리가 아직 남아」和「아직 집에 도착하지 못했어」：',
          ['持续残留 vs 尚未到达','两句都表示永远不会','两句都=已经完成'],0,['w2','b2'],
          '轴：持续 vs 尚未。','分别圈动词남다 / 도착하다。',{contrastAxis:'持续残留 vs 尚未到达',skill:'跨语境对照'}),
        q('e2','「거리는 아직 젖어 있어」更接近哪一类？',
          ['状态仍在持续（还湿着）','尚未开始下雨','已经完全干了'],0,['r2'],
          '젖어 있어=仍处于湿的状态。','看어 있어。'),
        q('e3','「우산은 이미 접었지만」中이미说明？',
          ['伞已经收起','伞还没收','人还没到家'],0,['r3'],
          '이미 접었다=已经折好。','이미+过去完成感。'),
        q('e4','雨后「아직 나가지 않을래」？',
          ['还不想出门（暂不发生出门）','已经出门了','墨水未干'],0,['r4'],
          '나가지 않을래=不想出去；아직加强「先不」。','看나가다。'),
        q('e5','下列哪句的「아직」属于「尚未达成目标」？',
          ['아직 집에 도착하지 못했어','네 목소리는 아직 귀에 남아','거리는 아직 젖어 있어'],0,['b2','w2','r2'],
          '只有到家句是否定达成。','问有没有目标动词被否定。',{skill:'跨语境对照'})
      ]
    }
  },
  {
    id:'f1-rest',roomType:'rest',mapNode:'rest',personaId:'polysemy_tutor',
    title:'休息处 · 回廊长椅',row:2,col:1,
    hpRisk:0,insightReward:0,
    encounter:{
      title:'休息',minItems:0,
      kind:'rest',
      options:[
        {id:'heal',label:'闭目复习证据句',effect:{hp:1},note:'专注值 +1；旅人再 +1'},
        {id:'review',label:'重看上一道错因（不扣不加）',effect:{},note:'预览中仅展示文案'}
      ]
    }
  },
  {
    id:'f1-shop',roomType:'shop',mapNode:'shop',personaId:'culture_guide',
    title:'商店 · 词义摊',row:2,col:2,
    hpRisk:0,insightReward:0,
    encounter:{
      title:'花洞察换东西',minItems:0,
      kind:'shop',
      stock:[
        {
          id:'buy-notes',relicId:'relic-sticky-notes',cost:2,name:'双色便签',
          blurb:'遗物。之后所有带对照轴的题目，会直接显示「两句差在哪」（与义项侦探效果同类）。'
        },
        {
          id:'buy-hint',cost:1,name:'单题提示券',effect:{hintCharges:1},
          blurb:'消耗品。下一道未答的题额外显示对照轴或补教方向提示（有几张用几次）。'
        },
        {
          id:'buy-heal',cost:2,name:'热饮',effect:{hp:1},
          blurb:'立即回复 1 点专注值（不超过上限）。答错扣血时可回来补给。'
        }
      ]
    }
  },
  {
    id:'f1-c3',roomType:'combat',mapNode:'context',personaId:'polysemy_tutor',
    title:'战斗 · 信与墨',row:3,col:1,
    hpRisk:1,insightReward:1,
    encounter:{
      title:'义项扫荡 · 信',minItems:4,
      items:[
        q('c3-1','「내 마음은 아직 정리되지 않았으니까」？',
          ['心情尚未整理好','心情已整理完','雨已经停了'],0,['l2'],
          '정리되지 않았으니까+아직。','找被否定的整理。',{transfer:false}),
        q('c3-2','「잉크는 이미 말랐는데」的이미？',
          ['墨水已经干了','墨水还没干','人还在楼梯'],0,['l3'],
          '이미 말랐다。','이미+干。'),
        q('c3-3','信中「아직」与「이미」对举说明什么？',
          ['心未整理完，但墨已干（时间不对齐）','两件事都没开始','两件事都已结束'],0,['l2','l3'],
          '未完成的心 vs 已完成的墨。','并读两句。',{contrastAxis:'心尚未整理 vs 墨已经干'}),
        q('c3-4','「편지를 썼지만 보내지 않았어」有「아직」吗？对本路径的启示？',
          ['本句无아직，但「写了却没寄」可作尚未送达的情境铺垫','本句有三个아직','本句证明이미=尚未'],0,['l1'],
          '证据铺垫，勿编造句中没有的词。','先确认句中有没有아직。')
      ]
    }
  },
  {
    id:'f1-treasure',roomType:'treasure',mapNode:'treasure',personaId:'culture_guide',
    title:'宝箱 · 便签盒',row:4,col:1,
    hpRisk:0,insightReward:0,
    encounter:{
      title:'拾取',minItems:0,
      kind:'treasure',
      relicId:'relic-sticky-notes',
      cardIds:['card-time-contrast']
    }
  },
  {
    id:'f1-boss',roomType:'boss',mapNode:'final_challenge',personaId:'polysemy_tutor',
    title:'Boss · 三境汇合',row:5,col:1,
    hpRisk:1,insightReward:3,
    encounter:{
      title:'终局题包',minItems:6,
      items:[
        q('boss1','新组合：若说「숙제는 아직 끝나지 않았어」，아직？',
          ['作业尚未做完','作业早已做完','声音还在'],0,['l2','b2'],
          '끝나지 않았어+아직，迁移自「尚未完成」轴。','迁移：完成类动词+否定。',{transfer:true,skill:'语境迁移'}),
        q('boss2','「창밖은 이미 조용해졌는데」若去掉이미？',
          ['失去与아직的鲜明对举','句子必须报错','자동变成尚未'],0,['w3'],
          '이미是对举标记。','想对举还在不在。',{transfer:true}),
        q('boss3','哪句是「状态仍在」而非「目标未达成」？',
          ['거리는 아직 젖어 있어','아직 집에 도착하지 못했어','숙제는 아직 끝나지 않았어'],0,['r2','b2'],
          '湿着=状态；后两句是未完成目标。','有没有明确目标动词？',{transfer:true,skill:'跨语境对照'}),
        q('boss4','文化上把아직理解成「一定在撒娇」可以当唯一答案吗？',
          ['不可以，属未证实推断','可以，永远正确','可以，只要是韩语'],0,['w2'],
          '情绪强度不能单凭아직断定。','看unverifiedClaims。',{transfer:true}),
        q('boss5','「아직 나가지 않을래」迁移判断：',
          ['暂不实施「出去」这一动作','已经在外面跑了','墨水未干的同义句'],0,['r4'],
          '나가지 않을래+아직。','迁移出门场景。',{transfer:true}),
        q('boss6','本层学习目标验收：아직 的两大用法？',
          ['状态仍在持续 / 目标或动作尚未发生','只能表示过去完成','只能表示将来天气'],0,['w2','b2','l2'],
          '持续 vs 尚未——本层主轴。','回忆窗边与末班车。',{transfer:true,contrastAxis:'持续 vs 尚未'})
      ]
    }
  }
];

const cards=[{
  id:'card-time-contrast',personaId:'culture_guide',title:'학습 카드 · 아직 / 이미',
  body:'아직≈还（持续或尚未）；이미≈已经。常对举；是否「撒娇」不能单凭单词断定。',
  relatedLineIds:['w2','w3'],kind:'culture_trivia',reviewStatus:'unverified',quizEligible:false
}];

const graph={
  startNodeId:'f1-c1',
  nodes:rooms.map(r=>r.id),
  edges:[
    {from:'f1-c1',to:'f1-c2',when:'on_clear',label:'左路 · 站台加练'},
    {from:'f1-c1',to:'f1-event',when:'player_choice',label:'右路 · 站台事件'},
    {from:'f1-c2',to:'f1-elite',when:'on_clear',label:'迎战精英'},
    {from:'f1-c2',to:'f1-rest',when:'player_choice',label:'先去休息'},
    {from:'f1-event',to:'f1-rest',when:'player_choice',label:'去休息'},
    {from:'f1-event',to:'f1-shop',when:'player_choice',label:'去商店'},
    {from:'f1-elite',to:'f1-c3',when:'on_clear',label:'汇合前进'},
    {from:'f1-rest',to:'f1-c3',when:'player_choice',label:'汇合前进'},
    {from:'f1-shop',to:'f1-c3',when:'player_choice',label:'汇合前进'},
    {from:'f1-c3',to:'f1-treasure',when:'on_clear',label:'打开宝箱'},
    {from:'f1-treasure',to:'f1-boss',when:'on_clear',label:'层主 Boss'}
  ]
};

module.exports={
  schemaVersion:2,
  runId:'offline-v2-floor1-ajik',
  pathTemplate:'p2_spire_one_floor',
  branching:true,
  title:'V2 尖塔样 · 第 1 层「아직」',
  designNote:'单层 9 房：战斗含 4+ 题，精英 5，Boss 6。预览可走图、扣专注、休息回血；正式会话接线仍待 B。',
  expression:'아직',
  baseMeaning:'还、仍然（still）/ 尚未（not yet）',
  learningGoal:'区分「아직」表示状态仍在，还是目标/动作尚未发生；能借助 이미 对举。',
  unverifiedClaims:['撒娇、冷战、情绪强弱不得作唯一答案'],
  startSongId:'sample-window',
  runRules:{maxHp:5,startingHp:5,labelHp:'专注值',wrongAnswerHpLoss:1,restHeal:1,restHealBonusStory:1},
  characters,relicsCatalog,songs,lines,cards,rooms,graph,
  floors:[{id:'floor-1',name:'第 1 层 · 夜色词径',roomIds:rooms.map(r=>r.id)}],
  provenance:{generator:'design_sample_v2',status:'original',sourceLineIds:lines.map(l=>l.id)},
  needsHumanReview:false
};
