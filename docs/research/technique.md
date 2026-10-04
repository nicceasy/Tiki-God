# Tiki technique, balance and the aficionado's red flags

A working reference for the Tiki God generator. It covers balance, method, pairing, garnish, the red flags an expert spots at a glance, and menu copy. It ends with a machine-readable rule block (section 11) written against the repo's own ids:

- ingredient ids from `data/ingredients.json`
- family ids from `data/families.json`
- vessel ids from `data/vessels.json`
- the project's flavor-tag vocabulary

**Confidence marks.** **[H]** means cross-checked against two or more independent sources, or against specs recorded in the repo catalogue with sources. **[M]** means widely repeated in the trade literature but checked against one source only. **[U]** means my estimate or an unresolved claim, to be treated as a tunable default and not as fact.

**Units.** Amounts are US fl oz per single serving unless stated. "Post-dilution" means what is in the glass after shaking, blending, swizzling or stirring: the numbers you drink. Sugar and acid are in g per 100 ml, using the repo's chemistry: lime is 6% acid, 1:1 simple syrup is 61.5 g sugar per 100 ml.

**How this was checked.** The research sandbox blocked page fetches and capped web searches. Claims were checked against:

- search-result summaries (Difford's, Punch, Imbibe, VinePair, Wikipedia-derived pages, ultimatemaitai.com, Atomic Grog, the Pusser's site)
- the repo's 1,070-drink catalogue (`data/drinks.json`), whose records carry their own sources (Berry, the Cates' *Smuggler's Cove*, Trader Vic's books, Death & Co, *Tropical Standard*, *Minimalist Tiki*, Mustipher)
- the repo's `data/model.json` statistics
- a fresh run of the generator battery (`scripts/review/battery.json`) against the last pre-WIP commit (`1de2045`). Its failures are catalogued in section 8 and drove the red-flag list.

---

## 0. The ten rules an aficionado actually applies (read this if nothing else)

1. **The name is a contract.** If a drink, its family label or its tagline says *colada*, *Mai Tai*, *Zombie*, *grog*, *swizzle*, *orgeat punch*, *daiquiri*, *flip* or *fizz*, the defining components must be in the glass at a tasteable dose, made by the defining method.
2. **Every ingredient has a job,** and two ingredients may not do the same job. A drink with eight things at a quarter ounce each is mud, not complexity. Donn Beach's complexity was a few small, *complementary* modifiers on a big rum-and-citrus frame.
3. **Fresh citrus, measured.** No sour mix, no bottled lime, no "sweet and sour." Lime is the default acid. Grapefruit is Don's second acid, and lemon is Vic's.
4. **Balance is judged after dilution and at serving temperature.** Crushed ice and flash blending add more water than a shaken-up sour gets, and cold dulls sweetness, so tiki specs read strong and sweet on paper. Colada-style drinks are barely acidic because fat does the balancing.
5. **Rum is chosen by job:** light for body, Jamaican for funk, Demerara for burnt sugar and smoke, agricole for grass. Overproof is a seasoning dose (¾–1 oz), never a pour.
6. **Accents go in by the drop and the dash:** anise in drops, Angostura in dashes, a teaspoon of grenadine in a Zombie. An ounce of absinthe, half an ounce of Fernet in a fruit drink, or an ounce of grenadine "for color" mark a writer who has never tasted the result.
7. **Method follows texture.** Shaking or flash-blending over crushed ice is for long tropical sours. Shake-and-strain is for short ones. Swizzling is built in the glass. Carbonation is never shaken. Stirred means no juice. Hot means no ice and no citrus juice.
8. **The vessel and the volume must agree.** A 3 oz drink does not go in a 20 oz hurricane, and a 10 oz drink does not go in a coupe.
9. **The garnish is aroma first and theater second, and it never lies.** Mint goes where the nose goes, nutmeg is grated fresh, and the spent lime shell sits on the Mai Tai. Nothing should signal a flavor that isn't in the drink.
10. **Fun is the point, and tacky is a failure of care, not of exuberance.** Umbrellas, orchids, fire and skull mugs are welcome. Neon "blue" that turns out swamp-green, cranberry-cocktail punches and a mint bush on a coupe are not.

---

## 1. Balance

### 1.1 The three numbers

A finished cocktail can be described by **ABV, sugar (g/100 ml) and titratable acid (g/100 ml)** after dilution, plus a trace of salt [H]. Dave Arnold's *Liquid Intelligence* is the source of this framing and of the reference point every other number calibrates against:

> **Classic Daiquiri** (2 oz white rum, ¾ oz lime, ¾ oz 1:1 simple), shaken: about **5¼ oz finished, 15% ABV, 8.9 g sugar, 0.85 g acid per 100 ml.** That is a sugar:acid weight ratio of about **10.5 : 1** [H]. I reproduced it from first principles: ¾ oz lime × 6% acid = 1.33 g acid, ¾ oz simple = 13.6 g sugar, in 3.5 oz pre-dilution with Arnold's shaken dilution of about 52% → 5.3 oz, 15.0%, 8.7 g, 0.84 g.

Arnold's empirical dilution curves (the repo's `web/lib/chem.js` uses exactly these). In each, `a` is the pre-dilution ABV as a fraction and the result is water added as a fraction of the pre-dilution volume [H]:

```
shaken  = −1.567·a² + 1.742·a + 0.203
stirred = −1.21·a²  + 1.246·a + 0.145
```

The negative quadratic term matters. With a positive sign the Daiquiri would come out at 6 oz, not Arnold's 5¼.

Arnold's qualitative findings [H/M]:

- Drinks made by the same method converge on the same ABV/sugar/acid window.
- **Blended drinks** have the lowest ABV, the highest dilution and a relatively high acid share.
- **Built drinks** (Old Fashioned) carry roughly twice the alcohol of blended drinks and essentially no acid.
- **Shaken drinks** are served at roughly 15–20% ABV.
- Vigorous shaking for about 12 s reaches roughly −5 to −8 °C with near-identical dilution whatever the ice.

### 1.2 Sugar : acid targets by family (post-dilution, weight ratio)

The first column below is this repo's weighted catalogue (interquartile range, from `data/model.json`). The second is the window I recommend the generator aim inside: the catalogue IQR, tightened toward the famous, well-documented specs. Sugar includes all sources (syrups, liqueurs, juices, cream of coconut). Acid is citric-equivalent from all sources.

| family | catalogue IQR | generate at | anchor classics |
|---|---|---|---|
| `daiquiri` | 7.9–13.5 | **7–11.5** | Daiquiri ~10.5; Hemingway ~5–7; frozen versions run sweeter, see §1.9 |
| `zombie` | 7.1–11.9 | **6.5–11** | 1934 Zombie ~8–9; Jet Pilot ~9 |
| `grog` | 8.2–11.8 | **7–12** | Don's honey Navy Grog ~10; Vic's allspice grog ~6 |
| `beachcomber-sour` | 8.8–12.7 | **8.5–13** | Three Dots ~11; Pearl Diver ~12 |
| `mai-tai` | 8.5–11.0 | **8.5–12** | Vic's 1944 ~10 |
| `orgeat-punch` | 5.6–12.0 | **6–11** | Fog Cutter ~4–5 (famously tart); Scorpion ~8 |
| `swizzle` | 9.6–14.9 | **8–14** | Queen's Park ~10 |
| `punch` | 8.7–14.1 | **8.5–14** | Planter's ~10–13 |
| `buck` | 8.0–15.2 | **8–16** | Dark 'n Stormy is acid-optional (ginger beer carries it) |
| `resort-punch` | 9.4–15.1 | **9.5–15** | Hurricane ~10; Rum Runner ~12 |
| `bitter-tiki` | 10.8–15.2 | **11–15.5** | Jungle Bird ~14; bitterness reads as "dry," so it tolerates more sugar |
| `colada` | 14.1–46.4 | **15–45** | Painkiller ~26; Hilton Piña Colada ~40; fat replaces acid |
| `stirred` | n/a | **acid < 0.15 g** | no citrus juice |
| `hot` | n/a | **acid < 0.15 g** | lemon peel and spice, not juice |

