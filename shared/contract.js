'use strict';
const {normalizeLanguage,languageInfo}=require('./languages');
const VERSION = 2;
const fail = (message) => { throw Object.assign(new Error(message), {code:'INVALID_INPUT'}); };
const bounded = (value, label, max=200) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail(label + '无效');
function validateLine(line) {
  if (!line || typeof line !== 'object') fail('歌词行无效');
  const id = bounded(line.id, '行 ID', 100);
  const songId = bounded(line.songId, '歌曲 ID', 100);
  const text = bounded(line.text, '歌词', 500);
  const startMs = line.startMs, endMs = line.endMs;
  if (startMs !== null && (!Number.isInteger(startMs) || startMs < 0)) fail('开始时间无效');
  if (endMs !== null && (!Number.isInteger(endMs) || endMs <= startMs)) fail('结束时间无效');
  if (startMs === null && endMs !== null) fail('没有开始时间时不能有结束时间');
  if (!['original_demo','lrclib','netease','qqmusic','manual_review'].includes(line.source?.kind)) fail('来源无效');
  if (!['verified','unverified','original'].includes(line.reviewStatus)) fail('核对状态无效');
  return {id,songId,text,startMs,endMs,source:line.source,reviewStatus:line.reviewStatus};
}
function validateAnswer(input) {
  if (!input || typeof input !== 'object') fail('答案无效');
  const sessionId=bounded(input.sessionId,'会话 ID',100), nodeId=bounded(input.nodeId,'节点 ID',100);
  const submissionId=bounded(input.submissionId,'重复提交 ID',100);
  if (!Number.isInteger(input.choice) || input.choice < 0 || input.choice > 2) fail('请选择一个选项');
  if (!Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt > 1000) fail('尝试次数无效');
  return {sessionId,nodeId,submissionId,choice:input.choice,attempt:input.attempt,hintUsed:input.hintUsed===true};
}
function validateMove(input) {
  if (!input || typeof input !== 'object') fail('移动请求无效');
  const sessionId=bounded(input.sessionId,'会话 ID',100), nodeId=bounded(input.nodeId,'节点 ID',100);
  const submissionId=bounded(input.submissionId,'重复提交 ID',100);
  if (!['up','down','left','right'].includes(input.direction)) fail('移动方向无效');
  return {sessionId,nodeId,submissionId,direction:input.direction};
}
function validateRespond(input) {
  if (!input || typeof input !== 'object') fail('答题请求无效');
  const sessionId=bounded(input.sessionId,'会话 ID',100), nodeId=bounded(input.nodeId,'节点 ID',100);
  const submissionId=bounded(input.submissionId,'重复提交 ID',100);
  if (!Number.isInteger(input.choice) || input.choice < 0 || input.choice > 2) fail('请选择一个有效答案');
  return {sessionId,nodeId,submissionId,choice:input.choice};
}
function validateTeach(input) {
  if (!input || typeof input !== 'object') fail('教学请求无效');
  const sessionId=bounded(input.sessionId,'会话 ID',100),nodeId=bounded(input.nodeId,'节点 ID',100);
  const submissionId=bounded(input.submissionId,'重复提交 ID',100);
  if (!['continue','answer'].includes(input.action)) fail('教学操作无效');
  if (input.action==='answer'&&(!Number.isInteger(input.choice)||input.choice<0||input.choice>2)) fail('请选择一个有效答案');
  return {sessionId,nodeId,submissionId,action:input.action,...(input.action==='answer'?{choice:input.choice}:{})};
}
function validateSong(song) {
  if (!song || typeof song !== 'object') fail('歌曲无效');
  const id=bounded(song.id,'歌曲 ID',100), title=bounded(song.title,'歌名',150);
  const artist=bounded(song.artist,'歌手',150), version=bounded(song.version,'歌曲版本',150);
  const language=normalizeLanguage(song.language);
  if (!Number.isInteger(song.durationMs) || song.durationMs < 1000 || song.durationMs > 3600000) fail('歌曲时长无效');
  if (!song.source || typeof song.source !== 'object' || !song.source.kind) fail('歌曲来源无效');
  const playback={};
  if (song.album !== undefined) playback.album=bounded(song.album,'专辑',150);
  if (song.provider !== undefined) {
    if (!['apple','qqmusic','netease'].includes(song.provider)) fail('音乐来源无效');
    playback.provider=song.provider;
  }
  if (song.providerId !== undefined && song.providerId !== '') {
    const providerId=String(song.providerId);
    if (!/^\d{1,20}$/.test(providerId)) fail('音乐来源 ID 无效');
    playback.providerId=providerId;
  }
  if (song.songmid !== undefined) {
    if (typeof song.songmid !== 'string' || !/^[A-Za-z0-9]{14}$/.test(song.songmid)) fail('QQ 歌曲 MID 无效');
    playback.songmid=song.songmid;
  }
  if (song.playlistId !== undefined) playback.playlistId=bounded(String(song.playlistId),'歌单 ID',40);
  if (song.trackIndex !== undefined) {
    if (!Number.isInteger(song.trackIndex) || song.trackIndex < 0 || song.trackIndex > 100000) fail('歌单位置无效');
    playback.trackIndex=song.trackIndex;
  }
  if (song.playbackVerified === true) playback.playbackVerified=true;
  return {id,title,artist,language,languageLabel:languageInfo(language).label,version,durationMs:song.durationMs,
    source:song.source,...playback,...(song.audio?{audio:song.audio}:{})};
}
const nodeTypes=['listening','meaning','path','story','culture','rest','challenge','level','final'];
const interactions=['listen','context','path','story','culture','card','final','dungeon'];
function validateLessonNode(input) {
  if (!input || typeof input !== 'object') fail('教学节点无效');
  if (Object.hasOwn(input,'correctIndex') || Object.hasOwn(input,'remedial')) fail('公开节点不能包含评分字段');
  const id=bounded(input.id,'节点 ID',100), stage=bounded(input.stage,'阶段名称',30);
  const title=bounded(input.title,'节点标题',120), prompt=bounded(input.prompt,'题面',1000);
  const language=normalizeLanguage(input.language);
  if (!nodeTypes.includes(input.type)) fail('节点类型无效');
  if (!['active','completed'].includes(input.status)) fail('节点状态无效');
  if (!interactions.includes(input.interaction)) fail('关卡交互无效');
  if (!input.persona || typeof input.persona.id !== 'string' || !input.persona.id || !input.persona.name) fail('关卡角色无效');
  if (!Array.isArray(input.options) || input.options.length > 3 ||
    input.options.some(option=>typeof option !== 'string' || !option.trim() || option.length > 300) ||
    (!['dungeon','final'].includes(input.interaction) && input.options.length < 2)) fail('节点选项无效');
  if (!Array.isArray(input.evidence) || input.evidence.length < 1) fail('节点证据无效');
  input.evidence.forEach(validateLine);
  if (!Array.isArray(input.map) || input.map.length < 3 || input.map.length > 6 ||
    input.map.some(item=>!item || !nodeTypes.includes(item.type) || !['active','completed','locked','skipped'].includes(item.status))) fail('课程地图无效');
  if (!Array.isArray(input.edges)) fail('课程路线无效');
  if (!input.room || !Array.isArray(input.room.tiles) || input.room.tiles.length !== 9 ||
    input.room.tiles.some(row=>typeof row !== 'string' || row.length !== 19)) fail('字符地图无效');
  if (!Array.isArray(input.room.cells) || input.room.cells.length !== 9 ||
    input.room.cells.some(row=>!Array.isArray(row) || row.length !== 19)) fail('字符地图格子无效');
  if (!input.room.objective || !Number.isInteger(input.room.collected) || !Number.isInteger(input.room.total)) fail('关卡目标无效');
  const teaching=input.teaching;
  if (!teaching || !['brief','reading','context','check','ready'].includes(teaching.phase) ||
    typeof teaching.goal !== 'string' || !teaching.goal.trim() || typeof teaching.reason !== 'string' || !teaching.reason.trim() ||
    typeof teaching.lineId !== 'string' || !teaching.lineId.trim() || !Number.isInteger(teaching.attempts) || teaching.attempts<0 ||
    typeof teaching.feedback !== 'string') fail('教学阶段无效');
  if (!Array.isArray(teaching.chunks) || teaching.chunks.some(chunk=>!chunk || typeof chunk.text!=='string' || !chunk.text.trim() ||
    typeof chunk.reading!=='string' || !chunk.reading.trim() || typeof chunk.meaning!=='string' || !chunk.meaning.trim())) fail('教学拆读无效');
  if (['reading','context','check','ready'].includes(teaching.phase) && teaching.chunks.length<1) fail('教学拆读缺失');
  if (['context','check','ready'].includes(teaching.phase) &&
    [teaching.translation,teaching.context,teaching.cultureNote].some(value=>typeof value!=='string'||!value.trim())) fail('教学语境无效');
  if (teaching.check!==null && (!teaching.check || typeof teaching.check.prompt!=='string' || !teaching.check.prompt.trim() ||
    !Array.isArray(teaching.check.options) || teaching.check.options.length!==3 ||
    teaching.check.options.some(option=>typeof option!=='string'||!option.trim()))) fail('教学检查无效');
  if (teaching.phase==='check' && teaching.check===null) fail('教学检查缺失');
  if (teaching.check && (Object.hasOwn(teaching.check,'correctIndex') || Object.hasOwn(teaching.check,'explanation'))) fail('公开教学不能包含答案字段');
  return {id,type:input.type,stage,title,prompt,options:[...input.options],evidence:input.evidence,map:input.map,
    status:input.status,language,languageLabel:languageInfo(language).label,target:input.target,
    material:input.material,provenance:input.provenance,interaction:input.interaction,
    persona:input.persona,reward:input.reward,game:input.game,edges:input.edges,room:input.room,teaching:input.teaching};
}
function validateLearningSession(input) {
  if (!input || typeof input !== 'object') fail('学习会话无效');
  if (!['active','completed'].includes(input.status)) fail('学习会话状态无效');
  const id=bounded(input.id,'会话 ID',100), songId=bounded(input.songId,'歌曲 ID',100);
  const language=normalizeLanguage(input.language);
  if (!Number.isInteger(input.schemaVersion) || input.schemaVersion !== VERSION) fail('会话版本无效');
  if (!input.progress || !Number.isInteger(input.progress.completed) || !Number.isInteger(input.progress.total) ||
    input.progress.completed < 0 || input.progress.total < 1 || input.progress.completed > input.progress.total ||
    (input.status === 'completed') !== (input.progress.completed === input.progress.total)) fail('学习进度无效');
  if (!input.mastery || !['new','practicing','mastered'].includes(input.mastery.status)) fail('掌握摘要无效');
  if (!input.game || !Number.isInteger(input.game.xp) || input.game.xp < 0 ||
    !Number.isInteger(input.game.streak) || input.game.streak < 0 ||
    !Array.isArray(input.game.cards) || !Array.isArray(input.game.route)) fail('游戏进度无效');
  return {...input,language,languageLabel:languageInfo(language).label};
}
module.exports={VERSION,validateLine,validateSong,validateAnswer,validateMove,validateRespond,validateTeach,validateLessonNode,validateLearningSession};
