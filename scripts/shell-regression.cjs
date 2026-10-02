// The owner approved the v0.1 shell: compare it independently of changed page content.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const {chromium}=dependency('playwright');
const sharp=dependency('sharp');
const version=require('../src/site.json').releaseVersion;
(async()=>{
 const browser=await chromium.launch({executablePath:chromeExecutable});
 const out=path.join('evidence',version,'shell');fs.mkdirSync(out,{recursive:true});
 const results=[];
 const railRedesign=require('../src/site.json').verticals.find(v=>v.id==='rail').navigation;
 for(const width of [1440,390])for(const route of railRedesign?['eiot','index.html']:['eiot','rail','index.html']){
  const pairs={};
  for(const [label,base] of [['approved','docs/v0.1'],['restored',`.staging/${version}`]]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.goto(pathToFileURL(path.resolve(base,route==='index.html'?route:route+'/index.html')).href);
   await page.evaluate(()=>{for(const a of document.querySelectorAll('.footer-bottom a,.gateway-footer span'))a.textContent=a.textContent.replace(/v\d+\.\d+(?:\.\d+)?/g,'vX.Y');});
   // Owner-approved navigation reorder: compare all other shell pixels unchanged.
   await page.evaluate(order=>{for(const parent of [document.querySelector('.nav'),...document.querySelectorAll('.footer-grid>div')].filter(e=>e&&(e.matches('.nav')||e.querySelector('h3')?.textContent==='Engineering'))){for(const id of order){const a=parent.querySelector('a[href="#'+id+'"]');if(a)parent.append(a);}}},require('../src/site.json').navigation.map(n=>n.id));
   const selectors=route==='index.html'?['body']:['.header','.site-footer'];
   for(const selector of selectors){
    // Align the shell on the same pixel grid; changed main heights must not
    // introduce subpixel text-antialiasing differences into the footer check.
    if(selector==='.site-footer')await page.locator('main').evaluate(e=>{e.hidden=true;});
    const name=`${route.replace('.html','')}-${selector.replace('.','')}-${width}`;
    const file=path.join(out,`${name}-${label}.png`);
    await page.locator(selector).screenshot({path:file});
    (pairs[name]??=[]).push(file);
   }
   await page.close();
  }
  for(const [name,files]of Object.entries(pairs)){
   const [a,b]=await Promise.all(files.map(file=>sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
   let changed=0;
   const sameSize=a.info.width===b.info.width&&a.info.height===b.info.height;
   if(sameSize)for(let i=0;i<a.data.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])))>12)changed++;
   results.push({name,sameSize,changedPercent:sameSize?changed/(a.info.width*a.info.height)*100:null});
  }
 }
 await browser.close();
 const passed=results.every(r=>r.sameSize&&r.changedPercent===0);
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({version,manifestSha256:sha(`.staging/${version}/manifest.json`),passed,results},null,2));
 console.log(JSON.stringify({passed,results},null,2));if(!passed)process.exitCode=1;
})();
