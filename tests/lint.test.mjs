import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLinter } from '../web/lib/lint.js';
import { createEngine } from '../web/lib/engine.js';
import { analyzeLines, lineOz, indexIngredients } from '../web/lib/chem.js';
import { drinkLook } from '../web/lib/optics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const vocab = read('data/ingredients.json');
const vessels = read('data/vessels.json');
const rules = read('data/technique-rules.json');
const drinks = read('data/drinks.json');
const { lint } = createLinter({ rules, vocab, vessels });
const ingMap = indexIngredients(vocab);

// A small hand-built recipe: a shaken rum sour in a coupe unless the test says otherwise.
const L = (id, oz, extra = {}) => ({ id, oz, ...extra });
function mk(o = {}) {
  return {
    name: 'Test Pour', tagline: 'A bright rum sour with fresh lime, shaken hard and served very cold.', prompt: '',
    archetype: { id: '', name: '' }, family: { id: 'daiquiri' }, servings: 1, riffOf: null,
    lines: [L('rum-white-column', 2), L('lime', 1), L('simple-syrup', 0.75)], vessel: { id: 'coupe' }, garnish: [], look: null, style: {},
    ...o,
    method: { method: 'shake', ice: 'cubed', steps: [], ...(o.method || {}) },
  };
}
const find = (fs, id, sev) => fs.filter(f => f.id === id && (!sev || f.sev === sev));
const show = fs => fs.map(f => `${f.sev} ${f.id}: ${f.msg}`).join('\n');
function fires(recipe, id, sev, opts) {
  const fs = lint(recipe, opts);
  assert.ok(find(fs, id, sev).length, `expected ${sev || ''} ${id}, got:\n${show(fs)}`);
  return fs;
}
function quiet(recipe, id, opts) {
  const fs = lint(recipe, opts);
  assert.equal(find(fs, id).length, 0, `did not expect ${id}:\n${show(fs)}`);
  return fs;
}

test('a clean Daiquiri spec has no fatal or major findings', () => {
  const daiquiri = mk({
    name: 'Daiquiri', archetype: { id: 'daiquiri', name: 'Daiquiri' },
    tagline: 'Cuban white rum, fresh lime juice and sugar, shaken hard and served very cold.',
    method: { method: 'shake', ice: 'cubed', up: true, steps: ['Shake everything with cubed ice hard for 10–12 seconds.', 'Double-strain into a chilled coupe.'] },
    garnish: ['lime wheel'], look: { body: { hex: '#ecefd6', opacity: 0.25 }, layers: [] },
    explanation: { tasting: 'Lime up front, then crisp white rum carries the middle. Sweet and sour in balance. It has some muscle.' },
  });
  const fs = lint(daiquiri);
  assert.deepEqual(fs.filter(f => f.sev !== 'minor'), [], show(fs));
  assert.equal(find(fs, 'linter-error').length, 0, show(fs));
  for (const f of fs) assert.ok(f.id && f.sev && f.msg, 'every finding has an id, a severity and a message');
});

test('family identity: colada, Mai Tai, Zombie, orgeat punch', () => {
  const colada = { family: { id: 'colada' }, vessel: { id: 'hurricane' }, method: { method: 'shake', ice: 'crushed' } };
  fires(mk({ ...colada, lines: [L('rum-white-column', 2), L('pineapple-juice', 4), L('lime', 0.5)] }), 'colada-no-coconut-or-pineapple', 'fatal');
  quiet(mk({ ...colada, lines: [L('rum-white-column', 2), L('pineapple-juice', 4), L('coconut-cream', 1.5), L('lime', 0.5)] }), 'colada-no-coconut-or-pineapple');
  // Present but under the canonical dose is major, not fatal (the Death & Co Piña Colada).
  const thin = lint(mk({ ...colada, lines: [L('rum-jamaican-pot', 1), L('pineapple-juice', 1), L('coconut-cream', 0.75), L('lime', 0.5)] }));
  assert.equal(find(thin, 'colada-no-coconut-or-pineapple').length, 0, show(thin));
  assert.ok(find(thin, 'family-underdosed', 'major').length, show(thin));
  // A colada in name only.
  fires(mk({ name: 'Midnight Colada', family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, lines: [L('rum-white-column', 2), L('lime', 0.75), L('simple-syrup', 0.5), L('soda-water', 2, { unit: 'top' })] }), 'noun-claim-false', 'fatal');

  const maiTai = { name: 'Mai Tai', family: { id: 'mai-tai' }, archetype: { id: 'mai-tai', name: 'Mai Tai' }, vessel: { id: 'dof' }, method: { method: 'shake', ice: 'crushed' }, garnish: ['spent lime shell', 'mint sprig'] };
  const spec = [L('rum-jamaican-aged', 2), L('lime', 1), L('orange-curacao', 0.5), L('orgeat', 0.5), L('rich-simple', 0.25)];
  fires(mk({ ...maiTai, lines: [...spec, L('pineapple-juice', 1)] }), 'mai-tai-juice', 'fatal');
  const clean = lint(mk({ ...maiTai, lines: spec }));
  assert.equal(clean.filter(f => f.sev === 'fatal').length, 0, show(clean));
  fires(mk({ ...maiTai, lines: spec.filter(l => l.id !== 'orgeat') }), 'mai-tai-incomplete', 'fatal');
  // A Royal Hawaiian riff that says so may take juice.
  quiet(mk({ ...maiTai, name: 'Royal Hawaiian Mai Tai', family: { id: 'resort-punch' }, archetype: { id: 'hawaiian-mai-tai', name: 'Hawaiian Mai Tai' }, lines: [...spec, L('pineapple-juice', 1)] }), 'mai-tai-juice');

  const zombie = { family: { id: 'zombie' }, archetype: { id: 'zombie', name: 'Zombie' }, vessel: { id: 'chimney' }, method: { method: 'flash-blend', ice: 'crushed' }, garnish: ['mint sprig'] };
  fires(mk({ ...zombie, lines: [L('rum-gold-column', 2), L('lime', 0.75), L('velvet-falernum', 0.5), L('dons-mix', 0.5)] }), 'zombie-weak-structure', 'fatal');
  const z = [L('rum-gold-column', 1.5), L('rum-jamaican-aged', 1.5), L('rum-demerara-overproof', 1), L('lime', 0.75), L('dons-mix', 0.5), L('velvet-falernum', 0.5)];
  quiet(mk({ ...zombie, lines: [...z, L('grenadine', 1 / 6, { unit: 'tsp' })] }), 'zombie-red-or-creamy');
  fires(mk({ ...zombie, lines: [...z, L('grenadine', 0.5)] }), 'zombie-red-or-creamy', 'fatal');
  fires(mk({ ...zombie, lines: [...z, L('coconut-cream', 0.5)] }), 'zombie-red-or-creamy', 'fatal');

  fires(mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, tagline: 'A brandy and orgeat punch with lemon, built for a long afternoon on the porch.', lines: [L('brandy', 2), L('lemon', 1), L('simple-syrup', 0.5), L('orange', 1)] }), 'orgeat-punch-without-orgeat', 'fatal');
});

