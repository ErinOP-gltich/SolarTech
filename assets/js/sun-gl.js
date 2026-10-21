/*!
 * Green Sun Technologies — sun-gl.js  ·  real-time WebGL plasma sun (Solar Noir v2)
 * ---------------------------------------------------------------------------------
 * A stylised, photoreal-ish star rendered in one fragment shader on a TRANSPARENT,
 * premultiplied-alpha canvas: boiling domain-warped plasma with soft granulation, a white-hot
 * core that cools through #FFC400 and #FF7A00 to a #FF3B1F limb, a chromospheric rim with
 * spicules, a layered corona with slowly rotating filamentary streamers, and prominences
 * (magnetic loops of fine strands) that rise off the limb, hang, and drain away.
 * No dependencies (GSAP is NOT required). Plain ES2019, exposes window.GSSun.
 *
 * API
 *   const sun = GSSun.mount(canvas, {
 *     center:    [0.72, 0.62], // sun centre, fraction of canvas width / height (from top-left)
 *     radius:    0.34,         // photosphere radius, fraction of min(canvas width, height)
 *     intensity: 1,            // 0 = dormant ember, 1 = normal, 2 = blazing
 *     pointer:   true,         // corona leans + brightens toward the pointer (window pointermove)
 *     dprMax:    1.5,          // devicePixelRatio cap
 *     quality:   'auto',       // 'auto' | 'high' | 'low'   ('auto' adapts to frame time)
 *     // optional: onReady(sun) after the first frame, seed (number, varies the pattern),
 *     //           allowSoftware (true = accept a software-rendered WebGL context)
 *   });
 *   sun.setIntensity(v, immediate?) // v 0..2, eased over ~0.3 s unless immediate === true
 *   sun.setPointer(nx, ny)          // -1..1 over the canvas (nx -1 = left, ny -1 = top);
 *                                   // pass null to release. Not needed when opts.pointer is on.
 *   sun.resize()                    // force a re-measure (a ResizeObserver already does this)
 *   sun.destroy()                   // stop, unhook every listener, clear the canvas
 *   // extras: sun.setCenter(x, y), sun.setRadius(r)   (live, e.g. scroll-driven)
 *   //         sun.pause(), sun.play()                 (e.g. while a menu covers the hero)
 *   //         sun.snapshot(seconds)  pauses and draws one frame at that clock time (posters/tests)
 *   //         sun.stats(), sun.gl    (false on the no-op controller)
 *
 * Behaviour
 *   - The canvas needs a CSS size (e.g. position:absolute; inset:0; width:100%; height:100%).
 *     Its backing store follows that box (ResizeObserver) × min(devicePixelRatio, dprMax).
 *   - The shader compiles off the main thread: mount() never waits for it (KHR_parallel_shader_compile
 *     where available, otherwise the status query is deferred a few frames). The first frame is drawn
 *     when it is ready, so fade the canvas in on "gl-on" / "gs:sun-ready" (see the CSS below).
 *   - The linked program is cached on the canvas's GL context: destroy() + mount() on the SAME canvas
 *     (e.g. to switch layouts on rotate) draws in the same task, with no recompile and no blank frame.
 *   - Rendering pauses while the canvas is off-screen (IntersectionObserver) or the tab is hidden;
 *     changes made meanwhile are drawn when it comes back.
 *   - quality 'auto': starts 'low' on small screens / weak devices; when typical frames (the slowest
 *     quarter is ignored, so main-thread hiccups don't count) take > 22 ms for ~2 s, the internal
 *     resolution / octave count steps down (four levels, then half-rate as a last resort).
 *   - prefers-reduced-motion: ONE static frame (re-rendered on resize / setters), no loop, no pointer
 *     reaction. Live changes to the OS setting are followed.
 *   - No WebGL / software-only WebGL / shader failure / context lost: class "no-gl" is added to
 *     canvas.parentElement and a bubbling "gs:sun-fallback" event fires on the canvas. mount() returns a
 *     no-op controller when it can't start at all; after webglcontextrestored it recovers by itself.
 *   - After the first frame: class "gl-on" on the parent and a bubbling "gs:sun-ready" event
 *     on the canvas (handy for a loader or a fade-in).
 *   - The canvas gets aria-hidden="true" unless it already has aria-hidden or a role.
 *
 * Recommended CSS (fallback for parents marked .no-gl; vmin values suit a full-viewport hero
 * with the default center / radius):
 *   .no-gl > canvas { display: none; }
 *   .no-gl {
 *     background:
 *       radial-gradient(circle at 72% 62%,
 *         #FFF1B8 0, #FFE07A 6vmin, #FFC400 15vmin, #FF9A00 25vmin, #FF7A00 29.5vmin, #FF3B1F 33.6vmin,
 *         rgba(255,150,30,.6) 34vmin, rgba(255,110,10,.3) 37vmin, rgba(255,80,20,.13) 46vmin,
 *         rgba(255,59,31,.05) 62vmin, rgba(5,5,7,0) 85vmin),
 *       #050507;   (orange glow stops: a translucent yellow over #050507 reads olive)
 *   }
 *   canvas.gs-sun { opacity: 0; transition: opacity 1.2s cubic-bezier(.16,1,.3,1); }
 *   .gl-on > canvas.gs-sun { opacity: 1; }
 *   @media (prefers-reduced-motion: reduce) { canvas.gs-sun { transition: none; } }
 *
 * Simplex noise: Ian McEwan, Ashima Arts / Stefan Gustavson (MIT licence).
 */
