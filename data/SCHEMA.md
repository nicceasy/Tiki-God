# Drink record schema

Each drink is one JSON object. Slice files live in `data/drinks/*.json` (an array of drinks); `scripts/merge.mjs` combines them into `data/drinks.json`.

```json
{
  "id": "zombie-1934",
  "name": "Zombie",
  "variant": "1934, Don the Beachcomber (Berry decode)",
  "aka": ["Zombie Punch"],
  "family": "zombie",
  "families_secondary": [],
  "year": 1934,
  "circa": false,
  "era": "golden",
  "creator": "Donn Beach",
  "venue": "Don the Beachcomber",
  "location": "Hollywood, California, USA",
  "popularity": 5,
  "parents": ["Planter's Punch", "Daiquiri"],
  "ingredients": [
    { "id": "lime", "amount": 0.75, "unit": "oz" },
    { "id": "rum-jamaican-aged", "amount": 1.5, "unit": "oz", "orig": "gold Jamaican rum" },
    { "id": "rum-demerara-overproof", "amount": 1, "unit": "oz", "orig": "Lemon Hart 151" },
    { "id": "pastis", "amount": 6, "unit": "drop", "orig": "Pernod" },
    { "id": "mint", "amount": 1, "unit": "sprig", "garnish": true }
  ],
  "method": "flash-blend",
  "ice": "crushed",
  "glass": "chimney / zombie glass",
  "garnish": ["mint sprig"],
  "servings": 1,
  "source": "Jeff Berry, Sippin' Safari (2007)",
  "source_urls": ["https://..."],
  "confidence": "high",
  "notes": "Short note in our own words (history, what's distinctive)."
}
```

## Field rules

| field | rule |
|---|---|
| `id` | kebab-case, unique. Add a variant suffix when needed: `mai-tai-1944`, `mai-tai-royal-hawaiian`. |
| `name` | Common name. |
| `variant` | Which version this is (year/venue/author of the spec), or `""`. |
| `family` | One of the ids in `data/families.json`. |
| `year` | Integer year of creation (best estimate) or `null`. Set `circa: true` when approximate. |
| `era` | `colonial` (<1900) · `pre-tiki` (1900–1933) · `golden` (1934–1959) · `late-classic` (1960–1979) · `decline` (1980–1997) · `revival` (1998–2009) · `craft` (2010–) |
| `popularity` | 5 iconic (everyone knows it) · 4 well-known classic · 3 known to enthusiasts · 2 deep cut · 1 obscure |
| `parents` | Names of drinks this one descends from, riffs on, or was modeled after (best effort; free text names, resolved to ids at merge). `[]` if none known. |
| `ingredients[].id` | Must exist in `data/ingredients.json`. Historical/defunct products are mapped to the closest modern available ID and the original is kept in `orig`. |
| `ingredients[].unit` | `oz ml cl tsp tbsp barspoon dash drop cup splash rinse scoop top piece leaves sprig slice pinch garnish` |
| `ingredients[].float` | `true` if floated on top. |
| `ingredients[].garnish` | `true` if it's a flavor-relevant garnish (grated nutmeg, mint bouquet). Decorative garnish goes only in `garnish[]`. |
| `method` | `shake` · `flash-blend` (spindle mixer, few seconds, crushed ice) · `blend` (frozen) · `swizzle` · `build` · `stir` · `hot` · `muddle-build` |
| `ice` | `crushed` · `cubed` · `pebble` · `shaved` · `block` · `none` · `blended` · `ice-cone` |
| `servings` | For bowls/punches, the number of servings the listed recipe makes (analysis divides by it). |
| `confidence` | `high` well-documented canonical spec · `medium` several variants exist, representative one chosen · `low` reconstruction / uncertain. |

## Conversion conventions

- Fresh pineapple chunks: ~¼ cup chunks ≈ 1 oz `pineapple-juice`.
- Granulated sugar by the teaspoon → the same number of tsp of `rich-simple` (`orig: "sugar"`); brown sugar → `demerara-syrup`.
- Commercial sweet-and-sour mix → half `lemon`, half `simple-syrup` (note it in `orig`).
- Rock candy syrup / cane syrup → `rich-simple`.
- Bacardi 151 → `rum-overproof-white`; Lemon Hart 151 → `rum-demerara-overproof`; Wray & Nephew 17 → `rum-jamaican-aged`; Rhum St. James → `rum-agricole-vieux`; Myers's / Coruba → `rum-jamaican-dark`; Pusser's → `rum-navy`.
- "Dark rum" (unspecified) in resort drinks → `rum-jamaican-dark`; "gold rum" → `rum-gold-column`; "light/white rum" → `rum-white-column`.
