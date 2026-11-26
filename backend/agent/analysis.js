'use strict';
const {validateSong,validateLine,validateLearnerProfile}=require('../../shared/contract');
const normalize=text=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function analyzeSong(input){
  const song=validateSong(input?.song),profile=validateLearnerProfile(input.profile);
  if(!Array.isArray(input.lines)||input.lines.length>3000)throw Error('歌词材料无效');
  const targetScript={ko:/\p{Script=Hangul}/u,ja:/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u}[song.language];
  const seen=new Set();
  const lines=input.lines.map(validateLine).filter(line=>{
    if(line.songId!==song.id)throw Error('歌词行不属于当前歌曲');
    if(seen.has(line.id))return false;
    seen.add(line.id);return true;
  });
  const counts=new Map();
  for(const line of lines){
    const key=normalize(line.text);
    counts.set(key,(counts.get(key)||0)+1);
  }
  const fragments=lines.map((line,index)=>{
    const key=normalize(line.text),characters=[...key].length;
    const durationMs=Number.isInteger(line.startMs)&&Number.isInteger(line.endMs)?line.endMs-line.startMs:null;
    const playable=durationMs>0&&line.endMs<=song.durationMs&&characters>0;
    const containsTargetScript=targetScript.test(line.text);
    const mixedScript=/[A-Za-z]/.test(line.text)&&/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line.text);
    const density=playable?Math.round(characters*1000/durationMs*10)/10:null;
    const repeats=counts.get(key);
    const reasons=[];
    if(characters<=18)reasons.push('句子较短，适合逐句拆读');
    if(repeats>1)reasons.push('相同文本出现 '+repeats+' 次，可在重复段回听');
    if(mixedScript)reasons.push('含拉丁字母与东亚文字，学习时留意混用部分');
    if(profile.goal==='meaning'&&index>0&&index<lines.length-1)reasons.push('前后句完整，可结合上下文理解');
    if(!playable)reasons.push('缺少有效播放区间，仅供阅读');
    if(!reasons.length)reasons.push('可结合词块提示回听整句');
    const score=characters*(profile.level==='starter'?2:1)+(density||0)*
      (profile.goal==='listening'?5:2)+(mixedScript?15:0)-Math.min(repeats,4)*5-
      (profile.goal==='meaning'&&index>0&&index<lines.length-1?15:0);
    return {lineId:line.id,containsTargetScript,characters,durationMs,textDensity:density,repeats,mixedScript,playable,reasons,score};
  });
  const selected=new Set();
  const recommended=fragments.filter(item=>item.playable&&item.containsTargetScript).sort((a,b)=>a.score-b.score).filter(item=>{
    const key=normalize(lines.find(line=>line.id===item.lineId).text);
    if(selected.has(key))return false;
    selected.add(key);return true;
  }).slice(0,profile.minutes===5?2:profile.minutes===10?3:5).map(item=>item.lineId);
  return {songId:song.id,profile,lineCount:lines.length,
    recommendedLineIds:recommended,fragments:fragments.map(({score,...item})=>item),
    basis:'依据歌词文本和句级时间戳；文字密度是粗略参考，发音与人声清晰度尚未分析。'};
}
module.exports={analyzeSong};
