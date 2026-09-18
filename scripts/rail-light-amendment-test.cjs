const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'signal-live':'signals');fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
const check=(value,name)=>{report.checks.push({name,passed:!!value});if(!value)throw Error(name);};
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.signal-lamp-red').getAnimations().length>0);
  check(await page.locator('.scene-light').count()===180,'180 ambient lights (50 percent more than v0.4.1)');
  check(await page.locator('.scene-signal').count()===2,'Two independently phased illustrative signals');
  const groups=require('../src/rail-scene.json').lightGroups;
  check(groups.leftWindows.energy<1&&groups.lamps.energy>1&&groups.trainWindows.energy>1,'Softer left windows and stronger lamps/train windows');
  for(const id of ['SIG-01','SIG-02']){
   const signal=page.locator(`[data-signal="${id}"]`);
   for(const [state,phase]of [['red',.2],['red',.49999],['green',.5],['green',.65],['green',.99999],['red',1]]){
    const opacity=await signal.evaluate((e,p)=>{
     e.getAnimations({subtree:true}).forEach(a=>{a.pause();const t=a.effect.getTiming();a.currentTime=t.duration*(p+1)+t.delay;});
     return ['red','green'].map(c=>+getComputedStyle(e.querySelector(`.signal-lamp-${c}`)).opacity);
    },phase);
    check(state==='red'?opacity[0]>.99&&opacity[1]===0:state==='green'?opacity[1]>.99&&opacity[0]===0:opacity.every(v=>v===0),`${id}: ${state} phase`);
    await signal.screenshot({path:path.join(out,`${id}-${state}.png`)});
   }
   check(await signal.evaluate(e=>{
    const animations=e.getAnimations({subtree:true});
    for(let i=0;i<100;i++){
     animations.forEach(a=>{const t=a.effect.getTiming();a.currentTime=t.duration*(i/100+1)+t.delay;});
     const [red,green]=['red','green'].map(c=>+getComputedStyle(e.querySelector(`.signal-lamp-${c}`)).opacity);
     if(!((red===1&&green===0)||(green===1&&red===0)))return false;
    }return true;
   }),`${id}: exactly one active aspect throughout the cycle`);
  }
  await page.locator('.scene-debug-toggle').click();
  check(await page.locator('.scene-signal').evaluateAll(nodes=>nodes.every(n=>n.getAnimations({subtree:true}).length===0&&['red','green'].every(c=>+getComputedStyle(n.querySelector(`.signal-lamp-${c}`)).opacity===1))),'Debug freezes both signal lenses as lime markers');
  await page.locator('.rail-hero').screenshot({path:path.join(out,'all-lights-debug.png')});
  await page.locator('.scene-debug-toggle').click();
  await page.locator('.scene-motion-toggle').click();
  check(await page.locator('.scene-signal').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='hidden'&&n.getAnimations({subtree:true}).length===0)),'Pause restores the original still photograph');
  await page.locator('.scene-motion-toggle').click();
  check(await page.locator('.scene-signal').evaluateAll(nodes=>nodes.every(n=>n.getAnimations({subtree:true}).length===2)),'Resume restarts the decorative cycles');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('.rail-hero').dataset.ambientState==='paused');
  check(await page.locator('.scene-signal').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).visibility==='hidden')),'Reduced motion retains the source photograph');
  check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}
})();
