const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const version=process.argv[2]||'v0.1';
const root=path.resolve(process.argv[3]||path.join('.staging',version));
let checks=0;
function assert(value,message){checks++;if(!value)throw Error(message);}
function verifyManifest(folder){
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
  for(const [file,hash] of Object.entries(manifest.files)){
    const target=path.join(folder,file);
    assert(fs.existsSync(target),`Missing published file ${target}`);
    assert(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')===hash,`Immutable file changed: ${target}`);
  }
}
const htmlFiles=['index.html','eiot/index.html','rail/index.html'];
for(const file of htmlFiles){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert(ids.length===new Set(ids).size,`Duplicate IDs in ${file}`);
  assert((html.match(/<h1[ >]/g)||[]).length===1,`Expected one h1 in ${file}`);
  assert(!/data-lucide|href="#"|javascript:|lorem ipsum|TODO/i.test(html),`Unresolved output in ${file}`);
  for(const match of html.matchAll(/\b(?:href|src|srcset)="([^"]+)"/g)){
    const ref=match[1];
    if(/^(?:https?:|mailto:|tel:|data:)/.test(ref))continue;
    const [target,fragment]=ref.split('#');
    const resolved=target?path.resolve(root,path.dirname(file),decodeURIComponent(target)):path.join(root,file);
    assert(resolved.startsWith(root+path.sep),`Path outside release: ${ref}`);
    assert(fs.existsSync(resolved),`Broken reference ${file}: ${ref}`);
    if(fragment)assert(fs.readFileSync(resolved,'utf8').includes(`id="${fragment}"`),`Broken anchor ${file}: ${ref}`);
  }
}
const nav=htmlFiles.slice(1).map(file=>fs.readFileSync(path.join(root,file),'utf8').match(/<nav class="nav"[^>]*>([\s\S]*?)<\/nav>/)[1]);
assert(nav[0]===nav[1],'Main navigation differs between verticals');
const css=fs.readFileSync(path.join(root,'assets/site.css'),'utf8');
for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))assert(fs.existsSync(path.resolve(root,'assets',match[1])),`Broken CSS asset ${match[1]}`);
verifyManifest(root);
if(fs.existsSync('docs/releases.json'))for(const release of JSON.parse(fs.readFileSync('docs/releases.json','utf8')))require('./releases.cjs').verifyRelease(path.resolve('docs',release.version),release.manifestSha256);
console.log(`PASS: ${checks} static, navigation and release-integrity checks`);
