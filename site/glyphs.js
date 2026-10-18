'use strict';
// A texture drawn on a canvas behind a section: rows of the Digital Mom clapper icon with small crop marks.
// A few icons are "exposed" (softly filled) now and then, and icons near the cursor light up as you move over them. Mark a section with data-glyphs="paper|olive|dark" (the tone of the
// background it sits on) and optionally data-glyph-mask="edges|center" (see site.css) to keep text areas clear.
// With reduced motion the sheet is drawn once and never changes.
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TONES = {
  paper: { line: '82,84,56', hi: '160,118,78', alpha: [0.08, 0.14], fill: 0.22 },
  olive: { line: '251,249,244', hi: '223,204,170', alpha: [0.08, 0.14], fill: 0.22 },
  dark: { line: '223,204,170', hi: '251,249,244', alpha: [0.1, 0.18], fill: 0.2 },
};

const ICON = new Path2D('M8.088,106.714c-0.326,-1.011 -0.595,-2.052 -0.802,-3.121l-6.791,-34.935c-2.811,-14.461 6.647,-28.483 21.108,-31.294l41.435,-8.054c0.803,-0.156 1.628,0.123 2.171,0.735c0.543,0.612 0.723,1.464 0.473,2.243l-23.563,73.414l22.654,0l25.847,-80.532c0.258,-0.804 0.933,-1.403 1.761,-1.564l33.246,-6.462c0.803,-0.156 1.628,0.123 2.171,0.735c0.543,0.612 0.723,1.464 0.473,2.243l-27.467,85.581l22.654,-0l29.752,-92.699c0.258,-0.804 0.933,-1.403 1.761,-1.564l31.872,-6.195c0.803,-0.156 1.628,0.123 2.171,0.735c0.543,0.612 0.723,1.464 0.473,2.243l-29.412,91.641c-0.258,0.804 -0.933,1.403 -1.761,1.564l-18.267,3.551l87.734,0c14.686,-0 26.609,11.923 26.609,26.609l0,113.088c-0,14.686 -11.923,26.609 -26.609,26.609l-193.296,0c-14.686,-0 -26.609,-11.923 -26.609,-26.609l0,-113.088c0,-1.136 0.071,-2.256 0.21,-3.355l0,-21.517Zm165.793,73.586l-63.191,-36.986c-2.691,-1.575 -6.02,-1.59 -8.725,-0.039c-2.705,1.551 -4.374,4.431 -4.374,7.55l0,73.973c-0,3.119 1.669,5.999 4.374,7.55c2.705,1.551 6.034,1.536 8.725,-0.039l63.191,-36.986c2.668,-1.561 4.307,-4.42 4.307,-7.511c0,-3.091 -1.639,-5.95 -4.307,-7.511Zm40.386,-178.693c0.306,-0.953 1.189,-1.602 2.19,-1.607c12.473,0.063 23.598,8.907 26.068,21.612l6.791,34.935c2.811,14.461 -6.647,28.483 -21.108,31.294l-40.547,7.882c-0.803,0.156 -1.628,-0.123 -2.171,-0.735c-0.543,-0.612 -0.723,-1.464 -0.473,-2.243l29.251,-91.138Z');
const rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function setup(box, index) {
  const tone = TONES[box.dataset.glyphs] || TONES.paper;
  const canvas = document.createElement('canvas');
  canvas.className = 'glyph-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  box.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let cells = [], cw = 76, ch = 92, w = 0, h = 0, dpr = 1;
  let boost = new Float32Array(0), active = new Set(), visible = false, frame = 0, nextPulse = 0;

  const draw = i => {
    const c = cells[i];
    const b = boost[i];
    ctx.clearRect(c.x - cw / 2, c.y - ch / 2, cw, ch);
    const color = b > 0.02 ? tone.hi : tone.line;
    if (c.t === 'cross') {
      ctx.strokeStyle = `rgba(${color},${(c.a * 0.9 + b * 0.4).toFixed(3)})`;
      ctx.lineWidth = 1;
      const s = 6;
      ctx.beginPath();
      ctx.moveTo(c.x - s, c.y); ctx.lineTo(c.x + s, c.y);
      ctx.moveTo(c.x, c.y - s); ctx.lineTo(c.x, c.y + s);
      ctx.stroke();
      return;
    }
    // the Digital Mom clapper icon (outline), tilted a little; it fills softly when "exposed"
    const sc = (cw * 0.3) / 255;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(sc, sc);
    ctx.translate(-127.5, -136);
    if (b > 0.02) {
      ctx.fillStyle = `rgba(${tone.hi},${(b * tone.fill).toFixed(3)})`;
      ctx.fill(ICON, 'evenodd');
    }
    ctx.strokeStyle = `rgba(${color},${(c.a + b * 0.35).toFixed(3)})`;
    ctx.lineWidth = 1.4 / sc;
    ctx.lineJoin = 'round';
    ctx.stroke(ICON);
    ctx.restore();
  };

  const build = () => {
    w = box.clientWidth; h = box.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    [cw, ch] = w < 700 ? [96, 116] : [132, 156];
    const rand = rng(2000 + index * 131);
    cells = [];
    for (let y = ch / 2; y < h + ch; y += ch) {
      for (let x = cw / 2; x < w + cw; x += cw) {
        const roll = rand();
        const a = tone.alpha[0] + rand() * (tone.alpha[1] - tone.alpha[0]);
        if (roll < 0.32) cells.push({ x, y, t: 'frame', a, rot: (rand() - 0.5) * 0.3 });
        else cells.push({ x, y, t: 'empty', a });
      }
    }
    cells = cells.filter(c => c.t !== 'empty');
    boost = new Float32Array(cells.length);
    active.clear();
    for (let i = 0; i < cells.length; i++) draw(i);
  };

  const tick = now => {
    frame = 0;
    if (!visible) return;
    if (now > nextPulse && cells.length) {
      const i = Math.floor(Math.random() * cells.length);
      if (cells[i].t === 'frame') { boost[i] = Math.max(boost[i], 0.9); active.add(i); }
      nextPulse = now + 500 + Math.random() * 900;
    }
    for (const i of active) {
      boost[i] *= 0.955;
      if (boost[i] < 0.02) { boost[i] = 0; active.delete(i); }
      draw(i);
    }
    frame = requestAnimationFrame(tick);
  };
  const start = () => { if (!REDUCE && visible && !frame) frame = requestAnimationFrame(tick); };

  if (!REDUCE) {
    box.addEventListener('pointermove', event => {
      if (!cells.length) return;
      const rect = box.getBoundingClientRect();
      const px = event.clientX - rect.left, py = event.clientY - rect.top, radius = 130;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].t !== 'frame') continue;
        const dx = cells[i].x - px, dy = cells[i].y - py;
        if (dx > radius || dx < -radius || dy > radius || dy < -radius) continue;
        const d = Math.hypot(dx, dy);
        if (d < radius) { boost[i] = Math.max(boost[i], 1 - d / radius); active.add(i); }
      }
      start();
    }, { passive: true });
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); }, { rootMargin: '100px' }).observe(box);
  }

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(build, 120); }).observe(box);
  build();
}

document.querySelectorAll('[data-glyphs]').forEach(setup);
