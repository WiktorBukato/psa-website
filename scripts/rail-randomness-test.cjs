const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const base=process.argv[3]||pathToFileURL(path.resolve('.staging',version)).href+'/';
const out=path.join('evidence',version,base.startsWith('http')?'randomness-live':'randomness');fs.mkdirSync(out,{recursive:true});
const report={version,manifestSha256:sha(`.staging/${version}/manifest.json`),checks:[],errors:[]};
function check(value,name){report.checks.push({name,passed:!!value});if(!value)throw Error(name);}
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
   window.lightPulses=[];const original=Element.prototype.animate;
   Element.prototype.animate=function(frames,options){
    if(this.matches('.scene-light'))window.lightPulses.push({id:[...document.querySelectorAll('.scene-light')].indexOf(this),at:performance.now(),duration:options.duration,rise:frames[1].offset,peak:frames[1].opacity,overlaps:this.getAnimations().filter(a=>a.playState==='running').length});
    return original.call(this,frames,options);
   };
  });
  await page.goto(base+'rail/index.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(22000);
  const pulses=await page.evaluate(()=>window.lightPulses);
  fs.writeFileSync(path.join(out,'pulses.json'),JSON.stringify(pulses,null,2));
  check(pulses.length>150,'Sustained independent activity over 22 seconds');
  check(pulses.every(p=>p.overlaps===0),'No overlapping pulses on the same light');
  check(pulses.every(p=>p.peak<1),'No saturation of pulse peaks');
  check(new Set(pulses.map(p=>Math.round(p.rise*100))).size>20,'Variable pulse shape');
  check(Math.max(...pulses.map(p=>p.duration))-Math.min(...pulses.map(p=>p.duration))>2000,'Broad duration variation');
  const first=new Map();for(const p of pulses)if(!first.has(p.id))first.set(p.id,p.at);
  const start=Math.min(...first.values());
  check([...first.values()].filter(t=>t-start>5000).length>25,'First pulses spread beyond the old short startup window');
  const core=await page.locator('.scene-light-core').evaluateAll(nodes=>nodes.map(n=>({y:+n.getAttribute('cy'),r:+n.getAttribute('r')})));
  check(core.filter(p=>p.y<290).every(p=>p.r<.8),'Distant windows and arches have smaller cores');
  check(await page.locator('.aircraft-light').getAttribute('r')==='1.4','Aircraft core reduced to 1.4 source pixels');
  await page.locator('.rail-hero').screenshot({path:path.join(out,'normal-hero.png')});
  await page.locator('.scene-debug-toggle').click();
  await page.locator('.rail-hero').screenshot({path:path.join(out,'debug-hero.png')});
  check(report.errors.length===0,'No browser errors');report.passed=true;
 }catch(e){report.passed=false;report.errors.push(e.stack);process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
})();
