'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('horizontal song shelves expose a visible WebKit scrollbar thumb and track',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../frontend/style.css'),'utf8');
  assert.match(css,/:is\(#musicSongs,#qqLibraryResults,#neteaseResults\)::?-webkit-scrollbar\s*\{/);
  assert.match(css,/:is\(#musicSongs,#qqLibraryResults,#neteaseResults\)::?-webkit-scrollbar-track\s*\{/);
  assert.match(css,/:is\(#musicSongs,#qqLibraryResults,#neteaseResults\)::?-webkit-scrollbar-thumb\s*\{/);
});

test('music shelves include an always-visible range control independent of OS scrollbar settings',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../frontend/index.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../frontend/music.js'),'utf8');
  for(const id of ['musicSongsScroll','qqLibraryScroll','neteaseScroll'])assert.match(html,new RegExp(`id="${id}"[^>]+type="range"`));
  assert.match(js,/control\.oninput=.*shelf\.scrollLeft/);
  assert.match(js,/shelf\.addEventListener\('scroll'/);
});

test('judge presentation keeps only the music and learning-map experience',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../frontend/index.html'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../frontend/app.js'),'utf8');
  const music=fs.readFileSync(path.join(__dirname,'../frontend/music.js'),'utf8');
  for(const id of ['demoTab','liveTab','demo','live'])assert.doesNotMatch(html,new RegExp(`id="${id}"`));
  for(const phrase of ['离线教学演示','本地音频与歌词','未人工核对','原 VIBE 原型']){
    const pattern=new RegExp(phrase);
    assert.doesNotMatch(html,pattern);assert.doesNotMatch(app,pattern);assert.doesNotMatch(music,pattern);
  }
  assert.doesNotMatch(html,/>AI[^<]*</);
  assert.match(html,/id="musicTab"/);assert.match(html,/id="studyTab"/);
});
