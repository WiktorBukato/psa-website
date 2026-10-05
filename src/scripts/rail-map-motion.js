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
 // Animate only the visible illuminated fragment, so deep zoom cannot hide most of a cycle.
 function visibleFragment(points,view){const chains=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;for(const [p,q] of [[-dx,a.x-view[0]],[dx,view[0]+view[2]-a.x],[-dy,a.y-view[1]],[dy,view[1]+view[3]-a.y]]){if(p===0){if(q<0)hi=-1;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}const x=(a.x-origin.x)/radius.x,y=(a.y-origin.y)/radius.y,u=dx/radius.x,v=dy/radius.y,A=u*u+v*v,B=2*(x*u+y*v),C=x*x+y*y-1,D=B*B-4*A*C;if(D<0||!A)continue;lo=Math.max(lo,(-B-Math.sqrt(D))/(2*A));hi=Math.min(hi,(-B+Math.sqrt(D))/(2*A));if(hi<=lo)continue;const start={x:a.x+dx*lo,y:a.y+dy*lo},end={x:a.x+dx*hi,y:a.y+dy*hi},last=chains.at(-1);if(last&&Math.hypot(last.at(-1).x-start.x,last.at(-1).y-start.y)<1e-7)last.push(end);else chains.push([start,end]);}for(const chain of chains){chain[0].distance=0;for(let i=1;i<chain.length;i++)chain[i].distance=chain[i-1].distance+Math.hypot(chain[i].x-chain[i-1].x,chain[i].y-chain[i-1].y);}return chains.sort((a,b)=>b.at(-1).distance-a.at(-1).distance)[0];}
 function update(){
  const r=surface.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,motion.pixelRatio);
  if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);}
  const m=svg.getScreenCTM();matrix={a:m.a,d:m.d,x:m.e-r.left,y:m.f-r.top,ratio};
  selected=map.querySelector('.map-location.is-active');
  if(selected){const xy=selected.getAttribute('transform').match(/[\d.-]+/g).map(Number);origin={x:xy[0],y:xy[1]};const e=map.querySelector('#map-radius-'+selected.dataset.location+' ellipse');radius={x:+e.getAttribute('rx'),y:+e.getAttribute('ry')};const level=map.dataset.mapLevel==='local'?'local':'overview',view=svg.getAttribute('viewBox').split(' ').map(Number);routes=[...map.querySelectorAll(`.map-nearby-track.is-active .map-nearby-${level} .map-rail-travel`)].slice(0,motion.maxRoutes).map(p=>visibleFragment(geometry(p),view)).filter(Boolean);}else routes=[];
  lifecycle();
 }
 function lifecycle(){paused=!visible||document.hidden||reduced.matches||!routes.length;cancelAnimationFrame(frame);clear();if(!paused){last=0;frame=requestAnimationFrame(tick);}}
 function pointAt(points,distance){for(let i=1;i<points.length;i++){const b=points[i],a=points[i-1];if(b.distance>=distance){const t=(distance-a.distance)/(b.distance-a.distance||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}}return points.at(-1);}
 function tick(now){if(paused)return;frame=requestAnimationFrame(tick);if(now-last<1000/motion.fps)return;last=now;clear();const m=matrix;context.setTransform(m.ratio,0,0,m.ratio,0,0);context.lineCap='round';context.lineJoin='round';context.lineWidth=2;
  routes.forEach((points,i)=>{const length=points.at(-1).distance,duration=Math.max(motion.minimumDuration,Math.min(motion.maximumDuration,length*m.a/motion.screenSpeed*1000)),phase=((now+i*173)%duration)/duration,head=phase*length,tail=Math.max(0,head-motion.stripePixels/m.a),a=pointAt(points,tail),b=pointAt(points,head),distance=Math.hypot((b.x-origin.x)/radius.x,(b.y-origin.y)/radius.y),fade=Math.max(0,1-distance);
   if(fade<=0)return;context.globalAlpha=Math.min(1,fade*1.7);const screen=p=>({x:p.x*m.a+m.x,y:p.y*m.d+m.y}),start=screen(a),end=screen(b);if(Math.hypot(end.x-start.x,end.y-start.y)<.1)return;
   const gradient=context.createLinearGradient(start.x,start.y,end.x,end.y);gradient.addColorStop(0,'rgba(255,181,83,0)');gradient.addColorStop(.55,'#ffcc78');gradient.addColorStop(1,'#fff2c7');context.strokeStyle=gradient;context.beginPath();context.moveTo(start.x,start.y);for(const p of points)if(p.distance>tail&&p.distance<head){const q=screen(p);context.lineTo(q.x,q.y);}context.lineTo(end.x,end.y);context.stroke();
  });context.globalAlpha=1;context.resetTransform();
 }
 map.addEventListener('map-view-change',update);map.addEventListener('map-highlight-change',update);new ResizeObserver(update).observe(surface);
 new IntersectionObserver(es=>{visible=es.some(e=>e.isIntersecting);lifecycle();}).observe(surface);reduced.addEventListener('change',lifecycle);document.addEventListener('visibilitychange',lifecycle);update();
})();
