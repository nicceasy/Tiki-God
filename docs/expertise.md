# How the generator thinks like a tiki bartender

The generator used to assemble a drink from statistics: pick a family, sample roles, balance the numbers. Its drinks balanced, but they often weren't what their labels said. You'd get a "colada" with no coconut, a tagline promising banana when nothing in the glass was banana, or a "blue" drink that came out swamp-green. This document describes the rebuild. Every drink is now built on a proven structure, the copy is checked against the glass, and the color is computed from what is poured.

The expert research behind it lives in [`docs/research/`](research/):

- [technique.md](research/technique.md): balance, method, ice, garnish, red flags, and the machine rules in `data/technique-rules.json`.
- [color.md](research/color.md): the optics model and its calibration.
- [presentation.md](research/presentation.md): garnish theater, drawing, cultural sensitivity and the voice of menu copy.
- [critique-round0.md](research/critique-round0.md): the aficionado critic's review of the old system, with its rubric.

The researched data itself is:

- `data/archetypes.json`: 59 archetypes.
- `data/concepts.json`: 618 prayer concepts covering 5,669 phrases.
- The `optics` field of every ingredient in `data/ingredients.json`.

## 1. Archetypes: the drink is built on a proven frame

An archetype (`data/archetypes.json`, compiled by `scripts/archetypes-build.mjs`) is a structure a tiki aficionado would recognize: Zombie, Mai Tai, Navy Grog, Piña Colada, Painkiller, Queen's Park Swizzle, Jungle Bird, Fog Cutter, Tom and Jerry, and so on. Each one records:

- **signature**: the components that make it what it is, each with the bottles that can fill it and a dose range. A colada is rum, pineapple and coconut, or it isn't a colada.
- **optional** slots: where a riff can happen.
- **forbidden** bottles: a Mai Tai never takes pineapple juice unless the guest asks for it.
- **canonical specs**: two to six historical recipes, with sources.
- **ratios**: the archetype's own ABV and sugar-to-acid windows.
- **service**: methods, ice and vessels.
- **garnish**: required, typical and never.
- **look, flavor profile and red flags.**

The research had to use proxies for a few ingredients the pantry lacked. Once those were added (fassionola, Tom and Jerry batter, cane syrup, the right sherries), the build script put the real bottles back.

`web/lib/composer.js` builds the drink the way a bartender riffs. People call this the "Mr. Potato Head" method:

1. **Pick the archetype.** It must be feasible: every required component needs a bottle the guest allows. It is scored against the prayer's flavors, families, concepts, strength, style and color. A family word means its canonical frame first ("a colada" means the Piña Colada's frame). Praying again moves to the next frame that still answers the prayer.
2. **Start from a canonical spec**, the one that best fits the prayer. A spec that doesn't carry its own archetype's signature is treated as a variant and never used as a starting point.
3. **Swap parts inside the slots**, in this order:
   - Requested spirits take over the base, or split it when the base is load-bearing. The 151 *is* a Cobra's Fang.
   - Requested bottles refill or open a slot. If no slot fits, they are worked in as a bartender would: trade part of the main juice, or let a flavored syrup take the plain syrup's job.
   - Requested flavors swap a slot's filling.
   - A flavor a spirit carries gets a split base: mezcal for smoke, pot-still Jamaican for funk.
   - "Three rums" are layered by job.
   - Zero-proof drinks swap each spirit for tea or juice and each liqueur for its alcohol-free twin.
   - Celebrations get topped with bubbles.
4. **Repair**: any signature component that went missing goes back in.
5. **Trim** to the family's ceiling from the research (a daiquiri is five things, a colada six), never below what the archetype's own canonical specs pour, and never the last sweetener or the last acid.
6. **Cap** every accent at the researched maximum dose.

A bare classic name ("zombie", "navy grog", "a tom and jerry") pours the classic as written and credits its creator. Praying again riffs on it with one signed change. "X but Y" changes exactly Y.

`composer.satisfies()` checks the finished drink against its archetype. Components the guest ruled out (orgeat in a nut-free Mai Tai) are *waived*, and the card says the drink is a cousin, not the real thing.

## 2. Construction, balance and technique

Before balancing, `structure()` makes the build one a bartender would pour without adjusting:

- Same-origin spirits pour as one line (2½ oz Jamaican and ½ oz Jamaican pot still is one pour).
- One overproof in the body, at most three spirits and two citruses, one fizzy top.
- A float is a float: half an ounce of overproof, three-quarters of anything else. The Dark 'n Stormy's cloud stays black rum.
- A batter already is the butter and the sugar.

