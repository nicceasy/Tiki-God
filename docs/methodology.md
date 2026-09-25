# What makes a good tiki drink

This is the model behind the generator: what the catalogue says about proven tiki drinks, and how those findings become rules for building new ones. Exact current figures for every family, era, ingredient and pairing are in the auto-generated [analysis.md](analysis.md); the numbers quoted here are rounded from it.

## 1. How the data is measured

The catalogue holds **1,070 drinks**. About 300 are hand-researched records (Donn Beach, Trader Vic, the golden-age venues, the punch and sour ancestors, resort drinks, the 1990s revival, craft-era originals and deep cuts). 362 come from structured transcriptions of tiki and cocktail books, and 414 are the tropical subset of Difford's Guide, selected by explicit rules (`scripts/import/`). Where two sources describe the same spec, the better-documented one wins. Genuinely different specs of one drink are all kept: 58 drinks appear in more than one version, such as the Navy Grog from Donn Beach, Smuggler's Cove and the Tropical Standard.

Every drink is stored as an original spec: ingredient ids from `data/ingredients.json`, amounts, method, ice, glass, garnish and servings. Historical products that no longer exist are mapped to their closest modern bottle, with the original kept in `orig`. For analysis each drink is converted to one serving and run through a simple chemistry model:

- **Ingredients carry ABV, sugar and acid** in grams per 100 ml. Citrus, syrup and liqueur values follow Dave Arnold's *Liquid Intelligence* tables where they exist and label figures otherwise. Lime is 6% acid, a 1:1 simple syrup is 61.5 g sugar per 100 ml, and Cointreau is 40% ABV with 25 g sugar.
- **Dilution** uses Arnold's shaken and stirred curves as a function of the pre-dilution ABV. Crushed-ice methods are scaled up: shaking over crushed ice ×1.15, swizzling ×1.2, flash-blending ×1.3. Frozen drinks count the ice as part of the drink. Everything is compared **after dilution**, because that's what you drink.
- **Weights:** famous drinks count more than obscure ones (fame 5 weighs 4× fame 1), and well-documented specs count more than reconstructions (confidence *low* weighs 0.6× *high*). The premise, as the project brief put it, is that we already know the popular ones are good.

## 2. What the catalogue says

### 2.1 There is a balance window, and it's wider and sweeter than a classic sour's

Across the catalogue, the weighted median drink lands at about **14% ABV, 7.3 g sugar and 0.67 g acid per 100 ml**, a sugar-to-acid ratio of about **11 : 1** by weight. The middle half runs from about 8.4 : 1 to 15 : 1. A classic Daiquiri sits near 8 : 1, at the tart end. Tiki drinks run sweeter because pineapple, orange and passion fruit add sugar without much acid, and because liqueurs sweeten while they flavor.

The window is family-specific, and the generator balances to the family's own range, not the global one:

- **Zombies and Beachcomber spice sours** are the tartest and strongest: sugar:acid near 9–10, about 14–17% ABV. The Zombie family is the extreme at about 8.7 : 1 and 17%.
- **Mai Tais** sit at about 16% ABV with a ratio near 10.5.
- **Colada-family** drinks are barely acidic (ratios of 14–46, median about 25) and gentle (about 9% ABV). The coconut fat does the balancing work that acid does elsewhere.
- **Resort punches** run about 11% ABV at a ratio near 11.

### 2.2 The skeleton is still punch

Strip away the modifiers and nearly every family keeps the 17th-century punch skeleton: strong, sour, sweet, weak. Median ounces by role, among drinks that use each role:

| family | formula |
|---|---|
| Mai Tai | 2 spirit : 1 sour : ¾ sweet : ½ liqueur |
| Zombie & heavyweights | 3 spirit : 1 sour : 1 juice : ½ sweet : ½ liqueur |
| Beachcomber spice sours | 2 spirit : ¾ sour : ¾ juice : ⅔ sweet : ½ liqueur |
| Grog | 2¼ spirit : 1¼ sour : ¾ juice : ½ sweet |
| Scorpion / Fog Cutter | 2 spirit : ¾ sour : 1 juice : ½ sweet : ½ liqueur |
| Colada | 1½ spirit : 2 juice : 1 cream : 1 liqueur (half add ½ sour) |
| Resort punch | 2 spirit : ¾ sour : 3 juice : ½ sweet : ¾ liqueur |

