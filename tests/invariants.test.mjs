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
      const inGlass = r.lines.some(l => `${l.name} ${l.id}`.toLowerCase().includes(root.replace(/s$/, '')) || (l.id === 'velvet-falernum' && root === 'falernum'));
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

test('a Blue Hawaii for a blue prayer is aqua-turquoise, not pineapple-green', () => {
  const runs = all.filter(({ p, r }) => /blue hawaii/i.test(p) && r.archetype.id === 'blue-hawaii');
  assert.ok(runs.length, 'the battery has a Blue Hawaii prayer');
  for (const { p, seed, r } of runs) {
    const c = hsl(r.look.body.hex);
    assert.ok(c.h >= 165 && c.h <= 195 && c.s >= 0.35, `${p} [${seed}] ${r.name}: ${r.look.body.hex} at hue ${c.h && c.h.toFixed(0)}`);
    assert.ok(oz(r, 'blue-curacao') <= 1, `${p} [${seed}]: ${oz(r, 'blue-curacao')} oz of curaçao is dye, not a drink`);
  }
});
