'use strict';
const endpoint='https://u.y.qq.com/cgi-bin/musicu.fcg';
function playlistId(value){
  const text=String(value||'').trim(),match=text.match(/(?:playlist\/|[?&](?:id|disstid)=)(\d+)/);
  const id=/^\d+$/.test(text)?text:match?.[1];
  if(!id||id.length>20)throw Error('QQ 音乐歌单链接或 ID 无效');
  return id;
}
function decodeTrack(item,index,id){
  const songId=String(item?.id||''),songmid=String(item?.mid||''),title=String(item?.name||item?.title||'').trim();
  const artist=(item?.singer||[]).map(part=>String(part?.name||'').trim()).filter(Boolean).join(' / ');
  const durationMs=Number(item?.interval)*1000,album=String(item?.album?.name||item?.album?.title||'').trim();
  if(!/^\d{1,20}$/.test(songId)||!title||!artist||!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000)return null;
  return {id:songId,title,artist,album,durationMs,provider:'qqmusic',songmid:/^[A-Za-z0-9]{14}$/.test(songmid)?songmid:null,playlistId:id,trackIndex:index};
}
async function importPublicPlaylist(value,fetchImpl=fetch){
  const id=playlistId(value),pageSize=500,songs=[];let begin=0,total=null,name=`QQ 音乐歌单 ${id}`;
  while(total===null||begin<total){
    const payload={comm:{ct:24,cv:0,uin:'0'},req:{module:'music.srfDissInfo.aiDissInfo',method:'uniform_get_Dissinfo',param:{disstid:Number(id),userinfo:1,tag:1,orderlist:1,song_begin:begin,song_num:pageSize,onlysonglist:begin===0?0:1,enc_host_uin:''}}};
    const response=await fetchImpl(endpoint,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/','User-Agent':'Mozilla/5.0 VIBE-Language-Agent/0.1'},body:JSON.stringify(payload)});
    if(!response.ok)throw Error(`QQ 音乐歌单返回 HTTP ${response.status}`);
    const envelope=(await response.json()).req||{},data=envelope.data||{};
    if(envelope.code!==0||data.code!==0)throw Error('QQ 音乐没有返回可读取的公开歌单');
    if(begin===0){total=Number(data.total_song_num??data.dirinfo?.songnum??0);name=String(data.dirinfo?.title||name)}
    const page=Array.isArray(data.songlist)?data.songlist:[];
    for(const item of page){const song=decodeTrack(item,songs.length,id);if(song)songs.push(song)}
    if(!page.length)break;
    begin+=page.length;if(total===0)total=begin;
  }
  if(total&&songs.length<total)throw Error(`QQ 音乐只返回了 ${songs.length}/${total} 首歌曲，未作为完整歌单导入`);
  return {id,name,provider:'qqmusic',songs,source:`https://y.qq.com/n/ryqq_v2/playlist/${id}`};
}
module.exports={importPublicPlaylist,playlistId,decodeTrack};
