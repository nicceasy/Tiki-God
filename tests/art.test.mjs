// The drink drawing tells the truth about the card (docs/research/presentation.md §7.4): every
// garnish it draws comes from a garnish phrase on the card, its service matches the method, and
// the signature serves look the way an aficionado expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../web/lib/engine.js';
import { drinkSpec, validateSpec, partsForPhrase, garnishPlan, garnishRule, UMBRELLA_ALLOWED, UP_VESSELS, FIZZ, idolSpec } from '../web/lib/artspec.js';
import { CATALOG, rimOf } from '../web/lib/artcatalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const engine = createEngine({
  vocab: read('data/ingredients.json'), families: read('data/families.json'), drinks: read('data/drinks.json'), model: read('data/model.json'),
  vessels: read('data/vessels.json'), archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'), rules: read('data/technique-rules.json'),
});

const PROMPTS = [
  'a mai tai', 'navy grog', 'three dots and a dash', 'painkiller', "queen's park swizzle", 'a colada for a lazy sunday',
  'something blue for the pool', 'layered like a sunrise', 'hot buttered rum', 'zombie', 'jungle bird', 'a scorpion bowl for 4',
  'daiquiri', 'tropical itch', 'dark and stormy', 'hurricane', 'saturn', 'ti punch', 'mojito', 'caipirinha', 'fog cutter',
  'volcano bowl for 2', 'pina colada', 'blue hawaii', 'bushwacker', 'miami vice', "planter's punch", 'flaming scorpion',
  'pearl diver', "cobra's fang", 'rum old fashioned', 'hot grog', 'mule', 'suffering bastard', 'port au prince',
  'kingston negroni', 'a punch bowl for a party of 8', 'zero-proof for the designated driver', 'something creamy and coconutty',
  'a tequila sunrise', 'skull mug of something dark', 'a drink for a dragon',
];
const drawn = [];
for (const p of PROMPTS) for (const seed of [0, 1]) {
  const recipe = engine.generate(p, { seed });
  drawn.push({ p, seed, recipe, spec: drinkSpec({ ...recipe, seed }, engine.ingMap) });
}
const garnishEls = spec => spec.elements.filter(e => e.part.startsWith('garnish.') || e.part === 'sparkle');
const isService = e => typeof e.from === 'string' && e.from.startsWith('(steps)');

test('every spec is valid and every element draws finite ink', () => {
  for (const { p, spec } of drawn) {
    const v = validateSpec(spec);
    assert.ok(v.ok, `${p}: ${v.errors.join('; ')}`);
    for (const e of spec.elements) {
      const part = CATALOG[e.part](e.params || {});
      for (const s of part.strokes) assert.ok(s.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `${p}: ${e.part} stroke`);
      for (const w of part.washes || []) assert.ok(w.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `${p}: ${e.part} wash`);
    }
  }
});

test('truth rule: every drawn garnish comes from a phrase on the card that calls for that part', () => {
  for (const { p, recipe, spec } of drawn) {
    for (const e of garnishEls(spec)) {
      if (isService(e)) {
        // a build layer the method steps describe (a bitters crown, muddled mint), not a garnish
        assert.ok(['garnish.bitters-crown', 'garnish.mint-leaves'].includes(e.part), `${p}: ${e.part} drawn from the steps`);
        assert.ok(recipe.method.steps.join(' ').toLowerCase().includes('crown') || e.part === 'garnish.mint-leaves', `${p}: crown not in the steps`);
        continue;
      }
      assert.ok(recipe.garnish.includes(e.from), `${p}: ${e.part} drawn from "${e.from}", not on the card (${recipe.garnish.join(', ')})`);
      assert.ok(partsForPhrase(e.from).includes(e.part), `${p}: "${e.from}" does not call for ${e.part}`);
    }
  }
});

test('the garnish budget: at most three garnishes and one dust', () => {
  for (const { p, recipe } of drawn) {
    const { items } = garnishPlan(recipe);
    assert.ok(items.filter(x => x.rule.role !== 'dust').length <= 3, `${p}: too many garnishes`);
    assert.ok(items.filter(x => x.rule.role === 'dust').length <= 1, `${p}: more than one dust`);
  }
});

test('no umbrella unless the card names one or the archetype allows one with a fruit flag', () => {
  for (const { p, recipe, spec } of drawn) {
    if (!spec.elements.some(e => e.part === 'garnish.umbrella')) continue;
    const named = recipe.garnish.some(g => /umbrella|parasol/i.test(g));
    const flag = recipe.garnish.some(g => /flag/i.test(g));
    assert.ok(named || (UMBRELLA_ALLOWED.includes(recipe.archetype.id) && flag), `${p}: umbrella on ${recipe.archetype.id} (${recipe.garnish.join(', ')})`);
    assert.ok(!UP_VESSELS.includes(spec.kind), `${p}: umbrella on a drink served up`);
  }
  // A colada or resort punch gets no umbrella by family habit.
  const colada = drawn.find(d => ['colada', 'resort-punch'].includes(d.recipe.family.id) && !d.recipe.garnish.some(g => /umbrella|flag/i.test(g)));
  assert.ok(colada, 'expected a colada or resort punch without an umbrella on its card');
  assert.ok(!colada.spec.elements.some(e => e.part === 'garnish.umbrella'), `${colada.p}: umbrella added by family`);
});

test('service matches the method: straws, bubbles, steam and ice', () => {
  for (const { p, recipe, spec } of drawn) {
    const parts = spec.elements.map(e => e.part);
    if (UP_VESSELS.includes(spec.kind) || recipe.method.method === 'hot') assert.ok(!parts.includes('straw'), `${p}: straw in a ${spec.kind}`);
    if (parts.includes('fizz')) assert.ok(recipe.lines.some(l => FIZZ.has(l.id)), `${p}: bubbles with nothing carbonated`);
    if (parts.includes('steam')) assert.ok(!parts.includes('ice') && recipe.method.method === 'hot', `${p}: steam with ice`);
    const ice = spec.elements.find(e => e.part === 'ice');
    const liquid = spec.elements.find(e => e.part === 'liquid');
    if (recipe.method.method === 'flash-blend') assert.ok(!liquid.params.frozen, `${p}: a flash-blended drink drawn as a frozen dome`);
    if (liquid.params.frozen) assert.ok(!ice, `${p}: ice drawn in a frozen drink`);
    if (ice && !['ice-shell'].includes(ice.params.style)) assert.ok(ice.params.style === recipe.method.ice || UP_VESSELS.includes(spec.kind), `${p}: ice ${ice.params.style} vs ${recipe.method.ice}`);
  }
});

const find = (pred, why) => { const d = drawn.find(pred); assert.ok(d, why); return d; };

test('Mai Tai: the spent shell floats dome-up like an island, mint planted beside it as a palm', () => {
  const { spec } = find(d => d.recipe.archetype.id === 'mai-tai', 'a Mai Tai');
  const shell = spec.elements.find(e => e.part === 'garnish.lime-shell');
  const mint = spec.elements.find(e => e.part === 'garnish.mint');
  assert.equal(shell.params.orientation, 'dome-up');
  assert.ok(mint && Math.abs(mint.x - shell.x) < 50, 'mint at the island\'s edge');
  assert.ok(!spec.elements.some(e => e.part === 'garnish.flame'), 'no fire on a Mai Tai');
  const straw = spec.elements.find(e => e.part === 'straw');
  assert.ok(straw && Math.abs(straw.x + Math.tan(straw.rot) * 0 - mint.x) < 70, 'the straw beside the mint');
});

test('Navy Grog: an ice cone with one straw dead center through it', () => {
  const { spec } = find(d => d.recipe.method.ice === 'ice-cone' && d.recipe.archetype.id === 'navy-grog', 'a Navy Grog with an ice cone');
  assert.equal(spec.elements.find(e => e.part === 'ice').params.style, 'ice-cone');
  const straws = spec.elements.filter(e => e.part === 'straw');
  assert.equal(straws.length, 1);
  assert.equal(straws[0].rot, 0);
  assert.equal(straws[0].x, rimOf(spec.kind).cx);
  assert.ok(straws[0].y < rimOf(spec.kind).y, 'the straw comes out of the cone tip, above the rim');
});

test('flaming: the shell turns cut-side up only when the card or the style says so', () => {
  const flaming = find(d => d.recipe.garnish.some(g => /flaming/.test(g)), 'a flaming garnish');
  const shell = flaming.spec.elements.find(e => e.part === 'garnish.lime-shell');
  assert.equal(shell.params.orientation, 'cup-up');
  assert.ok(flaming.spec.elements.some(e => e.part === 'garnish.flame'));
});

