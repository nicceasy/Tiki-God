# Round 0 critique: the Tiki God packet (96 drinks, 48 prayers × 2 seeds)

Reviewer stance: I'm the bartender behind the stick at a serious tiki bar who also has to keep it a party. Two questions decide everything: would I serve this to the guest who said that prayer, and would they come back? For most of this packet the answer is no. The chemistry layer is not the problem. Sugar:acid ratios mostly land inside family ranges and ABVs are plausible. The trouble sits on either side of the balancer: the prayer is misheard on the way in, and the recipe, steps, garnish, vessel, name and prose come out on the way out. The system is very good at producing statistically average Daiquiri/Colada/Buck skeletons and very bad at being a bartender.

## 0. Headline numbers (measured from packet.json)

| Metric | Count | Share |
|---|---|---|
| Coupe/"up" drinks whose steps say "open-pour, ice and all … top with crushed ice" | 14 of 15 coupes | 15% of all drinks |
| Prayers where the parser heard nothing (`Heard: (nothing)`) | 6 prayers / 12 drinks | 12.5% |
| Drinks that miss the central request of the prayer (my count) | 43 | 45% |
| Seed pairs that are byte-identical recipes | 5 of 48 prayers | 10% |
| Seed pairs with ingredient Jaccard ≥ 0.7 | 8 of 48 | 17% |
| Identical recipes served to *different* prayers | 6 clusters, 13 drinks | 14% |
| Duplicate drink names | "The Squall's Hideaway" ×2, "Havana Parrot" ×2 | |
| Tasting note claims banana on a drink with no banana ingredient | 24 | 25% |
| Tasting note says "clean cane, crispness and dryness" | 36 | 38% (incl. cream-of-coconut drinks) |
| Tasting note says "Balanced, neither sweet nor tart" | 77 | 80% |
| Tasting note says "Assertive, but the dilution keeps it easy" | 45 | 47% (incl. a hot drink) |
| Garnish is exactly "pineapple wedge and fronds" | 31 | 32% |
| Pineapple garnish on a drink with no pineapple | 7 | |
| Garnish duplicated as a recipe line ("garnish Fresh mint") | 13 | 14% |
| Light (white column) rum in the recipe | 50 | 52% |
| Taglines with a doubled word ("tropical tropical punch", "bitter bitter tiki sour") | 8 | |
| Non-accent lines measured in teaspoons (½ tsp rich simple, 1 tsp lime) | 25 lines | |
| Database ingredients that the prayers called for but were never used: fresh banana, HBR batter, sparkling wine, brandy, green Chartreuse, melon liqueur, yuzu, vanilla ice cream, coconut water, Islay Scotch, hibiscus, falernum syrup (N/A) | 0 uses each | |

**My overall score for round 0: 3.2 / 10** (mean of the per-drink grades in §5). Twelve drinks reach 6 or better. None is a 9.

What went right, so nobody breaks it: the mezcal Jungle Bird (proportions sound, bird vessel is a real nod to the KL Hilton's ceramic bird), the skull-mug grog (Pearl of Essequibo is a properly built Demerara/Jamaican/honey/allspice grog), "navy grog but with bourbon" (it is genuinely the 1941 Navy Grog with bourbon in the light-rum slot; only the ice-cone service is botched), and the Painkiller tin. The chemistry gate and the vessel story layer are worth keeping.

---

## 1. Failure taxonomy

Severity: **blocker**: a guest would send it back, or it can't physically be made as written. **Major**: drinkable, but wrong, misleading or joyless. **Minor**: polish.

### B1. Service contradiction: up drinks served on crushed ice. BLOCKER
- **Frequency:** 14 of 15 coupe drinks (every shaken coupe drink, 15% of the packet). Special ice (shaved, ice cone) is ignored in 4 more.
- **Examples:**
  - Havana 1957 s0, *Garden Flamingo*: "coupe · shake, **none ice**", then "Open-pour, ice and all, **into a coupe; top with crushed ice to fill**." And the garnish is a "big mint bouquet (spank it first)" on a coupe.
  - Volcano goddess s0, *Castaway of Havana*: crushed ice heaped into a coupe, then "set a spent lime half on the ice … and light it." That puts a burning lime shell on a 7 oz stemmed glass.
  - Tokyo neon s0, *Perfumed Galleon*; pirate's treasure s1; not too sweet s0; floral s0; surprise me s1: all the same coupe-plus-crushed-ice dump.
  - Navy grog s0/s1: "shake, **ice-cone** ice", then "Open-pour … top with crushed ice to fill". The ice cone is the whole point of the Navy Grog: a shaved-ice cone frozen around a straw hole.
  - Mai Tai s0/s1: "shake, **shaved** ice", then steps say crushed.
- **Suspected root cause:** the step writer branches on the family's default ice, or on a stale service object, rather than the final `method.ice` / `up` / vessel. "none" and "ice-cone" have no branch. (The current `engine.js` default branch does handle `svc.ice === 'none'`, so either the packet predates that change or `svc` differs from `recipe.method`. Either way there is no regression test.)
- **What correct looks like:** "Shake hard with cubed ice for 10–12 s; double-strain into a chilled coupe." An ice cone gets its own steps: "Shake with crushed ice; strain into a pilsner/DOF over an ice cone (pack shaved ice into a pilsner glass around a chopstick, freeze, unmold)", with a quick fallback ("or over one large cube"). Shaved ice gets "pack the glass with shaved/pebble ice". Add a test that asserts every step's ice word agrees with `method.ice`, and that a coupe never receives "ice and all".

### B2. The prayer was misheard, not heard, or heard and ignored. BLOCKER
- **Frequency:** 12 drinks heard nothing at all; 4 were misparsed; I count **43 of 96 (45%)** that miss the central request.
- **Examples:**
  - **Misparse: "not too sweet, very tart"** → `Heard: less sweet, less tart`. The negation window is the last 4 space-split tokens before a hit (`["not","too","sweet,","very"]`), so the comma isn't a boundary and "very" isn't an intensifier. The result is s1, *Frigatebird Bird*: ¼ oz lemon + 1 tsp lime against ¾ oz Campari, ½ oz OJ and 1 tsp crème de cacao. The guest asked for very tart and got the least acidic sour in the packet (acid 0.52 g/100 ml).
  - **Misparse: "layered and pretty, like a sunrise"** → `complex & layered`. "layered" sits in both the visual-layering entry (prompt.js line 161) and the complexity entry (line 167), and complexity won. s0 is a 5-dash-Angostura bitter sour in a DOF. s1 is a colada **in an opaque coconut shell**. Neither has a single layer.
  - **Heard nothing:** heartbreak, celebrating a promotion, the color of the ocean at dawn, a drink for a dragon, something my dad would like, pirate's treasure. Each one fell to the family-prior mode (generic resort punch, Beachcomber spice sour or daiquiri). Every one of these is an easy read for a human bartender: celebration means bubbles, dragon means fire and dragon fruit, pirate means navy rum and grog, ocean at dawn means a pale-blue-to-pink gradient.
  - **Heard and ignored:** "smoky" → `added chile liqueur for smoky`, when the database has mezcal and Islay Scotch and neither was used. "hot buttered rum for a snowy night" → no batter and no sugar (2.3 g/100 ml, tasting "Dry rather than sweet"), even though `hot-buttered-rum-batter` exists in the database. "cold night" / "rainy afternoon" → served on **crushed ice** in a footed pilsner. "low abv for brunch" → 10.3% and 10.5%, barely under the buck family's median of 11.1%. "frozen banana drink" s0 → no banana; grenadine dominates ("A pomegranate, lime, banana sour"), even though fresh `banana` exists. "celebrating a promotion" → no sparkling wine, even though `sparkling-wine` exists. "Tokyo neon" → a gin sour and a Mai Tai, nothing Japanese and nothing neon, even though `yuzu-juice` and `melon-liqueur` exist.
- **Suspected root cause:** (a) lexicon gaps for moods and occasions, and a free-text concept layer that doesn't fire; (b) negation scope that ignores punctuation and doesn't model intensifiers; (c) phrase collisions resolved by order, not specificity; (d) concept → ingredient mapping that adds a token "for X" ingredient instead of re-planning the drink. "Cold-weather" doesn't change service, "colour" doesn't constrain vessel or ingredients, and "occasion" picks nothing.
- **What correct looks like:** every prayer produces at least one *structural* decision that a reader can trace back to its words: family, service temperature, a hero ingredient, the vessel, or the colour. Unknown words fall back to an LLM-style semantic read or a curated concept table (heartbreak → bittersweet, comforting, stirred or warm), never to nothing. `Heard` must be non-empty for any prayer a bartender could interpret. Negation scope stops at `, ; . but and`; "very / extra / super / really" multiply the following attribute.

### B3. Classic identity destroyed by novelty swaps and "simple" pruning. BLOCKER
- **Frequency:** 8+ drinks; it hits exactly the prayers that name a classic.
- **Examples:**
  - "Elvis in Blue Hawaii" s0: `swapped blue curaçao for banana liqueur`. That is a Blue Hawaii with the blue removed. s1 swaps the light rum for dark Jamaican rum, which turns blue curaçao into swamp-teal.
  - "scorpion bowl for 4" s1: `swapped light rum … for london dry gin (to step away from the Scorpion)`. The guest asked for the Scorpion. Neither seed has brandy, the Scorpion's defining second spirit.
  - "a mai tai but tropical" s0: `swapped orange curaçao for passion fruit liqueur`. Without curaçao it isn't a Mai Tai cousin; it's a Jamaican rum sour.
  - "zombie" s0: `swapped velvet falernum for maraschino liqueur`. That drops one of the Zombie's three load-bearing flavours (falernum, Don's Mix, Pernod).
  - "a colada for a lazy sunday" s0/s1: **no pineapple in either seed**. *Coconut Conch* is 1½ oz light rum + ½ oz cream of coconut, 2 oz total, 17.9% ABV ("roughly the strength of a Daiquiri"), served in a 12 oz poco grande. "Lazy" → `simple` → the pruner kept the cheapest skeleton and threw out the defining ingredient.
