'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../frontend/play-once');

test('final lyric plays once and only replays after another explicit run',async()=>{
  let plays=0;
  const controller=create({play:async()=>{plays++;return true}});
  assert.equal(await controller.run(),true);
  assert.equal(plays,1);
  assert.equal(await controller.run(),true);
  assert.equal(plays,2);
});

test('repeated clicks while a lyric is starting do not stack playback',async()=>{
  let plays=0,finish;
  const controller=create({play:()=>{plays++;return new Promise(resolve=>{finish=resolve})}});
  const first=controller.run();
  assert.equal(await controller.run(),false);
  assert.equal(plays,1);
  finish(true);
  assert.equal(await first,true);
});
