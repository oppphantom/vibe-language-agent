'use strict';

const errorTypes={
  listening:'listening_gap',
  meaning:'context_misread',
  story:'usage_gap',
  culture:'context_overgeneralization',
  rest:'review_gap',
  challenge:'transfer_gap'
};

function evaluateAnswer(node,choice,{nextNode=null}={}) {
  const correct=choice===node.correctIndex;
  const nextAction=correct
    ?nextNode
      ?{type:'continue',nodeId:nextNode.id,reason:`下一站：${nextNode.stage}「${nextNode.title}」`}
      :{type:'complete',nodeId:null,reason:'探索路线已完成；本轮证据和迁移结果已记录。'}
    :{type:'remediate',nodeId:node.id,reason:node.remedial};
  return {
    feedback:{
      verdict:correct?'correct':'retry',
      explanation:correct?node.explanation:'这次选择没有接住当前节点的证据，先按补教提示再看一次。',
      errorType:correct?null:errorTypes[node.type],
      evidenceLineIds:[...node.evidenceLineIds],
      nextAction,
      toolLog:[{tool:'grade_choice',status:'ok',summary:'服务端依据原创课程包核对当前选项；未调用外部模型'}]
    },
    correct
  };
}

function masteryView(course,history,{courseCompleted=false,nodes=course.nodes}={}) {
  const skillOrder=[];
  const skillRecords=new Map();
  for(const node of nodes) {
    if(!skillRecords.has(node.skill)) {
      skillOrder.push(node.skill);
      skillRecords.set(node.skill,[]);
    }
  }
  for(const item of history) {
    const node=nodes.find(candidate=>candidate.id===item.nodeId);
    if(node)skillRecords.get(node.skill).push(item);
  }
  const skills=skillOrder.map(skill=>{
    const records=skillRecords.get(skill);
    const attempts=records.length;
    const errors=records.filter(item=>!item.correct).length;
    const hintsUsed=records.filter(item=>item.hintUsed).length;
    const lastCorrect=attempts>0&&records[records.length-1].correct;
    let status='new';
    if(attempts>0) {
      if(!lastCorrect)status='needs_review';
      else if(courseCompleted)status='mastered';
      else if(errors>0||hintsUsed>0)status='needs_review';
      else status='practicing';
    }
    return {skill,status,attempts,errors,hintsUsed};
  });
  const weakSkills=skills.filter(item=>item.errors>0||item.hintsUsed>0||item.status==='needs_review').map(item=>item.skill);
  let summary;
  if(courseCompleted&&weakSkills.length)summary=`本轮已完成。建议复习：${weakSkills.join('、')}。`;
  else if(courseCompleted)summary='本轮探索路线已完成，未出现需要补教的作答。';
  else if(weakSkills.length)summary=`当前需要回看：${weakSkills.join('、')}。`;
  else if(history.length)summary='当前作答稳定，继续完成后续证据与迁移挑战。';
  else summary='尚未开始作答。';
  return {
    expression:course.targetExpression,
    status:courseCompleted?'mastered':history.length?'practicing':'new',
    summary,
    weakSkills,
    skills
  };
}

module.exports={evaluateAnswer,masteryView};
