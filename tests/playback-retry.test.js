'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../frontend/playback-retry');

test('playback retry continues after failures and stops on the first success',async()=>{
  let plays=0,successes=0;
  const controller=create({
    play:async()=>++plays>=3,
    shouldContinue:()=>true,
    onSuccess:()=>{successes++},
    wait:async()=>{}
  });
  await controller.start();
  assert.equal(plays,3);assert.equal(successes,1);
});

test('playback retry stops as soon as the question is answered or leaves the screen',async()=>{
  let plays=0,allowed=true;
  const controller=create({
    play:async()=>{plays++;return false},
    shouldContinue:()=>allowed,
    onFailure:()=>{allowed=false},
    wait:async()=>{}
  });
  await controller.start();
  assert.equal(plays,1);
});

test('playback retry can be cancelled while a request is in flight',async()=>{
  let plays=0,finish;
  const controller=create({
    play:()=>{plays++;return new Promise(resolve=>{finish=resolve})},
    shouldContinue:()=>true,
    wait:async()=>{}
  });
  const pending=controller.start();
  while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
  controller.cancel();finish(false);
  await pending;
  assert.equal(plays,1);assert.equal(controller.cancelled,true);
});
