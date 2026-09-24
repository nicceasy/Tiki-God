#!/usr/bin/env node
// Import the tiki / tiki-adjacent tropical subset of a scraped Difford's Guide dataset.
//
// Usage: node scripts/import/difford.mjs <path-to-data-dir>
//   <path-to-data-dir> holds one JSON file per recipe (fields Url, Name, Glass, Ingredients,
//   Instructions, History, ...), as scraped by github.com/LauraMarby/IA-SRI-SIM_Project (src/data).
// Writes data/drinks/difford.json and prints a selection / mapping / dedupe report.
//
// Pipeline, per recipe:
//   1. parse each ingredient string (amount, unit, name, optional/top/float flags)
//   2. map names → ingredient ids with scripts/import/difford-map.json (first matching rule wins)
//   3. SELECTION (explicit, see selectTropical): tropical markers or a rum-family sour/punch/swizzle/highball
//   4. EXCLUSIONS: shots/shooters, cream-heavy dessert drinks, zero-proof recipes, unmappable key ingredients
//   5. method / ice parsed from the instruction verbs; family by explicit heuristics (classifyFamily)
//   6. provenance (creator / venue / location / year) extracted ONLY by regex from History; era judged (judgeEra)
//   7. DEDUPE against every other data/drinks/*.json: name/aka match (+ hand-checked aliases in the map file)
//      and ingredient-class Jaccard ≥ 0.5 → skip; same name but different spec → '-difford' variant if it is
//      recognisably the same drink, else skipped as an unrelated drink sharing the name.
// No Review / History / Instructions prose is copied: notes are generated structural descriptions.
// VERBOSE=1 also lists every duplicate, kept variant, name collision and unmappable recipe.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = process.argv[2];
if (!dataDir || !existsSync(dataDir)) {
  console.error('usage: node scripts/import/difford.mjs <path-to-data-dir>');
  process.exit(1);
}
const OUT = join(root, 'data/drinks/difford.json');
const SOURCE = "Difford's Guide (via LauraMarby/IA-SRI-SIM_Project scrape)";

const vocab = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
const ING = new Map(vocab.ingredients.map(i => [i.id, i]));
const MAP = JSON.parse(readFileSync(join(root, 'scripts/import/difford-map.json'), 'utf8'));
const RULES = MAP.rules.map(r => ({ ...r, re: new RegExp(r.match, 'i') }));
for (const r of RULES) if (r.id && !ING.has(r.id)) throw new Error(`difford-map.json: unknown id ${r.id}`);

// ---------------------------------------------------------------- helpers
const ML_PER_OZ = 29.57;
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const tally = (obj, k, n = 1) => { obj[k] = (obj[k] || 0) + n; };
const topN = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

// Same normalization as scripts/merge.mjs (copied: importing merge.mjs would run the merge).
const norm = s => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^the\s+/, '')
  .replace(/['’`".]/g, '')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const slug = s => norm(s).replace(/\s+/g, '-');
// Name key for dedupe: "Daiquiri No.2" = "Daiquiri No. 2", "Millionaire No.1" = "Millionaire Cocktail No. 1".
const nameKey = s => norm(s).replace(/\bcocktail\b/g, ' ').replace(/\bno\s*(\d+)\b/g, 'no $1').replace(/\s+/g, ' ').trim();

// Difford names carry spec qualifiers: "Mai Tai (Trader Vic's)", "Piña Colada (Difford's recipe)".
function splitName(name) {
  const clean = name.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  let base = m ? m[1] : clean;
  const qual = m ? m[2] : '';
  base = base.replace(/\s+cocktail$/i, '').trim();
  return { base: base || clean, qual };
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

// ml → our units. 1/8-oz grid when the ml figure is a bartender measure that lands within 4% of it
// (7.5 → ¼, 22.5 → ¾, 25 → ⅞, 50 → 1¾); small odd amounts become teaspoons (5 ml = 1 tsp); else 2 decimals.
function fromMl(ml) {
  const oz = ml / ML_PER_OZ;
  const eighth = Math.round(oz * 8) / 8;
  if (eighth > 0 && Math.abs(eighth - oz) / oz <= 0.04) return { amount: eighth, unit: 'oz' };
  if (ml < 15) return { amount: Math.round((ml / 4.93) * 4) / 4 || 0.25, unit: 'tsp' };
  return { amount: round(oz), unit: 'oz' };
}
const ozOf = line => {
  if (!line || line.amount == null) return 0;
  const f = vocab.units[line.unit];
  if (line.unit === 'piece') return (line.amount || 1) * ((ING.get(line.id) || {}).oz_per_piece || 0);
  return typeof f === 'number' ? line.amount * f : 0;
};

// ---------------------------------------------------------------- ingredient parsing
const COUNT_UNITS = ['fresh', 'whole', 'slice', 'wedge', 'ring', 'cube', 'sprig', 'leaf', 'inch', 'dried', 'segment',
  'cupful', 'knob', 'swath', 'twist', 'candied', 'unit', 'bag', 'pea', 'grated', 'bottle', 'pint', 'fill'];
const UNIT_RE = new RegExp(`^(ml|litre|dash|drop|barspoon|pinch|grind|gram|scoop|${COUNT_UNITS.join('|')})\\b\\s*(.*)$`, 'i');

function parseIngredient(raw) {
  let s = raw.replace(/\s+/g, ' ').trim();
  const p = { raw: s, amount: null, unit: null, name: '', optional: false, float: false };
  if (/\boptional\b/i.test(s)) { p.optional = true; s = s.replace(/\s*\boptional\b/ig, '').trim(); }
  let m;
  if ((m = s.match(/^Top up with\s+(.*)$/i))) { p.unit = 'top'; s = m[1]; }
  else if ((m = s.match(/^Float\s+(.*)$/i))) { p.float = true; p.unit = 'splash'; p.amount = 1; s = m[1]; }
  else if ((m = s.match(/^Splash\s+(.*)$/i))) { p.unit = 'splash'; p.amount = 1; s = m[1]; }
  else {
    if ((m = s.match(/^(\d*?)(\d)⁄(\d+)\s*(.*)$/))) { p.amount = (m[1] ? +m[1] : 0) + (+m[2]) / (+m[3]); s = m[4]; }
    else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/))) { p.amount = +m[1]; s = m[2]; }
    if (p.amount != null && (m = s.match(UNIT_RE))) { p.unit = m[1].toLowerCase(); s = m[2]; }
    else if (p.amount != null) p.unit = 'fresh';
  }
  // Egg white strings list vegan alternatives: keep the first option only.
  s = s.replace(/\s+or\s+(Aquafaba|Egg white|3 dashes).*$/i, '').trim();
  p.name = s;
  // orig: Difford's wording without serving-temperature / prep suffixes.
  p.label = s.replace(/\s+(chilled|from freezer|chopped wedges|chopped|cut into segments|fine sliced|torn|white)$/i, '')
    .replace(/\s+(chilled|from freezer|chopped)$/i, '').trim();
  return p;
}

function findRule(name) {
  for (const r of RULES) if (r.re.test(name)) return r;
  return undefined;
}