The Mai Tai row reproduces Trader Vic's own template (2 : 1 : ½ curaçao : ½ orgeat + ¼ rock candy). Vic reused it with bourbon in the Honi Honi, tequila in the Pinky Gonzales and light rum in the Menehune Juice. Base spirits sit at **2 oz** across the catalogue (middle half 1½–2 oz), and the Zombie is the famous exception.

### 2.3 Lime is the default acid, and Vic used lemon

Lime appears in about 62% of drinks (weighted) at a typical ¾ oz or less. Lemon appears in about a quarter, concentrated in Trader Vic's orgeat punches and in gin and brandy drinks. Grapefruit is the Beachcomber's second acid (Navy Grog, Zombie, Jet Pilot), usually alongside lime and often pre-mixed with cinnamon as "Don's Mix".

### 2.4 Rum is blended by job, not by brand

About a third of golden-age and late-classic drinks use two or more rums. Each style does a job:

| style | job | examples in the canon |
|---|---|---|
| light / column rum | body without noise | Daiquiri, Scorpion |
| gold or aged Jamaican | fruit and funk | Mai Tai, Zombie |
| dark Jamaican | molasses and caramel | Planter's Punch, Test Pilot |
| Demerara | burnt sugar and smoke | Navy Grog, Queen's Park Swizzle |
| 151 Demerara | lift and char, usually ¾–1 oz | Zombie, Jet Pilot, Cobra's Fang |
| aged agricole | grass and dryness | Three Dots and a Dash, the second Mai Tai |

The most common pair is light rum with dark Jamaican. Don's classic stack is gold Puerto Rican, Jamaican and 151 Demerara. The generator splits the base pour 55/45 for two rums and 40/35/25 for three, and holds overproof back to the dose the catalogue actually uses.

### 2.5 Accords: combinations that recur far more than chance

Pointwise mutual information (PMI) measures how much more often two ingredients meet than their individual frequencies predict. The strongest accords with real support (at least five drinks):

- **Pernod drops + 151 Demerara, Pernod + Angostura, Pernod + falernum.** Donn Beach's seasoning: the Zombie, Jet Pilot, Cobra's Fang and Test Pilot.
- **Allspice dram + honey, allspice + Demerara, allspice + grapefruit.** The Three Dots and a Dash and the Ancient Mariner.
- **Orange curaçao + orgeat, and mint + orgeat.** The Mai Tai and everything built on it.
- **Brandy + gin + orgeat + orange.** Trader Vic's Scorpion and Fog Cutter.
- **Honey + soda** (grogs and coolers), and **cinnamon + banana** (a craft-era favorite).
- **Coconut cream + pineapple.** The colada, obviously.

The generator scores every candidate by its PMI with what's already in the glass. So "spicy" in a Beachcomber sour pulls toward allspice and honey, and "coconut" pulls toward pineapple, because proven drinks do.

### 2.6 Seasoning by the drop

