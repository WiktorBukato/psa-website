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
