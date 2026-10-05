(() => {
  'use strict';
  const main = document.querySelector('.theme-rail #main');
  const hero = main?.querySelector('.rail-hero');
  if (!hero) return;
  const scene = hero.querySelector('.rail-scene');
  const plane = scene.querySelector('.scene-image-plane');
  const svg = scene.querySelector('.scene-svg');
  const image = hero.querySelector('.rail-hero-picture img');
  const card = hero.querySelector('.scene-card');
  const objects = [...svg.querySelectorAll('.scene-object')];
  const lights = [...svg.querySelectorAll('.scene-light')];
  const aircraft = svg.querySelector('.scene-aircraft');
  const signals = [...svg.querySelectorAll('.scene-signal')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set(), lightTimers = new Set(), animations = new Set();
  const source = svg.viewBox.baseVal;
  const timing = JSON.parse(document.getElementById('rail-motion-config').textContent);
  let visible = false, running = false, pinned = false, active = null, hideTimer;
  let mapping = {x:0,y:0,scale:1}, cursor=null, cursorFrame=0;
  const random = (min,max) => min + Math.random()*(max-min);
  function later(fn,delay,collection=timers) {
    const id=setTimeout(()=>{collection.delete(id);fn();},delay);collection.add(id);return id;
  }
  function animate(node,frames,options) {
    const animation=node.animate(frames,options);animations.add(animation);
    animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
    return animation;
  }
  function shimmer(light,meanDelay) {
    // Independent memoryless waits avoid a shared startup window or repeating waves.
    const delay=timing.lightIdleFloor-Math.log(1-Math.random())*meanDelay;
    later(()=>{
      if(!running)return;
      const peak=random(timing.lightPeakMin,timing.lightPeakMax)*Number(light.dataset.energy);
      const pulse=animate(light,[{opacity:0},{opacity:peak,offset:random(timing.lightRiseMin,timing.lightRiseMax)},{opacity:0}],{duration:random(timing.lightDurationMin,timing.lightDurationMax),easing:'ease-in-out'});
      // Schedule only after completion: one pulse per light, including after pause/debug.
      pulse.finished.then(()=>{if(running)shimmer(light,meanDelay);},()=>{});
    },delay,lightTimers);
  }
  function stopLights() {
    for(const timer of lightTimers)clearTimeout(timer);lightTimers.clear();
    for(const animation of animations)if(animation.effect.target.matches('.scene-light,.signal-lamp-red,.signal-lamp-green')){animation.cancel();animations.delete(animation);}
  }
  function startLights() {
    lights.forEach(light=>shimmer(light,timing.lightIdleMean*random(timing.lightRateMin,timing.lightRateMax)));
    for(const signal of signals){
      const options={duration:timing.signalDuration,iterations:Infinity,delay:-Number(signal.dataset.phase)};
      const startTime=document.timeline.currentTime;
      // Complementary steps share the same clock: no overlap and no dark interval.
      for(const [color,on]of [['red',1],['green',0]]){
        const animation=animate(signal.querySelector(`.signal-lamp-${color}`),[{opacity:on,offset:0,easing:'steps(1,end)'},{opacity:1-on,offset:timing.signalSwitchAt,easing:'steps(1,end)'},{opacity:on,offset:1}],options);
        animation.startTime=startTime;
      }
    }
  }
  function fly(first=false) {
    later(()=>{
      if(!running)return;
      // Recompute within the visible sky, including wide-screen object-fit crops.
      const rect=hero.getBoundingClientRect(),left=-mapping.x/mapping.scale;
      const visibleWidth=rect.width/mapping.scale,top=-mapping.y/mapping.scale;
      const start=left+visibleWidth*(rect.width<=760?.13:.57),end=left+visibleWidth*.96;
      const y=Math.min(timing.skyBottom,Math.max(timing.skyTop,top+timing.skyInset/mapping.scale));
      const frames=[0,.06,.94,1].map(offset=>({offset,transform:`translate(${start+(end-start)*offset}px, ${y+12*offset}px)`,opacity:offset===0||offset===1?0:1}));
      animate(aircraft,frames,{duration:timing.planeDuration,easing:'linear'});
      later(()=>fly(),timing.planeDuration);
    },first?random(timing.planeFirstMin,timing.planeFirstMax):random(timing.planeMin,timing.planeMax));
  }
  function updateMotion(restart=false) {
    const next=visible&&!document.hidden&&!reduced.matches;
    main.classList.toggle('rail-motion-paused',reduced.matches);
    hero.classList.toggle('ambient-running',next);
    hero.dataset.ambientState=next?'running':'paused';
    if(next===running&&!restart)return;
    running=next;
    stopLights();
    for(const timer of timers)clearTimeout(timer);timers.clear();
    for(const animation of animations)animation.cancel();animations.clear();
    if(running){startLights();fly(true);}
  }
  function registerImage() {
    const rect=hero.getBoundingClientRect();
    const position=getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
    const scale=Math.max(rect.width/source.width,rect.height/source.height);
    const width=source.width*scale,height=source.height*scale;
    mapping={x:(rect.width-width)*position[0]/100,y:(rect.height-height)*position[1]/100,scale};
    Object.assign(plane.style,{width:`${width}px`,height:`${height}px`,left:`${mapping.x}px`,top:`${mapping.y}px`});
    if(active)positionCard(active,pinned?null:cursor);
    if(running)updateMotion(true);
  }
  function positionCard(object,event) {
    const bounds=hero.getBoundingClientRect(),size=card.getBoundingClientRect();
    const [x,y]=object.dataset.point.split(',').map(Number);
    let left=event?event.clientX-bounds.left+20:mapping.x+x*mapping.scale+20;
    let top=event?event.clientY-bounds.top+18:mapping.y+y*mapping.scale-size.height-18;
    if(left+size.width>bounds.width-16)left-=size.width+40;
    left=Math.max(16,Math.min(left,bounds.width-size.width-16));
    top=Math.max(16,Math.min(top,bounds.height-size.height-16));
    card.style.left=`${left}px`;card.style.top=`${top}px`;
  }
  function show(object,event,lock=false) {
    if(pinned&&!lock)return;
    clearTimeout(hideTimer);active=object;pinned=lock;
    objects.forEach(o=>o.classList.toggle('is-selected',o===object));
    card.querySelectorAll('[data-asset-card]').forEach(content=>{content.hidden=content.dataset.assetCard!==object.dataset.asset;});
    card.hidden=false;positionCard(object,event);
  }
  function hide() {
    clearTimeout(hideTimer);pinned=false;active=null;cursor=null;card.hidden=true;
    objects.forEach(o=>o.classList.remove('is-selected'));
  }
  svg.addEventListener('pointerover',event=>{
    const object=event.target.closest('.scene-object');
    if(object&&event.pointerType!=='touch')show(object,event);
  });
  svg.addEventListener('pointerout',event=>{
    if(pinned)return;
    const from=event.target.closest('.scene-object'),to=event.relatedTarget?.closest?.('.scene-object');
    if(from&&from!==to)hideTimer=setTimeout(hide,180);
  });
  hero.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||pinned)return;
    cursor={clientX:event.clientX,clientY:event.clientY};
    if(!cursorFrame)cursorFrame=requestAnimationFrame(()=>{cursorFrame=0;if(active&&!pinned&&cursor)positionCard(active,cursor);});
  });
  svg.addEventListener('click',event=>{
    const object=event.target.closest('.scene-object');
    if(object){if(event.pointerType==='touch'&&active===object&&pinned)hide();else show(object,event,event.pointerType==='touch');}
  });
  hero.addEventListener('pointerleave',()=>{if(!pinned)hide();});
  hero.addEventListener('pointerdown',event=>{if(!event.target.closest('.scene-object'))hide();});
  // Roving focus retains keyboard access without adding visible scene controls.
  objects[0].tabIndex=0;
  svg.addEventListener('focusin',event=>{
    const object=event.target.closest('.scene-object');
    if(object){objects.forEach(o=>o.tabIndex=o===object?0:-1);if(object.matches(':focus-visible'))show(object,null,true);}
  });
  svg.addEventListener('focusout',event=>{if(!svg.contains(event.relatedTarget))hide();});
  svg.addEventListener('keydown',event=>{
    const object=event.target.closest('.scene-object');if(!object)return;
    const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
    if(direction){event.preventDefault();objects[(objects.indexOf(object)+direction+objects.length)%objects.length].focus({preventScroll:true});}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();if(active===object)hide();else show(object,null,true);}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('pointerdown',event=>{if(!hero.contains(event.target))hide();});
  reduced.addEventListener('change',()=>updateMotion());
  document.addEventListener('visibilitychange',()=>updateMotion());
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)hide();updateMotion();},{threshold:0}).observe(hero);
  new ResizeObserver(registerImage).observe(hero);
  image.addEventListener('load',registerImage);
  scene.hidden=false;registerImage();updateMotion();
})();

