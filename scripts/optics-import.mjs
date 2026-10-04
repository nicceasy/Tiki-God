#!/usr/bin/env node
// Import researched drink optics into data/ingredients.json (each ingredient's `optics`) and the
// calibration references into data/color-references.json.
//   node scripts/optics-import.mjs <color.json>
// Fields kept per ingredient: hex (color at drinking strength), tint (absorbance strength),
// scatter (cloudiness when mixed), opacity (cloudiness neat), sg (specific gravity), behavior
// (floats | sinks | clouds | foams | mixes), and layerHex for float and sink bands.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVocab, writeVocab } from './vocab-io.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const vocab = readVocab();
let n = 0;
const missing = [];
for (const ing of vocab.ingredients) {
  const o = src.ingredients[ing.id];
  if (!o) { missing.push(ing.id); continue; }
  const round = (x, d = 3) => typeof x === 'number' ? Math.round(x * 10 ** d) / 10 ** d : undefined;
  ing.optics = { hex: o.hex, tint: round(o.tint), scatter: round(o.scatter), opacity: round(o.opacity), sg: round(o.sg), behavior: o.behavior };
  if (o.layerHex && o.layerHex !== o.hex) ing.optics.layerHex = o.layerHex;
  n++;
}
writeVocab(vocab);
writeFileSync(join(root, 'data/color-references.json'), JSON.stringify({ about: 'Reference looks of classic drinks (expert estimates) used to calibrate web/lib/optics.js; hexes are top, middle, bottom.', model: src.model, references: src.referenceDrinks }, null, 1) + '\n');
console.log(`optics for ${n} ingredients${missing.length ? `; missing: ${missing.join(', ')}` : ''}; ${src.referenceDrinks.length} references`);