test('color physics: blue curaçao with dark rum, yellow juice and red syrups', () => {
  const blue = { family: { id: 'resort-punch' }, vessel: { id: 'hurricane' }, method: { method: 'shake', ice: 'crushed' }, prompt: 'something blue' };
  fires(mk({ ...blue, lines: [L('rum-jamaican-dark', 1.5), L('blue-curacao', 0.75), L('lime', 0.75), L('simple-syrup', 0.25)] }), 'blue-plus-dark-rum', 'fatal');
  const pineBlue = [L('rum-white-column', 1.5), L('blue-curacao', 0.75), L('pineapple-juice', 3), L('lime', 0.75)];
  fires(mk({ ...blue, tagline: 'A blue lagoon of a drink, with pineapple and lime, for the deep end of the pool.', lines: pineBlue }), 'blue-goes-green', 'major');
  quiet(mk({ ...blue, tagline: 'An aqua punch with pineapple and lime, poured for the deep end of the pool.', lines: pineBlue }), 'blue-goes-green');
  const red = [L('rum-white-column', 1.5), L('blue-curacao', 0.75), L('lime', 0.75), L('soda-water', 2, { unit: 'top' })];
  fires(mk({ ...blue, lines: [...red, L('grenadine', 0.5)] }), 'blue-plus-red', 'major');
  quiet(mk({ ...blue, lines: [...red, L('grenadine', 0.5, { sink: true })] }), 'blue-plus-red');
});

test('carbonation is topped, never shaken (with the Navy Grog precedent)', () => {
  const buck = { family: { id: 'buck' }, vessel: { id: 'highball' }, lines: [L('rum-black-blended', 2), L('lime', 0.5), L('ginger-beer', 3)] };
  fires(mk({ ...buck, method: { method: 'shake', ice: 'cubed', steps: ['Shake everything with cubed ice hard for 10–12 seconds.', 'Strain into a highball over fresh cubed ice.'] } }), 'shaken-carbonation', 'fatal');
  quiet(mk({ ...buck, method: { method: 'shake', ice: 'cubed', steps: ['Shake everything except the ginger beer with cubed ice.', 'Strain into a highball over fresh cubed ice.', 'Top with the ginger beer and give one gentle lift with the spoon.'] } }), 'shaken-carbonation');
  quiet(mk({ ...buck, method: { method: 'build', ice: 'cubed' } }), 'shaken-carbonation');
  quiet(mk({ family: { id: 'grog' }, vessel: { id: 'dof' }, method: { method: 'shake', ice: 'ice-cone' }, lines: [L('rum-white-column', 1), L('rum-jamaican-dark', 1), L('rum-demerara', 1), L('lime', 0.75), L('grapefruit', 0.75), L('honey-syrup', 1), L('soda-water', 0.75)] }), 'shaken-carbonation');
  fires(mk({ family: { id: 'punch' }, vessel: { id: 'flute' }, method: { method: 'shake', ice: 'cubed' }, lines: [L('gin', 1), L('lemon', 0.5), L('simple-syrup', 0.5), L('sparkling-wine', 3)] }), 'sparkling-shaken', 'fatal');
});

