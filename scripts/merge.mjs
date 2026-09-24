#!/usr/bin/env node
// Merge data/drinks/<slice>.json files into data/drinks.json.
// - dedupes records that describe the same drink/spec across slices
// - resolves free-text `parents` names to drink ids (`parent_ids`)
// - reports ingredient proposals that still need to be added to data/ingredients.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDrinks } from './validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'data/drinks');
const vocab = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
const vocabIds = new Set(vocab.ingredients.map(i => i.id));

// Slice priority when the same drink shows up twice: the slice that "owns" the creator wins.
const PRIORITY = ['don', 'vic', 'golden-venues', 'ancestors', 'resort', 'revival', 'craft', 'deep-cuts'];
const CONF_RANK = { high: 3, medium: 2, low: 1 };

export const norm = s => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^the\s+/, '')
  .replace(/['’`".]/g, '')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

const files = readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.new-ingredients.json'));
const all = [];
const proposals = [];
for (const f of files) {
  const slice = f.replace(/\.json$/, '');
  const drinks = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const d of drinks) all.push({ ...d, slice });
  try {
    const props = JSON.parse(readFileSync(join(dir, `${slice}.new-ingredients.json`), 'utf8'));
    for (const p of props) proposals.push({ ...p, _slice: slice });
  } catch { /* none */ }
}

// Confidence first (a well-sourced record beats a recalled one), then the slice that owns the creator.
const rank = d => [
  -(CONF_RANK[d.confidence] || 0),
  PRIORITY.indexOf(d.slice) === -1 ? 99 : PRIORITY.indexOf(d.slice),
];
const better = (a, b) => {
  const ra = rank(a), rb = rank(b);
  return ra[0] !== rb[0] ? ra[0] < rb[0] : ra[1] <= rb[1];
};

// 1. Exact id collisions.
const byId = new Map();
const dropped = [];
for (const d of all) {
  const prev = byId.get(d.id);
  if (!prev) { byId.set(d.id, d); continue; }
  const sameDrink = norm(prev.name) === norm(d.name);
  if (sameDrink) {
    const keep = better(prev, d) ? prev : d;
    const lose = keep === prev ? d : prev;
    byId.set(d.id, keep);
    dropped.push(`${lose.slice}:${lose.id} (dup of ${keep.slice}:${keep.id})`);
  } else {
    // Different drinks with the same id: rename the later one.
    let n = 2;
    while (byId.has(`${d.id}-${n}`)) n++;
    byId.set(`${d.id}-${n}`, { ...d, id: `${d.id}-${n}` });
  }
}

// 2. Same name + very similar spec from different slices → duplicate.
let merged = [...byId.values()];
const groups = new Map();
for (const d of merged) {
  const k = norm(d.name);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(d);
}
const remove = new Set();
for (const [, list] of groups) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (remove.has(a.id) || remove.has(b.id) || a.slice === b.slice) continue;
      const sim = jaccard(a.ingredients.map(x => x.id), b.ingredients.map(x => x.id));
      if (sim >= 0.75) {
        const keep = better(a, b) ? a : b;
        const lose = keep === a ? b : a;
        remove.add(lose.id);
        dropped.push(`${lose.slice}:${lose.id} (near-dup of ${keep.slice}:${keep.id}, sim ${sim.toFixed(2)})`);
      }
    }
  }
}
merged = merged.filter(d => !remove.has(d.id));

// 3. Resolve parents → parent_ids (prefer earliest-dated record with that name).
const nameIndex = new Map();
for (const d of merged) {
  for (const n of [d.name, ...(d.aka || [])]) {
    const k = norm(n);
    if (!k) continue;
    const prev = nameIndex.get(k);
    if (!prev || (d.year ?? 9999) < (prev.year ?? 9999) || ((d.year ?? 9999) === (prev.year ?? 9999) && d.popularity > prev.popularity)) nameIndex.set(k, d);
  }
}
let unresolved = 0;
for (const d of merged) {
  const ids = [];
  for (const p of d.parents || []) {
    const hit = nameIndex.get(norm(p)) || nameIndex.get(norm(p.replace(/\(.*?\)/g, '')));
    if (hit && hit.id !== d.id) ids.push(hit.id);
    else unresolved++;
  }
  d.parent_ids = [...new Set(ids)];
}

merged.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name));

// 4. Validate the merged set (proposal ids tolerated so we can see what's missing).
const pendingProposals = proposals.filter(p => !vocabIds.has(p.id));
const { errors, warnings } = validateDrinks(merged, pendingProposals.map(p => p.id));

writeFileSync(join(root, 'data/drinks.json'), JSON.stringify(merged, null, 1) + '\n');

console.log(`slices: ${files.join(', ')}`);
console.log(`records in: ${all.length}, merged: ${merged.length}, dropped: ${dropped.length}, unresolved parent names: ${unresolved}`);
for (const d of dropped) console.log('  dropped ' + d);
if (pendingProposals.length) {
  console.log(`ingredient proposals not yet in vocabulary (${pendingProposals.length}):`);
  for (const p of pendingProposals) console.log(`  ${p._slice}: ${p.id} — ${p.name}`);
}
console.log(`validation: ${errors.length} errors, ${warnings.length} warnings`);
for (const e of errors) console.log('  ERROR ' + e);
