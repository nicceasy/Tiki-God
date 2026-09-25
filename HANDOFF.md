# Session handoff: Tiki God

This is a curated export of the Claude Code session that built this repository, written so another session (local or cloud) can pick up without the original conversation. It covers:
- what was asked;
- what was built;
- the decisions made and why;
- the conventions, gotchas and open items.

The code and the docs linked below are the source of truth; this file is the map.

## At a glance

| | |
|---|---|
| Repo | <https://github.com/nicceasy/Tiki-God> (public, MIT) |
| Branch | `claude/relaxed-dijkstra-ty5c0h`: the only branch, and the default |
| Latest pinned build for embedding | `1d94212f58260c966b9d5a2990972abbe0f93704` (`dist/shrine.html`) |
| Live preview | A private claude.ai artifact of the Shrine that only the owner can open: <https://claude.ai/artifact/X4XiP7FuAvUVRhHKxoz73e>. It is republished from `dist/shrine.fragment.html`, which is gitignored. |
| Build and test | `npm run build` and `npm test` (Node 20 or newer, no dependencies). 11 tests, all passing at handoff. |
| Size of the catalogue | 1,070 drinks, 164 ingredients, 14 families, 34 vessels |

## What the user asked for, in order

1. **The project.** A repo with a deep understanding of tiki history, drinks, themes and flavors, to create new tiki drinks from modern, commonly available ingredients: nothing defunct, rare or expensive. The brief:
   - research the history and concepts;
   - catalogue every tiki drink findable, analyse the ingredients and proportions, and build a methodology for "good" drinks, with special attention to popular ones (Painkiller, grogs, Mai Tai);
   - end with a web page where a prompt returns a recipe plus an explanation of its influences and lineage.

   Delivered as the catalogue, model, generator and the main app `dist/index.html`, in commits `8f45ffe` → `8368aef`.