test('vessel fit: stingy, crowded and overflowing; bowls count every guest', () => {
  fires(mk({ family: { id: 'resort-punch' }, vessel: { id: 'hurricane' }, method: { ice: 'crushed' }, lines: [L('rum-white-column', 1.5), L('lime', 0.75), L('simple-syrup', 0.75)] }), 'volume-stingy', 'major');
  fires(mk({ lines: [L('rum-white-column', 4), L('lime', 2), L('simple-syrup', 1.5)], method: { up: true } }), 'volume-overflow', 'fatal');
  const tall = { family: { id: 'punch' }, vessel: { id: 'dof' }, method: { ice: 'crushed' } };
  fires(mk({ ...tall, lines: [L('rum-jamaican-dark', 2), L('lime', 1), L('pineapple-juice', 4), L('simple-syrup', 0.5)] }), 'volume-crowded', 'major');
  fires(mk({ ...tall, lines: [L('rum-jamaican-dark', 2), L('lime', 1), L('pineapple-juice', 6), L('orange', 2), L('simple-syrup', 0.5)] }), 'volume-overflow', 'fatal');
  const bowl = { family: { id: 'orgeat-punch' }, vessel: { id: 'tiki-bowl' }, method: { ice: 'crushed' }, lines: [L('rum-white-column', 1.5), L('brandy', 0.5), L('lemon', 0.75), L('orgeat', 0.5), L('orange', 1)] };
  const four = lint(mk({ ...bowl, servings: 4 }));
  assert.equal(find(four, 'volume-stingy').length + find(four, 'volume-overflow').length + find(four, 'bowl-single').length, 0, show(four));
  const one = lint(mk({ ...bowl, servings: 1 }));
  assert.ok(find(one, 'volume-stingy', 'major').length && find(one, 'bowl-single', 'major').length, show(one));
});

test('dose caps, minimum doses and exclusive groups', () => {
  const sour = { family: { id: 'beachcomber-sour' }, vessel: { id: 'footed-pilsner' }, method: { method: 'shake', ice: 'crushed' } };
  const base = [L('rum-gold-column', 2), L('lime', 0.75), L('honey-syrup', 0.75)];
  fires(mk({ ...sour, lines: [...base, L('absinthe', 0.5)] }), 'anise-overdose', 'fatal');
  quiet(mk({ ...sour, lines: [...base, L('absinthe', 0.018, { unit: 'drop', amount: 6 })] }), 'anise-overdose');
  quiet(mk({ ...sour, lines: [...base, L('absinthe', 0.1, { unit: 'rinse' })] }), 'anise-overdose');
  fires(mk({ ...sour, lines: [...base, L('angostura', 0.24, { unit: 'dash', amount: 8 })] }), 'bitters-overdose', 'major');
  quiet(mk({ family: { id: 'swizzle' }, vessel: { id: 'collins' }, method: { method: 'swizzle', ice: 'crushed' }, lines: [...base, L('angostura', 0.24, { unit: 'dash', amount: 8 })] }), 'bitters-overdose');
  fires(mk({ family: { id: 'grog' }, vessel: { id: 'dof' }, method: { ice: 'crushed' }, lines: [L('rum-demerara', 2), L('lime', 0.75), L('grapefruit', 0.75), L('honey-syrup', 0.75), L('grenadine', 0.5)] }), 'grenadine-for-color', 'major');
  fires(mk({ ...sour, lines: [...base, L('pineapple-juice', 0.25)] }), 'micro-dose-bulk', 'minor');
  fires(mk({ ...sour, lines: [...base, L('orange-curacao', 0.25), L('triple-sec', 0.25)] }), 'two-orange-liqueurs', 'minor');
  fires(mk({ ...sour, lines: [L('rum-overproof-white', 0.75), L('rum-demerara-overproof', 0.75), L('lime', 0.75), L('honey-syrup', 0.75)] }), 'overproof-overdose', 'fatal');
  fires(mk({ lines: [L('rum-white-column', 2), L('lime', 0.5), L('lemon', 0.5), L('simple-syrup', 0.75)] }), 'lemon-and-lime', 'minor');
  quiet(mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, lines: [L('rum-jamaican-dark', 2), L('lime', 0.5), L('lemon', 0.5), L('simple-syrup', 0.75), L('soda-water', 2, { unit: 'top' })] }), 'lemon-and-lime');
});

test('incompatibilities: curdling dairy', () => {
  const nog = { family: { id: 'colada' }, vessel: { id: 'hurricane' }, method: { method: 'blend', ice: 'blended' } };
  fires(mk({ ...nog, lines: [L('rum-aged-column', 1.5), L('half-and-half', 2), L('lime', 0.5), L('simple-syrup', 0.5)] }), 'casein-plus-citrus', 'fatal');
  fires(mk({ ...nog, lines: [L('rum-aged-column', 1.5), L('heavy-cream', 1), L('lime', 1), L('simple-syrup', 0.5)] }), 'heavy-cream-plus-heavy-citrus', 'major');
  quiet(mk({ ...nog, lines: [L('rum-aged-column', 1.5), L('coconut-cream', 1.5), L('pineapple-juice', 3), L('lime', 0.5)] }), 'casein-plus-citrus');
});

