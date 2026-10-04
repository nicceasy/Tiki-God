// Garnish and method steps, checked like ingredients (round-1 critique §3 and §5): the card's
// garnish is a controlled vocabulary of concrete, drawable things; a fruit garnish needs its
// fruit in the glass and never shows what the guest refused; the count fits the service; the
// classics wear their own garnish; fire always comes with its safety step; toppers on crushed ice
// leave room; blender ice follows the liquid; a group gets one method for its vessel.
// Run over the whole review battery at three seeds plus targeted prayers. Nothing here assumes
// how many people a prayer serves: expectations are read from the recipe itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../web/lib/engine.js';
import { garnishRule, UMBRELLA_ALLOWED } from '../web/lib/artspec.js';
import { fillBudget, recipeFill } from '../web/lib/vessels.js';

const j = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const vessels = j('data/vessels.json');
const engine = createEngine({
  vocab: j('data/ingredients.json'), families: j('data/families.json'), drinks: j('data/drinks.json'), model: j('data/model.json'),
  vessels, archetypes: j('data/archetypes.json'), concepts: j('data/concepts.json'),
});
const vesselById = Object.fromEntries(vessels.vessels.map(v => [v.id, v]));
const { prompts } = j('scripts/review/battery.json');
const EXTRA = [
  'three dots and a dash', 'a mai tai', 'navy grog', 'painkiller', "queen's park swizzle", 'zombie', 'hurricane', 'scorpion bowl for 4',
  'hot buttered rum', 'tom and jerry', 'hot grog', 'hot rum punch for 8', 'volcano bowl for 2', 'flaming scorpion', 'a flaming drink in a tiki mug',
  'flaming volcano bowl for 4', 'tequila sunrise in an enamel tin mug', 'a sunrise in a tiki mug', 'no pineapple, a zombie', 'a zombie with no cherries',
  'no mint please, something with crushed ice', 'no orange, a painkiller', 'something for my boss', 'minimalist rum drink', 'a mai tai with sparkling wine',
  'a celebration with champagne, crushed ice', 'frozen banana daiquiri', 'mai tai for 2', 'daiquiris for 2', 'hot buttered rum for 2', 'dark and stormy for 2',
  'frozen daiquiri for 2', "queen's park swizzle for 2", 'navy grog for 2', 'a mojito for 2', 'pina colada for 2', 'saturn', 'tropical itch', 'daiquiri',
  'ti punch', 'caipirinha', 'kingston negroni', 'bushwacker', 'jungle bird', 'blue hawaii', 'fog cutter', 'a punch bowl for a party of 8',
];
const all = [];
for (const p of prompts) for (const seed of [0, 1, 2]) all.push({ p, seed, r: engine.generate(p, { seed }) });
for (const p of EXTRA) for (const seed of [0, 1]) all.push({ p, seed, r: engine.generate(p, { seed }) });
const id = ({ p, seed, r }) => `${p} [${seed}] ${r.name} (${r.archetype.id}, ${r.vessel && r.vessel.id})`;
const has = (r, ...ids) => r.lines.some(l => ids.includes(l.id) && !l.garnish);
const steps = r => r.method.steps.join(' ');
const STRAWS = /^(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) long straws$/;
const UP_VESSELS = vessels.vessels.filter(v => v.serve.includes('up')).map(v => v.id);
const isUp = r => r.method.up || UP_VESSELS.includes(r.vessel && r.vessel.id);
const isBowl = r => !!(r.vessel && vesselById[r.vessel.id] && vesselById[r.vessel.id].serve.includes('bowl'));
const heaped = r => ['crushed', 'pebble', 'shaved'].includes(r.method.ice) || r.method.method === 'swizzle';
const decor = r => r.garnish.filter(g => !STRAWS.test(g) && g !== 'straw through the ice cone');
const RESTRAINED = ['sophisticated', 'first-date', 'boss-client', 'minimalist', 'japan-tokyo', 'robot', 'bamboo', 'cuba-havana'];
const restrained = p => engine.parse(p).concepts.some(c => RESTRAINED.includes(c));
const FIZZY = ['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda', 'sparkling-wine'];

test('garnish is plain vocabulary the drawing can show: no template text, no "none", no stray punctuation', () => {
  for (const x of all) for (const g of x.r.garnish) {
    assert.ok(!/named fruit|the fruit|full tiki|when practical|one per guest|\bnone\b|garnish|optional|later|\(|\)|,|\s{2}|^\s|\s$/.test(g), `${id(x)}: "${g}"`);
    const rule = garnishRule(g);
    assert.ok(rule && (rule.parts.length || rule.role === 'service'), `${id(x)}: "${g}" is not drawable`);
  }
});

