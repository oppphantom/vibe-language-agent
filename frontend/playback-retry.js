'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VibePlaybackRetry=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create({
    play,
    shouldContinue=()=>true,
    onAttempt=()=>{},
    onSuccess=()=>{},
    onFailure=()=>{},
    delay=attempt=>Math.min(4000,350*Math.pow(2,Math.max(0,attempt-1))),
    wait
  }){
    if(typeof play!=='function')throw Error('播放重试缺少执行函数');
    let cancelled=false,running=false,attempt=0,timer=null,wakeWait=null;
    const sleep=ms=>new Promise(resolve=>{
      wakeWait=resolve;
      timer=setTimeout(()=>{timer=null;wakeWait=null;resolve()},ms);
    });
    const waitImpl=wait||sleep;
    async function run(){
      if(running)return;
      running=true;
      while(!cancelled&&shouldContinue()){
        attempt++;
        onAttempt(attempt);
        let ok=false,error=null;
        try{ok=Boolean(await play(attempt))}catch(caught){error=caught}
        if(cancelled||!shouldContinue())break;
        if(ok){onSuccess(attempt);break}
        onFailure(attempt,error);
        await waitImpl(delay(attempt));
        timer=null;
      }
      running=false;
    }
    return {
      start:run,
      cancel(){
        cancelled=true;
        if(timer!==null)clearTimeout(timer);
        timer=null;
        if(wakeWait){const wake=wakeWait;wakeWait=null;wake()}
      },
      get attempts(){return attempt},
      get cancelled(){return cancelled}
    };
  }
  return {create};
});