// Ecosystem geometry is independent of the hero and is updated at most once per frame.
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const numberPattern=/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
  const tracks=[...document.querySelectorAll('[data-scroll-track]')].map(element=>({element,parts:[...element.querySelectorAll('[data-track-near]')].map(path=>({path,template:path.dataset.trackNear,near:path.dataset.trackNear.match(numberPattern).map(Number),far:path.dataset.trackFar.match(numberPattern).map(Number)}))}));
  if(!tracks.length)return;
  let frame=0;
  function render(){
    frame=0;
    for(const track of tracks){
      const box=track.element.getBoundingClientRect();
      if(!box.width||!box.height)continue;
      const position=Math.max(0,Math.min(1,1-(box.top+box.height/2)/innerHeight));
      const progress=reduced.matches?.5:position*position*(3-2*position);
      if(track.progress===progress)continue;
      track.progress=progress;
      for(const part of track.parts){let index=0;part.path.setAttribute('d',part.template.replace(numberPattern,()=>{const i=index++;return (part.near[i]+(part.far[i]-part.near[i])*progress).toFixed(3);}));}
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(render);}
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  reduced.addEventListener('change',schedule);
  const observer=new ResizeObserver(schedule);tracks.forEach(track=>observer.observe(track.element));
  render();
})();

