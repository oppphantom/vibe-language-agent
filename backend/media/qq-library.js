'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {join}=require('node:path');
const {homedir}=require('node:os');
const runFile=promisify(execFile);
const database=join(homedir(),'Library/Containers/com.tencent.QQMusicMac/Data/Library/Application Support/QQMusicMac/qqmusic.sqlite');
const query=`SELECT DISTINCT CAST(s.id AS TEXT) AS id, s.name AS title, s.singer AS artist,
       s.album AS album, s.K_SONG_RESERVE12 AS durationMs, s.K_SONG_RESERVE1 AS songmid
FROM NEWFOLDERSONGS AS f
JOIN SONGS AS s ON s.id=f.id AND s.type=f.type
WHERE s.K_SONG_RESERVE12 BETWEEN 1000 AND 3600000
ORDER BY s.name
LIMIT 1000`;

function decode(stdout){
  let rows;try{rows=JSON.parse(stdout||'[]')}catch{throw Error('QQ 音乐本地歌曲资料无法解析')}
  if(!Array.isArray(rows))throw Error('QQ 音乐本地歌曲资料格式无效');
  const seen=new Set();
  return rows.flatMap(row=>{
    const id=String(row.id||''),title=String(row.title||'').trim(),artist=String(row.artist||'').trim();
    const album=String(row.album||'').trim(),durationMs=Number(row.durationMs),songmid=String(row.songmid||'').trim();
    if(!/^\d{1,20}$/.test(id)||!title||!artist||!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000||seen.has(id))return [];
    seen.add(id);return [{id,title,artist,album,durationMs,provider:'qqmusic',songmid:/^[A-Za-z0-9]{14}$/.test(songmid)?songmid:null}];
  });
}
async function library(run=async()=>{
  const {stdout}=await runFile('/usr/bin/sqlite3',['-readonly','-json',database,query],{timeout:5000,maxBuffer:8*1024*1024});return stdout;
}){
  try{return decode(await run())}catch(error){
    if(error.code==='ENOENT'||/unable to open database|no such table|not a database/i.test(String(error.message)))throw Error('找不到可读取的 QQ 音乐客户端歌曲资料；请确认已登录并同步歌曲');
    throw error;
  }
}
module.exports={library,decode};
