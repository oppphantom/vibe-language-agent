'use strict';
/* 首屏天空：用 WebGL 复刻 haoqi.design 首屏的「水下阳光 / 焦散」光效。
   平涂 #BFDDF0 底 + 暖奶油色 #F2F4F1 焦散网纹铺满整屏 + 细颗粒，静止时也持续缓慢流动。
   不支持 WebGL 或着色器编译失败时保持样式表里的 CSS 光斑，不阻塞页面。 */
(function(){
  const canvas=document.querySelector('.sky-canvas');
  const host=canvas&&canvas.parentElement;
  if(!canvas||!host)return;

  const vertexSource=`
attribute vec2 aPos;
void main(){gl_Position=vec4(aPos,0.0,1.0);}
`;

  const fragmentSource=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}

float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
}

float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.3);a*=0.5;}
  return v;
}

vec2 hash2(vec2 p){
  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453);
}

/* 细胞边界距离：焦散网纹的核心，值越小越靠近细胞边界（亮线所在） */
float voroEdge(vec2 q){
  vec2 n=floor(q),f=fract(q);
  float f1=8.0,f2=8.0;
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 g=vec2(float(i),float(j));
      vec2 o=hash2(n+g);
      vec2 r=g+o-f;
      float d=dot(r,r);
      if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}
    }
  }
  return sqrt(f2)-sqrt(f1);
}

/* 斜向拉长的柔光团：中心 1，边缘 smoothstep 到 0；soft 越大边缘越像磨砂玻璃。
   参考图的光块都是沿光线方向拉长的细长条，所以先旋转再按椭圆取样。 */
