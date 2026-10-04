# Drink color model: Beer-Lambert absorbance plus a scattering term

`color.json` gives every ingredient in `data/ingredients.json` a color (`hex`), a coloring strength (`tint`), a cloudiness (`opacity` for the neat look, `scatter` for mixing), a specific gravity (`sg`) and a pour `behavior`. This note explains how to turn a recipe into a body color and layers. The model is calibrated against 50 reference drinks (`referenceDrinks`). Mean error on the reference body colors:

| setup | mean distance* |
|---|---|
| repo's interim optics in the current `web/lib/optics.js` | 18.0 |
| this table in the current `optics.js`, unchanged | 13.7 |
| this table in the model below | 11.2 |

\*Luma-weighted RGB distance on a 0–255 scale. Below about 10 two swatches look like "the same drink". The reference colors are expert estimates, not spectrophotometer readings, so about 10 is the noise floor. Tuning past it would only fit my own guesses.

## 1. What the fields mean

- **hex**: the ingredient's color at drinking strength. It is the hue the ingredient gives a finished drink when it is the main colorant. For weak colorants such as juices, pale spirits and syrups, this is also roughly how it looks neat in a glass.
- **tint**: absorbance strength per unit of volume fraction, applied to `hex`. A neat ingredient filling a ~7 cm glass looks like `hex^tint` in linear light (`neatHex`).
  - 0: clear (white rum, gin, simple syrup).
  - ~1: a typical juice or gold rum.
  - 2–3: dark rum, cola, amaro, allspice dram.
  - 3.5–5: grenadine, Campari, Angostura, cassis.
  - 7: blue curaçao, the strongest dye in the bar.
- **layerHex**: the look of a float or sink band seen through crushed ice, `hex^max(1, 0.6·tint)`. Use it for float and sink bands. A bitters crown is a thin film, so it uses plain `hex`. Strong narrow-band dyes have hand-set `neatHex`/`layerHex` values because broadband RGB over-darkens them (see §6).
- **opacity**: how cloudy the ingredient looks neat (0 = water-clear, 1 = cream). Use it for descriptions and for drawing a neat pour.
- **scatter**: scattering strength per unit volume fraction, used for mixing. Typical values:
  - 6: heavy cream
  - 5: coconut cream, ice cream
  - 4–4.5: coconut milk, half-and-half
  - 3.5: Irish cream
  - 2.5: banana
  - 2: Gardenia Mix
  - 1.5: guava, mango and apricot nectar; hot buttered rum batter
  - 1.2: orgeat
  - 1: pineapple and orange juice
  - 0.2–0.5: citrus, ginger beer, passion fruit syrup and liqueur
  - 0: clear liquids

  `opacity` cannot carry this job: cream and orgeat both look opaque neat, but a quarter-ounce of cream whitens a drink far more than a quarter-ounce of orgeat.
- **sg**: specific gravity at 20 °C, relative to water (see §4).
- **behavior**: what the ingredient does if poured unmixed onto a typical tiki body (SG ≈ 1.02).
  - `floats`: SG ≤ 0.99. This covers all spirits, sherry, cream, butter and spice dust.
  - `sinks`: SG ≥ 1.085. This covers syrups and dense liqueurs.
  - `clouds`: the ingredient scatters light (juice pulp, orgeat, coconut, dairy, louching anise).
  - `foams`: pineapple juice and egg white, which throw a head when shaken.
  - `mixes`: everything else.

## 2. Body color: absorbance, then scattering

Work in **linear light**. Convert hex to sRGB 0..1, then `lin(v) = v ≤ 0.04045 ? v/12.92 : ((v+0.055)/1.055)^2.4`. Here `f_i` is ingredient i's share of the final volume, meltwater included:
`f_i = oz_i / (Σ oz + dilution oz)`. Take dilution from `chem.dilutionFactor`: about 20–25% shaken, 30–45% for crushed ice, swizzled or flash-blended, and about 90% blended.

**Absorbance (Beer–Lambert).** Absorbances of dissolved colorants add, so transmittances multiply. This is subtractive mixing.

```
a_ik = −ln(max(lin(hex_ik), 0.002))                 per channel k ∈ {R,G,B}
A_k  = (L / 7 cm) · Σ_i f_i · tint_i · a_ik           L = liquid path through the vessel
T_k  = exp(−A_k)                                     what a clear drink transmits
```

**Scattering.** Turbidity rises with the summed scattering of cloudy ingredients. It saturates, because a little cream already makes a drink opaque.

