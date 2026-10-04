# Tiki presentation and aesthetics: recipe card and ink-and-watercolor drawing

This is research for Tiki God's recipe card and its Shrine drawing (`docs/art-direction.md`, `docs/vessels.md`, `web/lib/artspec.js`, `web/lib/artcatalog.js`, `web/lib/optics.js`, `web/lib/copy.js`, `web/lib/names.js`). It answers one question: **what does a finished tiki drink look like, and how should it be described, so that an expert sees a real drink and not a costume?**

It covers:
- garnish theater by archetype and how to draw it;
- color and layers in each kind of vessel;
- how each kind of ice looks;
- the details aficionados notice;
- cultural sensitivity in images and names;
- the voice of menu copy;
- a machine-readable JSON appendix that maps garnish phrases to drawable parts and placement rules.

All ids are the repo's own: archetype ids from `data/archetypes.json`, family ids from `data/families.json`, vessel ids from `data/vessels.json`, ingredient ids from `data/ingredients.json`, and flavor tags from the fixed vocabulary.

The archetype ids match `data/archetypes.json` as of this writing: 59 archetypes. `colada` is now split into `pina-colada`, `painkiller`, `fruit-colada`, `bushwacker`, `coconut-daiquiri` and `miami-vice`. There are also new resort, bowl and zero-proof archetypes.

**Confidence markers.** Claims checked against search-result summaries of primary or near-primary sources (Beachbum Berry's site, Punch, Difford's, Wikipedia, Pusser's, the Atomic Grog) are stated plainly, and sources are listed at the end. Claims that rest on my own bar knowledge and could not be re-verified are marked **(uncertain)** or **(from practice)**. Two limits applied: the web-search budget for this session ran out partway through, and direct page fetches are blocked. So the menu-copy and Mai-Kai details below come from memory and are flagged.

---

## 0. The problems, in presentation terms

The reviewer's complaints all come from one root cause: **presentation was generated separately from the recipe.** Each symptom has a structural fix:

| Symptom | Cause in the current code | Fix (rule) |
|---|---|---|
| A "colada" with no coconut or pineapple | The type noun or tagline comes from the family or the prayer, not from the lines | **Truth rule.** A type word, flavor word, color word or garnish may appear only if the recipe carries it (§7.4). |
| Drink color doesn't match the ingredients | Fixed alpha regardless of vessel depth; the bitters crown is painted under the ice instead of on it; red or sunset gradients appear in shaken drinks | Color comes from `optics.js` only. Path length changes the wash strength. Layers appear only when the build allows them (§3). |
| Umbrella on everything in `colada`/`resort-punch` | `artspec.js` adds the umbrella by family and ignores `archetype.garnish.never` | The archetype's `never` list overrides family defaults. The umbrella is allowed only for the resort and colada archetypes that list it (appendix `limits.umbrellaAllowed`). |
| The drawing says "Mai Tai" but the shell is drawn cut-side up | The `limeShell` part is a bowl (cut face up) | Two orientations: `dome-up` (spent shell, the Mai Tai "island") and `cup-up` (the flaming crouton boat) (§2.1). |
| Cherries the size of peas, orange wheels the size of coins | Garnish parts aren't drawn to the vessel scale of 38 units per inch | Real-world sizes are given in the appendix. A cherry is about 32 units across and an orange wheel about 110 (§2.3). |
| Straw on one side, mint on the other | Straw at `cx + 0.3·hw`, mint at `cx − 0.34·hw` | **Mint goes beside the straw.** The point of the mint is that your nose is in it when you sip (§2.2). |

---

## 1. What makes tiki fun and accessible, not fussy or kitsch for its own sake

Tiki's purpose has always been **transport**: a few minutes somewhere else (see `docs/history.md` §8.1). The best modern bars (Smuggler's Cove, Three Dots and a Dash, the Mai-Kai since its restoration, Hale Pele, False Idol, Sunken Harbor Club) keep the theater and drop the condescension. Six principles follow for the card and the drawing.

1. **Generous, not fussy.** Tiki garnish is bold and legible from across a dark room: a big mint bouquet, a fat pineapple wedge, a lime shell like an island. It is the opposite of a tweezered micro-garnish or a dehydrated-citrus-and-edible-glitter "craft" look. One hero garnish, read in one glance, beats five small ones.
2. **Every flourish means something.** The good tiki garnishes are signals with a story or a function:
   - the Mai Tai's island and palm;
   - Three Dots' Morse "V";
   - the Navy Grog's cone that keeps the drink cold and the straw clear;
   - the Tropical Itch's back-scratcher, a pun on its name;
   - the Sidewinder's Fang's snake;
   - the Queen's Park crown, which the drinker stirs in as they go.

   Kitsch for its own sake means decoration with no link to the drink: plastic monkeys, glow sticks, an umbrella on a stirred rum Old Fashioned, a sparkler in a daiquiri, a fruit salad on a pick. **Rule: every garnish either echoes an ingredient (aroma) or is a recognized signal for the drink's archetype (theater). If it does neither, drop it.**
3. **Mostly aroma.** Mint, nutmeg, cinnamon, citrus oils and flowers are smelled on every sip through a straw. That is why mint sits beside the straw, nutmeg is grated fresh over the ice cap, and a twist is expressed over the drink. Copy should mention the garnish's aroma when it matters ("nutmeg on the nose").
4. **Humor with a wink, never a sneer.** The classic names are tall tales: Zombie, Suffering Bastard, Fog Cutter, Test Pilot. The joke is on the drinker ("two per customer") or on the bar's own bravado, never on a people or a religion.
5. **Communal and generous.** Bowls with long straws, a flaming centerpiece, a pitcher of swizzle. When a prayer mentions friends, a party or "for six", the presentation should become a bowl (`scorpion-bowl`, `tiki-bowl`, `volcano-bowl`, `punch-bowl`). Draw several straws leaning out like spokes, not one.
6. **Accessible at home.** Every theatrical serve needs a home fallback, stated once, without condescension:
   - no ice-cone mold: pack crushed ice in a pilsner glass, push a chopstick through and freeze it, Tony Ramos's method as told to Berry; or just use crushed ice;
   - no flash blender: shake hard with crushed ice and dump the whole thing in;
   - no gardenia: no flower, or an edible orchid;
   - no bois lélé: a bar spoon.

   The card should never make a drink feel unmakeable.

**Smile, don't wince: tone of the drawing.** The art direction (ink and watercolor, *ma*, Quentin Blake looseness) suits tiki well. Mid-century tiki menu art was itself hand-drawn and cartoonish. The drawing should feel like a menu illustration, a bit tipsy and confident, not a product render.

---

## 2. Garnish theater by archetype, and how to draw it

### 2.1 The nine signature serves the brief names

Each entry gives what an expert expects, then how to draw it with the catalog. Parts marked *(new)* don't exist yet; see the appendix `parts`. Sizes are given in inches and converted at the repo's scale of about 38 units per inch.

**Mai Tai (`mai-tai`, `vic-mai-tai-riff`), in a `dof`**
- **Expect:** Trader Vic's own instructions: shake with shaved ice, garnish with half the spent lime shell inside the drink and a sprig of fresh mint. Bartenders put it as "an island and a palm tree": the squeezed half-lime floats **dome up** on the crushed ice and the mint rises beside it or out of it.
- **Never on a Mai Tai:** a cherry and orange flag, a paper umbrella as the only garnish, a dark-rum float, a grenadine sunrise, or pineapple juice color. These are the resort-era errors the archetype already forbids.
- **Draw:**
  - Crushed-ice mound above the rim.
  - `garnish.lime-shell` in `orientation: "dome-up"`, about 2 in wide (≈ 76 u). Sit it at the cap's center-left, its lower third hidden in ice.
  - `garnish.mint` (big), 3–4 in above the ice (≈ 115–150 u), planted at the shell's edge so it reads as a palm on an island.
  - One short straw beside the mint.
  - Liquid: translucent honey-amber, one color top to bottom.
- **Smile:** the dome is speckled green with lime-skin pores; draw a few tier-3 dots. The mint leans slightly, like a palm in a trade wind.

