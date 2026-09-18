(() => {
  'use strict';
  const main = document.querySelector('.theme-rail #main');
  const hero = main?.querySelector('.rail-hero');
  if (!hero) return;
  const scene = hero.querySelector('.rail-scene');
  const plane = scene.querySelector('.scene-image-plane');
  const svg = scene.querySelector('.scene-svg');
  const image = hero.querySelector('.rail-hero-picture img');
  const controls = hero.querySelector('.scene-controls');
  const inspectButton = controls.querySelector('.scene-inspect-toggle');
  const motionButton = controls.querySelector('.scene-motion-toggle');
  const debugButton = controls.querySelector('.scene-debug-toggle');
  const inspector = hero.querySelector('.scene-inspector');
  const select = inspector.querySelector('select');
  const card = hero.querySelector('.scene-card');
  const objects = [...svg.querySelectorAll('.scene-object')];
  const lights = [...svg.querySelectorAll('.scene-light')];
  const aircraft = svg.querySelector('.scene-aircraft');
  const signals = [...svg.querySelectorAll('.scene-signal')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set(), lightTimers = new Set(), animations = new Set();
  const source = svg.viewBox.baseVal;
  const timing = JSON.parse(document.getElementById('rail-motion-config').textContent);
  let visible = false, userPaused = false, running = false, lightDebug = false, pinned = false, active = null, hideTimer;
  let mapping = {x:0,y:0,scale:1}, cursor=null, cursorFrame=0;
  const cloudImage=new Image();
  cloudImage.onload=()=>hero.classList.add('sky-ready');
  cloudImage.src=svg.querySelector('.cloud-drift').getAttribute('href');
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
      if(!running||lightDebug)return;
      const peak=random(timing.lightPeakMin,timing.lightPeakMax)*Number(light.dataset.energy);
      const pulse=animate(light,[{opacity:0},{opacity:peak,offset:random(timing.lightRiseMin,timing.lightRiseMax)},{opacity:0}],{duration:random(timing.lightDurationMin,timing.lightDurationMax),easing:'ease-in-out'});
      // Schedule only after completion: one pulse per light, including after pause/debug.
      pulse.finished.then(()=>{if(running&&!lightDebug)shimmer(light,meanDelay);},()=>{});
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
    const next=visible&&!document.hidden&&!userPaused&&!reduced.matches;
    main.classList.toggle('rail-motion-paused',userPaused||reduced.matches);
    hero.classList.toggle('ambient-running',next);
    hero.dataset.ambientState=next?'running':'paused';
    motionButton.disabled=reduced.matches;
    motionButton.setAttribute('aria-pressed',String(userPaused||reduced.matches));
    motionButton.setAttribute('aria-label',reduced.matches?'Motion reduced by device preference':userPaused?'Resume scene motion':'Pause scene motion');
    motionButton.querySelector('.motion-label').textContent=reduced.matches?'Motion reduced':userPaused?'Resume motion':'Pause motion';
    motionButton.querySelector('.motion-state').textContent=userPaused||reduced.matches?'▷':'Ⅱ';
    if(next===running&&!restart)return;
    running=next;
    stopLights();
    for(const timer of timers)clearTimeout(timer);timers.clear();
    for(const animation of animations)animation.cancel();animations.clear();
    if(running){if(!lightDebug)startLights();fly(true);}
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
    if(!event&&!inspector.hidden){left=bounds.width-size.width-20;top=bounds.height-size.height-inspector.offsetHeight-controls.offsetHeight-42;}
    if(left+size.width>bounds.width-16)left-=size.width+40;
    left=Math.max(16,Math.min(left,bounds.width-size.width-16));
    top=Math.max(16,Math.min(top,bounds.height-size.height-controls.offsetHeight-24));
    card.style.left=`${left}px`;card.style.top=`${top}px`;
  }
  function show(object,event,lock=false) {
    if(pinned&&!lock)return;
    clearTimeout(hideTimer);active=object;pinned=lock;
    objects.forEach(o=>o.classList.toggle('is-selected',o===object));
    card.querySelectorAll('[data-asset-card]').forEach(content=>{content.hidden=content.dataset.assetCard!==object.dataset.asset;});
    card.hidden=false;select.value=object.dataset.asset;positionCard(object,event);
  }
  function hide() {
    clearTimeout(hideTimer);pinned=false;active=null;cursor=null;card.hidden=true;select.value='';
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
  hero.addEventListener('pointerdown',event=>{if(!event.target.closest('.scene-object,.scene-controls,.scene-inspector'))hide();});
  inspectButton.addEventListener('click',()=>{
    inspector.hidden=!inspector.hidden;inspectButton.setAttribute('aria-expanded',String(!inspector.hidden));
    if(!inspector.hidden){if(active){pinned=true;positionCard(active);}select.focus();}else hide();
  });
  select.addEventListener('change',()=>{const object=objects.find(o=>o.dataset.asset===select.value);if(object)show(object,null,true);else hide();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(!inspector.hidden||!card.hidden)){hide();inspector.hidden=true;inspectButton.setAttribute('aria-expanded','false');inspectButton.focus();}
  });
  document.addEventListener('pointerdown',event=>{if(!hero.contains(event.target)){hide();inspector.hidden=true;inspectButton.setAttribute('aria-expanded','false');}});
  motionButton.addEventListener('click',()=>{userPaused=!userPaused;updateMotion();});
  debugButton.addEventListener('click',()=>{
    lightDebug=!lightDebug;stopLights();
    hero.classList.toggle('light-debug',lightDebug);
    debugButton.setAttribute('aria-pressed',String(lightDebug));
    if(!lightDebug&&running)startLights();
  });
  reduced.addEventListener('change',()=>updateMotion());
  document.addEventListener('visibilitychange',()=>updateMotion());
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)hide();updateMotion();},{threshold:0}).observe(hero);
  new ResizeObserver(registerImage).observe(hero);
  image.addEventListener('load',registerImage);
  scene.hidden=false;controls.hidden=false;registerImage();updateMotion();
})();