- **Suspected root cause:** the novelty check (Jaccard ≥ 0.8 → swap something) has no notion of an identity core and fires even when the user *asked* for the classic. The "simple" style trims lines by cost/count without a must-keep list.
- **What correct looks like:** each family and named classic declares an **identity core** that may be re-proportioned but never removed:
  - Mai Tai: aged rum + lime + orange curaçao + orgeat.
  - Zombie: multi-rum + lime + Don's Mix (grapefruit + cinnamon) + falernum + absinthe/Pernod + Angostura.
  - Blue Hawaii: blue curaçao + pineapple + rum/vodka + sour.
  - Scorpion: rum + brandy + orange + lemon + orgeat.
  - Colada: rum + pineapple + coconut.
  - Painkiller: navy rum + pineapple + orange + coconut + nutmeg.
  - Grog: rum + lime/grapefruit + honey or spice.

  Novelty edits touch the periphery only. A bare classic name ("zombie") serves the canonical spec, credited, and offers a signed riff second. "X but Y" changes exactly the Y and says so.

### B4. Physically unworkable or incoherent technique. BLOCKER
- **Frequency:** about 12 drinks.
- **Examples:**
  - "a swizzle" s1, *Velvet Tradewind*: rhum agricole, apricot liqueur, cream of coconut and **"0.5 piece Egg white"**, swizzled over crushed ice. Egg white needs a dry shake to emulsify; swizzled on crushed ice it becomes snotty strands. Cream of coconut in a swizzle is a colada pretending.
  - Punch bowl for 8 s1: "Add everything to a blender cup with 12 oz of crushed ice (**multiply everything by 8**)". That's 44 oz of liquid, 24 oz of it rum including 6 oz of 69% overproof, in one blender cup with 12 oz of ice, all for one punch bowl of Zombie. Scorpion bowl for 4 and punch bowl s0 make the same "multiply" shaker request.
  - "the strongest drink you dare" s0: **16.8 oz finished in a 13 oz collins**; s1 is 15.3 oz in the same glass. Both overflow.
  - "coffee and rum, stirred" s0: "Stir everything with ice … Strain over one large cube … **Top with coffee**". The coffee is already in "everything". 2¾ oz rum + 1½ oz brewed coffee stirred on ice is watery iced coffee with a lot of booze, not a stirred sipper.
  - "hot buttered rum": ¼ oz butter (measured as a fluid ounce) and ¼ oz cinnamon syrup in 4 oz water. With no sugar to carry it, the butter floats as an oil slick and the drink is thin and savoury. "Garnish Whole cloves" appears as a recipe line while the garnish field says cinnamon stick.
  - "a swizzle" s0: "1. Add the remaining ingredients except the Angostura bitters." Remaining after what? Into what glass? The mint step was dropped, but the word "remaining" stayed.
- **Suspected root cause:** steps are templated per method with no feasibility check (vessel capacity, batch size versus equipment, ingredient/technique compatibility). The "multiply" suffix is bolted on rather than producing a batch recipe.
- **What correct looks like:** a **compatibility table** (egg white → dry shake + up or rocks, never swizzle or blend; dairy and cream of coconut → shake or blend, never stir; carbonation → never shaken). A **capacity check**: finished volume plus ice displacement must be ≤ vessel capacity, and ≥ 55% of it so the glass doesn't look empty. **Batch output** for N > 2: totals in cups and oz, build in a pitcher or bowl over a block or crushed ice, shake or blend in rounds, and a per-guest strength.

### B5. Seed collapse and cross-prayer duplicates. BLOCKER (packet-level)
- **Frequency:** 5 identical seed pairs; 8 pairs with Jaccard ≥ 0.7; 6 clusters where different prayers got the identical recipe (13 drinks); 12 drinks are pure copies.
- **Examples:**
  - *Undertow Cooler* (celebrating a promotion), *Tradewind of San Juan* (Gilligan's Island) and *San Juan Canopy* (pirate's treasure) are all 2 oz light rum, ½ lime, 2 pineapple, ½ grenadine, ¾ banana liqueur.
  - *Scarlet Serpent* (a drink that tastes like a sunset) = *Castaway of Havana* (volcano goddess).
  - *Cinnamon Canopy* (heartbreak) = *Corsair Sour* (rainy afternoon).
  - *Conch Cooler* (no coconut, no pineapple) = *The Gecko's Relic* (surprise me). "Surprise me" returns the single most generic drink in the system.
  - *Eclipse Colada* (night in Tahiti) = *San Juan Corsair* (in a coconut), and *Copra Macaw* (ocean at dawn) is the same drink plus 2 dashes of Angostura.
  - Identical across seeds: navy grog, painkiller, hot buttered rum, zero-proof, Jungle Bird.
