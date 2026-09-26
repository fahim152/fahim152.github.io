'use strict';

const views = {
  systems: {
    nodes: ['Software', 'Services', 'Data', 'Interfaces'],
    caption: 'Building and maintaining services, APIs, and the interfaces that connect them.'
  },
  products: {
    nodes: ['Web apps', 'APIs', 'Integrations', 'Users'],
    caption: 'Connecting web applications, backend APIs, and integrations around what people need.'
  },
  research: {
    nodes: ['Raw data', 'LLMs', 'Shared meaning', 'Integration'],
    caption: 'Exploring how AI can turn different industrial data into a shared understanding.'
  }
};

const controls = document.querySelector('.system-controls');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
controls.hidden = false;
controls.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (!button) return;
  const mode = button.dataset.mode;
  const view = views[mode];
  if (!view) return;
  document.querySelector('.system-map').dataset.mode = mode;
  document.querySelector('.system-version').textContent = `${String(Object.keys(views).indexOf(mode) + 1).padStart(2, '0')} / 03`;
  document.querySelectorAll('[data-node]').forEach((node, index) => {
    node.textContent = view.nodes[index];
  });
  controls.querySelectorAll('button').forEach((control) => {
    control.setAttribute('aria-pressed', String(control === button));
  });
  document.querySelector('.system-caption').textContent = view.caption;
  if (!reducedMotion.matches) {
    const flow = document.querySelector('.flow');
    flow.getAnimations().forEach(animation => animation.cancel());
    flow.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -310 }], { duration: 1600, easing: 'linear' });
  }
});

// Everything stays visible if JavaScript or motion is disabled.
reducedMotion.addEventListener('change', ({ matches }) => {
  if (matches) document.getAnimations().forEach(animation => animation.cancel());
});

// Navigation follows the section nearest the top without changing browser history.
if ('IntersectionObserver' in window) {
  const links = [...document.querySelectorAll('nav a')];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
  const entranceObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!reducedMotion.matches) entry.target.classList.add('has-entered');
      entranceObserver.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.section-heading, .degree, .research-card, .about-copy, .contact-inner').forEach(element => entranceObserver.observe(element));
}