// Rail content enhancements. All substantive copy and links already exist in HTML.
(() => {
  'use strict';
  const main=document.querySelector('.theme-rail #main');
  if(!main)return;
  const details=[...main.querySelectorAll('.capability-detail')];
  const cards=[...main.querySelectorAll('[data-capability]')];
  const group=main.querySelector('.capability-details');
  let opener=null;
  const aliases=new Map([...main.querySelectorAll('[data-alias-for]')].map(e=>[e.id,e.dataset.aliasFor]));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const more=main.querySelector('.more-cases');
  const moreSummary=more.querySelector('summary');
  function finishExpansion(){
    if(!more.open)return;
    if(document.activeElement===moreSummary)more.querySelector('h3').focus({preventScroll:true});
    moreSummary.hidden=true;
  }
  more.querySelector('h3').setAttribute('tabindex','-1');
  more.addEventListener('toggle',finishExpansion);
  function setHash(id){if(location.hash!==`#${id}`)history.pushState(null,'',`#${id}`);}
  function syncExpanded(){cards.forEach(card=>card.setAttribute('aria-expanded',String(document.getElementById(card.dataset.capability).open)));}
  function openCapability(id,{focus=false,scroll=false}={}){
    const selected=details.find(detail=>detail.id===(aliases.get(id)||id));
    if(!selected)return false;
    const displaced=details.some(detail=>detail!==selected&&detail.contains(document.activeElement));
    details.forEach(detail=>{detail.open=detail===selected;});
    syncExpanded();
    if(scroll)selected.scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});
    if(focus||displaced)selected.querySelector('.detail-body h3').focus({preventScroll:true});
    return true;
  }
  for(const card of cards){
    card.setAttribute('aria-controls',card.dataset.capability);card.setAttribute('aria-expanded','false');
    card.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();opener=card;setHash(card.dataset.capability);openCapability(card.dataset.capability,{focus:true,scroll:true});
    });
  }
  for(const detail of details){
    // Focus returns to a visible trigger before an enhanced closed panel is hidden.
    detail.querySelector('summary').addEventListener('click',event=>{
      if(!detail.open)return;
      event.preventDefault();detail.open=false;syncExpanded();
      (opener?.dataset.capability===detail.id?opener:cards.find(card=>card.dataset.capability===detail.id)).focus({preventScroll:true});
      history.replaceState(null,'','#expertise');
    });
    detail.addEventListener('toggle',syncExpanded);
  }
  group.classList.add('is-enhanced');
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const selected=details.find(detail=>detail.open);
    if(!selected||!selected.contains(document.activeElement))return;
    selected.open=false;syncExpanded();
    (opener?.dataset.capability===selected.id?opener:cards.find(card=>card.dataset.capability===selected.id)).focus({preventScroll:true});
    history.replaceState(null,'','#expertise');
  });

  const map=main.querySelector('[data-case-map]');
  const options=[...map.querySelectorAll('[data-map-case]')];
  const results=[...map.querySelectorAll('[data-map-result]')];
  const filters=[...map.querySelectorAll('[data-map-filter]')];
  const regions=[...map.querySelectorAll('[data-map-region]')];
  const mapSVG=map.querySelector('.world-map');
  let zoomFrame=0;
  function zoomMap(region,immediate=false){
    cancelAnimationFrame(zoomFrame);
    const target=region?region.dataset.mapViewport.split(' ').map(Number):[0,0,1000,500];
    const start=mapSVG.getAttribute('viewBox').split(' ').map(Number),began=performance.now();
    mapSVG.classList.toggle('is-zoomed',target[2]<1000);
    function tick(now){const p=immediate||reduced.matches?1:Math.min(1,(now-began)/420),ease=1-Math.pow(1-p,3);mapSVG.setAttribute('viewBox',start.map((v,i)=>v+(target[i]-v)*ease).join(' '));map.dispatchEvent(new Event('map-view-change'));if(p<1)zoomFrame=requestAnimationFrame(tick);else map.dispatchEvent(new Event('map-zoom-end'));}
    if(immediate)tick(began);else zoomFrame=requestAnimationFrame(tick);
  }
  map.addEventListener('map-zoom-request',event=>zoomMap({dataset:{mapViewport:(event.detail.viewport||event.detail).join(' ')}},!!event.detail.immediate));
  const status=map.querySelector('.map-status');
  let ready=false,filter='all',selected=options[0].dataset.mapCase;
  function selectCase(id,announce=true){
    const option=options.find(e=>e.dataset.mapCase===id);if(!option)return;
    selected=id;
    const region=option.dataset.region;
    options.forEach(e=>{e.setAttribute('aria-current',String(e===option));});
    results.forEach(e=>{e.hidden=e.dataset.mapResult!==id;});
    regions.forEach(e=>{const on=e.dataset.mapRegion===region;e.classList.toggle('is-selected',on);e.setAttribute('aria-pressed',String(on));});
    zoomMap(filter==='all'?null:regions.find(e=>e.dataset.mapRegion===region));
    if(announce)status.textContent=`${option.textContent}. ${region==='unknown'?'Location not published.':regions.find(e=>e.dataset.mapRegion===region)?.getAttribute('aria-label')||''}`;
  }
  function filterCases(value,announce=true){
    filter=value;
    filters.forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.mapFilter===value)));
    const visible=options.filter(e=>value==='all'||e.dataset.region===value);
    options.forEach(e=>{e.hidden=!visible.includes(e);});
    map.querySelector('.map-empty').hidden=visible.length>0;
    if(visible.length)selectCase(visible.some(e=>e.dataset.mapCase===selected)?selected:visible[0].dataset.mapCase,announce);
    else {results.forEach(e=>{e.hidden=true;});regions.forEach(e=>{e.classList.remove('is-selected');e.setAttribute('aria-pressed','false');});if(announce)status.textContent='No published example in this selection.';}
  }
  function initMap(){
    if(ready)return;ready=true;
    map.querySelector('.map-filters').hidden=false;
    map.classList.add('map-ready');
    const svg=map.querySelector('.world-map');svg.setAttribute('role','group');
    regions.forEach(region=>{
      region.setAttribute('role','button');region.setAttribute('tabindex','0');region.setAttribute('aria-label',region.dataset.mapRegion==='china'?'China — published country':'North America — published region');
      const choose=()=>filterCases(region.dataset.mapRegion);
      region.addEventListener('click',choose);region.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});
    });
    filters.forEach(button=>button.addEventListener('click',()=>filterCases(button.dataset.mapFilter)));
    options.forEach(option=>option.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();setHash(`case-${option.dataset.mapCase}`);selectCase(option.dataset.mapCase);
    }));
    map.querySelector('[data-map-reset]').addEventListener('click',()=>{filterCases('all');filters[0].focus({preventScroll:true});});
    filterCases('all',false);
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){initMap();observer.disconnect();}},{rootMargin:'300px'});observer.observe(map);
  function syncHash(initial=false){
    const id=decodeURIComponent(location.hash.slice(1));
    if(openCapability(id,{scroll:true}))return;
    if(id==='expertise'){
      const focused=details.find(detail=>detail.contains(document.activeElement));
      details.forEach(detail=>{detail.open=false;});syncExpanded();
      if(focused)cards.find(card=>card.dataset.capability===focused.id).focus({preventScroll:true});
    }
    if(id.startsWith('case-')){
      const caseId=id.slice(5),option=options.find(e=>e.dataset.mapCase===caseId);
      if(!option)return;
      initMap();filterCases('all',false);selectCase(caseId,false);
      const article=document.getElementById(id),more=article?.closest('.more-cases');if(more)more.open=true;
      if(initial)requestAnimationFrame(()=>article?.scrollIntoView({block:'start',behavior:'instant'}));
    }
  }
  addEventListener('hashchange',()=>syncHash());addEventListener('popstate',()=>syncHash());syncHash(true);

  // Text enlargement can require a compact header even above the normal breakpoint.
  const header=document.querySelector('.header'),container=header.querySelector('.header-inner'),nav=header.querySelector('.nav');
  const menu=header.querySelector('.menu-toggle');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  const normalBreakpoint=Number(document.body.dataset.railMenuBreakpoint);
  let frame=0;
  function layoutMenu(){
    frame=0;
    const links=[...nav.querySelectorAll('a')],navStyle=getComputedStyle(nav);
    const labelWidth=links.reduce((sum,link)=>{context.font=getComputedStyle(link).font;return sum+context.measureText(link.textContent).width;},0)+parseFloat(navStyle.columnGap||'22')*(links.length-1);
    const brand=header.querySelector('.brand').getBoundingClientRect().width,switchWidth=header.querySelector('.vertical-switch').getBoundingClientRect().width;
    const cta=header.querySelector('.header-cta'),ctaStyle=getComputedStyle(cta);context.font=ctaStyle.font;
    const ctaWidth=context.measureText(cta.textContent.trim()).width+parseFloat(ctaStyle.paddingLeft)+parseFloat(ctaStyle.paddingRight)+parseFloat(ctaStyle.columnGap)+18+2;
    const needed=labelWidth+brand+switchWidth+ctaWidth+3*parseFloat(getComputedStyle(container).columnGap);
    const compact=innerWidth<=normalBreakpoint||needed>container.clientWidth;
    const changed=document.body.classList.contains('rail-compact-nav')!==compact;
    document.body.classList.toggle('rail-compact-nav',compact);
    if(changed){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');nav.classList.remove('open');}
  }
  function scheduleMenu(){if(!frame)frame=requestAnimationFrame(layoutMenu);}
  new ResizeObserver(scheduleMenu).observe(container);addEventListener('resize',scheduleMenu);layoutMenu();
})();

