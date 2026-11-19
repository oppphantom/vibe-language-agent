'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../frontend/app.js'),'utf8');
test('completion controls are visible after an audio-choice question',()=>{
  const nodes=new Map();
  const $=id=>{
    if(!nodes.has(id))nodes.set(id,{hidden:true,children:[],textContent:'',
      append(...items){this.children.push(...items)},replaceChildren(){this.children=[]}});
    return nodes.get(id);
  };
  $('modalAudioChoices').hidden=false;
  $('modalAudioChoices').append({textContent:'旧音频选项'});
  const state={session:{status:'completed',mastery:{summary:'本轮完成'}}};
  const fn=source.slice(source.indexOf('function showFinishChoice(){'),source.indexOf('function finalLineEvidence('));
  vm.runInNewContext(fn+';showFinishChoice();',{$,state,stopNotePlaybackRetry(){},text:()=>({}),
    restartAdventure(){},closeGameModal(){},mode(){}});
  assert.equal($('modalOptions').hidden,false);
  assert.equal($('modalAudioChoices').hidden,true);
  assert.equal($('modalAudioChoices').children.length,0);
  assert.equal($('modalOptions').children.length,2);
});
test('teaching prose explains internal references in learner language',()=>{
  const fn=source.slice(source.indexOf('function learnerCopy('),source.indexOf('function renderTeaching(){'));
  const context={};vm.runInNewContext(fn,context);
  assert.equal(context.learnerCopy('starter 先练 L16，参考 story 节点'),'初学者 先练 第 16 句，参考 相关练习');
});