test('method rules', () => {
  const stirred = { family: { id: 'stirred' }, vessel: { id: 'rocks' }, method: { method: 'stir', ice: 'block' } };
  fires(mk({ ...stirred, lines: [L('rum-aged-column', 2), L('lime', 0.75), L('demerara-syrup', 0.25)] }), 'stirred-with-juice', 'major');
  quiet(mk({ ...stirred, lines: [L('rum-aged-column', 2), L('velvet-falernum', 0.5), L('lime', 0.25), L('angostura', 0.06, { unit: 'dash', amount: 2 })] }), 'stirred-with-juice');
  fires(mk({ ...stirred, method: { method: 'stir', ice: 'crushed' }, lines: [L('rum-aged-column', 2), L('demerara-syrup', 0.25), L('angostura', 0.06)] }), 'stirred-on-crushed', 'major');
  const hot = { family: { id: 'hot' }, lines: [L('rum-jamaican-dark', 1.5), L('hot-buttered-rum-batter', 1), L('hot-water', 4)] };
  fires(mk({ ...hot, vessel: { id: 'hot-mug' }, method: { method: 'hot', ice: 'cubed' } }), 'hot-wrong', 'fatal');
  fires(mk({ ...hot, vessel: { id: 'coupe' }, method: { method: 'hot', ice: 'none' } }), 'hot-vessel-unsafe', 'major');
  const warm = lint(mk({ ...hot, vessel: { id: 'hot-mug' }, method: { method: 'hot', ice: 'none' }, garnish: ['grated nutmeg'] }));
  assert.equal(find(warm, 'hot-wrong').length + find(warm, 'hot-vessel-unsafe').length, 0, show(warm));
  const swz = { family: { id: 'swizzle' }, vessel: { id: 'collins' }, garnish: ['mint sprig', 'swizzle stick'], lines: [L('rum-demerara', 2), L('lime', 0.75), L('demerara-syrup', 0.5), L('angostura', 0.12)] };
  fires(mk({ ...swz, method: { method: 'shake', ice: 'cubed' } }), 'swizzle-not-swizzled', 'fatal');
  fires(mk({ ...swz, method: { method: 'flash-blend', ice: 'crushed' } }), 'swizzle-method-mismatch', 'major');
  const swizzled = lint(mk({ ...swz, method: { method: 'swizzle', ice: 'crushed' } }));
  assert.equal(find(swizzled, 'swizzle-not-swizzled').length + find(swizzled, 'swizzle-method-mismatch').length, 0, show(swizzled));
  fires(mk({ method: { method: 'flash-blend', ice: 'crushed' } }), 'flash-blend-up', 'major');
  quiet(mk({ method: { method: 'shake', ice: 'shaved' }, archetype: { id: 'beachcombers-gold', name: "Beachcomber's Gold" } }), 'flash-blend-up');
  const layered = { family: { id: 'resort-punch' }, vessel: { id: 'highball' }, method: { method: 'build', ice: 'cubed' }, tagline: 'A layered tequila sunrise with orange juice and a red glow at the bottom.' };
  fires(mk({ ...layered, lines: [L('tequila-blanco', 1.5), L('orange', 4), L('grenadine', 0.5)] }), 'layer-claim-shaken', 'major');
  quiet(mk({ ...layered, lines: [L('tequila-blanco', 1.5), L('orange', 4), L('grenadine', 0.5, { sink: true })] }), 'layer-claim-shaken');
  fires(mk({ ...layered, lines: [L('tequila-blanco', 1.5), L('orange', 4), L('banana-liqueur', 0.5, { float: true })] }), 'float-too-dense', 'major');
  quiet(mk({ ...layered, lines: [L('tequila-blanco', 1.5), L('orange', 4), L('rum-black-overproof', 0.5, { float: true })] }), 'float-too-dense');
  fires(mk({ ...layered, lines: [L('tequila-blanco', 1.5), L('orange', 4), L('rum-jamaican-dark', 0.5, { sink: true })] }), 'sink-too-light', 'major');
});

test('component counting', () => {
  const many = ['rum-jamaican-aged', 'rum-barbados', 'lime', 'grapefruit', 'honey-syrup', 'cinnamon-syrup', 'velvet-falernum', 'allspice-dram', 'maraschino', 'orgeat', 'passion-fruit-syrup', 'angostura'];
  fires(mk({ family: { id: 'beachcomber-sour' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, lines: many.map((id, i) => L(id, i < 2 ? 1 : 0.5)) }), 'too-many-cooks', 'major');
  fires(mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, lines: [L('rum-jamaican-dark', 2), L('lime', 1), L('pineapple-juice', 2), L('orgeat', 0.25), L('cinnamon-syrup', 0.25), L('maraschino', 0.25), L('velvet-falernum', 0.25)] }), 'quarter-ounce-soup', 'major');
});

test('strength: overproof, total spirit, ABV windows and style overrides', () => {
  const zombie = { family: { id: 'zombie' }, archetype: { id: 'zombie', name: 'Zombie' }, vessel: { id: 'chimney' }, method: { method: 'flash-blend', ice: 'crushed' }, garnish: ['mint sprig'] };
  fires(mk({ ...zombie, lines: [L('rum-gold-column', 1.5), L('rum-demerara-overproof', 1.5), L('lime', 0.75), L('dons-mix', 0.5), L('velvet-falernum', 0.5)] }), 'overproof-overdose', 'fatal');
  fires(mk({ ...zombie, lines: [L('rum-gold-column', 2), L('rum-jamaican-aged', 2), L('rum-demerara-overproof', 1), L('lime', 1), L('dons-mix', 0.75), L('velvet-falernum', 0.5)] }), 'overproof-overdose', 'fatal');
  // A 15% drink for a "low abv for brunch" prayer misses the brief; zero-proof with rum is a lie.
  const brunch = mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, prompt: 'low abv for brunch', lines: [L('rum-jamaican-dark', 2), L('lime', 0.75), L('simple-syrup', 0.75), L('soda-water', 1, { unit: 'top' })] });
  fires(brunch, 'abv-out-of-band', 'major');
  fires(mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'crushed' }, style: { zeroProof: true }, lines: [L('rum-white-column', 1), L('lime', 0.75), L('pineapple-juice', 3), L('simple-syrup', 0.5)] }), 'zero-proof-has-alcohol', 'fatal');
});

