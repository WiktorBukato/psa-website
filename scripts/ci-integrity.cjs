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
  if(!current||current.manifestSha256!==release.manifestSha256)throw Error(`Release registry changed: ${release.version}`);
  const changed=execFileSync('git',['diff','--name-only',base,'HEAD','--',`docs/${release.version}`],{encoding:'utf8'}).trim();
  if(changed)throw Error(`Published version was modified: ${changed}`);
 }
}
console.log(`PASS: ${releases.length} immutable releases`);
