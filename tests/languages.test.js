'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const session=require('../backend/agent/session');
const {validateCourse}=require('../backend/agent/curriculum');
const {normalizeLanguage,languageInfo,publicLanguages}=require('../shared/languages');
const {validateSong}=require('../shared/contract');
const {findLyrics}=require('../backend/media/lyrics');
const {findNeteaseLyrics}=require('../backend/media/netease-lyrics');
const {findQqLyrics}=require('../backend/media/qq-lyrics');
const model=require('../backend/agent/model');
const {songs,journeys}=require('../content/fixtures/demo');

test('language registry accepts Korean, Japanese and Chinese and rejects unknown codes',()=>{
  assert.deepEqual(publicLanguages().map(item=>item.code),['ko','ja','zh']);
  assert.equal(languageInfo('ja').nativeLabel,'日本語');
  assert.equal(normalizeLanguage('ZH'),'zh');
  assert.throws(()=>normalizeLanguage('en'),error=>error.code==='INVALID_INPUT');
  for(const song of songs)assert.equal(validateSong(song).languageLabel,languageInfo(song.language).label);
});

test('all three authored courses start playable ASCII dungeons in their selected language',()=>{
  assert.deepEqual(journeys.map(course=>course.language),['ko','ja','zh']);
  for(const course of journeys){
    assert.equal(validateCourse(course),course);
    const created=session.begin(course.songIds[0]);
    assert.equal(created.language,course.language);
    assert.equal(created.languageLabel,languageInfo(course.language).label);
    const current=session.node(created.id);
    assert.equal(current.language,course.language);assert.equal(current.interaction,'dungeon');
    assert.equal(current.room.tiles.length,9);assert.ok(current.room.tiles.every(row=>row.length===19));
    assert.ok(current.map.length>=3);
  }
});

test('a course cannot mix its declared language with songs in another language',()=>{
  const broken=structuredClone(journeys.find(course=>course.language==='ja'));
  broken.songIds.push('demo-morning');
  assert.throws(()=>validateCourse(broken),error=>error.code==='COURSE_INVALID');
});

test('lyric adapters preserve an explicitly selected Japanese or Chinese language',async()=>{
  const fake=async()=>({ok:true,json:async()=>[{
    id:7,trackName:'未来',artistName:'歌手',duration:120,syncedLyrics:'[00:01.00]また会おう'
  }]});
  const japanese=await findLyrics('未来','歌手',120000,fake,'ja');
  assert.equal(japanese.song.language,'ja');
  const netease=await findNeteaseLyrics(
    {title:'未来',artist:'歌手',durationMs:120000,language:'zh'},
    async url=>({ok:true,json:async()=>url.pathname.includes('/search/')
      ?{code:200,result:{songs:[{id:8,name:'未来',artists:[{name:'歌手'}],duration:120000}]}}
      :{code:200,lrc:{lyric:'[00:01.00]下次再见'}}})
  );
  assert.equal(netease.song.language,'zh');
  const qqSong={id:'9',songmid:'003Do8be0UUbfy',title:'未来',artist:'歌手',album:'',durationMs:120000};
  const qq=await findQqLyrics(
    {title:'未来',artist:'歌手',durationMs:120000,language:'ja',providerId:'9'},
    {
      libraryImpl:async()=>[qqSong],
      fetchImpl:async()=>({ok:true,json:async()=>({code:0,lyric:Buffer.from('[00:01.00]また会おう').toString('base64')})}),
      fallback:()=>{throw Error('unexpected fallback')}
    }
  );
  assert.equal(qq.song.language,'ja');
  const fallback=await findQqLyrics(
    {title:'未来',artist:'歌手',durationMs:120000,language:'zh'},
    {
      libraryImpl:async()=>{throw Error('no local library')},
      fallback:async(_title,_artist,_duration,_fetch,language)=>({status:'no_matched_version',language,lines:[]})
    }
  );
  assert.equal(fallback.language,'zh');
  assert.throws(()=>normalizeLanguage('ko-kr'),error=>error.code==='INVALID_INPUT');
});

test('model explanation selects the teaching prompt from the requested language',async()=>{
  const previous={
    endpoint:process.env.VIBE_MODEL_ENDPOINT,
    name:process.env.VIBE_MODEL_NAME,
    key:process.env.VIBE_MODEL_API_KEY
  };
  process.env.VIBE_MODEL_ENDPOINT='https://model.example/v1/chat/completions';
  process.env.VIBE_MODEL_NAME='test-model';
  process.env.VIBE_MODEL_API_KEY='test-key';
  let requestBody;
  const fetchImpl=async(_url,options)=>{
    requestBody=JSON.parse(options.body);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
      meaning:'再次',context:'再次见面',uncertainty:'仍需核对'
    })}}]})};
  };
  try{
    const result=await model.explain({expression:'また',language:'ja',lines:['来週、また会いましょう。']},fetchImpl);
    assert.equal(result.language,'ja');assert.equal(result.languageLabel,'日语');
    assert.match(requestBody.messages[0].content,/日语教学助手/);
    assert.equal(JSON.parse(requestBody.messages[1].content).language,'ja');
  }finally{
    for(const [key,value] of [
      ['VIBE_MODEL_ENDPOINT',previous.endpoint],
      ['VIBE_MODEL_NAME',previous.name],
      ['VIBE_MODEL_API_KEY',previous.key]
    ]){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