test('garnish: excluded fruit, lying fruit, up service, required aroma', () => {
  const punch = { family: { id: 'beachcomber-sour' }, vessel: { id: 'footed-pilsner' }, method: { ice: 'crushed' }, lines: [L('rum-gold-column', 2), L('lime', 0.75), L('honey-syrup', 0.75), L('grapefruit', 0.5)] };
  fires(mk({ ...punch, prompt: 'no coconut, no pineapple', garnish: ['pineapple wedge and fronds'] }), 'garnish-excluded-ingredient', 'fatal');
  fires(mk({ ...punch, garnish: ['pineapple wedge'] }), 'garnish-excluded-ingredient', 'fatal', { intent: { raw: 'rum sour', avoidIngs: new Set(['pineapple-juice']), avoidTags: { pineapple: 1 } } });
  quiet(mk({ ...punch, garnish: ['pineapple wedge'] }), 'garnish-contradicts-recipe'); // the conventional flag in a Beachcomber sour
  fires(mk({ garnish: ['strawberry'] }), 'garnish-contradicts-recipe', 'major');
  quiet(mk({ garnish: ['lime wheel'] }), 'garnish-contradicts-recipe');
  fires(mk({ garnish: ['mint bouquet'] }), 'garnish-heavy-on-up', 'major');
  fires(mk({ garnish: ['lime wheel'], method: { up: true, steps: ['Double-strain into a chilled coupe.', 'Serve with a long straw.'] } }), 'garnish-heavy-on-up', 'major');
  const maiTai = { name: 'Mai Tai', family: { id: 'mai-tai' }, archetype: { id: 'mai-tai', name: 'Mai Tai' }, vessel: { id: 'dof' }, method: { ice: 'crushed' }, lines: [L('rum-jamaican-aged', 2), L('lime', 1), L('orange-curacao', 0.5), L('orgeat', 0.5)] };
  fires(mk({ ...maiTai, garnish: ['orchid'] }), 'garnish-missing-aroma', 'major');
  quiet(mk({ ...maiTai, garnish: ['spent lime half-shell', 'mint sprig'] }), 'garnish-missing-aroma');
});

test('copy: banned phrases and names, repeats, strength, colour, cream and fruit words', () => {
  fires(mk({ tagline: 'An explosion of flavor: white rum, lime and sugar, shaken hard and served very cold.' }), 'cliche-copy', 'minor');
  fires(mk({ method: { steps: ['Shake the rum with 1 oz of sour mix and cubed ice.'] } }), 'sour-mix', 'fatal');
  quiet(mk({ explanation: { tasting: 'Lime up front. Sweet and sour in balance.' } }), 'sour-mix');
  fires(mk({ name: "Pele's Revenge" }), 'sacred-or-offensive', 'major');
  fires(mk({ name: 'Kū Cup' }), 'sacred-or-offensive', 'major');
  quiet(mk({ name: 'Kuala Lumpur Sour' }), 'sacred-or-offensive');
  fires(mk({ tagline: 'A tropical tropical sour with lime and sugar, shaken and served up.' }), 'adjective-soup', 'major');
  fires(mk({ tagline: 'An easygoing white rum sour with lime and sugar, shaken hard and served cold.', lines: [L('rum-overproof-white', 1.5), L('rum-white-column', 1), L('lime', 1), L('simple-syrup', 0.75)] }), 'strength-word-lie', 'major');
  const amber = { body: { hex: '#c27d4e', opacity: 0.1 }, layers: [], description: 'Burnished amber' };
  fires(mk({ name: 'Blue Lagoon Sour', look: amber }), 'color-name-lie', 'major');
  quiet(mk({ name: 'Golden Lagoon Sour', look: amber }), 'color-name-lie');
  fires(mk({ tagline: 'A creamy white rum sour with lime and sugar, shaken hard and served cold.' }), 'creamy-without-cream', 'major');
  fires(mk({ name: 'Mango Squall' }), 'fruit-named-absent', 'fatal');
  quiet(mk({ name: 'Mango Squall', lines: [L('rum-white-column', 2), L('lime', 1), L('mango-nectar', 1), L('simple-syrup', 0.5)] }), 'fruit-named-absent');
  fires(mk({ prompt: 'coffee and rum, stirred' }), 'fruit-named-absent', 'fatal');
  quiet(mk({ prompt: 'no coffee, just rum' }), 'fruit-named-absent');
  fires(mk({ name: 'Banana-Leaf Sour', lines: [L('rum-jamaican-aged', 2), L('lime', 1), L('simple-syrup', 0.75)] }), 'phantom-flavor', 'major');
});

test('steps agree with the service', () => {
  fires(mk({ family: { id: 'punch' }, vessel: { id: 'collins' }, method: { ice: 'cubed', steps: ['Shake everything with cubed ice.', 'Strain into a collins glass over crushed ice.'] }, lines: [L('rum-jamaican-dark', 2), L('lime', 1), L('pineapple-juice', 2), L('simple-syrup', 0.5)] }), 'steps-ice-mismatch', 'major');
  quiet(mk({ family: { id: 'grog' }, vessel: { id: 'dof' }, method: { method: 'shake', ice: 'ice-cone', steps: ['Shake everything with about 12 oz of crushed ice for 8–10 seconds.', 'Strain into a double old fashioned over an ice cone (shaved ice packed around a chopstick), or over one large cube if you have no cone.'] } }), 'steps-ice-mismatch');
  fires(mk({ method: { method: 'shake', ice: 'cubed', up: true, steps: ['Shake everything with cubed ice.', 'Open-pour, ice and all, into a coupe.'] } }), 'open-pour-up', 'major');
});

