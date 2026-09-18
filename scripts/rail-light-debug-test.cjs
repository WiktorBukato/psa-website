const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'light-debug-live':'light-debug');fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
function check(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  for(const reducedMotion of ['no-preference','reduce'])for(const width of [320,390,1440,1920]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion});page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
   const label=`${width}/${reducedMotion}`,button=page.locator('.scene-debug-toggle');
   const geometry=()=>page.locator('.scene-light circle').evaluateAll(nodes=>nodes.map(n=>['cx','cy','r'].map(a=>n.getAttribute(a))));
   const before=await geometry();
   check(await button.getAttribute('aria-pressed')==='false',`${label}: off by default`);
   await button.focus();await page.keyboard.press('Space');
   check(await button.getAttribute('aria-pressed')==='true',`${label}: keyboard enables debug`);
   const steady=()=>page.locator('.scene-light').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display!=='none'&&+getComputedStyle(n).opacity===1&&n.getAnimations().length===0&&getComputedStyle(n.querySelector('.scene-light-core')).fill==='rgb(182, 255, 0)'));
   check(await steady(),`${label}: every light is constant lime, including reduced motion`);
   await page.waitForTimeout(350);
   check(await steady(),`${label}: lights remain constant over time`);
   check(JSON.stringify(before)===JSON.stringify(await geometry()),`${label}: positions and core/halo radii unchanged`);
   check(await page.locator('.scene-controls button').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=38;})),`${label}: controls fit viewport`);
   await page.locator('.rail-hero').screenshot({path:path.join(out,`debug-${width}-${reducedMotion}.png`)});
   if(reducedMotion==='no-preference'){
    await page.locator('.scene-motion-toggle').click();check(await steady(),`${label}: pause keeps debug lights visible`);
    await button.click();check(await page.locator('.scene-light').evaluateAll(nodes=>nodes.every(n=>+getComputedStyle(n).opacity===0)),`${label}: leaving debug preserves pause`);
    await page.locator('.scene-motion-toggle').click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.scene-light')].some(n=>n.getAnimations().length),{},{timeout:4500});
    check(true,`${label}: normal shimmer resumes`);
   }else{await button.click();check(await page.locator('.scene-light').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display==='none')),`${label}: leaving debug restores reduced-motion state`);}
   await button.click();await button.click();check(await button.getAttribute('aria-pressed')==='false',`${label}: repeated toggles restore default`);
   await page.reload();check(await button.getAttribute('aria-pressed')==='false',`${label}: no persistent debug state`);
   await page.close();
  }
  check(report.errors.length===0,'No JavaScript errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}
})();