// Offline SVG interaction: one nearest-point resolver serves mouse, touch and clicks.
(()=>{'use strict';
 const map=document.querySelector('[data-case-map]');if(!map)return;
 const svg=map.querySelector('.world-map'),points=[...map.querySelectorAll('[data-location]')],tooltip=map.querySelector('.map-location-tooltip'),surface=map.querySelector('.map-geography');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),limits={world:1000,min:.8,local:80,region:600,mouseHit:12,touchHit:22,radiusFraction:.12,cityRadiusKm:Number(map.querySelector('.map-rail-highlights').dataset.cityRadius),maximumRadiusKm:Number(map.querySelector('.map-rail-highlights').dataset.maximumRadius),cityViewport:Number(points[0].dataset.locationViewport.split(' ')[2]),wheelRate:.002,dragThreshold:4};let active=null,pending=null,visible=false,suppressClick=false;
 const screenPositions=new Map();let surfaceRect,tooltipSize;
 const view=()=>svg.getAttribute('viewBox').split(' ').map(Number);
 const coordinates=p=>p.getAttribute('transform').match(/[\d.-]+/g).map(Number);
 function screenPoint(p){return screenPositions.get(p);}
 const zoom=v=>map.dispatchEvent(new CustomEvent('map-zoom-request',{detail:v}));
 const setView=v=>map.dispatchEvent(new CustomEvent('map-zoom-request',{detail:{viewport:v,immediate:true}}));
 const bounded=([x,y,w])=>{w=Math.max(limits.min,Math.min(limits.world,w));return [Math.max(0,Math.min(1000-w,x)),Math.max(0,Math.min(500-w/2,y)),w,w/2];};
 const worldPosition=(x,y)=>new DOMPoint(x,y).matrixTransform(svg.getScreenCTM().inverse());
 function zoomAt(factor,x,y){const v=view(),p=worldPosition(x,y),w=Math.max(limits.min,Math.min(limits.world,v[2]*factor)),ratio=w/v[2];setView(bounded([p.x-(p.x-v[0])*ratio,p.y-(p.y-v[1])*ratio,w]));}
 function sync(){
  const [vx,vy,width,height]=view(),unit=1/svg.getScreenCTM().a;
  map.dataset.mapLevel=width<=limits.local?'local':width<limits.region?'regional':'world';
  for(const point of points){const code=point.dataset.location,[x,y]=coordinates(point),cos=Math.cos((90-y*180/500)*Math.PI/180),rx=Math.min(limits.maximumRadiusKm/111.195*500/180/cos,Math.max(limits.cityRadiusKm/111.195*500/180/cos*Math.min(1,width/limits.cityViewport),width*limits.radiusFraction)),ry=rx*cos,mask=map.querySelector('#map-radius-'+code),ellipse=mask.querySelector('ellipse');for(const [key,value] of Object.entries({x:x-rx,y:y-ry,width:rx*2,height:ry*2}))mask.setAttribute(key,value);for(const [key,value] of Object.entries({rx,ry}))ellipse.setAttribute(key,value);}
  const matrix=svg.getScreenCTM();for(const p of points){const [x,y]=coordinates(p);screenPositions.set(p,new DOMPoint(x,y).matrixTransform(matrix));}surfaceRect=surface.getBoundingClientRect();
  for(const p of points){const [x,y]=coordinates(p),inside=x>=vx&&x<=vx+width&&y>=vy&&y<=vy+height;p.style.display=inside?'':'none';p.setAttribute('tabindex',inside?'0':'-1');p.setAttribute('aria-hidden',String(!inside));
   const centre=screenPoint(p),spacing=Math.min(...points.filter(q=>q!==p).map(q=>{const s=screenPoint(q);return Math.hypot(s.x-centre.x,s.y-centre.y);}));
   for(const [cls,size] of [['location-hit',Math.max(1,Math.min(limits.touchHit,spacing*.45))],['location-halo',width>limits.local?3.5:6],['location-dot',width>limits.local?2:3.5]])p.querySelector('.'+cls).setAttribute('r',unit*size);
  }
 }
 function nearest(e){let result=null,best=e.pointerType==='touch'?limits.touchHit:limits.mouseHit;for(const p of points){if(p.style.display==='none')continue;const s=screenPoint(p),distance=Math.hypot(e.clientX-s.x,e.clientY-s.y);if(distance<best){best=distance;result=p;}}return result;}
 function position(x,y){const r=surfaceRect,b=tooltipSize;tooltip.style.left=Math.max(8,Math.min(r.width-b.width-8,x-r.left+14))+'px';tooltip.style.top=Math.max(8,Math.min(r.height-b.height-8,y-r.top+14))+'px';}
 function show(point,event){if(active===point&&!tooltip.hidden){const s=screenPoint(point);position(event?.clientX??s.x,event?.clientY??s.y);return;}active=point;map.querySelectorAll('[data-location-result]').forEach(p=>p.classList.toggle('is-active',p.dataset.locationResult===point.dataset.location));points.forEach(p=>p.classList.toggle('is-active',p===point));map.querySelectorAll('[data-nearby]').forEach(p=>p.classList.toggle('is-active',p.dataset.nearby===point.dataset.location));
  if(tooltip.dataset.tooltipLocation!==point.dataset.location){tooltip.replaceChildren();const strong=document.createElement('strong'),code=document.createElement('span'),hint=document.createElement('small');strong.textContent=point.dataset.city;code.textContent=point.dataset.location;hint.textContent=point.dataset.destination;tooltip.append(code,strong,hint);tooltip.dataset.tooltipLocation=point.dataset.location;}
  tooltip.hidden=false;tooltipSize=tooltip.getBoundingClientRect();map.dispatchEvent(new Event('map-highlight-change'));const s=screenPoint(point);position(event?.clientX??s.x,event?.clientY??s.y);
 }
 function hide(){if(!active)return;active=null;tooltip.hidden=true;map.querySelectorAll('.map-location.is-active,.map-nearby-track.is-active').forEach(p=>p.classList.remove('is-active'));map.dispatchEvent(new Event('map-highlight-change'));}
 for(const point of points){point.addEventListener('focus',()=>show(point));point.addEventListener('blur',hide);point.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();point.blur();}});}
 const pointers=new Map();let gesture=null;
 const beginGesture=()=>{const values=[...pointers.values()];gesture={view:view(),matrix:svg.getScreenCTM(),points:values.map(p=>({...p}))};};
 svg.addEventListener('wheel',e=>{e.preventDefault();pending=null;hide();zoomAt(Math.exp(Math.max(-250,Math.min(250,e.deltaY*(e.deltaMode===1?16:1)))*limits.wheelRate),e.clientX,e.clientY);const point=nearest(e);if(point)show(point,e);},{passive:false});
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;suppressClick=false;pending=null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);beginGesture();});
 svg.addEventListener('pointermove',e=>{
  if(pointers.has(e.pointerId)&&gesture){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const current=[...pointers.values()],start=gesture.points;if(current.length===2&&start.length===2){const distance=ps=>Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y),mid=ps=>({x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2}),a=mid(start),b=mid(current),scale=distance(start)/Math.max(1,distance(current)),v=gesture.view,m=gesture.matrix,w=Math.max(limits.min,Math.min(limits.world,v[2]*scale)),anchor=new DOMPoint(a.x,a.y).matrixTransform(m.inverse()),unit=w/v[2]/m.a,left=m.e+v[0]*m.a,top=m.f+v[1]*m.d;setView(bounded([anchor.x-(b.x-left)*unit,anchor.y-(b.y-top)*unit,w]));suppressClick=true;hide();return;}if(current.length===1&&start.length===1){const dx=current[0].x-start[0].x,dy=current[0].y-start[0].y;if(Math.hypot(dx,dy)>limits.dragThreshold||suppressClick){suppressClick=true;svg.classList.add('is-panning');hide();const v=gesture.view,unit=1/gesture.matrix.a;setView(bounded([v[0]-dx*unit,v[1]-dy*unit,v[2]]));return;}}}
  const point=nearest(e);if(point)show(point,e);else hide();
 });
 const finish=e=>{pointers.delete(e.pointerId);svg.classList.remove('is-panning');if(pointers.size)beginGesture();else gesture=null;};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
 svg.addEventListener('pointerleave',()=>{if(pointers.size)return;const focused=points.find(p=>p===document.activeElement&&p.style.display!=='none');if(focused)show(focused);else hide();});
 svg.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;return;}if(!e.detail)return;const point=nearest(e);if(point&&e.target.closest('[data-location]')!==point){e.preventDefault();e.stopPropagation();point.click();}},true);
 map.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('[data-location-zoom]'))pending=null;},true);
 for(const button of map.querySelectorAll('[data-location-zoom]'))button.addEventListener('click',()=>{pending=points.find(p=>p.dataset.location===button.dataset.locationZoom);hide();zoom(pending.dataset.locationViewport.split(' ').map(Number));});
 map.addEventListener('map-zoom-end',()=>{if(pending){const point=pending;pending=null;point.focus({preventScroll:true});show(point);}});
 svg.setAttribute('tabindex','0');svg.setAttribute('aria-describedby','map-help');svg.addEventListener('keydown',e=>{const factors={'+':.7,'=':.7,'-':1/.7},directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(factors[e.key]){e.preventDefault();const r=svg.getBoundingClientRect();hide();zoomAt(factors[e.key],r.left+r.width/2,r.top+r.height/2);}else if(directions[e.key]){e.preventDefault();hide();const v=view(),[dx,dy]=directions[e.key];setView(bounded([v[0]+dx*v[2]*.1,v[1]+dy*v[3]*.1,v[2]]));}else if(e.key==='Home'){e.preventDefault();map.querySelector('[data-map-world]').click();}});
 function lifecycle(){map.classList.toggle('map-motion-paused',reduced.matches||document.hidden||!visible);}
 new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);lifecycle();}).observe(map);reduced.addEventListener('change',lifecycle);document.addEventListener('visibilitychange',lifecycle);
 map.addEventListener('map-view-change',()=>{sync();if(active)show(active);});new ResizeObserver(sync).observe(svg);map.classList.add('map-locations-ready');sync();
 let scrollFrame=0;addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;sync();});},{passive:true});
})();

