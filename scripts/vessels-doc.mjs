#!/usr/bin/env node
// Writes the vessel catalogue section of docs/vessels.md from data/vessels.json and the model,
// between the <!--VESSELS--> markers, so the doc never drifts from the data.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const { vessels } = read('data/vessels.json');
const model = read('data/model.json');
const drinks = Object.fromEntries(read('data/drinks.json').map(d => [d.id, d]));
const KIND = { glass: 'Glassware', metal: 'Metal', ceramic: 'Tiki ceramics', fruit: 'Fruit', bowl: 'Bowls' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

let md = '';
for (const kind of Object.keys(KIND)) {
  md += `\n### ${KIND[kind]}\n`;
  for (const v of vessels.filter(x => x.kind === kind)) {
    const m = (model.vessels || {})[v.id] || { n: 0 };
    const ex = (m.ex || []).map(id => drinks[id] && drinks[id].name).filter((x, i, a) => x && a.indexOf(x) === i);
    md += `\n**${cap(v.name)}** · about ${v.capacity} oz · takes ${v.serve.join(', ')}\n\n${v.story}\n\n`;
    md += `- Classics: ${v.classics.join(', ') || '–'}\n`;
    md += `- In the catalogue: ${m.n} drink${m.n === 1 ? '' : 's'}${ex.length ? ` (e.g. ${ex.slice(0, 3).join(', ')})` : ''}\n`;
    if (v.sources.length) md += `- Sources: ${v.sources.map(u => `<${u}>`).join(' · ')}\n`;
  }
}
const p = join(root, 'docs/vessels.md');
const doc = readFileSync(p, 'utf8');
const out = doc.replace(/<!--VESSELS-->[\s\S]*<!--\/VESSELS-->/, `<!--VESSELS-->\n${md}\n<!--/VESSELS-->`);
writeFileSync(p, out);
console.log(`docs/vessels.md: ${vessels.length} vessels`);
