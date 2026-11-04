'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {library,index,findHits}=require('../backend/media/library-index');
test('library filters the selected artist and keeps duration in milliseconds',async()=>{
  const macBridge={libraryTracks:async()=>[{title:'A',artist:'RIIZE',duration:178.013},{title:'B',artist:'Other',duration:175}]};
  assert.deepEqual(await library('RIIZE',{macBridge}),[{title:'A',artist:'RIIZE',language:'ko',durationMs:178013}]);
  assert.equal((await library('RIIZE',{macBridge,language:'ja'}))[0].language,'ja');
});
test('discover returns evidence from two songs without inventing semantic differences',async()=>{
  const tracks=[{title:'A',artist:'RIIZE',durationMs:100000},{title:'B',artist:'RIIZE',durationMs:100000}];
  const findLyricsImpl=async title=>({status:'unverified',source:'LRCLIB',lines:[
    {text:'上一句',startMs:0,endMs:1000},{text:title+' 다시',startMs:1000,endMs:2000},{text:'下一句',startMs:2000,endMs:3000}
  ]});
  const data=await index('TEST-'+Date.now(),{libraryImpl:async()=>tracks,findLyricsImpl});
  const hits=findHits(data,'다시');assert.equal(hits.songCount,2);assert.equal(hits.hits.length,2);
  assert.equal(hits.hits[0].before,'上一句');assert.match(hits.matchMethod,/尚未核对/);
});