`balanceTo()` in `web/lib/engine.js` balances against a proven reference: the canonical spec the build started from, or the drink being riffed.

- It aims at that reference's sugar-to-acid ratio, kept inside both the archetype's band and the research's family window (`data/technique-rules.json`).
- "Less sweet", "very tart" and a frozen build are numeric targets, so the card tastes different from the reference. A sweet drink with no acid, asked to be less sweet, gets half an ounce of lime.
- The body is balanced without its sink: the grenadine blooms into a drink that is already right.
- Only sweeteners and citrus move. Plain syrups move before flavored ones. Liqueurs and juices keep their spec doses.
- Sours keep at least 0.5 g of acid per 100 ml (0.55 frozen); frozen drinks reach about 8.6 g of sugar; hot drinks hold 3–7 g and at most half an ounce of citrus.
- The spirit moves only for a stronger or gentler ask, and never past the archetype's spirit range.
- A low-ABV prayer lands at or under 7%: liqueurs come down first, then the spirit, then the drink is lengthened with juice or soda, never with more wine.

After balance, `floors()` enforces real pours: 1½ oz of spirit (2 for coladas and frozen drinks), at most 2½ (3 for heavyweights, 2 per bowl cup, about 1½ standard drinks per party cup), ¾ oz for each spirit in a split, mezcal at ¾ oz unless asked, and minimum doses by role (no teaspoon of gin, no half-teaspoon of syrup). `settle()` then nudges one sweetener or citrus a bar measure at a time, so rounding to quarter ounces and teaspoons doesn't undo the balance.

`fixTechnique()` and `steps()` keep the method honest:

- Egg white is always dry-shaken and never swizzled or blended.
- Cream is never stirred.
- Carbonation is held back and topped.
- Each kind of ice gets its own service: an up drink is double-strained into a chilled glass, the Navy Grog's ice cone is described, shaved ice is packed.
- Fire comes with safety lines.
- A batch for a group gives totals and a method for its vessel: shaken in rounds for a Scorpion or tiki bowl, stirred with cold water over a block frozen the night before for a punch bowl.

Servings and vessels follow the drink:

- A number in the prayer is the number. A party with no number is a batch for eight in a punch bowl; a bowl drink asked for one serves two; nothing is poured into a bowl for one, and a punch bowl is only for six or more.
- The archetype's own glassware comes first, chosen by the research's fill ranges (a Zombie's six ounces belong in a chimney). Colors, sinks and floats go in clear glass; a swizzle goes in a glass with straight sides.
- A vessel the guest asked for gets a drink scaled to fit it (a colada in a coconut is about eleven ounces).

## 3. Color: computed from what's poured

`web/lib/optics.js` implements the calibrated model from [color.md](research/color.md).

- **Absorbance.** Each ingredient absorbs light by Beer–Lambert (absorbances add in linear light), scaled by its `tint`.
- **Scattering.** Cloudy ingredients scatter. Turbidity is `1 − exp(−8·Σ f·scatter)`, and the scattered light takes the scatterers' whitened color, filtered over a shorter path. That's why a Painkiller is tan and a Piña Colada is pale cream-yellow.
- **Layers.** A float holds only if it's lighter than the *diluted* body, and a sink only if it's denser. Bands are sized by the research's formulas. A sink carries a mixing zone above it, so grenadine in orange juice reads red-orange and blue curaçao under pineapple reads green, never violet.

`tests/optics.test.mjs` checks 43 catalogued classics against their reference colors.

A color the guest asks for is a demand. The engine first tries to refill a slot with a bottle of that color. Next it opens a slot for one, lightens bottles that muddy it (dark rum under blue curaçao), or pours the classic carrier for that color (a grenadine sunrise for red). If the archetype still can't show the color, it tries the next archetype. The drink goes in a clear glass, never an opaque mug. A concept's color, such as "promotion" leaning gold, is only a preference.

## 4. Copy that tells the truth

`web/lib/copy.js` writes the copy from what is actually in the glass.

- **Tagline.** It starts with an archetype voice word that the drink earns ("frosty" needs ice; "potent" needs at least 15% ABV). Then the type noun (a "Zombie-style heavyweight", a "Mai Tai cousin"). Then up to two hero bottles named the way a menu would: whatever was asked for, changed, or sits outside the archetype's signature. It ends with the prayer's mood. A mood line that names a color or describes the build ("the sunrise sunk to the bottom") is used only if it's true.
- **Tasting note.** It follows the order a drinker meets the drink: the nose (an aroma garnish or a float), the palate (citrus and fruit by name, the spirit's voice, the modifiers), the finish (bitters, falernum, anise). Then texture, balance and strength. It uses only each ingredient's lead flavor, never a secondary note such as the banana hidden in Jamaican rum's funk.
- **Why it works.** It covers what the drink is built on, what changed and how that answers the prayer, one line of history, and strength in US standard drinks. Heavyweights get Don the Beachcomber's two-per-guest rule.
- **Names** (`web/lib/names.js`). They come from the prayer's imagery first.
  - A flavor word appears only if an ingredient leads with that flavor at a dose you can taste.
  - A color word appears only if the optics show the color, and an ingredient noun only if the ingredient is poured.
  - Places appear only for spirits with a sense of place.
  - A riff's name says what changed.
  - Sacred, colonial and caricature terms are never used, including Hawaiian words as decoration.
- **Garnish.** It is aroma first, then one piece of theater, and it never lies. A fruit garnish shows only a fruit that's in the drink, and never one the guest refused. An up drink gets one pick or peel. A hot drink gets nothing from the ice world. The count fits the vessel.

## 5. The internal critic

`web/lib/lint.js` encodes the technique research as rules: dose caps, exclusive groups, incompatibilities, method and vessel rules, family requirements, garnish truth and copy checks. `generate()` lints every build that isn't a classic poured as written. If anything is fatal (a colada with no coconut, an overproof pour, an overflowing glass), it rebuilds on the next frame that answers the prayer, up to three times, and serves the build with the fewest fatal findings. `node scripts/lint-battery.mjs` runs it over the review battery.

## 6. Hearing the prayer

`web/lib/prompt.js` reads a prayer the way a bartender would.

**Concepts.** The 618 researched concepts (`data/concepts.json`, built by `scripts/concepts-build.mjs` from [moods, places and culture research](research/)) cover moods, occasions, relationships, food, pop culture, lore, fantasy, personas, textures, places, eras, seasons, weather, nature and colors.

- They're matched on word stems, with typo tolerance that never rewrites a word the lexicon already knows.
- Adjectives fall back to their roots ("coconutty" reads as coconut).
- "A night in Tahiti" is not a cozy night in.
- A phrase two concepts both claim goes to the more specific one.

**Each concept** brings:

- flavor tags;
- bottles the drink should lean toward (a hero bottle weighted 1.6 is placed);
- bottles to avoid;
- style, color, families and vessels;
- garnish ideas;
- name words and tagline moods;
- a reading the Shrine says back.

**Promises.** Each reading names a hero (dad's bourbon, Tokyo's Japanese whisky and yuzu, a dragon's mezcal and chile) or a service (a first date served up). Frames that can keep the promise score higher, the hero is poured, and a build that breaks a promise tries the next frame.

**The hand-tuned lexicon** handles explicit asks: spirits, bottles, flavors, styles, colors, negation and diets. A color word is a demand; a mood that only suggests a color ("romantic") is a leaning. A flavor named outright beats a concept's soft avoid (coffee liqueur in "a coffee nightcap").

- Negation stops at a comma ("not too sweet, very tart").
- Intensifiers turn the next wish up ("extra smoky").
- A color word the guest says is a demand.

The Shrine's **How the gods heard you** section shows the full reading:

- each phrase and what it meant;
- the frame the drink is built on;
- the moves made to answer the prayer;
- anything the guest ruled out;
- any words nobody caught.

## 7. The author/critic loop

The drinks were reviewed in rounds by an aficionado critic. That persona knows the canon, drinkware, construction, history and aesthetics, and cares that tiki stays accessible, fun and respectful. The critic is a workflow of four lens reviewers plus a lead critic who scores every drink on the round-0 rubric and rules on the packet-level gates.

1. **Construction**: balance, technique, capacity.
2. **Canon and drinkware.**
3. **Looks**: the rendered contact sheets.
4. **Prayer fidelity, naming and fun.**

The material for each round comes from:

- `scripts/review/packet.mjs`: 48 prayers × 2 seeds, written out as JSON and as a readable dossier.
- `node scripts/build-site.mjs --review <dir>` plus `scripts/review/shoot.mjs`: contact sheets of the drawings.

`tests/invariants.test.mjs` encodes the critic's non-negotiables across the whole battery at three seeds:

- archetype truth;
- coladas with coconut and pineapple;
- truthful taglines and garnishes;
- steps that match the service;
- seeds that differ;
- strength that fits the prayer;
- names that aren't culturally careless.
