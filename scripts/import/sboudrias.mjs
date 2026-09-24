#!/usr/bin/env node
/**
 * Importer: SBoudrias/cocktails book transcriptions → Tiki-God drink records.
 *
 * GETTING THE DATASET
 *   git clone https://github.com/SBoudrias/cocktails /path/to/cocktails
 *   Recipes live in  packages/data/data/recipes/book/<book>/**\/*.json  (schema: packages/data/schemas/recipe.schema.json)
 *   Ingredient/category definitions live in packages/data/data/{ingredients,categories}.
 *   The dataset is AGPL-3.0. We import only structured facts (ingredient names, quantities, preparation,
 *   ice, glass, attribution) and never copy its description or instruction prose; `notes` are generated
 *   below from structural facts.
 *
 * USAGE
 *   node scripts/import/sboudrias.mjs <path-to-cloned-repo> [--dry-run] [--verbose]
 *   Writes data/drinks/books.json, then run: node scripts/validate.mjs data/drinks/books.json
 *
 * WHAT IT DOES
 *   1. Reads every recipe of the books in BOOKS. Death & Co books go through isTropical() (explicit filter).
 *   2. Maps each ingredient through scripts/import/ingredient-map.json (lower-cased dataset name → our id,
 *      with factors/unit conversions/splits). A recipe with any `skip`/unmapped ingredient is skipped and
 *      reported; accent-only items marked `drop` are removed (recipe kept at medium confidence).
 *   3. Converts preparation → method, served_on → ice, glassware → glass text.
 *   4. Classifies the family with classifyFamily() (documented rules below).
 *   5. Dedupes across books (same normalized name + ingredient Jaccard ≥ 0.6 → keep the book with the
 *      highest BOOK_PRIORITY and note the other in `source`), then against every other data/drinks/*.json
 *      slice (same name/aka + Jaccard ≥ 0.6 → skip; same name but different spec → keep as a variant with
 *      an id suffix naming the book).
 *   6. Fills era/year/creator/venue from CLASSICS (drinks older than the book), existing records of the
 *      same name, or the book attribution; popularity and confidence per the rules in the header of
 *      buildRecord().
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'data/drinks/books.json');
const args = process.argv.slice(2);
const REPO = args.find(a => !a.startsWith('--'));
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
if (!REPO) {
  console.error('usage: node scripts/import/sboudrias.mjs <path-to-cloned-SBoudrias/cocktails> [--dry-run] [--verbose]');
  process.exit(2);
}
const DATA = join(REPO, 'packages/data/data');
if (!existsSync(join(DATA, 'recipes/book'))) {
  console.error(`not a SBoudrias/cocktails checkout: ${join(DATA, 'recipes/book')} missing`);
  process.exit(2);
}

const vocab = JSON.parse(readFileSync(join(ROOT, 'data/ingredients.json'), 'utf8'));
const V = Object.fromEntries(vocab.ingredients.map(i => [i.id, i]));
const UNIT_OZ = vocab.units;
const FAMILY_IDS = new Set(JSON.parse(readFileSync(join(ROOT, 'data/families.json'), 'utf8')).families.map(f => f.id));
const MAP = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ingredient-map.json'), 'utf8'));

// ───────────────────────────────────────────────────────────── books ──
// Priority (first wins in cross-book dedupe): older / more authoritative for tiki first.
const BOOKS = {
  'sippin-safari': { title: "Beachbum Berry's Sippin' Safari", short: "Sippin' Safari", year: 2007, suffix: 'sippin-safari', vintage: true },
  'smugglers-cove': { title: "Smuggler's Cove: Exotic Cocktails, Rum, and the Cult of Tiki", short: "Smuggler's Cove", year: 2016, suffix: 'smugglers-cove',
    creator: "Smuggler's Cove staff (Martin Cate)", venue: "Smuggler's Cove", location: 'San Francisco, California, USA' },
  'pdt-cocktail-book': { title: 'The PDT Cocktail Book', short: 'PDT', year: 2011, suffix: 'pdt', creator: 'Jim Meehan', venue: 'PDT', location: 'New York, New York, USA' },
  'death-and-co': { title: 'Death & Co: Modern Classic Cocktails', short: 'Death & Co', year: 2014, suffix: 'death-and-co', filter: true,
    venue: 'Death & Co', location: 'New York, New York, USA' },
  'tiki-modern-tropical-cocktails': { title: 'Tiki: Modern Tropical Cocktails', short: 'Tiki: Modern Tropical Cocktails', year: 2019, suffix: 'tiki-modern',
    creator: 'Shannon Mustipher' },
  'easy-tiki': { title: 'Easy Tiki', short: 'Easy Tiki', year: 2021, suffix: 'easy-tiki' },
  'death-co-welcome-home': { title: 'Death & Co: Welcome Home', short: 'Death & Co: Welcome Home', year: 2021, suffix: 'death-co-welcome-home', filter: true,
    venue: 'Death & Co' },
  'minimalist-tiki': { title: 'Minimalist Tiki', short: 'Minimalist Tiki', year: 2022, suffix: 'minimalist-tiki' },
  'tropical-standard': { title: 'Tropical Standard', short: 'Tropical Standard', year: 2023, suffix: 'tropical-standard', creator: 'Garret Richard' },
  // Publication year not verified at import time → printed as "Wonk Press" instead of a year.
  'coconuts-and-carnage': { title: 'Coconuts & Carnage', short: 'Coconuts & Carnage', year: null, publisher: 'Wonk Press', suffix: 'coconuts-and-carnage',
    creator: 'Justin Wojslaw', location: 'Seattle, Washington, USA' },
};
const BOOK_PRIORITY = Object.keys(BOOKS);
// Hand-curated slices (as listed in scripts/merge.mjs); their metadata wins over bulk-imported slices.
const SLICE_PRIORITY = ['don', 'vic', 'golden-venues', 'ancestors', 'resort', 'revival', 'craft', 'deep-cuts'];
const bookCite = b => `${BOOKS[b].title} (${BOOKS[b].year ?? BOOKS[b].publisher})`;
const SOURCE_URL = 'https://github.com/SBoudrias/cocktails';

// ─────────────────────────────────────────────────── classic metadata ──
// Drinks older than the book that reprints them and that may be missing from the other slices.
// Keyed by norm(name). Existing records of the same name take precedence (see classicMeta()).
const DON = { creator: 'Donn Beach', venue: 'Don the Beachcomber', location: 'Hollywood, California, USA' };
const VIC = { creator: 'Victor Bergeron', venue: "Trader Vic's", location: 'Oakland, California, USA' };
const CLASSICS = {
  'port au prince': { ...DON, era: 'golden', popularity: 2 },
  'pupule': { ...DON, era: 'golden', popularity: 1 },
  'demerara dry float': { ...DON, era: 'golden', popularity: 2 },
  'dons own grog': { ...DON, era: 'golden', popularity: 2 },
  'dons beach planter': { ...DON, era: 'golden', popularity: 1, parents: ["Planter's Punch"] },
  'caribbean punch': { ...DON, era: 'golden', popularity: 1 },
  'coffee grog': { ...DON, era: 'golden', popularity: 2 },
  'coola culla don': { ...DON, era: 'golden', popularity: 1 },
  'hot tigers milk': { ...DON, era: 'golden', popularity: 1 },
  'pearl divers punch': { ...DON, era: 'golden', popularity: 1, parents: ['Pearl Diver'] },
  'penang afrididi 1': { ...DON, era: 'golden', popularity: 1 },
  'penang afrididi 2': { ...DON, era: 'golden', popularity: 1, parents: ['Penang Afrididi #1'] },
  'rum julep': { ...DON, era: 'golden', popularity: 1 },
  'skull and bones': { ...DON, creator: 'Tony Ramos', era: 'golden', popularity: 1 },
  'dons special daiquiri': { ...DON, era: 'golden', popularity: 2, parents: ['Daiquiri'] },
  'puka puka punch': { ...DON, era: 'golden', popularity: 2 },
  'puka punch': { ...DON, era: 'golden', popularity: 2 },
  'big bamboo': { creator: 'Mariano Licudine', venue: 'Mai-Kai', location: 'Fort Lauderdale, Florida, USA', era: 'golden', popularity: 1 },
  'dr wong': { venue: 'The Luau', location: 'Beverly Hills, California, USA', era: 'golden', popularity: 1 },
  'jims special': { venue: 'Tiki-Ti', location: 'Los Angeles, California, USA', era: 'late-classic', popularity: 1 },
  'rain killer': { creator: 'Bob Esmino', era: 'golden', popularity: 1 },
  'queens road cocktail': { era: 'golden', popularity: 1 },
  'siboney': { ...VIC, era: 'golden', popularity: 1 },
  'trader vics sour': { ...VIC, era: 'golden', popularity: 1 },
  'royal bermuda yacht club': { era: 'golden', popularity: 2 },
  'bombo': { era: 'colonial', popularity: 1 },
  'el draque': { era: 'colonial', location: 'Cuba', popularity: 1, parents: [] },
  'cora middleton': { year: 1939, era: 'golden', popularity: 1 },
  'daisy de santiago': { year: 1939, era: 'golden', location: 'Santiago de Cuba, Cuba', popularity: 2 },
  'millionaire cocktail no 1': { year: 1930, era: 'pre-tiki', popularity: 1 },
  'parisian blonde': { year: 1930, era: 'pre-tiki', popularity: 1 },
  'twelve mile limit': { era: 'pre-tiki', popularity: 1 },
  'wray and ting': { era: 'late-classic', location: 'Jamaica', popularity: 2 },
  'batida de maracuja e coco': { era: 'golden', location: 'Brazil', popularity: 1 },
  'banshee': { era: 'late-classic', popularity: 2 },
  'frozen margarita': { year: 1971, era: 'late-classic', creator: 'Mariano Martinez', location: 'Dallas, Texas, USA', popularity: 4, parents: ['Margarita'] },
  'frozen daiquiri': { era: 'pre-tiki', location: 'Havana, Cuba', popularity: 4, parents: ['Daiquiri'] },
};
// Names that are the same drink under another spelling.
const NAME_ALIASES = { 'mojito criollo no 1': 'mojito', 'zombie punch': 'zombie', 'halekulani': 'halekulani cocktail' };
// Craft-era drinks known well beyond one book (popularity 3).
const MODERN_CLASSICS = new Set(['lost lake', 'chartreuse swizzle', 'trinidad sour', 'kingston negroni', 'bitter mai tai', 'tia mia', 'nuclear daiquiri', 'paniolo old fashioned']);

// ─────────────────────────────────────────────────────────── helpers ──
export const norm = s => (s || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^the\s+/, '').replace(/['’`".]/g, '').replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const stripParens = s => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
const slug = s => s.replace(/(\d)\.(\d)/g, '$1-$2').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
  .replace(/['’`.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const round = x => Math.round(x * 1000) / 1000;
const ascii = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function walk(d) {
  let out = [];
  for (const e of readdirSync(d).sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (e.endsWith('.json') && e !== '_source.json') out.push(p);
  }
  return out;
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}
// Ingredient ids used for spec comparison (seasoning and garnish don't define a spec).
// House mixes are expanded so "Don's Mix" and "grapefruit + cinnamon syrup" compare equal.
const EXPAND = { 'dons-mix': ['grapefruit', 'cinnamon-syrup'], 'dons-spices-2': ['vanilla-syrup', 'allspice-dram'] };
const specIds = ings => ings.filter(i => !i.garnish && i.id !== 'saline').flatMap(i => EXPAND[i.id] || [i.id]);

// Sentence-case names ("Don's own grog") → title case; names already capitalised are kept.
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'de', 'du', 'la', 'le', 'e', 'y', 'for', 'or', 'del']);
function titleCase(name) {
  const words = name.split(' ');
  const lowerRest = words.slice(1).filter(w => /^[a-z]/.test(w)).length;
  if (lowerRest === 0) return name;
  return words.map((w, i) => {
    if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
const US_STATES = { AL: 'Alabama', AZ: 'Arizona', CA: 'California', CO: 'Colorado', DC: 'District of Columbia', FL: 'Florida', HI: 'Hawaii', IL: 'Illinois',
  IN: 'Indiana', LA: 'Louisiana', MA: 'Massachusetts', MI: 'Michigan', NC: 'North Carolina', NV: 'Nevada', NY: 'New York', OH: 'Ohio', OR: 'Oregon',
  PA: 'Pennsylvania', SC: 'South Carolina', TN: 'Tennessee', TX: 'Texas', WA: 'Washington', WI: 'Wisconsin' };
function expandLocation(loc) {
  if (!loc) return null;
  const m = loc.match(/^(.*),\s*([A-Z]{2})$/);
  if (m && US_STATES[m[2]]) return `${m[1]}, ${US_STATES[m[2]]}, USA`;
  if (m && m[2] === 'BC') return `${m[1]}, British Columbia, Canada`;
  if (m && m[2] === 'UK') return `${m[1]}, United Kingdom`;
  return loc;
}

// ───────────────────────────────────────────────── ingredient mapping ──
const mapEntry = name => {
  const e = MAP[name.toLowerCase().trim()];
  if (e === undefined) return null;
  return typeof e === 'string' ? { id: e } : e;
};
const GENERIC_UNITS = { oz: 'oz', ml: 'ml', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', dash: 'dash', drop: 'drop', pinch: 'pinch' };
const vocabBase = id => V[id].name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
const fmtQty = q => `${round(q.amount)}${q.unit === 'unit' ? ' ×' : ' ' + q.unit}`;
const HOT_AGENTS = /jalape|habanero|chile|chili|pepper/i;

/**
 * Convert one dataset ingredient. Returns { ings[], approx[], dropped[], skip?, garnishText?, hot, muddled }.
 */
