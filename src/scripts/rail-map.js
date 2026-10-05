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
