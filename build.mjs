// Builds the static site into site/.
//   src/pages/**.html     page bodies (a JSON <!--meta {...} --> comment on line 1 sets title, description, optional "cta": false)
//   src/partials/*.html   shared pieces: head, header, footer, cta, dialog. Include one anywhere with {{> name}}
//   src/templates/service.html + src/services.json   one page per service, generated
//   src/site.json         phone, WhatsApp, URL, navigation
// Edit a partial once, run `npm run build`, and every page updates. Also writes sitemap.xml and robots.txt.
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => path.join(root, 'src', ...p);
const out = (...p) => path.join(root, 'site', ...p);
const site = JSON.parse(await readFile(src('site.json'), 'utf8'));
const services = JSON.parse(await readFile(src('services.json'), 'utf8'));
const esc = v => String(v).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// ---------- team (src/team.json). Entries with "published": false stay off the site until their bio is ready ----------
const team = JSON.parse(await readFile(src('team.json'), 'utf8')).filter(m => m.published);
const teamMembers = team.map((m, i) => `      <article class="grid items-center gap-8 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:gap-16${i % 2 ? ' md:[&>div:first-child]:order-2' : ''}" data-scroll-zone>
        <div class="relative isolate mx-auto w-full max-w-[440px] md:mx-0">
          <div class="absolute -inset-3 -z-10 ${i % 2 ? 'rotate-[3deg]' : '-rotate-[3deg]'} rounded-[36px] bg-sand" aria-hidden="true"></div>
          <div class="photo-frame" data-scroll="wipe"><img class="photo-blend" src="/assets/team/${esc(m.photo)}" width="900" height="1125" alt="${esc(m.alt)}" loading="lazy"></div>
        </div>
        <div>
          <h3 data-scroll="words" class="m-0 font-display text-[clamp(38px,4.4vw,60px)] font-bold leading-[1] tracking-[-0.02em]">${esc(m.name)}</h3>
          ${m.role ? `<p class="m-0 mt-3 text-[15px] text-muted">${esc(m.role)}</p>` : ''}
          ${m.quote ? `<blockquote class="m-0 mt-7 border-l-2 border-bronze pl-5 font-display text-[clamp(22px,2.2vw,28px)] italic leading-[1.3]">“${esc(m.quote)}”</blockquote>` : ''}
          <div class="mt-7 max-w-[54ch] text-[17px] leading-[1.75] text-muted">${m.bio.map(p => `<p class="m-0 [&+p]:mt-4">${esc(p)}</p>`).join('')}</div>
        </div>
      </article>`).join('\n');

// ---------- partials ----------
const partials = {};
for (const f of await readdir(src('partials'))) if (f.endsWith('.html')) partials[f.slice(0, -5)] = await readFile(src('partials', f), 'utf8');
const include = tpl => {
  for (let i = 0; i < 4 && /\{\{>\s*[\w-]+\s*\}\}/.test(tpl); i++) {
    tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
      if (!(n in partials)) throw new Error(`Unknown partial {{> ${n}}}`);
      return partials[n];
    });
  }
  return tpl;
};
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));

// ---------- work (client projects). Empty list = no Our Work page, nav link or home teaser ----------
const work = JSON.parse(await readFile(src('work.json'), 'utf8'));
const categories = Object.fromEntries(services.map(s => [s.slug, s.title]));
const hasWork = work.length > 0;
for (const w of work) if (!categories[w.category]) throw new Error(`work.json: "${w.title}" has unknown category "${w.category}"`);
const workCard = (w, i, big) => {
  const img = w.image ? `<img class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" src="/assets/work/${esc(w.image)}" alt="${esc(w.alt || w.title)}" loading="lazy" width="1200" height="${big ? 900 : 1200}">` : '';
  const tag = w.url ? 'a' : 'div';
  const attrs = w.url ? ` href="${esc(w.url)}" target="_blank" rel="noopener"` : '';
  return `        <li data-work-category="${esc(w.category)}" class="${big ? 'md:col-span-2' : ''}">
          <${tag} class="group block no-underline"${attrs}>
            <div class="${big ? 'aspect-[16/10]' : 'aspect-[4/5]'} overflow-hidden rounded-[22px] bg-sand">${img}</div>
            <p class="m-0 mt-4 text-sm text-muted">${esc(categories[w.category])}</p>
            <h3 class="m-0 mt-1 font-display text-[28px] font-bold leading-[1.1]">${esc(w.title)}${w.client ? ` <span class="font-normal text-muted">for ${esc(w.client)}</span>` : ''}</h3>
            ${w.summary ? `<p class="m-0 mt-2 max-w-[56ch] text-[17px] leading-[1.65] text-muted">${esc(w.summary)}</p>` : ''}
          </${tag}>
        </li>`;
};
const workGrid = `      <ul class="m-0 grid list-none gap-x-8 gap-y-14 p-0 md:grid-cols-2" data-work-grid>\n${work.map((w, i) => workCard(w, i, i === 0)).join('\n')}\n      </ul>`;
const usedCategories = [...new Set(work.map(w => w.category))];
const workFilters = `      <div class="flex flex-wrap gap-3" role="group" aria-label="Filter our work">\n        <button type="button" class="chip" data-work-filter="all" aria-pressed="true">All work</button>\n${usedCategories.map(c => `        <button type="button" class="chip" data-work-filter="${esc(c)}" aria-pressed="false">${esc(categories[c])}</button>`).join('\n')}\n      </div>`;
const workTeaser = hasWork ? `    <section class="wrap py-[clamp(72px,9vw,128px)]" aria-labelledby="work-teaser-heading" data-scroll-zone>
      <h2 id="work-teaser-heading" class="mb-10 max-w-[14ch] font-display text-[clamp(40px,5vw,72px)] font-bold leading-[1] tracking-[-0.02em]" data-scroll="words">Less talk. More work.</h2>
      <ul class="m-0 grid list-none gap-x-8 gap-y-12 p-0 md:grid-cols-3">
${work.slice(0, 3).map(w => workCard(w, 0, false).replace(' class="">', '>').replace(' class="">', '>')).join('\n')}
      </ul>
      <p class="mt-10"><a class="link" href="/work/">See all our work <span aria-hidden="true">↗</span></a></p>
    </section>` : '';

