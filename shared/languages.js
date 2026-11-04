'use strict';

const languages=Object.freeze([
  Object.freeze({code:'ko',label:'韩语',nativeLabel:'한국어'}),
  Object.freeze({code:'ja',label:'日语',nativeLabel:'日本語'}),
  Object.freeze({code:'zh',label:'中文',nativeLabel:'中文'})
]);
const languageMap=new Map(languages.map(language=>[language.code,language]));

function normalizeLanguage(value,fallback='ko') {
  const candidate=value===undefined||value===null||value===''?fallback:value;
  if(typeof candidate!=='string')throw Object.assign(Error('学习语言无效'),{code:'INVALID_INPUT'});
  const code=candidate.trim().toLowerCase();
  if(!languageMap.has(code))throw Object.assign(Error('学习语言必须是韩语、日语或中文'),{code:'INVALID_INPUT'});
  return code;
}

function languageInfo(value,fallback='ko') {
  return languageMap.get(normalizeLanguage(value,fallback));
}

function publicLanguages() {
  return languages.map(language=>({...language}));
}

module.exports={
  languageCodes:languages.map(language=>language.code),
  languages,
  normalizeLanguage,
  languageInfo,
  publicLanguages
};