// Convert a parsed line with its rule into one of our ingredient lines (or a reason it can't be).
function convert(p, rule) {
  const line = { id: rule.id };
  const scale = rule.scale || 1;
  const u = p.unit;
  if (u === 'ml' || u === 'litre') Object.assign(line, fromMl(p.amount * (u === 'litre' ? 1000 : 1) * scale));
  else if (u === 'gram') Object.assign(line, fromMl(p.amount * scale));
  else if (u === 'dash' || u === 'drop' || u === 'pinch') Object.assign(line, { amount: p.amount, unit: u });
  else if (u === 'grind') Object.assign(line, { amount: p.amount, unit: 'pinch' });
  else if (u === 'barspoon') Object.assign(line, { amount: round(p.amount * scale, 3), unit: 'barspoon' });
  else if (u === 'top') line.unit = 'top';
  else if (u === 'splash') Object.assign(line, { amount: 1, unit: 'splash' });
  else if (u === 'scoop' && !(rule.count)) Object.assign(line, { amount: p.amount, unit: 'scoop' });
  else {
    const spec = rule.count && (rule.count[u] || rule.count.default);
    if (!spec) return { error: `no count conversion for "${u}"` };
    if (spec.oz) Object.assign(line, fromMl(p.amount * spec.oz * ML_PER_OZ));
    else if (spec.tsp) Object.assign(line, { amount: round(p.amount * spec.tsp, 2), unit: 'tsp' });
    else Object.assign(line, { amount: round(p.amount * (spec.per || 1), 2), unit: spec.unit });
  }
  if (rule.orig) line.orig = p.label;
  else if (rule.scale || (rule.count && !['leaves', 'sprig', 'piece', 'slice', 'scoop'].includes(line.unit))) line.orig = p.raw;
  if (p.float) line.float = true;
  return { line };
}

// A line is MINOR when it's an accent: dashes/drops/pinches or ≤ 1 tsp. Unmappable minor lines are
// dropped (and named in notes); an unmappable KEY line excludes the recipe.
const isMinor = p => ['dash', 'drop', 'pinch', 'grind', 'pea'].includes(p.unit)
  || (p.unit === 'ml' && p.amount <= 5) || (p.unit === 'barspoon' && p.amount <= 1)
  || /^(black pepper|celery salt|salt|sea salt|pink peppercorns|cayenne)\b(?!ed)|^(lemon|orange|lime|grapefruit) (peel|zest)/i.test(p.name);

// ---------------------------------------------------------------- method / ice / glass / garnish
function parseMethod(instr, lines, glass) {
  const text = instr.join(' ');
  const T = text.toUpperCase();
  const sentences = instr.flatMap(s => s.split(/(?<=\.)\s+/));
  const hot = /\b(HEAT|MICROWAVE|WARM)\b/.test(text) || /pre-warmed|boiling|hot water|\(hot\)/i.test(text)
    || lines.some(l => ['hot-water', 'hot-buttered-rum-batter'].includes(l.id)) || /toddy/i.test(glass);
  // A blend counts only when ice goes into the blender ("BLEND ... with 6oz scoop crushed ice",
  // "Add ... ice and BLEND"); Difford's "DRY BLEND / Flash BLEND without ice" is just emulsifying.
  const iceBlend = sentences.filter(s => /\bBLEND\b/.test(s) && /\bice\b/i.test(s) && !/without ice/i.test(s));
  let method;
  if (hot) method = 'hot';
  else if (iceBlend.length) method = iceBlend.some(s => /flash|briefly|few seconds|five seconds/i.test(s)) ? 'flash-blend' : 'blend';
  else if (/\bSWIZZLE\b/.test(text)) method = 'swizzle';
  else if (/\bSHAKE\b/i.test(text)) method = 'shake';
  else if (/\bMUDDLE\b/.test(text) && !/\bSTRAIN\b/.test(text)) method = 'muddle-build'; // muddled in the glass (Caipirinha, Mojito)
  else if (/\b(STIR|REGAL STIR|THROW)\b/.test(text)) method = 'stir';
  else if (/\bMUDDLE\b/.test(text)) method = 'muddle-build';
  else method = 'build'; // POUR / build; CHURN (bar-spoon stir in crushed ice) is a build, not a swizzle
  // Ice in the finished drink.
  let ice;
  if (method === 'hot') ice = 'none';
  else if (method === 'blend') ice = 'blended';
  else if (/crushed ice/i.test(text) && !/crushed ice\)/i.test(text)) ice = 'crushed';
  else if (/pebble ice/i.test(text)) ice = 'pebble';
  else if (/shaved ice/i.test(text)) ice = 'shaved';
  else if (/large (ice )?cube(?!s)|block ice|ice ball|ice sphere/i.test(text)) ice = 'block';
  else if (/ice-filled|filled with ice|over ice|ice cubes|fill glass with ice|ADD ice/i.test(text)) ice = 'cubed';
  else if (/chilled glass|no ice|\bup\b/i.test(text) && !/ice-filled/i.test(text)) ice = 'none';
  else ice = method === 'build' || method === 'muddle-build' ? 'cubed' : 'none';
  if (method === 'swizzle' && ice !== 'crushed' && ice !== 'pebble' && ice !== 'shaved') ice = 'crushed';
  if (/CHURN/.test(T) && ice !== 'blended') ice = 'crushed';
  return { method, ice };
}

function parseGarnish(instr, field) {
  const out = [];
  const src = [];
  for (const s of instr) {
    const m = s.match(/^Prepare garnish of\s+(.*?)\.?\s*$/i);
    if (m) src.push(m[1]);
  }
  if (!src.length && field) src.push(field);
  for (const g of src) {
    const cleaned = g.replace(/\([^)]*\)?/g, '').replace(/\s+\./g, '').replace(/Prepare garnish of\s+/ig, '').replace(/\b(dust|sprinkle|dusted|sprinkled) with\s+/ig, '').replace(/Garnish with\s+/ig, '')
      .replace(/Luxardo Maraschino Cherry/ig, 'maraschino cherry').replace(/\s*\(optional\)/ig, '');
    for (let part of cleaned.split(/\s*(?:,|&|\band\b|\.)\s*/i)) {
      part = part.trim().replace(/\s+on rim$/i, '').replace(/^(a|an)\s+/i, '').toLowerCase();
      part = part.replace(/^(freshly )?grated /, 'grated ').trim();
      if (part && part.length < 60 && !/^(stirrer|straws?|serve|spoon|wooden|none)\b/.test(part) && !out.includes(part)) out.push(part);
    }
  }
  return out;
}
const cleanGlass = g => (g || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*glass\b/ig, '').replace(/\s+/g, ' ').trim().toLowerCase();

// ---------------------------------------------------------------- selection
const RUM_IDS = new Set(vocab.ingredients.filter(i => i.cat === 'rum').map(i => i.id).concat(['batavia-arrack']));
const SPIRIT_IDS = new Set(vocab.ingredients.filter(i => i.cat === 'spirit' && !['absinthe', 'pastis'].includes(i.id)).map(i => i.id));
const CITRUS = new Set(['lime', 'lemon', 'grapefruit', 'orange', 'yuzu-juice', 'lime-cordial']);
const MIXERS = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'sparkling-wine']);
const DAIRY = new Set(['heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream']);
// Tropical markers (the brief's first list). Matched on the RAW Difford's name so that tropical drinks
// with an unmappable key ingredient (e.g. a mango liqueur) still count as "tropical by filter" and are
// then reported as unmappable instead of silently vanishing.
const MARKERS = [
  ['orgeat', /orgeat/i],
  ['falernum', /falernum/i],
  ['allspice', /pimento|allspice/i],
  ['cinnamon-syrup', /^cinnamon (sugar )?syrup/i],
  ['passion-fruit', /passion ?fruit|passo[ãa]|maracuja/i],
  ['pineapple', /pineapple/i],
  ['coconut', /coconut(?! sugar)|coco l[oó]pez/i],
  ['guava', /guava/i],
  ['mango', /mango/i],
  ['papaya', /papaya/i],
  ['banana', /banana|banane/i],
  ['lychee', /lychee|litchi|kwai feh/i],
  ['tiki-bitters', /tiki bitters/i],
];
// For a NON-rum base a marker must be "clear": fruit/coconut markers ≥ ½ oz; the potent tiki
// modifiers (orgeat, falernum, allspice dram) ≥ 1 tsp or dashes; tiki bitters at any dose.
// Cinnamon syrup alone never qualifies a non-rum drink (it is as much a winter/hot-toddy flavor).
const POTENT = new Set(['falernum', 'allspice', 'orgeat']);
const clearMarker = h => h.tag === 'tiki-bitters' || (POTENT.has(h.tag) && (h.oz >= 0.16 || h.dashes)) || (!POTENT.has(h.tag) && h.tag !== 'cinnamon-syrup' && h.oz >= 0.5);

