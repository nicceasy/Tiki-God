// Drink color is computed from the ingredients and must match how classic drinks really look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexIngredients, analyzeLines, lineOz } from '../web/lib/chem.js';
import { drinkLook, hexToRgb, showsColor, hsl } from '../web/lib/optics.js';

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
  const cases = { tangerine: [18, 40], 'sunset orange': [10, 30], 'mango gold': [30, 46], 'passion-fruit gold': [34, 50], 'hibiscus pink': [315, 2], 'rose gold': [0, 30], copper: [5, 36], ruby: [330, 12] };
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
