// Rendered-frame checks: a scheduled animation is not proof that it is visible.
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'rendered-motion-live':'rendered-motion');fs.mkdirSync(out,{recursive:true});
const sharp=dependency('sharp'),report={version,base,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
const check=(value,name,detail)=>{report.checks.push({name,passed:!!value,detail});if(!value)throw Error(name);};
async function difference(a,b){
 const [first,last]=await Promise.all([a,b].map(input=>sharp(input).removeAlpha().raw().toBuffer()));
 let pixels=0,maxDelta=0;for(let i=0;i<first.length;i+=3){const delta=Math.max(...[0,1,2].map(c=>Math.abs(first[i+c]-last[i+c])));maxDelta=Math.max(maxDelta,delta);if(delta>12)pixels++;}return {pixels,maxDelta};
}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  for(const width of [390,1440,1920,2560]){
   const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('.scene-aircraft').getAnimations().length>0,{},{timeout:5000});
   const flight=await page.evaluate(()=>{
    const h=document.querySelector('.rail-hero').getBoundingClientRect(),air=document.querySelector('.scene-aircraft'),animation=air.getAnimations()[0];
    animation.pause();animation.currentTime=animation.effect.getTiming().duration*.25;
    const light=air.firstElementChild;light.getAnimations().forEach(a=>{a.pause();a.currentTime=300;});
    return {frames:animation.effect.getKeyframes(),hero:{x:h.x,y:h.y,width:h.width,height:h.height}};
   });
   const dot=await page.locator('.aircraft-light').boundingBox(),h=flight.hero;
   check(dot.x>h.x&&dot.x+dot.width<h.x+h.width&&dot.y>h.y&&dot.y+dot.height<h.y+h.height,`${width}: aircraft is inside visible sky`,{dot,hero:h});
   const hero=page.locator('.rail-hero');
   // Freeze all moving layers at the actual scheduled frame to isolate their pixels.
   await hero.evaluate(e=>e.getAnimations({subtree:true}).forEach(a=>a.pause()));
   await page.addStyleTag({content:'.scene-scanlines,.scene-scanband,.scene-lights{visibility:hidden!important}'});
   const skyClip={x:Math.max(0,Math.floor(dot.x)-12),y:Math.max(0,Math.floor(dot.y)-12),width:28,height:28};
   const planeOn=await page.screenshot({clip:skyClip});
   await page.locator('.scene-aircraft').evaluate(e=>e.style.visibility='hidden');
   const planeOff=await page.screenshot({clip:skyClip});
   const planeDelta=await difference(planeOn,planeOff);
   check(planeDelta.pixels>=2&&planeDelta.maxDelta>=35,`${width}: aircraft paints visible pixels`,planeDelta);
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
   const native=window.setTimeout,ids=new Set();
   window.setTimeout=(fn,delay,...args)=>{const id=native(()=>{ids.delete(id);fn(...args);},delay);ids.add(id);return id;};
   window.freezeScheduledCallbacks=()=>{ids.forEach(clearTimeout);ids.clear();};
  });
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>[...document.querySelectorAll('.scene-light')].filter(e=>+getComputedStyle(e).opacity>.25).length>=3,{},{timeout:4000});
  const naturallyLit=await page.locator('.scene-light').evaluateAll(nodes=>nodes.map(n=>+getComputedStyle(n).opacity));
  check(naturallyLit.filter(v=>v>.25).length>=3,'Several lights visibly rise within the first four seconds',naturallyLit);
  const hero=page.locator('.rail-hero'),frames=[];
  for(let i=0;i<12;i++){frames.push(await hero.screenshot());await page.waitForTimeout(180);}
  const frameDelta=await difference(frames[0],frames[6]);check(frameDelta.pixels>100,'Natural successive hero frames differ',frameDelta);
  const thumbs=await Promise.all(frames.map(input=>sharp(input).resize({width:960}).raw().ensureAlpha().toBuffer({resolveWithObject:true})));
  await sharp(Buffer.concat(thumbs.map(t=>t.data)),{raw:{width:960,height:thumbs[0].info.height*thumbs.length,channels:4,pageHeight:thumbs[0].info.height}}).gif({delay:240,loop:0}).toFile(path.join(out,'hero-motion.gif'));
  // Compare actual pixels at the same light positions, with unrelated layers held still.
  await hero.evaluate(e=>{window.freezeScheduledCallbacks();e.getAnimations({subtree:true}).forEach(a=>a.pause());});
  const isolate=await page.addStyleTag({content:'.scene-aircraft,.scene-scanlines,.scene-scanband{visibility:hidden!important}'});
  await page.locator('.scene-light').evaluateAll(nodes=>nodes.forEach(n=>n.getAnimations().forEach(a=>a.currentTime=a.effect.getTiming().duration*.4)));
  const on=await hero.screenshot();
  await page.locator('.scene-lights').evaluate(e=>e.style.visibility='hidden');
  const off=await hero.screenshot(),lightDelta=await difference(on,off);
  check(lightDelta.pixels>30&&lightDelta.maxDelta>35,'Light cores and halos visibly brighten the photograph',lightDelta);
  for(const [name,input]of [['lights-on',on],['lights-off',off]])await sharp(input).extract({left:1040,top:110,width:700,height:170}).resize(1400,340).png().toFile(path.join(out,`${name}.png`));
  await isolate.evaluate(e=>e.remove());
  const scan=page.locator('.scene-scanlines');
  await scan.evaluate(e=>e.getAnimations().forEach(a=>a.currentTime=0));const scanA=await hero.screenshot();
  await scan.evaluate(e=>e.getAnimations().forEach(a=>a.currentTime=225));const scanB=await hero.screenshot();
  const scanDelta=await difference(scanA,scanB);check(scanDelta.pixels>1000,'Scan lines visibly move between video frames',scanDelta);
  for(const [name,input]of [['scan-a',scanA],['scan-b',scanB]])await sharp(input).extract({left:1270,top:30,width:320,height:160}).resize(960,480).png().toFile(path.join(out,`${name}.png`));
  await page.locator('.scene-inspect-toggle').click();await page.selectOption('#scene-asset','RS-01');
  // The inspector card can cover this train on wide screens. Hide only the QA
  // controls while retaining the real selected state and its SVG animations.
  const hideCard=await page.addStyleTag({content:'.scene-inspector,.scene-card{visibility:hidden!important}'});
  const selected=page.locator('[data-asset="RS-01"]');
  await page.waitForTimeout(300);
  await selected.evaluate(e=>e.getAnimations({subtree:true}).filter(a=>!a.transitionProperty).forEach(a=>{a.pause();a.currentTime=0;}));const outlineA=await hero.screenshot();
  await selected.evaluate(e=>e.getAnimations({subtree:true}).filter(a=>!a.transitionProperty).forEach(a=>a.currentTime=1100));const outlineB=await hero.screenshot();
  const contourDelta=await difference(outlineA,outlineB);check(contourDelta.pixels>15,'Selected contour visibly pulses',contourDelta);
  for(const [name,input]of [['contour-a',outlineA],['contour-b',outlineB]])await sharp(input).extract({left:1670,top:170,width:195,height:145}).resize(780,580).png().toFile(path.join(out,`${name}.png`));
  const tracer=selected.locator('.scene-tracer');
  await tracer.evaluate(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0;}));const traceA=await hero.screenshot();
  await tracer.evaluate(e=>e.getAnimations().forEach(a=>a.currentTime=1800));const traceB=await hero.screenshot();
  const traceDelta=await difference(traceA,traceB);check(traceDelta.pixels>5,'The highlight travels independently of contour breathing',traceDelta);
  await hideCard.evaluate(e=>e.remove());
  await page.locator('.scene-motion-toggle').click();
  check(await hero.evaluate(e=>e.getAnimations({subtree:true}).filter(a=>!a.transitionProperty).every(a=>a.playState!=='running')),'Pause also suspends the contour highlight and rolling band');
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   const geometry=await page.locator(width<760?'.ecosystem-mini-track':'.ecosystem-track').first().evaluate(svg=>{
    const rails=svg.querySelector('.track-steel').getAttribute('d').match(/[\d.]+/g).map(Number);
    const sleepers=[...svg.querySelectorAll('.track-sleepers path')].map(p=>p.getAttribute('d').match(/-?[\d.]+/g).map(Number));
    return {rails,sleepers};
   });
   const {rails:r,sleepers:t}=geometry,m=t[Math.floor(t.length/2)];
   check(r[0]===r[3]&&r[2]===r[5]&&r[4]>r[1],`${width}: parallel rails share identical endpoints`,r);
   check(t[0][0]>t[0][2]&&m[0]===m[2]&&t.at(-1)[0]<t.at(-1)[2],`${width}: sleepers lean toward the centre with a vertical middle`);
   await page.locator('.rail-environment').screenshot({path:path.join(out,`rails-${width}.png`)});
  }
  await page.close();check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors},null,2));}
})();
