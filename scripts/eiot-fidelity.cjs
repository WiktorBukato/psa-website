// Compare restored eIoT content to the owner's source, excluding the approved shell.
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
 const out=`evidence/${version}/reference`;fs.mkdirSync(out,{recursive:true});
 const results=[];
 for(const width of [1440,1920,390]){
  const samples=[];
  for(const [label,file]of [['original','reference/eiot/index.html'],['restored',`.staging/${version}/eiot/index.html`]]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.goto(pathToFileURL(path.resolve(file)).href);
   await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
   // Align the main elements on the same pixel grid, removing only their headers.
   await page.locator('.header').evaluate(e=>e.hidden=true);
   // The source hides this <br> on mobile, joining "forComplex". Normalize
   // the single missing word separator, as recorded in the v0.2 change scope.
   if(label==='original')await page.locator('.hero h1').evaluate(e=>{const first=e.firstChild;if(first?.nodeType===Node.TEXT_NODE&&first.textContent.endsWith('for'))first.textContent+=' ';});
   const text=await page.locator('main').evaluate(e=>e.innerText.replace(/\s/g,''));
   const png=path.join(out,`eiot-${label}-${width}.png`);
   await page.locator('main').screenshot({path:png});
   samples.push({text,pixels:await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true})});
   await page.close();
  }
  const [a,b]=samples;const sameSize=a.pixels.info.width===b.pixels.info.width&&a.pixels.info.height===b.pixels.info.height;
  let changed=0;
  if(sameSize)for(let i=0;i<a.pixels.data.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(a.pixels.data[i+c]-b.pixels.data[i+c])))>12)changed++;
  results.push({width,sameText:a.text===b.text,sameSize,changedPercent:sameSize?changed/(a.pixels.info.width*a.pixels.info.height)*100:null});
 }
 await browser.close();
 const passed=results.every(r=>r.sameText&&r.sameSize&&r.changedPercent===0);
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({version,manifestSha256:sha(`.staging/${version}/manifest.json`),normalization:'Single source headline whitespace before hidden mobile br; original raw mobile mismatch was limited to the for/Complex line (0.1205%).',passed,results},null,2));
 console.log(JSON.stringify({passed,results},null,2));if(!passed)process.exitCode=1;
})();