// ---------- case studies (src/clients.json): one card per client at /case-studies/, a full page per client ----------
// A client: { "slug", "name", "url", "industry", "location", "intro", "cover": { "image", "alt" },
//   "profiles": [{ "platform", "url" }], "hidden": true to keep it out until it is ready, "pending": true to show it
//   with "follows shortly" panels where pictures are missing (the page stays out of Google until pending is removed),
//   "work": [{ "type": website | logo | print | social | seo, "title", "summary", "facts": { "Label": "value" },
//     "before"/"after": { "image", "alt" }, "images": [{ "image", "alt", "caption", "label" }], "scores" (seo only) }] }.
// The type fixes the layout and the order on the page, so every client looks the same. The full template, image sizes
// and copy rules are in docs/case-study-template.md; case-images.mjs makes the standard logo panels and campaign cards.
// Pictures live in site/assets/clients/<slug>/. Links to the client's site and pages are normal followed links, so
// every case study gives the client a backlink. With no visible clients there is no page, menu link or sitemap entry.
const clients = JSON.parse(await readFile(src('clients.json'), 'utf8')).clients.filter(c => c.slug && c.name && !c.hidden);
const liveExample = ex => ex && (!ex.href.startsWith('/case-studies/') || clients.some(c => ex.href === `/case-studies/${c.slug}/`));
const hasGallery = clients.length > 0;
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* without sharp, images are built without width/height */ }
const imageSize = async file => {
  if (!sharp) return '';
  try { const m = await sharp(file).metadata(); return ` width="${m.width}" height="${m.height}"`; } catch { return ''; }
};
const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const serviceBySlug = Object.fromEntries(services.map(s => [s.slug, s]));
// One block of work on a client page. Every type uses the same two columns: title, facts and text on the left, the
// pictures on the right. The work "type" decides only how the pictures sit, so every client page looks the same. Types, in the order they appear on a page (see docs/case-study-template.md):
const workTypes = {
  website: { service: 'web-design', beside: true },        // before/after of the home page (same crop), side by side
  logo: { service: 'graphic-design', beside: true },       // before/after logo panels (case-images.mjs logo), side by side
  print: { service: 'graphic-design', beside: true },      // cards, signatures, brochures: one row, every picture the same height
  social: { service: 'social-media-marketing', beside: true }, // campaign cards (case-images.mjs card) in a grid, platforms listed
  photo: { service: 'social-media-marketing', beside: true },  // product and event photos, reel stills: a grid of square-ish shots
  seo: { service: 'seo', beside: true },                   // score table, then the screenshots in one row
};
const typeOrder = Object.keys(workTypes);
const workOf = c => [...c.work].filter(w => workTypes[w.type]).sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type));
const clientServices = c => [...new Set(workOf(c).map(w => w.service || workTypes[w.type].service))].map(slug => serviceBySlug[slug]).filter(Boolean);
const clientImg = async (c, it, extra = '') => {
  const url = `/assets/clients/${c.slug}/${it.image}`;
  return `<img class="block h-auto w-full${extra}" src="${esc(url)}"${await imageSize(out('assets', 'clients', c.slug, it.image))} alt="${esc(it.alt)}" loading="lazy">`;
};
// A picture that opens bigger in the viewer (gallery.js).
const zoomable = async (c, it, cls = '', pill = '') => `<button class="gallery-open group relative block w-full overflow-hidden border-0 bg-sand p-0 text-left ${cls}" type="button" data-full="${esc(`/assets/clients/${c.slug}/${it.image}`)}" data-caption="${esc([pill, it.caption?.replace(/\.$/, '')].filter(Boolean).join(': ') || it.alt)}" aria-label="Enlarge: ${esc(it.alt)}">
                ${await clientImg(c, it, ' transition-transform duration-500 group-hover:scale-[1.02]')}${pill ? `
                <span class="photo-pill" aria-hidden="true">${esc(pill)}</span>` : ''}
              </button>`;
