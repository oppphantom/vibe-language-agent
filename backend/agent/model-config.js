'use strict';

let sessionConfig=null;
const TYPES=new Set(['chat_completions','responses']);

function modelError(message){return Object.assign(Error(message),{code:'MODEL_CONFIG'})}

function inferType(endpoint,type){
  if(type)return type;
  return /\/responses\/?$/i.test(endpoint||'')?'responses':'chat_completions';
}

function validate(input,{allowMissingKey=false}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw modelError('模型配置无效');
  const endpoint=String(input.endpoint||'').trim();
  const model=String(input.model||'').trim();
  const apiKey=String(input.apiKey||'').trim();
  const apiType=inferType(endpoint,String(input.apiType||'').trim());
  if(!endpoint||endpoint.length>500)throw modelError('请填写模型接口地址');
  let url;
  try{url=new URL(endpoint)}catch{throw modelError('模型接口地址不是有效 URL')}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='localhost'||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||url.hostname.endsWith('.local')){
    throw modelError('模型接口必须是无账号、查询参数和片段的受信任 HTTPS 地址');
  }
  if(!model||model.length>160)throw modelError('请填写有效模型名称');
  if(!TYPES.has(apiType))throw modelError('不支持的模型接口类型');
  if(!allowMissingKey&&(!apiKey||apiKey.length>5000))throw modelError('请填写有效 API Key');
  return {endpoint:url.toString(),model,apiKey,apiType};
}

function envConfig(){
  const endpoint=process.env.VIBE_MODEL_ENDPOINT;
  const model=process.env.VIBE_MODEL_NAME;
  const apiKey=process.env.VIBE_MODEL_API_KEY;
  if(!endpoint||!model||!apiKey)return null;
  return validate({endpoint,model,apiKey,apiType:process.env.VIBE_MODEL_API_TYPE||''});
}

function getRuntimeConfig(){return sessionConfig||envConfig()}

function publicConfig(){
  const value=getRuntimeConfig();
  if(!value)return {configured:false,source:'none',endpoint:'',model:'',apiType:'chat_completions',apiKeySet:false};
  return {configured:true,source:sessionConfig?'session':'environment',endpoint:value.endpoint,model:value.model,apiType:value.apiType,apiKeySet:true};
}

function setSession(input){
  sessionConfig=Object.freeze(validate(input));
  return publicConfig();
}

function clearSession(){sessionConfig=null;return publicConfig()}

module.exports={validate,getRuntimeConfig,publicConfig,setSession,clearSession,inferType};
