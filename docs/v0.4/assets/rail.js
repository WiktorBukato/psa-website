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
  const inspector = hero.querySelector('.scene-inspector');
  const select = inspector.querySelector('select');
  const card = hero.querySelector('.scene-card');
  const close = card.querySelector('.scene-card-close');
  const objects = [...svg.querySelectorAll('.scene-object')];
  const lights = [...svg.querySelectorAll('.scene-light')];
  const aircraft = svg.querySelector('.scene-aircraft');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set(), animations = new Set();
  const source = svg.viewBox.baseVal;
  const timing = JSON.parse(document.getElementById('rail-motion-config').textContent);
  let visible = false, userPaused = false, running = false, pinned = false, active = null, hideTimer;
  let mapping = {x:0,y:0,scale:1};
  const random = (min,max) => min + Math.random()*(max-min);
  function later(fn,delay) {
    const id=setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);return id;
  }
  function animate(node,frames,options) {
    const animation=node.animate(frames,options);animations.add(animation);
    animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
    return animation;
  }
  function shimmer(light,first=false) {
    later(()=>{
      if(!running)return;
      animate(light,[{opacity:0},{opacity:random(.72,1),offset:.4},{opacity:.32,offset:.72},{opacity:0}],{duration:random(timing.lightDurationMin,timing.lightDurationMax),easing:'ease-in-out'});
      shimmer(light);
    },first?random(timing.firstLightMin,timing.firstLightMax):random(timing.lightMin,timing.lightMax));
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
    for(const timer of timers)clearTimeout(timer);timers.clear();
    for(const animation of animations)animation.cancel();animations.clear();
    if(running){lights.forEach(light=>shimmer(light,true));fly(true);}
  }
  function registerImage() {
    const rect=hero.getBoundingClientRect();
    const position=getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
    const scale=Math.max(rect.width/source.width,rect.height/source.height);
    const width=source.width*scale,height=source.height*scale;
    mapping={x:(rect.width-width)*position[0]/100,y:(rect.height-height)*position[1]/100,scale};
    Object.assign(plane.style,{width:`${width}px`,height:`${height}px`,left:`${mapping.x}px`,top:`${mapping.y}px`});
    if(active)positionCard(active);
    if(running)updateMotion(true);
  }
  function positionCard(object,event) {
    const bounds=hero.getBoundingClientRect(),size=card.getBoundingClientRect();
    const [x,y]=object.dataset.point.split(',').map(Number);
    let left=event?event.clientX-bounds.left+20:mapping.x+x*mapping.scale+20;
    let top=event?event.clientY-bounds.top+18:mapping.y+y*mapping.scale-size.height-18;
    if(!inspector.hidden){left=bounds.width-size.width-20;top=bounds.height-size.height-inspector.offsetHeight-controls.offsetHeight-42;}
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
    clearTimeout(hideTimer);pinned=false;active=null;card.hidden=true;select.value='';
    objects.forEach(o=>o.classList.remove('is-selected'));
  }
  svg.addEventListener('pointerover',event=>{
    const object=event.target.closest('.scene-object');
    if(object&&event.pointerType!=='touch')show(object,event);
  });
  svg.addEventListener('pointerout',event=>{
    if(pinned||card.contains(event.relatedTarget))return;
    const from=event.target.closest('.scene-object'),to=event.relatedTarget?.closest?.('.scene-object');
    if(from&&from!==to)hideTimer=setTimeout(hide,180);
  });
  svg.addEventListener('click',event=>{const object=event.target.closest('.scene-object');if(object)show(object,event,true);});
  card.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
  card.addEventListener('pointerleave',()=>{if(!pinned)hideTimer=setTimeout(hide,180);});
  close.addEventListener('click',()=>{hide();if(!inspector.hidden)select.focus();else inspectButton.focus();});
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
  reduced.addEventListener('change',()=>updateMotion());
  document.addEventListener('visibilitychange',()=>updateMotion());
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)hide();updateMotion();},{threshold:0}).observe(hero);
  new ResizeObserver(registerImage).observe(hero);
  image.addEventListener('load',registerImage);
  scene.hidden=false;controls.hidden=false;registerImage();updateMotion();
})();
