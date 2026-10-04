// Lint the review battery: generate every prompt in scripts/review/battery.json (two seeds each)
// with the real engine, run the technique linter on each drink, and print the findings by rule
// and severity plus the 20 worst drinks.
//
//   node scripts/lint-battery.mjs            # table + worst 20
//   node scripts/lint-battery.mjs --all      # also every finding, drink by drink
//   node scripts/lint-battery.mjs --json out.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../web/lib/engine.js';
import { createLinter } from '../web/lib/lint.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const vocab = read('data/ingredients.json');
const vessels = read('data/vessels.json');
const engine = createEngine({
  vocab, vessels, families: read('data/families.json'), drinks: read('data/drinks.json'), model: read('data/model.json'),
  archetypes: read('data/archetypes.json'), concepts: read('data/concepts.json'),
});
const { lint } = createLinter({ rules: read('data/technique-rules.json'), vocab, vessels });

const args = process.argv.slice(2);
const SEEDS = [0, 1];
const prompts = read('scripts/review/battery.json').prompts;
const results = [];
for (const prompt of prompts) {
  for (const seed of SEEDS) {
    const recipe = engine.generate(prompt, { seed });
    const findings = lint(recipe, { intent: engine.parse(prompt) });
    const n = { fatal: 0, major: 0, minor: 0 };
    for (const f of findings) n[f.sev]++;
    results.push({ prompt, seed, recipe, findings, n, score: n.fatal * 100 + n.major * 10 + n.minor });
  }
}

// Findings by rule and severity.
const byRule = new Map();
for (const r of results) {
  const hit = new Set();
  for (const f of r.findings) {
    const key = `${f.id}\u0000${f.sev}`;
    const e = byRule.get(key) || { id: f.id, sev: f.sev, count: 0, drinks: 0 };
    e.count++;
    if (!hit.has(key)) { e.drinks++; hit.add(key); }
    byRule.set(key, e);
  }
}
const rank = { fatal: 0, major: 1, minor: 2 };
const rows = [...byRule.values()].sort((a, b) => rank[a.sev] - rank[b.sev] || b.drinks - a.drinks || a.id.localeCompare(b.id));
const total = { fatal: 0, major: 0, minor: 0 };
for (const r of results) for (const k of Object.keys(total)) total[k] += r.n[k];
const clean = results.filter(r => !r.n.fatal && !r.n.major).length;

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
console.log(`Lint battery: ${prompts.length} prompts x ${SEEDS.length} seeds = ${results.length} drinks`);
console.log(`Findings: ${total.fatal} fatal, ${total.major} major, ${total.minor} minor. Drinks with a fatal: ${results.filter(r => r.n.fatal).length}; with no fatal or major: ${clean}.`);
console.log('');
console.log(`${pad('rule', 34)} ${pad('sev', 6)} ${lpad('findings', 8)} ${lpad('drinks', 7)}`);
console.log(`${'-'.repeat(34)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(7)}`);
for (const e of rows) console.log(`${pad(e.id, 34)} ${pad(e.sev, 6)} ${lpad(e.count, 8)} ${lpad(e.drinks, 7)}`);

console.log('\nThe 20 worst drinks (fatal x100 + major x10 + minor):');
const worst = [...results].sort((a, b) => b.score - a.score).slice(0, 20);
worst.forEach((r, i) => {
  const R = r.recipe;
  console.log(`\n${lpad(i + 1, 2)}. "${r.prompt}" seed ${r.seed}: ${R.name} [${R.family.id} / ${R.archetype.id}, ${R.method.method} ${R.method.ice}, ${R.vessel ? R.vessel.id : '?'}, ${R.stats.abv}% ABV]  ${r.n.fatal}F ${r.n.major}M ${r.n.minor}m`);
  console.log(`    ${R.lines.map(l => `${l.amount ?? l.oz} ${l.unit || 'oz'} ${l.id}${l.float ? ' (float)' : ''}${l.sink ? ' (sink)' : ''}`).join(', ')}`);
  for (const f of r.findings.filter(f => f.sev !== 'minor')) console.log(`    ${pad(f.sev, 5)} ${f.id}: ${f.msg}`);
});

// prayer-ignored can't be seen in one drink: different prayers, same ingredients, same seed.
const sets = new Map();
for (const r of results) {
  const key = `${r.seed}|${r.recipe.lines.map(l => l.id).sort().join(',')}`;
  (sets.get(key) || sets.set(key, []).get(key)).push(r.prompt);
}
const twins = [...sets.entries()].filter(([, ps]) => new Set(ps).size > 1);
console.log(`\nPrayers that got identical ingredient sets at the same seed (copy.prayerTrace): ${twins.length ? '' : 'none'}`);
for (const [key, ps] of twins) console.log(`  - seed ${key.split('|')[0]}: ${[...new Set(ps)].map(p => `"${p}"`).join(', ')}`);

if (args.includes('--all')) {
  console.log('\nEvery finding:');
  for (const r of results) {
    console.log(`\n"${r.prompt}" seed ${r.seed}: ${r.recipe.name}`);
    for (const f of r.findings) console.log(`  ${pad(f.sev, 5)} ${f.id}: ${f.msg}`);
  }
}
const j = args.indexOf('--json');
if (j >= 0 && args[j + 1]) {
  writeFileSync(args[j + 1], JSON.stringify(results.map(r => ({ prompt: r.prompt, seed: r.seed, name: r.recipe.name, family: r.recipe.family.id, archetype: r.recipe.archetype.id, n: r.n, findings: r.findings })), null, 1));
  console.log(`\nWrote ${args[j + 1]}`);
}
