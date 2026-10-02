const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {chromium}=dependency('playwright');
const site=require('../src/site.json');
const version=process.argv[2]||site.releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const live=base.startsWith('http');
const evidence=path.resolve('evidence',version,live?'live':'local');
fs.mkdirSync(evidence,{recursive:true});
const viewports=[{width:1440,height:900},{width:1920,height:1080},{width:2560,height:1440},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800},{width:320,height:740},{width:844,height:390}];
const report={version,base,checks:[],errors:[],screenshots:[],navigation:[],environment:{browser:'Chromium / installed Chrome',physicalDevice:false}};
function assert(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
async function fullPageScreenshot(page,target){
 const dimensions=await page.evaluate(()=>({width:innerWidth,height:document.documentElement.scrollHeight,viewport:innerHeight}));
 // Chrome's very tall captures can exceed its compositor texture limit. Tile
 // actual viewports instead of accepting repeated/blank strips as page pixels.
 if(dimensions.height<=16000){await page.screenshot({path:target,fullPage:true});return;}
 const sharp=dependency('sharp'),tiles=[];
 const captureStyle=await page.addStyleTag({content:'.back-top,.skip{visibility:hidden!important}'});
 for(let top=0;top<dimensions.height;top+=dimensions.viewport){
  await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),top);
  await page.locator('.header').evaluate((e,first)=>e.style.visibility=first?'':'hidden',top===0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const actual=await page.evaluate(()=>scrollY),input=await page.screenshot();
  tiles.push({input,left:0,top:actual});
 }
 await sharp({create:{width:dimensions.width,height:dimensions.height,channels:4,background:'#fff'}}).composite(tiles).png().toFile(target);
 await page.locator('.header').evaluate(e=>e.style.visibility='');
 await captureStyle.evaluate(e=>e.remove());
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
}
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
   if(route.startsWith('rail')&&await page.locator('[data-case-map]').count()){
    await page.locator('[data-case-map]').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('[data-case-map]').classList.contains('map-ready'));
    await page.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));
    await page.waitForFunction(()=>scrollY===0);
    await page.mouse.move(0,0);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   }
   const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),overflow:[...document.querySelectorAll('h1,h2,h3,p,a,button,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='fixed';}).map(e=>e.textContent.trim().slice(0,60))}));
   assert(info.scroll<=info.width+1,`${label}: no horizontal overflow`);
   assert(info.broken.length===0,`${label}: all images decoded ${info.broken.join(',')}`);
   assert(info.overflow.length===0,`${label}: readable content fits ${info.overflow.join(',')}`);
   const name=route.replace('/index.html','').replace('.html','')+`-${viewport.width}x${viewport.height}.png`;
   await fullPageScreenshot(page,path.join(evidence,name));report.screenshots.push(name);
   if(route!=='index.html'){
    const modernRail=route.startsWith('rail')&&await page.locator('.capability-detail').count()>0;
    const compact=await page.locator('.menu-toggle').isVisible();
    if(compact){
      const menu=page.getByRole('button',{name:'Open menu',exact:true});await menu.click();
      assert(await page.locator('#navigation').isVisible(),`${label}: menu opens`);
      await page.keyboard.press('Escape');assert(await menu.getAttribute('aria-expanded')==='false',`${label}: Escape closes menu`);
      await menu.click();await page.locator('#navigation a[href="#work"]').click();
      assert(await menu.getAttribute('aria-expanded')==='false',`${label}: section link closes menu`);
      assert(new URL(page.url()).hash==='#work',`${label}: work anchor navigates`);
    }
    for(const entry of modernRail?require('./navigation.cjs').forVertical('rail'):site.navigation){
      if(compact)await page.getByRole('button',{name:'Open menu',exact:true}).click();
      await page.locator(`#navigation a[href="#${entry.id}"]`).click();
      await page.waitForFunction(id=>document.querySelector(`#navigation a[href="#${id}"]`).getAttribute('aria-current')==='location',entry.id);
      assert(true,`${label}: active menu follows ${entry.id}`);
    }
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const contact=await page.locator('#contact .button').getAttribute('href');
    assert(route.startsWith('rail')&&!modernRail?contact.startsWith(`mailto:${site.email}?subject=`):contact===site.contactUrl,`${label}: actionable contact CTA`);
    assert(await page.locator(`.site-footer a[href="mailto:${site.email}"]`).count()===1,`${label}: shared contact email`);
    if(route.startsWith('rail')){
      assert(await page.locator('.rail-cap').count()===6,`${label}: six original capabilities`);
      assert(await page.locator('.rail-case').count()===(modernRail?6:3),`${label}: case inventory`);
      for(const id of modernRail?['signaling','dispatching','testing','monitoring']:['signaling','integration','software','hardware']){
        const target=modernRail?`expertise-${id}`:`cap-${id}`;
        const link=page.locator(`.environment-nodes a[href="#${target}"]`);
        await link.click();
        assert(new URL(page.url()).hash===`#${target}`,`${label}: ${id} ecosystem link`);
        assert(modernRail?await page.locator(`#${target}`).evaluate(e=>e.open):await page.locator(`#${target}`).getAttribute('href').then(v=>v.startsWith(`mailto:${site.email}?subject=`)),`${label}: ${id} capability destination`);
      }
      await page.locator('.environment-nodes a').first().focus();await page.keyboard.press('Enter');
      assert(new URL(page.url()).hash===(modernRail?'#expertise-signaling':'#cap-signaling'),`${label}: keyboard ecosystem navigation`);
    }else{
      assert(await page.locator('.cap-card').count()===6,`${label}: six original capabilities`);
      assert(await page.locator('.system-visual img').getAttribute('src')==='../assets/hero-reference.png',`${label}: original hero illustration`);
      assert(await page.locator('.domain-grid a[href="../rail/index.html"]').count()===1,`${label}: rail domain links to this version`);
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
   if(route==='rail')assert(await page.locator('.environment-nodes a:visible').count()===4,'rail: all environment content without JavaScript');
   await context.close();
  }
  // Enlarged text without shrinking the viewport.
  for(const route of ['eiot','rail']){
   const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(base+`${route}/index.html`);
   await page.addStyleTag({content:':root{font-size:32px!important}'});
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,{},{timeout:3000});
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
