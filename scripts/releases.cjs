const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
function verifyRelease(dir,manifestHash){
  const manifestPath=path.join(dir,'manifest.json');
  if(manifestHash&&sha(manifestPath)!==manifestHash)throw Error(`Release manifest was changed: ${dir}`);
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const actual=files(dir).map(f=>path.relative(dir,f).replaceAll('\\','/')).filter(f=>f!=='manifest.json').sort();
  if(JSON.stringify(actual)!==JSON.stringify(Object.keys(manifest.files).sort()))throw Error(`File set changed in ${dir}`);
  for(const [file,hash]of Object.entries(manifest.files))if(sha(path.join(dir,file))!==hash)throw Error(`Immutable release modified: ${dir}/${file}`);
  return manifest;
}
module.exports={sha,files,verifyRelease};
