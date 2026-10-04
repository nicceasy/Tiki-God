// Invariants a tiki aficionado would check on every drink: the label tells the truth, the
// tagline and garnish never promise what isn't there, the steps match the service, and the
// prayer is answered. Run over the whole review battery, several seeds each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../web/lib/engine.js';
import { showsColor, hsl } from '../web/lib/optics.js';

const j = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const engine = createEngine({
  vocab: j('data/ingredients.json'), families: j('data/families.json'), drinks: j('data/drinks.json'), model: j('data/model.json'),
  vessels: j('data/vessels.json'), archetypes: j('data/archetypes.json'), concepts: j('data/concepts.json'), rules: j('data/technique-rules.json'),
});
const { prompts } = j('scripts/review/battery.json');
const SEEDS = [0, 1, 2];
const all = [];
for (const p of prompts) for (const seed of SEEDS) all.push({ p, seed, r: engine.generate(p, { seed }) });
const has = (r, ...ids) => r.lines.some(l => ids.includes(l.id));
const oz = (r, ...ids) => r.lines.filter(l => ids.includes(l.id)).reduce((t, l) => t + (l.oz || 0), 0);

test('every drink is what its archetype says it is', () => {
  for (const { p, seed, r } of all) assert.ok(r.check.ok, `${p} [${seed}] ${r.name}: ${JSON.stringify(r.check)}`);
});

test('a colada is a colada and a Mai Tai cousin is no fruit punch', () => {
  for (const { p, seed, r } of all) {
    const fam = r.family.id;
    if (fam === 'colada' && !r.style.zeroProof && !/bushwacker|miami-vice/.test(r.archetype.id)) {
      assert.ok(oz(r, 'coconut-cream', 'coconut-milk') >= 0.5, `${p} [${seed}] ${r.name}: a colada without coconut`);
      assert.ok(has(r, 'pineapple-juice') || r.archetype.id === 'coconut-daiquiri', `${p} [${seed}] ${r.name}: a colada without pineapple`);
    }
    if (r.archetype.id === 'mai-tai') assert.ok(!has(r, 'pineapple-juice', 'orange') || /pineapple|orange|tropical/.test(p), `${p} [${seed}] ${r.name}: a Mai Tai with fruit juice nobody asked for`);
  }
});

test('the tagline only names what is in the glass, and only colors the glass shows', () => {
  const COLOR = { 'ruby-red': 'red', blue: 'blue', green: 'green', pink: 'pink', golden: 'gold', violet: 'purple', 'sunset-orange': 'orange' };
  for (const { p, seed, r } of all) {
    if (r.classic) continue;
    const t = r.tagline.toLowerCase();
    for (const [w, c] of Object.entries(COLOR)) if (new RegExp(`^an? ${w}\\b`).test(t)) assert.ok(showsColor(r.look, c), `${p} [${seed}] ${r.name}: tagline says ${w}, look is ${r.look.description}`);
    const m = /with ([a-z' ]+?)(?: and ([a-z' ]+?))?(?:,|\.| for | a riff| with)/.exec(t);
    if (m) for (const word of [m[1], m[2]].filter(Boolean)) {
      const root = word.replace(/^the /, '').split(' ').pop();
      // A garnish on the card counts as in the glass (Tahiti's "tiare tucked behind the ear").
      const inGlass = r.lines.some(l => `${l.name} ${l.id}`.toLowerCase().includes(root.replace(/s$/, '')) || (l.id === 'velvet-falernum' && root === 'falernum')) || word.split(' ').some(w => w.length > 3 && r.garnish.some(g => g.includes(w)));
      assert.ok(inGlass || ['bubbles', 'notes', 'edge', 'funk', 'spice', 'cream', 'butter', 'heat'].includes(root) || /mix/.test(word), `${p} [${seed}] ${r.name}: tagline names "${word}" but the glass has ${r.lines.map(l => l.id).join(', ')}`);
    }
  }
});