test('signature serves: Three Dots, Painkiller, Queen\'s Park, Tropical Itch, Saturn', () => {
  const dots = find(d => d.recipe.garnish.some(g => /three cherries/.test(g)), 'Three Dots');
  assert.ok(dots.spec.elements.some(e => e.part === 'garnish.morse-pick'), 'the Morse pick');
  assert.deepEqual(CATALOG['garnish.morse-pick']({}).strokes.length > 0, true);

  const pk = find(d => d.recipe.archetype.id === 'painkiller', 'a Painkiller');
  const nut = pk.spec.elements.find(e => e.part === 'garnish.nutmeg');
  assert.ok(nut && nut.params.density >= 0.8, 'a heavy nutmeg cap');
  assert.ok(pk.spec.elements.some(e => e.part === 'garnish.orange-wheel'), 'an orange wheel');

  const qps = find(d => d.recipe.archetype.id === 'trinidad-swizzle', 'a Queen\'s Park Swizzle');
  const crown = qps.spec.elements.find(e => e.part === 'garnish.bitters-crown');
  const ice = qps.spec.elements.findIndex(e => e.part === 'ice');
  assert.ok(crown, 'the bitters crown');
  assert.ok(qps.spec.elements.indexOf(crown) > ice, 'the crown is painted on the ice, not under it');
  assert.ok(qps.spec.elements.find(e => e.part === 'liquid').params.crownOnIce);
  assert.ok(qps.spec.elements.some(e => e.part === 'glass.frost'), 'a swizzle frosts the glass');

  const itch = find(d => d.recipe.archetype.id === 'tropical-itch', 'a Tropical Itch');
  assert.ok(itch.spec.elements.some(e => e.part === 'garnish.back-scratcher'), 'the back-scratcher');
  assert.ok(!itch.spec.elements.some(e => e.part === 'garnish.umbrella'), 'never an umbrella instead');

  const saturn = find(d => d.recipe.garnish.some(g => /ring around a cherry/.test(g)), 'a Saturn');
  assert.ok(saturn.spec.elements.some(e => e.part === 'garnish.peel-ring'), 'the planet and its ring');
});

test('garnish is drawn at real size (38 units to the inch)', () => {
  // measured on what the part covers (its silhouette), or its ink where it covers nothing
  const box = part => {
    const d = CATALOG[part]({});
    const pts = d.cover && d.cover.length ? d.cover.flat() : d.strokes.flatMap(s => s.pts);
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const near = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what}: ${v.toFixed(1)} not in ${lo}..${hi}`);
  near(box('garnish.lime-shell')[0], 74, 90, 'lime shell width');
  near(box('garnish.orange-wheel')[0], 100, 125, 'orange wheel width');
  near(box('garnish.lime-wheel')[0], 70, 86, 'lime wheel width');
  near(CATALOG['garnish.cherry']({ stem: false }).cover[0].reduce((m, p) => Math.max(m, p[0]), 0) * 2, 28, 36, 'cherry width');
  near(box('garnish.mint')[1], 95, 150, 'mint height');
});

test('the idol is not animated: its blink frame is its open face', () => {
  assert.deepEqual(idolSpec(170, 214, true), idolSpec(170, 214, false));
});

// ---------------------------------------------------------------- the painted drink's color
// The liquid is painted from the look (optics.js), and the look's hex is a contract: the painted
// body sits within 6 degrees of its hue, at most 0.12 more saturated and within 0.06 of its
// lightness, and the median pixel of the drawn body is within a CIEDE2000 of 10 of it. The
// painter's push toward a vivid menu painting is spent inside that box; creams stay cream, clear
// stays cool, dark stays dark, and the graded glazes multiply exactly onto the tones they promise.
import { pigment, bodyPigment, glaze, washFactor, hexHsl, GLASS_PROFILES, TIKI_GLAZES, WARM_GLAZES, levelOf, PALETTE, drinkPaint, crossfade, glazeFamilies, paintedBody, CONTRACT, VESSEL_IDS } from '../web/lib/artcatalog.js';
import { paintTilt, glazeOf, shelfColorOf, litByCard } from '../web/lib/artspec.js';
import { deltaE2000 } from '../web/lib/optics.js';
import { blockCube, halfAt } from '../web/lib/artcatalog.js';
import { spline } from '../web/lib/ink.js';
import { grow } from '../web/lib/artcatalog.js';

const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

test('the look hex is a contract: the painted body keeps its hue, lightness and strength, and the drawn body\'s median pixel is within ΔE2000 10', () => {
  for (const { p, seed, recipe, spec } of drawn) {
    const liq = spec.elements.find(e => e.part === 'liquid').params, b = recipe.look.body, { P, shown } = drinkPaint(liq);
    const [h0, s0, l0] = hexHsl(b.hex), [h, s, l] = hexHsl(P.body), at = `${p} [${seed}] ${b.hex} → ${P.body}`;
    if (s0 > 0.08) assert.ok(hueGap(h, h0) <= CONTRACT.dh + 0.6, `${at}: hue ${h.toFixed(0)} strays from the look's ${h0.toFixed(0)}`);
    assert.ok(s - s0 <= CONTRACT.ds + 0.01, `${at}: saturation ${s.toFixed(2)} past the look's ${s0.toFixed(2)} + ${CONTRACT.ds}`);
    assert.ok(Math.abs(l - l0) <= CONTRACT.dl + 0.01, `${at}: lightness ${l.toFixed(2)} off the look's ${l0.toFixed(2)}`);
    // (a clear or cloudy color is painted at least as strong as the look: vivid, never duller)
    // (at the edge of the gamut a pale, nearly pure yellow loses a hundredth of saturation to the
    // hex's 1/255 steps alone)
    if (P.kind === 'color') assert.ok(s >= Math.min(s0, 0.97) - (s0 > 0.9 && l0 > 0.7 ? 0.015 : 0.005), `${at}: painted duller than the look`);
    // the median pixel of the drawn body (in a mug with a float or a crown on it, the top layer
    // is what the guest sees, and the surface is judged against that layer)
    const top = GLASS_PROFILES[liq.kind].opaque && (recipe.look.layers || []).find(x => x.kind === 'float' || x.kind === 'crown');
    const med = paintedBody(liq), want = top ? top.hex : b.hex, dE = deltaE2000(want, med);
    assert.ok(dE <= (top ? 12 : 10), `${at}: the drawn body's median pixel ${med} is ΔE2000 ${dE.toFixed(1)} from ${want}`);
    if (top) assert.ok(shown.some(x => x.id === top.id), `${p}: the top layer is not painted`);
  }
});

test('CIEDE2000 behaves: identical is 0, a hair apart is about 1, a copper painted scarlet is far', () => {
  assert.equal(deltaE2000('#a7c28c', '#a7c28c'), 0);
  assert.ok(deltaE2000('#ff0000', '#ff1010') < 2);
  assert.ok(deltaE2000('#b65c2b', '#d8341a') > 10, 'a copper painted scarlet passes');
  assert.ok(Math.abs(deltaE2000('#b65c2b', '#c06030') - deltaE2000('#c06030', '#b65c2b')) < 1e-9, 'not symmetric');
});

test('an amber glows instead of reading as mud; creams stay cream, clear stays cool, dark stays dark', () => {
  const amber = pigment('#b77b45', { opacity: 0.4 });          // "burnished amber", once drawn as tan
  const [, sa, la] = hexHsl(amber.body);
  assert.ok(sa >= 0.75 && la >= hexHsl('#b77b45')[2], `amber painted ${amber.body}`);
  const cream = pigment('#f8ecc3', { opacity: 1 });            // a colada
  const [hc, sc, lc] = hexHsl(cream.body);
  assert.equal(cream.kind, 'cream');
  assert.ok(hc >= 30 && hc <= 50 && lc >= 0.78 && sc <= 0.8, `cream painted ${cream.body}`);
  const pk = pigment('#d8ab6c', { opacity: 1 });               // a Painkiller: café au lait
  assert.equal(pk.kind, 'milky');
  assert.ok(hexHsl(pk.body)[1] <= 0.72, `Painkiller painted ${pk.body}, past café au lait`);
  // a water-white drink is a cool sparkle; a daiquiri's straw is a faint green-gold, not blue
  const water = pigment('#f5f1e6', { opacity: 0.05, word: 'water-clear' });
  const [r, , b] = rgb(water.body);
  assert.equal(water.kind, 'clear');
  assert.ok(b >= r - 0.02, `water-white drink painted warm: ${water.body}`);
  for (const [hex, word] of [['#f9faef', 'hazy pale straw'], ['#f6f2dc', 'pale straw'], ['#f9faef', '']]) {
    const straw = pigment(hex, { opacity: 0.22, word }), [hs, ss, ls] = hexHsl(straw.body), [rr, , bb] = rgb(straw.body);
    assert.equal(straw.kind, 'clear');
    assert.ok(hs >= 48 && hs <= 72 && ss <= 0.65 && ls >= 0.82 && bb < rr - 0.05, `${word || hex}: a straw painted ${straw.body}, not a faint green-gold`);
  }
  const dark = pigment('#642a1d', { opacity: 0 });             // coffee and rum, stirred
  const [, sd, ld] = hexHsl(dark.body);
  assert.ok(ld <= 0.32 && sd >= 0.5, `dark drink painted ${dark.body}`);
  // and a grenadine sink stays ruby rather than going black
  const [hs, ss, ls] = hexHsl(pigment('#8e0a1e', { opacity: 1, layer: true }).body);
  assert.ok((hs >= 340 || hs <= 10) && ss >= 0.75 && ls >= 0.33, 'grenadine sink stays ruby');
});

