# Adding the Tiki God Shrine to another website

This guide is for adding the Shrine to another site as a page, for example at `/tiki`. It is written so a person, or a Claude Code session working in the other site's repository, can follow it without any other context.

**The short version:** the Shrine is one self-contained HTML file. Download it into the site's static folder, make sure the route resolves, and deploy.

## 1. What you're adding

The **Tiki God Shrine** is a playful front end to a tiki-drink generator.

- You type a prayer ("mezcal and passion fruit", "like a Painkiller but less sweet"). The page answers with a real, balanced recipe: amounts, steps, tasting note, lineage and why it works.
- The drink draws itself in brush-pen ink and watercolor, in its own researched vessel (chimney glass, tiki mug, coconut, Scorpion bowl and so on).
- Everything runs in the browser. There is no server, no API, no API key, no analytics and no cookies, and it saves nothing to storage.

| | |
|---|---|
| Repository | <https://github.com/nicceasy/Tiki-God> (public) |
| Branch | `claude/relaxed-dijkstra-ty5c0h`, which is also the repo's default branch (`HEAD`) |
| The file | [`dist/shrine.html`](dist/shrine.html) |
| Raw download | `https://raw.githubusercontent.com/nicceasy/Tiki-God/HEAD/dist/shrine.html` |
| Size | about 2.6 MB raw, about 490 KB gzipped (Vercel compresses it automatically) |
| Known-good commit | `8347171221e10887eb3e069a83371d80b9e56d6b` (2026-09-25) |

`dist/shrine.html` is a complete HTML document (`<!doctype html>` through `</html>`). It contains:
- all of its CSS, inline in a `<style>` block;
- all of its JavaScript, a small bundle of vanilla ES modules in one inline `<script type="module">`;
- the whole drink database (1,070 drinks, ingredients, families, vessels and the statistical model) as inline JSON on `window.__TIKI_DATA__`.

Its only outside request is **Google Fonts**: Nanum Brush Script, Instrument Sans and DM Mono from `fonts.googleapis.com` / `fonts.gstatic.com`. Without them it falls back to system fonts and still works.

It has been checked served from a subpath (`/tiki/index.html`): no errors, and it made no requests besides the fonts.

There is also [`dist/index.html`](dist/index.html), the full workbench with the Mix, Canon, Model and History tabs. It is also a single self-contained file (about 2.7 MB) and can be added the same way, for example at `/tiki/lab`.

## 2. Recommended approach: a standalone static page

Serve the file as-is at its own route. This is the most robust choice:
- its CSS can't collide with the site's CSS;
- the site's CSS can't break it;
- it needs no build step or dependencies in the host site.

### Get the file

```sh
# latest
curl -fsSL https://raw.githubusercontent.com/nicceasy/Tiki-God/HEAD/dist/shrine.html -o <static-dir>/tiki/index.html
# or pinned to a known commit (reproducible)
curl -fsSL https://raw.githubusercontent.com/nicceasy/Tiki-God/8347171221e10887eb3e069a83371d80b9e56d6b/dist/shrine.html -o <static-dir>/tiki/index.html
```

Commit the downloaded file into the site's repo. Vercel then serves it like any other static asset; it needs no network access at build time.

### Put it where the framework serves static files

| Framework | Put the file at | Served at | Notes |
|---|---|---|---|
| **Next.js** (App or Pages Router) | `public/tiki/index.html` | `/tiki/index.html` | Next doesn't map folder indexes, so add a rewrite for a clean `/tiki` (below). |
| **Astro** | `public/tiki/index.html` | `/tiki/` | Works out of the box. |
| **Vite / React SPA / plain static** | `public/tiki/index.html` (or `tiki/index.html` in the output root) | `/tiki/` | If `vercel.json` has a catch-all SPA rewrite like `"/(.*)" → "/index.html"`, it will swallow `/tiki`. Exclude it (below). |
| **SvelteKit** | `static/tiki/index.html` | `/tiki/index.html` | Add a rewrite or redirect for `/tiki` if you want the short URL. |
| **Hugo / Eleventy / Jekyll** | `static/tiki/index.html` / passthrough copy / `tiki/index.html` | `/tiki/` | Make sure the generator copies it untouched and doesn't template it. |

**Next.js clean URL.** In `next.config.js` (or `.mjs` / `.ts`):

```js
async rewrites() {
  return [{ source: '/tiki', destination: '/tiki/index.html' }];
},
```

**SPA catch-all that swallows `/tiki`.** Put a specific rule before the catch-all in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/tiki", "destination": "/tiki/index.html" },
    { "source": "/((?!tiki).*)", "destination": "/index.html" }
  ]
}
```

### Link to it

Add a normal link from the site's nav or a page, for example `<a href="/tiki">Tiki God</a>`. It's a full page, so a plain link is right; in Next.js a normal `<a>` avoids client-side routing into a static file.

## 3. Alternative: show it inside a page of the site (iframe)

Use this if the page should keep the site's header, footer and navigation. Create a normal page in the site and embed the static file:

```html
<iframe src="/tiki/index.html" title="Tiki God Shrine"
        style="display:block;width:100%;height:100vh;border:0"></iframe>
