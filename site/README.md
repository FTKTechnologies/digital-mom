# Digital Mom website

Static HTML built from `../src/`. Tailwind CSS v4, self-hosted GSAP + ScrollTrigger, DM Sans and Cormorant fonts. The CSP stays `script-src 'self'`.

## Pages
Home, About, Services (plus one page each for Social Media Marketing, Web Design, SEO and Graphic Design), How we work, FAQs, Contact and Privacy. **Our Work** appears automatically (page, menu link, home teaser, sitemap) as soon as `src/work.json` contains a project.

## Edit once, change every page
- `src/partials/header.html`, `footer.html`, `cta.html` (the "Got something good going on?" band), `dialog.html` (the contact pop-up), `head.html`. Include one in a page with `{{> name}}`.
- `src/site.json`: phone, WhatsApp link, site URL, main menu (`live` shows or hides a link) and footer links.
- `src/services.json`: the four services. Edits here update the services list, every service page, the contact form's dropdown and the home page.
- `src/pages/*.html`: page content. Line 1 of each is a `<!--meta {"title":"…","description":"…"} -->` comment. Add `"cta": false` to hide the footer call-to-action band. `about.html` becomes `/about/`; `services/index.html` becomes `/services/`.
- `src/templates/service.html`: the layout all service pages share.
- `src/site.css`: colours and fonts.

From the project root: `npm run build` (HTML + sitemap + CSS), `npm run serve` (preview on http://127.0.0.1:8744), `npm run pack` (creates `digital-mom-upload.zip` for cPanel, without this README).

## Team
`src/team.json` holds the people on the About page: name, role, quote, bio paragraphs and a photo in `site/assets/team/`. The fourth person is already in the file with `"published": false`. Her photo waits in `work-source/team-pending/fourth.jpg` so it is not uploaded early: add her name, role, quote and bio, copy the photo into `site/assets/team/`, set `published` to `true`, then run `npm run build`. Photos are 900x1125 crops of the `Fotos aug 2026` shoot.

## Scroll effects (`scroll-effects.js`)
Add an attribute to any element:
- `data-scroll="words"`: headline words rise out of a mask, one after another.
- `data-scroll="wipe"`: an image is uncovered from the bottom while it settles from a slight zoom (tied to scrolling).
- `data-scroll="curtain"`: a coloured panel opens from rounded, inset edges to full width.
- `data-scroll="draw"`: a divider line draws across.
- `data-scroll="scrub"` with `data-from-y`, `data-to-rotate`, `data-from-scale` and so on: parallax that follows scroll.
Visitors who prefer reduced motion, or without JavaScript, see the plain page.

## Adding client work
1. Put screenshots, mock-ups or exports (jpg, png, webp) in `work-source/`, then run `npm run images`. Optimised copies appear in `site/assets/work/`.
2. Add an entry to `src/work.json`:
   `{ "title": "New website", "client": "Client name", "category": "web-design", "summary": "One honest sentence.", "image": "file-name.jpg", "alt": "What the image shows", "url": "https://optional-live-link" }`
   `category` must be one of the service slugs: `social-media-marketing`, `web-design`, `seo`, `graphic-design`.
3. `npm run build`. Only publish work you have the client's permission to show.

## Contact form
`contact.php` + `contact.js` serve both the pop-up and the full form on `/contact/`: session token, hidden spam field, rate limit (5 per 15 minutes per address), optional business, link and service fields. PHP 8.1+ hosting with sessions, a writable temp folder and working mail is required. Authorise website@digital-mom.co.za as the sender.

## Upload to cPanel shared hosting
1. `npm run build`, then `npm run pack`.
2. cPanel > **Select PHP Version**: PHP 8.1 or newer, with sessions and mail enabled.
3. **File Manager** > `public_html` > Upload the zip > Extract. `index.html` must sit directly in `public_html`. Delete the zip afterwards.
4. **Email Accounts**: create `website@digital-mom.co.za`. Under **Email Deliverability** check SPF and DKIM, or enquiries may land in spam.
5. **SSL/TLS Status**: run AutoSSL, then add an https redirect once it works.
6. Check: `/contact.php` shows a small JSON token (never PHP code), then send a real test enquiry.
7. Submit `https://digital-mom.co.za/sitemap.xml` to Google Search Console.

Apache security headers are in `.htaccess`. Other servers need equivalents.

## Launch checks (from the copy pack)
Confirm the final service descriptions match what you can deliver, add only real and approved work, confirm the contact details and recipient inbox, have the Privacy policy reviewed against your real data handling, and replace stand-in photography with real team and client photos.
