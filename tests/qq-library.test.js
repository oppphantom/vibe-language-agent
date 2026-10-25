'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {library}=require('../backend/media/qq-library');

test('QQ local library returns minimal song metadata and deduplicates IDs',async()=>{
  const rows=[
    {id:'1234',title:'Memories',artist:'RIIZE',album:'Get A Guitar',durationMs:178000,songmid:'003Do8be0UUbfy',file:'/private/example'},
    {id:'1234',title:'Memories',artist:'RIIZE',album:'Get A Guitar',durationMs:178000},
    {id:'bad',title:'invalid',artist:'RIIZE',durationMs:178000}
  ];
  assert.deepEqual(await library(async()=>JSON.stringify(rows)),[
    {id:'1234',title:'Memories',artist:'RIIZE',album:'Get A Guitar',durationMs:178000,provider:'qqmusic',songmid:'003Do8be0UUbfy'}
  ]);
});