test('a fruit garnish only shows fruit that is in the drink (decorative flags aside)', () => {
  const SIG = [[/pineapple wedge|pineapple spear/, ['pineapple-juice', 'rum-pineapple']], [/lime wheel|lime wedge|lime shell|spent lime/, ['lime', 'lime-cordial']], [/orange (wheel|half|slice)/, ['orange', 'orange-curacao', 'triple-sec', 'blue-curacao']], [/banana/, ['banana', 'banana-liqueur']], [/coffee bean/, ['coffee', 'coffee-liqueur']]];
  for (const { p, seed, r } of all) for (const g of r.garnish) for (const [re, ids] of SIG) if (re.test(g)) assert.ok(has(r, ...ids), `${p} [${seed}] ${r.name}: garnish "${g}" without ${ids[0]}`);
});

test('the steps match the service', () => {
  for (const { p, seed, r } of all) {
    const st = r.method.steps.join(' ').toLowerCase();
    if (r.method.up) assert.ok(!/ice and all|top with crushed/.test(st), `${p} [${seed}] ${r.name}: an up drink dumped with its ice`);
    if (r.method.method === 'hot') assert.ok(!/crushed ice|cubed ice|shake/.test(st), `${p} [${seed}] ${r.name}: ice in a hot drink`);
    if (/ice cone/.test(st)) assert.equal(r.method.ice, 'ice-cone', `${p} [${seed}] ${r.name}`);
    if (r.lines.some(l => ['soda-water', 'ginger-beer', 'sparkling-wine', 'tonic'].includes(l.id))) assert.ok(/top with/.test(st), `${p} [${seed}] ${r.name}: carbonation not topped`);
    if (has(r, 'egg-white')) assert.ok(/dry-shake/.test(st), `${p} [${seed}] ${r.name}: egg white without a dry shake`);
  }
});

test('praying again brings a different drink', () => {
  for (const p of prompts) {
    const mine = all.filter(x => x.p === p).map(x => x.r.lines.map(l => `${l.id}:${l.amount}`).sort().join());
    assert.ok(new Set(mine).size >= 2, `${p}: every seed made the same drink`);
    const names = all.filter(x => x.p === p).map(x => x.r.name);
    assert.ok(new Set(names).size === names.length, `${p}: repeated name ${names.join(' / ')}`);
  }
});

test('strength fits the prayer', () => {
  for (const { p, seed, r } of all) {
    if (/zero-proof|designated driver/.test(p)) assert.ok(r.stats.abv < 0.5, `${p} [${seed}]: ${r.stats.abv}%`);
    if (/low abv/.test(p)) assert.ok(r.stats.abv <= 8.5, `${p} [${seed}] ${r.name}: ${r.stats.abv}%`);
    if (/strongest/.test(p)) assert.ok(r.stats.abv >= 14, `${p} [${seed}] ${r.name}: only ${r.stats.abv}%`);
    assert.ok(r.stats.abv < 40, `${p} [${seed}] ${r.name}: ${r.stats.abv}%`);
  }
});

test('every interpretable prayer is heard, and names are never culturally careless', () => {
  const BAD = /\b(pele|savage|native|cannibal|headhunter|voodoo|wahine|plantation|tiki god|idol|aloha|kahuna|mana|kapu)\b/i;
  for (const { p, seed, r } of all) {
    assert.ok(r.explanation.reading.heard.length >= 1, `${p}: heard nothing`);
    assert.ok(!BAD.test(r.name) && !BAD.test(r.tagline), `${p} [${seed}]: "${r.name}" / "${r.tagline}"`);
  }
});

