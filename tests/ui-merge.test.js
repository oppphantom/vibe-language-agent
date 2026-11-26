'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../frontend',name),'utf8');

test('landing layout retains all statically referenced learning and playback controls',()=>{
  const ids=[...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,'duplicate DOM IDs');
  for(const file of ['app.js','music.js','learning.js']){
    for(const [,id] of read(file).matchAll(/\$\('([^']+)'\)/g)){
      assert.ok(ids.includes(id),`${file} needs #${id}`);
    }
  }
});

test('deferred tab switching preserves accessibility, last selection, and visible focus',()=>{
  const nodes=new Map(),frames=new Map();let serial=0,focused=null;
  const classes=()=>{const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),toggle(x,on){if(on)values.add(x);else values.delete(x)},contains:x=>values.has(x)}};
  const $=id=>{
    if(!nodes.has(id))nodes.set(id,{hidden:id!=='music',attrs:{},classList:classes(),setAttribute(k,v){this.attrs[k]=v},focus(){focused=id}});
    return nodes.get(id);
  };
  const state={restarting:false,finalPlaybackToken:0};
  const context={$ ,state,document:{body:{classList:classes()},documentElement:{classList:classes()}},
    requestAnimationFrame(fn){frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id),
    stopNotePlaybackRetry(){},closeGameModal(){}};
  const source=read('app.js');
  vm.runInNewContext(source.slice(source.indexOf('let modeApplyFrame='),source.indexOf("$('musicTab').onclick=")),context);
  const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn()}};
  context.mode('study');
  assert.equal($('studyTab').attrs['aria-selected'],'true');
  assert.equal($('study').hidden,true);
  context.mode('settings');flush();flush();
  assert.equal($('settings').hidden,false);
  assert.equal($('study').hidden,true);
  assert.equal(focused,'settingsHeading');
  assert.equal($('settingsTab').attrs['aria-pressed'],'true');
  context.mode('music',()=>{assert.equal($('music').hidden,false);$('goLibrary').focus()});
  flush();flush();flush();
  assert.equal(focused,'goLibrary');
  assert.equal($('learningLanguage').disabled,false);
  assert.equal(context.document.documentElement.classList.contains('is-tab-switching'),false);
});
