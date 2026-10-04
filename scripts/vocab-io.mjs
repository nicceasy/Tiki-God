// Read and write data/ingredients.json in its house format: top-level keys one per line and
// one ingredient per line, so diffs stay readable.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const vocabPath = join(root, 'data/ingredients.json');
export const readVocab = () => JSON.parse(readFileSync(vocabPath, 'utf8'));
// Compact JSON with spaces after ':' and ',' (the file's original Python-style formatting).
export function pj(x) {
  if (Array.isArray(x)) return `[${x.map(pj).join(', ')}]`;
  if (x && typeof x === 'object') return `{${Object.entries(x).map(([k, v]) => `${JSON.stringify(k)}: ${pj(v)}`).join(', ')}}`;
  return JSON.stringify(x);
}
export function writeVocab(v) {
  const keys = Object.keys(v).filter(k => k !== 'ingredients');
  let out = '{\n';
  for (const k of keys) out += `  ${JSON.stringify(k)}: ${pj(v[k])},\n`;
  out += '  "ingredients": [\n' + v.ingredients.map(i => '    ' + pj(i)).join(',\n') + '\n  ]\n}\n';
  writeFileSync(vocabPath, out);
}
