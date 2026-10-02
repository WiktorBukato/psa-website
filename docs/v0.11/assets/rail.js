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
  const mapSVG=map.querySelector('.world-map'),worldReset=map.querySelector('[data-map-world]');
  let zoomFrame=0;
  function zoomMap(region){
    cancelAnimationFrame(zoomFrame);
    const target=region?region.dataset.mapViewport.split(' ').map(Number):[0,0,1000,500];
    const start=mapSVG.getAttribute('viewBox').split(' ').map(Number),began=performance.now();
    worldReset.hidden=!region;mapSVG.classList.toggle('is-zoomed',!!region);
    function tick(now){const p=reduced.matches?1:Math.min(1,(now-began)/420),ease=1-Math.pow(1-p,3);mapSVG.setAttribute('viewBox',start.map((v,i)=>v+(target[i]-v)*ease).join(' '));if(p<1)zoomFrame=requestAnimationFrame(tick);}
    zoomFrame=requestAnimationFrame(tick);
  }
  worldReset.addEventListener('click',()=>{zoomMap(null);filters[0].focus({preventScroll:true});});
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