function convertIngredient(raw, book) {
  const name = raw.name;
  const q = raw.quantity;
  const res = { ings: [], approx: [], dropped: [], hot: false, muddled: false };
  const entry = mapEntry(name);
  if (!entry) { res.skip = { name: name.toLowerCase(), reason: 'no map entry' }; return res; }
  if (entry.skip) { res.skip = { name: name.toLowerCase(), reason: entry.skip }; return res; }
  const techs = [].concat(raw.technique || []);
  // Peels and zests are aromatics on the glass, not measured juice.
  if (techs.some(t => t.technique === 'cut' && ['peeled', 'zested'].includes(t.type))) {
    res.garnishText = `${name.toLowerCase()} peel`;
    return res;
  }
  if (entry.drop) { res.dropped.push(`${name} (${entry.drop})`); return res; }
  if (q.unit === 'pinch' && /^lemon$/i.test(name)) { res.dropped.push(`${name} zest`); return res; }

  let origNotes = [];
  let approx = !!entry.approx;
  let float = false;
  let top = false;
  let rinse = false;
  for (const t of techs) {
    if (t.technique === 'application' && t.method === 'float') float = true;
    else if (t.technique === 'application' && t.method === 'top') top = true;
    else if (t.technique === 'application' && t.method === 'rinse') rinse = true;
    else if (t.technique === 'infusion') { approx = true; origNotes.push(`infused with ${t.agent}`); }
    else if (t.technique === 'fat-wash') { approx = true; origNotes.push(`${t.fat} fat-washed`); }
    else if (t.technique === 'acid-adjustment') { approx = true; origNotes.push('acid-adjusted'); }
    else if (t.technique === 'temperature' && ['hot', 'boiling'].includes(t.method)) res.hot = true;
    else if (t.technique === 'muddled') res.muddled = true;
  }
  if (/boiling|hot water/i.test(name)) res.hot = true;

  // Resolve target unit + amount multiplier.
  let unit, factor = entry.factor ?? 1, amount = q.amount;
  const perUnit = entry.units?.[q.unit];
  if (rinse) { unit = 'rinse'; amount = 1; factor = 1; }
  else if (top && (q.unit === 'part' || q.unit === 'unit')) { unit = 'top'; amount = undefined; }
  else if (perUnit) { unit = perUnit.unit; factor *= perUnit.factor; }
  else if (q.unit === 'spray') { unit = 'rinse'; amount = 1; factor = 1; }
  else if (GENERIC_UNITS[q.unit]) unit = entry.unit || GENERIC_UNITS[q.unit];
  else if (q.unit === 'unit' && entry.id && V[entry.id]?.oz_per_piece) unit = 'piece';
  else { res.skip = { name: `${name.toLowerCase()} [${q.unit}]`, reason: `no conversion for unit "${q.unit}"` }; return res; }

  const convertedUnit = q.unit !== unit && !(q.unit === 'part' && unit === 'top');
  const parts = entry.split || [{ id: entry.byBook?.[book] ?? entry.id, factor: 1 }];
  for (const p of parts) {
    if (!V[p.id]) throw new Error(`ingredient-map: "${name}" → unknown id "${p.id}"`);
    const ing = { id: p.id };
    const u = p.unit || unit;
    if (u === 'top') ing.unit = 'top';
    else if (['garnish', 'leaves', 'sprig', 'slice', 'pinch'].includes(u) && amount === undefined) ing.unit = u;
    else { ing.amount = round(amount * factor * (p.factor ?? 1)); ing.unit = u; }
    if (p.unit === 'garnish') { delete ing.amount; ing.unit = 'garnish'; }
    const trivial = name.toLowerCase() === vocabBase(p.id) && !convertedUnit && factor === 1 && !parts[1];
    const orig = [convertedUnit || factor !== 1 ? `${fmtQty(q)} ${name}` : name, ...origNotes].join(', ');
    if (!trivial || origNotes.length) ing.orig = orig + (q.modifier ? ` (${q.modifier})` : '');
    if (float) ing.float = true;
    if (entry.garnish || ing.unit === 'garnish') ing.garnish = true;
    res.ings.push(ing);
  }
  // Chile infusions keep their heat as an aromatic.
  for (const t of techs) {
    if (t.technique === 'infusion' && HOT_AGENTS.test(t.agent || '')) res.ings.push({ id: 'jalapeno', unit: 'garnish', garnish: true, orig: `${t.agent} infusion in ${name}` });
    if (t.technique === 'infusion' && /cinnamon/i.test(t.agent || '')) res.ings.push({ id: 'cinnamon', unit: 'garnish', garnish: true, orig: `${t.agent} infusion in ${name}` });
  }
  if (approx) res.approx.push(name);
  return res;
}

