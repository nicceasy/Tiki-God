# Round 2 critique: the Tiki God packet (96 drinks, 48 prayers × 2 seeds)

Reviewer: lead critic. I read the whole of `packet.md`, all 12 contact sheets and my round-1 critique. I recomputed the duplicate, Jaccard, fill and garnish numbers from `packet.json`, and checked the lens reports' strongest claims against the packet and the repo data (`data/drinks.json`, `data/vessels.json`, `git log`). Scores use the round-0 rubric (critique-round0.md §4) and its hard caps: a blocker caps a drink at 3, and a misheard or ignored prayer caps it at 2.

## Verdict: NOT APPROVED

Round 2 is the best packet yet. The mean rose from **4.54 to 5.45**, and drinks at 6 or above rose from **27 to 45**. Drinks capped at 3 or below fell from 22 to 9.

The round-1 structural failures are mostly gone. There are no single serves in punch bowls. The Hot Buttered Rum has real batter, and the Scorpion has real brandy. "Less sweet" and "very tart" now move the numbers. Fruit garnishes match the lines (43 mismatches down to 0). There are no exact-duplicate specs. The copy no longer leaks guidance or engine words like "slot".

It still fails 8 of 10 gates, and I would not serve about a third of it. Four causes drive most of the remaining failures:

1. **The balancer only checks the sugar-to-acid ratio, never absolute sugar or the method.** The result is a 26.4 g/100 ml "Tart and bracing" punch, a frozen sour at 4.2 g, and seven frozen drinks under the frozen floor.
2. **The canon layer stamps "as the gods pour it" on lines alone.** It ignores method, vessel and ice, so a shaken No. 4, a punch-bowl Pi Yi and a Hemingway in a collins all pass as canon. Lineage claims also run backwards in time.
3. **Divergence is enforced only on exact specs.** Six open-prayer seed pairs still collapse. Three cross-prayer pairs have identical ingredient sets, "Zombie" is a title twice, and the colada family takes 16 of 96 drinks.
4. **The fidelity gate was met by muting the readings instead of pouring them.** "Bananas foster", "Havana 1957", "a night in Tahiti", "first date" (served up), "promotion" (the float) and "dad" (maple and smoke) still don't get the drink their own reading describes. The reading's voice has been replaced with a ledger.

### Headline numbers (measured from packet.json)

| Metric | Round 1 | Round 2 |
|---|---|---|
| Mean drink score | 4.54 | **5.45** |
| Drinks ≥ 6 | 27 (28%) | **45 (47%)** |
| Drinks ≥ 7 | ≈10 | 17 |
| Drinks ≥ 9 | 0 | 0 |
| Drinks capped ≤ 3 | 22 | 9 |
| Exact-duplicate spec clusters | 7 (16 drinks) | **0** |
| Cross-prayer identical ingredient sets (Jaccard 1.0) | — | 3 pairs (creamy s0 = coconut s0; Jamaican s0 = pirate s0; strongest s1 = no-coconut s0) |
| Repeated names | 0 | 1 ("Zombie" ×2: zombie s0, strongest s1) |
| Seed pairs Jaccard ≥ 0.6 | 11 | 9 (6 of them open prayers) |
| Fruit-garnish/ingredient mismatches | 43 | **0** (only canonical expressed peels and the Three Dots Morse pick) |
| "Fresh mint on the nose" / mint in garnish | — | 48 / 52 of 96 |
| "Tart and bracing" | — | 12 (4 of them false: 26.4 g, 17.6 g, the blended Painkiller, the cream-of-coconut Painkiller) |
| "Sweet and sour in balance" | 80 | 37 |
| "poured as the canon has it" / "as the gods pour it" | — | 21 lines (at least 5 on drinks served against the canon) |
| Vessel share | — | hurricane 25, DOF 18, collins 13; coupe 4; flute, tulip, snifter, Nick & Nora, julep, copper mug and hollowed pineapple 0 |

## What changed since round 1

