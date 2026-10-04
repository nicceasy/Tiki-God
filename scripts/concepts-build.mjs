#!/usr/bin/env node
// Merge researched prayer semantics into data/concepts.json.
//   node scripts/concepts-build.mjs <semantics.json>... [--out data/concepts.json]
// Each concept maps phrases a guest might pray ("heartbreak", "Tokyo neon", "my grandmother's
// garden") to what a bartender would hear: flavor tags, bottles, things to steer away from,
// style, color, families, vessels, garnish ideas, name and tagline words, and a one-line
// reading the Shrine can say back. Unknown ids are dropped and reported; a phrase claimed by
// two concepts stays with the first.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(p.startsWith('/') ? p : join(root, p), 'utf8'));
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : join(root, 'data/concepts.json');
const files = args.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));

const vocab = read('data/ingredients.json');
const ing = new Map(vocab.ingredients.map(i => [i.id, i]));
const TAGS = new Set(vocab.flavor_tags || vocab.ingredients.flatMap(i => i.flavors || []));
const famIds = new Set(read('data/families.json').families.map(f => f.id));
const vesselIds = new Set(read('data/vessels.json').vessels.map(v => v.id));
const STYLE_NUM = ['strength', 'sweetness', 'tartness', 'complexity'];
const STYLE_BOOL = ['creamy', 'frozen', 'hot', 'long', 'bitter', 'flaming', 'layered', 'bowl', 'zeroProof', 'stirred', 'simple'];
// Colors the engine knows how to pour and to check in the finished drink.
const COLOR = {
  blue: 'blue', azure: 'blue', turquoise: 'blue', aqua: 'blue', teal: 'blue', cyan: 'blue', navy: 'blue',
  red: 'red', crimson: 'red', scarlet: 'red', ruby: 'red', pink: 'pink', rose: 'pink', coral: 'pink', blush: 'pink', magenta: 'pink',
  orange: 'orange', tangerine: 'orange', sunset: 'orange', amber: 'gold', gold: 'gold', golden: 'gold', yellow: 'gold',
  green: 'green', jade: 'green', emerald: 'green', lime: 'green', purple: 'purple', violet: 'purple', lavender: 'purple',
  black: 'dark', dark: 'dark', brown: 'dark', mahogany: 'dark', white: 'white', cream: 'white', ivory: 'white', clear: 'clear', silver: 'clear',
};
const issues = [];
const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();

