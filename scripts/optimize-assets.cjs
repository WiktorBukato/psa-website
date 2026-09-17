// Development-only conversion. Original supplied files remain in reference/.
const fs = require('node:fs');
const {dependency}=require('./tooling.cjs');
const sharp=dependency('sharp');
(async()=>{
  const jobs=[['fuel.png',1200],['coffee.png',1200],['rail.png',900]];
  for(const [file,width] of jobs) {
    await sharp(`reference/eiot/assets/${file}`).resize({width,withoutEnlargement:true}).webp({quality:90}).toFile(`src/assets/${file.replace(/\.png$/,'.webp')}`);
  }
  if(fs.existsSync('src/assets/rail-hero-original.png')) {
    for(const width of [1983,960]) await sharp('src/assets/rail-hero-original.png').resize({width,withoutEnlargement:true}).webp({quality:90}).toFile(`src/assets/rail-hero-${width}.webp`);
  }
  let source=fs.readFileSync('src/pages/eiot-sections.html','utf8');
  for(const [file] of jobs) source=source.replaceAll(file,file.replace(/\.png$/,'.webp'));
  fs.writeFileSync('src/pages/eiot-sections.html',source);
  for(const file of fs.readdirSync('src/assets')) {
    if(/\.(png|jpg|webp)$/.test(file)) {
      const m=await sharp(`src/assets/${file}`).metadata();
      console.log(`${file}: ${m.width}×${m.height}, ${Math.round(fs.statSync(`src/assets/${file}`).size/1024)} KB`);
    }
  }
})();
