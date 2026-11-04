'use strict';
const fs=require('node:fs');
const path=require('node:path');

function unquote(value) {
  const trimmed=value.trim();
  if(trimmed.length>=2&&trimmed[0]===trimmed.at(-1)&&['"',"'"].includes(trimmed[0])) {
    const inner=trimmed.slice(1,-1);
    return trimmed[0]==='"'?inner.replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\'):inner;
  }
  return trimmed;
}

function loadEnv(filePath=path.join(__dirname,'..','.env')) {
  if(!fs.existsSync(filePath))return false;
  const source=fs.readFileSync(filePath,'utf8').replace(/^\uFEFF/,'');
  for(const row of source.split(/\r?\n/)) {
    const line=row.trim();
    if(!line||line.startsWith('#'))continue;
    const match=line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if(!match||Object.hasOwn(process.env,match[1]))continue;
    process.env[match[1]]=unquote(match[2]);
  }
  return true;
}

module.exports={loadEnv};
