#!/usr/bin/env node
// Writes a review packet: every battery prompt run through the generator, as JSON and as a
// readable markdown dossier. Used by the author/critic loop (see docs/expertise.md).
//   node scripts/review/packet.mjs <out-dir> [seeds=0,1]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, amountString } from '../../web/lib/engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const out = process.argv[2] || join(root, 'review-out');
const seeds = (process.argv[3] || '0,1').split(',').map(Number);
mkdirSync(out, { recursive: true });
const engine = createEngine({ vocab: read('data/ingredients.json'), families: read('data/families.json'), drinks: read('data/drinks.json'), model: read('data/model.json'), vessels: read('data/vessels.json'), archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'), rules: read('data/technique-rules.json') });
const { prompts } = read('scripts/review/battery.json');
const recs = [];
let md = '# Review packet\n';
for (const p of prompts) for (const seed of seeds) {
  const r = engine.generate(p, { seed });
  recs.push({ prompt: p, seed, recipe: r });
  const rd = r.explanation.reading || {};
  md += `\n## "${p}" (seed ${seed}): ${r.name}${r.nickname ? ` (house name: ${r.nickname})` : ''}\n*${r.tagline}*\n\n`;
  md += `- Built on: ${rd.builtOn ? rd.builtOn.text : ''}${r.reference ? ` [reference ${r.reference.kind}: ${r.reference.name}, sameness ${r.reference.similarity}${r.reference.year ? `, ${r.reference.year}` : ''}]` : ''} · archetype ${r.archetype.id}${r.riffOf ? `; riff on ${r.riffOf.name}` : ''} · family ${r.family.name} · archetype check: ${r.check && r.check.ok ? 'ok' : JSON.stringify(r.check)}\n`;
  md += `- Vessel: ${r.vessel ? r.vessel.name : r.method.glass} · ${r.method.method}, ${r.method.ice} ice · serves ${r.servings}\n`;
  md += `- Stats: ${r.stats.abv}% ABV (${r.stats.standardDrinks} std drink${r.stats.standardDrinks === 1 ? '' : 's'}), sugar ${r.stats.sugarConc}, acid ${r.stats.acidConc} g/100 ml, ${r.stats.volOz} oz poured, ${r.stats.finalOz} oz finished\n`;
  md += `- Heard: ${(rd.heard || []).map(h => `"${h.phrase}" → ${h.meaning}`).join(' | ') || '(nothing)'}${rd.unheard && rd.unheard.length ? ` · NOT HEARD: ${rd.unheard.join(', ')}` : ''}\n`;
  md += `- Recipe:\n${r.lines.map(l => `  - ${l.garnish ? 'garnish' : amountString(l, 'oz')} ${l.name}${l.float ? ' (float)' : ''}${l.sink ? ' (sink)' : ''}${l.muddled ? ' (muddled/blended in)' : ''}`).join('\n')}\n`;
  if (r.batch) md += `- Batch for ${r.servings}: ${r.batch.map(b => `${b.total} ${b.name}`).join(', ')}\n`;
  md += `- Garnish: ${r.garnish.join(', ')}\n`;
  md += `- Steps:\n${r.method.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n`;
  md += `- Tasting: ${r.explanation.tasting}\n`;
  md += `- Look: ${r.look ? `${r.look.description} (body ${r.look.body.hex}, opacity ${r.look.body.opacity}${r.look.layers.length ? `; layers ${r.look.layers.map(x => `${x.kind} ${x.hex}`).join(', ')}` : ''})` : ''}\n`;
  if (rd.moves && rd.moves.length) md += `- Moves: ${rd.moves.join('; ')}\n`;
  if (rd.waived) md += `- Waived: ${rd.waived}\n`;
  md += `- Why: ${r.explanation.whyItWorks.join(' / ')}\n`;
}
writeFileSync(join(out, 'packet.json'), JSON.stringify(recs, null, 1));
writeFileSync(join(out, 'packet.md'), md);
console.log(`${recs.length} recipes → ${out}/packet.{json,md}`);
