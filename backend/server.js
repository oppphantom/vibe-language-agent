'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {begin,get,node,answer,move,respond,restart}=require('./agent/session');
const model=require('./agent/model');
const planner=require('./agent/planner');
const {loadEnv}=require('./env');
const {findLyrics}=require('./media/lyrics');
const {findNeteaseLyrics}=require('./media/netease-lyrics');
const neteaseCatalog=require('./media/netease-catalog');
const neteaseLibrary=require('./media/netease-library');
const qqLibrary=require('./media/qq-library');
const qqPlaylist=require('./media/qq-playlist');
const {findQqLyrics}=require('./media/qq-lyrics');
const libraryIndex=require('./media/library-index');
const {songs,lines}=require('../content/fixtures/demo');
const {validateLine,validateSong}=require('../shared/contract');
const {normalizeLanguage,publicLanguages}=require('../shared/languages');
const mac=process.platform==='darwin'?require('./media/mac-music'):null;
const systemPlayer=process.platform==='darwin'?require('./media/system-player').createBridge():
  process.platform==='win32'?require('./media/windows-player').createBridge():null;
const root=path.join(__dirname,'..');
const assets={'/':'frontend/index.html','/sky.js':'frontend/sky.js','/playback-retry.js':'frontend/playback-retry.js','/app.js':'frontend/app.js','/music.js':'frontend/music.js','/text-edit.js':'frontend/text-edit.js','/style.css':'frontend/style.css'};
const mime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'};
const publicSongs=songs.map(validateSong);
function send(res,status,data,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
function read(req,limit=12000){return new Promise((resolve,reject)=>{
  const parts=[];let size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>limit){reject(Error('请求过长'));req.destroy();}else parts.push(chunk)});
  req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')))}catch{reject(Error('请求不是有效 JSON'))}});req.on('error',reject);
});}
const UI_TEXT_FILE=path.join(root,'frontend/index.html');
function escapeHtml(text){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function allIndices(source,needle){const indices=[];let index=0;while((index=source.indexOf(needle,index))!==-1){indices.push(index);index+=needle.length;}return indices;}
const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// 返回源码中某个标签的每个元素区间，用于在祖先元素内部定位重复文案
function tagRegions(source,tag){
  const token=new RegExp(`<${tag}(?=[\\s>/])|</${tag}\\s*>`,'gi'),regions=[];
  let depth=0,regionStart=-1,match;
  while((match=token.exec(source))){
    if(match[0][1]!=='/'){depth++;if(depth===1)regionStart=match.index;}
    else if(depth>0){
      depth--;
      if(depth===0)regions.push({start:regionStart,end:match.index+match[0].length});
    }
  }
  if(depth>0&&regionStart!==-1)regions.push({start:regionStart,end:source.length});
  return regions;
}
function regionById(source,tag,id){
  const needle=`id="${id}"`;
  let index=source.indexOf(needle);
  while(index!==-1){
    const open=source.lastIndexOf('<',index);
    if(open!==-1&&source.slice(open,open+tag.length+1).toLowerCase()===('<'+tag)&&/[\s>]/.test(source[open+tag.length+1]||'')){
      const region=tagRegions(source,tag).find(item=>item.start===open);
      if(region)return region;
    }
    index=source.indexOf(needle,index+needle.length);
  }
  return null;
}
// 先找全局唯一；否则按祖先元素区间逐步收窄（如 <h1> 与 <meta description> 含有同一句）
function locateText(source,candidates,scope){
  for(const candidate of candidates){
    const indices=allIndices(source,candidate);
    if(indices.length===1)return {candidate,index:indices[0]};
  }
  if(!Array.isArray(scope))return null;
  for(const ancestor of scope){
    const tag=ancestor&&typeof ancestor.tag==='string'?ancestor.tag.toLowerCase():'';
    if(!/^[a-z][a-z0-9-]{0,30}$/.test(tag))continue;
    const id=typeof ancestor.id==='string'&&/^[\w:.-]{1,80}$/.test(ancestor.id)?ancestor.id:'';
    const regions=id?[regionById(source,tag,id)].filter(Boolean):tagRegions(source,tag);
    for(const candidate of candidates){
      const indices=allIndices(source,candidate);
      const hits=regions
        .map(region=>indices.filter(index=>index>=region.start&&index<region.end))
        .filter(list=>list.length>0);
      if(hits.length===1&&hits[0].length===1)return {candidate,index:hits[0][0]};
    }
  }
  return null;
}
// 把页面里改过的文字写回 index.html；动态生成、无法定位的文本不写入
function saveUiText(input){
  const edits=input&&input.edits;
  if(!Array.isArray(edits)||!edits.length||edits.length>200)throw Error('文字修改参数无效');
  let source=fs.readFileSync(UI_TEXT_FILE,'utf8');
  const applied=[],skipped=[];
  for(const edit of edits){
    const from=edit&&edit.from,to=edit&&edit.to;
    if(typeof from!=='string'||typeof to!=='string'||!from.trim()||from===to||from.length>4000||to.length>4000){
      skipped.push({text:String(from||'').slice(0,60),reason:'参数无效'});continue;
    }
    const candidates=[from];
    const escaped=escapeHtml(from);
    if(escaped!==from)candidates.push(escaped);
    const found=locateText(source,candidates,edit.scope);
    if(!found){skipped.push({text:from.slice(0,60),reason:'源码中没有匹配，可能是动态渲染或相同文字过多'});continue;}
    source=source.slice(0,found.index)+escapeHtml(to)+source.slice(found.index+found.candidate.length);
    applied.push(from.slice(0,60));
  }
  if(applied.length)fs.writeFileSync(UI_TEXT_FILE,source,'utf8');
  return {file:'frontend/index.html',applied,skipped};
}
function capabilities(mode){
  if(mode==='local_audio')return {seek:true,lineLoop:true,speed:true,wordSeek:false,reason:{wordSeek:'缺少逐词时间戳'}};
  if(mode==='mac_music')return mac?{seek:true,lineLoop:false,speed:false,wordSeek:false,reason:{lineLoop:'Mac 音乐仅支持单次自动暂停',speed:'桥接未实现变速',wordSeek:'缺少逐词时间戳'}}:{seek:false,lineLoop:false,speed:false,wordSeek:false,reason:{all:'仅 macOS 可用'}};
  if(mode==='system_player')return systemPlayer?{seek:true,lineLoop:false,speed:false,wordSeek:false,reason:{lineLoop:'当前仅支持单次句末暂停',speed:'客户端未开放变速控制',wordSeek:'缺少逐词时间戳'}}:{seek:false,lineLoop:false,speed:false,wordSeek:false,reason:{all:'仅 macOS 与 Windows 可用'}};
  return {seek:false,lineLoop:false,speed:false,wordSeek:false,reason:{all:'样例没有授权音源'}};
}
function createServer(){return http.createServer(async(req,res)=>{
  const port=req.socket.localPort;
  const allowed=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
  const origin=req.headers.origin;
  if(origin&&!allowed.has(origin))return send(res,403,{error:{code:'ORIGIN_DENIED',message:'仅允许当前本机页面调用'}});
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  try{
    if(req.method==='GET'&&assets[url.pathname]){
      const name=assets[url.pathname],ext=name.split('.').pop();return send(res,200,fs.readFileSync(path.join(root,name)),mime[ext]);
    }
    if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,mode:'offline_demo',platform:process.platform,modelConfigured:model.configured()});
    if(req.method==='GET'&&url.pathname==='/api/songs')return send(res,200,{
      songs:publicSongs,lines,languages:publicLanguages(),provenance:'原创教学样例；非实时 Agent 生成'
    });
    if(req.method==='GET'&&url.pathname==='/api/playback/capabilities')return send(res,200,{offline:capabilities('offline'),localAudio:capabilities('local_audio'),macMusic:capabilities('mac_music'),systemPlayer:capabilities('system_player')});
    if(req.method==='GET'&&url.pathname.startsWith('/api/sessions/')){
      const id=url.pathname.split('/')[3];
      return send(res,200,url.pathname.endsWith('/node')?node(id):get(id));
    }
    if(req.method==='POST'&&url.pathname==='/api/sessions')return send(res,201,begin(await read(req)));
    const restartMatch=url.pathname.match(/^\/api\/sessions\/([^/]+)\/restart$/);
    if(req.method==='POST'&&restartMatch)return send(res,201,await restart(decodeURIComponent(restartMatch[1])));
    if(req.method==='POST'&&url.pathname==='/api/answers')return send(res,200,answer(await read(req)));
    if(req.method==='POST'&&url.pathname==='/api/moves')return send(res,200,move(await read(req)));
    if(req.method==='POST'&&url.pathname==='/api/respond')return send(res,200,respond(await read(req)));
    if(req.method==='POST'&&url.pathname==='/api/lyrics/search'){
      const input=await read(req);
      if(!Number.isInteger(input.durationMs)||input.durationMs<1000||input.durationMs>3600000)throw Error('歌曲时长无效');
      const language=normalizeLanguage(input.language);
      const normalizedInput={...input,language};
      const result=input.provider==='netease'?await findNeteaseLyrics(normalizedInput):input.provider==='qqmusic'?await findQqLyrics(normalizedInput):
        await findLyrics(input.title,input.artist,input.durationMs,undefined,language);
      if(result.song){
        const playback={};
        for(const key of ['album','provider','providerId','songmid','playlistId','trackIndex','playbackVerified']) {
          if(input[key]!==undefined)playback[key]=input[key];
        }
        result.song={...result.song,...playback};
        result.song={...result.song,...validateSong(result.song)};
      }
      for(const line of result.lines)validateLine(line);
      return send(res,200,result);
    }
    if(req.method==='GET'&&url.pathname==='/api/netease/search'){
      return send(res,200,{songs:await neteaseCatalog.search(url.searchParams.get('q')||''),source:'网易云歌曲目录',reviewStatus:'unverified'});
    }
    if(req.method==='GET'&&url.pathname==='/api/netease/library'){
      if(!['darwin','win32'].includes(process.platform))return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 与 Windows 网易云客户端可用'}});
      return send(res,200,{songs:await neteaseLibrary.library(),source:'本机网易云客户端歌曲列表',reviewStatus:'unverified'});
    }
    if(req.method==='GET'&&url.pathname==='/api/netease/playlists'){
      if(process.platform!=='win32')return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'网易云本地歌单导入目前仅 Windows 可用'}});
      return send(res,200,{playlists:neteaseLibrary.windowsPlaylists(),source:'本机网易云客户端歌单',reviewStatus:'unverified'});
    }
    if(req.method==='GET'&&url.pathname==='/api/qq/library'){
      if(process.platform!=='darwin')return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS QQ 音乐客户端可用'}});
      return send(res,200,{songs:await qqLibrary.library(),source:'本机 QQ 音乐客户端歌曲列表',reviewStatus:'unverified'});
    }
    if(req.method==='GET'&&url.pathname==='/api/qq/playlist'){
      const playlist=await qqPlaylist.importPublicPlaylist(url.searchParams.get('value')||'');
      return send(res,200,{playlist,source:'QQ 音乐公开分享歌单',reviewStatus:'unverified'});
    }
    if(req.method==='POST'&&url.pathname==='/api/agent/plan')return send(res,201,await planner.plan(await read(req,400000)));
    if(req.method==='POST'&&url.pathname==='/api/agent/explain')return send(res,200,await model.explain(await read(req)));
    if(req.method==='GET'&&url.pathname==='/api/mac/status'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      return send(res,200,await mac.status());
    }
    if(req.method==='GET'&&url.pathname==='/api/player/status'){
      if(!systemPlayer)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 与 Windows 可用'}});
      return send(res,200,await systemPlayer.status(url.searchParams.get('source')));
    }
    if(req.method==='POST'&&url.pathname==='/api/player/play-line'){
      if(!systemPlayer)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 与 Windows 可用'}});
      const input=await read(req);
      if(!['qqmusic','netease'].includes(input.source)||typeof input.title!=='string'||!input.title||input.title.length>150||
        typeof input.artist!=='string'||!input.artist||input.artist.length>150||!Number.isFinite(input.startMs)||input.startMs<0||
        !Number.isFinite(input.endMs)||input.endMs<=input.startMs||input.endMs>3600000||
        (input.album!==undefined&&(typeof input.album!=='string'||input.album.length>150))||
        (input.durationMs!==undefined&&(!Number.isFinite(input.durationMs)||input.durationMs<=0||input.durationMs>3600000)))throw Error('播放参数无效');
      return send(res,200,await systemPlayer.playLine(input.source,input.startMs/1000,input.title,input.artist,input.endMs/1000,{album:input.album,durationMs:input.durationMs}));
    }
    if(req.method==='POST'&&url.pathname==='/api/player/control'){
      if(!systemPlayer)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 与 Windows 可用'}});
      const input=await read(req);
      if(!['qqmusic','netease'].includes(input.source)||!['play','pause','jump'].includes(input.action)||
        typeof input.title!=='string'||!input.title||input.title.length>150||typeof input.artist!=='string'||!input.artist||input.artist.length>150||
        (input.action==='jump'&&(!Number.isFinite(input.seconds)||input.seconds<0||input.seconds>3600))||
        (input.album!==undefined&&(typeof input.album!=='string'||input.album.length>150))||
        (input.durationMs!==undefined&&(!Number.isFinite(input.durationMs)||input.durationMs<=0||input.durationMs>3600000)))throw Error('播放控制参数无效');
      return send(res,200,await systemPlayer.control(input.source,input.action,input.title,input.artist,input.seconds,{album:input.album,durationMs:input.durationMs}));
    }
    if(req.method==='POST'&&url.pathname==='/api/player/open-track'){
      if(!systemPlayer?.openTrack)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'直接点播目前仅 Windows 可用'}});
      const input=await read(req),song=input.song;
      if(!['qqmusic','netease'].includes(input.source)||!song||!/^\d{1,20}$/.test(String(song.id||''))||
        (song.playlistId!==undefined&&(typeof song.playlistId!=='string'||song.playlistId.length>40))||
        (song.trackIndex!==undefined&&(!Number.isInteger(song.trackIndex)||song.trackIndex<0||song.trackIndex>100000)))throw Error('点播参数无效');
      return send(res,200,await systemPlayer.openTrack(input.source,{id:String(song.id),playlistId:song.playlistId,trackIndex:song.trackIndex}));
    }
    if(req.method==='POST'&&url.pathname==='/api/player/queue-step'){
      if(!systemPlayer)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 与 Windows 可用'}});
      const input=await read(req);
      if(!['qqmusic','netease'].includes(input.source)||!['next','previous'].includes(input.direction)||
        typeof input.title!=='string'||!input.title||input.title.length>150||typeof input.artist!=='string'||!input.artist||input.artist.length>150||
        (input.album!==undefined&&(typeof input.album!=='string'||input.album.length>150))||
        (input.durationMs!==undefined&&(!Number.isFinite(input.durationMs)||input.durationMs<=0||input.durationMs>3600000)))throw Error('切歌参数无效');
      return send(res,200,await systemPlayer.queueStep(input.source,input.direction,input.title,input.artist,{album:input.album,durationMs:input.durationMs}));
    }
    if(req.method==='GET'&&url.pathname==='/api/mac/library'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const artist=url.searchParams.get('artist')||'';
      const language=normalizeLanguage(url.searchParams.get('language')||undefined);
      return send(res,200,{artist,language,songs:await libraryIndex.library(artist,{macBridge:mac,language})});
    }
    if(req.method==='POST'&&url.pathname==='/api/mac/discover'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const input=await read(req),language=normalizeLanguage(input.language),data=await libraryIndex.index(input.artist,{macBridge:mac,language});
      return send(res,200,libraryIndex.findHits(data,input.expression));
    }
    if(req.method==='POST'&&url.pathname==='/api/mac/play-line'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const input=await read(req);
      if(typeof input.title!=='string'||!input.title||input.title.length>150||typeof input.artist!=='string'||!input.artist||input.artist.length>150||
        !Number.isFinite(input.startMs)||input.startMs<0||!Number.isFinite(input.endMs)||input.endMs<=input.startMs||input.endMs>3600000)throw Error('播放参数无效');
      return send(res,200,await mac.playLine(input.startMs/1000,input.title,input.artist,input.endMs/1000));
    }
    if(req.method==='POST'&&url.pathname==='/api/ui-text')return send(res,200,saveUiText(await read(req,200000)));
    send(res,404,{error:{code:'NOT_FOUND',message:'接口不存在'}});
  }catch(error){
    const code=error.code||'REQUEST_FAILED';
    const status=code==='NOT_FOUND'?404:code==='MODEL_UNAVAILABLE'?503:code==='MODEL_UPSTREAM'?502:
      ['MODEL_CONFIG','COURSE_INVALID'].includes(code)?500:code==='MODEL_OUTPUT'?502:
      ['ALREADY_COMPLETED','STALE_NODE','RUN_INCOMPLETE'].includes(code)?409:400;
    send(res,status,{error:{code,message:String(error.message||'请求失败').slice(0,250)}});
  }
});}
if(require.main===module){
  loadEnv(path.join(root,'.env'));
  const port=Number(process.env.PORT||8767);
  createServer().listen(port,'127.0.0.1',()=>console.log(`VIBE Agent: http://127.0.0.1:${port}/`));
}
module.exports={createServer,capabilities};