(function () {
  'use strict';

  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2  uCenter;',    // px, GL (bottom-left) coordinates
    'uniform float uRadius;',    // px
    'uniform float uTime;',
    'uniform float uI;',         // intensity 0..2
    'uniform vec3  uPointer;',   // xy unit direction (GL), z strength 0..1
    'uniform float uOct;',       // fbm octaves (3..5)
    'uniform float uDetail;',    // 1 high, 0 low
    'uniform float uSeed;',
    'uniform float uMaxR;',      // early-out radius (in sun radii)
    'uniform mat3  uRot;',       // photosphere rotation

    'const vec3 C_EMBER  = vec3(0.30, 0.035, 0.02);',
    'const vec3 C_FLARE  = vec3(1.0, 0.231, 0.122);',
    'const vec3 C_ORANGE = vec3(1.0, 0.478, 0.0);',
    'const vec3 C_SUN    = vec3(1.0, 0.769, 0.0);',
    'const vec3 C_HOT    = vec3(1.0, 0.945, 0.722);',
    'const vec3 C_WHITE  = vec3(1.0, 0.992, 0.955);',

    // --- simplex noise 3D (Ashima Arts, MIT) ---
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    '  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    '  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
    '  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
    '  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
    '  i=mod289(i);',
    '  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    '  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
    '  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);',
    '  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);',
    '  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
    '  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));',
    '  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    '  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
    '  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    '  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    '  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
    '  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}',

    // hash without sine (Dave Hoskins, MIT)
    'float hash11(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}',
    'float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',

    // fbm with per-octave drift (churning) and an octave rotation
    'const mat3 M3=mat3(0.00,0.80,0.60,-0.80,0.36,-0.48,-0.60,-0.48,0.64);',
    'float fbm(vec3 p,float t){',
    '  float s=0.0;float a=0.5;',
    '  for(int i=0;i<5;i++){',
    '    if(float(i)>=uOct)break;',
    '    float fi=float(i);',
    '    s+=a*snoise(p+vec3(0.026,-0.019,0.023)*t*(1.0+fi*0.8));',
    '    p=M3*p*2.03;a*=0.5;',
    '  }',
    '  return s;',
    '}',

    // brand plasma ramp: ember -> flare -> orange -> sun -> hot -> white
    'vec3 ramp(float x){',
    '  vec3 c=mix(C_EMBER,C_FLARE,smoothstep(0.0,0.24,x));',
    '  c=mix(c,C_ORANGE,smoothstep(0.20,0.46,x));',
    '  c=mix(c,C_SUN,smoothstep(0.42,0.68,x));',
    '  c=mix(c,C_HOT,smoothstep(0.66,0.86,x));',
    '  c=mix(c,C_WHITE,smoothstep(0.86,1.02,x));',
    '  return c;',
    '}',

    // ---------------- photosphere ----------------
    'vec3 surface(vec2 p,float rr,float t){',
    '  float z=sqrt(max(1.0-rr*rr,0.0));',
    '  vec3 n=uRot*vec3(p,z);',
    '  vec3 w;',
    '  w.x=snoise(n*1.6+vec3(0.0,0.0,t*0.014+uSeed));',
    '  w.y=snoise(n*1.6+vec3(4.3,-2.1,-t*0.012));',
    '  w.z=uDetail>0.5?snoise(n*1.6+vec3(-6.1,3.7,t*0.015)):w.x*w.y;',
    '  float f=fbm(n*3.4+w*1.05,t);',                                    // churning turbulence
    '  float g=snoise(n*30.0+w*2.4+vec3(0.0,t*0.09,0.0));',              // granulation
    '  float gran=(0.72*smoothstep(0.0,0.5,abs(g))+0.28*smoothstep(-0.3,0.7,g))*1.75-1.0;',
    '  float lf=smoothstep(0.04,0.5,z);',                                  // foreshortening fade at the limb
    '  gran*=smoothstep(70.0,220.0,uRadius)*(0.75+0.25*w.y)*lf;',   // fade cells out before they alias
    '  float vn=snoise(n*4.2+w*1.6+vec3(t*0.02,0.0,9.0));',              // flowing dark veins
    '  float veins=pow(max(1.0-abs(vn),0.0),14.0);',
    '  float plage=smoothstep(0.40,1.0,w.x*0.6+w.y*0.4);',
    '  float mu=z;',
    '  float lean=max(dot(normalize(p+1e-5),uPointer.xy),0.0)*uPointer.z*(1.0-mu);',
    '  float tex=0.72*f+0.26*gran*(0.45+0.55*smoothstep(-0.3,0.5,f))-veins*0.24*lf+0.30*plage;',
    '  float heat=0.19+0.44*mu+0.30*pow(mu,8.0)+0.27*tex*(0.45+0.55*lf)+0.07*lean;',
    '  heat+=uI<1.0?(uI-1.0)*0.40:(uI-1.0)*0.17;',
    '  vec3 c=ramp(heat);',
    '  float b=(1.0-0.38*pow(1.0-mu,4.0))*(0.93+0.12*tex)*(0.42+0.58*min(uI,1.0));',
    '  return c*b;',
    '}',

    // ---------------- prominences ----------------
    // magnetic loops: a glowing bundle of fine strands arching between two footpoints; each one
    // rises, hangs, then drains away and is reborn elsewhere on the limb
    'vec3 prominences(float ang,float h,float t){',
    '  vec3 acc=vec3(0.0);',
    '  float sf=min(uRadius*0.9,260.0);',                    // strand frequency (~7 px period: never aliases)
    '  for(int k=0;k<3;k++){',
    '    float id=float(k);',
    '    float period=14.0+id*5.3;',
    '    float ph=t/period+id*0.37+uSeed*0.13;',
    '    float cyc=floor(ph);float f=ph-cyc;',
    '    float env=smoothstep(0.0,0.2,f)*(1.0-smoothstep(0.55,0.98,f));',
    '    if(env<0.002)continue;',
    '    float r1=hash11(cyc*7.13+id*31.7+uSeed*3.1);',
    '    float x=mod(ang-r1*6.2831853+3.14159265,6.2831853)-3.14159265;',
    '    if(abs(x)>0.46+0.45*h)continue;',                       // cheap angular reject (widest loop + lean)
    '    float r2=hash11(cyc*3.71+id*11.3+0.5);',
    '    float r3=hash11(cyc*5.19+id*2.9+0.25);',
    '    float w=0.07+0.09*r2;',                                   // footpoint half-separation (radii)
    '    float ht=(0.14+0.25*r3)*(0.35+0.65*smoothstep(0.0,0.7,f));', // loop height grows as it rises
    '    float th=0.022+0.024*r3;',                                 // half thickness of the bundle
    '    x-=h*(r1-0.5)*0.9;',                                     // loops lean a little
    '    if(abs(x)>w+th*5.0+0.05||h>ht+th*5.0+0.05)continue;',   // outside the compact support
    '    float n=snoise(vec3(x*6.0,h*6.0-t*0.2,id*9.1+cyc*1.7));',
    '    float n2=snoise(vec3(x*24.0,h*24.0-t*0.38,id*3.3-cyc));',
    '    vec2 q=vec2(x/w,h/ht)+vec2(n,0.6*n)*0.06;',
    '    float e=length(q);',
    '    vec2 gq=q/vec2(w,ht);',
    '    float d=(e-1.0)*e/max(length(gq),1e-3)+n2*th*0.12;',     // ~euclidean distance from the loop spine
    '    float ac=d/th;',
    '    float band=exp(-ac*ac*1.6);',
    '    float st=0.5+0.5*sin(d*sf+n*2.0);',
    '    st*=st;',
    '    float knots=0.6+0.4*sin(atan(q.y,q.x+1e-5)*6.0+n*2.5+id*2.1+cyc*1.3+t*0.15);',
    '    float body=band*(0.35+0.95*st)*knots;',
    '    float hc=max(1.0-ac*ac/22.0,0.0);',
    '    float halo=hc*hc*0.20*(0.75+0.25*n);',                 // soft glow, zero before the support edge
    '    float fill=(1.0-smoothstep(0.2,1.0,e))*(0.5+0.5*n2)*0.10;', // faint plasma held inside the arch
    '    float fx=(abs(x)-w)/(0.55*w+th);',
    '    float foot=max(1.0-h*16.0,0.0)*max(1.0-fx*fx*0.5,0.0)*0.6;',
    '    float top=clamp(h/ht,0.0,1.0);',
    '    vec3 tint=mix(mix(C_ORANGE,C_SUN,0.2),C_FLARE,0.2+0.65*top);',
    '    acc+=(tint*(body+halo+fill)+mix(C_SUN,C_HOT,0.3)*(foot*foot+band*st*knots*0.3*(1.0-0.6*top)))*env;',
    '  }',
    '  return acc*2.6;',
    '}',

    // ---------------- corona ----------------
    'vec3 corona(vec2 p,float rr,float t){',
    '  float h=max(rr-1.0,0.0);',
    '  vec2 dir=p/max(rr,1e-4);',
    '  float lean=max(dot(dir,uPointer.xy),0.0)*uPointer.z;',
    '  float reach=(0.45+0.55*min(uI,1.6))*(1.0+0.55*lean*lean);',
    '  float hn=h/reach;',
    '  float lobes=0.0;float fil=0.0;float fine=0.0;',
    '  if(hn<4.5){',
    '    float a=t*0.012+hn*0.16;',
    '    float ca=cos(a);float sa=sin(a);',
    '    vec2 d=vec2(ca*dir.x-sa*dir.y,sa*dir.x+ca*dir.y);',
    '    d=normalize(d+uPointer.xy*uPointer.z*0.30*min(hn,1.6));',
    '    float lr=log(1.0+hn);',
    '    lobes=smoothstep(-0.45,0.9,snoise(vec3(d*1.5,t*0.030+uSeed)));',
    '    float fa=snoise(vec3(d*7.0,lr*0.9-t*0.045+uSeed*3.0));',
    '    fil=pow(max(1.0-abs(fa),0.0),6.0);',
    '    if(uDetail>0.5){',
    '      float fb=snoise(vec3(d*19.0,lr*0.6-t*0.03+7.0));',
    '      fine=pow(max(1.0-abs(fb),0.0),9.0)*smoothstep(60.0,180.0,uRadius);',
    '    }',
    '  }',
    '  float f1=exp(-hn*20.0);',
    '  float f2=exp(-hn*4.2);',
    '  float f3=exp(-hn*1.35);',
    '  float f4=1.0/(1.0+hn*hn*5.0);',
    '  float streak=(0.40+0.95*lobes)*(0.42+1.15*fil+0.75*fine);',
    '  vec3 e=vec3(0.0);',
    '  e+=mix(C_HOT,C_SUN,0.45)*f1*1.15;',
    '  e+=mix(C_SUN,C_ORANGE,smoothstep(0.0,0.35,hn))*f2*0.62*streak;',
    '  e+=mix(C_ORANGE,C_FLARE,smoothstep(0.1,1.4,hn))*f3*0.30*(0.35+0.65*streak);',
    '  e+=C_FLARE*f4*0.05;',
    // chromospheric rim + spicules
    '  if(h<0.14){',
    '    float sp=0.5+0.5*snoise(vec3(dir*46.0,t*0.35));',
    '    float rim=exp(-h*uRadius*0.9/(0.35+1.4*sp*sp+0.4*uDetail));',
    '    e+=mix(C_FLARE,C_ORANGE,0.55)*rim*1.25;',
    '  }',
    '  if(h<0.7){e+=prominences(atan(dir.y,dir.x),h,t);}',
    '  float gain=(0.10+0.90*min(uI,1.0))+max(uI-1.0,0.0)*0.85;',
    '  return e*gain*(1.0+0.45*lean);',
    '}',

    'void main(){',
    '  vec2 p=(gl_FragCoord.xy-uCenter)/uRadius;',
    '  float rr=length(p);',
    '  if(rr>uMaxR){gl_FragColor=vec4(0.0);return;}',
    '  float t=uTime;',
    // heat shimmer: tiny, limb-weighted displacement
    '  float aa=1.25/uRadius;',
    '  float disc=1.0-smoothstep(1.0-aa,1.0+aa,rr);',
    '  vec3 cc=vec3(0.0);',
    '  if(disc<1.0){',
    '    float shA=smoothstep(1.0,1.06,rr)*exp(-(rr-1.0)*6.0)*(0.004+0.003*uDetail);',
    '    vec2 ps=p+vec2(sin(p.y*31.0+t*2.3+2.0*sin(p.x*9.0-t*0.7)),sin(p.x*29.0-t*1.9+2.0*sin(p.y*7.0+t*0.9)))*shA;',
    '    vec3 ce=corona(ps,max(length(ps),1.0),t)*1.15;',
    '    float cm=max(max(ce.r,ce.g),ce.b);',
    '    vec3 hp=ce*((1.0-exp(-cm))/max(cm,1e-4));',
    '    cc=mix(hp,1.0-exp(-ce),0.3);',
    '  }',
    '  vec3 sc=vec3(0.0);',
    '  if(disc>0.0){sc=surface(p,min(rr,1.0),t);}',
    '  vec3 col=mix(cc,sc,disc);',
    '  float a=max(max(col.r,col.g),col.b);',
    '  if(a>0.003){',
    '    col+=(hash12(gl_FragCoord.xy+fract(t*7.13)*91.7)-0.5)/255.0;',
    '    col=max(col,0.0);',
    '    a=max(a,max(max(col.r,col.g),col.b));',
    '  }',
    '  a=mix(clamp(a,0.0,1.0),1.0,disc);',
    '  gl_FragColor=vec4(min(col,vec3(a)),a);',
    '}'
  ].join('\n');

  // quality ladder: backing-store scale (× capped dpr), fbm octaves, extra detail layers, pixel budget
  var LEVELS = [
    { scale: 1.0, oct: 5, detail: 1, maxPx: 3.2e6 },
    { scale: 0.8, oct: 4, detail: 1, maxPx: 2.2e6 },
    { scale: 0.72, oct: 3, detail: 0, maxPx: 1.4e6 },
    { scale: 0.5, oct: 3, detail: 0, maxPx: 0.9e6 }
  ];
  var STATIC_T = 311.6; // clock time with three prominences up on the limb (default seed), for the reduced-motion frame
  var SLOW_MS = 22;    // 'auto' steps down when typical frames take longer than this
  var UNIFORMS = ['uCenter', 'uRadius', 'uTime', 'uI', 'uPointer', 'uOct', 'uDetail', 'uSeed', 'uMaxR', 'uRot'];
  // linked programs, per WebGL context: destroy() + mount() on the same canvas reuses it (no recompile, no blank frame)
  var progCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function noop() {}
  function noopController() {
    return {
      gl: false,
      destroy: noop, setIntensity: noop, setPointer: noop, resize: noop,
      setCenter: noop, setRadius: noop, snapshot: noop, pause: noop, play: noop,
      stats: function () { return { gl: false }; }
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function mqMatches(q) {
    try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; }
  }
  function warn(msg, detail) {
    if (window.console && console.warn) console.warn('[GSSun] ' + msg, detail || '');
  }

  function mount(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') return noopController();
    if (canvas.__gsSun) { try { canvas.__gsSun.destroy(); } catch (e) { /* ignore */ } }
    opts = opts || {};

    var center = Array.isArray(opts.center) ? [num(opts.center[0], 0.72), num(opts.center[1], 0.62)] : [0.72, 0.62];
    var radius = Math.max(0.01, num(opts.radius, 0.34));
    var intensity = clamp(num(opts.intensity, 1), 0, 2);
    var intensityTarget = intensity;
    var usePointer = opts.pointer !== false;
    var dprMax = Math.max(0.5, num(opts.dprMax, 1.5));
    var qualityOpt = opts.quality === 'high' || opts.quality === 'low' ? opts.quality : 'auto';
    var seed = num(opts.seed, 0.37);
    var onReady = typeof opts.onReady === 'function' ? opts.onReady : null;

    // purely decorative: keep it out of the accessibility tree unless the page decided otherwise
    if (!canvas.hasAttribute('aria-hidden') && !canvas.hasAttribute('role')) canvas.setAttribute('aria-hidden', 'true');

    function parentEl() { return canvas.parentElement; }
    function emit(name) {
      try { canvas.dispatchEvent(new CustomEvent(name, { bubbles: true })); } catch (e) { /* old browsers */ }
    }
    function setNoGL(on) {
      var p = parentEl();
      if (!p) return;
      if (on) {
        var was = p.classList.contains('no-gl');
        p.classList.add('no-gl'); p.classList.remove('gl-on');
        if (!was) emit('gs:sun-fallback');
      } else p.classList.remove('no-gl');
    }

    var attrs = {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'default',
      // a software rasteriser can't run this at frame rate — prefer the CSS fallback
      failIfMajorPerformanceCaveat: !opts.allowSoftware
    };
    var gl = null;
    try {
      gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    } catch (e) { gl = null; }
    if (!gl || (gl.isContextLost && gl.isContextLost())) { setNoGL(true); return noopController(); }

    var prog = null, buf = null, U = {}, pending = null, pendingAge = 0, ready = false, failed = false;
    var destroyed = false, lost = false, paused = false, visible = true, raf = 0, drawnOnce = false, dirty = false;
    var reduced = mqMatches('(prefers-reduced-motion: reduce)');
    var level = qualityOpt === 'low' ? 2 : 0;
    if (qualityOpt === 'auto') {
      var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
      var small = vw < 700 || Math.min(vw, vh) < 560;
      var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
                 (navigator.deviceMemory && navigator.deviceMemory <= 2);
      level = small || weak ? 2 : 0;
    }
    var bw = 0, bh = 0, dprSeen = 0;
    var clock = 14.0 + seed * 7.0; // start just as three prominences rise (default seed), not on a bare limb
    var last = 0, carry = 0;
    var samples = [], sampleT = 0, warmT = 1.5, slowStreak = 0, frameMs = 0, throttle = false, frameFlip = false;
    var ptr = { has: false, cx: 0, cy: 0, manual: false, nx: 0, ny: 0 };
    var rect = null, rectAge = 1e9;
    var pdx = -0.7071, pdy = 0.7071, pStr = 0, pStrTarget = 0, pLx = 0, pLy = 0;
    var parallel = gl.getExtension('KHR_parallel_shader_compile');

    // ---------- GL setup (never blocks the main thread on the compile) ----------
    function shader(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    }
    function startCompile() {
      var vs = shader(gl.VERTEX_SHADER, VERT);
      var fs = shader(gl.FRAGMENT_SHADER, FRAG);
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      pending = { p: p, vs: vs, fs: fs };
      pendingAge = 0;
    }
    function compileDone() {
      if (parallel) return gl.getProgramParameter(pending.p, parallel.COMPLETION_STATUS_KHR);
      // no KHR_parallel_shader_compile: the GPU process still compiles in the background, so give it a
      // couple of frames before asking for LINK_STATUS (that query blocks until the link is done)
      return ++pendingAge > 2;
    }
    function bindProgram(p, b) {
      prog = p; buf = b;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      U = {};
      UNIFORMS.forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
    }
    function finishCompile() {
      var pd = pending; pending = null;
      if (gl.isContextLost()) return false;
      if (!gl.getProgramParameter(pd.p, gl.LINK_STATUS)) {
        warn('shader failed', gl.getShaderInfoLog(pd.fs) || gl.getProgramInfoLog(pd.p));
        gl.deleteProgram(pd.p); gl.deleteShader(pd.vs); gl.deleteShader(pd.fs);
        return false;
      }
      gl.detachShader(pd.p, pd.vs); gl.detachShader(pd.p, pd.fs);
      gl.deleteShader(pd.vs); gl.deleteShader(pd.fs);
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      bindProgram(pd.p, b);
      if (progCache) progCache.set(gl, { prog: prog, buf: buf });
      return true;
    }
    // returns true once the program is usable; drives the async compile
    function ensureReady() {
      if (ready) return true;
      if (failed || lost || destroyed || !pending) return false;
      if (!compileDone()) return false;
      if (finishCompile()) { ready = true; setNoGL(false); return true; }
      failed = true;
      setNoGL(true);
      stop();
      return false;
    }

    // ---------- sizing ----------
    // 0 = no size yet, 1 = unchanged, 2 = backing store resized (which clears it)
    function measure() {
      if (destroyed || lost) return 0;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) { var r = canvas.getBoundingClientRect(); w = r.width; h = r.height; }
      if (!w || !h) return 0;
      var L = LEVELS[level];
      dprSeen = window.devicePixelRatio || 1;
      var ratio = Math.min(dprSeen, dprMax) * L.scale;
      var tw = w * ratio, th = h * ratio;
      if (tw * th > L.maxPx) { var k = Math.sqrt(L.maxPx / (tw * th)); tw *= k; th *= k; }
      tw = Math.max(1, Math.round(tw));
      th = Math.max(1, Math.round(th));
      if (tw === bw && th === bh) return 1;
      bw = canvas.width = tw; bh = canvas.height = th;
      dirty = true; // the backing store is now blank until the next draw
      return 2;
    }

    // ---------- drawing ----------
    var rotM = new Float32Array(9);
    function setRot(t) {
      // photosphere spins about a tilted axis; the pointer adds a gentle parallax "look"
      var ay = t * 0.018 + pLx * 0.16;
      var ax = 0.38 - pLy * 0.12;
      var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      // R = Ry * Rx, column-major
      rotM[0] = cy;      rotM[1] = 0;   rotM[2] = -sy;
      rotM[3] = sy * sx; rotM[4] = cx;  rotM[5] = cy * sx;
      rotM[6] = sy * cx; rotM[7] = -sx; rotM[8] = cy * cx;
    }
    function draw(t) {
      if (destroyed || lost || !bw || !bh || !ensureReady()) return false;
      var L = LEVELS[level];
      var I = intensity;
      var reach = (0.45 + 0.55 * Math.min(I, 1.6)) * 1.55;
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(prog);
      gl.uniform2f(U.uCenter, center[0] * bw, (1 - center[1]) * bh);
      gl.uniform1f(U.uRadius, Math.max(2, radius * Math.min(bw, bh)));
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uI, I);
      gl.uniform3f(U.uPointer, pdx, pdy, reduced ? 0 : pStr);
      gl.uniform1f(U.uOct, L.oct);
      gl.uniform1f(U.uDetail, L.detail);
      gl.uniform1f(U.uSeed, seed);
      gl.uniform1f(U.uMaxR, 1.0 + 5.2 * reach);
      setRot(t);
      gl.uniformMatrix3fv(U.uRot, false, rotM);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      dirty = false;
      if (!drawnOnce) {
        drawnOnce = true;
        var p = parentEl();
        if (p) p.classList.add('gl-on');
        emit('gs:sun-ready');
        if (onReady) { try { onReady(api); } catch (e) { warn('onReady threw', e); } }
      }
      return true;
    }
    function frameTime() { return reduced ? STATIC_T + seed * 3.0 : clock; }
    function drawNow() {
      // one frame at the current state (used when not animating)
      if (measure()) draw(frameTime());
    }

    // ---------- pointer ----------
    function updatePointer(dt) {
      var tx = null, ty = null;
      if (ptr.manual) { tx = ptr.nx; ty = ptr.ny; }
      else if (ptr.has) {
        // the canvas box is re-read only after a scroll / resize or every ~0.5 s, never every frame
        rectAge += dt;
        if (!rect || rectAge > 0.5) { rect = canvas.getBoundingClientRect(); rectAge = 0; }
        if (rect.width && rect.height) {
          tx = ((ptr.cx - rect.left) / rect.width) * 2 - 1;
          ty = ((ptr.cy - rect.top) / rect.height) * 2 - 1;
        }
      }
      var k = 1 - Math.exp(-dt * 3.2);
      if (tx !== null) {
        // vector sun-centre -> pointer in backing-store px, GL y-up
        var vx = (tx * 0.5 + 0.5 - center[0]) * bw;
        var vy = (center[1] - (ty * 0.5 + 0.5)) * bh;
        var len = Math.sqrt(vx * vx + vy * vy);
        var Rpx = Math.max(1, radius * Math.min(bw, bh));
        pStrTarget = clamp((len - Rpx * 0.15) / (Rpx * 0.9), 0, 1) * clamp(1.6 - len / (Rpx * 6), 0.45, 1);
        if (len > 1e-3) {
          var ex = pdx + (vx / len - pdx) * k, ey = pdy + (vy / len - pdy) * k;
          var el = Math.sqrt(ex * ex + ey * ey) || 1;
          pdx = ex / el; pdy = ey / el;
        }
        pLx += (clamp(tx, -1, 1) - pLx) * k;
        pLy += (clamp(ty, -1, 1) - pLy) * k;
      } else {
        pStrTarget = 0;
        pLx -= pLx * k;
        pLy -= pLy * k;
      }
      pStr += (pStrTarget - pStr) * (1 - Math.exp(-dt * 2.4));
    }
    function onPointerMove(e) { ptr.has = true; ptr.cx = e.clientX; ptr.cy = e.clientY; }
    function onPointerOut(e) { if (!e.relatedTarget) ptr.has = false; }
    function onPointerEnd(e) { if (e.pointerType === 'touch') ptr.has = false; }
    function onBlur() { ptr.has = false; }
    function onScroll() { rectAge = 1e9; }

    // ---------- loop ----------
    function running() {
      return !destroyed && !lost && !failed && !reduced && !paused && visible && !document.hidden;
    }
    function frame(now) {
      raf = 0;
      if (!running()) return;
      raf = requestAnimationFrame(frame);
      if (!ready && !ensureReady()) { last = 0; return; } // still compiling
      var raw = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      monitor(Math.min(raw, 0.5));
      carry += raw > 0.25 ? 1 / 60 : raw; // after a stall, don't jump the clock
      if (throttle) { frameFlip = !frameFlip; if (frameFlip && !dirty) return; } // half rate, but never leave a cleared buffer
      var step = Math.min(carry, 0.1);
      carry = 0;
      clock += step;
      intensity += (intensityTarget - intensity) * (1 - Math.exp(-step * 5.0));
      if (usePointer || ptr.manual) updatePointer(step);
      if (!bw || (window.devicePixelRatio || 1) !== dprSeen) measure(); // also follows a monitor / zoom change
      draw(clock);
    }
    // 'auto' quality: judge wall-clock frame time over ~1 s windows. The slowest quarter of each window is
    // ignored so main-thread hiccups (page load, font swaps, long tasks) don't read as a slow GPU.
    function monitor(dt) {
      if (qualityOpt !== 'auto') return;
      if (warmT > 0) { warmT -= dt; return; }
      samples.push(dt); sampleT += dt;
      if (sampleT < 1.0 || samples.length < 12) return;
      samples.sort(function (a, b) { return a - b; });
      var n = Math.max(1, Math.floor(samples.length * 0.75)), sum = 0;
      for (var i = 0; i < n; i++) sum += samples[i];
      frameMs = sum / n * 1000;
      samples.length = 0; sampleT = 0;
      if (frameMs <= SLOW_MS) { slowStreak = 0; return; }
      slowStreak += frameMs > 40 ? 2 : 1;
      if (slowStreak < 2) return;
      slowStreak = 0;
      if (level < LEVELS.length - 1) { level++; warmT = 0.5; measure(); }
      else if (frameMs > 34) throttle = true;
    }
    function kick() {
      if (!raf && running()) {
        last = 0; carry = 0;
        samples.length = 0; sampleT = 0; warmT = Math.max(warmT, 0.4); // the first frames after a resume are noisy
        raf = requestAnimationFrame(frame);
      }
    }
    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function refresh() {
      if (destroyed || lost || failed) return;
      if (!ready) { if (running()) kick(); else kickStatic(); return; } // compiling: draw once it is done
      if (running()) { kick(); return; }                     // the loop will pick the change up
      if (!visible || document.hidden) { dirty = true; return; } // drawn when it comes back into view
      drawNow();
    }
    function wake() {
      if (running()) kick();
      else if (dirty) refresh();
    }
    // not animating (reduced motion, paused, off-screen) while the program compiles: poll until it is ready.
    // Also runs while a .no-gl parent hides the canvas after a context restore, so it can un-hide itself.
    var staticRaf = 0;
    function kickStatic() {
      if (staticRaf || destroyed) return;
      staticRaf = requestAnimationFrame(function () {
        staticRaf = 0;
        if (destroyed || lost || failed) return;
        if (ensureReady()) refresh(); else kickStatic();
      });
    }

    // ---------- observers & listeners ----------
    var ro = null, io = null, mql = null;
    function onResize() {
      if (destroyed || lost) return;
      rectAge = 1e9;
      // resizing the backing store clears it: redraw synchronously (RO callbacks run before paint)
      if (measure() !== 2 || !ready) return;
      if (visible && !document.hidden) draw(frameTime()); else dirty = true;
    }
    function onWinResize() {
      if (destroyed || lost) return;
      rectAge = 1e9;
      // 'resize' fires before this frame's rAF: while animating, just size the buffer and let the loop draw
      if (running()) measure(); else onResize();
    }
    if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(onResize); ro.observe(canvas); }
    window.addEventListener('resize', onWinResize, { passive: true });

    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) wake(); else stop();
      }, { rootMargin: '120px 0px' });
      io.observe(canvas);
    }
    function onVis() { if (document.hidden) stop(); else wake(); }
    document.addEventListener('visibilitychange', onVis);

    function onMotionPref() {
      reduced = mqMatches('(prefers-reduced-motion: reduce)');
      if (reduced) stop();
      refresh();
    }
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mql.addEventListener) mql.addEventListener('change', onMotionPref);
      else if (mql.addListener) mql.addListener(onMotionPref);
    } catch (e) { mql = null; }

    if (usePointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerEnd, { passive: true });
      window.addEventListener('pointercancel', onPointerEnd, { passive: true });
      document.addEventListener('pointerout', onPointerOut, { passive: true });
      window.addEventListener('blur', onBlur);
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    }

    function onLost(e) {
      e.preventDefault(); // signal that we want webglcontextrestored
      lost = true;
      ready = false; prog = null; buf = null; pending = null;
      if (progCache) progCache.delete(gl);
      stop();
      if (staticRaf) { cancelAnimationFrame(staticRaf); staticRaf = 0; }
      setNoGL(true);
    }
    function onRestored() {
      if (destroyed) return;
      lost = false; failed = false; drawnOnce = false;
      bw = bh = 0;
      parallel = gl.getExtension('KHR_parallel_shader_compile'); // extension objects die with the context
      try { startCompile(); } catch (e) { failed = true; setNoGL(true); return; }
      measure();
      refresh();
    }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    var api = {
      gl: true,
      setIntensity: function (v, immediate) {
        intensityTarget = clamp(num(v, 1), 0, 2);
        if (immediate || !running()) { intensity = intensityTarget; refresh(); }
      },
      setPointer: function (nx, ny) {
        if (nx === null || nx === undefined) { ptr.manual = false; return; }
        ptr.manual = true;
        ptr.nx = clamp(num(nx, 0), -1, 1);
        ptr.ny = clamp(num(ny, 0), -1, 1);
      },
      setCenter: function (x, y) {
        center[0] = num(x, center[0]); center[1] = num(y, center[1]);
        if (!running()) refresh();
      },
      setRadius: function (r) {
        radius = Math.max(0.01, num(r, radius));
        if (!running()) refresh();
      },
      resize: function () {
        if (destroyed || lost) return;
        bw = bh = 0; rectAge = 1e9;
        if (measure() && ready) { if (visible && !document.hidden) draw(frameTime()); else dirty = true; }
      },
      pause: function () { paused = true; stop(); },
      play: function () { paused = false; kick(); },
      snapshot: function (seconds) {
        // pause and draw exactly one frame at the given clock time (posters, tests)
        if (destroyed || lost) return;
        paused = true; stop();
        if (seconds !== undefined) clock = num(seconds, clock);
        intensity = intensityTarget;
        if (measure()) {
          if (ready || ensureReady()) draw(frameTime());
          else kickStatic();
        }
      },
      stats: function () {
        return {
          gl: true, ready: ready, level: level, width: bw, height: bh, quality: qualityOpt,
          reduced: reduced, paused: paused, visible: visible, running: !!raf, throttled: throttle,
          frameMs: Math.round(frameMs * 10) / 10, time: clock, parallelCompile: !!parallel
        };
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stop();
        if (staticRaf) { cancelAnimationFrame(staticRaf); staticRaf = 0; }
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        window.removeEventListener('resize', onWinResize);
        document.removeEventListener('visibilitychange', onVis);
        if (mql) {
          if (mql.removeEventListener) mql.removeEventListener('change', onMotionPref);
          else if (mql.removeListener) mql.removeListener(onMotionPref);
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerEnd);
        window.removeEventListener('pointercancel', onPointerEnd);
        document.removeEventListener('pointerout', onPointerOut);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('scroll', onScroll, { capture: true });
        canvas.removeEventListener('webglcontextlost', onLost, false);
        canvas.removeEventListener('webglcontextrestored', onRestored, false);
        try {
          if (!gl.isContextLost()) {
            if (pending) { gl.deleteProgram(pending.p); gl.deleteShader(pending.vs); gl.deleteShader(pending.fs); }
            // the linked program + quad stay cached on this canvas's context for an instant remount
            if (!progCache) { if (prog) gl.deleteProgram(prog); if (buf) gl.deleteBuffer(buf); }
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        } catch (e) { /* ignore */ }
        pending = null;
        var p = parentEl();
        if (p) p.classList.remove('gl-on');
        if (canvas.__gsSun === api) canvas.__gsSun = null;
      }
    };
    canvas.__gsSun = api;

    // ---------- start ----------
    var hit = progCache && progCache.get(gl);
    if (hit && gl.isProgram(hit.prog) && gl.isBuffer(hit.buf)) {
      bindProgram(hit.prog, hit.buf); // remount on the same canvas: no compile needed
      ready = true;
      setNoGL(false);
    } else {
      try { startCompile(); } catch (e) { failed = true; }
      if (failed) {
        api.destroy();
        setNoGL(true);
        return noopController();
      }
    }
    measure();
    if (reduced) refresh();
    else { if (ready) draw(clock); kick(); }
    return api;
  }

  window.GSSun = { mount: mount, version: '2.1.0' };
})();