test('a leaning is a preference: real bottles of that color, never a loud one nobody leaned toward', () => {
  for (const { p, seed, r } of all) {
    const intent = engine.parse(p);
    const leanNotes = r.notes.filter(n => /, (for a|so it glows)|(for a (golden glow|sunset-orange glow|ruby blush|pink blush|violet tint|green glint|blue glint))$/.test(n));
    for (const n of leanNotes) {
      if (/blue glint|blue curaçao/i.test(n)) assert.ok([intent.color, intent.colorLean].includes('blue'), `${p} [${seed}] ${r.name}: "${n}" without a blue leaning`);
      if (/green glint|melon|chartreuse/i.test(n)) assert.ok([intent.color, intent.colorLean].includes('green'), `${p} [${seed}] ${r.name}: "${n}" without a green leaning`);
    }
    // A Zombie or a Mai Tai never goes red for a leaning: that's grenadine abuse.
    if (['zombie', 'mai-tai'].includes(r.family.id) && leanNotes.length) assert.ok(!showsColor({ body: r.look.body, layers: [] }, 'red') && !showsColor({ body: r.look.body, layers: [] }, 'pink'), `${p} [${seed}] ${r.name}: a red ${r.family.name}`);
  }
});

test('a color the prayer demands is in the glass at every seed (a neon prayer is green twice, never a pale Mojito)', () => {
  for (const { p, seed, r } of all.filter(({ p }) => /\bneon\b/i.test(p))) {
    const c = hsl(r.look.body.hex);
    assert.ok(c.h !== null && c.h >= 70 && c.h < 165 && c.s > 0.3, `${p} [${seed}] ${r.name}: ${r.look.body.hex} (${r.look.description})`);
  }
});

test('a Blue Hawaii for a blue prayer is aqua-turquoise, not pineapple-green', () => {
  const runs = all.filter(({ p, r }) => /blue hawaii/i.test(p) && r.archetype.id === 'blue-hawaii');
  assert.ok(runs.length, 'the battery has a Blue Hawaii prayer');
  for (const { p, seed, r } of runs) {
    const c = hsl(r.look.body.hex);
    assert.ok(c.h >= 165 && c.h <= 195 && c.s >= 0.35, `${p} [${seed}] ${r.name}: ${r.look.body.hex} at hue ${c.h && c.h.toFixed(0)}`);
    assert.ok(oz(r, 'blue-curacao') <= 1, `${p} [${seed}]: ${oz(r, 'blue-curacao')} oz of curaçao is dye, not a drink`);
  }
});

test('the color words say what the glass is: fruit and bottle words only with that fruit or bottle, brown words only for brown drinks', () => {
  const HUE = { 'mango-gold': [30, 50], 'passion-fruit gold': [30, 50], 'campari red': [340, 12], oxblood: [0, 20], 'hibiscus pink': [315, 2], ruby: [330, 12], garnet: [330, 15], tangerine: [18, 40], coral: [5, 30] };
  const on = (h, [lo, hi]) => h !== null && (lo < hi ? h >= lo && h < hi : h >= lo || h < hi);
  for (const { p, seed, r } of all) {
    const w = r.look.description.split(/ with | under /)[0].toLowerCase().replace(/^(creamy|opaque|cloudy|hazy) /, '');
    const c = hsl(r.look.body.hex);
    if (HUE[w]) assert.ok(on(c.h, HUE[w]), `${p} [${seed}] ${r.name}: "${w}" for ${r.look.body.hex} (hue ${c.h && c.h.toFixed(0)})`);
    if (w === 'mango-gold') assert.ok(has(r, 'mango-nectar', 'mango'), `${p} [${seed}] ${r.name}: mango-gold without mango`);
    if (w === 'campari red') assert.ok(has(r, 'campari'), `${p} [${seed}] ${r.name}: Campari red without Campari`);
    if (/^(tan|café au lait|mahogany|oxblood|dark brown)$/.test(w)) assert.ok(/^creamy |^cloudy café/i.test(r.look.description) || c.l < 0.4, `${p} [${seed}] ${r.name}: "${w}" for a drink that is neither creamy nor dark (${r.look.body.hex})`);
    if (/with a sparkle/.test(r.look.description)) assert.ok(has(r, 'sparkling-wine'), `${p} [${seed}] ${r.name}: sparkles without a sparkling top`);
  }
});

