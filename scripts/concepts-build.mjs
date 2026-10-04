#!/usr/bin/env node
// Merge researched prayer semantics into data/concepts.json.
//   node scripts/concepts-build.mjs <semantics.json>... [--out data/concepts.json]
// Each concept maps phrases a guest might pray ("heartbreak", "Tokyo neon", "my grandmother's
// garden") to what a bartender would hear: flavor tags, bottles, things to steer away from,
// style, color, families, vessels, garnish ideas, name and tagline words, and a one-line
// reading the Shrine can say back (author-only notes in the research move to `guidance`, never
// rendered). Unknown ids are dropped and reported; a phrase claimed by two concepts stays with
// the first. The build is idempotent: `node scripts/concepts-build.mjs data/concepts.json`
// re-applies the patches to the committed file when the research inputs aren't at hand.
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
// Patches for bottles added after the research ran (it noted them as missing from the pantry).
const PATCH = {
  'japan-tokyo': { ings: { 'japanese-whisky': 1.6, sake: 0.5 }, vessels: { highball: 1 } },
  neon: { ings: { 'melon-liqueur': 0.8 }, color: 'green' },
  dragon: { ings: { 'pitaya-puree': 0.8 }, style: { flaming: true } },
  pele: { style: { flaming: true } },
  'hurricane-new-orleans': { ings: { fassionola: 1 } },
};
// Phrases the research gave to the wrong concept: "garden" alone is flowers and herbs, not a
// garden party with a punch bowl.
const MOVE = { garden: 'spring', gardens: 'spring', elegant: 'sophisticated', classy: 'sophisticated', 'havana 1950s': 'havana-nights', 'street party': 'party', 'block party': 'party' };
// Guest-facing readings. The research wrote each reading for two audiences: what the Shrine
// says back to the guest, and notes for whoever builds the drink ("Respect: …", "(… don't
// reuse.)", the list of jokes to keep away from a deity, "isn't in the pantry"). The notes move
// to `guidance`, which is kept for authors and never rendered.
const GUIDANCE = [
  /^Respect(fully)?\b|^Treat the lore\b|^Read the domain the god governs/,
  /\bdon'?t (reuse|borrow|use|name|mimic|stereotype)\b|\bdo not (reuse|invent)\b|\bcatalogue (drink|name)s?\b/i,
  /\bnever caricature\b|\bjokes?\b|\bclich[ée]s?\b|\bin any drink name\b|\bAvoid naming\b|\bAvoid the brand name\b|\bname the drink after\b|\bout of names\b/i,
  /\b(isn'?t|aren'?t|is not|are not) (in the pantry|stocked)\b|\bnot in the pantry\b|\bmissing from the pantry\b|\bif they were in the pantry\b|\bIt isn'?t stocked\b|\bThe local pantry\b|\bWith this pantry\b|\bin this pantry\b/i,
  /\buncertain\b|\bcolor model\b/i,
  /^Avoid\b/,
];
const isGuidance = s => GUIDANCE.some(re => re.test(s.trim()));
// Sentences end at . or ? before a capital (or an opening parenthesis or quote), so "1.2 times",
// "St. Thomas", "c. 1934" and "Girls! Girls! Girls!" stay whole.
const SENTENCE_BREAK = /(?<=[.?]["')\]]*)(?<!\b(?:St|Mt|Mr|Mrs|Dr|Jr|Sr|c|ca|vs|No|[A-Z])\.)\s+(?=[A-Z("'ʻ‘“])/;
function splitReading(text) {
  const keep = [], notes = [];
  for (const sentence of String(text || '').split(SENTENCE_BREAK)) {
    let s = sentence.trim();
    if (!s) continue;
    // An aside for the author inside a sentence the guest should read: "(… don't reuse.)".
    s = s.replace(/\s*\(([^)]*)\)/g, (m, inner) => (isGuidance(inner) ? (notes.push(inner.trim()), '') : m)).replace(/\s+([.,;:!?])/g, '$1');
    if (/^\(.*\)\.?$/.test(s) && isGuidance(s.slice(1, -1))) { notes.push(s); continue; }
    if (isGuidance(s)) notes.push(s);
    else if (s.replace(/[\s.()]/g, '')) keep.push(s);
  }
  return { reading: keep.join(' '), guidance: notes.join(' ') };
}
// Name and tagline words a concept should not offer: a place word from another place (Kyoto is
// not Tokyo), "Smoke Signal" (a stereotype, not a smoke), and Hawaiian words on concepts that
// aren't Hawaiian (a party is not a hoʻolauleʻa, a promotion is not a hoʻomaikaʻi).
const DROP_WORDS = {
  'japan-tokyo': ['Kyoto'],
  campfire: ['Smoke Signal'],
  'tiki-torch': ['Smoke Signal'],
  party: ["Ho'olaule'a", "Ho'olaule'a: a celebration", 'Big Kahuna Bowl'],
  promotion: ["Ho'omaika'i", "Ho'omaika'i: congratulations"],
  heartbreak: ['Kaumaha'],
  'self-care': ['Malama', "Ho'omaha", 'Malama: take care'],
  karaoke: ['Mele', 'Hana Hou', 'Hana hou! (encore!)'],
};
const keepWord = (id, w) => !(DROP_WORDS[id] || []).includes(w);
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
// Function words are never a wish ("and" is not Peru).
const FUNCTION_WORDS = new Set(['and', 'the', 'for', 'with', 'you', 'our', 'but', 'not', 'too', 'are', 'was', 'has', 'had', 'get', 'got', 'its', 'his', 'her', 'him', 'she', 'they', 'them', 'this', 'that', 'from', 'into', 'onto', 'over', 'very', 'just', 'some', 'any', 'all', 'one', 'two', 'few', 'lot', 'out', 'off', 'way', 'who', 'why', 'how', 'what', 'when', 'where', 'can', 'may', 'will', 'like', 'make', 'made', 'more', 'less', 'much', 'drink', 'drinks', 'something']);
const owner = new Map();
for (const [n, id] of Object.entries(MOVE)) { const x = all.find(x => x.c.id === id && !x.dup); if (x && !x.c.phrases.includes(n)) x.c.phrases.push(n); }
const claimScore = (x, n) => (slug(x.c.id) === slug(n) ? 100 : slug(x.c.id).includes(slug(n)) || slug(n).includes(slug(x.c.id)) ? 50 : 0) - x.c.phrases.length * 0.1;
for (const x of all) {
  if (x.dup || !x.c.id || !Array.isArray(x.c.phrases)) continue;
  for (const p of x.c.phrases) {
    const n = norm(p);
    if (!n || n.length < 3 || FUNCTION_WORDS.has(n)) continue;
    const cur = owner.get(n);
    if (MOVE[n]) { if (x.c.id === MOVE[n]) owner.set(n, x); continue; }
    if (!cur || claimScore(x, n) > claimScore(cur, n)) owner.set(n, x);
  }
}
const claimed = new Map();
const concepts = [];
const ids = new Set();
for (const x of all) {
  const { c, f } = x;
  const pt = PATCH[c.id];
  if (pt) { c.ings = { ...(c.ings || {}), ...(pt.ings || {}) }; c.vessels = { ...(c.vessels || {}), ...(pt.vessels || {}) }; c.style = { ...(c.style || {}), ...(pt.style || {}) }; if (pt.color) c.color = pt.color; }
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
    const said = splitReading(c.reading);
    const rec = { id, phrases, domain: c.domain || '', reading: said.reading };
    const guidance = [c.guidance, said.guidance].filter(Boolean).join(' ');
    if (guidance) rec.guidance = guidance;
    if (Object.keys(tags).length) rec.tags = tags;
    if (Object.keys(ings).length) rec.ings = ings;
    if (avoid.length) rec.avoid = avoid;
    if (Object.keys(style).length) rec.style = style;
    if (color) rec.color = color;
    if (Object.keys(families).length) rec.families = families;
    if (Object.keys(vessels).length) rec.vessels = vessels;
    if ((c.garnish || []).length) rec.garnish = c.garnish.slice(0, 4);
    if ((c.nameWords || []).length) rec.nameWords = c.nameWords.filter(w => typeof w === 'string' && w.length <= 18 && keepWord(c.id, w)).slice(0, 8);
    if ((c.taglineWords || []).length) rec.taglineWords = c.taglineWords.filter(w => typeof w === 'string' && w.length <= 48 && keepWord(c.id, w)).slice(0, 4);
    concepts.push(rec);
  }
}
writeFileSync(out, '{\n  "about": "What a bartender hears in a prayer: phrases mapped to flavors, bottles, style, color, families, vessels, garnish, name and tagline words, with a reading said back to the guest. Compiled from research by scripts/concepts-build.mjs.",\n  "concepts": [\n' + concepts.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n');
const byDomain = {};
for (const c of concepts) byDomain[c.domain || '?'] = (byDomain[c.domain || '?'] || 0) + 1;
console.log(`${concepts.length} concepts, ${claimed.size} phrases → ${out}`);
console.log(Object.entries(byDomain).map(([d, n]) => `${d}:${n}`).join(' '));
if (issues.length) console.log(`${issues.length} issues:\n  ` + issues.slice(0, 60).join('\n  ') + (issues.length > 60 ? `\n  ... ${issues.length - 60} more` : ''));
