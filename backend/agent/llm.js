'use strict';
const modelConfig=require('./model-config');

function configured() {
  return Boolean(modelConfig.getRuntimeConfig());
}

function modelError(message,code) {
  return Object.assign(Error(message),{code});
}

async function completeJson({system,user,timeoutMs=30000,config:overrideConfig},fetchImpl=fetch) {
  const config=overrideConfig?modelConfig.validate(overrideConfig):modelConfig.getRuntimeConfig();
  if(!config)throw modelError('模型未配置；请在设置页连接模型，或检查本机 .env','MODEL_UNAVAILABLE');
  if(typeof system!=='string'||!system.trim()||typeof user!=='string'||!user.trim())throw modelError('模型请求材料无效','INVALID_INPUT');
  const endpoint=new URL(config.endpoint);
  const body=config.apiType==='responses'?{
    model:config.model,stream:false,
    input:[
      {role:'system',content:[{type:'input_text',text:system}]},
      {role:'user',content:[{type:'input_text',text:user}]}
    ]
  }:{
    model:config.model,stream:false,response_format:{type:'json_object'},
    messages:[{role:'system',content:system},{role:'user',content:user}]
  };
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.max(1000,Math.min(120000,timeoutMs))),
      headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }catch(error){
    if(error?.name==='TimeoutError'||String(error?.message||'').toLowerCase().includes('timeout')){
      throw modelError(`模型服务在 ${Math.round(Math.max(1000,Math.min(120000,timeoutMs))/1000)} 秒内没有完成响应`,'MODEL_UPSTREAM');
    }
    throw modelError('模型服务连接失败：'+String(error.message||'未知错误').slice(0,120),'MODEL_UPSTREAM');
  }
  if(!response.ok)throw modelError('模型服务返回 HTTP '+response.status,'MODEL_UPSTREAM');
  let content;
  try{
    const payload=await response.json();
    if(config.apiType==='responses'){
      content=payload?.output_text;
      if(typeof content!=='string')content=payload?.output?.flatMap(item=>item?.content||[]).find(item=>item?.type==='output_text'&&typeof item.text==='string')?.text;
    }else content=payload?.choices?.[0]?.message?.content;
  }catch{throw modelError('模型响应不是有效 JSON','MODEL_OUTPUT')}
  if(typeof content==='string'&&content.length>500000)throw modelError('模型响应过长','MODEL_OUTPUT');
  let parsed;
  try{parsed=JSON.parse(typeof content==='string'?content.replace(/^```(?:json)?\s*|\s*```$/gi,''):'null')}catch{
    throw modelError('模型输出内容不是有效 JSON','MODEL_OUTPUT');
  }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw modelError('模型输出必须是 JSON 对象','MODEL_OUTPUT');
  return parsed;
}

module.exports={configured,completeJson};
