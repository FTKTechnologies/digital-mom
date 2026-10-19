// Prepares case-study pictures in the house sizes, so every client page looks the same (docs/case-study-template.md).
// Output goes to site/assets/clients/<client-slug>/<name>.jpg.
//
//   node case-images.mjs logo  <source> <client-slug>/<name>   logo on a white 1200 x 675 panel (logo-before, logo-after)
//   node case-images.mjs card  <source> <client-slug>/<name>   social card, 720 wide (social-card-1, social-card-2...)
//   node case-images.mjs shot  <source> <client-slug>/<name>   screenshot or print piece, at most 1600 wide
//   node case-images.mjs sheet <source> <client-slug> <cols> <rows> <count>
//                                                         cut a campaign master sheet (cards on white) into social-card-N
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const [kind, source, target, ...rest] = process.argv.slice(2);
const outPath = name => path.join(root, 'site', 'assets', 'clients', ...`${name}.jpg`.split('/'));
const save = async (img, name) => {
  await mkdir(path.dirname(outPath(name)), { recursive: true });
  const info = await img.toFile(outPath(name));
  console.log(`${name}.jpg ${info.width} x ${info.height}`);
};

if (kind === 'logo') {
  // The logo sits a little above centre so the Before/After label never covers it.
  const PANEL = { width: 1200, height: 675 }, BOX = { width: 680, height: 380 }, LIFT = 40;
  const logo = await sharp(source).flatten({ background: '#ffffff' }).trim({ threshold: 10 })
    .resize(BOX.width, BOX.height, { fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  const m = await sharp(logo).metadata();
  await save(sharp({ create: { ...PANEL, channels: 3, background: '#ffffff' } })
    .composite([{ input: logo, left: Math.round((PANEL.width - m.width) / 2), top: Math.round((PANEL.height - m.height) / 2 - LIFT) }])
    .jpeg({ quality: 88, mozjpeg: true }), target);
} else if (kind === 'card') {
  await save(sharp(source).flatten({ background: '#ffffff' }).resize(720).jpeg({ quality: 80, mozjpeg: true }), target);
} else if (kind === 'shot') {
  await save(sharp(source).flatten({ background: '#ffffff' }).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }), target);
} else if (kind === 'sheet') {
  // Finds the cards on a white master sheet by its white gutters, then saves them left to right, top to bottom.
  const [cols, rows, count] = rest.map(Number);
  const { data, info } = await sharp(source).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const runs = (n, isWhite) => { const r = []; let start = null; for (let i = 0; i <= n; i++) { const w = i === n || isWhite(i); if (!w && start === null) start = i; if (w && start !== null) { if (i - start > 200) r.push([start, i]); start = null; } } return r; };
  const xs = runs(info.width, x => { for (let y = 0; y < info.height; y += 7) if (data[y * info.width + x] < 245) return false; return true; }).slice(0, cols);
  const ys = runs(info.height, y => { for (let x = 0; x < info.width; x += 5) if (data[y * info.width + x] < 245) return false; return true; }).slice(0, rows);
  const cardW = Math.min(...xs.map(([a, b]) => b - a)), cardH = Math.round(cardW * 1.25);
  let n = 0;
  for (const [y] of ys) for (const [x] of xs) {
    if (++n > count) break;
    await save(sharp(source).extract({ left: x, top: y, width: cardW, height: Math.min(cardH, info.height - y) })
      .flatten({ background: '#ffffff' }).resize(720).jpeg({ quality: 80, mozjpeg: true }), `${target}/social-card-${n}`);
  }
} else {
  console.log('Usage: node case-images.mjs logo|card|shot <source> <client-slug>/<name>, or sheet <source> <client-slug> <cols> <rows> <count>');
  process.exit(1);
}
