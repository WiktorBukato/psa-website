const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {chromium}=dependency('playwright');
const version=require('../src/site.json').releaseVersion;
(async()=>{
 const browser=await chromium.launch({executablePath:chromeExecutable});
 const out=path.join('evidence',version,'reference');fs.mkdirSync(out,{recursive:true});
 for(const [label,file,width] of [['eiot-original','reference/eiot/index.html',1440],['eiot-restored',`.staging/${version}/eiot/index.html`,1440],['rail-restored',`.staging/${version}/rail/index.html`,805],['rail-desktop',`.staging/${version}/rail/index.html`,1440],['rail-mobile',`.staging/${version}/rail/index.html`,390],['eiot-mobile',`.staging/${version}/eiot/index.html`,390]]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(pathToFileURL(path.resolve(file)).href);
  await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  await page.locator('main').screenshot({path:path.join(out,label+'.png')});
  const bounds=await page.locator('main>section').evaluateAll(es=>es.map(e=>({id:e.id,class:e.className,y:e.offsetTop,height:e.offsetHeight})));
  console.log(label,JSON.stringify(bounds));
  await page.close();
 }
 await browser.close();
})();