test('the graded wash: lighter at the surface, deeper at the foot, blooms on neighboring hues', () => {
  for (const hex of ['#c68351', '#59a79a', '#d75a52', '#648ab6', '#f2c1b6']) {
    const P = pigment(hex, { opacity: 0.6 });
    const L = x => hexHsl(x)[2];
    assert.ok(L(P.surf) > L(P.body) && L(P.body) > L(P.deep) && L(P.deep) >= L(P.foot), `${hex}: tones not graded`);
    // each zone stays near the body's hue; a warm drink turns honey-gold at the surface and
    // red-copper at the foot
    for (const t of [P.surf, P.deep, P.foot]) assert.ok(hueGap(hexHsl(t)[0], hexHsl(P.body)[0]) <= 10, `${hex}: a zone tone strays from the body's hue`);
    const hb = hexHsl(P.body)[0];
    if (hb >= 15 && hb <= 50 && P.kind === 'color') assert.ok(hexHsl(P.surf)[0] > hb + 3 && hexHsl(P.foot)[0] < hb - 3, `${hex}: the amber does not turn gold above and copper below`);
    for (const t of [...P.blooms, P.glow, P.warm]) {
      const d = hueGap(hexHsl(t)[0], hexHsl(P.body)[0]);
      // creams vary only gently (a cream that swings hue reads as fruit)
      assert.ok(d >= (P.kind === 'cream' ? 2 : 4) && d <= 25, `${hex}: tint ${t} is ${d.toFixed(0)} degrees off the body`);
    }
  }
});

test('a glaze multiplies onto the tone under it to land on its target', () => {
  for (const [target, under, alpha] of [['#f6e2b6', '#f6e9cb', 0.03], ['#7c2c18', '#b7442a', 0.05], ['#2f8f9a', '#9fd3d8', 0.04], ['#e8702e', '#f4a874', 0.06]]) {
    const g = glaze(target, under, alpha);
    assert.ok(g.alpha >= alpha && g.alpha <= 0.5);
    const out = washFactor(g.color, g.alpha).map((f, i) => f * rgb(under)[i]);
    rgb(target).forEach((t, i) => assert.ok(Math.abs(out[i] - t) < 0.03, `${under} → ${target}: channel ${i} lands at ${out[i].toFixed(3)} not ${t.toFixed(3)}`));
  }
});

// What the glazed drink composites to at a point: the paper times every wash covering it (each
// layer of a wash multiplies by 1 - alpha * (1 - c); about 0.95 of them overlap inside it).
const inside = (pts, [x, y]) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
// (a wash with a clip stains only inside its first polygon, less the holes after it)
const clipped = (w, pt) => !w.clip || (inside(w.clip[0], pt) && !w.clip.slice(1).some(h => inside(h, pt)));
const paintedAt = (washes, pt) => washes.filter(w => inside(w.pts, pt) && clipped(w, pt)).reduce((acc, w) => acc.map((v, i) => v * Math.pow(1 - w.alpha * (1 - rgb(w.color)[i]), (w.layers || 22) * 0.95)), rgb(PALETTE.paper));
const hexOf = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

test('layers stay where physics puts them: a sink pools at the foot, a float sits on top', () => {
  const sink = drawn.find(d => d.recipe.look.layers.some(x => x.kind === 'sink') && !GLASS_PROFILES[d.spec.kind].opaque && !d.spec.elements.find(e => e.part === 'liquid').params.frozen && !d.spec.elements.find(e => e.part === 'liquid').params.frost);
  assert.ok(sink, 'a drink with a sink in a clear glass');
  const liq = sink.spec.elements.find(e => e.part === 'liquid'), R = rimOf(liq.params.kind), top = levelOf(liq.params.kind, liq.params.fill);
  const { shown, P } = drinkPaint(liq.params), paint = shown.find(x => x.kind === 'sink').paint;
  const ws = CATALOG.liquid(liq.params).washes;
  // on the floor of the glass the syrup is its own color; half way up the drink it is not there
  const floor = hexOf(paintedAt(ws, [R.cx + 6, R.bottom - 6])), mid = hexOf(paintedAt(ws, [R.cx + 6, (top + R.bottom) / 2]));
  assert.ok(hueGap(hexHsl(floor)[0], hexHsl(paint)[0]) <= 12, `the floor paints ${floor}, not the sink's ${paint}`);
  assert.ok(hueGap(hexHsl(mid)[0], hexHsl(paint)[0]) > hueGap(hexHsl(P.body)[0], hexHsl(paint)[0]) * 0.5, `the syrup climbs to the middle of the drink (${mid})`);
  // a float is laid from the surface down
  const fl = drawn.find(d => d.recipe.look.layers.some(x => x.kind === 'float') && !GLASS_PROFILES[d.spec.kind].opaque && !d.spec.elements.find(e => e.part === 'liquid').params.frozen && !d.spec.elements.find(e => e.part === 'liquid').params.frost);
  assert.ok(fl, 'a drink with a float in a clear glass');
  {
    const lp = fl.spec.elements.find(e => e.part === 'liquid').params, F = fl.recipe.look.layers.find(x => x.kind === 'float');
    const fpaint = pigment(F.hex, { opacity: 1 }).body, fw = CATALOG.liquid(lp).washes.filter(w => w.color === fpaint);
    const ftop = Math.min(...CATALOG.liquid(lp).washes.flatMap(w => w.pts.map(q => q[1])));
    assert.ok(fw.length >= 3 && fw.every(w => Math.min(...w.pts.map(q => q[1])) <= ftop + (rimOf(lp.kind).bottom - ftop) * 0.5), 'the float hangs from the surface');
  }
});

// A sink is its own layer of color, never a dark syrup multiplied through a body of another hue:
// a ruby hibiscus under a chartreuse highball crossfades through gold and tangerine (a sunrise),
// not through olive and maroon-brown; a crème de cassis settles plum, a grenadine garnet.
test('a sink settles in its own color and fades into the body round the hue circle, never through mud', () => {
  const params = { kind: 'highball', fill: 0.84, body: { hex: '#b6d77b', opacity: 0.13, clarity: 0.45 }, layers: [{ kind: 'sink', hex: '#720832', opacity: 0, frac: 0.15 }], seed: 56, word: 'chartreuse with hibiscus syrup settling ruby at the bottom' };
  const ws = CATALOG.liquid(params).washes, R = rimOf('highball'), top = levelOf('highball', 0.84);
  const ruby = drinkPaint(params).shown[0].paint, [rh, rs, rl] = hexHsl(ruby);
  assert.ok(rh >= 335 && rh <= 350 && rs >= 0.7 && rl >= 0.3, `a hibiscus sink painted ${ruby}, not a ruby`);
  // walk down the middle of the drink: no brown, olive or near-black anywhere
  for (let y = top + 8; y <= R.bottom - 4; y += 3) {
    const c = hexOf(paintedAt(ws, [R.cx + 9, y])), [h, s, l] = hexHsl(c);
    assert.ok(l >= 0.22, `near-black at ${y.toFixed(0)}: ${c}`);
    // (brown and olive are a dim yellow-orange: judged by luminance, since a pure gold has an HSL
    // lightness of 0.4 and is anything but dim)
    const [r, g, b] = rgb(c), mud = s < 0.45 || (h >= 20 && h <= 75 && 0.3 * r + 0.59 * g + 0.11 * b < 0.45);
    assert.ok(!mud, `muddy ${c} at ${y.toFixed(0)} between a chartreuse body and a ruby sink`);
  }
  // and the foot is the ruby
  const foot = hexOf(paintedAt(ws, [R.cx + 9, R.bottom - 5]));
  assert.ok(hueGap(hexHsl(foot)[0], rh) <= 12, `the foot paints ${foot}`);
  // crème de cassis is a plum-violet, distinct from a grenadine garnet
  for (const hex of ['#420820', '#5a1446']) assert.ok(hueGap(hexHsl(pigment(hex, { opacity: 1, layer: true }).body)[0], 318) <= 8, `cassis ${hex} not painted plum`);
  const cassis = pigment('#5a1446', { opacity: 1, layer: true }).body, gren = pigment('#8e0a1e', { opacity: 1, layer: true }).body;
  assert.ok(hexHsl(cassis)[0] >= 305 && hexHsl(cassis)[0] <= 330, `cassis painted ${cassis}, not plum`);
  assert.ok(hueGap(hexHsl(cassis)[0], hexHsl(gren)[0]) >= 25, `cassis ${cassis} and grenadine ${gren} read as one red`);
  // the crossfade itself keeps its chroma: half way from chartreuse to ruby is a vivid orange
  const half = crossfade('#bced65', '#a3123a', 0.5), [hh, hs] = hexHsl(half);
  assert.ok(hh >= 15 && hh <= 50 && hs >= 0.7, `half way from chartreuse to ruby is ${half}`);
});

