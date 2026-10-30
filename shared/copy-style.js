'use strict';
/** Shared bans for prompts and post-generation style warnings. */
const BANNED_SUBSTRINGS=[
  '首先',
  '其次',
  '最后需要指出',
  '值得注意的是',
  '综上所述',
  '在这个语境下我们可以看到',
  '开启学习之旅',
  '义项扫荡',
  '深度剖析',
  '赋能',
  '让我们一起',
  '不难发现'
];

function stylePromptBlock(){
  return [
    '文风：短句，口语，一题一事。',
    '题干点名具体歌词；解释只写句内可推出的理由；补教只说看哪一句哪个词。',
    '禁止：首先/其次、值得注意的是、综上所述、开启学习之旅、义项扫荡、深度剖析、赋能、让我们一起、不难发现。',
    '禁止把未证实的情绪或粉丝梗写成唯一正确答案。',
    '禁止编造输入中不存在的歌词行 id 或原文。'
  ].join('');
}

function collectStyleWarnings(texts){
  const warnings=[];
  const seen=new Set();
  for(const text of texts){
    if(typeof text!=='string'||!text)continue;
    for(const ban of BANNED_SUBSTRINGS){
      if(!text.includes(ban))continue;
      const key=ban+'|'+text.slice(0,48);
      if(seen.has(key))continue;
      seen.add(key);
      warnings.push(`文风：出现「${ban}」← ${text.slice(0,48)}`);
    }
  }
  return warnings;
}

module.exports={BANNED_SUBSTRINGS,stylePromptBlock,collectStyleWarnings};
