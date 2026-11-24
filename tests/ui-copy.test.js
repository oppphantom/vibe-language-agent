'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../frontend/index.html'),'utf8');

test('landing copy stays honest about demo audio and model setup',()=>{
  assert.match(html,/样例为原创教学文本，不含音源/);
  assert.match(html,/样例课程无需模型/);
  for(const claim of ['语音评分','跨设备同步','逐词时间戳','开放世界']){
    assert.doesNotMatch(html,new RegExp(claim));
  }
});

test('first screen puts global navigation above the hero and keeps one primary action',()=>{
  const appBar=html.indexOf('class="app-bar"');
  const heading=html.indexOf('<h1 id="heroTitle">');
  const lede=html.indexOf('把一首歌，变成一节能玩的语言课。');
  const heroAction=html.indexOf('id="startSample"');
  assert.ok(appBar>=0&&heading>appBar&&lede>heading&&heroAction>lede);
  assert.match(html,/<button id="settingsTab" type="button"/);
  assert.doesNotMatch(html,/<button id="settingsTab"[^>]*role="tab"/);
  assert.equal((html.match(/role="tab"/g)||[]).length,2);
  assert.match(html,/id="modelStatusTag"[^>]*>模型未连接</);
});