- **Suspected root cause:** a deterministic skeleton fill, and seeds that only perturb tie-breaks. When the parser hears nothing, every prayer falls into the same basin.
- **What correct looks like:** seed 1 differs from seed 0 in *concept* (another family, hero ingredient, or service), not just a ¼ oz. No two prayers in a battery ever share a recipe. Names are unique across the packet.

### M1. Tasting notes, taglines and "why" that don't describe the drink. MAJOR
- **Frequency:** phantom banana in 24 drinks; "crispness and dryness" in 36; "neither sweet nor tart" in 77 (80%); "the dilution keeps it easy" in 45.
- **Examples:**
  - Mai Tai s0/s1 tagline: "A funky, tropical, **banana** Mai Tai cousin". There is no banana in either; "banana" is a secondary flavour tag on Jamaican rum, promoted to a headline flavour. A guest with a banana aversion would skip a perfectly good drink.
  - *Coconut Conch* (rum + cream of coconut): "settles into **clean cane, crispness and dryness**." That is a sweet coconut drink.
  - *Marlin of San Juan*: ratio 54:1, "on the rich side", and still "Balanced, neither sweet nor tart."
  - *Lookout of Port Royal* (hot drink): "Assertive, but **the dilution keeps it easy**." *The Bamboo's Voyage* (coffee, no lime): "finishes with … **lime**", because falernum's tag leaks. *Perfumed Hideaway*: "finishes with florals, **lychee**", with no lychee in the drink. *Sun-Struck Colada*: "molasses, richness and **smoke**" from navy rum, which is arguable at best and misleading next to a smoky prayer.
  - Taglines are adjective soup: "A coconut, creamy, rich colada." "A pineapple, banana, tropical **tropical** punch." "A lime, baking spice, bitter **bitter** tiki sour."
  - "Why" is database statistics: "Sugar-to-acid ratio ≈ 27.8 : 1 **by weight** — inside the Colada & Painkiller family's typical range (14.05–46.35 across 66 drinks)". "Jamaican rum + fresh lime juice: paired in 55 drinks (Zombie, Mai Tai), a proven match" is trivially true and explains nothing. "Pina Colada, Piña Colada" is a dedupe miss shown to the user.
  - Strength comparisons contradict each other. "Roughly the strength of a Mai Tai" is used for 10.2%, 10.3%, 15.2% and 15.4%. "A Zombie" covers 15.5% to 19.7%. "A Daiquiri" is used for 17.4%. A 14.8% volcano drink is compared to a Hemingway Daiquiri.
- **Suspected root cause:** tasting is assembled from concatenated ingredient flavour tags with secondary tags promoted, and wide threshold buckets ("balanced" = most of the distribution). "Why" picks nearest neighbours by statistic across inconsistent database variants.
- **What correct looks like:**
  - **Tasting:** what a drinker perceives, in order of intensity, attributed where useful ("Jamaican rum's ripe, almost banana-like funk"). Sweetness and tartness are called relative to the family *and* in absolute terms ("on the sweet side, like a Painkiller"). Temperature and texture words fit the service.
  - **Tagline:** a hook with voice ("Pineapple, coconut, and nowhere to be."), never a tag list.
  - **Why:** three things. What it's built on ("a Navy Grog with bourbon in the light-rum slot"), what changed and how that answers the prayer, and one honest line of history. Strength goes in **US standard drinks** (0.6 oz ethanol) with one fixed, canonical reference scale.

### M2. Garnish: templated, mismatched and joyless. MAJOR
- **Frequency:** 31 drinks get only a pineapple wedge; 7 of those have no pineapple in them; 29 get "lime/orange wheel, mint sprig"; 13 repeat the garnish as an ingredient line.
- **Examples:**
  - *Frigatebird Bird* and *Cane Field of San Juan*: pineapple fronds on drinks with no pineapple. *The Relic's Lookout*: pineapple wedge on an orange-coffee-cacao drink.
  - Havana 1957 s0/s1: "big mint bouquet (spank it first)" on a coupe.
  - Hot buttered rum: recipe line "garnish Whole cloves", garnish field "cinnamon stick". The two disagree.
  - Every Mai Tai riff lists "spent lime shell, mint sprig, **big mint bouquet**", which is two mints, plus "garnish Fresh mint" as an ingredient.
  - The art renders paper umbrellas on drinks whose garnish lists none (a bitter tiki DOF, a coffee-chocolate hurricane).
- **Suspected root cause:** garnish is a per-family default list, not derived from ingredients, vessel and prayer. The aromatic role leaks into the poured-lines list.
- **What correct looks like:** garnish is chosen from (a) an ingredient in the drink (pineapple only if pineapple is in it), (b) an aromatic the drink needs (mint over crushed ice; nutmeg on cream or coconut; a cinnamon stick on spice; expressed orange on stirred), and (c) one moment of tiki theatre that fits the prayer: orchid, cocktail umbrella, cherry-and-pineapple flag, spent-shell flame, lime-wheel "life ring", sparkled cinnamon. Up drinks get a pick or a peel, never a bouquet. Garnish never appears as a poured line.

### M3. Look and vessel: colour-blind, opacity-blind and capacity-blind. MAJOR
- **Frequency:** every colour or visual prayer (sunset, blue, layered, ocean, green, neon, Elvis: 14 drinks), plus about 10 capacity misfits.
- **Examples:**
  - "something blue for the pool" s1, *Havana Parrot*: gold rum + blue curaçao (amber + blue = murky green), served in a **copper mug**, so nobody sees the colour. s0 is ¾ oz blue curaçao into 2 oz pineapple juice, which comes out green and opaque, not blue. Nobody thought about glass by the pool either.
  - "green like the jungle": s0 is dry vermouth, amaro and 5 dashes of Angostura, which is brown. s1 is 1¼ oz Bénédictine + soda, which is amber. The database's green Chartreuse, melon liqueur, mint and cucumber all went unused.
  - "the color of the ocean at dawn" s1: a brown spice sour in an opaque Moai mug.
  - Renderer (sheets 1–6): rum + cream of coconut is drawn **teal**; the creamy colada and Eclipse Colada are drawn sage-green; hot buttered rum is drawn **teal**; lime daiquiris are drawn mint-green; the orange-lemon Scorpion bowl is drawn green. Lime juice doesn't make a drink green, and cream of coconut makes it opaque ivory.
  - Capacity: *Coconut Conch* is 3.3 oz in a 12 oz poco grande. *San Juan Manta* is a single 6.6 oz serve "for 4" in a 64 oz bowl. Strongest s0 is 16.8 oz in a 13 oz collins.
- **Suspected root cause:** there's no `look` in the recipe object. Ingredient `optics` are marked `interim: true`. The mixing model seems additive in RGB, not subtractive-with-opacity. Vessel selection doesn't consider transparency even when colour is the request.
- **What correct looks like:** each recipe outputs `look = {hex, opacity, layers[], surface}` (for example "opaque ivory with a nutmeg dusting" or "clear aqua, fizzing"). Colour is computed by weighting each ingredient's tint strength (blue curaçao and grenadine are strong; light rum, lime and coconut water are weak) with opacity from cream, coconut, pineapple, egg, banana and ice cream. Colour prayers *constrain ingredients* (no amber spirits or yellow juices in a "blue" drink) and *force a clear vessel*. Layer prayers use sinks (grenadine, crème de cassis) and floats (overproof, aged rum) with the step text the engine already has. Poolside means no glass.

