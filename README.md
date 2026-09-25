# Tiki God

A catalogue of tiki and tropical drinks, a statistical model of what makes them work, and a generator that turns a prompt ("smoky and spicy for a cold night", "like a Painkiller but less sweet", "tequila tiki with passion fruit") into a balanced recipe. Each recipe comes with a written explanation of its lineage.

**Open `dist/index.html` in a browser.** It's a single self-contained file with all the data inside, and it works offline. It has four tabs:

- **Mix**: type a prompt and get a named recipe with measured amounts, build steps, glass and garnish. The drink is plotted against its family's normal ranges for strength, sugar and acid. You also get its family lineage, its closest relatives in the catalogue, and why each pairing works, citing the drinks that proved it. *Shake again* re-rolls the same prompt.
- **Canon**: search and filter every catalogued drink. Each record shows its original spec (with defunct products mapped to modern bottles), its chemistry, its source and a confidence rating. Records link to their parents, descendants and nearest relatives.
- **Model**: the numbers the generator balances toward: family formulas, the tiki pantry, recurring pairings, rum blends, and famous-versus-obscure comparisons.
- **History**: a timeline plus the full history and concepts write-ups.

**Adding the Shrine to another website?** See [INTEGRATING.md](INTEGRATING.md): it's one self-contained file you can drop into any static folder.

**Or open `dist/shrine.html`**, the playful front door. Say a prayer ("mezcal and passion fruit") and the same generator answers, while the drink draws itself in brush-pen ink and blooms with watercolor on an off-white sheet. Tiki mugs, a Ku idol and tropical flowers frame the prayer. Every drink comes in its own specific vessel (the Zombie in a chimney glass, the Painkiller in a Pusser's tin, the Fog Cutter in Trader Vic's mug, a Scorpion bowl on kneeling hula girls), chosen from 34 researched vessels in [docs/vessels.md](docs/vessels.md). The art style is researched in [docs/art-direction.md](docs/art-direction.md): Tyler Hobbs' layered-polygon watercolor, Curtis et al.'s edge darkening and granulation, perfect-freehand-style pressure ribbons, and a closed catalog of drawable parts in the spirit of json-render.

## What's in the repo

```
data/
  ingredients.json     canonical vocabulary: ABV, sugar and acid per 100 ml, flavor tags, availability, bottles, substitutes
  vessels.json         34 serving vessels (glassware, tiki mugs, fruit, bowls) with capacity and service
  families.json        14 structural families (Zombie, Mai Tai, Grog, Swizzle, Colada…) with origin stories and lineage
  drinks/*.json        research slices: don, vic, golden-venues, ancestors, revival, craft, resort, deep-cuts, books, difford
  drinks.json          merged, deduplicated catalogue (generated)
  model.json           statistics the generator uses (generated)
  SCHEMA.md            the drink record format and conversion conventions
docs/
  history.md           history of tiki from punch and grog to the craft revival and today's "tropical" reframing
  concepts.md          the drink-making ideas behind tiki: rum blending, layered modifiers, dilution, the pantry
  methodology.md       what the data says makes a good tiki drink, and how the generator uses it
  analysis.md          auto-generated statistics report (per family, per era, pairings, rum blends)
  art-direction.md     the Shrine's ink and watercolor style: research, references and rules
  vessels.md           the 34 serving vessels: histories, sources, which classic goes in which
  timeline.json        key events, machine-readable
web/                   the app (vanilla JS, no framework): lib/engine.js is the generator
                       shrine.* plus lib/ink.js, artcatalog.js, artspec.js, artrender.js draw the Shrine
scripts/               validate → merge → analyze → build-site, plus importers under scripts/import/
tests/                 node:test suite for the chemistry, parser and generator
dist/index.html        the built single-file app
dist/shrine.html       the built single-file Shrine
```

## Rebuild

Node 20 or newer; no dependencies to install.

```sh
npm run build      # merge slices → data/drinks.json, analyze → data/model.json, bundle → dist/index.html
npm test           # validation, chemistry, parser and generator tests
npm run serve      # optional: serve the repo and open http://localhost:8000/web/ for the unbundled dev version
```

## How the generator works (short version)

1. **Read the prompt.** A lexicon of about 750 phrases maps words to flavor tags, spirits, specific bottles, families, moods, places and styles (frozen, hot, stirred, a bowl for six, zero-proof). Negations ("no coconut", "not too sweet"), diets (nut-free, vegan) and named drinks ("a Mai Tai with mezcal") are understood.
2. **Pick a family.** Families are scored by how well their flavor profile fits the request, plus style and strength fit and a prior for well-established families.
3. **Fill the skeleton.** The family's role counts (how many spirits, sours, sweeteners, modifiers) come from the data. Each slot is filled by scoring every available ingredient on family frequency, match to the prompt, fit with the family's flavor, and pairing strength (PMI) with what's already chosen. A riff starts from the named drink's own spec instead.
4. **Make it new.** If the result lands too close to an existing recipe, one non-essential component is swapped until it doesn't.
5. **Balance it.** The spirit pour is anchored at the family's typical dose. Acid and sugar levers are solved to hit the family's post-dilution concentration targets, using Dave Arnold's dilution curves, adjusted for crushed ice and flash-blending. ABV is then kept inside the family's band. Amounts are snapped to what a bartender can measure (¼ oz steps, teaspoons, dashes, drops).
6. **Explain it.** The explanation covers family lineage, the closest catalogued relatives and what they share, pairings with their pedigree, rum-blend precedent, strength compared with famous drinks, and prep notes for anything homemade or specialty.

Only ingredients marked `common`, `specialty` or `homemade` (trivial from common ingredients) and costing no more than tier 3 are ever used. Defunct products (Wray & Nephew 17, Bacardi 151, original Lemon Hart 151) stay in the historical records as `orig` notes but map to modern equivalents.

## Accuracy and sources

Every record carries `source`, `source_urls` and a `confidence` rating (high, medium or low). The generator weights records by confidence and by fame, so a well-documented classic counts more than a single-source obscurity. Main sources:

- Jeff "Beachbum" Berry's books
- Martin and Rebecca Cate's *Smuggler's Cove*
- Trader Vic's *Book of Food & Drink* (1946) and *Bartender's Guide* (1947/1972)
- Transcriptions of 19th- and early-20th-century bar books from the EUVS digital library
- The Floridita and Club de Cantineros manuals
- *Minimalist Tiki*, *Tropical Standard*, Shannon Mustipher's *Tiki*, and Punch's *Easy Tiki*
- Difford's Guide

Most of these were read through public GitHub transcriptions: SBoudrias/cocktails, stephencattaneo/sc-drink-helper, robinn4k/Stirio, rasmusab/iba-cocktails and LauraMarby/IA-SRI-SIM_Project. The importers under `scripts/import/` are reproducible. Only recipe facts (ingredients, amounts, method, attribution) are recorded; notes are written fresh.

The research sandbox blocked direct page fetches to most cocktail sites and capped web searches, so some records were checked only against search snippets or one transcription. Those are marked `medium` or `low`, and contested facts are called out in `docs/history.md`.

## Adding a drink

Add a record to the right slice in `data/drinks/`, following `data/SCHEMA.md`. Run `node scripts/validate.mjs data/drinks/<slice>.json`, then `npm run build`. If it needs an ingredient that isn't in `data/ingredients.json`, add it there with ABV, sugar, acid, flavor tags and availability.

## License

MIT, see [LICENSE](LICENSE). Recipe facts are credited to their creators and sources; [NOTICE.md](NOTICE.md) covers the imported data slices and third-party names.