```
σ     = Σ_i f_i · scatter_i
S     = 1 − exp(−κ σ)                κ = 8
alb_k = Σ_i f_i·scatter_i·lin(hex_ik) / σ      color of the scatterers (pulp, fat, almond milk)
R_k   = ((1 − w)·alb_k + w) · T_k^β          w = 0.15, β = 0.5
out_k = (1 − S)·T_k + S·R_k
```

`R` is the light that bounced back out of a cloudy drink. It takes the scatterers' own color (pale yellow pineapple, white coconut, ivory orgeat), whitened a little. Its effective path through the absorbers is shorter, so it is filtered by `T^β` with β ≈ ½ rather than by the full `T`. Two familiar results follow:

- A Painkiller with dark Pusser's is **tan**, not brown.
- A Piña Colada is **pale cream-yellow**, even though neat pineapple juice is golden.

Report `S` as the drink's cloudiness. Above about 0.45 say "cloudy"; above about 0.8 with a white scatterer say "creamy" or "pastel".

**Why not full Kubelka–Munk / Duncan mixing?** It is the textbook model for paints: `K_mix = Σ c_i K_i`, `S_mix = Σ c_i S_i` and `R∞ = 1 + K/S − √((K/S)² + 2K/S)`. I implemented and tuned it, and it scored worse (about 18). R∞ assumes an infinitely thick layer, so diluting a cloudy juice with water leaves its color unchanged. That makes a juice drink look as saturated as the neat juice, which is wrong for a 7 cm glass of shaken sour. The albedo-weighted form above behaves like KM at high turbidity and like Beer–Lambert when the drink is clear.

**Mint.** Mint shaken or swizzled into a drink does not dye it. Blended mint does, as in the Missionary's Downfall. Treat about 8 blended leaves as ¼ oz of `#6fa04a` at tint 0.8 with scatter 0.3. The current engine drops all `aromatic` lines from the color, which loses this.

**Constants.** κ, w and β come from a grid search over the 50 references. The fit is flat near the optimum: (κ 8–12, β 0.5–0.6, w 0.15–0.3) all land at 10.7–11.4. Raising the tints of scattering ingredients by up to 1.8× changes little. Prefer the simple settings.

### Mapping onto the current `web/lib/optics.js`

The current `mixColor` already has this shape: `out = (1−S)T + S·alb·√T` with `S = 1 − exp(−3.2 Σ f·opacity)`. To adopt the model:

1. Store `scatter` in `optics` and use `Σ f·scatter` with κ = 8 in place of `3.2·Σ f·opacity`.
2. Whiten the albedo by w = 0.15.
3. Include blended mint as a colorant.
4. Scale A by vessel path. Suggested L values:

   | vessel | L |
   |---|---|
   | coupe or bowl | 5 cm |
   | rocks, double old-fashioned | 7 cm |
   | Collins, chimney | 6 cm, but a long view |
   | snifter or punch bowl | 9–10 cm |

   Opaque mugs show the surface only.

The engine's float check should use the **diluted** body SG. At present it averages the poured ingredients only, which overstates body density by about 0.005–0.01.

## 3. Ice, foam and the drawing

- **Crushed ice.** Do not lighten the computed body; calibration preferred no global ice whitening. Instead, draw the ice dome above the liquid line as near-white tinted with about 20% of the body color. Lighten the top 10–20% of the liquid by 15–25% toward white with a soft gradient.
- **Ice cone and swizzles.** Give these a white crown.
- **Foam head.** Draw one when a drink is shaken with pineapple (≥ ¾ oz), egg white, cream or aquafaba. Color it `mix(body, #fbf7ee, 0.7)`. Make it 3–10 mm thick for pineapple and about 12 mm for dry-shaken egg white, matte, with no gradient.
- **Frozen drinks.** Draw a matte, slightly lighter surface and no foam band. Render a 1–2 shade lighter "frost" band at the rim.
- **Watercolor.** Translucent drinks (S < 0.45) are glazes: multiply with an edge-darkened rim. Opaque drinks (S > 0.8) are body color: flatter, with less granulation. Never let a computed color reach pure black. Clamp lightness to L\* ≥ 12 so a Goslings float still reads as liquid.

## 4. Density and layering

```
SG ≈ ρ_EtOH-water(ABV)/ρ_water + 0.00375·sugar(g/100 ml) + 0.004·acid(g/100 ml)
ρ_EtOH-water/ρ_water (20 °C): 0%→1.000, 20%→0.975, 40%→0.950, 45%→0.941, 50%→0.932,
                              57%→0.918, 63%→0.904, 69%→0.890, 75%→0.875
```

