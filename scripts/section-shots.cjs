const {dependency,chromeExecutable}=require('./tooling.cjs');
const {chromium}=dependency('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const version=process.argv[2]||'v0.1';
(async()=>{const browser=await chromium.launch({executablePath:chromeExecutable});const out=path.join('evidence',version,'sections');fs.mkdirSync(out,{recursive:true});
for(const [route,id,width,height] of [['eiot','main',390,844],['eiot','ecosystem',390,844],['eiot','work',390,844],['rail','environment',390,844],['rail','contact',390,844],['rail','work',1440,900],['rail','environment',1440,900],['eiot','expertise',1440,900]]){
const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await page.goto(pathToFileURL(path.resolve('.staging',version,route,'index.html')).href);
await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.locator(`#${id}`).evaluate(e=>e.scrollIntoView());
await page.screenshot({path:path.join(out,`${route}-${id}-${width}.png`)});await page.close();}
for(const route of ['eiot','rail']){const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(pathToFileURL(path.resolve('.staging',version,route,'index.html')).href);await page.addStyleTag({content:':root{font-size:32px!important}'});await page.screenshot({path:path.join(out,`${route}-large-text.png`)});await page.close();}
await browser.close();})();
