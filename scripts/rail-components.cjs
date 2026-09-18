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
function railwayTrack(compact=false){
  // Parallel rail heads. Only the sleepers converge toward a centred vanishing
  // point above the track; endpoint inset keeps every sleeper within the rails.
  const width=compact?200:1000,height=32,center=width/2,inset=14;
  const count=compact?11:43,vanishingDistance=compact?100:540;
  const ties=Array.from({length:count},(_,i)=>{
    const x=inset+i*(width-inset*2)/(count-1);
    const lean=(x-center)*(height/2-2)/vanishingDistance;
    return `<path d="M${(x-lean).toFixed(2)} 2L${(x+lean).toFixed(2)} 30"/>`;
  }).join('');
  return `<svg class="${compact?'ecosystem-mini-track':'ecosystem-track'}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path class="track-bed" d="M0 8H${width}V22H0Z"/><g class="track-sleepers">${ties}</g><path class="track-steel" d="M0 10H${width}M0 22H${width}"/><path class="track-glint" d="M0 9H${width}M0 21H${width}"/></svg>`;
}
function heroScene(){
  const objects=scene.objects.map(o=>`<g class="scene-object" data-asset="${o.id}" data-point="${o.point.join(',')}" tabindex="-1" role="button" aria-label="${escape(o.id+' · '+o.name)}"><path class="scene-outline" d="${o.path}"/>${o.details?`<path class="scene-detail" d="${o.details}"/>`:''}<path class="scene-tracer" pathLength="100" d="${o.path}"/><path class="scene-hit ${o.strokeOnly?'scene-hit-line':''}" d="${o.path}"/></g>`).join('');
  const lights=scene.lights.map(([cx,cy,radius,group])=>{
    const depth=scene.lightDepth;
    const distance=depth.distantGroups.includes(group)?0:Math.max(0,Math.min(1,(cy-depth.farY)/(depth.nearY-depth.farY)));
    const r=+(radius*(depth.distantScale+(depth.nearScale-depth.distantScale)*distance)).toFixed(3);
    return `<g class="scene-light" data-energy="${scene.lightGroups[group].energy}" style="--light-energy:${scene.lightGroups[group].energy}"><circle class="scene-light-halo" cx="${cx}" cy="${cy}" r="${r*3.6}"/><circle class="scene-light-core" cx="${cx}" cy="${cy}" r="${r}"/></g>`;}).join('');
  const signals=`<defs><radialGradient id="signal-glow-cover"><stop offset="0" stop-color="#031515" stop-opacity=".97"/><stop offset=".5" stop-color="#031515" stop-opacity=".92"/><stop offset="1" stop-color="#031515" stop-opacity="0"/></radialGradient></defs>`+scene.signals.map(s=>`<g class="scene-signal" data-signal="${s.id}" data-phase="${s.phase}">${s.originals.map(([cx,cy,r])=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#signal-glow-cover)"/>`).join('')}<path d="${s.head}" fill="#041717" fill-opacity=".94"/>${['red','green'].map(color=>{const [cx,cy,r]=s[color];return `<g class="signal-lamp-${color}"><circle class="signal-halo" cx="${cx}" cy="${cy}" r="${r*2.2}"/><circle cx="${cx}" cy="${cy}" r="${r}"/></g>`;}).join('')}</g>`).join('');
  const cards=scene.objects.map(o=>`<div class="scene-card-content" data-asset-card="${o.id}" hidden><span class="scene-asset-id">${o.id}</span><h3>${escape(o.name)}</h3><dl><div><dt>Domain</dt><dd>${escape(o.group)}</dd></div><div><dt>Function</dt><dd>${escape(o.detail)}</dd></div></dl></div>`).join('');
  return `<div class="rail-scene" hidden><div class="scene-image-plane"><svg class="scene-svg" viewBox="0 0 ${scene.width} ${scene.height}" role="group" aria-label="Railway assets. Use arrow keys to explore and Escape to dismiss details."><g class="scene-lights" aria-hidden="true">${lights}</g>${signals}<g class="scene-aircraft"><circle class="aircraft-light" cx="0" cy="0" r="${scene.motion.planeRadius}" style="--aircraft-brightness:${scene.motion.planeBrightness}"/></g>${objects}</svg></div><div class="scene-scanlines" aria-hidden="true"></div><div class="scene-scanband" aria-hidden="true"></div></div><aside class="scene-card" hidden aria-label="Illustrated railway asset">${cards}</aside>`;
}
module.exports={expand:html=>html.replaceAll('{{rail-scene}}',heroScene()+`<script type="application/json" id="rail-motion-config">${JSON.stringify(scene.motion)}</script>`).replaceAll('{{rail-track}}',railwayTrack()).replaceAll('{{rail-mini-track}}',railwayTrack(true)).replace(/\{\{rail-icon:([^}]+)\}\}/g,(_,type)=>animatedIcon(type))};
