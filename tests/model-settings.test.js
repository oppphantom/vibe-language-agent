'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const config=require('../backend/agent/model-config');
const {completeJson}=require('../backend/agent/llm');
const {recordLesson}=require('../backend/agent/model');

test.afterEach(()=>config.clearSession());

test('session model configuration never exposes or persists the API key',()=>{
  const status=config.setSession({
    endpoint:'https://ark.cn-beijing.volces.com/api/v3/responses',
    model:'deepseek-v4-1-flash-261017',apiKey:'secret-value',apiType:'responses'
  });
  assert.deepEqual(status,{
    configured:true,source:'session',endpoint:'https://ark.cn-beijing.volces.com/api/v3/responses',
    model:'deepseek-v4-1-flash-261017',apiType:'responses',apiKeySet:true
  });
  assert.equal(JSON.stringify(status).includes('secret-value'),false);
  assert.equal(config.getRuntimeConfig().apiKey,'secret-value');
  config.clearSession();
  assert.notEqual(config.getRuntimeConfig()?.apiKey,'secret-value');
});

test('model configuration rejects unsafe endpoints and invalid fields',()=>{
  assert.throws(()=>config.validate({endpoint:'http://127.0.0.1:9999/chat',model:'x',apiKey:'y',apiType:'chat_completions'}),error=>error.code==='MODEL_CONFIG');
  assert.throws(()=>config.validate({endpoint:'https://model.example/chat',model:'',apiKey:'y',apiType:'chat_completions'}),error=>error.code==='MODEL_CONFIG');
  assert.throws(()=>config.validate({endpoint:'https://model.example/chat',model:'x',apiKey:'y',apiType:'unknown'}),error=>error.code==='MODEL_CONFIG');
});

test('responses protocol sends input and parses output_text JSON',async()=>{
  let body;
  const result=await completeJson({system:'只输出 JSON',user:'测试',config:{
    endpoint:'https://ark.cn-beijing.volces.com/api/v3/responses',model:'test-model',apiKey:'test-key',apiType:'responses'
  }},async(_url,options)=>{
    body=JSON.parse(options.body);
    return {ok:true,json:async()=>({output_text:'{"ok":true}'})};
  });
  assert.equal(body.model,'test-model');
  assert.equal(body.input[0].role,'system');
  assert.deepEqual(result,{ok:true});
});

test('judge interface contains a model settings entry and key security copy',()=>{
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../frontend/index.html'),'utf8');
  assert.match(html,/id="settingsTab"/);
  assert.match(html,/id="modelApiKey"/);
  assert.match(html,/只保存在本次本机服务进程/);
});

test('record lesson uses one lyric and adjacent lines without inventing missing fields',async()=>{
  config.setSession({endpoint:'https://model.example/v1/chat/completions',model:'test',apiKey:'test',apiType:'chat_completions'});
  let request;
  const result=await recordLesson({profile:{level:'comfortable',goal:'meaning',minutes:5},line:'다시 만나',previous:'어제는 안녕',next:'함께 걸어',language:'ko'},async(_url,options)=>{
    request=JSON.parse(options.body);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({
      reading:'다시 만나',meaning:'再次相见',translation:'再次见面',context:'前后句谈相遇和同行',
      cultureNote:'仅凭这些歌词无法确定更多文化背景'
    })}}]})};
  });
  assert.deepEqual(JSON.parse(request.messages[1].content).learnerProfile,{level:'comfortable',goal:'meaning',minutes:5});
  assert.equal(result.lesson.translation,'再次见面');
  assert.match(request.messages[1].content,/함께 걸어/);
  await assert.rejects(recordLesson({line:'다시 만나',language:'ko'},async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"reading":"a"}'}}]})})),
    error=>error.code==='MODEL_OUTPUT');
});