test('a fruit garnish shows only fruit that is poured (the Three Dots pick and an expressed peel on a stirred drink aside)', () => {
  const ORANGE_OIL = ['orange', 'orange-curacao', 'triple-sec', 'blue-curacao', 'orange-bitters'];
  const SIG = [
    [/pineapple (wedge|frond|spear|chunk)/, ['pineapple-juice', 'rum-pineapple', 'pineapple-syrup']],
    [/orange (wheel|slice)|cherry flag/, ['orange']], [/orange peel|orange-peel/, ORANGE_OIL],
    [/\blime\b/, ['lime', 'lime-cordial']], [/\blemon/, ['lemon']], [/grapefruit/, ['grapefruit', 'dons-mix', 'grapefruit-soda']],
    [/banana/, ['banana', 'banana-liqueur']], [/strawberr/, ['strawberry']], [/passion/, ['passion-fruit-juice', 'passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola']],
    [/mango/, ['mango-nectar']], [/coffee bean/, ['coffee', 'coffee-liqueur']], [/coconut/, ['coconut-cream', 'coconut-milk', 'coconut-water', 'coconut-rum']],
    [/candied ginger/, ['ginger-beer', 'ginger-ale', 'ginger-syrup', 'ginger-liqueur']], [/chocolate/, ['creme-de-cacao', 'white-creme-de-cacao']],
  ];
  for (const x of all) for (const g of x.r.garnish) {
    if (/three cherries and a pineapple chunk/.test(g)) { assert.equal(x.r.archetype.id, 'beachcomber-spice-sour', `${id(x)}: the Morse pick claims a Three Dots`); continue; }
    if (g === 'expressed orange peel' && x.r.family.id === 'stirred') continue;
    // (A classic poured as written wears its own edition's garnish: the Suffering Bastard's orange
    // slice, the Dark 'n Stormy's lime wedge, whatever is in the glass.)
    const edition = x.r.method.canon && x.r.method.canon.method === x.r.method.method && (x.r.classic || (x.r.canon && x.r.canon.state === 'as-written')) ? (x.r.method.canon.garnish || []).join(' ').toLowerCase() : '';
    if (edition && g.split(' ').some(w => w.length > 3 && edition.includes(w))) continue;
    for (const [re, ids] of SIG) if (re.test(g)) assert.ok(has(x.r, ...ids), `${id(x)}: "${g}" without ${ids[0]} (${x.r.lines.map(l => l.id).join(', ')})`);
  }
});

test('nothing the guest refused appears in the garnish, pineapple frond included', () => {
  const WORDS = { pineapple: /pineapple/, coconut: /coconut/, mint: /mint/, cherry: /cherr/, orange: /orange/, lime: /lime/, lemon: /lemon/, banana: /banana/, nutmeg: /nutmeg/, cinnamon: /cinnamon/ };
  let checked = 0;
  for (const x of all) {
    const avoid = engine.parse(x.p).avoidTags;
    for (const [tag, re] of Object.entries(WORDS)) if ((avoid[tag] || 0) >= 1) { checked++; for (const g of x.r.garnish) assert.ok(!re.test(g), `${id(x)}: refused ${tag}, garnish "${g}"`); }
  }
  assert.ok(checked >= 8, 'the battery exercises refusals');
});

test('an up drink gets exactly one thing a stemmed glass can hold', () => {
  let n = 0;
  for (const x of all) if (isUp(x.r)) {
    n++;
    assert.equal(decor(x.r).length, 1, `${id(x)}: ${x.r.garnish.join(', ')}`);
    for (const g of x.r.garnish) {
      // A small edible flower floats on an up drink; an orchid or gardenia doesn't.
      assert.ok(/wheel|peel|twist|on a pick|nutmeg|dusting|grated|toasted|ring around|on the rim|ice shell|coffee beans|^edible flower$/.test(g), `${id(x)}: "${g}" on a stemmed glass`);
      assert.ok(!/mint|umbrella|cinnamon stick|wedge|orchid|gardenia|straw|frond|flaming/.test(g), `${id(x)}: "${g}" on a stemmed glass`);
    }
  }
  assert.ok(n >= 8, 'the battery has up drinks');
});

test('a restrained prayer (elegant, precise, a first date) gets one garnish', () => {
  let n = 0;
  for (const x of all) if (restrained(x.p)) { n++; assert.ok(decor(x.r).length <= 1, `${id(x)}: ${x.r.garnish.join(', ')}`); }
  assert.ok(n >= 6, 'the battery has restrained prayers');
});