// ─────────────────────────────────────── Death & Co tropical filter ──
// Explicit judgment rule for the two Death & Co books (they are mostly non-tiki). A marker only counts
// when it is used at ≥ 1/4 oz (a barspoon of banana liqueur in a stirred whiskey drink is not tropical).
//   A. tiki signal:   ≥1 STRONG marker (orgeat, falernum, allspice dram, passion fruit, pineapple, coconut,
//                     guava, banana), OR swizzled / flash-blended, OR cinnamon syrup in a citrus sour on a
//                     rum-led base (Donn's cinnamon-spiced sours);
//   B. character:     rum/cane/arrack + agave ≥ 50% of the alcoholic volume (spirits, liqueurs, fortified
//                     wine), OR ≥2 distinct strong markers (tropical even on another base);
//   C. exclusion:     spirit-forward (stirred, or no citrus) AND agave-led AND <2 strong markers
//                     (an agave stirred drink with one tiki accent is an agave cocktail, not a tropical one).
//   include = A && B && !C
const STRONG_MARKERS = [
  ['orgeat', /orgeat|macadamia nut syrup/i], ['falernum', /falernum/i], ['allspice', /allspice|pimento dram/i],
  ['passion fruit', /passion ?fruit|fassionola/i], ['pineapple', /pineapple/i], ['coconut', /coconut|\bcoco\b/i],
  ['guava', /guava/i], ['banana', /banana|banane/i],
];
const CINNAMON_SYRUP = /(cinnamon|cassia).*syrup/i;
const RUM_LIKE = id => V[id]?.cat === 'rum' && id !== 'coconut-rum' || id === 'batavia-arrack';
const AGAVE = id => ['tequila-blanco', 'tequila-reposado', 'mezcal'].includes(id);
const isBaseSpirit = id => V[id] && V[id].role === 'base' && (V[id].cat === 'rum' || V[id].cat === 'spirit');
const SOUR = new Set(['lime', 'lemon', 'grapefruit', 'yuzu-juice', 'lime-cordial']);
// Accent spirits (Islay Scotch, absinthe) count as a base when poured by the ounce.
const isBaseIng = i => isBaseSpirit(i.id) || (V[i.id]?.cat === 'spirit' && i.unit === 'oz' && i.amount >= 1);
const RAW_OZ = { oz: 1, tsp: 1 / 6, tbsp: 0.5, ml: 1 / 29.57, cup: 8 };