const profileLinks = c => (c.profiles || []).filter(p => p.platform && p.url).map(p => `<a class="underline decoration-bronze/60 underline-offset-4 hover:decoration-ink" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.platform)}</a>`).join(', ');
const factList = rows => rows.length ? `<dl class="case-facts">
${rows.map(([k, v]) => `            <div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
          </dl>` : '';
// Stand-in for pictures that have not arrived yet (clients marked "pending").
const pendingPanel = text => `<div class="case-pending"><img src="/assets/favicon.svg" width="40" height="40" alt=""><p>${esc(text)}</p></div>`;
const siteLink = c => c.url ? `<a class="link" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(domainOf(c.url))} <span aria-hidden="true">↗</span></a>` : '';

// Landing page: one row per client, picture on one side and the summary on the other (sides alternate).
const clientRows = (await Promise.all(clients.map(async (c, i) => `      <article class="client-row grid gap-8 border-t border-line py-[clamp(40px,6vw,80px)] ${i % 2 ? 'md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'} md:items-center md:gap-14">
        <a class="client-cover group block overflow-hidden rounded-[22px] bg-sand${i % 2 ? ' md:order-2' : ''}" href="/case-studies/${esc(c.slug)}/" tabindex="-1" aria-hidden="true">
          ${c.cover ? await clientImg(c, c.cover, ' transition-transform duration-700 group-hover:scale-[1.03]') : `<span class="case-pending case-pending-cover"><img src="/assets/favicon.svg" width="40" height="40" alt=""><span>Pictures follow shortly</span></span>`}
        </a>
        <div>
          <h2 class="m-0 font-display text-[clamp(38px,4.6vw,64px)] font-bold leading-[1] tracking-[-0.02em]"><a class="no-underline hover:underline hover:decoration-bronze/60 hover:underline-offset-8" href="/case-studies/${esc(c.slug)}/">${esc(c.name)}</a></h2>
          ${c.industry ? `<p class="m-0 mt-3 text-[15px] text-muted">${esc(c.industry)}</p>` : ''}
          ${c.intro ? `<p class="m-0 mt-5 max-w-[48ch] text-[17px] leading-[1.7]">${esc(c.intro)}</p>` : ''}
          <ul class="m-0 mt-6 flex list-none flex-wrap gap-2 p-0" aria-label="What we did">
${clientServices(c).map(s => `            <li class="service-tag">${esc(s.title)}</li>`).join('\n')}
          </ul>
          <p class="m-0 mt-8 flex flex-wrap items-center gap-x-8 gap-y-3"><a class="btn" href="/case-studies/${esc(c.slug)}/">See the work<span class="sr-only"> for ${esc(c.name)}</span></a>${siteLink(c)}</p>
        </div>
      </article>`))).join('\n');

const ratio = async (c, it) => {
  if (!sharp) return 1;
  try { const m = await sharp(out('assets', 'clients', c.slug, it.image)).metadata(); return Math.round((m.width / m.height) * 100) / 100; } catch { return 1; }
};
const workBlock = async (c, w, i) => {
  const s = serviceBySlug[w.service || workTypes[w.type].service];
  const rows = Object.entries(w.facts || {}).filter(([, v]) => v).map(([k, v]) => [k, esc(v)]);
  if (w.type === 'social' && profileLinks(c)) rows.unshift([c.profiles.length > 1 ? 'Platforms' : 'Platform', profileLinks(c)]);
  if (s) rows.unshift(['Service', `<a class="underline decoration-bronze/60 underline-offset-4 hover:decoration-ink" href="/services/${esc(s.slug)}/">${esc(s.title)}</a>`]);
  const images = w.images || [];
  const pic = (it, round = 'rounded-[18px] case-shot', extra = '') => zoomable(c, it, round + extra, it.label);
  const parts = [];
  // Before/after pair (website, logo): before above after, each panel the same size.
  if (w.before && w.after) {
    parts.push(`<div class="grid max-w-[420px] gap-4">
          ${await zoomable(c, w.before, 'rounded-[18px] case-shot', 'Before')}
          ${await zoomable(c, w.after, 'rounded-[18px] case-shot', 'After')}
        </div>`);
  }
  // Score table (seo).
  if (w.scores?.rows?.length) {
    const sc = w.scores;
    const cell = (b, a) => `<td><span class="text-muted">${esc(b)}</span> <span aria-hidden="true">→</span><span class="sr-only"> to </span> <strong class="${a > b ? 'score-up' : ''}">${esc(a)}</strong></td>`;
    parts.push(`<div class="score-table-wrap">
          <table class="score-table">
            <caption>${esc(sc.source || 'Scores')}, before and after</caption>
            <thead><tr><th scope="col"><span class="sr-only">Score</span></th>${sc.rows.map(r => `<th scope="col">${esc(r.label)}</th>`).join('')}</tr></thead>
            <tbody>
