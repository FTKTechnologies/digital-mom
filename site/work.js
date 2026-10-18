'use strict';
// Filter buttons on /work/: show only projects in the chosen service. Without JavaScript every project stays visible.
const buttons = [...document.querySelectorAll('[data-work-filter]')];
const items = [...document.querySelectorAll('[data-work-category]')];
buttons.forEach(button => button.addEventListener('click', () => {
  const chosen = button.dataset.workFilter;
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  items.forEach(item => { item.hidden = chosen !== 'all' && item.dataset.workCategory !== chosen; });
}));
