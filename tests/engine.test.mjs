import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../web/lib/engine.js';
import { parsePrompt, buildNameIndex } from '../web/lib/prompt.js';
import { analyzeLines, indexIngredients } from '../web/lib/chem.js';
import { snap, fracString } from '../web/lib/format.js';
import { validateDrinks } from '../scripts/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const vocab = read('data/ingredients.json');
const families = read('data/families.json');
const drinks = read('data/drinks.json');
const model = read('data/model.json');
const canon = read('tests/fixtures/canon.json');
const vessels = read('data/vessels.json');
const engine = createEngine({ vocab, families, drinks, model, vessels, archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'), rules: read('data/technique-rules.json') });
const ingMap = indexIngredients(vocab);

const USABLE = new Set(['common', 'specialty', 'homemade']);
const PROMPTS = [
  'smoky and spicy for a cold night', 'like a Painkiller but less sweet', 'tequila tiki with passion fruit',
  'something blue for a pool party', 'strong and funky, three rums', 'bitter and refreshing', 'frozen banana for the beach',
  'Mai Tai with mezcal', 'hot buttered rum for Christmas', 'zero-proof and tropical', 'gin, honey and grapefruit',
  'a punch bowl for 6, no coconut', 'zombie', 'navy grog but with bourbon', 'coconut', 'something with Campari and pineapple',
  'nut-free mai tai', 'light and low abv for brunch', 'chocolate and coffee dessert drink', 'a jungle bird with mezcal',
];

test('database validates against the vocabulary', () => {
  const { errors } = validateDrinks(drinks);
  assert.deepEqual(errors, []);
  assert.ok(drinks.length >= 200, `expected a real catalogue, got ${drinks.length}`);
});

test('chemistry: canonical specs land in the expected ranges', () => {
  const byId = Object.fromEntries(canon.map(d => [d.id, d]));
  const chem = id => analyzeLines(byId[id].ingredients, ingMap, vocab.units, { method: byId[id].method, ice: byId[id].ice });
  const maiTai = chem('mai-tai-1944');
  assert.ok(maiTai.abv > 14 && maiTai.abv < 20, `Mai Tai ABV ${maiTai.abv}`);
  assert.ok(maiTai.sweetSour > 6 && maiTai.sweetSour < 12, `Mai Tai sugar:acid ${maiTai.sweetSour}`);
  const daiquiri = chem('daiquiri');
  assert.ok(daiquiri.abv > 12 && daiquiri.abv < 18, `Daiquiri ABV ${daiquiri.abv}`);
  const painkiller = chem('painkiller');
  assert.ok(painkiller.abv < daiquiri.abv, 'a Painkiller is lighter than a Daiquiri');
  assert.ok(painkiller.sweetSour > 15, 'a Painkiller is far sweeter than it is sour');
});

test('prompt parser: negation, riffs, spirits, diets, servings', () => {
  const nameIndex = buildNameIndex(drinks);
  const a = parsePrompt('no coconut, but lots of pineapple', { nameIndex });
  assert.ok(a.avoidTags.coconut > 0);
  assert.ok(a.tags.pineapple > 0);
  const b = parsePrompt('like a Painkiller but less sweet', { nameIndex });
  assert.equal(drinks.find(d => d.id === b.riffOf).name, 'Painkiller');
  assert.ok(b.sweetness < 0);
  const c = parsePrompt('mezcal and passion fruit, nut-free, for 4', { nameIndex });
  assert.ok(c.spirits.includes('mezcal'));
  assert.ok(c.avoidIngs.has('orgeat'));
  assert.equal(c.servings, 4);
  const d = parsePrompt('not too strong', { nameIndex });
  assert.ok(d.strength < 0);
});

test('every example prompt yields a balanced, buildable recipe', () => {
  for (const p of PROMPTS) {
    const r = engine.generate(p, { seed: 0 });
    assert.ok(r.name && r.lines.length >= 3, `${p}: too few lines`);
    for (const l of r.lines) {
      const ing = ingMap.get(l.id);
      assert.ok(ing, `${p}: unknown ingredient ${l.id}`);
      assert.ok(USABLE.has(ing.avail), `${p}: ${l.id} is ${ing.avail}`);
      if (!l.garnish && !l.muddled) assert.ok(l.oz > 0, `${p}: ${l.id} has no volume`);
    }
    assert.ok(new Set(r.lines.map(l => l.id)).size === r.lines.length, `${p}: duplicate ingredient`);
    assert.ok(r.method.steps.length >= 2, `${p}: no method`);
    assert.ok(r.explanation.lineage.length >= 1 && r.explanation.influences.length >= 1, `${p}: no lineage`);
    if (!/zero-proof/.test(p)) assert.ok(r.stats.abv > 3 && r.stats.abv < 30, `${p}: ABV ${r.stats.abv}`);
    assert.ok(r.stats.volOz < 14, `${p}: ${r.stats.volOz} oz is too big for one drink`);
  }
});

test('generator honours hard constraints', () => {
  const noCoco = engine.generate('a punch bowl for 6, no coconut', { seed: 0 });
  for (const l of noCoco.lines) assert.ok(!(ingMap.get(l.id).flavors || []).includes('coconut'), `coconut slipped in via ${l.id}`);
  assert.equal(noCoco.servings, 6);
  const nutFree = engine.generate('nut-free mai tai', { seed: 0 });
  for (const id of ['orgeat', 'amaretto', 'hazelnut-liqueur', 'velvet-falernum', 'falernum-syrup']) assert.ok(!nutFree.lines.some(l => l.id === id), `${id} in a nut-free drink`);
  const zero = engine.generate('zero-proof and tropical', { seed: 0 });
  assert.ok(zero.stats.abv < 1, `zero-proof drink has ${zero.stats.abv}% ABV`);
  const tequila = engine.generate('tequila tiki with passion fruit', { seed: 0 });
  assert.ok(tequila.lines.some(l => l.id.startsWith('tequila')), 'asked for tequila');
  assert.ok(tequila.lines.some(l => (ingMap.get(l.id).flavors || []).includes('passion-fruit')), 'asked for passion fruit');
  const hot = engine.generate('hot buttered rum for Christmas', { seed: 0 });
  assert.equal(hot.method.method, 'hot');
});

test('same prompt + seed is deterministic; a new seed makes a new drink', () => {
  const a = engine.generate('smoky and spicy for a cold night', { seed: 0 });
  const b = engine.generate('smoky and spicy for a cold night', { seed: 0 });
  assert.deepEqual(a.lines, b.lines);
  const variants = new Set([1, 2, 3, 4, 5].map(seed => engine.generate('smoky and spicy for a cold night', { seed }).lines.map(l => l.id).sort().join()));
  assert.ok(variants.size >= 2, 'shaking again should explore');
});

test('riffs change something but keep the family', () => {
  const r = engine.generate('Mai Tai with mezcal', { seed: 0 });
  assert.equal(r.family.id, 'mai-tai');
  assert.ok(r.lines.some(l => l.id === 'mezcal'));
  const plain = engine.generate('zombie', { seed: 0 });
  const src = drinks.find(d => d.id === plain.riffOf.id);
  const srcIds = new Set(src.ingredients.map(l => l.id));
  assert.ok(plain.lines.some(l => !srcIds.has(l.id)) || plain.lines.length !== srcIds.size, 'a bare riff must differ from its source');
});

test('bar amounts snap to measurable quantities', () => {
  const lime = ingMap.get('lime');
  assert.deepEqual(snap(0.8, lime, 'sour'), { amount: 0.75, unit: 'oz', oz: 0.75 });
  assert.equal(snap(0.15, ingMap.get('grenadine'), 'sweet').unit, 'tsp');
  assert.equal(snap(0.05, ingMap.get('angostura'), 'accent').unit, 'dash');
  assert.equal(snap(0.018, ingMap.get('pastis'), 'accent').unit, 'drop');
  assert.equal(fracString(1.75), '1¾');
});

test('every catalogued drink has a known, drawable vessel', async () => {
  const { GLASS_PROFILES } = await import('../web/lib/artcatalog.js');
  const ids = new Set(vessels.vessels.map(v => v.id));
  for (const v of vessels.vessels) assert.ok(GLASS_PROFILES[v.id] || GLASS_PROFILES[v.drawAs], `no drawing for vessel ${v.id}`);
  for (const d of drinks) assert.ok(ids.has(d.vessel), `${d.id}: vessel ${d.vessel}`);
  const byName = n => drinks.filter(d => d.name === n).map(d => d.vessel);
  assert.ok(byName('Painkiller').every(v => v === 'enamel-tin'), 'Painkiller comes in the Pusser\'s tin');
  assert.ok(byName('Pearl Diver').every(v => v === 'pearl-diver'), 'the Pearl Diver has its own glass');
  assert.ok(byName('Shrunken Skull').every(v => v === 'skull-mug'));
  assert.ok(byName('Jungle Bird').includes('bird-mug'), 'the 1973 original was served in a bird');
});

test('every generated drink gets a vessel that takes its service and holds it', () => {
  const byId = Object.fromEntries(vessels.vessels.map(v => [v.id, v]));
  for (const p of PROMPTS) for (const seed of [0, 1, 2]) {
    const r = engine.generate(p, { seed });
    assert.ok(r.vessel && byId[r.vessel.id], `${p}: no vessel`);
    const v = byId[r.vessel.id];
    assert.equal(r.method.glass, v.name, `${p}: steps name the vessel`);
    if (r.vessel.why === 'asked') continue;
    const bowl = r.servings >= 3 || r.style.bowl;
    assert.equal(v.serve.includes('bowl'), !!bowl, `${p}: ${v.id} for ${r.servings} servings`);
    if (!bowl) assert.ok(r.stats.finalOz <= v.capacity * 1.12, `${p}: ${r.stats.finalOz} oz in a ${v.capacity} oz ${v.id}`);
    if (r.method.method === 'hot') assert.ok(v.serve.includes('hot'), `${p}: hot drink in ${v.id}`);
    if (r.method.method === 'blend') assert.ok(v.serve.includes('frozen'), `${p}: frozen drink in ${v.id}`);
  }
});

test('asking for a vessel gets you that vessel, served the way it holds a drink', () => {
  const cases = { 'mezcal in a coconut': 'coconut', 'a skull mug of something dark': 'skull-mug', 'volcano bowl for 4': 'volcano-bowl', 'daiquiri in a tiki mug': 'ku-mug', 'something bitter in a coupe': 'coupe', 'zombie glass of dark rum': 'chimney' };
  for (const [p, id] of Object.entries(cases)) {
    const r = engine.generate(p);
    assert.equal(r.vessel.id, id, p);
  }
  assert.ok(['crushed', 'blended'].includes(engine.generate('mezcal in a coconut').method.ice), 'a coconut is packed with crushed ice or filled with a frozen drink');
});

// ---------- absolute balance, doses and line counts (round-2 critique §1, §7) ----------
import { sugarBand, balanceWord } from '../web/lib/chem.js';
import { createComposer, doseCap } from '../web/lib/composer.js';

test('absolute bands: the praised canon pours keep their spec', () => {
  // Calibration from the round-2 packet: these are diluted, finished-volume numbers, and the
  // critic scored all four 7.5 or better. Canon as written keeps its spec; "very tart" moves the band.
  const zombie = engine.generate('zombie', { seed: 0 });
  assert.ok(Math.abs(zombie.stats.sugarConc - 3.6) <= 0.3, `the 1934 Zombie moved to ${zombie.stats.sugarConc} g`);
  const qps = engine.generate('a swizzle', { seed: 0 });
  assert.equal(qps.name, "Queen's Park Swizzle");
  assert.ok(Math.abs(qps.stats.sugarConc - 4.4) <= 0.3, `the 1946 QPS moved to ${qps.stats.sugarConc} g`);
  assert.equal(qps.lines.find(l => l.id === 'rum-demerara').oz, 3, 'the QPS keeps its three ounces of Demerara');
  const tart = engine.generate('not too sweet, very tart', { seed: 1 });
  assert.ok(tart.stats.sugarConc <= 4.6 && tart.stats.acidConc >= 1.05, `very tart moved to ${tart.stats.sugarConc} g / ${tart.stats.acidConc}`);
  const scorpion = engine.generate('scorpion bowl for 4', { seed: 0 });
  assert.ok(Math.abs(scorpion.stats.sugarConc - 5.0) <= 0.3, `the Scorpion moved to ${scorpion.stats.sugarConc} g`);
});

test('absolute bands: the syrup-soup punches and the loud sours can no longer be poured', () => {
  for (const seed of [0, 1, 2]) {
    const j = engine.generate('Jamaican street party', { seed });
    assert.ok(j.stats.sugarConc <= 11.3, `Jamaican street party [${seed}] ${j.name}: ${j.stats.sugarConc} g`);
    assert.ok(j.stats.acidConc <= 1.25, `Jamaican street party [${seed}] ${j.name}: ${j.stats.acidConc} acid`);
    const m = engine.generate('mezcal and passion fruit', { seed });
    assert.ok(!(m.stats.sugarConc > 12 && m.stats.acidConc > 1.2), `mezcal and passion fruit [${seed}]: loud on both axes`);
    const bowl = engine.generate('a punch bowl for a party of 8', { seed });
    if (!bowl.classic) assert.ok(bowl.stats.acidConc <= 1.25, `party bowl [${seed}] ${bowl.name} sharp at ${bowl.stats.acidConc}`);
  }
  // The bands themselves: a 26.4 g punch, a 17.6 g punch cup and a 12.2 g / 1.25 sour sit outside.
  const punch = sugarBand({ method: 'build', ice: 'block', servings: 8, punchBowl: true, sour: true });
  assert.ok(26.4 > punch.sugar[1] && 17.6 > punch.sugar[1], 'a punch over a block stays at or under 11 g');
  const sour = sugarBand({ method: 'shake', ice: 'crushed', sour: true });
  assert.ok(12.2 > sour.sugar[1] && 1.25 > sour.acid[1], 'a shaken sour stays at or under 11 g and 1.2 g acid');
  // A directional ask moves the band.
  assert.ok(sugarBand({ method: 'shake', sour: true, tartness: 2 }).sugar[0] < 4.2, '"very tart" lowers the floor');
  assert.ok(sugarBand({ method: 'blend', sour: true, sweetness: -1 }).sugar[0] >= 7.8, 'frozen "less sweet" still clears 8 g');
});

test('a syrup never inherits a nectar\'s range: dose caps by bottle', () => {
  assert.ok(doseCap('passion-fruit-syrup', 'punch') <= 1 && doseCap('passion-fruit-syrup', 'resort-punch') <= 2);
  for (const id of ['hibiscus-syrup', 'orgeat', 'cinnamon-syrup', 'falernum-syrup']) assert.ok(doseCap(id, 'punch') <= 1, `${id} capped at an ounce`);
  assert.ok(doseCap('coconut-rum', 'colada') <= 0.5 && doseCap('coconut-rum', 'resort-punch') <= 0.5, 'coconut rum is an accent');
  for (const p of ['Jamaican street party', 'a tropical itch', 'a tropical itch for the party']) for (const seed of [0, 1]) {
    const r = engine.generate(p, { seed });
    for (const l of r.lines) if (ingMap.get(l.id).role === 'sweet' && !l.sink && !/batter/.test(l.id)) assert.ok(l.oz <= 2 + 1e-9, `${p} [${seed}]: ${l.oz} oz of ${l.id} per serve`);
  }
});

test('a frozen sour under its floor gets sugar, adding rich simple or demerara when nothing can scale', () => {
  for (const p of ["my grandmother's garden", 'something blue for the pool', 'a frozen banana drink', 'Tokyo neon', 'Elvis in Blue Hawaii']) for (const seed of [0, 1]) {
    const r = engine.generate(p, { seed });
    if (r.method.method !== 'blend' || r.classic) continue;
    assert.ok(r.stats.sugarConc >= 7.9, `${p} [${seed}] ${r.name}: frozen at ${r.stats.sugarConc} g`);
  }
  const g = engine.generate("my grandmother's garden", { seed: 0 });
  if (g.method.method === 'blend') assert.ok(g.lines.some(l => ['simple-syrup', 'rich-simple', 'demerara-syrup', 'cane-syrup'].includes(l.id)), `${g.name}: a frozen sour sweetened only by capped liqueurs`);
});

test('the balance word comes from absolute numbers', () => {
  assert.ok(/^Sweet/.test(balanceWord({ sugarConc: 26.4, acidConc: 1.38 })), '26.4 g is sweet, whatever the acid');
  assert.ok(/^Sweet/.test(balanceWord({ sugarConc: 17.6, acidConc: 1.38 })));
  assert.equal(balanceWord({ sugarConc: 4.1, acidConc: 1.11 }), 'Tart and bracing.');
  assert.notEqual(balanceWord({ sugarConc: 8.2, acidConc: 0.63 }, { creamy: true }), 'Tart and bracing.');
  assert.notEqual(balanceWord({ sugarConc: 6.4, acidConc: 0.43 }, { method: 'blend', creamy: true }), 'Tart and bracing.');
  assert.notEqual(balanceWord({ sugarConc: 9.6, acidConc: 0.95 }), 'Tart and bracing.', 'bracing needs restrained sugar');
  assert.equal(balanceWord({ sugarConc: 4.5, acidConc: 0 }, { method: 'hot', buttery: true }), 'No citrus, soft and round.');
});

test('identity-core doses: satisfies() holds the core to its dose', () => {
  const archetypes = read('data/archetypes.json').archetypes;
  const composer = createComposer({ archetypes, ingMap, model });
  const maiTai = archetypes.find(a => a.id === 'mai-tai');
  const L = (id, oz) => ({ id, oz });
  const thin = [L('rum-jamaican-aged', 2), L('lime', 1), L('orange-curacao', 0.5), L('orgeat', 1 / 3), L('rich-simple', 0.25)];
  assert.ok(composer.satisfies(maiTai, thin).ok, 'identification ignores doses');
  assert.ok(!composer.satisfies(maiTai, thin, {}, null, { doses: true }).ok, 'two teaspoons of orgeat is not a Mai Tai');
  assert.ok(composer.satisfies(maiTai, thin.map(l => l.id === 'orgeat' ? L('orgeat', 0.5) : l), {}, null, { doses: true }).ok);
  const zombie = archetypes.find(a => a.id === 'zombie');
  const dons = composer.coreMinimums(zombie, [L('grapefruit', 0.25), L('cinnamon-syrup', 0.25)]);
  assert.ok(dons.some(m => m.line.id === 'grapefruit' && m.min >= 0.5), "Don's Mix is two of grapefruit to one of cinnamon");
  for (const [p, seed] of [['celebrating a promotion', 0], ['celebrating a promotion', 1], ['something my dad would like', 0]]) {
    const r = engine.generate(p, { seed });
    const o = r.lines.find(l => l.id === 'orgeat');
    if (o && r.family.id === 'mai-tai') assert.ok(o.oz >= 0.5 - 1e-9, `${p} [${seed}] ${r.name}: ${o.oz} oz orgeat`);
  }
});

test('a low-ABV prayer is light: at or under 7% and about a standard drink', () => {
  for (const seed of [0, 1, 2]) {
    const r = engine.generate('low abv for brunch', { seed });
    assert.ok(r.stats.abv <= 7.05 && r.stats.standardDrinks <= 1.1, `low abv [${seed}] ${r.name}: ${r.stats.abv}% / ${r.stats.standardDrinks} sd`);
    assert.ok(!/normal cocktail/.test(r.explanation.tasting), `low abv [${seed}]: ${r.explanation.tasting}`);
  }
});
