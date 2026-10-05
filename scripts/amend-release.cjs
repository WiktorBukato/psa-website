// Explicit, exact owner exceptions only; this is not a general mutable release path.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {sha,verifyRelease}=require('./releases.cjs');
const [version,id]=process.argv.slice(2),records=require('./release-amendments.json');
const record=records.find(r=>r.version===version&&r.id===id);
if(!record?.authorization)throw Error('An exact owner-authorized amendment record is required.');
const target=path.join('docs',version),stage=path.join('.staging',version),registry=JSON.parse(fs.readFileSync('docs/releases.json','utf8'));
const current=registry.find(r=>r.version===version);
if(!current||current.manifestSha256!==record.beforeManifestSha256)throw Error('Unexpected published baseline.');
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==record.baseCommit)throw Error('Unexpected amendment base commit.');
for(const release of registry)verifyRelease(path.join('docs',release.version),release.manifestSha256);
const old=verifyRelease(target,record.beforeManifestSha256),next=verifyRelease(stage,record.afterManifestSha256);
verifyRelease(path.join('evidence',version,'pre-map-amendment','site'),record.beforeManifestSha256);
if(JSON.stringify(Object.keys(old.files).sort())!==JSON.stringify(Object.keys(next.files).sort()))throw Error('An amendment cannot change the public file set.');
const changed=Object.keys(old.files).filter(f=>old.files[f]!==next.files[f]).sort();
if(JSON.stringify(changed)!==JSON.stringify(Object.keys(record.files).sort()))throw Error('Unexpected amended files.');
for(const file of changed)if(!['rail/index.html','assets/rail.css','assets/rail.js'].includes(file)||old.files[file]!==record.files[file].before||next.files[file]!==record.files[file].after)throw Error(`Unapproved transition: ${file}`);
execFileSync(process.execPath,['scripts/check.cjs',version],{stdio:'inherit'});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),review=read(`evidence/${version}/visual-review.json`),qa=read(`evidence/${version}/local/qa.json`);
if(!qa.passed||qa.manifestSha256!==record.afterManifestSha256||!review.reviewed||!review.reviewer||!review.scope||!review.expectedChanges||!review.unchangedSections||review.manifestSha256!==record.afterManifestSha256)throw Error('Current browser and actual visual review are required.');
const comparison=read(review.comparison);
if(comparison.newManifestSha256!==record.afterManifestSha256||comparison.newVersion!==version)throw Error('Stale comparison.');
for(const file of review.additionalChecks){const check=read(file);if(!check.passed||check.manifestSha256!==record.afterManifestSha256)throw Error(`Missing or stale QA: ${file}`);}
for(const file of [...changed,'manifest.json'])fs.copyFileSync(path.join(stage,file),path.join(target,file));
current.manifestSha256=record.afterManifestSha256;fs.writeFileSync('docs/releases.json',JSON.stringify(registry,null,2)+'\n');
for(const release of registry)verifyRelease(path.join('docs',release.version),release.manifestSha256);
console.log(`Applied exact owner exception ${id}; ${changed.length} public files amended, all ${registry.length} releases verified.`);
