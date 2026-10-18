'use strict';

// GSAP ScrollTrigger effects. Elements opt in with data-scroll="reveal|scrub".
// Page-specific sequence: the [data-story] panel opens out, then its copy lights up word by word.
function initScrollEffects(root = document) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const empty = { available: false, refresh() {}, destroy() {} };
  if (!gsap || !ScrollTrigger) return empty; // Leave the HTML visible.

  gsap.registerPlugin(ScrollTrigger);
  const elements = [...root.querySelectorAll('[data-scroll]')];
  const media = gsap.matchMedia();
  let destroyed = false;
  let refreshFrame = 0;

  const number = (element, key, fallback) => {
    const raw = element.dataset[key];
    if (raw == null || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  // Wraps every word of an element (keeping <em>, <strong> and <br>) in a mask so it can slide up from below.
  function splitWords(root) {
    const words = [];
    const walk = node => [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const mask = document.createElement('span');
          mask.className = 'mask';
          const word = document.createElement('span');
          word.className = 'mask-word';
          word.textContent = part;
          mask.append(word);
          words.push(word);
          frag.append(mask);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    });
    walk(root);
    return words;
  }

  const refresh = () => {
    if (destroyed || refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      if (!destroyed) ScrollTrigger.refresh();
    });
  };

  media.add('(prefers-reduced-motion: no-preference)', () => {
    for (const element of elements) {
      const mode = element.dataset.scroll;
      if (window.innerWidth < number(element, 'minWidth', 0)) continue; // e.g. data-min-width="768" for desktop-only motion
      const trigger = element.closest('[data-scroll-zone]') || element;
      const start = element.dataset.start || (mode === 'reveal' ? 'top 88%' : 'top bottom');

      if (mode === 'reveal') {
        let targets = [element];
        if (element.dataset.children) {
          try { targets = [...element.querySelectorAll(element.dataset.children)]; }
          catch { console.warn('Invalid data-children selector; skipping effect.'); continue; }
        }
        if (!targets.length) continue;
        const once = element.dataset.once !== 'false';
        gsap.fromTo(targets,
          { y: number(element, 'distance', 28), autoAlpha: 0 },
          {
            y: 0, autoAlpha: 1,
            duration: clamp(number(element, 'duration', 0.7), 0.05, 5),
            stagger: clamp(number(element, 'stagger', 0.08), 0, 1),
            ease: 'power2.out',
            scrollTrigger: {
              trigger: element.dataset.children ? element : trigger, start, once,
              toggleActions: once ? 'play none none none' : 'play none none reverse'
            }
          });
      } else if (mode === 'words') {
        // Headline words rise out of a mask, one after another.
        const words = splitWords(element);
        if (!words.length) continue;
        const span = clamp(0.8 / words.length, 0.02, 0.09);
        gsap.from(words, {
          yPercent: 118, duration: 1, ease: 'power4.out', stagger: span,
          scrollTrigger: { trigger: element, start: element.dataset.start || 'top 88%', once: true }
        });
      } else if (mode === 'wipe') {
        // An image is uncovered from the bottom while the picture inside settles from a slight zoom.
        const inner = element.querySelector('img');
        // Keep the element's own rounded corners while it is being uncovered.
        const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
        const round = radius ? ` round ${radius}px` : '';
        gsap.fromTo(element, { clipPath: `inset(100% 0% 0% 0%${round})` }, {
          clipPath: `inset(0% 0% 0% 0%${round})`, ease: 'none',
          scrollTrigger: { trigger: element, start: element.dataset.start || 'top 94%', end: element.dataset.end || 'top 42%', scrub: 0.5 }
        });
        if (inner && !('noZoom' in element.dataset)) gsap.fromTo(inner, { scale: 1.3 }, {
          scale: 1, ease: 'none',
          scrollTrigger: { trigger: element, start: 'top 94%', end: 'bottom 30%', scrub: 0.5 }
        });
      } else if (mode === 'chat') {
        // Messages arrive one at a time like a real chat: ours pop in, then "typing…" before each reply.
        const items = [...element.children];
        const typing = items.find(item => 'typing' in item.dataset);
        const messages = items.filter(item => item !== typing);
        if (!messages.length) continue;
        // The chat box has a fixed height and scrolls inside: each message is added at the bottom and the
        // conversation glides up to show it, with "typing…" just below the last message before each reply.
        gsap.set(items, { display: 'none' });
        const timeline = gsap.timeline({ paused: true });
        const toBottom = () => gsap.to(element, { scrollTop: element.scrollHeight - element.clientHeight, duration: 0.45, ease: 'power2.out', overwrite: true });
        const pop = (item, at) => timeline
          .set(item, { display: '' }, at)
          .call(toBottom, null, '<')
          .fromTo(item, { scale: 0.6, autoAlpha: 0, y: 12 }, { scale: 1, autoAlpha: 1, y: 0, duration: 0.42, ease: 'back.out(1.7)', immediateRender: false }, '<');
        const hideTyping = () => timeline
          .to(typing, { autoAlpha: 0, scale: 0.8, duration: 0.15 }, '+=0.9')
          .set(typing, { display: 'none' });
        messages.forEach((item, i) => {
          if ('me' in item.dataset) { pop(item, i ? '+=0.7' : 0); return; }
          if (typing) { pop(typing, '+=0.35'); hideTyping(); }
          pop(item, '>');
        });
        if (typing) pop(typing, '+=0.6');
        ScrollTrigger.create({ trigger: element, start: element.dataset.start || 'top 75%', once: true, onEnter: () => timeline.play() });
      } else if (mode === 'curtain') {
        // A coloured panel opens from rounded, inset edges to full width as it arrives.
        gsap.fromTo(element, { clipPath: 'inset(0% 5% 0% 5% round 44px)' }, {
          clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: element, start: 'top bottom', end: 'top 30%', scrub: 0.4 }
        });
      } else if (mode === 'stack') {
        // Cards pin near the top (CSS sticky) while the next one slides over; the card underneath recedes.
        const cards = [...element.querySelectorAll('[data-stack-card]')];
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          gsap.to(card, {
            scale: 0.93, ease: 'none', transformOrigin: 'center top',
            scrollTrigger: { trigger: next, start: 'top 88%', end: 'top 22%', scrub: true }
          });
        });
      } else if (mode === 'draw') {
        // A divider line is drawn across, left to right (see [data-scroll=draw] in site.css).
        gsap.fromTo(element, { '--draw': 0 }, {
          '--draw': 1, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 90%', once: true }
        });
      } else if (mode === 'scrub') {
        const from = {};
        const to = {};
        const properties = { X: 'x', Y: 'y', Rotate: 'rotation', Scale: 'scale', Opacity: 'opacity' };
        for (const [attribute, property] of Object.entries(properties)) {
          const fromKey = `from${attribute}`;
          const toKey = `to${attribute}`;
          if (!(fromKey in element.dataset) && !(toKey in element.dataset)) continue;
          const fallback = property === 'scale' || property === 'opacity' ? 1 : 0;
          let a = number(element, fromKey, fallback);
          let b = number(element, toKey, fallback);
          if (property === 'scale') { a = clamp(a, 0.05, 10); b = clamp(b, 0.05, 10); }
          if (property === 'opacity') { a = clamp(a, 0, 1); b = clamp(b, 0, 1); }
          from[property] = a;
          to[property] = b;
        }
        if (!Object.keys(from).length) continue;
        const smoothing = clamp(number(element, 'scrub', 0.6), 0, 3);
        gsap.fromTo(element, from, {
          ...to, ease: 'none',
          scrollTrigger: {
            trigger, start, end: element.dataset.end || 'bottom top',
            scrub: smoothing === 0 ? true : smoothing, invalidateOnRefresh: true
          }
        });
      }
    }

    // Story: the panel opens from rounded, inset edges to full width as it arrives.
    const story = root.querySelector('[data-story]');
    const panel = story?.querySelector('[data-story-panel]');
    const copy = story?.querySelector('[data-story-copy]');
    if (panel) {
      gsap.fromTo(panel,
        { clipPath: 'inset(0% 5% 0% 5% round 44px)' },
        {
          clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: story, start: 'top bottom', end: 'top 25%', scrub: 0.4 }
        });
    }
    // Words start dim and brighten in sequence while the copy scrolls through the screen.
    if (copy) {
      const words = [];
      const original = copy.innerHTML;
      const split = node => [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = part;
            words.push(span);
            frag.append(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) split(child);
      });
      split(copy);
      if (words.length) {
        gsap.to(words, {
          opacity: 1, ease: 'none', stagger: 0.5,
          scrollTrigger: { trigger: copy, start: 'top 80%', end: 'bottom 55%', scrub: 0.4 }
        });
      }
      return () => { copy.innerHTML = original; }; // Cleanup restores the plain text.
    }
  });

  const images = [...root.querySelectorAll('img')].filter(image => !image.complete);
  images.forEach(image => {
    image.addEventListener('load', refresh);
    image.addEventListener('error', refresh);
  });
  if (document.fonts) document.fonts.ready.then(refresh);
  refresh();

  return {
    available: true,
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(refreshFrame);
      images.forEach(image => {
        image.removeEventListener('load', refresh);
        image.removeEventListener('error', refresh);
      });
      media.revert();
    }
  };
}

// Initialize once per page load.
window.dmEffects = initScrollEffects();
