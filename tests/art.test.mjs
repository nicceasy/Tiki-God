// The drink drawing tells the truth about the card (docs/research/presentation.md §7.4): every
// garnish it draws comes from a garnish phrase on the card, its service matches the method, and
// the signature serves look the way an aficionado expects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../web/lib/engine.js';
import { drinkSpec, validateSpec, partsForPhrase, garnishPlan, UMBRELLA_ALLOWED, UP_VESSELS, FIZZ, idolSpec } from '../web/lib/artspec.js';
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
// The liquid is painted from the look (optics.js) pushed the way a tiki menu painter pushes it:
// more saturated and luminous, on the drink's own hue, creams still cream, clear still cool, dark
// still dark; and the graded glazes multiply exactly onto the tones they promise.
import { pigment, glaze, washFactor, hexHsl, GLASS_PROFILES, TIKI_GLAZES, levelOf } from '../web/lib/artcatalog.js';

const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

test('the painted body keeps the look\'s hue and is never duller than it', () => {
  for (const { p, recipe } of drawn) {
    const b = recipe.look.body, P = pigment(b.hex, { opacity: b.opacity, clarity: b.clarity });
    if (P.kind === 'clear') continue;
    const [h0, s0] = hexHsl(b.hex), [h, s] = hexHsl(P.body);
    if (s0 > 0.08) assert.ok(hueGap(h, h0) <= 15, `${p}: painted hue ${h.toFixed(0)} strays from the look's ${h0.toFixed(0)}`);
    if (P.kind === 'color') assert.ok(s >= Math.min(0.8, s0 * 1.25), `${p}: ${b.hex} painted at saturation ${s.toFixed(2)}, not pushed`);
    else if (P.kind !== 'dark') assert.ok(s >= s0 * 0.85 || s >= 0.55, `${p}: ${b.hex} washed out to ${s.toFixed(2)}`);
  }
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

test('layers stay where physics puts them: a sink pools at the foot, a float sits on top', () => {
  const sink = drawn.find(d => d.recipe.look.layers.some(x => x.kind === 'sink') && !GLASS_PROFILES[d.spec.kind].opaque && !d.spec.elements.find(e => e.part === 'liquid').params.frozen && !d.spec.elements.find(e => e.part === 'liquid').params.frost);
  assert.ok(sink, 'a drink with a sink in a clear glass');
  const liq = sink.spec.elements.find(e => e.part === 'liquid'), R = rimOf(liq.params.kind);
  const L = sink.recipe.look.layers.find(x => x.kind === 'sink');
  const paint = pigment(L.hex, { opacity: 1, layer: true }).body;
  const ws = CATALOG.liquid(liq.params).washes.filter(w => w.color === paint);
  const top = Math.min(...CATALOG.liquid(liq.params).washes.flatMap(w => w.pts.map(q => q[1])));
  assert.ok(ws.filter(w => Math.max(...w.pts.map(q => q[1])) >= R.bottom - 12).length >= 3, 'the sink is laid in its own color, pooled on the floor of the glass');
  // its plumes bleed upward, but the syrup never climbs past the middle of the drink
  for (const w of ws) assert.ok(Math.min(...w.pts.map(q => q[1])) > (top + R.bottom) / 2 - 10, 'a sink wash climbs into the top of the drink');
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

test('ceramic mugs and bowls wear tiki glazes; coconut, barrel and pineapple stay natural', () => {
  const GL = Object.values(TIKI_GLAZES), ceramic = ['ku-mug', 'moai-mug', 'skull-mug', 'bird-mug', 'hot-mug', 'scorpion-bowl', 'tiki-bowl'];
  let n = 0;
  for (const { p, spec } of drawn) {
    const g = spec.elements.find(e => e.part === 'glass');
    if (!ceramic.includes(g.params.kind)) continue;
    n++;
    assert.ok(GL.includes(g.params.glaze), `${p}: a ${g.params.kind} in ${g.params.glaze}, not a tiki glaze`);
    assert.ok(CATALOG.glass(g.params).glazed, `${p}: the glaze is not composited as a glaze`);
  }
  assert.ok(n >= 3, 'ceramic vessels in the battery');
  for (const kind of ['coconut', 'barrel-mug', 'pineapple']) assert.ok(!CATALOG.glass({ kind, glaze: TIKI_GLAZES.cobalt }).glazed, `${kind} took a glaze`);
  // the volcano bowl: black glaze, red-orange lava
  const v = CATALOG.glass({ kind: 'volcano-bowl' }), cols = v.washes.map(w => hexHsl(w.color));
  assert.ok(cols.some(([, s, l]) => l < 0.45 && s < 0.3), 'the volcano bowl has no black glaze');
  assert.ok(cols.some(([h, s]) => (h <= 25 || h >= 350) && s > 0.6), 'the volcano bowl has no lava');
});
