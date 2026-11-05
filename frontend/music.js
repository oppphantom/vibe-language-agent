'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const state={song:null,lines:[],connected:false,provider:'apple',platform:'unknown',modelConfigured:false,qqSongs:[],qqSource:'本机 QQ 音乐',neteasePlaylists:[],pendingSong:null,connecting:false};
  let pendingCheckTimer=null,pendingCheckAttempts=0;
  const providerName={apple:'Mac「音乐」',qqmusic:'QQ 音乐',netease:'网易云音乐'};
  const languageName={ko:'韩语',ja:'日语',zh:'中文'};
  const normal=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const offsetKey=song=>'vibe-music-offset:'+(song.provider||'apple')+':'+song.artist+':'+song.title;
  const make=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el};
  const learningLanguage=()=>$('learningLanguage')?.value||'ko';
  const languageClass=code=>`language-text language-${['ko','ja','zh'].includes(code)?code:'ko'}`;
  const shelfPairs=[['musicSongs','musicSongsScroll'],['qqLibraryResults','qqLibraryScroll'],['neteaseResults','neteaseScroll']];
  function updateShelfScroll(shelfId,controlId){
    requestAnimationFrame(()=>{
      const shelf=$(shelfId),control=$(controlId),maximum=Math.max(0,shelf.scrollWidth-shelf.clientWidth);
      control.max=String(maximum);control.value=String(Math.min(maximum,shelf.scrollLeft));control.hidden=maximum<2;
    });
  }
  for(const [shelfId,controlId] of shelfPairs){
    const shelf=$(shelfId),control=$(controlId);
    control.oninput=()=>{shelf.scrollLeft=Number(control.value)};
    shelf.addEventListener('scroll',()=>{control.value=String(shelf.scrollLeft)},{passive:true});
  }
  window.addEventListener('resize',()=>shelfPairs.forEach(pair=>updateShelfScroll(...pair)));
  document.addEventListener('learning-language-change',()=>{
    if(!state.song||state.song.language===learningLanguage())return;
    state.song=null;state.lines=[];$('musicStudy').hidden=true;$('systemControls').hidden=true;
    $('musicStatus').textContent='学习语言已切换，请按新语言重新选择歌曲并检索歌词。';
  });
  const time=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
  async function request(path,method='GET',body){
    const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(!response.ok)throw Error(data.error?.message||'请求失败');return data;
  }
  function clearPendingCheck(){
    if(pendingCheckTimer!==null)clearTimeout(pendingCheckTimer);
    pendingCheckTimer=null;pendingCheckAttempts=0;
  }
  function setPendingSong(song){clearPendingCheck();state.pendingSong=song}
  function retryPendingSong(song,provider,reason){
    if(state.pendingSong!==song||state.provider!==provider)return;
    const status=$(provider==='qqmusic'?'qqLibraryStatus':'neteaseSearchStatus');
    if(pendingCheckAttempts>=10){
      status.textContent=`仍未确认 ${song.title} 已切歌。${reason} 若客户端已播放这首歌，请点「连接当前音乐来源」；否则请重新打开播放地址。`;
      return;
    }
    pendingCheckAttempts++;
    status.textContent=`正在等待${providerName[provider]}切到 ${song.title}（第 ${pendingCheckAttempts} 次核对）。${reason}`;
    if(pendingCheckTimer!==null)clearTimeout(pendingCheckTimer);
    pendingCheckTimer=setTimeout(()=>{
      pendingCheckTimer=null;
      if(state.pendingSong===song&&state.provider===provider)connectMusic();
    },900);
  }
  function updateProvider(){
    clearPendingCheck();state.provider=$('musicProvider').value;state.connected=false;state.song=null;state.lines=[];state.pendingSong=null;
    $('musicSongs').replaceChildren();$('musicStudy').hidden=true;$('systemControls').hidden=true;$('musicPlayback').textContent='选择一句歌词开始播放。';
    const apple=state.provider==='apple';$('loadLibrary').hidden=!apple;$('libraryArtistLabel').hidden=!apple;
    $('neteaseSearch').hidden=state.provider!=='netease';$('neteaseResults').replaceChildren();$('neteaseSearchStatus').textContent='';
    $('qqLibraryPanel').hidden=state.provider!=='qqmusic';$('qqLibraryResults').replaceChildren();$('qqLibraryStatus').textContent='';
    $('discoverForm').querySelector('button').disabled=!apple;
    $('discoverStatus').textContent=apple?'':'跨歌曲资料库索引目前只支持 Mac「音乐」；可以先在客户端换歌，再连接当前歌曲。';
    $('musicStatus').textContent=`已选择${providerName[state.provider]}。点击连接读取当前歌曲。`;
  }
  $('musicProvider').onchange=updateProvider;
  function playAddress(song){
    const id=String(song.providerId||song.id);
    if(!/^\d{1,20}$/.test(id))return null;
    return song.provider==='qqmusic'?`qqmusicmac://cmd_count==1&&cmd_0==playsong&&id_0==${id}`:
      song.provider==='netease'?'orpheus://'+btoa(JSON.stringify({type:'song',id,cmd:'play'})):null;
  }
  function directPlayLink(song){
    const link=make('a',`Safari：在${providerName[song.provider]}播放`,'client-play-link');
    link.href=playAddress(song);
    link.title='Safari 已在本机验证可打开客户端；当前内置浏览器会阻止客户端专用链接';
    link.onclick=()=>{
      setPendingSong(song);
      $(song.provider==='qqmusic'?'qqLibraryStatus':'neteaseSearchStatus').textContent=`已向浏览器请求打开 ${song.title}。若浏览器询问是否打开${providerName[song.provider]}，请由你决定；返回本页后会核对实际播放曲目。若未切歌，请使用旁边的复制地址按钮。`;
      retryPendingSong(song,song.provider,'');
    };
    return link;
  }
  function copyPlayLink(song){
    const source=song.provider,qq=source==='qqmusic',status=$(qq?'qqLibraryStatus':'neteaseSearchStatus');
    const button=make('button',qq?'复制 QQ 播放地址':'复制网易云播放地址');button.type='button';
    button.onclick=async()=>{
      const address=playAddress(song);
      if(!address){status.textContent='这首歌没有有效的歌曲 ID。';return}
      try{
        await navigator.clipboard.writeText(address);
        setPendingSong(song);
        status.textContent=`已复制 ${song.title} 的${providerName[source]}播放地址。请粘贴到浏览器地址栏并回车；返回本页后会自动核对当前歌曲并载入歌词。`;
      }catch{
        clearPendingCheck();state.pendingSong=null;
        status.textContent=`浏览器未允许复制。请在${providerName[source]}客户端选择这首歌，然后点「连接当前音乐来源」。`;
      }
    };
    return button;
  }
  function nativePlayButton(song){
    const status=$(song.provider==='qqmusic'?'qqLibraryStatus':'neteaseSearchStatus');
    const button=make('button',`在${providerName[song.provider]}播放`);button.type='button';
    button.onclick=async()=>{
      setPendingSong(song);status.textContent=`正在让 Windows ${providerName[song.provider]}播放 ${song.title}…`;
      try{
        await request('/api/player/open-track','POST',{source:song.provider,song:{id:String(song.id),playlistId:song.playlistId,trackIndex:song.trackIndex}});
        status.textContent='已发出点播命令，正在核对客户端实际曲目…';
        pendingCheckTimer=setTimeout(()=>{pendingCheckTimer=null;if(state.pendingSong===song)connectMusic()},700);
      }catch(error){clearPendingCheck();state.pendingSong=null;status.textContent='点播失败：'+error.message}
    };
    return button;
  }
  function showCurrentSong(song){
    const card=document.createElement('article');card.className='song-card';card.append(make('small',providerName[song.provider]+' · 当前曲目'),make('h2',song.title),make('p',song.artist+' · '+time(song.durationMs)+(song.album?' · '+song.album:'')));
    const button=make('button','查看歌词与逐句播放');button.onclick=()=>selectSong(song);card.append(button);$('musicSongs').replaceChildren(card);
    if(['qqmusic','netease'].includes(song.provider)&&playAddress(song)&&state.platform!=='win32')card.append(directPlayLink(song),copyPlayLink(song));
  }
  async function connectMusic(manual=false){
    if(state.connecting)return;
    state.connecting=true;
    const provider=state.provider,pending=manual?null:state.pendingSong,preview=manual?state.song:pending||state.song;
    if(manual){clearPendingCheck();state.pendingSong=null}
    $('musicStatus').textContent=`正在检查${providerName[provider]}…`;
    try{const data=await request(provider==='apple'?'/api/mac/status':'/api/player/status?'+new URLSearchParams({source:provider}));
      if(provider!==state.provider||(!manual&&pending&&state.pendingSong!==pending))return;
      state.connected=data.running;
      if(!data.running){$('musicStatus').textContent=provider==='apple'?'请先启动 Mac「音乐」，然后再点击连接。':`系统当前播放来源是${providerName[data.activeSource]||'其他应用'}。请在${providerName[provider]}播放目标歌曲，再点击连接。`;if(pending)retryPendingSong(pending,provider,'当前还没有检测到目标客户端。');return}
      $('musicStatus').textContent=data.title?`已连接${providerName[provider]}；当前曲目：${data.title} · ${data.artist}。`:`已连接${providerName[provider]}。`;
      if(provider==='qqmusic'&&!data.positionReliable)$('musicStatus').textContent+=' QQ 音乐向系统上报的进度可能停留在旧位置；网页的句末时间是目标值，请以客户端播放条为准。';
      if(provider!=='apple'){
        if(!data.title||!data.artist||!data.duration){$('musicStatus').textContent+=' 当前播放信息不完整，请在客户端重新播放歌曲。';if(pending)retryPendingSong(pending,provider,'播放信息暂时不完整。');return}
        const durationMs=Math.round(data.duration*1000);
        const samePreview=preview?.provider===provider&&normal(preview.title)===normal(data.title)&&
          (normal(preview.artist).includes(normal(data.artist))||normal(data.artist).includes(normal(preview.artist)))&&
          Math.abs(preview.durationMs-durationMs)<3000&&
          (!preview.album||!data.album||normal(preview.album)===normal(data.album));
        if(pending&&!samePreview){
          retryPendingSong(pending,provider,`当前仍显示 ${data.title} · ${data.artist}。`);
          return;
        }
        if(pending){
          clearPendingCheck();
          $(provider==='qqmusic'?'qqLibraryStatus':'neteaseSearchStatus').textContent=`已确认${providerName[provider]}正在播放 ${data.title}，正在载入这首歌的歌词。`;
          state.pendingSong=null;
        }
        const song={title:data.title,artist:data.artist,album:data.album||'',durationMs,provider,playbackVerified:true,
          providerId:String(data.providerId||(samePreview&&preview.providerId)||''),
          ...(samePreview&&preview.songmid?{songmid:preview.songmid}:{}),
          ...(samePreview&&preview.playlistId?{playlistId:preview.playlistId,trackIndex:preview.trackIndex}:{})};
        showCurrentSong(song);
        $('systemJumpSeconds').value=String(Math.round(data.position*10)/10);
        await selectSong(song);
      }
    }catch(error){$('musicStatus').textContent='连接失败：'+error.message}
    finally{state.connecting=false}
  }
  $('connectMusic').onclick=()=>connectMusic(true);
  window.addEventListener('focus',()=>{if(state.pendingSong)connectMusic()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.pendingSong)connectMusic()});
  $('loadLibrary').onclick=async()=>{
    const artist=$('libraryArtist').value.trim(),scope=artist?`${artist} 的`:'全部';$('musicSongs').replaceChildren();$('musicStatus').textContent=`正在读取${scope}资料库歌曲…`;
    try{const data=await request('/api/mac/library?'+new URLSearchParams({artist,language:learningLanguage()}));
      $('musicStatus').textContent=`资料库找到 ${data.songs.length} 首${artist?' '+artist+' 的':''}歌曲。选择一首查看同步歌词。`;
      const fragment=document.createDocumentFragment();
      for(const song of data.songs){const card=document.createElement('article');card.className='song-card';
        song.provider='apple';card.append(make('small','MAC MUSIC LIBRARY'),make('h2',song.title),make('p',song.artist+' · '+time(song.durationMs)));
        const button=make('button','查看歌词与逐句播放');button.onclick=()=>selectSong(song);card.append(button);fragment.append(card)}
      $('musicSongs').append(fragment);
      if(!data.songs.length)$('musicSongs').textContent=artist?'没有找到该歌手的资料库歌曲。请确认歌曲已加入 Mac「音乐」资料库。':'资料库中没有可读取的歌曲。';
      updateShelfScroll('musicSongs','musicSongsScroll');
    }catch(error){$('musicStatus').textContent='读取失败：'+error.message}
  };
  function showQqResults(){
    const query=normal($('qqLibraryFilter').value),matches=state.qqSongs.filter(song=>!query||normal(song.title+' '+song.artist).includes(query));
    $('qqLibraryResults').replaceChildren();$('qqLibraryStatus').textContent=`${state.qqSource} ${state.qqSongs.length} 首；筛选后 ${matches.length} 首，当前展示前 80 首。`;
    for(const song of matches.slice(0,80)){
      const card=document.createElement('article');card.className='song-card';card.append(make('small',state.qqSource+' · 未人工核对'),make('h2',song.title),make('p',song.artist+' · '+time(song.durationMs)+(song.album?' · '+song.album:'')));
      const preview=make('button','先看同步歌词');preview.type='button';preview.onclick=()=>selectSong({...song,providerId:song.id});
      card.append(preview);
      if(state.platform==='win32')card.append(nativePlayButton(song));else card.append(directPlayLink(song),copyPlayLink(song));
      $('qqLibraryResults').append(card);
    }
    updateShelfScroll('qqLibraryResults','qqLibraryScroll');
  }
  $('qqLibraryFilter').oninput=()=>{if(state.qqSongs.length)showQqResults()};
  $('qqLibrary').onclick=async()=>{
    $('qqLibraryStatus').textContent='正在读取本机 QQ 音乐客户端歌曲列表…';
    try{const data=await request('/api/qq/library');state.qqSongs=data.songs;state.qqSource='本机 QQ 音乐缓存';
      if(state.provider==='qqmusic')showQqResults();
    }catch(error){$('qqLibraryStatus').textContent='读取失败：'+error.message}
  };
  $('qqPlaylistForm').onsubmit=async event=>{
    event.preventDefault();$('qqLibraryStatus').textContent='正在导入 QQ 音乐公开歌单的完整歌曲列表…';
    try{const data=await request('/api/qq/playlist?'+new URLSearchParams({value:$('qqPlaylistValue').value.trim()}));
      state.qqSongs=data.playlist.songs;state.qqSource=`歌单「${data.playlist.name}」`;
      if(state.provider==='qqmusic')showQqResults();
    }catch(error){$('qqLibraryStatus').textContent='导入失败：'+error.message}
  };
  function showNeteaseResults(songs,source){
    $('neteaseResults').replaceChildren();
    $('neteaseSearchStatus').textContent=songs.length?`${source}找到 ${songs.length} 首。请核对版本；${state.platform==='win32'?'可直接让客户端播放。':'可以复制播放地址到浏览器地址栏切歌。'}`:'没有找到歌曲。';
    for(const song of songs){
      const card=document.createElement('article');card.className='song-card';card.append(make('small',source+' · 未人工核对'),make('h2',song.title),make('p',song.artist+' · '+time(song.durationMs)+(song.album?' · '+song.album:'')));
      const preview=make('button','先看同步歌词');preview.type='button';preview.onclick=()=>selectSong({...song,providerId:song.id});
      card.append(preview);
      if(state.platform==='win32')card.append(nativePlayButton(song));else card.append(directPlayLink(song),copyPlayLink(song));
      $('neteaseResults').append(card);
    }
    updateShelfScroll('neteaseResults','neteaseScroll');
  }
  $('neteaseSearchForm').onsubmit=async event=>{
    event.preventDefault();$('neteaseResults').replaceChildren();$('neteaseSearchStatus').textContent='正在搜索网易云歌曲目录…';
    try{const data=await request('/api/netease/search?'+new URLSearchParams({q:$('neteaseQuery').value.trim()}));
      if(state.provider==='netease')showNeteaseResults(data.songs,'网易云歌曲目录');
    }catch(error){$('neteaseSearchStatus').textContent='搜索失败：'+error.message}
  };
  $('neteaseLibrary').onclick=async()=>{
    $('neteaseResults').replaceChildren();$('neteaseSearchStatus').textContent='正在读取本机网易云客户端歌曲列表…';
    try{const data=await request('/api/netease/library');
      if(state.provider==='netease')showNeteaseResults(data.songs,'本机网易云');
    }catch(error){$('neteaseSearchStatus').textContent='读取失败：'+error.message}
  };
  $('neteasePlaylists').onclick=async()=>{
    $('neteaseResults').replaceChildren();$('neteaseSearchStatus').textContent='正在只读导入网易云本机歌单…';
    try{const data=await request('/api/netease/playlists');state.neteasePlaylists=data.playlists;
      const select=$('neteasePlaylistSelect');select.replaceChildren();
      for(const playlist of data.playlists){const option=document.createElement('option');option.value=playlist.id;option.textContent=`${playlist.name}（${playlist.songs.length} 首）`;select.append(option)}
      $('neteasePlaylistLabel').hidden=!data.playlists.length;
      if(data.playlists.length)showNeteaseResults(data.playlists[0].songs,`歌单「${data.playlists[0].name}」`);else $('neteaseSearchStatus').textContent='本机数据库里没有可导入的歌单。';
    }catch(error){$('neteaseSearchStatus').textContent='导入失败：'+error.message}
  };
  $('neteasePlaylistSelect').onchange=()=>{
    const playlist=state.neteasePlaylists.find(item=>item.id===$('neteasePlaylistSelect').value);
    if(playlist)showNeteaseResults(playlist.songs,`歌单「${playlist.name}」`);
  };
  async function selectSong(song){
    song.language=song.language||learningLanguage();song.provider=song.provider||state.provider;
    state.song=song;state.lines=[];$('musicStudy').hidden=false;
    $('musicLearning').hidden=true;$('planStatus').textContent='';
    $('musicSongTitle').textContent=`${song.title} · ${song.artist} · ${languageName[song.language]||'韩语'}`;
    $('systemControls').hidden=!song.provider||song.provider==='apple'||!song.playbackVerified;
    $('musicPlayback').textContent='选择一句歌词开始播放。';
    $('musicOffset').value=localStorage.getItem(offsetKey(song))||'0';
    $('musicSource').textContent='正在匹配同步歌词与音频版本…';$('musicLyrics').replaceChildren();
    $('musicStudy').scrollIntoView({behavior:'smooth',block:'start'});
    try{const data=await request('/api/lyrics/search','POST',song);
      if(state.song!==song||state.provider!==song.provider)return;
      if(data.status!=='unverified'){$('musicSource').textContent='没有找到与资料库版本时长匹配的同步歌词。';return}
      state.lines=data.lines;
      if(data.song){
        song={...song,...data.song,language:song.language,provider:song.provider||data.song.provider};
        state.song=song;
      }
      if(song.provider==='netease'&&data.song?.source?.id)song.providerId=String(data.song.source.id);
      if(song.provider==='netease'&&song.playbackVerified)showCurrentSong(song);
      $('musicSource').textContent=`来源 ${data.source} · ${data.lines.length} 行 · 未人工核对。${song.provider&&song.provider!=='apple'&&!song.playbackVerified?`当前仅预览歌词；请先在${providerName[song.provider]}客户端播放同一版本，再连接当前音乐来源。`:'先检查歌词与音频的时间偏移。'}`;
      for(const line of data.lines){const button=document.createElement('button');button.type='button';button.className='lyric-row';
        button.append(make('span',time(line.startMs)),make('strong',line.text,languageClass(song.language)));
        button.disabled=line.endMs===null||(song.provider&&song.provider!=='apple'&&!song.playbackVerified);
        button.title=line.endMs===null?'缺少句末时间，不能自动暂停':song.provider&&song.provider!=='apple'&&!song.playbackVerified?'当前仅预览歌词；连接正在播放的同一版本后可逐句播放':`在${providerName[song.provider||'apple']}播放这一句`;
        button.onclick=()=>play(song,line);$('musicLyrics').append(button)}
      $('musicLearning').hidden=false;
      if(!state.modelConfigured)$('planStatus').textContent='模型未配置：仍然可以播放和查看歌词，但不能生成真实歌曲课程。';
    }catch(error){if(state.song===song)$('musicSource').textContent='同步歌词检索失败：'+error.message}
  }
  $('planSong').onclick=async()=>{
    const song=state.song,lines=state.lines;
    if(!song||!lines.length){$('planStatus').textContent='请先载入同步歌词。';return}
    const button=$('planSong');button.disabled=true;
    $('planStatus').textContent='正在创建课程生成任务…';
    try{
      const plan=await window.vibePlanJob.run(request,{song,lines,language:song.language},message=>{$('planStatus').textContent=message});
      if(state.song!==song||state.lines!==lines){$('planStatus').textContent='歌曲或歌词已切换，本次生成结果没有打开。';return}
      $('planStatus').textContent=`${plan.provenance}；正在打开「${plan.title}」。`;
      await window.vibeStudy.startCourse(plan.courseId);
    }catch(error){
      $('planStatus').textContent='课程生成失败：'+error.message;
    }finally{button.disabled=!state.modelConfigured}
  };
  $('musicOffset').onchange=()=>{if(state.song)localStorage.setItem(offsetKey(state.song),$('musicOffset').value)};
  async function systemControl(action){
    const song=state.song;if(!song||song.provider==='apple')return;
    const seconds=Number($('systemJumpSeconds').value);
    if(action==='jump'&&(!Number.isFinite(seconds)||seconds<0||seconds>song.durationMs/1000)){$('musicPlayback').textContent='跳转时间超出歌曲范围。';return}
    $('musicPlayback').textContent=`正在让${providerName[song.provider]}${action==='jump'?'跳转并播放':action==='pause'?'暂停':'继续播放'}…`;
    try{const result=await request('/api/player/control','POST',{source:song.provider,action,title:song.title,artist:song.artist,album:song.album||'',durationMs:song.durationMs,seconds});
      if(!result.ok)throw Error(result.reason||'控制未成功');
      $('musicPlayback').textContent=action==='pause'?'已暂停。':action==='jump'?`已跳到 ${time(seconds*1000)} 并开始播放。`:'已继续播放。';
    }catch(error){$('musicPlayback').textContent='播放控制失败：'+error.message}
  }
  $('systemPlay').onclick=()=>systemControl('play');
  $('systemPause').onclick=()=>systemControl('pause');
  $('systemJump').onclick=()=>systemControl('jump');
  async function queueStep(direction){
    const song=state.song;if(!song||song.provider==='apple')return;
    $('musicPlayback').textContent=`正在让${providerName[song.provider]}切到${direction==='next'?'下一首':'上一首'}…`;
    try{
      const result=await request('/api/player/queue-step','POST',{source:song.provider,direction,title:song.title,artist:song.artist,album:song.album||'',durationMs:song.durationMs});
      if(!result.ok)throw Error(result.reason||'切歌未成功');
      if(state.song!==song||state.provider!==song.provider)return;
      const next={...result.song,playbackVerified:true};showCurrentSong(next);$('systemJumpSeconds').value='0';
      $('musicStatus').textContent=`已切到${next.title} · ${next.artist}，正在匹配同步歌词。`;
      await selectSong(next);
    }catch(error){$('musicPlayback').textContent='切歌失败：'+error.message}
  }
  $('systemPrevious').onclick=()=>queueStep('previous');
  $('systemNext').onclick=()=>queueStep('next');
  async function play(song,line,outputId='musicPlayback'){
    const output=$(outputId);
    const rawOffset=outputId==='discoverPlayback'?(localStorage.getItem(offsetKey(song))||'0'):$('musicOffset').value;
    const offset=Math.round((Number(rawOffset)||0)*1000);
    const startMs=line.startMs+offset,endMs=line.endMs+offset;
    if(startMs<0||endMs<=startMs){output.textContent='时间偏移超出可播放范围。';return}
    output.textContent=`正在让${providerName[song.provider||'apple']}跳到 ${song.title} 的 ${time(startMs)}…`;
    try{const result=await request(song.provider&&song.provider!=='apple'?'/api/player/play-line':'/api/mac/play-line','POST',{source:song.provider,title:song.title,artist:song.artist,album:song.album||'',durationMs:song.durationMs,startMs,endMs});
      if(!result.ok)throw Error(result.reason==='not_in_library'?'歌曲不在「音乐」资料库':result.reason||'播放未成功');
      output.textContent=`已定位 ${song.title} · ${time(startMs)}，预计在 ${time(endMs)} 自动暂停。`;
      return true;
    }catch(error){output.textContent='播放失败：'+error.message;return false}
  }
  window.vibeMusic={playEvidence:(song,line)=>play(song,line,'studyPlayback')};
  $('discoverForm').onsubmit=async event=>{
    event.preventDefault();const artist=$('libraryArtist').value.trim(),expression=$('discoverQuery').value.trim();
    $('discoverResults').replaceChildren();$('discoverStatus').textContent=`正在检索 ${artist} 资料库中的歌词，首次建立索引可能需要一些时间…`;
    try{const data=await request('/api/mac/discover','POST',{artist,expression,language:learningLanguage()});
      $('discoverStatus').textContent=`已匹配 ${data.indexed}/${data.requested} 首歌词，${data.songCount} 首歌含有「${expression}」，共 ${data.hits.length} 处。${data.matchMethod}${data.sourceFailures?'；'+data.sourceFailures+' 首来源失败':''}`;
      for(const hit of data.hits){const card=document.createElement('article');card.className='context-card';
        card.append(make('small',hit.song.title+' · '+hit.song.artist+' · '+time(hit.line.startMs)),
          make('p','上一句　'+(hit.before||'—'),'context'),make('p',hit.line.text,languageClass(learningLanguage())),make('p','下一句　'+(hit.after||'—'),'context'));
        const button=make('button','▶ 听这一句');button.disabled=hit.line.endMs===null;
        button.onclick=()=>play(hit.song,hit.line,'discoverPlayback');card.append(button);$('discoverResults').append(card)}
      if(!data.hits.length)$('discoverResults').textContent='已索引歌曲里没有找到这一表达；可以换一个词，或检查未匹配的歌词版本。';
    }catch(error){$('discoverStatus').textContent='检索失败：'+error.message}
  };
  (async()=>{
    try{
      const health=await request('/api/health');
      state.platform=health.platform||'unknown';state.modelConfigured=health.modelConfigured===true;
      $('planSong').disabled=!state.modelConfigured;
      if(!state.modelConfigured)$('planStatus').textContent='模型未配置：仍然可以播放和查看歌词，但不能生成真实歌曲课程。';
    }catch{}
    if(state.platform==='win32'){
      $('musicProvider').querySelector('option[value=apple]')?.remove();
      $('musicProvider').value='qqmusic';$('qqLibrary').hidden=true;
    }else $('neteasePlaylists').hidden=true;
    updateProvider();
  })();
})();
