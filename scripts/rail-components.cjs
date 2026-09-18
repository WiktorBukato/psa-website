// Build-time SVG, sharing the existing icon source. No image or runtime requests.
const scene = require('../src/rail-scene.json');
const icons = require('../src/icons.json');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function svgNode([tag, attrs, children=[]]) {
  return `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}>${children.map(svgNode).join('')}</${tag}>`;
}
function animatedIcon(type) {
  const names={signal:'rail-signal',code:'code-xml',cpu:'cpu',gear:'settings',database:'database',checks:'rail-verification'};
  if(!names[type])throw Error(`Unknown motion icon ${type}`);
  const [tag,attrs,children]=structuredClone(icons[names[type]]);
  if(type==='signal')children[1][1].class='signal-lamp';
  if(type==='code')children.push(['path',{d:'M17 21h4',class:'code-cursor'}]);
  if(type==='cpu'){
    children[1][1].class='cpu-core';
    children.slice(2).forEach((part,i)=>{part[1].class='cpu-pin';part[1].style=`--pin:${i}`;});
  }
  if(type==='database')children[2][1].class='database-ring';
  if(type==='checks')children.splice(1,1,
    ['path',{d:'m8 11 2 2 4-5',class:'check-mark check-one',pathLength:1}],
    ['path',{d:'m8 21 2 2 4-5',class:'check-mark check-two',pathLength:1}],
    ['path',{d:'M18 12h6M18 22h6'}]);
  return svgNode([tag,{...attrs,'stroke-width':1.25,class:`motion-icon icon-${type}`,'aria-hidden':'true',focusable:'false'},children]);
}
function railwayTrack(){
  const ties=Array.from({length:43},(_,i)=>{const x=Math.pow(i/42,1.16)*1010-10;const depth=26+x*.014;return `<path d="M${x.toFixed(1)} 2l${(10+x*.01).toFixed(1)} ${depth.toFixed(1)}"/>`;}).join('');
  return `<svg class="ecosystem-track" viewBox="0 0 1000 48" preserveAspectRatio="none" aria-hidden="true"><path class="track-bed" d="M0 3H1000V46L0 29Z"/><g class="track-sleepers">${ties}</g><path class="track-steel" d="M0 9H1000M0 23L1000 39"/><path class="track-glint" d="M0 7H1000M0 21L1000 37"/></svg>`;
}
function heroScene(){
  const objects=scene.objects.map(o=>`<g class="scene-object" data-asset="${o.id}" data-point="${o.point.join(',')}"><path class="scene-outline" d="${o.path}"/><path class="scene-hit ${o.strokeOnly?'scene-hit-line':''}" d="${o.path}"/></g>`).join('');
  const lights=scene.lights.map(([cx,cy,r])=>`<circle class="scene-light" cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
  const options=scene.objects.map(o=>`<option value="${o.id}">${o.id} · ${o.name}</option>`).join('');
  const cards=scene.objects.map(o=>`<div class="scene-card-content" data-asset-card="${o.id}" hidden><span class="scene-asset-id">${o.id}</span><h3>${escape(o.name)}</h3><dl><div><dt>Domain</dt><dd>${escape(o.group)}</dd></div><div><dt>Function</dt><dd>${escape(o.detail)}</dd></div></dl></div>`).join('');
  return `<div class="rail-scene" hidden><div class="scene-image-plane"><svg class="scene-svg" viewBox="0 0 ${scene.width} ${scene.height}" aria-hidden="true"><g class="scene-lights">${lights}</g><g class="scene-aircraft"><circle class="aircraft-light" cx="0" cy="0" r="1.2"/></g>${objects}</svg></div><div class="scene-scanlines" aria-hidden="true"></div></div><div class="scene-controls" hidden><button type="button" class="scene-inspect-toggle" aria-expanded="false" aria-controls="scene-inspector">Explore scene <span aria-hidden="true">+</span></button><button type="button" class="scene-motion-toggle" aria-pressed="false" aria-label="Pause scene motion"><span class="motion-state" aria-hidden="true">Ⅱ</span><span class="motion-label">Pause motion</span></button></div><div class="scene-inspector" id="scene-inspector" hidden><label for="scene-asset">Explore the infrastructure</label><select id="scene-asset"><option value="">Choose an object…</option>${options}</select><p>Hover over an object, or select it here.</p></div><aside class="scene-card" hidden aria-label="Illustrated railway asset"><button class="scene-card-close" type="button" aria-label="Close asset details">×</button>${cards}<p class="scene-disclaimer">${escape(scene.disclaimer)}</p></aside>`;
}
module.exports={expand:html=>html.replaceAll('{{rail-scene}}',heroScene()).replaceAll('{{rail-track}}',railwayTrack()).replace(/\{\{rail-icon:([^}]+)\}\}/g,(_,type)=>animatedIcon(type))};
