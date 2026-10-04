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
const files = args.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));

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

// The type word a menu uses for an original drink built on each archetype ("A smoky
// Zombie-style heavyweight with passion fruit"). Naming the classic it descends from is honest
// and tells an aficionado exactly what to expect; drink *names* never borrow it.
const NOUN_BY_ID = {
  colada: 'colada', painkiller: 'Painkiller-style colada', daiquiri: 'daiquiri', 'mai-tai': 'Mai Tai cousin', 'vic-mai-tai-riff': 'Mai Tai cousin',
  'planters-punch': "planter's punch", 'bowl-punch': 'bowl punch', 'ti-punch': "ti' punch", grog: 'grog', 'navy-grog': 'grog',
  'trinidad-swizzle': 'swizzle', 'bermuda-rum-swizzle': 'rum swizzle', 'overproof-swizzle': 'overproof swizzle', 'herbal-swizzle': 'herbal swizzle',
  'dark-n-stormy': 'ginger beer highball', mule: 'mule', 'suffering-bastard': 'ginger beer highball',
  'hemingway-daiquiri': 'Hemingway-style daiquiri', 'frozen-daiquiri': 'frozen daiquiri', 'fruit-daiquiri': 'fruit daiquiri', 'nuclear-daiquiri': 'overproof daiquiri',
  caipirinha: 'caipirinha', mojito: 'mojito', 'rum-old-fashioned': 'rum old fashioned', 'kingston-negroni': 'rum negroni', 'corn-n-oil': 'falernum sipper',
  'hot-buttered-rum': 'hot buttered rum', 'tom-and-jerry': 'Tom and Jerry', 'hot-grog': 'hot grog', 'hot-rum-punch': 'hot punch',
  zombie: 'Zombie-style heavyweight', pilot: 'short Beachcomber heavyweight', 'cobras-fang': "Cobra's Fang-style heavyweight", tortuga: 'overproof heavyweight',
  'beachcomber-spice-sour': 'Beachcomber sour', 'pearl-diver': 'Pearl Diver-style punch', 'port-au-prince': 'Beachcomber sour', 'beachcombers-gold': 'Beachcomber daiquiri',
  'missionarys-downfall': 'mint-and-pineapple frappé', scorpion: 'orgeat punch', 'fog-cutter': 'orgeat punch', 'passion-sour': 'passion fruit sour',
  'bitter-tiki-sour': 'bitter tiki sour', 'bitters-base-sour': 'bitters sour', 'tropical-stirred': 'tropical old fashioned',
  'pina-colada': 'colada', 'fruit-colada': 'fruit colada', bushwacker: 'frozen dessert colada', 'coconut-daiquiri': 'coconut daiquiri',
  'miami-vice': 'two-tone frozen swirl', 'blue-hawaii': 'Blue Hawaii-style punch', hurricane: 'Hurricane-style punch', 'resort-liqueur-punch': 'resort punch',
  'hawaiian-mai-tai': 'Hawaiian-style Mai Tai', 'tropical-itch': 'resort punch', 'pineapple-shell': 'pineapple punch', 'sunrise-float': 'sunrise',
  'scorpion-bowl': 'scorpion bowl', 'volcano-bowl': 'volcano bowl', 'zero-proof-tiki': 'zero-proof tropical',
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
    // Spec lines carry volume in oz; some research files put the count in `oz` and the volume in
    // `ozEq` ("2 tsp" as oz: 2, ozEq: 0.333). Normalize to oz = volume, amount = count.
    const normLine = l => {
      const { ozEq, ...rest } = l;
      if (ozEq === undefined) return rest;
      const counted = l.unit && l.unit !== 'oz';
      return { ...rest, oz: ozEq, ...(counted ? { amount: l.amount ?? l.oz } : {}) };
    };
    // Bowl specs are written for the whole bowl ("Scorpion Punch, for twelve"); the composer
    // works per drink, so they are divided down and keep `batchOf` for the record.
    const perDrink = (l, n) => n > 1 ? { ...l, oz: Math.round(l.oz / n * 1000) / 1000, ...(l.amount !== undefined && l.unit !== 'oz' ? { amount: Math.max(1, Math.round(l.amount / n)) } : {}) } : l;
    const specs = (a.canonicalSpecs || []).map(sp => {
      const n = sp.servings > 1 ? sp.servings : 1;
      const { servings, ...rest } = sp;
      return { ...rest, ...(n > 1 ? { batchOf: n } : {}), lines: (sp.lines || []).filter(l => ing.has(l.id)).map(normLine).map(l => perDrink(l, n)), vessel: vesselIds.has(sp.vessel) ? sp.vessel : undefined };
    }).filter(sp => sp.lines.length);
    const vessels = (a.vessels || []).filter(v => vesselIds.has(v));
    const allIds = new Set([...sig, ...opt].flatMap(c => c.anyOf));
    const garnishText = [...((a.garnish || {}).required || []), ...((a.garnish || {}).typical || [])].join(' ').toLowerCase();
    const reqIds = new Set(sig.filter(c => c.required).flatMap(c => c.anyOf));
    const weight = Math.max(1, ...(a.classics || []).map(c => popByName.get(norm(c)) || 0));
    const rec = {
      id: a.id, name: a.name, family: a.family, noun: a.noun || NOUN_BY_ID[a.id] || NOUN[a.family] || a.name.toLowerCase(),
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
