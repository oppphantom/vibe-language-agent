'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {search}=require('../backend/media/netease-catalog');
test('Netease search keeps song identity, artist and duration for verified playback',async()=>{
  const fetchImpl=async()=>({ok:true,json:async()=>({code:200,result:{songs:[
    {id:2114737220,name:'Love 119',artists:[{name:'RIIZE'}],duration:173489},
    {id:2114737220,name:'Love 119',artists:[{name:'RIIZE'}],duration:173489},
    {id:'bad',name:'unknown',artists:[],duration:0}
  ]}})});
  assert.deepEqual(await search('RIIZE Love 119',fetchImpl),[{id:'2114737220',title:'Love 119',artist:'RIIZE',album:'',durationMs:173489,provider:'netease'}]);
});