// ---------- absolute balance, doses and line counts (round-2 critique §1, §7) ----------
import { sugarBand } from '../web/lib/chem.js';
const rulesJ = j('data/technique-rules.json');
const archJ = j('data/archetypes.json').archetypes;
const canonNames = new Set(archJ.flatMap(a => (a.canonicalSpecs || []).map(sp => sp.name.replace(/\s*\(.*\)\s*/, '').trim())));
const built = all.filter(x => !x.r.classic && !canonNames.has(x.r.name));
const PLAIN = new Set(['simple-syrup', 'rich-simple', 'demerara-syrup', 'cane-syrup', 'agave-syrup']);
const CREAMY = new Set(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'whole-milk', 'irish-cream', 'tom-and-jerry-batter']);
const DESSERT = new Set(['creme-de-cacao', 'vanilla-ice-cream', 'irish-cream', 'coffee-liqueur', 'chocolate-syrup']);
const label = x => `${x.p} [${x.seed}] ${x.r.name}`;

test('every built drink sits inside the absolute sugar and acid band for how it is made', () => {
  for (const x of built) {
    const { r } = x, it = engine.parse(x.p);
    const L = r.lines.filter(l => !l.garnish);
    const citrus = L.filter(l => ['lime', 'lemon', 'grapefruit', 'yuzu-juice'].includes(l.id)).reduce((t, l) => t + l.oz, 0);
    const creamy = L.some(l => CREAMY.has(l.id) && l.oz >= 0.5), dessert = creamy && L.some(l => DESSERT.has(l.id));
    const b = sugarBand({ method: r.method.method, ice: r.method.ice, servings: r.servings, punchBowl: r.vessel && r.vessel.id === 'punch-bowl', sour: citrus >= 0.5 || r.stats.acidConc >= 0.45, creamy, dessert, sweetness: it.sweetness, tartness: it.tartness }, rulesJ.absoluteBands);
    if (r.family.id === 'zombie' && b.kind === 'shakenSour') b.sugar[0] = 0;
    const fw = (rulesJ.familyWindows[r.family.id] || {}).sugarConc;
    if (fw && b.kind === 'shakenSour') b.sugar[0] = Math.min(b.sugar[0], b.sugar[0] * (fw[0] + fw[1]) / 16);
    if ((it.strength || 0) <= -1.5) b.sugar[0] = Math.min(b.sugar[0], 6);
    if (b.kind === 'shakenSour' && L.some(l => ['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda', 'sparkling-wine'].includes(l.id) && !l.float && l.oz >= 2)) b.sugar[0] = 0;
    assert.ok(r.stats.sugarConc <= b.sugar[1] + 0.4, `${label(x)}: ${r.stats.sugarConc} g over the ${b.kind} ceiling ${b.sugar[1]}`);
    assert.ok(r.stats.sugarConc >= b.sugar[0] - 0.6, `${label(x)}: ${r.stats.sugarConc} g under the ${b.kind} floor ${b.sugar[0]}`);
    if (b.acid) assert.ok(r.stats.acidConc <= b.acid[1] + 0.08, `${label(x)}: acid ${r.stats.acidConc} past ${b.acid[1]}`);
  }
});

test('water is a line only over a block or in a batch, and one sweetener does one job', () => {
  for (const x of built) {
    const { r } = x;
    if (r.lines.some(l => l.id === 'water')) assert.ok(r.servings >= 2 || (r.method.method === 'build' && r.method.ice === 'block'), `${label(x)}: water ${r.method.method} on ${r.method.ice}`);
    const plain = r.lines.filter(l => PLAIN.has(l.id) && !l.sink && !l.float);
    assert.ok(plain.length <= 1, `${label(x)}: two plain syrups`);
    if (plain.length && r.lines.some(l => ['ginger-beer', 'cola'].includes(l.id) && l.oz >= 2)) assert.fail(`${label(x)}: plain syrup on top of a sweet soda`);
    if (r.lines.some(l => /batter/.test(l.id))) assert.ok(!r.lines.some(l => l.role === 'sweet' && !/batter/.test(l.id) && !engine.parse(x.p).ings[l.id]), `${label(x)}: the batter is the sugar`);
  }
});

