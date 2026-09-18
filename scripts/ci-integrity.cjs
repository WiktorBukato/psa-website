const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {verifyRelease}=require('./releases.cjs');
const releases=JSON.parse(fs.readFileSync('docs/releases.json','utf8'));
for(const r of releases)verifyRelease(path.join('docs',r.version),r.manifestSha256);
const base=process.argv[2];
if(base&&!/^0+$/.test(base)){
 let previous;
 try{previous=JSON.parse(execFileSync('git',['show',`${base}:docs/releases.json`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}
 catch(error){
  // A base commit without a release registry is the initial release only.
  const tree=execFileSync('git',['ls-tree','--name-only',base,'docs/releases.json'],{encoding:'utf8'}).trim();
  if(tree)throw error;previous=[];
 }
 for(const release of previous){
  const current=releases.find(r=>r.version===release.version);
  if(!current)throw Error(`Published version removed: ${release.version}`);
  const changed=execFileSync('git',['diff','--name-only',base,'HEAD','--',`docs/${release.version}`],{encoding:'utf8'}).trim();
  if(current.manifestSha256!==release.manifestSha256||changed){
   // Explicit owner exceptions are exact transitions, never a mutable allow-list.
   const records=JSON.parse(fs.readFileSync('scripts/release-amendments.json','utf8'));
   const baseCommit=execFileSync('git',['rev-parse',base],{encoding:'utf8'}).trim();
   const approval=records.find(a=>a.version===release.version&&a.baseCommit===baseCommit&&a.beforeManifestSha256===release.manifestSha256&&a.afterManifestSha256===current.manifestSha256);
   if(!approval)throw Error(`Unapproved published change: ${release.version}`);
   const prefix=`docs/${release.version}/`;
   const expected=[...Object.keys(approval.files),'manifest.json'].map(f=>prefix+f).sort();
   if(JSON.stringify(changed.split('\n').sort())!==JSON.stringify(expected))throw Error('Amendment changed an unapproved file');
   const old=JSON.parse(execFileSync('git',['show',`${base}:${prefix}manifest.json`],{encoding:'utf8'}));
   const next=JSON.parse(fs.readFileSync(prefix+'manifest.json','utf8'));
   if(JSON.stringify(Object.keys(old.files).sort())!==JSON.stringify(Object.keys(next.files).sort()))throw Error('Amendment changed the file set');
   for(const [file,hash] of Object.entries(old.files)){
    const allowed=approval.files[file];
    if(allowed?(hash!==allowed.before||next.files[file]!==allowed.after):hash!==next.files[file])throw Error(`Amendment hash mismatch: ${file}`);
   }
   console.log(`Verified explicit owner exception: ${approval.id}`);
  }
 }
}
console.log(`PASS: ${releases.length} immutable releases`);
