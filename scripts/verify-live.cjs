const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const site=require('../src/site.json');
const {verifyRelease}=require('./releases.cjs');
const version=process.argv[2]||'v0.1';
const release=JSON.parse(fs.readFileSync('docs/releases.json','utf8')).find(r=>r.version===version);
if(!release)throw Error('Unknown release');
const manifest=verifyRelease(path.join('docs',version),release.manifestSha256);
(async()=>{
 const results=[];const files=[...Object.entries(manifest.files),['manifest.json',release.manifestSha256]];
 for(let start=0;start<files.length;start+=5){
  const batch=await Promise.allSettled(files.slice(start,start+5).map(async([file,hash])=>{
   const url=`${site.baseUrl}/${version}/${file}`;
   const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
   const actual=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
   return {file,status:response.status,matched:response.ok&&actual===hash};
  }));
  for(const result of batch)results.push(result.status==='fulfilled'?result.value:{matched:false,error:String(result.reason)});
 }
 const passed=results.every(r=>r.matched),dir=path.join('evidence',version,'live');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'hash-verification.json'),JSON.stringify({version,checkedAt:new Date().toISOString(),passed,results},null,2));
 console.log(`${passed?'PASS':'FAIL'}: ${results.filter(r=>r.matched).length}/${results.length} public files match SHA-256`);
 if(!passed){console.log(results.filter(r=>!r.matched));process.exitCode=1;}
})();
