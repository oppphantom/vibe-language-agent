'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {library}=require('../backend/media/netease-library');

test('Netease local library exposes only song metadata and ignores malformed rows',async()=>{
  const rows=[
    {id:'2114737220',jsonStr:JSON.stringify({name:'Love 119',artists:[{name:'RIIZE'}],album:{name:'Love 119'},duration:173489,privateToken:'not for output'})},
    {id:'2114737220',jsonStr:JSON.stringify({name:'duplicate',artists:[{name:'RIIZE'}],duration:173489})},
    {id:'bad',jsonStr:'{}'}
  ];
  const songs=await library(async()=>JSON.stringify(rows));
  assert.deepEqual(songs,[{id:'2114737220',title:'Love 119',artist:'RIIZE',album:'Love 119',durationMs:173489,provider:'netease'}]);
});
