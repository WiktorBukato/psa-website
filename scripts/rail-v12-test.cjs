const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||'v0.12',root=path.resolve('.staging',version),out=`evidence/${version}/${process.argv[3]?'map-live':'map'}`,locations=require('../src/content/rail-locations.json'),network=require('../src/content/rail-network.json');
fs.mkdirSync(out,{recursive:true});const report={version,manifestSha256:sha(`${root}/manifest.json`),checks:[],errors:[]};
function check(ok,name){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference',hasTouch:width===390});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('https://www.psa.inc/**',r=>r.fulfill({contentType:'text/html',body:'<title>Destination navigation test</title>'}));
 await page.goto(pathToFileURL(`${root}/rail/index.html`).href);const map=page.locator('.rail-map');await map.scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 check(await map.getAttribute('data-map-level')==='world',`${width}: world level`);await map.screenshot({path:`${out}/world-${width}.png`});
 await page.locator('[data-map-filter="north-america"]').click();await page.waitForTimeout(550);check(await map.getAttribute('data-map-level')==='regional',`${width}: regional detail`);
 await map.screenshot({path:`${out}/regional-${width}.png`});
 for(const l of locations.locations){const p=page.locator(`[data-location="${l.code}"]`);const t=await p.getAttribute('transform');check(t===`translate(${(l.lon+180)*1000/360} ${(90-l.lat)*500/180})`,`${width}: ${l.code} exact coordinate`);
 await page.locator(`[data-location-zoom="${l.code}"]`).click();await page.waitForFunction(code=>document.querySelector('.map-location-tooltip').dataset.tooltipLocation===code&&document.querySelector('.map-nearby-track.is-active')?.dataset.nearby===code,l.code);check(await map.getAttribute('data-map-level')==='local',`${width}: ${l.code} local detail`);
 check(await page.locator('.map-nearby-track.is-active').count()===1,`${width}: only selected neighbourhood highlighted`);
 check((await page.locator('.map-location-tooltip').innerText()).includes(l.city),`${width}: city tooltip`);
 check(await p.getAttribute('target')==='_blank'&&await p.getAttribute('href')===l.url,`${width}: ${l.code} correct new-tab destination`);
 await map.screenshot({path:`${out}/${l.code}-${width}.png`});
 // Full-section screenshot can center the tall mobile section away from its map.
 await page.locator('.map-geography').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
 const a=await page.locator('.map-motion-canvas').evaluate(e=>e.toDataURL());await page.waitForTimeout(300);const b=await page.locator('.map-motion-canvas').evaluate(e=>e.toDataURL());check(a!==b,`${width}: ${l.code} travelling highlight`);
 if(l.code==='MBTA'){await page.locator('.map-geography').screenshot({path:`${out}/motion-${width}-a.png`});await page.waitForTimeout(450);await page.locator('.map-geography').screenshot({path:`${out}/motion-${width}-b.png`});const sharp=dependency('sharp');const pa=await sharp(`${out}/motion-${width}-a.png`).raw().toBuffer(),pb=await sharp(`${out}/motion-${width}-b.png`).raw().toBuffer();check(!pa.equals(pb),`${width}: actual motion pixels`);}
 const popupPromise=page.waitForEvent('popup');if(width===390)await p.tap();else await p.press('Enter');const popup=await popupPromise;await popup.waitForLoadState();check(popup.url()===l.url,`${width}: ${l.code} native navigation opens new tab (stubbed response)`);await popup.close();
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);check(await page.locator('.map-motion-canvas').evaluate(e=>!e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((v,i)=>i%4===3&&v)),`${width}: reduced motion respected`);
 await page.locator('[data-map-world]').click();await page.waitForFunction(()=>document.querySelector('.rail-map').dataset.mapLevel==='world',null,{timeout:10000});check(await map.getAttribute('data-map-level')==='world',`${width}: reset`);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: no horizontal overflow`);await page.close();
 }
 for(const n of network.nearby){const l=locations.locations.find(l=>l.code===n.code);for(const route of n.routes){const coords=[...route.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>[+m[1]*360/1000-180,90-+m[2]*180/500]);check(coords.every(([lon,lat])=>Math.hypot((lon-l.lon)*111.195*Math.cos(l.lat*Math.PI/180),(lat-l.lat)*111.195)<=locations.nearbyRadiusKm+.02),`${n.code}: route clipped to configured radius`);}}
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(pathToFileURL(`${root}/rail/index.html`).href);check(await nojs.locator('.map-location-links a').count()===5,'No-JS native destination links');
 const baseline=await browser.newPage({javaScriptEnabled:false});await baseline.goto(pathToFileURL(path.resolve('docs/v0.11/rail/index.html')).href);
 const unaffected=page=>page.locator('main').evaluate(e=>{const copy=e.cloneNode(true);copy.querySelector('.rail-map').remove();return copy.innerHTML.replace(/v\d+\.\d+(?:\.\d+)?/g,'VERSION');});
 check(await unaffected(nojs)===await unaffected(baseline),'All Rail markup outside the map unchanged from v0.11');await baseline.close();await nojs.close();
 check(!report.errors.length,'No runtime errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}})();
