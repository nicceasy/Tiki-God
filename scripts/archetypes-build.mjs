#!/usr/bin/env node
// Merge researched archetype files into data/archetypes.json.
//   node scripts/archetypes-build.mjs <research.json>... [--out data/archetypes.json]
// Validates every ingredient, family and vessel id against the repo's vocabularies (unknown
// ids are dropped and reported), and derives what the composer needs from the research:
// popularity weight (from the catalogue), style flags (creamy, long, bowl, layered...),
// aromatic garnishes, the type noun used in taglines, and a typical ingredient count.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(p.startsWith('/') ? p : join(root, p), 'utf8'));
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : join(root, 'data/archetypes.json');
const files = args.filter((a, i) => !a.startsWith('--') && i !== outAt + 1);

const vocab = read('data/ingredients.json');
const ing = new Map(vocab.ingredients.map(i => [i.id, i]));
const famIds = new Set(read('data/families.json').families.map(f => f.id));
const vesselIds = new Set(read('data/vessels.json').vessels.map(v => v.id));
const drinks = read('data/drinks.json');
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const popByName = new Map();
for (const d of drinks) popByName.set(norm(d.name), Math.max(popByName.get(norm(d.name)) || 0, d.popularity));

const issues = [];
const keepIds = (list, where) => (list || []).filter(id => {
  if (typeof id !== 'string') return false;
  if (ing.has(id)) return true;
  if (/^cat:/.test(id)) return true;
  issues.push(`${where}: unknown ingredient "${id}"`);
  return false;
});
const AROMA = { mint: /mint/, nutmeg: /nutmeg/, cinnamon: /cinnamon/ };
const NOUN = {
  punch: 'punch', grog: 'grog', daiquiri: 'sour', swizzle: 'swizzle', zombie: 'Beachcomber heavyweight', 'beachcomber-sour': 'Beachcomber sour',
  'mai-tai': 'Mai Tai-style sour', 'orgeat-punch': 'orgeat punch', colada: 'colada', buck: 'highball', 'resort-punch': 'tropical punch',
  'bitter-tiki': 'bitter tiki sour', stirred: 'tropical old fashioned', hot: 'hot drink',
};

const seen = new Map();
for (const f of files) {
  const data = read(f);
  for (const a of data.archetypes || []) {
    const where = `${a.id}`;
    if (!famIds.has(a.family)) { issues.push(`${where}: unknown family "${a.family}"`); continue; }
    const sig = (a.signature || []).map(c => ({ ...c, anyOf: keepIds(c.anyOf, `${where}.signature.${c.component}`) })).filter(c => c.anyOf.length || !c.required);
    // A required component with no known ingredient is either presentation (an ice shell) or a
    // missing ingredient; it is dropped from the signature and reported for review.
    const lost = (a.signature || []).filter(c => c.required && !keepIds(c.anyOf, '').length);
    if (lost.length) issues.push(`${where}: REVIEW required component(s) with no known ingredient, dropped: ${lost.map(c => `${c.component} [${(c.anyOf || []).join(', ')}]`).join('; ')}`);
    const opt = (a.optional || []).map(o => ({ ...o, anyOf: keepIds(o.anyOf, `${where}.optional.${o.slot}`) })).filter(o => o.anyOf.length);
    const specs = (a.canonicalSpecs || []).map(sp => ({ ...sp, lines: (sp.lines || []).filter(l => ing.has(l.id)), vessel: vesselIds.has(sp.vessel) ? sp.vessel : undefined })).filter(sp => sp.lines.length);
    const vessels = (a.vessels || []).filter(v => vesselIds.has(v));
    const allIds = new Set([...sig, ...opt].flatMap(c => c.anyOf));
    const garnishText = [...((a.garnish || {}).required || []), ...((a.garnish || {}).typical || [])].join(' ').toLowerCase();
    const reqIds = new Set(sig.filter(c => c.required).flatMap(c => c.anyOf));
    const weight = Math.max(1, ...(a.classics || []).map(c => popByName.get(norm(c)) || 0));
    const rec = {
      id: a.id, name: a.name, family: a.family, noun: a.noun || NOUN[a.family] || a.name.toLowerCase(),
      nameNouns: a.nameNouns, definition: a.definition, classics: a.classics || [], weight,
      creamy: a.creamy ?? sig.some(c => c.required && c.anyOf.some(id => ['cream'].includes((ing.get(id) || {}).cat))),
      long: a.long ?? sig.some(c => c.required && c.anyOf.some(id => (ing.get(id) || {}).role === 'lengthener')),
      bowl: a.bowl ?? (vessels.some(v => /bowl/.test(v)) && (a.methods || []).length > 0 && /bowl/i.test(a.name)),
      layered: a.layered ?? [...sig, ...opt].some(c => c.float || c.sink || c.crown),
      flaming: a.flaming ?? /flam|volcano/i.test(a.name + ' ' + (a.look || '')),
      zeroProof: a.zeroProof,
      signature: sig, optional: opt, forbidden: keepIds((a.forbidden || []).filter(x => ing.has(x) || /^cat:/.test(x)), `${where}.forbidden`),
      canonicalSpecs: specs, ratios: a.ratios || {}, methods: a.methods || ['shake'], ice: a.ice || ['crushed'], vessels,
      garnish: a.garnish || {}, aromatics: Object.keys(AROMA).filter(k => AROMA[k].test(garnishText) && ing.has(k)),
      look: a.look || '', flavorProfile: a.flavorProfile || [], taglineWords: a.taglineWords || [], substitutions: a.substitutions || [],
      redFlags: a.redFlags || [], prayerFit: a.prayerFit || [],
      typicalCount: specs.length ? Math.round(specs.reduce((s, sp) => s + sp.lines.filter(l => (ing.get(l.id) || {}).role !== 'aromatic').length, 0) / specs.length) : sig.length,
    };
    if (seen.has(rec.id)) issues.push(`${where}: duplicate id from ${f}; later one wins`);
    seen.set(rec.id, rec);
    void reqIds; void allIds;
  }
}
const archetypes = [...seen.values()];
writeFileSync(out, '{\n  "about": "Proven drink structures the generator builds from (see web/lib/composer.js). Compiled from research by scripts/archetypes-build.mjs.",\n  "archetypes": [\n' + archetypes.map(a => '    ' + JSON.stringify(a)).join(',\n') + '\n  ]\n}\n');
console.log(`${archetypes.length} archetypes → ${out}`);
if (issues.length) console.log(`${issues.length} issues:\n  ` + issues.slice(0, 80).join('\n  '));
