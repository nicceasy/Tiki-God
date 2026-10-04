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
  vessels: read('data/vessels.json'), archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'),
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
