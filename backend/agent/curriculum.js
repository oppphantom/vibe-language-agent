'use strict';
const {songs,lines,journeys}=require('../../content/fixtures/demo');
const {normalizeLanguage,languageInfo}=require('../../shared/languages');
const {fail}=require('./errors');
const courses=journeys;
const dynamicCourses=new Map();
const dynamicCourseTtlMs=2*60*60*1000;
const nodeTypes=['listening','meaning','story','culture','rest','challenge'];
const idPattern=/^[a-z0-9][a-z0-9-]{0,99}$/;

function text(value,label,max=1000) {
  if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${label}无效`,'COURSE_INVALID');
  return value.trim();
}

function analyzeMaterial(materialLines,expression) {
  if(!Array.isArray(materialLines))fail('课程材料无效','COURSE_INVALID');
  text(expression,'目标表达',40);
  const normalizedExpression=expression.normalize('NFKC').toLocaleLowerCase();
  const linesWithExpression=materialLines.filter(line=>
    typeof line?.text==='string'&&line.text.normalize('NFKC').toLocaleLowerCase().includes(normalizedExpression)
  );
  return {
    sufficient:linesWithExpression.length>=2,
    expressionHits:linesWithExpression.length,
    timedLines:materialLines.filter(line=>Number.isInteger(line?.startMs)&&Number.isInteger(line?.endMs)).length,
    reason:linesWithExpression.length>=2?'':`目标表达「${expression}」不足两处可引用语境`
  };
}

function validateCourse(course,{
  songCatalog=songs,
  lineCatalog=lines
}={}) {
  if(!course||typeof course!=='object')fail('课程配置不存在','COURSE_INVALID');
  text(course.id,'课程 ID',100);
  if(!idPattern.test(course.id))fail('课程 ID 格式无效','COURSE_INVALID');
  text(course.title,'课程标题',200);
  const language=normalizeLanguage(course.language);
  text(course.targetExpression,'目标表达',40);
  text(course.provenance,'课程来源',300);
  if(!Array.isArray(course.songIds)||!course.songIds.length)fail('课程没有关联歌曲','COURSE_INVALID');
  const songIds=new Set(course.songIds);
  for(const songId of songIds)if(!songCatalog.some(song=>song.id===songId))fail(`课程歌曲「${songId}」不存在`,'COURSE_INVALID');
  for(const song of songCatalog.filter(item=>songIds.has(item.id))) {
    if(song.language!==language)fail('课程语言与关联歌曲语言不一致','COURSE_INVALID');
  }
  if(!Array.isArray(course.nodes)||course.nodes.length!==nodeTypes.length)fail('课程节点数量无效','COURSE_INVALID');

  const lineIds=new Set(lineCatalog.map(line=>line.id));
  const nodeIds=new Set();
  const seenNodeTypes=new Set();
  for(let index=0;index<course.nodes.length;index++){
    const item=course.nodes[index],type=nodeTypes[index];
    if(!item||typeof item!=='object')fail('课程节点无效','COURSE_INVALID');
    text(item.id,'节点 ID',100);
    if(!idPattern.test(item.id)||nodeIds.has(item.id))fail('节点 ID 重复或格式无效','COURSE_INVALID');
    nodeIds.add(item.id);
    if(item.type!==type||seenNodeTypes.has(item.type))fail('六类教学节点缺失或顺序无效','COURSE_INVALID');
    seenNodeTypes.add(item.type);
    text(item.stage,'阶段名称',30);
    text(item.skill,'技能名称',30);
    text(item.title,'节点标题',120);
    text(item.prompt,'节点题面',1000);
    if(!Array.isArray(item.options)||item.options.length<2||item.options.length>3)fail('课程选项数量无效','COURSE_INVALID');
    if(item.options.some(option=>typeof option!=='string'||!option.trim()||option.length>300))fail('课程选项无效','COURSE_INVALID');
    if(!Number.isInteger(item.correctIndex)||item.correctIndex<0||item.correctIndex>=item.options.length)fail('课程答案索引无效','COURSE_INVALID');
    text(item.explanation,'答案说明',1000);
    text(item.remedial,'补教提示',1000);
    if(!item.target||typeof item.target!=='object')fail('课程学习目标无效','COURSE_INVALID');
    if(item.target.expression!==course.targetExpression)fail('节点目标表达与课程不一致','COURSE_INVALID');
    text(item.target.skill,'节点目标技能',30);
    if(!Array.isArray(item.target.prerequisites))fail('前置知识说明无效','COURSE_INVALID');
    if(!Array.isArray(item.evidenceLineIds)||!item.evidenceLineIds.length)fail('节点没有证据行','COURSE_INVALID');
    for(const lineId of item.evidenceLineIds) {
      if(!lineIds.has(lineId))fail(`证据行「${lineId}」不存在`,'COURSE_INVALID');
      const sourceLine=lineCatalog.find(line=>line.id===lineId);
      if(!songIds.has(sourceLine.songId))fail('证据行不属于课程歌曲','COURSE_INVALID');
    }
    const expectedPrerequisite=index===0?null:course.nodes[index-1].id;
    if(item.prerequisiteNodeId!==expectedPrerequisite)fail('节点前置关系无效','COURSE_INVALID');
  }
  const analysis=analyzeMaterial(lineCatalog.filter(line=>songIds.has(line.songId)),course.targetExpression);
  if(!analysis.sufficient)fail(analysis.reason,'COURSE_INVALID');
  return course;
}

function getCourse(songId) {
  if(typeof songId!=='string'||!songId.trim()||songId.length>100)fail('歌曲 ID 无效');
  const course=courses.find(item=>item.songIds.includes(songId));
  if(!course)fail('这首歌还没有可审查的教学课程','NOT_FOUND');
  validateCourse(course);
  return course;
}

function pruneDynamicCourses() {
  const now=Date.now();
  for(const [courseId,record] of dynamicCourses)if(record.expiresAt<=now)dynamicCourses.delete(courseId);
}

function getCourseById(courseId) {
  if(typeof courseId!=='string'||!courseId.trim()||courseId.length>120)fail('课程 ID 无效');
  pruneDynamicCourses();
  const record=dynamicCourses.get(courseId);
  if(record)return record.course;
  const course=courses.find(item=>item.id===courseId);
  if(!course)fail('课程不存在或已过期','NOT_FOUND');
  validateCourse(course);
  return course;
}

function registerCourse(course,{songCatalog,lineCatalog}={}) {
  pruneDynamicCourses();
  if(!Array.isArray(songCatalog)||!Array.isArray(lineCatalog))fail('动态课程材料无效','COURSE_INVALID');
  validateCourse(course,{songCatalog,lineCatalog});
  const stored={...course};
  Object.defineProperty(stored,'materials',{
    value:{
      songs:songCatalog.map(song=>({...song,source:{...song.source},...(song.audio?{audio:{...song.audio}}:{})})),
      lines:lineCatalog.map(line=>({...line,source:{...line.source}}))
    },
    enumerable:false
  });
  dynamicCourses.set(stored.id,{course:stored,expiresAt:Date.now()+dynamicCourseTtlMs});
  return stored;
}

function materialForCourse(course) {
  return course.materials||{songs,lines};
}

function publicMaterial(course) {
  const material=materialForCourse(course);
  return {
    songs:material.songs.filter(song=>course.songIds.includes(song.id)).map(song=>({
      ...song,languageLabel:languageInfo(song.language).label,source:{...song.source},
      ...(song.audio?{audio:{...song.audio}}:{})
    })),
    lines:material.lines.filter(line=>course.songIds.includes(line.songId)).map(line=>({...line,source:{...line.source}}))
  };
}

function nodeStatus(course,nodeId,completedNodeIds,currentIndex) {
  if(completedNodeIds.has(nodeId))return 'completed';
  if(course.nodes[currentIndex]?.id===nodeId)return 'active';
  return 'locked';
}

function publicMap(course,completedNodeIds,currentIndex) {
  return course.nodes.map(item=>({
    id:item.id,
    type:item.type,
    stage:item.stage,
    title:item.title,
    skill:item.skill,
    evidenceCount:item.evidenceLineIds.length,
    status:nodeStatus(course,item.id,completedNodeIds,currentIndex)
  }));
}

function publicNode(course,item,status) {
  const material=publicMaterial(course);
  const evidence=material.lines.filter(line=>item.evidenceLineIds.includes(line.id));
  return {
    id:item.id,
    type:item.type,
    stage:item.stage,
    title:item.title,
    language:course.language,
    languageLabel:languageInfo(course.language).label,
    target:item.target,
    prompt:item.prompt,
    options:[...item.options],
    material,
    evidence,
    status,
    provenance:`${course.provenance}；非实时 Agent 生成，标准答案保留在服务端`
  };
}

function nodeById(course,nodeId) {
  return course.nodes.find(item=>item.id===nodeId)||null;
}

module.exports={
  analyzeMaterial,
  validateCourse,
  getCourse,
  getCourseById,
  registerCourse,
  publicMap,
  publicNode,
  nodeById,
  nodeStatus
};
