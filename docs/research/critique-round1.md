# Round 1 critique: the Tiki God packet (96 drinks, 48 prayers × 2 seeds)

Reviewer: lead critic. I verified the four lens reports (construction, canon, looks, prayer) against `packet.json`, `packet.md` and contact sheets 03, 05 and 10. Scores use the round-0 rubric (critique-round0.md §4) with its hard caps: a blocker caps a drink at 3, and a misheard or ignored prayer caps it at 2.

## Verdict: NOT APPROVED

Round 1 is real progress. The mean rose from about 3.2 to **4.54**, and drinks at 6 or above rose from 12 to **27**. All six round-0 service blockers (up drinks served "ice and all") are gone. The canon layer can now pour a Zombie, a Navy Grog, a Tortuga, a QPS, a Kingston Negroni or a Nuclear Daiquiri the way a serious bar would.

The packet still fails 9 of the 10 gates. Three problems drive most of the failures:

1. **The card promises one drink and pours another.** Nothing checks the Heard reading against the recipe. "painkiller but less sweet" is the unchanged 4-1-1 at 9.6 g/100 ml sugar. "not too sweet, very tart" is heard as "less tart" and gets ½ oz lime. "first date" promises "served up … no garnish jungle" and gets a four-garnish frappé.
2. **Default specs collapse together.** There are 7 exact-duplicate clusters covering 16 drinks, 11 seed pairs at Jaccard ≥ 0.6, and 8 Tequila Sunrises.
3. **Service ignores physics.** Four single serves are built in a 120 oz punch bowl, a 20 oz colada goes into a 12 oz coconut, the Hot Buttered Rum has no batter, and the Scorpion carries 1 tsp of brandy.

I would serve about 10 of these drinks with pride. I would send about 22 back.

### Headline numbers (measured from packet.json)

| Metric | Round 0 | Round 1 |
|---|---|---|
| Mean drink score | ≈3.2 | **4.54** |
| Drinks ≥ 6 | 12 (12.5%) | 27 (28%) |
| Drinks ≥ 9 | 0 | 0 |
| Drinks capped ≤ 3 | — | 22 |
| Prayers with empty `Heard` | 6 | 0 |
| Exact-duplicate recipe clusters (drinks) | 6 (13) | 7 (16), plus one same-ingredient pair (surprise s0 / bitter s1) |
| Seed pairs with ingredient Jaccard ≥ 0.6 | 8 | 11 |
| Duplicate names | 2 | 0 |
| "Sweet and sour in balance" | 77 ("neither sweet nor tart") | 80 |
| Fruit-garnish/ingredient mismatches | 7 | 43 items on 33 drinks |
| "Don the Beachcomber limited his Zombie…" on the tasting line | — | 19 (most are not Zombies; several are 1.4 sd) |
| User-visible "slot" | — | 64 |

## Packet-level gates

| Gate | Pass | Evidence |
|---|---|---|
| Zero blockers | ✗ | Punch bowl for one ×4 ("my grandmother's garden" s0/s1, "Jamaican street party" s0/s1). Coconut overflow ×2 ("in a coconut" s0 is 20 oz finished in a 12 oz shell; s1 is 8.5 oz plus crushed ice). HBR with no batter ×2 ("1 tsp rich simple syrup", "0.25 oz Butter"). Scorpion s1 with "1 tsp Brandy / Cognac". "less sweet" ignored ×2. "tart" heard as "less tart". "ocean at dawn" ×2 ignored. Pineapple garnish on "no coconut, no pineapple" ×2. |
| Zero exact duplicates and zero repeated names | ✗ | Names are unique (pass). Recipes have 7 exact clusters: Caribe Hilton colada ×3 (lazy s0 = creamy s0 = in a coconut s0); strawberry colada (lazy s1 = Gilligan s1); banana daiquiri (frozen banana s0 = foster s0); Tequila Sunrise (layered s0 = ocean s0); Royal Hawaiian (layered s1 = ocean s1); Planter's (Jamaican s0 = pirate s0); Smuggler's Cove Zombie ×3 (dragon s1 = strongest s1 = no-coconut s1). |
| Seed pairs differ in concept for open prayers | ✗ | 11 pairs at Jaccard ≥ 0.6, all on the same archetype. The open prayers among them are "Tokyo neon" (0.83: s1 is s0 minus the lime), "volcano goddess" (0.89: + ¼ oz grapefruit + 1 tsp falernum) and "something blue for the pool" (0.67). Named-classic riffs also differ by a dash: Mai Tai, Navy Grog and Painkiller each add only "1 dash". |
| `Heard` non-empty for interpretable prayers | ✓ | 48/48 non-empty. The content is still sometimes wrong: "tastes" → "Elegance in tiki is restraint"; "tart" → "less tart"; "elegant" → boss-client. |
| ≥ 90% of drinks score ≥ 6 | ✗ | 27/96 (28%) |
| Mean ≥ 7.5 | ✗ | 4.54 |
| ≥ 12 drinks score ≥ 9 | ✗ | 0. The best are Zombie s0 and Navy Grog/bourbon s0 at 8. |
| Zero phantom flavours | ✗ | "finishes on … mint" with no mint in the drink or garnish ×7 (scorpion s1, heartbreak s0, grandmother s1, Jamaican s0, pirate s0/s1, party-8 s0). "baking spice and clove" on HBR s0/s1 and the rainy grogs, none of which has a clove source. "Silky and rich from the coconut and cream" on Painkillers with no cream. "a bitter edge" with no bitter ingredient (promotion s1, layered s1). "the ice is part of the recipe" on hot HBRs. Falernum-sourced clove and bourbon vanilla are legitimate and not counted. |
| Zero garnish/ingredient mismatches | ✗ | 43 items on 33 drinks (orange 15, pineapple 11, lime 10, lemon 5, grapefruit 2). Worst: "pineapple frond" on both "no coconut, no pineapple" drinks; "lemon twist, lime wheel, orange slice" on Perfumed Kyoto (none of the three is in the drink). There are also 8 template leaks ("the named fruit when practical", "the fruit", "full tiki garnish", "… and none."). |
| **Drawings match the recipes** (mine) | ✗ | Sheet 3: Blizzard Toddy (HBR, "Café au lait") is drawn sage green, and Woolen Toddy ("Near-black" coffee) is drawn teal. Sheet 10: a full pineapple wedge sits on the rim of Rogue Expedition and Crossing Revenant ("no pineapple"), and umbrellas appear on Long Afternoon Sunrise and Tangerine Long Afternoon where none is listed. Sheet 5: an unlisted umbrella on Perfumed Salt and Sand, a blue band reading as a liquid layer in Blooming Parlor, and a full party bowl drawn for a one-person drink. The looks lens counted about 18 unlisted umbrellas and 29 drawings with garnish that isn't listed. |

