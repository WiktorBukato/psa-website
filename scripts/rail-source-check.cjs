// Read-only GET audit. Never submit contact forms or email requests.
const fs=require('node:fs'),path=require('node:path');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const records=require('../src/content/rail-cases.public.json').cases;
const links=require('../src/content/rail-links.json');
const out=path.join('evidence',version,'sources');fs.mkdirSync(out,{recursive:true});
const urls=[...new Set([...records.map(c=>c.url),...Object.values(links).filter(u=>u.startsWith('https:'))])];
const plain=s=>s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
(async()=>{
 const results=[];
 for(let start=0;start<urls.length;start+=4){
  results.push(...await Promise.all(urls.slice(start,start+4).map(async url=>{
   try{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'PSA website link review'}});
    const type=response.headers.get('content-type')||'',bytes=Buffer.from(await response.arrayBuffer());
    if(type.includes('pdf')&&response.ok)fs.writeFileSync(path.join(out,'published-certificate.pdf'),bytes);
    const html=type.includes('html')?bytes.toString():'';
    const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
    const headings=[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>plain(m[1]));
    const caseRecord=records.find(c=>c.url===url);
    const semantic=caseRecord?headings.some(h=>h.toLowerCase()===caseRecord.sourceTitle.toLowerCase()):url===links.freightDispatching?headings.some(h=>/rail.*dispatch|heavy.*rail/i.test(h)):true;
    return {url,status:response.status,finalUrl:response.url,title,headings,contentType:type,semanticMatch:semantic,state:response.ok&&semantic?'verified':response.status===403||response.status===429?'manual check required':'review required',imageSources:caseRecord?[...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m=>m[1]).slice(0,24):undefined};
   }catch(error){return {url,state:'manual check required',error:error.message};}
  })));
 }
 fs.writeFileSync(path.join(out,'link-audit.json'),JSON.stringify({checkedAt:new Date().toISOString(),method:'GET; exact h1 matching for case destinations; no submissions',results},null,2));
 console.log(JSON.stringify(results.map(({imageSources,...r})=>r),null,2));
})();