// Dataset category chain of a raw ingredient (used to classify spirits we could not map).
const catCache = new Map();
function datasetCategories(ri) {
  const key = `${ri.type}|${ri.name}`;
  if (catCache.has(key)) return catCache.get(key);
  const dsSlug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/['’ʻ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const read = p => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
  const chain = (name, seen = new Set()) => {
    const sl = dsSlug(name);
    if (seen.has(sl)) return [];
    seen.add(sl);
    const j = read(join(DATA, 'categories', `${sl}.json`));
    return j ? [j.name, ...(j.parents || []).flatMap(p => chain(p, seen))] : [name];
  };
  const own = ri.type === 'category' ? [ri.name] : (read(join(DATA, 'ingredients', ri.type, `${dsSlug(ri.name)}.json`))?.categories || []);
  const out = own.flatMap(c => chain(c)).map(c => c.toLowerCase());
  catCache.set(key, out);
  return out;
}
function alcoholClass(ri, ids) {
  if (ids.length) {
    if (ids.some(RUM_LIKE)) return 'rum';
    if (ids.some(AGAVE)) return 'agave';
    if (ids.some(id => V[id].abv >= 10 && V[id].cat !== 'bitters')) return 'other';
    return null;
  }
  const txt = [ri.name.toLowerCase(), ...datasetCategories(ri)].join(' | ');
  if (/\brum\b|rhum|cacha|arrack|charanda|clairin|aguardiente de ca/.test(txt)) return 'rum';
  if (/tequila|mezcal|sotol|raicilla|bacanora/.test(txt)) return 'agave';
  if (['spirit', 'liqueur', 'wine'].includes(ri.type) || /whisk|gin\b|vodka|brandy|cognac|pisco|aquavit|liqueur|vermouth|sherry|amaro/.test(txt)) return 'other';
  return null;
}
function isTropical(raw, book) {
  const strong = new Set();
  let cinnamon = false, citrus = false, rum = 0, agave = 0, other = 0;
  for (const ri of raw.ingredients) {
    const q = ri.quantity;
    const oz = RAW_OZ[q.unit] ? q.amount * RAW_OZ[q.unit] : (q.unit === 'unit' && /pineapple|banana|coconut/i.test(ri.name) ? 0.25 * q.amount : 0);
    for (const [k, re] of STRONG_MARKERS) if (re.test(ri.name) && oz >= 0.25) strong.add(k);
    if (CINNAMON_SYRUP.test(ri.name) && oz >= 0.125) cinnamon = true;
    const ids = convertIngredient(ri, book).ings.map(i => i.id);
    if (ids.some(id => SOUR.has(id))) citrus = true;
    const cls = alcoholClass(ri, ids);
    const ozA = RAW_OZ[q.unit] ? q.amount * RAW_OZ[q.unit] : 0;
    if (cls === 'rum') rum += ozA; else if (cls === 'agave') agave += ozA; else if (cls === 'other') other += ozA;
  }
  const alc = rum + agave + other;
  const rumLed = rum > 0 && rum >= agave && rum >= other;
  const agaveLed = agave > rum && agave >= other;
  const swizzled = raw.preparation === 'swizzled' || raw.preparation === 'flash blended';
  const A = strong.size >= 1 || swizzled || (cinnamon && citrus && rumLed);
  const B = (alc > 0 && (rum + agave) / alc >= 0.5) || strong.size >= 2;
  const spiritForward = raw.preparation === 'stirred' || !citrus;
  const C = spiritForward && agaveLed && strong.size < 2;
  return { include: A && B && !C, strong: [...strong], why: { A, B, C, rum, agave, other } };
}

// ────────────────────────────────────────────────── family classifier ──
// Rules, first match wins (name keywords are checked before structure):
//   hot           served hot (hot water / hot coffee / boiling water)
//   zombie        'zombie' in name, or a sour with ≥3 base spirits (≥2.5 oz) incl. a true overproof (≥60% abv)
//                 + falernum/grenadine/anise
//   mai-tai       'mai tai' in name with orgeat, or spirit + lime + orange liqueur + orgeat
//   grog          'grog' in name, or ≥2 rums + honey + grapefruit
//   swizzle       swizzled (or 'swizzle' in name)
//   colada        'colada' in name, coconut + pineapple, or coconut-forward and creamy (≥1 oz coconut cream/milk)
//   bitter-tiki   Campari/amaro/Aperol/Cynar/Fernet (and Angostura used by the ounce) totalling ≥ 0.5 oz
//   buck          ≥2 oz ginger beer/ale, soda, tonic or sparkling (a 'top' counts 2 oz) in a short build
//                 (built/stirred/shaken, ≤5 measured ingredients besides bitters/garnish)
//   stirred       stirred, or built with no sour citrus, no fruit juice and no dairy
//   orgeat-punch  orgeat + lemon/orange on a base that is ≥1/3 brandy/gin/pisco/applejack
//   resort-punch  ≥2 different non-sour fruit juices totalling ≥2 oz
//   beachcomber-sour  spice modifier (falernum/allspice/cinnamon/honey/Don's mixes/gardenia) on a rum + lime/lemon core
//   daiquiri      simple spirit sour: sour citrus + sweetener, ≤5 measured ingredients (or 'daiquiri' in name)
//   punch         everything else
// Secondary families: every other structural rule that also matches (except daiquiri/punch/stirred), max 2.
const OZ = i => {
  if (i.unit === 'top') return 2;
  if (i.unit === 'piece') return (V[i.id].oz_per_piece || 0) * (i.amount || 0);
  return (UNIT_OZ[i.unit] ?? 0) * (i.amount || 0);
};
const LENGTHENERS = new Set(['ginger-beer', 'ginger-ale', 'soda-water', 'tonic', 'sparkling-wine', 'lemon-lime-soda', 'cola']);
const ORANGE_LIQ = new Set(['orange-curacao', 'triple-sec', 'blue-curacao']);
const BITTER = new Set(['campari', 'amaro', 'aperol', 'cynar', 'fernet', 'angostura']);
const SPICE_MODS = new Set(['velvet-falernum', 'falernum-syrup', 'allspice-dram', 'cinnamon-syrup', 'honey-syrup', 'dons-mix', 'dons-spices-2', 'gardenia-mix']);
const FRUIT_JUICE = new Set(['pineapple-juice', 'orange', 'passion-fruit-juice', 'passion-fruit-nectar', 'guava-nectar', 'mango-nectar', 'papaya-nectar',
  'apricot-nectar', 'cranberry-juice', 'pomegranate-juice', 'apple-juice', 'watermelon-juice', 'coconut-water']);
const SWEET = id => V[id]?.role === 'sweet' || ['velvet-falernum', 'orange-curacao', 'triple-sec', 'maraschino', 'coconut-cream'].includes(id);

function classifyFamily(d, name) {
  const n = norm(name);
  const ids = new Set(d.ingredients.map(i => i.id));
  const oz = id => d.ingredients.filter(i => i.id === id).reduce((s, i) => s + OZ(i), 0);
  const bases = d.ingredients.filter(i => isBaseIng(i) && OZ(i) >= 0.25);
  const baseIds = new Set(bases.filter(i => OZ(i) >= 0.5).map(i => i.id));
  const rums = new Set(bases.filter(i => V[i.id].cat === 'rum').map(i => i.id));
  const baseOz = bases.reduce((s, i) => s + OZ(i), 0);
  const rumOz = bases.filter(i => V[i.id].cat === 'rum' || i.id === 'batavia-arrack').reduce((s, i) => s + OZ(i), 0);
  const overproof = bases.some(i => V[i.id].abv >= 60); // true overproofs (151s, OFTD, Wray & Nephew), not 57% navy-strength pot still
  const hasSour = [...ids].some(id => SOUR.has(id));
  const measured = d.ingredients.filter(i => !i.garnish && !['dash', 'drop', 'rinse', 'pinch', 'leaves', 'garnish', 'sprig'].includes(i.unit) && i.id !== 'saline');
  const juices = [...ids].filter(id => FRUIT_JUICE.has(id));
  const juiceOz = juices.reduce((s, id) => s + oz(id), 0);
  const lengthOz = [...ids].filter(id => LENGTHENERS.has(id)).reduce((s, id) => s + oz(id), 0);
  const coconut = ['coconut-cream', 'coconut-milk', 'coconut-rum'].some(id => ids.has(id));
  const creamy = ['heavy-cream', 'half-and-half', 'vanilla-ice-cream'].some(id => ids.has(id));
  const bitterOz = [...ids].filter(id => BITTER.has(id)).reduce((s, id) => s + (id === 'angostura' ? (oz(id) >= 0.5 ? oz(id) : 0) : oz(id)), 0);
  const brandyGinOz = bases.filter(i => ['brandy', 'gin', 'gin-old-tom', 'pisco', 'applejack'].includes(i.id)).reduce((s, i) => s + OZ(i), 0);

  const rules = [
    ['hot', d.method === 'hot'],
    ['zombie', /\bzombie\b/.test(n) || (baseIds.size >= 3 && overproof && hasSour && baseOz >= 2.5 && ['velvet-falernum', 'falernum-syrup', 'grenadine', 'pastis', 'absinthe'].some(id => ids.has(id)))],
    ['mai-tai', (/\bmai tai\b|\btai\b/.test(n) && ids.has('orgeat')) || (bases.length > 0 && ids.has('lime') && [...ORANGE_LIQ].some(id => ids.has(id)) && ids.has('orgeat'))],
    ['grog', /grog/.test(n) || (rums.size >= 2 && ids.has('honey-syrup') && ids.has('grapefruit'))],
    ['swizzle', d.method === 'swizzle' || (/\bswizzle\b/.test(n) && d.ice === 'crushed')],
    ['colada', /colada/.test(n) || (coconut && (ids.has('pineapple-juice') || ids.has('rum-pineapple') || ids.has('pineapple-syrup'))) || oz('coconut-cream') + oz('coconut-milk') >= 1 || (coconut && creamy)],
    ['bitter-tiki', bitterOz >= 0.5],
    ['buck', lengthOz >= 2 && ['build', 'muddle-build', 'stir', 'shake'].includes(d.method) && measured.filter(i => !LENGTHENERS.has(i.id)).length <= 5],
    ['stirred', d.method === 'stir' || (['build', 'muddle-build'].includes(d.method) && !hasSour && juiceOz < 1 && !creamy)],
    ['orgeat-punch', ids.has('orgeat') && (ids.has('lemon') || ids.has('orange')) && baseOz > 0 && brandyGinOz / baseOz >= 1 / 3],
    ['resort-punch', juices.filter(id => id !== 'coconut-water').length >= 2 && juiceOz >= 2],
    ['beachcomber-sour', [...ids].some(id => SPICE_MODS.has(id)) && baseOz > 0 && rumOz / baseOz >= 0.5 && (ids.has('lime') || ids.has('lemon'))],
    ['daiquiri', (hasSour && [...ids].some(SWEET) && measured.length <= 5) || /daiquiri/.test(n)],
    ['punch', true],
  ];
  const matched = rules.filter(([, ok]) => ok).map(([f]) => f);
  const family = matched[0];
  const secondary = matched.slice(1).filter(f => !['daiquiri', 'punch', 'stirred', family].includes(f)).slice(0, 2);
  return { family, secondary };
}

// ─────────────────────────────────────────────────────── notes / text ──
const RUM_LABEL = {
  'rum-white-column': 'light column-still rum', 'rum-gold-column': 'gold column-still rum', 'rum-aged-column': 'aged Spanish-style rum',
  'rum-blended-light': 'lightly aged blended rum', 'rum-barbados': 'aged Barbados-style rum', 'rum-jamaican-aged': 'aged Jamaican rum',
  'rum-jamaican-dark': 'dark Jamaican rum', 'rum-jamaican-pot': 'Jamaican pot-still rum', 'rum-jamaican-white-overproof': 'unaged Jamaican overproof rum',
  'rum-demerara': 'Demerara rum', 'rum-demerara-overproof': 'Demerara 151', 'rum-black-blended': 'black blended rum', 'rum-black-overproof': 'black overproof rum',
  'rum-agricole-blanc': 'rhum agricole blanc', 'rum-agricole-vieux': 'aged rhum agricole', 'rum-haitian': 'Haitian rum', 'rum-navy': 'navy-style rum',
  'rum-overproof-white': 'white 151 rum', 'rum-spiced': 'spiced rum', 'rum-pineapple': 'pineapple rum', 'rum-cachaca': 'cachaça',
  'batavia-arrack': 'Batavia arrack', 'gin': 'gin', 'tequila-blanco': 'blanco tequila', 'tequila-reposado': 'reposado tequila', 'scotch-islay': 'Islay Scotch',
  'scotch-blended': 'blended Scotch', 'irish-whiskey': 'Irish whiskey', 'applejack': 'apple brandy',
};
const PROPER = /^(Campari|Aperol|Cynar|Fernet|Drambuie|Bénédictine|Galliano|Green Chartreuse|Yellow Chartreuse|Cherry Heering|Licor 43|Angostura|Peychaud|Don's|Gardenia|Swedish|Batavia|Irish|Islay|Pedro|Lillet)/;
function label(id) {
  if (RUM_LABEL[id]) return RUM_LABEL[id];
  const n = V[id].name.replace(/\s*\([^)]*\)/g, '').split(' / ')[0].trim();
  return PROPER.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
}
const an = s => `${/^[aeiou]/i.test(s) ? 'an' : 'a'} ${s}`;
const list = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const ERA_WORD = { colonial: 'colonial-era', 'pre-tiki': 'pre-tiki', golden: 'golden-era', 'late-classic': '1960s–70s', decline: '1980s–90s' };
const METHOD_PHRASE = { 'flash-blend': 'flash-blended', blend: 'blended frozen', swizzle: 'swizzled over crushed ice', stir: 'stirred', build: 'built in the glass',
  'muddle-build': 'muddled and built', hot: 'served hot', shake: 'shaken' };

function structureText(d) {
  const ings = d.ingredients.filter(i => !i.garnish);
  const bases = ings.filter(i => isBaseIng(i) && OZ(i) >= 0.25).sort((a, b) => OZ(b) - OZ(a));
  const uniq = xs => [...new Set(xs)];
  const baseLabels = uniq(bases.map(i => label(i.id)));
  let baseTxt = baseLabels.length > 2 ? `a ${baseLabels.length}-spirit blend led by ${baseLabels[0]}` : list(baseLabels);
  if (baseLabels.length === 2 && bases.every(i => V[i.id].cat === 'rum')) baseTxt = an(`${baseLabels[0].replace(/ rum$/, '')}/${baseLabels[1]} split`);
  const citrus = uniq(ings.filter(i => SOUR.has(i.id) && i.id !== 'lime-cordial').map(i => label(i.id).replace(/ juice$/, '')));
  const skip = new Set(['simple-syrup', 'rich-simple', 'demerara-syrup', 'water', 'saline', 'soda-water', ...SOUR]);
  const mods = uniq(ings.filter(i => !bases.includes(i) && !skip.has(i.id) && !(V[i.id].role === 'accent' && OZ(i) < 0.25) && !LENGTHENERS.has(i.id))
    .sort((a, b) => OZ(b) - OZ(a)).map(i => label(i.id))).slice(0, 3);
  const withs = [...citrus, ...mods];
  const len = ings.filter(i => LENGTHENERS.has(i.id)).map(i => label(i.id));
  let txt = baseTxt ? `${baseTxt}${withs.length ? ` with ${list(withs)}` : ''}` : list(withs);
  if (len.length) txt += `, lengthened with ${list(uniq(len))}`;
  return txt;
}

// ──────────────────────────────────────────────────── existing slices ──
function loadExisting() {
  const dir = join(ROOT, 'data/drinks');
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || f.endsWith('.new-ingredients.json') || f === basename(OUT)) continue;
    try { for (const d of JSON.parse(readFileSync(join(dir, f), 'utf8'))) out.push({ ...d, _slice: f.replace(/\.json$/, '') }); }
    catch (e) { console.warn(`warn: could not read ${f}: ${e.message}`); }
  }
  return out;
}
// Primary name (with and without a trailing parenthetical) plus each aka verbatim — an aka such as
// "Navy Grog (original)" must not collapse onto "Navy Grog".
const nameKeys = (name, aka = []) => {
  const ks = new Set();
  for (const k of [norm(name), norm(stripParens(name)), ...aka.map(norm)]) if (k) { ks.add(k); if (NAME_ALIASES[k]) ks.add(NAME_ALIASES[k]); }
  return [...ks];
};

