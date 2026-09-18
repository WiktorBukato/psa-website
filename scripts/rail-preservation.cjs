const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {dependency,chromeExecutable}=require('./tooling.cjs');
const {sha}=require('./releases.cjs');
const version=process.argv[2]||require('../src/site.json').releaseVersion;
const previous=process.argv[3]||'v0.2';
const output=path.join('evidence',version,'preservation');fs.mkdirSync(output,{recursive:true});
const sections=['.rail-proof','.rail-capabilities','.rail-experience','.rail-work','.rail-solution','.rail-standards','.rail-contact'];
const sharp=dependency('sharp');
(async()=>{
 const browser=await dependency('playwright').chromium.launch({executablePath:chromeExecutable});
 const results=[];
 for(const width of [1440,390]){
  const images={},iconBounds={};
  for(const [label,dir]of [['old',`docs/${previous}`],['new',`.staging/${version}`]]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.goto(pathToFileURL(path.resolve(dir,'rail/index.html')).href);
   await page.evaluate(async()=>{for(const image of document.images){image.loading='eager';}await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
   for(const section of sections){
    await page.evaluate(selected=>{for(const node of document.querySelector('#main').children)node.style.display=node.matches(selected)?'':'none';},section);
    const file=path.join(output,`${section.slice(1)}-${width}-${label}.png`);
    await page.locator(section).screenshot({path:file});(images[section]??=[]).push(file);
    if(previous==='v0.2'&&section==='.rail-capabilities'&&label==='new'){
      const box=await page.locator(section).boundingBox(),icon=await page.locator('.icon-checks').boundingBox();
      iconBounds[section]={left:icon.x-box.x,top:icon.y-box.y,right:icon.x-box.x+icon.width,bottom:icon.y-box.y+icon.height};
    }
   }
   await page.close();
  }
  for(const [section,files]of Object.entries(images)){
   const [a,b]=await Promise.all(files.map(f=>sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
   const sameSize=a.info.width===b.info.width&&a.info.height===b.info.height;let changed=0,changedOutsideIcon=0;
   if(sameSize)for(let i=0;i<a.data.length;i+=4)if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>12)){
     changed++;const x=(i/4)%a.info.width,y=Math.floor(i/4/a.info.width),r=iconBounds[section];
     if(!r||x<r.left||x>r.right||y<r.top||y>r.bottom)changedOutsideIcon++;
   }
   results.push({width,section,sameSize,changedPixels:sameSize?changed:null,changedOutsideIcon,normalization:iconBounds[section]?'Only the two separately animated check strokes are allowed to rasterize differently within their existing icon bounds; manually reviewed.':null});
  }
 }
 // Replace the longer token first: v0.4 is also a prefix of v0.4.1.
 const normalize=s=>[previous,version].sort((a,b)=>b.length-a.length).reduce((text,token)=>text.replaceAll(token,'VERSION'),s);
 for(const file of ['eiot/index.html','index.html','assets/eiot.css','assets/site.css','assets/app.js'])results.push({file,identical:normalize(fs.readFileSync(`docs/${previous}/${file}`,'utf8'))===normalize(fs.readFileSync(`.staging/${version}/${file}`,'utf8'))});
 const preview=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await preview.goto(pathToFileURL(path.resolve('.staging',version,'rail/index.html')).href);
 await preview.evaluate(()=>document.querySelectorAll('.scene-object').forEach(e=>e.classList.add('is-selected')));
 await preview.locator('.rail-hero').screenshot({path:path.join(output,'all-object-contours-1920.png')});
 await browser.close();
 const passed=results.every(r=>r.identical===true||(r.sameSize&&r.changedOutsideIcon===0));
 fs.writeFileSync(path.join(output,'qa.json'),JSON.stringify({version,previous,manifestSha256:sha(`.staging/${version}/manifest.json`),passed,results},null,2));
 console.log(JSON.stringify({passed,results},null,2));if(!passed)process.exitCode=1;
})();