**Painkiller (`painkiller`: `rum-navy`, `pineapple-juice`, `orange`, `coconut-cream`), in an `enamel-tin`**
- **Expect:** a heavy, fresh-grated nutmeg cap over the whole surface, plus an orange wheel (Pusser's adds a cherry). The Soggy Dollar Bar served it in plastic cups; the white enamel mug with the navy rim is Pusser's brand serve.
- **Draw:**
  - Opaque tin: show only the surface.
  - Ice heaped a little above the navy lip.
  - Nutmeg as a dense freckle field, heavier in the middle and thinning to the edge, never a neat ring. It should cover about 70% of the cap.
  - `garnish.orange-wheel` slotted on the rim at front-left, about 3 in (≈ 110 u) or a half-wheel. A cherry is optional and tucked against the wheel.
  - One straw.
  - Surface color: opaque pale tan-orange (coconut and pineapple, deepened by navy rum).
- **Never:** cinnamon instead of nutmeg, a lime shell, an umbrella *and* a flag *and* a wedge together. Nutmeg is the Painkiller's signal; `fruit-colada` forbids it for that reason.

**Zombie (`zombie`), in a `chimney`**
- **Expect:** the 1934 spec Berry decoded is garnished simply, with a mint sprig. Later menus and modern bars add fruit: a pineapple frond or chunk, a cherry on a pick, a lime wheel. **(uncertain:** which fruit appeared at Don's in the 1950s is not documented in what I could check. Treat fruit as optional and keep mint mandatory.)
- **Draw:**
  - The chimney is packed with crushed ice and the cap mounded about 0.6 in above the rim.
  - A tall `garnish.mint` bouquet beside the straw.
  - At most one fruit accent: either `garnish.pineapple-fronds` *(new)* rising behind the mint, or a cherry on a pick.
  - Liquid: deep amber to burnished copper, slightly hazy, darker toward the foot of this narrow, tall glass because the light path is longer.
- **Never:** red or orange-juice orange (the teaspoon of grenadine gives at most a rosy cast), a layered "sunset", a sugar rim.
- **Smile:** draw the straw long (a 10 in tiki straw) so it stands well above the tall mint. A small "2 per guest" note in the copy, not in the drawing.

**Navy Grog (`navy-grog`), in a `dof`**
- **Expect:** a cone of finely shaved ice frozen around the straw, standing in the glass with the drink poured around it. It is a conversation piece and keeps the drink cold.
  - Tony Ramos's home method: pack shaved ice into a pilsner glass, run a chopstick down the middle, unmold and freeze.
  - The Kon-Tiki chain had a metal mold so the cone fit a double old fashioned. Cocktail Kingdom re-created it with Berry.
- **Draw:**
  - The `ice` part in `style: "ice-cone"`: a frosty white cone a little narrower than the glass, rising about 1 in above the rim.
  - **One straw, exactly on the center axis, `rot: 0`**, coming out of the cone's tip. The current code offsets the straw by `0.3·hw`, which breaks the illusion.
  - Liquid around the cone: cloudy amber-tan (honey and grapefruit over dark rums), with a few soda bubbles.
  - Optional: a small mint sprig or a lime shell at the cone's foot.
- **Never:** an umbrella or a cherry-and-orange flag.
- **Opaque-vessel fallback:** in a `ku-mug` the cone's tip and straw are what show. Draw them above the rim, because they are the signal.

**Three Dots and a Dash (`beachcomber-spice-sour`, Three Dots signature: `rum-agricole-vieux` + aged rum + lime, orange, honey, falernum, allspice), in a `footed-pilsner`**
- **Expect:** the name is Morse code for V (for Victory): · · · —.
  - The dots are **three cherries**.
  - The dash is a **rectangular chunk of pineapple** at Don's, or a **pineapple frond** at Smuggler's Cove.
  - All are speared on one pick, in Morse order.
- **Draw:** `garnish.morse-pick` *(new)*:
  - one bamboo pick about 4 in long, laid across the rim at about −15°;
  - three cherries evenly spaced, then a rectangle (not a wedge) of pineapple, reading left to right · · · —;
  - cherries about 0.85 in (≈ 32 u) each, the chunk about 1.2 × 0.5 in.
  - Liquid: hazy golden amber.
- **Smile:** the order matters. A dash before the dots is a different letter, and someone will notice.
- **Never:** put this pick on a drink that isn't a Beachcomber-style spice sour. It is an identity claim.

**Hurricane (`hurricane`: dark rum, lemon, passion fruit), in a `hurricane`**
- **Expect:** an orange slice and a cherry. The "flag" is a half orange wheel folded around a cherry and pinned with a pick.
- **Color depends on the build:**
  - Pat O'Brien's drink is red. The 1956 Culligan recipe used **Red Passionola**, a red line extension of the fassionola syrup brand.
  - Berry's Grog Log Hurricane (4 oz dark Jamaican rum, 2 oz lemon, 2 oz passion fruit syrup) is a **cloudy amber-orange**, not red.
  - **Rule: paint it red only if a red ingredient is in the glass** (`grenadine`, `hibiscus-syrup`, a red fassionola substitute). Otherwise it is amber-orange.
- **Draw:**
  - The tall lamp-shaped glass filled with crushed ice.
  - `garnish.orange-flag` *(new)*: a half orange wheel standing upright on the rim with a cherry in its crook and a pick through both, at front-right.
  - One long straw on the opposite side.

**Tropical Itch (`tropical-itch`: bourbon and rums with passion fruit, curaçao and Angostura), in a `hurricane`**
- **Expect:** Harry Yee (Hilton Hawaiian Village, late 1950s, often given as 1957) put a **bamboo back-scratcher** in the glass instead of a swizzle stick, so you can "scratch your itch". There is usually a pineapple wedge, often an orchid.
- **Draw:**
  - `garnish.back-scratcher` *(new)*: a thin bamboo rod with a small curled five-finger "hand" at the top, standing in the ice and rising **1.0–1.2× the vessel's height** above the rim. This is the one garnish allowed to run off scale. Crop it at the box top if needed.
  - Add a pineapple wedge on the rim and an optional orchid.
  - Liquid: hazy golden orange.
- **Never** give a back-scratcher to anything but a Tropical Itch riff (bourbon or rum with passion fruit). Anywhere else it is a non sequitur.

**Sidewinder's Fang (`resort-punch` family, no archetype of its own; from The Lanai, San Mateo; passion fruit, orange, lime, dark Jamaican and Demerara rums, soda), in a `snifter`**
- **Expect:** a long, continuous orange-peel spiral lines the inside of the large snifter like a coiled snake.
  - The head is cut into a triangle and hooks over the rim.
  - Clove eyes are pushed through the head.
  - Usually a mint sprig too.
- **Draw:** `garnish.peel-snake` *(new)*:
  - a helix of ¾ in-wide orange peel winding up from the bowl's floor through 2½–3 turns;
  - front segments ink tier 1, back segments tier 3 (palest), so it reads as inside the glass;
  - the triangular head draped over the front-right rim with two clove dots, a darker brown in `PALETTE.wood`.
  - Liquid: hazy golden orange with fizz.
- **Constraint:** only in a clear vessel (`snifter`, also `goblet` or `hurricane`). In an opaque mug the snake is invisible, so don't choose it.

**Queen's Park Swizzle (`trinidad-swizzle`), in a `collins` or `footed-pilsner`**
- **Expect:** the famous three colors, from the bottom up:
  - bright green bruised mint leaves at the bottom;
  - a pale gold rum-and-lime middle in crushed ice;
  - a rust-red **Angostura crown** at the top, bleeding downward.

  The outside of the glass is white with frost from swizzling. A mint sprig and the swizzle stick are often left in.
- **Draw:**
  - Mint leaves as an *interior* band at the bottom: several small `garnish.mint-leaves` *(new)* shapes with a frond-green wash in the lowest ~20% of the glass.
  - The body pale gold.
  - **The crown painted onto the crushed-ice mound itself** and the top 15–20% of the liquid. Bitters soak into the cap and run down the ice, so the cap reads rust-red, not white. Today the crown is a liquid layer drawn under a white ice heap, which hides the drink's main feature.
  - A frost veil on the glass (a pale, granular white wash over the outside).
  - A mint sprig and optionally `garnish.swizzle-stick` *(new, bois lélé)* standing in the ice.
- **Never:** nutmeg, fruit flags, an umbrella.

### 2.2 Placement grammar (applies to every drawing)

How a working bartender builds the top of a tiki drink, and what the drawing should copy:

1. **Straw first, toward the back-right.** Garnish is built around it.
   - One straw for a single drink, slightly tilted (≈ 0.14 rad).
   - Bowls: 2–4 long straws fanned like spokes.
   - **No straw** on drinks served up (`coupe`, `nick-nora`, `cocktail-glass`, `flute`), on stirred drinks over a block, on the `ti-punch`, and on hot drinks.
   - A short straw on the `dof` Mai Tai is fine (from practice).
2. **Aromatic next to the straw.** Mint, a flower or a pineapple frond goes immediately beside the straw so the nose meets it on every sip. Draw the mint's stem foot within `0.15·hw` of the straw.
3. **Fruit on the rim, opposite the straw**, at front-left: a wheel or wedge slotted onto the rim with the slot straddling the glass. Half-wheels for narrow glasses (collins, chimney, highball), full wheels for wide ones (hurricane, DOF, snifter).
4. **Floaters on the cap:**
   - lime shells, flowers, an ice-cone tip, the flaming shell: on the ice mound at the center or center-left, partly sunk (lower third hidden);
   - for drinks served up: on the liquid surface (a floated twist or a single flower petal).
5. **Dusts on top:** nutmeg and cinnamon as freckles over the cap or surface. Denser in the middle, irregular, about 60–70% coverage. Never a ring, never solid brown.
6. **Picks diagonal:** skewers rest across the rim or stand in the ice at 20–35°, the pick visible beyond the fruit at both ends.
7. **Tall verticals stand in the ice:** a cinnamon stick, swizzle stick, sugarcane, back-scratcher or umbrella stand in the ice, never on the rim.
8. **Inside elements need a clear glass:** a peel spiral, a lime coin, bottom mint, a sink or the ice-cone body. In opaque vessels choose a visible signal instead.
9. **Budget:** at most **one hero garnish + one supporting garnish + one dust**, plus straws. The renderer's cap of four garnish functions is right. The engine's cap of three phrases is also right, as long as the dust and the aromatic count among them.
10. **Draw order (z):** glass back rim → liquid → ice → interior garnish (peel snake, bottom mint) → glass front → straws → aromatics → rim fruit → floaters → dusts → steam or flame. Mint should overlap the straw, so the straw is drawn first. The front half of a rim-slotted wheel overlaps the glass's front rim arc.

### 2.3 Scale

Garnish read at the vessel's scale makes the drawing believable. Typical sizes at 38 u/in (approximate, from practice):

| Garnish | Real size | Units | Current part | Suggested `s` |
|---|---|---|---|---|
| Lime shell (half lime) | 2.0–2.25 in across | 76–86 | box 60 wide | ≈ 1.3 |
| Lime wheel | ~2 in | ~76 | box 60 | ≈ 1.25 |
| Orange wheel | 2.75–3.25 in | 105–125 | box 60 | ≈ 1.8 (or a half-wheel at 1.8) |
| Cocktail or maraschino cherry | 0.75–0.9 in | 28–34 | Ø ≈ 20 inside a 44 × 62 box | ≈ 1.6 |
| Mint sprig above the cap | 2.5–4 in | 95–150 | box 92 tall | 1.1–1.6 |
| Pineapple wedge with skin | ~2.5–3 in long | ~100 | box 70 | ≈ 1.4 |
| Pineapple fronds (2–3 leaves) | 3–5 in | 115–190 | (new) | |
| Dendrobium orchid | 1.75–2.5 in | 65–95 | box 60 | ≈ 1.3 |
| Gardenia | 2.5–3.5 in | 95–130 | (new) | |
| Paper parasol, open | canopy ~3 in, stick ~4 in | 115 / 150 | box 80 × 90 | ≈ 1.4 |
| Cinnamon stick | 3–4 in | 115–150 | box 84 tall | ≈ 1.5 |
| Standard straw | 7.75 in | ~295 | length param | |
| Tiki or "giant" straw | 8.25–10.25 in | 315–390 | length param | |
| Bowl straws | 10–12 in | 380–455 | length param | |
| Ice cone (DOF) | ~4.5–5 in tall, ~2.25 in at the top **(uncertain)** | 170–190 tall | ice style | |
| Bamboo back-scratcher | ~17 in **(uncertain)** | crop at 1.0–1.2× vessel height | (new) | |
| Bois lélé swizzle stick | 8–12 in, with a 3–5-prong whorl | 300–450 | (new) | |

The current parts are drawn about 40–60% too small, which makes the drinks look like doll-house props. Tiki's own tradition runs bigger ("garnishes the size of your head" is a tiki blogger's motto).

**The vessel stays the subject.** A garnish crown should not rise more than about 0.6× the vessel's height above the rim. Exceptions: the back-scratcher, bowl straws, an umbrella stick, and a mint bouquet on a short glass.

### 2.4 The garnish signature for every archetype

This builds on `data/archetypes.json` `garnish` and doesn't contradict its `never` lists. **Hero** is the part that signals the archetype; **support** is optional. The "Draw" column uses the appendix's anchors.

| Archetype | Hero | Support | Dust | Draw notes |
|---|---|---|---|---|
| `pina-colada` | pineapple wedge + fronds on the rim | cherry tucked at the wedge; umbrella or orchid allowed | none | Opaque cream-white with a faint yellow cast; frozen dome above a `poco-grande`, or the pineapple or coconut vessel. No mint as the main garnish, no lime shell. |
| `painkiller` | **heavy fresh nutmeg cap** | orange wheel + cherry | nutmeg (dense) | §2.1. The nutmeg *is* the signal. |
| `fruit-colada` | pineapple wedge | the named fruit (strawberry etc.), orchid, umbrella | none | Color follows the fruit (Lava Flow: red strawberry streaks swirled through white; draw swirls only if the build pours the purée first). **No nutmeg**, which signals a Painkiller. |
| `bushwacker` | nutmeg or chocolate dust | whipped-cream dollop, cherry | nutmeg or cocoa | Opaque café-au-lait milkshake; a chocolate-syrup swirl inside the glass is allowed (it is a built layer). No citrus, no mint. |
| `coconut-daiquiri` | lime wheel | toasted coconut flakes (dust) | coconut flakes | Up: opaque milky white in a coupe; **no pineapple wedge** (it implies a colada) |
| `miami-vice` | pineapple wedge | strawberry, umbrella | — | **The one legitimate two-tone frozen drink:** strawberry daiquiri and piña colada poured side by side or layered. Draw two distinct washes, red-pink below or beside cream-white, with a soft wet-in-wet boundary. |
| `daiquiri` | none, or a lime wheel on the rim | — | — | Up in a coupe: thin froth line, condensation beads on the bowl. No straw, no umbrella. |
| `mai-tai` | lime shell dome-up | big mint beside the straw | — | §2.1 |
| `vic-mai-tai-riff` | mint | lime shell; Honi Honi: pineapple stick + cherry | — | As the Mai Tai |
| `planters-punch` | nutmeg on the cap, or an Angostura top | lime wheel or orange slice + cherry, mint | nutmeg | Collins, crushed ice |
| `bowl-punch` | lemon wheels floating on the surface | one big block of ice visible | nutmeg | `punch-bowl` with a ladle and cups; no straws |
| `ti-punch` | the lime coin *inside* the glass | small bois lélé | — | Short `rocks`, mostly empty, no straw, one cube at most |
| `grog` | lime wedge | lime shell | — | Rustic: cubes, tumbler |
| `navy-grog` | ice cone + centered straw | mint or lime shell at the cone's foot | — | §2.1 |
| `trinidad-swizzle` | Angostura crown on the ice | mint sprig, swizzle stick, frost | — | §2.1 |
| `bermuda-rum-swizzle` | orange slice + cherry | pineapple wedge | — | Frothy sunset-orange from swizzling pineapple; no crown, no nutmeg |
| `overproof-swizzle` | nutmeg dusting | cinnamon stick standing | nutmeg | `julep-cup` sweating white frost; little liquid visible |
| `herbal-swizzle` | nutmeg (Chartreuse) or crown (Green Swizzle) | mint | nutmeg | Frost on the glass |
| `dark-n-stormy` | lime wedge on the rim | candied ginger on a pick | — | **The storm:** a dark rum cloud at the top bleeding down (§3). Cubes. |
| `mule` | lime wheel or wedge | mint, candied ginger | — | Copper mug with condensation beads |
| `suffering-bastard` | mint sprig | orange half-wheel | — | Collins, cubes, fizz |
| `hemingway-daiquiri` | grapefruit twist, or none | — | — | Coupe; blush only with pink grapefruit |
| `frozen-daiquiri` | lime wheel, or none | short straw | — | Snowy dome; no umbrella on a Floridita frappé |
| `fruit-daiquiri` | the named fruit (banana slice, strawberry, passion-fruit half) | — | — | Fruit must match the drink |
| `nuclear-daiquiri` | none ("no garnish can withstand it") | lime wheel | — | Glow-stick yellow-green, up |
| `caipirinha` | lime wedges *inside*, among the ice | short straw | — | Rocks glass, crushed ice |
| `mojito` | mint bouquet | lime wedge, straw | — | Mint leaves suspended throughout; fizz |
| `rum-old-fashioned` | expressed orange or lime twist | cherry on a pick (optional) | — | One big clear cube; no straw |
| `kingston-negroni` | orange twist | — | — | Garnet, one cube |
| `corn-n-oil` | lime wedge | — | — | **The oil slick:** a black rum layer on top |
| `hot-buttered-rum` | cinnamon stick | — | nutmeg | Butter sheen ring, steam, no ice |
| `tom-and-jerry` | meringue-like cap | — | nutmeg, heavy | White mug, steam |
| `hot-grog` | lemon wheel studded with cloves | cinnamon stick | — | Clear amber, steam |
| `hot-rum-punch` | lemon peel spirals | — | nutmeg | Bowl; a ghostly blue flame only at service |
| `zombie` | mint bouquet | pineapple frond, or cherry on a pick | — | §2.1 |
| `pilot` | cherry on a pick | mint | — | DOF, crushed ice, deep amber |
| `cobras-fang` | mint sprig | lime wheel; flaming lime shell **(uncertain:** later mug service only) | — | Mug: show the surface and the mint |
| `beachcomber-spice-sour` | Three Dots: Morse pick; Nui Nui: long orange spiral inside | mint | — | Footed pilsner |
| `pearl-diver` | none (Don served it plain), or a gardenia | — | — | The ribbed Pearl Diver glass; creamy butterscotch body |
| `port-au-prince` | lime wedge | cherry; the umbrella is allowed | — | Pale gold with a faint blush |
| `beachcombers-gold` | **the shaved-ice shell lining the coupe** | — | — | §4 |
| `missionarys-downfall` | mint sprig | pineapple wedge | — | Pastel jade slush |
| `scorpion` | a gardenia floating | long straws (bowl); flaming lime shell in the bowl's well (theatrical) | — | Bowl: 3–4 straws fanned out |
| `fog-cutter` | mint sprig | straws | — | Mug: the sherry cap is what shows (amber band at the rim) |
| `tortuga` | mint sprig | orange slice | — | Chimney, reddish amber |
| `passion-sour` | Saturn: **lemon-peel ring around a cherry** (the planet and its ring) | — | — | Coupe or pilsner |
| `bitter-tiki-sour` | pineapple wedge + fronds | mint, orchid | — | Coral or salmon (Jungle Bird) |
| `bitters-base-sour` | none, or a lemon twist | — | — | Coupe, rust-garnet with a pinkish foam |
| `tropical-stirred` | orange twist | — | — | Rocks, one big cube |
| `blue-hawaii` | pineapple wedge or slice | orchid, umbrella, fronds, cherry | — | **Aqua-turquoise** (blue curaçao over yellow pineapple), never sapphire; hurricane glass |
| `hurricane` | orange-and-cherry flag | umbrella | — | §2.1; red only with a red ingredient |
| `resort-liqueur-punch` | pineapple wedge or orange slice | cherry, orchid, umbrella | — | Juicy and colorful, but color follows the liqueurs (banana yellow, blackberry purple-red) |
| `hawaiian-mai-tai` | pineapple wedge | orchid, cherry, **sugar-cane stick**, umbrella | — | The 1953 Royal Hawaiian style: juicier, may carry a dark-rum float (the one Mai Tai where the float is correct). Name it as such, not "Mai Tai". |
| `tropical-itch` | **bamboo back-scratcher** | pineapple spear, orchid, mint | — | §2.1; never an umbrella instead of the scratcher |
| `pineapple-shell` | the hollowed pineapple with its **crown as a lid**, set ajar | orchid, long straw | — | Draw the fruit vessel with the crown tilted back on top and the straw coming out under it; never an umbrella through the crown |
| `sunrise-float` | orange slice + cherry | a stir stick for the guest | — | **The sink is the point:** red grenadine at the bottom grading up into orange. One of the few archetypes where a gradient is legitimate. |
| `scorpion-bowl` | long straws, one per guest | gardenia, orchids, mint, flaming crater | — | Fan the straws like spokes. The gardenia floats. No "umbrella forest". |
| `volcano-bowl` | flame in the crater | long straws, orchid, mint | — | Dark-glazed bowl; the flame part sits in the crater; amber-orange surface |
| `zero-proof-tiki` | the *full* garnish of its boozy analogue (mint bouquet, pineapple, orchid, nutmeg or cinnamon) | — | as the analogue | Must look exactly as festive as the boozy drinks. A plainer garnish is the one thing its archetype forbids. |

**Signals to keep exclusive.** If the drink is not of that archetype, these garnishes claim a lineage it doesn't have:

| Garnish | Belongs to |
|---|---|
| Morse pick | `beachcomber-spice-sour` Three Dots-style |
| Ice cone | `navy-grog`, `grog` |
| Back-scratcher | `tropical-itch` |
| Peel snake | snifter drinks with orange and passion fruit (Sidewinder lineage) |
| Saturn ring | `passion-sour` |
| Angostura crown | swizzles (`trinidad-swizzle`, `herbal-swizzle`) and `planters-punch` |
| Ice shell | `beachcombers-gold` |
| Flaming shell | `scorpion`, `scorpion-bowl`, `volcano-bowl`, `cobras-fang` **(uncertain)**, and any drink with an explicit "flaming" request |
| Heavy nutmeg cap | `painkiller` (a light dusting is fine on punches, swizzles and hot drinks) |
| Sugar-cane stick | `hawaiian-mai-tai` and resort drinks |

A generated drink can borrow one *only* when it is a riff on that classic, or the prayer asks for it by name.

### 2.5 Fire, done right

Fire is real tiki theater, at the Mai-Kai, Smuggler's Cove and anywhere a Volcano Bowl is served.
- **The standard modern method (from practice):**
  - Flip a spent lime shell **cut side up** to make a little boat.
  - Put a crouton or sugar cube soaked in lemon extract (≈ 84% ABV) or 151 rum in it.
  - Light it, and dust ground cinnamon through the flame for sparks.
- **In the drawing:**
  - `garnish.lime-shell` with `orientation: "cup-up"` on the cap center;
  - a small `garnish.flame` *(new)*: three tongues in tier-1 ink with a butter-to-hibiscus wash;
  - a few `sparkle` tick marks above, for the cinnamon sparks.

  In bowls, the flame sits in the `volcano-bowl` crater.
- **Copy must say** "blow it out before you drink" or "let it burn out". Never suggest pouring the burning rum into the drink.
- **Only the `scorpion`, `scorpion-bowl`, `volcano-bowl`, `hot-rum-punch` and `hot-buttered-rum` (flamed Coffee Grog) archetypes** earn flame, plus explicit prayers. The `overproof-swizzle` never does; its archetype says so.

---

## 3. Color and layers in each vessel

`optics.js` already computes body color physically (Beer–Lambert absorbance plus scattering) and decides layers by specific gravity. That is the right basis. What follows is how an expert *expects* those colors to read in each vessel, plus the color errors that make experts wince.

### 3.1 Principles

1. **Color is earned.** Never paint a color the lines don't make. Common errors to guard against:
   - Blue needs `blue-curacao`. Red needs `grenadine`, `campari`, `hibiscus-syrup`, `cherry-heering`, `raspberry-syrup`, `cranberry-juice`, `pomegranate-juice`, `aperol` (orange-red), `strawberry` or a red fassionola.
   - Green needs `melon-liqueur`, `green-chartreuse`, mint muddled or blended in (`missionarys-downfall`), or blue + yellow.
2. **Mixing behaves like pigment and light, not like a crayon:**
   - **blue curaçao + pineapple or passion fruit → aqua to teal-green**. A Blue Hawaii is turquoise, not sapphire.
   - **blue + orange juice → a murky green-brown**, which is why good resort bartenders avoid it. Never generate it unless asked.
   - blue + coconut cream → opaque pastel sky-aqua (Blue Hawaiian).
   - Campari + pineapple → coral or salmon (Jungle Bird). Grenadine + pineapple → coral-pink. Grenadine + orange, shaken → salmon-orange.
   - Dark rum + pineapple + coconut → tan (Painkiller). Passion fruit → opaque golden orange. Guava → opaque pink. Hibiscus → translucent magenta-ruby.
   - Coffee → near-black. Absinthe or pastis in volume → a pale, milky louche.
3. **Cloudy versus clear is as important as hue:**
   - Opaque, matte: cream, coconut and blended drinks.
   - Hazy and translucent: fresh juice, orgeat and falernum drinks.
   - Glassy and clear: stirred drinks, a Ti' Punch. Clear drinks need highlights and visible ice. Cloudy ones need a dense, flat wash with little ice showing below the cap.
4. **Path length (depth) changes the shade.** This is an aficionado-grade realism point the renderer currently ignores (fixed alpha):
   - The same drink reads **paler in a shallow coupe** and **deeper in a chimney or the belly of a snifter**.
   - Scale wash alpha by the glass's local width or depth: about ×0.7 in `coupe`, `nick-nora`, `cocktail-glass` and `flute`; ×1.15 in the lower half of `chimney` and `collins`, and in the center of `snifter` and `hurricane` bulges.
5. **Crushed ice whitens and frost mutes.** A glass packed with crushed ice shows the drink as tinted spaces *between* white pebbles. The cap above the rim is white or blue-white. It is never drink-colored, except where bitters or a float soaks it (a crown, a dark-rum float on a Zombie-style riff).
   - Frosted swizzle glasses and julep cups veil the whole body in pale granular white. Lower body saturation by about 30% under frost.
6. **Shaken, blended or flash-blended means one color.** No sunset gradients, no stripes. Layers exist only when:
   - something is *floated last* (a dark-rum float, the Fog Cutter's sherry, a cream float, the Dark 'n Stormy rum);
   - something is *sunk last* (a grenadine sunrise: the point of `sunrise-float`, acceptable in resort drinks, **never** on a Mai Tai or Zombie);
   - something is *crowned* (bitters);
   - the build leaves *muddled solids* (QPS mint at the bottom, Caipirinha limes, Mojito leaves);
   - two frozen drinks are poured side by side (`miami-vice`).

   `drinkLook` already enforces this by specific gravity. The drawing must not add gradients beyond it.
7. **Foam:**
   - Shaken pineapple gives a thin pale froth (Jungle Bird, Port au Prince).
   - Egg white gives a thick white cap, sometimes with an Angostura stencil or dots (from practice).
   - Swizzled pineapple gives a frothy head (Bermuda Rum Swizzle).
   - Draw foam as a pale band with a soft lower edge, not a stroke.

### 3.2 Vessel by vessel

| Vessel | What shows | Layers | Ice and surface |
|---|---|---|---|
| `coupe`, `nick-nora`, `cocktail-glass` | A shallow lens of color, paler than the same drink in a tall glass. A thin froth line on shaken drinks; condensation beads on the bowl. | Float: a thin band at the meniscus. A sink shows only as a slightly darker bowl bottom. | No ice, or (frozen) a mounded dome above the rim. **Exception: Beachcomber's Gold,** with a white ice shell lining the bowl and the liquid in the hollow. |
| `flute` | A tall narrow column, pale, rising bead lines | Rarely | No ice |
| `rocks` | A short pool, glassy | Rare (Corn 'n' Oil's slick) | One big cube, or a Ti' Punch with none |
| `dof` | A wide body seen through crushed ice: color between pebbles, white cap above the rim | Float: a dark band at the top of the liquid that bleeds into the ice | Crushed and mounded; or the ice cone; or one big cube for stirred drinks |
| `highball`, `collins` | A tall column; deeper toward the bottom; bubbles if fizzy | The Dark 'n Stormy rum cloud: the top quarter mahogany, tendrils down. QPS: green bottom, gold middle, red crown. | Cubes (3 visible) or crushed with a cap |
| `chimney` | The tallest column, so the deepest color. The Zombie reads copper-amber, darker at the foot. | Generally none | Crushed, packed, with a cap. Some Zombie serves add cubes on top **(uncertain:** "packed with crushed ice and topped with cubes" appears in the repo's look text) |
| `hurricane` | The lamp-shaped bulge: deepest at the lower bulge, lighter at the waist. Resort colors look vivid here. | A sunrise sink is possible in resort drinks | Crushed to the top, cap above the rim |
| `poco-grande`, `goblet` | Frozen drinks: a matte opaque dome over a tulip bowl | None | Dome above the rim, no pebbles drawn |
| `footed-pilsner` | A tapered cone, deeper toward the top (wider), so lighter near the foot | QPS crown and mint, as for the collins | Crushed with a cap |
| `pearl-diver` | A creamy opaque butterscotch in the flared bowl; ribbed column below | None | Crushed |
| `snifter` | A big round belly, darkest at the center, with a lens highlight on one side. The peel snake shows here. | A float sits at the bowl's widest point **(from practice)** | Crushed, half to three quarters full |
| `tulip` | A tall stemmed tulip, Singapore Sling pink-coral | None | Crushed or cubes |
| `irish-coffee` | Dark coffee body with a **cream float** a clean white band on top (if the recipe floats cream); HBR opaque caramel with a butter-sheen ring | Cream float only | No ice; steam |
| `julep-cup`, `copper-mug`, `enamel-tin` | Opaque: surface only. Julep cup: heavy white frost on the outside. Copper: condensation beads. Tin: the navy lip. | Surface shows the top layer (float or crown) | The heap above the rim |
| Ceramics (`ku-mug`, `moai-mug`, `skull-mug`, `barrel-mug`, `fog-cutter-mug`, `bird-mug`, `clay-cup`, `hot-mug`) | Surface only: an ellipse of drink color at the rim, mostly hidden under the ice heap | The Fog Cutter's sherry cap shows as an amber ring between ice and rim | The heap; garnishes do the talking |
| `coconut`, `pineapple` | Surface only; the fruit is the vessel | — | The heap; draw the lid or the fronds of the pineapple set aside, or the pineapple top as a hat **(from practice)** |
| `scorpion-bowl`, `tiki-bowl`, `volcano-bowl` | A wide surface of cloudy pale orange-straw (Scorpion) with the gardenia floating | — | Crushed or cubes visible on the wide surface; 2–4 straws fanned; volcano crater flame |
| `punch-bowl` | A wide, clear-to-hazy pale gold | — | **One block of ice**, lemon wheels floating, nutmeg; a ladle |

### 3.3 Color words for copy

Color words (`optics.colorWord`) should go into the tasting note only when they match the drawing. Avoid "sunset" unless there is a sink. Avoid "blue lagoon" unless blue curaçao is present. "Golden", "amber", "copper", "coral", "ruby", "cream" and "jade" are the vocabulary experts recognize (from practice).

---

## 4. How each kind of ice looks

Ice is half of a tiki drink's look. These are the `ice` styles the engine and renderer use.

| Style | What it is | How it looks | How to draw it |
|---|---|---|---|
| `cubed` | 1–1.25 in cubes, cloudy in the center | 2–3 cubes visible through clear glass, tilted, edges catching light; a cloudy core | Square outlines, tier 2, each with a short diagonal highlight; faint blue wash. The current renderer is right. |
| `block` | One large clear 2 in cube or sphere | A single crystal-clear block, sharp edges, one long highlight; the liquid wraps around it | One large square, tier 2; *no* cloudy wash, or a very light one; a single highlight stroke |
| `crushed` | Irregular cracked chips (Lewis bag or machine) | Packed glass, a mottled white matrix; a **dome above the rim** (~0.5 in), irregular silhouette | Bumpy mound stroke plus 5–9 small pebble outlines, more at the cap than inside |
| `pebble` | Uniform rounded nuggets ("Sonic" or pellet ice) | Like crushed but rounder, more regular, more translucent | Rounder pebble outlines, same size, slightly more liquid showing |
| `shaved` | Fine snow (Vic's Mai Tai, Beachcomber's Gold, ice cones) | A smooth, matte, snowy dome; no individual pieces; frosts the glass instantly | A smooth mound stroke with a few stipple dots, no pebble outlines; the frost veil on the glass |
| `ice-cone` | Shaved ice molded and frozen around the straw | A white tapering column standing in the glass, rising about 1 in above the rim, the straw coming out of its tip | Two side strokes, a top ellipse, centered straw (§2.1) |
| `ice-shell` | Shaved ice pressed into a coupe, frozen, the drink poured into the hollow (Beachcomber's Gold, Don the Beachcomber 1937) | A white lining following the bowl, a small pool of liquid in the middle | **(new style)**: an inner offset of the bowl profile by about 6 u, filled with ice wash; liquid only in the inner hollow |
| `blended` | Frozen; flash-blended drinks are not this | An opaque, matte, slushy dome above the rim; fine crystals; the glass frosted | The frozen dome (present). No cubes, no pebbles inside. |
| `none` | Hot drinks; a neat Ti' Punch; drinks served up | Hot: steam rising. Up: a beaded chill on the bowl. | Steam only with `method: hot`. Never draw steam and ice together. |

**Flash-blended is not frozen.** Don's flash blend (a few seconds on a spindle mixer with crushed ice) gives a frothy, well-chilled drink full of crushed ice. It is not a slush. Draw it as `crushed`, never as the `blended` dome. Experts notice when a Zombie is drawn like a margarita slush.

**Frost and condensation (aficionado tells):**
- Swizzles and julep cups frost **white and opaque** on the outside: a granular pale veil, sometimes with finger marks.
- Up drinks and highballs bead with **condensation droplets** in small tier-3 circles.
- Hot drinks have neither.

---

## 5. Details that make an aficionado smile

These are cheap to draw or say and signal real knowledge. Use one per drink, never all of them.

1. **Mai Tai:** the lime shell dome-up, the mint as its palm; no pineapple, no float, no red.
2. **Navy Grog:** the straw dead-center through the cone.
3. **Three Dots:** Morse order, three dots and then the dash.
4. **Queen's Park:** green, gold and red layers plus white frost; the crown *on the ice*.
5. **Saturn:** a lemon-peel ring around a cherry: a planet and its ring. (J. "Popo" Galsini's 1967 competition winner.)
6. **Sidewinder's Fang:** clove eyes on the peel snake's head.
7. **Tropical Itch:** the back-scratcher, plus a copy line inviting you to use it.
8. **Painkiller:** a heavy nutmeg cap (from practice). Pusser's numbering (No. 2, 3, 4) refers to how many ounces of rum go in, a nice copy detail for strength.
9. **Zombie:** the copy's "two per guest", after Don's legendary limit.
10. **Fog Cutter:** Vic's line, "Fog Cutter, hell. After two of these, you won't even see the stuff." For a riff, adapt the joke rather than quoting it. The sherry float shows as an amber ring in the mug.
11. **Beachcomber's Gold:** the ice shell in the coupe.
12. **Pearl Diver:** the ribbed glass.
13. **Scorpion bowl:** the floating gardenia and a fan of long straws.
14. **The flaming lime shell:** cinnamon sparks.
15. **Ti' Punch:** a near-empty glass, a lime coin and a small swizzle. Tradition says *chacun prépare sa propre mort*, "each prepares his own death": you build it yourself.
16. **Dark 'n Stormy:** the rum cloud bleeding down, "the storm".
17. **Corn 'n' Oil:** the black-rum "oil slick" on top.
18. **Jungle Bird:** a nod to the ceramic bird it was first served in, or a bird-mug vessel.
19. **Copy that credits creators by name**, including those history forgot:
    - Ray Buhen, Filipino, one of Don's original "Four Boys" (later of the Tiki-Ti) **(from practice; well documented, not re-checked this session)**;
    - Mariano Licudine (Mai-Kai);
    - Harry Yee (Hilton Hawaiian Village);
    - Jeffrey Ong (Kuala Lumpur Hilton);
    - Joe Scialom (Shepheard's Hotel);
    - Ramón "Monchito" Marrero (Caribe Hilton).
20. **Rum categories named the Smuggler's Cove way** ("blended aged rum", "pot-still unaged") rather than "dark rum" alone.
21. **Mint bouquets slapped** (copy: "slap the mint to wake it"). It releases aroma without bruising.
22. **Freshly grated nutmeg** in the copy, never "a pinch of nutmeg powder".
23. **Honest strength.** "Strong; this is a sipper" earns more trust than "dangerously drinkable".

**Things that make an aficionado wince.** The validator should flag these:
- an umbrella in a coupe, a stirred drink or a Mai Tai;
- a cherry and orange flag on a Mai Tai;
- a red or orange Zombie;
- a grenadine sunrise on anything but a resort punch;
- a dark-rum float on a Mai Tai (unless it is explicitly the Royal Hawaiian resort riff);
- pineapple on a Dark 'n Stormy;
- mint on a colada;
- nutmeg on a QPS;
- salt or sugar rims on tiki classics;
- steam with ice;
- cubes in a frozen drink;
- a straw in a coupe;
- bubbles in a drink with no carbonation;
- blue with no blue curaçao;
- "sunset" layers in a shaken drink;
- a garnish fruit not in the drink and not part of the archetype vocabulary (a strawberry on a drink with no strawberry);
- five garnishes at once;
- a flash-blended Zombie drawn as a slushie;
- "Mai Tai" copy for a drink with pineapple juice and no orgeat.

---

## 6. Cultural sensitivity in tiki imagery and naming

### 6.1 Where modern bars landed

The repo's `docs/history.md` §7 already records the debate. Its main points, confirmed in this session's searches:
- Carved tiki and kiʻi figures represent gods and ancestors. Making them bar mascots and drinking vessels trivializes living religions.
- "Polynesia" was flattened into one invented look.
- Hula-girl and "savage" tropes sexualize and demean.
- The fantasy grew alongside the overthrow of the Hawaiian Kingdom and Pacific militarism.
- The Filipino, Chinese-American and Caribbean bartenders who did the work went uncredited.

Responses:
- Chicago's **Lost Lake** reopened in 2021 as a "tropical" bar. It said tiki culture "cannot be divorced from cultural appropriation and colonialism", then closed in 2022 after pandemic losses.
- **Garret Richard and Ben Wald's *Tropical Standard*** (2023) uses "tropical" deliberately. **Shannon Mustipher** foregrounds the drinks' Caribbean roots.
- **Martin Cate** argues that modern tiki bars recreate a retro-*American* 1940s–60s aesthetic rather than claim to represent Polynesia.
- **Pacific Islander views differ:** some object to any tiki theming; others accept a clearly fictional mid-century style while rejecting sacred imagery and caricature.

The consensus practice: **keep the escapism, the craft and the botanical, nautical and mid-century design; drop sacred figures used as jokes, the sexualized women, the "savage" and cannibal tropes, mock-pidgin, and "Oriental" caricature. Credit real people.**

### 6.2 Rules for drawings

| Do | Avoid |
|---|---|
| Botanicals (hibiscus, plumeria, monstera, palms, pineapple, coconut, orchid), fruit, glassware, rattan and bamboo textures, nautical gear (glass floats, rope, compass, lantern), weather and sea | Human figures as décor, especially women in grass skirts, coconut bras, or hula poses |
| Vessels drawn as the objects they are, when the recipe uses them | Faces with bones through noses, cannibal pots, shrunken heads drawn as gags, "headhunter" imagery |
| Mid-century mug shapes stylized as ceramic objects (glaze, form) | Animating, winking or making a named deity the butt of a joke |
| Generic carved-wood patterns (chevrons, bands) | Specific sacred iconography presented as a mascot (Kū named and animated as "the tiki god"), tattoo-like patterns (Polynesian tatau has lineage meaning) |

**Recommendations for this project's own framing.** These are product decisions to raise, not settled rules:
- **The Ku idol by the input that "blinks when you pray"** (`idol.ku`) and the name **"Tiki God"** with **"prayers"** are close to exactly what critics single out: a Hawaiian war god turned into a cute mascot and a joke religion.
  - *Mitigations,* from lightest to strongest:
    1. stop calling the figure Kū in code and copy, and describe it as a mid-century mug style;
    2. remove the blink, so the deity is not a toy;
    3. replace the idol with a non-sacred mascot (a pineapple, a parrot, a glass float). Swapping in a Moai doesn't help; it is also sacred (see below);
    4. reframe "prayer" as "wish", "order" or "message in a bottle".
  - Keeping the current framing is defensible as clearly fictional Polynesian Pop. But the card copy should then never extend the joke into fake ritual language ("the god demands…").
- **Moai mugs** depict Rapa Nui ancestor figures. They are ubiquitous and less charged than Kū in practice, but the same argument applies. Use them as vessels when a drink calls for one; prefer botanicals for the decorative frame.
- **The Scorpion bowl's kneeling hula-girl supports** (`scorpion-bowl` in `artcatalog.js`) are historically accurate to the Trader Vic's bowl. Draw them as simplified, non-sexualized caryatid forms or plain feet. Don't add skirts or emphasize bodies.
- **The skull mug and Shrunken Skull** are historically real; skulls are a pirate and Day-of-the-Dead motif. Draw a skull, never a "shrunken head" with stitched lips and hair. Tsantsa are Shuar and Achuar sacred practice.

### 6.3 Rules for names (`names.js`)

The current approach (nautical, botanical, weather and rum-geography imagery rather than faux-Polynesian words) is right and matches modern practice. Add a blocklist and a few constraints:

- **Never generate:**
  - savage, native, primitive, headhunter, cannibal, witch doctor;
  - voodoo or hoodoo (Vodou is a living Haitian religion; "Voodoo" drink names are common and widely criticized);
  - squaw, wahine, hula girl, island girl, "dusky";
  - coolie, Oriental, Fu Manchu, geisha, "Chinaman", Shanghai'd;
  - shrunken head, tsantsa.
- **Sacred or significant words, never as flavor text:** Kū, Lono, Kāne, Kanaloa, Pele (a living deity; the bar Hale Pele aside), Māui (as a god, not the island), mana, kapu or tapu, tiki (as a word for a god), moai, kahuna, aloha and mahalo (as filler), ʻohana.
- **Mock-pidgin or invented "Polynesian" words** ("Bongo Bongo", "Ooga", "Wiki Wiki Wahine", "Booga") are out. Classic pseudo-Polynesian names (Mai Tai, Nui Nui, Aku Aku, Pupule, Lapu Lapu) stay **only** for riffs of those classics. Note that Lapu-Lapu is a Filipino national hero, not a Polynesian word; another reason not to coin new ones.
- **Colonial and slavery vocabulary:** avoid "Plantation" and "Planter" in *new* names. The rum brand Plantation was renamed Planteray over the word's link to slavery. "Planter's Punch" survives only as the historical family name for riffs. Also avoid "conquistador", "colonial", "Missionary" and "Overseer" in new names; the historical "Missionary's Downfall" stays for riffs.
- **Real places are fine when the rum is from there** (Demerara, Port Royal, Martinique, Trelawny), as `names.js` already does. Don't attach a people's name to an invented drink ("Samoan", "Tahitian", "Maori" + noun), except for historical riffs (Samoan Fog Cutter).
- **The "creature" and "spooky" pools are fine.** Zombie, Kraken, Specter and Siren are Western folklore. "Idol" and "Relic" in `NOUN.adventure` are borderline and point at the sacred-object problem; I'd drop "Idol". (The bars False Idol and Pagan Idol use it knowingly, but a generator can't be knowing.)

### 6.4 Rules for copy

- Describe flavors with ingredients and places, not peoples: "Demerara rum and allspice", not "island spices"; "Caribbean" when it is Caribbean rum, not "exotic natives".
- "Exotic" is the genre's historical term ("exotic cocktails", Cate's subtitle). Use it for drinks in a history note, never for people.
- Credit creators and the uncredited (§5 item 19). It costs one clause and changes the tone of the card.

---

## 7. The voice of good tiki menu copy

### 7.1 What the classic and modern menus do

- **Don the Beachcomber:**
  - The Zombie's limit of **two per customer** is the most famous menu line in tiki: bravado that is also a warning.
  - Rum blends were kept secret; copy promised mystery, not ingredient lists.
- **Trader Vic's:** chatty, first-person, salesman's humor. The Fog Cutter line ("Fog Cutter, hell. After two of these, you won't even see the stuff") and the Mai Tai origin story (*maita'i roa ae*, "out of this world, the best") are told as anecdote.
- **The Mai-Kai:**
  - grouped drinks by strength (reportedly *mild*, *medium* and *strong*) **(uncertain:** from memory; not re-verified this session);
  - wrote short, evocative descriptions and dramatized the Mystery Drink's service with a gong and a dancer.
- **Modern bars** (Smuggler's Cove, Three Dots and a Dash, Sunken Harbor Club; general characterization from practice):
  - short lines with an ingredient list and a strength cue;
  - playful but exact;
  - name the rum category;
  - a wink in the description;
  - no lecture.

### 7.2 Voice rules

1. **Specific nouns.** "Funky Jamaican rum, lime, honey and a whisper of allspice", not "a tropical blend of island flavors". Specific is credible; generic sounds like a resort buffet.
2. **Wink, don't sneer.** One joke per card at most, aimed at the drinker or the drink's bravado ("Two per guest. We mean it.").
3. **Sensory order.** First what you see and smell (garnish aroma), then the palate, then texture and finish. The tasting-note structure in `copy.js` (front, middle, finish, texture, balance, strength) is right. Add a nose line when there is an aromatic garnish ("Mint and lime at the nose").
4. **Honest strength.** Pair each strength band with a plain cue: *Mild* (<10% ABV), *Medium* (10–15%), *Strong* (15–20%), *Two per guest* (20%+). Never "dangerously drinkable", "you won't taste the alcohol" or "goes down easy" for strong drinks. Cate and Berry both stress the responsibility side of tiki's high-proof heritage **(from practice)**.
5. **Short.**
   - **Name:** 2–3 words.
   - **Tagline:** ≤ 14 words: *type word + 1–2 defining flavors + mood*.
   - **Tasting note:** 2–4 sentences.
   - **Service line:** 1 sentence (vessel, ice, garnish ritual).
   - **Story:** 2–4 sentences of lineage with credit.
6. **Echo the prayer's mood, not fake flavors.** "Heartbreak" earns a mood ("for the long night after"), a name image and maybe a bittersweet build (`bitter-tiki-sour`, `stirred`). It doesn't earn "tastes like heartbreak". The current `copy.js` principle ("the prayer contributes the mood, never fake flavors") is exactly right.
7. **Present tense, second person sparingly.** "Swizzle until the glass frosts", not "Your senses will be transported…".
8. **No purple prose.** Avoid these banned clichés: "explosion of flavors", "symphony", "tantalizing", "exotic paradise in a glass", "taste buds", "dangerously", "tropical vibes", "liquid sunshine", "nectar of the gods".
9. **Teach once, kindly.** Define one technical term per card when it matters: "flash-blend: a 5-second buzz with crushed ice", "swizzle: spin a stick between your palms".

### 7.3 Examples

**Bad** (what the reviewer saw):
> *Lazy Sunday Colada.* "A tropical colada with cinnamon and lime, for a lazy sunday." *(no coconut, no pineapple in the lines)*

**Good** (same prayer, an honest `pina-colada` build):
> **Hammock Colada**
> *A silky colada with a little Jamaican funk, for a slow Sunday.*
> Pineapple and lime up front; cream of coconut and funky Jamaican rum carry the middle; it finishes on fresh nutmeg. Blended until thick and frosty. Medium strength: easy, but it's still rum.
> *Served in a poco grande with a pineapple wedge on the rim.*
> Born at San Juan's Caribe Hilton in 1954, the colada needed Coco López, invented a few years earlier, to exist. This one adds a splash of Jamaican rum, the way the Painkiller adds navy rum.

**Heartbreak** (an honest `bitter-tiki-sour`):
> **Bittersweet Lagoon**
> *A bitter tiki sour with grapefruit and Campari, for the long night after.*
> Grapefruit and lime up front, then blackstrap rum and Campari: bitter and dark, softened by pineapple froth. Tart and bracing. Medium strength.
> *Double old fashioned over crushed ice; pineapple fronds beside the straw.*
> Descended from Jeffrey Ong's Jungle Bird (Kuala Lumpur Hilton, 1973), the drink that taught tiki to love bitter.

**Strong drink:**
> **Undertow**
> *A Beachcomber heavyweight with three rums, grapefruit and cinnamon.*
> … Strong: two per guest. Donn Beach would approve.

### 7.4 Truth checks between card, drawing and lines

Each check should be machine-enforced:

1. **Type word ⇔ signature.** The tagline's type noun ("colada", "Mai Tai", "swizzle", "grog", "punch", "sour", "Zombie"…) comes from the archetype the composer *satisfied*. For example, `colada` requires both `pineapple-juice` and `coconut-cream` (in the archetype's ozRange).
2. **Flavor words ⇔ carriers.** Every named flavor has a carrier line at a tasting dose (`copy.js presence`).
3. **Color word ⇔ optics.** The color word comes from `drinkLook().description`. Words like "red", "blue" or "sunset" need the carrier ingredient or layer.
4. **Garnish ⇔ allowed.** Every garnish phrase must be:
   - in the archetype's `required`/`typical` list, or an aromatic echoing an ingredient line;
   - **not** in its `never` list (substring match);
   - drawable (it resolves to a part in the appendix);
   - compatible with the vessel (interior garnishes need clear glass).
5. **Drawing ⇔ card.** Every drawn garnish part comes from a garnish phrase on the card, and vice versa. That means no umbrella added by family default unless the card lists "paper umbrella".
6. **Service ⇔ drawing.** The ice style drawn equals `recipe.method.ice`. A straw is drawn iff the vessel and service take one. Steam appears iff `method === 'hot'`. Fizz appears iff a carbonated line exists.
7. **Strength cue ⇔ ABV band.**

---

## 8. Open questions

- Exact original Zombie garnish beyond mint at Don's (1934 versus 1950s menus).
- Exact dimensions of the Kon-Tiki/Cocktail Kingdom Navy Grog cone (height versus DOF height).
- Whether Pusser's official Painkiller garnish is orange *wheel* + cherry + nutmeg, or nutmeg + orange only. Search results give both; the Pusser's site summary includes the cherry.
- The Mai-Kai's historical menu strength categories (mild/medium/strong): recalled from practice, not verified this session.
- The original serve and garnish of the 1973 Jungle Bird beyond the ceramic bird.
- Whether the Cobra's Fang's flaming lime shell is historical or a later mug-service addition (the archetypes file already flags "later").
- Product decision: the Ku idol and "Tiki God"/"prayer" framing (§6.2).

---

## Sources

- Punch, "More Is More: The Evolution of Tiki Garnish." https://punchdrink.com/articles/more-is-more-the-evolution-of-tiki-garnish/
- James Beard Foundation archive, Three Dots and a Dash (Smuggler's Cove recipe, Morse garnish note). https://archive.jamesbeard.org/recipes/three-dots-and-a-dash
- Beachbum Berry, Navy Grog recipe and ice-cone barware. https://beachbumberry.com/recipe-navygrog.html · https://beachbumberry.com/barware-ice-cone.html
- The Atomic Grog, "Navy Grog ice cone lost art is revived." https://slammie.com/atomicgrog/blog/2014/06/11/navy-grog-ice-cone-lost-art-is-revived-by-cocktail-enthusiasts-handy-gadget
- VinePair, Navy Grog. https://vinepair.com/cocktail-recipe/navy-grog/
- Difford's Guide, Mai Tai (Trader Vic's). https://www.diffordsguide.com/cocktails/recipe/1219/mai-tai
- Beachbum Berry, Zombie (1934). https://beachbumberry.com/recipe-zombie.html · Punch, Zombie. https://punchdrink.com/recipes/zombie/
- Liber & Co., Sidewinder's Fang. https://liberandcompany.com/products/sidewinders-fang · The Atomic Grog, Mai-Kai Sidewinder's Fang review. https://www.slammie.com/atomicgrog/blog/2012/05/10/mai-kai-cocktail-review-bring-a-friend-and-sink-your-teeth-into-the-classic-sidewinders-fang/ · First Pour Cocktails, Sidewinder's Fang. https://www.firstpourcocktails.com/tiki-classics-sidewinders-fang/
- Punch, Tropical Itch. https://punchdrink.com/recipes/tropical-itch/ · Wikipedia, Harry Yee. https://en.wikipedia.com/wiki/Harry_Yee · Kaiser Penguin, Tropical Itch. https://www.kaiserpenguin.com/tropical-itch/
- Difford's Guide, Hurricane (original recipe). https://www.diffordsguide.com/cocktails/recipe/992/hurricane-original-recipe · NewOrleans.com, Hurricane. https://www.neworleans.com/drink/cocktails/hurricane/
- Difford's Guide, Queen's Park Swizzle. https://www.diffordsguide.com/cocktails/recipe/2740/queens-park-swizzle · VinePair, Queen's Park Swizzle. https://vinepair.com/cocktail-recipe/the-queens-park-swizzle
- Pusser's, Painkiller. https://pussersrum.com/blogs/cocktails/pussers-painkiller · Saveur, Painkiller. https://www.saveur.com/story/recipes/painkiller-cocktail/
- Newcity Resto, "Is This the End of the Tiki Bar? We Asked Local Pacific Islanders." https://resto.newcity.com/2021/12/08/is-this-the-end-of-the-tiki-bar-we-asked-local-pacific-islanders-what-they-think/
- Time Out Chicago, Lost Lake closing. https://www.timeout.com/chicago/news/beloved-logan-square-tropical-bar-lost-lake-is-closing-010722
- Pacific Island Times, "The curious case of Tiki racism." https://www.pacificislandtimes.com/post/the-curious-case-of-tiki-racism
- Lost Routes Tiki, "Are Traditional Tiki Bars Cultural Appropriation?" https://ampersandproduction.wixsite.com/lostroutestiki/post/are-traditional-tiki-bars-cultural-appropriation-here-39-s-what-experts-are-saying
- Punch, "The Evolution of Tiki in Four Eras" (Martin Cate). https://punchdrink.com/articles/mapping-the-eras-of-tiki-with-martin-cate-smugglers-cove-sf-cocktail-book/
- Wikipedia, Cocktail umbrella. https://en.wikipedia.org/wiki/Cocktail_umbrella
- Repo: `docs/history.md` §7–8, `docs/concepts.md`, `docs/vessels.md`, `data/archetypes.json` (garnish and look fields), `data/drinks.json` (garnish phrase frequencies).

---

## Appendix: garnish phrases → drawable parts (JSON)

Conventions:
- **Coordinates** use the renderer's own rim frame from `rimOf(kind)`:
  - `cx`: the vessel's center x;
  - `rimY`: the rim's y;
  - `hw`: the rim half-width;
  - `top`: where things rest (the ice cap `rimY − 14` when heaped, the frozen dome `rimY − 24`, the rim for opaque vessels, the liquid level for drinks served up);
  - `level`: the liquid level;
  - `bottom`: the bowl floor.
- **Sizes** are inches at 38 u/in. The renderer converts them to `s = (inches × 38) / partNativeSize`.
- **`z`** is the draw order (lower first).
- **`status`**: `existing` parts are in `CATALOG` now; `proposed` parts need adding to `artcatalog.js`.
- **Matching:** `phrases` are matched in order against each lowercased garnish string; the **first** match wins for that string. Signature entries come first.

```json
{
  "version": 1,
  "units": { "perInch": 38, "note": "Matches docs/vessels.md scale; sizes are typical real-world garnish sizes (approximate)." },

  "anchors": {
    "rim-front-left":  { "x": "cx - 0.96*hw", "y": "rimY + 2", "note": "Slotted onto the rim; front half overlaps the glass front arc." },
    "rim-front-right": { "x": "cx + 0.96*hw", "y": "rimY + 2" },
    "cap-center":      { "x": "cx", "y": "top", "note": "On the ice mound / frozen dome / surface; lower third hidden in ice when heaped." },
    "cap-left":        { "x": "cx - 0.35*hw", "y": "top + 4" },
    "beside-straw":    { "x": "strawX - 0.12*hw", "y": "top + 6", "note": "Aromatic stem foot within 0.15*hw of the straw so the nose meets it." },
    "straw-back-right":{ "x": "cx + 0.3*hw", "y": "opaque ? rimY + 4 : bottom - 14", "rot": 0.14, "note": "Default single straw." },
    "straw-center":    { "x": "cx", "y": "bottom - 14", "rot": 0, "note": "Ice cone: straw exactly on the axis, out of the cone tip." },
    "across-rim":      { "x": "cx + 0.1*hw", "y": "rimY - 6", "rot": -0.26, "note": "Pick laid across the rim, visible beyond the fruit at both ends." },
    "standing-in-ice": { "x": "cx - 0.2*hw", "y": "top + 18", "rot": 0.1, "note": "Tall verticals (cinnamon, swizzle stick, sugarcane, back-scratcher, umbrella)." },
    "surface-float":   { "x": "cx - 0.2*hw", "y": "level", "note": "Drinks served up / bowls: floating on the liquid." },
    "dust-surface":    { "shape": "ellipse", "rx": "0.6*hw", "ry": "0.6*hw*rimTilt + 2", "at": "cap-center", "note": "Freckles, denser at center, ~65% coverage; never a ring." },
    "interior-bottom": { "x": "cx", "y": "bottom - 0.12*(bottom-level)", "requiresClear": true },
    "interior-helix":  { "from": "bottom - 8", "to": "rimY + 6", "turns": 2.75, "requiresClear": true, "note": "Front segments tier 1, back segments tier 3." },
    "over-rim-drape":  { "x": "cx + 0.8*hw", "y": "rimY - 4", "note": "Hooks over the rim, part outside the glass." },
    "bowl-spokes":     { "x": "cx", "y": "rimY + 4", "note": "2-4 long straws fanned at (i-(n-1)/2)*0.32 rad." }
  },

  "parts": {
    "garnish.mint":           { "status": "existing", "sizeIn": [2.5, 4.0], "params": { "big": "bouquet|big|bunch" }, "z": 6 },
    "garnish.lime-shell":     { "status": "existing", "sizeIn": [2.0, 2.25], "params": { "orientation": ["dome-up", "cup-up"] }, "z": 8,
                                "fix": "Add orientation. dome-up = spent shell floating skin-up (Mai Tai island, speckled pores); cup-up = flaming crouton boat. Current drawing is cup-up only." },
    "garnish.lime-wheel":     { "status": "existing", "sizeIn": [1.9, 2.1], "params": { "half": "boolean" }, "z": 7 },
    "garnish.orange-wheel":   { "status": "existing", "sizeIn": [2.75, 3.25], "params": { "half": "boolean" }, "z": 7, "note": "Use half=true on collins/chimney/highball/footed-pilsner." },
    "garnish.cherry":         { "status": "existing", "sizeIn": [0.75, 0.9], "z": 9, "fix": "Currently ~0.45in at s=0.85; draw at s≈1.6." },
    "garnish.orchid":         { "status": "existing", "sizeIn": [1.75, 2.5], "z": 8 },
    "garnish.umbrella":       { "status": "existing", "sizeIn": [3.0, 4.0], "z": 5, "note": "Canopy ~3in; stick ~4in. Only where the archetype allows (see limits.umbrellaAllowed)." },
    "garnish.pineapple-wedge":{ "status": "existing", "sizeIn": [2.5, 3.0], "z": 7 },
    "garnish.cinnamon":       { "status": "existing", "sizeIn": [3.0, 4.0], "z": 5 },
    "garnish.beans":          { "status": "existing", "sizeIn": [0.4, 0.5], "z": 9, "note": "Three coffee beans floated on foam/cream." },
    "garnish.peel":           { "status": "existing", "sizeIn": [2.0, 3.0], "z": 7, "note": "Short expressed twist on the rim or floated." },
    "garnish.nutmeg":         { "status": "existing", "z": 10, "note": "Freckle field; Painkiller: dense (coverage 0.75), others 0.55." },
    "straw":                  { "status": "existing", "sizeIn": [7.75, 10.25], "z": 4 },
    "sparkle":                { "status": "existing", "z": 11, "note": "Cinnamon sparks above a flame." },

    "garnish.pineapple-fronds": { "status": "proposed", "sizeIn": [3.0, 5.0], "z": 5, "draw": "2-3 long serrated blade leaves fanning from a point, frond-green wash; stands beside the straw." },
    "garnish.pineapple-chunk":  { "status": "proposed", "sizeIn": [1.0, 1.25], "z": 9, "draw": "Small rectangle with a rind edge; the 'dash' in Three Dots." },
    "garnish.pick":             { "status": "proposed", "sizeIn": [3.5, 4.5], "z": 8, "draw": "Thin bamboo pick, tier-2 line, knotted or plain end." },
    "garnish.morse-pick":       { "status": "proposed", "sizeIn": [4.0, 4.5], "z": 9, "composite": ["garnish.pick", "garnish.cherry x3", "garnish.pineapple-chunk"], "draw": "Order left→right: cherry, cherry, cherry, chunk (· · · —). Equal spacing ~0.95in." },
    "garnish.orange-flag":      { "status": "proposed", "sizeIn": [2.75, 3.25], "z": 9, "composite": ["garnish.orange-wheel(half)", "garnish.cherry", "garnish.pick"], "draw": "Half orange wheel upright on the rim, cherry in its crook, pick through both." },
    "garnish.lime-wedge":       { "status": "proposed", "sizeIn": [1.5, 2.0], "z": 7, "draw": "Crescent wedge slotted on the rim, rind outward. Today lime wedges fall back to a wheel." },
    "garnish.lemon-wheel":      { "status": "proposed", "sizeIn": [2.0, 2.4], "z": 7, "draw": "citrusWheel with PALETTE.butter; params.cloves for Hot Grog." },
    "garnish.lime-coin":        { "status": "proposed", "sizeIn": [1.0, 1.25], "z": 3, "requiresClear": true, "draw": "Small round disc of lime peel with a little flesh, inside the glass (Ti' Punch)." },
    "garnish.peel-snake":       { "status": "proposed", "sizeIn": [18, 30], "z": 3, "requiresClear": true, "draw": "Helix of 0.75in orange peel at anchor interior-helix; triangular head over-rim-drape with two clove dots (PALETTE.wood)." },
    "garnish.peel-spiral":      { "status": "proposed", "sizeIn": [8, 14], "z": 3, "requiresClear": true, "draw": "Long orange (Nui Nui) or lime/lemon (Singapore Sling, Horse's Neck-style) spiral inside the glass, no head." },
    "garnish.peel-ring":        { "status": "proposed", "sizeIn": [1.6, 2.0], "z": 9, "draw": "Saturn: a thin lemon-peel band tilted ~0.35 rad encircling a cherry, like a planet's ring." },
    "garnish.back-scratcher":   { "status": "proposed", "sizeIn": [12, 17], "z": 5, "draw": "Thin bamboo rod with a curled 5-finger hand at the top; rises 1.0-1.2x vessel height above rim; crop at box top." },
    "garnish.swizzle-stick":    { "status": "proposed", "sizeIn": [8, 12], "z": 5, "draw": "Bois lélé: straight twig with a whorl of 3-5 short prongs at the bottom (visible in clear glass), top standing out of the ice." },
    "garnish.sugarcane":        { "status": "proposed", "sizeIn": [6, 8], "z": 5, "draw": "Pale green-gold stick with node rings every ~1.5in." },
    "garnish.gardenia":         { "status": "proposed", "sizeIn": [2.5, 3.5], "z": 8, "draw": "Waxy white spiral of 6-8 overlapping petals, faint butter center; floats on bowls (Scorpion)." },
    "garnish.edible-flower":    { "status": "proposed", "sizeIn": [1.0, 1.5], "z": 8, "draw": "Small 5-petal flower (borage, viola); fallback to orchid at s 0.6." },
    "garnish.flame":            { "status": "proposed", "sizeIn": [1.0, 1.75], "z": 11, "draw": "Three tongues, tier-1 ink, butter→hibiscus wash; sits in a cup-up lime shell or volcano crater." },
    "garnish.mint-leaves":      { "status": "proposed", "sizeIn": [0.6, 1.0], "z": 3, "requiresClear": true, "draw": "5-9 small leaves at interior-bottom (QPS) or scattered through (Mojito), frond-green wash." },
    "garnish.bitters-crown":    { "status": "proposed", "z": 6, "draw": "Rust-red (angostura optics) wash ON the ice cap plus downward tendrils 15-20% of body height; replaces the white cap wash." },
    "garnish.candied-ginger":   { "status": "proposed", "sizeIn": [0.75, 1.0], "z": 9, "draw": "Sugared amber cube on a pick." },
    "garnish.fruit-slice":      { "status": "proposed", "sizeIn": [1.0, 2.0], "params": { "fruit": ["banana", "strawberry", "passion-fruit-half", "mango", "apple", "grapefruit"] }, "z": 7, "draw": "Generic slice on the rim, colored by fruit; passion-fruit half floats cut-up showing seeds." },
    "garnish.cucumber":         { "status": "proposed", "sizeIn": [1.25, 1.5], "z": 7 },
    "garnish.herb-sprig":       { "status": "proposed", "sizeIn": [2.5, 3.5], "params": { "herb": ["basil", "rosemary", "geranium"] }, "z": 6 },
    "garnish.dust":             { "status": "proposed", "params": { "spice": ["cinnamon", "cocoa"] }, "z": 10, "draw": "Like nutmeg but cinnamon is redder-brown, cocoa darker; finer dots." },
    "garnish.whipped-cream":    { "status": "proposed", "sizeIn": [1.5, 2.5], "z": 9, "draw": "Soft piped swirl, 3 tiers, paper-white with a faint cream wash." },
    "garnish.pineapple-crown-lid": { "status": "proposed", "sizeIn": [4, 6], "z": 9, "draw": "The pineapple's own leafy crown set back on the cut top, tilted ajar ~0.3 rad; straw emerges beneath." },
    "ice.style.ice-shell":      { "status": "proposed", "draw": "Inner offset (~6u) of the coupe bowl filled with ice wash; liquid only in the inner hollow (Beachcomber's Gold)." },
    "glass.frost":              { "status": "proposed", "draw": "Pale granular white veil over the outside of the vessel (swizzles, julep cup); lowers body saturation ~30%." },
    "glass.condensation":       { "status": "proposed", "draw": "6-12 tier-3 droplet circles on the bowl (up drinks, highballs, copper mug)." }
  },

  "phrases": [
    { "match": "three cherr(y|ies).*(pineapple|frond)|morse|three dots",
      "parts": [{ "part": "garnish.morse-pick", "anchor": "across-rim", "sizeIn": 4.25 }],
      "signals": ["beachcomber-spice-sour"], "exclusive": true },

    { "match": "ice cone|cone of (shaved )?ice|straw through an ice cone",
      "parts": [{ "ice": "ice-cone" }, { "part": "straw", "anchor": "straw-center", "sizeIn": 8.25 }],
      "signals": ["navy-grog", "grog"], "exclusive": true,
      "rules": ["Only one straw, rot 0, centered.", "Cone rises ~1in above rim.", "Opaque vessel: draw only cone tip + straw above rim."] },

    { "match": "back ?-?scratcher",
      "parts": [{ "part": "garnish.back-scratcher", "anchor": "standing-in-ice", "heightOverRim": "1.1*vesselHeight" }],
      "signals": ["tropical-itch"], "exclusive": true },

    { "match": "(orange[- ]peel )?['\"]?snake|sidewinder|peel.*fang",
      "parts": [{ "part": "garnish.peel-snake", "anchor": "interior-helix" }],
      "requiresClear": true, "vesselsPreferred": ["snifter", "goblet", "hurricane"], "exclusive": true },

    { "match": "(long )?spiral.*(orange|lime|lemon) peel|(orange|lime|lemon) peel spiral|horse'?s neck",
      "parts": [{ "part": "garnish.peel-spiral", "anchor": "interior-helix" }],
      "requiresClear": true, "fallbackIfOpaque": "garnish.peel" },

    { "match": "peel ring around a cherry|ring around a cherry|saturn",
      "parts": [{ "part": "garnish.peel-ring", "anchor": "across-rim" }],
      "signals": ["passion-sour"], "exclusive": true },

    { "match": "angostura (crown|top|float)|bitters crown|crown of bitters",
      "parts": [{ "part": "garnish.bitters-crown", "anchor": "cap-center" }],
      "signals": ["trinidad-swizzle", "herbal-swizzle", "planters-punch"],
      "rules": ["Paint on the ice cap itself, not under it.", "Requires an angostura line marked crown."] },

    { "match": "flaming lime shell|flaming shell|lime shell.*(flame|fire|lit)|crouton",
      "parts": [{ "part": "garnish.lime-shell", "params": { "orientation": "cup-up" }, "anchor": "cap-center", "sizeIn": 2.1 },
                { "part": "garnish.flame", "anchor": "cap-center", "dy": -10 },
                { "part": "sparkle", "anchor": "cap-center", "dy": -40 }],
      "signals": ["scorpion", "scorpion-bowl", "volcano-bowl", "hot-rum-punch", "hot-buttered-rum", "cobras-fang"],
      "copy": "Let it burn out (or blow it out) before drinking." },

    { "match": "(half )?(spent )?lime (half[- ])?shell|lime hull",
      "parts": [{ "part": "garnish.lime-shell", "params": { "orientation": "dome-up" }, "anchor": "cap-left", "sizeIn": 2.1 }],
      "signals": ["mai-tai", "vic-mai-tai-riff", "grog", "navy-grog", "mojito"],
      "rules": ["Pair with mint planted at its edge when both present (island + palm)."] },

    { "match": "shaved[- ]ice shell|ice shell|lined with (crushed|shaved) ice",
      "parts": [{ "ice": "ice-shell" }],
      "signals": ["beachcombers-gold"], "vessels": ["coupe", "cocktail-glass"], "exclusive": true },

    { "match": "orange (slice|wheel|half[- ]wheel).*(cherr)|cherr.*orange (slice|wheel)|flag",
      "parts": [{ "part": "garnish.orange-flag", "anchor": "rim-front-right", "sizeIn": 3.0 }],
      "signals": ["hurricane", "sunrise-float", "resort-liqueur-punch", "bermuda-rum-swizzle", "planters-punch"],
      "neverWith": ["mai-tai", "navy-grog", "daiquiri", "trinidad-swizzle", "bowl-punch", "ti-punch", "grog"] },

    { "match": "mint (bouquet|bunch|sprigs)|bouquet of mint|big mint",
      "parts": [{ "part": "garnish.mint", "params": { "big": true }, "anchor": "beside-straw", "sizeIn": 3.75 }] },

    { "match": "\\bmint( sprig| leaf| leaves)?\\b",
      "parts": [{ "part": "garnish.mint", "anchor": "beside-straw", "sizeIn": 3.0 }],
      "rules": ["Mojito / QPS also add garnish.mint-leaves inside when clear."] },

    { "match": "pineapple (wedge|spear|slice|crescent)( and fronds)?",
      "parts": [{ "part": "garnish.pineapple-wedge", "anchor": "rim-front-left", "sizeIn": 2.75 }],
      "addIf": { "fronds": { "part": "garnish.pineapple-fronds", "anchor": "beside-straw", "sizeIn": 4.0 } } },

    { "match": "pineapple (frond|fronds|leaf|leaves)",
      "parts": [{ "part": "garnish.pineapple-fronds", "anchor": "beside-straw", "sizeIn": 4.0 }] },

    { "match": "pineapple (chunk|cube|stick)",
      "parts": [{ "part": "garnish.pineapple-chunk", "anchor": "across-rim" }, { "part": "garnish.pick", "anchor": "across-rim" }] },

    { "match": "(maraschino |luxardo |cocktail |brandied )?cherr(y|ies)( on a (pick|stick)| sail|, skewered)?|skewered (maraschino )?cherr",
      "parts": [{ "part": "garnish.cherry", "anchor": "cap-left", "sizeIn": 0.85 }],
      "rules": ["On a pick → add garnish.pick across-rim.", "Never on daiquiri, trinidad-swizzle, dark-n-stormy, mule, kingston-negroni, missionarys-downfall, nuclear-daiquiri (archetype never lists)."] },

    { "match": "orange (wheel|slice|half[- ]wheel|half)|^orange$",
      "parts": [{ "part": "garnish.orange-wheel", "anchor": "rim-front-left", "sizeIn": 3.0, "params": { "half": "narrowVessel" } }] },

    { "match": "lime wedge|lime crescent",
      "parts": [{ "part": "garnish.lime-wedge", "anchor": "rim-front-left", "sizeIn": 1.75 }],
      "fallback": "garnish.lime-wheel (half)" },

    { "match": "lime (wheel|slice|disc)|dehydrated lime",
      "parts": [{ "part": "garnish.lime-wheel", "anchor": "rim-front-left", "sizeIn": 2.0 }] },

    { "match": "lime coin|lime (disc|coin) in the glass|the lime coin",
      "parts": [{ "part": "garnish.lime-coin", "anchor": "interior-bottom" }],
      "signals": ["ti-punch"], "requiresClear": true },

    { "match": "lime wedges? (stay|in the glass|muddled)",
      "parts": [{ "part": "garnish.lime-wedge", "anchor": "interior-bottom", "count": 3 }],
      "signals": ["caipirinha"], "requiresClear": true },

    { "match": "lemon wheel studded with cloves|clove[- ]studded lemon",
      "parts": [{ "part": "garnish.lemon-wheel", "params": { "cloves": true }, "anchor": "surface-float", "sizeIn": 2.2 }],
      "signals": ["hot-grog"] },

    { "match": "lemon (wheel|slice)s?( floating)?",
      "parts": [{ "part": "garnish.lemon-wheel", "anchor": "rim-front-left", "sizeIn": 2.2 }],
      "rules": ["In punch-bowl: several floating at surface-float."] },

    { "match": "(orange|lemon|lime|grapefruit)( zest)? (twist|peel|zest)|expressed",
      "parts": [{ "part": "garnish.peel", "anchor": "rim-front-right", "sizeIn": 2.5 }],
      "rules": ["Tint by citrus: orange PALETTE.orange, lemon PALETTE.butter, lime PALETTE.lime, grapefruit #F2A0A0.", "Stirred drinks: drape on the rim or float on the surface."] },

    { "match": "(grated |fresh )?nutmeg",
      "parts": [{ "part": "garnish.nutmeg", "anchor": "dust-surface" }],
      "rules": ["painkiller: coverage 0.75 (the signal).", "Never on trinidad-swizzle, bermuda-rum-swizzle, dark-n-stormy, mule, suffering-bastard, bitter-tiki-sour, fruit-colada, coconut-daiquiri, miami-vice, blue-hawaii, hurricane, resort-liqueur-punch, hawaiian-mai-tai, tropical-itch, pineapple-shell, sunrise-float, scorpion-bowl, volcano-bowl (archetype never lists)."] },

    { "match": "(grated |ground )?cinnamon( powder| dust)?$|cinnamon dust|cocoa|chocolate powder",
      "parts": [{ "part": "garnish.dust", "anchor": "dust-surface" }] },

    { "match": "cinnamon stick",
      "parts": [{ "part": "garnish.cinnamon", "anchor": "standing-in-ice", "sizeIn": 3.5 }],
      "rules": ["Hot drinks: standing in the mug at level+18."] },

    { "match": "gardenias?",
      "parts": [{ "part": "garnish.gardenia", "anchor": "surface-float", "sizeIn": 3.0 }],
      "signals": ["scorpion", "scorpion-bowl", "pearl-diver"],
      "rules": ["Bowls: float at bowl center-left.", "Copy: gardenias are decoration, not for eating."] },

    { "match": "(edible )?orchid|dendrobium",
      "parts": [{ "part": "garnish.orchid", "anchor": "cap-left", "sizeIn": 2.0 }] },

    { "match": "edible flowers?|borage|viola|physalis",
      "parts": [{ "part": "garnish.edible-flower", "anchor": "cap-left" }] },

    { "match": "(paper |cocktail )?umbrella|parasol",
      "parts": [{ "part": "garnish.umbrella", "anchor": "standing-in-ice", "sizeIn": 4.0 }],
      "rules": ["Only if archetype in limits.umbrellaAllowed and vessel is not served-up/stirred."] },

    { "match": "coffee beans?",
      "parts": [{ "part": "garnish.beans", "anchor": "cap-center" }] },

    { "match": "(bois l[eé]l[eé]|swizzle stick)",
      "parts": [{ "part": "garnish.swizzle-stick", "anchor": "standing-in-ice" }],
      "signals": ["trinidad-swizzle", "herbal-swizzle", "ti-punch", "overproof-swizzle"] },

    { "match": "sugar ?cane",
      "parts": [{ "part": "garnish.sugarcane", "anchor": "standing-in-ice" }] },

    { "match": "candied ginger",
      "parts": [{ "part": "garnish.candied-ginger", "anchor": "across-rim" }, { "part": "garnish.pick", "anchor": "across-rim" }] },

    { "match": "banana (slice|chunk)|strawberr(y|ies)( slices?)?|passion fruit( half)?|mango slice|apple (wedge|slice)|apricot slice|grapefruit wedge",
      "parts": [{ "part": "garnish.fruit-slice", "anchor": "rim-front-left" }],
      "rules": ["The fruit must be in the drink's lines (fruit-daiquiri never lists 'a different fruit than the one named')."] },

    { "match": "cucumber",  "parts": [{ "part": "garnish.cucumber", "anchor": "rim-front-left" }] },
    { "match": "basil|rosemary|geranium", "parts": [{ "part": "garnish.herb-sprig", "anchor": "beside-straw" }] },

    { "match": "straws?$|long straws",
      "parts": [{ "part": "straw", "anchor": "bowl-spokes" }],
      "rules": ["Bowls: min(4, max(2, servings)) straws, 10-12in."] },

    { "match": "large block of ice|block of ice in the bowl",
      "parts": [{ "ice": "block" }], "vessels": ["punch-bowl"] },

    { "match": "whipped cream",
      "parts": [{ "part": "garnish.whipped-cream", "anchor": "cap-center" }],
      "signals": ["bushwacker"], "rules": ["Only bushwacker and dessert-style drinks; never on tiki classics."] },

    { "match": "toasted coconut( flakes)?|coconut flakes",
      "parts": [{ "part": "garnish.dust", "params": { "spice": "coconut" }, "anchor": "dust-surface" }],
      "signals": ["coconut-daiquiri"] },

    { "match": "chocolate[- ]syrup swirl|chocolate swirl",
      "parts": [{ "layer": "swirl", "color": "coffee-liqueur/creme-de-cacao optics" }],
      "requiresClear": true, "signals": ["bushwacker"] },

    { "match": "crown lid|hollowed pineapple",
      "parts": [{ "part": "garnish.pineapple-crown-lid", "anchor": "cap-center" }],
      "vessels": ["pineapple"], "signals": ["pineapple-shell"] },

    { "match": "stir stick|stirrer",
      "parts": [{ "part": "garnish.swizzle-stick", "params": { "plain": true }, "anchor": "standing-in-ice" }] },

    { "match": "^none$|no garnish",
      "parts": [], "rules": ["Draw nothing; never auto-add an umbrella or cherry."] }
  ],

  "signatures": [
    { "classic": "Mai Tai",              "archetype": "mai-tai",                "vessel": "dof",            "ice": "crushed",   "garnish": ["spent lime shell", "mint sprig"], "composition": "lime-shell dome-up at cap-left; mint (big) planted at its edge beside the straw", "body": "translucent honey-amber, one color" },
    { "classic": "Painkiller",           "archetype": "painkiller",               "vessel": "enamel-tin",     "ice": "crushed",   "garnish": ["grated nutmeg", "orange wheel", "cherry"], "composition": "dense nutmeg cap; orange wheel rim-front-left; cherry tucked; one straw", "body": "opaque pale tan-orange" },
    { "classic": "Zombie",               "archetype": "zombie",                 "vessel": "chimney",        "ice": "crushed",   "garnish": ["mint bouquet", "pineapple fronds"], "composition": "tall mint beside a 10in straw; optional fronds behind", "body": "copper-amber, darker at the foot; never red" },
    { "classic": "Navy Grog",            "archetype": "navy-grog",              "vessel": "dof",            "ice": "ice-cone",  "garnish": ["ice cone with straw"], "composition": "cone ~1in above rim; single centered straw out of the tip", "body": "cloudy amber-tan, few bubbles" },
    { "classic": "Three Dots and a Dash","archetype": "beachcomber-spice-sour", "vessel": "footed-pilsner", "ice": "crushed",   "garnish": ["three cherries and a pineapple chunk on a pick"], "composition": "morse-pick across-rim, · · · — left to right", "body": "hazy golden amber" },
    { "classic": "Hurricane",            "archetype": "hurricane",  "vessel": "hurricane",      "ice": "crushed",   "garnish": ["orange slice and cherry flag"], "composition": "orange-flag rim-front-right; long straw opposite", "body": "red ONLY with a red ingredient; otherwise cloudy amber-orange" },
    { "classic": "Tropical Itch",        "archetype": "tropical-itch",  "vessel": "hurricane",      "ice": "crushed",   "garnish": ["bamboo back-scratcher", "pineapple wedge", "orchid"], "composition": "back-scratcher standing, 1.1x vessel height above rim", "body": "hazy golden orange" },
    { "classic": "Sidewinder's Fang",    "archetype": null, "family": "resort-punch",  "vessel": "snifter",        "ice": "crushed",   "garnish": ["orange-peel snake", "mint sprig"], "composition": "peel-snake helix inside; head with clove eyes over front-right rim", "body": "hazy golden orange, fizz" },
    { "classic": "Queen's Park Swizzle", "archetype": "trinidad-swizzle",       "vessel": "collins",        "ice": "crushed",   "garnish": ["Angostura crown", "mint sprig"], "composition": "mint leaves at bottom; gold body; rust crown ON the ice cap; frost veil; swizzle stick optional", "body": "green / gold / rust-red tri-color" },
    { "classic": "Saturn",               "archetype": "passion-sour",           "vessel": "coupe",          "ice": "none",      "garnish": ["lemon peel ring around a cherry"], "composition": "peel-ring + cherry across the rim", "body": "opaque frothy pale yellow-gold" },
    { "classic": "Scorpion Bowl",        "archetype": "scorpion-bowl",             "vessel": "scorpion-bowl",  "ice": "crushed",   "garnish": ["gardenia", "long straws"], "composition": "gardenia floating; 3-4 straws as spokes; optional flaming shell", "body": "cloudy pale orange-straw" },
    { "classic": "Beachcomber's Gold",   "archetype": "beachcombers-gold",      "vessel": "coupe",          "ice": "ice-shell", "garnish": [], "composition": "white shaved-ice lining; jewel-like pale gold pool in the hollow", "body": "translucent pale gold" },
    { "classic": "Dark 'n Stormy",       "archetype": "dark-n-stormy",          "vessel": "highball",       "ice": "cubed",     "garnish": ["lime wedge"], "composition": "lime wedge on rim; the storm: dark rum cloud in the top quarter bleeding down", "body": "hazy straw-gold ginger beer under mahogany cloud" },
    { "classic": "Corn 'n' Oil",         "archetype": "corn-n-oil",             "vessel": "rocks",          "ice": "crushed",   "garnish": ["lime wedge"], "composition": "black rum oil slick on top", "body": "pale straw-gold under near-black" },
    { "classic": "Ti' Punch",            "archetype": "ti-punch",               "vessel": "rocks",          "ice": "none",      "garnish": ["the lime coin itself, in the glass"], "composition": "short, mostly empty glass; lime coin inside; no straw", "body": "water-clear or pale gold, glassy" },
    { "classic": "Fog Cutter",           "archetype": "fog-cutter",             "vessel": "fog-cutter-mug", "ice": "crushed",   "garnish": ["mint sprig", "straws"], "composition": "amber sherry ring visible at rim between ice and mug", "body": "cloudy straw-orange under amber sherry cap" },
    { "classic": "Volcano Bowl",         "archetype": "volcano-bowl",             "vessel": "volcano-bowl",   "ice": "crushed",   "garnish": ["flame in the crater", "long straws"], "composition": "flame in central crater; straws as spokes", "body": "cloudy amber-orange" }
  ],

  "limits": {
    "maxGarnishParts": 3,
    "maxDusts": 1,
    "umbrellaAllowed": ["pina-colada", "fruit-colada", "miami-vice", "blue-hawaii", "hurricane", "resort-liqueur-punch", "hawaiian-mai-tai", "sunrise-float", "port-au-prince", "planters-punch(with fruit only)", "zero-proof-tiki(if its analogue allows)"],
    "umbrellaNeverVessels": ["coupe", "nick-nora", "cocktail-glass", "flute", "rocks", "irish-coffee", "hot-mug"],
    "noStrawVessels": ["coupe", "nick-nora", "cocktail-glass", "flute", "irish-coffee", "hot-mug", "punch-bowl"],
    "noStrawArchetypes": ["ti-punch", "rum-old-fashioned", "kingston-negroni", "tropical-stirred", "daiquiri", "hemingway-daiquiri", "nuclear-daiquiri", "bitters-base-sour", "hot-buttered-rum", "tom-and-jerry", "hot-grog", "hot-rum-punch", "bowl-punch"],
    "garnishCrownMaxOverVesselHeight": 0.6,
    "exemptFromCrownMax": ["garnish.back-scratcher", "garnish.umbrella", "straw", "garnish.swizzle-stick"],
    "interiorPartsRequireClear": ["garnish.peel-snake", "garnish.peel-spiral", "garnish.lime-coin", "garnish.mint-leaves"],
    "flameAllowedArchetypes": ["scorpion", "scorpion-bowl", "volcano-bowl", "hot-rum-punch", "hot-buttered-rum"],
    "flameAllowedVessels": ["volcano-bowl", "scorpion-bowl", "tiki-bowl"],
    "flameRequiresPrayerOtherwise": true
  },

  "conflicts": [
    { "if": "archetype.garnish.never contains phrase (substring)", "then": "drop the phrase and its parts" },
    { "if": "family default (umbrella for colada/resort-punch) but archetype not in umbrellaAllowed", "then": "no umbrella" },
    { "if": "steam && ice !== 'none'", "then": "error" },
    { "if": "method === 'flash-blend'", "then": "ice style crushed, never the frozen dome" },
    { "if": "frozen (blend/blended) && cubes drawn", "then": "error" },
    { "if": "fizz drawn && no line in [soda-water, ginger-beer, ginger-ale, cola, tonic, lemon-lime-soda, sparkling-wine]", "then": "error" },
    { "if": "body hue blue && no blue-curacao", "then": "error" },
    { "if": "body hue red/pink && none of [grenadine, campari, hibiscus-syrup, cherry-heering, raspberry-syrup, raspberry-liqueur, cranberry-juice, pomegranate-juice, strawberry, guava-nectar, guava-syrup, aperol, sloe-gin, ruby-port, peychauds(dominant), watermelon-juice]", "then": "error" },
    { "if": "sink/sunrise layer && archetype in [mai-tai, zombie, navy-grog, pilot]", "then": "error" },
    { "if": "exclusive signature phrase && archetype not in its signals && not a riff of that classic && not named in prayer", "then": "drop phrase" },
    { "if": "drawn garnish part not traceable to a card garnish phrase", "then": "error (drawing must equal card)" }
  ],

  "copyCues": {
    "noseLine": { "garnish.mint": "Mint at the nose.", "garnish.nutmeg": "Fresh nutmeg on the nose.", "garnish.dust(cinnamon)": "A breath of cinnamon.", "garnish.peel": "Citrus oil over the top.", "garnish.gardenia": "A gardenia floating on top, for the scent.", "garnish.orchid": "" },
    "serviceLine": "Served in a {vessel.name} over {ice words}, with {garnish list}.",
    "iceWords": { "crushed": "crushed ice", "pebble": "pebble ice", "shaved": "shaved ice", "cubed": "cubes", "block": "one big cube", "ice-cone": "a cone of shaved ice frozen around the straw", "ice-shell": "a shell of shaved ice", "blended": "blended until thick and frosty", "none": "no ice" },
    "strengthCue": [ { "maxAbv": 10, "word": "Mild" }, { "maxAbv": 15, "word": "Medium" }, { "maxAbv": 20, "word": "Strong" }, { "maxAbv": 100, "word": "Strong: two per guest" } ],
    "bannedPhrases": ["explosion of flavor", "symphony", "tantalizing", "taste buds", "dangerously drinkable", "you won't taste the alcohol", "liquid sunshine", "nectar of the gods", "tropical vibes", "exotic paradise", "island spices", "the gods demand"],
    "bannedNameWords": ["savage", "native", "primitive", "headhunter", "cannibal", "witch doctor", "voodoo", "hoodoo", "squaw", "wahine", "hula girl", "island girl", "dusky", "coolie", "oriental", "geisha", "shrunken head", "tsantsa", "plantation", "planter", "conquistador", "colonial", "overseer", "kapu", "tapu", "mana", "kahuna", "pele", "kanaloa", "lono", "idol"],
    "classicNamesOnlyForRiffs": ["Mai Tai", "Nui Nui", "Aku Aku", "Pupule", "Lapu Lapu", "Missionary's Downfall", "Planter's Punch", "Suffering Bastard", "Samoan Fog Cutter", "Zombie", "Navy Grog", "Painkiller", "Hurricane", "Three Dots and a Dash", "Tropical Itch", "Sidewinder's Fang"]
  }
}
```
