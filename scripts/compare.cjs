// Human-reviewed visual regression evidence, never automatic approval.
const fs=require('node:fs');
const path=require('node:path');
const {dependency}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const sharp=dependency('sharp');
const [oldVersion,newVersion,oldEvidence]=process.argv.slice(2);
if(!oldVersion||!newVersion)throw Error('Usage: node scripts/compare.cjs v0.1 v0.2');
const oldDir=oldEvidence||path.join('evidence',oldVersion,'local'),newDir=path.join('evidence',newVersion,'local');
const output=path.join('evidence',newVersion,`compare-${oldVersion}`);fs.mkdirSync(output,{recursive:true});
(async()=>{
 const report={oldVersion,newVersion,oldEvidenceDirectory:oldDir,newManifestSha256:sha(path.join('.staging',newVersion,'manifest.json')),comparisons:[],note:'Pixel differences require human review. Different screenshot heights are structural changes, never an automatic pass.'};
 const names=fs.readdirSync(oldDir).filter(n=>n.endsWith('.png'));
 for(const file of names){
  const old=path.join(oldDir,file),next=path.join(newDir,file);
  if(!fs.existsSync(next))throw Error(`Missing new screenshot: ${next}`);
  const a=await sharp(old).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(next).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width=Math.max(a.info.width,b.info.width),height=Math.max(a.info.height,b.info.height);
  const left=await sharp(old).extend({right:width-a.info.width,bottom:height-a.info.height,background:'#f1d7d7'}).png().toBuffer();
  const right=await sharp(next).extend({right:width-b.info.width,bottom:height-b.info.height,background:'#f1d7d7'}).png().toBuffer();
  await sharp({create:{width:width*2,height,channels:4,background:'#fff'}}).composite([{input:left,left:0,top:0},{input:right,left:width,top:0}]).png().toFile(path.join(output,file));
  let changed=null;
  if(a.info.width===b.info.width&&a.info.height===b.info.height){
   let pixels=0;for(let i=0;i<a.data.length;i+=4)if(Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]))>12)pixels++;
   changed=+(pixels/(width*height)*100).toFixed(3);
  }
  report.comparisons.push({file,oldSize:[a.info.width,a.info.height],newSize:[b.info.width,b.info.height],changedPercent:changed,identical:sha(old)===sha(next)});
 }
 const target=path.join(output,'comparison.json');fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(target);
})();
