// Measures what a realistic HAND-DRAWN attempt scores, vs the machine-perfect
// shapes the original calibration used.
const puppeteer=require('puppeteer');
const CHROME=process.env.HOME+'/.cache/puppeteer/chrome/linux-151.0.7922.47/chrome-linux64/chrome';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// deterministic wobble so runs are comparable
let seed=12345;
function rnd(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
function wob(a){return (rnd()-0.5)*a;}

function circlePts(cx,cy,r,n,wobble,ar=1){
  const p=[];for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;
    const rr=r*(1+wob(wobble));
    p.push([cx+Math.cos(t)*rr, cy+Math.sin(t)*rr*ar]);}
  return p;
}
// a crescent moon as a person draws it: outer arc + inner arc joined
function crescentPts(cx,cy,r,wobble){
  const p=[];
  for(let i=0;i<=26;i++){const t=-Math.PI*0.45+i/26*Math.PI*1.9;
    const rr=r*(1+wob(wobble));p.push([cx+Math.cos(t)*rr,cy+Math.sin(t)*rr]);}
  for(let i=26;i>=0;i--){const t=-Math.PI*0.45+i/26*Math.PI*1.9;
    const rr=r*0.72*(1+wob(wobble));p.push([cx-r*0.30+Math.cos(t)*rr,cy+Math.sin(t)*rr]);}
  return p;
}
function starPts(cx,cy,R,r,wobble){
  const p=[];for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI/5;
    const rad=(i%2?r:R)*(1+wob(wobble));
    p.push([cx+Math.cos(a)*rad,cy+Math.sin(a)*rad]);}
  return p;
}
function heartPts(cx,cy,s,wobble){
  const p=[];for(let i=0;i<=40;i++){const t=i/40*Math.PI*2;
    const x=16*Math.pow(Math.sin(t),3);
    const y=-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));
    p.push([cx+x/16*s*(1+wob(wobble)), cy+y/16*s*(1+wob(wobble))]);}
  return p;
}

(async()=>{
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
    args:['--no-sandbox','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:960,height:700});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:3000/games/wilson/index.html',{waitUntil:'networkidle0'});
  await sleep(600);
  await p.evaluate(()=>window.__wilson.reset());

  async function trial(label,prompt,draw){
    const r=await p.evaluate(async (prompt,draw)=>{
      const W=window.__wilson; W.play(); W.setPrompt(prompt);
      for(const s of draw) W.strokePoly(s.pts,s.w,s.c||'white',s.close);
      return W.score();
    },prompt,draw);
    console.log((label+' ').padEnd(36,'.')+
      ' match='+(r.match*100).toFixed(0).padStart(3)+'%'+
      ' grade='+r.grade+
      (r.guess?('  guess='+r.guess.name+(r.alt?' / '+r.alt.name:'')):''));
    return r;
  }

  console.log('=== HAND-DRAWN ATTEMPTS (what a real player produces) ===');
  await trial('moon: decent crescent','moon',
    [{pts:crescentPts(0.5,0.5,0.30,0.05),w:0.012,close:true}]);
  await trial('moon: neat crescent','moon',
    [{pts:crescentPts(0.5,0.5,0.30,0.02),w:0.010,close:true}]);
  await trial('smiley tag: wobbly circle','smiley',
    [{pts:circlePts(0.5,0.5,0.28,40,0.06),w:0.014,close:true}]);
  await trial('heart: decent','heart',
    [{pts:heartPts(0.5,0.5,0.30,0.05),w:0.013,close:true}]);
  await trial('star: decent','star',
    [{pts:starPts(0.5,0.5,0.30,0.13,0.06),w:0.012,close:true}]);
  await trial('ghost: blob + feet','ghost',
    [{pts:circlePts(0.5,0.45,0.24,30,0.05),w:0.013,close:true}]);

  console.log('\n=== FREESTYLE RECOGNITION (what does Wilson guess?) ===');
  const face=[
    {pts:circlePts(0.5,0.5,0.26,40,0.04),w:0.013,close:true},        // head
    {pts:circlePts(0.42,0.43,0.030,12,0.05),w:0.010,close:true},     // eye
    {pts:circlePts(0.58,0.43,0.030,12,0.05),w:0.010,close:true},     // eye
    {pts:[[0.40,0.58],[0.45,0.63],[0.55,0.63],[0.60,0.58]],w:0.012}  // smile
  ];
  await trial('freestyle: a FACE','free',face);
  await trial('freestyle: a heart','free',
    [{pts:heartPts(0.5,0.5,0.30,0.04),w:0.013,close:true}]);
  await trial('freestyle: a star','free',
    [{pts:starPts(0.5,0.5,0.30,0.13,0.05),w:0.012,close:true}]);
  await trial('freestyle: a crescent moon','free',
    [{pts:crescentPts(0.5,0.5,0.30,0.04),w:0.011,close:true}]);

  console.log('\nerrors:',errs.length?errs.slice(0,2).join('|'):'(none)');
  await b.close();
})().catch(e=>{console.error('FATAL:',e.message);process.exit(1);});
