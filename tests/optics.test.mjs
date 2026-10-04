// Drink color is computed from the ingredients and must match how classic drinks really look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexIngredients, analyzeLines, lineOz } from '../web/lib/chem.js';
import { drinkLook, hexToRgb, showsColor, hsl, colorWord } from '../web/lib/optics.js';

const j = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const vocab = j('data/ingredients.json');
const ingMap = indexIngredients(vocab);
const drinks = j('data/drinks.json');
const refs = j('data/color-references.json').references;
const dist = (a, b) => { const x = hexToRgb(a), y = hexToRgb(b); return Math.sqrt(x.reduce((s, v, i) => s + [0.3, 0.59, 0.11][i] * (v - y[i]) ** 2, 0)); };

function lookOf(d) {
  const lines = d.ingredients.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, oz: lineOz(l, ingMap.get(l.id), vocab.units) / (d.servings || 1), float: !!l.float, sink: !!l.sink, garnish: !!l.garnish, role: ingMap.get(l.id).role }));
  const c = analyzeLines(d.ingredients, ingMap, vocab.units, { method: d.method, ice: d.ice, servings: d.servings || 1 });
  return drinkLook(lines, ingMap, { method: d.method, ice: d.ice, dilutionOz: c.finalOz - c.volOz, vessel: d.vessel });
}

