const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs'),{sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion,base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=`evidence/${version}/${base.startsWith('http')?'track-scroll-live':'track-scroll'}`;fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
function check(ok,name){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
 for(const route of ['eiot','rail']){await page.goto(base+route+'/index.html');const modern=route==='rail'&&await page.locator('.capability-detail').count()>0,expected=(modern?require('./navigation.cjs').forVertical('rail'):require('../src/site.json').navigation).map(n=>'#'+n.id);check(JSON.stringify(await page.locator('.nav>a').evaluateAll(es=>es.map(e=>e.getAttribute('href'))))===JSON.stringify(expected),`${width} ${route}: exact navigation order`);check(JSON.stringify(await page.locator('.footer-grid>div').filter({has:page.locator('h3', {hasText:'Engineering'})}).locator('a').evaluateAll(es=>es.map(e=>e.getAttribute('href'))))===JSON.stringify(modern?expected:expected.slice(0,4)),`${width} ${route}: footer order`);}
 await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 const tracks=page.locator(width<800?'.ecosystem-mini-track':'.ecosystem-track');
 for(let index=0;index<await tracks.count();index++){
 const track=tracks.nth(index),states=[];
 for(const [name,ratio]of [['bottom',1],['middle',.5],['top',0]]){
  await track.evaluate((e,r)=>scrollTo(0,scrollY+e.getBoundingClientRect().top+e.getBoundingClientRect().height/2-innerHeight*r),ratio);await page.waitForTimeout(100);
  const state=await track.evaluate(e=>{const nums=p=>e.querySelector(p).getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return{steel:nums('.track-steel'),ties:nums('.track-sleepers'),width:e.viewBox.baseVal.width};});states.push(state);
  const [ux,uy,ur,lx,ly,lr]=state.steel,t=state.ties,intersection=(a,y)=>a[0]+(a[2]-a[0])*(y-a[1])/(a[3]-a[1]);
  check(ur>ux&&lr>lx&&ly>uy,`${width}/${index}/${name}: distinct horizontal rails`);
  check(ux<intersection(t.slice(0,4),uy)&&ur>intersection(t.slice(-4),uy)&&lx<intersection(t.slice(0,4),ly)&&lr>intersection(t.slice(-4),ly),`${width}/${index}/${name}: both rails extend beyond outer sleepers`);
  const middle=t.slice((t.length/4-1)/2*4,(t.length/4-1)/2*4+4);check(Math.abs(middle[0]-middle[2])<.001,`${width}/${index}/${name}: middle sleeper vertical`);
  if(index===0){await track.evaluate((e,r)=>scrollTo(0,scrollY+e.getBoundingClientRect().top+e.getBoundingClientRect().height/2-innerHeight*r),Math.max(.14,Math.min(.86,ratio)));await page.waitForTimeout(100);await page.screenshot({path:`${out}/${width}-${name}.png`});}
 }
 const gauge=s=>s.steel[4]-s.steel[1];check(gauge(states[0])>gauge(states[1])&&gauge(states[1])>gauge(states[2]),`${width}/${index}: gauge decreases smoothly toward top (${states.map(gauge).join(', ')})`);
 check(Math.abs(states[0].ties[0]-states[0].ties[2])<.01,`${width}/${index}: bottom sleepers upright (${states[0].ties.slice(0,4).join(', ')})`);
 check(states[2].ties[0]>states[2].ties[2]&&states[2].steel[0]>states[2].steel[3],`${width}/${index}: top sleepers converge and upper rail is shorter`);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);
 const fixed=await Promise.all((await tracks.all()).map(track=>track.locator('.track-steel').getAttribute('d')));
 await page.evaluate(()=>scrollBy(0,-240));await page.waitForTimeout(80);
 for(let index=0;index<fixed.length;index++)check(fixed[index]===await tracks.nth(index).locator('.track-steel').getAttribute('d'),`${width}/${index}: reduced motion static`);
 await page.close();
}
check(!report.errors.length,'No browser errors');report.passed=true;
}catch(e){report.errors.push(e.stack);report.passed=false;}finally{await browser.close();fs.writeFileSync(`${out}/qa.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));if(!report.passed)process.exitCode=1;}})();