// ───────────────────────────────────────────────────────── parents ──
// Lineage by name: a record whose name contains one of these drink names descends from it.
const LINEAGE = [
  ['mai tai', 'Mai Tai'], ['zombie', 'Zombie'], ['scorpion', 'Scorpion'], ['grog', 'Navy Grog'], ['fog cutter', 'Fog Cutter'],
  ['missionarys downfall', "Missionary's Downfall"], ['pina colada', 'Piña Colada'], ['colada', 'Piña Colada'], ['painkiller', 'Painkiller'],
  ['jungle bird', 'Jungle Bird'], ['planters punch', "Planter's Punch"], ['hurricane', 'Hurricane'], ['pearl diver', 'Pearl Diver'],
  ['three dots and a dash', 'Three Dots and a Dash'], ['test pilot', 'Test Pilot'], ['jet pilot', 'Jet Pilot'], ['donga punch', 'Donga Punch'],
  ['nui nui', 'Nui Nui'], ['cobras fang', "Cobra's Fang"], ['hemingway daiquiri', 'Hemingway Daiquiri'], ['derby daiquiri', 'Derby Daiquiri'],
  ['banana daiquiri', 'Banana Daiquiri'], ['strawberry daiquiri', 'Strawberry Daiquiri'], ['daiquiri', 'Daiquiri'], ['ti punch', "Ti' Punch"],
  ['doctor funk', 'Doctor Funk'], ['lei lani volcano', 'Lei Lani Volcano'], ['peachtree punch', 'Peachtree Punch'],
  ['port light', 'Port Light'], ['suffering bastard', 'Suffering Bastard'], ['singapore sling', 'Singapore Sling'], ['negroni', 'Negroni'],
  ['old fashioned', 'Old Fashioned'], ['manhattan', 'Manhattan'], ['mojito', 'Mojito'], ['caipirinha', 'Caipirinha'], ['el diablo', 'El Diablo'],
  ['margarita', 'Margarita'], ['blue hawaii', 'Blue Hawaii'], ['queens park swizzle', "Queen's Park Swizzle"], ['corn and oil', "Corn 'n' Oil"],
  ['trinidad sour', 'Trinidad Sour'], ['julep', 'Mint Julep'], ['penang afrididi', 'Penang Afrididi'], ['rum barrel', 'Rum Barrel'],
  ['hot buttered rum', 'Hot Buttered Rum'], ['navy grog', 'Navy Grog'], ['mary pickford', 'Mary Pickford'], ['el presidente', 'El Presidente'],
];
const PARENTS = {
  'three scots and a dash': ['Three Dots and a Dash'], 'reverends tai': ['Mai Tai'], 'pkny': ['Painkiller'], 'donga daiquiri': ['Donga Punch', 'Daiquiri'],
  'rbr rum barrel remix': ['Rum Barrel'], 'rays mystique': ["Ray's Mistake"], 'blue leilani': ['Blue Hawaii'], 'doctor funkenstein': ['Doctor Funk'],
  'dr funk e sanchez': ['Doctor Funk'], 'shaken missionarys downfall': ["Missionary's Downfall"], 'ti punch vieux': ["Ti' Punch"],
  'the last fang': ["Cobra's Fang"], 'last fang': ["Cobra's Fang"], 'copperheads fang': ["Cobra's Fang"], 'banana life redux': ['Banana Life'],
  'penang punch': ['Penang Afrididi'], 'frosty buck': [], 'slushy dog': ['Salty Dog'], 'shochulada': ['Piña Colada'],
  'sparkling mai tai': ['Mai Tai'], 'improved bajan rum punch': ['Barbados Rum Punch'], 'lost navigator': [], 'sub mariner': [],
};
function parentsFor(name, known) {
  const n = norm(name);
  if (PARENTS[n]) return PARENTS[n];
  if (n === 'grog') return [];
  const m2 = name.match(/^(.*)\s+2\.0$/);
  if (m2) return [titleCase(m2[1])];
  for (const [k, parent] of LINEAGE) {
    if (norm(parent) === n || NAME_ALIASES[n] === norm(parent)) return [];
    if (new RegExp(`(^| )${k}( |$)`).test(n)) return [parent];
  }
  return known || [];
}

