'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VibePlayOnce=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({play}){
    if(typeof play!=='function')throw Error('单次播放缺少执行函数');
    let running=false;
    async function run(){
      if(running)return false;
      running=true;
      try{return Boolean(await play())}
      finally{running=false}
    }
    return {run,get running(){return running}};
  }
  return {create};
});
