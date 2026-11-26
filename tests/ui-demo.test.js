'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../frontend/index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../frontend/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../frontend/style.css'),'utf8');

test('landing directs learners to their own music',()=>{
  for(const id of ['goLibrary','stepRail','stepStatus','modelStatusStrip','modelStatusHint','studyTabHint','studyProvenance','openModelFromStudy','planPhases']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html,/id="(?:sampleCourse|sampleSongs|sampleStatus|startSample|goSampleFromStudy)"/);
  assert.doesNotMatch(html,/先体验样例课程/);
  assert.match(html,/role="tablist"/);
  assert.match(html,/aria-controls="music"/);
  assert.match(html,/aria-controls="study"/);
  assert.match(html,/aria-describedby="musicStudyLockText"/);
  assert.match(html,/class="app-bar"/);
  const library=html.indexOf('id="musicLibrary"');
  const stepRail=html.indexOf('id="stepRail"');
  const study=html.indexOf('id="musicStudy"');
  assert.ok(library>=0&&stepRail>library&&stepRail<study);
  assert.doesNotMatch(html,/step__num/);
});

test('duplicate instructions keep a single source of truth',()=>{
  for(const phrase of ['连接我的音乐','连接当前音乐来源','连接模型后生成']){
    assert.doesNotMatch(html,new RegExp(phrase));
  }
  assert.ok((html.match(/生成学习地图/g)||[]).length<=2);
  assert.equal((html.match(/原创教学样例 · 非实时 Agent 生成/g)||[]).length,0);
});

test('demo IA styles and secondary actions exist',()=>{
  for(const selector of ['button.secondary','.capability-grid','.step-rail','.model-strip','.learning-cta','.agent-box.is-secondary']){
    assert.ok(css.includes(selector),`missing ${selector}`);
  }
  assert.match(css,/\.app-bar\{[^}]*position:sticky/);
  assert.doesNotMatch(css,/\.step-rail\{[^}]*position:sticky/);
});