// A phrase two concepts both claim goes to the one that names it most directly: the concept
// whose id is the phrase ("dreamsicle") beats a broad one that lists it ("childhood"); then the
// one with fewer phrases (more specific); then the first.
const slug = s => norm(s).replace(/['\s]+/g, '-');
const all = [];
for (const f of files) for (const c of read(f).concepts || []) all.push({ c, f });
const seenIds = new Map();
for (const x of all) {
  if (!x.c.id || !Array.isArray(x.c.phrases)) continue;
  // The same concept id twice (a research script's duplicate): keep the richer one.
  const prev = seenIds.get(x.c.id);
  if (prev && (prev.c.phrases || []).length >= x.c.phrases.length) { x.dup = true; issues.push(`${x.c.id}: duplicate concept dropped`); continue; }
  if (prev) prev.dup = true;
  seenIds.set(x.c.id, x);
}
const owner = new Map();
const claimScore = (x, n) => (slug(x.c.id) === slug(n) ? 100 : slug(x.c.id).includes(slug(n)) || slug(n).includes(slug(x.c.id)) ? 50 : 0) - x.c.phrases.length * 0.1;
for (const x of all) {
  if (x.dup || !x.c.id || !Array.isArray(x.c.phrases)) continue;
  for (const p of x.c.phrases) {
    const n = norm(p);
    if (!n || n.length < 3) continue;
    const cur = owner.get(n);
    if (!cur || claimScore(x, n) > claimScore(cur, n)) owner.set(n, x);
  }
}
const claimed = new Map();
const concepts = [];
const ids = new Set();
for (const x of all) {
  const { c, f } = x;
  if (x.dup) continue;
  {
    const where = `${f.split('/').pop()}:${c.id}`;
    if (!c.id || !Array.isArray(c.phrases)) { issues.push(`${where}: no id/phrases`); continue; }
    let id = c.id;
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    const phrases = [];
    for (const p of c.phrases) {
      const n = norm(p);
      if (!n || n.length < 3 || owner.get(n) !== x || claimed.has(n)) continue;
      claimed.set(n, id); phrases.push(n);
    }
    if (!phrases.length) { issues.push(`${where}: every phrase belongs to a more specific concept`); continue; }
    const tags = {};
    for (const [t, w] of Object.entries(c.tags || {})) {
      const v = num(w, -2, 2);
      if (!TAGS.has(t)) { issues.push(`${where}: unknown tag ${t}`); continue; }
      if (v) tags[t] = v;
    }
    const ings = {};
    for (const [i, w] of Object.entries(c.ings || {})) {
      if (!ing.has(i)) { issues.push(`${where}: unknown ingredient ${i}`); continue; }
      const v = num(w, 0, 3);
      if (v) ings[i] = v;
    }
    const avoid = (c.avoid || []).filter(i => ing.has(i) || (issues.push(`${where}: unknown avoid ${i}`), false));
    const style = {};
    for (const k of STYLE_NUM) { const v = num((c.style || {})[k], -2, 2); if (v) style[k] = v; }
    for (const k of STYLE_BOOL) if ((c.style || {})[k] === true) style[k] = true;
    const families = {};
    for (const [fam, w] of Object.entries(c.families || {})) {
      if (!famIds.has(fam)) { issues.push(`${where}: unknown family ${fam}`); continue; }
      const v = num(w, -3, 3);
      if (v) families[fam] = v;
    }
    const vessels = {};
    for (const [v, w] of Object.entries(c.vessels || {})) {
      if (!vesselIds.has(v)) { issues.push(`${where}: unknown vessel ${v}`); continue; }
      const x = num(w, -3, 3);
      if (x) vessels[v] = x;
    }
    const color = c.color ? COLOR[norm(c.color).split(' ')[0]] || null : null;
    if (c.color && !color && !['pale', 'tan', 'beige', 'amber-pale'].includes(norm(c.color))) issues.push(`${where}: unknown color ${c.color}`);
    const rec = { id, phrases, domain: c.domain || '', reading: c.reading || '' };
    if (Object.keys(tags).length) rec.tags = tags;
    if (Object.keys(ings).length) rec.ings = ings;
    if (avoid.length) rec.avoid = avoid;
    if (Object.keys(style).length) rec.style = style;
    if (color) rec.color = color;
    if (Object.keys(families).length) rec.families = families;
    if (Object.keys(vessels).length) rec.vessels = vessels;
    if ((c.garnish || []).length) rec.garnish = c.garnish.slice(0, 4);
    if ((c.nameWords || []).length) rec.nameWords = c.nameWords.filter(w => typeof w === 'string' && w.length <= 18).slice(0, 8);
    if ((c.taglineWords || []).length) rec.taglineWords = c.taglineWords.filter(w => typeof w === 'string' && w.length <= 48).slice(0, 4);
    concepts.push(rec);
  }
}
writeFileSync(out, '{\n  "about": "What a bartender hears in a prayer: phrases mapped to flavors, bottles, style, color, families, vessels, garnish, name and tagline words, with a reading said back to the guest. Compiled from research by scripts/concepts-build.mjs.",\n  "concepts": [\n' + concepts.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n');
const byDomain = {};
for (const c of concepts) byDomain[c.domain || '?'] = (byDomain[c.domain || '?'] || 0) + 1;
console.log(`${concepts.length} concepts, ${claimed.size} phrases → ${out}`);
console.log(Object.entries(byDomain).map(([d, n]) => `${d}:${n}`).join(' '));
if (issues.length) console.log(`${issues.length} issues:\n  ` + issues.slice(0, 60).join('\n  ') + (issues.length > 60 ? `\n  ... ${issues.length - 60} more` : ''));
