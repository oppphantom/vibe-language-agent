'use strict';
const {randomUUID}=require('node:crypto');
const planner=require('./planner');
const {PLAN_PHASES}=require('../../shared/plan-phases');

const jobs=new Map();
const ttlMs=2*60*60*1000;
const phases=new Set(PLAN_PHASES);

function prune(){
  const now=Date.now();
  for(const [id,job] of jobs)if(job.expiresAt<=now)jobs.delete(id);
}
function view(job){
  return {id:job.id,status:job.status,phase:job.phase,createdAt:job.createdAt,updatedAt:job.updatedAt,
    ...(job.result?{result:job.result}:{}),...(job.error?{error:job.error}:{})};
}
function update(job,phase){
  if(!phases.has(phase)||['completed','failed'].includes(job.status))return;
  job.phase=phase;job.status=phase==='completed'?'completed':'running';job.updatedAt=new Date().toISOString();
}
function create(input,{planImpl=planner.plan}={}){
  prune();
  const now=new Date().toISOString(),job={id:randomUUID(),status:'queued',phase:'queued',createdAt:now,updatedAt:now,
    expiresAt:Date.now()+ttlMs,result:null,error:null};
  jobs.set(job.id,job);
  job.promise=Promise.resolve().then(()=>planImpl(input,{onProgress:phase=>{if(phase!=='completed')update(job,phase)}})).then(result=>{
    job.result=result;update(job,'completed');return result;
  }).catch(error=>{
    job.status='failed';job.phase='failed';job.updatedAt=new Date().toISOString();
    job.error={code:error.code||'REQUEST_FAILED',message:String(error.message||'课程生成失败').slice(0,250)};
  });
  return view(job);
}
function get(id){
  prune();
  if(typeof id!=='string'||!id.trim()||id.length>100)return null;
  const job=jobs.get(id);return job?view(job):null;
}

module.exports={create,get};
