// Optimises project images for the Our Work page.
// Put originals (jpg, png, webp) in work-source/, run `npm run images`, and reference the output name in src/work.json
// (for example "image": "bakery-site.jpg"). Output: site/assets/work/<name>.jpg, 1200px wide max, ~80% quality.
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(root, 'work-source');
const to = path.join(root, 'site', 'assets', 'work');
await mkdir(from, { recursive: true });
await mkdir(to, { recursive: true });
const files = (await readdir(from)).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) console.log('No images found in work-source/. Add some and run again.');
for (const f of files) {
  const name = path.parse(f).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
  const info = await sharp(path.join(from, f)).rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(to, name));
  console.log(`${f} -> assets/work/${name} (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB)`);
}
