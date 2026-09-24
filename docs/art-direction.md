# Art direction: ink and watercolor on paper

The Shrine page is a single off-white sheet. Tiki mugs, a carved idol and tropical flowers are drawn on in brush-pen ink, then bloom with watercolor. There is no scene or environment, only drawings with generous empty paper around them. This document records the research behind that choice and the rules the renderer follows.

## What we studied

### The three reference repositories

- **[achimala/jev-paint](https://github.com/achimala/jev-paint)** treats paint as a *material*. It lays down a smooth underpainting first, then brush strokes that follow the form's contours. Each stroke has a tapered, bristled profile, and the strokes build a height map lit by a single light. Everything is deterministic from a seed and rendered off the main thread. Takeaways: underlay before detail; strokes follow form, not a grid; texture comes from a physical model rather than a noise overlay; same seed, same painting.
- **[vercel-labs/json-render](https://github.com/vercel-labs/json-render)** generates UI as JSON that may only use components from a predefined catalog, validated against a schema and rendered progressively as it arrives. Takeaway for us: a drink illustration is a JSON *art spec* built only from a fixed catalog of drawable parts (glass, liquid wash, ice, garnish, flower, mug, idol). The generator writes the spec, the renderer draws it element by element, and nothing outside the catalog can appear. The same spec could later come from a language model without any risk of broken art.
- **[alesha-pro/tools · hand-drawn-canvas-animation](https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation)** is a Canvas 2D kit for hand-drawn films. Most relevant is its *doodle* look: a near-black brush-pen line 3–5 units wide that swells and tapers, with color as watercolor "a few units off the line, soft at the edge, never flat to the outline", on paper. Its quality gates:
  - Line hierarchy: outer contours heavier than inner detail.
  - Pressure, taper and gaps used on purpose, and confident long edges instead of roughening every millimetre.
  - Clean ink need not boil.
  - Grain is not a universal overlay; decide whether texture belongs to the paper or the object.
  - One finish per shot, and seeded randomness so a drawing holds its marks.

  We adapt its `makeStroke`/`drawStroke` pressure ribbon, its `pigmentWash` (multiply fill, granulation, darker rim) and its `paper()` stock.

### Consensus references for generative ink and watercolor

- **Tyler Hobbs, [*A Guide to Simulating Watercolor Paint with Generative Art*](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art).** This is the most widely reused technique (ports on [OpenProcessing](https://openprocessing.org/@neill/846117), [Sighack](https://sighack.com/post/generative-watercolor-in-processing) and [gists](https://gist.github.com/zapthedingbat/b50fb68ae290ac587b3d36bf14f1e6f3)). Recursively deform a polygon by displacing each edge's midpoint along a Gaussian. Deform it about 7 times into a base shape, then for each of 30–100 layers deform the base 4–5 more times and fill at about 4% opacity. Stacked near-transparent layers give watercolor's soft, varied edge. Per-edge variance gives some edges hard and some soft.
- **Curtis, Anderson, Seims, Fleischer & Salesin, [*Computer-Generated Watercolor*](https://www.cs.princeton.edu/courses/archive/fall00/cs597b/papers/curtis97.pdf) (SIGGRAPH 1997).** The canonical account of what makes watercolor read as watercolor: edge darkening, granulation (pigment settling into the paper's valleys), backruns, pigment separation and glazing (thin layers over one another). We take edge darkening, granulation keyed to a paper height map, and glazing, without the fluid simulation.
- **Steve Ruiz, [perfect-freehand](https://github.com/steveruizok/perfect-freehand).** The de-facto standard for natural digital ink (tldraw). A stroke is an outline polygon around its points, with size, thinning (pressure's effect on width), smoothing, streamline, and start and end tapers. Our ink ribbon uses the same model with an authored pressure curve.
- **Quentin Blake's [ink and watercolor method](https://quentinblake.com/about-drawing/how-i-draw)** is the benchmark for minimal and playful. It uses a loose, confident dip-pen line retraced from a rough so it looks like one stroke. The watercolor "rarely stays within the wobbly ink lines", working in and outside the line for liveliness, and it aims for atmosphere over detail.
- **Sumi-e ([overview](https://japanartjournal.com/articles/sumi-e-a-guide-to-japanese-ink-painting-2)).** Economy of stroke, with each mark final and the essence caught in a few well-placed lines. Uses *ma*, deliberate empty space treated as equal to the subject, and several tones of one ink from deep black to pale grey.
- **Subject reference: mid-century tiki mugs** ([Orchids of Hawaii](https://mytiki.life/creators/orchids-of-hawaii/tiki-mugs), [Otagiri, Trader Vic's](https://blog.retroplanet.com/collecting-tiki-mugs-trader-vics-tiki-farm/)). The Moai mug has a heavy brow, long nose and pursed lips. The Ku-style idol has big round eyes and a wide toothy grin. Glazes are brown, cream, green and teal. Tropical motifs are hibiscus, plumeria, monstera and pineapple.

## The rules we draw by

1. **Paper first, and quiet.** The ground is off-white (`#F6F4EF`), cool enough to avoid looking like parchment. Its cold-press texture is a generated height map, shown at very low contrast and used again to make pigment granulate in the valleys. Texture belongs to the paper, not to every object.
2. **One ink, several tones.** Near-black with a blue cast (`#1D1A22`). Contours are brush-pen ribbons, about 2.4 px, that taper in and out and swell slightly mid-stroke. Inner detail is lighter (about 1.3 px) and slightly paler, and the back of a rim ellipse is palest. Long edges are single confident strokes, with a few deliberate gaps where light or overlap justifies one.
3. **Watercolor off the line.** Washes are Hobbs-style stacks of deformed polygons, 18–30 layers at 3–6% opacity, multiplied onto the paper. Each wash is set a few pixels off-register from its ink and is allowed to escape the outline. It gets a darkened edge (a faint rim stroke) and granulation from the paper map. Glazing, a second pale pass, is used only where a form needs depth.
4. **A small palette.** Hibiscus `#E4574A`, plumeria butter `#F2C14E`, lagoon `#2D9B94`, frond green `#5E8F4C`, carved wood `#B06A34` and orchid pink `#EE8FB0`. Drink washes take their color from the actual ingredients, softened toward the paper.
5. **Ma.** Six small drawings frame the prayer at the edges, and the center stays empty paper for the words. On a phone, three drawings sit above and below. Nothing is drawn behind text.
6. **Draw-on, then bloom, then stillness.** Each drawing's strokes draw on in order: silhouette, then features, then details. Its wash then blooms as layers accumulate, over about 0.6 s. After that the page is still; there is no boiling line. The only later motion is playful and brief: the little idol by the input blinks when you pray.
7. **Seeded and repeatable.** Every mark comes from a seed, so the same drink always gets the same drawing.
8. **Catalog, spec, render.** A drink is described as a JSON spec (`web/lib/artspec.js`) of catalog parts (`web/lib/artcatalog.js`) and drawn by `web/lib/artrender.js`. The page never invents shapes outside the catalog.
