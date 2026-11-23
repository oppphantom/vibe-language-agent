'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  const profileKey=()=> 'vibe-learner-profile:'+($('learningLanguage').value||'ko');
  const recordKey='vibe-learning-records-v1';
  let records={};
  function profile(){
    return {level:$('learnerLevel').value,goal:$('learnerGoal').value,minutes:Number($('learnerMinutes').value)};
  }
  function restoreProfile(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(profileKey())||'{}')||{}}catch{}
    $('learnerLevel').value=['starter','beginner','comfortable'].includes(saved.level)?saved.level:'beginner';
    $('learnerGoal').value=['reading','listening','meaning'].includes(saved.goal)?saved.goal:'listening';
    $('learnerMinutes').value=[5,10,15].includes(saved.minutes)?saved.minutes:10;
  }
  for(const id of ['learnerLevel','learnerGoal','learnerMinutes']){
    $(id).onchange=()=>{
      try{localStorage.setItem(profileKey(),JSON.stringify(profile()));$('learnerStatus').textContent='已保存在当前浏览器，将用于下一次课程。'}
      catch{$('learnerStatus').textContent='浏览器保存失败，本次选择仍可用于生成课程。'}
      document.dispatchEvent(new Event('learner-profile-change'));
    };
  }
  const names={lyrics_to_audio:'给歌词选原声',audio_to_lyrics:'给原声选歌词',context:'语境题',teaching:'教学检查'};
  function render(){
    const entries=Object.values(records).flatMap(session=>session.attempts.map(attempt=>({...attempt,title:session.title})))
      .sort((a,b)=>b.at.localeCompare(a.at));
    const first=entries.filter(item=>item.firstAttempt);
    const correct=first.filter(item=>item.correct).length;
    $('learningRecordSummary').textContent=entries.length?
      '已记录 '+entries.length+' 次作答；首次作答正确 '+correct+'/'+first.length+'。记录保存在当前浏览器。':
      '完成教学检查或地图题后，这里会显示逐题表现。记录保存在当前浏览器。';
    $('learningRecordList').replaceChildren();
    for(const entry of entries.slice(0,100)){
      const row=document.createElement('p');
      const metrics=entry.metrics;
      row.textContent=entry.title+' · '+(entry.stage||'练习')+(entry.targetText?' · '+entry.targetText:'')+' · '+(names[entry.questionType]||entry.questionType)+' · 第 '+entry.attempt+' 次 · '+
        (entry.correct?'答对':'答错')+' · '+new Date(entry.at).toLocaleString()+
        (metrics?' · 本次作答前播放成功 '+metrics.playSuccesses+' 次，失败 '+metrics.playFailures+' 次':' · 未采集播放次数');
      $('learningRecordList').append(row);
    }
  }
  try{
    const saved=JSON.parse(localStorage.getItem(recordKey)||'{}');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
      for(const [id,value] of Object.entries(saved)){
        if(value&&typeof value.title==='string'&&Array.isArray(value.attempts)&&
          value.attempts.every(item=>item&&typeof item.at==='string'&&typeof item.correct==='boolean'))records[id]=value;
      }
    }
  }catch{$('learningRecordStatus').textContent='已有记录读取失败，新记录将在本次学习后尝试保存。'}
  function capture(session){
    if(!session?.id||!Array.isArray(session.history))return;
    const attempts=session.history.filter(item=>item.interaction==='question'||item.interaction==='teaching').map(item=>({
      ...item,questionType:item.questionType||'teaching',firstAttempt:item.firstAttempt??item.attempt===1
    }));
    if(!attempts.length)return;
    const key=item=>item.id||item.nodeId+':'+item.interaction+':'+item.attempt;
    const merged=new Map((records[session.id]?.attempts||[]).map(item=>[key(item),item]));
    for(const item of attempts)merged.set(key(item),item);
    records[session.id]={title:session.courseTitle,profile:session.learnerProfile,attempts:[...merged.values()]};
    try{localStorage.setItem(recordKey,JSON.stringify(records));$('learningRecordStatus').textContent=''}
    catch{$('learningRecordStatus').textContent='记录保存失败，当前页面仍可查看；关闭前请检查浏览器存储。'}
    render();
  }
  document.addEventListener('learning-language-change',restoreProfile);
  restoreProfile();render();
  window.vibeLearning={profile,capture};
})();