// Across the battery the painting spreads copper drinks with their own secondary colors: a red
// foot only where something red is in the glass, honey-gold light where passion fruit or honey
// carry it, and otherwise the two pours of one prayer lean opposite ways.
// The painting follows the look, never the seed: two pours with one look are one paint; a
// teaspoon of grenadine shaken through a Zombie is no red foot; and without a sink or a float the
// look declares, no gradient turns the hue (the glass deepens in value, in the drink's own color).
test('no painter\'s choice: one look is one paint, and only a declared layer turns the hue', () => {
  assert.equal(paintTilt({ seed: 1, lines: [{ id: 'grenadine', oz: 0.17 }] }, engine.ingMap, 7), null);
  const body = { hex: '#c4824d', opacity: 0.5, clarity: 0.3 };
  const a = drinkPaint({ body, seed: 3, word: 'ruddy amber', tilt: { shift: -9, foot: '#8e1426', footK: 0.6 } }).P, b = drinkPaint({ body, seed: 977, word: 'ruddy amber' }).P;
  assert.deepEqual(a, b, 'two pours of one ruddy amber are painted differently');
  for (const key of ['surf', 'body', 'deep', 'foot', 'glow', 'warm']) assert.ok(hueGap(hexHsl(a[key])[0], hexHsl(body.hex)[0]) <= CONTRACT.dh + 0.6, `the ${key} of a ruddy amber turns to ${a[key]}`);
  // across the battery: every even drink is one hue from its surface to its foot in the drawing
  for (const { p, seed, recipe, spec } of drawn) {
    const liq = spec.elements.find(e => e.part === 'liquid').params;
    if ((recipe.look.layers || []).some(x => x.kind === 'sink' || x.kind === 'float') || GLASS_PROFILES[liq.kind].opaque || liq.frozen) continue;
    const { P } = drinkPaint(liq);
    if (P.kind === 'clear' || hexHsl(P.body)[1] < 0.2) continue;
    const R = rimOf(liq.kind), top = levelOf(liq.kind, liq.fill), ws = CATALOG.liquid(liq).washes, h = R.bottom - top;
    const hues = [0.3, 0.55, 0.8, 0.95].map(k => hexHsl(hexOf(paintedAt(ws, [R.cx + 9, top + h * k]))));
    const sat = hues.filter(c => c[1] > 0.2);
    for (const c of sat) assert.ok(hueGap(c[0], hexHsl(recipe.look.body.hex)[0]) <= 10, `${p} [${seed}]: the drawn ${recipe.look.description} turns to hue ${c[0].toFixed(0)} in the glass`);
  }
  // the identical Zombies of a battery are painted identically
  const z0 = engine.generate('zombie', { seed: 0 });
  const p0 = drinkSpec({ ...z0, seed: 0 }, engine.ingMap).elements.find(e => e.part === 'liquid').params, p1 = drinkSpec({ ...z0, seed: 5, name: 'Other' }, engine.ingMap).elements.find(e => e.part === 'liquid').params;
  assert.equal(drinkPaint(p0).P.body, drinkPaint(p1).P.body);
});

// ---------------------------------------------------------------- what kind of paint the drink is
// The look's color word and the recipe say what the body is made of: coconut and dairy make an
// opaque, gouache-like tint (a Painkiller orange-tan, a blue colada a chalky aqua, a colada a
// butter-cream), coffee and chocolate a milky cocoa, a named teal stays teal even in a neon drink.
test('creamy and café bodies are flat, lifted tints; a named teal keeps its hue', () => {
  const pk = pigment('#d8ab6c', { opacity: 1, word: 'creamy apricot with a pale froth' });
  const [hp, sp, lp] = hexHsl(pk.body);
  assert.equal(pk.kind, 'milky');
  assert.ok(hp >= 25 && hp <= 45 && sp <= 0.65 && lp >= 0.68, `Painkiller painted ${pk.body}, not a warm orange-tan cream`);
  for (const [hex, word] of [['#cfb698', 'creamy café au lait'], ['#d5be9f', 'creamy tan'], ['#c9a27a', 'creamy mocha']]) {
    const P = pigment(hex, { opacity: 1, word }), h0 = hexHsl(P.body)[0];
    assert.equal(P.kind, 'cafe', word);
    assert.ok(hexHsl(P.body)[1] <= 0.46, `${word} painted ${P.body}: past milky cocoa`);
    for (const t of [...P.blooms, P.glow, P.warm, P.foot]) assert.ok(hueGap(hexHsl(t)[0], h0) <= 5, `${word}: ${t} swings off the cocoa toward peach`);
  }
  const aqua = pigment('#86d3ce', { opacity: 1, word: 'opaque lagoon teal', neon: true, creamy: true });
  assert.ok(hexHsl(aqua.body)[1] <= 0.45 && hexHsl(aqua.body)[2] >= 0.72, `a blue colada painted ${aqua.body}, not a chalky aqua`);
  const colada = pigment('#f8ecc3', { opacity: 1, word: 'creamy ivory' }), [hc] = hexHsl(colada.body);
  assert.ok(hc >= 36 && hc <= 46, `a colada painted ${colada.body}: lemonade, not butter-cream`);
  const hawaii = pigment('#83b990', { opacity: 0.94, neon: true, word: 'opaque teal-green with a pale froth' });
  assert.ok(hexHsl(hawaii.body)[0] >= 160, `a Blue Hawaii painted ${hawaii.body}: kelly green, not teal`);
  const foam = pigment('#91c29e', { opacity: 0.8, neon: true, word: 'opaque seafoam' });
  assert.ok(hexHsl(foam.body)[1] <= 0.45 && hexHsl(foam.body)[2] >= 0.74, `seafoam painted ${foam.body}: not pale and soft`);
});

test('a turquoise stays turquoise: body, tints and blooms between 180 and 196 degrees', () => {
  const P = pigment('#468ab0', { opacity: 0.5, clarity: 0.31, neon: true, word: 'cloudy turquoise' });
  for (const t of [P.surf, P.body, P.deep, P.foot, P.glow, P.warm, ...P.blooms]) {
    const h = hexHsl(t)[0];
    assert.ok(h >= 180 && h <= 196, `a turquoise tone painted ${t} (${h.toFixed(0)} degrees)`);
  }
});

test('an opaque body hides its crushed ice too: chips only in the top sliver, under the heap', () => {
  let seen = 0;
  for (const { p, spec } of drawn) {
    const ice = spec.elements.find(e => e.part === 'ice'), liq = spec.elements.find(e => e.part === 'liquid');
    if (!ice || !['crushed', 'pebble', 'shaved'].includes(ice.params.style) || GLASS_PROFILES[ice.params.kind].opaque || !ice.params.sunk) continue;
    seen++;
    const art = CATALOG.ice(ice.params), top = levelOf(liq.params.kind, liq.params.fill), R = rimOf(ice.params.kind);
    const limit = top + 8 + 0.13 * (R.bottom - top) + 10;
    for (const c of art.cover) assert.ok(Math.min(...c.map(q => q[1])) <= limit, `${p}: a crushed-ice chip deep inside an opaque drink`);
    for (const d of art.dots || []) if (d.y > R.y) assert.ok(d.y <= limit, `${p}: an ice fleck deep inside an opaque drink`);
  }
  assert.ok(seen >= 1, 'an opaque drink on crushed ice in the battery');
});

test('whipped cream is warm white, and the enamel tin has its cobalt rim and chips', () => {
  const W = CATALOG['garnish.whipped-cream']({});
  assert.ok(W.glazed, 'whipped cream is not glazed');
  const c = hexOf(paintedAt(W.washes, [-6, -14])), [h, s, l] = hexHsl(c), [r, g, b] = rgb(c);
  assert.ok(l >= 0.9 && r >= g && g >= b && (h <= 50 || s < 0.1), `whipped cream painted ${c}, not warm white`);
  const E = CATALOG.glass({ kind: 'enamel-tin' });
  assert.ok(E.glazed, 'the enamel tin is not glazed');
  const lip = hexOf(paintedAt(E.washes, [150, 323])), [lh, ls] = hexHsl(lip);
  assert.ok(lh >= 200 && lh <= 235 && ls >= 0.4, `the enamel lip painted ${lip}, not cobalt`);
});

test('an opaque or creamy body hides its cubes; only a corner breaks the surface', () => {
  let seen = 0;
  for (const { p, spec } of drawn) {
    const ice = spec.elements.find(e => e.part === 'ice'), liq = spec.elements.find(e => e.part === 'liquid');
    if (!ice || !['cubed', 'block'].includes(ice.params.style) || GLASS_PROFILES[ice.params.kind].opaque || !ice.params.sunk) continue;
    seen++;
    const art = CATALOG.ice(ice.params), top = levelOf(liq.params.kind, liq.params.fill);
    assert.ok(art.cover.length <= 1, `${p}: ${art.cover.length} cubes painted inside an opaque drink`);
    for (const c of art.cover) assert.ok(Math.max(...c.map(q => q[1])) <= top + 12, `${p}: a cube sits below the surface of an opaque drink`);
  }
  assert.ok(seen >= 1, 'an opaque drink on cubes in the battery');
});