**Result: 1 of 10 gates passes.**

## What I verified, corrected or dropped from the lens reports

- **Verified.** The duplicate clusters and seed Jaccards (I recomputed both). The punch bowl serving 1 (the steps really say "Build everything in a punch bowl over one large block"). The coconut overflow. The HBR with no batter. Lucky Relic's ½ oz lime. "Sweet and sour in balance" ×80. "slot" ×64. "keep it to 6 bottles" ×6. The 19 Zombie strength lines. The editorial guidance printed to guests: "keep the god's name out of … jokes ('angry god', 'sacrifice', 'virgin')", "(Dragonfly, Golden Dragon … don't reuse.)", "Respect: age doesn't mean sweet". The green and teal hot mugs and the wedge on the no-pineapple Zombies (seen on the sheets).
- **Corrected.** The prayer lens wants "strongest = at least 4 standard drinks with a 151 float". I reject that: research §1.4 says a heavyweight "should hit the Zombie, not exceed it". The target is Zombie-class (3.3–3.5 sd), made the packet maximum, with a warning. What's wrong today is that "skull mug" s0 (3.7 sd) out-muscles the "strongest" prayer.
- **Softened.** "Mezcal split ≤ ¾ oz" becomes ≤ 1 oz. A Jungle Bird with ¾ + ¾ is right, and the actual fault is Charred Monsoon's 2 oz.
- **Not counted as phantoms.** Clove or cinnamon on falernum drinks (Zombie, Cobra's Fang, Malecón Sour), and vanilla on bourbon or aged-rum drinks. The carriers are real.
- **Dropped as petty or non-gating.** Coupe stem proportions, the Jungle Bird 1973/1978 hedge, and the ʻokina in "Maita'i Roa Ae". These are worth a lint, not a ranking.
- **Unverified.** The looks lens reports a colada-turns-mint-green regression at HEAD (`artcatalog.js` mixes `PALETTE.ice` into pale bodies). I didn't re-render, but the code claim is specific. Check it before the round-2 shoot. The repo has moved past the packet (cd11604, faffc98, d91f9b7, b095eff), so **regenerate the packet and sheets before round 2 is scored.**

## Ranked fixes (most leverage first)

### 1. A fidelity gate: the reading becomes a contract the recipe must keep (BLOCKER, about 35 drinks)
Today `data/concepts.json` readings are printed as `Heard`, but only their soft tag weights reach the composer, so archetype priors win.
- **Compile each reading into promises:** must-pour ids (any-of), service or temperature, vessel class, ABV band, colour and avoid-ids. After composing, require at least one kept and visible promise per non-negated reading. Otherwise re-plan, and if that also fails, rewrite `Heard` to describe only what was poured.
- **Directional asks are numeric targets, checked after rounding:**
  - "less sweet" Painkiller: ¾ oz cream of coconut, ½ oz lime, a pinch of salt, about 7 g/100 ml, and the card says so. Today it's 9.6 with Moves "allspice dram in the spice slot".
  - "very tart" daiquiri: 2 oz rum, 1 oz lime, ½ oz simple, acid ≥ 1.0. Today it's ½ oz lime.
  - "low abv": ≤ 7.0%, using a fino or Lillet split or sparkling as the base. Today it's 8.7% and 7.9% on 1¼ oz tequila.
  - "refreshing": ≥ 8 oz and ≤ 10%.
- **Examples that must change:**
  - dad → bourbon (the Honi Honi reading).
  - promotion → the promised Demerara float, never "2 oz Light rum".
  - garden → gin, elderflower, cucumber and a flower.
  - Foster → banana + demerara or batter + cinnamon, ideally blended with vanilla ice cream.
  - ocean at dawn → pale aqua with a pink blush and saline, not a Sunrise.
  - first date → actually served up.
  - dragon → chile or ginger heat and a flaming shell.
  - Tokyo → tonic (the black-light glow the reading itself promises).
- **Split `reading` (guest-facing) from `guidance` (never rendered).** Strip "Respect: …", "(… don't reuse.)" and the volcano card's list of forbidden jokes.

### 2. Uniqueness and real seed divergence (BLOCKER, 16 duplicate drinks plus 11 collapsed pairs)
- Hash line sets across the battery or session. On a collision, re-plan from a sibling classic:
  - heavyweights: Cobra's Fang, Tortuga, Jet Pilot, Test Pilot, Three Dots and a Dash;
  - coladas: Lava Flow built as a Lava Flow, Chi Chi, Banana Colada;
  - pirate: a Navy Grog in the barrel mug the reading asks for;
  - Jamaican street party: a Jamaican rum, Ting and pimento punch for a crowd.
- Seed 1 must change the archetype, the hero, the service temperature or the vessel class, and the name and tagline must follow from that change. Examples:
  - Mai Tai "tropical" s1 → a passion-and-pineapple Mai Tai frappé in a hollowed pineapple;
  - Navy Grog/bourbon s1 → Vic's allspice and demerara branch;
  - HBR s1 → a Coffee Grog or a Tom & Jerry;
  - volcano s1 → a hibiscus-chile swizzle.
- No identical taglines or shared name stems within a pair. There are 4 identical tagline pairs and 14 shared stems today.
- Cap any archetype at 3 per battery unless the prayers name it. Cap the Sunrise at 1 (8 today) and default it to a rum base.

### 3. A feasibility pass on every path: servings, capacity, method and vessel (BLOCKER, about 25 drinks)
- **Bowls.** Any bowl vessel requires servings ≥ 2; a punch bowl requires ≥ 6. An archetype with `bowl:true` (Volcano Bowl, Scorpion) forces bowl service with batch totals. A party word with no number defaults to 6–8 servings. Fix `engine.js chooseVessel()`: `bowl = !!intent.style.bowl || servings >= 3` and `fit = bowl ? 1 : fitOf(v)` both need to go.
- **Capacity on every path.** The `asked` and `riff` branches return before `fitOf()`. When a vessel is fixed by the prayer, scale the recipe to it. A coconut colada should be 1½ rum, 3 pineapple, 1 cream of coconut, ½ cream, ½ lime and 1 scant cup of ice (about 11 oz), not 10.5 oz plus 8 oz of ice.
- **Blender ice is 1–1¼× the liquid, not a fixed "1 cup (8 oz)".** The fixed cup overflows six poco grandes and half-fills three hurricanes. Gate fill per research §1.5.
- **Method → vessel whitelist.**
  - Swizzle → collins, pilsner or highball (not a hurricane: Banyan Swizzle).
  - Sink, float or named colour → clear vessel only (not the enamel tin on "first date" s1, not the hollowed pineapple on the blue pool s1).
  - Hemingway → coupe.
  - "pool" → an acrylic tumbler (add it to `vessels.json`).
- **Toppers.** Open-pour, add the soda or sparkling, lift once, then crown with crushed ice. Today's order is "top with crushed ice to fill" and then "Top with the sparkling wine". Better for a celebration: a coupe or flute. Still wine (Vic's Scorpion) goes into the batch.
- **Fire.** Any garnish containing "flaming" forces the safety step the volcano card already has. The Scorpion bowls carry "flaming lime shell" with no lighting or safety line.

### 4. Role-aware composition: identity cores, minimum doses, rebalance after every move (BLOCKER/MAJOR, about 30 drinks)
- **Identity-core minimum doses, checked by `satisfies()`, not just presence:**
  - HBR batter: 1 heaping tbsp (¾–1 oz) of butter, dark brown sugar and spice.
  - Scorpion brandy ≥ ½ oz per serve.
  - Navy Grog honey ≥ ¾ oz.
  - Mai Tai and Royal Hawaiian lime ≥ ½–¾ oz.
  - Fruit-named frozen drinks contain the fruit.
- **`trim()` and swaps may never remove the last line in a role.** Woolen Toddy lost its only sugar "to keep it to 6 bottles". "first date" s1 swapped lime for pineapple. "low abv" s0 swapped lime for OJ. Rerun `balance()` after every move.
- **Minimum perceptible dose by role** (syrups and liqueurs ≥ ¼ oz, juices ≥ ½ oz, base ≥ ½ oz, split spirits ≥ ¾ oz). Merge or drop anything smaller: "1 tsp London dry gin", "0.5 tsp Cinnamon syrup", "1 tsp fresh grapefruit juice", "0.25 oz Coconut water", "½ tsp rich simple" next to "¼ oz demerara".
- **Base floor and ceiling.**
  - Floor: 1½ oz single serve, 2 oz for coladas and frozen drinks. 1 oz light rum at 0.7 sd appears five times.
  - Ceiling: 2½ oz single serve, or 3 oz for named heavyweights. Sundown Horizon has 4½ oz of rum; Blackstrap Torch is 3.7 sd.
  - Bowls: about 2½ oz of spirit per guest.
- **At most 7 poured lines**, except canonical heavyweights. One line per role unless the second does a different job. Banyan Swizzle has 10 lines and three citruses.
- **Method-specific sugar targets.** Frozen sours need 8.5–12 g/100 ml; Lucky Malecón is at 3.4. Re-solve the balance whenever the method changes.
- **Balance the body without the sink**, then add the sink as extra. Kyoto Horizon's body is pure sour until stirred.

### 5. Garnish from a controlled vocabulary, checked like an ingredient (BLOCKER for constraints; 33 drinks)
- A fruit garnish requires that fruit in the lines, or a whitelisted reason (orange with curaçao).
- Garnish passes through the same avoid-set as the recipe. That means no "pineapple frond" on "no coconut, no pineapple".
- Resolve the placeholders: "the named fruit" becomes a caramelised banana coin, and "full tiki garnish" becomes a mint bouquet with an orchid and frond fan. Drop "none".
- Store garnish phrases as objects so "citrus twist, expressed" survives.
- Up drinks get one rim or surface item: no upright mint in Canopy Liana's coupe, no cinnamon stick in the Foster coupe.
- "One per guest" only when servings > 1.
- Add a battery test for every rule above.

### 6. The drawing renders exactly the card (MAJOR; about 18–29 drinks)
- Draw exactly `recipe.garnish`, one part per phrase, through an independent mapping. The current if/else-if drops every orange wheel listed beside a lime.
- No default umbrella on resort or colada families. A frond is fronds, not a wedge. A sunk cherry sits at the bottom of the glass.
- Liquid comes only from `look.body.hex`. Toddy mugs and bowls get neutral, deterministic glazes, not `rng` picks from wood, lagoon or frond. That pick is what made the HBR green and the coffee toddy teal.
- Ice is a near-white lift, not a `#9CC9D6` multiply. No cubes below the surface of opaque bodies.
- No single false "depth" band on shaken drinks: Mai Tais and Zombies read as layered today.
- Sinks clamp to ruby or magenta, not plum-black.
- Bowl ice is never a blue band.
- Crushed-ice drinks fill to the rim, with floats at the very top.
- Blue Hawaii lands in aqua (¾–1 oz curaçao, or calibrate the curaçao and pineapple mix), and "Look" text is generated from the painted hex. Deep End Sour is drawn blue but described as "Creamy pale green-gold".
- Re-shoot all 12 sheets.

### 7. Copy that is true: one strength scale, balance from the numbers, no phantoms, no engine words (MAJOR; most drinks)
- **Strength.** One scale in standard drinks, shared by the tasting and Why lines. Don's two-per-guest rule appears only on Zombie-lineage drinks; credit Vic for the Tortuga and Scorpion and Pat O'Brien's for the Hurricane. Never print "Easy-drinking strength" next to "two per guest" (Sundown Horizon), and never mention ice on hot drinks.
- **Balance line** from the measured sugar:acid ratio against the style. Coladas say "rich and round, barely tart". Prayers that ask for tart get "Tart and bracing".
- **Every flavour word maps to a poured carrier.** Mint appears in the nose only when it's in the garnish, never in the finish. The prayer's hero (banana!) appears in the first clause.
- **Moves.** Tag each move with its cause. Credit only prayer-caused moves to the prayer, in bartender words. Never print "slot", "route only", swap chains or bottle caps.
- **Taglines.** At most one "with". Never repeat the classic's name. The colour and time words must agree with the look and the prayer (no "sunset-orange … sunrise"). Every promise must be true: "salt spray on the rim" needs a salt rim; "tiare" needs a tiare (gardenia); "the way Constante shook them" is false for 1957.
- **Formatting.** Keep the case in definitions ("trader Vic's" → "Trader Vic's"). "6 drops", "2 strawberries", "½ ripe banana".

### 8. Names and credits that tell the truth (MAJOR)
- **Real names for real drinks.** If the drink is ≥ 0.95 similar to a catalogued spec, print the real name with credit. Scale Revenant is the Cobra's Fang, Overgrown Hideaway is Vic's Tortuga, and Garden Maelstrom is the QPS. A house name is allowed as a nickname.
- **Split `origin` from `source`.** "Queen's Park Swizzle (Queen's Park Hotel, Port of Spain, 1920s; published by Trader Vic, 1946)". Grog is Royal Navy, not "Scandinavian". HBR is colonial American. Give the Bushwacker one story (Ship's Store, St. Thomas, 1975; popularised at the Sandshaker, Pensacola). Hedge the Caribe Hilton claim.
- **Name rules.**
  - Unique stems per battery: Palm-Shaded ×5, Cup ×5 and Sundown ×4 today.
  - Gate time words on the prayer's time: no "Sundown Eastward" for a sunrise, no "Swell Sunset" for dawn.
  - Never name an absent ingredient or a brand: Tangerine, Blackstrap, Salt, Kraken.
  - No "Rum-Soaked Hot Buttered Rum".
- **Culture.** No Hawaiian words on non-Hawaiian prayers: "Ho'olaule'a" on a Jamaican street party. Drop "Smoke-Signal". Vessels like the Moai only when asked.

### 9. Parser hygiene (MAJOR, about 14 drinks)
- Whole-word concept matching: "tastes" matched "tasteful" and pulled in "Elegance in tiki is restraint".
- Move "elegant" and "classy" out of boss-client, which is where "Corner Office Cup" and "Blooming Boardroom" came from.
- Add concepts for "night", "street" and year or decade words. 1957 is the Hotel Nacional and Tropicana era.
- "surprise me" gets its own reading, not "Bored means…".
- Add regression tests for every prayer named here.


## Praise to keep (do not regress)

- **Serving the classic first when the prayer names it.**
  - "zombie" s0 is Berry's 1934 decode to the drop: 1½ gold, 1½ Jamaican, 1 Demerara 151, ¾ lime, ½ Don's Mix, ½ falernum, 1 tsp grenadine, a dash of Angostura, 6 drops of anise. It is flash-blended, served in a chimney and credited, and the tagline reads "poured as written. Pray again and the gods will riff on it." This is the model for every bare classic.
- **Honest single-variable riffs.**
  - Moonlit Navy Grog keeps Don's honey, lime, grapefruit, soda and the dark Jamaican + Demerara, and announces "bourbon takes over from light rum".
  - Passion Mai Tai keeps the aged Jamaican, lime, curaçao and orgeat.
- **Deep-canon picks.** Vic's Tortuga for "strongest", the Kingston Negroni (Simó, Death & Co, 2009) for "surprise me", the Nuclear Daiquiri (de Gruyther, LAB, 2005) for a green jungle, the QPS with mint pressed, frosted, an Angostura crown and the bois lélé left in, Pat O'Brien's Hurricane, and the Bushwacker for the dessert prayer.
- **Service fixes from round 0 hold.**
  - Every coupe gets "Double-strain into a chilled coupe".
  - Shaved ice is packed for the Mai Tai.
  - The Navy Grog ice cone has a recipe and a big-cube fallback.
  - Sinks say "Don't stir: let the guest do it".
  - Carbonation is never shaken.
  - Hot drinks preheat the vessel and never touch ice.
  - Batches are given in cups and ounces.
- **Drinks I'd serve today.**
  - Papa's Library Dog-Eared Page: 2 oz dark Jamaican, ½ oz lemon, ¾ oz honey, 5 oz tea, preheated toddy mug.
  - Moonlit Whole Crew: Fish House cups over a block at about 1.6 sd.
  - Rogue Orchid: a dark Mai Tai with a black-rum float in a skull.
  - Smoldering Jungle Bird, with the original 4 oz pineapple, in the bird ceramic.
- **Fire safety language** on the volcano cards: a lemon-extract cube, a long lighter, "keep hair, sleeves and straws clear … put the fire out before anyone drinks". Apply it everywhere a flame appears.
- **Zero-proof is truly 0.0.** There is no Angostura, and tea plus saline give the structure.
- **Readings with real voice and history.** The Elvis reading (Harry Yee 1957, Coco Palms, Kauaʻi). The Pele reading, which keeps the goddess's name out of drink names; Ember Pāhoehoe uses its kahakō correctly. The Jamaica reading (Hampden, Worthy Park, pimento, Ting). Lines like "Zero ambition, maximum comfort." and "Same shape, one rank up."
- **Taglines and names with voice**, which should be the bar everywhere. Taglines: "for the heart that took on water", "dug up at low tide", "one more chapter", "all of the ceremony, none of the proof". Names: Slow Sunday Hammock, Torch Song Bird, Skipper Colada, Deep End Sour, Spice-Route Doubloon, Fire Fountain Crater.
- **The drawing style** is warm watercolour and ink, with a historically literate vessel library (chimney, poco grande, Ku, Moai, skull, bird, scorpion bowl on its stand). Opaque mugs show only the surface. Straws are correctly absent on up, stirred and hot drinks. Steam appears only on hot drinks.
- **Truthful colour where the look model fires.** Painkillers are opaque café au lait, the Nuclear Daiquiri is pale green, Deep End Sour is drawn blue, and Tangerine Long Afternoon has an orange-to-red sunrise floor.

## Per-drink scores (round-0 rubric, caps applied)

Mean 4.54 · ≥ 6: 27 · ≥ 9: 0 · ≤ 3: 22.

| # | Prayer | Seed | Name | Score | Note |
|---|---|---|---|---|---|
| 0 | a colada for a lazy sunday | 0 | Slow Sunday Hammock | 6 | Caribe Hilton colada + ½ oz coconut rum: sound, but 5 bottles for 'lazy', and the same drink is served to two other prayers |
| 1 | a colada for a lazy sunday | 1 | Slow Sunday Riptide | 4 | 1 oz rum, 0.7 sd, 9.5 oz in a 20 oz hurricane; strawberry 'smoothie'; identical to Gilligan s1 |
| 2 | something creamy and coconutty | 0 | Palm-Shaded Lookout | 6 | Answers creamy + coconut, but it's the Caribe Hilton cluster again (exact duplicate) |
| 3 | something creamy and coconutty | 1 | Palm-Shaded Conch | 5 | Painkiller in a hurricane; ½ tsp cinnamon syrup is a token pour; tasting says 'coconut and cream' with no cream; umbrella drawn but not listed |
| 4 | a mai tai but tropical | 0 | Passion Mai Tai | 7 | Honest Mai Tai riff (passion fruit for rock candy), core intact, shaved ice; tagline repeats 'Mai Tai' |
| 5 | a mai tai but tropical | 1 | Passion Tempest | 6 | Seed 0 + 1 dash Angostura, with the identical tagline |
| 6 | zombie | 0 | Zombie | 8 | Berry's 1934 decode to the drop, credited, flash-blended, chimney, Don's rule; 'pineapple frond' with no pineapple, and labelled classic and 'riff' at once |
| 7 | zombie | 1 | Wild Typhoon | 6.5 | c.1950 route with pineapple; a defensible sibling, but a small step |
| 8 | navy grog but with bourbon | 0 | Moonlit Navy Grog | 8 | Don's Navy Grog with bourbon in the light-rum slot, ice cone explained with a fallback; flat tagline and an odd 'Moonlit' |
| 9 | navy grog but with bourbon | 1 | Honeyed Downpour | 6.5 | Seed 0 + 1 dash Angostura, with the identical tagline |
| 10 | a swizzle | 0 | Garden Maelstrom | 7.5 | Good QPS: mint pressed, swizzled, Angostura crown, collins; credited to 'Trader Vic, 1946' (wrong); generic name |
| 11 | a swizzle | 1 | Banyan Swizzle | 4.5 | 10 lines, 3 citruses (¼ oz lemon invisible), swizzled in a hurricane's waist |
| 12 | painkiller but less sweet | 0 | Palm-Shaded Painkiller | 2 | B2: 'less sweet' ignored. Unchanged Pusser's 4-1-1 at 9.6 g/100 ml sugar |
| 13 | painkiller but less sweet | 1 | Coconut Kraken | 2 | B2: seed 0 + a dash of allspice, 'For "sweet": allspice dram' |
| 14 | scorpion bowl for 4 | 0 | Sundown Doldrums | 5.5 | Scorpion core and batch intact, bowl fits; lemon-heavy, ¼ oz orgeat, flaming shell with no safety step |
| 15 | scorpion bowl for 4 | 1 | Compass Bowl | 3 | B3: 1 tsp brandy, 1 tsp gin, ½ tsp demerara; still wine 'topped' |
| 16 | hot buttered rum for a snowy night | 0 | Rum-Soaked Hot Buttered Rum | 2 | B3: no batter (1 tsp rich simple + ¼ oz butter, 2.3 g sugar); phantom clove; 'the ice is part of the recipe' on a hot drink |
| 17 | hot buttered rum for a snowy night | 1 | Blizzard Toddy | 2 | Same as s0 + 1 tsp 151; drawn sage green |
| 18 | a frozen banana drink | 0 | Brain Freeze Sour | 4 | Banana liqueur with no banana, frozen at shaken-drink sugar; placeholder garnish 'the named fruit when practical' |
| 19 | a frozen banana drink | 1 | Banana-Leaf Brain Freeze | 4.5 | Real banana and prayer-true, but 1 oz rum (0.7 sd) and half a hurricane |
| 20 | something smoky and spicy for a cold night | 0 | Woolen Toddy | 4 | Hot, smoky and spicy as asked, but the only sweetener was trimmed: spiked coffee at 2.3 g sugar; drawn teal for 'Near-black' |
| 21 | something smoky and spicy for a cold night | 1 | Smoke-Signal Woolen | 4.5 | ½ + ½ oz base in 2½ oz water; 5 oz drink; 'Smoke-Signal' trope |
| 22 | mezcal and passion fruit | 0 | Charred Treasure Map | 6 | Cobra's Fang with a mezcal split; on the ask; passion fruit only via Fassionola |
| 23 | mezcal and passion fruit | 1 | Charred Monsoon | 5 | On the ask, but 2 oz mezcal + 2 oz rum (2.8 sd) turns a Hurricane into a smoke bomb |
| 24 | bananas foster in a glass | 0 | Foster Daiquiri | 3 | Banana daiquiri where the reading said 'never citrus-forward'; cinnamon stick standing in a coupe; placeholder garnish |
| 25 | bananas foster in a glass | 1 | Banana-Boat Foster | 3 | Caribe Hilton colada with banana liqueur in a hollowed pineapple: nothing Foster |
| 26 | coffee and rum, stirred | 0 | Moonless Squall | 7 | Sensible coffee rum Old Fashioned over a block; 'citrus twist , expressed'; Zombie strength line at 1.6 sd |
| 27 | coffee and rum, stirred | 1 | Midnight Anchor | 6 | ¼ oz demerara + ½ tsp rich simple redundancy; 12.1 g sugar; identical tagline |
| 28 | ginger and lime highball | 0 | Gingered Doldrums | 4 | 1¾ oz overproof floated on 3 oz ginger beer: first sips near-neat; 16.5% 'highball'; phantom clove |
| 29 | ginger and lime highball | 1 | Golden Flamingo | 4.5 | 'Mule' with no ginger beer, champagne-topped; 'Flamingo' that isn't pink |
| 30 | heartbreak | 0 | Torch Song Bird | 5.5 | Lovely tagline and bittersweet idea, but Heering promised and absent; orange peel with no orange; mint phantom |
| 31 | heartbreak | 1 | Sunrise Broken Compass | 3 | Hemingway over cubes in a DOF, 1¾ oz grapefruit; garnish '... and none.'; not the promised drink |
| 32 | first date at the beach | 0 | Salt and Sand Frappé | 4 | Three spirits in a strawberry frappé, low sugar for frozen, overflows 12 oz; 4 garnishes after 'no garnish jungle' |
| 33 | first date at the beach | 1 | Perfumed Salt and Sand | 3.5 | Hibiscus sink in an opaque enamel tin ('down the inside of the glass') |
| 34 | my grandmother's garden | 0 | Sunday Best Punch | 2 | B4: single serve built over a block in a 120 oz punch bowl; no garden ingredient |
| 35 | my grandmother's garden | 1 | Blooming Parlor | 2 | B4: punch bowl for one, 'long straws, one per guest'; four spirits in 1¾ oz |
| 36 | a rainy afternoon with a good book | 0 | Papa's Library Dog-Eared Page | 7 | A real hot tea grog: preheated mug, honey, lemon; grapefruit twist and lime wheel on a lemon drink; phantom clove |
| 37 | a rainy afternoon with a good book | 1 | Honeyed Chapter and Verse | 5 | 1 oz rum, 0.7 sd, 4.5 oz; identical tagline |
| 38 | celebrating a promotion | 0 | Champagne Lanai Cup | 6 | Mai Tai + bubbles is the right idea; champagne topped onto crushed ice; promised overproof float missing |
| 39 | celebrating a promotion | 1 | Gilded Maita'i Roa Ae | 4.5 | 2 oz light-rum Mai Tai for a promotion (the downgrade); 'bitter edge' phantom |
| 40 | a drink that tastes like a sunset | 0 | Horizon Sunset | 5 | A sink gradient, but a tequila Sunrise for a sunset; 'tastes' misparsed as 'elegance' |
| 41 | a drink that tastes like a sunset | 1 | Sundown Horizon | 5 | Sunset float looks right, but 4½ oz rum (3.0 sd) called 'Easy-drinking strength' |
| 42 | something blue for the pool | 0 | Deep End Sour | 5.5 | Actually blue and drawn blue; look text says 'green-gold'; overflows a 12 oz poco grande; sour slush; no unbreakable vessel |
| 43 | something blue for the pool | 1 | Copra Deep End | 4 | Blue drink hidden in an opaque pineapple, 4.5 oz in a 20 oz shell |
| 44 | layered and pretty, like a sunrise | 0 | First Light Sunrise | 6 | Honest Tequila Sunrise in a collins: layered, pretty, sunrise; non-tiki; duplicate of 'ocean' s0; umbrella drawn not listed |
| 45 | layered and pretty, like a sunrise | 1 | Sundown Eastward | 4 | Royal Hawaiian Mai Tai with no citrus (acid 0.27), named 'Sundown' for a sunrise |
| 46 | the color of the ocean at dawn | 0 | Swell Sunset | 2 | B2: ocean ignored, the same Tequila Sunrise; 'salt spray on the rim' with no salt rim |
| 47 | the color of the ocean at dawn | 1 | Sundown Swell | 2 | B2: duplicate citrus-less Royal Hawaiian, orange not ocean |
| 48 | green like the jungle | 0 | Canopy Liana | 7 | Nuclear Daiquiri, credited, coupe, truly green; pineapple wedge (absent) and an upright mint sprig on a coupe |
| 49 | green like the jungle | 1 | Canopy Toucan | 5 | Missionary's Downfall with aquavit, melon and peach (8 lines); overflows the poco grande |
| 50 | Havana 1957 | 0 | Malecón Sour | 5.5 | Decent daiquiri, but falernum for Havana, 1 tsp rich simple, Constante 'in 1957' (he died 1952), 'Water-clear' |
| 51 | Havana 1957 | 1 | Lucky Malecón | 3.5 | Watermelon frappé at 3.4 g sugar (sour slush), 1 tsp grapefruit, garnish 'the fruit' |
| 52 | a night in Tahiti | 0 | Moorea Colada | 4 | Three ½ oz rums lost in cream of coconut; promised Mai Tai shape and vanilla absent; 'tiare' but an orchid |
| 53 | a night in Tahiti | 1 | Palm-Shaded Moorea | 2.5 | Strawberry colada with ½ bourbon + ½ light rum, 0.7 sd; nothing Tahitian |
| 54 | Jamaican street party | 0 | Block Party Bowl Cup | 2.5 | B4: single Planter's in a punch bowl, filled with crushed ice; Hawaiian 'Ho'olaule'a' on a Jamaican party |
| 55 | Jamaican street party | 1 | Wild Ho'olaule'a | 2 | B4: brandy-peach Fish House Punch for one in a bowl, ½ oz Jamaican rum; Hawaiian name |
| 56 | Tokyo neon | 0 | Kyoto Horizon | 4.5 | Melon + yuzu + hibiscus has some neon logic, but a tequila Sunrise in a hurricane; the sink is the main sweetener |
| 57 | Tokyo neon | 1 | Perfumed Kyoto | 3.5 | Seed 0 minus the lime: acid 0.39 'in balance'; lemon/lime/orange garnish with none in the drink |
| 58 | Elvis in Blue Hawaii | 0 | Long-Lost Blue Hawaii | 6.5 | Harry Yee's spec, Elvis reading accurate, but it's described and drawn green |
| 59 | Elvis in Blue Hawaii | 1 | Sideburns Tide | 5 | Gin swap 'for elvis'; seed collapse |
| 60 | Gilligan's Island | 0 | Skipper Colada | 6 | Coconut shell, three rums, fun; 5.75 oz + 8 oz ice overflows the 12 oz shell |
| 61 | Gilligan's Island | 1 | Castaway Canopy | 3 | Duplicate 1 oz-rum strawberry smoothie |
| 62 | a drink for a dragon | 0 | Scale Revenant | 4.5 | Canon Cobra's Fang, but no fire, chile or smoke for a dragon, though the tagline says 'smoky' |
| 63 | a drink for a dragon | 1 | Wild Hoard | 4 | Smuggler's Cove Zombie, served to three prayers; Moai for a dragon |
| 64 | something my dad would like | 0 | Captain Dad Cup | 5 | Good Barbados/agricole Mai Tai, but the promised bourbon and maple are absent |
| 65 | something my dad would like | 1 | Gilded Captain Dad | 4 | Light-rum Mai Tai for dad |
| 66 | volcano goddess | 0 | Fire Fountain Crater | 4 | Volcano Bowl served single in a DOF with 'one per guest'; 3 sweeteners, sunk grenadine does the sweetening; good fire-safety text |
| 67 | volcano goddess | 1 | Ember Pāhoehoe | 3.5 | Seed 0 + ¼ grapefruit + 1 tsp falernum |
| 68 | pirate's treasure | 0 | Pieces of Eight Cup | 4 | Duplicate Planter's in a collins; same-category rum split; orange and pineapple garnish absent; mint phantom |
| 69 | pirate's treasure | 1 | Spice-Route Doubloon | 4 | Good name, but a Navy Grog with no honey (¼ oz demerara vs 1½ oz citrus) |
| 70 | not too sweet, very tart | 0 | Lucky Relic | 2 | B2: 'tart' → 'less tart': ½ oz lime, less tart than a standard daiquiri |
| 71 | not too sweet, very tart | 1 | Riptide Cooler | 4 | Stock Mojito; 'very' moved nothing; Moves credits the Angostura to 'sweet, tart' |
| 72 | the strongest drink you dare | 0 | Overgrown Hideaway | 7 | Vic's Tortuga, 3.3 sd, in a chimney: the right heavyweight, renamed without credit |
| 73 | the strongest drink you dare | 1 | Skull Revenant | 5 | Smuggler's Cove Zombie duplicate (3 prayers); pineapple frond with no pineapple |
| 74 | low abv for brunch | 0 | Long Afternoon Sunrise | 2.5 | B2: 8.7% for low ABV; the OJ swap left a tequila soda over a cassis puddle |
| 75 | low abv for brunch | 1 | Tangerine Long Afternoon | 4 | Mimosa-sunrise idea, but 7.9% on a full tequila base |
| 76 | zero-proof for the designated driver | 0 | Clear Skies Spritz | 4.5 | 0.0% honestly, but 6.2 oz shaken over crushed, called a 'Spritz'; 'full tiki garnish' placeholder |
| 77 | zero-proof for the designated driver | 1 | Sunrise Sandbar | 5 | A tea-and-grapefruit zero-proof grog with saline is a smart build; short; placeholder garnish |
| 78 | no coconut, no pineapple | 0 | Rogue Expedition | 3 | Constraint broken: pineapple frond garnish (drawn as a wedge) on the no-pineapple drink; falernum removed from the Zombie core |
| 79 | no coconut, no pineapple | 1 | Crossing Revenant | 2.5 | Duplicate Zombie + pineapple frond on the no-pineapple drink |
| 80 | in a coconut | 0 | Copra Macaw | 3 | B4: 20 oz finished in a 12 oz coconut; triplicate colada |
| 81 | in a coconut | 1 | Palm-Shaded Voyage | 3 | B4: 8.5 oz + crushed ice open-poured into a 12 oz coconut |
| 82 | skull mug of something dark | 0 | Blackstrap Torch | 4 | 11 lines, 3.7 sd (above Zombie), overflowing a 12 oz skull; no blackstrap, no torch |
| 83 | skull mug of something dark | 1 | Rogue Orchid | 6.5 | Dark Mai Tai with a black-rum float in a skull: on the ask and well built |
| 84 | a punch bowl for a party of 8 | 0 | Whole Crew Volcano | 4 | 101 oz + crushed ice in a 120 oz bowl; 2.6 sd per guest at a party; ¼ oz gin and brandy tokens; 'Volcano' with no fire |
| 85 | a punch bowl for a party of 8 | 1 | Moonlit Whole Crew | 6 | Proper Fish House cups over a block at about 1.6 sd; method stated twice; pineapple and orange garnish absent |
| 86 | a Jungle Bird with mezcal | 0 | Smoldering Jungle Bird | 7 | Jungle Bird with mezcal split, original 4 oz pineapple, bird ceramic; tight on capacity |
| 87 | a Jungle Bird with mezcal | 1 | Smoldering Canopy | 6 | Seed 0 with Demerara for Jamaican |
| 88 | surprise me | 0 | Uncharted Curveball | 3.5 | An Aperol Jungle Bird sold as 'something you have never had'; duplicate of 'bitter' s1 |
| 89 | surprise me | 1 | Uncharted Compass | 6.5 | Kingston Negroni, credited: a real surprise; Zombie strength line at 1.4 sd |
| 90 | bitter and refreshing | 0 | Afternoon Rain Swizzle | 6.5 | QPS + Campari: bitter and cold; 2½ oz Demerara is not 'lower proof' |
| 91 | bitter and refreshing | 1 | Bitter Cool Breeze | 4 | Aperol makes it less bitter; short DOF; duplicate of 'surprise me' s0 |
| 92 | something floral and elegant | 0 | Corner Office Cup | 3.5 | Crushed-ice Mai Tai with spent shell, not elegant; 'Corner Office... closing the deal' |
| 93 | something floral and elegant | 1 | Blooming Boardroom | 3.5 | Rum Old Fashioned with pisco named 'Blooming Boardroom': nothing floral, no flower |
| 94 | chocolate and coffee dessert drink | 0 | Bushwhacked Cocoa Lagoon | 6 | An on-ask Bushwacker (vodka as in 1975), rich dessert; whipped cream drawn as café au lait |
| 95 | chocolate and coffee dessert drink | 1 | Bushwhacked Mariner | 6.5 | Rum Bushwacker, prayer-true and fun |