${sc.columns.map((h, k) => `              <tr><th scope="row">${esc(h)}</th>${sc.rows.map(r => cell(r.before[k], r.after[k])).join('')}</tr>`).join('\n')}
            </tbody>
          </table>
        </div>`);
  }
  if (images.length) {
    if (w.type === 'social') {
      // Campaign cards: a tidy grid of small portrait cards.
      parts.push(`<div class="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4">
          ${(await Promise.all(images.map(it => pic(it, 'rounded-[12px]')))).join('\n          ')}
        </div>`);
    } else if (w.type === 'photo') {
      // Photos and reel stills: square-ish shots, three across on wider screens.
      parts.push(`<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          ${(await Promise.all(images.map(it => pic(it, 'rounded-[12px]')))).join('\n          ')}
        </div>`);
    } else if (w.type === 'logo' && !(w.before && w.after)) {
      // A logo with no "before": the new logo panels stacked, same size as a before/after pair.
      parts.push(`<div class="grid max-w-[420px] gap-4">
          ${(await Promise.all(images.map(it => pic(it)))).join('\n          ')}
        </div>`);
    } else if (w.type === 'print') {
      // Print pieces, stacked like a before/after pair: landscape pieces (signatures) take the full width, portrait
      // pieces (business cards) sit two across underneath.
      const ratios = await Promise.all(images.map(it => ratio(c, it)));
      parts.push(`<div class="grid max-w-[420px] grid-cols-2 items-start gap-4">
          ${(await Promise.all(images.map((it, k) => pic(it, 'rounded-[14px] case-shot', ratios[k] > 1 ? ' col-span-2' : '')))).join('\n          ')}
        </div>`);
    } else {
      // Screenshots (seo): one row where every picture has the same height. Column widths follow each picture's
      // shape; on phones they wrap two across.
      const ratios = await Promise.all(images.map(it => ratio(c, it)));
      const cols = ratios.map(r => `${r}fr`).join('_');
      parts.push(`<div class="grid grid-cols-2 items-start gap-3 md:grid-cols-[${cols}] md:gap-4">
          ${(await Promise.all(images.map((it, k) => pic(it, 'rounded-[14px] case-shot', ratios[k] > 1.2 && ratios.some(x => x < 1) ? ' col-span-2 md:col-span-1' : '')))).join('\n          ')}
        </div>`);
    }
  }
  if (!parts.length && c.pending) parts.push(pendingPanel('Pictures of this work follow shortly.'));
  const id = `${w.type}-${i + 1}`;
  if (workTypes[w.type].beside && parts.length) {
    return `    <section id="${esc(id)}" class="gallery-section wrap border-t border-line py-[clamp(48px,6vw,88px)]" aria-labelledby="${esc(id)}-heading" data-scroll-zone>
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <div>
          <h2 id="${esc(id)}-heading" class="m-0 font-display text-[clamp(34px,4vw,54px)] font-bold leading-[1] tracking-[-0.02em]" data-scroll="words">${esc(w.title)}</h2>
          ${factList(rows)}
          ${w.summary ? `<p class="m-0 mt-5 max-w-[52ch] text-[17px] leading-[1.7] text-muted">${esc(w.summary)}</p>` : ''}
        </div>
        <div class="grid content-start gap-5">
          ${parts.join('\n          ')}
        </div>
      </div>
    </section>`;
  }
  return `    <section id="${esc(id)}" class="gallery-section wrap border-t border-line py-[clamp(48px,6vw,88px)]" aria-labelledby="${esc(id)}-heading" data-scroll-zone>
      <div class="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        <h2 id="${esc(id)}-heading" class="m-0 font-display text-[clamp(34px,4vw,54px)] font-bold leading-[1] tracking-[-0.02em]" data-scroll="words">${esc(w.title)}</h2>
        <div>
          ${w.summary ? `<p class="m-0 max-w-[56ch] text-[18px] leading-[1.7]">${esc(w.summary)}</p>` : ''}
          ${factList(rows)}
        </div>
      </div>${parts.length ? `
      <div class="case-media mt-10 grid gap-5">
        ${parts.join('\n        ')}
      </div>` : ''}
    </section>`;
};
const lightbox = `  <dialog class="lightbox" aria-label="Picture viewer">
    <button class="lightbox-close" type="button" aria-label="Close">×</button>
    <button class="lightbox-step lightbox-prev" type="button" aria-label="Previous picture">←</button>
    <figure class="m-0"><img alt=""><figcaption></figcaption></figure>
    <button class="lightbox-step lightbox-next" type="button" aria-label="Next picture">→</button>
  </dialog>
  <script src="/gallery.js" defer></script>`;
// Line icons for the platforms a service card lists ("platforms" in services.json), drawn in the footer icon style.
const platformIcons = {
  instagram: { name: 'Instagram', svg: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>' },
  facebook: { name: 'Facebook', svg: '<circle cx="12" cy="12" r="8.5"/><path d="M13.3 20.4v-10a2.3 2.3 0 0 1 2.3-2.3h1.2M10.4 13.2h5.4"/>' },
  linkedin: { name: 'LinkedIn', svg: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8.2 10.6v5.9M11.8 16.5v-5.9M11.8 13.4a2.5 2.5 0 0 1 5 0v3.1"/><circle cx="8.2" cy="7.7" r=".6" fill="currentColor"/>' },
  tiktok: { name: 'TikTok', svg: '<path d="M13.8 3.8v11a3.6 3.6 0 1 1-3.6-3.6"/><path d="M13.8 3.8c.5 2.5 2.2 4.1 4.7 4.4"/>' },
};
const ldJson = data => `  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const clientOrg = c => ({ '@type': 'Organization', name: c.name, ...(c.url && { url: c.url }), ...(c.profiles?.length && { sameAs: c.profiles.map(p => p.url) }) });
const clientPages = await Promise.all(clients.map(async c => {
  const facts = [
    c.industry && ['Industry', esc(c.industry)],
    c.location && ['Based in', esc(c.location)],
    c.url && ['Website', siteLink(c)],
    profileLinks(c) && ['Social pages', profileLinks(c)],
  ].filter(Boolean);
  const jump = workOf(c).length > 1 ? `      <nav class="mt-10 flex flex-wrap gap-3" aria-label="Gallery sections">
${workOf(c).map((w, i) => `        <a class="chip inline-flex items-center no-underline" href="#${esc(`${w.type}-${i + 1}`)}">${esc(w.title)}</a>`).join('\n')}
      </nav>` : '';
  return {
    urlPath: `/case-studies/${c.slug}/`,
    meta: { noindex: !!c.pending, title: `${c.name} case study | Digital Mom`, description: `What Digital Mom did for ${c.name}: ${clientServices(c).map(s => s.title.toLowerCase().replace('seo', 'SEO')).join(', ')}.`, cta: true },
    body: `  <main id="main">
    <section class="wrap pb-12 pt-10 md:pb-16 md:pt-16" aria-labelledby="page-title" data-scroll-zone>
      <p class="m-0 mb-8"><a class="link" href="/case-studies/"><span aria-hidden="true">←</span> All case studies</a></p>
      <div class="grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-14">
        <div>
          <h1 id="page-title" class="m-0 font-display text-[clamp(52px,9vw,120px)] font-bold leading-[.92] tracking-[-0.03em]" data-scroll="words">${esc(c.name)}</h1>
          ${c.intro ? `<p class="mb-0 mt-8 max-w-[50ch] text-lg leading-[1.7] md:text-xl">${esc(c.intro)}</p>` : ''}
        </div>
        <div>${factList(facts)}</div>
      </div>
${jump}
    </section>
${(await Promise.all(workOf(c).map((w, i) => workBlock(c, w, i)))).join('\n')}
  </main>
${ldJson({ '@context': 'https://schema.org', '@type': 'CreativeWork', name: `${c.name} case study`, url: `${site.url}/case-studies/${c.slug}/`, ...(c.intro && { description: c.intro }), creator: { '@type': 'Organization', name: 'Digital Mom', url: site.url }, about: clientOrg(c) })}
${lightbox}`,
    vars: {},
  };
}));

