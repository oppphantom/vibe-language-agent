'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const session=require('../backend/agent/session');
const {analyzeMaterial,validateCourse}=require('../backend/agent/curriculum');
const {journey}=require('../content/fixtures/demo');

function finishTeaching(sessionId,nodeId,correctIndex=journey.nodes[0].correctIndex){
  for(const submissionId of ['teach-brief','teach-reading','teach-context']){
    session.teach({sessionId,nodeId,submissionId,action:'continue'});
  }
  return session.teach({sessionId,nodeId,submissionId:'teach-check',action:'answer',choice:correctIndex});
}

test('the authored course starts a public dungeon without exposing answer keys',()=>{
  assert.equal(validateCourse(journey),journey);
  const created=session.begin('demo-morning'),current=session.node(created.id);
  assert.equal(current.status,'active');assert.equal(current.interaction,'dungeon');
  assert.equal(current.teaching.phase,'brief');
  assert.equal(current.teaching.goal.length>0,true);
  assert.equal(Object.hasOwn(current.teaching,'correctIndex'),false);
  assert.equal(current.room.tiles.length,9);assert.ok(current.room.tiles.every(row=>row.length===19));
  assert.ok(current.map.length>=3);assert.equal(current.map[0].status,'active');
  assert.ok(current.map.slice(1).every(item=>item.status==='locked'));
  assert.equal(Object.hasOwn(current,'correctIndex'),false);
  assert.equal(Object.hasOwn(current.room,'objects'),false);
  assert.equal(current.room.pending,null);
});

test('a learner must finish teaching before moving into the dungeon assessment',()=>{
  const created=session.begin('demo-morning'),current=session.node(created.id);
  const move={sessionId:created.id,nodeId:current.id,submissionId:'too-early',direction:'right'};
  assert.throws(()=>session.move(move),error=>error.code==='TEACHING_REQUIRED');
});

test('teaching reveals reading and context in order, then remediation precedes a retry',()=>{
  const created=session.begin('demo-morning'),nodeId=session.node(created.id).id;
  let result=session.teach({sessionId:created.id,nodeId,submissionId:'phase-1',action:'continue'});
  assert.equal(result.node.teaching.phase,'reading');assert.ok(result.node.teaching.chunks.length);
  result=session.teach({sessionId:created.id,nodeId,submissionId:'phase-2',action:'continue'});
  assert.equal(result.node.teaching.phase,'context');assert.ok(result.node.teaching.translation);
  result=session.teach({sessionId:created.id,nodeId,submissionId:'phase-3',action:'continue'});
  assert.equal(result.node.teaching.phase,'check');assert.equal(result.node.teaching.check.options.length,3);
  const correctIndex=journey.nodes[0].correctIndex,wrongIndex=(correctIndex+1)%3;
  result=session.teach({sessionId:created.id,nodeId,submissionId:'wrong-check',action:'answer',choice:wrongIndex});
  assert.equal(result.event.type,'teaching-remedial');assert.equal(result.node.teaching.phase,'reading');
  session.teach({sessionId:created.id,nodeId,submissionId:'phase-4',action:'continue'});
  session.teach({sessionId:created.id,nodeId,submissionId:'phase-5',action:'continue'});
  result=session.teach({sessionId:created.id,nodeId,submissionId:'right-check',action:'answer',choice:correctIndex});
  assert.equal(result.event.type,'teaching-complete');assert.equal(result.node.teaching.phase,'ready');
});

test('material analysis refuses a target with fewer than two usable contexts',()=>{
  const materials=[
    {id:'one',text:'다시 만나자',songId:'s'},
    {id:'two',text:'다른 말',songId:'s'}
  ];
  assert.equal(analyzeMaterial(materials,'다시').sufficient,false);
  materials.push({id:'three',text:'내일 다시 보자',songId:'s'});
  const analysis=analyzeMaterial(materials,'다시');
  assert.equal(analysis.sufficient,true);assert.equal(analysis.expressionHits,2);
});

test('movement is idempotent and old rooms cannot advance a session',()=>{
  const created=session.begin('demo-morning'),current=session.node(created.id);
  finishTeaching(created.id,current.id);
  const input={sessionId:created.id,nodeId:current.id,submissionId:'move-one',direction:'right'};
  const moved=session.move(input);
  assert.equal(moved.node.id,current.id);
  assert.notDeepEqual(moved.node.room.tiles,current.room.tiles);
  assert.deepEqual(session.move(input),moved);
  assert.throws(()=>session.move({...input,submissionId:'stale',nodeId:'not-current'}),error=>error.code==='STALE_NODE');
});

test('invalid evidence makes the course fail closed',()=>{
  const broken=structuredClone(journey);
  broken.nodes[0].evidenceLineIds=['missing-line'];
  assert.throws(()=>validateCourse(broken),error=>error.code==='COURSE_INVALID');
  assert.throws(()=>session.begin('not-a-demo-song'),error=>error.code==='NOT_FOUND');
});
