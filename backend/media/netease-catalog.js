'use strict';
const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
async function search(query,fetchImpl=fetch){
  if(typeof query!=='string'||!query.trim()||query.length>80)throw Error('搜索词无效');
  const url=new URL('https://music.163.com/api/search/get');
  url.searchParams.set('type','1');url.searchParams.set('s',query.trim());url.searchParams.set('limit','10');
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0 VIBE-Language-Agent/0.1'}});
  if(!response.ok)throw Error(`网易云歌曲搜索返回 HTTP ${response.status}`);
  const data=await response.json();
  if(data.code!==200||!Array.isArray(data.result?.songs))throw Error('网易云歌曲搜索结果不可用');
  const seen=new Set();
  return data.result.songs.flatMap(item=>{
    const id=Number(item.id),title=String(item.name||'').trim(),artist=(item.artists||[]).map(x=>String(x.name||'').trim()).filter(Boolean).join(' / '),album=String(item.album?.name||'').trim(),durationMs=Number(item.duration);
    if(!Number.isSafeInteger(id)||id<=0||!title||!artist||!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000||seen.has(id))return [];
    seen.add(id);return [{id:String(id),title,artist,album,durationMs,provider:'netease'}];
  }).sort((a,b)=>{
    const aExact=normalize(query)===normalize(a.artist+' '+a.title),bExact=normalize(query)===normalize(b.artist+' '+b.title);
    return Number(bExact)-Number(aExact);
  });
}
module.exports={search};
