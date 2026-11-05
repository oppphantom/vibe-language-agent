'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.vibePlanJob=api;
})(typeof window!=='undefined'?window:null,()=>{
  const labels=typeof window!=='undefined'&&window.vibePlanPhases?window.vibePlanPhases.PLAN_PHASE_LABELS:
    require('../shared/plan-phases').PLAN_PHASE_LABELS;
  async function run(request,input,onProgress=()=>{},{pollMs=500}={}){
    let job=await request('/api/agent/plan-jobs','POST',input);
    onProgress(labels[job.phase]||labels.queued,job);
    while(!['completed','failed'].includes(job.status)){
      await new Promise(resolve=>setTimeout(resolve,pollMs));
      job=await request(`/api/agent/plan-jobs/${encodeURIComponent(job.id)}`);
      onProgress(labels[job.phase]||labels.queued,job);
    }
    if(job.status==='failed')throw Object.assign(Error(job.error?.message||'课程生成失败'),{code:job.error?.code||'REQUEST_FAILED'});
    return job.result;
  }
  return {run,labels};
});
