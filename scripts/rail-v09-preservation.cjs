const fs=require('node:fs'),path=require('node:path');
const {sha,verifyRelease}=require('./releases.cjs');
const version=process.argv[2]||'v0.9',previous='v0.8',old=`docs/${previous}`,next=`.staging/${version}`;
const out=path.join('evidence',version,'preservation-v09');fs.mkdirSync(out,{recursive:true});
const checks=[];function check(value,name){checks.push({name,passed:!!value});}
for(const release of JSON.parse(fs.readFileSync('docs/releases.json','utf8'))){verifyRelease(path.join('docs',release.version),release.manifestSha256);check(true,`Published ${release.version} remains byte-identical`);}
const norm=s=>s.replaceAll(/v0\.\d+(?:\.\d+)?/g,'VERSION');
for(const file of ['eiot/index.html','index.html','assets/eiot.css','assets/site.css','assets/app.js','assets/rail.js']){
 const a=fs.readFileSync(path.join(old,file),'utf8'),b=fs.readFileSync(path.join(next,file),'utf8');
 check(norm(a)===norm(b),`${file}: unchanged aside from version label`);
}
for(const file of fs.readdirSync(path.join(old,'assets')).filter(file=>file!=='rail.css'))check(sha(path.join(old,'assets',file))===sha(path.join(next,'assets',file)),`Existing asset unchanged: ${file}`);
const a=fs.readFileSync(path.join(old,'rail/index.html'),'utf8'),b=fs.readFileSync(path.join(next,'rail/index.html'),'utf8');
for(const text of ['Mainline Signaling Upgrade','Urban Station Systems Integration','Level Crossing Safety Upgrade','TraxSentinel — Level Crossing Monitoring','Engineering Expertise Across the Rail Environment'])check(a.includes(text)&&b.includes(text),`Rail section copy retained: ${text}`);
for(const destination of ['https://www.psa.inc/enterprise-iot/level-crossing-monitoring-solution/','https://www.psa.inc/railway/industry-experience/'])check(a.includes(destination)&&b.includes(destination),`Rail destination retained: ${destination}`);
const report={version,previous,manifestSha256:sha(path.join(next,'manifest.json')),checks,passed:checks.every(c=>c.passed)};
fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
