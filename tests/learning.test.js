'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeSong}=require('../backend/agent/analysis');
const {validateLearnerProfile,validateRespond}=require('../shared/contract');
const {songs,lines}=require('../content/fixtures/demo');
const {masteryView}=require('../backend/agent/evaluation');
const session=require('../backend/agent/session');
test('analysis handles repeated text, unknown timing and invalid profiles',()=>{
  const song=songs[0],source=lines.filter(line=>line.songId===song.id);
  const material=[source[0],{...source[0],id:'repeated',startMs:5000,endMs:8000},
    {...source[0],id:'no-end',text:'other text',endMs:null}];
  const result=analyzeSong({song,lines:material,profile:{level:'starter',goal:'reading',minutes:5}});
  assert.equal(result.recommendedLineIds.length,1);
  assert.equal(result.fragments[0].repeats,2);
  assert.equal(result.fragments[2].playable,false);
  assert.throws(()=>analyzeSong({song,lines:[{...source[0],songId:'wrong'}]}));
  assert.throws(()=>validateLearnerProfile({minutes:7}));
  const base={sessionId:'s',nodeId:'n',submissionId:'x',choice:0};
  assert.equal(validateRespond(base).metrics,null);
  assert.throws(()=>validateRespond({...base,metrics:{playRequests:1,playSuccesses:2}}));
});
test('completion events do not inflate attempts or establish mastery',()=>{
  const result=masteryView({targetExpression:'a'},[
    {nodeId:'n',choice:0,correct:false},{nodeId:'n',choice:null,correct:true}
  ],{courseCompleted:true,nodes:[{id:'n',skill:'listening'}]});
  assert.equal(result.skills[0].attempts,1);
  assert.equal(result.status,'needs_review');
});
test('question responses are recorded once with retries and target evidence',()=>{
  const created=session.begin('demo-morning');
  let current=session.node(created.id),serial=0;
  const send=(fn,extra)=>fn({sessionId:created.id,nodeId:current.id,submissionId:'learning-'+serial++,...extra});
  while(current.teaching.phase!=='ready'){
    if(current.teaching.phase==='check'){
      for(let choice=0;choice<3;choice++){
        if(current.teaching.phase!=='check'){
          while(current.teaching.phase!=='check')current=send(session.teach,{action:'continue'}).node;
        }
        current=send(session.teach,{action:'answer',choice}).node;
        if(current.teaching.phase==='ready')break;
      }
    }else current=send(session.teach,{action:'continue'}).node;
  }
  // Breadth-first route through the public map to a question, avoiding enemies and cards.
  while(!current.room.pending){
    const tiles=current.room.tiles,start=tiles.flatMap((row,y)=>[...row].map((v,x)=>({v,x,y}))).find(p=>p.v==='@');
    const queue=[{...start,path:[]}],seen=new Set();let path;
    while(queue.length){
      const point=queue.shift(),key=point.x+','+point.y;
      if(seen.has(key))continue;seen.add(key);
      if(['♪','?'].includes(tiles[point.y][point.x])){path=point.path;break}
      for(const [direction,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){
        const x=point.x+dx,y=point.y+dy;
        if(tiles[y]?.[x]&&!['#','x','✦'].includes(tiles[y][x]))queue.push({x,y,path:[...point.path,direction]});
      }
    }
    assert.ok(path?.length);
    current=send(session.move,{direction:path[0]}).node;
  }
  const challenge=current.room.pending.challenge;
  const line=current.material.lines.find(item=>item.id===challenge.lineId);
  const correct=challenge.options.indexOf(line.text);
  assert.ok(correct>=0);
  const input={sessionId:created.id,nodeId:current.id,submissionId:'question-wrong',choice:(correct+1)%3,
    metrics:{playRequests:2,playSuccesses:1,playFailures:1}};
  const first=session.respond(input);
  assert.deepEqual(session.respond(input),first);
  const second=session.respond({...input,submissionId:'question-right',choice:correct});
  const attempts=second.session.history.filter(item=>item.interaction==='question');
  assert.equal(attempts.length,2);
  assert.equal(attempts[0].firstAttempt,true);
  assert.equal(attempts[0].targetText,line.text);
  assert.equal(attempts[1].attempt,2);
  assert.equal(attempts[1].hintUsed,true);
});

test('browser records survive reload and late snapshots without duplicate attempts',()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  const saved=new Map();
  function load(){
    const elements=new Map();
    function element(){return {value:'',textContent:'',children:[],append(item){this.children.push(item)},replaceChildren(){this.children=[]}}}
    const document={getElementById(id){
      if(!elements.has(id))elements.set(id,element());
      return elements.get(id);
    },createElement:element,addEventListener(){},dispatchEvent(){}};
    document.getElementById('learningLanguage').value='ko';
    const localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
    const window={};
    vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/learning.js'),'utf8'),{window,document,localStorage});
    return {api:window.vibeLearning,document};
  }
  const initial=load();
  const first={id:'a',nodeId:'n',questionId:'q',interaction:'question',questionType:'audio_to_lyrics',
    firstAttempt:true,attempt:1,correct:false,at:'2026-11-19T09:00:00Z'};
  const second={...first,id:'b',firstAttempt:false,attempt:2,correct:true};
  const session={id:'session',courseTitle:'测试课程',history:[first,second]};
  initial.api.capture(session);
  initial.api.capture({...session,history:[first]});
  const restored=load();
  assert.match(restored.document.getElementById('learningRecordSummary').textContent,/2 次作答/);
  assert.match(restored.document.getElementById('learningRecordSummary').textContent,/0\/1/);
});

test('target-language recommendations exclude unrelated vocal fillers',()=>{
  const song=songs.find(item=>item.language==='ko');
  const source=lines.find(item=>item.songId===song.id);
  const material=['oh','oh','oh','다시 만나자'].map((text,index)=>({
    ...source,id:'language-'+index,text,startMs:index*5000,endMs:index*5000+4000
  }));
  const result=analyzeSong({song,lines:material});
  assert.deepEqual(result.recommendedLineIds,['language-3']);
});
