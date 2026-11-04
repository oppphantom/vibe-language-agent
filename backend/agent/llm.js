'use strict';

function configured() {
  return Boolean(process.env.VIBE_MODEL_API_KEY&&process.env.VIBE_MODEL_NAME&&process.env.VIBE_MODEL_ENDPOINT);
}

function modelError(message,code) {
  return Object.assign(Error(message),{code});
}

async function completeJson({system,user,timeoutMs=30000},fetchImpl=fetch) {
  if(!configured())throw modelError('模型未配置；请检查本机 .env 中的模型设置','MODEL_UNAVAILABLE');
  if(typeof system!=='string'||!system.trim()||typeof user!=='string'||!user.trim())throw modelError('模型请求材料无效','INVALID_INPUT');
  let endpoint;
  try{endpoint=new URL(process.env.VIBE_MODEL_ENDPOINT)}catch{throw modelError('模型地址不是有效 URL','MODEL_CONFIG')}
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hostname==='localhost'||/^\d+\.\d+\.\d+\.\d+$/.test(endpoint.hostname)){
    throw modelError('模型地址必须是受信任的 HTTPS 服务','MODEL_CONFIG');
  }
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.max(1000,Math.min(120000,timeoutMs))),
      headers:{Authorization:'Bearer '+process.env.VIBE_MODEL_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.VIBE_MODEL_NAME,stream:false,response_format:{type:'json_object'},
        messages:[{role:'system',content:system},{role:'user',content:user}]
      })
    });
  }catch(error){
    throw modelError('模型服务连接失败：'+String(error.message||'未知错误').slice(0,120),'MODEL_UPSTREAM');
  }
  if(!response.ok)throw modelError('模型服务返回 HTTP '+response.status,'MODEL_UPSTREAM');
  let content;
  try{content=(await response.json())?.choices?.[0]?.message?.content}catch{throw modelError('模型响应不是有效 JSON','MODEL_OUTPUT')}
  if(typeof content==='string'&&content.length>500000)throw modelError('模型响应过长','MODEL_OUTPUT');
  let parsed;
  try{parsed=JSON.parse(typeof content==='string'?content.replace(/^```(?:json)?\s*|\s*```$/gi,''):'null')}catch{
    throw modelError('模型输出内容不是有效 JSON','MODEL_OUTPUT');
  }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw modelError('模型输出必须是 JSON 对象','MODEL_OUTPUT');
  return parsed;
}

module.exports={configured,completeJson};
