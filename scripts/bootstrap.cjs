// One-time import of the supplied prototype. Never required to rebuild the site.
const fs = require('node:fs');
const html = fs.readFileSync('reference/eiot/index.html', 'utf8');
let body = html.slice(html.indexOf('<div class="proof">'), html.indexOf('<section class="final-cta"'));
body = body.replaceAll('href="#railway"', 'href="../rail/index.html"')
  .replaceAll('href="https://www.psa.inc/railway/"', 'href="../rail/index.html"')
  .replaceAll('href="https://www.psa.inc/enterprise-iot/"', 'href="#expertise"')
  .replaceAll('href="https://www.psa.inc/contacts/"', 'href="#contact"');
fs.writeFileSync('src/pages/eiot-sections.html', body);
const lucide = require('../reference/eiot/assets/lucide.min.js');
const names = new Set([...html.matchAll(/data-lucide="([^"]+)"/g)].map(m => m[1]));
['signal','database','circle-check','code-2','train-front','building-2','monitor','map-pin','arrow-up-right','arrow-right','arrow-up','chevron-down','mail','phone','copy','x','menu','radio-tower','traffic-cone','network','shield-check','calendar-days','globe-2','route','scan-line','circle-dot','gauge','hard-drive','check','file-check-2','git-merge','layers','wifi','lightbulb','rail-symbol','server'].forEach(n => names.add(n));
const icons = {};
for (const name of names) {
  const key = name.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('');
  if(lucide.icons[key]) icons[name] = lucide.icons[key];
}
fs.writeFileSync('src/icons.json', JSON.stringify(icons));