2. **"The Shrine" side project.** A web page with tiki elements drawn live in JS. In the centre, an input labelled "say a prayer for a new tiki drink, and the tiki gods will abide". The recipe and a custom JS drawing of the drink draw on below it. It should be fun, cute and quick, with real drinks. The first version was a night-luau scene, in commit `b86030e`.
3. **Redesign.** The user rejected the scene: "not what I had in mind". The new brief:
   - an off-white background, no environment, minimal but cute;
   - watercolor or ink work drawn on: tiki, mugs and flowers on an off-white field;
   - study three references first: [achimala/jev-paint](https://github.com/achimala/jev-paint), [vercel-labs/json-render](https://github.com/vercel-labs/json-render) and [alesha-pro hand-drawn-canvas-animation](https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation);
   - research "good art" and consensus references before designing; design-forward and textural.

   Delivered in `0f1d614` and `a3199f9`; the research is in `docs/art-direction.md`.
4. **A specific mug or glass for every drink, researched.** Delivered in `e404a1e` → `8347171`; the research is in `docs/vessels.md`.
5. **Adding it to their own website.** The user has a separate website repo, built locally, pushed to GitHub and deployed on Vercel. Its Claude Code session should add the Shrine. This session wrote `INTEGRATING.md` (`044c65d`) and a paste-ready prompt, reproduced at the end of this file.
6. **License.** MIT plus `NOTICE.md` for the imported recipe data (`f8d879e`).
7. **Move "Pray again"** from the bottom of the recipe to under the drink drawing (`1d94212`). `INTEGRATING.md` was re-pinned to that build (`d24b162`).
8. **Moving it local.** This session explained `git clone`, opening `dist/shrine.html`, and `claude --teleport` to resume the session in a local terminal. Teleport needs the same claude.ai account (`/login`), a clean checkout of this repo, and the branch pushed, which it is.
9. **This file.**

## How it works

### Data pipeline

The pipeline is `data/drinks/*.json` slices → `scripts/merge.mjs` → `data/drinks.json` → `scripts/analyze.mjs` → `data/model.json` and `docs/analysis.md` → `scripts/vessels-doc.mjs` → `scripts/build-site.mjs` → `dist/`.

- **Ingredients** (`data/ingredients.json`): ABV, sugar and acid in g/100 ml (Dave Arnold's values), positional flavor tags (the first is dominant), availability (`common`, `specialty`, `homemade`, `rare`, `defunct`) and cost tiers. Defunct products map to modern ones, with the original kept in `orig`.
- **Slices**, in merge priority order: don, vic, golden-venues, ancestors, resort, revival, craft, deep-cuts. Two slices are machine-imported by `scripts/import/`:
  - `books` (362 drinks) from SBoudrias/cocktails;
  - `difford` (414 drinks) from a Difford's Guide scrape.

  The imports record facts only and copy no prose. Merge ranks by confidence, then slice priority. It dedupes near-duplicates (same name and ingredient Jaccard ≥ 0.75), resolves `parent_ids`, assigns each drink a `vessel`, and validates.
- **Model**: popularity × confidence weights, post-dilution chemistry (Arnold's dilution curves: crushed ice ×1.15, swizzle ×1.2, flash-blend ×1.3), per-family formulas, PMI pairings, rum combinations, era trends and per-family vessel shares.

### Generator (`web/lib/engine.js`)

1. `prompt.js` parses the prompt: a lexicon of about 750 phrases, negation, diets, servings, drink-name riffs, and vessel words ("in a coconut", "skull mug", "zombie glass").
2. It scores the families and fills the family skeleton by family share, intent match, flavor fit and PMI compatibility.
3. A novelty check swaps an ingredient when the result lands at Jaccard ≥ 0.8 with an existing drink.
4. The anchored balancer: acid and sugar levers aim at family targets, the base pour stays inside the ABV band, and amounts snap to bar units.
5. It writes the explanation: lineage, influences, why it works, a tasting note, and the vessel with the reason it was chosen.
6. **Vessel choice**, in order:
   1. the vessel named in the prompt, which also adapts the service (a coconut gets crushed ice);
   2. a riff's source vessel, or the vessel of another spec with the same name if the source's doesn't fit;
   3. otherwise the family's vessel shares plus a researched affinity, filtered by service (up, rocks, crushed, frozen, hot, bowl) and by capacity.

### Vessels

- `data/vessels.json` lists 34 vessels, each with capacity, the services it takes, a story and sources.
- `web/lib/vessels.js` maps glass text to a vessel id. The most specific vessel wins ("tall glass or tiki mug" gives the mug). "Old fashioned" becomes the DOF for crushed-ice or long drinks and the rocks glass otherwise.
- Identity-defining classics are fixed by name (`BY_NAME`): Zombie in the chimney, Mai Tai in the DOF, Fog Cutter in its mug, Painkiller in the Pusser's tin, and so on.

### Art system: the Shrine (`web/shrine.*`)

- `ink.js`:
  - paper: a height map for granulation, plus a faint CSS texture;
  - brush-pen ribbons: tapered, swelling, seeded, in the style of perfect-freehand;
  - Tyler Hobbs-style watercolor: stacked, deformed polygons multiplied onto the paper, with Curtis-style edge darkening and granulation.
- `artcatalog.js`: a closed catalogue of drawable parts: flowers, mugs, idol, garnishes, liquid, ice, fizz, steam, the frame, and all 34 vessels at about 38 units per inch in a 300 × 460 box.
  - Clear glasses are profiles shared with the liquid and ice.
  - Opaque vessels show the drink only at the rim.
- `artspec.js`: turns a recipe into a JSON art spec that may only use catalogue parts (the json-render idea), and validates it. It also holds the hero layout, which never draws behind text.
- `artrender.js`: the timeline renderer. Strokes draw on at pen speed, then washes bloom layer by layer onto a committed base canvas while live strokes go on an overlay. The drink drawing is cropped to its content height, and reduced motion gets finished stills.
- Page features: fonts are Nanum Brush Script, Instrument Sans and DM Mono. The hero drawings are hibiscus, Moai mug, plumeria, monstera and pineapple. The Ku idol sits on the prayer box and blinks on each prayer, and text bleeds in like ink.

### Build (`scripts/build-site.mjs`)

- A small regex bundler for this repo's own ES modules. It supports named imports and exports only, no circular imports, and module order matters: `LIB`, then the page modules.
- Data is inlined as `window.__TIKI_DATA__` with separator-safe JSON (U+2028 and U+2029 escaped).
- It outputs `dist/index.html` and `dist/shrine.html`, which are committed. The `*.fragment.html` files have no document skeleton, are gitignored, and are used only to publish the artifact.

## Conventions this session followed

- Commit and push after every change to `claude/relaxed-dijkstra-ty5c0h`, with descriptive messages. Don't open PRs unless asked.
- Rebuild (`npm run build`) and run `npm test` before committing. `dist/` is committed so the single-file pages are always current on GitHub.
- Before calling visual work done, render it in headless Chromium (Playwright) and look at it: a desktop and phone screenshot, plus a gallery of drinks or vessels.
- Docs are written in plain language, and unverified claims are marked as such.

## Gotchas

- **Network (cloud environment).** Most cocktail sites returned 403 to direct fetches, so research relied on web search summaries and GitHub-hosted datasets. `docs/vessels.md` and `NOTICE.md` say so. Headless Chromium shows `ERR_CERT_AUTHORITY_INVALID` for Google Fonts unless the page is opened with `ignoreHTTPSErrors`; that's harmless.
- **Playwright** is global: `require($(npm root -g)/playwright)`, with Chromium in `/opt/pw-browsers`. Never run `playwright install`.
- **Bundler.** A module with a default export, or one that re-exports another module, breaks the bundler. Keep to `export function` and `export const`.
- **Generated docs.** `docs/analysis.md` and the vessel catalogue section of `docs/vessels.md` are generated. Edit their sources (`scripts/analyze.mjs`, `data/vessels.json`), not the generated text.
- **Vessel changes.** When changing a vessel's geometry in `artcatalog.js`, keep `GLASS_PROFILES` and the drawing in sync. The liquid, ice, straws and garnishes all read the profile.

## Open items and ideas

- **Website integration:** pending in the user's website session (prompt below). Nothing was pushed to their site repo from here.
- **Default branch:** suggested renaming to `main`. The HEAD links in `INTEGRATING.md` follow the default branch; pinned SHA links keep working.
- **Vessel research still unverified:**
  - the Cobra's Fang's 1941 "tall curved glass";
  - whether the first Zombie glass was the straight chimney;
  - the profile of the Raffles sling glass;
  - the original vessels of the Piña Colada, Blue Hawaii, Rum Runner and Bahama Mama.
- **Possible vessel additions:** Trader Vic's "Mai Tai Joe" (Suffering Bastard) mug, the Headhunter mug, a milk-glass Tom & Jerry mug, and a separate Mai-Kai Mystery bowl. The generic "tiki mug" currently draws as the Ku mug.
- **Data confidence:** 85 of the 1,070 drinks are low confidence and 711 medium. They are weighted down and can be tightened record by record.

## Working with this user

- Short, direct answers; commit to a recommendation instead of listing options; call out bad ideas.
- They follow along on a phone or in the Claude app, so link finished pages. The Shrine artifact at the link above is the canonical preview.
- They care about the Shrine looking design-forward, minimal and textural, and about the drinks being real and good.

## Prompt already given to the user for their website session

```
Add the Tiki God Shrine to this site as a standalone page at /tiki.

Full guide (read it first): https://raw.githubusercontent.com/nicceasy/Tiki-God/HEAD/INTEGRATING.md

Summary:
1. The Shrine is one self-contained HTML file (all CSS, JS and data inline; only
   external request is Google Fonts). Download it, pinned to a known-good commit:
   curl -fsSL https://raw.githubusercontent.com/nicceasy/Tiki-God/1d94212f58260c966b9d5a2990972abbe0f93704/dist/shrine.html -o <static-dir>/tiki/index.html
   where <static-dir> is this framework's static folder (public/ for Next.js,
   Astro and Vite; static/ for SvelteKit and Hugo). Commit the file as is: don't
   minify, template or hand-edit it.
2. Make /tiki resolve:
   - Next.js: add a rewrite { source: '/tiki', destination: '/tiki/index.html' }.
   - If vercel.json has an SPA catch-all rewrite, add a /tiki rule before it and
     exclude tiki from the catch-all.
   - Other frameworks: see section 2 of the guide.
3. Add a link to /tiki in the site's navigation, labelled "Tiki God". Use a plain
   <a href="/tiki">, not client-side routing.
4. If the site sets a Content-Security-Policy, relax it for /tiki/* to allow:
   - inline scripts and styles;
   - fonts.googleapis.com and fonts.gstatic.com;
   - data: images.
5. Run the site locally and open /tiki. Expect:
   - an off-white paper page with "Tiki God" in brush lettering;
   - flowers and mugs drawing on, and a little idol on the prayer box;
   - a first recipe already answered below, with the drink drawn in its glass;
   - a "Pray again" button under the drawing;
   - no console errors.
   Type a prayer and press "pray", and a new recipe and drawing should appear.
6. Commit on a new branch, push, and check /tiki on the Vercel preview deployment
   before merging to production. Don't merge without asking me.

To update later, re-run the curl with a newer commit SHA from
https://github.com/nicceasy/Tiki-God/commits
```

## Where to read more

- [README.md](README.md): overview and layout.
- [INTEGRATING.md](INTEGRATING.md): adding the Shrine to another site.
- [docs/methodology.md](docs/methodology.md): what makes a good tiki drink.
- [docs/art-direction.md](docs/art-direction.md): the art research and rules.
- [docs/vessels.md](docs/vessels.md): the vessels and their sources.
- [docs/history.md](docs/history.md) and [docs/concepts.md](docs/concepts.md): background.
- [docs/analysis.md](docs/analysis.md): every number the generator balances against.
