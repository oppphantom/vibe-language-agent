'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {begin,get,node,answer}=require('./agent/session');
const model=require('./agent/model');
const {findLyrics}=require('./media/lyrics');
const libraryIndex=require('./media/library-index');
const {songs,lines}=require('../content/fixtures/demo');
const {validateLine}=require('../shared/contract');
const mac=process.platform==='darwin'?require('./media/mac-music'):null;
const root=path.join(__dirname,'..');
const assets={'/':'frontend/index.html','/app.js':'frontend/app.js','/music.js':'frontend/music.js','/style.css':'frontend/style.css'};
const mime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'};
function send(res,status,data,type='application/json; charset=utf-8'){
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(type.startsWith('application/json')?JSON.stringify(data):data);
}
function read(req){return new Promise((resolve,reject)=>{
  const parts=[];let size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>12000){reject(Error('请求过长'));req.destroy();}else parts.push(chunk)});
  req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')))}catch{reject(Error('请求不是有效 JSON'))}});req.on('error',reject);
});}
function capabilities(mode){
  if(mode==='local_audio')return {seek:true,lineLoop:true,speed:true,wordSeek:false,reason:{wordSeek:'缺少逐词时间戳'}};
  if(mode==='mac_music')return mac?{seek:true,lineLoop:false,speed:false,wordSeek:false,reason:{lineLoop:'Mac 音乐仅支持单次自动暂停',speed:'桥接未实现变速',wordSeek:'缺少逐词时间戳'}}:{seek:false,lineLoop:false,speed:false,wordSeek:false,reason:{all:'仅 macOS 可用'}};
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
    if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,mode:'offline_demo',modelConfigured:model.configured()});
    if(req.method==='GET'&&url.pathname==='/api/songs')return send(res,200,{songs,lines,provenance:'原创教学样例；非实时 Agent 生成'});
    if(req.method==='GET'&&url.pathname==='/api/playback/capabilities')return send(res,200,{offline:capabilities('offline'),localAudio:capabilities('local_audio'),macMusic:capabilities('mac_music')});
    if(req.method==='GET'&&url.pathname.startsWith('/api/sessions/')){
      const id=url.pathname.split('/')[3];
      return send(res,200,url.pathname.endsWith('/node')?node(id):get(id));
    }
    if(req.method==='POST'&&url.pathname==='/api/sessions')return send(res,201,begin((await read(req)).songId));
    if(req.method==='POST'&&url.pathname==='/api/answers')return send(res,200,answer(await read(req)));
    if(req.method==='POST'&&url.pathname==='/api/lyrics/search'){
      const input=await read(req);
      if(!Number.isInteger(input.durationMs)||input.durationMs<1000||input.durationMs>3600000)throw Error('歌曲时长无效');
      const result=await findLyrics(input.title,input.artist,input.durationMs);
      for(const line of result.lines)validateLine(line);
      return send(res,200,result);
    }
    if(req.method==='POST'&&url.pathname==='/api/agent/explain')return send(res,200,await model.explain(await read(req)));
    if(req.method==='GET'&&url.pathname==='/api/mac/status'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      return send(res,200,await mac.status());
    }
    if(req.method==='GET'&&url.pathname==='/api/mac/library'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const artist=url.searchParams.get('artist')||'';
      return send(res,200,{artist,songs:await libraryIndex.library(artist,{macBridge:mac})});
    }
    if(req.method==='POST'&&url.pathname==='/api/mac/discover'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const input=await read(req),data=await libraryIndex.index(input.artist,{macBridge:mac});
      return send(res,200,libraryIndex.findHits(data,input.expression));
    }
    if(req.method==='POST'&&url.pathname==='/api/mac/play-line'){
      if(!mac)return send(res,503,{error:{code:'PLATFORM_UNAVAILABLE',message:'仅 macOS 可用'}});
      const input=await read(req);
      if(typeof input.title!=='string'||!input.title||input.title.length>150||typeof input.artist!=='string'||!input.artist||input.artist.length>150||
        !Number.isFinite(input.startMs)||input.startMs<0||!Number.isFinite(input.endMs)||input.endMs<=input.startMs||input.endMs>3600000)throw Error('播放参数无效');
      return send(res,200,await mac.playLine(input.startMs/1000,input.title,input.artist,input.endMs/1000));
    }
    send(res,404,{error:{code:'NOT_FOUND',message:'接口不存在'}});
  }catch(error){
    const code=error.code||'REQUEST_FAILED';
    const status=code==='NOT_FOUND'?404:code==='MODEL_UNAVAILABLE'?503:code==='MODEL_UPSTREAM'?502:code==='ALREADY_COMPLETED'?409:400;
    send(res,status,{error:{code,message:String(error.message||'请求失败').slice(0,250)}});
  }
});}
if(require.main===module){const port=Number(process.env.PORT||8767);createServer().listen(port,'127.0.0.1',()=>console.log(`VIBE Agent: http://127.0.0.1:${port}/`));}
module.exports={createServer,capabilities};
