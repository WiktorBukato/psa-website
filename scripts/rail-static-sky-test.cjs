const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'static-sky-live':'static-sky');fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
const check=(value,name)=>{report.checks.push({name,passed:!!value});if(!value)throw Error(name);};
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),requests=[];
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  check(await page.locator('.scene-controls,.scene-inspector,.scene-clouds,.cloud-drift').count()===0,'No old controls, inspector or cloud layer');
  check(!requests.some(u=>u.includes('sky-clouds')),'No cloud asset request');
  check(await page.locator('.scene-object').count()===29,'All 29 contours retained');
  check(await page.locator('.scene-light').count()===180,'All 180 lights retained');
  for(const file of ['rail-hero-1983.webp','rail-hero-960.webp'])check(sha(`.staging/${version}/assets/${file}`)===sha(`docs/v0.4.2/assets/${file}`),`Original photograph unchanged: ${file}`);
  await page.waitForFunction(()=>document.querySelector('.signal-lamp-red').getAnimations().length>0);
  for(const signal of await page.locator('.scene-signal').all()){
   check(await signal.evaluate(e=>getComputedStyle(e).visibility==='visible'),'Signal animation remains visible');
   check(await signal.evaluate(e=>{const a=e.getAnimations({subtree:true});a.forEach(x=>x.pause());for(const p of [0,.49999,.5,.99999,1]){a.forEach(x=>{const t=x.effect.getTiming();x.currentTime=t.duration*(p+1)+t.delay;});const [r,g]=['red','green'].map(c=>+getComputedStyle(e.querySelector(`.signal-lamp-${c}`)).opacity);if(r+g!==1)return false;}return true;}),'Signal has exactly one active aspect');
  }
  const map=await page.locator('.scene-svg').evaluate(e=>{const m=e.getScreenCTM();return {a:m.a,e:m.e,f:m.f};});
  await page.mouse.move(1280*map.a+map.e,345*map.a+map.f);await page.waitForTimeout(100);
  check(await page.locator('[data-asset-card="RS-02"]').isVisible(),'Train hover tooltip retained');
  const first=await page.locator('.scene-card').boundingBox();
  await page.mouse.move(1310*map.a+map.e,338*map.a+map.f);await page.waitForTimeout(100);
  const next=await page.locator('.scene-card').boundingBox();check(Math.abs(next.x-first.x)>10,'Tooltip still follows cursor');
  await page.mouse.move(0,0);
  await page.keyboard.press('Tab');await page.locator('[data-asset="RS-01"]').focus();
  check(await page.locator('[data-asset-card="RS-01"]').isVisible(),'Direct keyboard access displays tooltip');
  await page.keyboard.press('ArrowRight');
  check(await page.locator('.scene-object[tabindex="0"]').evaluate(e=>document.activeElement===e&&e.dataset.asset!=='RS-01'),'Arrow keys move roving focus');
  await page.keyboard.press('Escape');check(await page.locator('.scene-card').isHidden(),'Escape dismisses details');
  await page.locator('.rail-hero').screenshot({path:path.join(out,'hero-desktop.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
  check(await page.locator('.rail-hero').getAttribute('data-ambient-state')==='paused','Reduced motion still stops ambient effects');
  const original=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  await original.goto(pathToFileURL(path.resolve('docs/v0.4.2/rail/index.html')).href);
  // Isolate the underlying hero image for byte-level rendered comparison.
  const hide='.rail-scene,.scene-card,.scene-controls,.scene-inspector{display:none!important}';
  await page.addStyleTag({content:hide});await original.addStyleTag({content:hide});
  const [a,b]=await Promise.all([page,original].map(p=>p.locator('.rail-hero').screenshot()));
  const sharp=dependency('sharp');const [ra,rb]=await Promise.all([a,b].map(i=>sharp(i).raw().toBuffer()));
  check(ra.equals(rb),'Restored static hero pixels match original v0.4.2 exactly');
  await original.close();
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  touch.on('pageerror',e=>report.errors.push(e.message));await touch.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  // Find an actually exposed hit point, excluding text/CTA overlays and cropped objects.
  const hit=await touch.evaluate(()=>{const hero=document.querySelector('.rail-hero').getBoundingClientRect();for(let y=hero.bottom-25;y>hero.top+80;y-=12)for(let x=25;x<hero.right-20;x+=12){const e=document.elementFromPoint(x,y),o=e?.closest('.scene-object');if(o)return {x,y,id:o.dataset.asset};}return null;});
  check(!!hit,'A visible object can be tapped directly on mobile');
  await touch.touchscreen.tap(hit.x,hit.y);await touch.waitForTimeout(150);
  check(await touch.locator(`[data-asset-card="${hit.id}"]`).isVisible(),'Direct touch displays object details');
  const box=await touch.locator('.scene-card').boundingBox();check(box.x>=0&&box.x+box.width<=390,'Touch card stays inside viewport');
  await touch.locator('.rail-hero').screenshot({path:path.join(out,'hero-mobile-touch.png')});
  await touch.touchscreen.tap(hit.x,hit.y);check(await touch.locator('.scene-card').isHidden(),'Repeated tap dismisses details');
  check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