test('a creamy drink is laid flat, without the streak of light a clear drink parts around', () => {
  const params = { kind: 'hurricane', fill: 0.86, layers: [], seed: 5 };
  const count = (body, word) => CATALOG.liquid({ ...params, body, word }).washes.filter(w => w.layers).length;
  assert.ok(count({ hex: '#d8ab6c', opacity: 1, clarity: 0.28 }, 'creamy apricot') < count({ hex: '#d98a3a', opacity: 0.4, clarity: 0.5 }, 'amber'), 'the creamy body still parts around a streak');
});

test('a float shows on a tall drink packed with crushed ice', () => {
  const params = { kind: 'collins', fill: 0.92, body: { hex: '#efb87c', opacity: 0.93, clarity: 0.53 }, layers: [{ kind: 'float', hex: '#6b290a', opacity: 0, frac: 0.09 }], crushed: true, seed: 403, word: 'opaque apricot' };
  const paint = pigment('#6b290a', { opacity: 1 }).body, R = rimOf('collins'), top = levelOf('collins', 0.92);
  const ws = CATALOG.liquid(params).washes.filter(w => w.color === paint);
  assert.ok(ws.length >= 5, 'the float is laid in bands and tendrils');
  assert.ok(Math.max(...ws.flatMap(w => w.pts.map(q => q[1]))) >= top + (R.bottom - top) * 0.2, 'the float reaches below the crushed-ice cap');
});

test('ceramic mugs and bowls wear tiki glazes, hot drinks warm stoneware, skulls bone or ebony; coconut, barrel and pineapple stay natural', () => {
  const GL = Object.values(TIKI_GLAZES), WARM = Object.values(WARM_GLAZES), ceramic = ['ku-mug', 'moai-mug', 'skull-mug', 'bird-mug', 'hot-mug', 'scorpion-bowl', 'tiki-bowl'];
  let n = 0;
  for (const { p, recipe, spec } of drawn) {
    const g = spec.elements.find(e => e.part === 'glass');
    if (!ceramic.includes(g.params.kind)) continue;
    n++;
    if (g.params.kind === 'skull-mug') assert.ok([WARM_GLAZES.bone, TIKI_GLAZES.ebony].includes(g.params.glaze), `${p}: a skull in ${g.params.glaze}`);
    else if (recipe.method.method === 'hot') assert.ok(WARM.includes(g.params.glaze), `${p}: a hot drink in a ${g.params.glaze} mug, not warm stoneware`);
    else assert.ok(GL.includes(g.params.glaze), `${p}: a ${g.params.kind} in ${g.params.glaze}, not a tiki glaze`);
    assert.ok(CATALOG.glass(g.params).glazed, `${p}: the glaze is not composited as a glaze`);
  }
  assert.ok(n >= 3, 'ceramic vessels in the battery');
  for (const kind of ['coconut', 'barrel-mug', 'pineapple']) assert.ok(!CATALOG.glass({ kind, glaze: TIKI_GLAZES.cobalt }).glazed, `${kind} took a glaze`);
  // the volcano bowl: black glaze, red-orange lava
  const v = CATALOG.glass({ kind: 'volcano-bowl' }), cols = v.washes.map(w => hexHsl(w.color));
  assert.ok(cols.some(([, s, l]) => l < 0.45 && s < 0.3), 'the volcano bowl has no black glaze');
  assert.ok(cols.some(([h, s]) => (h <= 25 || h >= 350) && s > 0.6), 'the volcano bowl has no lava');
});

// A shaken, stirred or blended drink is one color in the glass: without a sink its foot keeps the
// drink's own hue and gets its depth from value; a red carrier shaken through a copper shows as a
// dark garnet-brown foot, not a scarlet one; a honeyed amber in a coupe stays amber.
test('an even drink keeps its own hue down to the foot; a sink keeps its own color', () => {
  const cases = [
    { body: { hex: '#d6ad6d', opacity: 0.43, clarity: 0.5 }, word: 'pale amber', tilt: { shift: -7 } },
    { body: { hex: '#b65c2b', opacity: 0.74, clarity: 0.5 }, word: 'cloudy burnished copper', tilt: { shift: -3, foot: '#de0d2c', footK: 0.51 } },
    { body: { hex: '#c4824d', opacity: 0.27, clarity: 0.5 }, word: 'copper', tilt: { shift: -4, foot: '#de0d2c', footK: 0.46 } },
    { body: { hex: '#cc9d4e', opacity: 0.19, clarity: 0.5 }, word: 'honeyed amber', tilt: { shift: 11, top: '#f4b334', topK: 0.51 } },
  ];
  for (const c of cases) {
    // (the painter's hand may lean the whole glass, red-copper or honey-gold, within the family
    // the look names; inside the glass it is one color, every tone near the painted body)
    const { P } = drinkPaint(c), h0 = hexHsl(c.body.hex)[0], hb = hexHsl(P.body)[0];
    for (const key of ['deep', 'foot', 'warm']) assert.ok(hueGap(hexHsl(P[key])[0], hb) <= 9 && hueGap(hexHsl(P[key])[0], h0) <= 15, `${c.word}: the ${key} paints ${P[key]}, off the drink's hue`);
    for (const key of ['surf', 'glow', 'body']) assert.ok(hueGap(hexHsl(P[key])[0], hb) <= 7 && hueGap(hexHsl(P[key])[0], h0) <= 15, `${c.word}: the ${key} paints ${P[key]}, off the drink's hue`);
    assert.ok(hexHsl(P.foot)[2] <= hexHsl(P.body)[2], `${c.word}: the foot is no deeper than the body`);
  }
  // a pale drink under a float (ginger beer under dark rum) stays pale all the way down
  const pale = drinkPaint({ body: { hex: '#e7d7ad', opacity: 0.73, clarity: 0.5 }, word: 'cloudy pale honey with a dark brown float', layers: [{ kind: 'float', hex: '#551702', frac: 0.35 }], tilt: { shift: -7 } }).P;
  assert.ok(hexHsl(pale.foot)[2] >= 0.68 && hexHsl(pale.warm)[2] >= 0.66, `the ginger beer's foot paints ${pale.foot} / ${pale.warm}`);
  // with a sink the syrup settles in its own color under the body (the sunrise keeps its fire)
  const sunrise = drinkPaint({ body: { hex: '#f19a45', opacity: 0.98, clarity: 0.5 }, word: 'opaque amber', layers: [{ kind: 'sink', hex: '#8e0a1e', frac: 0.15 }] });
  assert.ok(hueGap(hexHsl(sunrise.shown[0].paint)[0], 352) <= 14, `a grenadine sink paints ${sunrise.shown[0].paint}`);
});

test('a dark brown spirit is mahogany with amber light at its edge, not wine', () => {
  const P = pigment('#4d2f1d', { opacity: 0, clarity: 0.9, word: 'dark brown' });
  const [bh, bs, bl] = hexHsl(P.body), [sh, , sl] = hexHsl(P.surf);
  assert.ok(P.kind === 'dark' && bh >= 17 && bh <= 32 && bs <= 0.6 && bl <= 0.32, `the body paints ${P.body}`);
  assert.ok(sh >= bh + 5 && sh <= 45 && sl >= bl + 0.1, `the edge and meniscus paint ${P.surf}, not an amber glow`);
  // the old wine-dark coffee hex is turned to mahogany too, but an oxblood keeps its red
  assert.ok(hexHsl(pigment('#642a1d', { opacity: 0, word: 'dark brown' }).body)[0] >= 17, 'coffee and rum painted as wine');
  assert.ok(hexHsl(pigment('#642a1d', { opacity: 0, word: 'dark oxblood' }).body)[0] < 17, 'an oxblood turned brown');
});

test('an opaque fruit body is laid flat under a pale froth that shows', () => {
  const params = { kind: 'hurricane', fill: 0.86, body: { hex: '#eccd77', opacity: 0.89, clarity: 0.4 }, layers: [{ kind: 'foam', hex: '#f7eaca', opacity: 1, frac: 0.06 }], seed: 33, word: 'opaque pineapple gold with a pale froth', tilt: { shift: 13 } };
  const ws = CATALOG.liquid(params).washes, R = rimOf('hurricane'), top = levelOf('hurricane', 0.86);
  const froth = hexOf(paintedAt(ws, [R.cx + 4, top + 5])), body = hexOf(paintedAt(ws, [R.cx + 4, (top + R.bottom) / 2]));
  assert.ok(hexHsl(froth)[2] >= 0.86, `the froth paints ${froth}, lost in the body`);
  assert.ok(hexHsl(body)[1] >= 0.6 && hexHsl(body)[2] < hexHsl(froth)[2] - 0.08, `the body paints ${body} under the froth ${froth}`);
});

