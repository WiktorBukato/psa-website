// Offline SVG interaction: one nearest-point resolver serves mouse, touch and clicks.
(()=>{'use strict';
 const map=document.querySelector('[data-case-map]');if(!map)return;
 const svg=map.querySelector('.world-map'),points=[...map.querySelectorAll('[data-location]')],tooltip=map.querySelector('.map-location-tooltip'),surface=map.querySelector('.map-geography'),controls=map.querySelector('.map-scale-controls');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),limits={world:1000,min:5,local:80,region:600,mouseHit:12,touchHit:22};let active=null,pending=null,visible=false;
 const view=()=>svg.getAttribute('viewBox').split(' ').map(Number);
 const coordinates=p=>p.getAttribute('transform').match(/[\d.-]+/g).map(Number);
 function screenPoint(p){const [x,y]=coordinates(p);return new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());}
 const zoom=v=>map.dispatchEvent(new CustomEvent('map-zoom-request',{detail:v}));
 function sync(){
  const [vx,vy,width,height]=view(),unit=width/svg.getBoundingClientRect().width;
  map.dataset.mapLevel=width<=limits.local?'local':width<limits.region?'regional':'world';
  for(const p of points){const [x,y]=coordinates(p),inside=x>=vx&&x<=vx+width&&y>=vy&&y<=vy+height;p.style.display=inside?'':'none';p.setAttribute('tabindex',inside?'0':'-1');p.setAttribute('aria-hidden',String(!inside));
   const centre=screenPoint(p),spacing=Math.min(...points.filter(q=>q!==p).map(q=>{const s=screenPoint(q);return Math.hypot(s.x-centre.x,s.y-centre.y);}));
   for(const [cls,size] of [['location-hit',Math.max(1,Math.min(limits.touchHit,spacing*.45))],['location-halo',width>limits.local?3.5:6],['location-dot',width>limits.local?2:3.5]])p.querySelector('.'+cls).setAttribute('r',unit*size);
  }
 }
 function nearest(e){let result=null,best=e.pointerType==='touch'?limits.touchHit:limits.mouseHit;for(const p of points){if(p.style.display==='none')continue;const s=screenPoint(p),distance=Math.hypot(e.clientX-s.x,e.clientY-s.y);if(distance<best){best=distance;result=p;}}return result;}
 function position(x,y){const r=surface.getBoundingClientRect(),b=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(r.width-b.width-8,x-r.left+14))+'px';tooltip.style.top=Math.max(8,Math.min(r.height-b.height-8,y-r.top+14))+'px';}
 function show(point,event){active=point;map.querySelectorAll('[data-location-result]').forEach(p=>p.classList.toggle('is-active',p.dataset.locationResult===point.dataset.location));points.forEach(p=>p.classList.toggle('is-active',p===point));map.querySelectorAll('[data-nearby]').forEach(p=>p.classList.toggle('is-active',p.dataset.nearby===point.dataset.location));
  if(tooltip.dataset.tooltipLocation!==point.dataset.location){tooltip.replaceChildren();const strong=document.createElement('strong'),code=document.createElement('span'),hint=document.createElement('small');strong.textContent=point.dataset.city;code.textContent=point.dataset.location;hint.textContent=point.dataset.destination;tooltip.append(code,strong,hint);tooltip.dataset.tooltipLocation=point.dataset.location;}
  tooltip.hidden=false;const s=screenPoint(point);position(event?.clientX??s.x,event?.clientY??s.y);
 }
 function hide(){active=null;tooltip.hidden=true;map.querySelectorAll('.map-location.is-active,.map-nearby-track.is-active').forEach(p=>p.classList.remove('is-active'));}
 for(const point of points){point.addEventListener('focus',()=>show(point));point.addEventListener('blur',hide);point.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();point.blur();}});}
 svg.addEventListener('pointermove',e=>{const point=nearest(e);if(point)show(point,e);else hide();});svg.addEventListener('pointerleave',()=>{const focused=points.find(p=>p===document.activeElement);if(focused)show(focused);else hide();});
 svg.addEventListener('click',e=>{if(!e.detail)return;const point=nearest(e);if(point&&e.target.closest('[data-location]')!==point){e.preventDefault();e.stopPropagation();point.click();}},true);
 map.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('[data-location-zoom]'))pending=null;},true);
 for(const button of map.querySelectorAll('[data-location-zoom]'))button.addEventListener('click',()=>{pending=points.find(p=>p.dataset.location===button.dataset.locationZoom);hide();zoom(pending.dataset.locationViewport.split(' ').map(Number));});
 map.addEventListener('map-zoom-end',()=>{if(pending){const point=pending;pending=null;point.focus({preventScroll:true});show(point);}});
 for(const button of controls.querySelectorAll('button'))button.addEventListener('click',()=>{hide();const [x,y,w,h]=view(),next=Math.max(limits.min,Math.min(limits.world,w*(button.dataset.mapScale==='in'?.5:2)));zoom([Math.max(0,Math.min(1000-next,x+w/2-next/2)),Math.max(0,Math.min(500-next/2,y+h/2-next/4)),next,next/2]);});
 function lifecycle(){map.classList.toggle('map-motion-paused',reduced.matches||document.hidden||!visible);}
 new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);lifecycle();}).observe(map);reduced.addEventListener('change',lifecycle);document.addEventListener('visibilitychange',lifecycle);
 map.addEventListener('map-view-change',()=>{sync();if(active)show(active);});new ResizeObserver(sync).observe(svg);controls.hidden=false;map.classList.add('map-locations-ready');sync();
})();
