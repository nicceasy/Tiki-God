# How Tiki Drinks Work: Concepts

*The ideas behind the modern tiki drink: its skeleton, its rum logic, its seasonings and techniques, and how they changed from Planter's Punch to today's craft bars.*

This document goes with [`history.md`](history.md), which covers people, places and dates, and it feeds the modeling work in `data/`. It explains **why** classic tiki recipes look the way they do, so that new drinks can be built from modern, available ingredients using the same logic. Bracketed numbers point to **Sources** at the end. Statements marked **(heuristic)** are this project's own summaries of patterns in the classic recipes, not quotations from practitioners.

---

## 1. The skeleton: sour, sweet, strong, weak

Every tiki drink is a **rum punch or rum sour** that has been elaborated. The oldest written version of its balance is the Caribbean punch rhyme [9][17]:

- **1878** (London *Fun*): 1 glass lemon juice, 2 glasses sugar, 3 glasses rum, 4 glasses cold water.
- **1908** (*New York Times*): 2 parts sour (lime), 1½ parts sweet, 3 parts strong (Jamaican rum), 4 parts weak.
- **Popular mnemonic:** *one of sour, two of sweet, three of strong, four of weak.*

In the original setting, "sweet" often meant raw sugar or a thin syrup, and "weak" was water or ice melt added before serving. In a modern shaken drink, the **"weak" part comes from ice**, so the three ingredients you actually measure are sour, sweet and strong. Modern syrups are also much sweeter by volume than a glass of loose sugar, so today's typical proportions look like this:

| Template | Sour | Sweet | Strong | Weak |
|---|---|---|---|---|
| 1908 rhyme (by volume) | 2 | 1.5 | 3 | 4 (water) |
| Modern Daiquiri-style sour | ¾–1 oz lime | ½–¾ oz 1:1 syrup | 2 oz rum | shaking dilution (roughly half again the liquid volume) |
| Classic Beachcomber drink | ¾–1½ oz *combined* citrus | ½–1½ oz *combined* sweeteners and liqueurs | 2–4 oz *combined* rums | crushed ice and flash-blending |

Keep this in mind: **tiki takes each of the four slots and splits it into several ingredients.** The sour slot becomes lime *plus* grapefruit or pineapple. The sweet slot becomes honey *plus* falernum *plus* cinnamon syrup. The strong slot becomes three rums. The weak slot becomes crushed ice, blending and juice. The overall balance still follows the rhyme [2][1].

---

## 2. Rum blending

### 2.1 Why use more than one rum?

Donn Beach's central idea was that **a combination of rums could do what no single rum could** [2][22]. Rums from different traditions are strong in different, complementary ways:

| Role | What it adds | Typical style (project IDs) |
|---|---|---|
| **Backbone / dryness** | Clean alcohol, crisp finish; lets citrus and spice show | Light column rum from Cuba or Puerto Rico (`rum-white-column`, `rum-gold-column`, `rum-blended-light`); rhum agricole blanc for a *grassy* dryness (`rum-agricole-blanc`) |
| **Funk / body** | Esters, overripe banana and pineapple, "hogo"; weight on the palate | Jamaican pot still (`rum-jamaican-pot`, `rum-jamaican-aged`) |
| **Richness / depth** | Burnt sugar, dried fruit, smoke, dark color | Demerara (`rum-demerara`), black rums (`rum-black-blended`, `rum-jamaican-dark`) |
| **Bridge / roundness** | Balanced oak and fruit that ties the others together | Barbados and other blended aged rums (`rum-barbados`, `rum-aged-column`) |
| **Strength / accent** | Heat, a concentrated burst of flavor, flammability | 151-proof Demerara (`rum-demerara-overproof`), Jamaican overproof, OFTD-style blends (`rum-black-overproof`) |
| **Vegetal lift** | Fresh cane, grass, olive brine | Agricole blanc or vieux, cachaça, clairin |

### 2.2 How the classics blend