// ---------- client messages (src/testimonials.json) ----------
// Real quotes only, used with the client's permission: [{ "quote": "...", "name": "...", "business": "..." }].
// An empty list means no section on the home page. Three or more drift sideways in a slow loop (paused on hover,
// still for reduced motion); fewer sit in a simple row.
const testimonials = JSON.parse(await readFile(src('testimonials.json'), 'utf8')).filter(t => t.quote && t.name);
const reviewCard = t => `          <li class="review-card">
            <figure class="m-0">
              <blockquote class="m-0 text-[16px] leading-[1.6] text-ink">“${esc(t.quote)}”</blockquote>
              <figcaption class="mt-4 flex items-center gap-3">
                <span class="grid size-9 flex-none place-items-center rounded-full bg-olive text-[14px] font-semibold text-paper" aria-hidden="true">${esc(t.name.trim()[0].toUpperCase())}</span>
                <span class="leading-tight"><span class="block text-[15px] font-medium text-ink">${esc(t.name)}</span>${t.business ? `<span class="block text-[13px] text-muted">${esc(t.business)}</span>` : ''}</span>
              </figcaption>
            </figure>
          </li>`;
const loop = testimonials.length >= 3;
const reviewList = (hidden = false) => `        <ul class="review-track m-0 list-none p-0"${hidden ? ' aria-hidden="true"' : ''}>
${testimonials.map(reviewCard).join('\n')}
        </ul>`;
const testimonialsSection = testimonials.length ? `    <section class="on-olive overflow-hidden bg-olive-deep py-[clamp(64px,8vw,112px)] text-paper" aria-labelledby="reviews-heading">
      <div class="wrap mb-10 grid gap-4 md:mb-14 md:grid-cols-[1fr_auto] md:items-end md:gap-12">
        <h2 id="reviews-heading" class="m-0 max-w-[14ch] font-display text-[clamp(40px,5vw,72px)] font-bold leading-[1] tracking-[-0.02em]" data-scroll="words">What our clients are saying.</h2>
        <p class="m-0 max-w-[34ch] text-[17px] leading-[1.7] text-paper/75">Messages from the businesses we work with, shared with their permission.</p>
      </div>
      <div class="reviews${loop ? ' reviews-loop' : ' wrap'}">
${reviewList()}${loop ? '\n' + reviewList(true) : ''}
      </div>
    </section>` : '';

// ---------- generated fragments ----------
if (hasWork && !site.nav.find(i => i.href === '/work/')?.live) site.nav.find(i => i.href === '/work/').live = true;
if (hasGallery && site.nav.find(i => i.href === '/case-studies/')) site.nav.find(i => i.href === '/case-studies/').live = true;
const live = site.nav.filter(i => i.live);
const links = cls => live.map(i => `<a class="${cls}" href="${esc(i.href)}">${esc(i.label)}</a>`).join('\n');
const arrow = '<span aria-hidden="true">↗</span>';
const serviceHref = s => `/services/${s.slug}/`;
const rows = list => list.map(s => `        <li data-scroll="draw">
          <a class="group grid gap-3 py-7 no-underline transition-colors hover:bg-sand/50 md:rounded-[16px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-baseline md:gap-10 md:-mx-3 md:px-3 md:py-9" href="${serviceHref(s)}">
            <h3 data-scroll="words" class="m-0 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.01em] md:text-[34px]">${esc(s.title)}</h3>
            <p class="m-0 max-w-[52ch] text-[17px] leading-[1.65] text-muted">${esc(s.short)}</p>
            <span class="text-sm underline decoration-bronze/60 underline-offset-[6px] group-hover:decoration-ink">Read more ${arrow}</span>
          </a>
        </li>`).join('\n');
// Navigation is built per page so the current page is marked (aria-current) in the header, mobile menu and footer.
const isCurrent = (href, here) => (href === '/' ? here === '/' : here.startsWith(href));
const navLinks = (here, cls, currentCls) => live.map(i => {
  const cur = isCurrent(i.href, here);
  return `<a class="${cls}${cur ? ' ' + currentCls : ''}" href="${esc(i.href)}"${cur ? ' aria-current="page"' : ''}>${esc(i.label)}</a>`;
}).join('\n');
const navVars = here => ({
  nav_header: live.length > 1 ? `        <nav aria-label="Main navigation" class="hidden gap-7 text-[15px] lg:flex">\n${navLinks(here, 'underline-offset-[6px] hover:underline', 'underline decoration-bronze decoration-2')}\n        </nav>` : '',
  nav_mobile: navLinks(here, 'block border-t border-paper/20 py-4 font-display text-[34px] font-bold leading-none no-underline', 'text-gold'),
  nav_footer: `      <nav aria-label="Footer navigation" class="mt-5 flex flex-wrap gap-x-7 text-paper">\n${navLinks(here, 'inline-flex min-h-11 items-center no-underline hover:underline', 'text-gold')}\n      </nav>`,
});