**Absolute concentrations (post-dilution) the generator should hold** [H for the sour band, which agrees with Arnold's Daiquiri and the catalogue; M/U for the rest]:

| style | acid g/100 ml | sugar g/100 ml |
|---|---|---|
| shaken or crushed tropical sour (daiquiri, mai-tai, beachcomber-sour, grog, zombie, swizzle, punch) | 0.55–0.95 | 5.5–10 |
| orgeat punch / Fog Cutter | 0.7–1.0 | 5.5–9 |
| bitter tiki | 0.5–0.75 | 7–9.5 |
| resort punch | 0.5–0.8 | 7–10 |
| buck / highball (carbonic acid adds perceived tartness) | 0.3–0.65 | 4.5–8 |
| colada | 0.1–0.45 | 8–11 |
| frozen (blended with ice) | 0.55–0.85 | 8.5–12 |
| stirred | 0–0.15 | 3–7 |
| hot | 0–0.15 | 3–7 |

### 1.3 Dilution by method

Water added as a fraction of the pre-dilution volume, at a typical tiki pre-dilution ABV of 20–28%.

| method (repo id) | ice | dilution | notes |
|---|---|---|---|
| `shake` | cubed, strained up | ~0.50–0.60 [H] | Arnold curve. 10–12 s hard shake |
| `shake` | crushed / pebble, open-poured | ~0.60–0.75 [M] | More surface area. Keeps melting in the glass. Repo models ×1.15 |
| whip shake | a few pebbles, strained over fresh crushed | ~0.35–0.5 [M] | Shake until the ice is gone. Frothier, less dilute |
| `flash-blend` | 12 oz crushed + 2–4 "agitator" cubes, 3–5 s | ~0.65–0.85 [M/U] | Aerates and frosts. Repo models ×1.3 of shaken |
| `swizzle` | crushed, built in glass | ~0.6–0.75 [U] | Ongoing melt, so serve at once. Repo ×1.2 |
| `blend` (frozen) | ice ≈ 1–1.5× liquid by volume | ice becomes the drink (~0.9–1.2) [M] | Push sugar up 20–50% |
| `stir` | cubed, strained up or onto a block | ~0.40–0.48 [H] | Arnold stirred curve |
| `build` | one large block/cube | ~0.15–0.25 at service, rising [M] | |
| `build` | cubes, highball | the mixer is the dilution, plus ~0.1–0.2 melt | |
| `muddle-build` | crushed/cubed | ~0.3–0.5 | Caipirinha |
| `hot` | none | the hot water/coffee is the dilution (1 part spirit : 2.5–4 hot liquid) | |

Practical rule [H, Berry/Cate]: a crushed-ice or flash-blended spec should taste slightly too strong and too sweet before dilution. That is how a 4 oz-rum Zombie lands at 15–17%.

### 1.4 ABV bands by style (post-dilution)

| family / style | ABV band | notes |
|---|---|---|
| `zombie` | 15–19% | The ceiling family. Never more than ~4 oz total rum or ~1 oz 151 per serving |
| `mai-tai` | 14.5–17% | |
| `daiquiri` (up) | 13–18% | Arnold's Daiquiri is 15% |
| `daiquiri` (frozen) | 9–14% | |
| `beachcomber-sour`, `grog`, `swizzle` | 12.5–17% | |
| `punch` | 11–15.5% | |
| `orgeat-punch` | 10.5–14.5% | Bowls toward the low end |
| `bitter-tiki` | 12–17% | The Trinidad Sour-type bitters-base outlier runs higher |
| `resort-punch` | 8.5–12.5% | |
| `buck` / highball | 8.5–12.5% | |
| `colada` | 7–12% | |
| `stirred` | 20–30% | |
| `hot` | 7–13% | |
| bowls (any family) | 9–14% per cup | Built to be drunk for an hour |
| "low ABV" request | ≤ 8% | Use fortified wine, liqueur bases, or 1 oz spirit lengthened |
| zero-proof | 0% | Still needs acid, sugar, body (tea, coconut, nectar), aroma and a little bitterness or spice |

**Strength ceilings** [H for Zombie; U for the numbers]:

- Ethanol per single serving ≤ **2.0 oz (≈60 ml)**, about the 1934 Zombie.
- Total spirit ≤ **4 oz**.
- Overproof (≥ 57%) ≤ **1 oz**, or **1.5 oz** only when it is the sole base of a small drink: Cobra's Fang-type, 151 Swizzle.
- More than one overproof in a drink is a red flag.
- Don's "only two to a customer" was marketing built on a real ceiling. The generator's "strongest drink you dare" should hit the Zombie, not exceed it.

### 1.5 Volume norms by vessel

The pre-dilution liquid should fill a **predictable fraction of the vessel**, depending on how it is iced:

- **crushed or cubed ice:** pre-dilution liquid ≈ 30–50% of capacity, because ice takes the rest
- **served up:** the *finished* volume ≈ 60–90% of capacity
- **hot:** 60–85% of capacity
- **frozen:** the blended volume (liquid plus ice) ≈ 80–100% of capacity

[M/U, derived from classic specs. Mai Tai: 4¼ oz in a 14 oz DOF. Zombie 1934: ~5.9 oz in a 13½ oz chimney, topped with cubes. Navy Grog: 6¼ oz in a DOF around the cone. Painkiller: 8 oz in a 12–16 oz tin. Daiquiri: 3½ oz → 5¼ oz in a 7 oz coupe.]

| vessel id | cap oz | service | pre-dilution liquid oz (single) |
|---|---|---|---|
| `coupe` | 7 | up / Beachcomber's Gold ice shell | 2.75–4 |
| `nick-nora` | 5 | up | 2–3 |
| `cocktail-glass` | 6 | up | 2.5–3.5 |
| `rocks` | 8 | large cube / built | 2–3.5 |
| `dof` | 14 | crushed or cubes | 3.75–7 |
| `highball` | 10 | cubes, built | 3.5–6 (incl. mixer) |
| `collins` | 13 | cubes or crushed | 4–7 |
| `chimney` | 13.5 | crushed, topped with cubes | 5–7 |
| `hurricane` | 20 | crushed / cubes / frozen | 6–10 |
| `poco-grande` | 12 | frozen or crushed | 4–6 liquid (+ ice when frozen) |
| `footed-pilsner` | 12 | crushed | 3.5–6 |
| `pearl-diver` | 12 | crushed | 3.5–6 |
| `snifter` (tiki snifter) | 20 | crushed / cubes | 5–9 |
| `tulip` | 11 | crushed | 3.5–5.5 |
| `goblet` | 12 | crushed / frozen | 3.5–6 |
| `flute` | 7 | no ice; sparkling top | 4–6 |
| `irish-coffee` | 8 | hot / no ice | 5–7 |
| `julep-cup` | 11 | crushed | 3–5 |
| `copper-mug` | 14 | cubes | 5–8 |
| `enamel-tin` | 12 | cubes | 5–8 |
| `ku-mug` | 14 | crushed | 4–7 |
| `moai-mug` | 16 | crushed | 5–8 |
| `skull-mug` | 12 | crushed | 3.5–6 |
| `barrel-mug` | 16 | crushed | 5–8 |
| `fog-cutter-mug` | 20 | crushed | 6–9 |
| `bird-mug` | 12 | crushed / cubes | 3.5–6 |
| `coconut` | 12 | crushed | 4–7 |
| `pineapple` | 20 | crushed | 6–10 |
| `clay-cup` | 7 | crushed / cube | 2.5–3.5 |
| `hot-mug` | 10 | hot | 6–8.5 |
| `tiki-bowl` | 32 | crushed, 2–3 servings | 10–20 total |
| `volcano-bowl` | 40 | crushed, 2–4 servings + fire well | 14–24 total |
| `scorpion-bowl` | 64 | crushed, 3–6 servings | 18–40 total |
| `punch-bowl` | 120 | one large block, 8–16 cups | 40–90 total |

### 1.6 How fruit, fat and liqueurs move the balance

Computed from the repo's ingredient table and expressed as **simple-syrup equivalents** (oz of 1:1 syrup with the same sugar) and **lime equivalents** (oz of lime with the same acid), per oz of ingredient:

| ingredient id | ≈ simple-eq | ≈ lime-eq | what it really does |
|---|---|---|---|
| `pineapple-juice` | 0.16 | 0.13 | Body, aroma, foam. Tastes sweeter than its sugar because of aroma. Large doses go flabby unless lime backs them up |
| `orange` | 0.16 | 0.15 | Body, color, roundness. Dulls a short sour above ~1 oz. Turns bitter within hours of squeezing |
| `grapefruit` | 0.11 | 0.40 | A real second acid with bitterness. White grapefruit is Don's |
| `passion-fruit-juice` (purée) | 0.16 | **0.58** | Very acidic (pulp titratable acidity ~3–4.5% citric [H]). Cut the lime when you use it |
| `passion-fruit-syrup` | 0.89 | 0.25 | Sweetener plus some acid |
| `passion-fruit-nectar` | 0.21 | 0.13 | Sweetened juice: body, little acid |
| `guava-nectar`, `mango-nectar`, `papaya-nectar` | 0.21–0.23 | 0.03–0.07 | Thick, sweet, nearly acid-free. Needs lime |
| `coconut-cream` (sweetened cream of coconut) | 0.89 | 0 | Sugar plus fat. Fat mutes acid and alcohol, which is why coladas run at sugar:acid 15–45 |
| `coconut-milk` (unsweetened) | 0.03 | 0 | Fat only. Swapping it for cream of coconut without adding sugar gives a thin, sour drink |
| `heavy-cream`, `half-and-half` | ~0.05 | 0 | Fat/protein. See curdling, §2.10 |
| `orgeat` | 1.06 | 0 | Sweet plus almond plus a milky haze |
| `velvet-falernum` | 0.49 | 0 | Half a syrup, with lime-zest and clove perfume |
| `orange-curacao` | 0.33 | 0 | Sweet-dry orange. `triple-sec` is 0.41 |
| `allspice-dram` | 0.41 | 0 | Potent. Doses are ¼ oz and rarely more |
| `maraschino` | 0.57 | 0 | Funky cherry-almond. ¼–½ oz |
| `campari` | 0.39 | 0 | Sweet *and* bitter. Bitterness lets a drink carry more sugar |
| `grenadine` | 0.89 | 0.13 | Sweetener and red color. In a Zombie it is a 1 tsp seasoning |
| `honey-syrup` | 0.94 | 0 | Rounder, floral. Don's "honey mix" is 1:1 |
| `rich-simple`, `demerara-syrup` | 1.43 | 0 | 2:1 syrups. Use ⅔ of the 1:1 volume |
| `ginger-beer` | 0.16 | 0.02 | Sweet, low acid. Buck sugar:acid can run higher |
| `lime-cordial` | 0.49 | 0.42 | Sweet-sour. A legitimate ingredient (Berry's Suffering Bastard) but not a citrus substitute |

Rules that follow:

- **Count all sugar, not just syrups.** Many classics have no plain syrup at all: they are sweetened by curaçao, falernum and orgeat (Mai Tai) or by juice and cream of coconut (Painkiller). A generator that adds a syrup "because sours have syrups" over-sweetens.
- **Pineapple drinks still need lime.** Modern Jungle Bird runs 1½ pineapple to ½ lime. The 1973 original ran 4 oz pineapple to ½ lime and was a long welcome drink at ~8–10% ABV [H]. Keep **pineapple ≤ 3× lime** in non-colada sours.
- **Passion fruit purée replaces lime.** 1 oz purée plus 1 oz lime is over-tart.
- **Coconut fat tolerates and wants a lower acid share.** Colada acid is 0.1–0.45 g. A full ounce of lime in a colada reads sour and can split the coconut. Coconut *in a sour* (a coconut daiquiri or coconut Mai Tai riff) should keep sour-level acid, roughly ½ oz cream of coconut against ¾ oz lime.
- **Liqueurs sweeten.** More than ~1½ oz total sweet liqueur in a single drink is cloying unless the drink is liqueur-based by design (Rum Runner, Chartreuse Swizzle).

### 1.7 Salt and saline

- **Saline** is a 20% w/v salt solution (repo id `saline`). Add 2–6 drops per drink, roughly 0.02–0.06 g salt [H on practice; M on dose].
- **What it does:** suppresses bitterness (Campari, grapefruit, amaro), brightens fruit, rounds coconut and chocolate, and lifts stirred drinks.
- **Precedent.** *Tropical Standard* puts 5 drops in nearly everything (Navy Grog, Piña Colada, Frozen Banana Daiquiri, Royal Hawaiian Mai Tai) [H, repo catalogue].
- It is never "tasted as salt." If the drink tastes salty, it is wrong.
- Skip it when `li-hing-mui-syrup` or salted ingredients are present.

### 1.8 When a drink needs more acid, and when it needs less

**More acid** (add lime in ¼ oz steps, or swap orange for grapefruit) when:

- post-dilution acid falls below the family floor, or sugar:acid rises above the family ceiling
- nectars, cream of coconut (outside a colada), banana or sweet liqueurs exceed ~1 oz in total
- the base is black, spiced or blackstrap rum, which tastes sweet without sugar
- the drink is long and juicy (resort punch). Acid of ~0.5 g still has to survive the juice
- it is frozen. Keep acid at 0.55–0.85 g even while sugar rises, or the slush tastes like a melted popsicle

**Less acid** when:

- it is a colada or cream drink
- it contains passion fruit purée, grapefruit or Don's Mix (count them)
- the drink is bitter (Campari, amaro), since bitterness already reads as dryness
- it is hot (acid gets harsh when hot; use lemon peel)
- it is carbonated (carbonic acid adds bite)

### 1.9 Temperature and perception

Cold suppresses sweetness and aroma [H, Arnold]. Crushed-ice and frozen drinks need more sugar than the same spec shaken and served up. Frozen drinks typically need **+20–50% sugar** [M] and less acid share. A frozen drink built at shaken-sour sugar tastes thin and icy. Hot drinks read sweeter and more alcoholic: keep them at 7–13% ABV and 3–7 g sugar.

---

## 2. Technique by method

### 2.1 Shake, cubed ice, strained (`shake`, `cubed`)

- **For:** short sours served up (Daiquiri, Beachcomber's Gold, Saturn served up, Hemingway, Trinidad Sour) or strained over a single large cube.
- Shake 10–12 s, hard, with 1-inch cubes [H].
- Fine-strain when muddled herbs or fruit pulp would float.
- Pineapple and egg give a foam head. A shaken lime drink is cloudy. Neither should be described as "crystal clear."

### 2.2 Shake with crushed ice and open-pour (`shake`, `crushed`)

- **For:** the home stand-in for flash-blending, and Vic's own Mai Tai method ("shaken with shaved ice") [H].
- Shake 8–10 s with about 12 oz of crushed or pebble ice, then **open-pour** (dump the tin, ice and all) into the glass.
- Top with fresh crushed ice to make a dome above the rim, which anchors the mint.
- The **whip shake** variant [M]: shake with a small handful of pebbles until they vanish, then strain over fresh crushed ice. It gives more froth and less dilution, and suits Mai Tais and Zombies.

### 2.3 Flash blend (`flash-blend`)

- **For:** Donn Beach's signature texture.
- Uses an electric **spindle drink mixer**, the milkshake machine, which mixes from the top down and leaves much of the ice intact [H, Cate].
- Add 12 oz crushed ice plus 2–4 larger "agitator" cubes and run **3–5 seconds**. That chills, dilutes, aerates and wakes the citrus [H].
- Pour the whole tin into the glass. Top with crushed, or with cubes for a Zombie.
- **Not** a frozen drink. It should not be slushy.
- **Home substitute:** a hard shake with crushed ice, or 3–5 s pulses on a blender's lowest speed.
- Flash blending whips egg white well. The Smuggler's Cove Port Light is flash-blended with egg white [H, repo catalogue].

### 2.4 Blend, frozen (`blend`)

- **For:** the Floridita frappé, the Missionary's Downfall (Berry's spec is blended with mint, honey, peach liqueur, lime and pineapple [H]), frozen coladas, the Rum Runner and the Frozen Banana Daiquiri.
- Ice ≈ 1–1.5× the liquid by volume. A common bar formula for two drinks is 10 oz ice : 5 spirit : 2 sour : 2 rich syrup [M].
- Blend 10–20 s until smooth and mounded, not watery.
- Use **real fruit** for fruit-named frozen drinks: a banana for a frozen banana drink, strawberries for a Lava Flow, fresh pineapple for a Missionary's Downfall.
- No carbonation in the blender.
- Spirit ≤ ~2½ oz per serving, or it won't hold a frozen texture and is too strong for the format.
- Glass: `poco-grande`, `hurricane`, `goblet`, `snifter`, or a coupe with a proud mound (the Floridita). Never a Nick & Nora.

### 2.5 Swizzle (`swizzle`)

Built in the glass. The sequence:

1. Syrup, then (if used) mint leaves pressed lightly at the bottom, then citrus, then spirits.
2. Fill ⅔ with crushed ice.
3. Insert a **bois lélé**, the Martinique *Quararibea turbinata* branch with radiating prongs [H], or a metal swizzle. Spin it between flat palms like starting a fire, moving up and down, until the **outside of the glass frosts** (10–20 s).
4. Top with crushed ice to a dome.
5. Add a **bitters crown**, then mint, then a straw.

Notes:

- The Queen's Park Swizzle shows a natural **three-layer gradient** [H]: muddled mint green at the bottom, pale gold body, and an Angostura red-brown crown on top. The Bermuda Rum Swizzle is the juicy, pitcher-swizzled cousin. It froths from swizzling pineapple and has no crown.
- Never shaken and strained. Never cubed ice.

### 2.6 Build (`build`)

- **Highballs and bucks:** fill with cubes, add the spirit and fresh citrus, then pour the carbonated mixer down a bar spoon and give one gentle lift. Do not stir hard.
- **The Dark 'n Stormy "cloud":** pour ginger beer first and the black rum last, so it hangs as a dark layer over the pale ginger beer [H, IBA/Gosling's convention]. This is a legitimate gradient.
- **Ti' Punch:** a lime coin is pinched over the glass, then a teaspoon of cane syrup and 2 oz agricole, swizzled with one cube or none.
- **Old Fashioned-style:** stirred in the glass over a large cube.
- **Punch bowls:** built over one large block.

### 2.7 Stir (`stir`)

- Spirit-forward drinks with **no fresh juice**: rum Old Fashioned, Kingston Negroni, Corn 'n Oil.
- Stir 20–30 s with cubes. Strain up or onto a large block.
- Clear, silky, 20–30% ABV.
- Shaking a spirits-only drink clouds and over-dilutes it. Stirring a drink with juice under-mixes and under-aerates it.

### 2.8 Muddle (`muddle-build`, and muddled components)

- **Mint:** press, don't pulverize. Shredding releases grassy chlorophyll bitterness [H].
- **Lime wedges (Caipirinha):** firm and brief, because the peel oil is the point and over-muddling the pith turns bitter.
- **Ginger, cucumber, jalapeño and fruit** muddle in the shaker. Fine-strain if the drink is served up. Remove jalapeño seeds unless "hot" was asked for.

### 2.9 Hot (`hot`)

- Pre-warm the mug.
- Batter or syrup, then spirit, then hot water, coffee or tea, at 1 part spirit to 2½–4 parts hot liquid. Stir until the batter dissolves.
- Garnish with grated nutmeg, a cinnamon stick or a clove-studded lemon peel.
- Use butter as a **batter** (butter, brown sugar, spices, salt) worked in, never as a raw pat. A raw pat leaves a greasy slick.
- No ice, no crushed-ice garnish, no carbonation. Citrus is peel, or ≤ ½ oz lemon in a hot grog or punch.
- Heat-safe vessels only: `hot-mug`, `irish-coffee`. Ceramic tiki mugs are OK only if rated for heat.
- **Flaming:** flame only the spirit, briefly, in a warmed ladle, away from guests. Leave it out of a generator's default steps.

### 2.10 Dairy and acid

- **Casein dairy curdles below about pH 5.5** [H]. Milk, half-and-half (`half-and-half`), cream liqueurs (`irish-cream`) and ice cream (`vanilla-ice-cream`) curdle with lime, lemon, grapefruit, passion fruit purée, and even cranberry or pineapple if they sit. The "Cement Mixer" shot (Irish cream plus lime) is a joke drink for exactly this reason [H].
- **Heavy cream** (36%) has little casein relative to fat. Shaken hard with citrus and served at once, it emulsifies, as in the Ramos Gin Fizz [H]. In tiki it appears mainly in the Caribe Hilton Piña Colada (1 oz heavy cream with cream of coconut and 6 oz pineapple, blended) [H, the hotel's own recipe].
- **Coconut cream and milk contain no casein and do not curdle with citrus.** They can separate or seize when very cold, so shake hard or blend and serve immediately.
- **Fresh pineapple plus dairy** (bromelain) turns bitter if it sits [M]. Serve immediately and never batch it.
- **Ice cream** is blended, never shaken.

### 2.11 Egg white

- About ¾–1 oz per drink (one white ≈ 1 oz).
- **Dry shake** (no ice) 10 s, then shake with ice. The reverse dry shake (ice first, strain, then shake without ice) also works. A spindle mixer whips it in one go.
- Serve up or over a large cube to display the foam. Over crushed ice under a mint bouquet the foam is mostly hidden. The Port Light shows it is done, but it is not a showcase [H].
- Rare in golden-age tiki, more common in craft-era sours.
- It is incompatible with "vegan." Aquafaba is the usual swap; it is not in the vocabulary.

### 2.12 Carbonation: what must not be shaken

- **Never shake or blend soda, ginger beer, tonic, cola or sparkling wine as the lengthener.** The pressure blows the tin and the fizz is lost [H].
- Shake the rest, strain, then **top** with the carbonated mixer and lift once.
- **Historical exception:** Donn Beach's Navy Grog (Berry's decode) puts ¾ oz soda in the shaker with everything else [H]. A small dose (≤ 1 oz) of soda in a Beachcomber shake or flash-blend acts as texture and dilution. The generator may follow that precedent in `grog`, `beachcomber-sour` and `punch`, but a buck or highball always tops.
- Sparkling wine is poured last, into a flute or coupe, with no crushed ice.

### 2.13 Floats

- Pour slowly over the back of a bar spoon held just above the surface, or onto the crushed-ice dome. Use ¼–¾ oz.
- **A float has to be less dense than the drink.** That means high-ABV, low-sugar spirits: dark rum, 151, overproof. Sweet liqueurs sink and cannot be floated [H, density/specific gravity].
- The Fog Cutter's ½ oz amontillado "float" rests on the crushed ice and seeps down. That is the canonical exception [H].
- **Legitimate floats:**
  - sherry on the Fog Cutter
  - dark rum on resort Planter's Punches, the Hurricane variants and the Breakfast Mai Tai (craft)
  - 151 on resort Rum Runners
  - the Dark 'n Stormy's rum "cloud"
- **Illegitimate:** a dark-rum float on a Mai Tai, or any float on a Daiquiri.

### 2.14 Sinks

- After building, pour ¼–½ oz of a **dense, sugary** syrup or liqueur (`grenadine`, `creme-de-cassis`, `blackberry-liqueur`, `raspberry-syrup`) slowly down the inside wall. It settles to the bottom, making the "sunrise" gradient: red at the base, through orange, to yellow [H].
- It works over cubes or no ice. Over crushed ice it bleeds through in streaks, which can be pretty but won't hold a clean band.
- Shaking after the sink destroys it. A sink is the last step.
- It belongs in resort and party drinks. It is a red flag in a Mai Tai, Zombie, Navy Grog or Fog Cutter.

### 2.15 Bitters crown

- 3–8 dashes of Angostura on top of the packed crushed-ice dome, after swizzling.
- It is aromatic on the first sip and visually a red-brown cap.
- It defines the Queen's Park Swizzle and the Trinidad-style swizzles, and suits Planter's Punch ("Angostura top").
- It works only on crushed ice, where the dashes sit on the ice. On cubes it sinks and disappears.
- Skip it on colada-white drinks unless you want brown freckles.

### 2.16 Ice cone and ice shell

- **Navy Grog ice cone** [H]: pack finely shaved ice into a pilsner glass, push a chopstick through the center for the straw hole, unmold, and freeze overnight. Serve in a DOF with the straw through the cone and the drink poured around it. The Kon-Tiki chain used a purpose-made metal cone mold.
- **Beachcomber's Gold ice shell:** shaved ice pressed to line a champagne saucer, frozen, with the drink strained into the hollow [H, Berry].
- These are the only "up-glass with ice" exceptions.

### 2.17 Fresh juice and what can come from a can

- **Must be fresh:** lime, lemon, grapefruit and orange, squeezed the same day.
  - Lime peaks within hours of squeezing. Some bartenders find 4-hour-old lime rounder.
  - Juice degrades noticeably after ~24 h, and citrus develops bitterness after ~10 h at room temperature [M].
- **Acceptable from a can, carton or bottle:**
  - 100% unsweetened pineapple juice. Fresh-pressed foams more.
  - passion fruit purée or syrup
  - nectars (guava, mango, papaya, apricot)
  - cream of coconut (Coco López is the canonical brand; the Piña Colada and Coco López both date to 1954 Puerto Rico [H])
  - ginger beer
  - real pomegranate grenadine
- **Never:**
  - sour mix, "sweet and sour," margarita or piña colada mixes
  - bottled lime or lemon "juice"
  - cranberry juice cocktail in tiki (it is a 1960s Ocean Spray/vodka-highball lineage, not tropical)
  - artificial red "grenadine" (HFCS and Red 40) when the copy claims pomegranate

### 2.18 Batches and bowls

- Scale the main components linearly. Scale **bitters, anise, saline and extracts at ~0.75×** past 4 servings [M].
- Juice citrus within 4–6 h of service. Add carbonation and sparkling wine only at service.
- **Crushed-ice bowls** (`scorpion-bowl`, `tiki-bowl`, `volcano-bowl`):
  - Flash-blend or shake in rounds of two servings, and pour over fresh crushed ice in the bowl.
  - Per-cup ABV 9–14%.
  - Total spirit ≤ ~2½ oz per guest.
  - One long straw per guest.
  - Garnish with gardenias or orchids. Vic's 1968 menu describes the Scorpion Bowl as "bedecked with gardenias and served with long straws" [H].
- **Ladled punch** (`punch-bowl`):
  - Build over **one large block**. Crushed ice drowns a bowl in 20 minutes.
  - Pre-dilute ~10–20% with cold water if the block is small, or 20–25% if the punch is pre-batched to be served without shaking [M].
  - Grate nutmeg and float lemon wheels.
- **Volcano bowl fire:** ½ oz lemon extract or overproof in the central well, lit at the table. Nobody drinks near the well until it is out, and nobody ladles or pours burning liquid.

### 2.19 Fire

The safe, theatrical version that tiki bars actually use:

- Ream a lime (or lemon) half until the shell is dry.
- Set a **crouton or sugar cube soaked in lemon extract** inside. Lemon extract is ~80%+ ABV with lemon oil and burns with a visible **yellow** flame. 151 burns nearly invisible blue in daylight [H].
- Float the shell on the crushed-ice dome of a wide mug or bowl and light it.
- A pinch of **ground cinnamon** dusted from above sparks in the flame [H].

Rules:

- only on wide mugs and bowls, never on narrow glasses or coupes
- away from mint bouquets, paper umbrellas, straws and hair
- never pour spirit from the bottle toward a flame
- tell the guest to let it burn out (or cover it with a saucer) before drinking
- the fuel is never drunk

A flaming 151 float on a Zombie is a later chain-restaurant habit, not Donn Beach. Bacardi 151 was withdrawn from the US in 2016 amid burn lawsuits [H].

---

## 3. Pairing logic

### 3.1 Rums by job (Donn Beach: "What one rum can't do, three rums can" [H])

| job | ids | dose in a blend | pairs with | avoid |
|---|---|---|---|---|
| clean body; carries citrus | `rum-white-column`, `rum-gold-column`, `rum-blended-light` | 1–2 oz | lime, simple, maraschino, passion, pineapple | being the *only* rum in a "dark/stormy/rich" prayer |
| oak and vanilla body | `rum-aged-column`, `rum-barbados` | 1–2 oz | orgeat, falernum, honey, coconut, banana | — |
| funk, banana, overripe pineapple | `rum-jamaican-aged`, `rum-jamaican-pot` | 1–1.5 oz (dominates above 1.5 oz in a blend) | orgeat, curaçao, banana, cinnamon, ginger, falernum, coffee | delicate floral modifiers (elderflower, lychee) |
| molasses and caramel; color | `rum-jamaican-dark`, `rum-black-blended` | 0.75–2 oz | ginger beer, Campari, pineapple, coffee, lemon | blue curaçao (color mud) |
| burnt sugar and smoke | `rum-demerara` | 0.75–2 oz | honey, allspice, grapefruit, lime, cinnamon | — |
| lift, char, the kicker | `rum-demerara-overproof`, `rum-black-overproof` | **¾–1 oz** | anise drops, Angostura, falernum, cinnamon, grapefruit, passion | being a second overproof |
| grass, vegetal, dry | `rum-agricole-blanc` | 1–2 oz | cane syrup, lime coin, falernum, guava, hibiscus, Chartreuse | heavy cream, cranberry |
| dry, aged cane | `rum-agricole-vieux` | 1–1.5 oz | honey, allspice, orange (Three Dots), split with Jamaican in a Mai Tai | — |
| rich navy blend | `rum-navy` | 2 oz | pineapple, orange, cream of coconut, nutmeg (Painkiller) | — |
| Jamaican white overproof | `rum-jamaican-white-overproof` | ≤ ¾ oz | small funk boosts | being the base unless asked |
| cane funk | `rum-cachaca` | 2 oz | lime, sugar, passion, pineapple | — |
| spiced | `rum-spiced` | rarely | — | classic-family drinks. Build spice from allspice, cinnamon and falernum instead |
| coconut liqueur | `coconut-rum` | ≤ ½ oz with cream of coconut, ≤ 1½ oz in resort drinks | resort punches (Bahama Mama, Lei Lani Volcano) | being the colada's only coconut |

Classic stacks [H, repo catalogue]:

- Don's Zombie: gold PR + Jamaican + 151 Demerara.
- Navy Grog: light PR + dark Jamaican + Demerara.
- Vic's second Mai Tai: Jamaican + Martinique.
- Three Dots: aged agricole + Demerara.

The repo's most common pair is light rum + dark Jamaican. A blend should span at least two *different jobs*. Light + gold column is redundant: the catalogue shows a negative PMI between them.

### 3.2 Modifier affinities (what goes with what)

PMI figures are this repo's measured co-occurrence strengths. Higher means the pair meets more often than chance.

| modifier | best bases | best juices / partners | evidence |
|---|---|---|---|
| `velvet-falernum` / `falernum-syrup` | Jamaican, Demerara, Barbados, overproof black, gin (Saturn), Green Chartreuse | lime, grapefruit, passion, pineapple, anise drops | PMI: falernum + 151 black 1.74, + pastis 1.86, + Chartreuse 1.80 |
| `allspice-dram` | Demerara, aged column, overproof black | honey, grapefruit, vanilla (Spices #2), lime | PMI + Demerara 2.33, + honey 1.90, + grapefruit 1.85; **negative with pineapple (−1.43)** |
| `orgeat` | aged/Jamaican rum, brandy, gin, bourbon, Scotch | lime + curaçao (Mai Tai), lemon + orange + brandy (Scorpion), passion (Saturn) | + brandy 1.78; negative with cinnamon syrup (−1.05) |
| `cinnamon-syrup` / `dons-mix` | Jamaican, black overproof, pineapple rum | **grapefruit** (Don's Mix, PMI 2.11), banana, apple, passion | — |
| `honey-syrup` | Demerara, agricole, gin, Scotch | allspice, grapefruit, soda (grog), lemon, Yellow Chartreuse | — |
| `passion-fruit-syrup` | dark Jamaican (Hurricane), gin (Saturn), overproof, bourbon (Port Light), tequila/mezcal | lemon, lime, orgeat, falernum, honey | + black overproof 1.83; **negative with grenadine (−1.05) and rich simple (−2.4)**: redundant |
| `grenadine` | — | lime + absinthe (Dr. Funk), orange (sunrise), blackberry + banana (Rum Runner) | a teaspoon is seasoning, an ounce is a resort drink |
| `campari` | black/blackstrap, Jamaican, mezcal | **pineapple** + lime + demerara (Jungle Bird), grapefruit, falernum | — |
| `green-chartreuse` | as base (Chartreuse Swizzle), or ¼–½ oz | falernum, pineapple, lime, nutmeg, mint | — |
| `pastis` / `absinthe` | 151 Demerara (PMI 3.21), Jamaican dark | Angostura, falernum, grenadine, maraschino | drops only |
| `maraschino` | light rum, gin | grapefruit (Hemingway), lime, 151 | — |
| `banana-liqueur` | Jamaican, aged rum | cinnamon, cacao, coconut, pineapple, lime | — |
| `coconut-cream` | navy, Jamaican, light rum, agricole, vodka (Chi Chi) | **pineapple** (the colada), orange (Painkiller), nutmeg, banana, cacao, passion, coffee | — |
| `ginger-syrup` / `ginger-beer` | Jamaican, black, gin + brandy (Suffering Bastard), tequila | lime, honey, pineapple, Angostura | — |
| `coffee-liqueur` / `coffee` | Jamaican, Demerara, black | cinnamon, orange peel, vanilla, coconut, cacao; resort pineapple (Bahama Mama variants) [M] | **not** with lime-forward sours (muddy) |
| `hibiscus-syrup` | agricole, mezcal, tequila, Jamaican | lime, ginger, allspice, clove (Caribbean sorrel) | — |
| `elderflower-liqueur`, `lychee-liqueur` | gin, light rum, pisco, agricole blanc | lime, lemon, yuzu, cucumber, mint | not with funky Jamaican or Campari |
| `ancho-reyes`, `jalapeno` | mezcal (jalapeño + mezcal PMI 3.94), tequila, Demerara | pineapple, lime, passion, cinnamon | — |
| `amontillado-sherry` | brandy, rum | orgeat, lemon (Fog Cutter float), dried fruit | — |

**Measured anti-pairings** (negative PMI with support in the catalogue). The generator should avoid them unless the archetype calls for them:

- `lemon` + `lime` (−2.36): one primary citrus. Exceptions: the c. 1950 Zombie and Vic's Planter's Punch.
- `grapefruit` + `lemon` (−1.96)
- `orange-curacao` + `pineapple-juice` (−1.0): the Mai Tai corruption
- `allspice-dram` + `pineapple-juice` (−1.43)
- `brandy` + `pineapple-juice` (−1.27)
- `passion-fruit-syrup` + `grenadine` (−1.05): two red-fruit syrups
- `rich-simple` + `velvet-falernum` (−1.57): falernum *is* the sweetener
- `orgeat` + `simple-syrup` (−1.03): redundant sweeteners
- `angostura` + `rum-white-column` (−1.24): light rum drinks are rarely bittered

### 3.3 Sweetener choice by base

| base | first-choice sweeteners | second |
|---|---|---|
| light rum | simple, honey, orgeat, maraschino, passion syrup | falernum |
| Jamaican rum | demerara or rich syrup, orgeat, falernum, cinnamon, banana liqueur | allspice |
| Demerara rum | honey, demerara syrup, allspice, cinnamon | falernum |
| agricole | rich cane syrup, honey, falernum | orgeat |
| gin | honey, passion syrup, orgeat, falernum, Cherry Heering | elderflower |
| bourbon / rye | honey, orgeat, maple, cinnamon, demerara | allspice |
| tequila | agave, orgeat, passion, hibiscus | honey |
| mezcal | agave, passion, cinnamon, orgeat, pineapple syrup | ancho |
| brandy / pisco | orgeat, honey, curaçao | apricot |
| Scotch | honey, ginger, orgeat | — |
| vodka | anything clean. In tiki it is a resort-era base (Chi Chi, Blue Hawaii) and wrong for golden-age families | — |

### 3.4 Too many cooks

Each component must be one of eight jobs:

1. base
2. second rum (contrast)
3. primary acid
4. secondary acid or bitter juice
5. sweetener(s)
6. body (juice, cream, soda)
7. accent modifier
8. seasoning (dash or drop)

The limits:

- **Liquid components (non-garnish lines):** typical maximum 5 for `daiquiri`, 6 for `mai-tai`, `swizzle`, `bitter-tiki`, `buck` and `colada`, 7–8 for `grog`, `punch`, `orgeat-punch`, `resort-punch` and `beachcomber-sour`, and 9–11 only for `zombie`.
- **Quarter-ounce rule:** at most **three** components at ≤ ¼ oz that are not seasonings. Four or more quarter-ounce pours makes "eight things at a quarter ounce" mud.
- **Volume rule:** base, acid and main body juice together should make up ≥ 60% of pre-dilution volume.
- **One of each:** one primary citrus, one orange liqueur, at most one plain syrup, at most two coconut sources, at most two red-fruit sweeteners, at most two passion sources, one aggressive bitter liqueur (two only in `bitter-tiki`), one anise source.
- **Minimum doses:** a bulk juice (pineapple, orange, nectar, coconut water) below ½ oz does nothing, and neither does a grapefruit below ¼ oz. Soda below 1 oz isn't a top; the exception is the ¾ oz in a Beachcomber grog.

### 3.5 Bitter and herbal in tiki

| element | use | precedent |
|---|---|---|
| Angostura (1–2 dashes) | salt-and-pepper seasoning | Zombie, Three Dots |
| Angostura crown | swizzles | Queen's Park |
| Angostura as base | deliberate craft inversion only | Trinidad Sour, 1½ oz |
| Campari | needs pineapple and a dark rum to carry it | Jungle Bird |
| amaro | sits in bitter-tiki and stirred drinks | — |
| Green Chartreuse | base of the Chartreuse Swizzle, or a ¼–½ oz accent | — |
| anise | drops (6 drops ≈ ⅛ tsp) | — |
| Fernet, Islay Scotch | at most ¼–½ oz, only when "bitter," "smoky" or "medicinal" is asked for | — |

Never stack two or three aggressive bitter or anise elements (Campari *and* absinthe *and* amaro) in a drink whose prayer is gentle (garden, grandmother, floral, sunny, brunch). A garden reads as:

- base: gin, agricole blanc, light rum or pisco
- herbs: mint, basil, cucumber
- flowers: elderflower, orange flower water, honey
- lift: lemon or lime, with soda or sparkling wine optional
- a quiet garnish

---

## 4. Garnish conventions

### 4.1 Principles

1. **Aroma first.** In tiki the garnish is part of the flavor: the mint sprig smelled on every sip, nutmeg, cinnamon, citrus oil, the Angostura crown [H, Cate/Berry]. Put aromatic garnishes **next to the straw**, where the nose goes.
2. **Spank, don't shred.** Clap mint once between the palms to break the oil glands without bruising (Toby Maloney, Milk & Honey) [H].
3. **Signal truthfully.** Fruit garnish signals fruit. A garnish may be decorative, but it may not be the *only* evidence of a flavor the drink doesn't have, and it may never show an ingredient the prayer excluded.
   - The decorative "flag" (citrus slice plus cherry) and cherry-plus-pineapple picks are accepted conventions in punch, resort and Beachcomber families even without that juice inside. Don's Three Dots pineapple chunk is one.
4. **Match the garnish to the ice and the glass.**
   - Mint bouquets need a crushed-ice dome to stand in.
   - Coupes take one small thing (a lime wheel or twist, a cherry on a pick) or nothing.
   - Hot drinks take spice and peel.
5. **No duplicates.** One mint element, one cherry element.
6. **Counts by vessel:**
   - up: 0–1
   - rocks: 1
   - DOF or short crushed: 1–2
   - tall glass or mug: 2–3
   - fruit vessel: 1–3
   - bowl: 3–5, including flowers, straws and fire

### 4.2 Per family

| family | required / defining | typical | never |
|---|---|---|---|
| `mai-tai` | spent lime half-shell + big mint sprig (the shell and sprig are often described as an island and a palm tree [M]) | orchid (Hawaii, later); pineapple spear (Hawaii) | cherry dropped in; orange-and-cherry flag; umbrella-only; dark-rum float; grenadine sink |
| `zombie` | mint sprig | mint bouquet, cherry on a pick, pineapple frond; lit lime shell (mug service, later) | sugar or salt rim, cream, umbrella-and-fruit-salad, blue anything |
| `grog` | Navy Grog: ice cone with the straw through it | spent lime shell, mint; Vic's rock-candy stick | umbrella, orchid, cherry flag |
| `beachcomber-sour` | — | Three Dots: three cherries + pineapple chunk; Nui Nui: long orange-peel spiral; mint; gardenia | salt rim, cream, umbrella-only |
| `swizzle` | swizzle stick left in, mint sprig, Angostura crown (Trinidad style) | straw | fruit flag, umbrella (Trinidad style); bitters crown on a Bermuda swizzle (has none) |
| `daiquiri` | — | lime wheel or nothing; grapefruit twist (Hemingway) | mint bouquet, umbrella, cherry on a coupe drink, sugar rim |
| `orgeat-punch` | — | gardenia or orchid, long straws (bowls), mint; volcano fire (bowls) | umbrella-and-fruit salad, grenadine sink, cream |
| `colada` | pineapple wedge (+ fronds); **grated nutmeg on a Painkiller** | maraschino cherry, orange wheel (Painkiller), umbrella, orchid | mint bouquet (weak; nutmeg or pineapple is better), Angostura crown, salt rim |
| `resort-punch` | — | **umbrella, orchid**, pineapple wedge, cherry, orange half-wheel: *this is where the fun garnish lives* | — |
| `punch` | grated nutmeg or an Angostura top | lime wheel, mint, orange slice, cherry | sugar rim |
| `buck` | lime wedge or wheel | candied ginger, mint (mules) | umbrella, nutmeg, cherry |
| `bitter-tiki` | — | pineapple wedge + fronds; orchid (Jungle Bird) | whipped cream, nutmeg |
| `stirred` | expressed orange or lime twist | a cherry on a pick | mint bouquet, umbrella, fruit skewer, crushed ice |
| `hot` | grated nutmeg or a cinnamon stick | clove-studded lemon peel; orange peel (Coffee Grog) | ice, umbrella, mint, pineapple, lime wheel |

### 4.3 Aroma garnishes, how to

| garnish | how |
|---|---|
| **mint sprig or bouquet** | 3–5 tops (bouquet) or 1 sprig, spanked, stems trimmed short and pushed into the crushed-ice dome beside the straw. Optionally dust with powdered sugar for a "frosted" look |
| **nutmeg** | Microplane a whole nutmeg over the surface just before serving. Never pre-ground from a jar |
| **cinnamon** | A stick as a stirrer in hot drinks. Torch the tip briefly for smoke (craft). Ground cinnamon only over fire for sparks or on hot or cream drinks |
| **citrus peel** | Express the oils over the surface and rim. Spirals for the Nui Nui; the lemon-peel ring around a cherry for the Saturn [H] |
| **bitters crown** | 3–8 dashes on top of crushed ice |
| **spent lime shell** | Use the squeezed half, placed face-down or face-up on the ice dome |

### 4.4 Decorative, and their history

- **Flowers:**
  - The **orchid** arrived in 1955. Harry Yee at the Hilton Hawaiian Village switched to Vanda orchids after sugar-cane stick garnishes kept ending up chewed in the ashtrays [H].
  - The **paper umbrella** followed around 1959 (Yee) [H]. Berry credits Yee as the first to use both [H].
  - **Gardenias** are Vic's, on the Scorpion Bowl [H].
  - Use pesticide-free, food-safe flowers. Orchids are decoration, not food.
- **Cherries:** neon maraschino on a pick is period kitsch and fine on resort, punch and Beachcomber drinks. A dark Luxardo or brandied cherry is the craft-era cue. Choose by tone.
- **Pineapple:** a wedge with fronds, spears and "flags."
- **Picks and props:** tiki swizzle sticks, bamboo picks, sword picks, a pineapple-frond "fan."
- **Ice:** the Navy Grog cone and the Beachcomber's Gold shell.

### 4.5 Tacky versus fun

**Fun** (an aficionado smiles):

- an umbrella stuck in a lemon wedge on a Hurricane (Smuggler's Cove does exactly this [H])
- an orchid on a Jungle Bird
- a mint bouquet towering over a Zombie
- a lit lime shell on a volcano bowl
- three cherries and a pineapple chunk that *spell* "V"
- a skull mug for something dark
- long straws in a shared bowl

As Martin Cate puts it, tiki garnish tells guests "this looks fun… and not be punished by a glob of bitter death" [M, paraphrase of a quote in Punch].

**Tacky** (an aficionado winces):

- an umbrella on a coupe or a stirred drink
- sugar or salt rims on tiki drinks. Exception: a li hing mui rim on a drink that contains li hing mui is a deliberate Hawaiian touch
- whipped cream on anything not built as a dessert
- glitter, glow sticks, gummy candy
- a fruit-salad skewer of five fruits that aren't in the drink
- a brandied cherry *and* an orchid *and* a mint bouquet on a 4 oz up drink
- a cherry sunk in a Mai Tai
- a garnish blocking the straw or nose
- dried-citrus wheels on everything (generic Instagram)
- plastic monkeys on a drink presented as serious (fine at a pool party if the copy is in on the joke)

**The test:** is the garnish *doing* something (aroma, story, theater) and *consistent* with the drink? Kitsch is welcome. Carelessness is not.

---

## 5. RED FLAGS

The severity scale:

- **fatal** means an aficionado rejects the drink outright
- **major** means they wince and correct it
- **minor** means they raise an eyebrow

Each entry gives the flag, why it matters, and the fix. Section 11 implements every flag as a rule keyed by id.

### 5.1 Identity: the name, family and label must be true

| id | sev | flag | why | fix |
|---|---|---|---|---|
| `colada-no-coconut-or-pineapple` | fatal | A "colada" (name, family or tagline) without both pineapple (≥ 1.5 oz juice) and coconut (≥ ¾ oz cream of coconut, or coconut milk plus sugar) | "Colada" means pineapple + coconut. The Piña Colada *is* the definition [H] | Add `pineapple-juice` 2–4 oz and `coconut-cream` ¾–1½ oz, or rename and relabel |
| `colada-coconut-from-liqueur-only` | major | The only coconut is `coconut-rum` or `coconut-water` | Thin, sweet, no body. The fat is the point | Use `coconut-cream`. Keep coconut rum ≤ ½ oz as an accent |
| `colada-sour` | major | Colada with > ¾ oz lime, or acid > 0.5 g | Fat plus heavy acid reads sour and can split | ≤ ½ oz lime |
| `mai-tai-juice` | fatal | A Mai Tai (name or riff) with `pineapple-juice` or `orange` | The Royal Hawaiian's juice version is a later Hawaii drift, documented by the early 1970s [H]. Berry: "served red, yellow, and blue, with pineapple juice and grenadine—neither of which is in the recipe" [H] | Rum, lime, curaçao, orgeat, rich syrup. Only allow juice when "Royal Hawaiian" or "Hawaiian-style" is explicitly requested, and say so |
| `mai-tai-incomplete` | fatal | A Mai Tai missing lime, orgeat, an orange liqueur, or an aged/Jamaican/agricole rum | These define the template (Vic, 1944) [H] | Restore the 2 : 1 : ½ : ½ : ¼ skeleton |
| `mai-tai-float-or-sink` | major | A Mai Tai with a dark-rum float or a grenadine sink | Resort corruption | Remove. Garnish with lime shell + mint |
| `zombie-weak-structure` | fatal | A Zombie with one rum, no overproof, or no grapefruit/cinnamon/falernum element | The defining stack [H, Berry 2007 decode] | Gold column + Jamaican + ¾–1 oz 151 Demerara; Don's Mix or grapefruit + cinnamon; falernum |
| `zombie-red-or-creamy` | fatal | A Zombie with grenadine > 1 tsp, any cream or coconut, or blue curaçao | The grenadine is a seasoning, not color | 1 tsp grenadine; no dairy, coconut or blue |
| `grog-wrong` | major | A "grog" without the grog engine: (lime + grapefruit + honey/allspice/demerara) or (rum + water/soda + lime) | Navy Grog structure [H] | Add white grapefruit and honey or allspice |
| `swizzle-not-swizzled` | fatal | A "swizzle" that is shaken and strained, or uses cubed ice | The method *is* the name | method `swizzle`, ice `crushed` |
| `daiquiri-impostor` | major | A "daiquiri" with cream, juice > 1 oz (unless fruit-named), > 5 components, or a non-rum base not named in the title | The Daiquiri is rum, lime, sugar | Strip it back, or call it a sour |
| `orgeat-punch-without-orgeat` | fatal | `orgeat-punch` family label or tagline with no `orgeat` | The label names the ingredient. The generator produced exactly this for "mezcal and passion fruit" | Add orgeat ½ oz or relabel |
| `scorpion-without-brandy` | major | A Scorpion or Scorpion bowl with no brandy | Vic's Scorpion is rum + brandy + orange + lemon + orgeat [H] | Add `brandy` ½–1 oz per serving |
| `fog-cutter-incomplete` | major | A Fog Cutter without gin + brandy + rum or without the sherry float | Vic's spec [H] | Add both |
| `buck-without-ginger` | major | A "buck" or "mule" without `ginger-beer`, `ginger-ale` or ginger | Definitional | Add ginger beer |
| `highball-served-up` | major | "Highball" or "cooler" served up | Long, iced, carbonated by definition | Build in a `highball` or `collins` |
| `hot-wrong` | fatal | A hot drink with ice, carbonation, or > ½ oz citrus juice | Curdles butter, flattens, harsh | Peel instead of juice; no ice |
| `stirred-with-juice` | major | `stirred` with fresh juice, dairy or egg | Stirred drinks are spirit-forward and clear | Shake it, or remove the juice |
| `bitter-tiki-not-bitter` | major | `bitter-tiki` without a bitter liqueur or bitters at ≥ ½ oz | Family definition | Add Campari or amaro |
| `classic-riff-loses-signature` | major | A riff on a named classic drops its signature: Painkiller without nutmeg or orange, Hurricane without passion fruit, Navy Grog without grapefruit, Jungle Bird without Campari or pineapple, Queen's Park without mint or Angostura, Saturn without passion fruit or gin, Missionary's Downfall without mint | The riff must still be recognizably that drink | Keep the signature; vary the other parts |
| `bowl-single` | major | A bowl vessel or the "Bowl" noun for one serving, or "for 6" served in one glass | Bowls are communal | Servings ≥ 2 for bowls; scale the recipe |
| `named-reference-ignored` | major | Pop-culture or classic references ignored (e.g. "Blue Hawaii" with no blue curaçao) | The prayer named a drink | Honor the referenced classic: Yee's Blue Hawaii is light rum, vodka, blue curaçao, pineapple, sweet-and-sour, made fresh with lemon + simple [H] |

### 5.2 Ingredients

| id | sev | flag | why | fix |
|---|---|---|---|---|
| `sour-mix` | fatal | Sour mix, sweet-and-sour, margarita or colada mix, bottled lime or lemon, in a spec or the copy | The decline-era shortcut that killed tiki [H] | Fresh lime or lemon + simple |
| `cranberry-in-tiki` | major | `cranberry-juice` (juice cocktail) in a tiki family drink without an explicit request | Not a tropical ingredient; 1960s vodka-highball lineage; tastes like a brunch Cosmo | Hibiscus, real grenadine, pomegranate, passion or guava |
| `lime-cordial-as-citrus` | major | `lime-cordial` as the only acid in a sour family (outside `buck`, i.e. the Suffering Bastard) | Rose's is sweet-sour flavoring, not fresh lime | Fresh `lime` |
| `spiced-rum-classic` | major | `rum-spiced` in `mai-tai`, `zombie`, `grog`, `swizzle` or `daiquiri` | Builds spice from vanilla-flavored rum instead of real modifiers. Instant amateur tell | Aged rum + allspice dram, cinnamon or falernum |
| `coconut-pileup` | major | More than two coconut sources, or `coconut-rum` + `coconut-cream` + dairy (the generator produced coconut rum + half-and-half + cream of coconut) | Cloying, muddy, redundant | One cream of coconut (+ optional ½ oz coconut rum) |
| `casein-plus-citrus` | fatal | `half-and-half`, `irish-cream` or `vanilla-ice-cream` with `lime`, `lemon`, `grapefruit`, `yuzu-juice`, `passion-fruit-juice` or `lime-cordial` | Curdles: the Cement Mixer effect [H] | Drop the citrus, or switch to coconut |
| `heavy-cream-plus-heavy-citrus` | major | `heavy-cream` with > ¾ oz citrus | Risky texture; not tiki | Coconut instead, or ≤ ½ oz citrus served at once |
| `ice-cream-shaken` | major | `vanilla-ice-cream` in a method other than `blend` | Doesn't emulsify | Blend |
| `blue-or-melon-unrequested` | major | `blue-curacao` or `melon-liqueur` without a color or pop request | Artificial-color shortcut; resort cliché | Remove, or only when asked |
| `two-orange-liqueurs` | minor | Two of `orange-curacao`, `triple-sec`, `blue-curacao` | Redundant | Keep one |
| `two-plain-syrups` | minor | Two of `simple-syrup`, `rich-simple`, `demerara-syrup`, `agave-syrup`, `maple-syrup` | Same job twice | Keep one. Rich-for-texture + a flavored syrup is fine |
| `lemon-and-lime` | minor | `lemon` + `lime` outside `zombie`, `punch`, `resort-punch` | Measured anti-pairing (PMI −2.36) | Pick one |
| `grenadine-for-color` | major | `grenadine` > ½ oz outside `resort-punch`, `punch`, Dr. Funk-type or a sunrise sink; any grenadine in `mai-tai` | Turns the drink pink and candy-sweet | ≤ 1 tsp as seasoning, or use it as a sink deliberately |
| `anise-overdose` | fatal | `absinthe` or `pastis` > ¼ tsp (0.04 oz), unless a rinse or "anise-forward" requested | Six drops is Don's dose. ½ oz turns everything licorice | 6 drops, or a rinse |
| `bitters-overdose` | major | `angostura` > 6 dashes (except as a crown or in a bitters-base drink); other bitters > 4 dashes | Washes the drink brown and medicinal | 1–2 dashes, or a crown |
| `allspice-overdose` | major | `allspice-dram` > ½ oz | Tastes like a clove cigarette | ¼ oz typical |
| `chartreuse-overdose` | minor | `green-chartreuse` > ¾ oz unless it is the base (Chartreuse Swizzle) | Dominates | ¼–½ oz accent |
| `overproof-overdose` | fatal | Any overproof > 1 oz (or 1½ oz as the sole base of a small drink); two different overproofs; total spirit > 4 oz; ethanol > 2 oz (the generator produced 5 oz of rum with two overproofs) | Dangerous, not just strong | ¾–1 oz overproof in a 3–4 oz rum stack |
| `jamaican-white-overproof-base` | minor | `rum-jamaican-white-overproof` > ¾ oz without a request | Fiery, grassy, dominant | ≤ ½ oz boost |
| `smoky-bitter-bomb` | minor | `fernet` > ¼ oz or `scotch-islay` > ½ oz in a fruity drink unless asked | Medicinal | Accent doses |
| `bitter-stack-in-gentle-drink` | fatal | Two or more of {`campari`, `amaro`, `cynar`, `fernet`, `absinthe`, `pastis`} in a drink whose prayer reads gentle, floral, garden, sunny or brunch | The critic's own example: Campari + absinthe in "my grandmother's garden" | One gentle herbal at most; build from flowers, herbs, honey and citrus |
| `too-many-cooks` | major | More components than the family max (§3.4), or > 11 anywhere | Mud | Cut to one item per job |
| `quarter-ounce-soup` | major | ≥ 4 non-seasoning components at ≤ ¼ oz | "Eight ingredients at a quarter ounce" | Consolidate into 2–3 meaningful modifiers |
| `micro-dose-bulk` | minor | `pineapple-juice`, `orange`, nectars, `coconut-water` or `apple-juice` < ½ oz; `grapefruit` < ¼ oz; a carbonated top < 1 oz (except the Beachcomber ¾ oz soda) | Contributes nothing but a line on the card | Raise to a tasteable dose or drop |
| `redundant-red-fruit` | minor | More than two of {`grenadine`, `raspberry-syrup`, `raspberry-liqueur`, `blackberry-liqueur`, `creme-de-cassis`, `cranberry-juice`, `pomegranate-juice`, `hibiscus-syrup`, `sloe-gin`} | Generic red punch | Two at most, with distinct jobs |
| `passion-pileup` | minor | More than two passion sources | Redundant | Syrup or purée, plus at most one other |
| `vodka-in-golden-age-family` | major | `vodka` as the base in `zombie`, `mai-tai`, `grog`, `swizzle`, `beachcomber-sour` | Rum is the point of those families | Rum, or the requested non-rum spirit with flavor |
| `brewed-coffee-cold-stirred` | major | `coffee` > 1 oz in a `stirred` drink, or hot coffee shaken (the generator produced 1½ oz coffee stirred over cubes in a rocks glass) | Watery, overfilled, flat | `coffee-liqueur` ½–¾ oz or a cold-brew splash ≤ ¾ oz; or make it a hot Coffee Grog |
| `raw-butter` | major | `butter` in any cold drink, or a raw pat in a hot drink | Grease slick | `hot-buttered-rum-batter` in hot drinks only |
| `fruit-named-absent` | fatal | A drink named or taglined for a fruit or food it doesn't contain at a tasteable dose (a "frozen banana drink" with no banana) | Dishonest | Real `banana` for frozen, `banana-liqueur` ≥ ½ oz shaken, etc. |
| `dessert-without-dessert` | major | A "bananas Foster," "dessert," "chocolate" or "coffee" prayer answered with grapefruit sours | Ignores the food reference | Banana, butter or brown sugar, cinnamon, dark rum, cream or ice cream; or cacao, coffee, coconut, vanilla |
| `coconut-milk-unsweetened-swap` | minor | `coconut-milk` in a colada with no added sugar | Thin and sour | `coconut-cream`, or add `rich-simple` |
| `spice-sludge` | minor | More than three spice carriers (`rum-spiced`, `allspice-dram`, `cinnamon-syrup`, `five-spice-syrup`, `dons-spices-2`, `clove`, `tiki-bitters`) | Pumpkin-latte mud | Two spices, chosen |
| `liqueur-cloy` | major | Sweet liqueurs > 1½ oz total (excluding liqueur-based archetypes) | Cloying | Trim, and add acid |

### 5.3 Balance

| id | sev | flag | fix |
|---|---|---|---|
| `ratio-out-of-window` | major | Sugar:acid outside the family window (§1.2) | Re-solve the acid and sugar levers |
| `acid-missing` | fatal | A sour-family drink with post-dilution acid < 0.4 g (the generator produced a colada at 0 acid, which is fine for a colada, but a 0.5 g Zombie is not) | Restore citrus |
| `frozen-thin` | major | A `blend` drink at shaken-sour sugar (< 8.5 g/100 ml) or with > 2½ oz spirit | +20–50% sugar; ≤ 2½ oz spirit |
| `abv-out-of-band` | major | ABV outside the family band (§1.4), or the request was violated ("low ABV" > 10%; "strongest" > the Zombie ceiling) | Rescale spirit and lengtheners |
| `passion-plus-full-lime` | minor | `passion-fruit-juice` ≥ ¾ oz plus `lime` ≥ ¾ oz | Cut the lime by about the purée's lime-equivalent |
| `pineapple-flab` | minor | Non-colada sour with pineapple > 3× the lime | Add lime, or move to `resort-punch` or `colada` |
| `hot-too-dry-or-strong` | minor | Hot drink sugar < 2.5 g or ABV > 14% | More batter or syrup; more hot water |
| `tasting-contradicts-numbers` | major | Copy says "balanced," "dry," "tart" or "sweet" against the computed numbers | Generate the copy from the numbers |

### 5.4 Technique and method

| id | sev | flag | fix |
|---|---|---|---|
| `shaken-carbonation` | fatal | Carbonated ingredient > 1 oz with method `shake`, `flash-blend` or `blend` and not marked as a top. The generator listed a buck as "shake" with ginger beer | Shake the rest, top with soda, lift once |
| `sparkling-shaken` | fatal | `sparkling-wine` shaken or blended | Top it |
| `swizzle-method-mismatch` | major | Swizzle family with cubed ice or straining | Crushed, swizzled in the glass |
| `flash-blend-up` | major | `flash-blend` or crushed-shake drink served in `coupe`, `nick-nora` or `cocktail-glass`, unless Beachcomber's Gold with an ice shell | Open-pour into a crushed-ice vessel |
| `layer-claim-shaken` | major | "Layered," "sunrise," "gradient," "float" or "sink" claimed with no float or sink step, or with the layering component shaken in | Add a float or sink as the final step |
| `float-too-dense` | major | Float of a liqueur or syrup (sugar > 15 g/100 ml, ABV < 35%) | Float a high-ABV spirit; sink the syrup |
| `sink-too-light` | major | "Sink" of a spirit | Sink syrups and liqueurs only |
| `mint-shredded-or-unstrained` | minor | Muddled mint in an up drink without fine-straining | Fine strain; press, don't shred |
| `egg-no-dry-shake` | minor | `egg-white` shaken with ice only (no dry shake, no flash blend) | Dry shake first |
| `hot-vessel-unsafe` | major | Hot drink in a thin glass coupe, flute or an unrated mug | `hot-mug` or `irish-coffee` |
| `punchbowl-crushed` | minor | A `punch-bowl` (ladled) built on crushed ice | One large block |
| `fire-unsafe` | major | Fire garnish on a narrow glass or coupe; 151 poured from the bottle; flame near mint or umbrella; "flaming float" | Lemon-extract crouton in a lime shell on a wide mug or bowl |
| `ice-cone-misuse` | minor | Ice cone on a non-grog, or in a coupe | Navy Grog in a DOF |
| `frozen-no-mound` | minor | Frozen drink in `nick-nora` or with no mound | `poco-grande`, `hurricane`, `goblet` or a coupe with a proud mound |

### 5.5 Vessel and volume

| id | sev | flag | fix |
|---|---|---|---|
| `volume-overflow` | fatal | Pre-dilution liquid above the vessel's range (§1.5). The generator produced 16.8 oz finished in a 13 oz collins | Rescale, or choose a larger vessel |
| `volume-stingy` | major | Pre-dilution liquid below the range (the 3.3 oz finished colada in a 12 oz poco grande) | Rescale up, or a smaller vessel |
| `up-drink-in-mug` | major | Strained-up drink in an opaque tiki mug or fruit shell | Coupe or Nick & Nora |
| `colada-in-coupe` | minor | Colada or creamy blended drink served up in a coupe (allowed only for a stirred "deconstruction") | Hurricane, poco grande, snifter, coconut, pineapple |
| `fruit-vessel-for-up` | major | `coconut` or `pineapple` shell for a stirred or up drink | Crushed-ice long drinks only |
| `stirred-on-crushed` | major | `stirred` family over crushed ice | Large block, or up |

### 5.6 Garnish

| id | sev | flag | fix |
|---|---|---|---|
| `garnish-excluded-ingredient` | fatal | Garnish shows an ingredient the prayer excluded ("no pineapple" + pineapple wedge) | Remove it |
| `garnish-contradicts-recipe` | major | Fruit garnish is the only signal of a flavor the drink lacks, in a family where it isn't the conventional flag (pineapple wedge + fronds on a coffee-chocolate drink; orange wheel on a drink with no orange in a gentle "floral" up serve) | Garnish from what's in the glass, or use a neutral decorative |
| `garnish-duplicate` | minor | Two items of the same garnish type (mint sprig + mint bouquet) | Keep one |
| `garnish-missing-aroma` | major | The archetype's defining aroma is absent (Mai Tai mint + shell, Painkiller nutmeg, Queen's Park crown, Zombie mint, hot nutmeg or cinnamon) | Add it |
| `garnish-heavy-on-up` | major | Mint bouquet, umbrella, pineapple wedge with fronds, or > 1 element on a coupe, Nick & Nora or cocktail glass | One small element, or none |
| `garnish-rim` | minor | Salt or sugar rim on a tiki drink (li hing mui with li hing excepted) | Remove |
| `garnish-whipped-cream` | minor | Whipped cream on a non-dessert drink | Remove |
| `garnish-clutter` | minor | More elements than the vessel allows (§4.1); orchid + brandied cherry + umbrella on an "elegant" drink | Edit down |
| `mint-without-dome` | minor | Mint bouquet on a cubed or up drink | Crushed dome, or a single leaf |
| `cherry-in-mai-tai` | minor | Cherry or flag on a Mai Tai | Lime shell + mint |
| `nutmeg-on-tart-sour` | minor | Grated nutmeg on a lean, lime-forward up sour | Nutmeg goes on rich, creamy, punch and hot drinks |

### 5.7 Color and look

This is a summary. The detailed optics belong to the color/gradient workstream. Physics marked [H] is subtractive color mixing and density.

| id | sev | flag | why | fix |
|---|---|---|---|---|
| `blue-goes-green` | major | `blue-curacao` with amber or dark rum, `orange`, `pineapple-juice`, `mango-nectar`, `passion-fruit-*`, `banana-liqueur` or a yellow liqueur, described as "blue" | Blue + yellow/amber = green or teal [H]. Yee's Blue Hawaii with pineapple is really aqua-turquoise | Clear bases (light rum, vodka, gin, lime, coconut white) for true blue. Call pineapple versions "aqua" or "turquoise." Never blue + dark rum (swamp) |
| `blue-plus-dark-rum` | fatal | `blue-curacao` with any dark rum (`rum-jamaican-dark`, `rum-black-blended`, `rum-demerara`, `rum-navy`, overproof black or Demerara) | Swamp green-brown in the glass; the classic "blue + dark rum = murky green" tell | Clear base only for blue drinks |
| `blue-plus-red` | major | `blue-curacao` + `grenadine` mixed | Purple-brown mud | Separate them by density: sink the grenadine, or float blue over a pale base |
| `color-name-lie` | major | Name or copy color word not produced by the ingredients ("Jade Gecko" brown with vermouth, amaro and Angostura) | Dishonest | Choose color words from the computed color |
| `red-zombie-or-mai-tai` | major | Zombie or Mai Tai that reads red or pink | Grenadine abuse | Amber or copper; ≤ 1 tsp grenadine |
| `opacity-lie` | minor | "Crystal-clear" copy on drinks with pineapple, coconut, orange, banana, egg or cream; or "creamy" on a clear drink | These are opaque or cloudy | Copy from the optics |
| `coffee-citrus-mud` | minor | `coffee`, `coffee-liqueur` or `creme-de-cacao` with ≥ ¾ oz lime or lemon | Brown and sour clash | Coffee goes with coconut, cream, spice and orange *peel* |
| `angostura-brown-wash` | minor | > 3 dashes mixed into a pale or white drink | Turns it beige or brown | A crown on top instead, or 1–2 dashes |
| `midori-orange-mud` | minor | `melon-liqueur` with `orange` or dark rum | Olive-brown | Melon with pineapple, lime or a clear base |

### 5.8 Copy and naming

| id | sev | flag | fix |
|---|---|---|---|
| `noun-claim-false` | fatal | Name contains a type noun whose requirements aren't met (see the `nameNouns` table in §11) | Use a noun the drink earns |
| `phantom-flavor` | major | Tagline or tasting headlines a flavor that comes only from a *secondary tag* of a base spirit ("banana" because Jamaican rum is tagged banana; "lychee" from elderflower; "almond" from falernum) or from nothing at all | Headline flavors must come from an ingredient whose *first* tag it is, at a tasteable dose. Secondary notes may appear hedged ("a banana-ish funk from the Jamaican rum") |
| `adjective-soup` | major | "A funky, banana, tropical tropical punch": repeated words, a flavor-tag list as tagline, or "tropical" twice | Write a sentence with a verb, at most two flavor words, and a story beat |
| `label-names-absent-ingredient` | fatal | The family descriptor names an ingredient that is absent ("orgeat punch" without orgeat) | Describe what is in it ("a brandy-and-orange punch"), or fix the recipe |
| `prayer-ignored` | fatal | Different prayers produce the same drink ("heartbreak" and "a rainy afternoon with a good book" got identical recipes; "Gilligan's Island," "pirate's treasure" and "celebrating a promotion" got one drink), or the prayer's concrete nouns (Tokyo, garden, sunset, dragon, Elvis) leave no trace in the ingredients, look, vessel or garnish | Map the prayer to at least one ingredient choice and one presentation choice, and say which in the explanation |
| `sacred-or-offensive` | major | Real deity names used as jokes (Pele, Ku, Lono, Kāne, Kanaloa), "savage," "cannibal," "headhunter," "witch doctor," sexualized hula imagery, or faux-Polynesian gibberish words | Modern tiki keeps the escapism and drops the caricature (Smuggler's Cove; Cate; the Tropical Standard reframing). The repo's `names.js` already prefers nautical, botanical and weather imagery | Use nautical, botanical, weather, rum-geography and adventure imagery; volcanoes and fire without naming a goddess |
| `false-provenance` | major | "Don's original," "Vic's secret recipe" or "since 1934" on a generated drink | Lying about history | "In the Beachcomber manner…" |
| `classic-name-misuse` | fatal | Calling a drink a Mai Tai, Zombie, Painkiller, Navy Grog or Jungle Bird when it isn't a riff of that spec | Classic names are specs | "X-style," or an original name |
| `strength-word-lie` | major | "Easygoing" at ≥ 15%; "potent" at ≤ 10%; "low ABV" ≥ 10% | Copy from the numbers |
| `creamy-without-cream` | major | "Creamy," "velvet" or "silken" with no `coconut-cream`, `coconut-milk`, dairy, egg, banana or ice cream | Copy from the ingredients |
| `rich-for-lean` | minor | "Rich" for a lean, dry sour | Copy from the numbers |
| `cliche-copy` | minor | "Explosion of flavor," "tropical paradise in a glass," "perfect for any occasion," "a symphony of," "tantalizing" | Write like a 1950s menu: specific, wry, short |
| `possessive-mad-libs` | minor | Awkward generated forms like "The Squall's Hideaway," "The Shipwreck's Relic," "X of San Juan" with no San Juan rum | Two-word evocative names; place words only when the rum or prayer earns them |
| `copy-too-long` | minor | Tagline > 20 words, or a tasting note > 3 sentences | Trim |

---

## 6. Naming and copy

### 6.1 How the classic menus wrote

Real lines (verified):

- **Trader Vic's, 1968, Scorpion Bowl:** *"A Festive Concoction Of Rums, Fruit Juices And Brandy, With A Whisper Of Almond, Bedecked With Gardenias And Served With Long Straws."* [H] Note that every flavor word is true (rums, juices, brandy, orgeat-as-"almond"), and it ends with the service theater.
- **Trader Vic's Fog Cutter (1940s postcard):** *"What a sneaker — positively only two to a person; really, I don't see why people buy them."* [M] Also the famous *"Fog Cutter, hell. After two of these, you won't even see the stuff."* [H]
- **Vic on the Scorpion:** *"a drink which does not shilly-shally or mess around in getting you under way."* [M]
- **Don the Beachcomber's Zombie:** a two-per-customer limit, and Donn called it *"a mender of broken dreams"* [M].
- **Mai Tai:** named for the Tahitian *"Maita'i roa ae!"* ("out of this world, the best"), Vic's guests' reaction in 1944 [H].
- **The Mai-Kai (Fort Lauderdale)** groups drinks as **mild, medium and strong**, with lines like "only for the sturdy" (151 Swizzle) and "dangerous and deadly" (Shrunken Skull) [M].
- Modern craft menus (Smuggler's Cove and its descendants) usually pair a short name with a terse, truthful component list, sometimes with a one-line story.

**The register:**

- one sentence, 8–20 words
- wry, hyperbolic about *strength* and *effect*, honest about *contents*
- names the base and one or two signature components in plain, evocative words: "a whisper of almond," "Jamaican rum," "honey and grapefruit"
- often closes on service theater: the vessel, flowers, fire, long straws
- warnings are jokes that are also true

### 6.2 How names relate to the drink

| naming mode | examples [H] | rule for the generator |
|---|---|---|
| danger / hyperbole | Zombie, Scorpion, Cobra's Fang, Shrunken Skull, Suffering Bastard, Missionary's Downfall, Never Say Die, Test Pilot, Jet Pilot | Reserve for strong drinks (≥ 15%) |
| place / voyage / navy | Navy Grog, Port Light, Queen's Park Swizzle, Fog Cutter, Pearl Diver, Port au Prince | Place words must match the rum's origin, the prayer, or the vessel's story |
| garnish- or vessel-coded | Three Dots and a Dash (the garnish spells "V"), Pearl Diver (the glass), Pi Yi (served in a pineapple), Volcano Bowl, Scorpion Bowl | Great when the presentation earns it: the name can point at the garnish |
| ingredient-honest | Piña Colada ("strained pineapple"), Banana Daiquiri, Coffee Grog, Hot Buttered Rum | An ingredient word must name a leading ingredient |
| period / pop | Saturn (Apollo Saturn V; first named X-15, 1967) [H], Jungle Bird (the Aviary Bar, KL Hilton, 1973) [H] | Prayer-driven pop references belong here |
| Polynesian words (historical) | Mai Tai, Nui Nui | Do not coin pseudo-Polynesian words. Using real words requires knowing their meaning |

**Name rules:**

- 1–4 words.
- A type noun (Colada, Grog, Swizzle, Punch, Sour, Buck, Cooler, Bowl, Toddy, Flip, Fizz, Nightcap) only if earned (§11 `nameNouns`).
- A color word only if the computed color matches.
- Flavor adjectives only from leading ingredients.
- A classic's name only for a true riff.
- Avoid repeating the generator's Mad-Libs template in a single session.

### 6.3 Copy that reads real, and copy that reads fake

**Real** (built from the repo's ingredients):

- *"Navy rum, pineapple and orange over cream of coconut, with a snowfall of nutmeg. Prescribed for Sundays."* (Painkiller-style)
- *"Three rums, grapefruit and cinnamon, with a whisper of anise. We'll serve you two, and then we'll call you a cab."* (Zombie-style)
- *"Demerara rum, honey and white grapefruit poured around a cone of ice. A sailor's ration, promoted."* (grog)
- *"Gin, lemon, honey and elderflower over crushed ice with a crown of mint. Pick it at dawn."* (garden)

**Fake** (all observed in the generator):

- *"A funky, banana, tropical tropical punch."* That is adjective soup, a phantom banana and a repeated word.
- *"A smoky, agave, earthy orgeat punch."* There is no orgeat in the glass.
- *"A coconut, creamy, rich colada."* The recipe was rum + ½ oz cream of coconut: not creamy, not rich, no pineapple.

**Tasting-note shape:** three beats, mapped to real components in order of impact.

1. **Nose:** the aroma garnish or float.
2. **Palate:** base + lead modifier + acid.
3. **Finish:** a spice, bitter or wood note.

Then one sentence on strength in human terms ("about a glass of wine's worth of strength per sip, and there's a lot of sip").

### 6.4 Tying copy to the prayer (sketch; deep prayer analysis is another workstream)

The explanation should name the *move* the prayer caused, for example:

- *heartbreak* → bittersweet (Campari or grapefruit) softened by honey, in a skull mug. "Something to hold onto."
- *grandmother's garden* → gin or agricole, honey, lemon, mint, elderflower, cucumber; a gentle orchid or mint garnish; soft green-gold.
- *sunset* → a passion and orange body with a grenadine sink: an actual gradient.
- *Tokyo neon* → yuzu, lychee and Japanese whisky are not all in the vocabulary. Use `yuzu-juice` + `lychee-liqueur` + gin, crystal-clear and bright, with a flag in the copy.

Different prayers must not collapse onto one drink.

---

## 7. Quick reference: signature specs to calibrate against (from the repo catalogue, sourced)

| drink (source) | spec | method / ice / glass | garnish |
|---|---|---|---|
| Mai Tai (Vic 1944) | 2 aged Jamaican, 1 lime, ½ orange curaçao, ½ orgeat, ¼ rock candy (rich) | shake, shaved, DOF | spent lime shell + mint |
| Zombie (Don 1934, Berry decode) | 1½ gold PR, 1½ Jamaican, 1 151 Demerara, ¾ lime, ½ Don's Mix, ½ falernum, 1 tsp grenadine, 6 drops Pernod, dash Angostura | flash-blend 5 s, crushed; chimney topped with cubes | mint |
| Navy Grog (Don, Berry) | 1 each light PR, dark Jamaican, Demerara; ¾ lime, ¾ white grapefruit, ¾ soda, 1 honey mix | shake; DOF around an ice cone | the cone and straw |
| Queen's Park Swizzle | 2–3 Demerara, ¾–1 lime, ¾ demerara syrup or 1 simple, 8–12 mint leaves, 4–8 dashes Angostura on top | swizzle, crushed, collins | mint + bitters crown |
| Painkiller (Pusser's) | 2 Pusser's (navy), 4 pineapple, 1 orange, 1 cream of coconut; nutmeg | shake, cubes; tin or tall glass | nutmeg (+ orange wheel, cherry) |
| Piña Colada (Caribe Hilton) | 2 white rum, 1 cream of coconut, 1 heavy cream, 6 pineapple | blend | pineapple wedge + cherry |
| Jungle Bird (KL Hilton 1973) | 1½ dark Jamaican, ¾ Campari, 4 pineapple, ½ lime, ½ simple (modern González: 1½ blackstrap, ¾ Campari, 1½ pineapple, ½ lime, ½ demerara) | shake; bird vessel or DOF | pineapple wedge, orchid (modern) |
| Hurricane (Berry / Cate) | 4 dark Jamaican or black, 2 lemon, 2 passion syrup | shake or flash-blend; hurricane | orange + cherry, or an umbrella in a lemon wedge |
| Three Dots and a Dash (Don) | 1½ aged agricole, ½ Demerara, ½ lime, ½ orange, ½ honey, ¼ falernum, ¼ allspice, dash Angostura | flash-blend, crushed, tulip or pilsner | three cherries + pineapple chunk |
| Saturn (Galsini 1967) | 1¼–1½ gin, ½–¾ lemon, ½ passion syrup, ¼ falernum, ¼ orgeat | blend, crushed; pilsner (or coupe) | lemon-peel ring around a cherry |
| Scorpion (Vic, single) | 2 light rum, 1 brandy, 2 orange, 1½ lemon, ½ orgeat | flash-blend | gardenia |
| Fog Cutter (Vic) | 2 light rum, 1 brandy, ½ gin, 2 lemon, 1 orange, ½ orgeat, ½ amontillado float | shake, crushed, 14 oz glass or Fog Cutter mug | straws |
| Missionary's Downfall (Berry) | 1 light rum, ½ peach liqueur, 1 honey, ½ lime, 1 pineapple (or ⅓ cup fresh chunks), mint leaves | blend | mint |
| Chartreuse Swizzle (Dionysos) | 1¼ Green Chartreuse, ½ falernum, 1 pineapple, ¾ lime | swizzle, collins | mint + nutmeg |
| Blue Hawaii (Yee 1957) | ¾ light rum, ¾ vodka, ½ blue curaçao, 3 pineapple, 1 sweet-and-sour (= ½ lemon + ½ simple fresh) | shake, crushed, hurricane | pineapple wedge + umbrella |
| Rum Runner (Berry) | ¾ overproof white, ⅞ blackberry liqueur, ⅞ banana liqueur, ⅝ grenadine, 1½ lime | blend | lime wheel + cherry |

---

## 8. Audit: what the generator got wrong (battery at commit 1de2045, seed 0)

This is what the aficionado saw. Each row maps to the red flags it trips.

| prayer | what came out | flags |
|---|---|---|
| a colada for a lazy sunday | 1½ white rum + ½ cream of coconut, 3.3 oz in a 12 oz poco grande, pineapple garnish | `colada-no-coconut-or-pineapple`, `volume-stingy`, `garnish-contradicts-recipe`, `creamy-without-cream` ("creamy, rich") |
| something creamy and coconutty | light rum, pineapple, coconut rum, 1¼ half-and-half, cream of coconut | `coconut-pileup` |
| a mai tai but tropical | Jamaican Mai Tai + passion liqueur; tagline "banana"; mint sprig + mint bouquet | `phantom-flavor`, `garnish-duplicate` |
| zombie | gold + Jamaican + 151; ¼ oz grenadine + ¼ maraschino; **no falernum** | `zombie-weak-structure` (falernum), `grenadine-for-color` (¼ oz vs 1 tsp) |
| navy grog but with bourbon | edible orchid on a grog | `garnish` "never" for grog (orchid) |
| painkiller but less sweet | navy rum, pineapple, orange, cream of coconut, ¼ lime, nutmeg, enamel tin | passes (the one acceptable result) |
| scorpion bowl for 4 | two light rums, no brandy, orange-wheel garnish | `scorpion-without-brandy`, rum blend lacks contrast |
| hot buttered rum | raw ¼ oz butter + cinnamon syrup; sugar 2.3 g; "banana" tagline | `raw-butter`, `hot-too-dry-or-strong`, `phantom-flavor` |
| a frozen banana drink | daiquiri + ¾ oz grenadine + banana liqueur; no real banana; brandied cherry | `fruit-named-absent` (frozen requires real banana), `grenadine-for-color` |
| mezcal and passion fruit | "orgeat punch" with no orgeat | `orgeat-punch-without-orgeat`, `label-names-absent-ingredient` |
| bananas foster in a glass | grapefruit grog | `dessert-without-dessert` |
| coffee and rum, stirred | 2¾ rum + 1½ brewed coffee stirred, 6.6 oz in an 8 oz rocks glass | `brewed-coffee-cold-stirred`, `volume-overflow` |
| ginger and lime highball | buck "shake" with ginger beer | `shaken-carbonation` |
| heartbreak / rainy afternoon | identical recipes | `prayer-ignored` |
| first date at the beach | cranberry cocktail + grenadine + blackberry liqueur | `cranberry-in-tiki`, `redundant-red-fruit` |
| my grandmother's garden | Campari + 2 dashes absinthe + pineapple | `bitter-stack-in-gentle-drink` |
| a drink that tastes like a sunset | coupe daiquiri with grenadine + Campari; mint sprig + orange wheel on a coupe | `garnish-heavy-on-up`, `layer-claim-shaken` (no gradient for a "sunset") |
| something blue for the pool | blue curaçao + pineapple, called blue | `blue-goes-green` (it's aqua) |
| layered and pretty, like a sunrise | shaken bitter-tiki; no float or sink | `layer-claim-shaken`, `prayer-ignored` |
| green like the jungle | dry vermouth + amaro + 5 Angostura → brown, named "Jade" | `color-name-lie` |
| Havana 1957 | falernum daiquiri with a mint bouquet on a coupe | `garnish-heavy-on-up`, `mint-without-dome` |
| Tokyo neon | gin-orgeat-maraschino coupe; orchid + brandied cherry | `prayer-ignored`, `garnish-clutter` |
| Elvis in Blue Hawaii | no blue curaçao | `named-reference-ignored` |
| Gilligan / pirate's treasure / promotion | one identical resort punch | `prayer-ignored` |
| the strongest drink you dare | 5 oz of rum incl. two overproofs; 16.8 oz finished in a 13 oz collins | `overproof-overdose`, `volume-overflow` |
| low abv for brunch | buck "shake" with soda; 10.3% | `shaken-carbonation`, `abv-out-of-band` (low-ABV target ≤ 8%) |
| a punch bowl for a party of 8 | orgeat punch on crushed ice in a ladled punch bowl, no brandy | `punchbowl-crushed`, `scorpion-without-brandy`-type thinness |
| something floral and elegant | elderflower daiquiri + orchid + brandied cherry on a coupe | `garnish-clutter`, `phantom-flavor` ("lychee") |
| chocolate and coffee dessert drink | "colada" with OJ, coffee liqueur, cacao, cream of coconut, *pineapple* garnish | `colada-no-coconut-or-pineapple` (no pineapple), `garnish-contradicts-recipe`, `coffee-citrus-mud`-adjacent |
| something my dad would like | saline daiquiri with orchid + brandied cherry | `garnish-clutter` (an orchid on dad's daiquiri is a tone miss) |

Generator-level root causes (so the fixes land in the right place):

1. **Copy is generated from flavor tags, not ingredients.** Base-spirit secondary tags leak into taglines ("banana"), and family nouns are printed whether or not they are earned.
2. **Family labels are fixed strings.** The `famWord` map in `engine.js` prints "orgeat punch" and "colada" without checking contents.
3. **Garnish is chosen by family and flavor without checking the vessel and serve.** Mint bouquets end up on coupes, pineapple on drinks without pineapple, duplicates appear.
4. **Method is chosen by family and ignores carbonation.** Bucks come out "shake."
5. **Volume isn't checked against the vessel.**
6. **Prayers with no flavor words fall through to a family prior**, so many prayers yield one drink.
7. **No color model drove naming.**

The WIP commit's archetype composer (signatures, forbidden lists, ratios, looks) addresses several of these. The rules below are written to plug into that composer as validators.

---

## 9. Missing ingredients (proposals; not added to the repo)

| proposed id | name | abv | sugar g/100 ml | acid g/100 ml | avail | why |
|---|---|---|---|---|---|---|
| `egg-whole` | Whole egg | 0 | 0.4 | 0 | common | Flips, nogs and the Tom and Jerry batter. `tom-and-jerry` currently proxies with `egg-white`, which makes a different drink |
| `fassionola` | Fassionola (red tropical-fruit syrup) | 0 | 60 | 0.8 | specialty | Cobra's Fang and early Hurricanes; modern craft versions exist. Currently forced onto passion syrup + grenadine |
| `pineapple-fresh` | Fresh pineapple chunks (muddled or blended) | 0 | 12 | 0.8 | common | Missionary's Downfall and blended coladas call for chunks; foam and texture differ from juice; lets a pineapple garnish be "truthful" in frozen drinks |
| `lemon-extract` | Lemon extract (flaming-garnish fuel; never drunk) | 80 | 0 | 0 | common | The standard safe fire garnish (lime shell + crouton). Garnish-only, zero volume |
| `cane-syrup` | Cane syrup / sirop de canne (rich) | 0 | 85 | 0 | specialty | Ti' Punch and agricole drinks; currently proxied by `rich-simple` (acceptable) [U whether worth adding] |

---

## 10. Sources

- Dave Arnold, *Liquid Intelligence* (2014): Daiquiri chemistry, dilution curves, method clustering, shaking-time findings. Summaries via absurdlyoptimized.com, Difford's shaking guide, PopSci, Bookey/Sobrief summaries.
- Martin & Rebecca Cate, *Smuggler's Cove* (2016): flash blending, rum categories (21 categories by still and age), Hurricane umbrella-in-lemon garnish, Port Light with egg white, Top Notch Volcano fire. Via Punch "flash blend" article, cocktailwonk review, therumlab.
- Jeff Berry, *Sippin' Safari*, *Remixed*, *Intoxica!*, *Total Tiki*: Zombie decode, Navy Grog and ice cone (beachbumberry.com), Hurricane, Missionary's Downfall, Rum Runner, Blue Hawaii, Saturn, Three Dots.
- Trader Vic's *Book of Food and Drink* (1946) and *Bartender's Guide*: Mai Tai, Scorpion, Fog Cutter; menu copy via Wikipedia (Fog Cutter, Scorpion bowl).
- ultimatemaitai.com: Royal Hawaiian Mai Tai juice-drift chronology.
- Wikipedia: Harry Yee and Cocktail umbrella (orchid 1955, umbrella 1959), Piña colada, Navy Grog.
- Punch: "More Is More: The Evolution of Tiki Garnish," "The Second Coming of the Jungle Bird," whip-shake history.
- VinePair: spanking mint (Toby Maloney), swizzling technique (bois lélé), Queen's Park Swizzle.
- Pusser's Rum: Painkiller 4:1:1 and history.
- Difford's Guide: Jungle Bird original (1973 KL Hilton, Jeffrey Ong), Bahama Mama (contested origin), Hurricane original.
- cocktailwonk.com "Stop setting rum on fire"; lemon-extract crouton technique.
- Dairy and acid: Artisan Spirit Magazine; artofdrink; Tasting Table (casein, pH 5.5, heavy cream exception, Cement Mixer).
- Passion fruit acidity: Embrapa / Brazilian juice standards (≥ 2.5 g/100 g citric; pulp TA 3.7–4.5).
- Citrus freshness: Tales of the Cocktail ("Don't use your citrus juice immediately").
- Saline practice: Saveur/PopSci "Why you should add salt"; *Tropical Standard* specs in the repo catalogue.
- The repo's own `data/drinks.json` (1,070 sourced records), `data/model.json` (family statistics, PMI) and `data/archetypes.json`.

---

## 11. Machine rules (JSON)

Conventions:

- Amounts are oz per single serving, matching `data/ingredients.json` units (`dash` = 0.03 oz, `drop` = 0.003 oz, `tsp` = 0.1667 oz).
- "Components" means non-garnish recipe lines.
- "Seasonings" means lines measured in dashes, drops, pinches or rinses.
- Metrics are post-dilution as computed by `web/lib/chem.js`.
- `when` filters: `family`, `nameNoun`, `method`, `vessel`, `prayerTone`, `prayerAsks`.
- Rule kinds:
  - `requireAny` (at least one id, optionally `minOz`)
  - `requireAll`
  - `forbid`
  - `maxOz`
  - `minOzIfPresent`
  - `maxCountOf` (a set)
  - `pairForbidden` (a × b, with `unless`)
  - `methodForbiddenFor` (ids × methods, unless marked `top`)
  - `range` (metric bounds)
  - `vesselFit`
  - `custom` (described in `check`; implement in code)

```json
{
  "version": 1,
  "about": "Tiki technique, balance and red-flag rules for the Tiki God generator. Ids match data/ingredients.json, data/families.json, data/vessels.json. Amounts are oz per single serving; metrics are post-dilution (web/lib/chem.js).",
  "sets": {
    "rums": ["rum-white-column","rum-gold-column","rum-aged-column","rum-blended-light","rum-barbados","rum-jamaican-aged","rum-jamaican-dark","rum-jamaican-pot","rum-jamaican-white-overproof","rum-demerara","rum-demerara-overproof","rum-black-blended","rum-black-overproof","rum-agricole-blanc","rum-agricole-vieux","rum-haitian","rum-navy","rum-overproof-white","rum-spiced","rum-pineapple","rum-cachaca"],
    "spirits": ["rum-white-column","rum-gold-column","rum-aged-column","rum-blended-light","rum-barbados","rum-jamaican-aged","rum-jamaican-dark","rum-jamaican-pot","rum-jamaican-white-overproof","rum-demerara","rum-demerara-overproof","rum-black-blended","rum-black-overproof","rum-agricole-blanc","rum-agricole-vieux","rum-haitian","rum-navy","rum-overproof-white","rum-spiced","rum-pineapple","rum-cachaca","gin","gin-old-tom","bourbon","rye","scotch-blended","scotch-islay","irish-whiskey","brandy","applejack","pisco","tequila-blanco","tequila-reposado","mezcal","vodka","aquavit","batavia-arrack","okolehao"],
    "overproof": ["rum-demerara-overproof","rum-black-overproof","rum-overproof-white","rum-jamaican-white-overproof"],
    "agedOrFunkyRum": ["rum-aged-column","rum-barbados","rum-jamaican-aged","rum-jamaican-dark","rum-jamaican-pot","rum-demerara","rum-agricole-vieux","rum-navy","rum-black-blended"],
    "primaryCitrus": ["lime","lemon"],
    "strongAcids": ["lime","lemon","grapefruit","yuzu-juice","passion-fruit-juice","lime-cordial"],
    "mildAcids": ["pineapple-juice","cranberry-juice","pomegranate-juice","orange"],
    "caseinDairy": ["half-and-half","irish-cream","vanilla-ice-cream"],
    "allDairy": ["heavy-cream","half-and-half","irish-cream","vanilla-ice-cream","butter"],
    "coconutSources": ["coconut-cream","coconut-milk","coconut-rum","coconut-water"],
    "coconutBody": ["coconut-cream","coconut-milk"],
    "carbonated": ["soda-water","ginger-beer","ginger-ale","cola","tonic","lemon-lime-soda","sparkling-wine"],
    "orangeLiqueurs": ["orange-curacao","triple-sec","blue-curacao"],
    "plainSyrups": ["simple-syrup","rich-simple","demerara-syrup","agave-syrup","maple-syrup"],
    "redFruit": ["grenadine","raspberry-syrup","raspberry-liqueur","blackberry-liqueur","creme-de-cassis","cranberry-juice","pomegranate-juice","hibiscus-syrup","sloe-gin"],
    "passionSources": ["passion-fruit-syrup","passion-fruit-juice","passion-fruit-nectar","passion-fruit-liqueur"],
    "aggressiveBitter": ["campari","amaro","cynar","fernet","absinthe","pastis"],
    "bitterLiqueurs": ["campari","aperol","amaro","cynar","fernet"],
    "anise": ["absinthe","pastis"],
    "spiceCarriers": ["rum-spiced","allspice-dram","cinnamon-syrup","five-spice-syrup","dons-spices-2","clove","tiki-bitters"],
    "sweetLiqueurs": ["orange-curacao","triple-sec","blue-curacao","maraschino","apricot-liqueur","peach-liqueur","cherry-heering","banana-liqueur","blackberry-liqueur","raspberry-liqueur","creme-de-cassis","coffee-liqueur","creme-de-cacao","galliano","benedictine","yellow-chartreuse","drambuie","elderflower-liqueur","allspice-dram","velvet-falernum","passion-fruit-liqueur","coconut-rum","amaretto","hazelnut-liqueur","licor-43","irish-cream","ginger-liqueur","melon-liqueur","lychee-liqueur","swedish-punsch"],
    "bulkJuices": ["pineapple-juice","orange","passion-fruit-nectar","guava-nectar","mango-nectar","papaya-nectar","apricot-nectar","cranberry-juice","pomegranate-juice","apple-juice","coconut-water","watermelon-juice"],
    "seasonings": ["angostura","peychauds","orange-bitters","tiki-bitters","mole-bitters","pastis","absinthe","saline","orange-flower-water","vanilla-extract","almond-extract","clove","nutmeg","cinnamon"],
    "accentsAllowedBelowQuarter": ["angostura","peychauds","orange-bitters","tiki-bitters","mole-bitters","pastis","absinthe","saline","orange-flower-water","vanilla-extract","almond-extract","grenadine","maraschino","allspice-dram","green-chartreuse","yellow-chartreuse","velvet-falernum","falernum-syrup","cinnamon-syrup","ginger-syrup","rich-simple","demerara-syrup","simple-syrup","honey-syrup","dons-spices-2","gardenia-mix","five-spice-syrup","li-hing-mui-syrup","peach-liqueur","apricot-liqueur","cherry-heering","coconut-rum","rum-jamaican-pot","rum-demerara-overproof","rum-jamaican-white-overproof","fernet","campari","scotch-islay","mezcal","amontillado-sherry","vanilla-syrup","maple-syrup","agave-syrup"],
    "yellowOrAmber": ["pineapple-juice","orange","mango-nectar","passion-fruit-juice","passion-fruit-syrup","passion-fruit-nectar","banana-liqueur","galliano","yellow-chartreuse","licor-43","apricot-nectar","papaya-nectar","guava-nectar","rum-aged-column","rum-barbados","rum-jamaican-aged","rum-jamaican-dark","rum-jamaican-pot","rum-demerara","rum-demerara-overproof","rum-black-blended","rum-black-overproof","rum-agricole-vieux","rum-navy","rum-spiced","bourbon","rye","brandy","tequila-reposado","demerara-syrup","honey-syrup","maple-syrup","orgeat"],
    "darkSpirits": ["rum-jamaican-dark","rum-black-blended","rum-black-overproof","rum-demerara","rum-demerara-overproof","rum-navy"],
    "clearBases": ["rum-white-column","rum-blended-light","rum-agricole-blanc","vodka","gin","tequila-blanco","pisco","rum-cachaca","lime","lemon","coconut-cream","coconut-milk","soda-water","lemon-lime-soda","triple-sec","simple-syrup","rich-simple"],
    "opaqueMakers": ["pineapple-juice","orange","coconut-cream","coconut-milk","heavy-cream","half-and-half","egg-white","vanilla-ice-cream","banana","irish-cream","mango-nectar","guava-nectar","papaya-nectar","apricot-nectar","passion-fruit-juice","strawberry","orgeat"],
    "creamyMakers": ["coconut-cream","coconut-milk","heavy-cream","half-and-half","egg-white","vanilla-ice-cream","banana","irish-cream","gardenia-mix","hot-buttered-rum-batter"],
    "heatSafeVessels": ["hot-mug","irish-coffee"],
    "upVessels": ["coupe","nick-nora","cocktail-glass"],
    "opaqueVessels": ["ku-mug","moai-mug","skull-mug","barrel-mug","fog-cutter-mug","bird-mug","coconut","pineapple","clay-cup","hot-mug","enamel-tin","copper-mug","julep-cup","tiki-bowl","volcano-bowl"],
    "bowlVessels": ["scorpion-bowl","tiki-bowl","volcano-bowl","punch-bowl"],
    "crushedIce": ["crushed","pebble","shaved","ice-cone","blended"]
  },

  "familyWindows": {
    "punch":            {"abv": [11, 15.5], "sugarToAcid": [8.5, 14],  "acidConc": [0.55, 0.85], "sugarConc": [6.5, 9.5], "maxComponents": 7,  "typicalComponents": 5, "maxSpiritOz": 3},
    "grog":             {"abv": [12, 16.5], "sugarToAcid": [7, 12],    "acidConc": [0.6, 0.95],  "sugarConc": [5.5, 8.5], "maxComponents": 8,  "typicalComponents": 7, "maxSpiritOz": 3},
    "daiquiri":         {"abv": [13, 18],   "sugarToAcid": [7, 11.5],  "acidConc": [0.65, 0.95], "sugarConc": [6, 9.5],   "maxComponents": 5,  "typicalComponents": 4, "maxSpiritOz": 2.25},
    "swizzle":          {"abv": [12.5, 17.5],"sugarToAcid": [8, 14],   "acidConc": [0.55, 0.85], "sugarConc": [6.5, 10],  "maxComponents": 6,  "typicalComponents": 5, "maxSpiritOz": 3},
    "zombie":           {"abv": [15, 19],   "sugarToAcid": [6.5, 11],  "acidConc": [0.55, 0.85], "sugarConc": [5, 8],     "maxComponents": 11, "typicalComponents": 9, "maxSpiritOz": 4},
    "beachcomber-sour": {"abv": [12.5, 16], "sugarToAcid": [8.5, 13],  "acidConc": [0.6, 0.85],  "sugarConc": [6.5, 9],   "maxComponents": 9,  "typicalComponents": 7, "maxSpiritOz": 3},
    "mai-tai":          {"abv": [14.5, 17], "sugarToAcid": [8.5, 12],  "acidConc": [0.7, 0.95],  "sugarConc": [7, 9.5],   "maxComponents": 7,  "typicalComponents": 6, "maxSpiritOz": 2.5},
    "orgeat-punch":     {"abv": [10.5, 14.5],"sugarToAcid": [6, 11],   "acidConc": [0.7, 1.0],   "sugarConc": [5.5, 8],   "maxComponents": 8,  "typicalComponents": 6, "maxSpiritOz": 3.5},
    "colada":           {"abv": [7, 12],    "sugarToAcid": [15, 45],   "acidConc": [0.1, 0.45],  "sugarConc": [8, 11],    "maxComponents": 6,  "typicalComponents": 4, "maxSpiritOz": 2.5},
    "buck":             {"abv": [8.5, 12.5],"sugarToAcid": [8, 16],    "acidConc": [0.3, 0.65],  "sugarConc": [4.5, 8],   "maxComponents": 6,  "typicalComponents": 4, "maxSpiritOz": 2.5},
    "resort-punch":     {"abv": [8.5, 12.5],"sugarToAcid": [9.5, 15],  "acidConc": [0.5, 0.8],   "sugarConc": [7, 10],    "maxComponents": 8,  "typicalComponents": 6, "maxSpiritOz": 3},
    "bitter-tiki":      {"abv": [12, 17],   "sugarToAcid": [11, 15.5], "acidConc": [0.5, 0.75],  "sugarConc": [7, 9.5],   "maxComponents": 7,  "typicalComponents": 5, "maxSpiritOz": 2.25},
    "stirred":          {"abv": [20, 30],   "sugarToAcid": null,       "acidConc": [0, 0.15],    "sugarConc": [3, 7],     "maxComponents": 5,  "typicalComponents": 4, "maxSpiritOz": 2.75},
    "hot":              {"abv": [7, 13],    "sugarToAcid": null,       "acidConc": [0, 0.15],    "sugarConc": [3, 7],     "maxComponents": 6,  "typicalComponents": 4, "maxSpiritOz": 2.5}
  },

  "styleOverrides": {
    "frozen":   {"appliesWhen": {"method": ["blend"]}, "sugarConc": [8.5, 12], "acidConc": [0.55, 0.85], "abv": [8, 14], "maxSpiritOz": 2.5, "sugarBoostVsShaken": [1.2, 1.5]},
    "bowl":     {"appliesWhen": {"vessel": ["scorpion-bowl","tiki-bowl","volcano-bowl","punch-bowl"]}, "abv": [9, 14], "maxSpiritOzPerGuest": 2.5, "minServings": 2},
    "lowAbv":   {"appliesWhen": {"prayerAsks": ["low abv","light","brunch","session"]}, "abv": [0.5, 8]},
    "strongest":{"appliesWhen": {"prayerAsks": ["strongest","strong","dangerous","potent"]}, "abv": [15, 19], "maxEthanolOz": 2.0},
    "zeroProof":{"appliesWhen": {"prayerAsks": ["zero-proof","alcohol-free","mocktail","designated driver"]}, "abv": [0, 0.5], "require": "acid >= 0.45 g/100ml; body source (tea, coconut, nectar, ginger beer) present; one spice or bitter-free aromatic accent"}
  },

  "dilution": {
    "formula": {"shaken": "-1.567*a^2 + 1.742*a + 0.203", "stirred": "-1.21*a^2 + 1.246*a + 0.145", "a": "pre-dilution ABV fraction"},
    "methodFactor": {"shake/cubed": 1.0, "shake/crushed": 1.15, "whip-shake": 0.75, "flash-blend": 1.3, "swizzle": 1.2, "blend": "ice is part of drink: 0.9-1.2 of pre-dilution volume", "stir": "stirred formula", "build/block": "0.8 x stirred", "build/cubes+mixer": "mixer is the dilution, +0.1-0.2", "hot": 0},
    "confidence": {"shake/cubed": "H", "stir": "H", "others": "M/U (tunable)"}
  },

  "strength": {
    "maxSpiritOzSingle": 4.0,
    "maxEthanolOzSingle": 2.0,
    "maxOverproofOz": 1.0,
    "maxOverproofOzSoleBase": 1.5,
    "maxDistinctOverproof": 1,
    "overproofIds": ["rum-demerara-overproof","rum-black-overproof","rum-overproof-white","rum-jamaican-white-overproof"]
  },

  "doseCaps": {
    "pastis":                       {"maxOz": 0.04, "typical": "6 drops", "exceptions": "rinse 0.1 oz; anise-forward request 0.25"},
    "absinthe":                     {"maxOz": 0.04, "typical": "6 drops or 2 dashes", "exceptions": "rinse 0.1 oz; anise-forward request 0.25"},
    "angostura":                    {"maxOz": 0.18, "typical": "1-2 dashes", "exceptions": "crown on crushed ice up to 0.25; bitters-base sour 1.5"},
    "peychauds":                    {"maxOz": 0.12},
    "orange-bitters":               {"maxOz": 0.12},
    "tiki-bitters":                 {"maxOz": 0.12},
    "mole-bitters":                 {"maxOz": 0.12},
    "saline":                       {"maxOz": 0.024, "typical": "2-6 drops"},
    "almond-extract":               {"maxOz": 0.012},
    "vanilla-extract":              {"maxOz": 0.03},
    "orange-flower-water":          {"maxOz": 0.012},
    "allspice-dram":                {"maxOz": 0.5, "typical": 0.25},
    "velvet-falernum":              {"maxOz": 0.75},
    "falernum-syrup":               {"maxOz": 0.75},
    "maraschino":                   {"maxOz": 0.5, "exceptions": "c.1950 Zombie riff 0.75"},
    "grenadine":                    {"maxOz": 0.5, "byFamily": {"zombie": 0.17, "mai-tai": 0, "grog": 0.17, "orgeat-punch": 0.25, "resort-punch": 1.0, "punch": 0.75}, "exceptions": "sink 0.5; Dr. Funk-type 1.0"},
    "green-chartreuse":             {"maxOz": 0.75, "exceptions": "Chartreuse Swizzle base 1.5"},
    "yellow-chartreuse":            {"maxOz": 0.75},
    "campari":                      {"maxOz": 0.75, "byFamily": {"bitter-tiki": 1.5, "stirred": 1.0}},
    "fernet":                       {"maxOz": 0.25, "exceptions": "explicit request 0.5"},
    "scotch-islay":                 {"maxOz": 0.5, "exceptions": "explicit smoky request as base 2.0"},
    "cinnamon-syrup":               {"maxOz": 0.75},
    "ginger-syrup":                 {"maxOz": 0.75},
    "blue-curacao":                 {"maxOz": 0.75, "exceptions": "Blue Hawaiian 1.0"},
    "melon-liqueur":                {"maxOz": 1.0},
    "coffee-liqueur":               {"maxOz": 1.0},
    "creme-de-cacao":               {"maxOz": 0.75},
    "banana-liqueur":               {"maxOz": 1.0},
    "coconut-rum":                  {"maxOz": 1.5, "byFamily": {"colada": 0.5}},
    "rum-jamaican-white-overproof": {"maxOz": 0.75, "exceptions": "sole base by request 1.5"},
    "coffee":                       {"maxOz": 0.75, "byFamily": {"hot": 6.0}},
    "irish-cream":                  {"maxOz": 1.0},
    "amontillado-sherry":           {"maxOz": 0.75, "exceptions": "sherry-forward low-ABV 2.0"},
    "jalapeno":                     {"note": "1-2 slices muddled; strain seeds unless 'hot' asked"}
  },

  "minDoseIfPresent": {
    "pineapple-juice": 0.5, "orange": 0.5, "passion-fruit-nectar": 0.5, "guava-nectar": 0.5, "mango-nectar": 0.5, "papaya-nectar": 0.5,
    "apricot-nectar": 0.5, "apple-juice": 0.5, "coconut-water": 0.75, "watermelon-juice": 0.75, "cranberry-juice": 0.5, "pomegranate-juice": 0.5,
    "grapefruit": 0.25, "lime": 0.25, "lemon": 0.25,
    "soda-water": 1.0, "ginger-beer": 2.0, "ginger-ale": 2.0, "cola": 2.0, "tonic": 2.0, "lemon-lime-soda": 2.0, "sparkling-wine": 2.0,
    "_exceptions": "soda-water 0.75 inside a Beachcomber grog/punch shake (Navy Grog precedent); lime 0.08-0.25 as a Ti' Punch lime coin"
  },

  "componentCounting": {
    "components": "non-garnish lines",
    "seasoningUnits": ["dash","drop","pinch","rinse"],
    "maxNonSeasoningAtOrBelowQuarterOz": 3,
    "maxNonSeasoningAtOrBelowQuarterOzZombie": 4,
    "minCoreShare": {"value": 0.6, "core": "base spirits + primary acid + main body juice/cream/mixer, as share of pre-dilution volume", "exemptFamilies": ["stirred","zombie"]}
  },

  "exclusiveGroups": [
    {"set": "orangeLiqueurs", "max": 1, "sev": "minor"},
    {"set": "plainSyrups", "max": 1, "sev": "minor"},
    {"set": "coconutSources", "max": 2, "sev": "major"},
    {"set": "redFruit", "max": 2, "sev": "minor"},
    {"set": "passionSources", "max": 2, "sev": "minor"},
    {"set": "bitterLiqueurs", "max": 1, "maxByFamily": {"bitter-tiki": 2, "stirred": 2}, "sev": "minor"},
    {"set": "anise", "max": 1, "sev": "minor"},
    {"set": "overproof", "max": 1, "sev": "fatal"},
    {"set": "spiceCarriers", "max": 3, "sev": "minor"},
    {"ids": ["lemon","lime"], "max": 1, "allowFamilies": ["zombie","punch","resort-punch"], "sev": "minor"},
    {"ids": ["heavy-cream","half-and-half","vanilla-ice-cream","irish-cream"], "max": 1, "sev": "minor"}
  ],

  "incompatibilities": [
    {"id": "casein-plus-citrus", "a": "caseinDairy", "b": "strongAcids", "sev": "fatal", "why": "curdles below ~pH 5.5"},
    {"id": "casein-plus-mild-acid", "a": "caseinDairy", "b": ["pineapple-juice","cranberry-juice","pomegranate-juice"], "unless": {"method": ["blend"]}, "sev": "minor", "why": "slow curdle/bitterness if it sits; blend and serve at once"},
    {"id": "heavy-cream-plus-heavy-citrus", "a": ["heavy-cream"], "b": ["lime","lemon","grapefruit","passion-fruit-juice"], "whenOzB": ">0.75", "sev": "major"},
    {"id": "coffee-citrus-mud", "a": ["coffee","coffee-liqueur","creme-de-cacao"], "b": ["lime","lemon"], "whenOzB": ">=0.75", "sev": "minor"},
    {"id": "blue-plus-red", "a": ["blue-curacao"], "b": ["grenadine","creme-de-cassis","raspberry-syrup","cranberry-juice","campari"], "unless": {"layered": true}, "sev": "major", "why": "purple-brown mud unless kept apart by a sink/float"},
    {"id": "blue-goes-green", "a": ["blue-curacao"], "b": "yellowOrAmber", "sev": "major", "why": "subtractive mixing: blue + yellow/amber = green/teal; may be described as aqua/turquoise but never 'blue'; never blue + dark rum", "allowIfCopyColor": ["aqua","turquoise","teal","lagoon"]},
    {"id": "blue-plus-dark-rum", "a": ["blue-curacao"], "b": "darkSpirits", "sev": "fatal", "why": "swamp green-brown"},
    {"id": "midori-orange-mud", "a": ["melon-liqueur"], "b": ["orange","rum-jamaican-dark","rum-black-blended","rum-demerara"], "sev": "minor"},
    {"id": "spiced-rum-plus-spice-stack", "a": ["rum-spiced"], "b": ["allspice-dram","cinnamon-syrup","five-spice-syrup","dons-spices-2"], "sev": "minor"},
    {"id": "passion-plus-full-lime", "a": ["passion-fruit-juice"], "b": ["lime","lemon"], "whenOzA": ">=0.75", "whenOzB": ">=0.75", "sev": "minor"},
    {"id": "egg-with-carbonation-shaken", "a": ["egg-white"], "b": "carbonated", "unless": {"carbonatedIsTop": true}, "sev": "major"}
  ],

  "methodRules": [
    {"id": "shaken-carbonation", "ids": "carbonated", "forbiddenMethods": ["shake","flash-blend","blend"], "unlessTop": true, "smallDoseException": {"ids": ["soda-water"], "maxOz": 1.0, "families": ["grog","beachcomber-sour","punch"]}, "sev": "fatal"},
    {"id": "sparkling-shaken", "ids": ["sparkling-wine"], "forbiddenMethods": ["shake","flash-blend","blend","swizzle"], "unlessTop": true, "sev": "fatal"},
    {"id": "ice-cream-shaken", "ids": ["vanilla-ice-cream"], "requiredMethod": ["blend"], "sev": "major"},
    {"id": "stirred-with-juice", "when": {"method": ["stir"]}, "forbidIds": ["lime","lemon","grapefruit","orange","pineapple-juice","passion-fruit-juice","coconut-cream","coconut-milk","heavy-cream","half-and-half","egg-white","vanilla-ice-cream","banana"], "maxOzException": {"lime": 0.25}, "sev": "major"},
    {"id": "hot-wrong", "when": {"method": ["hot"]}, "forbidIce": true, "forbidIds": "carbonated", "maxOz": {"lime": 0.25, "lemon": 0.5, "grapefruit": 0, "orange": 0.5, "pineapple-juice": 1.0}, "requireVessel": "heatSafeVessels", "sev": "fatal"},
    {"id": "swizzle-method", "when": {"family": ["swizzle"]}, "requireMethod": ["swizzle"], "requireIce": ["crushed","pebble"], "sev": "fatal"},
    {"id": "flash-blend-up", "when": {"method": ["flash-blend"]}, "forbiddenVessels": "upVessels", "unless": "ice shell (Beachcomber's Gold) or frozen mound", "sev": "major"},
    {"id": "crushed-shake-up", "when": {"method": ["shake"], "ice": ["crushed","pebble","shaved"]}, "forbiddenVessels": "upVessels", "sev": "major"},
    {"id": "frozen-vessel", "when": {"method": ["blend"]}, "allowedVessels": ["poco-grande","hurricane","goblet","snifter","coupe","pineapple","coconut","ku-mug","moai-mug","tiki-bowl","footed-pilsner","collins"], "sev": "minor"},
    {"id": "stirred-on-crushed", "when": {"family": ["stirred"]}, "forbidIce": ["crushed","pebble","shaved","blended"], "sev": "major"},
    {"id": "egg-no-dry-shake", "when": {"has": ["egg-white"]}, "requireStep": "dry shake (or flash-blend)", "sev": "minor"},
    {"id": "punchbowl-block", "when": {"vessel": ["punch-bowl"]}, "requireIce": ["block","cubed"], "sev": "minor"},
    {"id": "layer-claim", "when": {"copyClaims": ["layered","sunrise","gradient","float","sink","ombre","two-tone"]}, "requireStep": "a final float or sink line (line.float or line.sink), not shaken in", "sev": "major"},
    {"id": "float-density", "when": {"lineFlag": "float"}, "requireLine": "abv >= 35 and sugar <= 10 g/100ml, or amontillado-sherry on crushed ice", "sev": "major"},
    {"id": "sink-density", "when": {"lineFlag": "sink"}, "requireLine": "sugar >= 25 g/100ml and abv <= 30", "sev": "major"}
  ],

  "vesselFit": {
    "rule": "pre-dilution single-serving liquid oz must fall in range; bowls multiply by servings. finalOz (post-dilution) must not exceed capacity for up/no-ice service.",
    "ranges": {
      "coupe": [2.75, 4], "nick-nora": [2, 3], "cocktail-glass": [2.5, 3.5], "rocks": [2, 3.5], "dof": [3.75, 7], "highball": [3.5, 6],
      "collins": [4, 7], "chimney": [5, 7], "hurricane": [6, 10], "poco-grande": [4, 6], "footed-pilsner": [3.5, 6], "pearl-diver": [3.5, 6],
      "snifter": [5, 9], "tulip": [3.5, 5.5], "goblet": [3.5, 6], "flute": [4, 6], "irish-coffee": [5, 7], "julep-cup": [3, 5],
      "copper-mug": [5, 8], "enamel-tin": [5, 8], "ku-mug": [4, 7], "moai-mug": [5, 8], "skull-mug": [3.5, 6], "barrel-mug": [5, 8],
      "fog-cutter-mug": [6, 9], "bird-mug": [3.5, 6], "coconut": [4, 7], "pineapple": [6, 10], "clay-cup": [2.5, 3.5], "hot-mug": [6, 8.5],
      "tiki-bowl": [10, 20], "volcano-bowl": [14, 24], "scorpion-bowl": [18, 40], "punch-bowl": [40, 90]
    },
    "serviceByVessel": {
      "up": ["coupe","nick-nora","cocktail-glass"],
      "noUpService": ["ku-mug","moai-mug","skull-mug","barrel-mug","fog-cutter-mug","coconut","pineapple","hurricane","chimney","tiki-bowl","volcano-bowl","scorpion-bowl"],
      "hotOnly": ["hot-mug"],
      "sparklingOk": ["flute","coupe","collins","highball"]
    },
    "sev": {"overflow": "fatal", "stingy": "major"}
  },

  "familyRequirements": {
    "colada":           {"requireAll": [{"anyOf": ["pineapple-juice"], "minOz": 1.5}, {"anyOf": ["coconut-cream","coconut-milk"], "minOz": 0.75}], "forbid": ["campari","absinthe","pastis","fernet","cranberry-juice","grapefruit"], "maxOz": {"lime": 0.75, "lemon": 0.5}, "notes": "coconut-milk requires added sugar; coconut-rum is accent only (<=0.5 oz)"},
    "mai-tai":          {"requireAll": [{"anyOf": ["lime"], "minOz": 0.75}, {"anyOf": ["orgeat"], "minOz": 0.25}, {"anyOf": ["orange-curacao","triple-sec"], "minOz": 0.25}, {"anyOf": "agedOrFunkyRum", "minOz": 1.0}], "forbid": ["pineapple-juice","orange","grenadine","coconut-cream","coconut-rum","rum-spiced","blue-curacao","vodka","cranberry-juice"], "exceptions": "pineapple/orange allowed only for an explicit 'Royal Hawaiian' riff, labeled as such"},
    "zombie":           {"requireAll": [{"countOf": "rums", "min": 2, "excluding": "overproof"}, {"anyOf": "overproof", "minOz": 0.5, "maxOz": 1.0}, {"anyOf": ["lime"], "minOz": 0.5}, {"anyOf": ["dons-mix","grapefruit","cinnamon-syrup","passion-fruit-syrup"], "minOz": 0.25}, {"anyOf": ["velvet-falernum","falernum-syrup","maraschino"], "minOz": 0.25}], "recommend": ["angostura","pastis","grenadine (<=1 tsp)"], "forbid": ["coconut-cream","coconut-milk","coconut-rum","heavy-cream","half-and-half","vanilla-ice-cream","irish-cream","egg-white","blue-curacao","melon-liqueur","vodka","cola","lemon-lime-soda","rum-spiced","cranberry-juice"]},
    "grog":             {"requireAny": [{"allOf": ["lime","grapefruit"], "plusAnyOf": ["honey-syrup","allspice-dram","demerara-syrup"]}, {"allOf": ["lime"], "plusAnyOf": ["water","soda-water","hot-water"]}], "minRums": 1, "forbid": ["coconut-cream","heavy-cream","half-and-half","blue-curacao","melon-liqueur","cranberry-juice"]},
    "swizzle":          {"requireMethod": "swizzle", "requireAny": [{"anyOf": ["lime","lemon"], "minOz": 0.5}], "forbid": ["heavy-cream","half-and-half","vanilla-ice-cream","egg-white","irish-cream"]},
    "daiquiri":         {"requireAll": [{"anyOf": ["lime","lemon"], "minOz": 0.5}, {"anyOf": "spirits", "minOz": 1.5}], "forbid": ["heavy-cream","half-and-half","irish-cream","coconut-milk","cranberry-juice"], "maxComponents": 5, "notes": "non-rum base must be named in the title (e.g. 'tequila daiquiri'); fruit-named daiquiri must contain that fruit"},
    "orgeat-punch":     {"requireAll": [{"anyOf": ["orgeat"], "minOz": 0.25}, {"anyOf": ["lemon","lime"], "minOz": 0.5}], "recommend": ["brandy","orange","gin","amontillado-sherry"], "forbid": ["coconut-cream","heavy-cream","half-and-half","blue-curacao","melon-liqueur","cranberry-juice"]},
    "buck":             {"requireAny": [{"anyOf": ["ginger-beer","ginger-ale","soda-water","cola","tonic","lemon-lime-soda","sparkling-wine"], "minOz": 2.0}], "carbonationIsTop": true, "methodPreferred": ["build"], "forbid": ["heavy-cream","half-and-half","vanilla-ice-cream","irish-cream"]},
    "resort-punch":     {"requireAll": [{"countOf": "bulkJuices", "min": 1}, {"anyOf": ["lime","lemon","grapefruit","passion-fruit-juice"], "minOz": 0.5}], "notes": "the fun-garnish family; vodka acceptable; still needs real rum character unless prayer says otherwise"},
    "bitter-tiki":      {"requireAny": [{"anyOf": ["campari","amaro","cynar","aperol","fernet","angostura"], "minOz": 0.5}], "forbid": ["heavy-cream","half-and-half","vanilla-ice-cream","irish-cream","blue-curacao"]},
    "punch":            {"requireAll": [{"anyOf": ["lime","lemon"], "minOz": 0.5}, {"anyOf": "spirits", "minOz": 1.5}], "forbid": ["irish-cream","vanilla-ice-cream"]},
    "beachcomber-sour": {"requireAll": [{"anyOf": ["lime","lemon","grapefruit"], "minOz": 0.5}, {"anyOf": ["honey-syrup","velvet-falernum","falernum-syrup","allspice-dram","cinnamon-syrup","dons-spices-2","gardenia-mix","passion-fruit-syrup","dons-mix","orgeat"], "minOz": 0.25}], "forbid": ["heavy-cream","half-and-half","vanilla-ice-cream","irish-cream","blue-curacao","melon-liqueur","cranberry-juice"]},
    "stirred":          {"forbid": ["lime","lemon","grapefruit","orange","pineapple-juice","passion-fruit-juice","coconut-cream","coconut-milk","heavy-cream","half-and-half","egg-white","vanilla-ice-cream","banana","coffee"], "exceptions": "lime <=0.25 (Corn 'n Oil wedge squeeze); coffee only as coffee-liqueur"},
    "hot":              {"requireAny": [{"anyOf": ["hot-water","coffee","black-tea","half-and-half"], "minOz": 3.0}], "forbid": "carbonated", "maxOz": {"lime": 0.25, "lemon": 0.5}, "notes": "butter only as hot-buttered-rum-batter or gardenia-mix"}
  },

  "nameNouns": {
    "Colada":        {"require": "pineapple-juice >= 1.5 AND (coconut-cream >= 0.75 OR coconut-milk >= 0.75 + sweetener)"},
    "Piña Colada":   {"require": "colada rule AND rum or named spirit; riff only"},
    "Painkiller":    {"require": "riff of Painkiller: navy/dark rum, pineapple, orange, coconut-cream, nutmeg"},
    "Mai Tai":       {"require": "mai-tai familyRequirements; riff only"},
    "Zombie":        {"require": "zombie familyRequirements; riff only"},
    "Grog":          {"require": "grog familyRequirements OR hot rum + water + citrus/spice"},
    "Swizzle":       {"require": "method swizzle on crushed ice"},
    "Daiquiri":      {"require": "spirit + lime/lemon + sugar, no dairy, <= 5 components; non-rum base named"},
    "Punch":         {"require": "spirit + citrus + sugar + a lengthener (juice/water/soda/tea) OR bowl service"},
    "Bowl":          {"require": "servings >= 2 AND bowl vessel"},
    "Sour":          {"require": "citrus >= 0.5 oz"},
    "Cooler":        {"require": "long (>= 5 oz pre-dilution) AND carbonated or juice lengthener, served on ice"},
    "Highball":      {"require": "carbonated top >= 2.5 oz, built, tall glass"},
    "Buck":          {"require": "ginger-beer or ginger-ale >= 2 oz"},
    "Mule":          {"require": "ginger-beer >= 2 oz AND lime"},
    "Fizz":          {"require": "citrus + sugar + soda-water/sparkling top; no crushed-ice mound"},
    "Flip":          {"require": "whole egg (proposed egg-whole) or egg-white + rich sweetener; nutmeg"},
    "Nog":           {"require": "egg and/or dairy"},
    "Toddy":         {"require": "method hot"},
    "Julep":         {"require": "mint + crushed ice + julep-cup or similar"},
    "Smash":         {"require": "muddled herb/fruit + crushed ice"},
    "Old Fashioned": {"require": "stirred/built, no juice, bitters"},
    "Nightcap":      {"require": "stirred or hot, abv >= 18 or hot"},
    "Cup":           {"require": "any; generic serving noun"},
    "Sling":         {"require": "spirit + citrus + sweetener + soda or water lengthener; (cherry liqueur classic)"},
    "Swizzle Stick": {"require": "never as a drink noun"},
    "Revenant":      {"require": "abv >= 15"},
    "Specter":       {"require": "abv >= 15"},
    "Bird":          {"require": "bitter-tiki family or bird-mug vessel"}
  },

  "garnish": {
    "maxElementsByService": {"up": 1, "rocks": 1, "short-crushed": 2, "tall": 3, "mug": 3, "fruit-vessel": 3, "bowl": 5, "hot": 2},
    "aromaGarnishes": ["mint sprig","mint bouquet","grated nutmeg","cinnamon stick","expressed citrus peel","orange-peel spiral","lemon-peel ring","Angostura crown","spent lime shell","clove-studded lemon peel","cinnamon dust over fire"],
    "decorative": ["orchid","gardenia","edible flower","paper umbrella","cherry on a pick","maraschino cherry","brandied cherry","pineapple wedge and fronds","pineapple frond","orange half-wheel","lime wheel","flag (citrus slice + cherry)","swizzle stick","long straws","ice cone","ice shell"],
    "theater": ["flaming lime shell (lemon-extract crouton)","cinnamon sparks","volcano well fire"],
    "duplicates": [["mint sprig","mint bouquet","mint crown"],["maraschino cherry","brandied cherry","cherry on a pick"],["orchid","edible flower","gardenia"]],
    "needsCrushedDome": ["mint bouquet","mint sprig (tall)","paper umbrella (tall)","flaming lime shell"],
    "forbiddenOnUp": ["mint bouquet","paper umbrella","pineapple wedge and fronds","flaming lime shell","orchid + cherry together","long straws"],
    "forbiddenOnHot": ["ice","mint","umbrella","pineapple","lime wheel"],
    "fireAllowedVessels": ["ku-mug","moai-mug","skull-mug","barrel-mug","fog-cutter-mug","tiki-bowl","volcano-bowl","scorpion-bowl","coconut","pineapple","snifter"],
    "truth": {
      "rule": "A fruit garnish may not show an ingredient the prayer excluded (fatal). A fruit garnish that is the only signal of a flavor absent from the drink is major, except the conventional decorative flag/cherry-pineapple pick in punch, resort-punch, beachcomber-sour, zombie, colada, bitter-tiki families.",
      "signals": {
        "pineapple wedge and fronds": ["pineapple-juice","rum-pineapple","pineapple-syrup"],
        "orange half-wheel": ["orange","orange-curacao","triple-sec"],
        "lime wheel": ["lime","lime-cordial"],
        "spent lime shell": ["lime"],
        "lemon wheel": ["lemon"],
        "lemon-peel ring": ["lemon"],
        "grapefruit twist": ["grapefruit","dons-mix"],
        "banana slice": ["banana","banana-liqueur"],
        "strawberry": ["strawberry"],
        "passion fruit half": ["passion-fruit-juice","passion-fruit-syrup","passion-fruit-nectar","passion-fruit-liqueur"],
        "coffee beans": ["coffee","coffee-liqueur"],
        "grated nutmeg": [],
        "cinnamon stick": []
      }
    },
    "byFamily": {
      "mai-tai":          {"required": ["spent lime shell","mint sprig"], "typical": ["orchid","pineapple spear (Hawaii)"], "never": ["cherry","flag (citrus slice + cherry)","paper umbrella (alone)","dark rum float","grenadine sink"]},
      "zombie":           {"required": ["mint sprig"], "typical": ["mint bouquet","cherry on a pick","pineapple frond","flaming lime shell (mug)"], "never": ["salt rim","sugar rim","whipped cream","umbrella-and-fruit-salad"]},
      "grog":             {"required": [], "typical": ["ice cone","spent lime shell","mint sprig","rock candy stick"], "never": ["paper umbrella","orchid","flag (citrus slice + cherry)","salt rim"]},
      "beachcomber-sour": {"required": [], "typical": ["mint sprig","cherry on a pick","orange-peel spiral","gardenia","three cherries + pineapple chunk"], "never": ["salt rim","whipped cream","paper umbrella (alone)"]},
      "swizzle":          {"required": ["swizzle stick","mint sprig"], "typical": ["Angostura crown","grated nutmeg (Chartreuse)"], "never": ["paper umbrella","flag (citrus slice + cherry)","cherry"]},
      "daiquiri":         {"required": [], "typical": ["lime wheel","grapefruit twist","none"], "never": ["mint bouquet","paper umbrella","cherry (on coupe)","sugar rim","salt rim","pineapple wedge and fronds"]},
      "orgeat-punch":     {"required": [], "typical": ["gardenia","orchid","mint sprig","long straws","volcano well fire"], "never": ["umbrella-and-fruit-salad","grenadine sink","whipped cream"]},
      "colada":           {"required": ["pineapple wedge and fronds"], "typical": ["maraschino cherry","grated nutmeg","orange half-wheel","paper umbrella","orchid"], "never": ["Angostura crown","salt rim","mint bouquet"]},
      "resort-punch":     {"required": [], "typical": ["paper umbrella","orchid","pineapple wedge and fronds","maraschino cherry","orange half-wheel","flag (citrus slice + cherry)"], "never": []},
      "punch":            {"required": [], "typical": ["grated nutmeg","Angostura crown","lime wheel","mint sprig","orange half-wheel","cherry on a pick"], "never": ["sugar rim","salt rim"]},
      "buck":             {"required": ["lime wheel"], "typical": ["candied ginger","mint sprig"], "never": ["paper umbrella","grated nutmeg","cherry"]},
      "bitter-tiki":      {"required": [], "typical": ["pineapple wedge and fronds","orchid","mint sprig"], "never": ["whipped cream","grated nutmeg"]},
      "stirred":          {"required": ["expressed citrus peel"], "typical": ["cherry on a pick"], "never": ["mint bouquet","paper umbrella","fruit skewer"]},
      "hot":              {"required": ["grated nutmeg"], "typical": ["cinnamon stick","clove-studded lemon peel","orange peel"], "never": ["paper umbrella","mint","pineapple wedge and fronds","lime wheel","ice"]}
    },
    "archetypeAromaRequired": {
      "Mai Tai": ["spent lime shell","mint sprig"],
      "Painkiller": ["grated nutmeg"],
      "Queen's Park Swizzle": ["Angostura crown","mint sprig"],
      "Zombie": ["mint sprig"],
      "Navy Grog": ["ice cone"],
      "Hot Buttered Rum": ["grated nutmeg"],
      "Three Dots and a Dash": ["three cherries + pineapple chunk"],
      "Saturn": ["lemon-peel ring"]
    },
    "tackyNever": ["glitter","glow stick","gummy candy","whipped cream (non-dessert)","sugar rim (tiki)","salt rim (tiki, except li-hing-mui with li-hing-mui-syrup)","umbrella on up or stirred drink","cherry sunk in a Mai Tai","five-fruit skewer of absent fruits","garnish blocking straw"]
  },

  "copy": {
    "headlineFlavorRule": "A flavor word may headline (tagline, first sentence of tasting) only if it is the FIRST flavor tag of an ingredient present at >= its minDose (or >= 0.25 oz for liqueurs/syrups, >= 1 dash for bitters as 'spice'), or is produced by a garnish aroma (mint, nutmeg, cinnamon). Secondary tags of base spirits (e.g. banana/pineapple/tropical on Jamaican rum; lychee on elderflower; almond/ginger on falernum) may only appear hedged ('a banana-ish funk from the Jamaican rum').",
    "creamyWordsRequire": "creamyMakers",
    "colorWordsRequire": "computed drink color (optics) in the named hue family",
    "strengthWords": {"easygoing|gentle|light|breezy": [0, 11], "moderate": [10, 15], "potent|strong|dangerous|two-per-customer": [15, 20]},
    "tastingStructure": ["nose: aroma garnish or float", "palate: base + lead modifier + acid", "finish: spice/bitter/wood", "strength in human terms"],
    "taglineWords": [8, 20],
    "noRepeatedWords": true,
    "maxFlavorAdjectivesInTagline": 2,
    "bannedPhrases": ["explosion of flavor","tropical paradise in a glass","perfect for any occasion","a symphony of","tantalizing","taste buds","burst of flavor","sour mix","sweet and sour mix","margarita mix","pina colada mix","Don's original","Vic's secret recipe","authentic since"],
    "bannedNameTerms": ["Pele","Ku","Lono","Kane","Kanaloa","Savage","Cannibal","Headhunter","Witch Doctor","Native"],
    "familyLabelMustBeTrue": {"orgeat punch": ["orgeat"], "colada": ["pineapple-juice", "coconut-cream|coconut-milk"], "grog": "grog familyRequirements", "swizzle": "method swizzle", "Mai Tai cousin": "mai-tai familyRequirements", "Beachcomber-style heavyweight": "zombie familyRequirements"},
    "prayerTrace": "Every generated drink must record >= 1 ingredient decision and >= 1 presentation decision (vessel, garnish, look) caused by the prayer; two prayers with different content words must not yield identical ingredient sets at the same seed."
  },

  "colorQuick": {
    "note": "Summary for copy-truth only; detailed optics live in the color workstream.",
    "murky": [
      {"if": ["blue-curacao", "darkSpirits"], "reads": "swamp green-brown"},
      {"if": ["blue-curacao", "yellowOrAmber"], "reads": "green to teal (call it aqua/turquoise if pale)"},
      {"if": ["blue-curacao", "grenadine"], "reads": "purple-brown unless layered"},
      {"if": ["melon-liqueur", "orange"], "reads": "olive"},
      {"if": ["coffee-liqueur", "lime"], "reads": "muddy brown"},
      {"if": ["angostura>3 dashes mixed", "coconut-cream"], "reads": "beige-pink"}
    ],
    "layers": {
      "sink": "dense syrup/liqueur last, down the side: red base (grenadine/cassis/blackberry) under orange/yellow body",
      "float": "dark rum / overproof / sherry on top: dark cap fading down through crushed ice",
      "crown": "Angostura on crushed-ice dome: red-brown cap; QPS = green base (mint), gold body, red crown",
      "stormCloud": "black rum poured last over ginger beer"
    }
  },

  "redFlags": [
    {"id": "colada-no-coconut-or-pineapple", "sev": "fatal", "when": {"anyOf": [{"family": ["colada"]}, {"nameNoun": "Colada"}, {"copyWord": "colada"}]}, "kind": "requireAll", "ids": [{"anyOf": ["pineapple-juice"], "minOz": 1.5}, {"anyOf": ["coconut-cream","coconut-milk"], "minOz": 0.75}], "fix": "pineapple-juice 2-4 oz + coconut-cream 0.75-1.5 oz, or relabel"},
    {"id": "colada-coconut-from-liqueur-only", "sev": "major", "when": {"family": ["colada"]}, "kind": "custom", "check": "coconut sources present but none of coconut-cream/coconut-milk", "fix": "use coconut-cream; coconut-rum <= 0.5"},
    {"id": "colada-sour", "sev": "major", "when": {"family": ["colada"]}, "kind": "maxOz", "ids": {"lime": 0.75, "lemon": 0.5}, "metric": {"acidConc": [0, 0.5]}, "fix": "<= 0.5 oz lime"},
    {"id": "mai-tai-juice", "sev": "fatal", "when": {"anyOf": [{"family": ["mai-tai"]}, {"nameNoun": "Mai Tai"}]}, "kind": "forbid", "ids": ["pineapple-juice","orange"], "unless": "explicit Royal Hawaiian request", "fix": "remove juice"},
    {"id": "mai-tai-incomplete", "sev": "fatal", "when": {"nameNoun": "Mai Tai"}, "kind": "requireAll", "ids": [{"anyOf": ["lime"]}, {"anyOf": ["orgeat"]}, {"anyOf": ["orange-curacao","triple-sec"]}, {"anyOf": "agedOrFunkyRum"}], "fix": "2 : 1 : 1/2 : 1/2 : 1/4"},
    {"id": "mai-tai-float-or-sink", "sev": "major", "when": {"family": ["mai-tai"]}, "kind": "custom", "check": "no line.float of dark rum, no line.sink of grenadine", "fix": "remove"},
    {"id": "zombie-weak-structure", "sev": "fatal", "when": {"anyOf": [{"family": ["zombie"]}, {"nameNoun": "Zombie"}]}, "kind": "custom", "check": "familyRequirements.zombie", "fix": "gold column + Jamaican + 0.75-1 oz 151 Demerara; Don's Mix; falernum"},
    {"id": "zombie-red-or-creamy", "sev": "fatal", "when": {"family": ["zombie"]}, "kind": "custom", "check": "grenadine <= 0.17 oz; no coconutSources, allDairy, blue-curacao", "fix": "1 tsp grenadine"},
    {"id": "grog-wrong", "sev": "major", "when": {"anyOf": [{"family": ["grog"]}, {"nameNoun": "Grog"}]}, "kind": "custom", "check": "familyRequirements.grog", "fix": "lime + white grapefruit + honey or allspice"},
    {"id": "swizzle-not-swizzled", "sev": "fatal", "when": {"anyOf": [{"family": ["swizzle"]}, {"nameNoun": "Swizzle"}]}, "kind": "custom", "check": "method == swizzle && ice in [crushed,pebble]", "fix": "swizzle over crushed"},
    {"id": "daiquiri-impostor", "sev": "major", "when": {"nameNoun": "Daiquiri"}, "kind": "custom", "check": "familyRequirements.daiquiri", "fix": "strip to spirit, citrus, sugar (+ named fruit)"},
    {"id": "orgeat-punch-without-orgeat", "sev": "fatal", "when": {"anyOf": [{"family": ["orgeat-punch"]}, {"copyWord": "orgeat"}]}, "kind": "requireAny", "ids": ["orgeat"], "minOz": 0.25, "fix": "add orgeat or relabel"},
    {"id": "scorpion-without-brandy", "sev": "major", "when": {"anyOf": [{"nameNoun": "Scorpion"}, {"family": ["orgeat-punch"], "vessel": ["scorpion-bowl"]}]}, "kind": "requireAny", "ids": ["brandy"], "minOz": 0.5, "fix": "brandy 0.5-1 oz per serving"},
    {"id": "fog-cutter-incomplete", "sev": "major", "when": {"nameNoun": "Fog Cutter"}, "kind": "requireAll", "ids": [{"anyOf": ["gin"]}, {"anyOf": ["brandy","pisco"]}, {"anyOf": ["amontillado-sherry"]}], "fix": "gin + brandy + rum + sherry float"},
    {"id": "buck-without-ginger", "sev": "major", "when": {"anyOf": [{"nameNoun": "Buck"}, {"nameNoun": "Mule"}]}, "kind": "requireAny", "ids": ["ginger-beer","ginger-ale","ginger-syrup","ginger-fresh"], "fix": "ginger beer top"},
    {"id": "highball-served-up", "sev": "major", "when": {"anyOf": [{"nameNoun": "Highball"}, {"nameNoun": "Cooler"}]}, "kind": "custom", "check": "vessel not in upVessels and ice != none", "fix": "highball/collins on cubes"},
    {"id": "hot-wrong", "sev": "fatal", "when": {"method": ["hot"]}, "kind": "custom", "check": "methodRules.hot-wrong", "fix": "no ice, no fizz, peel not juice"},
    {"id": "stirred-with-juice", "sev": "major", "when": {"method": ["stir"]}, "kind": "custom", "check": "methodRules.stirred-with-juice", "fix": "shake, or remove juice"},
    {"id": "bitter-tiki-not-bitter", "sev": "major", "when": {"family": ["bitter-tiki"]}, "kind": "custom", "check": "familyRequirements.bitter-tiki", "fix": "Campari or amaro >= 0.5 oz"},
    {"id": "classic-riff-loses-signature", "sev": "major", "when": {"riff": true}, "kind": "custom", "check": "the riff keeps its source archetype's required signature components and archetypeAromaRequired garnish", "fix": "restore signature; vary the rest"},
    {"id": "bowl-single", "sev": "major", "when": {"anyOf": [{"vessel": "bowlVessels"}, {"nameNoun": "Bowl"}]}, "kind": "custom", "check": "servings >= 2; and servings >= 4 => bowl or batch", "fix": "scale"},
    {"id": "named-reference-ignored", "sev": "major", "when": {"prayerNamesDrink": true}, "kind": "custom", "check": "prayer naming a classic or pop drink (e.g. 'Blue Hawaii', 'Elvis in Blue Hawaii') yields a riff that keeps that classic's signature (blue-curacao + pineapple for Blue Hawaii)", "fix": "honor the reference"},

    {"id": "sour-mix", "sev": "fatal", "kind": "copyBan", "phrases": ["sour mix","sweet and sour","sweet-and-sour","margarita mix","pina colada mix","bottled lime"], "fix": "fresh citrus + syrup"},
    {"id": "cranberry-in-tiki", "sev": "major", "when": {"notPrayerAsks": ["cranberry"]}, "kind": "forbid", "ids": ["cranberry-juice"], "fix": "hibiscus-syrup, grenadine, pomegranate-juice, passion, guava"},
    {"id": "lime-cordial-as-citrus", "sev": "major", "when": {"familyNot": ["buck"]}, "kind": "custom", "check": "lime-cordial present and no lime/lemon/grapefruit", "fix": "fresh lime"},
    {"id": "spiced-rum-classic", "sev": "major", "when": {"family": ["mai-tai","zombie","grog","swizzle","daiquiri","beachcomber-sour"]}, "kind": "forbid", "ids": ["rum-spiced"], "fix": "aged rum + allspice/cinnamon/falernum"},
    {"id": "coconut-pileup", "sev": "major", "kind": "custom", "check": "count(coconutSources) > 2 OR (coconut-rum AND coconut-cream AND any allDairy)", "fix": "one cream of coconut (+ <=0.5 coconut rum)"},
    {"id": "casein-plus-citrus", "sev": "fatal", "kind": "pairForbidden", "a": "caseinDairy", "b": "strongAcids", "fix": "drop citrus or use coconut"},
    {"id": "heavy-cream-plus-heavy-citrus", "sev": "major", "kind": "custom", "check": "heavy-cream present and sum(lime,lemon,grapefruit,passion-fruit-juice) > 0.75", "fix": "<= 0.5 citrus or coconut"},
    {"id": "ice-cream-shaken", "sev": "major", "kind": "custom", "check": "vanilla-ice-cream present and method != blend", "fix": "blend"},
    {"id": "blue-or-melon-unrequested", "sev": "major", "when": {"notPrayerAsks": ["blue","green","neon","color","Blue Hawaii","Midori","pool","ocean","lagoon"]}, "kind": "forbid", "ids": ["blue-curacao","melon-liqueur"], "fix": "remove"},
    {"id": "two-orange-liqueurs", "sev": "minor", "kind": "maxCountOf", "set": "orangeLiqueurs", "n": 1},
    {"id": "two-plain-syrups", "sev": "minor", "kind": "maxCountOf", "set": "plainSyrups", "n": 1},
    {"id": "lemon-and-lime", "sev": "minor", "when": {"familyNot": ["zombie","punch","resort-punch"]}, "kind": "maxCountOf", "ids": ["lemon","lime"], "n": 1},
    {"id": "grenadine-for-color", "sev": "major", "kind": "custom", "check": "grenadine > doseCaps.grenadine.byFamily[family] (default 0.5) unless line.sink", "fix": "1 tsp seasoning or a deliberate sink"},
    {"id": "anise-overdose", "sev": "fatal", "kind": "maxOz", "ids": {"absinthe": 0.04, "pastis": 0.04}, "unless": "rinse or anise-forward request", "fix": "6 drops"},
    {"id": "bitters-overdose", "sev": "major", "kind": "maxOz", "ids": {"angostura": 0.18, "peychauds": 0.12, "orange-bitters": 0.12, "tiki-bitters": 0.12, "mole-bitters": 0.12}, "unless": "Angostura crown (0.25) or bitters-base archetype", "fix": "1-2 dashes or a crown"},
    {"id": "allspice-overdose", "sev": "major", "kind": "maxOz", "ids": {"allspice-dram": 0.5}},
    {"id": "chartreuse-overdose", "sev": "minor", "kind": "maxOz", "ids": {"green-chartreuse": 0.75}, "unless": "Chartreuse base archetype"},
    {"id": "overproof-overdose", "sev": "fatal", "kind": "custom", "check": "each overproof <= 1.0 (1.5 if sole base); count(overproof) <= 1; total spirits <= 4.0; ethanol <= 2.0 oz", "fix": "0.75-1 oz overproof in a 3-4 oz stack"},
    {"id": "jamaican-white-overproof-base", "sev": "minor", "kind": "maxOz", "ids": {"rum-jamaican-white-overproof": 0.75}, "unless": "explicit request"},
    {"id": "smoky-bitter-bomb", "sev": "minor", "kind": "maxOz", "ids": {"fernet": 0.25, "scotch-islay": 0.5}, "unless": "explicit bitter/smoky/medicinal request"},
    {"id": "bitter-stack-in-gentle-drink", "sev": "fatal", "when": {"prayerTone": ["gentle","floral","garden","sunny","brunch","romantic","grandmother","light","elegant","morning"]}, "kind": "maxCountOf", "set": "aggressiveBitter", "n": 1, "fix": "flowers, herbs, honey, citrus"},
    {"id": "too-many-cooks", "sev": "major", "kind": "custom", "check": "components <= familyWindows[family].maxComponents and <= 11", "fix": "one item per job"},
    {"id": "quarter-ounce-soup", "sev": "major", "kind": "custom", "check": "count(non-seasoning lines with oz <= 0.25) <= componentCounting.maxNonSeasoningAtOrBelowQuarterOz (zombie 4)", "fix": "consolidate"},
    {"id": "micro-dose-bulk", "sev": "minor", "kind": "minOzIfPresent", "ids": "minDoseIfPresent", "fix": "raise or drop"},
    {"id": "redundant-red-fruit", "sev": "minor", "kind": "maxCountOf", "set": "redFruit", "n": 2},
    {"id": "passion-pileup", "sev": "minor", "kind": "maxCountOf", "set": "passionSources", "n": 2},
    {"id": "vodka-in-golden-age-family", "sev": "major", "when": {"family": ["zombie","mai-tai","grog","swizzle","beachcomber-sour"]}, "kind": "forbid", "ids": ["vodka"], "unless": "explicit vodka request"},
    {"id": "brewed-coffee-cold-stirred", "sev": "major", "when": {"methodNot": ["hot"]}, "kind": "maxOz", "ids": {"coffee": 0.75}, "fix": "coffee-liqueur or make it hot"},
    {"id": "raw-butter", "sev": "major", "kind": "custom", "check": "butter only when method == hot; prefer hot-buttered-rum-batter", "fix": "batter, hot only"},
    {"id": "fruit-named-absent", "sev": "fatal", "kind": "custom", "check": "every fruit/food word in name, tagline or prayer-as-request maps to a present ingredient at minDose; frozen banana requires 'banana' (fresh), not only banana-liqueur", "fix": "add the fruit"},
    {"id": "dessert-without-dessert", "sev": "major", "when": {"prayerAsks": ["dessert","bananas foster","chocolate","pie","cake","ice cream","sundae","horchata","dreamsicle"]}, "kind": "custom", "check": "drink contains >= 1 of creamyMakers or hot-buttered-rum-batter or creme-de-cacao/coffee-liqueur/banana-liqueur/vanilla-syrup AND no grapefruit", "fix": "dessert-shaped build"},
    {"id": "coconut-milk-unsweetened-swap", "sev": "minor", "when": {"family": ["colada"]}, "kind": "custom", "check": "coconut-milk without coconut-cream requires >= 0.5 oz simple-equivalent sweetener", "fix": "coconut-cream"},
    {"id": "spice-sludge", "sev": "minor", "kind": "maxCountOf", "set": "spiceCarriers", "n": 3},
    {"id": "liqueur-cloy", "sev": "major", "kind": "custom", "check": "sum(sweetLiqueurs oz) <= 1.5 unless archetype is liqueur-based (rum-runner, chartreuse swizzle, resort)", "fix": "trim, add acid"},

    {"id": "ratio-out-of-window", "sev": "major", "kind": "range", "metric": "sugarToAcid", "bounds": "familyWindows[family].sugarToAcid"},
    {"id": "acid-missing", "sev": "fatal", "when": {"familyNot": ["colada","stirred","hot","buck"]}, "kind": "range", "metric": "acidConc", "min": 0.4},
    {"id": "frozen-thin", "sev": "major", "when": {"method": ["blend"]}, "kind": "custom", "check": "sugarConc >= 8.5 and spirits <= 2.5 oz"},
    {"id": "abv-out-of-band", "sev": "major", "kind": "range", "metric": "abv", "bounds": "familyWindows[family].abv, overridden by styleOverrides"},
    {"id": "passion-plus-full-lime", "sev": "minor", "kind": "custom", "check": "incompatibilities.passion-plus-full-lime"},
    {"id": "pineapple-flab", "sev": "minor", "when": {"familyNot": ["colada","resort-punch","bitter-tiki"]}, "kind": "custom", "check": "pineapple-juice <= 3 x (lime + lemon)"},
    {"id": "hot-too-dry-or-strong", "sev": "minor", "when": {"method": ["hot"]}, "kind": "custom", "check": "sugarConc >= 2.5 and abv <= 14"},
    {"id": "tasting-contradicts-numbers", "sev": "major", "kind": "custom", "check": "sweet/tart/balanced words consistent with sugarToAcid position within family window (lower third = tart, upper third = sweet)"},

    {"id": "shaken-carbonation", "sev": "fatal", "kind": "custom", "check": "methodRules.shaken-carbonation"},
    {"id": "sparkling-shaken", "sev": "fatal", "kind": "custom", "check": "methodRules.sparkling-shaken"},
    {"id": "swizzle-method-mismatch", "sev": "major", "kind": "custom", "check": "methodRules.swizzle-method"},
    {"id": "flash-blend-up", "sev": "major", "kind": "custom", "check": "methodRules.flash-blend-up and crushed-shake-up"},
    {"id": "layer-claim-shaken", "sev": "major", "kind": "custom", "check": "methodRules.layer-claim"},
    {"id": "float-too-dense", "sev": "major", "kind": "custom", "check": "methodRules.float-density"},
    {"id": "sink-too-light", "sev": "major", "kind": "custom", "check": "methodRules.sink-density"},
    {"id": "mint-shredded-or-unstrained", "sev": "minor", "kind": "custom", "check": "muddled mint + up service requires fine-strain step"},
    {"id": "egg-no-dry-shake", "sev": "minor", "kind": "custom", "check": "methodRules.egg-no-dry-shake"},
    {"id": "hot-vessel-unsafe", "sev": "major", "when": {"method": ["hot"]}, "kind": "custom", "check": "vessel in heatSafeVessels"},
    {"id": "punchbowl-crushed", "sev": "minor", "kind": "custom", "check": "methodRules.punchbowl-block"},
    {"id": "fire-unsafe", "sev": "major", "kind": "custom", "check": "fire garnish only in garnish.fireAllowedVessels; fuel is lemon-extract crouton (or overproof in a well), never poured from bottle; not with mint bouquet/umbrella adjacent; copy never says 'flaming 151 float'"},
    {"id": "ice-cone-misuse", "sev": "minor", "kind": "custom", "check": "ice-cone only family grog (or explicit request) in dof/rocks"},
    {"id": "frozen-no-mound", "sev": "minor", "kind": "custom", "check": "methodRules.frozen-vessel"},

    {"id": "volume-overflow", "sev": "fatal", "kind": "vesselFit", "side": "max"},
    {"id": "volume-stingy", "sev": "major", "kind": "vesselFit", "side": "min"},
    {"id": "up-drink-in-mug", "sev": "major", "kind": "custom", "check": "ice == none and vessel in opaqueVessels (except hot-mug for hot)"},
    {"id": "colada-in-coupe", "sev": "minor", "when": {"family": ["colada"]}, "kind": "custom", "check": "vessel not in upVessels unless method == stir"},
    {"id": "fruit-vessel-for-up", "sev": "major", "kind": "custom", "check": "vessel in [coconut, pineapple] requires crushed ice and method != stir"},
    {"id": "stirred-on-crushed", "sev": "major", "kind": "custom", "check": "methodRules.stirred-on-crushed"},

    {"id": "garnish-excluded-ingredient", "sev": "fatal", "kind": "custom", "check": "no garnish signals (garnish.truth.signals) an excluded ingredient or avoided flavor tag"},
    {"id": "garnish-contradicts-recipe", "sev": "major", "kind": "custom", "check": "garnish.truth.rule"},
    {"id": "garnish-duplicate", "sev": "minor", "kind": "custom", "check": "garnish.duplicates groups max 1 each"},
    {"id": "garnish-missing-aroma", "sev": "major", "kind": "custom", "check": "garnish.byFamily[family].required and archetypeAromaRequired present"},
    {"id": "garnish-heavy-on-up", "sev": "major", "kind": "custom", "check": "service up => no forbiddenOnUp items and <= 1 element"},
    {"id": "garnish-rim", "sev": "minor", "kind": "custom", "check": "no salt/sugar rim unless li-hing-mui-syrup present"},
    {"id": "garnish-whipped-cream", "sev": "minor", "kind": "custom", "check": "whipped cream only when prayer asks dessert and drink is blended/creamy"},
    {"id": "garnish-clutter", "sev": "minor", "kind": "custom", "check": "elements <= garnish.maxElementsByService; elegant/minimal prayer => <= 1"},
    {"id": "mint-without-dome", "sev": "minor", "kind": "custom", "check": "mint bouquet requires crushed-family ice"},
    {"id": "cherry-in-mai-tai", "sev": "minor", "when": {"family": ["mai-tai"]}, "kind": "custom", "check": "no cherry/flag"},
    {"id": "nutmeg-on-tart-sour", "sev": "minor", "kind": "custom", "check": "grated nutmeg only on colada, punch, hot, swizzle (Chartreuse/151), creamy or rum-rich drinks; not on a lean up daiquiri"},

    {"id": "blue-goes-green", "sev": "major", "kind": "custom", "check": "incompatibilities.blue-goes-green (copy/name color word must be aqua/turquoise/teal/green, not blue)"},
    {"id": "blue-plus-red", "sev": "major", "kind": "custom", "check": "incompatibilities.blue-plus-red"},
    {"id": "blue-plus-dark-rum", "sev": "fatal", "kind": "pairForbidden", "a": ["blue-curacao"], "b": "darkSpirits"},
    {"id": "color-name-lie", "sev": "major", "kind": "custom", "check": "copy.colorWordsRequire"},
    {"id": "red-zombie-or-mai-tai", "sev": "major", "when": {"family": ["zombie","mai-tai"]}, "kind": "custom", "check": "computed hue not red/pink"},
    {"id": "opacity-lie", "sev": "minor", "kind": "custom", "check": "'clear/crystal' copy forbidden if any opaqueMakers present; 'creamy' requires creamyMakers"},
    {"id": "coffee-citrus-mud", "sev": "minor", "kind": "custom", "check": "incompatibilities.coffee-citrus-mud"},
    {"id": "angostura-brown-wash", "sev": "minor", "kind": "custom", "check": "angostura mixed (not crown) <= 0.09 oz when drink is pale/white (coconut-cream, clear bases)"},
    {"id": "midori-orange-mud", "sev": "minor", "kind": "custom", "check": "incompatibilities.midori-orange-mud"},

    {"id": "noun-claim-false", "sev": "fatal", "kind": "custom", "check": "every nameNouns entry present in name satisfies its require"},
    {"id": "phantom-flavor", "sev": "major", "kind": "custom", "check": "copy.headlineFlavorRule"},
    {"id": "adjective-soup", "sev": "major", "kind": "custom", "check": "copy.noRepeatedWords and maxFlavorAdjectivesInTagline and tagline has a verb or a noun phrase beyond the adjective list"},
    {"id": "label-names-absent-ingredient", "sev": "fatal", "kind": "custom", "check": "copy.familyLabelMustBeTrue"},
    {"id": "prayer-ignored", "sev": "fatal", "kind": "custom", "check": "copy.prayerTrace"},
    {"id": "sacred-or-offensive", "sev": "major", "kind": "copyBan", "phrases": "copy.bannedNameTerms"},
    {"id": "false-provenance", "sev": "major", "kind": "copyBan", "phrases": ["Don's original","Vic's secret","since 1934","authentic original"]},
    {"id": "classic-name-misuse", "sev": "fatal", "kind": "custom", "check": "classic drink names (Mai Tai, Zombie, Painkiller, Navy Grog, Jungle Bird, Hurricane, Scorpion, Fog Cutter, Piña Colada, Saturn, Three Dots and a Dash) only in riffs that pass that archetype's signature"},
    {"id": "strength-word-lie", "sev": "major", "kind": "custom", "check": "copy.strengthWords"},
    {"id": "creamy-without-cream", "sev": "major", "kind": "custom", "check": "copy.creamyWordsRequire"},
    {"id": "rich-for-lean", "sev": "minor", "kind": "custom", "check": "'rich' requires sugarConc >= 8 or creamyMakers or dark/navy/demerara rum >= 1 oz"},
    {"id": "cliche-copy", "sev": "minor", "kind": "copyBan", "phrases": "copy.bannedPhrases"},
    {"id": "possessive-mad-libs", "sev": "minor", "kind": "custom", "check": "name not of form 'The X's Y'; 'of <Place>' only when a spirit from that place >= 1 oz or the prayer names it"},
    {"id": "copy-too-long", "sev": "minor", "kind": "custom", "check": "tagline words within copy.taglineWords; tasting <= 3 sentences"}
  ],

  "sweetEquivalentsPerOz": {
    "about": "oz of 1:1 simple syrup with the same sugar, and oz of lime with the same acid, per oz of ingredient (from data/ingredients.json)",
    "pineapple-juice": [0.16, 0.13], "orange": [0.16, 0.15], "grapefruit": [0.11, 0.40], "passion-fruit-juice": [0.16, 0.58],
    "passion-fruit-syrup": [0.89, 0.25], "passion-fruit-nectar": [0.21, 0.13], "guava-nectar": [0.21, 0.07], "mango-nectar": [0.23, 0.05],
    "coconut-cream": [0.89, 0], "coconut-milk": [0.03, 0], "orgeat": [1.06, 0], "velvet-falernum": [0.49, 0], "orange-curacao": [0.33, 0],
    "triple-sec": [0.41, 0], "allspice-dram": [0.41, 0], "maraschino": [0.57, 0], "campari": [0.39, 0], "grenadine": [0.89, 0.13],
    "honey-syrup": [0.94, 0], "rich-simple": [1.43, 0], "demerara-syrup": [1.43, 0], "ginger-beer": [0.16, 0.05], "lime-cordial": [0.49, 0.42],
    "dons-mix": [0.42, 0.27], "lemon": [0.03, 1.0], "lime": [0.03, 1.0]
  }
}
```
