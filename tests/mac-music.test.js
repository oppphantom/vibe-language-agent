'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {libraryTracks}=require('../backend/media/mac-music');

test('blank Mac Music query enumerates all library tracks',async()=>{
  let invocation;
  const runFileImpl=async(...args)=>{invocation=args;return {stdout:'A\tRIIZE\t178.01\nB\taespa\t175\n'}};
  const tracks=await libraryTracks('',runFileImpl);
  assert.equal(invocation[1].at(-1),'');
  assert.match(invocation[1][1],/every track of library playlist 1/);
  assert.deepEqual(tracks.map(track=>track.title),['A','B']);
});
