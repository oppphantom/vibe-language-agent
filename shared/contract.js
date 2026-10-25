'use strict';
const VERSION = 1;
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
  if (!Number.isInteger(input.attempt) || input.attempt < 1 || input.attempt > 10) fail('尝试次数无效');
  return {sessionId,nodeId,submissionId,choice:input.choice,attempt:input.attempt,hintUsed:input.hintUsed===true};
}
module.exports={VERSION,validateLine,validateAnswer};
