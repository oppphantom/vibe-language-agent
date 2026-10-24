'use strict';
// Original teaching text and fictional tracks; no commercial lyrics or music.
const songs=[
  {id:'demo-morning',title:'清晨的约定',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-return',title:'再见的路口',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}}
];
const row=(songId,n,text,startMs,endMs)=>({id:`${songId}-${n}`,songId,text,startMs,endMs,source:{kind:'original_demo',label:'原创教学文本'},reviewStatus:'original'});
const lines=[
  row('demo-morning',1,'오늘 아침에 너를 만났어.',1000,4500),
  row('demo-morning',2,'우리 다시 걸어 볼까?',5000,8500),
  row('demo-morning',3,'처음처럼 웃어 줘.',9000,12500),
  row('demo-return',1,'어제는 말하지 못했어.',1000,4500),
  row('demo-return',2,'내일 다시 이야기하자.',5000,8500),
  row('demo-return',3,'이번에는 솔직하게 말할게.',9000,12500)
];
const lesson={
  id:'demo-dasi',type:'context_choice',target:{expression:'다시',skill:'语境理解',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['知道 다시 的基本义：再次、重新']},
  prompt:'在第二首的「내일 다시 이야기하자」里，「다시」强调什么？',
  options:['明天再次谈这件事','从未说过这件事','今天立刻结束谈话'],
  correctIndex:0,
  explanation:'「내일」是明天，「이야기하자」是一起谈谈；「다시」让这次谈话与之前未说出口的事相连。',
  remedial:'先看上一句「어제는 말하지 못했어」（昨天没能说出口），再读「내일 다시 이야기하자」（明天再谈吧）。试着找出昨天与明天的联系。'
};
module.exports={songs,lines,lesson};
