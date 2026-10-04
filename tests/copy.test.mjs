// The card's words, checked against the drink: what the Shrine says it heard, the strength and
// balance lines, credits, classic recognition, names and taglines, culture and punctuation.
// Each check uses its own small lexicon rather than the copywriter's, so a slip in one is caught
// by the other. Run over the whole review battery, three seeds each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../web/lib/engine.js';
import { HAWAIIAN, POLY, polynesianPrayer } from '../web/lib/names.js';

const j = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const archetypes = j('data/archetypes.json');
const concepts = j('data/concepts.json');
const engine = createEngine({
  vocab: j('data/ingredients.json'), families: j('data/families.json'), drinks: j('data/drinks.json'), model: j('data/model.json'),
  vessels: j('data/vessels.json'), archetypes, concepts,
});
const archById = new Map((Array.isArray(archetypes) ? archetypes : archetypes.archetypes).map(a => [a.id, a]));
const { prompts } = j('scripts/review/battery.json');
const SEEDS = [0, 1, 2];
const all = [];
for (const p of prompts) for (const seed of SEEDS) all.push({ p, seed, r: engine.generate(p, { seed }) });
const ids = r => new Set(r.lines.filter(l => !l.garnish || l.muddled).map(l => l.id));
const has = (r, ...xs) => xs.some(x => ids(r).has(x));
const oz = (r, ...xs) => r.lines.filter(l => xs.includes(l.id) && !l.garnish).reduce((t, l) => t + (l.oz || 0), 0);
const gtext = r => r.garnish.join(' ').toLowerCase();
const tag = (p, seed, r) => `${p} [${seed}] ${r.name}`;
const cardText = r => [r.name, r.tagline, r.explanation.tasting, ...r.explanation.whyItWorks, ...r.explanation.reading.heard.map(h => h.meaning), r.explanation.reading.builtOn.text, ...r.explanation.reading.moves].join(' \n ');

