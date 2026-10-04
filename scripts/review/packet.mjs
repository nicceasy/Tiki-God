#!/usr/bin/env node
// Writes a review packet: every battery prompt run through the generator, as JSON and as a
// readable markdown dossier. Used by the author/critic loop (see docs/expertise.md).
//   node scripts/review/packet.mjs <out-dir> [seeds=0,1]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../../web/lib/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const out = process.argv[2] || join(root, 'review-out');
const seeds = (process.argv[3] || '0,1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const engine = createEngine({ vocab: read('data/ingredients.json'), families: read('data/families.json'), drinks: read('data/drinks.json'), model: read('data/model.json'), vessels: read('data/vessels.json'), archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json') });
const { prompts } = read('scripts/review/battery.json');
const recs = [];
let md = '# Review packet\n';
for (const p of prompts) for (const seed of seeds) {
  const r = engine.generate(p, { seed });
  recs.push({ prompt: p, seed, recipe: r });
  md += `\n## "${p}" (seed ${seed}): ${r.name}\n*${r.tagline}*\n\n`;
  md += `- Family: ${r.family.name}${r.riffOf ? ` (riff on ${r.riffOf.name})` : ''}\n`;
  md += `- Vessel: ${r.vessel ? r.vessel.name : r.method.glass} · ${r.method.method}, ${r.method.ice} ice · serves ${r.servings}\n`;
  md += `- Stats: ${r.stats.abv}% ABV, sugar ${r.stats.sugarConc}, acid ${r.stats.acidConc} g/100 ml, ${r.stats.finalOz} oz finished\n`;
  md += `- Heard: ${r.heard.join(', ') || '(nothing)'}\n`;
  md += `- Recipe:\n${r.lines.map(l => `  - ${l.garnish ? 'garnish' : `${l.amount} ${l.unit}`} ${l.name}${l.float ? ' (float)' : ''}${l.sink ? ' (sink)' : ''}`).join('\n')}\n`;
  md += `- Garnish: ${r.garnish.join(', ')}\n`;
  md += `- Steps:\n${r.method.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n`;
  md += `- Tasting: ${r.explanation.tasting}\n`;
  if (r.explanation.prayer) md += `- Prayer reading: ${r.explanation.prayer.map(x => typeof x === 'string' ? x : `${x.phrase} → ${x.effect}`).join('; ')}\n`;
  if (r.look) md += `- Look: ${typeof r.look === 'string' ? r.look : JSON.stringify(r.look)}\n`;
  md += `- Why: ${r.explanation.whyItWorks.slice(0, 3).join(' / ')}\n`;
}
writeFileSync(join(out, 'packet.json'), JSON.stringify(recs, null, 1));
writeFileSync(join(out, 'packet.md'), md);
console.log(`${recs.length} recipes → ${out}/packet.{json,md}`);