// ────────────────────────────────────────────────────────── recipe → record ──
const METHOD = { shaken: 'shake', 'flash blended': 'flash-blend', blended: 'blend', swizzled: 'swizzle', built: 'build', stirred: 'stir', other: 'build' };
const ICE = { 'crushed ice': 'crushed', 'ice cubes': 'cubed', 'big rock': 'block', up: 'cubed', blended: 'blended' };
const GLASS = { 'old fashioned': 'old fashioned', collins: 'collins', highball: 'highball', snifter: 'snifter', coupe: 'coupe', martini: 'cocktail glass',
  'nick & nora': 'Nick & Nora', irish: 'Irish coffee glass', hurricane: 'hurricane', julep: 'julep cup', mule: 'copper mug', tiki: 'tiki mug',
  punch: 'punch bowl', flute: 'flute', 'footed pilsner': 'footed pilsner', goblet: 'goblet', 'wine glass': 'wine glass' };

// Dataset quirks fixed by hand (book/relative-path → patch function).
const FIXES = {
  // 7 oz Peychaud's is a transcription slip for 7 dashes.
  'smugglers-cove/07_Understanding Rum/richard-sealebach.json': r => { for (const i of r.ingredients) if (/peychaud/i.test(i.name)) i.quantity = { amount: 7, unit: 'dash' }; },
  // '6 oz pineapple' is six 1-inch chunks (cf. the Boo Loo in deep-cuts).
  "smugglers-cove/08_The Theater of Exotic Cocktail/boo-loo.json": r => { for (const i of r.ingredients) if (i.name === 'pineapple') i.quantity = { amount: 6, unit: 'unit' }; },
  // Six lime wedges ≈ one lime ≈ 1 oz juice.
  'tropical-standard/03_Preparations - Shaken - Hybrid/caipirinha.json': r => { for (const i of r.ingredients) if (i.name === 'lime') i.quantity = { amount: 4, unit: 'unit' }; },
  'tropical-standard/03_Preparations - Shaken - Hybrid/pina-brava.json': r => { for (const i of r.ingredients) if (i.name === 'lime') i.quantity = { amount: 4, unit: 'unit' }; },
};
// Bowls printed without a serving count.
const SERVINGS = { "smugglers-cove:scorpion": 4, "smugglers-cove:top notch volcano": 4, "smugglers-cove:arrack punch": 4, "smugglers-cove:boo loo": 2 };

function readRecipes() {
  const out = [];
  for (const book of BOOK_PRIORITY) {
    const dir = join(DATA, 'recipes/book', book);
    if (!existsSync(dir)) { console.warn(`warn: book "${book}" not found in dataset`); continue; }
    for (const file of walk(dir)) {
      const rel = `${book}/${relative(dir, file)}`;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      if (FIXES[rel]) FIXES[rel](raw);
      out.push({ book, rel, chapter: relative(dir, dirname(file)), raw });
    }
  }
  return out;
}

function convertRecipe(rec) {
  const { raw, book } = rec;
  const ings = [], approx = [], dropped = [], skips = [], garnish = [];
  let hot = false, muddled = false;
  const names = new Set(raw.ingredients.map(i => i.name.toLowerCase()));
  for (const ri of raw.ingredients) {
    // A whole lime/lemon/orange/grapefruit counted by the piece next to its own juice is the garnish (shell, wheel).
    const fruit = ri.name.toLowerCase();
    if (ri.quantity.unit === 'unit' && ['lime', 'lemon', 'orange', 'grapefruit'].includes(fruit) && names.has(`${fruit} juice`)
      && ![].concat(ri.technique || []).some(t => t.technique === 'muddled')) { garnish.push(`${fruit} (spent shell / wheel)`); continue; }
    const c = convertIngredient(ri, book);
    if (c.skip) skips.push(c.skip);
    ings.push(...c.ings); approx.push(...c.approx); dropped.push(...c.dropped);
    if (c.garnishText) garnish.push(c.garnishText);
    hot ||= c.hot; muddled ||= c.muddled;
  }
  // Merge duplicate ids that share a unit (e.g. split mixes landing on an id already present).
  const merged = [];
  for (const i of ings) {
    const prev = merged.find(m => m.id === i.id && m.unit === i.unit && m.amount !== undefined && i.amount !== undefined && !m.float && !i.float && !m.garnish && !i.garnish);
    if (prev) { prev.amount = round(prev.amount + i.amount); prev.orig = [prev.orig, i.orig].filter(Boolean).join(' + ') || undefined; if (!prev.orig) delete prev.orig; }
    else merged.push(i);
  }
  if (/\bhot\b/i.test(raw.name) && merged.some(i => ['hot-water', 'coffee', 'black-tea'].includes(i.id))) hot = true;
  if (merged.some(i => i.id === 'hot-water') || merged.some(i => i.id === 'hot-buttered-rum-batter')) hot = true;
  if (raw.glassware === 'irish' && merged.some(i => ['coffee', 'black-tea'].includes(i.id) && OZ(i) >= 3)) hot = true;
  let method = METHOD[raw.preparation] || 'build';
  const fruitUnits = raw.ingredients.some(i => i.quantity.unit === 'unit' && /^(lime|lemon|mint leaves|orange|sugar cube)$/i.test(i.name));
  if (['build', 'stir'].includes(method) && (muddled || (raw.preparation !== 'stirred' && fruitUnits))) method = 'muddle-build';
  let ice = ICE[raw.served_on] || 'cubed';
  if (hot) { method = 'hot'; ice = 'none'; }
  return { ingredients: merged, approx, dropped, skips, garnish, method, ice };
}

function attributionOf(raw) {
  const at = raw.attributions || [];
  const authors = at.filter(a => a.relation === 'recipe author').map(a => a.source);
  const adapted = at.filter(a => a.relation === 'adapted by').map(a => a.source);
  const bar = at.find(a => a.relation === 'bar');
  const book = at.find(a => a.relation === 'book');
  return { authors, adapted, bar: bar?.source || null, location: expandLocation(bar?.location), book: book?.source || null };
}

// ───────────────────────────────────────────────────────────── main ──
const existing = loadExisting();
const existingByKey = new Map();
for (const d of existing) for (const k of nameKeys(d.name, d.aka)) {
  if (!existingByKey.has(k)) existingByKey.set(k, []);
  existingByKey.get(k).push(d);
}
const existingIds = new Set(existing.map(d => d.id));

const stats = {};
const S = b => (stats[b] ||= { recipes: 0, filtered: 0, imported: 0, dupExisting: 0, dupBooks: 0, unmappable: 0 });
const unmappable = new Map(); // ingredient → { recipes: n, reason }
const skippedRecipes = [];
const dupLog = [];
const filterLog = [];
const candidates = [];

