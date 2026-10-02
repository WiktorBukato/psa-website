const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||'v0.11',root=path.resolve('.staging',version),base=pathToFileURL(root).href+'/',out=`evidence/${version}/visual-enhancements`;
fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`${root}/manifest.json`),checks:[],errors:[]};
const check=(ok,name,detail)=>{report.checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'no-preference'});
  page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  const summary=page.locator('.more-cases summary');await summary.focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
  check(await summary.isHidden(),`${width}: count-neutral expansion trigger disappears`);
  check(await page.locator('.more-cases h3').first().evaluate(e=>e===document.activeElement),`${width}: keyboard focus moves to first revealed heading`);
  check(!/six|\b6\b/i.test(await summary.textContent()),`${width}: no case-count wording`);
  check(await page.locator('.case-graphic img').count()===6,`${width}: six subject images`);
  for(const img of await page.locator('.case-graphic img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());check(await img.evaluate(e=>e.naturalWidth>=250&&e.naturalHeight>0&&e.hasAttribute('srcset')&&e.alt.length>15),`${width}: responsive image decodes`);}
  check(!/Illustrative engineering graphic|Geographic base:/.test(await page.locator('main').innerText()),`${width}: unwanted visible captions removed`);
  await page.locator('.rail-map').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.map-ready'));
  await page.locator('[data-map-filter="china"]').click();await page.waitForTimeout(500);
  check(await page.locator('.world-map').getAttribute('viewBox')==='670 85 240 120',`${width}: China zoom uses public country geometry`);
  await page.locator('.rail-map').screenshot({path:`${out}/china-zoom-${width}.png`});
  await page.locator('[data-map-world]').click();await page.waitForTimeout(500);check(await page.locator('.world-map').getAttribute('viewBox')==='0 0 1000 500',`${width}: world view restores`);
  await page.locator('[data-map-filter="north-america"]').click();await page.waitForTimeout(500);check(await page.locator('.world-map').getAttribute('viewBox')==='0 10 480 240',`${width}: North America region zoom`);
  await page.locator('[data-map-filter="unknown"]').click();await page.waitForTimeout(500);check(await page.locator('[data-map-region].is-selected').count()===0&&await page.locator('[data-map-world]').isHidden(),`${width}: unknown locations never create markers`);
  check(await page.locator('.stage-visual').count()===4&&await page.locator('.engagement-visual').count()===2&&await page.locator('.architecture-visual').count()===3,`${width}: all requested blocks have native graphics`);
  for(const [name,selector,motion] of [['delivery','.delivery-steps li:first-child','.stage-orbit'],['team','.engagement-grid>section:first-child','.engagement-visual>span'],['trax-cpu','.trax-architecture section:first-child','.data-beam'],['trax-database','.trax-architecture section:nth-child(3)','.database-ring'],['trax-workspace','.trax-architecture section:last-child','.screen-trace']]){
   const card=page.locator(selector);await card.scrollIntoViewIfNeeded();await card.hover();await card.locator('a').first().focus();await page.waitForTimeout(400);
   const moving=card.locator(motion).first(),pseudo=motion.includes('beam')||motion.includes('span')?'::after':null;
   const sample=()=>moving.evaluate((e,p)=>{const s=getComputedStyle(e,p);return {animation:s.animationName,transform:s.transform,left:s.left,dash:s.strokeDashoffset};},pseudo);
   const a=await sample();await card.screenshot({path:`${out}/${name}-${width}-a.png`});await page.waitForTimeout(650);const b=await sample();await card.screenshot({path:`${out}/${name}-${width}-b.png`});
   check(a.animation!=='none'&&b.animation!=='none'&&JSON.stringify(a)!==JSON.stringify(b),`${width}: ${name} animation changes rendered geometry`,{a,b});
   const sharp=dependency('sharp'),pa=await sharp(`${out}/${name}-${width}-a.png`).raw().toBuffer({resolveWithObject:true}),pb=await sharp(`${out}/${name}-${width}-b.png`).raw().toBuffer({resolveWithObject:true});
   check(pa.info.width===pb.info.width&&pa.info.height===pb.info.height&&!pa.data.equals(pb.data),`${width}: ${name} temporal pixels differ`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.delivery-steps li:first-child').hover();check(await page.locator('.stage-orbit').first().evaluate(e=>getComputedStyle(e).animationName)==='none',`${width}: OS reduced-motion disables new motion`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: no overflow`);await page.close();
 }
 const cases=require('../src/content/rail-cases.public.json').cases;
 check(cases.every(c=>['latitude','longitude','customerName','operatorName','currentDeliveryStatus','imagePath'].every(k=>c[k]===null)),'Public seed disclosure level unchanged');
 for(const media of Object.values(require('../src/content/rail-case-media.json')))for(const size of [512,1024])check(fs.statSync(`${root}/assets/${media.asset}-${size}.webp`).size<300000,`${media.asset}-${size}: optimized image under 300KB`);
 check(!report.errors.length,'No runtime errors',report.errors);report.passed=true;
}catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));}})();
