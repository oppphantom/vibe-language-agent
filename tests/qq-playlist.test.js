'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {importPublicPlaylist,playlistId}=require('../backend/media/qq-playlist');
const response=(id,mid,total=2)=>({ok:true,json:async()=>({req:{code:0,data:{code:0,total_song_num:total,dirinfo:{title:'完整歌单'},songlist:[{id,mid,name:mid,interval:180,singer:[{name:'歌手'}],album:{name:'专辑'}}]}}})});
test('QQ public playlist validates IDs and loads every page',async()=>{
  const payloads=[],answers=[response(1,'00000000000001'),response(2,'00000000000002')];
  const playlist=await importPublicPlaylist('https://y.qq.com/n/ryqq_v2/playlist/7039749142',async(_url,options)=>{payloads.push(JSON.parse(options.body));return answers.shift()});
  assert.equal(playlistId('?disstid=7039749142'),'7039749142');
  assert.equal(playlist.name,'完整歌单');assert.deepEqual(playlist.songs.map(song=>song.id),['1','2']);
  assert.deepEqual(payloads.map(item=>item.req.param.song_begin),[0,1]);
  assert.deepEqual(payloads.map(item=>item.req.param.onlysonglist),[0,1]);
});
