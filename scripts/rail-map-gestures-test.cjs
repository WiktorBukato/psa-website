const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||'v0.12',root=path.resolve('.staging',version),out=`evidence/${version}/${process.argv[3]?'map-gestures-live':'map-gestures'}`;
fs.mkdirSync(out,{recursive:true});const report={version,manifestSha256:sha(`${root}/manifest.json`),checks:[],errors:[]};
function check(ok,name){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(process.argv[3]?new URL('rail/index.html',process.argv[3]).href:pathToFileURL(`${root}/rail/index.html`).href);
  const map=page.locator('.rail-map'),svg=page.locator('.world-map');await map.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
  check(await page.locator('[data-map-scale],[data-map-filter="unknown"],.map-world-reset').count()===0,`${width}: obsolete controls absent`);
  check(await page.locator('[data-map-world]').count()===1&&await page.locator('[data-map-world]').innerText()==='World view',`${width}: one top world reset`);
  check(!(await map.innerText()).includes('PSA project slide'),`${width}: production labels cleaned`);
  await page.locator('[data-location-zoom="MNNH"]').click();await page.waitForTimeout(600);
  for(const location of require('../src/content/rail-locations.json').locations)check(await page.locator('.map-local-land').evaluate((e,l)=>e.isPointInFill(new DOMPoint((l.lon+180)*1000/360,(90-l.lat)*500/180)),location),`${width}: ${location.code} lies on rendered detailed land`);
  const read=async()=> (await svg.getAttribute('viewBox')).split(' ').map(Number);
  const dot=page.locator('[data-location="MNNH"] .location-dot'),before=await dot.boundingBox(),v=await read(),scroll=await page.evaluate(()=>scrollY);await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.wheel(0,-250);await page.waitForTimeout(150);const after=await dot.boundingBox();
  check((await read())[2]<v[2],`${width}: wheel zooms in`);check(Math.hypot(after.x+after.width/2-before.x-before.width/2,after.y+after.height/2-before.y-before.height/2)<1,`${width}: zoom anchored at pointer`);check(await page.evaluate(()=>scrollY)===scroll,`${width}: wheel inside map does not scroll page`);
  const r=await svg.boundingBox(),start=await read();await page.mouse.move(r.x+r.width*.2,r.y+r.height*.25);await page.mouse.down();await page.mouse.move(r.x+r.width*.2+40,r.y+r.height*.25+20,{steps:8});await page.mouse.up();const pan=await read();check(pan[0]!==start[0]&&pan[2]===start[2],`${width}: drag pans without zoom`);
  await svg.focus();await page.keyboard.press('+');check((await read())[2]<pan[2],`${width}: keyboard zoom`);const kb=await read();await page.keyboard.press('ArrowRight');check((await read())[0]>kb[0],`${width}: keyboard pan`);await page.keyboard.press('Home');await page.waitForTimeout(500);check((await read()).join(' ')==='0 0 1000 500',`${width}: Home returns world`);
  for(const mode of ['world','regional','local']){
   if(mode==='regional'){await page.locator('[data-map-filter="north-america"]').click();await page.waitForTimeout(500);}if(mode==='local'){await page.locator('[data-location-zoom="MBTA"]').click();await page.waitForTimeout(500);}
   const q=page.locator('[data-location="MBTA"] .location-dot'),b=await q.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);const active=page.locator('.map-nearby-track.is-active');check(await active.count()===1,`${width}: ${mode} bounded highlight`);
   const ellipse=await page.locator('#map-radius-MBTA ellipse').getAttribute('rx'),box=await read();check(+ellipse<box[2]*.3,`${width}: ${mode} radius remains local to viewport`);
   const moving=active.locator(mode==='local'?'.map-nearby-local .map-rail-travel':'.map-nearby-overview .map-rail-travel').first();check(await moving.evaluate(e=>parseFloat(getComputedStyle(e).getPropertyValue('--trail-length'))>0),`${width}: ${mode} screen-sized moving stripe`);
   await page.addStyleTag({content:'.header,.back-top,.skip{visibility:hidden!important}.map-location-tooltip{visibility:hidden!important}'});const a=await svg.screenshot();await page.waitForTimeout(650);const bframe=await svg.screenshot();check(!a.equals(bframe),`${width}: ${mode} rendered moving stripes`);await fs.promises.writeFile(`${out}/${mode}-${width}.png`,bframe);
  }
  if(width===390){const cdp=await page.context().newCDPSession(page),r=await svg.boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2,initial=await read();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check((await read())[2]<initial[2],`${width}: two-finger pinch zoom`);}
  await page.close();
 }
 check(!report.errors.length,'No runtime errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}})();