- **Zombie (1934, Berry's decode):** 1½ oz gold Puerto Rican + 1½ oz gold or dark Jamaican + 1 oz Lemon Hart 151 Demerara. That is backbone plus funk plus a strong, rich accent, about 4 oz of rum in total [20][2].
- **Navy Grog (Don, c. 1941):** equal parts of three rums (a light Puerto Rican, a dark Jamaican and a Demerara) with lime, grapefruit and honey, lengthened with a little soda [2][3].
- **Mai Tai (1944 → post-war):** Vic began with **one** superb rum, the 17-year J. Wray & Nephew Jamaican. When it ran out, he rebuilt its profile by **blending** a Jamaican with a Martinique rum [18][19]. Modern craft versions follow the same logic: a Jamaican pot-still rum for funk plus an agricole for dry grassiness, or a single "blended aged" rum designed as that blend.
- **Floats:** a dark rum floated on top (Planter's Punch, island Mai Tai, Painkiller variations) adds aroma and a visual gradient more than taste throughout the drink.

### 2.3 The Smuggler's Cove categories

Martin and Rebecca Cate's *Smuggler's Cove* (2016) replaced loose labels ("light," "dark," "gold," "Jamaican") with categories based on **how a rum is made** [1]. The system combines several axes:

1. **Still type / production:** *pot still*, *column still*, *blended* (pot and column distillate combined), and, for fresh-cane-juice spirits, *cane* categories (for example Coffey-still or pot-still cane spirits, and **AOC Martinique rhum agricole**).
2. **Age:** *unaged*, *lightly aged*, *aged* and *long aged*.
3. **Special treatments:** *black* rums (heavily colored or sweetened with caramel or molasses) and *overproof* bottlings.

This gives categories such as **Pot Still Unaged**, **Pot Still Lightly Aged**, **Blended Lightly Aged**, **Blended Aged**, **Pot Still Aged**, **Blended Long Aged**, **Black Blended**, **Black Pot Still**, **Black Blended Overproof**, **Cane AOC Martinique Rhum Agricole Blanc/Vieux**, and others. See the book for the full list and the age boundaries. Each recipe calls for a *category*. Any good rum in that category will work, so a recipe no longer depends on one brand that may disappear, which is exactly what happened with Wray & Nephew 17 [1].

A second, producer-led scheme is the **Gargano classification**, promoted by Velier's Luca Gargano and Foursquare's Richard Seale. It sorts rum by still type and distillery: *Pure Single Rum* (pot still, one distillery), *Single Blended Rum* (pot plus column from one distillery), and column-still categories. It is used widely in rum-geek circles and fits well with the Cate categories.

**Practical blending heuristics (heuristic, drawn from the classic specs):**
- Pair a **clean** rum with a **characterful** one. A drink whose rum is all high-ester Jamaican can overwhelm delicate modifiers. A drink with only light column rum usually needs spice or a float to feel "tiki."
- Use **overproof rum as an accent** (¼–1 oz), not as the base, unless the drink is built around it.
- **Black rums** add color and molasses. Use them at up to about half the rum, or as a float.
- **Agricole** brings dryness and a green note. It pairs especially well with orgeat and curaçao (Mai Tai) and with falernum.
- **Total rum** in the classic Beachcomber drinks runs 2–4 oz per serving. Crushed ice and blending bring it back to drinkable strength.

---

## 3. Fresh citrus and the sweet–sour balance

### 3.1 Citrus as a palette

| Juice | Approx. acid (g/100 ml) | Approx. sugar (g/100 ml) | Role |
|---|---|---|---|
| Lime | ~6 | ~1.6 | The default tiki sour: sharp and aromatic |
| Lemon | ~6 | ~2 | Rounder; common in Vic's drinks and punches |
| Grapefruit | ~2.4 | ~7 | Bitter-citrus depth; a **Donn Beach signature** (Navy Grog, Don's Mix) |
| Orange | ~0.9 | ~10 | Sweetness and body more than sourness |
| Pineapple | ~0.8 | ~10 | Body, tropical aroma and **foam** when shaken or blended |
| Passion fruit (juice) | ~3.5 | ~10 | Very aromatic; tart and sweet at once |

*(Values follow this project's `data/ingredients.json`, which uses Dave Arnold's tables [8] where available.)*

Two consequences:
- **Grapefruit, orange and pineapple juice are both sour *and* sweet, and they are also the "weak."** A drink with 1 oz pineapple needs less syrup and less water.
- **Lime does nearly all the acid work.** Most classic tiki drinks contain ½–1 oz of lime (or lemon) per serving whatever else is in them (heuristic).

### 3.2 Freshness

Donn and Vic squeezed juice to order or daily, and the revival of fresh juice was the basis of the modern comeback [1][2]. Lime juice changes within hours of squeezing. Some bartenders, Arnold among them, find it at its best a few hours after juicing, and after about a day it goes flat and bitter [8]. Bottled lime and pre-made **sour mix** were the most damaging shortcut of the decline era (see [`history.md`](history.md) §5).

### 3.3 Balance targets

- A balanced tiki sour usually has **roughly equal volumes of citrus and 1:1-equivalent sweetener** once you count the sugar in liqueurs and juices (heuristic). Rich (2:1) syrups, honey and cream of coconut deliver more sugar per ounce, so they need smaller volumes.
- Sweet liqueurs, such as orange curaçao, falernum (Velvet Falernum is about 11% ABV and fairly sweet) and allspice dram, belong in the *sweet* slot even though they also add flavor. Many classic drinks have no plain syrup at all and are sweetened entirely by modifiers.
- **Cold suppresses the perception of sweetness.** Crushed-ice and frozen drinks need more sugar than a straight-up sour made from the same recipe [8]. Resort bars pushed this principle too far (§9).
- Dilution after shaking or blending brings a tiki drink to roughly the ABV of a strong glass of wine or lower. This project's analysis of the catalog puts the median at about 11–12% ABV after dilution (see `docs/analysis.md`).

---

## 4. Layering: the "secret ingredient" philosophy

The distinctive thing about a Beachcomber drink is **many small modifiers, none of them identifiable on its own** [2][15]:

- Each flavoring element appears in **small doses**: ¼–½ oz of a syrup or liqueur, a teaspoon of grenadine, a dash of bitters, 6 drops of Pernod.
- Pairs are chosen to **fuse into a new flavor**. Grapefruit and cinnamon become "Don's Mix." Vanilla and allspice become "Spices #2." Honey, butter, vanilla, cinnamon and allspice become "Gardenia Mix." Lime, clove, ginger and almond make falernum [13][14][15].
- The mixes were **pre-batched and code-named**, so the "secret" lived in the pre-mix rather than in the bartender's head [15][16].

| Don's pre-mix | Decoded composition (Berry) | Flavor effect |
|---|---|---|
| Don's Mix | 2 : 1 grapefruit juice : cinnamon syrup [13] | Warm, bitter-sweet citrus; the "secret" of the 1934 Zombie |
| Spices #4 | Cinnamon syrup [15][16] | Warm spice sweetener |
| Spices #2 | 1 : 1 vanilla syrup : allspice dram [15] | Baking-spice sweetness |
| Gardenia Mix | Butter, honey and spice syrups/liqueur [14][15] | Rich, creamy honey; used in the Pearl Diver |

**Why it works.** Small amounts of several aromatic sweeteners give a rounder, more "perfumed" sweetness than the same total sugar from one source. Overlapping spice notes (cinnamon, allspice, clove, vanilla, anise) read as one "tropical spice" chord. The drinker gets complexity without being able to name any single ingredient, which was a large part of the mystique [2].

**For generation (heuristic):** think in **house blends**. A new drink can use a named two- or three-part pre-mix (grapefruit–cinnamon, passion fruit–vanilla, pineapple–allspice) as one ingredient. That keeps the recipe readable while preserving the layered effect.

---

## 5. Spice syrups and liqueurs: the tiki pantry

| Ingredient | What it is | Origin and history | Typical dose | Pairs with |
|---|---|---|---|---|
| **Falernum** | Lime zest, ginger, clove and almond, as a low-proof liqueur (e.g., John D. Taylor's Velvet Falernum) or a syrup | Barbados, 19th century; the name's origin is unclear | ¼–½ oz | Lime, all rums, pineapple; Zombie, Test Pilot, Cobra's Fang |
| **Allspice (pimento) dram** | Rum infused with Jamaican allspice berries and sweetened | Jamaica; gone from the U.S. market for decades until **St. Elizabeth Allspice Dram (Haus Alpenz) in 2008** | ¼ oz or less, or dashes (very potent) | Demerara rum, lime, honey; Don's Spices #2, Lion's Tail |
| **Cinnamon syrup** | Sugar syrup infused with cinnamon (cassia) | Don's "Spices #4" | ¼–½ oz | Grapefruit (Don's Mix), Demerara, vanilla |
| **Vanilla syrup** | Sugar syrup with vanilla | Don's Spices #2 and Gardenia | ¼ oz | Allspice, pineapple, aged rum |
| **Orgeat** | Almond syrup, often with orange-flower water | French and Mediterranean (originally a barley-almond drink); in American cocktails since the 19th century; the Mai Tai's key sweetener (Garnier orgeat in 1944) | ¼–½ oz | Curaçao, agricole, Jamaican rum, lime |
| **Passion fruit syrup** | Passion fruit and sugar | Hawaiian *lilikoʻi*; the Hurricane (New Orleans, 1940s) and many Hawaiian-era drinks | ½–1 oz | Lime, lemon, dark rum, vanilla |
| **Grenadine** | Pomegranate syrup (French *grenade*) | 19th-century French and American bars; by mid-century mostly artificial red syrup; real pomegranate grenadine is back in craft bars | 1 tsp–½ oz | Color and tart-fruit accent; Zombie, Planter's Punch |
| **Honey** | Usually a 1:1 "honey mix" (honey thinned with water) | Don's Navy Grog and Gardenia Mix | ½–1 oz | Grapefruit, lime, Demerara, allspice |
| **Rock candy / demerara / simple syrup** | Plain sweeteners at 1:1 or 2:1 | Vic's rock candy syrup in the 1944 Mai Tai | ¼–½ oz | Everything |
| **Orange curaçao** | Orange-peel liqueur on a brandy or neutral base | Dutch Caribbean origins; Holland DeKuyper in Vic's Mai Tai | ½ oz | Orgeat, lime, aged rum |
| **Maraschino** | Marasca cherry liqueur | Floridita Daiquiris (Hemingway) | 1 tsp–¼ oz | Grapefruit, lime, light rum |
| **Fruit brandies and liqueurs** | Apricot, peach, cherry, banana | Vic and Don used them as accents | ¼–½ oz | Aged rum, lemon |
| **Cream of coconut** | Sweetened coconut cream (Coco López) | Puerto Rico, mid-20th century; Piña Colada and Painkiller | 1–2 oz | Pineapple, orange, nutmeg, dark rum |
| **Fassionola** | Mid-century commercial red (and other-colored) tropical fruit syrup of disputed composition | Used in some Don-era and Hurricane recipes (e.g., Cobra's Fang) | ½ oz | Passion fruit, lime; recreated by craft producers |

*(Sources: [1][2][3][5][13][14][15][16][18].)*

---

## 6. Bitters and anise as seasoning

Tiki recipes use **Angostura bitters** and **anise** (Pernod, Herbsaint, pastis or absinthe) in the way a cook uses salt and pepper [2][1]:
- A **dash of Angostura** adds cinnamon, clove and gentian bitterness, keeps multiple sweeteners from tasting flat, and ties spice syrups to the rum.
- **Drops of anise**, for example the 6 drops of Pernod in the 1934 Zombie, sit below the threshold of recognition. They lift the aromatics and link cinnamon, allspice and clove notes, without the drink tasting of licorice [20].
- Modern bars add **tiki bitters** (allspice and cinnamon heavy), **mole bitters**, and **saline** (a few drops of salt solution to sharpen fruit).

**Heuristic:** almost every "spicy" Beachcomber drink has at least one of these seasonings, and they are measured in **dashes and drops, never ounces**.

---

## 7. Fruit juices as body

Non-citrus juices and fats give tiki drinks their **long, round texture**:
- **Pineapple juice** adds body, a silky **foam** when shaken or blended, and a tropical top note. It is the most common non-citrus juice in the genre.
- **Orange juice** mainly adds sweetness and volume. It is a mark of the later resort style.
- **Guava, mango and papaya nectars** add thick body and sweetness (the Hawaiian and resort line).
- **Cream of coconut and coconut milk** add fat and sweetness, which carry nutmeg and dark rum (Piña Colada, Painkiller).
- **Soda water, ginger beer and sparkling wine** lengthen and lighten (Navy Grog's splash of soda, the Suffering Bastard, royal-style punches).
- **Honey and butter** (Gardenia Mix, Hot Buttered Rum) add weight and a creamy finish.

**Heuristic:** the more juice a drink contains, the less added sugar and water it needs, and the more strong-flavored rum it can carry.

---

## 8. Ice, dilution and technique

### 8.1 Crushed ice and flash blending

Tiki drinks are **ice-heavy on purpose**. They were built for hot climates and slow sipping, with 2–4 oz of rum that needed taming [1][2]:
- **Flash blending.** Donn used electric **spindle mixers**, the milkshake-style stand mixer that spins from the top. Stand mixers came into cocktail use in the 1920s and dominated until the **Waring blender** arrived in the late 1930s [12]. The drink goes into the mixer cup with crushed ice and runs for **only a few seconds (about 3–5)**. This aerates, chills and dilutes the drink without pulverizing the ice [12].
- **Open pour.** After flash blending, or after shaking with crushed ice, the whole contents (ice included) are **dumped unstrained** into the glass. Smuggler's Cove-style recipes use this method widely [1].
- **Shaking with crushed or shaved ice** is the home substitute and was Vic's method for the Mai Tai: shaken with shaved ice, then poured [18].
- **Swizzling** (Caribbean): the drink is built in the glass over crushed ice and churned with a *bois lélé* swizzle stick until the glass frosts (Queen's Park Swizzle).
- **Ice cone:** for Don's Navy Grog, shaved ice was molded into a cone around the straw. It melts slowly and looks dramatic.
- **Full blending (frozen):** blended with lots of ice into slush. This is the Floridita frozen Daiquiri and the later resort drink. It needs **more sugar**, because cold dulls sweetness, and gives the most dilution [8].

### 8.2 Dilution targets

Arnold's measurements show that shaking chills and dilutes quickly, while crushed-ice methods add even more water through their larger ice surface [8]. This project's analysis models extra dilution for crushed-ice shaking, swizzling and flash blending (see `docs/analysis.md`). **Heuristic:** a flash-blended or crushed-ice drink should taste *slightly too strong and too sweet* before dilution. That is how the tiki specs with high spirit ratios manage to be balanced in the glass.

### 8.3 Garnish as flavor

Mint (smelled at the nose on every sip), grated nutmeg, cinnamon and a flamed lime shell are **part of the drink's aroma**, not decoration. The Mai Tai's mint sprig and the Painkiller's nutmeg are essential to how they taste [1][18].

---

## 9. How the formula evolved

| Stage | What changed | Result |
|---|---|---|
| **Punch → Planter's Punch** (17th–19th c.) | Spirit + citrus + sugar + water + spice, codified as 1:2:3:4 | The balance template [9][17] |
| **Havana precision** (1910s–30s) | Light rum, lime and sugar measured exactly; blender-frozen Daiquiris; maraschino and grapefruit accents | Elegance and consistency |
| **Don's formula** (1934–1940s) | Planter's Punch **multiplied**: several rums, several citrus juices, several spice sweeteners in small doses, seasoning by the drop, flash blending, coded pre-mixes | Complex, mysterious, strong "rhum rhapsodies" [2] |
| **Vic's streamlining** (1937–1950s) | Fewer ingredients; one great rum or a purpose-built blend; house syrups (orgeat, rock candy) that could be **bottled and standardized** for a chain | The Mai Tai: a five-ingredient rum sour that shows off the rum [18] |
| **Resort drift** (1950s–1980s) | Hawaiian hotels and cruise lines added **pineapple and orange juice, dark-rum floats, blue curaçao and grenadine**; bars moved to **premixes, sour mix and blenders**; rums got lighter and cheaper; garnishes grew | Sweeter, weaker, juicier "umbrella drinks" [19] |
| **Craft rebalancing** (1998–2010s) | Berry decoded original specs; fresh juice; measured pours; homemade and craft syrups; rum by category (Cate); proper crushed ice and flash blending | Drier, stronger, more aromatic drinks close to the originals [1][2][3] |
| **Tropical modernism** (2010s–) | Precise sugar and acid, acid-adjusted juices, clarification, shelf-stable versions of the classic mixes (e.g., extract-based Don's Mix), systematic rum substitution, less reliance on Polynesian imagery | Consistent, lighter-textured drinks and new flavor families [7][13] |

---

## 10. Recurring ratios and rules of thumb

**Ratios cited by sources:**
1. **Punch rhyme:** 1 sour : 2 sweet : 3 strong : 4 weak (mnemonic). The 1908 NYT version is 2 : 1½ : 3 : 4 [17].
2. **Trader Vic's 1944 Mai Tai** (Vic's own account): 2 oz 17-year Jamaican rum, juice of one lime (about ¾–1 oz), ½ oz orange curaçao, ½ oz orgeat, ¼ oz rock candy syrup, shaken with shaved ice [18]. That is 2 : ~1 : ~1¼ (strong : sour : sweet-modifiers). Modern craft Mai Tais stay close to it, often trimming the orgeat to ¼ oz.
3. **1934 Zombie** (Berry decode): about 4 oz of mixed rums against ¾ oz lime, ½ oz Don's Mix, ½ oz falernum and 1 tsp grenadine, seasoned with Angostura and Pernod, flash-blended [20]. This shows how much rum crushed-ice dilution can carry.
4. **Don's Mix:** 2 parts grapefruit to 1 part cinnamon syrup [13].
5. **Spices #2:** 1 : 1 vanilla syrup to allspice dram [15].

**Practitioners' rules:**
- **Cate / Smuggler's Cove:**
  - Specify rum by **category**, not brand.
  - Squeeze citrus **fresh**.
  - **Measure** everything.
  - Use **crushed ice** and **flash blending or open pouring** where the recipe calls for it.
  - Treat **garnish** as aroma [1][12].
- **Berry:**
  - Respect the **original proportions**. Many "tiki drinks" people dislike are later corruptions.
  - Don's complexity came from **combinations of small amounts**, not from any exotic single ingredient [2][3].
- **Vic:** a good tropical drink should **showcase good rum** rather than bury it. The Mai Tai was built around one excellent aged rum [18][6].
- **Richard & Wald:**
  - Treat classic tropical recipes as **systems of sugar, acid, dilution and aroma** that can be rebuilt with modern precision.
  - Reformulate secret mixes for **consistency and shelf stability** [7][13].
- **Arnold:**
  - **Temperature and dilution change perceived sweetness and strength.**
  - Colder, more diluted drinks need proportionally more sugar and acid to taste balanced [8].

**Project heuristics (for generation):**
- Keep the **citrus slot at ½–1 oz lime-equivalent acid** per single serving. Count grapefruit and pineapple as partial acids.
- Build the sweet slot from **two to four modifiers** (for example ¼ oz falernum + ¼ oz cinnamon + ½ oz honey) rather than one syrup.
- Use **two or three rums** from different roles in §2.1. At least one should add character (funk, richness or grass).
- Add **one seasoning** (dash of Angostura, drops of anise, or saline).
- Match technique to texture:
  - **Flash-blend or shake with crushed ice** for long drinks with juice.
  - **Shake and strain** for short, spirit-forward sours.
  - **Swizzle** for built drinks.
- Garnish with **aromatics** (mint, nutmeg, cinnamon, citrus oils) chosen to echo an ingredient inside the drink.

---

## 11. Ingredients then and now

### 11.1 What disappeared or changed

| Historical ingredient | What happened | Modern stand-in (project ID) |
|---|---|---|
| **J. Wray & Nephew 17-year** (Vic's 1944 Mai Tai rum) | Ran out in the 1940s. Vic moved to the 15-year and then to blends. A few bottles surfaced in 2004. Appleton issued a limited "17 Year Old Legend" (2018) inspired by it | A **blended aged** rum, or Jamaican pot-still aged rum plus a little agricole (`rum-jamaican-aged` + `rum-agricole-vieux`) [18][19] |
| **Bacardi 151** | Discontinued in the U.S. in **2016** | Other white or gold overproof rums (`rum-overproof-white`); OFTD-style blends if a dark overproof suits the drink |
| **Lemon Hart 151** (Demerara overproof; the Zombie's accent) | Supply to the U.S. was interrupted in the early 2010s; the brand has since reappeared in some markets | **Hamilton 151 Demerara**, Lemon Hart where available (`rum-demerara-overproof`) |
| **Pimento (allspice) dram** | Effectively unavailable in the U.S. for decades | **St. Elizabeth Allspice Dram** (2008) and others (`allspice-dram`) |
| **Rhum St. James** and other Martinique rums of Vic's era | Always available in France, patchy in the U.S. for years | Widely distributed agricole (Clément, J.M, Neisson, Saint James) (`rum-agricole-*`) |
| **"Gold Puerto Rican" and "Cuban" rums of the 1930s** | Styles have changed; Cuban rum is embargoed in the U.S. | Light or gold column rums from Puerto Rico, the Virgin Islands and elsewhere (`rum-gold-column`) |
| **Fassionola, Don's pre-mixes, Garnier orgeat** | Discontinued, secret or unrecorded | Homemade or craft recreations (`dons-mix`, `dons-spices-2`, `gardenia-mix`, `orgeat`) |
| **Real grenadine** | Replaced by artificial syrups from the mid-century | Pomegranate-based grenadine (homemade or craft brands) (`grenadine`) |
| **Fresh citrus** | Replaced by sour mix in the decline era | Fresh lime, lemon and grapefruit (`lime`, `lemon`, `grapefruit`) |

### 11.2 What's now easy to get

- **Velvet Falernum** (John D. Taylor's, Barbados; about 11% ABV) (`velvet-falernum`).
- **St. Elizabeth Allspice Dram** (`allspice-dram`).
- **Quality orgeat** from several craft producers, plus easy homemade versions (`orgeat`).
- **Passion fruit syrups and frozen purées** (`passion-fruit-syrup`, `passion-fruit-juice`).
- **Hamilton rums**, Ed Hamilton's line of Jamaican, Demerara and other rums, including 151 Demerara and, from **2021**, a **Zombie blend created with Jeff Berry** [21].
- **Smith & Cross** navy-strength Jamaican pot-still rum (Haus Alpenz, **2009**), a benchmark for Jamaican funk.
- **Planteray (formerly Plantation) O.F.T.D.**, a dark overproof blend (about 69% ABV) of Guyanese, Jamaican and Barbadian rums launched in **2016** with input from tiki bartenders and historians. The brand renamed itself from Plantation to **Planteray** (renaming announced 2020, new name 2023, rollout 2024).
- **Rhum agricole** of every age.
- **Dry curaçao** (e.g., Pierre Ferrand Dry Curaçao) for the Mai Tai.
- **Cream of coconut** (Coco López and others) (`coconut-cream`).
- **Tiki and mole bitters** (`tiki-bitters`, `mole-bitters`) in addition to Angostura.

**Takeaway for generation.** Nearly everything the golden-age bartenders used can now be bought or made in a few minutes. The only true losses are specific old rums, and the rum categories exist to replace those.

---

## 12. Checklist for a new tiki drink (heuristic)

1. **Pick a lineage:** punch/Planter's, grog, Zombie-style complexity, Mai Tai-style restraint, swizzle, cream/colada, or bowl.
2. **Choose rums by role:** backbone + character (+ accent).
3. **Set the sour:** lime-led, optionally with grapefruit or pineapple.
4. **Layer the sweet:** two to four modifiers, at least one aromatic spice (falernum, allspice, cinnamon, vanilla) or nut (orgeat).
5. **Season:** bitters, anise or saline.
6. **Add body if long:** pineapple, passion fruit, coconut, soda.
7. **Choose the technique and ice:** flash blend or open pour, swizzle, or shake and strain.
8. **Garnish for aroma:** mint, nutmeg, citrus oils, or a flamed lime shell for theater.
9. **Name and serve with intent:** keep the escapism and theater, and avoid sacred or stereotyped imagery (see [`history.md`](history.md) §7).

---

## Sources

1. Martin and Rebecca Cate, *Smuggler's Cove: Exotic Cocktails, Rum, and the Cult of Tiki* (Ten Speed Press, 2016).
2. Jeff Berry, *Beachbum Berry's Sippin' Safari* (SLG Publishing, 2007).
3. Jeff Berry, *Beachbum Berry Remixed* (Club Tiki Press, 2010).
4. Jeff Berry, *Beachbum Berry's Grog Log* (1998) and *Intoxica!* (2002).
5. Jeff Berry, *Potions of the Caribbean* (Cocktail Kingdom, 2013).
6. Victor Bergeron, *Trader Vic's Bartender's Guide* (1947; revised 1972).
7. Garret Richard and Ben Wald, *Tropical Standard: Cocktail Techniques & Reinvented Recipes* (Harper Design, 2023).
8. Dave Arnold, *Liquid Intelligence: The Art and Science of the Perfect Cocktail* (W. W. Norton, 2014).
9. David Wondrich, *Punch: The Delights (and Dangers) of the Flowing Bowl* (Perigee, 2010).
10. Wayne Curtis, *And a Bottle of Rum* (Crown, 2006; rev. 2018).
11. Shannon Mustipher, *Tiki: Modern Tropical Cocktails* (Rizzoli, 2019).
12. *Punch*, "How to 'Flash Blend' Your Way to a Better Frothy Drink" (quoting Martin Cate on spindle mixers and the 1938 Waring blender). https://punchdrink.com/articles/flash-blend-way-better-frothy-drink/
13. *Punch*, "Should Don's Mix Not Be a Mix At All?" (Garret Richard's extract-based Don's Mix), https://punchdrink.com/articles/diy-dons-mix-cocktails-recipe/ ; "How to Make Better Don's Mix," https://punchdrink.com/articles/dons-mix-zombie-cocktail/
14. *Punch*, "Rediscovering Don's 'Other' Essential Tiki Mix" (Gardenia Mix). https://punchdrink.com/articles/rediscovering-don-the-beachcomber-gardenia-mix-pearl-diver-tiki-cocktail-recipe/
15. The Lost Tiki Lounge, "A Definitive Guide to Don's Mix, Spices #2, #4 & Gardenia." https://thelosttikilounge.com/ingredients/dons-secret-recipes/
16. *Imbibe*, "Don the Beachcomber's Nui Nui." https://imbibemagazine.com/recipe/don-the-beachcombers-nui-nui-cocktail/
17. Planter's Punch verses: Vintage American Cocktails, "Planter's Punch #1 – Original 1878 Recipe," https://vintageamericancocktails.com/planters-punch-original/ ; Forgotten Cocktails, "Jasper's Jamaican Planter's Punch" (1908 NYT verse), https://forgottencocktails.com/jaspers-jamaican-planters-punch/ ; Wikipedia, "Planter's punch," https://en.wikipedia.org/wiki/Planter's_punch
18. Trader Vic's, "History of the Mai Tai," https://tradervics.com/pages/history-of-the-mai-tai ; *Distiller*, "The Original 1944 Mai Tai," https://distiller.com/articles/original-1944-mai-tai-recipe ; Difford's Guide, "Mai Tai (Trader Vic's)," https://www.diffordsguide.com/encyclopedia/1257/cocktails/mai-tai-cocktail-and-its-history
19. Kevin Crossman, *The Search for the Ultimate Mai Tai*, "History of the Mai Tai" and "The (De)Evolution of the Hawaiian Mai Tai." https://ultimatemaitai.com/about/history/ ; https://ultimatemaitai.com/about/history/deevolution-hawaiian-mai-tai/
20. Jeff Berry, "How to make a Zombie." https://beachbumberry.com/recipe-zombie.html ; Wikipedia, "Zombie (cocktail)," https://en.wikipedia.org/wiki/Zombie_(cocktail)
21. *HeraldNet*, "He cracked the Zombie code. Now he has his own Zombie rum," https://www.heraldnet.com/life/he-cracked-the-zombie-code-now-he-has-his-own-zombie-rum/ ; *Bloomberg*, "Zombie Rum Is Here to Reanimate Your Tiki Cocktail Recipes" (2021), https://www.bloomberg.com/news/articles/2021-06-25/zombie-rum-is-here-to-reanimate-your-tiki-cocktail-recipes
22. Bill Stott, "Architecture of the Cocktail: 'What one rum can't do, three rums can'" (on the attributed Donn Beach maxim). https://www.eastportlandblog.com/2020/12/28/architecture-of-the-cocktail-what-one-rum-cant-do-three-rums-can-by-bill-stott/

### Verification notes

Page fetching was blocked while this was written, and the shared web-search budget ran out. The following were checked against search results:
- the decoded Don's mixes (Don's Mix 2:1; Spices #2 and #4; Gardenia);
- Richard's extract-based Don's Mix;
- the flash-blending history (spindle mixers from the 1920s; Waring in 1938; 3–5 seconds);
- the 1944 Mai Tai ingredients and the W&N 17 story;
- the Royal Hawaiian pineapple dispute;
- the 1878 and 1908 punch verses;
- the 2021 Berry–Hamilton Zombie rum.

**Spot-check before relying on them:**
- the Smuggler's Cove category names and age boundaries (quote from the book directly);
- product dates: St. Elizabeth 2008, Smith & Cross 2009, OFTD 2016 and its ABV, the Bacardi 151 discontinuation in 2016, the Lemon Hart supply gap, Appleton 17 Legend 2018, the Planteray renaming timeline, and Velvet Falernum's ABV;
- the Gargano classification labels;
- Arnold's statements on lime-juice aging.