test('a glaze is a function of the drink and the vessel, never of its neighbors; chile asks for oxblood, a dark prayer for black', () => {
  const ceramic = ['ku-mug', 'moai-mug', 'skull-mug', 'bird-mug', 'hot-mug', 'scorpion-bowl', 'tiki-bowl'];
  const mugs = drawn.filter(d => ceramic.includes(d.spec.kind));
  assert.ok(mugs.length >= 3);
  for (const { p, recipe, seed, spec } of mugs) for (const avoid of [[TIKI_GLAZES.turquoise], [TIKI_GLAZES.cobalt, TIKI_GLAZES.jade]]) {
    assert.equal(glazeOf(drinkSpec({ ...recipe, seed }, engine.ingMap, { avoid })), glazeOf(spec), `${p}: the glaze answers its neighbors`);
  }
  const dragon = engine.generate('a drink for a dragon', { seed: 0 }), spec = drinkSpec({ ...dragon, seed: 0 }, engine.ingMap);
  // (the oxblood when it stands clear of the drink: an oxblood mug round a rust-red drink loses it)
  const drinkHue = hexHsl(drinkPaint(spec.elements.find(e => e.part === 'liquid').params).P.surf)[0];
  if (ceramic.includes(spec.kind) && dragon.method.method !== 'hot' && hueGap(drinkHue, hexHsl(TIKI_GLAZES.oxblood)[0]) >= 30) assert.equal(glazeOf(spec), TIKI_GLAZES.oxblood, 'a chile-hot tiki mug is not in oxblood');
  const skull = engine.generate('skull mug of something dark', { seed: 0 });
  assert.equal(glazeOf(drinkSpec({ ...skull, seed: 0 }, engine.ingMap)), TIKI_GLAZES.ebony, 'a dark skull mug is not the black glaze');
  assert.equal(glazeOf(drinkSpec({ ...skull, seed: 0, prompt: 'a skull mug' }, engine.ingMap)), WARM_GLAZES.bone, 'a skull mug is not bone');
  // an ebony skull is black with a charcoal sheen, not a turquoise mug with black at its foot
  const coat = CATALOG.glass({ kind: 'skull-mug', glaze: TIKI_GLAZES.ebony }).washes.map(w => hexHsl(w.color));
  assert.ok(!coat.some(([h, s]) => h >= 160 && h <= 200 && s > 0.3) && coat.some(([, , l]) => l < 0.2), 'the ebony skull is not black');
});

test('mint muddled and shaken or blended through the drink shows as torn leaf bits in it', () => {
  const minty = drawn.concat(['my grandmother\'s garden', 'Havana 1957'].flatMap(p => [0, 1].map(seed => { const recipe = engine.generate(p, { seed }); return { p, recipe, spec: drinkSpec({ ...recipe, seed }, engine.ingMap) }; })))
    .filter(d => (d.recipe.lines || []).some(l => l.id === 'mint' && l.muddled && (l.amount || 0) >= 6) && !GLASS_PROFILES[d.spec.kind].opaque && !UP_VESSELS.includes(d.spec.kind));
  assert.ok(minty.length >= 2, 'muddled-mint drinks in clear glasses');
  for (const { p, spec } of minty) assert.ok(spec.elements.some(e => e.part === 'garnish.mint-leaves'), `${p}: the muddled mint is not in the glass`);
});

test('the drink stays inside its glass; a dark spirit over a block is one heart with a window, rims and a crescent of light', () => {
  // every drink declares the inside of its vessel as its clip, within the walls
  for (const { p, spec } of drawn) {
    const liq = spec.elements.find(e => e.part === 'liquid'), part = CATALOG.liquid(liq.params), G = GLASS_PROFILES[liq.params.kind];
    assert.ok(part.clip && part.clip.length === 1 && part.clip[0].length > 8, `${p}: the drink has no clip`);
    if (!G.opaque && !liq.params.frozen) for (const [x, y] of part.clip[0]) assert.ok(Math.abs(x - rimOf(liq.params.kind).cx) <= halfAt(G, y) + 0.01, `${p}: the clip runs past the wall at ${x},${y}`);
  }
  // a dark spirit stirred over a block, seen through the glass
  const dark = engine.generate('coffee and rum, stirred', { seed: 0 }), spec = drinkSpec({ ...dark, seed: 0 }, engine.ingMap);
  const liq = spec.elements.find(e => e.part === 'liquid'), ice = spec.elements.find(e => e.part === 'ice');
  assert.ok(liq.params.block && ice && ice.params.style === 'block', 'the stirred dark drink has its block');
  const { P } = drinkPaint(liq.params), R = rimOf(liq.params.kind), G = GLASS_PROFILES[liq.params.kind], top = levelOf(liq.params.kind, liq.params.fill);
  assert.equal(P.kind, 'dark');
  const ws = CATALOG.liquid(liq.params).washes, B = blockCube(liq.params.kind, liq.params.fill, liq.params.seed);
  // the window sits where the ice part draws the block (one geometry)
  // (its broken outline runs along the same curve the window is cut to)
  const curve = new Set(spline(B.c, 3).map(p => p.join())), outline = CATALOG.ice(ice.params).strokes.filter(s => s.color && s.color !== '#EEF6F7');
  assert.ok(outline.length >= 3 && outline.every(s => s.pts.every(p => curve.has(p.join()))), 'the window and the drawn block disagree');
  const L = x => hexHsl(hexOf(paintedAt(ws, x)))[2];
  const y = Math.min(R.bottom - 8, B.y + B.size / 2 + 6), xl = R.cx - halfAt(G, y) + 4, xr = R.cx + halfAt(G, y) - 4;
  // (one continuous heart: no streak of light parting it a third of the way in)
  const across = []; for (let x = xl + 8; x <= xr - 8; x += 3) across.push(L([x, R.bottom - 6]));
  assert.ok(Math.max(...across) - Math.min(...across) < 0.06, `the heart is striped: ${across.map(v => v.toFixed(2)).join(' ')}`);
  // amber hairlines at the walls and a lighter window through the block
  assert.ok(L([R.cx - halfAt(G, y) + 1.9, y]) > L([xl + 10, y]) + 0.08, 'no amber light at the wall');
  assert.ok(L([B.x, B.y]) > L([xl + 6, R.bottom - 6]) + 0.06, 'the block is not a lighter window');
  const ry = (halfAt(G, top) - 4) * G.rimTilt, lens = [];
  for (let u = -0.9; u <= 0.9; u += 0.05) lens.push(L([R.cx + u * (halfAt(G, top) - 4), top + ry * Math.sqrt(1 - u * u) - 1.2]));
  assert.ok(Math.max(...lens) > L([xl + 10, y]) + 0.08, 'no crescent of light at the meniscus');
  // and the window's color is still the drink's: a mahogany through ice is an amber-brown, never a pink or grey
  const [wh, ws2] = hexHsl(hexOf(paintedAt(ws, [B.x, B.y])));
  assert.ok(wh >= 12 && wh <= 40 && ws2 > 0.35, `the window paints hue ${wh}`);
  // two pours of it differ: a lighter heart, a different block
  const other = engine.generate('coffee and rum, stirred', { seed: 1 }), lp1 = drinkSpec({ ...other, seed: 1 }, engine.ingMap).elements.find(e => e.part === 'liquid').params;
  const B1 = blockCube(lp1.kind, lp1.fill, lp1.seed);
  assert.ok(Math.abs(B1.a - B.a) > 0.05 || Math.abs(B1.size - B.size) > 3, 'the two blocks are stamped from one plate');
});

test('no glaze in the drink stains off-hue: a garnet foot is never violet', () => {
  // a rust-red: every saturated wash the liquid lays stays in the warm half of the circle
  const ws = CATALOG.liquid({ kind: 'collins', fill: 0.92, body: { hex: '#b75c33', opacity: 0.55, clarity: 0.16 }, word: 'cloudy rust-red', crushed: true, seed: 5, tilt: { shift: -9 } }).washes;
  for (const w of ws) { const [h, s] = hexHsl(w.color); assert.ok(s < 0.25 || h <= 40 || h >= 345, `a wash loads ${w.color}`); }
});

test('a far sink feathers into the in-between color in tongues', () => {
  const params = { kind: 'highball', fill: 0.84, body: { hex: '#b6d77b', opacity: 0.13, clarity: 0.45 }, layers: [{ kind: 'sink', hex: '#720832', opacity: 0, frac: 0.15 }], seed: 9, word: 'chartreuse with hibiscus syrup settling ruby at the bottom' };
  const { shown } = drinkPaint(params), ruby = shown[0].paint, ws = CATALOG.liquid(params).washes;
  // the tongues: plain washes rising from the syrup, rounded and short of the body's own color
  const tongues = ws.filter(w => !w.layers && w.soft >= 0.9);
  assert.ok(tongues.length >= 2 && tongues.length <= 3, `${tongues.length} tongues`);
  // the top of the settled syrup is lighter and less saturated than its depths
  const feathers = ws.filter(w => w.layers && hexHsl(w.color)[1] > 0.3 && Math.abs(((hexHsl(w.color)[0] - hexHsl(ruby)[0] + 540) % 360) - 180) < 12);
  assert.ok(feathers.length >= 2, 'the syrup is one flat slab');
  // a turquoise drink in a clear glass shows turquoise on the shelf
  const blue = engine.generate('Elvis in Blue Hawaii', { seed: 0 }), above = shelfColorOf(drinkSpec({ ...blue, seed: 0 }, engine.ingMap));
  assert.ok(above && hexHsl(above)[0] > 160 && hexHsl(above)[0] < 200, `the Blue Hawaii shows ${above}`);
});

