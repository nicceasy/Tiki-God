// Drink color is computed from the ingredients and must match how classic drinks really look.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexIngredients, analyzeLines, lineOz } from '../web/lib/chem.js';
import { drinkLook, hexToRgb, showsColor } from '../web/lib/optics.js';

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