test('a named flavor is a dose you can taste, and a recipe is at most seven lines', () => {
  const POTENT = new Set(['grenadine', 'maraschino', 'allspice-dram', 'fernet']);
  const SKIP = new Set(['absinthe', 'pastis', 'saline', 'almond-extract', 'vanilla-extract', 'orange-flower-water', 'rose-water', 'na-bitters']);
  for (const x of built) {
    const { r } = x;
    const fin = r.stats.finalOz;
    const named = Math.max(0.25, Math.min(0.5, fin * 0.04)), potent = Math.max(1 / 12, Math.min(0.25, fin * 0.016));
    for (const l of r.lines) {
      if (l.garnish || l.muddled || l.float || l.sink || SKIP.has(l.id) || PLAIN.has(l.id) || ['base', 'lengthener', 'aromatic'].includes(l.role) && l.id !== 'scotch-islay' || ['dash', 'drop', 'piece'].includes(l.unit) || /bitters|angostura|peychaud/.test(l.id)) continue;
      // Don's Mix split into its parts is dosed by its ratio, two of grapefruit to one of cinnamon.
      if (l.id === 'cinnamon-syrup' && r.family.id === 'zombie' && r.lines.some(g => g.id === 'grapefruit')) continue;
      const floor = l.id === 'scotch-islay' ? 0.25 : POTENT.has(l.id) ? potent : named;
      assert.ok(l.oz >= floor - 0.09, `${label(x)}: ${l.oz} oz of ${l.id} in ${fin} oz is a token`);
    }
    const n = r.lines.filter(l => !l.garnish).length;
    assert.ok(n <= (r.family.id === 'zombie' ? 10 : 7), `${label(x)}: ${n} poured lines`);
  }
});

test('the spirit is a full pour, not a bucket: 2½ oz (3 for the Zombie line), floats half an ounce, coconut rum an accent', () => {
  for (const x of built) {
    const { r } = x, it = engine.parse(x.p);
    if (r.servings >= 2) continue;
    const body = r.lines.filter(l => l.role === 'base' && !l.float && !l.sink).reduce((t, l) => t + l.oz, 0);
    const liq = r.lines.filter(l => l.role === 'modifier' && /chartreuse/.test(l.id)).reduce((t, l) => t + l.oz * 55 / 40, 0);
    const cap = r.family.id === 'zombie' ? ((it.strength || 0) > 0 ? 4 : 3) : 2.5;
    assert.ok(body + liq <= cap + 0.13, `${label(x)}: ${body} oz of spirit${liq ? ` and ${liq.toFixed(2)} oz-equivalent of Chartreuse` : ''}`);
    for (const l of r.lines) if (l.float && l.role === 'base' && r.archetype.id !== 'dark-n-stormy') assert.ok(l.oz <= 0.5 + 1e-9, `${label(x)}: a ${l.oz} oz float`);
    const coco = r.lines.find(l => l.id === 'coconut-rum');
    if (coco && !it.ings['coconut-rum']) assert.ok(coco.oz <= 0.5 + 1e-9, `${label(x)}: ${coco.oz} oz coconut rum`);
  }
});

test('a leaning reaches for a colorant, never more juice "for a golden glow"', () => {
  for (const x of all) for (const n of x.r.notes || []) assert.ok(!/(pineapple|orange|mango|nectar|juice)[^,]*, for a (golden|sunset-orange) glow|traded for [^,]*(nectar|juice), for a/.test(n), `${label(x)}: "${n}"`);
});
