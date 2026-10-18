// Builds the static site: src/pages/*.html + src/partials/*.html -> site/**/index.html, plus sitemap.xml and robots.txt.
// Edit the header, footer or contact dialog once in src/partials and every page updates on the next build.
// Page meta lives in a JSON comment on the first line of each page: <!--meta {"title":"...","description":"..."} -->
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => path.join(root, 'src', ...p);
const out = (...p) => path.join(root, 'site', ...p);
const site = JSON.parse(await readFile(src('site.json'), 'utf8'));
const esc = v => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));

const live = site.nav.filter(i => i.live);
const links = cls => live.map(i => `<a class="${cls}" href="${esc(i.href)}">${esc(i.label)}</a>`).join('\n');
const nav = {
  nav_header: live.length > 1 ? `        <nav aria-label="Main navigation" class="hidden gap-7 text-[15px] md:flex">\n${links('underline-offset-[6px] hover:underline')}\n        </nav>` : '',
  nav_footer: live.length > 1 ? `      <nav aria-label="Footer navigation" class="flex flex-wrap gap-x-6">\n${links('inline-flex min-h-11 items-center hover:underline')}\n      </nav>` : '',
};
const globals = { name: esc(site.name), phone: esc(site.phone), whatsapp: esc(site.whatsapp), whatsapp_hello: esc(site.whatsapp_hello), ...nav };

const [head, header, footer] = await Promise.all(['head', 'header', 'footer'].map(n => readFile(src('partials', `${n}.html`), 'utf8')));
const files = (await readdir(src('pages'))).filter(f => f.endsWith('.html')).sort();
const urls = [];

for (const file of files) {
  const raw = await readFile(src('pages', file), 'utf8');
  const m = raw.match(/^\s*<!--meta\s*([\s\S]*?)\s*-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--meta {...} --> comment on the first line`);
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length);
  const name = file.replace(/\.html$/, '');
  const urlPath = name === 'index' ? '/' : `/${name}/`;
  const vars = {
    ...globals,
    title: esc(meta.title), description: esc(meta.description), og_description: esc(meta.og_description || meta.description),
    canonical: esc(site.url + urlPath),
  };
  const html = fill(head + header + body + footer, vars);
  const left = html.match(/\{\{\w+\}\}/);
  if (left) throw new Error(`${file}: unresolved placeholder ${left[0]}`);
  const target = name === 'index' ? out('index.html') : out(name, 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
  urls.push(site.url + urlPath);
  console.log('built', path.relative(root, target));
}

await writeFile(out('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>\n`);
await writeFile(out('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
