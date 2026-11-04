'use strict';
const {search}=require('./netease-catalog');
const {parseSyncedLrc}=require('./lyrics');
const {normalizeLanguage}=require('../../shared/languages');
const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
async function findNeteaseLyrics(input,fetchImpl=fetch){
  const {title,artist,durationMs}=input;
  const language=normalizeLanguage(input.language);
  if(typeof title!=='string'||!title.trim()||title.length>150||typeof artist!=='string'||!artist.trim()||artist.length>150||
    !Number.isInteger(durationMs)||durationMs<1000||durationMs>3600000)throw Error('歌曲信息无效');
  const tracks=await search(`${artist} ${title}`.slice(0,80),fetchImpl);
  const candidates=tracks.filter(song=>normalize(song.title)===normalize(title)&&
    (normalize(song.artist).includes(normalize(artist))||normalize(artist).includes(normalize(song.artist)))&&
    Math.abs(song.durationMs-durationMs)<3000&&
    (!input.album||normalize(song.album)===normalize(input.album)));
  const selected=input.providerId?candidates.find(song=>song.id===String(input.providerId)):candidates[0];
  if(!selected)return {status:'no_matched_version',source:'网易云音乐',lines:[]};
  const url=new URL('https://music.163.com/api/song/lyric');
  url.searchParams.set('id',selected.id);url.searchParams.set('lv','1');url.searchParams.set('tv','1');
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 VIBE-Language-Agent/0.1'}});
  if(!response.ok)throw Error(`网易云歌词返回 HTTP ${response.status}`);
  const data=await response.json();
  if(data.code!==200)throw Error('网易云歌词暂不可用');
  const songId=`netease-${selected.id}`;
  const lines=parseSyncedLrc(data.lrc?.lyric,songId,selected.id,'netease').filter(line=>!/^(作词|作曲|编曲|录音|混音|母带)\s*[:：]/.test(line.text));
  if(!lines.length)return {status:'no_matched_version',source:'网易云音乐',lines:[]};
  return {status:'unverified',source:'网易云音乐',song:{id:songId,title:selected.title,artist:selected.artist,language,version:'网易云歌曲 ID '+selected.id,durationMs:selected.durationMs,source:{kind:'netease',id:selected.id}},lines};
}
module.exports={findNeteaseLyrics};
