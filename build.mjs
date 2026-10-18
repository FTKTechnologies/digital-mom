// Builds the static site into site/.
//   src/pages/**.html     page bodies (a JSON <!--meta {...} --> comment on line 1 sets title, description, optional "cta": false)
//   src/partials/*.html   shared pieces: head, header, footer, cta, dialog. Include one anywhere with {{> name}}
//   src/templates/service.html + src/services.json   one page per service, generated
//   src/site.json         phone, WhatsApp, URL, navigation
// Edit a partial once, run `npm run build`, and every page updates. Also writes sitemap.xml and robots.txt.
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
            <div class="${big ? 'aspect-[16/10]' : 'aspect-[4/5]'} overflow-hidden bg-sand">${img}</div>
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

// ---------- generated fragments ----------
if (hasWork && !site.nav.find(i => i.href === '/work/')?.live) site.nav.find(i => i.href === '/work/').live = true;
const live = site.nav.filter(i => i.live);
const links = cls => live.map(i => `<a class="${cls}" href="${esc(i.href)}">${esc(i.label)}</a>`).join('\n');
const arrow = '<span aria-hidden="true">↗</span>';
const serviceHref = s => `/services/${s.slug}/`;
const rows = list => list.map(s => `        <li data-scroll="draw">
          <a class="group grid gap-3 py-7 no-underline transition-colors hover:bg-sand/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-baseline md:gap-10 md:-mx-3 md:px-3 md:py-9" href="${serviceHref(s)}">
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
  nav_footer: `      <nav aria-label="Footer navigation" class="flex flex-col">\n${navLinks(here, 'inline-flex min-h-11 items-center no-underline hover:underline', 'text-gold')}\n      </nav>`,
});

// Home page: services as cards that stack at the top while scrolling (see data-scroll="stack").
const stackTones = [
  { card: 'bg-sand text-ink', sticky: 'top-[88px]' },
  { card: 'bg-olive text-paper', sticky: 'top-[108px]' },
  { card: 'bg-gold text-ink', sticky: 'top-[128px]' },
  { card: 'bg-olive-deep text-paper', sticky: 'top-[148px]' },
];
const servicesStack = `      <div data-scroll="stack">\n${services.map((s, i) => {
  const t = stackTones[i % stackTones.length];
  return `        <a data-stack-card class="sticky ${t.sticky} mb-5 block min-h-[min(68svh,500px)] rounded-[28px] ${t.card} p-7 no-underline md:mb-8 md:p-12" href="${serviceHref(s)}">
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

const globals = {
  services_stack: servicesStack,
  name: esc(site.name), phone: esc(site.phone), whatsapp: esc(site.whatsapp), whatsapp_hello: esc(site.whatsapp_hello),
  year: String(new Date().getFullYear()),
  footer_links: site.footer_links.map(i => `<a class="inline-flex min-h-11 items-center hover:underline" href="${esc(i.href)}">${esc(i.label)}</a>`).join('\n'),
  services_rows: `      <ul class="m-0 list-none border-b border-line p-0">\n${rows(services)}\n      </ul>`,
  service_names: services.map(s => esc(s.title)).join(' / '),
  service_options: services.map(s => `<option>${esc(s.title)}</option>`).concat(['<option>Not sure yet</option>', '<option>Something else</option>']).join(''),
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
  const urlPath = stem === 'index' ? '/' : stem.endsWith('/index') ? `/${stem.slice(0, -6)}/` : `/${stem}/`;
  pages.push({ urlPath, meta: JSON.parse(m[1]), body: raw.slice(m[0].length), vars: {} });
}
const serviceTpl = await readFile(src('templates', 'service.html'), 'utf8');
for (const s of services) {
  const others = services.filter(o => o.slug !== s.slug);
  pages.push({
    urlPath: serviceHref(s),
    meta: { title: `${s.title} | Digital Mom`, description: s.meta },
    body: serviceTpl,
    vars: {
      service_title: esc(s.title), service_intro: esc(s.intro), service_fit: esc(s.fit),
      service_includes: s.includes.map(i => `<li>${esc(i)}</li>`).join('\n            '),
      service_how: s.how.map(h => `        <div data-scroll="draw" class="py-7"><h3 class="m-0 font-display text-[26px] font-bold leading-[1.1]">${esc(h.lead)}</h3><p class="mb-0 mt-2 max-w-[52ch] text-[17px] leading-[1.7] text-muted">${esc(h.text)}</p></div>`).join('\n'),
      services_others: `      <ul class="m-0 list-none border-b border-line p-0">\n${rows(others)}\n      </ul>`,
    },
  });
}

await rm(out('services'), { recursive: true, force: true });
await rm(out('work'), { recursive: true, force: true }); // regenerated only when src/work.json has projects
const urls = [];
const ctaHtml = fill(include(partials.cta), globals);
for (const p of pages) {
  if (p.urlPath === '/work/' && !hasWork) continue; // no projects yet: no page, no sitemap entry
  const withCta = p.meta.cta === false ? '' : ctaHtml;
  const vars = {
    ...globals, ...navVars(p.urlPath), ...p.vars,
    title: esc(p.meta.title), description: esc(p.meta.description), og_description: esc(p.meta.og_description || p.meta.description),
    canonical: esc(site.url + p.urlPath), cta: withCta,
  };
  const html = fill(include(partials.head + partials.header + p.body + partials.footer), vars);
  const left = html.match(/\{\{\w+\}\}/);
  if (left) throw new Error(`${p.urlPath}: unresolved placeholder ${left[0]}`);
  const target = p.urlPath === '/' ? out('index.html') : out(...p.urlPath.split('/').filter(Boolean), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
  urls.push(site.url + p.urlPath);
  console.log('built', p.urlPath);
}
await writeFile(out('sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join('')}</urlset>\n`);
await writeFile(out('robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
