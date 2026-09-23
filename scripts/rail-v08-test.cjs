const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');

const version=process.argv[2]||'v0.8';
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'structure-live':'structure');
fs.mkdirSync(out,{recursive:true});
const report={version,base,manifestSha256:sha(path.join('.staging',version,'manifest.json')),checks:[],errors:[]};
function check(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
   page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
   const info=await page.evaluate(()=>({
    sections:[...document.querySelectorAll('#main > section')].map(e=>[...e.classList].find(name=>name.startsWith('rail-')&&name!=='rail-section')),
    colors:Object.fromEntries(['rail-experience','rail-capabilities','rail-environment','rail-standards','rail-solution','rail-trust','rail-work','rail-contact'].map(name=>[name,getComputedStyle(document.querySelector('.'+name)).backgroundColor])),
    logos:document.querySelectorAll('.rail-client-logos a').length,
    scanlines:document.querySelectorAll('.scene-scanlines,.scene-scanband').length,
    sceneObjects:document.querySelectorAll('.scene-object').length,
    team:document.querySelector('.rail-team-place a').href,
    iso:document.querySelector('.rail-iso-proof').href
   }));
   check(info.sections.join(',')==='rail-hero,rail-proof,rail-experience,rail-capabilities,rail-environment,rail-standards,rail-solution,rail-trust,rail-work,rail-contact',`${width}: approved section order`);
   check(info.colors['rail-experience']===info.colors['rail-capabilities']&&info.colors['rail-experience']===info.colors['rail-standards']&&info.colors['rail-experience']===info.colors['rail-trust']&&info.colors['rail-experience']===info.colors['rail-work'],`${width}: light sections match`);
   check(info.colors['rail-experience']!==info.colors['rail-environment']&&info.colors['rail-experience']!==info.colors['rail-contact'],`${width}: dark sections contrast`);
   check(info.logos===6&&info.scanlines===0&&info.sceneObjects===require('../src/rail-scene.json').objects.length,`${width}: logos, CRT removal, scene retained`);
   check(info.team==='https://www.psa.inc/company/'&&info.iso.includes('Certificate_ISO%209001_20015_PSA-QR.pdf'),`${width}: sourced team and ISO destinations`);
   const cards=page.locator('.rail-case'),panel=page.locator('#rail-case-panel');
   check(await panel.isHidden(),`${width}: case preview initially closed`);
   await cards.nth(0).click();
   check(await panel.isVisible()&&await panel.locator('h3').innerText()==='Mainline Signaling Upgrade',`${width}: first case preview opens`);
   check(await cards.nth(0).getAttribute('aria-expanded')==='true'&&await panel.locator('img').count()===1,`${width}: preview accessibility and image`);
   await panel.screenshot({path:path.join(out,`case-expanded-${width}.png`)});
   await cards.nth(1).click();
   check(await panel.locator('h3').innerText()==='Urban Station Systems Integration'&&await cards.nth(0).getAttribute('aria-expanded')==='false',`${width}: switching cases updates shared panel`);
   check((await panel.locator('.rail-case-contact').getAttribute('href')).includes('Urban%20Station'),`${width}: case inquiry matches selection`);
   await page.keyboard.press('Escape');check(await panel.isHidden(),`${width}: Escape closes preview`);
   await cards.nth(2).focus();await page.keyboard.press('Space');check(await panel.isVisible()&&await panel.locator('h3').innerText()==='Level Crossing Safety Upgrade',`${width}: keyboard Space opens preview`);
   await panel.getByRole('button',{name:'Close project preview'}).click();check(await panel.isHidden()&&await cards.nth(2).evaluate(e=>document.activeElement===e),`${width}: close restores focus`);
   await page.close();
  }
  const noJs=await browser.newContext({javaScriptEnabled:false});const page=await noJs.newPage();await page.goto(base+'rail/index.html');
  check(await page.locator('.rail-case').first().getAttribute('href').then(h=>h.startsWith('mailto:')),`No-JS case contact remains usable`);
  check(await page.locator('#rail-case-panel').isHidden(),`No-JS preview remains hidden`);
  await noJs.close();
  report.passed=report.errors.length===0;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors},null,2));}
})();
