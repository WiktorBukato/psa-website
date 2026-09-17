const fs=require('node:fs');
const path=require('node:path');
const version=process.argv[2]||'v0.1';
const urls=new Set();for(const route of ['eiot','rail'])for(const match of fs.readFileSync(path.join('.staging',version,route,'index.html'),'utf8').matchAll(/href="(https:[^"]+)"/g))urls.add(match[1]);
(async()=>{const entries=[...urls],results=[];for(let i=0;i<entries.length;i+=5){
 const batch=await Promise.allSettled(entries.slice(i,i+5).map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});await r.arrayBuffer();return {url,finalUrl:r.url,status:r.status,ok:r.ok};}));
 batch.forEach((r,j)=>results.push(r.status==='fulfilled'?r.value:{url:entries[i+j],ok:false,error:String(r.reason)}));
}fs.mkdirSync('reports',{recursive:true});fs.writeFileSync(`reports/${version}-external-links.json`,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));console.log(JSON.stringify(results,null,2));})();