// Home page: services as cards that stack at the top while scrolling (see data-scroll="stack"). Tablet and desktop
// only: on phones the cards are taller than the space under the header, so they simply scroll as a list.
const stackTones = [
  { card: 'bg-sand text-ink', sticky: 'md:top-[88px]' },
  { card: 'bg-olive text-paper', sticky: 'md:top-[108px]' },
  { card: 'bg-gold text-ink', sticky: 'md:top-[128px]' },
  { card: 'bg-olive-deep text-paper', sticky: 'md:top-[148px]' },
];
const servicesStack = `      <div data-scroll="stack">\n${services.map((s, i) => {
  const t = stackTones[i % stackTones.length];
  return `        <a data-stack-card class="md:sticky ${t.sticky} mb-5 block md:min-h-[min(68svh,500px)] rounded-[28px] ${t.card} p-7 no-underline md:mb-8 md:p-12" href="${serviceHref(s)}">
          <div class="grid gap-8 md:grid-cols-2 md:gap-16">
            <div>
              <span class="font-display text-[clamp(44px,5vw,64px)] font-bold leading-none opacity-55" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
              <h3 class="m-0 mt-4 font-display text-[clamp(34px,4vw,56px)] font-bold leading-[1.02] tracking-[-0.01em]">${esc(s.title)}</h3>
            </div>
            <div>
              <p class="m-0 max-w-[44ch] text-lg leading-[1.65]">${esc(s.short)}</p>
              <ul class="list-dash mt-5 max-w-[44ch]">${s.includes.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
              <span class="mt-6 inline-block text-[15px] underline decoration-current/50 underline-offset-[6px]">Read more ${arrow}</span>
            </div>
          </div>
        </a>`;
}).join('\n')}\n      </div>`;

// Google Analytics only loads after a visitor accepts cookies (consent.js). With no ga_id set, nothing loads and the CSP stays self-only.
const ga = site.ga_id ? { script: " https://www.googletagmanager.com", connect: " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com", img: " https://*.google-analytics.com https://*.googletagmanager.com" } : { script: "", connect: "", img: "" };
const csp = `default-src 'self'; script-src 'self'${ga.script}; style-src 'self'; img-src 'self'${ga.img}; font-src 'self'; connect-src 'self'${ga.connect}; form-action 'self'; base-uri 'none'; object-src 'none'`;
// Enquiry form question sets (src/enquiry.json): the topic choices, one hidden fieldset per service (contact.js opens
// the chosen one), and site/enquiry-fields.php, the same list for contact.php to check answers against.
const enquiry = JSON.parse(await readFile(src('enquiry.json'), 'utf8')).sets;
const choice = (type, name, value, label = value) => `<label class="choice"><input type="${type}" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`;
const enquiryTopics = enquiry.map(s => choice('radio', 'topic', s.key, s.label)).concat(choice('radio', 'topic', 'unsure', 'Not sure yet')).join('');
const enquirySets = enquiry.map(s => `          <fieldset class="enquiry-set" data-enquiry-set="${esc(s.key)}" data-service="${esc(s.service)}" hidden disabled>
            <legend>${esc(s.label)}: a few quick questions</legend>
${s.fields.map(f => {
  const name = `q[${s.key}][${f.name}]`;
  if (f.type === 'text') return `            <label for="q-${esc(s.key)}-${esc(f.name)}">${esc(f.label)} <span class="font-normal text-muted">(optional)</span></label>
            <input id="q-${esc(s.key)}-${esc(f.name)}" name="${name}" maxlength="200"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`;
  return `            <fieldset class="choice-group"><legend>${esc(f.label)}${f.type === 'checkbox' ? ' <span class="font-normal text-muted">(pick any)</span>' : ''}</legend><div class="choices">${f.options.map(o => choice(f.type, f.type === 'checkbox' ? `${name}[]` : name, o)).join('')}</div></fieldset>`;
}).join('\n')}
          </fieldset>`).join('\n');
const enquiryJson = JSON.stringify(enquiry.map(s => ({ key: s.key, label: s.label, fields: s.fields.map(({ name, label, type, options }) => ({ name, label, type, options: options || [] })) })));
const phpString = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
await writeFile(out('enquiry-fields.php'), `<?php\n// Written by build.mjs from src/enquiry.json. The enquiry form's question sets, for contact.php to check answers.\nreturn json_decode(${phpString(enquiryJson)}, true);\n`);
const legal = site.legal || {};
const globals = {
  csp: esc(csp), ga_id: esc(site.ga_id || ""),
  legal_entity: esc(legal.entity || site.name), legal_registration: esc(legal.registration || "[registration number to confirm]"),
  legal_address: esc(legal.address || "[business address to confirm]"), legal_email: esc(legal.email || ""),
  legal_officer: esc(legal.information_officer || ""), legal_updated: esc(legal.updated || ""),
  services_stack: servicesStack,
  testimonials: testimonialsSection,
  name: esc(site.name), phone: esc(site.phone), phone_tel: esc('tel:' + site.phone.replace(/[^+\d]/g, '')), hours: esc(site.hours), location: esc(site.location), email: esc(site.email), whatsapp: esc(site.whatsapp), whatsapp_hello: esc(site.whatsapp_hello),
  year: String(new Date().getFullYear()),
  footer_links: site.footer_links.map(i => `<a class="inline-flex min-h-11 items-center hover:underline" href="${esc(i.href)}">${esc(i.label)}</a>`)
    .concat('<button class="cookie-settings inline-flex min-h-11 items-center border-0 bg-transparent p-0 text-inherit hover:underline" type="button">Cookie settings</button>').join('\n'),
  services_rows: `      <ul class="m-0 list-none border-b border-line p-0">\n${rows(services)}\n      </ul>`,
  service_names: services.map(s => esc(s.title)).join(' / '),
  enquiry_topics: enquiryTopics, enquiry_sets: enquirySets,
  work_grid: workGrid, work_filters: workFilters, work_teaser: workTeaser, team_members: teamMembers,
};

// ---------- pages ----------
const walk = async (dir, rel = '') => {
  const found = [];
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) found.push(...await walk(dir, r));
    else if (e.name.endsWith('.html')) found.push(r);
  }
  return found;
};
const pages = [];
for (const rel of (await walk(src('pages'))).sort()) {
  const raw = await readFile(src('pages', ...rel.split('/')), 'utf8');
  const m = raw.match(/^\s*<!--meta\s*([\s\S]*?)\s*-->\s*/);
  if (!m) throw new Error(`${rel}: missing <!--meta {...} --> comment on the first line`);
  const stem = rel.replace(/\.html$/, '');
  const urlPath = stem === '404' ? '/404.html' : stem === 'index' ? '/' : stem.endsWith('/index') ? `/${stem.slice(0, -6)}/` : `/${stem}/`;
  pages.push({ urlPath, meta: JSON.parse(m[1]), body: raw.slice(m[0].length), vars: {} });
}
const serviceTpl = await readFile(src('templates', 'service.html'), 'utf8');
for (const s of services) {
  const others = services.filter(o => o.slug !== s.slug);
  pages.push({
    urlPath: serviceHref(s),
    meta: { title: `${s.page_title || s.title} | Digital Mom`, description: s.meta },
    body: serviceTpl,
    vars: {
      service_quote: esc(`/contact/?service=${s.slug}#enquiry-form`), service_title: esc(s.title), service_intro: esc(s.intro), service_fit: esc(s.fit),
      service_photo: esc(s.photo), service_photo_alt: esc(s.photo_alt),
      // The service page's WhatsApp button opens a chat with a hello that names the service.
      service_short_name: esc(s.title === 'SEO' ? 'SEO' : s.title.toLowerCase()),
      service_whatsapp: esc(`${site.whatsapp}?text=${encodeURIComponent(`Hi Digital Mom, I’d love to chat about ${s.title === 'SEO' ? 'SEO' : s.title.toLowerCase()} for my business.`)}`),
      service_includes: s.includes.map(i => `<li>${esc(i)}</li>`).join('\n            '),
      // "What we offer": the specific things this service covers (platforms, logo design, redesigns...), one row each,
      // with a link to a case study that shows it. Readable for visitors and clear for search engines.
      // An example link only shows when its case study is published (hidden clients have no page).
      service_offers: s.offers?.length ? `    <section class="wrap pb-[clamp(64px,8vw,112px)]" aria-labelledby="offers-heading" data-scroll-zone>
      <div class="grid gap-10 md:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] md:gap-20">
        <h2 id="offers-heading" data-scroll="words" class="m-0 max-w-[13ch] self-start md:sticky md:top-28 font-display text-[clamp(36px,4.6vw,64px)] font-bold leading-[1.02] tracking-[-0.02em]">${esc(s.offers_heading || 'What we offer')}</h2>
        <ul class="m-0 list-none border-b border-line p-0">
${s.offers.map(o => `          <li data-scroll="draw" class="grid gap-2 border-t border-line py-7 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] sm:gap-8">
            <h3 class="m-0 font-display text-[26px] font-bold leading-[1.1]">${esc(o.title)}</h3>
            <div>
              <p class="m-0 max-w-[52ch] text-[17px] leading-[1.7] text-muted">${esc(o.text)}</p>${o.platforms ? `
              <ul class="m-0 mt-4 flex list-none flex-wrap gap-2 p-0" aria-label="Platforms">${o.platforms.map(p => `<li class="inline-flex min-h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[14px]"><svg class="size-[18px] text-bronze" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${platformIcons[p].svg}</svg>${platformIcons[p].name}</li>`).join('')}</ul>` : ''}${liveExample(o.example) ? `
              <p class="m-0 mt-3"><a class="link" href="${esc(o.example.href)}">${esc(o.example.label)} <span aria-hidden="true">↗</span></a></p>` : ''}
            </div>
          </li>`).join('\n')}
        </ul>
      </div>
    </section>
` : '',
      service_how: s.how.map(h => `        <div data-scroll="draw" class="py-7"><h3 class="m-0 font-display text-[26px] font-bold leading-[1.1]">${esc(h.lead)}</h3><p class="mb-0 mt-2 max-w-[52ch] text-[17px] leading-[1.7] text-muted">${esc(h.text)}</p></div>`).join('\n'),
      services_others: `      <ul class="m-0 list-none border-b border-line p-0">\n${rows(others)}\n      </ul>`,
    },
  });
}

