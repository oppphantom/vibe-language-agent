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
