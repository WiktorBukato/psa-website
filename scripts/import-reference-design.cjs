// One-time restoration from owner-supplied references; generated sources are committed.
const fs=require('node:fs');
const path=require('node:path');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {chromium}=dependency('playwright');
(async()=>{
 const original=fs.readFileSync('reference/eiot/index.html','utf8');
 let main=original.match(/<main id="main">([\s\S]*?)<\/main>/)[1];
 main=main.replaceAll('href="#railway"','href="../rail/index.html"').replaceAll('href="https://www.psa.inc/railway/"','href="../rail/index.html"').replaceAll('href="https://www.psa.inc/enterprise-iot/"','href="#expertise"').replace('Partner for<br>','Partner for <br>');
 fs.writeFileSync('src/pages/eiot.html',main);
 fs.copyFileSync('reference/eiot/assets/hero-reference.png','src/assets/hero-reference.png');
 for(const file of ['fuel.png','coffee.png','rail.png'])fs.copyFileSync(`reference/eiot/assets/${file}`,`src/assets/${file}`);
 fs.copyFileSync('image 1.png','src/assets/rail-reference.png');
 const browser=await chromium.launch({executablePath:chromeExecutable});
 const page=await browser.newPage();
 const css=fs.readFileSync('reference/eiot/styles.css','utf8');
 const scoped=await page.evaluate(css=>{
  const sheet=new CSSStyleSheet();sheet.replaceSync(css);
  function rules(list){return [...list].map(rule=>{
   if(rule instanceof CSSStyleRule){
    const selectors=rule.selectorText.split(',').map(s=>s.trim()).filter(s=>!/(\.header|\.nav\b|\.brand|\.menu-toggle|\.skip|footer)/.test(s));
    if(!selectors.length)return '';
    return selectors.map(s=>(s===':root'||s==='body')?'.theme-eiot #main':`.theme-eiot #main ${s}`).join(',')+'{'+rule.style.cssText+'}';
   }
   if(rule.cssRules)return rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+rules(rule.cssRules)+'}';
   return rule.cssText;
  }).join('\n');}
  return rules(sheet.cssRules);
 },css);
 fs.mkdirSync('src/styles',{recursive:true});
 fs.writeFileSync('src/styles/eiot.css','/* Owner-supplied CSS, scoped to main to preserve the approved shared shell. */\n.theme-eiot #main{line-height:normal;}\n.theme-eiot #main .text-link,.theme-eiot #main .button{min-height:auto;text-align:start}\n.theme-eiot #main .section-heading>p{font-size:inherit}\n'+scoped+'\n');
 // Keep shared shell/gateway rules exactly, discard the rejected v0.1 page designs.
 const shared=await page.evaluate(css=>{
  const sheet=new CSSStyleSheet();sheet.replaceSync(css);
  const allowed=/^(?::root|\*|body|a(?=[: {.]|$)|button(?=[: {]|$)|img|svg|h[123]|p(?=[: {]|$)|summary|\[hidden\]|section|\[id\]|\.container|\.section(?=[: {]|$)|\.eyebrow|\.section-heading|\.button|\.text-link|\.skip|\.header|\.brand|\.nav|\.vertical-switch|\.menu-toggle|\.site-footer|\.footer-|\.back-top|\.gateway|\.theme-rail$)/;
  function rules(list){return [...list].map(rule=>{
   if(rule instanceof CSSStyleRule){const ss=rule.selectorText.split(',').map(s=>s.trim()).filter(s=>allowed.test(s)||/^\.js \.(nav|menu-toggle)/.test(s)||s==='.theme-rail .site-footer');return ss.length?ss.join(',')+'{'+rule.style.cssText+'}':'';}
   if(rule.cssRules){const inner=rules(rule.cssRules);return inner.trim()?rule.cssText.slice(0,rule.cssText.indexOf('{')+1)+inner+'}':'';}
   return '';
  }).join('\n');}return rules(sheet.cssRules);
 },fs.readFileSync('docs/v0.1/assets/site.css','utf8'));
 fs.writeFileSync('src/site.css','/* Approved common shell and gateway, extracted unchanged from v0.1. */\n'+shared+'\n');
 const lucide=require('../reference/eiot/assets/lucide.min.js');
 const icons=JSON.parse(fs.readFileSync('src/icons.json','utf8'));
 for(const name of ['calendar-check','chart-no-axes-column-increasing','globe','train-track','train-front','plug','activity','circle-check','clipboard-check','radio-tower','router','laptop','monitor','building-2','code-xml','settings','database','cpu']){
  const key=name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('');
  if(!lucide.icons[key])throw Error('Missing '+key);icons[name]=lucide.icons[key];
 }
 icons['rail-signal']=['svg',{xmlns:'http://www.w3.org/2000/svg',width:24,height:32,viewBox:'0 0 24 32',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'},[['rect',{x:7,y:2,width:10,height:21,rx:5}],['circle',{cx:12,cy:8,r:2}],['circle',{cx:12,cy:16,r:2}],['path',{d:'M12 23v7M8 30h8'}]]];
 icons['rail-station']=['svg',{xmlns:'http://www.w3.org/2000/svg',width:44,height:34,viewBox:'0 0 44 34',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round'},[['rect',{x:23,y:4,width:17,height:24,rx:4}],['path',{d:'M28 4V1h7v3M26 10h11v9H26zM26 23h2m7 0h2M26 28l-2 5m13-5 3 5M1 33h42M3 32V18h11v14M1 18h15M6 21h5'}]]];
 const railAttrs={...icons['rail-signal'][1],width:32,height:34,viewBox:'0 0 32 34'};
 icons['rail-train']=['svg',railAttrs,[['rect',{x:6,y:2,width:20,height:25,rx:4}],['path',{d:'M10 7h12v10H10zM10 22h3m6 0h3M9 27l-5 6m19-6 5 6M5 31h22M13 4h6'}]]];
 icons['rail-control']=['svg',railAttrs,[['path',{d:'M3 33V18h11v15M14 33V2h14v31M1 33h30M6 21v3m5-3v3M6 27v3m5-3v3M18 6h1m4 0h1M18 10h1m4 0h1M18 14h1m4 0h1M18 18h1m4 0h1M18 22h1m4 0h1M18 26h1m4 0h1M18 30h1m4 0h1'}]]];
 icons['rail-verification']=['svg',railAttrs,[['rect',{x:3,y:3,width:26,height:27,rx:4}],['path',{d:'m8 11 2 2 4-5m-6 13 2 2 4-5M18 12h6M18 22h6'}]]];
 fs.writeFileSync('src/icons.json',JSON.stringify(icons));
 await browser.close();console.log('Restored eIoT HTML/assets/CSS; kept approved common shell.');
})();
