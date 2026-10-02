const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const {sha,verifyRelease}=require('./releases.cjs');
const version=process.argv[2]||'v0.10',root=path.resolve('.staging',version),out=`evidence/${version}/preservation-v10`;
fs.mkdirSync(out,{recursive:true});
const checks=[];const check=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const normalize=s=>s.replaceAll(/v\d+\.\d+(?:\.\d+)?/g,'VERSION');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
try{
 for(const release of JSON.parse(fs.readFileSync('docs/releases.json','utf8'))){verifyRelease(`docs/${release.version}`,release.manifestSha256);check(true,`Immutable ${release.version}`);}
 for(const file of ['eiot/index.html','index.html','assets/eiot.css','assets/site.css','assets/app.js'])check(normalize(fs.readFileSync(`docs/v0.9/${file}`,'utf8'))===normalize(fs.readFileSync(`${root}/${file}`,'utf8')),`Unchanged eIoT/gateway/shared source: ${file}`);
 for(const file of ['src/rail-scene.json','scripts/rail-components.cjs'])check(execFileSync('git',['show',`1cef9c7:${file}`]).equals(fs.readFileSync(file)),`Scene geometry and renderer unchanged: ${file}`);
 for(const file of ['rail-hero-clean-v09-1983.webp','rail-hero-clean-v09-960.webp'])check(sha(`${root}/assets/${file}`)===sha(`docs/v0.9/assets/${file}`),`Approved hero unchanged: ${file}`);
 const existingAssetNames=fs.readdirSync(`${root}/assets`).filter(name=>fs.existsSync(`docs/v0.9/assets/${name}`)&&!['rail.css','rail.js','licenses.txt'].includes(name));
 for(const name of existingAssetNames)check(sha(`${root}/assets/${name}`)===sha(`docs/v0.9/assets/${name}`),`Reused asset byte-identical: ${name}`);
 const baseline=execFileSync('git',['show','1cef9c7:src/scripts/rail.js']).toString().split('// Progressive case previews')[0].trim();check(fs.readFileSync('src/scripts/rail.js','utf8').trim()===baseline,'Hero and scroll-track runtime unchanged; only obsolete case preview removed');
 const published=walk(root),allowedExtensions=new Set(['.html','.css','.js','.svg','.json','.png','.jpg','.webp','.txt']);
 check(published.every(file=>allowedExtensions.has(path.extname(file))),'Output asset types allowlisted');
 check(!published.some(file=>/private|\.pdf$|\.map$|rail-reference|extracted|research|source-locators/i.test(file)),'No private, PDF mockup or source-map files in output');
 const textFiles=[...walk('src'),...walk('scripts'),...published].filter(file=>/\.(?:html|css|js|cjs|json|svg)$/.test(file));
 const forbidden=/AAMk[A-Za-z0-9_=-]{10,}|teams\.microsoft\.com\/l\/message|outlook\.office|sharepoint\.com\/|api[_-]?key\s*[=:]\s*["'][^"']{12,}/i;
 // Audit the planned code tree, excluding this test's literal scanner patterns.
 check(textFiles.filter(file=>path.resolve(file)!==path.resolve(__filename)).every(file=>!forbidden.test(fs.readFileSync(file,'utf8'))),'No message IDs, internal links or embedded keys in planned code/output');
 if(process.argv[3]){
  const privateSeed=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  const terms=privateSeed.candidates.flatMap(record=>[...(record.codes||[]),record.customerOrOperator,record.place]).filter(term=>typeof term==='string'&&term.length>=4);
  check(textFiles.every(file=>{const text=fs.readFileSync(file,'utf8');return terms.every(term=>!text.toLowerCase().includes(term.toLowerCase()));}),'External private-registry identifiers absent from code and output');
 }
 const rail=fs.readFileSync(`${root}/rail/index.html`,'utf8');
 check(!/Mainline Signaling Upgrade|Urban Station Systems Integration|Level Crossing Safety Upgrade|15\+|150\+|750\+|100% coverage|SIL.Related Experience|ITCSM|PFC200roject|Give a Credit|FILMWARE/.test(rail),'Superseded copy and unapproved claims absent');
 check(!/rail-logo-drift|client-logos|partner-logos/.test(rail),'No imported logo walls or idle drift');
 check(!/fetch\s*\(/.test(fs.readFileSync(`${root}/assets/rail.js`,'utf8')),'No runtime data fetch');
 check(rail.includes('noindex,nofollow')&&!/rel="canonical"/.test(rail),'Review indexing policy preserved');
 const totals=folder=>{const files=walk(folder).filter(file=>/\.(?:html|css|js|webp|png|jpg|svg)$/.test(file));return {bytes:files.reduce((sum,file)=>sum+fs.statSync(file).size,0),gzipBytes:files.reduce((sum,file)=>sum+zlib.gzipSync(fs.readFileSync(file)).length,0),files:files.map(file=>({file:path.relative(folder,file),bytes:fs.statSync(file).size,gzip:zlib.gzipSync(fs.readFileSync(file)).length}))};};
 const resources={before:totals('docs/v0.9'),after:totals(root)};
 fs.writeFileSync(`${out}/resources.json`,JSON.stringify(resources,null,2));
 fs.writeFileSync(`${out}/qa.json`,JSON.stringify({version,manifestSha256:sha(`${root}/manifest.json`),checks,passed:true,resources:{beforeBytes:resources.before.bytes,afterBytes:resources.after.bytes}},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,beforeBytes:resources.before.bytes,afterBytes:resources.after.bytes}));
}catch(error){fs.writeFileSync(`${out}/qa.json`,JSON.stringify({version,manifestSha256:sha(`${root}/manifest.json`),checks,passed:false,error:error.message},null,2));console.error(error.message);process.exitCode=1;}
