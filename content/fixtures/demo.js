'use strict';
// 原创教学文本与虚构曲目；不包含商业歌词、音源或成员资料库内容。
const songs=[
  {id:'demo-morning',title:'清晨的约定',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-return',title:'再见的路口',artist:'VIBE 原创教学样例',language:'ko',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-jp-morning',title:'朝の再会',artist:'VIBE 原创教学样例',language:'ja',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创日语教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-jp-rain',title:'雨のあと',artist:'VIBE 原创教学样例',language:'ja',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创日语教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-zh-platform',title:'站台的再见',artist:'VIBE 原创教学样例',language:'zh',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创中文教学文本'},audio:{available:false,reason:'未附可授权音源'}},
  {id:'demo-zh-next',title:'下次的约定',artist:'VIBE 原创教学样例',language:'zh',version:'demo-v1',durationMs:30000,source:{kind:'original_demo',label:'原创中文教学文本'},audio:{available:false,reason:'未附可授权音源'}}
];
const row=(songId,n,text,startMs,endMs)=>({id:`${songId}-${n}`,songId,text,startMs,endMs,source:{kind:'original_demo',label:'原创教学文本'},reviewStatus:'original'});
const lines=[
  row('demo-morning',1,'오늘 아침에 너를 만났어.',1000,4500),
  row('demo-morning',2,'우리 다시 걸어 볼까?',5000,8500),
  row('demo-morning',3,'처음처럼 웃어 줘.',9000,12500),
  row('demo-return',1,'어제는 말하지 못했어.',1000,4500),
  row('demo-return',2,'내일 다시 이야기하자.',5000,8500),
  row('demo-return',3,'이번에는 솔직하게 말할게.',9000,12500),
  row('demo-jp-morning',1,'今日の朝、また君に会えた。',1000,4500),
  row('demo-jp-morning',2,'雨のあとも、また歩こうか。',5000,8500),
  row('demo-jp-morning',3,'昨日は言えなかったことを、明日また話そう。',9000,12500),
  row('demo-jp-rain',1,'駅の前で、また手を振った。',1000,4500),
  row('demo-jp-rain',2,'次の春も、またここで待ってる。',5000,8500),
  row('demo-jp-rain',3,'言えなかった気持ちを、今度は届けよう。',9000,12500),
  row('demo-zh-platform',1,'清晨的站台，我们再次见面。',1000,4500),
  row('demo-zh-platform',2,'雨停之后，再见时再一起走吧。',5000,8500),
  row('demo-zh-platform',3,'昨天没说完的话，留到下一次见面。',9000,12500),
  row('demo-zh-next',1,'上一次告别时，我们说好还会回来。',1000,4500),
  row('demo-zh-next',2,'今天的再见，不是结束。',5000,8500),
  row('demo-zh-next',3,'下次再见，我会把没说完的话讲完。',9000,12500)
];
const lesson={
  id:'demo-dasi',type:'context_choice',target:{expression:'다시',skill:'语境理解',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['知道 다시 的基本义：再次、重新']},
  prompt:'在第二首的「내일 다시 이야기하자」里，「다시」强调什么？',
  options:['明天再次谈这件事','从未说过这件事','今天立刻结束谈话'],
  correctIndex:0,
  explanation:'「내일」是明天，「이야기하자」是一起谈谈；「다시」让这次谈话与之前未说出口的事相连。',
  remedial:'先看上一句「어제는 말하지 못했어」（昨天没能说出口），再读「내일 다시 이야기하자」（明天再谈吧）。试着找出昨天与明天的联系。'
};
const journey={
  id:'demo-dasi-journey',
  title:'다시：让未完成的事重新发生',
  language:'ko',
  targetExpression:'다시',
  teaching:{reading:'다-시（da-si）',meaning:'再次、重新；把当前行动与之前发生或未完成的行动连接起来',translations:{
    'demo-morning-2':'我们要不要再一起走走？','demo-return-1':'昨天没能说出口。','demo-return-2':'明天我们再聊吧。'
  }},
  songIds:['demo-morning','demo-return'],
  provenance:'原创教学课程包；固定内容，可在离线环境完整验证',
  nodes:[
    {
      id:'demo-dasi-listen',type:'listening',stage:'听辨',skill:'听辨定位',title:'找到重复的落点',
      target:{expression:'다시',skill:'听辨定位',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:[]},
      prompt:'样例没有授权音源，先做文字定位。两首歌里的「다시」分别紧挨着什么动作？',
      options:['两次都紧挨着一个共同行动','两次都紧挨着「만났어」','两次都紧挨着「웃어 줘」'],
      correctIndex:0,
      explanation:'第一首的「걸어 볼까」是“走一走吧”，第二首的「이야기하자」是“谈一谈吧”；「다시」都放在共同行动前。',
      remedial:'暂时别看三句全句。先只找每首歌的第二句，再找「다시」后面紧跟着的动作词。',
      evidenceLineIds:['demo-morning-2','demo-return-2'],
      prerequisiteNodeId:null
    },
    {
      id:lesson.id,type:'meaning',stage:'含义',skill:'语境推断',title:'连接昨天和明天',
      target:lesson.target,prompt:lesson.prompt,options:lesson.options,correctIndex:lesson.correctIndex,
      explanation:lesson.explanation,remedial:lesson.remedial,evidenceLineIds:lesson.target.evidenceLineIds,
      prerequisiteNodeId:'demo-dasi-listen'
    },
    {
      id:'demo-dasi-story',type:'story',stage:'剧情',skill:'情境运用',title:'替人物把话接下去',
      target:{expression:'다시',skill:'情境运用',evidenceLineIds:['demo-return-1','demo-return-2'],prerequisites:['理解 다시 表示“再次、重新”']},
      prompt:'朋友昨天没能把话说完，现在说「내일 다시 이야기하자」。哪一句回应既承认过去，也约好下一次行动？',
      options:['좋아, 내일 다시 이야기하자.','오늘 처음 이야기하자.','내일은 이야기하지 말자.'],
      correctIndex:0,
      explanation:'「좋아」表示接受，「내일」承接下一次时间，「다시 이야기하자」保留“再谈”的共同行动。',
      remedial:'先圈出回应里的时间词。原句约的是“明天”，回应也需要延续明天与“再谈”，不能改成“今天第一次”或“不要谈”。',
      evidenceLineIds:['demo-return-1','demo-return-2'],
      prerequisiteNodeId:'demo-dasi'
    },
    {
      id:'demo-dasi-culture',type:'culture',stage:'文化',skill:'文化解读',title:'只说到歌词能支持的地方',
      target:{expression:'다시',skill:'文化解读',evidenceLineIds:['demo-morning-2','demo-return-1','demo-return-2'],prerequisites:['能区分句子事实与额外推断']},
      prompt:'歌词里有「우리 다시 걸어 볼까」。哪一种解读最稳妥，没有超出材料？',
      options:['说话者把重新走一走呈现为双方共同参与的可能','这说明韩国人的关系都会马上和解','这证明两个人已经正式复合'],
      correctIndex:0,
      explanation:'「우리」明确把行动写成“我们”的共同可能，但歌词没有说明冲突内容、对方是否答应或关系最终结果。',
      remedial:'把“材料写出了什么”和“我们猜发生了什么”分开。只保留「우리」与「다시」共同指向邀请这一条。',
      evidenceLineIds:['demo-morning-2','demo-return-1','demo-return-2'],
      prerequisiteNodeId:'demo-dasi-story'
    },
    {
      id:'demo-dasi-rest',type:'rest',stage:'休息',skill:'证据复盘',title:'停一下，回看证据',
      target:{expression:'다시',skill:'证据复盘',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['完成听辨、含义、剧情与文化节点']},
      prompt:'哪一组证据最能支持“之前没完成，之后再做”？',
      options:['「어제는 말하지 못했어」与「내일 다시 이야기하자」','「오늘 아침에 너를 만났어」与「처음처럼 웃어 줘」','「이번에는 솔직하게 말할게」与「내일 다시 이야기하자」'],
      correctIndex:0,
      explanation:'前一句交代“昨天没能说”，后一句提出“明天再谈”。两处时间与行动共同形成“未完成，再尝试”。',
      remedial:'找一对包含“没有做到”和“再次去做”的句子。第一组同时有昨天没说出、明天再谈两层信息。',
      evidenceLineIds:['demo-morning-2','demo-return-2'],
      prerequisiteNodeId:'demo-dasi-culture'
    },
    {
      id:'demo-dasi-challenge',type:'challenge',stage:'最终挑战',skill:'表达迁移',title:'在新句子里带走 다시',
      target:{expression:'다시',skill:'表达迁移',evidenceLineIds:['demo-morning-2','demo-return-2'],prerequisites:['完成本轮五个节点']},
      prompt:'第一次看到这句话：다음 주에 다시 만나자. 这里的「다시」最自然提示了什么？',
      options:['之前已有见面，之后约定再见','两人从未见过面','见面时间就在今天早上'],
      correctIndex:0,
      explanation:'「다음 주」是下周，「만나자」是见面吧；「다시」把下周的见面与之前已经发生过的见面连接起来。',
      remedial:'先不看「다시」，读「다음 주에 만나자」得到“下周见面吧”。再想「다시」为什么会让这次见面和以前产生关系。',
      evidenceLineIds:['demo-morning-2','demo-return-2'],
      prerequisiteNodeId:'demo-dasi-rest'
    }
  ]
};
const japaneseJourney={
  id:'demo-ja-mata-journey',
  title:'また：让共同行动再次发生',
  language:'ja',
  targetExpression:'また',
  teaching:{reading:'ま-た（ma-ta）',meaning:'又、再次；表示相同或相关的事情再发生',translations:{
    'demo-jp-morning-2':'雨停之后，我们也再一起走走吧。','demo-jp-morning-3':'昨天没能说出口的事，明天再说吧。','demo-jp-rain-2':'下一个春天，我也会再在这里等你。'
  }},
  songIds:['demo-jp-morning','demo-jp-rain'],
  provenance:'原创日语教学课程包；固定内容，可在离线环境完整验证',
  nodes:[
    {
      id:'demo-ja-mata-listen',type:'listening',stage:'听辨',skill:'听辨定位',title:'找到重复出现的また',
      target:{expression:'また',skill:'听辨定位',evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisites:[]},
      prompt:'样例没有授权音源，先做文字定位。两首歌里的「また」分别和什么行动放在一起？',
      options:['一起走一走、继续等待的计划','已经结束的告别','从未发生的见面'],correctIndex:0,
      explanation:'「歩こう」是“走吧、走一走吧”，「待ってる」是“在等待”；「また」都让这个行动带有再次发生的意味。',
      remedial:'先只看每首歌的第二句，把「また」遮住。读出剩余动作是“继续走”还是“继续等待”。',
      evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisiteNodeId:null
    },
    {
      id:'demo-ja-mata-meaning',type:'meaning',stage:'含义',skill:'语境推断',title:'昨天没说完，明天再说',
      target:{expression:'また',skill:'语境推断',evidenceLineIds:['demo-jp-morning-3'],prerequisites:['知道 また 的基本义：再次、又']},
      prompt:'「昨日は言えなかったことを、明日また話そう」里的「また」强调什么？',
      options:['昨天没说完的内容，明天再谈','今天第一次见面','以后永远不再谈'],correctIndex:0,
      explanation:'「昨日は言えなかった」交代未完成的谈话，「明日」与「また」把未完成的内容连接到下一次。',
      remedial:'找句中的两个时间词「昨日」和「明日」，再确认「言えなかった」表示“昨天没能说”。',
      evidenceLineIds:['demo-jp-morning-3'],prerequisiteNodeId:'demo-ja-mata-listen'
    },
    {
      id:'demo-ja-mata-story',type:'story',stage:'剧情',skill:'情境运用',title:'替朋友接住下一次约定',
      target:{expression:'また',skill:'情境运用',evidenceLineIds:['demo-jp-morning-3','demo-jp-rain-2'],prerequisites:['理解 また 连接同一种行动的再次发生']},
      prompt:'朋友说「明日また話そう」。哪一句回应既接受明天，也保留再次交谈？',
      options:['うん、明日また話そう。','今日は初めて話そう。','もう二度と話さないでおこう。'],correctIndex:0,
      explanation:'「うん」表示接受，「明日また話そう」延续同一时间与“再谈”的提议。',
      remedial:'原句约的是“明天”和“再谈”。回应也要同时保留这两个信息，不能改成今天第一次或以后不谈。',
      evidenceLineIds:['demo-jp-morning-3','demo-jp-rain-2'],prerequisiteNodeId:'demo-ja-mata-meaning'
    },
    {
      id:'demo-ja-mata-culture',type:'culture',stage:'文化',skill:'文化解读',title:'别把邀请推断成结局',
      target:{expression:'また',skill:'文化解读',evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisites:['能区分歌词事实与额外推断']},
      prompt:'从「また歩こうか」「またここで待ってる」能得出哪项最稳妥的结论？',
      options:['歌词把再次一起行动或再见面的可能写成共同期待','所有日本人都用同一种方式修复关系','两人已经立刻复合'],correctIndex:0,
      explanation:'两个句子都表达未来再次行动的可能，但材料没有交代矛盾、对方是否接受或关系结果。',
      remedial:'只保留句子里明确写着的时间与行动。把“可能再见面”与“已经复合”分开。',
      evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisiteNodeId:'demo-ja-mata-story'
    },
    {
      id:'demo-ja-mata-rest',type:'rest',stage:'休息',skill:'证据复盘',title:'停一下，比对再次行动',
      target:{expression:'また',skill:'证据复盘',evidenceLineIds:['demo-jp-morning-3','demo-jp-rain-2'],prerequisites:['完成听辨、含义、剧情与文化节点']},
      prompt:'哪一组证据最能支持“这次没完成，以后再次进行”？',
      options:['「昨日は言えなかった」与「明日また話そう」','「駅の前で、また手を振った」与「次の春も、またここで待ってる」','「雨のあとも、また歩こうか」与「今度は届けよう」'],correctIndex:0,
      explanation:'第一组明确出现“昨天没能说”和“明天再谈”，其他组更多是反复出现或未来行动。',
      remedial:'寻找同时包含“未完成”和“以后再做”的一组，而不是只出现两个未来动作的句子。',
      evidenceLineIds:['demo-jp-morning-3','demo-jp-rain-2'],prerequisiteNodeId:'demo-ja-mata-culture'
    },
    {
      id:'demo-ja-mata-challenge',type:'challenge',stage:'最终挑战',skill:'表达迁移',title:'把また带进新邀请',
      target:{expression:'また',skill:'表达迁移',evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisites:['完成本轮五个节点']},
      prompt:'第一次看到这句话：来週、また会いましょう。这里的「また」最自然提示了什么？',
      options:['之前见过，之后约定再见面','两人从未见过面','见面已经结束且不会再有下一次'],correctIndex:0,
      explanation:'「来週」是下周，「会いましょう」是见面吧；「また」把下周的见面与之前的见面连接起来。',
      remedial:'先不看「また」读「来週、会いましょう」，得到“下周见面吧”。再想「また」如何让这次见面和以前产生关系。',
      evidenceLineIds:['demo-jp-morning-2','demo-jp-rain-2'],prerequisiteNodeId:'demo-ja-mata-rest'
    }
  ]
};
const chineseJourney={
  id:'demo-zh-zaijian-journey',
  title:'再见：告别之后仍留重逢可能',
  language:'zh',
  targetExpression:'再见',
  teaching:{reading:'zài jiàn',meaning:'告别时使用，也可从字面指向“再次见面”',translations:{
    'demo-zh-platform-2':'雨停之后，再见时再一起走吧。','demo-zh-next-1':'上一次告别时，我们说好还会回来。','demo-zh-next-3':'下次再见，我会把没说完的话讲完。'
  }},
  songIds:['demo-zh-platform','demo-zh-next'],
  provenance:'原创中文教学课程包；固定内容，可在离线环境完整验证',
  nodes:[
    {
      id:'demo-zh-zaijian-listen',type:'listening',stage:'听辨',skill:'听辨定位',title:'从位置找到再见',
      target:{expression:'再见',skill:'听辨定位',evidenceLineIds:['demo-zh-platform-2','demo-zh-next-3'],prerequisites:[]},
      prompt:'样例没有授权音源，先做文字定位。两首歌里的「再见」分别靠近什么时间或行动？',
      options:['再见时再一起走；下次再见再讲完','第一次见面的路上；立刻转身离开','昨天没说出口；从此不再见面'],correctIndex:0,
      explanation:'「再见时再一起走吧」与「下次再见」都把“再见”和之后共同行动连接起来。',
      remedial:'只看含「再见」的句子，圈出后面的“一起走”或“讲完”这两个行动。',
      evidenceLineIds:['demo-zh-platform-2','demo-zh-next-3'],prerequisiteNodeId:null
    },
    {
      id:'demo-zh-zaijian-meaning',type:'meaning',stage:'含义',skill:'语境推断',title:'今天的告别不是终点',
      target:{expression:'再见',skill:'语境推断',evidenceLineIds:['demo-zh-next-1','demo-zh-next-2'],prerequisites:['知道 再见 可作为告别语']},
      prompt:'「今天的再见，不是结束」在这组歌词里最接近什么意思？',
      options:['这是一次告别，但歌词仍保留以后重逢的可能','今天没有发生任何告别','说话者正在第一次见面'],correctIndex:0,
      explanation:'前一句说“说好还会回来”，后一句说“再见不是结束”；告别与未来重逢同时成立。',
      remedial:'先重读上一句“说好还会回来”，再判断「不是结束」是在否定这次关系，还是否定未来重逢。',
      evidenceLineIds:['demo-zh-next-1','demo-zh-next-2'],prerequisiteNodeId:'demo-zh-zaijian-listen'
    },
    {
      id:'demo-zh-zaijian-story',type:'story',stage:'剧情',skill:'情境运用',title:'把告别接成约定',
      target:{expression:'再见',skill:'情境运用',evidenceLineIds:['demo-zh-next-1','demo-zh-next-3'],prerequisites:['理解再见既可告别也可指向下一次见面']},
      prompt:'朋友说「明天再见」。哪一句回应既接受当下告别，也保留明天重逢？',
      options:['好，明天再见。','今天第一次见。','以后永远不再见。'],correctIndex:0,
      explanation:'「好」接受约定，「明天再见」同时包含告别与明天重逢。',
      remedial:'回应需要保留原句中的“明天”和“再次见面”，不能改成第一次见面或永远不再见。',
      evidenceLineIds:['demo-zh-next-1','demo-zh-next-3'],prerequisiteNodeId:'demo-zh-zaijian-meaning'
    },
    {
      id:'demo-zh-zaijian-culture',type:'culture',stage:'文化',skill:'文化解读',title:'告别语不等于关系结论',
      target:{expression:'再见',skill:'文化解读',evidenceLineIds:['demo-zh-next-2','demo-zh-next-3'],prerequisites:['能区分语言功能与人物关系事实']},
      prompt:'「今天的再见，不是结束」能支持哪项解读？',
      options:['这里的再见既是告别，也表达以后重逢的期待','所有说再见的人都会马上复合','这句话证明两个人从未认识'],correctIndex:0,
      explanation:'句子明确把告别与“不是结束”并置，但没有说明人物最终是否复合或关系将如何发展。',
      remedial:'只保留句子明确表达的功能：告别之后仍有重逢期待，不补充人物最终结局。',
      evidenceLineIds:['demo-zh-next-2','demo-zh-next-3'],prerequisiteNodeId:'demo-zh-zaijian-story'
    },
    {
      id:'demo-zh-zaijian-rest',type:'rest',stage:'休息',skill:'证据复盘',title:'停一下，找重逢线索',
      target:{expression:'再见',skill:'证据复盘',evidenceLineIds:['demo-zh-next-1','demo-zh-next-3'],prerequisites:['完成听辨、含义、剧情与文化节点']},
      prompt:'哪一组证据最能支持“先告别，之后还会再见”？',
      options:['「说好还会回来」与「下次再见，我会把没说完的话讲完」','「清晨的站台」与「雨停之后」','「昨天没说完的话」与「下一次见面」'],correctIndex:0,
      explanation:'第一组同时出现过去的约定与未来的再见，还具体说明下次要完成的事。',
      remedial:'寻找同时出现“过去约定”和“未来再见”的一组，而不是只有时间或地点。',
      evidenceLineIds:['demo-zh-next-1','demo-zh-next-3'],prerequisiteNodeId:'demo-zh-zaijian-culture'
    },
    {
      id:'demo-zh-zaijian-challenge',type:'challenge',stage:'最终挑战',skill:'表达迁移',title:'在新句子里使用再见',
      target:{expression:'再见',skill:'表达迁移',evidenceLineIds:['demo-zh-platform-2','demo-zh-next-3'],prerequisites:['完成本轮五个节点']},
      prompt:'第一次看到这句话：下个月再见。这里的「再见」最自然提示了什么？',
      options:['先告别，并约定下个月再见面','两人下个月第一次认识','这次见面永远不可能结束'],correctIndex:0,
      explanation:'「下个月」给出未来时间，「再见」既有告别功能，也把下一次见面作为约定。',
      remedial:'先读「下个月」，得到未来时间；再想「再见」中的“再”与“见”如何组成下一次见面。',
      evidenceLineIds:['demo-zh-platform-2','demo-zh-next-3'],prerequisiteNodeId:'demo-zh-zaijian-rest'
    }
  ]
};
const journeys=[journey,japaneseJourney,chineseJourney];
module.exports={songs,lines,lesson,journey,japaneseJourney,chineseJourney,journeys};
