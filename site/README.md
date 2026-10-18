# Digital Mom website, phase 1 (landing page)

Static HTML. Styling is Tailwind CSS v4; scroll effects use self-hosted GSAP + ScrollTrigger (`assets/vendor/`). The CSP stays `script-src 'self'`.

## One place for the header, footer and contact dialog
Pages are built from `../src/`:
- `src/partials/header.html`, `footer.html`, `head.html` — shared by every page. Edit once, rebuild, all pages update.
- `src/site.json` — phone, WhatsApp link, site URL and the navigation list. Set an item's `live` to `true` when its page exists and it appears in the header and footer.
- `src/pages/index.html` — the landing page. Every page starts with a `<!--meta {"title":"…","description":"…"} -->` line. A file called `about.html` becomes `/about/`.
- `src/site.css` — Tailwind source and the design tokens (colours, fonts).

From the project root (`D:\Projects\digital mom`):
- `npm run build` — builds the HTML pages, `sitemap.xml`, `robots.txt` and the CSS.
- `npm run dev:css` — rebuild the CSS on change. `npm run serve` — preview at http://127.0.0.1:8744.

## Scroll effects
`scroll-effects.js` reads attributes: `data-scroll="reveal"` (entrance) or `"scrub"` (follows scroll) with `data-from-y`, `data-to-rotate`, `data-from-scale`, `data-scrub`, `data-min-width` and so on. Visitors with reduced motion, or without JavaScript, see the plain page.

## Contact form
`contact.php` + `contact.js` (session token, honeypot, rate limit). PHP 8.1+ hosting with sessions, a writable temp directory and working mail are required. Authorize website@digital-mom.co.za as the sender and test real delivery after upload.

## Upload to cPanel shared hosting
1. On your computer run `npm run build`, then `npm run pack` (creates `digital-mom-upload.zip` in the project root, without this README).
2. cPanel > **Select PHP Version** (or MultiPHP Manager): choose PHP 8.1 or newer for the domain. Make sure sessions and `mail` are enabled.
3. cPanel > **File Manager** > `public_html` > **Upload** the zip, then **Extract** it there. Delete the zip afterwards. `index.html` must sit directly in `public_html`.
4. cPanel > **Email Accounts**: create `website@digital-mom.co.za`. Under **Email Deliverability** make sure SPF and DKIM show as valid, otherwise enquiries may land in spam.
5. cPanel > **SSL/TLS Status**: run AutoSSL so the site loads over https, then add an https redirect once it works.
6. Check: the home page loads; `/contact.php` shows a small JSON token (never PHP source); send a real test enquiry and confirm it arrives at the recipient set in `contact.php`.
7. Submit `https://digital-mom.co.za/sitemap.xml` to Google Search Console.

If the security headers do not appear, ask the host to allow `.htaccess` overrides. Other servers need equivalents of the headers in `.htaccess`.

To update later: edit in `src/`, run `npm run build` and `npm run pack`, upload and extract the new zip over the old files.
