const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const site = require('../src/site.json');
const icons = require('../src/icons.json');
const railComponents = require('./rail-components.cjs');
const version = process.argv[2] || site.releaseVersion;
if (!/^v\d+\.\d+(?:\.\d+)?$/.test(version)) throw Error('Use a version such as v0.1');
const out = path.join('.staging', version);
const stageRoot=path.resolve('.staging');
if(!path.resolve(out).startsWith(stageRoot+path.sep))throw Error('Unsafe staging path');
if(fs.existsSync(out))fs.rmSync(path.resolve(out),{recursive:true});
fs.mkdirSync(out, { recursive: true });
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function node([tag, attrs, children = []]) {
  return `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' ')}>${children.map(node).join('')}</${tag}>`;
}
function icon(name) {
  if(!icons[name]) throw Error(`Unknown icon ${name}`);
  const [tag,attrs,children]=icons[name];
  return node([tag,{...attrs,'stroke-width':1.5,'aria-hidden':'true',focusable:'false'},children]);
}
const arrow = () => icon('arrow-right');
function brand(prefix,vertical='') { return `<a class="brand" href="${prefix}index.html" aria-label="PSA — website home"><img src="${prefix}assets/brand-psa-color.svg" alt="PSA" width="159" height="36">${vertical?`<span>${vertical}</span>`:''}</a>`; }
function header(current) {
  return `<a class="skip" href="#main">Skip to content</a><header class="header"><div class="container header-inner">${brand('../',current==='rail'?'RAIL':'eIoT')}<nav class="nav" id="navigation" aria-label="Main navigation">${site.navigation.map(n=>`<a href="#${n.id}">${n.label}</a>`).join('')}</nav><nav class="vertical-switch" aria-label="Engineering vertical">${site.verticals.map(v=>`<a href="../${v.id}/index.html" ${v.id===current?'aria-current="page"':''}>${v.id==='eiot'?'eIoT':'Rail'}</a>`).join('')}</nav><a class="button small header-cta" href="#contact">Let’s talk ${arrow()}</a><button class="menu-toggle" aria-label="Open menu" aria-controls="navigation" aria-expanded="false">${icon('menu')}</button></div></header>`;
}
function footer(current) {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div>${brand('../',current==='rail'?'RAIL':'eIoT')}<p>Engineering connected products.<br>Building confidence in complex systems.</p></div><div><h3>Explore PSA</h3>${site.verticals.map(v=>`<a href="../${v.id}/index.html">${v.label} ${arrow()}</a>`).join('')}</div><div><h3>Engineering</h3>${site.navigation.slice(0,4).map(n=>`<a href="#${n.id}">${n.label}</a>`).join('')}</div><div><h3>Start a conversation</h3><a href="mailto:${site.email}">${site.email}</a><a href="tel:${site.phoneHref}">${site.phone}</a><a href="${site.contactUrl}">PSA contact page ↗</a></div></div><div class="footer-bottom"><p>© 2026 ${site.company}</p><span>Engineering, together.</span><a href="../index.html">${version} · Explore both verticals</a></div></div></footer><a class="back-top" href="#main" aria-label="Back to top">${icon('arrow-up')}</a>`;
}
function document(page,body) {
  const pageScript=fs.existsSync(`src/scripts/${page.id}.js`)?`<script src="../assets/${page.id}.js" defer></script>`:'';
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${page.id==='rail'?'dark':'light'}"><meta name="robots" content="noindex,nofollow"><title>PSA — ${page.title}</title><meta name="description" content="${esc(page.description)}"><meta name="theme-color" content="${page.id==='rail'?'#041d20':'#f5f9fc'}"><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../assets/site.css"><link rel="stylesheet" href="../assets/${page.id}.css"><script src="../assets/app.js" defer></script>${pageScript}</head><body class="theme-${page.id}">${header(page.id)}<main id="main" tabindex="-1">${body}</main>${footer(page.id)}</body></html>`;
}
function expand(html) {
  return html.replace(/<i data-lucide="([^"]+)"(?: aria-hidden="true")?><\/i>/g,(_,name)=>icon(name))
    .replaceAll('src="assets/','src="../assets/').replace(/\{\{contact:([^}]+)\}\}/g,(_,subject)=>`mailto:${site.email}?subject=${encodeURIComponent(subject)}`);
}
fs.cpSync('src/assets',path.join(out,'assets'),{recursive:true,filter:s=>!s.endsWith('-original.png')});
for(const file of ['site.css','app.js']) fs.copyFileSync(`src/${file}`,path.join(out,'assets',file));
for(const page of site.verticals){
  const style=`src/styles/${page.id}.css`,motion=`src/styles/${page.id}-motion.css`,script=`src/scripts/${page.id}.js`;
  fs.writeFileSync(path.join(out,'assets',`${page.id}.css`),fs.readFileSync(style,'utf8')+(fs.existsSync(motion)?'\n'+fs.readFileSync(motion,'utf8'):''));
  if(fs.existsSync(script))fs.copyFileSync(script,path.join(out,'assets',`${page.id}.js`));
}
fs.copyFileSync('THIRD-PARTY-NOTICES.md',path.join(out,'assets','licenses.txt'));
for(const page of site.verticals) {
  fs.mkdirSync(path.join(out,page.id),{recursive:true});
  const source = fs.readFileSync(`src/pages/${page.id}.html`,'utf8');
  fs.writeFileSync(path.join(out,page.id,'index.html'),document(page,expand(page.id==='rail'?railComponents.expand(source):source)));
}
const home = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>PSA — Connected Products. Critical Infrastructure.</title><meta name="description" content="Explore PSA engineering expertise in Enterprise IoT and railway systems."><link rel="icon" href="assets/favicon.svg"><link rel="stylesheet" href="assets/site.css"></head><body class="gateway"><header class="container gateway-header">${brand('')}<span>Engineering, together.</span></header><main class="container"><p class="eyebrow">Professional Software Associates</p><h1>Connected products.<br>Critical infrastructure.</h1><p class="gateway-intro">Two areas of expertise. One engineering partner.<br>Explore what we can build together.</p><div class="gateway-grid"><a class="gateway-card gateway-eiot" href="eiot/index.html"><span class="eyebrow">01 / Enterprise IoT</span>${icon('cpu')}<h2>From the device<br>to the enterprise.</h2><p>Hardware. Embedded. Connectivity. Cloud. AI.</p><span class="text-link">Explore eIoT ${arrow()}</span></a><a class="gateway-card gateway-rail" href="rail/index.html"><span class="eyebrow">02 / Railway systems</span>${icon('train-front')}<h2>From trackside<br>to onboard.</h2><p>Signaling. Integration. Modernization. Verification.</p><span class="text-link">Explore Rail ${arrow()}</span></a></div></main><footer class="container gateway-footer"><span>© 2026 ${site.company}</span><span>${version}</span></footer></body></html>`;
fs.writeFileSync(path.join(out,'index.html'),home);
function walk(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=Object.fromEntries(walk(out).filter(f=>!f.endsWith('manifest.json')).map(f=>[path.relative(out,f).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version,files},null,2)+'\n');
console.log(`Built ${version}: ${Object.keys(files).length} files → ${out}`);