Angostura appears in about a quarter of drinks at a dash or two, and anise in drops (six drops of Pernod is Don's constant). Accents are measured in dashes and drops, never ounces, except in the craft era's deliberate inversions: the Trinidad Sour's 1½ oz of Angostura and the Chartreuse Swizzle's Chartreuse base.

### 2.7 The crowd favors long, gentle and simple

Comparing drinks rated famous (4–5) with obscure ones (1–2), unweighted:

| | famous | obscure |
|---|---|---|
| drinks | 56 | 907 |
| ABV after dilution | ~11.9% | ~14.2% |
| volume before ice | ~5¼ oz | ~4 oz |
| sugar : acid | ~11.0 | ~10.8 |
| ingredients | 5 | 5 |

The drinks that became famous are longer, gentler and a touch sweeter than the deep cuts, with no more ingredients. Complexity doesn't make a classic; balance and drinkability do. The generator therefore defaults to the family median and adds complexity only when asked ("complex", "layered", "show-stopper").

### 2.8 Eras move the balance

Dated drinks only; medians, unweighted.

| era | drinks | ABV | sugar : acid | juice share of volume | two or more rums | non-rum base |
|---|---|---|---|---|---|---|
| colonial punch | 24 | ~14% | ~14 | 0% | 0% | 29% |
| pre-tiki (Cuba, swizzles) | 56 | ~16% | ~10 | 0% | 5% | 20% |
| golden age (1934–59) | 93 | ~15% | ~10 | 0% | 33% | 24% |
| late classic (1960–79) | 35 | ~12% | ~10 | 13% | 34% | 37% |
| decline (1980–97) | 9 | ~12% | ~14.5 | 38% | 22% | 22% |
| revival (1998–2009) | 102 | ~15% | ~10 | 0% | 9% | 19% |
| craft (2010–) | 99 | ~14% | ~11 | 0% | 5% | 15% |

The golden age invented the rum blend: a third of its drinks stack two or more rums, against 5–9% before and after. The few dated decline-era drinks are juice-heavy and sweet. The revival and craft eras restored strength and fresh acid, ran a touch sweeter, and kept using gin, agave, whiskey and aquavit bases in the Mai Tai, spice-sour and colada skeletons with the other ingredients unchanged.

## 3. How the generator uses this

1. **Parse the prompt** into an intent. The prompt lexicon (about 750 phrases) maps words to weighted flavor tags, spirits, bottles, families, styles, colors, moods and places. It handles negation ("no coconut" is a hard exclusion, "less sweet" a soft shift), diets (nut-free, dairy-free, vegan), serving counts and named drinks, which start a riff. It also knows food references ("Dreamsicle", "bananas Foster", "horchata").
2. **Choose a family.** Each family is scored on:
   - the fit between the prompt's flavor weights and the family's flavor centroid, measured from its member drinks
   - its style fit (hot, creamy, bitter, stirred, long, frozen, bowl)
   - how far it can move on strength and complexity
   - a prior for well-established families

   Seed 0 takes the best family; *Shake again* samples from the top few. A riff keeps its source drink's family.
3. **Fill the skeleton.** Role counts come from the family's data (for example, a Zombie usually has three spirits, a sour, a sweetener, a liqueur, an accent and often a juice). Each slot scores every available ingredient in that role:
   - **1.6 × log(family share) + 0.6 × log(global share):** what the family and the whole catalogue actually use
   - **+ 2.4 × prompt match:** fit to the prompt's flavor weights, with the first-listed flavor of each ingredient dominant
   - **+ 1.5 × family flavor fit:** so replacements taste like they belong
   - **+ 1.1 × mean PMI with what's already chosen:** falling back to flavor-tag affinity for rare ingredients
   - **− penalties:** specialty or homemade items, pricey bottles, dairy next to citrus, and blue or green liqueurs nobody asked for

   Exclusive groups stop redundant picks, such as two orange liqueurs or two plain syrups.
4. **Honor the request.** Any strongly requested flavor that isn't carried prominently gets the best carrier, which is protected from later swaps. Explicitly named bottles are always used.
5. **Make it new.** If the ingredient set overlaps an existing recipe by 80% or more (Jaccard), one non-essential component is swapped for a well-paired alternative until it doesn't. The explanation names the drink it stepped away from.
6. **Balance.** Spirits are anchored at the family's typical pour (floored at 1¾ oz, 2 oz for stirred drinks), and overproof is capped at its usual dose. Acid and sugar levers are solved iteratively to hit the family's post-dilution targets, shifted by the prompt ("tart", "not too sweet"). A riff aims at its own source drink's chemistry instead. ABV is then held inside the family band, and absurd sizes are corrected.
7. **Snap to the bar.** Amounts round to ¼ oz, teaspoons or half-teaspoons, dashes and drops, and the chemistry is recomputed from the rounded spec.
8. **Explain it.** The explanation includes:
   - the family story and its line of descent
   - the design moves the generator made
   - the closest catalogued relatives and what they share
   - accords with the drinks that prove them
   - rum-blend precedent
   - where the drink sits in its family's balance ranges
   - a strength comparison with a famous drink of similar ABV
   - a palate walk: opening, body, finish
   - prep notes for homemade or specialty items

## 4. Availability rules

The generator only uses ingredients marked `common`, `specialty` (a good shop or online, not expensive) or `homemade` (trivial from common ingredients: honey syrup, cinnamon syrup, Don's Mix). It skips anything above cost tier 3. Rare and defunct products, such as Wray & Nephew 17, Bacardi 151, okolehao and the original Lemon Hart 151, never appear in generated drinks. Each ingredient carries example bottles and substitutes, and the explanation lists them for anything specialty or homemade.

## 5. Limits

- **Chemistry isn't taste.** The model captures sugar, acid, strength and dilution. It doesn't capture texture, aroma intensity or bitterness beyond a tag.
- **The lexicon is hand-built.** Phrasing it doesn't know is ignored rather than guessed; the "Heard" chips on every result show what it understood.
- **Some records are medium or low confidence.** The research environment blocked most direct page fetches, so some were checked against a single transcription or search snippets. They are weighted down, and the data can be tightened record by record.
- **Families are a simplification.** Some drinks straddle two families (`families_secondary`), and the family formulas are medians, not laws.
