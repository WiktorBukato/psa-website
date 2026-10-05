const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||'v0.12',root=path.resolve('.staging',version),out=`evidence/${version}/${process.argv[3]?'map-amendment-live':'map-amendment'}`,geography=require('../src/content/rail-map.json'),network=require('../src/content/rail-network.json');
fs.mkdirSync(out,{recursive:true});const report={version,manifestSha256:sha(`${root}/manifest.json`),checks:[],errors:[]};
function check(ok,name){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const region of geography.regions)check(region.path.split('Z').filter(Boolean).every(p=>geography.landPath.includes(p+'Z')),`${region.id}: identical coastline vertices in base and region`);
 check(network.localPath.length>network.nearby.reduce((n,l)=>n+l.routes.join('').length,0),'Continuous local base extends beyond bounded neighbourhood overlays');
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(process.argv[3]?new URL('rail/index.html',process.argv[3]).href:pathToFileURL(`${root}/rail/index.html`).href);
  const map=page.locator('.rail-map');await map.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
  check(await map.locator('[data-location] title,[data-location][title]').count()===0,`${width}: native location tooltip removed`);
  check(await map.locator('[data-map-region] circle').count()===0,`${width}: large regional circles removed`);
  await page.locator('[data-map-filter="north-america"]').click();await page.waitForTimeout(550);
  const baseOpacity=await page.locator('.map-rail-network').evaluate(e=>getComputedStyle(e).opacity);
  for(const code of ['MBTA','MNNH','MTAB','WMATA']){
   const dot=page.locator(`[data-location="${code}"] .location-dot`),b=await dot.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
   check(await page.locator('.map-location-tooltip').getAttribute('data-tooltip-location')===code,`${width}: nearest-point hover resolves ${code}`);
   check(await page.locator('.map-nearby-track.is-active').count()===1,`${width}: one bounded overlay active`);
  }
  check(await page.locator('.map-rail-network').evaluate(e=>getComputedStyle(e).opacity)===baseOpacity,`${width}: hover never brightens the entire railway base`);
  await page.locator('[data-location-zoom="WMATA"]').click();await page.locator('[data-location-zoom="MBTA"]').click();await page.waitForFunction(()=>document.querySelector('.map-location-tooltip').dataset.tooltipLocation==='MBTA');
  check(await page.locator('.map-location-tooltip').getAttribute('data-tooltip-location')==='MBTA',`${width}: rapid zoom retains latest selected city`);
  const active=page.locator('.map-nearby-track.is-active');check(await active.getAttribute('mask')==='url(#map-radius-MBTA)',`${width}: travelling highlights and glow share distance fade`);
  const stops=await map.locator('#map-fade-MBTA stop').evaluateAll(es=>es.map(e=>[e.getAttribute('offset'),e.getAttribute('stop-opacity')]));
  check(stops[0][0]==='0'&&stops.at(-1)[1]==='0'&&stops[2][1]==='.55',`${width}: continuous near-to-far fade`);
  check(await page.locator('.map-location-tooltip').evaluate(e=>{const color=getComputedStyle(e).backgroundColor;return /rgba/.test(color)&&parseFloat(color.split(',').at(-1))<.8;}),`${width}: translucent hover card`);
  await page.addStyleTag({content:'.header,.back-top,.skip{visibility:hidden!important}'});
  await map.screenshot({path:`${out}/local-${width}.png`});
  const a=await page.locator('.map-geography').screenshot();await page.waitForTimeout(450);const b=await page.locator('.map-geography').screenshot();check(!a.equals(b),`${width}: rendered travelling light changes pixels`);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);check(await page.locator('.map-motion-canvas').evaluate(e=>!e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((v,i)=>i%4===3&&v)),`${width}: reduced motion stops travelling light`);
  await page.close();
 }
 check(!report.errors.length,'No runtime errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}})();
