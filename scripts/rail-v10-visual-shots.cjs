const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const version=process.argv[2]||'v0.10',out=`evidence/${version}/visual`,base=pathToFileURL(path.resolve('.staging',version)).href+'/';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto(base+'rail/index.html');await page.locator('.rail-map').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.rail-map').classList.contains('map-ready'));
  const capture=async(name,selector)=>{
   const target=page.locator(selector);await page.waitForTimeout(200);await target.scrollIntoViewIfNeeded();await page.evaluate(()=>document.activeElement?.blur());await page.locator('.header').evaluate((e,show)=>e.style.visibility=show?'visible':'hidden',selector==='.header');await page.locator('.back-top,.skip').evaluateAll(es=>es.forEach(e=>e.style.visibility='hidden'));await page.waitForTimeout(200);
   await target.screenshot({path:`${out}/${name}-${width}.png`,animations:'disabled'});
  };
  for(const [name,selector] of [['hero','.rail-hero'],['expertise','.rail-capabilities'],['context','.rail-environment'],['cases','.rail-work'],['map','.rail-map'],['delivery','.rail-delivery'],['trax','.rail-solution'],['assurance','.rail-assurance'],['contact','.rail-contact'],['header','.header'],['footer','.site-footer']])await capture(name,selector);
  for(const c of require('../src/content/rail-capabilities.json')){await page.locator(`[data-capability="${c.id}"]`).click();await capture(c.id,`#${c.id}`);await page.keyboard.press('Escape');}
  await page.locator('.more-cases summary').click();await capture('extra-cases','.more-cases');for(const faq of await page.locator('.rail-faq details').all())await faq.evaluate(e=>{e.open=true;});await capture('faq','.rail-faq');
  await page.close();console.log(`Complete, unclipped section crops: ${width}px`);
 }
}finally{await browser.close();}})();