if (hasGallery) pages.push({
  urlPath: '/case-studies/',
  meta: { title: 'Case studies | Digital Mom', description: 'Client work by Digital Mom: websites, logos, social media and search, with a full case study and a link to each business.', cta: true },
  body: `  <main id="main">
    <section class="wrap pb-12 pt-14 md:pb-16 md:pt-24" aria-labelledby="page-title" data-scroll-zone>
      <h1 id="page-title" class="m-0 max-w-[13ch] font-display text-[clamp(44px,8vw,104px)] font-bold leading-[.96] tracking-[-0.03em]" data-scroll="words">Good work speaks for itself.</h1>
      <p class="mb-0 mt-8 max-w-[52ch] text-lg leading-[1.7] md:text-xl">The businesses we work with and what we made for them. Pick a client to see the full case study, from the website and logo to their social media and search.</p>
    </section>
    <div class="wrap">
${clientRows}
    </div>
  </main>
${ldJson({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Case studies', url: `${site.url}/case-studies/`, publisher: { '@type': 'Organization', name: 'Digital Mom', url: site.url }, hasPart: clients.map(c => ({ '@type': 'CreativeWork', name: `${c.name} case study`, url: `${site.url}/case-studies/${c.slug}/`, about: clientOrg(c) })) })}`,
  vars: {},
});
pages.push(...clientPages);