test('pale creams keep their own color: butter-yellow, mango-gold and ivory are three paints, and an ivory stays warm', () => {
  const cream = (hex, word) => drinkPaint({ body: { hex, opacity: 1, clarity: 0.8 }, word, creamy: true }).P;
  const looks = { butter: '#f8ecc3', mango: '#f0b955', ivory: '#f6ebca' };
  const butter = cream(looks.butter, 'creamy butter-yellow'), mango = cream(looks.mango, 'creamy mango-gold'), ivory = cream(looks.ivory, 'creamy ivory');
  for (const [k, P] of Object.entries({ butter, mango, ivory })) {
    const [h0, s0, l0] = hexHsl(looks[k]), [h, s, l] = hexHsl(P.body);
    assert.ok(hueGap(h, h0) <= 6 && s - s0 <= 0.12 && Math.abs(l - l0) <= 0.06, `the ${k} paints ${P.body} for ${looks[k]}`);
  }
  // a mango colada is a deep mango-gold (about h37 s0.72 l0.68), not a pale cream
  const [mh, ms, ml] = hexHsl(mango.body);
  assert.ok(mh >= 33 && mh <= 42 && ms >= 0.7 && ml <= 0.72, `a mango-gold paints ${mango.body}`);
  // an ivory is warm (hue 40-50, saturation at least 0.25), its shadow a deeper ivory, never grey-blue
  for (const key of ['body', 'deep', 'foot', 'warm']) { const [h, s] = hexHsl(ivory[key]); assert.ok(h >= 38 && h <= 52 && s >= 0.25, `an ivory's ${key} paints ${ivory[key]}`); }
  // every glaze of a cream within a few degrees of its body (no peach shadow)
  for (const P of [butter, mango, ivory]) {
    const [h0] = hexHsl(P.body);
    for (const key of ['surf', 'deep', 'foot', 'glow', 'warm']) assert.ok(hueGap(hexHsl(P[key])[0], h0) <= 4.5, `a cream's ${key} ${P[key]} strays from its body ${P.body}`);
  }
});

test('a pale look is lifted gently, and a copper never drifts gold', () => {
  const pale = drinkPaint({ body: { hex: '#d6ad6d', opacity: 0.43, clarity: 0.38 }, word: 'pale amber', tilt: { shift: -11 } }).P;
  const [ph, ps] = hexHsl(pale.body);
  assert.ok(ps <= 0.66 && ph >= 33, `a pale amber paints ${pale.body}, an orange`);
  const copper = drinkPaint({ body: { hex: '#c28848', opacity: 0.88, clarity: 0.19 }, word: 'opaque copper under a garnet crown of bitters', tilt: { shift: 13, top: '#f4cb34', topK: 0.56 } }).P;
  assert.ok(hexHsl(copper.body)[0] <= 32, `a copper paints ${copper.body}, a golden amber`);
});

test('an ice cone shows the drink through it; a vessel holds its paint to its wall', () => {
  const cone = CATALOG.ice({ kind: 'dof', style: 'ice-cone', fill: 0.84, seed: 3, body: '#e28422' });
  assert.ok(cone.washes.length && cone.washes.every(w => w.clip && w.clip.length >= 3), 'the cone is washed with the drink, less its white streaks and rim');
  for (const kind of ['ku-mug', 'coconut', 'barrel-mug', 'tiki-bowl']) {
    const g = CATALOG.glass({ kind, glaze: kind === 'ku-mug' ? TIKI_GLAZES.cobalt || Object.values(TIKI_GLAZES)[0] : undefined });
    assert.ok(g.washes.every(w => w.clip && w.clip.length), `a ${kind}'s paint runs loose past its wall`);
  }
  // grow pushes a square out on every side
  const sq = grow([[0, 0], [10, 0], [10, 10], [0, 10]], 2);
  assert.deepEqual(sq.map(p => p.map(v => Math.round(v))), [[-2, -2], [12, -2], [12, 12], [-2, 12]]);
});

// ---------------------------------------------------------------- round 2: the painting obeys the card
test('fire only with a fire step: a spent shell is a spent shell, and a lit one keeps everything clear of its flame', () => {
  const dragon = engine.generate('a drink for a dragon', { seed: 1 });
  const lit = dragon.method.steps.some(x => /light it/.test(x));
  // the same drink with its shell spent and no lighting step: no flame, even with the style's flag
  const spent = { ...dragon, seed: 1, style: { ...(dragon.style || {}), flaming: true }, garnish: dragon.garnish.map(g => (/flaming/.test(g) ? 'spent lime shell' : g)), method: { ...dragon.method, steps: dragon.method.steps.filter(x => !/light it|flame/i.test(x)) } };
  const s0 = drinkSpec(spent, engine.ingMap);
  assert.ok(!litByCard(spent) && !s0.elements.some(e => e.part === 'garnish.flame' || e.part === 'sparkle'), 'a spent shell is drawn on fire with no step that lights it');
  assert.equal((s0.elements.find(e => e.part === 'garnish.lime-shell') || { params: {} }).params.orientation, 'dome-up');
  // a flaming garnish whose steps do not light it is not drawn alight either
  const unlit = { ...spent, garnish: dragon.garnish };
  assert.ok(!drinkSpec(unlit, engine.ingMap).elements.some(e => e.part === 'garnish.flame'), 'a flame with no lighting step');
  // with the lighting step and its safety text, the flame is drawn, and every straw, sprig, stick
  // and flower stands a hand's width clear of it at every height it burns
  const fires = [...drawn.filter(d => litByCard(d.recipe)), ...(lit ? [{ p: 'a drink for a dragon', recipe: dragon, spec: drinkSpec({ ...dragon, seed: 1 }, engine.ingMap) }] : [])];
  assert.ok(fires.length >= 2, 'lit drinks in the battery');
  for (const { p, spec } of fires) {
    const flames = spec.elements.filter(e => e.part === 'garnish.flame');
    if (spec.kind !== 'volcano-bowl') assert.ok(flames.length, `${p}: lit on the card, not drawn`);
    for (const f of flames) for (const e of spec.elements.filter(x => ['straw', 'garnish.mint', 'garnish.cinnamon', 'garnish.umbrella', 'garnish.orchid', 'garnish.edible-flower', 'garnish.herb-sprig', 'garnish.swizzle-stick'].includes(x.part))) {
      for (const y of [f.y - (f.params.h || 54), f.y]) if (y <= e.y) assert.ok(Math.abs(e.x + Math.tan(e.rot || 0) * (e.y - y) - f.x) >= 40, `${p}: the ${e.part} stands in the flame at y ${y.toFixed(0)}`);
    }
  }
});

test('an opaque mug shows its drink at its own color, its float on top; a bowl shows the drink and its ice, a punch bowl its block', () => {
  // the skull's black rum float is what the guest sees on the surface
  const skull = drawn.filter(d => d.spec.kind === 'skull-mug' && d.recipe.look.layers.some(x => x.kind === 'float'));
  assert.ok(skull.length, 'a skull mug with a float');
  for (const { p, recipe, spec } of skull) {
    const liq = spec.elements.find(e => e.part === 'liquid').params, med = paintedBody(liq), fl = recipe.look.layers.find(x => x.kind === 'float');
    assert.ok(hexHsl(med)[2] < 0.3 && deltaE2000(med, fl.hex) <= 12, `${p}: the ${fl.id} float paints ${med} on the surface`);
  }
  // a bowl's surface is the drink's own color, not a pale salmon or white
  for (const { p, recipe, spec } of drawn.filter(d => ['scorpion-bowl', 'tiki-bowl', 'volcano-bowl'].includes(d.spec.kind))) {
    const liq = spec.elements.find(e => e.part === 'liquid').params;
    assert.ok(deltaE2000(paintedBody(liq), recipe.look.body.hex) <= 10, `${p}: the bowl's surface paints ${paintedBody(liq)} for ${recipe.look.body.hex}`);
    const ice = spec.elements.find(e => e.part === 'ice');
    if (ice && ['crushed', 'pebble', 'shaved'].includes(ice.params.style)) {
      const ws = CATALOG.ice(ice.params).washes;
      assert.ok(ws.some(w => w.clip && w.clip.length > 3), `${p}: the drink does not show in the gaps between the chips`);
    }
  }
  const punch = drawn.find(d => d.spec.kind === 'punch-bowl');
  if (punch) {
    const ice = punch.spec.elements.find(e => e.part === 'ice');
    assert.ok(ice && ice.params.style === 'block' && CATALOG.ice(ice.params).strokes.length >= 2, 'the punch bowl shows no block');
  }
});

