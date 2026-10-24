'use strict';
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function parseSyncedLrc(lrc,songId,sourceId){
  const raw=String(lrc||'').split(/\r?\n/).flatMap(row=>{
    const m=row.match(/^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.+)$/);
    return m?[{startMs:(Number(m[1])*60+Number(m[2]))*1000+Number((m[3]||'0').padEnd(3,'0').slice(0,3)),text:m[4].trim()}]:[];
  }).filter(x=>x.text);
  return raw.map((x,i)=>({id:`${songId}-${i+1}`,songId,text:x.text,startMs:x.startMs,endMs:raw[i+1]?.startMs>x.startMs?raw[i+1].startMs:null,
    source:{kind:'lrclib',id:sourceId},reviewStatus:'unverified'}));
}
async function findLyrics(title,artist,durationMs,fetchImpl=fetch){
  if(!title||!artist||title.length>150||artist.length>150)throw Error('歌名或歌手无效');
  const url=new URL('https://lrclib.net/api/search');url.searchParams.set('track_name',title);url.searchParams.set('artist_name',artist);
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'VIBE-Language-Agent/0.1'}});
  if(!response.ok)throw Error('LRCLIB 返回 HTTP '+response.status);
  const matches=(await response.json()).filter(x=>normalize(x.trackName)===normalize(title)&&normalize(x.artistName).includes(normalize(artist))&&x.syncedLyrics);
  const item=matches.sort((a,b)=>Math.abs(a.duration*1000-durationMs)-Math.abs(b.duration*1000-durationMs))[0];
  if(!item||Math.abs(item.duration*1000-durationMs)>8000)return {status:'no_matched_version',source:'LRCLIB',lines:[]};
  const songId=`lrclib-${item.id}`;return {status:'unverified',source:'LRCLIB',song:{id:songId,title:item.trackName,artist:item.artistName,language:'ko',version:item.albumName||'unknown',durationMs:Math.round(item.duration*1000),source:{kind:'lrclib',id:item.id}},lines:parseSyncedLrc(item.syncedLyrics,songId,item.id)};
}
module.exports={parseSyncedLrc,findLyrics};