// ---------------------------------------------------------------------------------------------
// 1. What the gods heard is true of the drink.
const RUMS = ['rum-white-column', 'rum-gold-column', 'rum-aged-column', 'rum-blended-light', 'rum-barbados', 'rum-jamaican-aged', 'rum-jamaican-dark', 'rum-jamaican-pot', 'rum-jamaican-white-overproof', 'rum-demerara', 'rum-demerara-overproof', 'rum-black-blended', 'rum-black-overproof', 'rum-agricole-blanc', 'rum-agricole-vieux', 'rum-haitian', 'rum-navy', 'rum-overproof-white', 'rum-spiced', 'rum-pineapple', 'rum-cachaca'];
const NAMED = [
  // Bottles and fruit.
  [/\bfalernum\b/, r => has(r, 'velvet-falernum', 'falernum-syrup')], [/\borgeat\b/, r => has(r, 'orgeat')], [/\bcampari\b/, r => has(r, 'campari')],
  [/\baperol\b/, r => has(r, 'aperol')], [/\bamaro\b/, r => has(r, 'amaro', 'cynar', 'fernet')], [/\bgrapefruit\b/, r => has(r, 'grapefruit', 'dons-mix', 'grapefruit-soda')],
  [/\bpineapple\b/, r => has(r, 'pineapple-juice', 'pineapple-syrup', 'rum-pineapple') || r.vessel && r.vessel.id === 'pineapple'],
  [/\bcoconut\b/, r => has(r, 'coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water') || r.vessel && r.vessel.id === 'coconut'],
  [/\bbanana\b/, r => has(r, 'banana', 'banana-liqueur')], [/\bstrawberr/, r => has(r, 'strawberry')], [/\bmint\b/, r => has(r, 'mint') || /mint/.test(gtext(r))],
  [/\bginger\b/, r => has(r, 'ginger-beer', 'ginger-ale', 'ginger-syrup', 'ginger-liqueur', 'ginger-fresh')], [/\bgrenadine\b/, r => has(r, 'grenadine')],
  [/\bpassion[- ]?fruit\b/, r => has(r, 'passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola')],
  [/\bhoney\b/, r => has(r, 'honey-syrup', 'gardenia-mix')], [/\bmaraschino\b/, r => has(r, 'maraschino')], [/\bchartreuse\b/, r => has(r, 'green-chartreuse', 'yellow-chartreuse')],
  [/\b(absinthe|pernod|pastis)\b/, r => has(r, 'absinthe', 'pastis')], [/\bcranberr/, r => has(r, 'cranberry-juice')], [/\bhibiscus\b/, r => has(r, 'hibiscus-syrup') || /hibiscus/.test(gtext(r))],
  [/\bmezcal\b/, r => has(r, 'mezcal')], [/\btequila\b/, r => has(r, 'tequila-blanco', 'tequila-reposado')], [/\bgin\b/, r => has(r, 'gin', 'gin-old-tom')],
  [/\bbourbon\b/, r => has(r, 'bourbon')], [/\bvodka\b/, r => has(r, 'vodka')], [/\b(brandy|cognac)\b/, r => has(r, 'brandy', 'applejack')],
  [/\bblue cura[çc]ao\b/, r => has(r, 'blue-curacao')], [/\b(sparkling wine|champagne|prosecco)\b/, r => has(r, 'sparkling-wine')], [/\b(black )?tea\b/, r => has(r, 'black-tea', 'lapsang-tea', 'butterfly-pea-tea')],
  [/\borange juice\b/, r => has(r, 'orange')], [/\blemon\b/, r => has(r, 'lemon') || /lemon/.test(gtext(r))], [/\blime\b/, r => has(r, 'lime', 'lime-cordial') || /lime/.test(gtext(r))],
  [/\bdemerara rum\b/, r => has(r, 'rum-demerara', 'rum-demerara-overproof')], [/\bjamaican( pot-still)? rum\b/, r => has(r, 'rum-jamaican-aged', 'rum-jamaican-dark', 'rum-jamaican-pot', 'rum-jamaican-white-overproof')],
  [/\bblack rum\b/, r => has(r, 'rum-black-blended', 'rum-black-overproof')], [/\bnavy rum\b/, r => has(r, 'rum-navy')], [/\bgold rum\b/, r => has(r, 'rum-gold-column')],
  [/\b(light|white) rum\b/, r => has(r, 'rum-white-column', 'rum-blended-light', 'rum-overproof-white')], [/\brum\b/, r => has(r, ...RUMS)],
  [/\ballspice( dram)?\b|\bpimento\b/, r => has(r, 'allspice-dram', 'dons-spices-2', 'tiki-bitters')], [/\bangostura\b/, r => has(r, 'angostura')],
  // Vessels and garnish.
  [/\bskull mug\b/, r => r.vessel && r.vessel.id === 'skull-mug'], [/\bpunch bowl\b/, r => r.vessel && r.vessel.id === 'punch-bowl'], [/\bscorpion bowl\b/, r => r.vessel && r.vessel.id === 'scorpion-bowl'],
  [/\bvolcano bowl\b/, r => r.vessel && r.vessel.id === 'volcano-bowl'], [/\bhurricane glass\b/, r => r.vessel && r.vessel.id === 'hurricane'], [/\bcoconut shell\b/, r => r.vessel && r.vessel.id === 'coconut'],
  [/\borchids?\b/, r => /orchid/.test(gtext(r))], [/\b(gardenia|tiare)\b/, r => /gardenia|tiare/.test(gtext(r))], [/\bumbrella\b/, r => /umbrella/.test(gtext(r))],
  // Technique.
  [/\bfloat\b/, r => r.lines.some(l => l.float)], [/\bsunk to the bottom\b|\bsinks?\b/, r => r.lines.some(l => l.sink)], [/\bblended\b|\bfrozen\b/, r => ['blend', 'flash-blend'].includes(r.method.method) || r.method.ice === 'blended'],
  [/\bswizzled\b/, r => r.method.method === 'swizzle'], [/\bstirred\b/, r => r.method.method === 'stir'], [/\blit at the table\b|\bflaming\b|\bset alight\b/, r => /flam/.test(gtext(r)) || r.method.steps.some(s => /light it|flam/i.test(s))],
];
// Sentences that tell history (a date, a past-tense verb) promise nothing about this drink;
// a word ruled out ("no dark float") or offered as an alternative ("lime or lemon") is no promise.
const HISTORIC = /\b(1[5-9]\d\d|20[0-2]\d)\b|\b(was|were|gave|said|began|created|invented|named|credited|born|opened|predates|coined|became|printed|published|introduced|populari[sz]ed|shot|traced|took|drank|learned)\b/i;
function brokenPromises(meaning, r) {
  const out = [];
  for (const s0 of meaning.split(/(?<=[.?])\s+(?=[A-Z])/)) {
    if (HISTORIC.test(s0)) continue;
    let s = ` ${s0.toLowerCase()} `.replace(/\b(no|not|without|never|instead of)\s+[a-z' -]+?(?=[,.;:]|\band\b|$)/g, ' ').replace(/\bif [^,;.]*[,;.]/g, ' ');
    // "lime or lemon": an alternative is kept if either side is in the glass.
    for (const alt of s.match(/[a-z' -]+ or [a-z' -]+/g) || []) {
      const hits = alt.split(/ or /).map(x => NAMED.find(([re]) => re.test(x)));
      if (hits.some(h => h && h[1](r))) s = s.replace(alt, ' ');
    }
    for (const [re, ok] of NAMED) {
      const m = s.match(re);
      if (m) { if (!ok(r)) out.push(m[0].trim()); s = s.replace(new RegExp(re.source, 'g'), ' '); }
    }
  }
  return out;
}

test('1. what the gods heard names nothing the drink lacks', () => {
  for (const { p, seed, r } of all) {
    for (const h of r.explanation.reading.heard) {
      const bad = brokenPromises(h.meaning, r);
      assert.deepEqual(bad, [], `${tag(p, seed, r)}: heard "${h.phrase}" as "${h.meaning}", but the drink has no ${bad.join(', ')}`);
    }
  }
});

test('1. moves and twists are said in bartender words', () => {
  for (const { p, seed, r } of all) {
    const text = [...r.explanation.reading.moves, ...r.explanation.whyItWorks].join(' ');
    assert.ok(!/\bslot\b|route only|to keep it to \d|→/.test(text), `${tag(p, seed, r)}: ${text}`);
    assert.ok((text.match(/The twist:/g) || []).length <= 1, `${tag(p, seed, r)}: more than one twist`);
  }
});

// ---------------------------------------------------------------------------------------------
// 2. One strength scale, in US standard drinks, and the house rule belongs to the house.
test('2. tasting note and Why lines agree on one strength scale', () => {
  for (const { p, seed, r } of all) {
    const sd = r.stats.standardDrinks, n = r.explanation.tasting, why = r.explanation.whyItWorks.join(' ');
    const both = `${n} ${why}`;
    if (r.stats.abv <= 0.5) { assert.match(n, /No alcohol at all/, tag(p, seed, r)); continue; }
    // A long, low-proof drink (7.5% or under) is light whatever its volume.
    if (sd < 1.2 || (r.stats.abv <= 7.5 && sd < 1.6)) { assert.match(n, /\b[Ll]ight\b/, tag(p, seed, r)); assert.ok(!/heavyweight|so sip it|normal cocktail/.test(both), `${tag(p, seed, r)}: ${sd} sd called strong`); }
    else if (sd < 2) { assert.match(n, /strength of a normal cocktail/, tag(p, seed, r)); assert.ok(!/heavyweight|so sip it/.test(both), `${tag(p, seed, r)}: ${sd} sd called strong`); }
    else if (sd < 2.5) { assert.match(n, /[Ss]trong: about (1½|2) standard drinks, so sip it/, `${tag(p, seed, r)}: ${n}`); assert.ok(!/heavyweight/.test(both), `${tag(p, seed, r)}: ${sd} sd called a heavyweight`); }
    else { assert.match(n, /heavyweight: about \d/, `${tag(p, seed, r)}: ${n}`); assert.match(why, /a heavyweight/, tag(p, seed, r)); }
    assert.match(why, new RegExp(`About ${sd} US standard drink${sd === 1 ? '' : 's'}`), `${tag(p, seed, r)}: ${why}`);
    assert.ok(!(sd >= 2 && /easy[- ]drinking/i.test(cardText(r))), `${tag(p, seed, r)}: easy-drinking at ${sd} sd`);
  }
});

test('2. house rules: Don for the Zombie line, Vic for his bowls, Pat O\'Brien\'s for the Hurricane', () => {
  for (const { p, seed, r } of all) {
    const text = `${r.explanation.tasting} ${r.explanation.whyItWorks.join(' ')}`;
    const a = r.archetype.id, sd = r.stats.standardDrinks;
    if (/two per guest|two-per-guest/.test(text)) assert.ok(['zombie', 'cobras-fang', 'pilot'].includes(a) && sd >= 2.5, `${tag(p, seed, r)}: Don's limit on a ${a} at ${sd} sd`);
    if (/Vic served it/.test(text)) assert.ok(['scorpion', 'scorpion-bowl'].includes(a), `${tag(p, seed, r)}: Vic's table on a ${a}`);
    if (/Pat O'Brien's pours/.test(text)) assert.equal(a, 'hurricane', tag(p, seed, r));
  }
});

test('2. hot drinks never mention ice; shared drinks speak per guest', () => {
  for (const { p, seed, r } of all) {
    const words = `${r.tagline} ${r.explanation.tasting} ${r.explanation.whyItWorks.join(' ')}`;
    if (r.method.method === 'hot') assert.ok(!/\bice\b|frost|frosty|chilled/i.test(words), `${tag(p, seed, r)}: ${words}`);
    if ((r.servings || 1) > 1 && r.stats.abv > 0.5) assert.match(r.explanation.whyItWorks.join(' '), /per guest/, tag(p, seed, r));
  }
});

// ---------------------------------------------------------------------------------------------
// 3. The balance line reads the absolute numbers: past 12 g of sugar a drink is sweet whatever its
// acid; "tart and bracing" needs about 0.9 g of acid and no more than 9 g of sugar (a gram more
// frozen) and is never said of a creamy drink; a hot drink with no citrus is soft and round.
test('3. the balance line matches the measured sugar and acid', () => {
  for (const { p, seed, r } of all) {
    const n = r.explanation.tasting, s = r.stats, acid = s.acidConc || 0, sugar = s.sugarConc || 0;
    const shift = r.method.method === 'blend' ? 1 : 0;
    const creamy = oz(r, 'coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'whole-milk', 'tom-and-jerry-batter') >= 0.5;
    if (creamy && acid < 0.4) { assert.match(n, sugar > 12 ? /Sweet and round\./ : /Rich and round, with almost no acid\./, `${tag(p, seed, r)}: ${n}`); continue; }
    if (/Tart and bracing/.test(n)) assert.ok(!creamy && acid >= 0.9 - 0.02 && sugar <= 9 + shift + 0.1, `${tag(p, seed, r)}: tart and bracing at ${sugar} g / ${acid}: ${n}`);
    if (sugar > 12 && acid >= 0.2) assert.match(n, /\bSweet\b/, `${tag(p, seed, r)}: ${sugar} g: ${n}`);
    if (r.method.method === 'hot' && acid < 0.2) assert.match(n, /No citrus, soft and round|Rich and round/, `${tag(p, seed, r)}: ${n}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 4-6. Credits keep origin apart from edition, proper nouns keep their capitals, and a drink that
// is a classic says so.
test('4. credits never nest a book inside an origin, and every family root is dated', () => {
  for (const { p, seed, r } of all) {
    const b = r.explanation.reading.builtOn.text;
    assert.ok(!/\([^()]*\([^()]*\)[^()]*\)/.test(b), `${tag(p, seed, r)}: nested parentheses in "${b}"`);
  }
  // A credit is printed inside parentheses, so it carries none of its own.
  for (const a of (Array.isArray(archetypes) ? archetypes : archetypes.archetypes)) {
    for (const [drink, o] of Object.entries(a.origins || {})) {
      assert.ok(['documented', 'attributed', 'disputed'].includes(o.confidence), `${a.id} ${drink}: confidence ${o.confidence}`);
      assert.ok(!/[()]/.test(o.text || ''), `${a.id} ${drink}: parentheses in the credit "${o.text}"`);
    }
    for (const sp of a.canonicalSpecs || []) assert.ok(!/[()]/.test(sp.edition || ''), `${a.id} ${sp.name}: parentheses in the edition "${sp.edition}"`);
  }
});

test('5. a definition after a colon keeps its proper nouns', () => {
  const LOWER = /: (trader vic|harry yee|pat o'brien|constante|bermuda's|vic's|don's|don the|jerry thomas|queen's park|ramón|the caribe hilton|el floridita|gosling's)/;
  for (const { p, seed, r } of all) for (const line of [r.tagline, ...r.explanation.whyItWorks, r.explanation.tasting]) assert.ok(!LOWER.test(line), `${tag(p, seed, r)}: ${line}`);
});

test('6. a build that is a proven classic is printed under its real name, with its credit', () => {
  for (const { p, seed, r } of all) {
    if (!r.classic) continue;
    assert.equal(r.name, r.classic.name, tag(p, seed, r));
    assert.ok(r.tagline.startsWith(`The ${r.classic.name}`), `${tag(p, seed, r)}: ${r.tagline}`);
    if (r.classic.recognized) assert.ok(r.nickname && r.nickname !== r.name, `${tag(p, seed, r)}: no house nickname`);
  }
  // (A templated zero-proof spec is no classic.)
  // (The canon contract: a drink 95% the lines of a classic but served otherwise is a house riff.)
  for (const { p, seed, r } of all) if (!r.classic && !r.riffOf && r.archetype.id !== 'zero-proof-tiki' && r.reference && r.reference.similarity >= 0.95 && (!r.canon || r.canon.state === 'as-written')) assert.fail(`${tag(p, seed, r)}: ${Math.round(r.reference.similarity * 100)}% the ${r.reference.name} but not named as it`);
});

test('6. a riff that loses a defining bottle is called a cousin', () => {
  const DEFINING = { Zombie: ['velvet-falernum', 'falernum-syrup', 'dons-mix', 'pastis', 'absinthe'], 'Mai Tai': ['orgeat'], 'Jungle Bird': ['campari', 'aperol', 'amaro'], 'Navy Grog': ['grapefruit'] };
  for (const { p, seed, r } of all) {
    const need = r.reference && DEFINING[r.reference.name];
    if (!need || r.classic || need.some(x => has(r, x))) continue;
    assert.match(`${r.tagline} ${r.explanation.whyItWorks.join(' ')}`, /cousin/, `${tag(p, seed, r)}: a ${r.reference.name} without ${need.join('/')}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 7. Names and lineage tell the truth.
test('7. every type word in a name is true of the build', () => {
  const BLACK = ['rum-black-blended', 'rum-black-overproof'];
  const NOUNS = [
    [/\bSpritz\b/, r => has(r, 'sparkling-wine') || (has(r, 'aperol', 'campari', 'lillet-blanc', 'white-wine') && has(r, 'soda-water', 'tonic'))],
    [/\bMule\b/, r => has(r, 'ginger-beer')], [/\b(Volcano|Crater|Caldera)\b/, r => (r.vessel && r.vessel.id === 'volcano-bowl') || /flam/.test(gtext(r))],
    [/\bBowl\b/, r => r.vessel && /bowl/.test(r.vessel.id)], [/\b(Torch|Blaze|Inferno|Flame|Flaming|Bonfire)\b/, r => /flam/.test(gtext(r))],
    [/\b(Smoky|Smoldering|Charred|Ashen|Smoke)\b/, r => has(r, 'mezcal', 'scotch-islay', 'lapsang-tea')], [/\bCup\b/, r => r.vessel && r.vessel.id === 'punch-bowl'],
    [/\bBlackstrap\b/, r => r.lines.some(l => BLACK.includes(l.id) && !l.float)], [/\bToddy\b/, r => r.archetype.id === 'hot-grog'], [/\bColada\b/, r => has(r, 'coconut-cream', 'coconut-milk')],
  ];
  for (const { p, seed, r } of all) {
    for (const nm of [r.name, r.nickname].filter(Boolean)) {
      for (const [re, ok] of NOUNS) if (re.test(nm)) assert.ok(ok(r), `${tag(p, seed, r)}: "${nm}" is not true of the build`);
      assert.ok(nm.split(/[\s-]+/).filter(Boolean).length <= 4 || nm === r.classic?.name, `${tag(p, seed, r)}: "${nm}" is more than four words`);
    }
    if (r.archetype.id === 'hot-buttered-rum') assert.ok(!/\bToddy\b/.test(r.name), `${tag(p, seed, r)}: a hot buttered rum is no toddy`);
    if (r.riffOf) {
      const riff = r.riffOf.name.toLowerCase().split(/[\s-]+/);
      const modifier = r.name.slice(0, Math.max(0, r.name.toLowerCase().lastIndexOf(r.riffOf.name.toLowerCase()))).toLowerCase().split(/[\s-]+/).filter(Boolean);
      assert.ok(!modifier.some(w => riff.includes(w)), `${tag(p, seed, r)}: "${r.name}" repeats the classic's own word`);
    }
  }
});

test('7. the drink a card is built on is its nearest catalogued relative', () => {
  for (const { p, seed, r } of all) {
    if (r.archetype.id !== 'fruit-colada' || r.riffOf) continue;
    if (has(r, 'strawberry')) assert.equal(r.reference.name, 'Lava Flow', `${tag(p, seed, r)}: a strawberry colada built on the ${r.reference.name}`);
    // A banana colada anchors to a banana drink: the Banana Colada, or the Lava Flow when its coconut rum matches too.
    else if (has(r, 'banana', 'banana-liqueur') && !has(r, 'blue-curacao')) assert.ok(['Banana Colada', 'Lava Flow'].includes(r.reference.name), `${tag(p, seed, r)}: a banana colada built on the ${r.reference.name}`);
  }
  for (const { p, seed, r } of all) {
    if (r.archetype.id !== 'sunrise-float' || r.riffOf) continue;
    assert.ok(!/Hurricane|Mai Tai/.test(r.reference.name), `${tag(p, seed, r)}: a sunrise built on the ${r.reference.name}`);
  }
});

// ---------------------------------------------------------------------------------------------
// 8. Culture: its language only when the prayer is about it, spelled properly; a garnish or an
// offering the copy names is in the glass.
test('8. Hawaiian words appear only on a Polynesian prayer, and are spelled with the ʻokina', () => {
  const ASCII = /\b(maita'i|ho'olaule'a|hawai'i|lu'au|ho'omaika'i|kaua'i|o'ahu|ali'i)\b/i;
  for (const { p, seed, r } of all) {
    const poly = polynesianPrayer(p, engine.parse(p).concepts);
    for (const t of [r.name, r.nickname, r.tagline].filter(Boolean)) {
      if (!poly) assert.ok(!HAWAIIAN.test(t) && !POLY.test(t), `${tag(p, seed, r)}: Hawaiian words on a non-Polynesian prayer: "${t}"`);
    }
    assert.ok(!ASCII.test(cardText(r)), `${tag(p, seed, r)}: an ASCII apostrophe for the ʻokina`);
  }
});

test('8. a garnish named in the tagline is on the drink', () => {
  const G = [[/\b(tiare|gardenia)\b/, /tiare|gardenia/], [/\borchids?\b/, /orchid/], [/\bumbrellas?\b/, /umbrella/], [/\bnutmeg\b/, /nutmeg/], [/\bcinnamon stick\b/, /cinnamon stick/], [/\bmint sprig\b/, /mint/]];
  // (Don's Gardenia Mix is a bottle, not the flower.)
  for (const { p, seed, r } of all) for (const [re, g] of G) if (re.test(r.tagline.toLowerCase().replace(/gardenia mix/g, ''))) assert.ok(g.test(gtext(r)), `${tag(p, seed, r)}: "${r.tagline}" but the garnish is ${r.garnish.join('; ')}`);
});

// The lore of a reading may tell of the ʻōhelo offered to Pele (history is never dropped); the
// drink's own words (name, tagline, tasting, Why) never borrow it as a flavor note.
test('8. an offering named on the card is in the glass', () => {
  for (const { p, seed, r } of all) {
    const text = [r.name, r.tagline, r.explanation.tasting, ...r.explanation.whyItWorks].join(' \n ').toLowerCase();
    if (/ʻōhelo|ohelo/.test(text) && /offer/.test(text)) assert.ok(has(r, 'cranberry-juice', 'raspberry-syrup', 'raspberry-liqueur', 'blackberry-liqueur', 'creme-de-cassis', 'strawberry'), `${tag(p, seed, r)}: names the ʻōhelo offering without a berry`);
  }
});

// ---------------------------------------------------------------------------------------------
// 9. Lint: punctuation, length, era and mood.
test('9. no doubled punctuation, no space before a comma', () => {
  for (const { p, seed, r } of all) {
    const t = cardText(r);
    assert.ok(!/[,;:]\s*[,;:.]|(?<!\.)\.\.(?!\.)|[!?]['"’”]?\.| [,.;:]/.test(t), `${tag(p, seed, r)}: ${t.match(/.{0,30}([,;:]\s*[,;:.]|(?<!\.)\.\.(?!\.)|[!?]['"’”]?\.| [,.;:]).{0,30}/)?.[0]}`);
  }
});

test('9. taglines are short and say "with" at most once', () => {
  for (const { p, seed, r } of all) {
    if (r.classic) continue;
    const t = r.tagline;
    assert.ok(t.split(/\s+/).length <= 16, `${tag(p, seed, r)}: ${t.split(/\s+/).length} words: ${t}`);
    assert.ok((t.match(/\bwith\b/g) || []).length <= 1, `${tag(p, seed, r)}: ${t}`);
    assert.ok(!/\b(\w+)\s+\1\b/i.test(t), `${tag(p, seed, r)}: a word twice in a row: ${t}`);
  }
});

test('9. a tagline mood comes from what the prayer matched', () => {
  const moods = [...new Set((Array.isArray(concepts) ? concepts : concepts.concepts).flatMap(c => c.taglineWords || []))].filter(m => m.length >= 12);
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ'’]/g, '').replace(/^with\s+/, '').replace(/[.!]+$/, '');
  for (const { p, seed, r } of all) {
    const mine = new Set((engine.parse(p).taglineWords || []).map(norm));
    const t = norm(r.tagline);
    for (const m of moods) if (t.includes(norm(m))) assert.ok(mine.has(norm(m)) || [...mine].some(x => x.includes(norm(m)) && t.includes(x)), `${tag(p, seed, r)}: mood "${m}" from a concept the prayer didn't match`);
  }
});

test('9. a year or decade in a tagline is the drink\'s own', () => {
  for (const { p, seed, r } of all) {
    const bare = r.tagline.replace(/\([^)]*\)/g, '');
    const m = bare.match(/\b(1[5-9]\d\d|20[0-2]\d)(s)?\b/);
    if (!m) continue;
    const y = (r.reference && r.reference.year) || (r.classic && r.classic.year);
    const lo = Number(m[1]), hi = m[2] ? lo + 9 : lo;
    assert.ok(y && y >= lo - 1 && y <= hi + 1, `${tag(p, seed, r)}: "${r.tagline}" but the drink dates from ${y}`);
  }
});

test('9. time words only when the prayer keeps that time', () => {
  const TIMES = [[/\b(sunrise|dawn|daybreak|morning)\b/i, /sunrise|dawn|daybreak|morning|brunch|breakfast/i], [/\b(sunset|sundown|dusk|twilight)\b/i, /sunset|sundown|dusk|twilight|evening/i], [/\b(midnight|moonlit|moonless)\b/i, /night|midnight|moon|late/i]];
  for (const { p, seed, r } of all) {
    for (const [re, prayer] of TIMES) for (const t of [r.name, r.tagline]) if (re.test(t.replace(/\([^)]*\)/g, '')) && !/sunrise-float/.test(r.archetype.id)) assert.ok(prayer.test(p), `${tag(p, seed, r)}: "${t}" for "${p}"`);
  }
});

// ---------------------------------------------------------------------------------------------
// 10. Readings are promises the recipe keeps, said in the reading's own voice (round 2).
const pair = p => all.filter(x => x.p === p);
const fold10 = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’ʻ]/g, "'");
test('10. Heard quotes what the guest typed, never echoes a word or leaks notes for the bartender', () => {
  for (const { p, seed, r } of all) {
    const heard = r.explanation.reading.heard;
    for (const h of heard) {
      assert.ok(fold10(p).includes(fold10(h.phrase)) || fold10(h.phrase).split(/\s+/).every(w => fold10(p).includes(w)), `${tag(p, seed, r)}: quotes "${h.phrase}", which the guest didn't type`);
      const ph = fold10(h.phrase).replace(/[^a-z ]/g, ''), mn = fold10(h.meaning).replace(/[^a-z ]/g, '');
      assert.ok(mn !== ph && mn !== `${ph} family`, `${tag(p, seed, r)}: "${h.phrase}" echoed as "${h.meaning}"`);
      assert.ok(!/^(read (it |them )?as|families:|target |a group:)|\bmust come from\b/i.test(h.meaning), `${tag(p, seed, r)}: notes for the bartender in "${h.meaning}"`);
    }
    // A word inside a phrase already heard is part of that reading, not a line of its own.
    for (const h of heard) assert.ok(!heard.some(o => o !== h && fold10(o.phrase).split(/\s+/).length > 1 && fold10(h.phrase).split(/\s+/).every(w => fold10(o.phrase).split(/\s+/).includes(w))), `${tag(p, seed, r)}: "${h.phrase}" heard twice`);
  }
  const hav = pair('Havana 1957')[0].r.explanation.reading.heard.map(h => h.phrase);
  assert.ok(hav.includes('Havana 1957'), `Havana 1957 heard as ${hav.join(', ')}`);
});

test('10. history in a reading is kept whole (Pele, the ʻōhelo, Hampden, Ting, Elvis and the Coco Palms)', () => {
  const said = (p, re) => pair(p).every(({ r }) => r.explanation.reading.heard.some(h => re.test(h.meaning)));
  assert.ok(said('volcano goddess', /Halemaʻumaʻu/) && said('volcano goddess', /ʻōhelo/), 'Pele and the ʻōhelo');
  assert.ok(said('Jamaican street party', /Hampden/) && said('Jamaican street party', /Ting/), 'Hampden and Ting');
  assert.ok(said('Elvis in Blue Hawaii', /Coco Palms on Kauaʻi/) && said('Elvis in Blue Hawaii', /four years/), 'Elvis');
  assert.ok(said('a night in Tahiti', /maitaʻi roa aʻe/i), 'Tahiti');
});

test('10. the drink keeps what the reading promised', () => {
  const ozOf = (r, ...ids) => oz(r, ...ids);
  for (const { p, seed, r } of all) {
    if (/\bbitter\b/.test(p) && !/jungle bird/i.test(p)) { assert.ok(ozOf(r, 'campari') >= 0.74, `${tag(p, seed, r)}: bitter without ¾ oz Campari`); assert.ok(!has(r, 'aperol'), `${tag(p, seed, r)}: Aperol for "bitter"`); }
    if (/\bsmoky\b/.test(p)) assert.ok(ozOf(r, 'scotch-islay') >= 0.24 || ozOf(r, 'mezcal') >= 0.5 || r.lines.some(l => l.id === 'mezcal' && l.float), `${tag(p, seed, r)}: smoke you can't taste`);
    if (/\bpassion fruit\b/.test(p)) assert.ok(ozOf(r, 'passion-fruit-syrup', 'passion-fruit-juice') >= 0.74 || ozOf(r, 'passion-fruit-nectar') >= 1, `${tag(p, seed, r)}: passion fruit only as a token`);
    if (/\btropical\b/.test(p)) assert.ok(has(r, 'passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'fassionola', 'guava-nectar', 'mango-nectar', 'pineapple-juice'), `${tag(p, seed, r)}: "tropical" heard and ignored`);
    if (/\bnight\b/.test(p)) assert.ok(!(r.explanation.reading.unheard || []).includes('night'), `${tag(p, seed, r)}: night not heard`);
    if (/\bfirst date\b/.test(p) && r.archetype.id === 'fruit-daiquiri') assert.ok(has(r, 'apricot-liqueur') && has(r, 'pineapple-juice') && ['coupe', 'nick-nora', 'cocktail-glass'].includes(r.vessel.id), `${tag(p, seed, r)}: the Hotel Nacional, served up`);
  }
  const [h0] = pair('Havana 1957');
  assert.ok(h0.r.archetype.id === 'frozen-daiquiri' && has(h0.r, 'maraschino') && h0.r.method.method === 'blend', `Havana 1957 [0] is the Floridita No. 4, frappé: ${h0.r.name}`);
  for (const { seed, r } of pair('celebrating a promotion').filter(x => x.r.archetype.family === 'mai-tai' || /mai-tai/.test(x.r.archetype.id))) assert.ok(oz(r, 'orgeat') >= 0.49 && r.lines.some(l => l.float && l.id === 'rum-demerara-overproof'), `promotion [${seed}] ${r.name}: ½ oz orgeat and the Demerara 151 float`);
  const [b0] = pair('heartbreak');
  assert.ok(oz(b0.r, 'cherry-heering') >= 0.49, `heartbreak [0] ${b0.r.name}: the promised Cherry Heering`);
  const [t0] = pair('a night in Tahiti');
  assert.ok(/mai-tai/.test(t0.r.archetype.id) && has(t0.r, 'vanilla-syrup') && /tiare|gardenia/.test(gtext(t0.r)), `Tahiti [0] ${t0.r.name}: a vanilla Mai Tai with a tiare`);
  const [g0] = pair('green like the jungle');
  assert.equal(g0.r.archetype.id, 'nuclear-daiquiri', `green [0] ${g0.r.name}`);
  for (const { seed, r } of pair('Jamaican street party')) assert.ok(has(r, 'grapefruit-soda') && r.archetype.id !== 'tropical-itch', `Jamaican street party [${seed}] ${r.name}: Jamaican rum punch with Ting`);
  for (const { seed, r } of pair('volcano goddess')) assert.ok(!/first berry/.test(r.tagline) && has(r, 'hibiscus-syrup') && has(r, 'ancho-reyes'), `volcano goddess [${seed}] ${r.name}: geology, hibiscus and chile`);
  for (const { seed, r } of pair('something my dad would like')) assert.ok(has(r, 'bourbon') && has(r, 'maple-syrup') && has(r, 'scotch-islay'), `dad [${seed}] ${r.name}: bourbon, maple and smoke`);
});

test('10. moves are credited to the word they serve, with the line\'s own amount', () => {
  for (const { p, seed, r } of all) {
    const why = r.explanation.whyItWorks.join(' ');
    assert.ok(!/For “[^”]+”, “[^”]+”, “[^”]+”:/.test(why), `${tag(p, seed, r)}: one move credited to three words: ${why}`);
    assert.ok(!/For “bitter”: Aperol|For “(highball|ginger|lime)”[^.]*sparkling wine|For “low abv”[^.]*sparkling wine/.test(why), `${tag(p, seed, r)}: ${why}`);
    assert.ok(!/\ba barspoon of\b/.test(r.explanation.reading.moves.join(' ')), `${tag(p, seed, r)}: a move without its amount`);
    assert.ok(!/\bframe\b/.test(`${r.explanation.reading.builtOn.text} ${why}`), `${tag(p, seed, r)}: "frame" in guest copy`);
  }
});

test('10. names: type nouns from the drink, pointer words present, weather only on weather, no stem twice in a pair', () => {
  const WEATHER = /\b(Monsoon|Maelstrom|Riptide|Doldrums|Typhoon|Squall|Tempest|Gale|Downpour|Waterspout)\b/;
  for (const { p, seed, r } of all) {
    const nm = r.nickname || r.name;
    if (/mai-tai/.test(r.archetype.id) || r.method.method === 'blend') assert.ok(!/\bSour\b/.test(nm), `${tag(p, seed, r)}: "Sour" on a ${r.archetype.id}`);
    if (/\bOrchid\b/.test(nm)) assert.ok(/orchid/.test(gtext(r)), `${tag(p, seed, r)}: an Orchid with no orchid`);
    if (/\b(Sakura|Blossom|Blooming)\b/.test(nm)) assert.ok(/orchid|gardenia|tiare|flower|blossom/.test(gtext(r)), `${tag(p, seed, r)}: a blossom name with no flower`);
    assert.ok(!/\bCopra\b/.test(nm), `${tag(p, seed, r)}: Copra`);
    if (WEATHER.test(nm)) assert.ok(r.method.method !== 'stir' && !/lazy|sunday|slow/.test(p) && (r.stats.standardDrinks >= 2.2 || r.style.flaming || /storm|typhoon|hurricane|wild|snow/.test(p)), `${tag(p, seed, r)}: weather on a calm drink`);
    assert.ok(!/Moorea/.test(`${nm} ${r.tagline}`), `${tag(p, seed, r)}: Moʻorea without its ʻokina`);
  }
  const TYPE = new Set(['punch', 'cup', 'grog', 'daiquiri', 'sour', 'swizzle', 'colada', 'buck', 'cooler', 'highball', 'bird', 'nightcap', 'sipper', 'toddy', 'mug', 'mai', 'tai', 'frappé', 'bowl', 'pilot', 'revenant', 'specter']);
  for (const p of new Set(all.map(x => x.p))) {
    const [a, b] = pair(p);
    if (!a || !b || a.r.classic || b.r.classic || b.r.riffOf) continue;
    const words = r => (r.nickname || r.name).toLowerCase().split(/[\s-]+/).filter(w => w.length >= 4 && !TYPE.has(w));
    const shared = words(b.r).filter(w => words(a.r).includes(w));
    assert.deepEqual(shared, [], `${p}: "${a.r.nickname || a.r.name}" and "${b.r.nickname || b.r.name}" share a stem`);
  }
});

test('10. taglines: each seed its own line and its own hook, no dead forms, colours from the look', () => {
  for (const p of new Set(all.map(x => x.p))) {
    const ts = pair(p).filter(x => !x.r.classic).map(x => x.r.tagline);
    assert.equal(new Set(ts).size, ts.length, `${p}: a tagline printed twice: ${ts.join(' | ')}`);
    const hooks = (engine.parse(p).taglineWords || []).map(m => fold10(m).replace(/^with\s+/, ''));
    for (const h of hooks) assert.ok(pair(p).filter(x => fold10(x.r.tagline).includes(h)).length <= 1, `${p}: the hook "${h}" on two seeds`);
  }
  for (const { p, seed, r } of all) {
    if (r.classic) continue;
    assert.ok(!/^An? (planter's punch|colada with banana|blue hawaii riff|orgeat punch with passion fruit|daiquiri)\.$/i.test(r.tagline), `${tag(p, seed, r)}: dead form "${r.tagline}"`);
    if ((r.reference || {}).similarity >= 0.85) assert.ok(!/-style\b|\bcousin\b/.test(r.tagline), `${tag(p, seed, r)}: "-style" or "cousin" at ${r.reference.similarity}: ${r.tagline}`);
    if (/\bprecision\b/.test(r.tagline)) assert.ok(r.method.method !== 'blend', `${tag(p, seed, r)}: precision from a blender`);
  }
});

test('10. tasting names only what you can taste, the nose only what reaches it; a flame only if a step lights it', () => {
  for (const { p, seed, r } of all) {
    const t = r.explanation.tasting;
    const front = ((t.match(/(?:^|; )([^;.]*?) up front/) || [])[1] || '').replace(/^.*?; /, '');
    const final = r.stats.finalOz || 1;
    for (const [word, ids, k] of [['pineapple', ['pineapple-juice', 'pineapple-syrup'], 1.2], ['coconut water', ['coconut-water'], 1], ['banana', ['banana-liqueur', 'banana'], 1.6], ['vanilla', ['vanilla-syrup'], 1.2]]) {
      if (!new RegExp(`\\b${word}\\b`, 'i').test(front)) continue;
      const loud = r.lines.filter(l => ids.includes(l.id) && !l.garnish).reduce((s, l) => s + (l.unit === 'piece' ? 0.06 * final : (l.oz || 0)) / final * k, 0);
      assert.ok(loud >= 0.03, `${tag(p, seed, r)}: "${word}" up front at ${loud.toFixed(3)} of the glass: ${t}`);
    }
    if (/Fresh mint on the nose/.test(t)) assert.ok(/mint/.test(gtext(r)) || r.lines.some(l => l.id === 'mint' && l.muddled), `${tag(p, seed, r)}: mint on the nose with no mint`);
    if (/Peat smoke on the nose/.test(t)) assert.ok(oz(r, 'scotch-islay') >= 0.2, `${tag(p, seed, r)}: peat smoke from a token`);
    const lit = r.method.steps.some(s => /^Fire, last and carefully/.test(s)) || /flaming/.test(gtext(r));
    assert.equal(!!r.style.flaming, lit, `${tag(p, seed, r)}: style.flaming ${r.style.flaming} but lit ${lit}`);
  }
});