test('the count fits the service: crushed-ice tiki ≤ 3 with an aromatic, rocks 1, hot 2, bowls ≤ 4 with a straw per guest', () => {
  const AROMA = /mint|nutmeg|cinnamon|peel|twist|spiral|ring around|lime shell|basil/;
  for (const x of all) {
    const r = x.r, d = decor(r), n = r.servings > 1 ? r.servings : 1;
    const straws = r.garnish.filter(g => STRAWS.test(g));
    if (isBowl(r) && r.vessel.id !== 'punch-bowl' && n > 1) {
      assert.equal(straws.length, 1, `${id(x)}: a shared bowl needs straws`);
      assert.ok(straws[0].startsWith(['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n)), `${id(x)}: ${straws[0]} for ${n}`);
    } else assert.equal(straws.length, 0, `${id(x)}: long straws on a single serve or a ladled punch (${r.garnish.join(', ')})`);
    if (isBowl(r)) assert.ok(r.garnish.length <= 4, `${id(x)}: ${r.garnish.join(', ')}`);
    else if (r.method.method === 'hot') assert.ok(d.length <= 2, `${id(x)}: ${r.garnish.join(', ')}`);
    else if (!isUp(r) && ['dof', 'rocks', 'clay-cup'].includes(r.vessel.id) && ['cubed', 'block', 'none'].includes(r.method.ice)) assert.ok(d.length <= 1, `${id(x)}: rocks drink with ${r.garnish.join(', ')}`);
    else assert.ok(d.length <= 3, `${id(x)}: ${r.garnish.join(', ')}`);
    if (!isBowl(r) && !isUp(r) && heaped(r) && d.length > 1) assert.ok(d.some(g => AROMA.test(g)), `${id(x)}: crushed-ice drink with no aromatic (${r.garnish.join(', ')})`);
    // one of each kind of thing
    for (const k of ['mint', 'cherr', 'orchid|gardenia|flower', 'nutmeg|dusting|grated|toasted']) assert.ok(r.garnish.filter(g => new RegExp(k).test(g)).length <= 1, `${id(x)}: two ${k} (${r.garnish.join(', ')})`);
  }
});

test('hot drinks: spice and peel by archetype, nothing from the ice world', () => {
  for (const x of all) if (x.r.method.method === 'hot') {
    for (const g of x.r.garnish) assert.ok(!/mint|umbrella|straw|pineapple|lime wheel|cherr|orchid|gardenia|ice|flower|flaming/.test(g), `${id(x)}: "${g}" on a hot drink`);
    if (x.r.archetype.id === 'hot-buttered-rum') assert.deepEqual([...x.r.garnish].sort(), ['cinnamon stick', 'freshly grated nutmeg'], id(x));
    if (x.r.archetype.id === 'tom-and-jerry') assert.deepEqual(x.r.garnish, ['freshly grated nutmeg'], id(x));
  }
});

test('the signature serves wear their own garnish', () => {
  const find = (arch, pred = () => true) => all.filter(x => x.r.archetype.id === arch && pred(x.r));
  const every = (arch, fn, pred) => { const xs = find(arch, pred); assert.ok(xs.length, `no ${arch} in the battery`); for (const x of xs) fn(x.r, id(x)); };
  // (The Morse pick is the Three Dots' own: its honey, orange and allspice; another Don sour wears mint.)
  every('beachcomber-spice-sour', (r, w) => assert.ok(r.garnish.includes('three cherries and a pineapple chunk on a pick'), w), r => !r.lines.some(l => ['cinnamon-syrup', 'dons-spices-2'].includes(l.id)) && has(r, 'honey-syrup') && has(r, 'orange') && has(r, 'allspice-dram'));
  // A Mai Tai served up (a celebration's sparkling Mai Tai in a flute) wears one small thing instead.
  every('mai-tai', (r, w) => { if (!isUp(r)) assert.ok(r.garnish.includes('spent lime shell'), w); assert.ok(!r.garnish.some(g => /cherr|umbrella|flag/.test(g)), w); });
  every('navy-grog', (r, w) => { assert.ok(r.garnish.includes('mint sprig') && r.garnish.includes('spent lime shell'), w); if (r.method.ice === 'ice-cone') assert.ok(r.garnish.includes('straw through the ice cone'), w); });
  every('painkiller', (r, w) => { assert.ok(r.garnish.includes('heavy nutmeg cap'), w); if (has(r, 'orange') && !(engine.parse(r.prompt).avoidTags.orange >= 1)) assert.ok(r.garnish.includes('orange wheel') && r.garnish.some(g => /^cherry/.test(g)), w); });
  every('trinidad-swizzle', (r, w) => assert.ok(r.garnish.includes('mint sprig') && r.garnish.includes('swizzle stick left in'), w));
  every('zombie', (r, w) => { assert.equal(r.garnish[0], 'mint sprig', w); if (has(r, 'pineapple-juice') && !(engine.parse(r.prompt).avoidTags.pineapple >= 1)) assert.ok(r.garnish.includes('pineapple frond'), w); });
  // A Hurricane batched into a punch bowl floats its fruit instead of wearing a flag.
  every('hurricane', (r, w) => assert.ok(r.garnish.includes('orange slice and cherry flag'), w), r => r.lines.some(l => l.id === 'orange') && !/bowl/.test(r.vessel.id));
  every('scorpion-bowl', (r, w) => assert.ok(!r.garnish.some(g => /flaming/.test(g)) || r.style.flaming, w));
  for (const x of all) if (/^scorpion/.test(x.r.archetype.id) && !x.r.style.flaming) assert.ok(x.r.garnish.includes('gardenia'), id(x));
});

test('fire: a flaming garnish brings its lighting and safety step, only in a vessel that can take it, never beside flowers or an umbrella', () => {
  const FIRE_SAFE = ['ku-mug', 'moai-mug', 'skull-mug', 'barrel-mug', 'fog-cutter-mug', 'tiki-bowl', 'volcano-bowl', 'scorpion-bowl', 'coconut', 'pineapple', 'snifter', 'goblet'];
  let flames = 0;
  for (const x of all) {
    const st = steps(x.r);
    const lit = /light it/.test(st);
    if (x.r.garnish.some(g => /flaming/.test(g))) {
      flames++;
      assert.ok(/Fire, last and carefully/.test(st), `${id(x)}: a flaming garnish with no fire step`);
      assert.ok(x.r.style.flaming || ['volcano-bowl', 'tiki-bowl', 'scorpion-bowl'].includes(x.r.vessel.id), `${id(x)}: unasked fire outside a fire bowl`);
    }
    if (lit) {
      assert.ok(FIRE_SAFE.includes(x.r.vessel.id), `${id(x)}: fire in a ${x.r.vessel.id}`);
      assert.ok(/hair, sleeves, straws and flowers clear/.test(st) && /never pour spirit/.test(st) && /blow it out/.test(st), `${id(x)}: fire without its safety line`);
      if (/Fire, last/.test(st)) assert.ok(!x.r.garnish.some(g => /umbrella|orchid|gardenia|flower|bouquet/.test(g)), `${id(x)}: ${x.r.garnish.join(', ')} beside the flame`);
      assert.ok(/(Fire, last|Theater, if you like)/.test(x.r.method.steps[x.r.method.steps.length - 1]), `${id(x)}: the fire comes last`);
    }
    if (x.r.style.flaming && x.r.method.method !== 'hot' && FIRE_SAFE.includes(x.r.vessel.id) && heaped(x.r)) assert.ok(/Fire, last and carefully/.test(st), `${id(x)}: asked for fire`);
  }
  assert.ok(flames >= 2, 'the battery has flaming garnishes');
  const bowl = all.find(x => x.p === 'scorpion bowl for 4' && x.seed === 0);
  assert.ok(!bowl.r.garnish.some(g => /flaming/.test(g)) && /Theater, if you like/.test(steps(bowl.r)), 'the Scorpion bowl\'s flame is optional theater, not a default garnish');
});

test('toppers: carbonation is topped (still wine never is); on crushed ice the pour leaves room and the ice crowns it after', () => {
  let n = 0;
  for (const x of all) {
    const r = x.r, st = r.method.steps;
    assert.ok(!/top with the white wine/i.test(st.join(' ')), `${id(x)}: still wine topped`);
    const fizz = r.lines.filter(l => FIZZY.includes(l.id) && !l.float && !l.sink);
    if (!fizz.length) continue;
    const top = st.findIndex(s => /^Top with/.test(s));
    assert.ok(top >= 0, `${id(x)}: carbonation not topped`);
    if (!heaped(r) || isUp(r)) continue;
    n++;
    for (const s of st.slice(0, top)) assert.ok(!/top with (crushed|pebble|more crushed) ice|mound more shaved|pack with more crushed|finish with a mound|top each with (crushed|pebble)/i.test(s), `${id(x)}: ice to the brim before the topper: "${s}"`);
    assert.ok(st.slice(0, top).some(s => /leaving room/.test(s)), `${id(x)}: no room left for the topper`);
    assert.ok(st.slice(top + 1).some(s => /^(Crown|Mound)/.test(s)), `${id(x)}: no ice crown after the topper`);
  }
  assert.ok(n >= 3, 'the battery has crushed-ice drinks with a topper');
});

test('blender ice follows the liquid (about 1–1¼×); a flash-blend takes about 6 oz for one drink', () => {
  const iceOz = s => { const m = /about (?:[\d¼½¾]+ cups? \((\d+) oz\)|(\d+) oz) of (?:crushed )?ice/.exec(s); return m ? Number(m[1] || m[2]) : null; };
  const mixOz = s => { const m = /about (\d*)([¼½¾]?) oz of the mix/.exec(s); return m ? Number(m[1] || 0) + ({ '¼': 0.25, '½': 0.5, '¾': 0.75 }[m[2]] || 0) : null; };
  let blends = 0;
  for (const x of all) {
    // (A Lava Flow's strawberry purée is spooned into the glass first, not blended.)
    const r = x.r, held = l => l.float || l.sink || l.streak || FIZZY.includes(l.id);
    const liquid = r.lines.filter(l => !l.garnish && !held(l)).reduce((t, l) => t + (l.oz || 0), 0);
    for (const s of r.method.steps) {
      const ice = iceOz(s);
      if (ice === null || !/^(Blend|Flash-blend|Add everything[^.]* to a blender)/.test(s)) continue;
      const mix = mixOz(s) ?? liquid;
      if (/Flash-blend|blender cup/.test(s)) assert.ok(ice >= 5.5 && ice <= Math.max(7, mix * 1.4), `${id(x)}: ${ice} oz of ice for ${mix} oz flash-blended`);
      // (Ice cream is half the frost already: about 4 oz of ice and a short blend.)
      else if (has(r, 'vanilla-ice-cream')) assert.ok(ice >= 3 && ice <= 5 && /briefly/.test(steps(r)), `${id(x)}: ${ice} oz of ice with ice cream ("${s}")`);
      else { blends++; assert.ok(ice >= mix * 0.85 && ice <= mix * 1.45, `${id(x)}: ${ice} oz of ice for ${mix} oz blended ("${s}")`); }
    }
    if (r.method.method === 'blend') assert.ok(!/1 cup \(8 oz\) of ice/.test(steps(r)) || Math.abs(liquid - 7.3) < 1.5, `${id(x)}: the fixed cup of ice`);
  }
  assert.ok(blends >= 10, 'the battery has blended drinks');
});

test('a group gets one method for its vessel: bowls in rounds over fresh crushed ice, punch over a block with water, glasses from a pitcher', () => {
  let bowls = 0, punches = 0;
  for (const x of all) {
    const r = x.r, n = r.servings > 1 ? r.servings : 1, st = steps(r);
    if (n < 2) { assert.ok(!/batch totals|rounds of/.test(st), `${id(x)}: batch steps for one`); continue; }
    // once, or not at all when everything is added glass by glass (a Dark 'n Stormy is all topper and float)
    assert.ok((st.match(/batch totals/g) || []).length === 1 || (r.method.method === 'hot' && /Divide the/.test(st)) || /^For \d+: fill/.test(r.method.steps[0]), `${id(x)}: the batch is described ${(st.match(/batch totals/g) || []).length} times`);
    assert.ok(!/Build everything|Shake everything|Add everything/.test(st), `${id(x)}: a single-serve step after the batch`);
    if (r.vessel.id === 'punch-bowl' && r.method.method === 'hot') assert.ok(/warm the punch bowl/.test(st) && /Ladle into punch cups/.test(st) && !/ice/.test(st), `${id(x)}: ${st}`);
    else if (r.vessel.id === 'punch-bowl' && !has(r, 'egg-white')) {
      punches++;
      assert.ok(/night before/.test(st) && /block/.test(st) && /Ladle into punch cups, 4–5 oz each/.test(st), `${id(x)}: ${st}`);
      if (!has(r, 'water')) assert.ok(/of cold water/.test(st), `${id(x)}: no dilution water`);
      assert.ok(!/crushed ice/.test(st), `${id(x)}: crushed ice drowns a punch bowl`);
    } else if (isBowl(r) && r.method.method !== 'blend') {
      bowls++;
      assert.ok(/rounds of|all at once|Fill the/.test(st) && /crushed ice/.test(st), `${id(x)}: ${st}`);
      assert.ok(/one per guest \(about [\d¼½¾]+ oz of the mix each\)/.test(st), `${id(x)}: no share per guest`);
    }
  }
  assert.ok(bowls >= 3 && punches >= 3, `bowls ${bowls}, punch bowls ${punches}`);
});

test('batch totals are measurable: cups past 8 oz, teaspoons only for small accents', () => {
  for (const x of all) for (const b of x.r.batch || []) {
    assert.ok(/^(\d*[¼½¾]?) (oz|tsp|dash|dashes|drops)$|^\d*[¼½¾]? cups? \(\d+ oz\)$|^\d*[¼½¾]?$/.test(b.total) && b.total !== '', `${id(x)}: "${b.total}" ${b.name}`);
    const m = /^(\d+) tsp$/.exec(b.total);
    if (m) assert.ok(Number(m[1]) <= 2, `${id(x)}: ${b.total} of ${b.name}`);
    const oz = /^(\d+)[¼½¾]? oz$/.exec(b.total);
    if (oz) assert.ok(Number(oz[1]) < 8, `${id(x)}: ${b.total} should be in cups`);
  }
});

test('a sink names the vessel it runs down, and says when an opaque vessel hides the bloom', () => {
  let opaque = 0;
  for (const x of all) {
    const r = x.r, v = vesselById[r.vessel.id];
    for (const s of r.method.steps.filter(s => /slowly down the inside/.test(s))) {
      if (v.kind !== 'glass') assert.ok(!/inside of (the|each) glass/.test(s), `${id(x)}: "glass" for a ${v.id}`);
      if (['metal', 'ceramic', 'fruit'].includes(v.kind) || ['tiki-bowl', 'volcano-bowl', 'scorpion-bowl'].includes(v.id)) { opaque++; assert.ok(/hidden/.test(s), `${id(x)}: ${s}`); }
    }
  }
  assert.ok(opaque >= 2, 'opaque sinks exercised');
});

// ---------- service physics, canonical service, steps from the lines (round-2 critique §3, §5, §6, §9) ----------
// With the technique rules loaded, as the site runs it.
const { createLinter } = await import('../web/lib/lint.js');
const rules = j('data/technique-rules.json');
const ruled = createEngine({
  vocab: j('data/ingredients.json'), families: j('data/families.json'), drinks: j('data/drinks.json'), model: j('data/model.json'),
  vessels, archetypes: j('data/archetypes.json'), concepts: j('data/concepts.json'), rules,
});
const SERVICE_EXTRA = ['daiquiri no. 4', 'hemingway daiquiri', "missionary's downfall", 'painkiller', 'gin-gin mule', 'a rum punch on the boat',
  'something for the beach', 'a pina colada by the pool', 'champagne to celebrate', 'a volcano bowl for two, on fire', 'hot buttered rum', 'a frozen daiquiri'];
const served = [];
for (const p of prompts) for (const seed of [0, 1]) served.push({ p, seed, r: ruled.generate(p, { seed }) });
for (const p of SERVICE_EXTRA) for (const seed of [0, 1]) served.push({ p, seed, r: ruled.generate(p, { seed }) });
const battery = served.filter(x => prompts.includes(x.p));

test('capacity on every path: the liquid, the ice it is served on and headroom fit the vessel (one model with the engine and the linter)', () => {
  for (const x of served) {
    const r = x.r, v = vesselById[r.vessel.id];
    const f = recipeFill(r, v);
    // (A drink the guest's own vessel had to be scaled into fits it too.)
    assert.ok(f.oz <= f.hi + 0.06, `${id(x)}: ${f.kind} ${f.oz.toFixed(2)} oz (${f.open ? 'poured' : 'finished'}) + ${f.ice.toFixed(1)} oz of ice in a ${v.capacity} oz ${v.id}; it holds ${f.hi.toFixed(2)}`);
    if (!['frozen', 'bowl'].includes(f.kind)) assert.ok(f.need <= v.capacity + 0.06, `${id(x)}: needs ${f.need.toFixed(2)} oz of a ${v.capacity} oz ${v.id}`);
    if (r.method.ice === 'none' && ['shake', 'stir'].includes(r.method.method)) assert.ok(v.serve.includes('up'), `${id(x)}: strained with no ice into an empty ${v.id}`);
    if (r.method.method === 'blend' && !isBowl(r) && r.vessel.why !== 'asked') assert.ok(r.stats.finalOz >= v.capacity * 0.45, `${id(x)}: ${r.stats.finalOz} oz frozen lost in a ${v.capacity} oz ${v.id}`);
  }
});

test('the budget itself: cubes take 45% of the glass, packed crushed 50%, a shell 30% of a coupe, up drinks 80% (85% with bubbles), bowls count their ice in its voids', () => {
  const V = id => vesselById[id];
  // Strained over fresh cubes: the finished liquid plus 45% ice plus headroom (a 13 oz collins holds 6.65 oz finished).
  assert.ok(Math.abs(fillBudget({ volOz: 5, finalOz: 7 }, V('collins'), { method: 'shake', ice: 'cubed' }).hi - 6.65) < 0.01);
  // Ice and all: the poured liquid plus the glass's own ice (the 1934 Zombie's 6 oz fits its chimney).
  const z = fillBudget({ volOz: 5.96, finalOz: 10.8 }, V('chimney'), { method: 'flash-blend', ice: 'crushed' });
  assert.ok(z.open && z.oz <= z.hi, `Zombie ${z.oz} > ${z.hi}`);
  // The round-3 overflows no longer fit: the Painkiller's 10.9 oz over cubes in its tin, the 6.4 oz in a shell-lined coupe, 10.4 oz over cubes in a collins.
  assert.ok(fillBudget({ volOz: 8, finalOz: 10.9 }, V('enamel-tin'), { method: 'shake', ice: 'cubed' }).oz > fillBudget({ volOz: 8, finalOz: 10.9 }, V('enamel-tin'), { method: 'shake', ice: 'cubed' }).hi);
  const shell = fillBudget({ volOz: 3.77, finalOz: 6.4 }, V('coupe'), { method: 'flash-blend', ice: 'shaved' });
  assert.equal(shell.kind, 'shell'); assert.ok(shell.oz > shell.hi && shell.hi < 4.5);
  assert.ok(fillBudget({ volOz: 7.25, finalOz: 10.4 }, V('collins'), { method: 'shake', ice: 'cubed' }).oz > 6.65);
  // Up: 5–5½ oz finished in a 7 oz coupe; a flute with bubbles to 85%.
  assert.ok(Math.abs(fillBudget({ volOz: 3.5, finalOz: 5 }, V('coupe'), { method: 'shake', ice: 'cubed' }).hi - 5.6) < 0.01);
  assert.ok(Math.abs(fillBudget({ volOz: 4, finalOz: 6 }, V('flute'), { method: 'shake', ice: 'cubed', fizz: true }).hi - 5.95) < 0.01);
  // A topper is never on the shaker's ice: only the shaken part is diluted.
  assert.ok(fillBudget({ volOz: 6, finalOz: 8 }, V('collins'), { method: 'shake', ice: 'cubed', fizzOz: 3 }).oz < 7.05);
  // Bowls: two serves shaken on 2 cups of ice over a 1-cup bed sit in the volcano bowl's 40 oz with the ice's voids holding the mix.
  const vb = fillBudget({ volOz: 7, finalOz: 10.4 }, V('volcano-bowl'), { method: 'shake', ice: 'crushed', servings: 2 });
  assert.ok(vb.oz <= vb.hi && vb.need <= 40, `${vb.need}`);
});

test('the shaker ice for an open pour is sized to the glass, and a bowl gets rounds of two over a modest bed', () => {
  for (const x of served) {
    const st = x.r.method.steps.join(' ');
    assert.ok(!/12 oz of crushed ice/.test(st) || x.r.vessel.id === 'hurricane' || vesselById[x.r.vessel.id].capacity >= 14, `${id(x)}: the fixed scoop`);
    if (isBowl(x.r) && /Flash-blend|Blend/.test(st) && x.r.servings >= 2) assert.ok(/rounds of two|all at once/.test(st) && !/finish with a mound/.test(st), `${id(x)}: ${st}`);
  }
});

test('a named classic is served the way its canon serves it, or the card records what the prayer waived', () => {
  const by = p => served.find(x => x.p === p && x.seed === 0).r;
  // (Up in a coupe, or the Papa Doble's goblet when the shell can't hold it.)
  assert.ok(vesselById[by('hemingway daiquiri').vessel.id].serve.includes('up') || by('hemingway daiquiri').vessel.id === 'goblet', 'a Hemingway goes up, or in its goblet');
  assert.equal(by("missionary's downfall").method.method, 'blend', "Missionary's Downfall is blended");
  assert.equal(by('painkiller').vessel.id, 'enamel-tin', "the Painkiller comes in the Pusser's tin");
  assert.ok(by('gin-gin mule').lines.some(l => l.id === 'mint' && l.muddled), 'the Gin-Gin Mule keeps its mint');
  for (const x of served) {
    const c = x.r.method.canon;
    if (!c || !c.vessel || x.r.vessel.why === 'asked' || x.r.vessel.id === c.vessel) continue;
    assert.ok((x.r.method.waived || []).length, `${id(x)}: ${c.name} belongs in a ${c.vessel}, served in a ${x.r.vessel.id} with nothing waived`);
  }
});

test('steps come from the lines: herbs pressed only when poured, bitters dashed, floats held back from "the rest"', () => {
  for (const x of served) {
    const r = x.r, st = r.method.steps;
    for (const herb of ['mint', 'basil']) if (st.some(s => new RegExp(`(press|muddle)[^.]*\\b${herb}\\b`, 'i').test(s))) assert.ok(r.lines.some(l => l.id === herb && l.muddled), `${id(x)}: presses ${herb} with no ${herb} line`);
    assert.ok(!st.some(s => /^Float[^:]*bitters/i.test(s)), `${id(x)}: bitters floated`);
    for (const f of r.lines.filter(l => l.float)) {
      const at = st.findIndex(s => /^Float/.test(s) && s.toLowerCase().includes(f.name.toLowerCase().split(' ').pop()));
      for (const s of st.slice(0, at < 0 ? 0 : at)) if (/^(Add|Build|Shake|Stir|Divide|Blend)\b.*\b(everything|the rest)\b/.test(s)) assert.ok(/except/.test(s), `${id(x)}: "${s}" sweeps in the ${f.name} float`);
    }
  }
});

test('fire agrees with the vessel and keeps its clearance: a lit volcano bowl has no mint ring', () => {
  const allowed = rules.garnish.fire.allowedVessels;
  for (const x of served) {
    const st = x.r.method.steps.join(' ');
    if (/light it/.test(st)) assert.ok(allowed.includes(x.r.vessel.id), `${id(x)}: fire in a ${x.r.vessel.id}`);
    if (x.r.vessel.id === 'volcano-bowl' && /Fire, last/.test(st)) assert.ok(!x.r.garnish.some(g => /mint/.test(g)), `${id(x)}: mint round the crater`);
    if (x.r.style.flaming && (heaped(x.r) || isBowl(x.r)) && x.r.method.method !== 'hot' && x.r.vessel.why !== 'asked') assert.ok(/light it/.test(st), `${id(x)}: fire asked for on crushed ice, never lit`);
  }
});

test('the vessel library: glass is a hazard by the pool, on the beach and on a boat; a celebration with bubbles goes up; no vessel takes over the battery', () => {
  for (const x of served) if (/\b(pool|beach|boat)\b/.test(x.p) && !isBowl(x.r) && !isUp(x.r) && x.r.method.method !== 'hot') assert.equal(vesselById[x.r.vessel.id].kind, 'acrylic', id(x));
  // Acrylic is for where glass is the hazard.
  for (const x of served) if (vesselById[x.r.vessel.id].kind === 'acrylic' && x.r.vessel.why !== 'asked') assert.ok(/\b(pool|beach|boat|poolside|swim)\b/i.test(x.p) || x.r.vessel.why === 'occasion', `${id(x)}: acrylic without a hazard`);
  for (const x of served) if (/promotion/.test(x.p) && !isBowl(x.r) && x.r.lines.some(l => l.id === 'sparkling-wine')) assert.ok(['flute', 'coupe', 'saucer'].includes(x.r.vessel.id), id(x));
  const count = {};
  for (const x of battery) count[x.r.vessel.id] = (count[x.r.vessel.id] || 0) + 1;
  for (const [v, n] of Object.entries(count)) assert.ok(n <= battery.length * 0.22, `${v} holds ${n} of ${battery.length}`);
  assert.ok(Object.keys(count).length >= 18, `only ${Object.keys(count).length} vessels in use`);
});

test('garnish keeps the reading\'s and the name\'s promises, and mint is not a reflex', () => {
  const by = (p, seed = 0) => served.find(x => x.p === p && x.seed === seed).r;
  assert.ok(by('something floral and elegant').garnish.some(g => /flower|orchid|gardenia/.test(g)), 'floral gets a flower');
  for (const seed of [0, 1]) assert.ok(by('a night in Tahiti', seed).garnish.includes('tiare gardenia'), 'Tahiti wears the tiare');
  for (const x of served) if (/orchid/i.test(x.r.name) && !isUp(x.r)) assert.ok(x.r.garnish.includes('orchid'), `${id(x)}: named for an orchid`);
  const mint = battery.filter(x => x.r.garnish.some(g => /mint/.test(g))).length;
  assert.ok(mint <= battery.length * 0.45, `mint on ${mint} of ${battery.length}`);
});

test('the linter catches what the service rules forbid', () => {
  const { lint } = createLinter({ rules, vocab: j('data/ingredients.json'), vessels });
  const base = { name: 'Test', family: { id: 'punch' }, archetype: { id: 'planters-punch' }, servings: 1, stats: {}, garnish: [], explanation: {} };
  const L = (id, oz, extra = {}) => ({ id, name: id, oz, unit: 'oz', amount: oz, ...extra });
  const ids = rec => lint(rec).map(f => f.id);
  const crowded = { ...base, vessel: { id: 'coconut' }, lines: [L('rum-white-column', 2), L('lime', 1), L('pineapple-juice', 3), L('simple-syrup', 1)], method: { method: 'shake', ice: 'crushed', steps: [] } };
  assert.ok(ids(crowded).includes('ice-and-all-overfull'));
  const upTumbler = { ...base, vessel: { id: 'dof' }, lines: [L('rum-white-column', 2), L('lime', 0.75), L('simple-syrup', 0.75)], method: { method: 'shake', ice: 'none', steps: [] } };
  assert.ok(ids(upTumbler).includes('up-in-tumbler'));
  const phantom = { ...base, vessel: { id: 'collins' }, lines: [L('rum-white-column', 2), L('lime', 0.75), L('simple-syrup', 0.75)], method: { method: 'swizzle', ice: 'crushed', steps: ['Lightly press the mint in the bottom of a collins glass.', 'Add everything to a collins glass.'] } };
  assert.ok(ids(phantom).includes('phantom-muddle'));
  const sweep = { ...base, vessel: { id: 'hot-mug' }, lines: [L('rum-white-column', 1.5), L('rum-demerara-overproof', 0.25, { float: true }), L('hot-water', 5)], method: { method: 'hot', ice: 'none', steps: ['Add the rest except the hot water and stir.', 'Top with steaming hot water.', 'Float the Demerara 151 overproof rum on top: pour it gently over the back of a bar spoon.'] } };
  assert.ok(ids(sweep).includes('rest-sweeps-float'));
});

// ---------- round 3: capacity everywhere, canonical service, steps and garnish truth (round-3 critique §1, §5, §6, §8) ----------
// Prayers from outside the review battery, so the capacity model is not tuned to it.
const WIDE = ['a pirate wedding', 'something for my mom on mothers day', 'vegan and nut free mai tai', 'spicy mango', 'a drink for a mermaid', 'hawaiian sunset with pineapple', 'gin and coconut', 'a tiki drink for a hot summer day', 'whiskey sour but tiki', 'something purple', 'rum and coke but fancy', 'christmas morning', 'lychee and rose', 'a negroni for the beach', 'a smoky old fashioned', 'banana bread', 'cinnamon and apple, warm', 'something sour and refreshing', 'a margarita gone tiki', 'zombie for two', 'a hurricane in new orleans', 'pina colada but frozen with strawberries', 'anniversary dinner', 'the beach at midnight', 'ice cream float', 'tea party', 'a drink that glows', 'birthday party for 10', 'chartreuse swizzle', 'navy grog for a crowd', 'no rum please', 'just pineapple and rum', 'a strong dark rum drink', 'something with egg white', 'mezcal mai tai', 'a fog cutter', 'grapefruit and honey', 'tropical sangria', 'a coffee nightcap', 'something blue and creamy'];
const wide = [];
for (const p of WIDE) for (const seed of [0, 1]) wide.push({ p, seed, r: ruled.generate(p, { seed }) });

test('the capacity model holds on the battery and on 80 prayers from outside it: liquid + ice + headroom never past the vessel', () => {
  for (const x of [...battery, ...wide]) {
    const v = vesselById[x.r.vessel.id], f = recipeFill(x.r, v);
    assert.ok(f.oz <= f.hi + 0.06, `${id(x)}: ${f.kind} ${f.oz.toFixed(2)} oz + ${f.ice.toFixed(1)} oz ice in a ${v.capacity} oz ${v.id} (holds ${f.hi.toFixed(2)})`);
  }
});

test('canonical service: the archetype\'s own vessel and its garnish rules', () => {
  for (const x of [...served, ...wide]) {
    const r = x.r, st = r.method.steps.join(' ');
    // A Bermuda swizzle stirs its bitters in: no crown, no mint (its archetype's garnish.never).
    if (r.archetype.id === 'bermuda-rum-swizzle') {
      assert.ok(!/to form a crown/.test(st) && !r.garnish.some(g => /mint/.test(g)), `${id(x)}: ${r.garnish.join(', ')} / ${st}`);
    }
    // A Tom and Jerry: its milk-glass mug, the batter loosened with the spirits (never melted),
    // the hot water whisked in so it foams.
    if (r.archetype.id === 'tom-and-jerry' && r.vessel.why !== 'asked' && r.servings === 1) {
      assert.equal(r.vessel.id, 'tom-and-jerry-mug', id(x));
      assert.ok(/stir to loosen the batter/.test(st) && /whisking as you pour/.test(st) && !/until it melts/.test(st), `${id(x)}: ${st}`);
    }
    // A service feature is never listed as a garnish.
    assert.ok(!r.garnish.some(g => /shell lining|ice shell/.test(g)), `${id(x)}: ${r.garnish.join(', ')}`);
  }
  const hot = {};
  for (const x of served) if (x.r.method.method === 'hot' && x.r.servings === 1) (hot[x.r.archetype.id] = hot[x.r.archetype.id] || new Set()).add(x.r.vessel.id);
  if (hot['hot-grog']) assert.ok([...hot['hot-grog']].some(v => vesselById[v].kind === 'glass'), 'a hot grog goes in a glass toddy');
});

test('garnish truth: a Three Dots pick only on a Three Dots or with pineapple, a cinnamon stick only with cinnamon, heat or flame, an umbrella only where it is drawn', () => {
  const ALL = [...all, ...served, ...wide];
  for (const x of ALL) {
    const r = x.r, st = r.method.steps.join(' ');
    if (r.garnish.includes('three cherries and a pineapple chunk on a pick'))
      assert.ok(has(r, 'pineapple-juice', 'rum-pineapple', 'pineapple-syrup') || (has(r, 'honey-syrup') && has(r, 'orange')), `${id(x)}: the Morse pick on a drink that isn't a Three Dots`);
    if (r.garnish.includes('cinnamon stick'))
      assert.ok(r.method.method === 'hot' || /light it/.test(st) || has(r, 'cinnamon-syrup', 'cinnamon', 'dons-spices-2', 'hot-buttered-rum-batter', 'tom-and-jerry-batter', 'rum-spiced'), `${id(x)}: a cinnamon stick with no cinnamon`);
    if (r.garnish.includes('paper umbrella')) assert.ok(UMBRELLA_ALLOWED.includes(r.archetype.id), `${id(x)}: the painter won't draw this umbrella`);
  }
  const zombie = served.find(x => x.p === 'zombie' && x.seed === 0) || all.find(x => x.p === 'zombie' && x.seed === 0);
  if (zombie && zombie.r.classic) assert.ok(!zombie.r.garnish.some(g => /cherr/.test(g)), 'Berry\'s Zombie wears only its mint');
});

test('steps from the method: fire keeps straws and mint clear, zero-proof shakes short, a frappé takes a cup of shaved ice, the swizzle\'s ice word is its own', () => {
  for (const x of [...all, ...served, ...wide]) {
    const r = x.r, st = r.method.steps.join(' ');
    if (/Fire, last and carefully/.test(st)) {
      if (r.garnish.some(g => /long straws/.test(g))) assert.ok(/until the flame is out/.test(st), `${id(x)}: straws by the flame`);
      if (r.garnish.some(g => /\bmint\b/.test(g))) assert.ok(/far rim/.test(st), `${id(x)}: mint by the flame`);
    }
    if (r.style.zeroProof && /^Shake/m.test(r.method.steps.join('\n'))) assert.ok(/5–6 seconds/.test(st) && !/10–12 seconds/.test(st), `${id(x)}: ${st}`);
    if (r.method.method === 'blend' && isUp(r) && !isBowl(r) && r.servings === 1) assert.ok(/of shaved ice/.test(st) && /heap/.test(st), `${id(x)}: frappé ${st}`);
    if (r.method.method === 'swizzle' && ['shaved', 'pebble'].includes(r.method.ice)) assert.ok(new RegExp(`two-thirds with ${r.method.ice} ice`).test(st), `${id(x)}: ${st}`);
  }
});

test('the vessel library: the stories say what is true, and the new vessels are complete', () => {
  const moai = vesselById['moai-mug'].story, ku = vesselById['ku-mug'].story;
  assert.ok(/Aku-Aku/.test(moai) && !/Kon-Tiki/.test(moai), moai);
  assert.ok(/four great akua/.test(ku) && /Kūkāʻilimoku/.test(ku) && !/god of war\b(?!.*Kamehameha)/.test(ku.split('Kūkāʻilimoku')[0]), ku);
  for (const id of ['tom-and-jerry-mug', 'toddy-glass', 'acrylic-ribbed', 'wine-glass']) {
    const v = vesselById[id];
    assert.ok(v && v.capacity > 0 && v.serve.length && v.story && (v.sources || []).length && v.drawAs, `${id} incomplete`);
  }
});
