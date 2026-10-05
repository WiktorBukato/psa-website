const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const capabilities=require('../src/content/rail-capabilities.json'),cases=require('../src/content/rail-cases.public.json').cases;
const version=process.argv[2]||'v0.10',root=path.resolve('.staging',version),base=pathToFileURL(root).href+'/',out=`evidence/${version}/acceptance`;
fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`${root}/manifest.json`),checks:[],errors:[],cls:[],requests:[]};
const check=(ok,name,detail)=>{report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));};
async function ready(page){await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});}
async function mapReady(page){await page.locator('.rail-map').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.rail-map').classList.contains('map-ready'));}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [320,360,390,768,844,1024,1440,1920,2560]){
  const page=await browser.newPage({viewport:{width,height:width===844?390:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.addInitScript(()=>{window.qaCLS=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.qaCLS+=entry.value;}).observe({type:'layout-shift',buffered:true});});
  await ready(page);
  const alignment=await page.locator('.header .container,main>section>.container,.site-footer>.container').evaluateAll(es=>es.map(e=>({left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width})));
  check(alignment.every(r=>Math.abs(r.left-alignment[0].left)<=2&&Math.abs(r.width-alignment[0].width)<=2),`${width}: one container across header/main/footer`,alignment);
  const logo=await page.locator('.header .brand img').boundingBox();check(Math.abs(logo.width/logo.height-159/36)<.02,`${width}: logo aspect ratio`);
  const header=await page.evaluate(()=>{const els=[...document.querySelector('.header-inner').children].filter(e=>getComputedStyle(e).display!=='none'&&!e.matches('.nav'));return els.map(e=>{const b=e.getBoundingClientRect();return b.y+b.height/2;});});
  check(Math.max(...header)-Math.min(...header)<=2,`${width}: header items centred in one row`,header);
  check(await page.locator('.rail-proof,.rail-client-logos,.rail-partner-logos,.rail-case-panel,.rail-team-place').count()===0,`${width}: superseded blocks removed`);
  for(const c of capabilities){
   await page.locator(`[data-capability="${c.id}"]`).click();
   check(await page.locator(`#${c.id}`).evaluate(e=>e.open),`${width}: ${c.id} opens`);
   check(await page.locator('.capability-detail[open]').count()===1,`${width}: single detail panel`);
   check(await page.locator(`#${c.id} .detail-body h3`).textContent()===c.detailHeading,`${width}: unique substantive detail heading`);
   await page.keyboard.press('Escape');check(await page.locator(`[data-capability="${c.id}"]`).evaluate(e=>e===document.activeElement),`${width}: Escape returns focus`);
  }
  await mapReady(page);
  check(await page.locator('[data-map-result]:visible').count()===1&&await page.locator('[data-map-result="commuter-signaling"]').isVisible(),`${width}: first featured case selected`);
  for(const [region,count] of [['north-america',1],['china',1],['unknown',4],['all',6]]){
   await page.locator(`[data-map-filter="${region}"]`).click();
   check(await page.locator('[data-map-case]:visible').count()===count,`${width}: ${region} filter count`);
   check(await page.locator(`[data-map-filter="${region}"]`).getAttribute('aria-pressed')==='true',`${width}: filter state`);
   if(region==='unknown')check(await page.locator('[data-map-region].is-selected').count()===0,`${width}: unknown geography has no marker`);
  }
  for(const c of cases){
   await page.locator(`[data-map-case="${c.id}"]`).click();
   check(await page.locator(`[data-map-result="${c.id}"]`).isVisible(),`${width}: map/list select ${c.id}`);
   check(await page.locator(`[data-map-result="${c.id}"] a`).getAttribute('href')===c.url,`${width}: exact map publication URL`);
  }
  await page.locator('[data-map-region="china"]').focus();await page.keyboard.press('Enter');
  check(await page.locator('[data-map-filter="china"]').getAttribute('aria-pressed')==='true',`${width}: keyboard region selection`);
  await page.waitForTimeout(500);const wheelBefore=await page.evaluate(()=>scrollY);await page.mouse.move(width*.35,450);await page.mouse.wheel(0,180);await page.waitForTimeout(300);check(await page.evaluate(()=>scrollY)>wheelBefore,`${width}: map does not trap wheel`);
  for(const c of cases)check(await page.locator(`#case-${c.id} a`).getAttribute('href')===c.url,`${width}: card publication ${c.id}`);
  const more=page.locator('.more-cases');await more.locator('summary').click();check(await more.evaluate(e=>e.open),`${width}: more cases opens`);if((await more.locator('summary').textContent()).includes('Explore more')){await page.waitForTimeout(80);check(await more.locator('summary').isHidden(),`${width}: expansion button disappears`);}else{await more.locator('summary').focus();await page.keyboard.press('Space');check(!await more.evaluate(e=>e.open),`${width}: more cases closes by keyboard`);}
  for(const faq of await page.locator('.rail-faq details').all()){await faq.locator('summary').click();check(await faq.evaluate(e=>e.open),`${width}: native FAQ opens`);await faq.locator('summary').click();}
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('h1,h2,h3,h4,p,a,button,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&!e.matches('.skip');}).map(e=>e.textContent.trim().slice(0,55))}));
  check(overflow.scroll<=width+1&&overflow.elements.length===0,`${width}: entire page content fits`,overflow);
  check(await page.evaluate(()=>getComputedStyle(document.body).overflowX!=='hidden'),`${width}: no body overflow masking`);
  const nested=await page.locator('a a,a button,button a,button button,summary a,summary button').count();check(nested===0,`${width}: no nested controls`);
  const targets=await page.locator('.map-filters button,.map-case-options a,.rail-faq summary,.capability-detail[open]>summary,.menu-toggle,.vertical-switch a,.rail-contact a').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>({label:e.textContent||e.getAttribute('aria-label'),height:e.getBoundingClientRect().height})));
  check(targets.every(e=>e.height>=43.5),`${width}: main controls meet 44px height`,targets);
  check(!requests.some(u=>/^https?:/.test(u)),`${width}: no runtime external requests`);
  report.requests.push({width,requests:requests.map(u=>u.replace(base,''))});
  report.cls.push({width,value:await page.evaluate(()=>window.qaCLS)});
  if(width===1440||width===390){
   for(const [name,selector] of [['hero','.rail-hero'],['expertise-closed','.rail-capabilities'],['context','.rail-environment'],['cases','.rail-work'],['delivery','.rail-delivery'],['trax','.rail-solution'],['assurance','.rail-assurance'],['contact','.rail-contact'],['header','.header'],['footer','.site-footer']]){
    await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).screenshot({path:`${out}/${name}-${width}.png`});
   }
   for(const c of capabilities){await page.locator(`[data-capability="${c.id}"]`).click();await page.locator(`#${c.id}`).screenshot({path:`${out}/${c.id}-${width}.png`});await page.keyboard.press('Escape');}
   await page.locator('[data-map-filter="all"]').click();await page.locator('[data-map-case]').first().click();await page.locator('.rail-map').screenshot({path:`${out}/map-${width}.png`});
   if(!await page.locator('.more-cases').evaluate(e=>e.open))await page.locator('.more-cases summary').click();await page.locator('.more-cases').screenshot({path:`${out}/cases-expanded-${width}.png`});
   for(const faq of await page.locator('.rail-faq details').all())await faq.evaluate(e=>{e.open=true;});await page.locator('.rail-faq').screenshot({path:`${out}/faq-expanded-${width}.png`});
  }
  await page.close();console.log(`Checked ${width}px`);
 }
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await ready(page);
 for(const c of capabilities){await page.goto(base+`rail/index.html#${c.id}`);check(await page.locator(`#${c.id}`).evaluate(e=>e.open),`Direct ${c.id}`);await page.reload();check(await page.locator(`#${c.id}`).evaluate(e=>e.open),`Refresh ${c.id}`);for(const alias of c.aliases){await page.goto(base+`rail/index.html#${alias}`);check(await page.locator(`#${c.id}`).evaluate(e=>e.open),`Legacy alias ${alias}`);}}
 await page.locator('[data-capability="expertise-cad"]').click();await page.locator('[data-capability="expertise-testing"]').click();await page.goBack();check(await page.locator('#expertise-cad').evaluate(e=>e.open),'Back restores CAD');await page.goForward();check(await page.locator('#expertise-testing').evaluate(e=>e.open),'Forward restores testing');
 await page.goto(base+'rail/index.html#case-vectorcast-rams');check(await page.locator('.more-cases').evaluate(e=>e.open),'Direct extra case opens disclosure');check(await page.locator('[data-map-result="vectorcast-rams"]').isVisible(),'Direct case synchronises map');
 await mapReady(page);await page.locator('[data-map-filter="china"]').click();await page.locator('[data-map-case="china-metro-supervision"]').click();await page.locator('[data-map-filter="all"]').click();await page.locator('[data-map-case="commuter-signaling"]').click();await page.goBack();check(await page.locator('[data-map-result="china-metro-supervision"]').isVisible(),'Back restores case');await page.goForward();check(await page.locator('[data-map-result="commuter-signaling"]').isVisible(),'Forward restores case');
 // Empty selection and a future second case in a region, using temporary DOM fixtures only.
 await page.locator('[data-map-case][data-region="china"]').evaluateAll(es=>es.forEach(e=>e.dataset.region='fixture-unknown'));await page.locator('[data-map-filter="china"]').click();check(await page.locator('.map-empty').isVisible(),'Empty region gives honest fallback');await page.locator('[data-map-reset]').click();check(await page.locator('[data-map-case]:visible').count()===6,'Empty reset restores every case');
 await page.locator('[data-map-case="commuter-interlockings"]').evaluate(e=>e.dataset.region='north-america');await page.locator('[data-map-filter="north-america"]').click();check(await page.locator('[data-map-case]:visible').count()===2,'Multiple-case region group supported');await page.locator('[data-map-case="commuter-interlockings"]').click();check(await page.locator('[data-map-result="commuter-interlockings"]').isVisible(),'Second regional case selectable');await page.close();
 const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await ready(touch);await mapReady(touch);await touch.locator('[data-map-filter="china"]').tap();check(await touch.locator('[data-map-result="china-metro-supervision"]').isVisible(),'Touch region selection');await touch.close();
 for(const width of [320,360,390,768,844,1024,1280,1440,1920,2560]){const zoom=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await ready(zoom);await zoom.addStyleTag({content:':root{font-size:32px!important}'});await zoom.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,{},{timeout:3000});check(await zoom.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: 200% text fits`);if(width===390||width===1280)await zoom.screenshot({path:`${out}/text-200-${width}.png`,fullPage:true});await zoom.close();}
 const nojs=await browser.newPage({viewport:{width:390,height:844},javaScriptEnabled:false,reducedMotion:'reduce'});await ready(nojs);check(await nojs.locator('.capability-detail>summary:visible').count()===6,'NoJS all six native summaries');for(const detail of await nojs.locator('.capability-detail').all()){await detail.locator('summary').click();check(await detail.locator('.detail-body').isVisible(),'NoJS substantive detail opens');}
 check(await nojs.locator('[data-map-result]').count()===6&&await nojs.locator('.map-case-options a:visible').count()===6,'NoJS all six public map alternatives');check(await nojs.locator('.map-filters').isHidden(),'NoJS no false interactive map filters');await nojs.locator('.more-cases summary').click();check(await nojs.locator('.rail-case:visible').count()===6,'NoJS six complete case cards');await nojs.screenshot({path:`${out}/nojs-390.png`,fullPage:true});await nojs.close();
 check(!report.errors.length,'No JavaScript errors',report.errors);check(report.cls.every(r=>r.value<=.1),'Measured layout shifts within 0.1',report.cls);
 const old=fs.readFileSync('docs/v0.9/assets/rail.js'),current=fs.readFileSync(`${root}/assets/rail.js`),geo=Buffer.from(JSON.stringify(require('../src/content/rail-map.json')));
 const gzip=b=>zlib.gzipSync(b).length;report.budgets={oldRailJSgzip:gzip(old),newRailJSgzip:gzip(current),incrementalJSgzip:gzip(current)-gzip(old),geographicGzip:gzip(geo)};
 check(report.budgets.incrementalJSgzip<=35000,'Incremental JS under 35KB gzip',report.budgets);check(gzip(geo)<=100000,'Geographic data under 100KB gzip');
 report.passed=true;
}catch(error){report.passed=false;report.errors.push(error.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,budgets:report.budgets,cls:report.cls},null,2));}})();