function markerHits(parsed) {
  const hits = [];
  for (const p of parsed) {
    if (p.optional) continue;
    for (const [tag, re] of MARKERS) {
      if (!re.test(p.name)) continue;
      let oz = 0;
      if (p.unit === 'ml') oz = p.amount / ML_PER_OZ;
      else if (p.unit === 'barspoon') oz = p.amount * 0.125;
      else if (['fresh', 'wedge', 'ring', 'slice', 'cupful', 'whole'].includes(p.unit)) oz = 0.5 * p.amount;
      else if (p.unit === 'top' || p.unit === 'splash') oz = 1;
      hits.push({ tag, oz, dashes: ['dash', 'drop'].includes(p.unit), name: p.name });
    }
  }
  return hits;
}

// Returns { tropical: bool, why: string } — the explicit selection filter.
function selectTropical(ctx) {
  const { hits, lines, method, ice, glass, name } = ctx;
  const rumOz = lines.filter(l => RUM_IDS.has(l.id)).reduce((a, l) => a + ozOf(l), 0);
  const spiritOz = lines.filter(l => SPIRIT_IDS.has(l.id)).reduce((a, l) => a + ozOf(l), 0);
  ctx.rumOz = rumOz; ctx.spiritOz = spiritOz;
  const rumBase = rumOz >= 0.75 && rumOz >= spiritOz;
  const citrusOz = lines.filter(l => CITRUS.has(l.id)).reduce((a, l) => a + ozOf(l), 0);
  const mixer = lines.some(l => MIXERS.has(l.id) && (l.unit === 'top' || ozOf(l) >= 1.5));
  const tikiServe = method === 'swizzle' || method === 'flash-blend' || (/tiki|coconut shell|pineapple shell/i.test(glass) && ['crushed', 'pebble', 'shaved'].includes(ice));
  // 1. tropical markers
  if (hits.length) {
    if (rumBase || RUM_IDS.has(ctx.baseId)) return { tropical: true, why: `rum + ${hits[0].tag}` };
    const strong = hits.filter(clearMarker);
    if (strong.length) return { tropical: true, why: `marker ${strong[0].tag}` };
  }
  if (tikiServe) return { tropical: true, why: method === 'swizzle' ? 'swizzled' : 'tiki-mug / crushed-ice serve' };
  // 2. rum / cachaça / agricole sours, punches, swizzles and highballs (the tiki ancestors)
  if (rumBase) {
    if (citrusOz >= 0.25) return { tropical: true, why: 'rum sour/punch' };
    if (mixer) return { tropical: true, why: 'rum highball' };
    if (/punch|grog|swizzle|bumbo/i.test(name)) return { tropical: true, why: 'rum punch/grog by name' };
    if (method === 'hot' && lines.some(l => ['butter', 'hot-buttered-rum-batter'].includes(l.id))) return { tropical: true, why: 'hot buttered rum' };
  }
  return { tropical: false };
}

const isShot = (d, parsed) => /shot/i.test(d.Glass || '') || /\b(shot|shooter|slammer|bomb)\b/i.test(d.Name)
  || (/\bLAYER\b/.test((d.Instructions || []).join(' ')) && parsed.filter(p => p.unit === 'ml').reduce((a, p) => a + p.amount, 0) <= 90);

// Temperance / zero-proof recipes: < 0.2 oz of pure alcohol in the whole drink.
const ethanolOz = lines => lines.reduce((a, l) => a + ozOf(l) * ((ING.get(l.id) || {}).abv || 0) / 100, 0);

// Cream-heavy dessert drinks: ≥ ½ oz dairy, no citrus, no colada fruit — unless rum-based with a tropical
// marker (Trader Vic's Banana Cow, the Jamaican Dirty Banana are resort-tiki; a Banana Banshee is not).
function isDessert(lines, rumTropical) {
  if (rumTropical) return false;
  const dairyOz = lines.filter(l => DAIRY.has(l.id)).reduce((a, l) => a + (l.unit === 'scoop' ? 3 : ozOf(l)), 0);
  if (dairyOz < 0.5) return false;
  const citrus = lines.some(l => CITRUS.has(l.id) && ozOf(l) >= 0.25);
  const colada = lines.some(l => ['pineapple-juice', 'coconut-cream', 'coconut-milk', 'coconut-rum', 'passion-fruit-juice', 'guava-nectar', 'mango-nectar'].includes(l.id));
  return !citrus && !colada;
}

// ---------------------------------------------------------------- family heuristics
// First matching rule is the family; later matches (max 2) become families_secondary.
const BITTER = new Set(['campari', 'aperol', 'amaro', 'cynar', 'fernet']);
const FRUIT_JUICE = new Set(['pineapple-juice', 'orange', 'passion-fruit-juice', 'passion-fruit-nectar', 'guava-nectar', 'mango-nectar',
  'papaya-nectar', 'cranberry-juice', 'apple-juice', 'pomegranate-juice', 'watermelon-juice', 'coconut-water']);
const FRUIT_MOD = new Set(['banana-liqueur', 'blackberry-liqueur', 'apricot-liqueur', 'peach-liqueur', 'passion-fruit-liqueur', 'passion-fruit-syrup',
  'raspberry-liqueur', 'cherry-heering', 'melon-liqueur', 'coconut-rum', 'blue-curacao', 'grenadine', 'guava-syrup', 'lychee-liqueur', 'lychee-syrup', 'banana', 'strawberry']);
const SPICE = new Set(['velvet-falernum', 'falernum-syrup', 'allspice-dram', 'cinnamon-syrup', 'tiki-bitters', 'dons-mix', 'dons-spices-2']);