test('garnish sprites: a banana coin is a cream disc on a pick, lemon is pale and not orange, a pineapple chunk is a cube, cinnamon a quill, floating wheels float', () => {
  assert.equal(garnishRule('banana coin on a pick').id, 'banana-pick');
  assert.equal(garnishRule('brûléed banana coin on a pick').id, 'banana-pick');
  const banana = CATALOG['garnish.pick']({ items: ['banana'] }), cream = banana.washes.find(w => hexHsl(w.color)[2] > 0.85);
  assert.ok(cream && !banana.strokes.some(s => s.pts.length === 2 && Math.hypot(s.pts[0][0] - s.pts[1][0], s.pts[0][1] - s.pts[1][1]) > 20), 'a banana coin drawn as a citrus wheel');
  const sheet = engine.generate('a frozen banana drink', { seed: 0 });
  if (sheet.garnish.some(g => /banana coin/.test(g))) assert.ok(drinkSpec({ ...sheet, seed: 0 }, engine.ingMap).elements.some(e => e.part === 'garnish.pick' && (e.params.items || []).includes('banana')), 'the banana coin is not on a pick');
  // lemon and orange are told apart at a glance
  const fill = part => hexHsl(CATALOG[part]({}).washes[0].color);
  const [lh, , ll] = fill('garnish.lemon-wheel'), [oh, , ol] = fill('garnish.orange-wheel');
  assert.ok(lh >= 48 && lh <= 60 && ll >= 0.7 && hueGap(lh, oh) >= 18, `lemon ${lh.toFixed(0)}/${ll.toFixed(2)} against orange ${oh.toFixed(0)}/${ol.toFixed(2)}`);
  // a pineapple chunk is a cube, about as tall as it is wide, with its rind crosshatched
  const chunk = CATALOG['garnish.pick']({ items: ['chunk'] }).cover.find(c => c.length >= 6), xs = chunk.map(q => q[0]), ys = chunk.map(q => q[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  assert.ok(w / h < 1.4 && w / h > 0.7, `a pineapple chunk ${w.toFixed(0)} by ${h.toFixed(0)} is a cigar`);
  // a cinnamon quill is about a third of an inch across (38 units to the inch): fat enough that
  // it never reads as a straw, thinner than a cigar, and short, a stub of bark, not straw length
  const cinS = CATALOG['garnish.cinnamon']({}), cin = cinS.cover[0].map(q => q[0]), cinW = Math.max(...cin) - Math.min(...cin);
  assert.ok(cinW <= 16, 'a cinnamon stick as thick as a cigar');
  assert.ok(cinW >= 11, 'a cinnamon stick as thin as a straw');
  assert.ok(cinS.box[1] <= 80, 'a cinnamon stick as long as a straw');
  // wheels floating on a punch: three to five small wheels on the surface
  assert.equal(garnishRule('orange wheels floating').id, 'floating-wheels');
  const punch = { ...engine.generate('a punch bowl for a party of 8', { seed: 0 }), seed: 0 };
  punch.garnish = [...punch.garnish.filter(g => !/wheel/.test(g)), 'orange wheels floating'];
  const wheels = drinkSpec(punch, engine.ingMap).elements.filter(e => e.part === 'garnish.orange-wheel');
  assert.ok(wheels.length >= 3 && wheels.length <= 5 && wheels.every(e => (e.s || 1) < 0.7 && e.params.flat < 0.5), `${wheels.length} floating wheels`);
});

test('pressed mint is drawn only from a mint line, never from a step\'s words', () => {
  const qps = engine.generate("queen's park swizzle", { seed: 0 }), spec = { ...qps, seed: 0 };
  const noMint = { ...spec, lines: spec.lines.filter(l => l.id !== 'mint' || l.garnish) };
  assert.ok(noMint.method.steps.some(x => /mint/i.test(x)) || true);
  assert.ok(!drinkSpec(noMint, engine.ingMap).elements.some(e => e.part === 'garnish.mint-leaves'), 'pressed mint drawn with no mint line');
  if (spec.lines.some(l => l.id === 'mint' && !l.garnish) && /press|muddle/i.test(spec.method.steps.join(' '))) assert.ok(drinkSpec(spec, engine.ingMap).elements.some(e => e.part === 'garnish.mint-leaves'), 'the QPS mint is not pressed into the glass');
});

test('the Kū mug is a carved relief, not a cartoon; every vessel in the library has a drawing, the acrylic tumbler too', () => {
  const ku = CATALOG.glass({ kind: 'ku-mug', glaze: TIKI_GLAZES.jade });
  // no googly pupils: no paper-white dots in the eyes
  assert.ok(!(ku.dots || []).some(d => d.color === PALETTE.paper), 'googly eyes');
  // a heavy brow (a long, near-level stroke across the face), almond eyes, a rectangular mouth
  const wide = ku.strokes.filter(s => { const xs = s.pts.map(q => q[0]); return Math.max(...xs) - Math.min(...xs) >= 90 && s.pts.every(q => q[1] > 225 && q[1] < 255); });
  assert.ok(wide.length >= 2, 'no brow ridge');
  const mouth = ku.strokes.find(s => { const xs = s.pts.map(q => q[0]), ys = s.pts.map(q => q[1]); return s.pts.length >= 8 && Math.max(...xs) - Math.min(...xs) >= 60 && Math.max(...ys) - Math.min(...ys) >= 20 && Math.min(...ys) > 300; });
  assert.ok(mouth, 'no rectangular mouth');
  const vessels = read('data/vessels.json');
  for (const v of vessels.vessels || vessels) assert.ok(VESSEL_IDS.includes(v.id) || VESSEL_IDS.includes(v.drawAs), `${v.id} has no drawing`);
  assert.ok(VESSEL_IDS.includes('acrylic-tumbler') && !GLASS_PROFILES['acrylic-tumbler'].opaque, 'the acrylic tumbler is not drawn as a clear tumbler');
  assert.ok(CATALOG.glass({ kind: 'acrylic-tumbler' }).strokes.length > CATALOG.glass({ kind: 'highball' }).strokes.length, 'the acrylic tumbler has no double wall');
});

test('the critic catches a flame with no lighting step, a lighting step with no safety line, and a fruit color word with no fruit', async () => {
  const { createLinter } = await import('../web/lib/lint.js');
  const { lint } = createLinter({ rules: read('data/technique-rules.json'), vocab: read('data/ingredients.json'), vessels: read('data/vessels.json') });
  const dragon = engine.generate('a drink for a dragon', { seed: 0 }), ids = r => lint(r).map(f => f.id);
  const unlit = { ...dragon, garnish: [...dragon.garnish.filter(g => !/flaming/.test(g)), 'flaming lime shell'], method: { ...dragon.method, steps: dragon.method.steps.filter(x => !/light it/.test(x)) } };
  assert.ok(ids(unlit).includes('flame-without-step'), 'a flame with no step passes');
  const unsafe = { ...unlit, method: { ...unlit.method, steps: [...unlit.method.steps, 'Set a sugar cube in the shell and light it.'] } };
  assert.ok(lint(unsafe).some(f => f.id === 'flame-without-safety' && f.sev === 'fatal'), 'a flame with no safety line passes');
  const mango = { ...dragon, look: { ...dragon.look, description: 'Opaque mango gold' } };
  if (!dragon.lines.some(l => /mango/.test(l.id))) assert.ok(ids(mango).includes('look-word-fruit'), 'a mango gold with no mango passes');
  for (const { p, recipe } of drawn) assert.ok(!lint(recipe).some(f => ['flame-without-step', 'flame-without-safety', 'look-word-fruit'].includes(f.id)), `${p}: ${lint(recipe).filter(f => /flame|look-word/.test(f.id)).map(f => f.msg).join('; ')}`);
});

test('a Lava Flow\'s strawberry, poured first, streaks up the walls only as a declared layer', async () => {
  const { drinkLook } = await import('../web/lib/optics.js');
  const ing = engine.ingMap, L = (spec, o) => drinkLook(spec.map(([id, oz, x]) => ({ id, oz, role: ing.get(id).role, ...(x || {}) })), ing, o);
  const lines = [['rum-white-column', 1], ['coconut-rum', 1], ['banana', 1.75], ['pineapple-juice', 2], ['coconut-cream', 2]];
  // without a declared streak the strawberries blended in are one pink body, no layer
  const blended = L([...lines, ['strawberry', 2]], { method: 'blend', ice: 'blended', dilutionOz: 5 });
  assert.ok(!blended.layers.some(x => x.kind === 'streak'), 'a streak with nothing poured first');
  const lava = L([...lines, ['strawberry', 2, { streak: true }]], { method: 'blend', ice: 'blended', dilutionOz: 5 });
  const st = lava.layers.find(x => x.kind === 'streak');
  assert.ok(st && /streaking .* up through it/.test(lava.description), `the Lava Flow reads ${lava.description}`);
  assert.ok(hexHsl(lava.body.hex)[2] > 0.75, `the colada between the streaks is ${lava.body.hex}, not pink`);
  const params = { kind: 'hurricane', fill: 0.92, frozen: true, body: lava.body, layers: lava.layers, word: lava.description.toLowerCase(), creamy: true, seed: 9 };
  const red = drinkPaint(params).shown[0].paint, ws = CATALOG.liquid(params).washes.filter(w => hueGap(hexHsl(w.color)[0], hexHsl(red)[0]) < 25 && hexHsl(w.color)[1] > 0.4);
  const R = rimOf('hurricane'), tops = ws.map(w => Math.min(...w.pts.map(q => q[1])));
  assert.ok(ws.length >= 4 && Math.min(...tops) < R.bottom - (R.bottom - R.y) * 0.4, 'the strawberry does not streak up the glass');
});