Reference points:

- **Sugar.** Simple 1:1 is 61.5 g/100 ml, giving 1.23. Rich 2:1 is 88 g/100 ml, giving 1.33. Both match published sucrose tables.
- **Liqueurs.** Coffee liqueur is about 1.12–1.13, blue curaçao about 1.09, Galliano about 1.06 and green Chartreuse about 1.016. These agree with the commonly quoted pousse-café charts within about ±0.02.
- **Override list.** Juices are set by Brix, about 1.03–1.065. Heavy cream is 0.995, butterfat 0.91, Coco López about 1.17, orgeat about 1.26 and honey syrup about 1.21.

**A layer holds** when the pour differs from the **diluted** body by about 0.02 or more and it is poured gently: onto the back of a bar spoon, onto the crushed-ice dome, or down the inside of the glass for a sink. Crushed ice and frozen-drink viscosity let smaller differences hold.

**Layers become gradients.** Ethanol and water diffuse, so a float blurs into the drink over 5–15 minutes. Draw the bands this way:

- **Float.** The band is `oz_float / oz_liquid × 1.3` of the glass height on crushed ice, at most 35%. Draw it in `layerHex` with a soft lower edge about 15–20% of the band.
- **Sink.** It fills the bottom 15–25% in `layerHex`. Above it, draw a mixing zone of the same height where the sink's color is blended into the body subtractively, using the mixing rules. A grenadine sink in orange juice gives a red-orange zone; blue curaçao under pineapple gives a **green** zone, not a violet one.
- **Bitters crown.** It covers the top 5–8% plus 2–4 streaks in plain `hex`.
- **Order inside the glass.** Read the order from SG, not from recipe order. A float that is denser than the body is dropped as a layer and described as a "streak", as with the Galliano in a Harvey Wallbanger.

## 5. Checks that keep copy honest

- Words come from the computed color: amber, coral, tan, sea-green, and so on. Add "cloudy" or "pastel" from S.
- A recipe without a red ingredient must not be called red or pink.
- A mixed drink that contains dark or black rum must not be called golden or pale.
- A blue drink must have a clear or white base. Blue mixed with yellow juice is teal or green; blue mixed with amber spirit is murky.
- A "colada" must compute to an opaque pale cream-yellow (S > 0.8). If it doesn't, it lacks coconut cream or pineapple.

## 6. Known limits and uncertainty

- **Broadband RGB.** Real dyes absorb narrow bands. Three-channel Beer–Lambert therefore over-darkens strong dyes when concentrated: neat blue curaçao would come out navy-black. The strong dyes have hand-set `neatHex`/`layerHex` values. When diluted in a drink the model behaves well; the Blue Lagoon is within 3.
- **Blue Hawaii.** With ½ oz curaçao to 3 oz pineapple the model gives a sage or sea-green (`#a0c591`). The reference I set, sea-green teal `#6cbc9c`, is bluer. I am not certain which is right. Resort Blue Hawaiis look aqua in photos because they use more curaçao, strongly dyed mass-market curaçao, or sweet-and-sour mix instead of pineapple.
- **Brand variance.** Color varies a lot between brands, and the notes record it:
  - Pierre Ferrand Dry Curaçao (amber) vs DeKuyper orange curaçao (bright orange).
  - Giffard Banane du Brésil (golden amber) vs cheap crème de banane (yellow).
  - Averna (black-brown) vs Montenegro (pale rose).
  - Chinola (cloudy golden) vs Passoã (red). The Passoã color is uncertain.
  - White vs dark crème de cacao.
  - White vs ruby grapefruit.
- **Commercial SG values.** These are estimates from ABV and sugar. Brand sugar contents vary, so treat adjacent pousse-café layers closer than 0.02 as unreliable.
- **Research limits.** The web search budget ran out at the start of this task, and cocktail sites block page fetches. Product colors and densities come from expert knowledge and published-chart memory, not from fresh sources.
- **Reproducibility.** `research/colorwork-a/` holds `table.mjs`, `refs.mjs`, `calib.mjs` and `build.mjs`. Running `node build.mjs` regenerates `color.json`. Running `node calib.mjs` prints the per-drink comparison and writes `sheet.png`, whose columns are the reference top, middle and bottom, then the interim engine, this table in the engine, and the recommended model.