// ---------- real drinks ----------
const engine = createEngine({ vocab, families: read('data/families.json'), drinks, model: read('data/model.json'), vessels, archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'), rules: read('data/technique-rules.json') });
const vById = Object.fromEntries(vessels.vessels.map(v => [v.id, v]));
const AROMA = { mint: 'mint sprig', nutmeg: 'freshly grated nutmeg', cinnamon: 'cinnamon stick' };
const CLASSICS = ['zombie', 'mai tai', 'painkiller', 'navy grog'];
// A catalogued drink served as written, the way the engine pours a bare classic name: its own
// lines, method, ice, vessel and garnish, credited in the tagline.
function servedAsWritten(d) {
  const A = engine.archetypeForDrink(d);
  const n = d.servings || 1;
  const all = d.ingredients.filter(l => ingMap.has(l.id)).map(l => {
    const ing = ingMap.get(l.id);
    const garnish = !!l.garnish || ing.role === 'aromatic';
    return { id: l.id, name: ing.name, role: garnish ? 'aromatic' : ing.role, oz: lineOz(l, ing, vocab.units) / n, amount: l.amount, unit: l.unit, float: !!l.float, sink: !!l.sink, garnish };
  });
  const lines = all.filter(l => !l.garnish);
  const chem = analyzeLines(d.ingredients.filter(l => ingMap.has(l.id) && !l.garnish && ingMap.get(l.id).role !== 'aromatic'), ingMap, vocab.units, { method: d.method, ice: d.ice, servings: n });
  const garnish = [...(d.garnish || [])];
  for (const l of all.filter(x => x.garnish)) if (AROMA[l.id] && !garnish.some(g => g.toLowerCase().includes(l.id))) garnish.push(AROMA[l.id]);
  const v = vById[d.vessel];
  const credit = [d.creator, d.venue].filter(Boolean).join(', ') + (d.year ? `, ${d.circa ? 'c. ' : ''}${d.year}` : '');
  return {
    name: d.name, classic: { id: d.id, name: d.name }, prompt: d.name.toLowerCase(), riffOf: null, servings: 1, style: {},
    tagline: `The ${d.name} (${credit}), poured as written. Pray again and the gods will riff on it.`,
    archetype: A ? { id: A.id, name: A.name } : { id: null, name: d.name }, family: { id: d.family },
    lines, garnish, vessel: { id: v.id, name: v.name },
    method: { method: d.method, ice: d.ice, glass: v.name, vessel: v.id, up: v.serve.includes('up') && ['cubed', 'none'].includes(d.ice), steps: [] },
    look: drinkLook(lines, ingMap, { method: d.method, ice: d.ice, dilutionOz: Math.max(0, chem.finalOz - chem.volOz) }),
    stats: { abv: chem.abv, sugarConc: chem.sugarConc, acidConc: chem.acidConc, sweetSour: chem.sweetSour, volOz: chem.volOz, finalOz: chem.finalOz },
  };
}

test('the canonical Zombie, Mai Tai, Painkiller and Navy Grog, as catalogued, have no fatal findings', () => {
  for (const p of CLASSICS) {
    const id = engine.parse(p).riffOf;
    const d = drinks.find(x => x.id === id);
    assert.ok(d, `"${p}" names a catalogued classic`);
    const fs = lint(servedAsWritten(d), { intent: engine.parse(p) });
    assert.deepEqual(fs.filter(f => f.sev === 'fatal' || f.id === 'linter-error'), [], `${d.id}:\n${show(fs)}`);
  }
});

test('the engine pours the four classics as written (seed 0) and they lint without a fatal', async t => {
  for (const p of CLASSICS) {
    await t.test(p, st => {
      const r = engine.generate(p, { seed: 0 });
      if (!r.classic) return st.skip('this engine riffs on a bare classic name instead of pouring it as written');
      const fs = lint(r, { intent: engine.parse(p) });
      assert.deepEqual(fs.filter(f => f.sev === 'fatal' || f.id === 'linter-error'), [], `${r.name}:\n${show(fs)}`);
    });
  }
});

test('every engine drink lints without the linter itself failing', () => {
  for (const p of ['zombie', 'something blue for the pool', 'hot buttered rum for a snowy night', 'scorpion bowl for 4', 'zero-proof for the designated driver', 'coffee and rum, stirred', 'layered and pretty, like a sunrise']) {
    for (const seed of [0, 1]) {
      const fs = lint(engine.generate(p, { seed }), { intent: engine.parse(p) });
      assert.equal(find(fs, 'linter-error').length, 0, `${p} #${seed}:\n${show(fs)}`);
      for (const f of fs) assert.ok(['fatal', 'major', 'minor'].includes(f.sev) && f.msg.length > 10, `${p}: ${JSON.stringify(f)}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// The canon contract, identity cores, chronology and battery-level divergence (round-2 critique:
// canon lane). One run of the review battery at two seeds serves every test below.
const archData = read('data/archetypes.json').archetypes;
const battery = read('scripts/review/battery.json').prompts.flatMap(p => [0, 1].map(seed => ({ p, seed, r: engine.generate(p, { seed }) })));
const bottles = r => new Set(r.lines.filter(l => !l.garnish).map(l => l.id));
const jac = (a, b) => { const i = [...a].filter(x => b.has(x)).length; return i / (a.size + b.size - i || 1); };
const tagOf = ({ p, seed, r }) => `"${p}" [${seed}] ${r.name}`;
const whyText = r => r.explanation.whyItWorks.join(' ');

test('canon contract: three states, each in its own words', () => {
  for (const x of battery) {
    const { r } = x, cn = r.canon, built = r.explanation.reading.builtOn.text;
    assert.ok(['as-written', 'house-riff', 'cousin'].includes(cn.state), `${tagOf(x)}: ${cn.state}`);
    assert.ok(r.check.canon && r.check.canon.state === cn.state, `${tagOf(x)}: recipe.check carries the canon state`);
    // No stamp a drink doesn't earn: the old stamps are retired, and "as written" is said only of
    // a drink that is the edition (no move, no dose, no service change the prayer didn't fix).
    assert.ok(!/as the gods pour it|poured as the canon has it/.test(`${built} ${whyText(r)} ${r.tagline}`), `${tagOf(x)}: retired stamp in "${built}"`);
    if (/poured as written/.test(built)) assert.equal(cn.state, 'as-written', `${tagOf(x)}: "${built}"`);
    if (cn.state === 'as-written') {
      assert.ok(!r.explanation.reading.moves.some(m => /twist/.test(m)), `${tagOf(x)}: a twist removes the canon stamp`);
      assert.deepEqual(cn.service, [], `${tagOf(x)}: served against its edition: ${cn.service.join('; ')}`);
      assert.ok(!/\briff\b/.test(built), `${tagOf(x)}: "riff" on a drink that moved nothing`);
    }
    // A cousin names no spec, only the family; and no drink is "built on" a spec below 0.4.
    if (cn.state === 'cousin') assert.ok(!built.includes(`the ${r.reference.name} (`) && /a cousin of /.test(built), `${tagOf(x)}: "${built}"`);
    if (r.reference.similarity < 0.4) assert.equal(cn.state, 'cousin', `${tagOf(x)}: built on ${r.reference.name} at ${r.reference.similarity}`);
    assert.ok(!/\bframe\b/.test(built), `${tagOf(x)}: engine word "frame" in "${built}"`);
  }
});

test('canon contract: a method, ice or vessel change is listed in words, and a dish is never stamped', () => {
  const pool = new Map(archData.flatMap(a => a.canonicalSpecs.map(sp => [`${a.id}:${sp.name}`, sp])));
  const CLASS = { shake: 's', 'flash-blend': 's', blend: 'b', stir: 't', build: 'u', 'muddle-build': 'u', swizzle: 'w', hot: 'h' };
  for (const x of battery) {
    const { r } = x, sp = pool.get(r.reference.id);
    if (!sp || r.canon.state !== 'house-riff' || (r.servings || 1) > 1) continue;
    if (CLASS[sp.method] && CLASS[r.method.method] && CLASS[sp.method] !== CLASS[r.method.method]) assert.ok(r.canon.changes.some(c => /instead of/.test(c)), `${tagOf(x)}: ${r.method.method} vs ${sp.method} unlisted`);
  }
  const foster = engine.generate('bananas foster in a glass', { seed: 0 });
  assert.notEqual(foster.canon.state, 'as-written', 'a prayer that names a dish is never answered with a stamped classic');
});

test('canon contract: a shaken, served-up build is never recognized as a frappé (No. 4) or any edition served otherwise', () => {
  for (const x of battery) if (x.r.classic && x.r.classic.recognized) assert.equal(x.r.canon.state, 'as-written', tagOf(x));
});

test('identity cores: a classic keeps what makes it itself, or is not called it', () => {
  const OVER = ['rum-demerara-overproof', 'rum-overproof-white', 'rum-black-overproof'];
  const has = (r, ...ids) => r.lines.some(l => ids.includes(l.id) && !l.garnish);
  const strongest = engine.generate('the strongest drink you dare', { seed: 0 });
  for (const x of [...battery, { p: 'the strongest drink you dare', seed: 0, r: strongest }, { p: 'a tortuga', seed: 0, r: engine.generate('a tortuga', { seed: 0 }) }]) {
    const { r } = x, ref = r.reference.name;
    if (ref === 'Tortuga') assert.ok(r.lines.filter(l => OVER.includes(l.id)).length >= 2, `${tagOf(x)}: a Tortuga without both overproofs`);
    if (ref === 'Lava Flow') assert.ok(has(r, 'strawberry'), `${tagOf(x)}: a Lava Flow without its strawberry`);
    if (ref === 'Jungle Bird') assert.ok(has(r, 'pineapple-juice'), `${tagOf(x)}: a Jungle Bird without pineapple`);
    if (/Navy Grog/.test(ref)) assert.ok(has(r, 'honey-syrup', 'allspice-dram', 'pimento-syrup'), `${tagOf(x)}: a Navy Grog with no honey or allspice`);
    assert.ok(!/Tortuga[^.]*without its [^.]*overproof/.test(whyText(r)), `${tagOf(x)}: ${whyText(r)}`);
  }
  if (strongest.archetype.id === 'tortuga') assert.ok(strongest.stats.standardDrinks >= 3.2, `the strongest drink is ${strongest.stats.standardDrinks} sd`);
  // The named drink without its core is named for what it became, and the card says so.
  const jb = engine.generate('a jungle bird with orgeat instead of pineapple', { seed: 0 });
  if (!jb.lines.some(l => l.id === 'pineapple-juice')) assert.notEqual(jb.reference.name, 'Jungle Bird', 'a Jungle Bird with no pineapple is anchored to another drink');
});

test('chronology: a family tree runs back only to an older drink, and the origins are right', () => {
  const byName = new Map();
  for (const a of archData) for (const [nm, o] of Object.entries(a.origins || {})) if (!byName.has(nm)) byName.set(nm, o);
  for (const x of battery) {
    const m = whyText(x.r).match(/The family tree runs back to the (.+?) \(/);
    if (!m) continue;
    const anc = byName.get(m[1]), mine = x.r.reference.year;
    assert.ok(anc && anc.year, `${tagOf(x)}: an undated root ${m[1]}`);
    if (mine && x.r.canon.state !== 'cousin') assert.ok(anc.year < mine, `${tagOf(x)}: runs back to ${m[1]} (${anc.year}) from a drink of ${mine}`);
  }
  const A = id => archData.find(a => a.id === id);
  assert.equal(A('bitters-base-sour').origin.drink, 'Trinidad Especial');
  assert.ok(A('bitters-base-sour').origin.year < A('bitters-base-sour').origins['Trinidad Sour'].year, 'the Especial (2008) is older than the Trinidad Sour (2009)');
  assert.match(A('fruit-daiquiri').origin.text, /Floridita, Havana, 1930s/);
  assert.match(A('tropical-stirred').origins.Bombo.text, /bumbo/);
  assert.match(A('hot-grog').origin.text, /winter descendant of Admiral Vernon's 1740 grog/);
  assert.equal(A('hot-grog').origin.year, null);
  assert.match(A('scorpion').origin.text, /1946 as a punch for twelve/);
  assert.match(A('scorpion').canonicalSpecs.find(sp => sp.name === 'Scorpion (individual)').edition, /1972/);
  // Don's peach is peach brandy on the card.
  const md = engine.generate("missionary's downfall", { seed: 0 });
  assert.ok(md.lines.some(l => l.name === 'Peach brandy'), md.lines.map(l => l.name).join(', '));
});

test('battery divergence: praying again is a new idea, never the same drink a line off', () => {
  for (let i = 0; i < battery.length; i += 2) {
    const a = battery[i], b = battery[i + 1];
    // A drink the guest named keeps its name (under 70% shared); a frame the prayer's own reading
    // names and promises bottles for (the promotion's Mai Tai with its float and bubbles) can only
    // move so far without breaking those promises (under 80%); any other prayer, under 60%.
    const named = engine.namesFrame(a.p, a.r.archetype.id) && (a.r.riffOf || (a.r.classic && !a.r.classic.recognized));
    const promised = engine.namesFrame(a.p, a.r.archetype.id) && engine.namesFrame(a.p, b.r.archetype.id);
    const j = jac(bottles(a.r), bottles(b.r));
    assert.ok(j < (named ? 0.7 : promised ? 0.8 : 0.6), `"${a.p}": seed 1 shares ${Math.round(j * 100)}% of seed 0's bottles (${a.r.name} / ${b.r.name})`);
    const moved = a.r.archetype.id !== b.r.archetype.id || a.r.method.method !== b.r.method.method || (a.r.vessel || {}).id !== (b.r.vessel || {}).id || a.r.reference.id !== b.r.reference.id
      || [...bottles(b.r)].some(id => !bottles(a.r).has(id));
    assert.ok(moved, `"${a.p}": seed 1 changes nothing structural`);
  }
});

test('battery divergence: no two prayers pour the same set of bottles, and canonical titles never repeat', t => {
  let max = 0, worst = '';
  const near = [];
  for (let i = 0; i < battery.length; i++) for (let k = i + 1; k < battery.length; k++) {
    if (battery[i].p === battery[k].p) continue;
    const j = jac(bottles(battery[i].r), bottles(battery[k].r));
    if (j > max) { max = j; worst = `${tagOf(battery[i])} = ${tagOf(battery[k])}`; }
    if (j >= 0.8) near.push(`${j.toFixed(2)} ${tagOf(battery[i])} = ${tagOf(battery[k])}`);
  }
  t.diagnostic(`max cross-prayer ingredient-set Jaccard ${max.toFixed(2)}; pairs at 0.8 or more: ${near.length}`);
  assert.ok(max < 0.9, `two prayers pour nearly the same drink (${max.toFixed(2)}): ${worst}`);
  const titles = new Map();
  for (const x of battery) if (x.r.classic) {
    assert.ok(!titles.has(x.r.name) || titles.get(x.r.name) === x.p, `"${x.r.name}" titled twice: ${titles.get(x.r.name)} and ${x.p}`);
    titles.set(x.r.name, x.p);
  }
});

test('battery divergence: no frame poured more than three times unless the prayers name it', () => {
  const n = {};
  for (const x of battery) if (!engine.namesFrame(x.p, x.r.archetype.id)) (n[x.r.archetype.id] = n[x.r.archetype.id] || []).push(tagOf(x));
  for (const [id, xs] of Object.entries(n)) assert.ok(xs.length <= 3, `${id} poured ${xs.length} times unasked: ${xs.join('; ')}`);
});

test('twists serve the heard word: "X but Y" again answers Y another way, and no variation weakens a heard promise', () => {
  const s0 = engine.generate('a mai tai but tropical', { seed: 0 }), s1 = engine.generate('a mai tai but tropical', { seed: 1 });
  const src = new Set(drinks.find(d => d.id === engine.parse('a mai tai but tropical').riffOf).ingredients.map(l => l.id));
  const change = r => [...bottles(r)].filter(id => !src.has(id) && (ingMap.get(id) || {}).role !== 'base');
  assert.ok(change(s1).length && !change(s1).some(id => change(s0).includes(id)), `seed 1 answers "tropical" with ${change(s1)} after ${change(s0)}`);
  assert.ok(!/rest of the prayer steered/.test(JSON.stringify(s1.explanation.reading.heard)), 'the heard word is answered');
  for (const seed of [0, 1, 2]) {
    const r = engine.generate('bitter and refreshing', { seed });
    assert.ok(!r.explanation.reading.moves.some(m => /aperol in place of campari/i.test(m)), `"bitter" never trades Campari for Aperol: ${r.explanation.reading.moves}`);
  }
});
