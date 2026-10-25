'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {join}=require('node:path');
const {homedir}=require('node:os');
const runFile=promisify(execFile);
const database=join(homedir(),'Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');
const query=`SELECT d.id, d.jsonStr
FROM playlistTrackIds AS p,
     json_each(p.jsonStr, '$.trackIds') AS item
JOIN dbTrack AS d ON d.id = CAST(json_extract(item.value, '$.id') AS TEXT)
ORDER BY CAST(item.key AS INTEGER)
LIMIT 500`;

function decode(stdout){
  let rows;try{rows=JSON.parse(stdout||'[]')}catch{throw Error('网易云本地歌曲资料无法解析')}
  if(!Array.isArray(rows))throw Error('网易云本地歌曲资料格式无效');
  const seen=new Set();
  return rows.flatMap(row=>{
    let item;try{item=JSON.parse(row.jsonStr)}catch{return []}
    const id=String(row.id||''),title=String(item.name||'').trim();
    const artist=Array.isArray(item.artists)?item.artists.map(part=>String(part?.name||'').trim()).filter(Boolean).join(' / '):'';
    const durationMs=Number(item.duration),album=String(item.album?.name||'').trim();
    if(!/^\d{1,20}$/.test(id)||!title||!artist||!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000||seen.has(id))return [];
    seen.add(id);return [{id,title,artist,album,durationMs,provider:'netease'}];
  });
}
async function library(run=async()=>{
  const {stdout}=await runFile('/usr/bin/sqlite3',['-readonly','-json',database,query],{timeout:5000,maxBuffer:8*1024*1024});return stdout;
}){
  try{return decode(await run())}catch(error){
    if(error.code==='ENOENT'||/unable to open database|no such table|not a database/i.test(String(error.message)))throw Error('找不到可读取的网易云客户端歌曲资料；请确认已登录并同步歌曲');
    throw error;
  }
}
module.exports={library,decode};
