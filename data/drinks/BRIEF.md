# Cataloguing brief (shared by all research agents)

Goal: build the most complete, accurate database of tiki and tiki-adjacent tropical drinks ever assembled, so we can statistically model what makes a good tiki drink. Accuracy of proportions matters more than anything else — a wrong spec poisons the model.

## Read first
- `data/SCHEMA.md` — record format and conversion conventions.
- `data/ingredients.json` — the ONLY ingredient IDs you may use (plus any you propose, see below).
- `data/families.json` — the family ids.

## Your output
- Write your slice to `data/drinks/<slice>.json` — a JSON array of drink records.
- Validate with `node scripts/validate.mjs data/drinks/<slice>.json` and fix every ERROR before finishing.
- Do NOT edit any other file in the repo. Do NOT commit or push.

## Research rules
1. Use web research (WebSearch / WebFetch) to verify every spec you can. Good sources: Jeff "Beachbum" Berry's books as quoted/cited on reputable sites, Martin & Rebecca Cate's *Smuggler's Cove* book, Trader Vic's *Bartender's Guide* (1947 / 1972), Difford's Guide, Punch (punchdrink.com), Imbibe, Liquor.com, Kindred Cocktails, The Atomic Grog (atomicgrog.com), Cocktail Wonk (Matt Pietrek), Critiki, Tiki Central, Saveur, Serious Eats, Wikipedia (history only), bar/restaurant sites. Prefer the most authoritative/original spec. When a drink has famous variants that differ materially (e.g. Zombie 1934 vs 1956; Mai Tai 1944 vs Royal Hawaiian 1953), create separate records with distinct ids and `variant` text.
2. Convert everything to the schema units. Map historical/defunct products to the closest modern available ingredient ID and keep the original wording in `orig` (e.g. `{"id":"rum-jamaican-aged","amount":1,"unit":"oz","orig":"Wray & Nephew 17 yr"}`).
3. Include flavor-relevant garnishes (grated nutmeg, swizzled mint, cinnamon) as ingredients with `"garnish": true` and unit `garnish`/`sprig`/`leaves`; decorative garnishes only in `garnish[]`.
4. Bowls/punches: record the recipe as published and set `servings`.
5. `notes`: 1–3 sentences in YOUR OWN WORDS (never paste book prose): what's distinctive, history, lineage. `parents`: names of drinks it descends from or riffs on.
6. `confidence`: be honest. `low` for reconstructions of secret recipes or specs you could only find in one weak source.
7. `source`: the book/person/site the spec comes from; `source_urls`: the pages you actually checked.
8. Popularity calibration: 5 = Mai Tai, Piña Colada, Painkiller, Zombie, Daiquiri, Hurricane, Mojito · 4 = Navy Grog, Jungle Bird, Scorpion, Planter's Punch, Missionary's Downfall, Queen's Park Swizzle, Blue Hawaii, Rum Runner · 3 = Test Pilot, Saturn, Three Dots and a Dash, Fog Cutter, Jet Pilot, Chartreuse Swizzle · 2 = Pearl Diver, Nui Nui, Cobra's Fang, Port Light · 1 = true obscurities.
9. Stay inside your slice. Other agents are covering the other slices (listed in your prompt) — skip drinks that clearly belong to them.
10. Ingredient IDs: map to existing IDs whenever the flavor is close enough (note the original in `orig`). Only if an ingredient truly cannot be mapped (and matters to the flavor), propose it in `data/drinks/<slice>.new-ingredients.json` as an array of objects with the same fields as entries in `data/ingredients.json` (id, name, cat, role, abv, sugar, acid, flavors (from `flavor_tags`), avail, cost, examples, subs, notes). The validator accepts IDs from that file.

## Final report (your last message)
- Count of drinks written, and the list of names.
- Drinks you deliberately skipped or couldn't verify.
- Any proposed new ingredients and why.
- Anything surprising you learned that matters for modeling (e.g. recurring ratios, house techniques).
