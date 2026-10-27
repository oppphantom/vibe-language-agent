'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {join}=require('node:path');
const {homedir}=require('node:os');
const {existsSync,readFileSync}=require('node:fs');
const runFile=promisify(execFile);
const database=join(homedir(),'Library/Containers/com.netease.163music/Data/Documents/storage/sqlite_storage.sqlite3');
const windowsDatabase=join(process.env.LOCALAPPDATA||join(homedir(),'AppData/Local'),'NetEase/CloudMusic/Library/webdb.dat');
const windowsQueue=join(process.env.LOCALAPPDATA||join(homedir(),'AppData/Local'),'NetEase/CloudMusic/webdata/file/playingList');
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
function decodeTrack(id,item,extra={}){
  const title=String(item?.name||'').trim();
  const artist=(Array.isArray(item?.artists||item?.ar)?(item.artists||item.ar).map(part=>String(part?.name||'').trim()).filter(Boolean).join(' / '):'')||'未知歌手';
  const durationMs=Number(item?.duration??item?.dt),album=String((item?.album||item?.al)?.name||'').trim();
  if(!/^\d{1,20}$/.test(String(id))||!title||!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000)return null;
  return {id:String(id),title,artist,album,durationMs,provider:'netease',...extra};
}
function windowsPlaylists({databasePath=windowsDatabase,queuePath=windowsQueue,DatabaseSyncImpl}={}){
  if(!existsSync(databasePath))throw Error('找不到网易云 Windows 本地歌单数据库；请先登录并同步歌单');
  if(!DatabaseSyncImpl){try{({DatabaseSync:DatabaseSyncImpl}=require('node:sqlite'))}catch{throw Error('Windows 歌单读取需要 Node.js 22 或更高版本')}}
  const db=new DatabaseSyncImpl(databasePath,{readOnly:true});
  try{
    const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    const names=new Map();
    if(tables.has('historyPlaylists'))for(const row of db.prepare('SELECT id,jsonStr FROM historyPlaylists').all()){
      try{const data=JSON.parse(row.jsonStr);if(data.name)names.set(String(data.id||row.id),String(data.name))}catch{}
    }
    const tracks=new Map();
    for(const row of db.prepare('SELECT id,jsonStr FROM dbTrack').all()){
      try{const song=decodeTrack(row.id,JSON.parse(row.jsonStr));if(song)tracks.set(String(row.id),song)}catch{}
    }
    const playlists=[];
    for(const row of db.prepare('SELECT id,jsonStr FROM playlistTrackIds').all()){
      try{
        const data=JSON.parse(row.jsonStr),id=String(row.id),ids=data.trackIds||[];
        const songs=ids.map((item,index)=>{const trackId=String(typeof item==='object'?item.id:item),song=tracks.get(trackId);return song?{...song,playlistId:id,trackIndex:index}:null}).filter(Boolean);
        playlists.push({id,name:String(data.name||names.get(id)||`网易云歌单 ${id}`),provider:'netease',songs});
      }catch{}
    }
    if(existsSync(queuePath))try{
      const data=JSON.parse(readFileSync(queuePath,'utf8'));
      const songs=(data.list||[]).map((item,index)=>{const raw=item.track||item.localTrack;return raw?decodeTrack(raw.id,raw,{playlistId:'current-queue',trackIndex:index}):null}).filter(Boolean);
      if(songs.length)playlists.push({id:'current-queue',name:'当前播放队列',provider:'netease',songs});
    }catch{}
    return playlists;
  }finally{db.close()}
}
async function library(run){
  if(!run&&process.platform==='win32'){
    const seen=new Set();return windowsPlaylists().flatMap(list=>list.songs.filter(song=>!seen.has(song.id)&&seen.add(song.id)));
  }
  run=run||(async()=>{const {stdout}=await runFile('/usr/bin/sqlite3',['-readonly','-json',database,query],{timeout:5000,maxBuffer:8*1024*1024});return stdout});
  try{return decode(await run())}catch(error){
    if(error.code==='ENOENT'||/unable to open database|no such table|not a database/i.test(String(error.message)))throw Error('找不到可读取的网易云客户端歌曲资料；请确认已登录并同步歌曲');
    throw error;
  }
}
module.exports={library,decode,windowsPlaylists,decodeTrack};
