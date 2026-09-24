const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||'v0.9',base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'polish-live':'polish');fs.mkdirSync(out,{recursive:true});
const report={version,base,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
function check(ok,name,detail){report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [320,390,768,1440,1920,2560]){
  const page=await browser.newPage({viewport:{width,height:width<500?844:900}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  const proof=await page.evaluate(()=>[...document.querySelector('.rail-proof .proof-grid').children].map(e=>{
   const outer=e.getBoundingClientRect(),head=e.querySelector('h2,strong'),r=head.getBoundingClientRect();return {text:head.textContent.trim(),outerLeft:outer.left,outerRight:outer.right,textLeft:r.left,textRight:r.right,scroll:e.scrollWidth,client:e.clientWidth};
  }));
  check(proof.every(p=>p.textRight<=p.outerRight+1&&p.textLeft>=p.outerLeft-1&&p.scroll<=p.client+1),`${width}: proof labels remain inside separators`,proof);
  const icons=await page.evaluate(()=>[...document.querySelectorAll('.rail-proof .proof-grid > :nth-child(n+4) svg')].map(e=>e.outerHTML));
  check(icons.length===2&&icons[0]!==icons[1],`${width}: standards and ISO use distinct icons`);
  check(await page.locator('.rail-client-logos a').count()===6&&await page.locator('.rail-partner-logos a').count()===9,`${width}: client and partner inventories are distinct`);
  await page.locator('.rail-trust').scrollIntoViewIfNeeded();
  await page.locator('.rail-logo-field img').evaluateAll(async images=>{for(const image of images)image.loading='eager';await Promise.all(images.map(image=>image.decode().catch(()=>{})));});
  const destinations=await page.locator('.rail-logo-field a').evaluateAll(es=>es.map(a=>({url:a.href,valid:a.querySelector('img')?.complete&&a.querySelector('img')?.naturalWidth>0})));
  check(destinations.every(x=>x.valid&&x.url.startsWith('http')),`${width}: all logos and destinations load`);
  check(await page.locator('.rail-hero-picture img').getAttribute('src')==='../assets/rail-hero-clean-v09-1983.webp',`${width}: cleaned hero selected`);
  await page.locator('.rail-proof').screenshot({path:path.join(out,`proof-${width}.png`)});
  await page.locator('.rail-trust').screenshot({path:path.join(out,`trust-${width}.png`)});
  const trustBounds=await page.locator('.rail-trust').evaluate(section=>{const box=section.getBoundingClientRect();return [...section.querySelectorAll('.rail-logo-field a')].map(a=>{const r=a.getBoundingClientRect();return {top:r.top,bottom:r.bottom,sectionTop:box.top,sectionBottom:box.bottom};});});
  check(trustBounds.every(r=>r.top>=r.sectionTop&&r.bottom<=r.sectionBottom),`${width}: floating logos remain inside trust section`,trustBounds.slice(-3));
  if(width===1920){await page.evaluate(()=>document.querySelectorAll('.scene-object').forEach(e=>e.classList.add('is-selected')));await page.locator('.rail-hero').screenshot({path:path.join(out,'hero-all-contours-1920.png')});}
  const float=await page.locator('.rail-logo-field a').evaluateAll(es=>es.map(e=>({duration:getComputedStyle(e).animationDuration,x:getComputedStyle(e).getPropertyValue('--drift-x'),y:getComputedStyle(e).getPropertyValue('--drift-y')})));
  check(new Set(float.map(x=>x.duration)).size===15&&float.every(x=>x.x&&x.y),`${width}: independent gentle logo motion`);
  const drift=await page.locator('.rail-client-logos a').nth(1).evaluate(e=>{const animation=e.getAnimations()[0];animation.pause();const duration=animation.effect.getTiming().duration;animation.currentTime=0;const a=e.getBoundingClientRect();animation.currentTime=duration/4;const b=e.getBoundingClientRect();return Math.hypot(a.x-b.x,a.y-b.y);});
  check(drift>2&&drift<24,`${width}: logo motion is visible but restrained`,drift);
  const first=page.locator('.rail-client-logos a').first();await first.hover({force:true});
  await page.waitForFunction(()=>{const e=document.querySelector('.rail-client-logos a');return e.matches(':hover')&&getComputedStyle(e).scale==='1.09'&&getComputedStyle(e.querySelector('img')).filter==='none';},{},{timeout:2500});
  const hovered=await first.evaluate(e=>({hover:e.matches(':hover'),scale:getComputedStyle(e).scale,filter:getComputedStyle(e.querySelector('img')).filter}));
  check(hovered.hover&&hovered.scale!=='none'&&hovered.filter==='none',`${width}: hover grows and restores full color`,hovered);
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await first.evaluate(e=>getComputedStyle(e).animationName==='none'),`${width}: reduced motion stops logo drift`);
  await page.close();
 }
 check(report.errors.length===0,'No JavaScript errors');report.passed=true;
}catch(e){report.errors.push(e.stack);report.passed=false;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors},null,2));}})();
