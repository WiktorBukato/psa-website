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

  const areaButtons = [...document.querySelectorAll('[data-area]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  function selectArea(id) {
    areaButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === id)));
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== id; });
  }
  if (areaButtons.length) {
    document.querySelector('.environment-panels').classList.add('enhanced');
    selectArea(areaButtons[0].dataset.area);
    areaButtons.forEach((button, index) => {
      button.addEventListener('click', () => selectArea(button.dataset.area));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % areaButtons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + areaButtons.length) % areaButtons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = areaButtons.length - 1;
        if (next !== undefined) { event.preventDefault(); areaButtons[next].focus(); selectArea(areaButtons[next].dataset.area); }
      });
    });
  }

  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const status = document.querySelector('.copy-status');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(button.dataset.copy);
      status.textContent = 'Email address copied.';
    } catch {
      status.textContent = `Please select and copy this address: ${button.dataset.copy}`;
    }
  }));

  const backTop = document.querySelector('.back-top');
  const sectionLinks = [...document.querySelectorAll('.nav a')];
  const sections = sectionLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let queued = false;
  function updateScroll() {
    const offset = document.querySelector('.header')?.getBoundingClientRect().height + 60 || 140;
    let current = '';
    sections.forEach(section => { if (section.getBoundingClientRect().top <= offset) current = section.id; });
    sectionLinks.forEach(link => {
      const active = link.hash === `#${current}`;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    backTop?.classList.toggle('is-visible', scrollY > innerHeight * .7);
    queued = false;
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  updateScroll();
})();