float blob(vec2 p,vec2 c,vec2 r,float ang,float soft){
  vec2 q=p-c;
  float ca=cos(ang),sa=sin(ang);
  q=vec2(ca*q.x+sa*q.y,-sa*q.x+ca*q.y);
  float d=length(q/r);
  return 1.0-smoothstep(1.0-soft,1.0,d);
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  uv.y=1.0-uv.y;                       // 以左上角为原点，方便对照参考图
  float aspect=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*aspect,uv.y);
  float t=uTime;

  /* 光块沿约 -27° 的光线方向拉长；它们只决定整屏焦散网的疏密与明暗，
     不再限定光只出现在某几块区域。 */
  vec2 c1=vec2(0.56,0.10)+0.042*vec2(sin(t*0.110),cos(t*0.088));
  vec2 c2=vec2(0.26,0.31)+0.050*vec2(cos(t*0.082+1.7),sin(t*0.097));
  vec2 c3=vec2(0.78,0.33)+0.046*vec2(sin(t*0.095+0.6),cos(t*0.077));
  vec2 c4=vec2(0.46,0.70)+0.044*vec2(cos(t*0.113),sin(t*0.088+2.1));
  vec2 c5=vec2(0.87,0.60)+0.034*vec2(sin(t*0.128+2.4),cos(t*0.102));
  vec2 c6=vec2(0.12,0.58)+0.032*vec2(cos(t*0.092+0.9),sin(t*0.118+1.2));
  vec2 c7=vec2(0.64,0.93)+0.040*vec2(sin(t*0.103+3.1),cos(t*0.082));
  vec2 c8=vec2(0.55,0.44)+0.048*vec2(sin(t*0.090+1.1),cos(t*0.110+0.4));
  float pulse=1.0+0.052*sin(t*0.150);

  /* 先把采样坐标揉皱，光块边缘才会像水下的光一样不规则、并缓慢变形 */
  vec2 drift=vec2(t*0.038,-t*0.028);
  float w1=fbm(p*2.5+drift);
  float w2=fbm(p*2.5-drift*0.8+vec2(4.7,2.3));
  vec2 wp=p+(vec2(w1,w2)-0.5)*0.40;
  float w3=fbm(wp*5.6-drift*1.6+vec2(1.3,8.8));

  /* 斜向坐标系：屏幕约 -27°；p.x 已按 aspect 拉伸，所以这个角度更平缓 */
  float ang=-0.30;
  float a=-0.30;
  vec2 sp=vec2(cos(a)*p.x-sin(a)*p.y,sin(a)*p.x+cos(a)*p.y);

  /* 大尺度分布决定焦散网的疏密与明暗，本身不做圆形光斑 */
  float field=0.0;
  field+=0.86*blob(wp,vec2(c1.x*aspect,c1.y),vec2(0.720,0.300)*pulse,ang,1.0);
  field+=0.70*blob(wp,vec2(c2.x*aspect,c2.y),vec2(0.600,0.260)*pulse,ang,1.0);
  field+=0.52*blob(wp,vec2(c3.x*aspect,c3.y),vec2(0.520,0.245)*pulse,ang,1.0);
  field+=0.58*blob(wp,vec2(c4.x*aspect,c4.y),vec2(0.580,0.250)*pulse,ang,1.0);
  field+=0.40*blob(wp,vec2(c5.x*aspect,c5.y),vec2(0.340,0.180)*pulse,ang,1.0);
  field+=0.32*blob(wp,vec2(c6.x*aspect,c6.y),vec2(0.320,0.175)*pulse,ang,1.0);
  field+=0.38*blob(wp,vec2(c7.x*aspect,c7.y),vec2(0.520,0.195)*pulse,ang,1.0);
  field+=0.44*blob(wp,vec2(c8.x*aspect,c8.y),vec2(0.640,0.270)*pulse,ang,1.0);
  field+=(w3-0.5)*0.55;
  /* 整屏铺满：亮团只决定哪儿更亮、哪儿稀疏，不再把画面其余部分留成平涂蓝底 */
  float place=clamp(0.45+0.55*smoothstep(0.10,0.85,field),0.0,1.0);

  /* 光丝：沿光线方向拉长的四层噪声脊线，构成参考图里水下焦散的光纹。
     先用低频噪声把斜向坐标揉弯，光丝才会像水波一样弯曲流动。 */
  vec2 sw=sp+(vec2(fbm(p*1.7+drift*0.7),fbm(p*1.7-drift*0.6+vec2(5.2,3.3)))-0.5)*0.16;
  /* 焦散网：把斜向坐标拉长后求细胞边界，得到参考图里那种细长、会弯曲的亮纹。
     坐标尺度越小，细胞越大、网越疏。 */
  vec2 q=vec2(sw.x*0.78,sw.y*2.80);
  q+=(vec2(fbm(q*1.3+drift),fbm(q*1.3-drift+vec2(3.1,4.2)))-0.5)*0.55;
  float cell1=1.0-smoothstep(0.0,0.22,voroEdge(q));
  vec2 q2=vec2(sw.x*1.55,sw.y*5.60)+vec2(4.3,1.7);
  q2+=(vec2(fbm(q2*1.5-drift*0.8),fbm(q2*1.5+drift*0.7+vec2(2.2,5.5)))-0.5)*0.40;
  float cell2=1.0-smoothstep(0.0,0.20,voroEdge(q2));
  vec2 q3=vec2(sw.x*2.90,sw.y*10.60)+vec2(1.1,7.4);
  q3+=(vec2(fbm(q3*1.4+drift*0.6),fbm(q3*1.4-drift*0.5+vec2(6.3,2.8)))-0.5)*0.30;
  float cell3=1.0-smoothstep(0.0,0.16,voroEdge(q3));
  float net=clamp(cell1*0.74+cell2*0.38+cell3*0.26,0.0,1.0);

  /* 焦散网铺满整屏，亮团只影响疏密与强弱。
     两层中频噪声把轮廓撕成不规则的光须，避免变成一块块干净的云。 */
  float grain=fbm(p*2.2+drift*0.6);
  float grain2=fbm(p*4.4-drift*0.9+vec2(2.7,5.9));
  float gate=smoothstep(0.10,0.78,place*0.90+grain*0.28+(grain2-0.5)*0.16);
  /* 大块柔光托底：焦散网叠在这层柔光上，形成参考图那种连成片的亮区 */
  float glow=smoothstep(0.08,0.72,place*0.85+grain*0.24);
  float light=clamp(gate*(0.14+0.78*net)+glow*0.26+pow(gate,3.0)*0.04,0.0,0.97);
  /* 亮区里的中频起伏 + 整幅极淡的网纹，避免出现大片死白和死平的蓝 */
  light*=0.93+0.09*fbm(p*7.0+drift*1.4);
  light=clamp(light+net*0.02,0.0,0.96);

  /* 亮部里的细碎闪点 */
  float spark=pow(smoothstep(0.60,0.92,fbm(p*16.0+w1*2.0+vec2(t*0.075,-t*0.055))),2.0)*(0.20+0.80*gate);
  light=clamp(light+spark*0.08,0.0,0.98);

  /* 蓝底在亮区边缘带一点更深的蓝，平坦区域保持参考图的 #BFDDF0 */
  float shade=fbm(vec2(sp.x*0.45,sp.y*1.7)+drift*0.5)-0.5;
  vec3 base=mix(vec3(0.749,0.867,0.941),vec3(0.690,0.827,0.918),
                clamp(-shade*0.9,0.0,1.0)*0.26*gate);

  vec3 cream=vec3(0.949,0.957,0.945);  // #F2F4F1
  vec3 color=mix(base,cream,light);
  color+=vec3(0.012,0.003,-0.008)*smoothstep(0.60,1.0,light);

  /* 细颗粒：参考图的画面有轻微胶片颗粒 */
  color+=(hash(gl_FragCoord.xy+floor(t*6.0))-0.5)*0.015;

  gl_FragColor=vec4(color,1.0);
}
`;

  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl)return;

  function compile(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      // 着色器失败时保持样式表里的 CSS 光斑，只在控制台留下原因
      console.warn('sky shader:',gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertex=compile(gl.VERTEX_SHADER,vertexSource);
  const fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
  const program=vertex&&fragment?gl.createProgram():null;
  if(!program)return;
  gl.attachShader(program,vertex);
  gl.attachShader(program,fragment);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
  gl.useProgram(program);

  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'aPos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);

  const uRes=gl.getUniformLocation(program,'uRes');
  const uTime=gl.getUniformLocation(program,'uTime');

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0;
  let started=0;
  let lastDraw=-1;

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    const maxPixels=2200000;
    let w=Math.max(1,Math.round(canvas.clientWidth*dpr));
    let h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    const scale=Math.min(1,Math.sqrt(maxPixels/(w*h)));
    w=Math.round(w*scale);
    h=Math.round(h*scale);
    if(w===width&&h===height)return;
    width=w;height=h;
    canvas.width=w;
    canvas.height=h;
    gl.viewport(0,0,w,h);
    draw(lastDraw<0?0:lastDraw);
  }

  function draw(seconds){
    gl.uniform2f(uRes,width,height);
    gl.uniform1f(uTime,seconds);
    gl.drawArrays(gl.TRIANGLES,0,3);
    lastDraw=seconds;
  }

  function frame(now){
    if(document.hidden||reduceMotion.matches)return;
    if(!started)started=now;
    const seconds=(now-started)/1000;
    // 30fps 足够表现这种缓慢流动，省电
    if(lastDraw<0||seconds-lastDraw>=1/30)draw(seconds);
    requestAnimationFrame(frame);
  }

  host.classList.add('is-live');
  resize();
  window.addEventListener('resize',resize);
  if(reduceMotion.matches){
    draw(0);
    reduceMotion.addEventListener('change',()=>{
      if(reduceMotion.matches)draw(0);
      else{started=0;lastDraw=-1;requestAnimationFrame(frame);}
    });
  }else{
    requestAnimationFrame(frame);
  }
  // 从后台切回时重新累积时间，避免出现一次大跳变
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&!reduceMotion.matches){started=0;lastDraw=-1;requestAnimationFrame(frame);}
  });
})();
