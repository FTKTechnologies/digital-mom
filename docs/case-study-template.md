# Case study template

Every client case study follows this template, so all client pages look and read the same. Data lives in
`src/clients.json`, pictures in `site/assets/clients/<client-slug>/`, and `build.mjs` turns them into
`/case-studies/` (one row per client) and `/case-studies/<client-slug>/` (the full page). The layout comes from the
template. A client entry never sets its own layout.

## Page structure (fixed)

1. **Header:** client name, intro (one or two sentences), facts on the right (Industry, Based in, Website, Social pages),
   then jump buttons to each section.
2. **One section per piece of work**, always in this order, leaving out any the client did not get:

| Order | `type`    | Service        | Pictures underneath the text                                               |
|-------|-----------|----------------|----------------------------------------------------------------------------|
| 1     | `website` | Web Design     | Before above after (home page), stacked, max 420px wide                    |
| 2     | `logo`    | Graphic Design | Old logo above new logo on matching white panels, max 420px wide           |
| 3     | `print`   | Graphic Design | Signature on top, cards two across under it, stacked, max 420px wide      |
| 4     | `social`  | Social Media   | Campaign cards in a grid beside the text, platforms linked in facts        |
| 5     | `seo`     | SEO            | PageSpeed score table beside the text, screenshots in a row under it       |

Every section uses the same two columns (5 : 7): **info on the left** (title, facts, summary) and **pictures on the right**.
On phones the pictures follow the text. Social cards sit 4 across on desktop and 3 on phones.

Facts always start with **Service**. Social sections list the client's **Platforms**
automatically from the client's `profiles`.

3. The page ends with the usual call to action.

The landing page row shows the cover, name, industry, intro, service tags, a "See the work" button and a link to the
client's website.

## Pictures (house sizes)

Make every picture with `case-images.mjs` so sizes match across clients:

| Picture                     | Command                                                                  | File name                     |
|-----------------------------|--------------------------------------------------------------------------|-------------------------------|
| Logo panel (before / after) | `node case-images.mjs logo <source> <slug>/logo-before`                  | `logo-before.jpg`, `logo-after.jpg` (1200 x 675, white) |
| Social card                 | `node case-images.mjs card <source> <slug>/social-card-1`                | `social-card-N.jpg` (720 wide, 4:5) |
| Cards from a master sheet   | `node case-images.mjs sheet <sheet.png> <slug> <cols> <rows> <count>`    | `social-card-1.jpg` and on    |
| Screenshot or print piece   | `node case-images.mjs shot <source> <slug>/<name>`                       | at most 1600 wide             |

- **Website before/after:** crop both to the same shape (the top of the home page, about 2.1 : 1). The new site can
  be captured with headless Edge; the old one usually comes from the client or a screenshot.
- **Cover** (landing page): the new website's home page if there is web work, otherwise three campaign cards on a
  sand background (`#e7ddce`), 1600 x 967.
- **Logo:** use the client's real old logo file for "before" (ask for it if there is none) and the master export of
  the new one for "after".

## Copy rules

- **Intro:** what was done and who the client is, in one or two sentences, for example
  "A new logo and a 17-card social media campaign for …, a South African … built around …".
- **Section titles:** Website redesign, Logo redesign (or Logo refinement), Business cards and email signatures,
  "<Campaign name> campaign", Search care.
- **Never name the tools or platform a site is built on** (no WordPress, Elementor, HTML, CSS or similar) on any page.
- **Summaries:** what was made and why it helps, in plain words. Real facts only: no invented results, no criticism of
  the old work, no claims the client has not seen. Web and SEO wording must not suggest the Digital Mom team did the
  technical work itself.
- **SEO:** "We manage the Google Business Profile, improve how fast the site loads and keep its SEO up to Google's
  latest standards", Status "Ongoing, on a monthly plan", plus the PageSpeed before/after scores exactly as measured
  (lower scores are shown too).
- **Alt text:** describe what is in each picture, for example "Campaign card: <headline>".
- Every client link (website and social pages) is a normal followed link: that is the client's backlink.

## `src/clients.json` skeleton

```json
{
  "slug": "client-name",
  "name": "Client Name",
  "url": "https://client.co.za/",
  "industry": "What they do",
  "location": "Town, Province",
  "intro": "One or two sentences.",
  "cover": { "image": "cover.jpg", "alt": "…" },
  "profiles": [
    { "platform": "Instagram", "url": "https://www.instagram.com/…/" },
    { "platform": "Facebook", "url": "https://www.facebook.com/…" }
  ],
  "work": [
    { "type": "website", "title": "Website redesign", "summary": "…",
      "before": { "image": "site-before.jpg", "alt": "…" }, "after": { "image": "site-after.jpg", "alt": "…" } },
    { "type": "logo", "title": "Logo redesign", "summary": "…", "facts": { "What changed": "…" },
      "before": { "image": "logo-before.jpg", "alt": "…" }, "after": { "image": "logo-after.jpg", "alt": "…" } },
    { "type": "print", "title": "Business cards and email signatures", "summary": "…",
      "images": [{ "image": "email-signature.jpg", "alt": "…", "caption": "…" }] },
    { "type": "social", "title": "… campaign", "summary": "…", "facts": { "Format": "16 portrait cards, 1080 x 1350" },
      "images": [{ "image": "social-card-1.jpg", "alt": "Campaign card: …" }] },
    { "type": "seo", "title": "Search care", "summary": "…", "facts": { "Status": "Ongoing, on a monthly plan" },
      "scores": { "source": "Google PageSpeed Insights", "columns": ["Performance", "Accessibility", "Best practices", "SEO"],
        "rows": [{ "label": "Mobile", "before": [0, 0, 0, 0], "after": [0, 0, 0, 0] },
                 { "label": "Desktop", "before": [0, 0, 0, 0], "after": [0, 0, 0, 0] }] },
      "images": [{ "image": "pagespeed-mobile-before.jpg", "label": "Before", "alt": "…" }] }
  ]
}
```

Use `"hidden": true` on a client to keep it off the site until it is ready.

## After adding or changing a client

`npm run build`, check `/case-studies/` and the client page at desktop and phone width, then `npm run pack`.
The update zip (`upload/digital-mom-update.zip`) then holds only what changed.
