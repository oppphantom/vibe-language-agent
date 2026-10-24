'use strict';
const {findLyrics}=require('./lyrics');
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const cache=new Map();
async function library(artist,{macBridge}={}){
  if(!macBridge)throw Error('Mac「音乐」仅在 macOS 可用');
  if(typeof artist!=='string'||artist.trim().length<2||artist.length>80)throw Error('歌手名称无效');
  const tracks=await macBridge.libraryTracks(artist.trim());
  return tracks.filter(track=>normalize(track.artist)===normalize(artist)).slice(0,30).map(track=>({
    title:track.title,artist:track.artist,durationMs:Math.round(track.duration*1000)
  }));
}
async function index(artist,{macBridge,findLyricsImpl=findLyrics,libraryImpl=library}={}){
  const key=normalize(artist),old=cache.get(key);
  if(old&&Date.now()-old.at<5*60*1000)return old.data;
  const tracks=(await libraryImpl(artist,{macBridge})).slice(0,30);
  const results=[];
  for(let i=0;i<tracks.length;i+=4){
    results.push(...await Promise.allSettled(tracks.slice(i,i+4).map(async track=>{
      const lyric=await findLyricsImpl(track.title,track.artist,track.durationMs);
      return lyric.status==='unverified'?{track,lines:lyric.lines,lyricSource:lyric.source}:null;
    })));
  }
  const data={requested:tracks.length,indexed:results.filter(x=>x.status==='fulfilled'&&x.value).length,
    sourceFailures:results.filter(x=>x.status==='rejected').length,
    entries:results.flatMap(x=>x.status==='fulfilled'&&x.value?[x.value]:[])};
  cache.set(key,{at:Date.now(),data});return data;
}
function findHits(data,expression){
  const needle=String(expression||'').normalize('NFKC').toLocaleLowerCase().trim();
  if(!needle||needle.length>40)throw Error('请输入 1–40 个字符的表达');
  const hits=[];
  for(const entry of data.entries)for(let i=0;i<entry.lines.length;i++){
    const line=entry.lines[i];
    if(!line.text.normalize('NFKC').toLocaleLowerCase().includes(needle))continue;
    hits.push({song:entry.track,line,before:entry.lines[i-1]?.text||'',after:entry.lines[i+1]?.text||'',source:entry.lyricSource});
  }
  return {expression,matchMethod:'韩文连续字符命中；词形和语义尚未核对',requested:data.requested,indexed:data.indexed,sourceFailures:data.sourceFailures,
    songCount:new Set(hits.map(x=>x.song.title+'\0'+x.song.artist)).size,hits:hits.slice(0,100)};
}
module.exports={library,index,findHits};
