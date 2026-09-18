const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'motion-live':'motion');fs.mkdirSync(out,{recursive:true});
const report={version,base,checks:[],errors:[],manifestSha256:sha(path.join('.staging',version,'manifest.json'))};
function check(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  for(const width of [320,390,768,844,1440,1920,2560]){
   const page=await browser.newPage({viewport:{width,height:width===844?390:900},reducedMotion:'reduce',hasTouch:width<800});
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
   check(await page.locator('.rail-telemetry').count()===0,`${width}: static telemetry removed`);
   check(await page.locator('.scene-object').count()===require('../src/rail-scene.json').objects.length,`${width}: complete image object inventory`);
   check(await page.locator('.scene-controls,.scene-clouds').count()===0,`${width}: removed controls and cloud layer`);
   const registration=await page.evaluate(()=>{
    const hero=document.querySelector('.rail-hero').getBoundingClientRect(),plane=document.querySelector('.scene-image-plane').getBoundingClientRect(),img=document.querySelector('.rail-hero-picture img');
    const [px,py]=getComputedStyle(img).objectPosition.split(' ').map(parseFloat);
    const scale=Math.max(hero.width/1983,hero.height/793);
    return Math.max(Math.abs(plane.width-1983*scale),Math.abs(plane.height-793*scale),Math.abs(plane.left-hero.left-(hero.width-plane.width)*px/100),Math.abs(plane.top-hero.top-(hero.height-plane.height)*py/100));
   });
   check(registration<.1,`${width}: overlay follows exact image crop`);
   for(const object of require('../src/rail-scene.json').objects){
    await page.locator(`[data-asset="${object.id}"]`).focus();
    check(await page.locator(`[data-asset="${object.id}"]`).evaluate(o=>o.classList.contains('is-selected')),`${width}: focus ${object.id}`);
    check(await page.locator(`[data-asset-card="${object.id}"]`).isVisible(),`${width}: correct card ${object.id}`);
   }
   const inside=await page.evaluate(()=>{const h=document.querySelector('.rail-hero').getBoundingClientRect(),c=document.querySelector('.scene-card').getBoundingClientRect();return c.left>=h.left&&c.right<=h.right&&c.top>=h.top&&c.bottom<=h.bottom;});
   check(inside,`${width}: details fit hero`);
   await page.screenshot({path:path.join(out,`inspector-${width}.png`)});
   await page.keyboard.press('Escape');
   check(await page.locator('.scene-card').isHidden(),`${width}: Escape closes details`);
   check(await page.locator('.scene-object[tabindex="0"]').evaluate(e=>document.activeElement===e),`${width}: Escape preserves keyboard focus`);
   const dot=page.locator('.route-dot').first();await dot.scrollIntoViewIfNeeded();
   check(await dot.evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(52, 124, 128)',`${width}: node starts teal`);
   await page.locator('.environment-nodes>a').first().focus();
   check(await dot.evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(255, 132, 69)',`${width}: keyboard node becomes orange`);
   await page.locator('.rail-environment').screenshot({path:path.join(out,`track-${width}.png`)});
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
   let seed=17421;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   const animate=Element.prototype.animate;window.motionCalls=[];
   Element.prototype.animate=function(frames,options){window.motionCalls.push({class:this.getAttribute('class'),time:Date.now(),frames});return animate.call(this,frames,options);};
  });
  await page.clock.install();await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});await page.clock.runFor(300);
  check(await page.locator('.rail-hero').getAttribute('data-ambient-state')==='running','Ambient starts when visible');
  await page.clock.runFor(20000);
  const calls=await page.evaluate(()=>window.motionCalls);
  check(calls.some(c=>c.class==='scene-aircraft'),'Aircraft has a scheduled pass');
  check(calls.filter(c=>c.class==='scene-light').length>=5,'Independent lights start');
  check(new Set(calls.filter(c=>c.class==='scene-light').map(c=>c.time)).size>=5,'Lights do not share one clock');
  // Use a real path hit inside the foreground signal, not a bounding-box hover.
  const point=await page.locator('[data-asset="SIG-01"]').evaluate(e=>{const s=e.ownerSVGElement,p=s.createSVGPoint();p.x=1618;p.y=448;const c=p.matrixTransform(s.getScreenCTM());return {x:c.x,y:c.y};});
  await page.mouse.move(point.x,point.y);await page.clock.runFor(300);
  check(await page.locator('[data-asset-card="SIG-01"]').isVisible(),'Mouse reveals the object under its contour');
  await page.screenshot({path:path.join(out,'hero-hover-1440.png')});
  await page.keyboard.press('Escape');
  for(const [id,selector,animation]of [['signaling','.signal-lamp','signal-warmth'],['software','.code-cursor','code-blink'],['hardware','.cpu-pin','cpu-data'],['integration','.icon-gear','gear-turn'],['modernization','.database-ring','database-sync'],['verification','.check-one','check-write']]){
   await page.locator(`#cap-${id}`).hover();await page.clock.runFor(450);
   check(await page.locator(`#cap-${id} ${selector}`).first().evaluate(e=>getComputedStyle(e).animationName)===animation,`${id}: icon animates on hover`);
  }
  await page.locator('.rail-capabilities').screenshot({path:path.join(out,'capabilities-hover-1440.png')});
  await page.close();
  // IntersectionObserver is a rendering-lifecycle API; exercise it on the real
  // browser clock, separately from accelerated randomized-timer assertions.
  const lifecycle=await browser.newPage({viewport:{width:1440,height:900}});
  lifecycle.on('pageerror',e=>report.errors.push(e.message));
  await lifecycle.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await lifecycle.locator('.site-footer').scrollIntoViewIfNeeded();
  await lifecycle.waitForFunction(()=>document.querySelector('.rail-hero').dataset.ambientState==='paused');
  check(true,'Offscreen hero suspends ambient');
  await lifecycle.locator('.rail-hero').scrollIntoViewIfNeeded();
  await lifecycle.waitForFunction(()=>document.querySelector('.rail-hero').dataset.ambientState==='running');
  check(true,'Returning to hero resumes ambient');
  await lifecycle.emulateMedia({reducedMotion:'reduce'});
  await lifecycle.waitForFunction(()=>document.querySelector('.rail-hero').dataset.ambientState==='paused');
  check(true,'Changing OS motion preference stops ambient immediately');
  check(await lifecycle.locator('.rail-hero').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.effect.target.matches('.scene-light,.scene-aircraft,.aircraft-light,.scene-scanlines')).every(a=>a.playState!=='running')),'Reduced motion suspends all ambient animations');
  await lifecycle.emulateMedia({reducedMotion:'no-preference'});
  await lifecycle.waitForFunction(()=>document.querySelector('.rail-hero').dataset.ambientState==='running');
  check(true,'Restoring OS motion preference resumes ambient');
  await lifecycle.close();
  check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(error){report.passed=false;report.errors.push(error.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors},null,2));}
})();