function classifyFamily(d) {
  const ids = new Set(d.ingredients.map(l => l.id));
  const oz = id => d.ingredients.filter(l => l.id === id).reduce((a, l) => a + ozOf(l), 0);
  const n = d.name.toLowerCase();
  const rums = [...ids].filter(id => RUM_IDS.has(id));
  const rumOz = rums.reduce((a, id) => a + oz(id), 0);
  const spiritOz = [...ids].filter(id => SPIRIT_IDS.has(id)).reduce((a, id) => a + oz(id), 0);
  const citrus = [...ids].filter(id => CITRUS.has(id) && oz(id) >= 0.25);
  const juices = [...ids].filter(id => FRUIT_JUICE.has(id) && oz(id) >= 0.5);
  const juiceOz = juices.reduce((a, id) => a + oz(id), 0);
  const topMixer = d.ingredients.some(l => MIXERS.has(l.id) && l.id !== 'sparkling-wine' && (l.unit === 'top' || ozOf(l) >= 1.5));
  const hasBitter = [...ids].some(id => BITTER.has(id) && oz(id) >= 0.25);
  const spiced = [...ids].some(id => SPICE.has(id));
  const coconut = oz('coconut-cream') + oz('coconut-milk') >= 0.25 || (ids.has('coconut-rum') && oz('coconut-rum') >= 0.5 && ids.has('pineapple-juice'));
  const up = d.ice === 'none';
  // Creamy tropical drinks (Dirty Banana, Banana Cow, Bushwacker) sit with the coladas in our other slices.
  const dairyOz = d.ingredients.filter(l => DAIRY.has(l.id)).reduce((a, l) => a + (l.unit === 'scoop' ? 3 : ozOf(l)), 0);
  const creamyTropical = dairyOz >= 0.5 && citrus.length === 0
    && [...ids].some(id => ['banana', 'banana-liqueur', 'pineapple-juice', 'coconut-rum', 'passion-fruit-juice', 'mango-nectar', 'guava-nectar'].includes(id));
  const rules = [
    ['hot', d.method === 'hot'],
    ['mai-tai', /mai tai/.test(n) || (ids.has('orgeat') && (ids.has('orange-curacao') || ids.has('triple-sec')) && ids.has('lime') && rumOz >= spiritOz && rumOz > 0)],
    ['zombie', /zombie/.test(n) || (rums.length >= 3 && ids.has('lime') && (spiced || ids.has('grenadine') || ids.has('absinthe') || ids.has('pastis')))],
    ['grog', /\bgrog\b/.test(n) || (ids.has('honey-syrup') && ids.has('grapefruit') && ids.has('lime') && rums.length >= 2)],
    ['colada', /colada|painkiller|chi[ -]?chi/.test(n) || coconut || creamyTropical],
    ['bitter-tiki', /jungle bird/.test(n) || (hasBitter && (juices.length > 0 || citrus.length > 0) && !up)],
    ['swizzle', /swizzle/.test(n) || d.method === 'swizzle'],
    ['orgeat-punch', /scorpion|fog ?cutter/.test(n) || (ids.has('orgeat') && (ids.has('brandy') || ids.has('gin')) && rumOz > 0 && (ids.has('orange') || ids.has('lemon')))],
    ['buck', /\b(buck|mule|stormy|cooler|cuba libre|highball|mojito)\b/.test(n) || (topMixer && juiceOz < 2)],
    ['resort-punch', /hurricane|rum runner|bahama mama|goombay|blue hawaii/.test(n) || (juices.length >= 2 && juiceOz >= 2) || (juiceOz >= 2 && [...ids].some(id => FRUIT_MOD.has(id)))],
    ['beachcomber-sour', spiced && citrus.length > 0 && rumOz > 0],
    // Spirit-forward: no citrus, no real juice or mixer — stirred, or shaken but built like an Old Fashioned.
    ['stirred', citrus.length === 0 && oz('water') < 1.5 && (d.method === 'stir' || (juiceOz < 0.5 && !topMixer && !coconut && d.method !== 'blend'
      && oz('pineapple-juice') + oz('passion-fruit-juice') < 0.5 && !d.ingredients.some(l => DAIRY.has(l.id) || l.id === 'egg-white')))],
    ['punch', /punch/.test(n) || juiceOz >= 2 || (d.servings || 1) > 1],
    ['daiquiri', citrus.length > 0 || /daiquiri/.test(n) || oz('pineapple-juice') + oz('passion-fruit-juice') >= 0.5],
  ];
  // Name wins over structure for the canonical families.
  if (/daiquiri/.test(n) && !coconut && !/mai tai/.test(n)) rules.unshift(['daiquiri', true]);
  if (/punch/.test(n) && !/milk punch/.test(n)) rules.splice(1, 0, ['punch', true]);
  const hits = [];
  for (const [fam, ok] of rules) if (ok && !hits.includes(fam)) hits.push(fam);
  if (!hits.length) hits.push(d.method === 'stir' ? 'stirred' : topMixer ? 'buck' : 'punch');
  // Secondaries: only informative ones. 'punch' (everyone's ancestor) only when named a punch;
  // 'daiquiri' only for lengthened sours (buck/swizzle, e.g. Mojito) or when named a daiquiri.
  const secondary = hits.slice(1).filter(f => (f !== 'punch' || /punch/.test(n))
    && (f !== 'daiquiri' || ['buck', 'swizzle'].includes(hits[0]) || /daiquiri/.test(n)) && f !== 'stirred');
  return { family: hits[0], families_secondary: secondary.slice(0, 2) };
}

