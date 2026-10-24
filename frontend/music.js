'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const state={song:null,lines:[],connected:false};
  const offsetKey=song=>'vibe-music-offset:'+song.artist+':'+song.title;
  const make=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el};
  const time=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
  async function request(path,method='GET',body){
    const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(!response.ok)throw Error(data.error?.message||'请求失败');return data;
  }
  $('connectMusic').onclick=async()=>{
    $('musicStatus').textContent='正在检查本机「音乐」…';
    try{const data=await request('/api/mac/status');state.connected=data.running;
      $('musicStatus').textContent=data.running
        ? `已连接本机「音乐」${data.title?'；当前曲目：'+data.title+' · '+data.artist:''}。可读取资料库歌曲。`
        : '「音乐」尚未打开。请先启动 Mac「音乐」，然后再点击连接。';
    }catch(error){$('musicStatus').textContent='连接失败：'+error.message}
  };
  $('loadLibrary').onclick=async()=>{
    const artist=$('libraryArtist').value.trim();$('musicSongs').replaceChildren();$('musicStatus').textContent='正在读取 '+artist+' 的资料库歌曲…';
    try{const data=await request('/api/mac/library?'+new URLSearchParams({artist}));
      $('musicStatus').textContent=`资料库找到 ${data.songs.length} 首 ${artist} 的歌曲。选择一首查看同步歌词。`;
      for(const song of data.songs){const card=document.createElement('article');card.className='song-card';
        card.append(make('small','MAC MUSIC LIBRARY'),make('h2',song.title),make('p',song.artist+' · '+time(song.durationMs)));
        const button=make('button','查看歌词与逐句播放');button.onclick=()=>selectSong(song);card.append(button);$('musicSongs').append(card)}
      if(!data.songs.length)$('musicSongs').textContent='没有找到该歌手的资料库歌曲。请确认歌曲已加入 Mac「音乐」资料库。';
    }catch(error){$('musicStatus').textContent='读取失败：'+error.message}
  };
  async function selectSong(song){
    state.song=song;state.lines=[];$('musicStudy').hidden=false;$('musicSongTitle').textContent=song.title+' · '+song.artist;
    $('musicOffset').value=localStorage.getItem(offsetKey(song))||'0';
    $('musicSource').textContent='正在匹配同步歌词与音频版本…';$('musicLyrics').replaceChildren();
    $('musicStudy').scrollIntoView({behavior:'smooth',block:'start'});
    try{const data=await request('/api/lyrics/search','POST',song);
      if(data.status!=='unverified'){$('musicSource').textContent='没有找到与资料库版本时长匹配的同步歌词。';return}
      state.lines=data.lines;$('musicSource').textContent=`来源 ${data.source} · ${data.lines.length} 行 · 未人工核对。先检查歌词与音频的时间偏移。`;
      for(const line of data.lines){const button=document.createElement('button');button.type='button';button.className='lyric-row';
        button.append(make('span',time(line.startMs)),make('strong',line.text));
        button.disabled=line.endMs===null;button.title=line.endMs===null?'缺少句末时间，不能自动暂停':'在 Mac「音乐」播放这一句';
        button.onclick=()=>play(song,line);$('musicLyrics').append(button)}
    }catch(error){$('musicSource').textContent='同步歌词检索失败：'+error.message}
  }
  $('musicOffset').onchange=()=>{if(state.song)localStorage.setItem(offsetKey(state.song),$('musicOffset').value)};
  async function play(song,line,outputId='musicPlayback'){
    const output=$(outputId);
    const rawOffset=outputId==='discoverPlayback'?(localStorage.getItem(offsetKey(song))||'0'):$('musicOffset').value;
    const offset=Math.round((Number(rawOffset)||0)*1000);
    const startMs=line.startMs+offset,endMs=line.endMs+offset;
    if(startMs<0||endMs<=startMs){output.textContent='时间偏移超出可播放范围。';return}
    output.textContent=`正在让「音乐」打开 ${song.title} 并跳到 ${time(startMs)}…`;
    try{const result=await request('/api/mac/play-line','POST',{title:song.title,artist:song.artist,startMs,endMs});
      if(!result.ok)throw Error(result.reason==='not_in_library'?'歌曲不在「音乐」资料库':result.reason||'播放未成功');
      output.textContent=`已定位 ${song.title} · ${time(startMs)}，预计在 ${time(endMs)} 自动暂停。`;
    }catch(error){output.textContent='播放失败：'+error.message}
  }
  $('discoverForm').onsubmit=async event=>{
    event.preventDefault();const artist=$('libraryArtist').value.trim(),expression=$('discoverQuery').value.trim();
    $('discoverResults').replaceChildren();$('discoverStatus').textContent=`正在检索 ${artist} 资料库中的歌词，首次建立索引可能需要一些时间…`;
    try{const data=await request('/api/mac/discover','POST',{artist,expression});
      $('discoverStatus').textContent=`已匹配 ${data.indexed}/${data.requested} 首歌词，${data.songCount} 首歌含有「${expression}」，共 ${data.hits.length} 处。${data.matchMethod}${data.sourceFailures?'；'+data.sourceFailures+' 首来源失败':''}`;
      for(const hit of data.hits){const card=document.createElement('article');card.className='context-card';
        card.append(make('small',hit.song.title+' · '+hit.song.artist+' · '+time(hit.line.startMs)),
          make('p','上一句　'+(hit.before||'—'),'context'),make('p',hit.line.text,'korean'),make('p','下一句　'+(hit.after||'—'),'context'));
        const button=make('button','▶ 听这一句');button.disabled=hit.line.endMs===null;
        button.onclick=()=>play(hit.song,hit.line,'discoverPlayback');card.append(button);$('discoverResults').append(card)}
      if(!data.hits.length)$('discoverResults').textContent='已索引歌曲里没有找到这一表达；可以换一个词，或检查未匹配的歌词版本。';
    }catch(error){$('discoverStatus').textContent='检索失败：'+error.message}
  };
})();
