'use strict';
const {library}=require('./qq-library');
const {parseSyncedLrc,findLyrics}=require('./lyrics');
const clean=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const artistKey=value=>clean(String(value||'').replace(/\([^)]*\)|（[^）]*）/g,''));
const isCreditLine=(line,title)=>/^(?:词|曲|作词|作曲|编曲|录音|混音|母带|制作人)\s*[:：]/.test(line.text)||
  (line.startMs<15000&&/^(?:(?:original|korean|english|chinese)\s+lyrics|lyrics|vocal\s+directed|background\s+vocals|programming|recorded|digital\s+edited|mixed|mastered|composed|arranged|produced|written)(?:\s+by)?\s*[:：]/i.test(line.text)||
    line.text.startsWith(title+' - '));
const withoutCredits=(lines,title)=>{
  const kept=lines.filter(line=>!isCreditLine(line,title));
  return kept.map((line,index)=>({...line,endMs:kept[index+1]?.startMs??line.endMs}));
};

async function findQqLyrics(input,{fetchImpl=fetch,libraryImpl=library,fallback=findLyrics}={}){
  const {title,artist,durationMs}=input;
  if(typeof title!=='string'||!title.trim()||title.length>150||typeof artist!=='string'||!artist.trim()||artist.length>150||
    !Number.isInteger(durationMs)||durationMs<1000||durationMs>3600000)throw Error('歌曲信息无效');
  let songs;
  try{songs=await libraryImpl()}catch{return fallback(title,artist,durationMs,fetchImpl)}
  const candidate=songs.find(song=>(!input.providerId||song.id===String(input.providerId))&&clean(song.title)===clean(title)&&
    (artistKey(song.artist)===artistKey(artist)||artistKey(song.artist).includes(artistKey(artist))||artistKey(artist).includes(artistKey(song.artist)))&&
    Math.abs(song.durationMs-durationMs)<3000&&(!input.album||clean(song.album)===clean(input.album)));
  if(input.providerId&&!candidate)return {status:'no_matched_version',source:'QQ 音乐',lines:[]};
  if(candidate?.songmid){
    try{
      const url=new URL('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg');
      url.searchParams.set('format','json');url.searchParams.set('songmid',candidate.songmid);
      const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),headers:{Referer:'https://y.qq.com/','User-Agent':'Mozilla/5.0 VIBE-Language-Agent/0.1'}});
      if(response.ok){
        const data=await response.json();
        if(data.code===0&&typeof data.lyric==='string'&&data.lyric.length<200000){
          const raw=Buffer.from(data.lyric,'base64').toString('utf8');
          const songId=`qqmusic-${candidate.id}`;
          const lines=withoutCredits(parseSyncedLrc(raw,songId,candidate.songmid,'qqmusic'),candidate.title);
          if(lines.length)return {status:'unverified',source:'QQ 音乐',song:{id:songId,title:candidate.title,artist:candidate.artist,language:'ko',version:candidate.album||'QQ 音乐歌曲 ID '+candidate.id,durationMs:candidate.durationMs,source:{kind:'qqmusic',id:candidate.songmid}},lines};
        }
      }
    }catch{ /* QQ 歌词接口临时失败时，下面尝试带版本校验的 LRCLIB。 */ }
  }
  return fallback(title,artist,durationMs,fetchImpl);
}
module.exports={findQqLyrics};