// ---------------------------------------------------------------- provenance (facts only, via regex)
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
function firstSentence(h) {
  const s = h.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/\bA\.K\.A\.?/gi, 'aka').trim();
  const re = /(?<!\b(?:St|Dr|Mr|Mrs|Ms|Co|Jr|No|Mt|Ft|vs|c|ca|U\.S|Inc|Ltd))\.(?=\s+[A-Z"“]|\s*$)/g;
  const m = re.exec(s);
  return m ? s.slice(0, m.index) : s;
}
const CAP = "[A-Z\\u00C0-\\u017F][\\p{L}'’.\\-]*";
const PARTICLE = "(?:de|da|del|della|di|du|van|von|der|la|le|y|dos|'[A-Za-z]+'|\"[^\"]+\"|“[^”]+”)";
const NAME = `${CAP}(?:\\s+(?:${CAP}|${PARTICLE})){0,4}`;
const PERSON_RE = new RegExp(`\\bby\\s+(yours truly|${NAME}(?:\\s+(?:and|&)\\s+${NAME})?)`, 'u');
const eraOf = y => y == null ? null : y < 1900 ? 'colonial' : y < 1934 ? 'pre-tiki' : y < 1960 ? 'golden' : y < 1980 ? 'late-classic' : y < 1998 ? 'decline' : y < 2010 ? 'revival' : 'craft';

function cutPlace(s, venue = false) {
  // Keep the leading run of capitalised comma parts: "Glasgow, Scotland, who says ..." → "Glasgow, Scotland".
  const parts = [];
  for (const raw of s.replace(/[>|].*$/, '').split(/,\s*/)) {
    const whole = raw.trim().replace(/[.;:]+$/, '');
    const p = whole.replace(/\s+(where|who|when|which|for|and|after|as|using|this|to|with|while|during|by|but|in \d{4}|on \d|from|before|until|since|then|now|was|is|were)\b.*$/i, '').trim().replace(/[.;:]+$/, '');
    if (!(venue ? /^[A-Z0-9À-ſ'][\p{L}\d.'’&@\- ]*$/u : /^[A-ZÀ-ſ][\p{L}.'’&\- ]*$/u).test(p) || p.split(/\s+/).length > (venue ? 7 : 5)) break;
    if (/^(The|This|It|He|She|They|His|Her|Originally|Recipe|See|For)\b/.test(p) && parts.length) break;
    if (/^(Hotel|Bar|Restaurant)$/i.test(p)) continue;
    parts.push(p);
    if (p !== whole) break;
  }
  return parts.join(', ') || null;
}

function provenance(history) {
  const out = { year: null, circa: false, creator: null, venue: null, location: null, basis: null, parents: [] };
  if (!history) return out;
  const h = history.replace(/\s+/g, ' ').replace(/\s+([,.;:!?'’])/g, '$1').replace(/\s+'s\b/g, "'s")
    .replace(/\bA\.K\.A\.?/gi, 'aka').replace(/\b([A-Z])\.(?=\s*[A-Z])/g, '$1').trim(); // initials: "David A. Embury"
  const first = firstSentence(h);
  const YEAR = '(1[6-9]\\d\\d|20[0-2]\\d)';
  const yearRe = new RegExp(`\\b(?:(circa|c\\.|ca\\.|around|about|approximately|early|mid|mid-|late)\\s+(?:the\\s+)?)?${YEAR}(s)?\\b`, 'i');
  // 1. "created / invented / discovered ... [in YEAR] [by PERSON] [at VENUE[, LOCATION]]", or a competition entry
  //    ("Bacardí Legacy 2015 winning cocktail by X at Y in Z"), or "a 2015 recipe by X".
  const created = first.match(/\b(created|invented|discovered|devised|conceived|originated|first (?:made|served|mixed|created)|winning (?:cocktail|drink|recipe)|(?:a|an) (?:1[6-9]\d\d|20[0-2]\d) (?:recipe|drink|cocktail))\b(.*)$/i);
  // 2. a dated book: "a recipe in Harry Craddock's 1930 The Savoy Cocktail Book", "Adapted from David A. Embury's 1948 ...",
  //    "Victor Bergeron's Trader Vic's Bartender's Guide (1972)", "who in his 1948 Fine Art of Mixing Drinks".
  const bookRes = [
    new RegExp(`\\b(?:adapted from|recipe (?:originally )?(?:first )?(?:published )?(?:in|from)|published in|appear(?:ed|s|ance) in|found in|recipe book,|in)\\s+[^;()]{0,70}?'s\\s+${YEAR}\\b`, 'i'),
    new RegExp(`\\b(?:book|guide|manual|days|drinks)\\b[^;()]{0,40}\\(${YEAR}\\)`, 'i'),
    new RegExp(`\\bin (?:his|her|their) ${YEAR}\\b`, 'i'),
    new RegExp(`\\b${YEAR} edition of\\b`, 'i'),
  ];
  const book = bookRes.map(re => h.slice(0, 400).match(re)).filter(Boolean).sort((a, b) => a.index - b.index)[0];
  if (created) {
    const tail = created[2];
    const lead = created[1].match(yearRe);
    const comp = first.match(/(?:Legacy|Tales of the Cocktail)\s+(20[0-2]\d)\b|\b(20[0-2]\d)\s+(?:Tales of the Cocktail|Bacard[ií] Legacy)/i);
    const y = lead || (/winning/i.test(created[1]) ? first.match(yearRe) : null) || tail.match(yearRe)
      || (comp ? [comp[0], null, comp[1] || comp[2], null] : null);
    if (y) { out.year = +y[2]; out.circa = !!(y[1] || y[3]); out.basis = 'created'; }
    const who = tail.match(PERSON_RE);
    if (who) {
      const c = who[1].trim();
      out.creator = /^yours truly$/i.test(c) ? 'Simon Difford' : c.replace(/[,.]$/, '');
      if (/^(The|A|An|Bacard|Jack|Martini|Diageo|Campari|Brown)\b/.test(out.creator)) out.creator = null;
    }
    const at = tail.match(/\bat\s+(?:the\s+)?([A-Z0-9À-ſ][^;()]*)$/u);
    if (at) {
      const rest = at[1];
      const inIdx = rest.search(/\s+in\s+(?=[A-Z])/);
      if (inIdx > 0) {
        out.venue = cutPlace(rest.slice(0, inIdx).replace(/,\s*$/, ''), true);
        out.location = cutPlace(rest.slice(inIdx).replace(/^\s+in\s+/, ''));
      } else {
        const parts = rest.split(/,\s*/);
        out.venue = cutPlace(parts[0], true);
        out.location = parts.length > 1 ? cutPlace(parts.slice(1).join(', ')) : null;
      }
      if (out.venue && out.venue.length > 60) out.venue = null;
    } else {
      const loc = tail.match(/\bin\s+(?:the\s+)?(?!\d)([A-ZÀ-ſ][^;()]*)$/u);
      if (loc) out.location = cutPlace(loc[1]);
    }
    if (out.location && /^(June|July|\d)/.test(out.location)) out.location = null;
  }
  if (out.year == null && book) { out.year = +book[1]; out.circa = true; out.basis = 'book'; }
  if (out.year == null) {
    const c = h.match(new RegExp(`^(?:circa|c\\.)\\s+(?:the\\s+)?${YEAR}(s)?`, 'i'));
    if (c) { out.year = +c[1]; out.circa = true; out.basis = 'created'; }
  }
  if (out.year == null) {
    // A dated origin statement later in the History ("first appeared in print in 1937", "traces its origin back to ... 1740").
    const later = h.match(new RegExp(`\\b(?:created|invented|originated|first (?:known )?(?:published|appeared|appears|appearance|recorded|mentioned|served|printed)|dates? (?:back )?(?:to|from)|traces? (?:its|their) origins? (?:back )?to)\\b[^.]{0,80}?\\b(?:(circa|c\\.|around|about|early|mid|late)\\s+)?(?:the\\s+)?${YEAR}(s)?\\b`, 'i'));
    if (later) { out.year = +later[2]; out.circa = true; out.basis = 'later statement'; }
  }
  if (out.venue && new RegExp(`^(${MONTHS})\\b`).test(out.venue)) out.venue = null;
  // Parents: "a riff on the classic X", "a variation on the X", "a twist on X".
  const PNAME = "[A-Z\\u00C0-\\u017F][\\p{L}\\d'’&\\-]*(?:\\s+(?:[A-Z\\u00C0-\\u017F\\d][\\p{L}\\d'’&\\-]*|of|the|de|la|del|on|'n'|n'))*";
  const pr = new RegExp(`\\b(?:riff|twist|variation|variant|take|play|spin|version)\\s+(?:on|of)\\s+(?:the\\s+|a\\s+|an\\s+)?(?:classic\\s+|vintage\\s+|famous\\s+|original\\s+|tiki\\s+)?(${PNAME})`, 'gu');
  const hp = h.replace(/\bNo\.\s*(\d)/g, 'No $1');
  let m;
  while ((m = pr.exec(hp))) {
    const p = m[1].trim();
    if (p.length > 2 && p.length < 40 && !/^(Difford|Tiki|Jeff|Don|Trader|Victor|The|Our|This|That)$/i.test(p) && !out.parents.includes(p)) out.parents.push(p);
  }
  return out;
}

// Era: from the History year when there is one; otherwise judgment from facts in the text.
const HIST_ERA = [
  [/Beaumont-Gantt|\bDonn? (the )?Beach(comber)?\b/i, 'golden'],
  [/Trader Vic|Victor (J\. )?Bergeron/i, 'golden'],
  [/Floridita|Constant(e|ino) Ribalaigua|Sloppy Joe|Prohibition|Queen's Park Hotel|Raffles|Savoy Cocktail Book|Harry Craddock|MacElhone|Ensslin/i, 'pre-tiki'],
  [/Jerry Thomas|19th[- ]century|nineteenth century/i, 'colonial'],
];
function judgeEra(prov, hist) {
  if (prov.year != null) return { era: eraOf(prov.year), basis: `year (${prov.basis})` };
  const facts = `${prov.creator || ''} ${prov.venue || ''} ${firstSentence(hist)}`;
  for (const [re, era] of HIST_ERA) if (re.test(facts)) return { era, basis: 'historic creator/venue/source named' };
  if (/yours truly|Bacard[ií] Legacy|competition|Cabinet Room/i.test(hist)) return { era: 'craft', basis: 'history-modern' };
  // No dating facts: Difford's undated entries are overwhelmingly the 1990s–2000s bar drinks catalogued in
  // the guide's early editions, so 'revival' is the least-wrong default (never 'craft' without evidence).
  return { era: 'revival', basis: 'undated default' };
}

// Canonical drink names that, when contained in a longer name, mark it as a riff (e.g. "Guava Daiquiri").
const CANON_PARENTS = [
  ['daiquiri', 'Daiquiri'], ['mai tai', 'Mai Tai'], ['pina colada', 'Piña Colada'], ['colada', 'Piña Colada'], ['mojito', 'Mojito'],
  ['zombie', 'Zombie'], ['caipirinha', 'Caipirinha'], ['painkiller', 'Painkiller'], ['jungle bird', 'Jungle Bird'], ['hurricane', 'Hurricane'],
  ['planters punch', "Planter's Punch"], ['queens park swizzle', "Queen's Park Swizzle"], ['mule', 'Moscow Mule'], ['dark n stormy', "Dark 'n' Stormy"],
  ['navy grog', 'Navy Grog'], ['scorpion', 'Scorpion'], ['fog cutter', 'Fog Cutter'], ['ti punch', "Ti' Punch"],
  ['cuba libre', 'Cuba Libre'], ['pisco punch', 'Pisco Punch'], ['margarita', 'Margarita'], ['cosmopolitan', 'Cosmopolitan'],
];

// ---------------------------------------------------------------- popularity
// Difford's scrape has no "classic" flag, so: calibrated knowledge list (BRIEF.md scale) + History calling it a classic.
const FAMOUS = {
  'mai tai': 5, 'pina colada': 5, 'painkiller': 5, 'zombie': 5, 'daiquiri': 5, 'hurricane': 5, 'mojito': 5,
  'navy grog': 4, 'jungle bird': 4, 'scorpion': 4, 'planters punch': 4, 'missionarys downfall': 4, 'queens park swizzle': 4,
  'blue hawaii': 4, 'rum runner': 4, 'caipirinha': 4, 'dark n stormy': 4, 'dark and stormy': 4, 'cuba libre': 4,
  'hemingway special daiquiri': 4, 'hemingway daiquiri': 4, 'strawberry daiquiri': 4, 'frozen daiquiri': 4,
  'test pilot': 3, 'saturn': 3, 'three dots and a dash': 3, 'fog cutter': 3, 'jet pilot': 3, 'chartreuse swizzle': 3,
  'bahama mama': 3, 'rum swizzle': 3, 'bermuda rum swizzle': 3, 'ti punch': 3, 'air mail': 3, 'airmail': 3, 'pisco punch': 3,
  'mary pickford': 3, 'bumbo': 3, 'batida': 3, 'blue hawaiian': 3, 'lychee martini': 3, 'porn star martini': 3, 'pornstar martini': 3,
  'banana daiquiri': 3, 'nuclear daiquiri': 3, 'trinidad sour': 3, 'rum punch': 3, 'fish house punch': 3, 'mango daiquiri': 3,
  'pineapple daiquiri': 3, 'passion fruit daiquiri': 3, 'coconut daiquiri': 3, 'caipirissima': 3, 'bajan rum punch': 3,
  'el presidente': 3, 'dead man walking': 2, 'goombay smash': 3, 'singapore sling': 4, 'mary pickford cocktail': 3,
  'rum and coke': 3, 'cable car': 3, 'kingston negroni': 3, 'daiquiri no 3': 2, 'daiquiri no 4': 2, 'daiquiri no 5': 2,
  'pineapple express': 2, 'bushwacker': 3, 'miami vice': 3, 'lava flow': 3, 'tropical itch': 2, 'suffering bastard': 3,
  'rum old fashioned': 3, 'corn n oil': 3, 'corn and oil': 3, 'paloma': 4, 'passion fruit martini': 3, 'bay breeze': 3,
  'sex on the beach': 4, 'malibu bay breeze': 3, 'tequila sunrise': 4, 'singapore sling 1': 4,
};

// ---------------------------------------------------------------- notes (generated, own words)
const SHORT = {
  'rum-white-column': 'light rum', 'rum-gold-column': 'gold rum', 'rum-aged-column': 'aged Spanish-style rum',
  'rum-blended-light': 'lightly aged blended rum', 'rum-barbados': 'blended aged rum', 'rum-jamaican-aged': 'aged Jamaican rum',
  'rum-jamaican-dark': 'dark Jamaican rum', 'rum-jamaican-pot': 'Jamaican pot-still rum', 'rum-jamaican-white-overproof': 'white overproof Jamaican rum',
  'rum-demerara': 'Demerara rum', 'rum-demerara-overproof': 'Demerara 151', 'rum-black-blended': 'black rum', 'rum-black-overproof': 'overproof black rum',
  'rum-agricole-blanc': 'rhum agricole blanc', 'rum-agricole-vieux': 'aged rhum agricole', 'rum-haitian': 'Haitian rum', 'rum-navy': 'navy rum',
  'rum-overproof-white': '151 rum', 'rum-spiced': 'spiced rum', 'rum-pineapple': 'pineapple rum', 'rum-cachaca': 'cachaça', 'batavia-arrack': 'Batavia arrack',
  'tequila-blanco': 'tequila', 'tequila-reposado': 'reposado tequila', 'scotch-blended': 'Scotch', 'scotch-islay': 'peated Scotch', 'gin-old-tom': 'Old Tom gin',
  'orange-curacao': 'orange curaçao', 'velvet-falernum': 'falernum', 'allspice-dram': 'allspice dram', 'coconut-cream': 'cream of coconut',
  'coconut-rum': 'coconut liqueur', 'pineapple-juice': 'pineapple', 'passion-fruit-syrup': 'passion fruit syrup', 'passion-fruit-juice': 'passion fruit',
  'passion-fruit-nectar': 'passion fruit juice', 'orange': 'orange juice', 'grapefruit': 'grapefruit', 'rich-simple': 'rich syrup', 'demerara-syrup': 'demerara syrup',
  'honey-syrup': 'honey', 'cinnamon-syrup': 'cinnamon syrup', 'campari': 'Campari-style bitter', 'half-and-half': 'cream', 'egg-white': 'egg white',
  'soda-water': 'soda', 'lemon-lime-soda': 'lemon-lime soda', 'sparkling-wine': 'sparkling wine', 'mint': 'mint', 'angostura': 'Angostura',
  'banana-liqueur': 'banana liqueur', 'lychee-liqueur': 'lychee liqueur', 'guava-nectar': 'guava', 'mango-nectar': 'mango', 'banana': 'fresh banana',
  'cherry-heering': 'cherry liqueur', 'amontillado-sherry': 'sherry', 'lillet-blanc': 'aromatized wine', 'tiki-bitters': 'tiki bitters',
};
const labelOf = id => SHORT[id] || (ING.get(id)?.name || id).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*\/.*$/, '').trim().replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase());
const STRUCT = {
  daiquiri: d => d.method === 'blend' ? 'frozen sour' : d.ice === 'none' ? 'sour served up' : d.ice === 'crushed' ? 'sour over crushed ice' : 'sour on ice',
  swizzle: () => 'swizzle', colada: d => d.method === 'blend' ? 'blended colada' : 'colada-style drink', 'mai-tai': () => 'Mai Tai-style sour',
  zombie: () => 'multi-rum Zombie-style drink', grog: () => 'grog', buck: d => d.ingredients.some(l => l.id === 'ginger-beer') ? 'buck' : 'highball',
  punch: d => d.method === 'hot' ? 'hot punch' : 'punch', 'resort-punch': () => 'fruit-forward tropical punch', 'bitter-tiki': () => 'bittersweet tropical sour',
  'beachcomber-sour': () => 'spiced tropical sour', 'orgeat-punch': () => 'orgeat punch', stirred: () => 'stirred, spirit-forward drink', hot: () => 'hot drink',
};
const listText = xs => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const COMMON = new Set(['lime', 'lemon', 'rich-simple', 'simple-syrup', 'water', 'saline', 'egg-white', 'soda-water']);

function makeNotes(d, dropped, approxKey) {
  const bases = d.ingredients.filter(l => RUM_IDS.has(l.id) || SPIRIT_IDS.has(l.id)).sort((a, b) => ozOf(b) - ozOf(a));
  const baseIds = [...new Set(bases.map(l => l.id))];
  const rumCount = baseIds.filter(id => RUM_IDS.has(id)).length;
  let base;
  if (rumCount >= 3) base = `${rumCount}-rum`;
  else if (baseIds.length >= 2) base = `${labelOf(baseIds[0])} and ${labelOf(baseIds[1])}`;
  else base = baseIds.length ? labelOf(baseIds[0]) : 'liqueur-based';
  const mods = [...new Set(d.ingredients.filter(l => !l.garnish && !COMMON.has(l.id) && !baseIds.includes(l.id)).sort((a, b) => ozOf(b) - ozOf(a)).map(l => labelOf(l.id)))].slice(0, 3);
  const struct = STRUCT[d.family](d);
  const article = /^[aeiou]/i.test(base) ? 'an' : 'a';
  let s = `Difford's Guide spec for ${article} ${base} ${struct}${mods.length ? ` with ${listText(mods)}` : ''}.`;
  if (d.method === 'blend' && d.family !== 'daiquiri' && d.family !== 'colada') s = s.replace(/\.$/, ', blended with ice.');
  if (dropped.length) s += ` Minor accents outside our vocabulary omitted (${listText(dropped)}).`;
  if (approxKey.length) s += ` Mapped approximately: ${listText(approxKey)}.`;
  return s;
}

// ---------------------------------------------------------------- existing records for dedupe
const drinksDir = join(root, 'data/drinks');
const existing = [];
for (const f of readdirSync(drinksDir)) {
  if (!f.endsWith('.json') || f === 'difford.json' || f.endsWith('.new-ingredients.json')) continue;
  try {
    const arr = JSON.parse(readFileSync(join(drinksDir, f), 'utf8'));
    if (Array.isArray(arr)) for (const d of arr) if (d && d.name && Array.isArray(d.ingredients)) existing.push({ ...d, _slice: f });
  } catch (e) { console.warn(`warn: could not read ${f}: ${e.message}`); }
}
const existingByName = new Map();
const existingIds = new Set(existing.map(d => d.id));
for (const d of existing) for (const n of [d.name, ...(d.aka || [])]) {
  const k = nameKey(n);
  if (!k) continue;
  if (!existingByName.has(k)) existingByName.set(k, []);
  existingByName.get(k).push(d);
}
// Dedupe compares ingredient ids after folding interchangeable styles into one class, so the
// same drink written with a different rum style or sugar syrup still reads as the same spec.
const ID_CLASS = {
  'simple-syrup': 'sugar', 'rich-simple': 'sugar', 'demerara-syrup': 'sugar',
  pastis: 'anise', absinthe: 'anise', 'orange-curacao': 'orange-liqueur', 'triple-sec': 'orange-liqueur',
  'velvet-falernum': 'falernum', 'falernum-syrup': 'falernum', 'coconut-cream': 'coconut', 'coconut-milk': 'coconut',
  'passion-fruit-syrup': 'passion', 'passion-fruit-juice': 'passion', 'passion-fruit-nectar': 'passion', 'passion-fruit-liqueur': 'passion',
  'tequila-blanco': 'tequila', 'tequila-reposado': 'tequila', 'gin-old-tom': 'gin', 'amaro': 'amaro', 'fernet': 'amaro', 'cynar': 'amaro',
  'honey-syrup': 'honey', 'gardenia-mix': 'honey', 'hot-buttered-rum-batter': 'butter', butter: 'butter',
};
const idClass = id => RUM_IDS.has(id) ? 'rum' : ID_CLASS[id] || id;
const coreIds = d => [...new Set(d.ingredients.filter(l => !l.garnish && !['water', 'saline'].includes(l.id)).map(l => idClass(l.id)))];
const baseClass = d => {
  const b = d.ingredients.filter(l => !l.garnish).sort((a, c) => ozOf(c) - ozOf(a)).find(l => RUM_IDS.has(l.id) || SPIRIT_IDS.has(l.id));
  if (!b) return 'liqueur';
  const c = ING.get(b.id);
  return RUM_IDS.has(b.id) ? 'rum' : /bourbon|rye|scotch|irish/.test(b.id) ? 'whiskey' : /tequila|mezcal/.test(b.id) ? 'agave' : c.id;
};
// Explicit same-drink links whose names differ between Difford's and our slices (checked by hand).
const ALIASES = MAP.dedupe_aliases || {};

// ---------------------------------------------------------------- main loop
const stats = { scanned: 0, malformed: 0, notTropical: 0, tropical: 0, shot: 0, dessert: 0, mocktail: 0, unmappable: 0, duplicate: 0, collision: 0, imported: 0, variants: 0 };
const eraBasis = {};
const why = {}, unmappableKey = {}, unmappableMinor = {}, droppedOptional = {}, dupes = [], variantsKept = [], unmappableDrinks = [], collisions = [];
const out = [];
const usedIds = new Set();
const files = readdirSync(dataDir).filter(f => f.endsWith('.json')).sort();

for (const f of files) {
  let d;
  try { d = JSON.parse(readFileSync(join(dataDir, f), 'utf8')); } catch { stats.malformed++; continue; }
  stats.scanned++;
  if (!d || !d.Name || !Array.isArray(d.Ingredients) || !d.Ingredients.length) { stats.malformed++; continue; }
  const instr = (d.Instructions || []).map(s => String(s).replace(/\s+/g, ' ').trim());
  const parsed = d.Ingredients.map(parseIngredient);

  // map
  const lines = [], dropped = [], approxKey = [], approxAll = [], badKey = [], optional = [];
  for (const p of parsed) {
    if (p.optional) { optional.push(p.label); continue; }
    const rule = findRule(p.name);
    if (rule && rule.drop) continue;
    if (!rule || !rule.id) {
      if (isMinor(p)) dropped.push(p.label);
      else badKey.push(p.label);
      continue;
    }
    const r = convert(p, rule);
    if (r.error) { if (isMinor(p)) dropped.push(p.label); else badKey.push(`${p.label} [${r.error}]`); continue; }
    if (rule.approx && !isMinor(p)) {
      approxAll.push({ label: p.label, id: rule.id });
      if (RUM_IDS.has(rule.id) || SPIRIT_IDS.has(rule.id) || ozOf(r.line) >= 0.5) approxKey.push(`${p.label} → ${rule.id}`);
    }
    // Two Difford's lines that map to the same id and unit (milk + single cream, white + brown cacao) merge.
    const twin = lines.find(l => l.id === r.line.id && l.unit === r.line.unit && !l.float && !r.line.float && l.unit !== 'top');
    if (twin && typeof twin.amount === 'number') {
      twin.amount = round(twin.amount + r.line.amount, 3);
      twin.orig = [twin.orig || twin.id, r.line.orig || p.label].join(' + ');
    } else lines.push(r.line);
  }
  const glassLine = instr.map(x => x.match(/pre-chill (?:a|an)\s+(.+?)\s*\.?$/i)).find(Boolean);
  const glass = cleanGlass(d.Glass || (glassLine ? glassLine[1] : ''));
  const { method, ice } = parseMethod(instr, lines, glass);
  // FLOAT instructions: mark the floated ingredient.
  for (const s of instr.filter(x => /\bFLOAT\b/.test(x))) {
    for (const l of lines) {
      const key = (l.orig || labelOf(l.id)).toLowerCase().split(/\s+/).slice(0, 2).join(' ');
      if (key && s.toLowerCase().includes(key)) l.float = true;
    }
  }
  const baseLine = lines.filter(l => RUM_IDS.has(l.id) || SPIRIT_IDS.has(l.id)).sort((a, b) => ozOf(b) - ozOf(a))[0];
  const ctx = { hits: markerHits(parsed), lines, method, ice, glass, name: d.Name, baseId: baseLine && baseLine.id };
  const sel = selectTropical(ctx);
  if (!sel.tropical) { stats.notTropical++; continue; }
  stats.tropical++;
  tally(why, sel.why.startsWith('rum + ') ? 'rum base + tropical marker' : sel.why.startsWith('marker ') ? 'non-rum base + clear tropical marker' : sel.why);

  for (const x of dropped) tally(unmappableMinor, x);
  for (const x of optional) tally(droppedOptional, x);
  if (isShot(d, parsed)) { stats.shot++; continue; }
  if (isDessert(lines, sel.why.startsWith('rum + '))) { stats.dessert++; continue; }
  if (!badKey.length && ethanolOz(lines) < 0.2) { stats.mocktail++; continue; }
  if (badKey.length) {
    stats.unmappable++;
    for (const b of badKey) tally(unmappableKey, b.replace(/\s*\[.*\]$/, ''));
    unmappableDrinks.push(`${d.Name}: ${badKey.join('; ')}`);
    continue;
  }
  if (lines.length < 2) { stats.unmappable++; unmappableDrinks.push(`${d.Name}: fewer than 2 mappable ingredients`); continue; }

  // garnish
  const garnish = parseGarnish(instr, d.Garnish);
  const gtext = garnish.join(' ');
  if (/nutmeg/.test(gtext) && !lines.some(l => l.id === 'nutmeg')) lines.push({ id: 'nutmeg', unit: 'garnish', garnish: true });
  if (/cinnamon/.test(gtext) && !/cinnamon stick/.test(gtext) && !lines.some(l => l.id === 'cinnamon')) lines.push({ id: 'cinnamon', unit: 'garnish', garnish: true });
  if (/mint sprig/.test(gtext) && !lines.some(l => l.id === 'mint')) lines.push({ id: 'mint', amount: 1, unit: 'sprig', garnish: true });

  // provenance
  const prov = provenance(d.History);
  const { base, qual } = splitName(d.Name);
  const hist = (d.History || '').replace(/\s+/g, ' ');
  const era = judgeEra(prov, hist);

  const rec = {
    id: '', name: base, variant: qual, aka: [],
    family: 'punch', families_secondary: [],
    year: prov.year, circa: prov.circa, era: era.era,
    creator: prov.creator, venue: prov.venue, location: prov.location,
    popularity: 2,
    parents: [],
    ingredients: lines, method, ice, glass, garnish, servings: 1,
    source: SOURCE, source_urls: [d.Url].filter(Boolean),
    confidence: approxKey.length ? 'low' : 'medium',
    notes: '',
  };
  // Batch punches: a bowl/jug recipe → servings.
  const totalOz = lines.reduce((a, l) => a + (l.unit === 'top' ? 2 : ozOf(l)), 0);
  if (totalOz > 12 && /bowl|jug|pitcher|carafe|serves|punch/i.test(instr.join(' ') + ' ' + glass + ' ' + d.Name)) rec.servings = Math.max(2, Math.round(totalOz / 5));
  Object.assign(rec, classifyFamily(rec));
  tally(eraBasis, era.basis);
  // parents
  const nb = norm(base);
  const parents = new Set(prov.parents);
  for (const [k, p] of CANON_PARENTS) if (nb.includes(k) && nb !== k && norm(p) !== nb && !(k === 'colada' && nb.includes('pina colada'))) { parents.add(p); break; }
  rec.parents = [...parents].filter(p => norm(p) !== nb).slice(0, 3);
  // popularity
  const fam = FAMOUS[nb];
  rec.popularity = fam ? Math.min(fam, qual ? 3 : fam) : (/^(A|This|The) (classic|vintage)\b|\bis a classic\b|\bVintage cocktail\b/i.test(firstSentence(hist)) ? 3 : 2);

  // dedupe against the other slices
  const myIds = coreIds(rec);
  const keys = [nameKey(base), nameKey(d.Name), nameKey(`${base} ${qual}`)];
  // A qualifier that is an alternative name rather than a spec note ("The Getaway (AKA Cynar Daiquiri)", "(Papa Doble)").
  if (qual && !/recipe|style|\bby\b|formula|serve|version|difford|original|frozen|rocks|simple|\bwith\b|contemporary|blended|straight|made|method|twist|based/i.test(qual)) keys.push(nameKey(qual.replace(/^aka\s+/i, '')));
  const matches = [...new Set([
    ...keys.flatMap(k => existingByName.get(k) || []),
    ...(ALIASES[d.Name] || []).map(id => existing.find(e => e.id === id)).filter(Boolean),
  ])];
  let idBase = slug(qual ? `${base} ${qual}` : base);
  if (matches.length) {
    const best = matches.map(e => ({ e, sim: jaccard(myIds, coreIds(e)) })).sort((a, b) => b.sim - a.sim)[0];
    // "X (by <author>)" is a distinct documented version when none of our same-name records is that author's.
    const byWho = qual.match(/^by\s+(.+)$/i);
    const surname = byWho && byWho[1].trim().split(/\s+/).pop();
    const distinctAuthor = !!surname && !matches.some(e => `${e.creator || ''} ${e.venue || ''} ${e.variant || ''} ${e.name}`.toLowerCase().includes(surname.toLowerCase()));
    if (best.sim >= 0.5 && !distinctAuthor) {
      stats.duplicate++;
      dupes.push(`${d.Name} ≈ ${best.e._slice}:${best.e.id} (J=${best.sim.toFixed(2)})`);
      continue;
    }
    // Same name, materially different spec. It is a genuine variant only if it is recognisably the same
    // drink (same base-spirit class or same family, and some shared core); otherwise it is an unrelated
    // drink that happens to share the name → skipped, so it can't be confused with ours at merge time.
    const sameDrink = best.sim >= 0.15 && (matches.some(e => baseClass(e) === baseClass(rec)) || matches.some(e => e.family === rec.family));
    if (!sameDrink) {
      stats.collision++;
      collisions.push(`${d.Name} vs ${best.e._slice}:${best.e.id} (J=${best.sim.toFixed(2)}, base ${baseClass(rec)}/${baseClass(best.e)})`);
      continue;
    }
    // Keep as a documented Difford's variant. Undated → the drink's era is that of the drink it adapts.
    rec.variant = qual && !/difford/i.test(qual) ? `${qual} (Difford's Guide adaptation)` : "Difford's Guide adaptation";
    if (rec.year == null && era.basis !== 'history-modern') { rec.era = best.e.era; eraBasis[era.basis]--; tally(eraBasis, 'inherited from matched drink'); }
    rec.popularity = Math.min(rec.popularity, 3);
    idBase = `${slug(qual ? `${base} ${qual}` : base)}-difford`;
    stats.variants++;
    variantsKept.push(`${d.Name} (best J=${best.sim.toFixed(2)} vs ${best.e._slice}:${best.e.id})`);
  }
  let id = idBase;
  if (existingIds.has(id) && !id.endsWith('-difford')) id = `${idBase}-difford`;
  let k = 2;
  while (usedIds.has(id) || existingIds.has(id)) id = `${idBase}-${k++}`;
  usedIds.add(id);
  rec.id = id;
  rec.notes = makeNotes(rec, dropped, approxAll.map(a => `${a.label} as ${ING.get(a.id).name.replace(/\s*\(.*?\)/g, "")}`));
  if (!rec.creator) delete rec.creator;
  if (!rec.venue) delete rec.venue;
  if (!rec.location) delete rec.location;
  out.push(rec);
  stats.imported++;
}

out.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

// ---------------------------------------------------------------- report
const famDist = {};
for (const d of out) tally(famDist, d.family);
const eraDist = {};
for (const d of out) tally(eraDist, d.era);
console.log(`Difford's import → ${basename(OUT)}  (dedupe checked against ${existing.length} records in ${new Set(existing.map(e => e._slice)).size} other slice files)`);
console.log(`scanned ${stats.scanned} (malformed ${stats.malformed})`);
console.log(`not tropical by filter: ${stats.notTropical}`);
console.log(`tropical by filter: ${stats.tropical}   reasons: ${JSON.stringify(why)}`);
console.log(`  excluded shots/shooters: ${stats.shot}`);
console.log(`  excluded cream-heavy dessert drinks: ${stats.dessert}`);
console.log(`  excluded non-alcoholic (temperance) recipes: ${stats.mocktail}`);
console.log(`  skipped as unmappable: ${stats.unmappable}`);
console.log(`  skipped as duplicate: ${stats.duplicate}`);
console.log(`  skipped as same-name but unrelated drink: ${stats.collision}`);
console.log(`  imported: ${stats.imported}  (of which same-name Difford's variants: ${stats.variants})`);
console.log(`families: ${JSON.stringify(topN(famDist, 20))}`);
console.log(`eras: ${JSON.stringify(topN(eraDist, 10))}   basis: ${JSON.stringify(eraBasis)}`);
console.log(`confidence low: ${out.filter(d => d.confidence === 'low').length}`);
console.log('top unmappable KEY ingredients:');
for (const [k2, v] of topN(unmappableKey, 25)) console.log(`  ${v}\t${k2}`);
console.log('top dropped minor accents (unmappable dashes/drops/≤1 tsp, tropical records):');
for (const [k2, v] of topN(unmappableMinor, 10)) console.log(`  ${v}\t${k2}`);
console.log(`optional ingredients dropped (tropical records): ${JSON.stringify(topN(droppedOptional, 8))}`);
if (process.env.VERBOSE) {
  console.log('\nduplicates:\n  ' + dupes.join('\n  '));
  console.log('\nsame-name variants kept:\n  ' + variantsKept.join('\n  '));
  console.log('\nname collisions skipped:\n  ' + collisions.join('\n  '));
  console.log('\nunmappable drinks:\n  ' + unmappableDrinks.join('\n  '));
}