const allRecipes = readRecipes();
const allRecipeNames = new Set(allRecipes.map(r => norm(r.raw.name)));
for (const rec of allRecipes) {
  const st = S(rec.book);
  st.recipes++;
  const conv = convertRecipe(rec);
  if (BOOKS[rec.book].filter) {
    const t = isTropical(rec.raw, rec.book);
    if (!t.include) { st.filtered++; continue; }
    filterLog.push(`${rec.book}: ${rec.raw.name} [${t.strong.join(', ') || rec.raw.preparation}]`);
  }
  if (conv.skips.length) {
    st.unmappable++;
    skippedRecipes.push(`${rec.book}: ${rec.raw.name} — ${conv.skips.map(s => s.name).join(', ')}`);
    for (const s of conv.skips) {
      const u = unmappable.get(s.name) || { recipes: 0, reason: s.reason };
      u.recipes++; unmappable.set(s.name, u);
    }
    continue;
  }
  if (conv.ingredients.length < 2) { st.unmappable++; skippedRecipes.push(`${rec.book}: ${rec.raw.name} — fewer than 2 ingredients after mapping`); continue; }
  // "Zombie (1950)" / "Scorpion (Kelbo's)" → name "Zombie" + variant note, when the bare name is a known drink.
  const rawName = rec.raw.name.trim();
  const paren = rawName.match(/\(([^)]*)\)\s*$/);
  const bare = stripParens(rawName);
  const bareKnown = paren && (existingByKey.has(norm(bare)) || CLASSICS[norm(bare)] || allRecipeNames.has(norm(bare)));
  const name = titleCase(bareKnown ? bare : rawName);
  candidates.push({ ...rec, ...conv, name, parenNote: bareKnown ? paren[1] : null, keys: nameKeys(name) });
}

// Cross-book dedupe: same name + similar spec → keep the higher-priority book, note the other.
const booksByName = new Map();
for (const c of candidates) for (const k of c.keys) {
  if (!booksByName.has(k)) booksByName.set(k, new Set());
  booksByName.get(k).add(c.book);
}
const removed = new Set();
for (let i = 0; i < candidates.length; i++) {
  for (let j = i + 1; j < candidates.length; j++) {
    const a = candidates[i], b = candidates[j];
    if (removed.has(a) || removed.has(b) || a.book === b.book) continue;
    if (!a.keys.some(k => b.keys.includes(k))) continue;
    const sim = jaccard(specIds(a.ingredients), specIds(b.ingredients));
    if (sim < 0.6) continue;
    const [keep, lose] = BOOK_PRIORITY.indexOf(a.book) <= BOOK_PRIORITY.indexOf(b.book) ? [a, b] : [b, a];
    removed.add(lose);
    (keep.alsoIn ||= []).push(lose.book);
    S(lose.book).dupBooks++;
    dupLog.push(`${lose.book}: ${lose.name} ≈ ${keep.book} (J=${sim.toFixed(2)})`);
  }
}

// Dedupe against the other slices, then build records.
const records = [];
const recordBook = new Map();
const classicFamily = new Map();
const variantOf = new Map();
const usedIds = new Set();
for (const c of candidates.filter(c => !removed.has(c))) {
  const matches = [...new Set(c.keys.flatMap(k => existingByKey.get(k) || []))];
  let best = null, bestSim = 0;
  for (const m of matches) {
    const sim = jaccard(specIds(c.ingredients), specIds(m.ingredients));
    if (sim > bestSim) { bestSim = sim; best = m; }
  }
  if (best && bestSim >= 0.6) {
    S(c.book).dupExisting++;
    dupLog.push(`${c.book}: ${c.name} ≈ existing ${best._slice}:${best.id} (J=${bestSim.toFixed(2)})${c.alsoIn ? ` [also ${c.alsoIn.join(', ')}]` : ''}`);
    for (const b of c.alsoIn || []) S(b).dupExisting++, S(b).dupBooks--;
    continue;
  }
  const rec = buildRecord(c, matches);
  let id = rec.id;
  if (matches.length || existingIds.has(id) || usedIds.has(id)) id = `${slug(c.name)}-${BOOKS[c.book].suffix}`;
  let n = 2;
  while (existingIds.has(id) || usedIds.has(id)) id = `${slug(c.name)}-${BOOKS[c.book].suffix}-${n++}`;
  rec.id = id;
  usedIds.add(id);
  records.push(rec);
  recordBook.set(rec, c.book);
  if (matches.length) variantOf.set(rec, matches.map(m => m.id).join(', '));
  S(c.book).imported++;
}

/**
 * Record fields:
 *   era/year/creator/venue: from the earliest existing record with the same name (classic reprinted in a book),
 *     else CLASSICS, else the book attribution. Sippin' Safari defaults to golden; modern books to craft with
 *     year null (the book's own authors / credited modern bartenders).
 *   popularity: existing/CLASSICS value for classics; otherwise 2, or 3 when the name appears in ≥2 books or
 *     is in MODERN_CLASSICS.
 *   confidence: high when every ingredient mapped cleanly, medium when anything was approximated or dropped.
 */