```

The Shrine scrolls inside the frame. It is designed to work from 400 px wide up, with a 16 px gutter. Same-origin iframes need no special headers. If the site sends `X-Frame-Options: DENY`, or `frame-ancestors 'none'` in its CSP, relax that for this path.

**Don't paste the HTML into a component** (`dangerouslySetInnerHTML`, `set:html` and similar). The page uses generic class names (`.hero`, `.title`, `.btn`, `.answer`), sets `body` styles, and runs a module script that expects its own document. The standalone file or an iframe keeps both sides safe.

## 4. Things that can trip you up

- **Content Security Policy.** If the site sends a CSP header, the Shrine's path needs:
  - `script-src 'unsafe-inline'` (the inline module bundle and data);
  - `style-src 'unsafe-inline' https://fonts.googleapis.com`;
  - `font-src https://fonts.gstatic.com`;
  - `img-src data:` (the paper texture is a generated data URL).

  The simplest fix is to scope a relaxed policy to `/tiki/*` in `vercel.json` `headers` or in Next's `headers()`.
- **Theme.** The Shrine deliberately paints its own off-white paper and ink colors in both light and dark mode. It ignores the host site's theme.
- **Title and favicon.** The document title is "Tiki God Shrine". It has no favicon, so the browser shows the site's root `/favicon.ico`.
- **Size.** Vercel serves it with Brotli or gzip, about 490 KB over the wire. Nothing else loads except the fonts. If you want, add long-lived cache headers for `/tiki/*` and bust the cache by re-downloading.
- **Framework processing.** Some static-site generators minify or template HTML in their static folder. The file should be copied byte for byte: it contains a large inline JSON blob and `</script>`-escaped strings.
- **Reduced motion.** It respects `prefers-reduced-motion`: the drawings appear finished instead of drawing on.

## 5. Keeping it up to date

The Shrine is built in this repo. To pick up improvements, re-run the `curl` above and commit the new file. For reproducibility, pin a commit SHA rather than `HEAD`. A small script in the host site keeps this to one command:

```json
"scripts": {
  "tiki:update": "curl -fsSL https://raw.githubusercontent.com/nicceasy/Tiki-God/HEAD/dist/shrine.html -o public/tiki/index.html"
}
```

Changes to the Shrine itself belong in this repo:
- The page: `web/shrine.html`, `web/shrine.css`, `web/shrine.js`.
- The drawing engine: `web/lib/ink.js`, `artcatalog.js`, `artspec.js`, `artrender.js`.
- The generator: `web/lib/engine.js` and its helpers.
- The data: `data/`.

Rebuild with `npm run build`; it needs Node 20 or newer and has no dependencies to install. `npm test` runs the checks. The bundled page comes out as `dist/shrine.html`. Editing the 2.6 MB built file by hand is not recommended; change the source and rebuild.

To add a link back to the host site, for example "← back to nicceasy.com", edit the footer in `web/shrine.html` (inside `<!--BUILD:BODY-->`), rebuild, and re-copy.

## 6. Checklist for the integrating session

1. Identify the framework and its static folder (section 2).
2. Download `dist/shrine.html` into it as `tiki/index.html`, pinned to a commit SHA.
3. Add the rewrite or route exclusion if the framework needs one, so `/tiki` resolves.
4. Add a link to `/tiki` wherever it belongs in the site.
5. Run the dev server or a production build locally and open `/tiki`. You should see:
   - the paper background, and "Tiki God" in brush lettering;
   - drawings of flowers and mugs inking in, and a small idol sitting on the prayer box;
   - a first recipe already answered below, with a drink drawn in its glass;
   - no console errors.

   Type a prayer and press **pray**: a new recipe and drawing should appear.
6. Check that a CSP, a catch-all rewrite or an HTML minifier isn't interfering (section 4).
7. Commit on a branch and push. Vercel builds a preview deployment for the branch; check `/tiki` there before merging to production.

## 7. Where things are documented

- [README.md](README.md): what the project is, the repo layout, how the generator works.
- [docs/art-direction.md](docs/art-direction.md): the ink and watercolor style and its references.
- [docs/vessels.md](docs/vessels.md): the 34 serving vessels, their histories and which drink goes in which.
- [docs/methodology.md](docs/methodology.md): what the data says makes a good tiki drink.
- [docs/history.md](docs/history.md) and [docs/concepts.md](docs/concepts.md): background.

**Provenance.** Recipe data was compiled from public sources: Berry's books, Trader Vic's guides, Difford's Guide and GitHub-hosted recipe datasets, listed in the README. Only recipe facts were recorded (ingredients, amounts, method, attribution); descriptions and notes are written fresh. The repository has no license file yet; add one if the owner wants to set terms for reuse.
