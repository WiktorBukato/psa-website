// Scoped evidence for the owner's single authorized v0.2 amendment.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const {chromium}=dependency('playwright');
const sharp=dependency('sharp');
const output='evidence/v0.2/rail-flow-amendment';
(async()=>{
 const browser=await chromium.launch({executablePath:chromeExecutable});
 const results=[];
 for(const width of [320,390,768,805,1440,2560]){
  const samples=[];
  for(const [label,root] of [['before',output+'/before'],['after','.staging/v0.2']]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.goto(pathToFileURL(path.resolve(root,'rail/index.html')).href);
   await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
   const bounds=await page.locator('#environment').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};});
   const png=await page.screenshot({path:`${output}/${label}-${width}.png`,fullPage:true});
   const raw=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   if(label==='after'){
    if(await page.locator('.flow-out .flow-arrow').count()!==2)throw Error('Two legend arrows required');
    if(width>760){
     // Resolve the calc() via the actual main line pseudo-element.
     const aligned=await page.evaluate(()=>{const nodes=document.querySelector('.environment-nodes');const axis=nodes.getBoundingClientRect().top+parseFloat(getComputedStyle(nodes,'::before').top);return [...document.querySelectorAll('.flow-in .flow-arrow,.flow-out .flow-secondary')].every(e=>{const r=e.getBoundingClientRect();return Math.abs(r.top+r.height/2-axis)<1;});});
     if(!aligned)throw Error('Arrow axis is misaligned');
    }
    await page.locator('#environment').screenshot({path:`${output}/section-${width}.png`});
   }
   samples.push({bounds,raw});await page.close();
  }
  const [a,b]=samples;const sameDimensions=a.raw.info.width===b.raw.info.width&&a.raw.info.height===b.raw.info.height;
  let outside=0,inside=0;
  if(sameDimensions)for(let y=0;y<a.raw.info.height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4;const changed=Math.max(...[0,1,2].map(c=>Math.abs(a.raw.data[i+c]-b.raw.data[i+c])))>12;
   if(changed){if(y>=Math.floor(a.bounds.top)&&y<=Math.ceil(a.bounds.bottom))inside++;else outside++;}
  }
  results.push({width,sameDimensions,unchangedSectionBounds:JSON.stringify(a.bounds)===JSON.stringify(b.bounds),outsideChangedPixels:outside,insideChangedPixels:inside});
 }
 await browser.close();
 const old=JSON.parse(fs.readFileSync(output+'/before/manifest.json'));
 const next=JSON.parse(fs.readFileSync('.staging/v0.2/manifest.json'));
 const changedFiles=Object.keys(next.files).filter(f=>old.files[f]!==next.files[f]);
 const passed=results.every(r=>r.sameDimensions&&r.unchangedSectionBounds&&r.outsideChangedPixels===0)&&(JSON.stringify(changedFiles.sort())===JSON.stringify(['assets/rail.css','rail/index.html']));
 fs.writeFileSync(output+'/qa.json',JSON.stringify({passed,manifestSha256:sha('.staging/v0.2/manifest.json'),changedFiles,results},null,2));
 console.log(JSON.stringify({passed,changedFiles,results},null,2));if(!passed)process.exitCode=1;
})();
