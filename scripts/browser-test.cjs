const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {chromium}=dependency('playwright');
const site=require('../src/site.json');
const version=process.argv[2]||'v0.1';
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const live=base.startsWith('http');
const evidence=path.resolve('evidence',version,live?'live':'local');
fs.mkdirSync(evidence,{recursive:true});
const viewports=[{width:1440,height:900},{width:1920,height:1080},{width:2560,height:1440},{width:768,height:1024},{width:390,height:844},{width:320,height:740},{width:844,height:390}];
const report={version,base,checks:[],errors:[],screenshots:[],navigation:[],environment:{browser:'Chromium / installed Chrome',physicalDevice:false}};
function assert(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await chromium.launch({executablePath:chromeExecutable,headless:true});
 try{
  for(const route of ['index.html','eiot/index.html','rail/index.html'])for(const viewport of viewports){
   const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
   page.on('pageerror',error=>report.errors.push(`${route}: ${error.message}`));
   page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
   await page.goto(base+route,{waitUntil:'networkidle'});
   await page.evaluate(async()=>{for(const img of document.images){img.loading='eager';}await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await document.fonts.ready;});
   const label=`${route} ${viewport.width}×${viewport.height}`;
   const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),overflow:[...document.querySelectorAll('h1,h2,h3,p,a,button,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.textContent.trim().slice(0,60))}));
   assert(info.scroll<=info.width+1,`${label}: no horizontal overflow`);
   assert(info.broken.length===0,`${label}: all images decoded ${info.broken.join(',')}`);
   assert(info.overflow.length===0,`${label}: readable content fits ${info.overflow.join(',')}`);
   const name=route.replace('/index.html','').replace('.html','')+`-${viewport.width}x${viewport.height}.png`;
   await page.screenshot({path:path.join(evidence,name),fullPage:true});report.screenshots.push(name);
   if(route!=='index.html'){
    if(viewport.width<=900){
      const menu=page.getByRole('button',{name:'Open menu',exact:true});await menu.click();
      assert(await page.locator('#navigation').isVisible(),`${label}: menu opens`);
      await page.keyboard.press('Escape');assert(await menu.getAttribute('aria-expanded')==='false',`${label}: Escape closes menu`);
      await menu.click();await page.locator('#navigation a[href="#work"]').click();
      assert(await menu.getAttribute('aria-expanded')==='false',`${label}: section link closes menu`);
      assert(new URL(page.url()).hash==='#work',`${label}: work anchor navigates`);
    }
    await page.locator('#contact').scrollIntoViewIfNeeded();
    assert(await page.locator('.contact-banner .button').getAttribute('href').then(v=>v.startsWith(`mailto:${site.email}?subject=`)),`${label}: actionable contact CTA`);
    await page.locator('.copy-email').click();
    await page.waitForFunction(()=>document.querySelector('.copy-status').textContent.length>0);
    assert((await page.locator('.copy-status').innerText()).length>0,`${label}: copy email success or explicit fallback`);
    const details=page.locator('details').first();await details.locator('summary').click();assert(await details.getAttribute('open')!==null,`${label}: disclosure opens`);await details.locator('summary').click();
    if(route.startsWith('rail')){
      for(const id of ['station','control','onboard','wayside']){
        await page.locator(`[data-area="${id}"]`).click();
        assert(await page.locator(`[data-panel="${id}"]`).isVisible(),`${label}: ${id} selector works`);
        assert(await page.locator('[data-panel]:visible').count()===1,`${label}: one environment panel visible`);
      }
      await page.locator('[data-area="wayside"]').focus();await page.keyboard.press('ArrowRight');
      assert(await page.locator('[data-area="station"]').getAttribute('aria-pressed')==='true',`${label}: keyboard environment navigation`);
    }
    const other=route.startsWith('rail')?'eiot':'rail';
    await page.locator(`.vertical-switch a[href="../${other}/index.html"]`).click();
    assert(page.url().includes(`/${other}/index.html`),`${label}: version-local vertical switch`);
   }
   await page.close();
  }
  // Progressive enhancement: all navigation and content remain usable without JS.
  for(const route of ['eiot','rail']){
   const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
   const page=await context.newPage();await page.goto(base+`${route}/index.html`);
   assert(await page.locator('#navigation').isVisible(),`${route}: navigation without JavaScript`);
   if(route==='rail')assert(await page.locator('[data-panel]:visible').count()===4,'rail: all environment content without JavaScript');
   await context.close();
  }
  // Enlarged text without shrinking the viewport.
  for(const route of ['eiot','rail']){
   const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(base+`${route}/index.html`);
   await page.addStyleTag({content:':root{font-size:32px!important}'});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route}: 200% text width`);
   await page.screenshot({path:path.join(evidence,`${route}-text-200.png`),fullPage:true});await page.close();
  }
  assert(report.errors.length===0,`No browser errors: ${report.errors.join('; ')}`);
  report.passed=true;
 }catch(error){report.passed=false;report.failure=error.stack;throw error;}
 finally{
  report.manifestSha256=crypto.createHash('sha256').update(fs.readFileSync(path.join('.staging',version,'manifest.json'))).digest('hex');
  report.checkedAt=new Date().toISOString();
  fs.writeFileSync(path.join(evidence,'qa.json'),JSON.stringify(report,null,2));
  await browser.close();console.log(`${report.passed?'PASS':'FAIL'}: ${report.checks.length} browser checks. Evidence: ${evidence}`);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
