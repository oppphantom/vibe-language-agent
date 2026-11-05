'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const planJobs=require('../backend/agent/plan-jobs');
const browserJobs=require('../frontend/plan-job');

const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('a course generation job exposes real planner phases and one final result',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const created=planJobs.create({song:'input'},{planImpl:async(_input,{onProgress})=>{
    onProgress('analyzing_lyrics');await gate;
    onProgress('generating_teaching');onProgress('designing_dungeon');onProgress('completed');
    return {courseId:'course-1',title:'课程'};
  }});
  assert.equal(created.status,'queued');
  await tick();assert.equal(planJobs.get(created.id).phase,'analyzing_lyrics');
  release();await tick();await tick();
  const finished=planJobs.get(created.id);
  assert.equal(finished.status,'completed');assert.equal(finished.result.courseId,'course-1');
});

test('browser job runner reports server phases and returns the completed course',async()=>{
  const phases=[],responses=[
    {id:'job-1',status:'queued',phase:'queued'},
    {id:'job-1',status:'running',phase:'analyzing_lyrics'},
    {id:'job-1',status:'running',phase:'generating_teaching'},
    {id:'job-1',status:'running',phase:'designing_dungeon'},
    {id:'job-1',status:'completed',phase:'completed',result:{courseId:'course-1'}}
  ];
  const result=await browserJobs.run(async()=>responses.shift(),{},(_message,job)=>phases.push(job.phase),{pollMs:0});
  assert.deepEqual(phases,['queued','analyzing_lyrics','generating_teaching','designing_dungeon','completed']);
  assert.equal(result.courseId,'course-1');
});

test('browser job runner surfaces the stored model error',async()=>{
  const responses=[{id:'job-2',status:'queued',phase:'queued'},
    {id:'job-2',status:'failed',phase:'failed',error:{code:'MODEL_UPSTREAM',message:'模型调用超时'}}];
  await assert.rejects(()=>browserJobs.run(async()=>responses.shift(),{},()=>{},{pollMs:0}),error=>
    error.code==='MODEL_UPSTREAM'&&error.message==='模型调用超时');
});
