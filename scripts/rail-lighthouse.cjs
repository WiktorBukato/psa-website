// Temporary loopback server for lab audits only. file:// viewing remains independent.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const {chromeExecutable}=require('./tooling.cjs');
const version=process.argv[2]||'v0.10',cli=process.argv[3];if(!cli||!fs.existsSync(cli))throw Error('Pass the existing centralized Lighthouse CLI path');
const root=path.resolve('.staging',version),out=path.resolve('evidence',version,'lighthouse');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);});
const run=args=>new Promise(resolve=>{let output='';const process=spawn(global.process.execPath,[cli,...args],{stdio:['ignore','pipe','pipe']});process.stdout.on('data',data=>{output+=data;});process.stderr.on('data',data=>{output+=data;});process.on('close',exitCode=>resolve({exitCode,output:output.slice(-1500)}));});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/rail/index.html`;const results=[];try{
 for(const mode of ['mobile','desktop']){
  const outputPath=path.join(out,mode),result=await run([url,'--quiet','--output=json','--output=html',`--output-path=${outputPath}`,`--chrome-path=${chromeExecutable}`,'--chrome-flags=--headless --no-first-run','--only-categories=performance,accessibility,best-practices,seo',...(mode==='desktop'?['--preset=desktop']:[])]);
  const file=outputPath+'.report.json',report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  results.push({mode,...result,runtimeError:report?.runtimeError||null,scores:report?Object.fromEntries(Object.entries(report.categories).map(([id,c])=>[id,c.score])):null,metrics:report?Object.fromEntries(['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time'].map(id=>[id,report.audits[id]?.numericValue])):null});
  console.log(JSON.stringify(results.at(-1)));
 }
}finally{server.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({kind:'Local laboratory audit; no field CWV measurement',results},null,2));}})();