test('every ingredient has researched optics', () => {
  for (const i of vocab.ingredients) {
    assert.ok(i.optics && /^#[0-9a-f]{6}$/i.test(i.optics.hex), `${i.id} has no color`);
    assert.ok(typeof i.optics.tint === 'number' && typeof i.optics.scatter === 'number' && typeof i.optics.sg === 'number', `${i.id} optics incomplete`);
  }
});

test('classic drinks come out the color they really are', () => {
  const rows = [];
  for (const r of refs) {
    const id = (/catalogue:\s*([\w-]+)/.exec(r.spec || '') || [])[1];
    const d = id && drinks.find(x => x.id === id);
    if (!d) continue;
    const look = lookOf(d);
    // Layered drinks are judged band by band: the body against the nearest reference band.
    rows.push({ name: r.drink, d: Math.min(...r.hexes.map(h => dist(look.body.hex, h))) });
  }
  assert.ok(rows.length >= 20, `only ${rows.length} references matched the catalogue`);
  const mean = rows.reduce((s, r) => s + r.d, 0) / rows.length;
  const worst = rows.sort((a, b) => b.d - a.d)[0];
  assert.ok(mean <= 12, `mean color error ${mean.toFixed(1)} over ${rows.length} classics`);
  assert.ok(worst.d <= 60, `${worst.name} is off by ${worst.d.toFixed(0)}`);
});

test('a colada is creamy, a Blue Hawaii is not navy, a grenadine sink is red', () => {
  const by = n => drinks.find(d => d.name === n);
  const colada = lookOf(by('Piña Colada'));
  assert.ok(colada.body.opacity > 0.8, `colada opacity ${colada.body.opacity}`);
  const sunrise = drinks.find(d => d.ingredients.some(l => l.id === 'grenadine' && l.sink));
  if (sunrise) assert.ok(lookOf(sunrise).layers.some(x => x.kind === 'sink' && showsColor({ body: { hex: x.hex, opacity: 0 } }, 'red')), `${sunrise.name}: sink not red`);
});

test('warm drinks get warm words: milky browns only for creamy drinks, dark browns only for dark ones', () => {
  const CREAMERS = ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream', 'egg-white', 'banana', 'whole-milk', 'hot-buttered-rum-batter', 'tom-and-jerry-batter'];
  const milky = /^(creamy |opaque |cloudy )?(café au lait|tan|mocha|cream|ivory)\b/i;
  const darkWord = /^(creamy |opaque |cloudy )?(mahogany|dark brown|molasses|near-black)\b/i;
  const words = new Set();
  for (const d of drinks) {
    const look = lookOf(d);
    const body = look.description.split(' with ')[0].split(' under ')[0];
    words.add(body.toLowerCase().replace(/^(creamy|opaque|cloudy|hazy) /, ''));
    if (milky.test(body)) assert.ok(d.ingredients.some(l => CREAMERS.includes(l.id)), `${d.name}: "${body}" but nothing creamy in it`);
    if (darkWord.test(body)) assert.ok(hsl(look.body.hex).l < 0.4, `${d.name}: "${body}" for ${look.body.hex}`);
  }
  // The catalogue reads in more than a handful of browns.
  for (const w of ['honeyed amber', 'copper', 'coral', 'ruby', 'garnet', 'rose gold']) assert.ok(words.has(w), `no catalogued drink reads "${w}"`);
});

test('color words sit on the right hue', () => {
  const near = (hex, lo, hi) => { const h = hsl(hex).h; return h !== null && (lo < hi ? h >= lo && h < hi : h >= lo || h < hi); };
  const cases = { tangerine: [18, 40], 'flame orange': [10, 30], 'mango gold': [30, 46], 'mango-gold': [30, 50], 'campari red': [340, 12], oxblood: [0, 20], 'passion-fruit gold': [34, 50], 'hibiscus pink': [315, 2], 'rose gold': [0, 30], copper: [5, 36], ruby: [330, 12] };
  for (const d of drinks) {
    const look = lookOf(d);
    const w = look.description.split(' with ')[0].split(' under ')[0].toLowerCase().replace(/^(creamy|opaque|cloudy|hazy) /, '');
    if (cases[w]) assert.ok(near(look.body.hex, ...cases[w]), `${d.name}: "${w}" for ${look.body.hex} (hue ${hsl(look.body.hex).h})`);
  }
});

test('the words say what the glass is: café-au-lait Painkiller, ivory coconut, mocha Bushwacker, a faintly lime daiquiri', () => {
  const word = id => { const d = drinks.find(x => x.id === id); return lookOf(d).description.split(' with ')[0].toLowerCase(); };
  // A Painkiller is a creamy orange-tan colada, never a fruit it doesn't have.
  assert.match(word('painkiller-pussers'), /^creamy (café au lait|orange-tan|tan)$/);
  // Cream of coconut over lime (the engine's Coconut Daiquiri) is ivory, not an empty clear body.
  const coco = drinkLook([['rum-white-column', 2], ['lime', 1], ['coconut-cream', 1]].map(([id, oz]) => ({ id, oz, role: ingMap.get(id).role })), ingMap, { method: 'shake', dilutionOz: 1.2 });
  assert.match(coco.description.toLowerCase(), /^creamy ivory$/);
  assert.ok(hsl(coco.body.hex).h !== null, `coconut daiquiri ${coco.body.hex} has no hue`);
  assert.match(word('bushwacker'), /^creamy (mocha|café au lait)$/);
  // Fresh lime leaves a daiquiri faintly green-gold, not an empty clear body.
  const dq = lookOf(drinks.find(x => x.id === 'daiquiri'));
  const h = hsl(dq.body.hex);
  assert.ok(h.h !== null && h.h >= 55 && h.h <= 80 && h.s >= 0.3, `daiquiri body ${dq.body.hex}`);
  assert.match(dq.description.toLowerCase(), /lime|straw/);
  for (const d of drinks) {
    const look = lookOf(d), w = look.description.toLowerCase(), c = hsl(look.body.hex);
    if (/^(creamy |opaque |cloudy )?seafoam/.test(w)) assert.ok(c.s >= 0.35 && c.l >= 0.7, `${d.name}: seafoam for ${look.body.hex}`);
    if (/apricot/.test(w.split(' with ')[0])) assert.ok(!/^creamy/.test(w), `${d.name}: "${w}"`);
  }
});

test('butterfly pea turns violet with citrus and pink in a sour; a Blue Lagoon stays sky blue', () => {
  const look = spec => drinkLook(spec.map(([id, oz]) => ({ id, oz, role: ingMap.get(id).role })), ingMap, { method: 'shake', dilutionOz: 1 });
  const sour = hsl(look([['gin', 2], ['lemon', 0.75], ['simple-syrup', 0.5], ['butterfly-pea-tea', 1]]).body.hex);
  assert.ok(sour.h >= 290 && sour.h < 345, `butterfly pea sour at hue ${sour.h}`);
  const neat = hsl(look([['gin', 2], ['butterfly-pea-tea', 1], ['soda-water', 3]]).body.hex);
  assert.ok(neat.h >= 200 && neat.h < 250, `butterfly pea and soda at hue ${neat.h}`);
  const lagoon = hsl(look([['vodka', 1.5], ['blue-curacao', 1], ['lemon', 0.5], ['lemon-lime-soda', 4]]).body.hex);
  assert.ok(lagoon.h >= 195 && lagoon.h <= 215 && lagoon.s >= 0.6, `Blue Lagoon at hue ${lagoon.h}`);
});

test('the bottle that colors the glass can name it: mango-gold colada, Campari red, a plum cassis sink, a sparkle', () => {
  const look = (spec, o) => drinkLook(spec.map(([id, oz, x]) => ({ id, oz, role: ingMap.get(id).role, ...(x || {}) })), ingMap, o);
  // Mango nectar in a colada is mango-gold, not tan.
  const riptide = look([['rum-white-column', 2], ['mango-nectar', 2], ['pineapple-juice', 2], ['banana', 1.75], ['coconut-rum', 1], ['coconut-cream', 1.75]], { method: 'blend', ice: 'blended', dilutionOz: 2 });
  assert.match(riptide.description, /^Creamy mango-gold$/);
  // An ounce of Campari over Demerara rum is a clear red (its dye is calibrated on the Jungle Bird).
  const swizzle = look([['rum-demerara', 1.75], ['lime', 1], ['simple-syrup', 0.5], ['campari', 1], ['angostura', 0.12, { crown: true }]], { method: 'swizzle', ice: 'crushed', dilutionOz: 1.5 });
  const h = hsl(swizzle.body.hex).h;
  assert.match(swizzle.description, /^Campari red\b/);
  assert.ok(h >= 345 || h < 8, `Campari swizzle at hue ${h}`);
  // Cassis sinks plum, not brick.
  const sunrise = look([['rum-gold-column', 1], ['lime', 0.25], ['orange', 4.5], ['creme-de-cassis', 0.5, { sink: true }], ['sparkling-wine', 2]], { method: 'build', ice: 'cubed', dilutionOz: 1 });
  const sink = sunrise.layers.find(x => x.kind === 'sink');
  assert.ok(sink && hsl(sink.hex).h >= 300 && hsl(sink.hex).h < 335, `cassis sink ${sink && sink.hex}`);
  assert.match(sunrise.description, /cassis settling deep plum/);
  // A Mai Tai under Champagne is no pale honey: it is a mid amber, and it sparkles.
  const lanai = look([['rum-agricole-vieux', 1.25], ['rum-aged-column', 1], ['lime', 1], ['orgeat', 0.333], ['rich-simple', 0.25], ['orange-curacao', 0.5], ['sparkling-wine', 2]], { method: 'shake', ice: 'crushed', dilutionOz: 1.5 });
  assert.match(lanai.description, /amber with a sparkle$/);
  assert.doesNotMatch(lanai.description, /pale honey/i);
});

test('dark drinks keep their hue; pineapple, Campari and fassionola name the glass they color', () => {
  const look = (spec, o) => drinkLook(spec.map(([id, oz, x]) => ({ id, oz, role: ingMap.get(id).role, ...(x || {}) })), ingMap, o);
  // Coffee liqueur stirred into aged rum is coffee brown, not claret: the dim floor that keeps a
  // dark drink liquid greys it at its own hue rather than lifting only the blue.
  const coffee = look([['rum-aged-column', 2], ['demerara-syrup', 0.167], ['coffee-liqueur', 0.5], ['angostura', 0.06]], { method: 'stir', ice: 'cubed', dilutionOz: 1.1 });
  const c = hsl(coffee.body.hex);
  assert.ok(c.h >= 18 && c.h <= 30 && c.s <= 0.5 && c.l < 0.3, `coffee and rum at ${coffee.body.hex}`);
  assert.match(coffee.description, /^Dark brown$/);
  // A Piña Colada that is mostly pineapple is butter-yellow; ivory is for cream alone.
  const colada = look([['rum-white-column', 2], ['pineapple-juice', 6], ['coconut-cream', 1.5], ['heavy-cream', 1]], { method: 'blend', ice: 'blended', dilutionOz: 2 });
  assert.match(colada.description, /^Creamy (butter-yellow|pineapple-cream)$/);
  const coconutSour = look([['rum-white-column', 2], ['lime', 1], ['coconut-cream', 1]], { method: 'shake', dilutionOz: 1 });
  assert.doesNotMatch(coconutSour.description, /butter|pineapple/);
  // A light pineapple sour is pineapple gold; honeyed amber is kept for a deep honey (L < 0.62).
  const sour = look([['rum-gold-column', 2], ['lime', 0.75], ['pineapple-juice', 2], ['rich-simple', 0.5], ['apricot-liqueur', 0.25]], { method: 'shake', ice: 'cubed', dilutionOz: 1.25 });
  assert.match(sour.description, /^Opaque pineapple gold with a pale froth$/);
  for (const hex of ['#eccd77', '#e0c188', '#ebba7c']) assert.ok(!/honeyed amber/.test(colorWord(hex, 0.5, { creamy: false })), `${hex} is too light for honeyed amber`);
  // Campari stirred with vermouth and rum deepens to garnet; with lime it stays Campari red.
  const stirred = look([['rum-jamaican-pot', 0.75], ['batavia-arrack', 0.75], ['li-hing-mui-syrup', 0.5], ['campari', 1], ['sweet-vermouth', 1]], { method: 'stir', ice: 'cubed', dilutionOz: 1 });
  assert.match(stirred.description, /^Deep Campari garnet$/);
  // Fassionola reddens a copper Zombie-style sour to rust-red (as the painting tilts it).
  const rust = look([['rum-demerara-overproof', 0.75], ['mezcal', 0.75], ['rum-jamaican-dark', 0.75], ['lime', 0.5], ['orange', 0.5], ['fassionola', 0.5], ['velvet-falernum', 0.25]], { method: 'shake', ice: 'crushed', dilutionOz: 1.5 });
  assert.match(rust.description, /^Cloudy rust-red$/);
});

test('the rum ambers are told apart by what is in them, not all called copper', () => {
  const look = (spec, o) => drinkLook(spec.map(([id, oz, x]) => ({ id, oz, role: ingMap.get(id).role, ...(x || {}) })), ingMap, o);
  const word = lk => lk.description.split(/ with | under /)[0].toLowerCase().replace(/^(creamy|opaque|cloudy|hazy) /, '');
  // A teaspoon of grenadine with Don's Mix leaves the 1934 Zombie a ruddy amber, still no red.
  const zombie = look([['rum-gold-column', 1.5], ['rum-jamaican-aged', 1.5], ['rum-demerara-overproof', 1], ['lime', 0.75], ['dons-mix', 0.5], ['grenadine', 1 / 6], ['velvet-falernum', 0.5], ['angostura', 0.03]], { method: 'flash-blend', ice: 'crushed', dilutionOz: 3 });
  assert.equal(word(zombie), 'ruddy amber');
  const zh = hsl(zombie.body.hex).h;
  assert.ok(zh >= 18 && zh < 32, `Zombie at hue ${zh}`);
  // A Navy Grog sweetened with honey is honeyed amber.
  const grog = look([['bourbon', 1], ['rum-jamaican-dark', 1], ['rum-demerara', 1], ['lime', 0.75], ['grapefruit', 0.75], ['honey-syrup', 1], ['soda-water', 1]], { method: 'shake', ice: 'ice-cone', dilutionOz: 2.5 });
  assert.equal(word(grog), 'honeyed amber');
  // Campari and four ounces of pineapple are coral (the Jungle Bird), however dark the rum.
  const bird = look([['rum-jamaican-dark', 0.75], ['mezcal', 0.75], ['lime', 0.5], ['pineapple-juice', 4], ['simple-syrup', 0.5], ['campari', 0.75]], { method: 'shake', ice: 'crushed', dilutionOz: 2.5 });
  assert.equal(word(bird), 'coral');
  // Passion fruit syrup over a little black tea is passion-fruit gold.
  const sandbar = look([['grapefruit', 0.75], ['lime', 0.75], ['passion-fruit-syrup', 1], ['falernum-syrup', 0.25], ['black-tea', 1], ['soda-water', 1]], { method: 'shake', ice: 'crushed', dilutionOz: 2 });
  assert.equal(word(sandbar), 'passion-fruit gold');
  // Banana lightens a Bushwacker's mocha to a banana café.
  const bush = look([['rum-barbados', 2], ['banana', 1.75], ['coffee-liqueur', 0.75], ['creme-de-cacao', 0.75], ['coconut-cream', 2.25], ['half-and-half', 2]], { method: 'blend', ice: 'blended', dilutionOz: 8 });
  assert.equal(word(bush), 'banana-café');
  // The new warm words sit on their hues.
  const cases = { tawny: [26, 38], russet: [14, 30], terracotta: [6, 20], 'blood-orange': [8, 20], 'orange-gold': [32, 44] };
  for (const [w, [lo, hi]] of Object.entries(cases)) for (const d of drinks) {
    const lk = lookOf(d);
    if (word(lk) !== w) continue;
    const h = hsl(lk.body.hex).h;
    assert.ok(h !== null && h >= lo && h < hi, `${d.name}: "${w}" for ${lk.body.hex} (hue ${h})`);
  }
  for (const hex of ['#f8ecc3', '#f6ebca']) assert.ok(!/tawny|russet|terracotta|blood-orange/.test(colorWord(hex, 1, { creamy: true })), `${hex} is a pale cream`);
});

// Round 2 (looks): vivid, truthful look hexes. A drink in a glass reads more colorful than the bare
// absorbance model predicts, and the references agree; pigments subtract, so a red juice under
// blue curaçao is a slate, not a pure blue; a mango colada is a deep mango gold; and a color word
// that names a fruit is only used when that fruit is in the glass.
test('looks are vivid and true: slate for watermelon under curaçao, deep mango gold, fruit words only with the fruit', () => {
  const look = (spec, o) => drinkLook(spec.map(([id, oz, x]) => ({ id, oz, role: ingMap.get(id).role, ...(x || {}) })), ingMap, o);
  const slate = look([['rum-white-column', 2], ['lime', 1.25], ['watermelon-juice', 1.5], ['rich-simple', 0.75], ['blue-curacao', 1]], { method: 'blend', ice: 'blended', dilutionOz: 5 });
  const cs = hsl(slate.body.hex);
  assert.ok(cs.h >= 195 && cs.h <= 250 && cs.s < 0.42, `watermelon under blue curaçao is ${slate.body.hex} (${slate.description}), not a slate`);
  assert.match(slate.description, /slate blue/);
  assert.ok(showsColor(slate, 'blue'), 'a slate-blue pool drink is no longer blue');
  const mango = look([['rum-white-column', 1.5], ['mango-nectar', 2], ['pineapple-juice', 2], ['coconut-cream', 2], ['heavy-cream', 0.75]], { method: 'blend', ice: 'blended', dilutionOz: 5 });
  const cm = hsl(mango.body.hex);
  assert.ok(cm.h >= 32 && cm.h <= 42 && cm.s >= 0.75 && cm.l <= 0.74, `a mango colada is ${mango.body.hex}, a pale cream`);
  assert.match(mango.description, /^Creamy mango[- ]gold/);
  // an orange-free amber is never "tangerine", an apricot-free one never "apricot"
  for (const d of drinks) {
    const L = lookOf(d), w = L.description.split(/ with | under /)[0].toLowerCase(), ids = d.ingredients.map(l => l.id).join(' ');
    if (/tangerine|blood-orange/.test(w)) assert.ok(/orange|tangerine|curacao|triple-sec/.test(ids), `${d.name}: "${w}" with no orange`);
    if (/apricot/.test(w)) assert.ok(/apricot/.test(ids), `${d.name}: "${w}" with no apricot`);
    if (/mango/.test(w)) assert.ok(/mango/.test(ids), `${d.name}: "${w}" with no mango`);
    if (/passion-fruit/.test(w)) assert.ok(/passion-fruit/.test(ids), `${d.name}: "${w}" with no passion fruit`);
  }
});
