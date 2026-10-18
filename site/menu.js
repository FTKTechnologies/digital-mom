'use strict';
// Hamburger menu for phones and tablets. Opens a panel under the header; closes on Escape, on choosing a link,
// when the screen becomes wide enough for the normal menu, and returns focus to the button after Escape.
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('mobile-menu');
if (toggle && menu) {
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', event => { if (event.target.closest('a, button')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', event => { if (event.matches) setOpen(false); });
}