// One small canvas animates the selected roads; the geographic SVG stays static.
(()=>{'use strict';
 const map=document.querySelector('[data-case-map]');if(!map)return;
 const svg=map.querySelector('.world-map'),surface=map.querySelector('.map-geography'),canvas=document.createElement('canvas');
 canvas.className='map-motion-canvas';canvas.setAttribute('aria-hidden','true');surface.append(canvas);
 const context=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),cache=new WeakMap();
 const motion=JSON.parse(map.querySelector('.map-rail-highlights').dataset.motion);
 let routes=[],matrix,origin,radius,selected,frame=0,last=0,visible=false,paused=true;
 function clear(){context.clearRect(0,0,canvas.width,canvas.height);}
 function geometry(path){if(cache.has(path))return cache.get(path);const points=[...path.getAttribute('d').matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>({x:+m[1],y:+m[2],distance:0}));for(let i=1;i<points.length;i++)points[i].distance=points[i-1].distance+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);cache.set(path,points);return points;}
 function branches(points){let best=Infinity,index=1,centre=points[0];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((origin.x-a.x)*dx+(origin.y-a.y)*dy)/(dx*dx+dy*dy||1))),p={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-origin.x,p.y-origin.y);if(d<best){best=d;index=i;centre=p;}}return [[centre,...points.slice(0,index).reverse()],[centre,...points.slice(index)]].map(ps=>{ps[0]={...ps[0],distance:0};for(let i=1;i<ps.length;i++)ps[i]={...ps[i],distance:ps[i-1].distance+Math.hypot(ps[i].x-ps[i-1].x,ps[i].y-ps[i-1].y)};return ps;}).filter(ps=>ps.at(-1).distance*matrix.a>1);}
 // Parallel tracks or duplicated source segments form one visible corridor at this zoom.
 function selectCorridors(candidates){const occupied=new Set(),selected=[];for(const points of candidates){if(points.at(-1).distance*matrix.a<2)continue;const count=Math.min(256,Math.max(2,Math.ceil(points.at(-1).distance*matrix.a/motion.corridorCellPixels))),cells=[];let overlap=0;for(let i=0;i<count;i++){const p=pointAt(points,points.at(-1).distance*i/(count-1)),x=Math.floor((p.x*matrix.a+matrix.x)/motion.corridorCellPixels),y=Math.floor((p.y*matrix.d+matrix.y)/motion.corridorCellPixels);cells.push([x,y]);if(occupied.has(`${x},${y}`))overlap++;}if(overlap/count>.35)continue;selected.push(points);for(const [x,y] of cells)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)occupied.add(`${x+dx},${y+dy}`);if(selected.length===motion.maxRoutes)break;}return selected;}
 // Animate only the visible illuminated fragment, so deep zoom cannot hide most of a cycle.
 function visibleFragment(points,view){const chains=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;for(const [p,q] of [[-dx,a.x-view[0]],[dx,view[0]+view[2]-a.x],[-dy,a.y-view[1]],[dy,view[1]+view[3]-a.y]]){if(p===0){if(q<0)hi=-1;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}const x=(a.x-origin.x)/radius.x,y=(a.y-origin.y)/radius.y,u=dx/radius.x,v=dy/radius.y,A=u*u+v*v,B=2*(x*u+y*v),C=x*x+y*y-1,D=B*B-4*A*C;if(D<0||!A)continue;lo=Math.max(lo,(-B-Math.sqrt(D))/(2*A));hi=Math.min(hi,(-B+Math.sqrt(D))/(2*A));if(hi<=lo)continue;const start={x:a.x+dx*lo,y:a.y+dy*lo},end={x:a.x+dx*hi,y:a.y+dy*hi},last=chains.at(-1);if(last&&Math.hypot(last.at(-1).x-start.x,last.at(-1).y-start.y)<1e-7)last.push(end);else chains.push([start,end]);}for(const chain of chains){chain[0].distance=0;for(let i=1;i<chain.length;i++)chain[i].distance=chain[i-1].distance+Math.hypot(chain[i].x-chain[i-1].x,chain[i].y-chain[i-1].y);}return chains.sort((a,b)=>b.at(-1).distance-a.at(-1).distance)[0];}
 function update(){
  const r=surface.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,motion.pixelRatio);
  if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);}
  const m=svg.getScreenCTM();matrix={a:m.a,d:m.d,x:m.e-r.left,y:m.f-r.top,ratio};
  selected=map.querySelector('.map-location.is-active');
  if(selected){const xy=selected.getAttribute('transform').match(/[\d.-]+/g).map(Number);origin={x:xy[0],y:xy[1]};const e=map.querySelector('#map-radius-'+selected.dataset.location+' ellipse');radius={x:+e.getAttribute('rx'),y:+e.getAttribute('ry')};const view=svg.getAttribute('viewBox').split(' ').map(Number),group=map.querySelector('.map-nearby-track.is-active'),candidates=[...group.querySelectorAll('.map-rail-travel')].map(p=>visibleFragment(geometry(p),view)).filter(Boolean),chosen=selectCorridors(candidates);group.querySelector('.map-rail-glow').setAttribute('d',chosen.map(ps=>ps.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')).join(''));routes=chosen.map(points=>({branches:branches(points),length:points.at(-1).distance})).filter(r=>r.branches.length);}else routes=[];
  lifecycle();
 }
 function lifecycle(){paused=!visible||document.hidden||reduced.matches||!routes.length;cancelAnimationFrame(frame);clear();if(!paused){last=0;frame=requestAnimationFrame(tick);}}
 function pointAt(points,distance){for(let i=1;i<points.length;i++){const b=points[i],a=points[i-1];if(b.distance>=distance){const t=(distance-a.distance)/(b.distance-a.distance||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}}return points.at(-1);}
 function tick(now){if(paused)return;frame=requestAnimationFrame(tick);if(now-last<1000/motion.fps)return;last=now;clear();const m=matrix;context.setTransform(m.ratio,0,0,m.ratio,0,0);context.lineCap='round';context.lineJoin='round';context.lineWidth=2;
  routes.forEach((route,i)=>{const duration=Math.max(motion.minimumDuration,Math.min(motion.maximumDuration,route.length*m.a/motion.screenSpeed*1000)),time=now+i*173,points=route.branches[Math.floor(time/duration)%route.branches.length],phase=(time%duration)/duration,length=points.at(-1).distance,head=phase*length,tail=Math.max(0,head-motion.stripePixels/m.a),a=pointAt(points,tail),b=pointAt(points,head),distance=Math.hypot((b.x-origin.x)/radius.x,(b.y-origin.y)/radius.y),fade=Math.max(0,1-distance);
   if(fade<=0)return;context.globalAlpha=Math.min(1,fade*1.7);const screen=p=>({x:p.x*m.a+m.x,y:p.y*m.d+m.y}),start=screen(a),end=screen(b);if(Math.hypot(end.x-start.x,end.y-start.y)<.1)return;
   const gradient=context.createLinearGradient(start.x,start.y,end.x,end.y);gradient.addColorStop(0,'rgba(255,181,83,0)');gradient.addColorStop(.55,'#ffcc78');gradient.addColorStop(1,'#fff2c7');context.strokeStyle=gradient;context.beginPath();context.moveTo(start.x,start.y);for(const p of points)if(p.distance>tail&&p.distance<head){const q=screen(p);context.lineTo(q.x,q.y);}context.lineTo(end.x,end.y);context.stroke();
  });context.globalAlpha=1;context.resetTransform();
 }
 map.addEventListener('map-view-change',update);map.addEventListener('map-highlight-change',update);new ResizeObserver(update).observe(surface);
 new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);lifecycle();}).observe(surface);reduced.addEventListener('change',lifecycle);document.addEventListener('visibilitychange',lifecycle);update();
})();