### M4. Proportion and strength choices a bartender wouldn't make. MAJOR
- **Frequency:** about 20 drinks.
- **Examples:**
  - Light rum in 50 of 96 drinks. Tiki is a rum-*blending* tradition (Don's three-rum builds, Vic's 17-year J. Wray), and Martin Cate's categories exist to put pot-still character in the glass. *Cinnamon Anchor* (a swizzle on 2 oz light rum), *Gale Punch* and the "dad" daiquiri all end up thin.
  - *Scorched Cup*: 1¼ oz chile liqueur, a 40% sweet liqueur, used as a modifier; sweet heat buries the Demerara rum. *Kingston Hideaway*: 1¼ oz Bénédictine as the only sweetener, which is syrupy and medicinal. *Bamboo Highball*: ginger syrup + falernum + ginger beer gives 18:1 "lush" for a "ginger and lime highball".
  - *The Bamboo's Voyage*: 2¾ oz Barbados rum in a stirred drink, an Old Fashioned and a half.
  - False precision: ½ tsp rich simple next to 3 oz of pineapple juice; ½ tsp vanilla syrup; 1 tsp lime in a colada. Nobody can taste ½ tsp of simple in 6 oz.
  - Low ABV for brunch: 10.3–10.5%, versus about 6–7% for a sherry cobbler or spritz. Strongest: 17–19% ABV is ordinary Zombie territory. "Strongest" should be judged by **total ethanol** (s0 ≈ 2.9 oz ≈ 4.8 standard drinks), and the output should carry a Don-style "limit two" warning.
  - Zero-proof: 5.4 oz of thin iced tea with ½ tsp syrup in a collins glass. The designated driver gets the saddest drink of the night.
- **Suspected root cause:** the balancer is satisfied by in-range family statistics. There's no per-role sanity (modifier ≤ 1 oz unless it's the base; liqueur-as-sweetener accounting), no minimum perceptible pour, and no prayer-driven strength target in absolute terms.
- **What correct looks like:** round to ¼ oz, with tsp/dash/drop for accents only. At most 7 poured ingredients except for heavyweights. Base spirit 1½–2½ oz in a single serve (up to 4 oz for heavyweights, with a warning). Low-ABV ≤ 7%, zero-proof ≥ 7 oz and as dressed-up as the boozy drinks, and strongest is reported in standard drinks.

