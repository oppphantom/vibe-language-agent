'use strict';
// Original teaching text and fictional tracks; no commercial lyrics or music.
// Path: 语境关 → 对照语境关 → 最终挑战；答错同节点补教（见 docs/lessons/dasi-path.md）.
// P1 prelude fields: personaId, morphologyNote, contrastAxis, transfer — see AGENT_OUTPUT_SPEC.md.
const songs=[
  {id:'demo-morning',title:'清晨的约定',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-return',title:'再见的路口',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-retry',title:'再试一次',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:20000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}}
];
const row=(songId,n,text,startMs,endMs)=>({id:`${songId}-${n}`,songId,text,startMs,endMs,source:{kind:'original_demo',label:'原创教学文本'},reviewStatus:'original'});
const lines=[
  row('demo-morning',1,'오늘 아침에 너를 만났어.',1000,4500),
  row('demo-morning',2,'우리 다시 걸어 볼까?',5000,8500),
  row('demo-morning',3,'처음처럼 웃어 줘.',9000,12500),
  row('demo-return',1,'어제는 말하지 못했어.',1000,4500),
  row('demo-return',2,'내일 다시 이야기하자.',5000,8500),
  row('demo-return',3,'이번에는 솔직하게 말할게.',9000,12500),
  row('demo-retry',1,'시험은 어려웠지만, 다시 볼게.',1000,5000),
  row('demo-retry',2,'포기하지 마.',5500,8500)
];
const morphologyNote='本关依据连续字符命中「다시」，未做韩语词形分析；命中≠义项已变。';
const lessons=[
  {
    id:'demo-dasi',
    mapNode:'context',
    personaId:'polysemy_tutor',
    type:'context_choice',
    morphologyNote,
    target:{expression:'다시',skill:'语境理解',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['知道 다시 的基本义：再次、重新']},
    contrastAxis:'再次是否连接到「未说出口 → 明天再谈」这一事件链',
    prompt:'在第二首的「내일 다시 이야기하자」里，「다시」强调什么？',
    options:['明天再次谈这件事','从未说过这件事','今天立刻结束谈话'],
    correctIndex:0,
    explanation:'「내일」是明天，「이야기하자」是一起谈谈；「다시」让这次谈话与之前未说出口的事相连。',
    remedial:'先看上一句「어제는 말하지 못했어」（昨天没能说出口），再读「내일 다시 이야기하자」（明天再谈吧）。试着找出昨天与明天的联系。',
    cardIds:[]
  },
  {
    id:'demo-dasi-contrast',
    mapNode:'context',
    personaId:'polysemy_tutor',
    type:'context_choice',
    morphologyNote,
    target:{expression:'다시',skill:'跨语境对照',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['完成 demo-dasi：能指出「다시」连接前后事件']},
    contrastAxis:'再次的事件类型：再试走路 vs 再谈未说完的话',
    prompt:'比较「우리 다시 걸어 볼까?」和「내일 다시 이야기하자」：两句里的「다시」分别连着怎样的再次？',
    options:['再一起走路试试 / 再谈一次（未说完的事）','两句都只表示「立刻结束」','两句都表示「第一次见面」'],
    correctIndex:0,
    explanation:'第一首「다시 걸어」是提议再试一次走路；第二首「다시 이야기」是把未说出口的话放到明天再谈。同是「再次」，所连事件不同。',
    remedial:'并排看两句：一句的动词是「걸어 볼까」（要不要走走看），一句是「이야기하자」（一起谈）。问自己：再次的是哪一件事？',
    cardIds:[]
  },
  {
    id:'demo-dasi-final',
    mapNode:'final_challenge',
    personaId:'polysemy_tutor',
    type:'context_choice',
    transfer:true,
    morphologyNote,
    target:{expression:'다시',skill:'语境迁移',evidenceLineIds:['demo-retry-1'],prerequisites:['完成对照关：能区分「다시」所连接的事件类型']},
    prompt:'新句子「시험은 어려웠지만, 다시 볼게。」里，「다시」最合理的理解是？',
    options:['会再考一次 / 再看一次这科考试','考试已经永远结束，不再尝试','这句话在说第一次见到朋友'],
    correctIndex:0,
    explanation:'「시험」是考试，「볼게」是（我会）看/考；「다시」表示在觉得难之后仍要再来一次。不必推断情绪强弱——文本只支持「再次应试/再看」这一层。',
    remedial:'圈出「시험」和「볼게」，再看「다시」插在中间时，重复的是哪个动作。忽略未写出的心情形容词。',
    cardIds:[]
  }
];
const route=lessons.map(lesson=>lesson.id);
const lessonById=Object.fromEntries(lessons.map(lesson=>[lesson.id,lesson]));
module.exports={songs,lines,lessons,route,lessonById,lesson:lessons[0]};
