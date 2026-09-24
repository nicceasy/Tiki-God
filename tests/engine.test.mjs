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
const engine = createEngine({ vocab, families, drinks, model });
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
      if (!l.garnish) assert.ok(l.oz > 0, `${p}: ${l.id} has no volume`);
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