### M5. Family labels and names that lie about the contents. MAJOR
- **Examples:**
  - *Smoldering Bowl* and *Compass of Havana* are filed under "Scorpion & Fog Cutter (Vic's **orgeat** punches)" with **no orgeat**.
  - *Mariner Cooler* is a cream drink, not a cooler. *Rogue Hibiscus* and *Charred Hibiscus* contain no hibiscus. *Plymouth Parrot* uses London dry gin, while Plymouth is a distinct gin style. *Smoldering Bowl* is served in a mug.
  - Grammar and redundancy: "**The Doldrums's** Expedition", "**Frigatebird Bird**", "The Bamboo's Voyage" (a bamboo doesn't voyage).
  - Geography salad: "Jaguar of Havana" (no jaguars in Cuba; it's a colada with soda water), "Castaway of Havana" for a *volcano goddess*, "Compass of Havana" for a sunset, "Tradewind of San Juan" for Gilligan's Island, "Barracuda of San Juan" for a drink in a coconut. "San Juan" and "Havana" appear 11 times between them, mostly attached to light rum, whatever the prayer.
  - The prayer often hands you the name and the generator ignores it: volcano goddess, dragon, pirate's treasure, Tokyo neon.
- **Suspected root cause:** names are drawn from a trope bag (place × creature/object × noun) keyed on the family, not on the prayer or the hero ingredient. No uniqueness or grammar pass.
- **What correct looks like:** the name draws on the prayer, a hero ingredient, or a tiki idiom, with puns welcome. It's grammatical (possessive "Doldrums'", or reword), unique within the packet, and never names an ingredient that isn't there. On cultural sensitivity: modern tiki (Smuggler's Cove, Tropical Standard, the post-2018 conversation) has moved away from caricature. Generic "goddess / volcano / castaway" is fine, but naming drinks after a living deity (Pele) or sacred figures is not.

### M6. Season and temperature ignored. MAJOR
- *Ashen Grog* and *Scorched Cup* ("cold night"), *Corsair Sour* and *Gale Cup* ("rainy afternoon … cold-weather") are all on crushed ice; *Scorched Cup* even gets soda water. Cold-weather should push toward hot (toddy, buttered rum, grog served hot, Tom & Jerry-style), stirred-and-strong (rum Old Fashioned), or at the very least a non-crushed rocks service.

### m1. Units and formatting. MINOR
"0.5 piece Egg white", "6 drop / 7 drop", "hot, none ice", "shake, none ice", butter in fluid oz, inconsistent capitalisation ("Light rum" against "fresh lime juice", "Hot water", "Coffee"), "(spank it first)" inside a garnish list. The engine vocabulary leaks into user-facing chips: "served in: scorpion bowl", "bartender's choice".

### m2. Accessibility notes missing. MINOR
Homemade items (Don's Mix, pineapple gum syrup, cinnamon syrup, honey mix) appear with no one-line recipe or substitute. Specialty items (Demerara 151, agricole) have no fallback. The packet strips the brand examples that exist in the JSON. Show one or two benchmark bottles for each rum, because the rum category *is* the flavour in tiki.

---

## 2. The 15 worst outputs, with notes

1. **"a colada for a lazy sunday" s0, *Coconut Conch*: 0/10 territory.** 1½ oz light rum + ½ oz cream of coconut: no pineapple, no acid, 2 oz of liquid in a 12 oz poco grande, 17.9% ABV, tasting "clean cane, crispness and dryness." A lazy Sunday wants *low effort and low strength*. This is a sweet rum shot in a big glass. The "simple" style pruned out the definition of the drink. Seed 1 repeats the crime with three rums and still no pineapple.
2. **"Elvis in Blue Hawaii" s0, *The Shipwreck's Relic*.** The engine logged `swapped blue curaçao for banana liqueur`. It's a Blue Hawaii without blue, in honour of a film named for the colour. Harry Yee's 1957 spec (light rum, vodka, blue curaçao, pineapple, sweet-and-sour) was right there. Seed 1 uses dark Jamaican rum, so the blue comes out muddy teal.
3. **"hot buttered rum for a snowy night" s0 (s1 is identical), *Lookout of Port Royal*.** ¼ oz butter, ¼ oz cinnamon syrup, 4 oz water: a greasy, nearly sugarless hot rum (2.3 g/100 ml, "Dry rather than sweet"). The database has `hot-buttered-rum-batter`. The tagline "warm, funky, banana hot drink" promises banana that isn't there. The renderer draws the liquid teal.
4. **"scorpion bowl for 4" s1, *Plymouth Parrot*.** The guest asked for the Scorpion, and the engine swapped out the rum "to step away from the Scorpion". It's a gin sour, with no brandy, built as one 4¼ oz serve "multiplied by 4" in a shaker, in a 64 oz bowl, named after a gin it doesn't contain.
5. **"layered and pretty, like a sunrise" s1, *The Doldrums's Expedition*.** "Layered" was misread as "complex"; the drink is a plain colada **inside an opaque coconut shell**, the one vessel that guarantees nobody sees a sunrise. The name has a possessive typo. Seed 0 is a brown bitter sour; it's just as wrong.
6. **"something blue for the pool" s1, *Havana Parrot*.** Gold rum turns the curaçao murky green. It's served in a copper mug that hides the colour completely, the name is a duplicate, and the garnish is orange wheel + mint (orange). The colour is the request, and this answer fails it.
7. **"a swizzle" s1, *Velvet Tradewind*.** Egg white and cream of coconut, swizzled over crushed ice. That can't be made well, and it isn't a swizzle in spirit (a swizzle is lean: rum, lime, sugar, bitters, mint, ice). Tasting "green cane, green notes and cream"; a "0.5 piece" unit.
8. **"bananas foster in a glass" s0, *Lookout Grog*.** Bananas Foster (Brennan's, New Orleans, 1951) is butter, brown sugar, banana, cinnamon, dark rum, flambé and vanilla ice cream. This is a tart grapefruit-lime grog with a splash of banana liqueur and allspice. It's a dessert prayer answered with a sour, while the database has fresh banana, vanilla ice cream, butter and HBR batter, all unused. The best theatre match in the battery, a flambé, went to the volcano coupe instead.
9. **"volcano goddess" s0, *Castaway of Havana*.** It's literally the sunset drink (light rum, lime, grenadine, Campari). The crushed ice is dumped into a coupe and a flaming lime shell set on top. The name ignores the prayer, and this is a fire hazard on a stemmed glass. Seed 1 (a Zombie-style build in a snifter with fire) is the right idea in the wrong vessel; the database has a **volcano bowl** that went unused.
10. **"not too sweet, very tart" s1, *Frigatebird Bird*.** "Very tart" was parsed as "less tart". It gets ¼ oz lemon + 1 tsp lime against ¾ oz Campari, ½ oz OJ and a teaspoon of crème de cacao. A pineapple garnish with no pineapple, a collins glass for 5.7 oz, and "Frigatebird Bird" round it out.
11. **"coffee and rum, stirred" s0, *The Bamboo's Voyage*.** 2¾ oz rum stirred with 1½ oz brewed coffee is watery and hot-or-cold unspecified. The steps add the coffee twice. Tasting finds lime and banana in a drink with neither. The right build is rum + coffee liqueur or cold-brew concentrate (¼–½ oz) + demerara + bitters: a rum Old Fashioned with coffee.
12. **"celebrating a promotion" s0, *Undertow Cooler*.** Heard nothing, and it's the identical recipe served to Gilligan's Island and pirate's treasure. A promotion is the easiest read in the battery: bubbles. Sparkling wine is in the database. Seed 1 is a colada topped with **soda water**, which is the opposite of celebratory.
13. **"Tokyo neon" s0, *Perfumed Galleon*.** A gin/maraschino/orgeat sour with crushed ice in a coupe. There's nothing Japanese and nothing neon. Yuzu and melon liqueur (Midori, a Suntory product, as neon as a bottle gets) are both in the database. Seed 1 is a straight Mai Tai variant.
14. **"green like the jungle" s1, *Kingston Hideaway*.** 1¼ oz Bénédictine + 2 oz rum + lime + soda is amber-brown, cloying-herbal and not green. Seed 0 is brown and red. Green Chartreuse (the Chartreuse Swizzle is a modern tiki standard) sits in the database unused.
15. **"a punch bowl for a party of 8" s1, *Graveyard Shift Specter*.** A Zombie-strength heavyweight (3 oz rum including ¾ oz of 69% overproof per guest, 16.2%) is "flash-blended ×8" in one blender cup and served from a communal bowl. A party punch should be sessionable, built in the bowl over a block of ice, with batch measures. Seed 0 is the scorpion-bowl drink copied, also "multiplied".

Runners-up: "smoky and spicy for a cold night" s1 (1¼ oz chile liqueur, crushed ice, soda, no smoke); "zero-proof" s0/s1 (5.4 oz of thin tea); "low abv for brunch" s0/s1 (not low); "the color of the ocean at dawn" s1 (brown in a Moai); "frozen banana drink" s0 (no banana, a pink pomegranate sour); "heartbreak" s0 (the rainy-afternoon drink copied).

---

## 3. What excellent answers look like (12 prayers)

Conventions: US oz; ethanol and standard drinks (US, 0.6 oz ethanol) are approximate; "sub" means the accessible substitute. Every answer below uses only items already in `data/ingredients.json` unless flagged.

### 3.1 "a colada for a lazy sunday" → **Sunday Hammock**
*Tagline:* Pineapple, coconut, and nowhere to be.
- 1½ oz lightly aged blended rum (Planteray 3 Stars, or Bacardí Superior)
- ½ oz Jamaican rum (Appleton Estate Signature), for character without effort
- 3 oz pineapple juice
- 1¼ oz cream of coconut (Coco López, stirred well)
- ½ oz fresh lime juice
- pinch of salt (or 3 drops saline)

**Method:** lazy wins. Shake hard with a scoop of crushed ice and dump it all into the glass, or blend for 10 s with 1 cup of ice if you want it frozen. Doubles straight into a pitcher.
**Vessel:** poco grande (or whatever big glass is clean; this is Sunday).
**Garnish:** pineapple wedge with a cherry flag. Optional fresh nutmeg.
**Look:** opaque ivory-gold, frosted, a thin coconut sheen on top.
**Strength:** about 8–9% ABV, about 1.4 standard drinks.
**Why it's right:** the colada core is intact (rum + pineapple + coconut). The lime and salt keep a Coco López drink from cloying. Everything comes from the grocery store: no syrups, no homemade anything. The Jamaican half-ounce is the one "tiki" upgrade and costs no effort.

### 3.2 "a mai tai but tropical" → **Roa Ae**
*Tagline:* Trader Vic's Mai Tai, with passion fruit and pineapple riding shotgun.
- 1 oz aged Jamaican rum (Appleton Estate 8 or 12)
- 1 oz aged rhum agricole (Clément VSOP; sub: aged Demerara rum, El Dorado 8)
- ¾ oz fresh lime juice
- ½ oz orange curaçao (Pierre Ferrand Dry Curaçao)
- ¼ oz orgeat
- ½ oz passion fruit syrup (in place of the rock-candy syrup)
- 1 oz pineapple juice

**Method:** shake with 12 oz crushed ice; open-pour into the glass; top with crushed ice so it domes.
**Vessel:** double old fashioned (the Mai Tai's glass since Vic's Oakland bar, 1944).
**Garnish:** the spent lime shell, cut side up (the "island"), a big mint sprig planted beside it (the "palm"), and an orchid.
**Look:** hazy gold-amber, slightly opaque from the pineapple foam, with a green crown of mint.
**Strength:** about 15% ABV, about 1.7 standard drinks.
**Why:** the Mai Tai core is untouched (aged rum blend, lime, curaçao, orgeat). "Tropical" is answered by swapping the plain sugar for passion fruit and adding an ounce of pineapple for body. The name nods to Carrie Guild's "Maita'i roa ae", "out of this world". Every change is announced in the explanation.

### 3.3 "zombie" → **Zombie (Don the Beachcomber, c. 1934, per Jeff Berry's decode)**, then a signed riff
A one-word classic prayer gets the classic first.
- ¾ oz fresh lime juice
- ½ oz Don's Mix (2 parts white grapefruit juice : 1 part cinnamon syrup)
- ½ oz falernum (Velvet Falernum)
- 1½ oz gold Puerto Rican rum (sub: any gold column rum)
- 1½ oz aged Jamaican rum
- 1 oz Demerara 151 (Hamilton 151 or Lemon Hart 151; sub: 1 oz El Dorado 8 + accept a gentler Zombie)
- 1 tsp grenadine
- 1 dash Angostura bitters
- 6 drops Pernod or absinthe

**Method:** flash-blend for up to 5 seconds with 6 oz crushed ice (or shake very hard); pour into the glass; top with ice.
**Vessel:** chimney (Zombie) glass. **Garnish:** a mint sprig. **Look:** deep amber-red, translucent, frosted.
**Strength:** about 3.3 standard drinks. Print Don's rule: *limit two per guest.*
**Riff for seed 1 (if novelty is required):** *Graveyard Bloom* is the same build with the grenadine replaced by ¼ oz hibiscus syrup, plus ¼ oz passion fruit syrup and ¼ oz less Don's Mix. That gives a garnet colour and a floral-tart edge; announce it as a Zombie riff.

### 3.4 "hot buttered rum for a snowy night" → **Snowbound**
*Tagline:* Brown sugar, butter and dark rum, with the radiator ticking.
- 2 oz aged Jamaican rum (Appleton Estate Signature; or 1½ Jamaican + ½ Demerara)
- 1 heaping tbsp (about ¾ oz) hot buttered rum batter*
- ¼ oz allspice dram (the tiki nod; optional)
- 4–5 oz boiling water

*Batter (keeps 2 weeks refrigerated): beat 1 stick softened butter, 1 cup packed dark brown sugar, 1 tsp cinnamon, ½ tsp nutmeg, ¼ tsp allspice, ⅛ tsp clove, a pinch of salt and 1 tsp vanilla.*

**Method:** preheat the mug. Add the batter and a splash of hot water and stir until it melts; add the rum and dram; top with hot water and stir.
**Vessel:** toddy mug (or a stemmed Irish coffee glass to show off the colour).
**Garnish:** cinnamon stick as a stirrer, fresh nutmeg grated over.
**Look:** opaque caramel-tan with a gold butter sheen and a fleck of nutmeg; steaming.
**Strength:** about 12–13% ABV, about 1.5 standard drinks.

### 3.5 "scorpion bowl for 4" → **The Scorpion Bowl (batched for four)**
*Tagline:* Four straws, one bowl, zero regrets until Tuesday.
- 6 oz light Puerto Rican rum
- 2 oz brandy (any VS cognac or good American brandy)
- 1 oz London dry gin
- 6 oz fresh orange juice
- 4 oz fresh lemon juice
- 2 oz orgeat
- 1 oz simple syrup (taste: add only if your oranges are tart)

**Method:** blend in two batches, each with 1½ cups crushed ice, for 5 seconds (or stir hard in a pitcher with ice). Pour into the bowl over 3 cups fresh crushed ice.
**Vessel:** Scorpion bowl (64 oz). **Garnish:** a gardenia or orchid floated in the centre (Vic's served the Scorpion with a gardenia), orange wheels around the rim, mint, and four 12-inch straws.
**Look:** opaque sunny pale orange, frosted, with a white flower floating in the middle.
**Strength:** about 12% ABV, about 1.5 standard drinks each.
**Why:** this is the Scorpion core (rum, brandy, orange, lemon, orgeat) at sensible party strength, with the method rewritten for batch.

### 3.6 "bananas foster in a glass" → **Flambé '51**
*Tagline:* Brennan's tableside dessert, poured instead of plated.
- 1½ oz dark or aged Jamaican rum
- ½ oz banana liqueur (Giffard Banane du Brésil)
- ½ ripe banana
- 1 tbsp hot buttered rum batter (sub: ¼ oz demerara syrup + a pinch of cinnamon)
- 2 scoops (about 4 oz) vanilla ice cream
- ½ cup crushed ice, plus a pinch of salt

**Method:** blend until smooth and spoonable. Drizzle a little caramel or demerara syrup down the inside of the glass first.
**Vessel:** poco grande or a footed tulip.
**Garnish:** a torched (brûléed) banana coin on a pick. *Optional theatre:* pinch ground cinnamon through a lit match's flame above the glass so it sparkles, Brennan's flambé trick in miniature, over the drink and never into it.
**Look:** opaque beige-caramel milkshake with dark caramel streaks on the glass.
**Strength:** about 7–8% ABV, about 1.25 standard drinks.

### 3.7 "something blue for the pool" → **Deep End**
*Tagline:* Swimming-pool blue, and safe to drink in the shallow end.
- 1½ oz light rum
- ¾ oz blue curaçao
- ½ oz fresh lime juice
- ¼ oz simple syrup
- 2 oz coconut water
- 2 oz soda water, to top

**Method:** shake everything but the soda with cubed ice; strain over fresh ice; top with soda and stir once.
**Vessel:** a tall clear **acrylic** tumbler or plastic hurricane, because no glass goes poolside. (Gap: `vessels.json` has no shatterproof vessel; add one.)
**Garnish:** a lime wheel hooked over the rim like a life ring, and a cocktail umbrella.
**Look:** clear, bright aqua-blue, fizzing; the coconut water gives a faint sunlit haze. No yellow juice or amber spirit is allowed, because they'd turn it green.
**Strength:** about 9–10% ABV, about 1.3 standard drinks: sessionable in the sun.

### 3.8 "layered and pretty, like a sunrise" → **First Light**
*Tagline:* Crimson at the horizon, gold overhead, and a little cloud of foam on top.
- 1½ oz lightly aged blended rum
- 2 oz pineapple juice
- 1 oz fresh orange juice
- ½ oz fresh lime juice
- ¼ oz passion fruit syrup
- ½ oz grenadine, to sink

**Method:** shake everything except the grenadine hard with cubed ice; strain into the glass over fresh cubed ice. Then pour the grenadine slowly down the inside of the glass; it sinks and bleeds upward. **Don't stir**; the guest stirs with the straw.
**Vessel:** hurricane glass (clear, tall, curved, so the gradient shows).
**Garnish:** a half orange wheel on the rim (the sun) and a cherry.
**Look:** three bands, deep crimson at the bottom, coral-orange in the middle and pale gold above, capped with white pineapple foam.
**Strength:** about 8% ABV, about 1 standard drink.

### 3.9 "green like the jungle" → **Canopy Swizzle**
*Tagline:* Grass, mint and Chartreuse: the whole jungle, swizzled.
- 1¼ oz rhum agricole blanc (sub: a grassy white rum)
- ½ oz green Chartreuse
- ¾ oz fresh lime juice
- ½ oz falernum
- ¼ oz simple syrup
- 10 mint leaves + 2 thin cucumber slices

**Method:** lightly press the mint and cucumber in the bottom of the glass. Add everything else, fill two-thirds with crushed ice, and swizzle until the glass frosts. Pack with more ice. No bitters crown, because red would fight the green.
**Vessel:** footed pilsner or collins (clear).
**Garnish:** a huge mint bouquet, a cucumber ribbon threaded on a pick, a lime wheel.
**Look:** pale jade-green, translucent, flecked with mint and frosted outside.
**Strength:** about 16% ABV, about 1.6 standard drinks.
**Lineage:** a cousin of Marco Dionysos's Chartreuse Swizzle and the Queen's Park Swizzle.

### 3.10 "Tokyo neon" → **Neon Kaiju**
*Tagline:* Melon-green, yuzu-bright, stomping through the city lights.
- 1½ oz Japanese whisky (Suntory Toki; sub: a crisp white rum. Gap: Japanese whisky isn't in the database)
- ¾ oz melon liqueur (Midori, Suntory's own, launched in the US in 1978)
- ½ oz yuzu juice (sub: ¼ oz lemon + ¼ oz lime)
- 3 oz cold soda water

**Method:** shake the whisky, Midori and yuzu briefly with cubed ice; strain into the glass over a clear ice spear; top with soda and lift once with the spoon.
**Vessel:** tall highball.
**Garnish:** a shiso leaf (or mint) slapped and tucked in, and a bright red cherry on a pick for the neon contrast.
**Look:** electric chartreuse-green, crystal-clear, streaming bubbles.
**Strength:** about 11–12% ABV, about 1.3 standard drinks.

### 3.11 "volcano goddess" → **Caldera Queen** (for two)
*Tagline:* Lava-red, chile-warm, with a fire in the crater.
- 2 oz aged Jamaican rum
- 2 oz Demerara rum (El Dorado 5 or 8)
- 1½ oz fresh lime juice
- 1 oz fresh grapefruit juice
- 2 oz pineapple juice
- 1 oz passion fruit syrup
- ½ oz cinnamon syrup
- ½ oz grenadine
- ½ oz chile liqueur (Ancho Reyes)
- 2 dashes Angostura bitters
- For the crater: ½ oz 151 rum and a sugar cube or crouton

**Method:** shake in two tins with crushed ice (or flash-blend); pour into the bowl and pack with crushed ice around the crater. Soak the sugar cube in the 151 *before* it goes in the crater, light it with a long lighter, and keep hair and sleeves back. Never pour from the bottle near the flame, and put the fire out (cover the crater) before anyone drinks.
**Vessel:** volcano bowl (40 oz) with two long straws.
**Garnish:** an orchid and pineapple fronds around the crater rim, and lime wheels.
**Look:** opaque lava orange-red with a blue flame in the centre. Optional: sprinkle cinnamon through the flame for sparks.
**Strength:** about 12–13% ABV, about 1.5 standard drinks each.
**Naming note:** evoke the goddess without borrowing Pele's name; she's a living figure in Hawaiian religion.

### 3.12 "zero-proof for the designated driver" → **The Lifeguard**
*Tagline:* All of the parasol, none of the proof: someone has to watch the pool.
- ¾ oz fresh lime juice
- ½ oz fresh grapefruit juice
- 1½ oz pineapple juice
- ½ oz passion fruit syrup
- ½ oz falernum syrup, non-alcoholic (sub: ¼ oz orgeat + ¼ oz cinnamon syrup)
- 2 oz strong black tea, chilled (for rum-like tannin and backbone)
- 2 oz ginger beer, to top
- *(No Angostura: a dash is ~45% ABV. Keep it strictly 0.0 for drivers, pregnancy and recovery.)*

**Method:** shake everything but the ginger beer with crushed ice; open-pour into the mug; top with ginger beer and more crushed ice.
**Vessel:** a proper tiki mug, never a "kid's" glass.
**Garnish:** the full treatment: mint bouquet, pineapple fronds, orchid and umbrella. It should be the best-dressed drink at the table.
**Look:** hazy amber-gold, fizzing, frosted.
**Volume:** about 9–10 oz. **ABV:** 0.0%.

*Directions for the six prayers the parser didn't hear (bar for round 1):*
- **Heartbreak:** bittersweet and comforting, stirred or warm. Demerara rum + Campari or amaro + falernum, stirred on a big cube, with an expressed orange peel. Tagline energy: "for the long way home."
- **Celebrating a promotion:** bubbles. An Air Mail-style tiki build (aged rum, lime, honey, sparkling wine) in a flute or coupe, with a gold-leaf or orchid garnish.
- **Ocean at dawn:** a pale blue-to-blush gradient. Coconut-water/blue-curaçao body with a hibiscus or grenadine blush sinking to the bottom. Butterfly-pea tea, which turns violet when you add acid, would be ideal (it's missing from the database).
- **A dragon:** fire plus dragon fruit (missing from the database) plus chile. A Jamaican-overproof punch with five-spice syrup, a flaming lime shell and a dragon or skull mug.
- **Dad:** Navy Grog or a rum Old Fashioned. Not too sweet, a real rum, no fuss.
- **Pirate's treasure:** navy rum (Pusser's) grog or a Painkiller riff, gold-flecked, in a barrel mug or tin.

---

## 4. Scoring rubric for later rounds

Each drink is scored 0–10 on each dimension and the weighted mean gives the drink score. **Hard caps:** any blocker (§1 B1–B4) caps the drink at 3. A misread prayer (B2) caps it at 2. A packet with any exact duplicate (B5) loses 1 point off the packet score per duplicate.

| # | Dimension (weight) | What earns 10/10 |
|---|---|---|
| 1 | **Prayer fidelity** (20%) | Every content word in the prayer leads to a visible decision (family, service, hero ingredient, colour, vessel, strength, occasion), and a bartender reading the drink cold could guess the prayer. Constraints ("no coconut", "zero-proof", "for 8") are fully honoured. The engine's `Heard` list is complete and correct. |
| 2 | **Canon and identity** (10%) | Named classics are served canonically and credited, or riffed with the identity core intact and the change stated. Lineage claims are accurate (date, place, person) and come from the tiki canon (Don, Vic, Berry, Cate, modern standards). |
| 3 | **Balance and proportions** (15%) | A pro would make it without adjusting. Sugar:acid fits the style; the base is 1½–2½ oz (heavyweights flagged); modifiers ≤ 1 oz unless they're the point; no false-precision pours; ≤ 7 poured ingredients unless heavyweight; ABV fits the prayer (low ≤ 7%, zero = 0.0, strongest reported in standard drinks with a warning). |
| 4 | **Technique and feasibility** (10%) | Steps match method, ice and vessel exactly. Ingredients are compatible with technique (egg → dry shake; carbonation added last; dairy never stirred). Volume fits the vessel (55–100% of capacity with ice). Batches are given as totals with a batch method. Fire steps carry safety lines. |
| 5 | **Flavour truth** (10%) | Every tasting word maps to an ingredient that's actually present, in the right order of intensity. Sweet/tart and strength calls are honest. The tagline is a hook with voice, not a tag list, with no doubled words. |
| 6 | **Tiki character** (10%) | Reads as tiki on purpose: a rum blend or a characterful base, layered spice/fruit/bitter, a reason for crushed ice, theatre where the prayer invites it. Light rum alone only when the style demands it (daiquiri, Blue Hawaii). |
| 7 | **Garnish** (5%) | Derived from the drink and the moment, aromatic where the nose matters, one bit of fun, and never an ingredient that's absent. Up drinks get a pick or peel. |
| 8 | **Vessel and look** (10%) | The vessel fits the service, the capacity and the story, and shows off the colour when colour matters. `look` is given (hex, opacity, layers, surface) and is physically plausible; the renderer matches it (cream reads ivory, blue reads blue, layers show). |
| 9 | **Name** (5%) | Evocative, tied to the prayer or hero ingredient, grammatical, unique in the packet, and never naming an absent ingredient or a living deity. A guest would want to say it out loud. |
| 10 | **Explanation and accessibility** (5%) | "Why" names what it's built on, what changed and why, and one line of history. Strength in standard drinks. Every homemade or specialty item has a one-line recipe or substitute, and benchmark bottles are named for each rum style. |

**Packet-level gates (all required for approval):** zero blockers; zero exact duplicates and zero repeated names; seed pairs differ in concept (Jaccard < 0.6) for every open prayer; `Heard` non-empty for every interpretable prayer; ≥ 90% of drinks score ≥ 6; mean ≥ 7.5; at least 12 drinks score ≥ 9; tasting-note phantom flavours = 0; garnish/ingredient mismatches = 0.

**What a 10/10 drink is, in one sentence:** the guest says the prayer, you set the drink down, and they laugh because it's obviously *their* drink. It tastes balanced on the first sip, looks like what they imagined, has a name they repeat to the next table, and they could make it at home from the card.

---

## 5. Per-drink grades, round 0 (for tracking)

| Prayer | s0 | s1 | Note |
|---|---|---|---|
| a colada for a lazy sunday | 1 | 2 | no pineapple, 2–2½ oz drink |
| something creamy and coconutty | 6 | 5 | s1 pineapple garnish, no pineapple |
| a mai tai but tropical | 4 | 6 | s0 lost curaçao; phantom banana |
| zombie | 5 | 6 | s0 dropped falernum; close to canon otherwise |
| navy grog but with bourbon | 6 | 6 | real Navy Grog swap; ice cone ignored; seeds identical |
| a swizzle | 4 | 1 | s0 broken step; s1 egg white |
| painkiller but less sweet | 6 | 6 | sound; seeds identical |
| scorpion bowl for 4 | 3 | 2 | no brandy; s1 gin; no batch |
| hot buttered rum for a snowy night | 2 | 2 | no batter, no sugar |
| a frozen banana drink | 3 | 5 | no fresh banana |
| something smoky and spicy for a cold night | 4 | 2 | no smoke; crushed ice; s1 1¼ oz chile liqueur |
| mezcal and passion fruit | 5 | 6 | s0 "orgeat punch" without orgeat |
| bananas foster in a glass | 2 | 3 | a sour, not a dessert |
| coffee and rum, stirred | 2 | 2 | coffee twice; watery; 2¾ oz rum |
| ginger and lime highball | 4 | 5 | s0 cloying; garnish mismatch |
| heartbreak | 2 | 2 | heard nothing; s0 copy; s1 coupe with crushed ice |
| first date at the beach | 4 | 5 | cranberry cocktail; duplicate name |
| my grandmother's garden | 2 | 2 | no garden anywhere |
| a rainy afternoon with a good book | 3 | 3 | crushed ice; copy |
| celebrating a promotion | 2 | 2 | no bubbles; copy |
| a drink that tastes like a sunset | 3 | 3 | no gradient; coupe with crushed ice; s1 "orgeat punch" without orgeat |
| something blue for the pool | 4 | 1 | s0 green; s1 copper mug |
| layered and pretty, like a sunrise | 1 | 1 | misparsed; no layers; coconut shell |
| the color of the ocean at dawn | 2 | 1 | heard nothing; brown in a Moai |
| green like the jungle | 1 | 1 | both brown |
| Havana 1957 | 3 | 3 | coupe with crushed ice and a mint bouquet |
| a night in Tahiti | 3 | 3 | s0 copy; nothing Tahitian beyond vanilla |
| Jamaican street party | 3 | 3 | coupe sours, not a party |
| Tokyo neon | 2 | 2 | nothing Japanese or neon |
| Elvis in Blue Hawaii | 1 | 2 | blue removed / muddied |
| Gilligan's Island | 3 | 4 | s0 copy |
| a drink for a dragon | 2 | 2 | heard nothing |
| something my dad would like | 3 | 4 | heard nothing; s1 "Havana Parrot" dupe name |
| volcano goddess | 1 | 5 | s0 flaming coupe copy; s1 right idea, wrong vessel |
| pirate's treasure | 2 | 2 | heard nothing; s0 copy |
| not too sweet, very tart | 4 | 1 | misparse; s1 least tart drink |
| the strongest drink you dare | 4 | 4 | overflows collins; no warning |
| low abv for brunch | 2 | 3 | 10%+ ABV |
| zero-proof for the designated driver | 2 | 2 | 5.4 oz thin tea; seeds identical |
| no coconut, no pineapple | 4 | 4 | honours the constraint, boring; s0 copy |
| in a coconut | 5 | 5 | fine, generic |
| skull mug of something dark | 7 | 6 | best grog in the packet |
| a punch bowl for a party of 8 | 2 | 1 | no batch; s1 Zombie ×8 |
| a Jungle Bird with mezcal | 7 | 7 | sound; seeds identical |
| surprise me | 2 | 2 | most generic drink; coupe with crushed ice |
| bitter and refreshing | 3 | 4 | not refreshing (no length) |
| something floral and elegant | 3 | 3 | coupe with crushed ice; phantom lychee; s1 not elegant |
| chocolate and coffee dessert drink | 3 | 2 | OJ, or pineapple + banana, with coffee |

Mean ≈ 3.2. Drinks at ≥ 6: 12. Drinks at ≥ 9: 0.

---

## 6. Highest-leverage fixes, ranked

1. Make the step writer read the final `method` (ice/up/vessel). Add ice-cone and shaved branches, and a test that no coupe gets "ice and all". (Fixes B1: 18 drinks.)
2. Bound the negation scope at punctuation and conjunctions, add intensifiers, and resolve lexicon collisions by specificity ("layered" → visual layering when near "pretty" or a colour word). Add a concept fallback so `Heard` is never empty. (B2.)
3. Add identity cores per family and named classic. The novelty swap and the simple-pruner may not touch them, and a bare classic name serves the canon. (B3.)
4. Add a feasibility pass: technique compatibility, capacity, batch output for N > 2, and fire safety. (B4.)
5. Make seed 1 a different concept, with packet-level uniqueness of recipes and names. (B5.)
6. Add a `look` model (subtractive colour + opacity + layers). Colour prayers constrain ingredients and force clear vessels; fix the renderer palette for cream, coconut and lime. (M3.)
7. Rebuild the tasting, tagline and why: ingredient-attributed, no secondary-tag promotion, standard drinks, one canonical strength scale, and a short history line. (M1.)
8. Derive garnish from ingredients, aromatics and theatre; drop the garnish-as-ingredient lines. (M2.)
9. Set the default base toward characterful rums. Add per-role pour caps and minimum perceptible pours; absolute ABV targets for low/zero/strongest. (M4.)
10. Generate names from the prayer and hero ingredient, with a grammar pass, uniqueness, and a cultural-sensitivity filter. (M5.)
