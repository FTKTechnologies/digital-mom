'use strict';
// Gallery page: tap a picture to see it bigger. Arrow buttons and the keyboard's left/right keys step through every
// picture on the page; Escape or the × closes it. Without JavaScript the pictures simply stay in the grid.
(() => {
  const dialog = document.querySelector('.lightbox');
  const openers = [...document.querySelectorAll('.gallery-open')];
  if (!dialog || !openers.length) return;
  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const prev = dialog.querySelector('.lightbox-prev');
  const next = dialog.querySelector('.lightbox-next');
  let index = 0, opener = null;

  const show = i => {
    index = (i + openers.length) % openers.length;
    const button = openers[index];
    img.src = button.dataset.full;
    img.alt = button.querySelector('img')?.alt || '';
    caption.textContent = button.dataset.caption || '';
    caption.hidden = !caption.textContent;
  };
  prev.hidden = next.hidden = openers.length < 2;

  openers.forEach((button, i) => button.addEventListener('click', () => {
    opener = button;
    show(i);
    dialog.showModal();
  }));
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('close', () => { img.removeAttribute('src'); opener?.focus(); });
})();
