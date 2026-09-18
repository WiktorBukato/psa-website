(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  function setMenu(open, returnFocus = false) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navigation.classList.toggle('open', open);
    if (returnFocus) menu.focus();
  }
  menu?.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header') && menu?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });
  const mobileBreakpoint = matchMedia('(max-width: 900px)');
  mobileBreakpoint.addEventListener('change', () => { if (menu) setMenu(false); });

  const backTop = document.querySelector('.back-top');
  const sectionLinks = [...document.querySelectorAll('.nav a')];
  const sections = sectionLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let queued = false;
  function updateScroll() {
    const headerHeight = document.querySelector('.header')?.getBoundingClientRect().height || 0;
    const offset = Math.max(headerHeight, parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    const atBottom = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight;
    let current = '';
    let nearestTop = -Infinity;
    sections.forEach(section => {
      const top = section.getBoundingClientRect().top;
      const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      if ((atBottom || top <= offset + margin + 1) && top > nearestTop) {
        current = section.id;
        nearestTop = top;
      }
    });
    // Several final sections can share the same maximum scroll position on a
    // tall monitor. Preserve the clicked anchor when its section is visible.
    const anchor = sections.find(section => `#${section.id}` === location.hash);
    if (atBottom && anchor) {
      const bounds = anchor.getBoundingClientRect();
      if (bounds.top >= headerHeight && bounds.top < innerHeight) current = anchor.id;
    }
    sectionLinks.forEach(link => {
      const active = link.hash === `#${current}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    backTop?.classList.toggle('is-visible', scrollY > innerHeight * .7);
    queued = false;
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  addEventListener('hashchange', updateScroll);
  updateScroll();
})();