function buildRecord(c, matches) {
  const B = BOOKS[c.book];
  const at = attributionOf(c.raw);
  const nk = norm(c.name);
  // A same-name record is the same drink (so its metadata applies) when it predates the craft era, or when a
  // craft/revival record shares the creator or venue; otherwise it is a different drink that happens to share a name.
  const sameMaker = m => {
    const surnames = at.authors.map(a => a.split(' ').pop().toLowerCase());
    const who = (m.creator || '').toLowerCase();
    return (surnames.length && surnames.some(s => who.includes(s))) || (at.bar && m.venue && norm(m.venue) === norm(at.bar))
      || (!at.authors.length && B.creator && who.includes(B.creator.split(' ').pop().toLowerCase()));
  };
  const byPrimary = [...matches].sort((a, b) => (c.keys.includes(norm(b.name)) ? 1 : 0) - (c.keys.includes(norm(a.name)) ? 1 : 0));
  const pool = byPrimary.filter(m => c.keys.includes(norm(m.name))).length ? byPrimary.filter(m => c.keys.includes(norm(m.name))) : byPrimary;
  // Hand-curated slices first (bulk imports such as a Difford's dump only as a fallback), then the earliest year.
  const sliceRank = m => SLICE_PRIORITY.includes(m._slice) ? 0 : 1;
  // A modern bartender's drink that merely shares a vintage name (spec overlap < 0.3) is not a re-spec of it.
  // Book authors re-speccing a classic, and 'classics' chapters, always count as re-specs.
  const related = m => B.vintage || !at.authors.length || (B.creator && at.authors.includes(B.creator)) || /classic|foundational|essential|restoration/i.test(c.chapter)
    || jaccard(specIds(c.ingredients), specIds(m.ingredients)) >= 0.3;
  const classicExisting = pool.filter(m => !['craft', 'revival'].includes(m.era) && related(m))
    .sort((a, b) => sliceRank(a) - sliceRank(b) || (a.year ?? 9999) - (b.year ?? 9999) || b.popularity - a.popularity)[0]
    || pool.filter(sameMaker).sort((a, b) => b.popularity - a.popularity)[0];
  const cl = CLASSICS[nk] || CLASSICS[norm(c.raw.name)] || null;
  const isClassic = !!(classicExisting || cl);
  const inBooks = new Set(c.keys.flatMap(k => [...(booksByName.get(k) || [])]));

  const d = {
    id: slug(c.name), name: c.name, variant: '', aka: [], family: 'punch', families_secondary: [],
    year: null, circa: false, era: B.vintage ? 'golden' : 'craft', creator: null, venue: null, location: null, popularity: 2, parents: [],
    ingredients: c.ingredients, method: c.method, ice: c.ice, glass: GLASS[c.raw.glassware] || c.raw.glassware, garnish: c.garnish,
    servings: c.raw.servings || SERVINGS[`${c.book}:${nk}`] || 1,
    source: `${bookCite(c.book)}, via SBoudrias/cocktails transcription` + (c.alsoIn ? `; also in ${c.alsoIn.map(bookCite).join('; ')}` : ''),
    source_urls: [SOURCE_URL],
    confidence: c.approx.length || c.dropped.length ? 'medium' : 'high',
    notes: '',
  };
  if (ascii(c.name) !== c.name) d.aka.push(ascii(c.name));
  // Bowls printed without a serving count: ~4.5 oz of liquid per guest (before melt).
  const totalOz = d.ingredients.reduce((s, i) => s + OZ(i), 0);
  if (d.servings === 1 && totalOz > 12) d.servings = Math.max(2, Math.round(totalOz / 4.5));

  // Who/when.
  const bookCreator = at.authors.length ? at.authors.join(' & ') : (B.creator || null);
  if (classicExisting) {
    Object.assign(d, { year: classicExisting.year ?? null, circa: !!classicExisting.circa, era: classicExisting.era, creator: classicExisting.creator || null,
      venue: classicExisting.venue || null, location: classicExisting.location || null, popularity: classicExisting.popularity });
  } else if (cl) {
    const authorIsOriginator = B.vintage || c.book === 'smugglers-cove';
    Object.assign(d, { year: cl.year ?? null, circa: !!cl.circa, era: cl.era, creator: cl.creator ?? (authorIsOriginator && at.authors.length ? at.authors.join(' & ') : null),
      venue: cl.venue ?? (B.vintage ? at.bar : null), location: cl.location ?? (B.vintage ? at.location : null), popularity: cl.popularity });
  } else {
    d.creator = bookCreator;
    d.venue = at.bar || B.venue || null;
    d.location = at.location || (at.bar ? null : B.location || null);
    if (at.bar === "Smuggler's Cove" && !at.authors.length) d.creator = BOOKS['smugglers-cove'].creator;
    d.popularity = inBooks.size >= 2 || MODERN_CLASSICS.has(nk) ? 3 : 2;
  }
  if (isClassic && inBooks.size >= 2 && d.popularity < 3) d.popularity = 3;

  // Variant text.
  const ORIGINATORS = /beachcomber|donn beach|trader vic|bergeron/i;
  const specAuthors = at.adapted.length ? at.adapted : at.authors.filter(a => !ORIGINATORS.test(a));
  const reSpecBy = specAuthors.length && !B.vintage ? ` by ${specAuthors.join(' & ')}${at.bar && at.bar !== B.venue ? ` (${at.bar})` : ''}` : '';
  if (isClassic) {
    const origin = c.parenNote ? `${c.parenNote}; ` : '';
    d.variant = B.vintage ? `${origin}${[at.authors.join(' & '), at.bar].filter(Boolean).join(', ') || 'vintage spec'} (Berry, ${B.short})`
      : `${origin}${B.short} spec${reSpecBy} (${B.year ?? B.publisher})`;
  } else if (matches.length) {
    d.variant = `${B.short} (${B.year ?? B.publisher})${reSpecBy}`;
  } else if (c.parenNote) {
    d.variant = `${c.parenNote} (${B.short})`;
  }

  // Family: classics keep the family of their existing record for consistency.
  const fam = classifyFamily(d, c.name);
  const existingFam = classicExisting && FAMILY_IDS.has(classicExisting.family) ? classicExisting.family : null;
  d.family = existingFam || fam.family;
  d.families_secondary = [...new Set([fam.family, ...fam.secondary])].filter(f => f !== d.family && !['daiquiri', 'punch', 'stirred'].includes(f)).slice(0, 2);
  if (existingFam && fam.family !== existingFam && ['daiquiri', 'punch', 'stirred'].includes(fam.family) === false && !d.families_secondary.includes(fam.family)) d.families_secondary.unshift(fam.family);
  d.families_secondary = d.families_secondary.slice(0, 2);
  // Classics with no existing record keep one family across books (the first, highest-priority book's).
  if (!existingFam && cl) {
    if (classicFamily.has(nk) && classicFamily.get(nk) !== d.family) {
      d.families_secondary = [d.family, ...d.families_secondary.filter(f => f !== classicFamily.get(nk))].slice(0, 2);
      d.family = classicFamily.get(nk);
    } else classicFamily.set(nk, d.family);
  }

  d.parents = parentsFor(c.name, cl?.parents);

  // Notes: structural facts only, generated.
  const who = isClassic
    ? (B.vintage
      ? `Vintage ${d.venue || 'tiki-bar'} recipe as recovered by Jeff Berry`
      : `${B.short} spec of ${d.era === 'craft' || d.era === 'revival' ? 'a modern tiki standard' : an(`${ERA_WORD[d.era]} ${d.venue ? `${d.venue} ` : ''}classic`)}`)
    : (d.creator && d.creator !== B.creator && !d.creator.startsWith("Smuggler's Cove")
      ? `${B.vintage ? 'Vintage drink' : 'Original'} by ${d.creator}${d.venue ? ` (${d.venue})` : ''}, featured in ${B.short}`
      : `${B.short} original`);
  const extras = [];
  if (d.method !== 'shake' && METHOD_PHRASE[d.method]) extras.push(METHOD_PHRASE[d.method]);
  if (d.servings > 1) extras.push(`batched for ${d.servings}`);
  d.notes = `${who}: ${structureText(d)}${extras.length ? `; ${extras.join(', ')}` : ''}.`;
  if (c.dropped.length) d.notes += ` Omitted accent: ${c.dropped.map(x => x.replace(/\s*\(.*\)$/, '')).join(', ')}.`;

  // Clean optional fields.
  if (!d.garnish.length) d.garnish = [];
  return d;
}

// ────────────────────────────────────────────────────────── output ──
records.sort((a, b) => BOOK_PRIORITY.indexOf(recordBook.get(a)) - BOOK_PRIORITY.indexOf(recordBook.get(b)) || a.name.localeCompare(b.name));
for (const r of records) if (!FAMILY_IDS.has(r.family)) throw new Error(`bad family ${r.family} for ${r.id}`);
if (!DRY) writeFileSync(OUT, JSON.stringify(records, null, 1) + '\n');

// ────────────────────────────────────────────────────────── report ──
console.log(`\nSBoudrias/cocktails import → ${relative(ROOT, OUT)}${DRY ? ' (dry run, not written)' : ''}`);
console.log(`existing records compared: ${existing.length} from ${new Set(existing.map(d => d._slice)).size} slices\n`);
console.log('book                              recipes  filtered  imported  dup-existing  dup-books  unmappable');
for (const b of BOOK_PRIORITY) {
  const s = S(b);
  console.log(`${b.padEnd(34)}${String(s.recipes).padStart(7)}${String(s.filtered).padStart(10)}${String(s.imported).padStart(10)}${String(s.dupExisting).padStart(14)}${String(s.dupBooks).padStart(11)}${String(s.unmappable).padStart(12)}`);
}
const tot = k => BOOK_PRIORITY.reduce((s, b) => s + S(b)[k], 0);
console.log(`${'TOTAL'.padEnd(34)}${String(tot('recipes')).padStart(7)}${String(tot('filtered')).padStart(10)}${String(tot('imported')).padStart(10)}${String(tot('dupExisting')).padStart(14)}${String(tot('dupBooks')).padStart(11)}${String(tot('unmappable')).padStart(12)}`);
console.log(`\nconfidence: ${records.filter(r => r.confidence === 'high').length} high, ${records.filter(r => r.confidence === 'medium').length} medium`);
const famCount = {};
for (const r of records) famCount[r.family] = (famCount[r.family] || 0) + 1;
console.log('families:', Object.entries(famCount).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(', '));
console.log('\ntop unmappable ingredients (recipes blocked):');
for (const [n, u] of [...unmappable].sort((a, b) => b[1].recipes - a[1].recipes).slice(0, VERBOSE ? 200 : 25)) console.log(`  ${String(u.recipes).padStart(3)}  ${n} — ${u.reason}`);
if (VERBOSE) {
  console.log('\nDeath & Co recipes kept by the tropical filter:'); for (const l of filterLog) console.log('  ' + l);
  console.log('\nskipped (unmappable):'); for (const l of skippedRecipes) console.log('  ' + l);
  console.log('\nduplicates:'); for (const l of dupLog) console.log('  ' + l);
  console.log('\nkept as variants of a same-name drink:'); for (const r of records.filter(r => variantOf.has(r))) console.log(`  ${r.id} — ${r.variant}  [${variantOf.get(r)}]`);
}