**Fixed (don't regress):**
- Punch bowls for one.
- HBR with no batter.
- The 1-tsp Scorpion brandy.
- "Less sweet" ignored (the Painkiller s0 now has ¾ oz cream of coconut and ½ oz lime, at 8.2 g).
- "Tart" heard as "less tart" (Riptide Sour is at acid 1.11).
- Garnish mismatches, including the pineapple frond on "no pineapple".
- Template garnish leaks.
- Unlisted umbrellas.
- Exact-duplicate specs.
- "slot" and "keep it to 6 bottles".
- Guidance leaks ("Respect…", "don't reuse", the volcano joke list).
- "Ho'olaule'a" on Jamaica.
- Wrong credits (QPS, Bushwacker, grog).
- Real names for real classics.
- The swizzle in a hurricane.
- Topping order (sparkling wine, then the crushed-ice crown).
- The Zombie strength line on non-Zombies.
- Green and teal liquid in hot mugs.
- The Blue Hawaii drawn green.
- The dragon with no fire or heat.
- Tokyo with no tonic.
- The ocean not blue.
- The coconut colada at 20 oz in a 12 oz shell (now 10.9 oz, which still overflows).

**Persist:**
- Bananas Foster isn't Foster.
- Both ginger highballs aren't highballs.
- Mezcal and passion fruit uses passion fruit only as Fassionola.
- Hemingway isn't in a coupe.
- Frozen sours are under-sweet.
- Pool drinks are in glass.
- The promotion float is missing.
- Tahiti gets a colada.
- Havana gets Hollywood.
- "Floral" has no flower.
- "Bitter" gets Aperol.
- Low ABV is a 1 oz rum sunrise.
- Seed collapse on HBR, coffee, Painkiller and chocolate.

**Worse:**
- **The Tortuga lost an overproof** on the strongest prayer (3.3 → 2.7 sd).
- **New syrup-soup punches** on the Jamaican street party (26.4 g and 17.6 g).
- **The colada cluster** grew from 3 to 4 prayers.
- **Round 1's praised Nuclear Daiquiri** for green is gone.
- **Readings muted into ledgers** ('"grandmother's" → golden: brandy').
- **False canon stamps** on drinks served against the canon.
- **"Zombie" is a title twice.**
- **The "vivid pass" (454b8a9) drifts colours.** It paints amber, copper and oxblood looks as scarlet, and seed-parity tilt paints identical "Ruddy amber" Zombies three different colours.

## What I verified, corrected or dropped from the lens reports

- **Verified in the packet:**
  - The Tropical Itch carries '5 oz Passion fruit syrup' per serve and '5 cups (40 oz)' in the batch. `data/drinks.json` uses nectar, not syrup.
  - Sunday Best Frappé is at '4.2' g with no syrup.
  - The Tortuga 'here without its white overproof rum'.
  - 'Daiquiri No. 4 … as the gods pour it' is shaken and served up. The repo's own No. 4 is the Floridita frappé.
  - The Pi Yi is built in a punch bowl while its Why says 'served inside a hollowed-out pineapple'.
  - The Honi Honi is 'poured as the canon has it' alongside 'the twist: a dash of orange bitters'.
  - Lineage runs backwards in time: the Trinidad Especial (2008) 'runs back to' the 2009 Sour; the Hotel Nacional runs back to the Banana Daiquiri; the Bombo runs back to the Kingston Negroni.
  - The Canopy Toucan presses mint with no mint line, and the drawing shows the pressed mint.
  - Ashen Hoard is drawn on fire with no fire step (sheet 08).
  - The Kū mug is a googly-eyed cartoon (sheet 08).
  - Copra Conch's 'Creamy ivory' is painted grey (sheet 01).
  - The skull mugs are glazed teal and red, and their black floats are invisible (sheet 11).
  - HBR, grog and toddy mugs are in teal, cobalt, oxblood and jade (sheets 03, 05).
  - The "glazes that answer their neighbours" commit is real (454b8a9).
  - Woolen Mug's Moves says 'a barspoon of Islay Scotch' while the line says '½ tsp'.
  - 'NOT HEARD: night' appears ×4, including on 'Moonlit Hot Buttered Rum'.
- **Corrected (softened):**
  - The House Party Punch Cup (17.6 g) is a major fault, not a blocker. It sits in Pat O'Brien's Hurricane territory and is sweet but drinkable over a melting block. The 26.4 g Tropical Itch is a blocker.
  - First Light Punch (7.39 oz poured, 11.4 oz finished in a 13 oz collins) is tight, not an overflow.
  - The real overflows are "first date" s0 (11.4 oz in a 12 oz tin before the ice) and "in a coconut" s0 (10.9 oz in a 12 oz shell). The blended coladas at 20.0–20.9 oz in a 20 oz hurricane are a fit failure (major), not a blocker.
  - The HBR s0 water ratio (1½ : 6) is the Smuggler's Cove spec. Thin for "snowy night" is minor, not wrong.
- **Dropped as petty:**
  - '½ oz Coffee liqueur + 1 tsp demerara' at 8.8 g in a stirred rum Old Fashioned. That's within normal Old Fashioned sweetness.
  - Coupe proportions, and cube tint on two highballs.
- **Promoted:**
  - "a mai tai but tropical" s1 to a **B2 cap**. The card literally says '"tropical" → tropical: heard, but the rest of the prayer steered this drink'. That is "heard and ignored" by definition.
  - The fidelity regression (prayer lens: "readings silenced") to a ranked fix. A ledger is more honest than a lie, but the guest loses the reason the drink exists. The drinks themselves still have to keep the promises.

## Packet-level gates

| Gate | Pass | Evidence |
|---|---|---|
| Zero blockers | ✗ | 7 capped drinks. **B4:** 'Jamaican street party' s1 (26.4 g/100 ml, '5 oz Passion fruit syrup' per serve); 'my grandmother's garden' s0 (frozen, no syrup, 4.2 g); 'first date at the beach' s0 ('2 oz Water' shaken on crushed, 11.4 oz finished in a 12 oz tin, then 'top with crushed ice to fill'); 'in a coconut' s0 (10.9 oz finished in a 12 oz coconut, then topped with ice). **B2:** 'bananas foster' s0 and s1 (a Banana Daiquiri and a colada, no butter, sugar or cinnamon); 'a mai tai but tropical' s1 ('tropical: heard, but the rest of the prayer steered this drink'). |
| Zero exact duplicates and zero repeated names | ✗ | Exact specs: 0 (pass). Names: 'Zombie' appears twice (zombie s0; strongest s1 'Zombie (house name: Wraith Revenant)'). Three cross-prayer pairs have identical ingredient sets (Jaccard 1.0): creamy s0 = coconut s0 (cinnamon Painkiller); Jamaican s0 = pirate s0 (Jamaican rum, lime, passion fruit syrup, demerara, allspice, Angostura); strongest s1 = no-coconut s0 (SC Zombie, rescaled). |
| Seed pairs differ in concept for open prayers (Jaccard < 0.6) | ✗ | 'coffee and rum, stirred' 0.80 (s1 = s0 minus two dashes); 'chocolate and coffee dessert drink' 0.83 (s1 = s0 + ½ banana); 'something my dad would like' 0.71; 'something blue for the pool' 0.67 (two blue frozen daiquiris); 'low abv for brunch' 0.67 (cassis vs grenadine); 'something smoky and spicy' 0.62 (identical Moves). Named-classic pairs that also move one line: Painkiller 0.83, HBR 0.75 ('+¼ oz 151 float'), Navy Grog 0.75. |
| `Heard` non-empty for interpretable prayers | ✓ | 48/48 non-empty. The content regressed to ledgers ('"grandmother's" → golden: brandy') and echoes ('"coffee" → coffee'). It still leaks guidance ('A group: batchable, crowd-pleasing…') and shows 'NOT HEARD: night' ×4. |
| ≥ 90% of drinks score ≥ 6 | ✗ | 45/96 (47%) |
| Mean ≥ 7.5 | ✗ | 5.45 |
| ≥ 12 drinks score ≥ 9 | ✗ | 0. The best are Zombie s0 and Bourbon Navy Grog at 8.5, and QPS and Mezcal Jungle Bird at 8. |
| Zero phantom flavours | ✗ | The ingredient phantoms of round 1 (mint finishes, clove, cream) are gone. What remains are false or imperceptible headline claims. 'Tart and bracing.' on Wild Block Party Bowl (26.4 g) and House Party Punch Cup (17.6 g). 'Pineapple and coconut water up front' from ½ oz in 20.9 oz. 'banana and pineapple up front' from ¼ oz banana liqueur in 20.4 oz. 'vanilla and pineapple up front' from ¼ oz in 19.5 oz. That's 5 in all. |
| Zero garnish/ingredient mismatches | ✓ | 0 fruit garnishes without their fruit. The only exceptions are canonical: expressed orange peel on two stirred drinks, and the Three Dots Morse pick on Uncharted Curveball. |
| **Drawings match the recipes** (mine) | ✗ | **Fire:** Ashen Hoard is drawn with a lit shell, but nothing in the steps lights it. **Phantom mint:** Canopy Toucan shows pressed mint at the foot with no mint line. **Colour:** Overgrown Outpost 'Cloudy burnished copper' is painted scarlet; Broken Compass Bird 'oxblood' is cherry-red; Zombie s0 'Ruddy amber' is scarlet with three zones; Banana Daiquiri 'Honeyed amber' is lemon; Copra Conch 'Creamy ivory' is grey-blue; Deep End Snow's watermelon and curaçao are painted pure blue. **Hidden layers:** the skull mugs show no black float. **Garnish shapes:** banana coins are drawn as citrus wheels. **Glazes:** chosen by neighbour, not by drink (HBR teal vs cobalt). |

**Result: 2 of 10 gates pass** (round 1: 1 of 10).

## Ranked fixes (most leverage first)

### 1. A balance solver that knows absolute sugar, method and role (BLOCKER; about 25 drinks)
`engine.js settle()` balances only the sugar-to-acid ratio. 26.4 / 1.38 ≈ 19 sits "inside the window", so nothing fires.
- **Absolute bands by method, re-checked after every pass** (fit, trim, topper, batch):
  - shaken sours 8–11 g;
  - frozen sours 8.5–12 g, with acid 0.55–0.85;
  - punches 9–11 g;
  - non-dessert ceiling about 13 g;
  - stirred drinks under 10 g.
- **When the frozen floor can't be reached by scaling existing lines, add ½–¾ oz rich simple or demerara.** Today it multiplies capped liqueurs and silently gives up.
  - Sunday Best Frappé ('1¼ oz lime, ¾ oz elderflower, ¼ oz maraschino', 4.2 g) becomes 1½ rum, ½ brandy, ¾ lime, ½ elderflower, ½ rich simple and 1 tsp maraschino, at about 9.5 g.
  - Also fix Deep End Snow (6.0), Sideburns Tide (6.4 with '1 tsp simple syrup'), Brain Freeze Sour (7.0), Green Sakura (7.0) and Blooming Parlor (7.2).
- **Nectar and juice slots stay nectar and juice.** The Tropical Itch takes 3–4 oz passion fruit nectar, never '5 oz Passion fruit syrup'. A Jamaican street punch is 1½ oz Jamaican rum + ¼ oz overproof, ¾ oz lime, ½ oz demerara, ¼ oz pimento dram and 2 oz Ting or grapefruit soda per guest, over the block, at about 10 g.
- **One sweetener per job.** When a liqueur, Campari or vermouth carries the sugar, drop the plain syrup first.
  - Red Sky Afterglow: drop the '¼ oz simple syrup' after '1 oz Fassionola, ½ oz Grenadine'.
  - Ember Serpent: orgeat + simple + curaçao gives 12.1 g.
  - Uncharted Hideaway: '½ oz Li hing mui syrup' in a Kingston Negroni should be a barspoon or a rim.
  - Long-Lost Mariner: demerara + honey.
  - Gingered Doldrums: '2 tsp rich simple syrup' on ginger beer.
- **Water lines only when batching or building over a block.** Drop '2 oz Water' when the method is shake, flash-blend or swizzle on crushed ice (Low Tide Lounge Punch, Long-Lost Doubloon).
- **The balance word comes from absolute numbers.**
  - Above 12 g, the drink is 'sweet', whatever the acid.
  - 'Tart and bracing' needs acid ≥ 0.9 and sugar ≤ 9.
  - Frozen bands are shifted.
  - Zero-acid hot drinks say 'no citrus, soft and round', not 'barely tart'.
  - A low-ABV card never says 'About the strength of a normal cocktail'.

### 2. Real divergence across the battery: ingredient-set hashing, archetype caps, unique names (BLOCKER at packet level; about 30 drinks)
- **Hash ingredient sets (not line+oz tuples) across the battery and re-plan on Jaccard ≥ 0.8**, drawing from siblings:
  - Zombie → Jet Pilot, Test Pilot or Beachcomber's Gold;
  - colada → Chi Chi, Banana Colada, or a Painkiller in the tin;
  - Planter's → Navy Grog in the barrel;
  - Mai Tai → Menehune Juice or Mai Tai Swizzle.
  - Kill today's three Jaccard-1.0 cross-prayer pairs first.
- **Seed 1 must change the archetype, the service temperature, the vessel class or the hero, and the name and tagline must follow the change.**
  - Coffee s1: a Coffee Grog served up, or a cold-brew rum swizzle.
  - HBR s1: a Tom & Jerry (the archetype exists and is unused) or a Coffee Grog.
  - Chocolate s1: a stirred cacao Rum Alexander, or a hot mocha grog.
  - Pool s1: a coconut-blue Chi Chi in an acrylic tumbler.
  - Low-ABV s1: a sherry-and-falernum tiki spritz.
  - Smoky s1: a cold mezcal-and-chile swizzle.
- **Cap any archetype at 3 per battery unless prayers name it.** Today the colada family has 16, Mai Tai 9, Zombie 5, Lava Flow 5 and Sunrise 5. Make the concept's canonical answer a top candidate:
  - green → Nuclear Daiquiri;
  - floral → Saturn or Pearl Diver;
  - Havana → Hotel Nacional, El Presidente or Mojito.
- **Unique titles.** A second canonical instance gets a different title ('Zombie, the Smuggler's Cove way'), or another drink.
- **A battery stem registry.** Today: Lagoon ×5, Sour ×5, Punch ×5, Rum-Soaked ×4, Copra ×3, Mariner ×3, Doubloon ×3, Orange-Grove ×3, Canopy ×3. No stem may repeat within a pair (13 pairs share one today).

### 3. A canon contract: lines, method, ice, vessel and required garnish together (MAJOR; about 25 drinks)
`exactClassic()` matches ingredients only, and `recipe.check` reports only ingredient ids, so every card says 'archetype check: ok'.
- **Three states with their own words.**
  - *As written*: lines, method, ice, vessel and required garnish match a named edition, with its date.
  - *House riff on X*: every change listed, including method ('blended instead of shaken') and bitters.
  - *In the X frame*: a structural cousin, naming no spec below about 0.4 sameness.
  - A twist removes the canon stamp. A sameness ≥ 0.97 drink with no moves drops the word 'riff' (Zombie s0 Heard, HBR s0, Elvis s0).
- **Inherit the canonical service unless the prayer fixes the vessel** (record 'waived: vessel by prayer'):
  - Daiquiri No. 4 flash-blended in a coupe;
  - Hemingway, Hotel Nacional and Trinidad Especial up in a coupe;
  - Missionary's Downfall blended;
  - Pi Yi blended in a hollowed pineapple, or say 'the Pi Yi's lines, batched for a bowl';
  - Painkiller over ice in the Pusser's tin;
  - Gin-Gin Mule with its mint.
- **Identity cores that can't be dropped under the classic's name:**
  - Tortuga keeps both overproofs.
  - Lava Flow: strawberry purée poured first, the colada poured over so it streaks up. Without strawberry, call it a Banana or Mango Colada.
  - Jungle Bird keeps pineapple. Without it, it's Oertel's Bitter Mai Tai, credited.
  - Navy Grog keeps honey or demerara-allspice, and the cone.
- **Chronology and lineage.** Print 'the family tree runs back to X' only when X is older. Fix the origins in `data/archetypes.json`:
  - Trinidad Especial (Bolognese, 2008), made famous by González's Trinidad Sour (2009);
  - fruit daiquiri → Floridita, 1930s;
  - Bombo → colonial bumbo, with the Kingston Negroni as a modern cousin;
  - hot grog → 'a winter descendant of Vernon's 1740 grog', not 'served hot'.
  - Scorpion: '1946 punch for twelve' vs the '1972 individual and bowl'.
  - Don's Mix stays 2:1 grapefruit to cinnamon.
  - Label Don-era peach as 'peach brandy', not 'schnapps'.

### 4. Readings become promises the recipe keeps, and the reading's voice comes back (MAJOR; about 20 drinks)
Compile each reading into must-pour, service, vessel, ABV and colour targets. Plan to keep the primary promise, and re-plan if it fails. Only rewrite the sentence when a promise truly can't be kept, and keep history sentences (Pele, ʻōhelo, Hampden, Ting) always.
- **Bananas Foster.**
  - s0: 1½ oz aged Jamaican, ½ oz banana liqueur, ½ ripe banana, ¾ oz HBR batter and 2 scoops vanilla ice cream, blended, with a cinnamon-dusted brûléed banana coin. Credit Brennan's, New Orleans, 1951.
  - s1: a stirred Foster Old Fashioned (aged rum, banana liqueur, demerara, cinnamon, Angostura).
  - Never stamp a different drink 'as the gods pour it' for a prayer that didn't name it.
- **Havana 1957.** s0 is the Floridita No. 4, frappé. s1 is the Hotel Nacional Special, up. Add a Cuban-origin filter for Havana and year concepts.
- **First date.** The Hotel Nacional double-strained into a chilled coupe with a lime wheel, as the reading promises.
- **Promotion.** An aged-rum Mai Tai with ½ oz orgeat and a ¼ oz Demerara 151 float, topped with sparkling wine in a flute or coupe.
- **Dad.** The Honi Honi with ¼ oz maple and an Islay rinse.
- **Heartbreak s0.** Add ½ oz Heering.
- **Tahiti.** A vanilla Mai Tai with a tiare or gardenia. For 'night', add a 'night' concept (darker rum, a float, moonlit service).
- **Smoky.** ¼ oz Islay or a mezcal float, said in the nose ('peat smoke').
- **Mezcal and passion fruit.** Passion fruit syrup or purée as the hero (¾–1 oz), so the tasting can say 'passion fruit', not 'fassionola'.
- **Low ABV.** ≤ 7% and ≤ 1 sd on fino, Lillet or a sparkling base, and say 'light'.
- **Strongest.** The Tortuga with both overproofs (Zombie class, 3.3–3.5 sd, the packet maximum).
- **Ginger and lime highball.**
  - s0: 2 oz rum, ½ oz lime and 4–5 oz ginger beer, with any float ≤ ½ oz.
  - s1: ginger syrup + soda, never champagne as the lengthener.
- **Bitter.** Campari ≥ ¾ oz, never Aperol.
- **Volcano goddess s1.** Evoke geology, not worship. A hibiscus-chile swizzle with a Demerara 151 float or a crater flame; drop 'the first berry set aside'.
- **Heard hygiene.**
  - Merge phrases that map to one concept.
  - Drop echo lines ('"coffee" → coffee').
  - Quote only what the guest typed ('havana 1950s' ≠ 'Havana 1957').
  - Never render guidance (the party-of-8 'A group: batchable…').
  - Split archetype rule sentences ('Without both coconut and pineapple it is not a colada.') from guest descriptions.

### 5. Capacity physics on every path (BLOCKER for 2 drinks; MAJOR for about 12)
- **Open-pour 'ice and all' means the shaker ice is the glass's ice.** Poured liquid must be ≤ about 50–55% of capacity: ≤ 6 oz in a 12 oz tin or coconut, ≤ 6.5 oz in a 13 oz collins. Size the shaker ice to the glass.
- **Blender ice = 1–1¼ × the liquid, and finished volume ≤ 90% of capacity.**
  - The colada (2 rum, 4 pineapple, 1½ cream of coconut, 1 cream, about 8 oz ice) lands at 6–8% ABV and fits a 20 oz hurricane.
  - Today, Slow Sunday Hammock and Skipper are '20.9 oz finished' and 3.8–4.3%.
- **Small drinks go in small vessels.**
  - A poco grande or goblet for frozen drinks under 10 oz (Sideburns Tide is 8.9 oz in 20 oz).
  - A coupe for up drinks (Crooked Lonely Lagoon is up in an empty 14 oz DOF).
  - A highball or collins for 6–7 oz sunrises.
- **Bowls.** Blend in rounds of two and pour over a modest bed. Today the Scorpion s0 is 4 rounds of 7 oz + 8 oz ice into a 64 oz bowl over a bed, then a mound.
- **Add an acrylic or unbreakable tumbler** and use it for pool, beach and boat prayers.

### 6. The painting obeys the card (MAJOR; about 30 drawings)
- **Fire.** Draw flame only when the steps contain the lighting step with its safety text. In `artspec.js:236`, `recipe.style.flaming` alone currently lights Ashen Hoard's spent shell.
- **Clearance.** Keep a clearance radius round any flame: Fire Fountain Crater's mint ring touches it.
- **The look hex is a contract.**
  - Painted body within ΔH ≤ 6°, ΔS ≤ +0.12 and ΔL ±0.06 of `look.body.hex`.
  - Lint the median body pixel at ΔE2000 ≤ 10.
  - Copper stays brown-orange, oxblood stays at L ≈ 0.35, honeyed amber is never lemon, and ivory stays warm (hue 40–50°, S ≥ 0.25).
- **Remove seed-parity 'painter's choice'** from `paintTilt()`. A teaspoon of grenadine isn't a red foot. No hue-shifting gradient without a declared sink or float.
- **Opaque mugs paint the top layer on the visible surface** (the black floats in both skulls).
- **Glazes are a deterministic function of drink and vessel, never of neighbours.**
  - Skulls are bone, or ebony for 'dark'.
  - Hot drinks get warm neutrals or a clear toddy or Irish-coffee glass.
- **Kū mug.** A carved relief (heavy brow, almond eyes, broad nose, rectangular mouth), not a cartoon.
- **Garnish sprites.**
  - A banana coin is a cream disc on a pick.
  - Lemon is pale yellow and distinct from orange.
  - A pineapple chunk is a rind-crosshatched cube.
  - Cinnamon is a thin quill.
  - 'Floating' wheels are 3–5 small wheels on the surface.
  - Punch bowls show their block.
- **Steps come from the lines.** No 'Lightly press the mint' without a mint line; bitters crowns are dashed onto the ice, not 'floated' off a spoon; 'the rest' excludes floats.

### 7. Doses, roles and line counts (MAJOR; about 20 drinks)
- **Identity-core minimums in `satisfies()`:**
  - Mai Tai-family orgeat ≥ ½ oz ('2 tsp Orgeat' on Corner Office Sour, Passion Lagoon and First Light Punch);
  - HBR batter ≥ ¾ oz (Honeyed Treasure Island has ½);
  - Hotel Nacional apricot ½ oz;
  - swizzle crown 4–6 dashes when the Look promises one (the QPS has '2 dashes' under 'a heavy crown').
- **Perceptibility floor scaled to finished volume.** In a drink of 12 oz or more, a named flavour is ≥ ½ oz (vanilla, banana liqueur, coconut water, ¼ oz lime in a colada). Merge twin quarter-ounce citruses ('¼ oz lime + ¼ oz yuzu', '¼ oz lime + ¼ oz lemon'). Anything under the floor is dropped and kept out of the tasting.
- **At most 7 poured lines except named heavyweights:** Banyan Swizzle 8, Blooming Parlor 8, First Light Punch 9, Uncharted Curveball 8.
- **Spirit budget.**
  - Base 1½–2½ oz; 3 oz only for named heavyweights (Red Sky 3 oz rum, Smoldering Monsoon 3 oz, Pieces of Eight 3 oz).
  - Count 55% liqueurs (Chartreuse) toward the budget.
  - Coconut rum ≤ ½ oz as an accent (1 oz in five fruit coladas).

### 8. Copy, names and taglines with voice and truth (MAJOR; most drinks)
- **Taglines.**
  - Pairwise unique, with the prayer hook used by one seed only. Today 20 pairs share the hook.
  - 'A bright zero-proof tiki drink with soda.' and 'A funky Mai Tai cousin.' are each printed twice.
  - Ban the dead forms: 'A planter's punch.', 'A Blue Hawaii riff.', 'A colada with banana.'
  - No '-style' or 'cousin' at sameness ≥ 0.85.
- **Type nouns come from the reference, not the family bucket.** No 'Sour' on Mai Tais (Corner Office, Grill Master, Orchid) or on a frozen daiquiri.
- **Name words that point at things must be present:**
  - Orchid needs an orchid;
  - Sakura needs a cherry blossom;
  - Deep shouldn't sit beside 'shallows';
  - weather words (Monsoon, Maelstrom, Riptide, Doldrums) only on turbulent drinks.
  - Retire 'Copra'.
  - Spell Moʻorea with its ʻokina.
- **Moves credit only the word the move serves:**
  - not 'For "highball", "ginger", "lime": topped with sparkling wine';
  - not 'For "bitter": Aperol in place of Campari';
  - not 'For "low abv": … topped with sparkling wine'.
  - Retire 'frame' and 'takes over from' in guest copy.
  - Never 'gold rum takes over from blanco tequila' on a drink the guest was never told was a Sunrise.

### 9. Use the vessel library (MINOR; about 15 drinks)
The hurricane is 25 of 96 (26%). Cap any vessel at about 15% unless prayers ask for it.
- Celebration → flute or coupe.
- Brunch → flute or wine glass.
- Painkiller → enamel tin.
- Pi Yi → hollowed pineapple.
- Up sours → coupe or Nick & Nora.
- QPS and Three Dots → footed pilsner.
- The Why describes the vessel actually served (the skull-mug Jet Pilot's Why still says 'in a double old fashioned').

## Praise to keep (don't regress)

- **Canon pours I'd serve tonight:**
  - The Zombie, Berry's 1934 decode to the drop, flash-blended into a chimney with Don's two-per-guest rule.
  - The Bourbon Navy Grog: Don's honey, equal lime and grapefruit, 1 oz soda, the ice cone with its chopstick recipe and a big-cube fallback.
  - The Queen's Park Swizzle: mint pressed, swizzled to frost, stick left in, credit now right.
  - The Coconut Daiquiri in the shell with toasted coconut.
  - The Honi Honi for dad.
  - The Mezcal Jungle Bird at 1973 proportions.
  - Chapter and Verse Toddy with its clove-studded lemon.
  - Riptide Sour, honestly 'Tart and bracing'.
  - The Bushwacker.
- **Party service is real now.** Punch bowls serve 8:
  - batch totals in cups and ounces;
  - a quart block frozen the night before;
  - about 20% pre-dilution water 'the dilution a shake would give';
  - a cup count.
  The Scorpion bowl has real brandy, wine in the batch, a gardenia and four straws. The volcano bowl serves two, with its fire in the central well.
- **Fire safety wherever a flame is lit:** 'Keep hair, sleeves, straws and flowers clear … blow it out (or cover it with a saucer) before anyone drinks.'
- **Directional asks move the numbers.** The 'less sweet' Painkiller s0 goes from 10.7 to 8.2 g, and 'very tart' gets 1 oz lime at acid 1.11.
- **Technique details:**
  - preheated toddy mugs, with the batter melted with a splash of hot water;
  - no ice or straws on hot drinks;
  - carbonation never shaken, with open-pour, top, lift and crown in that order;
  - sinks with 'Don't stir: let the guest do it';
  - stirred drinks over one big cube with an expressed peel;
  - zero-proof truly 0.0% with tea tannin and saline.
- **Garnish truth:** zero fruit garnishes without their fruit. Vic's gardenia on the Scorpions, Yee's orchid on the Blue Hawaii, Bajan nutmeg and Angostura, the straw through the grog cone.
- **Credits now right:**
  - QPS (Queen's Park Hotel, 1920s; published by Vic, 1946);
  - Bushwacker (Ship's Store 1975; Sandshaker);
  - Royal Hawaiian Mai Tai 1953;
  - Jet Pilot (The Luau, c. 1958);
  - Trinidad Especial (Bolognese 2008);
  - Gin-Gin Mule (Saunders 2000);
  - Hotel Nacional (Wil P. Taylor);
  - the Mai Tai with the Q.B. Cooler dispute;
  - grog as Royal Navy.
  Real names lead, with house names as nicknames.
- **Honest riff copy:** 'here without its soda', 'bourbon takes over from light rum', 'No brandy, so it's a Scorpion Punch cousin'. Extend this voice to method changes.
- **The dragon:** mezcal, chile liqueur and a flaming shell with the safety step, 'guarding its hoard'. The Port au Prince sibling is clever.
- **Readings and lines with voice:** the Elvis reading (Blue Hawaii 1961, Coco Palms on Kauaʻi; Yee's drink four years older). Taglines: 'A velvet colada for a three-hour tour.', 'for the heart that took on water', 'one more chapter', 'cannonball!', 'skip the cake'. Names: Chapter and Verse Toddy, Fire Fountain Crater, Broken Compass Bird, Skipper Colada, Sideburns Tide, Deep End Snow.
- **Drawings:**
  - Sinks are beautiful and correct: Passion Horizon gold-to-garnet, cassis plum vs grenadine garnet on the brunch pair, Sakura Horizon's ruby under chartreuse.
  - Blue drinks are blue.
  - Umbrellas appear only when listed.
  - Coupes are drawn up with no straw.
  - Whipped cream is white on mocha.
  - The vessel library (chimney, cone, volcano bowl, Scorpion bowl, tin, coconut, barrel, bird, footed pilsner) is historically literate and fun.

## Per-drink scores (round-0 rubric, caps applied)

Mean 5.45 · ≥ 6: 45 · ≥ 7: 17 · ≥ 9: 0 · ≤ 3: 9.

| # | Prayer | Seed | Name | Score | Note |
|---|---|---|---|---|---|
| 0 | a colada for a lazy sunday | 0 | Slow Sunday Hammock | 6 | Caribe Hilton colada + ½ oz coconut rum; sound, but 20.9 oz finished in a 20 oz hurricane at 4.3%, and the same colada goes to 3 other prayers |
| 1 | a colada for a lazy sunday | 1 | Slow Sunday Riptide | 5 | 'Built on the Lava Flow' with no strawberry ('mango nectar in place of strawberries'); 6 lines and 1 oz coconut rum for 'lazy'; 'Riptide' on a lazy Sunday |
| 2 | something creamy and coconutty | 0 | Palm-Shaded Hideaway | 6 | A good cinnamon Painkiller, but its ingredient set is identical to 'in a coconut' s0; Heard is an echo ('creamy → creamy') |
| 3 | something creamy and coconutty | 1 | Copra Conch | 5 | A banana colada sold as a Lava Flow; 1 oz coconut rum + ½ oz banana liqueur + banana; 'Creamy ivory' drawn grey-blue; tagline 'A colada with banana.' |
| 4 | a mai tai but tropical | 0 | Passion Mai Tai | 7.5 | Honest Mai Tai riff (passion fruit for the rock candy), core intact, shaved ice; drawn with an orange-to-red foot as if layered |
| 5 | a mai tai but tropical | 1 | Rum-Soaked Squall | 2 | B2 cap: the card says 'tropical: heard, but the rest of the prayer steered this drink'. Vic's own Jamaican + Martinique formula sold as 'the twist' |
| 6 | zombie | 0 | Zombie | 8.5 | Berry's 1934 decode to the drop, flash-blended, chimney, credited. Heard still says 'riff on zombie'; drawn scarlet with three colour zones for 'Ruddy amber' |
| 7 | zombie | 1 | Wild Typhoon | 5 | 11 lines with tokens ('2 tsp' grapefruit, '½ tsp' grenadine, '½ tsp' allspice); Don's Mix inverted (½ oz cinnamon vs 2 tsp grapefruit); 0.91 Jaccard to two other Zombies |
| 8 | navy grog but with bourbon | 0 | Bourbon Navy Grog | 8.5 | Don's Navy Grog with bourbon in the light-rum slot, soda, ice cone with a big-cube fallback. Flat tagline |
| 9 | navy grog but with bourbon | 1 | Long-Lost Mariner | 6 | Seed 0 minus the soda, with demerara and honey stacked; still no allspice, so Vic's branch is missing again; another 'Mariner' |
| 10 | a swizzle | 0 | Queen's Park Swizzle | 8 | Good QPS: mint pressed, swizzled to frost, stick left in, credit fixed. Only '2 dashes' for a 'heavy crown'; drawn coral-red under a brown lump |
| 11 | a swizzle | 1 | Banyan Swizzle | 6 | Bermuda swizzle with grapefruit + lime instead of lemon: 8 lines, four juices; 2-dash 'crown' |
| 12 | painkiller but less sweet | 0 | Palm-Shaded Painkiller | 7 | 'Less sweet' really moves (¾ oz cream of coconut, ½ oz lime, 8.2 g). Card says 'Tart and bracing' on a cream-of-coconut drink; hurricane, not the Pusser's tin |
| 13 | painkiller but less sweet | 1 | Orange-Grove Maelstrom | 4 | Answers 'less sweet' by blending (6.4 g frozen, acid 0.43, 'Tart and bracing'); method change unannounced; 0.83 to seed 0 |
| 14 | scorpion bowl for 4 | 0 | Scorpion | 7.5 | Vic's individual Scorpion ×4 with real brandy and gardenia; '1946, poured as written' on 1972 lines; four rounds of one drink into a 64 oz bowl is tight |
| 15 | scorpion bowl for 4 | 1 | Lookout Bowl | 6.5 | A fair Scorpion bowl with wine in the batch and rounds of two; '¼ oz Passion fruit syrup' is a token; tagline 'An orgeat punch with passion fruit.' |
| 16 | hot buttered rum for a snowy night | 0 | Moonlit Hot Buttered Rum | 7 | Smuggler's Cove HBR with real batter in a preheated mug. Labelled 'a riff' with no moves; 'NOT HEARD: night' on 'Moonlit'; teal mug |
| 17 | hot buttered rum for a snowy night | 1 | Blizzard Mug | 5 | Seed 0 + ¼ oz 151 float (round 1 asked for a Coffee Grog or Tom & Jerry); step 3 'Add the rest' sweeps in the float that step 5 floats |
| 18 | a frozen banana drink | 0 | Brain Freeze Sour | 6.5 | Real banana, Jamaican rum, frozen, on the ask; sugar 7.0 is under the frozen floor; 'Sour' name; banana coin drawn as a citrus wheel |
| 19 | a frozen banana drink | 1 | Banana-Leaf Brain Freeze | 4.5 | Lava Flow blended in one go (no lava); 1 oz coconut rum; 20.4 oz in a 20 oz glass; a twin of Gilligan s1 |
| 20 | something smoky and spicy for a cold night | 0 | Woolen Mug | 5.5 | Hot, spicy, cosy; but smoke is '½ tsp Islay Scotch' in 7.9 oz, untasted, and Moves calls it 'a barspoon' |
| 21 | something smoky and spicy for a cold night | 1 | Pepperpot Woolen | 5 | Hot grog with chile, the same ½ tsp Islay and identical Moves; 'the Royal Navy's grog of 1740, served hot' is wrong (Vernon's grog was cold) |
| 22 | mezcal and passion fruit | 0 | Smoldering Monsoon | 4.5 | 3 oz base, 2 oz lemon, 2¼ oz Fassionola (12.2 g / 1.25 acid): loud on both axes; passion fruit only as 'fassionola' |
| 23 | mezcal and passion fruit | 1 | Ember Spyglass | 6 | Proper Cobra's Fang with a mezcal split; passion fruit again only as ½ oz Fassionola; 0.80 to dragon s0 |
| 24 | bananas foster in a glass | 0 | Banana Daiquiri | 2 | B2 cap: a shaken Banana Daiquiri stamped 'as the gods pour it' for Bananas Foster: no butter, brown sugar, cinnamon or vanilla |
| 25 | bananas foster in a glass | 1 | Banana-Boat Foster | 2 | B2 cap: Caribe Hilton colada + '¼ oz Banana liqueur'; nothing Foster; 0.93 to lazy s0 |
| 26 | coffee and rum, stirred | 0 | Wayward Monsoon | 6.5 | Sensible coffee rum Old Fashioned over a block. 'Built on' at sameness 0.19; 'Monsoon' on a contemplative sipper |
| 27 | coffee and rum, stirred | 1 | Tradewind Sipper | 4 | Seed 0 minus two dashes (Jaccard 0.80, open prayer); 'Bombo … family tree runs back to the Kingston Negroni (2009)' |
| 28 | ginger and lime highball | 0 | Gingered Doldrums | 4.5 | 1¾ oz rum float on 3 oz ginger beer + 2 tsp rich simple: first sips near-neat, syrup duplicates the ginger beer (persists) |
| 29 | ginger and lime highball | 1 | Golden Gecko | 4 | Ginger syrup + 2 oz champagne, no ginger beer or soda, 15.2%: not a highball (persists) |
| 30 | heartbreak | 0 | Broken Compass Bird | 6.5 | Bittersweet black-rum Jungle Bird with amaro and hibiscus: a drink I'd pour. Promised Heering absent; 'oxblood' drawn cherry-red |
| 31 | heartbreak | 1 | Crooked Lonely Lagoon | 6 | A bold Trinidad Especial for heartbreak, but served up in an empty 14 oz DOF; chronology inverted (Especial 2008 'runs back to' the 2009 Sour) |
| 32 | first date at the beach | 0 | Low Tide Lounge Punch | 3 | Blocker: 8.09 oz with '2 oz Water', shaken on 12 oz crushed, open-poured into a 12 oz tin (11.4 oz finished) and topped with ice: overflows; a tin mug for a first date |
| 33 | first date at the beach | 1 | Golden Low Tide Lounge | 4.5 | The promised Hotel Nacional, but in a hurricane over cubes (5.5 oz in 20 oz), apricot halved to ¼ oz, lineage 'runs back to the Banana Daiquiri' |
| 34 | my grandmother's garden | 0 | Sunday Best Frappé | 3 | Blocker: a blended sour with no syrup at all, 4.2 g sugar / 0.93 acid ('Balanced, leaning tart'): a sour snow cone |
| 35 | my grandmother's garden | 1 | Blooming Parlor | 5 | Garden answered (mint, flower, elderflower), but 8 lines, 7.2 g frozen, credited 'shaken, the Easy Tiki way' while blended; looks gold, not green |
| 36 | a rainy afternoon with a good book | 0 | Chapter and Verse Toddy | 7.5 | A real hot tea grog: 2 oz Barbados, ½ lemon, ¾ honey, 5 oz black tea, clove-studded lemon. Only the '1740 … served hot' line is wrong |
| 37 | a rainy afternoon with a good book | 1 | Honeyed Treasure Island | 6 | HBR in tea with '½ oz' batter padded by honey and '½ tsp' allspice; 7.9%, thin for a rainy afternoon |
| 38 | celebrating a promotion | 0 | Corner Office Sour | 6 | Mai Tai royale with agricole/aged rum and the right topping order; '2 tsp Orgeat' is half a Mai Tai's heart; no promised float; DOF for a celebration; 'Sour' |
| 39 | celebrating a promotion | 1 | Passion Lagoon | 5 | 2 oz light rum Mai Tai for a promotion (the downgrade persists); '2 tsp Orgeat' |
| 40 | a drink that tastes like a sunset | 0 | Red Sky Afterglow | 6 | A red Hurricane for a sunset; 3 oz rum, three sweeteners ('1 oz Fassionola, ½ oz Grenadine, ¼ oz simple syrup') |
| 41 | a drink that tastes like a sunset | 1 | Passion Horizon | 6 | Pretty gold-to-garnet sink, honest light strength; 6.25 oz in a 20 oz hurricane, ¼ oz lime token, 'Built on the Tequila Sunrise … 0.09' |
| 42 | something blue for the pool | 0 | Deep End Snow | 4.5 | Blue curaçao + watermelon (reads violet-slate, drawn pure blue), frozen at 6.0 g; still glass at a pool |
| 43 | something blue for the pool | 1 | Banana-Boat Deep End | 5.5 | Blue banana daiquiri at a sound frozen sugar (9.8); hurricane glass at the pool; 0.67 to seed 0 (both blue frozen daiquiris) |
| 44 | layered and pretty, like a sunrise | 0 | First Light Punch | 5.5 | Hawaiian Mai Tai whose only 'layer' is a navy float on top; 9 lines; '2 tsp Orgeat'; tight collins |
| 45 | layered and pretty, like a sunrise | 1 | Orange-Grove Eastward | 6 | Rum sunrise with a real grenadine sink: layered and pretty, but ¼ lime + ¼ lemon tokens and 6.56 oz in a 20 oz hurricane |
| 46 | the color of the ocean at dawn | 0 | Sapphire Lagoon | 6 | Yee's Blue Hawaii, ocean is finally blue; 'dawn' adds nothing; ≈ Elvis s0 (0.81) |
| 47 | the color of the ocean at dawn | 1 | Deep-Water Lagoon | 5.5 | Blue Hawaiian colada; '¼ oz fresh lime juice' in 12.4 oz; 'Deep-Water' next to 'Caribbean-shallows' |
| 48 | green like the jungle | 0 | Canopy Liana | 5 | Hemingway + 1 oz Chartreuse (2.4 sd, 22%) strained over cubes in a collins; round 1's praised Nuclear Daiquiri is gone |
| 49 | green like the jungle | 1 | Canopy Toucan | 5 | Chartreuse Swizzle with 1¾ oz gin added (2.3 sd); step 1 presses mint that isn't in the lines, and the drawing shows it |
| 50 | Havana 1957 | 0 | Daiquiri No. 4 | 5.5 | A clean daiquiri, but 'Daiquiri No. 4 … as the gods pour it' is shaken and up (the No. 4 is the frappé); nothing of 1957 |
| 51 | Havana 1957 | 1 | Golden Tropicana | 4 | Missionary's Downfall shaken over cubes with 15 un-muddled mint leaves, sold as 'A mint-and-pineapple frappé'; Hollywood for Havana |
| 52 | a night in Tahiti | 0 | Moorea Colada | 3 | Caribe Hilton + ¼ oz vanilla in 19.5 oz (4.1%); the card's own reading promises a vanilla Mai Tai; 'NOT HEARD: night' |
| 53 | a night in Tahiti | 1 | Copra Moorea | 3 | Strawberry colada with a vanilla token; 'here without its ripe banana' (the Lava Flow never needed it); nothing Tahitian |
| 54 | Jamaican street party | 0 | House Party Punch Cup | 4 | 1½ oz passion fruit syrup + demerara per serve, 17.6 g, 'Tart and bracing'; identical set to pirate s0. Real bowl service for 8 |
| 55 | Jamaican street party | 1 | Wild Block Party Bowl | 2 | Blocker: Tropical Itch with '5 oz Passion fruit syrup' per serve (40 oz in the batch), 26.4 g sugar, 'Tart and bracing'; Waikīkī bourbon for Jamaica; no back-scratcher |
| 56 | Tokyo neon | 0 | Sakura Horizon | 5.5 | Neon logic (tonic, melon, hibiscus sink) and a sound build; ¼ + ¼ citrus tokens; 'Sakura' with no cherry blossom; 'Built on the Cuban Master … 0.07' |
| 57 | Tokyo neon | 1 | Green Sakura | 4.5 | Frozen melon-whisky daiquiri at 7.0 g; 'Ginza-bar precision' on a blender drink; 'Green Sakura' |
| 58 | Elvis in Blue Hawaii | 0 | Deep-Water Blue Hawaii | 6.5 | Harry Yee's drink and a delightful Elvis reading; labelled 'A Blue Hawaii riff.' with no move; 5 oz in a 20 oz hurricane |
| 59 | Elvis in Blue Hawaii | 1 | Sideburns Tide | 4.5 | Gin swap, blended to 8.9 oz in a 20 oz glass at 6.7 g sugar with '1 tsp simple syrup'; fun name |
| 60 | Gilligan's Island | 0 | Skipper Colada | 5 | 'A velvet colada for a three-hour tour' is great; the drink is the shared Caribe Hilton colada + ½ oz coconut water (3.8%, 20.9 oz in 20) |
| 61 | Gilligan's Island | 1 | Castaway Canopy | 4 | One-line twin of frozen-banana s1 (gold vs Jamaican rum); Lava Flow blended flat |
| 62 | a drink for a dragon | 0 | Scale Revenant | 7.5 | Fixed and fun: mezcal, chile, Fassionola, a flaming shell with the full safety step. The Kū mug is drawn as a googly-eyed cartoon |
| 63 | a drink for a dragon | 1 | Ashen Hoard | 6 | Port au Prince with mezcal and chile is a smart sibling; the drawing lights the lime shell though no step lights anything |
| 64 | something my dad would like | 0 | Grill Master Sour | 6 | Bourbon + agricole Mai Tai for dad is right; '¼ oz Orgeat'; promised maple and smoke absent; 'Grill Master Sour' |
| 65 | something my dad would like | 1 | Honi Honi | 7 | The Honi Honi for dad, as round 1 asked; 'poured as the canon has it' beside 'the twist: a dash of orange bitters' |
| 66 | volcano goddess | 0 | Fire Fountain Crater | 7 | A real volcano bowl for two with fire and safety text; '¼ oz Maple syrup' token; tagline 'ruby-red' vs look 'terracotta'; mint drawn round the flame |
| 67 | volcano goddess | 1 | ʻŌhelo Mariner | 3.5 | Cranberry-cocktail gin mule with no mint, 2 oz ginger beer, 11.9 g; tagline borrows the ʻōhelo offering to Pele as flavour text |
| 68 | pirate's treasure | 0 | Pieces of Eight Punch | 5.5 | 3 oz Jamaican, passion fruit, allspice: tasty but 2.3 sd, and the same lines as Jamaican s0 |
| 69 | pirate's treasure | 1 | Rum-Soaked Doubloon | 6.5 | A Zombie in the rum barrel with Jamaican overproof: fun and on the ask; 11 lines, 3.3 sd |
| 70 | not too sweet, very tart | 0 | Long-Lost Doubloon | 4 | '2 oz Water' shaken on crushed dilutes the tart ask (acid 0.65); tagline 'A planter's punch.' |
| 71 | not too sweet, very tart | 1 | Riptide Sour | 7.5 | 'Very tart' honoured: 2 oz rum, 1 oz lime, ¼ oz simple, ¼ oz curaçao, acid 1.11, 'Tart and bracing' is true |
| 72 | the strongest drink you dare | 0 | Overgrown Outpost | 5 | 'Built on the Tortuga … here without its white overproof rum': the strongest prayer drops from 3.3 to 2.7 sd (regression) |
| 73 | the strongest drink you dare | 1 | Zombie | 6 | SC Zombie at 3.5 sd, but titled 'Zombie' a second time; identical ingredient set to no-coconut s0; Don's Mix split 1:1 |
| 74 | low abv for brunch | 0 | Long Afternoon Sunrise | 3.5 | 7.3% and 'About the strength of a normal cocktail' for 'low abv'; a rum mimosa-sunrise in a hurricane |
| 75 | low abv for brunch | 1 | Orange-Grove Long Afternoon | 5 | 6.9% / 1.1 sd passes, but it is seed 0 with grenadine for cassis; still a rum base |
| 76 | zero-proof for the designated driver | 0 | Clear Skies Punch | 6 | 0.0% with ginger, falernum and soda; short (6.2 oz in a 13 oz collins); tagline identical to seed 1 |
| 77 | zero-proof for the designated driver | 1 | Passion Sandbar | 6 | Smart tea-grapefruit-passion zero-proof with saline; 13 g / 1.38 acid is punchy; 'Navy Grog' with no honey or cone |
| 78 | no coconut, no pineapple | 0 | Rum-Soaked Expedition | 5 | Constraint kept, but it is the strongest-drink Zombie again (Jaccard 1.0); 'A potent Zombie-style heavyweight.' |
| 79 | no coconut, no pineapple | 1 | Orchid Sour | 5.5 | Agricole-split Mai Tai, ≈ mai tai s1; 'Orchid' with no orchid; the constraint is never said back |
| 80 | in a coconut | 0 | Copra Macaw | 3 | Blocker: 7.5 oz shaken on 12 oz crushed, 10.9 oz finished, open-poured into a 12 oz coconut and topped with ice; same Painkiller as creamy s0 |
| 81 | in a coconut | 1 | Coconut Daiquiri | 7.5 | Canonical Coconut Daiquiri in the shell, 4 oz poured, toasted coconut: a fit for the vessel and the prayer |
| 82 | skull mug of something dark | 0 | Dark-Water Doubloon | 7 | Jet Pilot with a black-rum float in the skull: on the ask. Teal skull and no visible float in the drawing; Why says 'in a double old fashioned' |
| 83 | skull mug of something dark | 1 | Rum-Soaked Orchid | 6.5 | Dark Mai Tai with a black float (kept from round 1); red skull glaze, float not drawn; 'Rum-Soaked Orchid' with no orchid |
| 84 | a punch bowl for a party of 8 | 0 | Whole Crew Bowl | 6 | Scorpion Punch with wine for 8 over a block, real batch maths; Heard leaks guidance ('A group: batchable, crowd-pleasing…'); sharp at 1.36 acid |
| 85 | a punch bowl for a party of 8 | 1 | Pi Yi | 5.5 | Pi Yi lines built in a punch bowl while its own Why says 'blended … served inside a hollowed-out pineapple'; 'Peach liqueur / schnapps' on a Don card |
| 86 | a Jungle Bird with mezcal | 0 | Mezcal Jungle Bird | 8 | Faithful: 1973 proportions, mezcal split, 4 oz pineapple, ¾ oz Campari |
| 87 | a Jungle Bird with mezcal | 1 | Ember Serpent | 5 | An uncredited Bitter Mai Tai ('orgeat in place of pineapple') with orgeat + simple + curaçao (12.1 g) in the Jungle Bird's bird |
| 88 | surprise me | 0 | Uncharted Curveball | 6.5 | Batavia arrack in a flash-blended Don sour in a pilsner: a real surprise; 2 tsp honey + ¼ oz li hing tokens; 'pineapple chunk' drawn as a cigar |
| 89 | surprise me | 1 | Uncharted Hideaway | 6 | Kingston Negroni with arrack is a fine surprise, but ½ oz li hing mui syrup pushes it to 12.4 g |
| 90 | bitter and refreshing | 0 | Spring Water Swizzle | 7 | QPS + Campari is bitter and refreshing; Angostura 'floated' off a spoon instead of dashed as a crown |
| 91 | bitter and refreshing | 1 | Bitter Cool Breeze | 4 | Aperol makes it less bitter (persists); tagline 'A wild, dark bitter tiki sour' on a 1 sd honeyed-amber drink |
| 92 | something floral and elegant | 0 | Pearl Bay Royal Palm | 6.5 | Hibiscus daiquiri in a coupe: floral and elegant enough; no flower on it; drawn fuchsia |
| 93 | something floral and elegant | 1 | Blooming Royal Palm | 5.5 | Hemingway + elderflower over cubes in a DOF; elegant needs a coupe and a flower |
| 94 | chocolate and coffee dessert drink | 0 | Bushwhacked Cocoa Lagoon | 7 | Bushwacker done right: rum, coffee, cacao, coconut, whipped cream; a dessert |
| 95 | chocolate and coffee dessert drink | 1 | Bushwhacked Mariner | 5.5 | Seed 0 + ½ banana (Jaccard 0.83, open prayer); still a good dessert |
