const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const scene=require('../src/rail-scene.json');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'scene-live':'scene');fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
function check(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.sky-ready');
  check(await page.locator('.scene-object').count()===29,'29 inspectable assets');
  check(await page.locator('.scene-card-close,.scene-disclaimer').count()===0,'No close cross or lower disclaimer in tooltip');
  await page.locator('.scene-inspect-toggle').click();
  for(const object of scene.objects){
   await page.selectOption('#scene-asset',object.id);
   check(await page.locator(`[data-asset-card="${object.id}"]`).isVisible(),`${object.id}: keyboard selection displays its content`);
  }
  await page.keyboard.press('Escape');
  const map=await page.locator('.scene-svg').evaluate(e=>{const m=e.getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f};});
  const point=(x,y)=>({x:x*map.a+map.e,y:y*map.d+map.f});
  const p1=point(1280,345),p2=point(1310,338);
  await page.mouse.move(p1.x,p1.y);await page.waitForTimeout(100);
  check(await page.locator('[data-asset-card="RS-02"]').isVisible(),'Hover identifies the nearer red train');
  const before=await page.locator('.scene-card').boundingBox();
  await page.mouse.move(p2.x,p2.y);await page.waitForTimeout(100);
  const after=await page.locator('.scene-card').boundingBox();
  check(Math.abs(after.x-before.x)>10,'Tooltip follows cursor rather than staying at entry point');
  check(await page.locator('.scene-card').evaluate(e=>getComputedStyle(e).pointerEvents==='none'&&getComputedStyle(e).backgroundColor.includes('0.6')),'Translucent tooltip does not intercept the pointer');
  await page.locator('.rail-hero').screenshot({path:path.join(out,'cursor-tooltip.png')});
  await page.mouse.move(0,0);check(await page.locator('.scene-card').isHidden(),'Leaving the hero dismisses hover tooltip');
  // Review contours by category, keeping original photo visible and interactive geometry exact.
  for(const prefix of ['RS','SIG','OLE','TRK','INF']){
   await page.locator('.scene-object').evaluateAll((nodes,p)=>nodes.forEach(n=>n.classList.toggle('is-selected',n.dataset.asset.startsWith(p))),prefix);
   await page.waitForTimeout(240);
   await page.locator('.rail-hero').screenshot({path:path.join(out,`contours-${prefix}.png`)});
  }
  await page.locator('.scene-object').evaluateAll(nodes=>nodes.forEach(n=>n.classList.remove('is-selected')));
  await page.locator('.scene-motion-toggle').click();
  check(await page.locator('.cloud-drift').evaluateAll(nodes=>nodes.every(n=>n.getAnimations().every(a=>a.playState==='paused'))),'Pause freezes both cloud passes');
  const hero=page.locator('.rail-hero');
  // Holding every other layer still isolates real cloud pixels from lights/scanlines.
  await page.addStyleTag({content:'.scene-lights,.scene-aircraft,.scene-scanlines,.scene-scanband,.scene-signal{visibility:hidden!important}'});
  await page.waitForTimeout(300);
  const frames=[];
  for(const time of [0,35000,69990,70010]){
   await page.locator('.cloud-drift').evaluateAll((nodes,t)=>nodes.forEach(n=>n.getAnimations().forEach(a=>{a.pause();a.currentTime=t;})),time);
   const frame=await hero.screenshot();frames.push(frame);fs.writeFileSync(path.join(out,`clouds-${time}.png`),frame);
  }
  const sharp=dependency('sharp');
  const raw=await Promise.all(frames.map(f=>sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
  const bounds=await hero.boundingBox(),landY=Math.ceil(map.f-bounds.y+300*map.d);
  let skyChanged=0,landChanged=0,seamDelta=0,seamPixels=0;
  for(let i=0;i<raw[0].data.length;i+=4){
   const d=Math.max(...[0,1,2].map(c=>Math.abs(raw[0].data[i+c]-raw[1].data[i+c])));
   if(d>10){if(Math.floor(i/4/raw[0].info.width)>landY)landChanged++;else skyChanged++;}
   const seam=Math.max(...[0,1,2].map(c=>Math.abs(raw[2].data[i+c]-raw[3].data[i+c])));seamDelta=Math.max(seamDelta,seam);if(seam>10)seamPixels++;
  }
  check(skyChanged>200,'Clouds visibly move between rendered frames');
  check(landChanged===0,'Cloud motion leaves all railway foreground pixels unchanged');
  check(seamDelta<32&&seamPixels<raw[0].info.width*raw[0].info.height*.001,'Cloud handoff is continuous (only sparse subpixel resampling changes)');
  for(const [x,y]of [[1358,210],[1382,220],[1888,130],[1707,220],[895,180]]){
   const p=point(x,y),px=Math.round(p.x-bounds.x),py=Math.round(p.y-bounds.y),i=(py*raw[0].info.width+px)*4;
   if(px>=0&&px<raw[0].info.width&&py>=0&&py<raw[0].info.height)check([0,1,2].every(c=>raw[0].data[i+c]===raw[1].data[i+c]),`Skyline object ${x},${y} remains stationary`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.locator('.scene-clouds').evaluate(e=>getComputedStyle(e).display==='none'),'Reduced motion uses original sky');
  await page.close();
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await touch.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await touch.locator('.scene-inspect-toggle').tap();await touch.selectOption('#scene-asset','RS-06');
  check(await touch.locator('[data-asset-card="RS-06"]').isVisible(),'Touch selector reaches expanded objects');
  const card=await touch.locator('.scene-card').boundingBox();
  check(card.x>=0&&card.x+card.width<=390,'Touch tooltip fits viewport');
  await touch.locator('.rail-hero').screenshot({path:path.join(out,'mobile-inspector.png')});
  await touch.locator('.scene-inspect-toggle').tap();check(await touch.locator('.scene-card').isHidden(),'Touch toggle dismisses card without a close cross');
  check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
