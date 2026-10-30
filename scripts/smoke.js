'use strict';
const assert=require('node:assert/strict');
const {createServer}=require('../backend/server');
async function main(){
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
  try{
    assert.equal((await call('/api/health')).data.ok,true);
    const created=await call('/api/sessions','POST',{songId:'demo-morning'});assert.equal(created.status,201);
    const id=created.data.id;
    assert.equal(created.data.progress.total,3);
    assert.equal(created.data.currentNodeId,'demo-dasi');
    let node=(await call(`/api/sessions/${id}/node`)).data;
    assert.equal(node.id,'demo-dasi');assert.equal(node.options.length,3);
    assert.equal(node.correctIndex,undefined);
    assert.equal(node.personaId,'polysemy_tutor');
    assert.ok(node.morphologyNote);
    const wrong=await call('/api/answers','POST',{sessionId:id,nodeId:node.id,submissionId:'wrong-1',choice:1,attempt:1});
    assert.equal(wrong.data.feedback.verdict,'retry');
    assert.equal(wrong.data.session.progress.completed,0);
    const right1=await call('/api/answers','POST',{sessionId:id,nodeId:'demo-dasi',submissionId:'right-1',choice:0,attempt:2,hintUsed:true});
    assert.equal(right1.data.session.progress.completed,1);
    assert.equal(right1.data.session.currentNodeId,'demo-dasi-contrast');
    node=(await call(`/api/sessions/${id}/node`)).data;
    assert.equal(node.id,'demo-dasi-contrast');
    const right2=await call('/api/answers','POST',{sessionId:id,nodeId:'demo-dasi-contrast',submissionId:'right-2',choice:0,attempt:1});
    assert.equal(right2.data.session.progress.completed,2);
    assert.equal(right2.data.session.currentNodeId,'demo-dasi-final');
    const right3=await call('/api/answers','POST',{sessionId:id,nodeId:'demo-dasi-final',submissionId:'right-3',choice:0,attempt:1});
    assert.equal(right3.data.session.progress.completed,3);
    assert.equal(right3.data.session.currentNodeId,null);
    assert.equal((await call(`/api/sessions/${id}`)).data.history.length,4);
    console.log('Offline HTTP smoke passed: choose → wrong → remediate → three-node path → completed session');
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