await rm(out('services'), { recursive: true, force: true });
await rm(out('gallery'), { recursive: true, force: true }); // old address of the case studies page
await rm(out('case-studies'), { recursive: true, force: true }); // regenerated only when src/clients.json has clients to show
await rm(out('work'), { recursive: true, force: true }); // regenerated only when src/work.json has projects
const urls = [];
// The version stamp is a fingerprint of everything that shapes the CSS and scripts (sources, this file, the site's own
// scripts), so pages only change when something really changed. That keeps the update zip (pack.mjs) small.
const stampHash = createHash('sha1');
const allFiles = async dir => (await readdir(dir, { recursive: true, withFileTypes: true })).filter(e => e.isFile()).map(e => path.join(e.parentPath ?? e.path, e.name)).sort();
for (const f of await allFiles(src())) stampHash.update(path.relative(root, f)).update(await readFile(f));
stampHash.update(await readFile(fileURLToPath(import.meta.url)));
for (const f of (await readdir(out())).filter(f => f.endsWith('.js')).sort()) stampHash.update(f).update(await readFile(out(f)));
const buildStamp = stampHash.digest('hex').slice(0, 10);
const ctaHtml = fill(include(partials.cta), globals);
for (const p of pages) {
  if (p.urlPath === '/work/' && !hasWork) continue; // no projects yet: no page, no sitemap entry
  const withCta = p.meta.cta === false ? '' : ctaHtml;
  const vars = {
    ...globals, ...navVars(p.urlPath), ...p.vars,
    title: esc(p.meta.title), description: esc(p.meta.description), og_description: esc(p.meta.og_description || p.meta.description),
    canonical: esc(site.url + p.urlPath), cta: withCta,
    robots: p.meta.noindex ? '\n  <meta name="robots" content="noindex">' : '',
  };
  // Every build stamps the site's own CSS and JS links (?v=...), so browsers and server caches fetch fresh files after an upload.
  const html = fill(include(partials.head + partials.header + p.body + partials.footer), vars)
    .replace(/(src|href)="(\/[^"?#]+\.(?:css|js))"/g, `$1="$2?v=${buildStamp}"`);
  const left = html.match(/\{\{\w+\}\}/);
  if (left) throw new Error(`${p.urlPath}: unresolved placeholder ${left[0]}`);
  const target = p.urlPath === '/' ? out('index.html') : p.urlPath.endsWith('.html') ? out(p.urlPath.slice(1)) : out(...p.urlPath.split('/').filter(Boolean), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
  if (!p.meta.noindex) urls.push(site.url + p.urlPath);
  console.log('built', p.urlPath);
}
// Maintenance page (src/maintenance.html): always built, only served to everyone while site.json "maintenance" is true.
{
  const html = fill(include(partials.head + await readFile(src('maintenance.html'), 'utf8')), {
    ...globals, title: esc(`${site.name} | New website in production`), description: esc('Digital Mom is building a new website. Send us a WhatsApp and the team will get back to you.'),
    og_description: esc('Digital Mom is building a new website. Send us a WhatsApp and the team will get back to you.'),
    canonical: esc(site.url + '/'), robots: '\n  <meta name="robots" content="noindex">',
  }).replace(/(src|href)="(\/[^"?#]+\.(?:css|js))"/g, `$1="$2?v=${buildStamp}"`);
  const left = html.match(/\{\{\w+\}\}/);
  if (left) throw new Error(`maintenance page: unresolved placeholder ${left[0]}`);
  await writeFile(out('maintenance.html'), html);
  console.log('built /maintenance.html', site.maintenance ? '(ON: every other page is blocked)' : '(off)');
}
const lastmod = new Date().toISOString().slice(0, 10); // the build date: every page is rebuilt together
await writeFile(out('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
await writeFile(out('robots.txt'), `User-agent: *\nAllow: /\nDisallow: /contact.php\n\nSitemap: ${site.url}/sitemap.xml\n`);
// Apache rules (src/htaccess). The Content-Security-Policy header matches the page meta tag, so it widens with Google Analytics too.
// With site.json "maintenance": true, every address except the maintenance page and the files it loads answers 503
// with that page (temporary, so search engines keep the site's listings).
const maintenanceRules = site.maintenance ? `
  # MAINTENANCE MODE (site.json "maintenance": true). Everything except the maintenance page and its files answers 503,
  # unless the browser holds the Team preview pass (set by preview.php). pack.mjs fills in the token in the upload zips.
  RewriteCond %{REQUEST_URI} !^/(maintenance\\.html|preview\\.php|assets/|scroll-effects\\.js|glyphs\\.js|favicon\\.ico|apple-touch-icon\\.png|robots\\.txt|\\.well-known/)
  RewriteCond %{HTTP_COOKIE} !(^|;\\s*)dm_preview={{preview_token}}(;|$)
  RewriteRule ^ - [R=503,L]
` : '';
await writeFile(out('.htaccess'), (await readFile(src('htaccess'), 'utf8')).replace('{{csp}}', csp)
  .replace('{{maintenance_rules}}\n', maintenanceRules)
  .replace('{{maintenance_error}}\n', site.maintenance ? 'ErrorDocument 503 /maintenance.html\n' : ''));
