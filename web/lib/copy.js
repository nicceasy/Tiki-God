import { showsColor } from './optics.js';
import { POLY, cultureOk, timeOk, polishPolynesian, TIME_WORDS } from './names.js';
import { fracString } from './format.js';

// Menu copy that tells the truth. Every flavor a tagline or tasting note names must be carried
// by an ingredient at a dose you can taste; the drink's type word comes from its archetype
// (which the composer guarantees it satisfies) and must be true of the build; the prayer
// contributes the mood, never fake flavors. A research reading is said back to the guest only
// if the drink keeps every promise in it; otherwise the Shrine says what was actually poured.

// How loudly an ingredient speaks per ounce, by category.
const INTENSITY = { rum: 1, spirit: 1, liqueur: 1.6, fortified: 1.2, bitters: 26, syrup: 1.2, citrus: 1.5, juice: 1, cream: 1.1, soda: 0.5, aromatic: 0 };
// Tags that describe structure rather than flavor, never named as flavors.
const STRUCTURAL = new Set(['sweet', 'tart', 'light', 'crisp', 'dry', 'rich', 'boozy', 'fruity', 'tropical', 'warm', 'citrus', 'creamy', 'effervescent']);
const WORD = {
  lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', orange: 'orange', pineapple: 'pineapple', 'passion-fruit': 'passion fruit',
  guava: 'guava', mango: 'mango', papaya: 'papaya', banana: 'banana', coconut: 'coconut', cherry: 'cherry', berry: 'red berries',
  apricot: 'apricot', peach: 'peach', 'stone-fruit': 'stone fruit', pomegranate: 'pomegranate', apple: 'apple', melon: 'melon', lychee: 'lychee',
  'dried-fruit': 'dried fruit', almond: 'almond', nutty: 'toasted nuts', vanilla: 'vanilla', cinnamon: 'cinnamon', allspice: 'allspice',
  clove: 'clove', nutmeg: 'nutmeg', ginger: 'ginger', 'baking-spice': 'baking spice', anise: 'anise', chili: 'chili heat', pepper: 'pepper',
  herbal: 'herbal notes', mint: 'mint', floral: 'floral notes', honey: 'honey', caramel: 'caramel', molasses: 'molasses', maple: 'maple', buttery: 'butter',
  chocolate: 'chocolate', coffee: 'coffee', tea: 'tea', funky: 'rum funk', grassy: 'green cane', vegetal: 'green agave', smoky: 'smoke',
  oaky: 'oak', bitter: 'a bitter edge', salty: 'salt', earthy: 'earth', agave: 'agave', juniper: 'juniper',
};
// The voice of each base spirit in a tasting note.
const SPIRIT_VOICE = {
  'rum-white-column': 'crisp white rum', 'rum-gold-column': 'smooth gold rum', 'rum-aged-column': 'mellow aged rum', 'rum-blended-light': 'lightly aged rum',
  'rum-barbados': 'round Barbados rum', 'rum-jamaican-aged': 'funky Jamaican rum', 'rum-jamaican-dark': 'dark Jamaican rum', 'rum-jamaican-pot': 'high-ester Jamaican pot still',
  'rum-jamaican-white-overproof': 'fiery Jamaican overproof', 'rum-demerara': 'molasses-rich Demerara rum', 'rum-demerara-overproof': 'burnt-sugar 151 Demerara',
  'rum-black-blended': 'inky black rum', 'rum-black-overproof': 'black overproof', 'rum-agricole-blanc': 'grassy rhum agricole', 'rum-agricole-vieux': 'aged rhum agricole',
  'rum-haitian': 'earthy Haitian rum', 'rum-navy': 'navy-strength rum', 'rum-overproof-white': 'overproof white rum', 'rum-spiced': 'spiced rum',
  'rum-pineapple': 'pineapple rum', 'rum-cachaca': 'grassy cachaça', gin: 'piney gin', 'gin-old-tom': 'soft Old Tom gin', bourbon: 'vanilla-and-oak bourbon',
  rye: 'peppery rye', 'scotch-blended': 'honeyed Scotch', 'irish-whiskey': 'Irish whiskey', brandy: 'brandy', applejack: 'apple brandy', pisco: 'floral pisco',
  'tequila-blanco': 'peppery blanco tequila', 'tequila-reposado': 'rested tequila', mezcal: 'smoky mezcal', vodka: 'vodka', aquavit: 'caraway aquavit',
  'batavia-arrack': 'Batavia arrack', okolehao: 'okolehao', 'black-tea': 'strong black tea', 'japanese-whisky': 'Japanese whisky',
};
// How a bottle is named in a sentence: the thing a bartender would say, proper nouns kept.
const SAY = {
  'rum-white-column': 'light rum', 'rum-gold-column': 'gold rum', 'rum-aged-column': 'aged rum', 'rum-blended-light': 'lightly aged rum', 'rum-barbados': 'Barbados rum',
  'rum-jamaican-aged': 'Jamaican rum', 'rum-jamaican-dark': 'dark Jamaican rum', 'rum-jamaican-pot': 'Jamaican pot-still rum', 'rum-jamaican-white-overproof': 'Jamaican overproof',
  'rum-demerara': 'Demerara rum', 'rum-demerara-overproof': 'Demerara 151', 'rum-black-blended': 'black rum', 'rum-black-overproof': 'black overproof rum',
  'rum-agricole-blanc': 'rhum agricole', 'rum-agricole-vieux': 'aged rhum agricole', 'rum-haitian': 'Haitian rum', 'rum-navy': 'navy rum', 'rum-overproof-white': 'white overproof rum',
  'rum-cachaca': 'cachaça', lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', orange: 'orange juice', 'pineapple-juice': 'pineapple', 'coconut-cream': 'cream of coconut',
  'velvet-falernum': 'falernum', 'falernum-syrup': 'falernum syrup', 'orange-curacao': 'orange curaçao', 'blue-curacao': 'blue curaçao', 'dons-mix': "Don's Mix", 'gardenia-mix': 'Gardenia Mix',
  'hot-buttered-rum-batter': 'buttered-rum batter', 'tom-and-jerry-batter': 'Tom & Jerry batter', 'sparkling-wine': 'sparkling wine', 'soda-water': 'soda', 'simple-syrup': 'simple syrup',
  'rich-simple': 'rich syrup', 'demerara-syrup': 'demerara syrup', 'honey-syrup': 'honey', 'passion-fruit-syrup': 'passion fruit syrup', 'mint': 'fresh mint', banana: 'ripe banana',
  strawberry: 'strawberries', 'scotch-islay': 'Islay Scotch', 'japanese-whisky': 'Japanese whisky', 'ancho-reyes': 'chile liqueur', 'tequila-blanco': 'blanco tequila',
  'tequila-reposado': 'reposado tequila', brandy: 'brandy', angostura: 'Angostura', absinthe: 'absinthe', pastis: 'Pernod', 'heavy-cream': 'cream', 'half-and-half': 'cream',
};
// Proper nouns a lowercased bottle name must keep ("the dark Jamaican rum float").
const PROPER = [
  ['jamaican', 'Jamaican'], ['demerara(?! syrup| sugar)', 'Demerara'], ['barbados', 'Barbados'], ['haitian', 'Haitian'], ['angostura', 'Angostura'], ['campari', 'Campari'],
  ['aperol', 'Aperol'], ['galliano', 'Galliano'], ['bénédictine', 'Bénédictine'], ['chartreuse', 'Chartreuse'], ['cherry heering', 'Cherry Heering'], ["don's mix", "Don's Mix"],
  ["don's spices", "Don's Spices"], ['gardenia mix', 'Gardenia Mix'], ['london', 'London'], ['old tom', 'Old Tom'], ['irish', 'Irish'], ['islay', 'Islay'], ['scotch', 'Scotch'],
  ['batavia', 'Batavia'], ["peychaud's", "Peychaud's"], ['pedro ximénez', 'Pedro Ximénez'], ['licor 43', 'Licor 43'], ['fernet', 'Fernet'], ['drambuie', 'Drambuie'], ['cynar', 'Cynar'],
  ['lillet', 'Lillet'], ['spanish', 'Spanish'], ['japanese', 'Japanese'], ['cognac', 'Cognac'], ['champagne', 'Champagne'], ['swedish', 'Swedish'], ['chinese', 'Chinese'],
  ['tom & jerry', 'Tom & Jerry'], ['pernod', 'Pernod'], ['herbsaint', 'Herbsaint'], ['cointreau', 'Cointreau'], ['martinique', 'Martinique'], ['cuban', 'Cuban'], ['puerto rican', 'Puerto Rican'],
];
const PROPER_RE = new RegExp(`\\b(${PROPER.map(([w]) => w).join('|')})\\b`, 'g');
const PROPER_MAP = Object.fromEntries(PROPER.map(([w, to]) => [w.replace(/\(.*\)$/, ''), to]));
export const properCase = s => String(s || '').replace(PROPER_RE, m => PROPER_MAP[m] || m);

const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] || '');
const strip = n => n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const an = w => (/^[aeiou]/i.test(w) && !/^(one|u[bcfhjkqrstn][aeiou])/i.test(w) ? 'an' : 'a');

// A definition spliced after a colon keeps its proper nouns: "Trader Vic's orgeat punch", not
// "trader Vic's"; only a common opening word ("A", "Rum", "Two") is lowercased.
const COMMON_OPENERS = new Set(['a', 'an', 'the', 'two', 'three', 'four', 'rum', 'aged', 'navy', 'equal', 'one']);
export function decap(s) {
  const t = String(s || '');
  const first = (t.match(/^[A-Za-z']+/) || [''])[0];
  return COMMON_OPENERS.has(first.toLowerCase()) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

// Who made a drink, where and when (and how sure we are), as a card prints it.
export function creditText(o) {
  if (!o) return '';
  if (o.text !== undefined) return o.text;
  const head = [o.who, o.where, o.when].filter(Boolean).join(', ');
  return [head, o.published ? `published by ${o.published}` : '', o.claim || ''].filter(Boolean).join('; ');
}

// Final pass on any line a guest reads: proper nouns, the ʻokina and kahakō, and punctuation
// that never doubles up ("cannonball!." or " ,").
export function polish(text) {
  return polishPolynesian(properCase(String(text || '')))
    .replace(/\s+([,.;:!?])/g, '$1').replace(/([!?]['"’”]?)\./g, '$1').replace(/(?<!\.)\.\.(?!\.)/g, '.').replace(/,\s*\./g, '.').replace(/([,;:])\1+/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

// One strength scale in US standard drinks (0.6 oz of ethanol), shared by the tasting note and
// the Why lines. Under 1.2 is light, up to 1.9 a normal cocktail, 2.0-2.4 strong, 2.5 and up a
// heavyweight. The house rule belongs to the house: Don's two-per-guest limit on Don's
// heavyweights, Vic's table for Vic's, Pat O'Brien's for the Hurricane. Bowls speak per guest;
// hot drinks never mention ice.
export function strengthBand(sd, abv) {
  if (abv <= 0.5) return 'zero';
  if (sd < 1.2) return 'light';
  if (sd < 2) return 'normal';
  if (sd < 2.5) return 'strong';
  return 'heavyweight';
}
const sdWords = sd => {
  let h = Math.round(sd * 2) / 2;
  // "About 2½" is never said of a 2.4, nor "about 2" of a 2.5: the words stay inside the band.
  if (sd < 2.5 && h >= 2.5) h = 2;
  if (sd >= 2.5 && h < 2.5) h = 2.5;
  return h <= 1 ? (sd < 0.9 ? 'under a standard drink' : 'about one standard drink') : `about ${fracString(h)} standard drinks`;
};
const HOUSE_RULE = {
  zombie: 'Don the Beachcomber limited his Zombie to two per guest, and the same goes here.',
  don: "Don the Beachcomber's two-per-guest rule applies.",
  vic: 'A Trader Vic heavyweight: one is plenty.',
  'vic-table': 'Trader Vic served it by the bowl, for the table: one round is plenty.',
  pat: "Pat O'Brien's pours it by the souvenir glass: one is plenty.",
};
// Don's limit was on his Zombie and its line (the Cobra's Fang, his Test Pilot), nothing else.
const houseRule = (archetypeId, house) => archetypeId === 'zombie' ? HOUSE_RULE.zombie
  : archetypeId === 'cobras-fang' || (archetypeId === 'pilot' && house === 'don') ? HOUSE_RULE.don
    : ['scorpion', 'scorpion-bowl'].includes(archetypeId) ? HOUSE_RULE['vic-table']
      : archetypeId === 'hurricane' ? HOUSE_RULE.pat
        : house === 'vic' ? HOUSE_RULE.vic : 'One is plenty.';
export function strengthCopy(stats, { method = '', house = null, archetypeId = '', perGuest = false } = {}) {
  const sd = stats.standardDrinks || 0, abv = stats.abv || 0;
  const band = strengthBand(sd, abv);
  const who = perGuest ? 'Per guest, ' : '';
  const rule = band !== 'heavyweight' ? '' : houseRule(archetypeId, house);
  const tasting = {
    zero: 'No alcohol at all, but all of the ritual.',
    light: `${who ? 'Per guest, it is light' : 'Light'}: ${sdWords(sd)}.`,
    normal: `${who}${who ? 'about' : 'About'} the strength of a normal cocktail.`,
    strong: `${who ? 'Per guest, it is strong' : 'Strong'}: ${sdWords(sd)}, so sip it${method === 'hot' ? ' while it steams' : ''}.`,
    heavyweight: `${who ? 'Per guest, a heavyweight' : 'A heavyweight'}: ${sdWords(sd)}. ${rule}`,
  }[band];
  const n = `${sd} US standard drink${sd === 1 ? '' : 's'}${perGuest ? ' per guest' : ''}`;
  const why = band === 'zero' ? 'No alcohol at all, so anyone at the table can have one.'
    : `About ${n} (${abv}% ABV after dilution): ${{ light: 'light', normal: 'about a normal cocktail', strong: 'strong, so sip it', heavyweight: 'a heavyweight' }[band]}.${rule ? ` ${rule}` : ''}`;
  return { band, tasting: tasting.trim(), why };
}

export function createCopywriter({ ingMap, ingVec }) {
  const ing = id => ingMap.get(id) || {};
  const say = id => SAY[id] || properCase(strip(ing(id).name || id).toLowerCase());
  const leadOf = id => (ing(id).flavors || [])[0];
  const PLAIN = new Set(['simple-syrup', 'rich-simple', 'demerara-syrup', 'cane-syrup']);
  // In the glass, not on it: a garnish or an aromatic (a mint sprig) counts only when muddled.
  const isPoured = l => l.muddled || (!l.garnish && ing(l.id).role !== 'aromatic');

  // Which flavors a drink really carries: tag → { score, carriers }.
  function presence(lines, floor = 0.05) {
    const total = lines.filter(l => !l.garnish).reduce((s, l) => s + (l.oz || 0), 0) || 1;
    const out = {};
    for (const l of lines) {
      const ig = ingMap.get(l.id);
      if (!ig) continue;
      const k = l.muddled ? 0.6 : l.garnish || ig.role === 'aromatic' ? 0.25 : ((l.oz || 0) / total) * (INTENSITY[ig.cat] ?? 1) * (ig.role === 'base' ? 1.2 : 1);
      for (const [t, w] of Object.entries(ingVec[l.id] || {})) {
        const v = w * k;
        if (!out[t]) out[t] = { tag: t, score: 0, carriers: [] };
        out[t].score += v;
        if (v >= Math.min(0.04, floor * 0.8)) out[t].carriers.push(l.id);
      }
    }
    return Object.values(out).filter(x => x.score >= floor && x.carriers.length).sort((a, b) => b.score - a.score);
  }

  const named = pres => pres.filter(x => !STRUCTURAL.has(x.tag) && WORD[x.tag]);

  // Flavors that may headline a name or tagline: the lead flavor of an ingredient poured at a
  // dose you can taste (a quarter ounce, a teaspoon of something loud, or mint worked into the
  // drink). Secondary notes (the banana in Jamaican rum's funk) never headline.
  const LOUD = new Set(['liqueur', 'syrup', 'fortified']);
  function headline(lines) {
    const out = new Map();
    for (const l of lines) {
      const ig = ingMap.get(l.id);
      if (!ig || (l.garnish && !l.muddled)) continue;
      const lead = (ig.flavors || []).find(t => !STRUCTURAL.has(t) && WORD[t]);
      if (!lead) continue;
      const ok = l.muddled || (l.oz || 0) >= 0.25 || (LOUD.has(ig.cat) && (l.oz || 0) >= 0.16);
      if (!ok || ig.cat === 'bitters') continue;
      out.set(lead, (out.get(lead) || 0) + (l.oz || 0.5) * (INTENSITY[ig.cat] ?? 1));
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }

  // ---------------------------------------------------------------------------------------
  // What the finished drink is, for every truth check below. Built once per drink.
  const SMOKY = ['mezcal', 'scotch-islay', 'lapsang-tea'];
  const BITTER = ['campari', 'aperol', 'amaro', 'cynar', 'fernet'];
  const FIZZ = ['soda-water', 'ginger-beer', 'ginger-ale', 'sparkling-wine', 'tonic', 'cola', 'lemon-lime-soda', 'grapefruit-soda'];
  const CREAMS = ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream', 'whole-milk', 'tom-and-jerry-batter'];
  const SPICE = ['allspice-dram', 'cinnamon-syrup', 'velvet-falernum', 'falernum-syrup', 'dons-mix', 'dons-spices-2', 'ginger-syrup', 'angostura', 'tiki-bitters', 'hot-buttered-rum-batter', 'gardenia-mix', 'five-spice-syrup', 'clove', 'cinnamon', 'nutmeg'];
  function drinkFacts({ lines, stats = {}, look = null, method = '', ice = '', up = false, vessel = null, garnish = [], archetype = {}, prayer = '', concepts = [], riffOf = null, origin = null, servings = 1, steps = [], polynesian = false, intent = {} }) {
    const poured = lines.filter(isPoured);
    const ids = new Set(poured.map(l => l.id));
    const oz = id => poured.filter(l => l.id === id).reduce((t, l) => t + (l.oz || 0), 0);
    const has = (...xs) => xs.some(id => ids.has(id));
    const g = garnish.join(' ').toLowerCase();
    const layers = (look && look.layers) || [];
    const vid = vessel ? vessel.id : '';
    const f = {
      lines: poured, ids, has, oz, garnish, gtext: g, vessel: vid, vesselName: vessel ? vessel.name : '', bowl: !!(vessel && (vessel.serve || []).includes('bowl')),
      method, ice, up, hot: method === 'hot', frozen: method === 'blend' || ice === 'blended', stirred: method === 'stir', swizzled: method === 'swizzle',
      float: poured.some(l => l.float), sink: poured.some(l => l.sink), layered: layers.some(x => x.kind === 'sink' || x.kind === 'float'), foam: layers.some(x => x.kind === 'foam') || has('egg-white', 'egg-whole'),
      flaming: /flaming|flame/.test(g) || steps.some(s => /\blight it\b|set alight|flam/i.test(s)),
      fizzy: FIZZ.some(id => oz(id) >= 0.75), creamy: CREAMS.some(id => oz(id) >= 0.5) || has('vanilla-ice-cream', 'egg-white'),
      smoky: has(...SMOKY), bitter: BITTER.some(id => oz(id) >= 0.25) || oz('angostura') >= 0.5,
      spiced: has(...SPICE) || /nutmeg|cinnamon|clove|allspice/.test(g),
      abv: stats.abv || 0, sd: stats.standardDrinks || 0, sugar: stats.sugarConc || 0, acid: stats.acidConc || 0, ratio: stats.sweetSour, finalOz: stats.finalOz || 0,
      servings, look, shows: c => !!(look && showsColor(look, c)),
      archetype: archetype.id || '', family: archetype.family || '', archetypeName: archetype.name || '', classics: archetype.classics || [], riffOf: riffOf || '',
      prayer: String(prayer || '').toLowerCase(), concepts, polynesian, origin: origin || null, intent,
      rums: poured.filter(l => ing(l.id).cat === 'rum' && !l.float).length,
      leads: new Set(poured.filter(l => (l.oz || 0) >= 0.15 || l.muddled).map(l => leadOf(l.id))),
    };
    return f;
  }

  // ---------------------------------------------------------------------------------------
  // Claims: what a line of prose promises about the drink. Each phrase has a test the finished
  // drink must pass. Phrases are matched most specific first, and a matched phrase is consumed
  // so "dark rum" doesn't also count as the color dark. Used to decide whether a research
  // reading can be said back as written, and whether a tagline mood is true.
  const ANY = (...xs) => f => f.has(...xs);
  const RUMS = [...ingMap.values()].filter(i => i.cat === 'rum').map(i => i.id);
  const JAM = ['rum-jamaican-aged', 'rum-jamaican-dark', 'rum-jamaican-pot', 'rum-jamaican-white-overproof'];
  const DARK = ['rum-jamaican-dark', 'rum-black-blended', 'rum-demerara', 'rum-navy', 'rum-black-overproof', 'rum-demerara-overproof', 'rum-jamaican-aged'];
  const AGED = ['rum-aged-column', 'rum-barbados', 'rum-jamaican-aged', 'rum-agricole-vieux', 'rum-demerara', 'rum-jamaican-dark', 'rum-jamaican-pot', 'rum-gold-column', 'rum-navy', 'rum-haitian'];
  const WHITE = ['rum-white-column', 'rum-blended-light', 'rum-overproof-white', 'rum-agricole-blanc'];
  const OVERPROOF = ['rum-demerara-overproof', 'rum-black-overproof', 'rum-overproof-white', 'rum-jamaican-white-overproof', 'rum-jamaican-pot'];
  const ARCH = (...a) => f => a.includes(f.archetype) || a.some(x => f.riffOf.toLowerCase() === x);
  const GAR = re => f => re.test(f.gtext);
  const C = [
    // Drinks by name (a promise that this drink is one of them).
    [/\b(mai tai|maitaʻi|maita'i)( cousin| shape| template)?\b/, f => ['mai-tai', 'vic-mai-tai-riff', 'hawaiian-mai-tai'].includes(f.archetype) || /mai tai/i.test(f.riffOf), 'drink'],
    [/\bzombie\b/, ARCH('zombie'), 'drink'], [/\bpainkiller\b/, ARCH('painkiller'), 'drink'], [/\bnavy grog\b/, ARCH('navy-grog'), 'drink'],
    [/\bjungle bird\b/, ARCH('bitter-tiki-sour'), 'drink'], [/\bhemingway|papa doble\b/, ARCH('hemingway-daiquiri'), 'drink'], [/\bhotel nacional|air mail|pisco sour|chilcano|dr\.? funk|mimosa|cobbler|julep\b/, () => false, 'drink'],
    [/\b(tequila )?sunrise\b/, f => f.archetype === 'sunrise-float' || (f.sink && f.shows('red')), 'drink'], [/\bblue hawaii(an)?\b/, f => ['blue-hawaii', 'fruit-colada'].includes(f.archetype) && f.has('blue-curacao'), 'drink'],
    [/\bmissionary'?s downfall\b/, ARCH('missionarys-downfall'), 'drink'], [/\bqueen'?s park\b/, ARCH('trinidad-swizzle'), 'drink'], [/\bbushwacker\b/, ARCH('bushwacker'), 'drink'],
    [/\bhot buttered rum\b/, ARCH('hot-buttered-rum'), 'drink'], [/\btom (&|and) jerry\b/, ARCH('tom-and-jerry'), 'drink'], [/\bcoffee grog\b/, f => f.has('coffee') && f.hot, 'drink'],
    [/\bold fashioned\b/, ARCH('rum-old-fashioned', 'tropical-stirred'), 'drink'], [/\bkingston negroni|negroni\b/, f => ['kingston-negroni', 'tropical-stirred'].includes(f.archetype) && f.has('campari'), 'drink'],
    [/\bplanter'?s punch\b/, ARCH('planters-punch'), 'drink'], [/\bscorpion\b/, ARCH('scorpion', 'scorpion-bowl'), 'drink'], [/\bfog cutter\b/, ARCH('fog-cutter'), 'drink'],
    [/\bhoni honi\b/, f => f.archetype === 'vic-mai-tai-riff' && f.has('bourbon'), 'drink'], [/\blava flow\b/, f => f.archetype === 'fruit-colada' && f.has('strawberry'), 'drink'],
    [/\bmojito\b/, ARCH('mojito'), 'drink'], [/\bcaipirinha\b/, ARCH('caipirinha'), 'drink'], [/\bhurricane\b(?! glass)/, ARCH('hurricane'), 'drink'],
    [/\b(piña|pina) colada|colada\b/, f => f.family === 'colada' && f.has('coconut-cream', 'coconut-milk') && f.has('pineapple-juice'), 'drink'],
    [/\bdaiquiris?\b/, f => f.family === 'daiquiri', 'drink'], [/\bswizzle\b(?! stick)/, f => f.swizzled, 'drink'], [/\bgrog\b/, f => f.family === 'grog' || f.archetype === 'hot-grog', 'drink'],
    [/\bspritz\b/, ANY('sparkling-wine'), 'drink'], [/\bmule\b/, ANY('ginger-beer'), 'drink'], [/\btoddy\b/, f => f.hot, 'drink'], [/\bflip\b/, ANY('egg-whole', 'tom-and-jerry-batter'), 'drink'],
    [/\bpunch\b(?! (bowl|cup))/, f => ['punch', 'resort-punch', 'orgeat-punch', 'zombie', 'grog'].includes(f.family) || f.bowl, 'drink'],
    // Vessels.
    [/\bscorpion bowl\b/, f => f.vessel === 'scorpion-bowl', 'vessel'], [/\bvolcano bowl|crater\b/, f => f.vessel === 'volcano-bowl', 'vessel'], [/\bpunch (bowl|cup)\b/, f => f.vessel === 'punch-bowl', 'vessel'],
    [/\b(in a |coconut )shell|in a coconut\b/, f => f.vessel === 'coconut', 'vessel'], [/\b(hollowed[- ](out )?|in a )pineapple\b|pineapple shell\b/, f => f.vessel === 'pineapple', 'vessel'],
    [/\bcoupe\b/, f => f.vessel === 'coupe', 'vessel'], [/\bnick ?(&|and) ?nora\b/, f => f.vessel === 'nick-nora', 'vessel'], [/\brocks glass|heavy rocks\b/, f => ['rocks', 'dof'].includes(f.vessel), 'vessel'],
    [/\bdouble old fashioned\b/, f => f.vessel === 'dof', 'vessel'], [/\bhighball\b/, f => ['highball', 'collins'].includes(f.vessel) || (f.fizzy && f.finalOz >= 6), 'vessel'],
    [/\bcollins\b/, f => f.vessel === 'collins', 'vessel'], [/\bchimney|zombie glass\b/, f => f.vessel === 'chimney', 'vessel'], [/\bhurricane(-lamp)? glass\b/, f => f.vessel === 'hurricane', 'vessel'],
    [/\bpoco grande\b/, f => f.vessel === 'poco-grande', 'vessel'], [/\bpilsner\b/, f => f.vessel === 'footed-pilsner', 'vessel'], [/\bsnifter\b/, f => f.vessel === 'snifter', 'vessel'],
    [/\bflute\b/, f => f.vessel === 'flute', 'vessel'], [/\bcopper mug\b/, f => f.vessel === 'copper-mug', 'vessel'], [/\btin( cup| mug)?\b/, f => ['enamel-tin', 'julep-cup'].includes(f.vessel), 'vessel'],
    [/\b(k[uū]|tiki) mug\b/, f => f.vessel === 'ku-mug', 'vessel'], [/\bmoai\b/, f => f.vessel === 'moai-mug', 'vessel'], [/\bskull\b/, f => f.vessel === 'skull-mug', 'vessel'], [/\bbarrel\b/, f => f.vessel === 'barrel-mug', 'vessel'],
    [/\bbird[- ](mug|ceramic|shaped)\b/, f => f.vessel === 'bird-mug', 'vessel'], [/\b(warmed |toddy )?mug\b/, f => /mug|tin/.test(f.vessel), 'vessel'], [/\bbowl\b/, f => f.bowl, 'vessel'],
    [/\bunbreakable|acrylic|plastic|mason jar|teacup|punch cup|jar\b/, () => false, 'vessel'], [/\bpitcher|by the jug|batch(able|ed)?\b/, f => f.servings > 1, 'vessel'],
    // Garnish.
    [/\b(tiare|gardenia)\b/, GAR(/tiare|gardenia/), 'garnish'], [/\borchids?\b/, GAR(/orchid/), 'garnish'], [/\b(umbrellas?|parasols?)\b/, GAR(/umbrella|parasol/), 'garnish'],
    [/\b(spent )?lime shell|island and palm\b/, GAR(/shell/), 'garnish'], [/\bcinnamon stick\b/, GAR(/cinnamon stick/), 'garnish'], [/\b(lei|leis|plumeria|frangipani|pīkake|pikake|flowers?|blossoms?|petals?)\b/, GAR(/orchid|gardenia|flower|hibiscus|blossom|petal|plumeria/), 'garnish'],
    [/\b(fronds?|pineapple wedge)\b/, GAR(/frond|pineapple/), 'garnish'], [/\bswizzle stick|bois l[ée]l[ée]\b/, f => /swizzle stick|bois/.test(f.gtext) || f.swizzled, 'garnish'], [/\bback-?scratcher\b/, GAR(/scratcher/), 'garnish'],
    [/\bgold[- ](leaf|foil|flake)/, GAR(/gold/), 'garnish'], [/\bstraws?\b/, GAR(/straw/), 'garnish'], [/\b(sugar|salt) rim|\bon the rim\b|\brimmed\b/, GAR(/rim/), 'garnish'],
    [/\btwist|peel\b/, GAR(/twist|peel/), 'garnish'],
    // Technique and service.
    [/\bfloat(s|ed|ing)?\b/, f => f.float || /float/.test(f.gtext), 'technique'], [/\bsink(s|ing)?\b|\bsunk\b/, f => f.sink, 'technique'], [/\blayer(s|ed)?\b|\bbands?\b|\bgradient\b|\bpousse/, f => f.layered, 'technique'],
    [/\bflash[- ]blend/, f => f.method === 'flash-blend', 'technique'], [/\b(blend(ed|er)?|frozen|slush(y)?|frapp[ée]|sorbet|spoonable)\b/, f => f.frozen, 'technique'],
    [/\bstirred\b|\bstir(red)? down\b/, f => f.stirred, 'technique'], [/\bswizzl(e|ed|ing)\b/, f => f.swizzled, 'technique'], [/\bshaken\b|\bhard shake\b/, f => ['shake', 'flash-blend', 'blend'].includes(f.method), 'technique'],
    [/\b(flam(e|es|ed|ing|b[ée])|fire|fiery|ablaze|set alight|lit)\b/, f => f.flaming, 'technique'], [/\bmuddl/, f => f.lines.some(l => l.muddled), 'technique'],
    [/\b(hot|steaming|boiling|warm(ed|ing|th)?|served warm)\b/, f => f.hot, 'technique'], [/\bcrushed ice\b/, f => ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(f.ice), 'technique'],
    [/\bshaved ice\b/, f => f.ice === 'shaved', 'technique'], [/\bice cone\b/, f => f.ice === 'ice-cone', 'technique'], [/\b(big|large|one|single|clear) (rock|cube|block)\b|\bon the rocks\b|\bclear ice\b/, f => ['block', 'cubed'].includes(f.ice), 'technique'],
    [/\bserved up\b|\bup in a\b/, f => f.up, 'technique'], [/\bfoam|frothy|froth\b/, f => f.foam, 'technique'], [/\btall|long\b/, f => f.finalOz >= 7, 'technique'],
    // Strength, sweetness and texture.
    [/\b(zero[- ]proof|non-?alcoholic|without spirits|no alcohol|spirit-free|alcohol-free)\b/, f => f.abv <= 0.5, 'style'],
    [/\b(strong|potent|high-octane|heavyweight|stronger|more strength|boozy|serious)\b/, f => f.sd >= 1.8 || f.abv >= 15, 'style'],
    [/\b(low[- ]proof|low in alcohol|low[- ]abv|lower proof|sessionable|gentle|moderate( strength| proof)?|not too strong|light in alcohol|easy)\b/, f => f.sd < 2 && f.abv <= 13 && f.abv > 0.5, 'style'],
    [/\b(not a sugar bomb|not too sweet|no sugar|little or no( added)? sugar|dry|drier|restraint)\b/, f => f.sugar <= 8.5 && !(f.ratio > 16), 'style'],
    [/\b(tart|sharp|bracing|sour|sweet-tart|bright acid|zesty)\b/, f => f.acid >= 0.6, 'style'], [/\b(sweet|sweeter|sticky|sugar)\b/, f => f.sugar >= 7, 'style'],
    [/\b(bitter|bittersweet|bitterness|amaro's)\b/, f => f.bitter, 'style'], [/\b(creamy|silky|velvet(y)?|milkshake|cream moustache|custard)\b/, f => f.creamy, 'style'],
    [/\b(fizzy|fizz|bubbly|bubbles|effervescent|sparkling|carbonated|topped with soda)\b/, f => f.fizzy, 'style'],
    [/\b(smok(e|y)|peat(y)?|charred)\b/, f => f.smoky, 'style'], [/\b(spice|spiced|spicy|baking spice)\b/, f => f.spiced, 'style'],
    [/\b(funk|funky|hogo|high-ester)\b/, f => f.has(...JAM, 'batavia-arrack', 'rum-cachaca', 'rum-agricole-blanc'), 'style'],
    [/\b(floral|perfumed|fragrant)\b/, f => f.leads.has('floral') || /orchid|gardenia|flower|hibiscus/.test(f.gtext), 'style'],
    [/\bherbal|herbs\b/, f => f.has('green-chartreuse', 'yellow-chartreuse', 'benedictine', 'galliano', 'aquavit', 'amaro', 'gin', 'absinthe', 'pastis', 'basil') || f.lines.some(l => l.muddled && l.id === 'mint'), 'style'],
    [/\btropical fruit|tropical\b/, f => f.has('pineapple-juice', 'passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'mango-nectar', 'guava-nectar', 'papaya-nectar', 'banana', 'banana-liqueur', 'fassionola', 'coconut-cream', 'lychee-syrup'), 'style'],
    [/\bnutty|nuttiness\b/, ANY('orgeat', 'amaretto', 'hazelnut-liqueur', 'amontillado-sherry', 'oloroso-sherry'), 'style'],
    // Colors.
    [/\b(red|crimson|ruby|scarlet|garnet|lava-red|jewel-red)\b/, f => f.shows('red'), 'color'], [/\b(pink|blush|rosy|rose-pink)\b/, f => f.shows('pink'), 'color'],
    [/\b(blue|turquoise|teal|aqua|azure|sea-green)\b/, f => f.shows('blue'), 'color'], [/\b(green|jade|emerald)\b/, f => f.shows('green'), 'color'],
    [/\b(purple|violet|lavender|indigo)\b/, f => f.shows('purple'), 'color'], [/\b(black|ink-dark|inky)\b/, f => f.shows('dark'), 'color'],
    // Ingredients, most specific first.
    [/\bcherry heering\b/, ANY('cherry-heering'), 'ingredient'], [/\bmaraschino\b/, ANY('maraschino'), 'ingredient'], [/\bamar[oi]\b/, ANY('amaro', 'cynar', 'fernet'), 'ingredient'],
    [/\bcampari\b/, ANY('campari'), 'ingredient'], [/\baperol\b/, ANY('aperol'), 'ingredient'], [/\b(red )?bitter aperitif|aperitivo\b/, ANY('campari', 'aperol'), 'ingredient'],
    [/\bchartreuse\b/, ANY('green-chartreuse', 'yellow-chartreuse'), 'ingredient'], [/\bb[ée]n[ée]dictine\b/, ANY('benedictine'), 'ingredient'], [/\bgalliano\b/, ANY('galliano'), 'ingredient'],
    [/\bdrambuie\b/, ANY('drambuie'), 'ingredient'], [/\blicor 43\b/, ANY('licor-43'), 'ingredient'], [/\bamaretto\b/, ANY('amaretto'), 'ingredient'],
    [/\b(kahl[uú]a|tia maria|coffee liqueur)\b/, ANY('coffee-liqueur'), 'ingredient'], [/\bcoffee\b/, ANY('coffee', 'coffee-liqueur'), 'ingredient'],
    [/\b(cr[èe]me de )?cacao|chocolate|mocha\b/, ANY('creme-de-cacao', 'white-creme-de-cacao', 'mole-bitters', 'hazelnut-liqueur'), 'ingredient'], [/\bcassis\b/, ANY('creme-de-cassis'), 'ingredient'],
    [/\belderflower|st-germain\b/, ANY('elderflower-liqueur'), 'ingredient'], [/\bblue cura[çc]ao\b/, ANY('blue-curacao'), 'ingredient'], [/\b(cura[çc]ao|cointreau|triple sec)\b/, ANY('orange-curacao', 'triple-sec', 'blue-curacao'), 'ingredient'],
    [/\bdon'?s mix\b/, ANY('dons-mix'), 'ingredient'], [/\bfalernum\b/, ANY('velvet-falernum', 'falernum-syrup'), 'ingredient'], [/\b(allspice|pimento)\b/, f => f.has('allspice-dram', 'dons-spices-2', 'tiki-bitters') || /allspice/.test(f.gtext), 'ingredient'],
    [/\borgeat|almond\b/, ANY('orgeat', 'amaretto', 'almond-extract'), 'ingredient'], [/\bhoney\b/, ANY('honey-syrup', 'gardenia-mix'), 'ingredient'], [/\bmaple\b/, ANY('maple-syrup'), 'ingredient'],
    [/\bvanilla\b/, f => f.has('vanilla-syrup', 'vanilla-extract', 'vanilla-ice-cream', 'dons-spices-2', 'licor-43', 'galliano') || f.leads.has('vanilla'), 'ingredient'],
    [/\bcinnamon\b/, f => f.has('cinnamon-syrup', 'dons-mix', 'cinnamon', 'gardenia-mix', 'hot-buttered-rum-batter', 'five-spice-syrup') || /cinnamon/.test(f.gtext), 'ingredient'],
    [/\bnutmeg\b/, f => /nutmeg/.test(f.gtext) || f.has('nutmeg'), 'ingredient'], [/\bcloves?\b/, f => f.has('clove', 'velvet-falernum', 'falernum-syrup', 'five-spice-syrup') || /clove/.test(f.gtext), 'ingredient'],
    [/\bginger beer\b/, ANY('ginger-beer'), 'ingredient'], [/\bginger ale\b/, ANY('ginger-ale'), 'ingredient'], [/\bginger\b/, ANY('ginger-beer', 'ginger-ale', 'ginger-syrup', 'ginger-liqueur', 'ginger-fresh'), 'ingredient'],
    [/\btonic\b/, ANY('tonic'), 'ingredient'], [/\bcola\b/, ANY('cola'), 'ingredient'], [/\b(chiles?|chilis?|chili heat|ancho|jalape[ñn]o)\b/, ANY('ancho-reyes', 'jalapeno', 'mole-bitters'), 'ingredient'],
    [/\bfive-spice\b/, ANY('five-spice-syrup'), 'ingredient'], [/\bli hing mui\b/, ANY('li-hing-mui-syrup'), 'ingredient'], [/\bhibiscus\b/, f => f.has('hibiscus-syrup') || /hibiscus/.test(f.gtext), 'ingredient'],
    [/\bgrenadine\b/, ANY('grenadine'), 'ingredient'], [/\bpomegranate\b/, ANY('pomegranate-juice', 'grenadine'), 'ingredient'], [/\bcranberr(y|ies)\b/, ANY('cranberry-juice'), 'ingredient'],
    [/\bstrawberr(y|ies)\b/, ANY('strawberry'), 'ingredient'], [/\braspberr(y|ies)\b/, ANY('raspberry-syrup', 'raspberry-liqueur'), 'ingredient'], [/\b(blackberr(y|ies)|bramble)\b/, ANY('blackberry-liqueur'), 'ingredient'],
    [/\bberr(y|ies)\b|ʻōhelo|ohelo\b/, f => f.leads.has('berry') || /berr/.test(f.gtext), 'ingredient'], [/\bbananas?\b/, ANY('banana', 'banana-liqueur'), 'ingredient'],
    [/\bpineapple\b/, ANY('pineapple-juice', 'pineapple-syrup', 'rum-pineapple'), 'ingredient'], [/\b(passion ?fruit|passion-fruit|maracuj[áa]|lilikoʻ?i|lilikoi|parcha|chinola)\b/, ANY('passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola'), 'ingredient'],
    [/\bfassionola\b/, ANY('fassionola'), 'ingredient'], [/\bguava\b/, ANY('guava-nectar', 'guava-syrup'), 'ingredient'], [/\bmango\b/, ANY('mango-nectar'), 'ingredient'], [/\bpapaya\b/, ANY('papaya-nectar'), 'ingredient'],
    [/\blychee\b/, ANY('lychee-syrup', 'lychee-liqueur'), 'ingredient'], [/\b(water)?melon|midori\b/, ANY('melon-liqueur', 'watermelon-juice'), 'ingredient'], [/\bapricot\b/, ANY('apricot-liqueur', 'apricot-nectar'), 'ingredient'],
    [/\bpeach\b/, ANY('peach-liqueur'), 'ingredient'], [/\bapples?\b/, ANY('apple-juice', 'applejack'), 'ingredient'], [/\b(dragon fruit|pitaya)\b/, ANY('pitaya-puree'), 'ingredient'], [/\byuzu\b/, ANY('yuzu-juice'), 'ingredient'],
    [/\blimes?\b/, ANY('lime', 'lime-cordial'), 'ingredient'], [/\blemons?\b/, f => f.has('lemon') || /lemon/.test(f.gtext), 'ingredient'], [/\bgrapefruit\b/, ANY('grapefruit', 'dons-mix', 'grapefruit-soda'), 'ingredient'],
    [/\borange juice|\boj\b/, ANY('orange'), 'ingredient'], [/\boranges?\b/, f => f.has('orange', 'orange-curacao', 'triple-sec', 'blue-curacao', 'orange-bitters', 'aperol') || /orange/.test(f.gtext) || f.shows('orange'), 'ingredient'],
    [/\bcoconut water\b/, ANY('coconut-water'), 'ingredient'], [/\bcream of coconut|coco l[óo]pez|coconut cream\b/, ANY('coconut-cream', 'coconut-milk'), 'ingredient'],
    [/\bcoconut\b/, f => f.has('coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water') || f.vessel === 'coconut', 'ingredient'], [/\bice cream\b/, ANY('vanilla-ice-cream'), 'ingredient'],
    [/\bcream\b/, ANY('heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream', 'coconut-cream', 'coconut-milk'), 'ingredient'], [/\bmilk\b/, ANY('whole-milk', 'half-and-half', 'coconut-milk'), 'ingredient'],
    [/\beggs?\b|egg white\b/, ANY('egg-white', 'egg-whole', 'tom-and-jerry-batter'), 'ingredient'], [/\b(butter|batter)\b/, ANY('butter', 'hot-buttered-rum-batter', 'gardenia-mix', 'tom-and-jerry-batter'), 'ingredient'],
    [/\b(brown sugar|demerara syrup|dark sugar|caramelized sugar)\b/, ANY('demerara-syrup', 'hot-buttered-rum-batter', 'maple-syrup'), 'ingredient'], [/\b(salt|saline|salted)\b/, f => f.has('saline', 'li-hing-mui-syrup') || /salt/.test(f.gtext), 'ingredient'],
    [/\bmint\b/, f => f.has('mint') || /mint/.test(f.gtext), 'ingredient'], [/\bbasil\b/, f => f.has('basil') || /basil/.test(f.gtext), 'ingredient'], [/\bcucumber\b/, f => f.has('cucumber') || /cucumber/.test(f.gtext), 'ingredient'],
    [/\blapsang\b/, ANY('lapsang-tea'), 'ingredient'], [/\bbutterfly[- ]pea\b/, ANY('butterfly-pea-tea'), 'ingredient'], [/\b(black |strong |cold |iced )?tea\b/, ANY('black-tea', 'lapsang-tea', 'butterfly-pea-tea'), 'ingredient'],
    [/\b(soda|soda water|club soda)\b/, ANY('soda-water', 'grapefruit-soda', 'lemon-lime-soda'), 'ingredient'], [/\b(sparkling wine|champagne|prosecco|cava)\b/, ANY('sparkling-wine'), 'ingredient'],
    [/\b(white )?wine\b/, ANY('white-wine', 'sparkling-wine'), 'ingredient'], [/\bsherry\b/, ANY('amontillado-sherry', 'px-sherry', 'cream-sherry', 'oloroso-sherry'), 'ingredient'], [/\bvermouth\b/, ANY('sweet-vermouth', 'dry-vermouth'), 'ingredient'],
    [/\blillet|quinquina\b/, ANY('lillet-blanc'), 'ingredient'], [/\bsake\b/, ANY('sake'), 'ingredient'], [/\bangostura\b/, ANY('angostura'), 'ingredient'], [/\bbitters\b/, f => [...f.ids].some(id => ing(id).cat === 'bitters'), 'ingredient'],
    [/\b(pernod|absinthe|pastis|herbsaint|anise)\b/, ANY('absinthe', 'pastis', 'galliano', 'aquavit'), 'ingredient'],
    [/\bmezcal\b/, ANY('mezcal'), 'ingredient'], [/\btequila\b/, ANY('tequila-blanco', 'tequila-reposado'), 'ingredient'], [/\bpisco\b/, ANY('pisco'), 'ingredient'], [/\bgin\b/, ANY('gin', 'gin-old-tom'), 'ingredient'],
    [/\bvodka\b/, ANY('vodka'), 'ingredient'], [/\bbourbon\b/, ANY('bourbon'), 'ingredient'], [/\brye\b/, ANY('rye'), 'ingredient'], [/\bjapanese whisky\b/, ANY('japanese-whisky'), 'ingredient'],
    [/\b(scotch|whisky|whiskey)\b/, ANY('scotch-blended', 'scotch-islay', 'irish-whiskey', 'japanese-whisky', 'bourbon', 'rye'), 'ingredient'], [/\b(islay|peat)\b/, ANY('scotch-islay'), 'ingredient'],
    [/\b(brandy|cognac)\b/, ANY('brandy', 'applejack'), 'ingredient'], [/\baquavit\b/, ANY('aquavit'), 'ingredient'], [/\barrack\b/, ANY('batavia-arrack'), 'ingredient'], [/\bokolehao\b/, ANY('okolehao'), 'ingredient'],
    [/\bcacha[çc]a\b/, ANY('rum-cachaca'), 'ingredient'], [/\b((rhum )?agricole|rhum)\b/, ANY('rum-agricole-blanc', 'rum-agricole-vieux'), 'ingredient'],
    [/\b(151|overproof|navy[- ]strength)\b/, ANY(...OVERPROOF, 'rum-navy'), 'ingredient'], [/\bdemerara\b/, ANY('rum-demerara', 'rum-demerara-overproof'), 'ingredient'],
    [/\b(jamaican rum|jamaican|pot[- ]still|hampden|worthy park|appleton|wray|smith (&|and) cross)\b/, ANY(...JAM), 'ingredient'], [/\b(navy rum|pusser'?s)\b/, ANY('rum-navy', 'rum-demerara', 'rum-black-blended'), 'ingredient'],
    [/\b(black rum|blackstrap|gosling'?s|black seal)\b/, ANY('rum-black-blended', 'rum-black-overproof'), 'ingredient'], [/\bdark (jamaican )?rums?\b/, ANY(...DARK), 'ingredient'],
    [/\b(aged|older|better) rums?\b|\baged blend\b/, ANY(...AGED), 'ingredient'], [/\b(light|white|clear) rums?\b/, ANY(...WHITE), 'ingredient'], [/\bgold rum\b/, ANY('rum-gold-column'), 'ingredient'],
    [/\b(barbados|bajan) rum\b/, ANY('rum-barbados'), 'ingredient'], [/\bhaitian\b|barbancourt\b/, ANY('rum-haitian'), 'ingredient'], [/\bspiced rum\b/, ANY('rum-spiced'), 'ingredient'],
    [/\b(three|two|multiple) rums|rum blend|split base\b/, f => f.rums >= 2, 'ingredient'], [/\brums?\b/, ANY(...RUMS), 'ingredient'],
    // Gold last (after "gold rum").
    [/\b(gold|golden)\b/, f => f.shows('gold') || f.shows('orange'), 'color'],
  ];
  // Era words: a decade or year in a line must match the drink's documented date.
  const ERA = [
    [/\b(1[5-9]\d\d|20[0-2]\d)s\b/, m => [Number(m[1]), Number(m[1]) + 9]], [/\b(1[5-9]\d\d|20[0-2]\d)\b/, m => [Number(m[1]) - 1, Number(m[1]) + 1]],
    [/'(\d\d)\b/, m => [1900 + Number(m[1]) - 1, 1900 + Number(m[1]) + 1]], [/\b(twenties)\b/, () => [1920, 1929]], [/\b(thirties)\b/, () => [1930, 1939]], [/\b(forties)\b/, () => [1940, 1949]],
    [/\b(fifties)\b/, () => [1950, 1959]], [/\b(sixties)\b/, () => [1960, 1969]], [/\b(seventies)\b/, () => [1970, 1979]], [/\b(eighties)\b/, () => [1980, 1989]],
    [/\bjet age\b/, () => [1950, 1969]], [/\bmid-century\b/, () => [1940, 1969]], [/\b(gaslight|victorian)\b/, () => [1837, 1901]], [/\bprohibition\b/, () => [1920, 1933]],
  ];
  // People: a line that names the hand behind a drink needs the drink to be theirs.
  const PEOPLE = [
    [/\bconstante|ribalaigua\b/, f => (/Ribalaigua/.test((f.origin || {}).who || '') || /Ribalaigua/.test((f.origin || {}).text || '')) && !(Number((f.prayer.match(/\b(1[89]\d\d|20\d\d)\b/) || [])[1]) > 1952)],
    [/\b(donn|don)(?!'t)\b|\bbeachcomber\b/, f => (f.origin || {}).house === 'don'], [/\b(trader )?vic\b/, f => (f.origin || {}).house === 'vic'],
    [/\bscialom\b/, f => /Scialom/.test((f.origin || {}).text || '')], [/\bharry yee\b/, f => /Harry Yee/.test((f.origin || {}).text || '')],
    [/\b(papa|hemingway)\b/, f => f.archetype === 'hemingway-daiquiri'],
  ];
  // Every promise in a line of prose, each with its test. `kind` says what sort of promise.
  function claimsIn(text) {
    let s = ` ${String(text || '').toLowerCase().replace(/[’]/g, "'")} `;
    const out = [];
    for (const [re, test, kind] of C) {
      const g = new RegExp(re.source, 'g');
      s = s.replace(g, m => { out.push({ phrase: m.trim(), test, kind }); return ' '.repeat(m.length); });
    }
    for (const [re, range] of ERA) {
      const m = re.exec(s);
      if (m) { const [lo, hi] = range(m); out.push({ phrase: m[0], kind: 'era', test: f => { const y = (f.origin || {}).year; return !!y && y >= lo && y <= hi; } }); s = s.replace(m[0], ' '); }
    }
    for (const [re, test] of PEOPLE) if (re.test(s)) out.push({ phrase: (s.match(re) || [''])[0], kind: 'person', test });
    return out;
  }
  const keeps = (text, f) => claimsIn(text).every(c => c.test(f));

  // A tagline mood is said only if it is true of the drink, of its time of day, of its culture.
  // Sacred words and greetings ("aloha", "mahalo") are no menu decoration, even on a Hawaiian prayer.
  const SACRED = /\b(aloha|mahalo|pele|kahuna|mana|kapu|wahine|savage|native|idol|tiki gods?)\b/i;
  function moodOk(m, f) {
    if (!m || SACRED.test(m) || !cultureOk(m, f.polynesian) || !timeOk(m, f.prayer)) return false;
    return keeps(m, f);
  }

  // ---------------------------------------------------------------------------------------
  // How the gods heard a phrase. History in the research reading (sentences that tell what
  // happened, and promise nothing about this drink) is kept; the rest is said back only if the
  // drink keeps every promise in it. Otherwise the Shrine says what was actually poured for it.
  const HISTORY = /\b(1[5-9]\d\d|20[0-2]\d)\b|\b(was|were|gave|said|began|created|invented|named for|named after|credited|born|opened|predates|fed|coined|became|printed|published|decoded|drank|introduced|populari[sz]ed|shot partly|traced|ran out|beached|carried|took)\b/i;
  // Sentences end at . or ? before a capital, an opening parenthesis or a quote, so "St. Thomas",
  // "c. 1934", "J. Galsini", "1.2 times" and "Girls! Girls! Girls!" stay whole.
  const SENTENCE_BREAK = /(?<=[.?]["')\]]*)(?<!\b(?:St|Mt|Mr|Mrs|Dr|Jr|Sr|c|ca|vs|No|[A-Z])\.)\s+(?=[A-Z("'ʻ‘“])/;
  const sentencesOf = text => String(text || '').split(SENTENCE_BREAK).map(x => x.trim()).filter(Boolean);
  // A short label the parser heard ("less sweet", "strawberry", "served in: coconut") is said
  // back only if the drink bears it out; otherwise the card admits it.
  function heardLabel(label, f) {
    const l = String(label || '');
    if (/^(less|no) sweet(ness)?$|^not too sweet$|^drier$/.test(l)) return keeps('not too sweet', f) ? l : `${l}: heard, but this one still drinks on the sweet side`;
    if (/^(no|not|less|without) /.test(l) || /^riff on |family$|^\d+ rums?$/.test(l)) return l;
    const what = l.replace(/^served in: /, '');
    const cl = claimsIn(what).filter(c => !['era', 'person'].includes(c.kind));
    return cl.length && !cl.every(c => c.test(f)) ? `${l}: heard, but the rest of the prayer steered this drink` : l;
  }
  const DEIXIS = /\b(there|it|its|they|their|them|he|she|his|her|this|these|those)\b/i;
  function hear(reading, concept, f) {
    const sentences = sentencesOf(reading);
    const history = [];
    let broken = false, prevKept = true;
    for (const s0 of sentences) {
      const s = s0.trim();
      const cl = claimsIn(s);
      // A history sentence may name drinks, people and years; anything else in it is a promise.
      const promises = cl.filter(c => !['drink', 'person', 'era'].includes(c.kind) || !HISTORY.test(s));
      if (HISTORY.test(s) && !promises.length) {
        // "They drank there" needs the sentence before it; without it the history goes unsaid.
        prevKept = prevKept || !DEIXIS.test(s);
        if (prevKept) history.push(s);
        continue;
      }
      const ok = !cl.length || cl.every(c => c.test(f));
      if (!ok) broken = true;
      prevKept = ok;
    }
    if (!broken && sentences.length) return polish(reading);
    const said = sayBack(concept, f);
    const lead = history.slice(0, 2).join(' ');
    if (!lead) return polish(said);
    return polish(/^heard\b/.test(said) ? lead : `${lead} Here, ${said}.`);
  }

  // What a concept actually changed in this drink, said in plain words: "bittersweet: an amaro
  // edge, black rum and lime". Only what was poured, served or shown.
  const EDGE = new Set(['campari', 'aperol', 'amaro', 'cynar', 'fernet']);
  const partWord = (id, l) => (EDGE.has(id) ? `${an(say(id))} ${say(id)} edge` : l && l.float ? `${an(say(id))} ${say(id)} float` : l && l.sink ? `${say(id)} sunk to the bottom` : ing(id).role === 'sour' ? `fresh ${say(id)}` : say(id));
  const TAG_GIST = { smoky: f => f.smoky && 'smoky', funky: f => f.has(...JAM, 'batavia-arrack') && 'funky', tropical: f => keeps('tropical', f) && 'tropical', floral: f => keeps('floral', f) && 'floral', 'baking-spice': f => f.spiced && 'spiced', cinnamon: f => keeps('cinnamon', f) && 'spiced', allspice: f => keeps('allspice', f) && 'spiced', chili: f => keeps('chile', f) && 'chile-warm', coffee: f => f.has('coffee', 'coffee-liqueur') && 'coffee-dark', chocolate: f => keeps('chocolate', f) && 'chocolate', oaky: f => f.leads.has('oaky') && 'aged', herbal: f => keeps('herbal', f) && 'herbal', mint: f => keeps('mint', f) && 'minty', coconut: f => keeps('coconut', f) && 'coconut', honey: f => keeps('honey', f) && 'honeyed', vanilla: f => keeps('vanilla', f) && 'vanilla', banana: f => keeps('banana', f) && 'banana', bitter: f => f.bitter && 'bittersweet', tart: f => f.acid >= 0.8 && 'tart', creamy: f => f.creamy && 'creamy', effervescent: f => f.fizzy && 'fizzy' };
  const COLOR_GIST = { red: 'red', pink: 'pink', gold: 'golden', blue: 'blue', green: 'green', purple: 'violet', dark: 'dark', orange: 'orange' };
  function sayBack(concept, f) {
    const c = concept || {};
    const st = c.style || {};
    const gist = [];
    const STYLE_GIST = [['hot', f.hot, 'hot'], ['frozen', f.frozen, 'frozen'], ['bitter', f.bitter, 'bittersweet'], ['creamy', f.creamy, 'creamy'], ['bowl', f.bowl && f.servings > 1, 'made to share'],
      ['zeroProof', f.abv <= 0.5, 'zero-proof'], ['layered', f.layered, 'layered'], ['flaming', f.flaming, 'lit at the table'], ['stirred', f.stirred, 'stirred'], ['long', f.finalOz >= 7 && f.fizzy, 'long and fizzy']];
    for (const [k, ok, w] of STYLE_GIST) if (st[k] === true && ok) gist.push(w);
    if ((st.strength || 0) >= 0.8 && f.sd >= 2) gist.push('strong');
    if ((st.strength || 0) <= -0.8 && f.sd < 1.6 && f.abv > 0.5) gist.push('gentle');
    if ((st.sweetness || 0) <= -0.4 && f.sugar <= 8.5 && !(f.ratio > 16)) gist.push('not too sweet');
    if ((st.tartness || 0) >= 0.4 && f.acid >= 0.8) gist.push('tart');
    for (const [t, w] of Object.entries(c.tags || {}).sort((a, b) => b[1] - a[1])) if (w >= 0.8 && TAG_GIST[t]) { const g = TAG_GIST[t](f); if (g) gist.push(g); }
    if (c.color && COLOR_GIST[c.color] && f.shows(c.color)) gist.push(COLOR_GIST[c.color]);
    const g1 = [...new Set(gist)][0] || '';
    // What it poured: first what carries the gist ("strong: Demerara 151"), then the bottles
    // carrying its flavors, then its own bottles, heaviest leaning first.
    const parts = [];
    const lineOf = id => f.lines.find(l => l.id === id);
    const big = l => (l.oz || 0) >= 0.15 || l.muddled;
    const byOz = ls => [...ls].sort((a, b) => (b.oz || 0) - (a.oz || 0));
    const GIST_CARRIER = {
      strong: l => ing(l.id).role === 'base' && !l.float, bittersweet: l => BITTER.includes(l.id), creamy: l => CREAMS.includes(l.id), fizzy: l => FIZZ.includes(l.id),
      'long and fizzy': l => FIZZ.includes(l.id), smoky: l => SMOKY.includes(l.id), spiced: l => SPICE.includes(l.id) && ing(l.id).cat !== 'bitters', funky: l => JAM.includes(l.id) || l.id === 'batavia-arrack',
      tart: l => ing(l.id).role === 'sour', layered: l => l.float || l.sink,
    };
    const tagOf = { minty: 'mint', honeyed: 'honey', 'chile-warm': 'chili', 'coffee-dark': 'coffee', aged: 'oaky' };
    const carries = GIST_CARRIER[g1] || (g1 && (l => leadOf(l.id) === (tagOf[g1] || g1)));
    // "Strong" is carried by the hottest bottle (the Demerara 151), not the biggest pour.
    const order = g1 === 'strong' ? ls => [...ls].sort((a, b) => (ing(b.id).abv || 0) - (ing(a.id).abv || 0) || (b.oz || 0) - (a.oz || 0)) : byOz;
    if (carries) for (const l of order(f.lines.filter(l => big(l) && carries(l) && !PLAIN.has(l.id))).slice(0, 2)) parts.push(partWord(l.id, l));
    for (const [t, w] of Object.entries(c.tags || {}).sort((a, b) => b[1] - a[1])) {
      if (w < 0.8 || STRUCTURAL.has(t)) continue;
      const carrier = f.lines.find(l => leadOf(l.id) === t && big(l) && ing(l.id).cat !== 'bitters' && !PLAIN.has(l.id));
      if (carrier) parts.push(partWord(carrier.id, carrier));
    }
    for (const [id] of Object.entries(c.ings || {}).filter(([, w]) => w >= 0.4).sort((a, b) => b[1] - a[1])) if (f.ids.has(id) && !PLAIN.has(id)) parts.push(partWord(id, lineOf(id)));
    const special = f.vessel && !['rocks', 'dof', 'highball', 'collins', 'coupe', 'cocktail-glass'].includes(f.vessel) && (c.vessels || {})[f.vessel] >= 1;
    const where = special ? `, in ${an(f.vesselName)} ${f.vesselName}` : '';
    const uniq = [...new Set(parts)].slice(0, 3);
    // A technique is not carried by a bottle: "frozen, with fresh lime", not "frozen: fresh lime".
    const TECHNIQUE = new Set(['hot', 'frozen', 'stirred', 'made to share', 'lit at the table', 'zero-proof', 'gentle', 'not too sweet']);
    if (g1 && uniq.length && TECHNIQUE.has(g1)) return `${g1}, with ${list(uniq)}${where}`;
    if (g1 && uniq.length && !uniq.some(p => p.includes(g1))) return `${g1}: ${list(uniq)}${where}`;
    if (uniq.length) return `answered with ${list(uniq)}${where}`;
    if (g1) return `${g1}${where}`;
    if (where) return `served${where}`;
    return 'heard, though the rest of the prayer steered this drink';
  }

  // ---------------------------------------------------------------------------------------
  // The tasting note, in the order a drinker meets it: the nose (an aroma garnish or a float),
  // the palate (the prayer's hero first, then the citrus and fruit up front, the spirit's voice
  // in the middle, the modifiers named by what they are), the finish (spice, bitters, anise:
  // only poured carriers), then texture, balance and strength.
  const NOSE = { mint: 'Fresh mint on the nose', nutmeg: 'Fresh nutmeg on the nose', cinnamon: 'A whiff of cinnamon stick', 'orange peel': 'Orange oil on the nose', lemon: 'Lemon oil on the nose' };
  const FINISH_IDS = { angostura: 'Angostura spice', 'tiki-bitters': 'bitter spice', 'orange-bitters': 'bitter orange', absinthe: 'a whisper of anise', pastis: 'a whisper of anise', 'allspice-dram': 'allspice', 'velvet-falernum': 'falernum spice', 'falernum-syrup': 'falernum spice', 'cinnamon-syrup': 'cinnamon', 'ginger-syrup': 'ginger heat', campari: 'Campari bitterness', aperol: 'gentle orange bitterness', amaro: 'herbal bitterness', 'ancho-reyes': 'a slow chile burn', 'dons-mix': 'cinnamon', 'five-spice-syrup': 'five-spice', 'mole-bitters': 'chocolate bitterness' };
  function tastingNote({ lines, stats, archetype, look, method, ice, garnish = [], intent = {}, house = null, perGuest = false }) {
    const poured = lines.filter(isPoured);
    const floats = poured.filter(l => l.float);
    const bits = [];
    // Nose: only what is in the garnish (or floated on top).
    const g = garnish.join(' ').toLowerCase();
    const nose = /mint/.test(g) ? NOSE.mint : /nutmeg/.test(g) ? NOSE.nutmeg : /cinnamon/.test(g) ? NOSE.cinnamon : /orange (peel|twist)|expressed/.test(g) ? NOSE['orange peel'] : /lemon (peel|twist)/.test(g) ? NOSE.lemon : '';
    if (floats.length) bits.push(`The ${list(floats.map(l => say(l.id)))} float meets you first`);
    else if (nose) bits.push(nose);
    // The prayer's hero: an asked bottle or the carrier of an asked flavor leads the palate.
    const askedTags = Object.entries(intent.tags || {}).filter(([t, w]) => w - ((intent.conceptTags || {})[t] || 0) >= 1 && !STRUCTURAL.has(t) && t !== 'bitter').map(([t]) => t);
    const hero = poured.filter(l => !l.float && ing(l.id).role !== 'base' && ing(l.id).cat !== 'bitters' && ((intent.ings || {})[l.id] >= 1 || askedTags.includes(leadOf(l.id))) && ((l.oz || 0) >= 0.2 || l.muddled));
    const heroWords = [...new Set(hero.map(l => MENU[l.id] || say(l.id)))];
    const citrusFruit = poured.filter(l => ['sour', 'juice'].includes(ing(l.id).role) && !floats.includes(l) && ((l.oz || 0) >= 0.25 || l.muddled)).sort((a, b) => b.oz - a.oz).map(l => MENU[l.id] || say(l.id));
    const front = [...new Set([...heroWords, ...citrusFruit])].slice(0, Math.max(2, heroWords.length + (citrusFruit.some(w => !heroWords.includes(w)) ? 1 : 0)));
    const bases = poured.filter(l => ing(l.id).role === 'base' && !l.float && (l.oz || 0) >= 0.4).sort((a, b) => b.oz - a.oz);
    const voices = bases.slice(0, 2).map(b => SPIRIT_VOICE[b.id] || say(b.id));
    const mids = [...new Set(poured.filter(l => ['sweet', 'modifier', 'rich'].includes(ing(l.id).role) && !FINISH_IDS[l.id] && ((l.oz || 0) >= 0.2 || (ing(l.id).cat === 'liqueur' && (l.oz || 0) >= 0.16)) && !PLAIN.has(l.id)).sort((a, b) => b.oz - a.oz).map(l => MENU[l.id] || say(l.id)))].filter((w, i, a) => !front.includes(w) && !a.some(x => x !== w && x.endsWith(` ${w}`))).slice(0, 2);
    const finish = [...new Set(poured.filter(l => FINISH_IDS[l.id]).sort((a, b) => b.oz - a.oz).map(l => FINISH_IDS[l.id]))].slice(0, 2);
    const palate = [];
    if (front.length) palate.push(`${list(front)} up front`);
    if (voices.length) palate.push(`${list(voices)} ${voices.length > 1 ? 'carry' : 'carries'} the middle${mids.length ? ` with ${list(mids)}` : ''}`);
    else if (mids.length) palate.push(`${list(mids)} in the middle`);
    if (palate.length) bits.push(palate.join(', then '));
    if (finish.length) bits.push(`it finishes on ${list(finish)}`);
    let s = bits.length ? `${cap(bits.join('; '))}.` : '';
    const texture = textureLine(poured, method, ice);
    if (texture) s += ` ${texture}`;
    s += ` ${balanceLine(stats, archetype, poured, intent)} ${strengthCopy(stats, { method, house, archetypeId: archetype && archetype.id, perGuest }).tasting}`;
    return polish(s.replace(/\s+/g, ' ').trim());
  }

  function textureLine(lines, method, ice) {
    const at = (ids, min = 0.5) => lines.filter(l => ids.includes(l.id) && (l.oz || 0) >= min);
    if (method === 'blend' || ice === 'blended') return 'Thick and frosty, like a slushie for grown-ups.';
    const rich = [...new Set(at(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'whole-milk']).map(l => ({ 'coconut-cream': 'cream of coconut', 'coconut-milk': 'coconut milk', 'heavy-cream': 'cream', 'half-and-half': 'cream', 'vanilla-ice-cream': 'ice cream', 'whole-milk': 'milk' }[l.id])))];
    if (rich.length) return `Silky and rich from the ${list(rich)}.`;
    if (at(['soda-water', 'ginger-beer', 'ginger-ale', 'sparkling-wine', 'tonic', 'cola', 'grapefruit-soda', 'lemon-lime-soda'], 0.75).length) return 'Long and fizzy.';
    if (at(['egg-white', 'egg-whole'], 0.1).length) return 'Topped with a soft, silky foam.';
    if (method === 'stir') return 'Silky and spirit-forward, sipped slowly over one big cube.';
    if (method === 'swizzle') return 'Swizzled until the glass frosts.';
    if (method === 'hot') return 'Steaming and soothing.';
    return '';
  }

  // Sweet and sour from the measured sugar-to-acid ratio, read against the archetype's own
  // window, and in absolute terms: a colada with almost no acid is rich and round, not "in
  // balance"; a guest who asked for tart and got real acid is told so.
  function balanceLine(stats, archetype, lines, intent = {}) {
    const r = stats.sweetSour, acid = stats.acidConc || 0, sugar = stats.sugarConc || 0;
    const creamy = lines.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'tom-and-jerry-batter', 'whole-milk'].includes(l.id) && (l.oz || 0) >= 0.5);
    const buttery = lines.some(l => ['hot-buttered-rum-batter', 'butter', 'gardenia-mix', 'tom-and-jerry-batter'].includes(l.id));
    if (acid < 0.2 || r === null || r === undefined) return creamy || buttery ? 'Rich and round, barely tart.' : sugar > 6 ? 'Soft and round, with almost no sourness.' : 'Dry and spirit-forward.';
    if (creamy && acid < 0.4) return 'Rich and round, barely tart.';
    const band = archetype && archetype.ratios && archetype.ratios.sugarToAcid;
    const lo = band ? band[0] : 7, hi = band ? band[1] : 14;
    const askedTart = (intent.tartness || 0) >= 0.5 || ((intent.tags || {}).tart || 0) >= 1;
    if (r < lo * 0.9 || acid >= 1.0 || (askedTart && acid >= 0.8)) return 'Tart and bracing.';
    if (r > hi * 1.1 || (acid < 0.4 && sugar > 8)) return acid < 0.4 ? 'On the sweet side, barely tart.' : 'On the sweet side, with just enough acid to stay bright.';
    const p = (r - lo) / Math.max(0.1, hi - lo);
    if (p < 0.2) return 'Balanced, leaning tart.';
    if (p > 0.8) return 'Balanced, leaning rich.';
    return 'Sweet and sour in balance.';
  }

  // ---------------------------------------------------------------------------------------
  // "A frosty colada with mango and lime, for a slow Sunday." Base spirits lend one adjective at
  // most, from their lead flavor (smoke only from mezcal, Islay or lapsang); the named flavors
  // come from what was added to the spirit, the ones the guest asked for first. Twelve words or
  // so: one image, one fact, at most one "with", never the classic's name twice.
  const BASE_ADJ = { smoky: 'smoky', funky: 'funky', grassy: 'grassy', molasses: 'dark', agave: 'agave-bright', juniper: 'piney', oaky: 'oak-aged' };
  const COLOR_WORD = { blue: 'blue', green: 'green', red: 'ruby-red', pink: 'pink', gold: 'golden', purple: 'violet', dark: 'dark', orange: 'orange', white: 'snow-white', clear: 'crystal-clear' };
  const NOUN_IMPLIES = {
    colada: ['pineapple', 'coconut', 'creamy'], 'mai tai': ['almond', 'orange', 'lime'], grog: ['lime', 'grapefruit', 'honey'], daiquiri: ['lime'],
    swizzle: ['lime', 'mint'], 'passion fruit': ['passion-fruit', 'lemon'], 'orgeat punch': ['almond', 'orange', 'lemon'], 'falernum': ['lime', 'clove', 'almond'],
    'beachcomber sour': ['lime', 'honey', 'allspice'], zombie: ['lime', 'grapefruit', 'cinnamon', 'anise'], 'ginger beer': ['ginger'], mule: ['ginger', 'lime'],
    mojito: ['mint', 'lime'], caipirinha: ['lime'], 'bitter tiki': ['bitter', 'pineapple'], 'old fashioned': [], negroni: ['bitter'], 'hot buttered rum': ['buttery', 'baking-spice'],
    painkiller: ['pineapple', 'coconut', 'orange', 'nutmeg'], hurricane: ['passion-fruit', 'lemon'], 'blue hawaii': ['pineapple'], 'scorpion': ['almond', 'orange'], sunrise: ['orange', 'pomegranate'],
  };
  // How a menu names a bottle in a tagline: the thing you taste, not the label.
  const MENU = {
    'pineapple-juice': 'pineapple', 'coconut-cream': 'coconut', 'coconut-milk': 'coconut', 'coconut-water': 'coconut water', 'coconut-rum': 'coconut',
    orange: 'orange', lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', 'passion-fruit-syrup': 'passion fruit', 'passion-fruit-juice': 'passion fruit',
    'passion-fruit-nectar': 'passion fruit', 'passion-fruit-liqueur': 'passion fruit', 'guava-nectar': 'guava', 'guava-syrup': 'guava', 'mango-nectar': 'mango',
    'papaya-nectar': 'papaya', banana: 'banana', strawberry: 'strawberry', 'banana-liqueur': 'banana', 'velvet-falernum': 'falernum', 'falernum-syrup': 'falernum', 'allspice-dram': 'allspice',
    'cinnamon-syrup': 'cinnamon', 'ginger-syrup': 'ginger', 'ginger-beer': 'ginger beer', 'ginger-liqueur': 'ginger', 'honey-syrup': 'honey', 'orgeat': 'orgeat',
    grenadine: 'grenadine', 'hibiscus-syrup': 'hibiscus', maraschino: 'maraschino', 'blue-curacao': 'blue curaçao', 'orange-curacao': 'curaçao', campari: 'Campari',
    aperol: 'Aperol', 'green-chartreuse': 'green Chartreuse', 'yellow-chartreuse': 'yellow Chartreuse', 'coffee-liqueur': 'coffee', coffee: 'coffee',
    'creme-de-cacao': 'chocolate', 'white-creme-de-cacao': 'chocolate', 'vanilla-syrup': 'vanilla', 'vanilla-ice-cream': 'vanilla ice cream', 'heavy-cream': 'cream', 'half-and-half': 'cream',
    'dons-mix': "Don's Mix", 'gardenia-mix': 'Gardenia Mix', 'hot-buttered-rum-batter': 'spiced butter', 'peach-liqueur': 'peach', 'apricot-liqueur': 'apricot',
    'cherry-heering': 'cherry', 'lychee-syrup': 'lychee', 'lychee-liqueur': 'lychee', 'melon-liqueur': 'melon', 'sparkling-wine': 'bubbles', 'soda-water': 'soda',
    'black-tea': 'black tea', 'li-hing-mui-syrup': 'li hing mui', 'five-spice-syrup': 'five-spice', 'yuzu-juice': 'yuzu', 'pomegranate-juice': 'pomegranate',
    'raspberry-syrup': 'raspberry', 'elderflower-liqueur': 'elderflower', absinthe: 'absinthe', pastis: 'anise', angostura: 'Angostura', mint: 'mint',
    mezcal: 'mezcal', 'scotch-islay': 'Islay Scotch', 'rum-jamaican-pot': 'Jamaican funk', 'rum-demerara-overproof': '151', 'rum-agricole-blanc': 'agricole',
    'rum-agricole-vieux': 'aged agricole', 'tequila-blanco': 'tequila', 'tequila-reposado': 'reposado', gin: 'gin', bourbon: 'bourbon', rye: 'rye', brandy: 'brandy',
    pisco: 'pisco', 'rum-cachaca': 'cachaça', 'batavia-arrack': 'arrack', aquavit: 'aquavit', 'japanese-whisky': 'Japanese whisky', tonic: 'tonic', 'sweet-vermouth': 'sweet vermouth',
    'tom-and-jerry-batter': 'egg batter', fassionola: 'fassionola', 'watermelon-juice': 'watermelon', 'cranberry-juice': 'cranberry', 'ancho-reyes': 'chile', 'pitaya-puree': 'dragon fruit',
  };
  // Voice adjectives a menu may lean on, each with what the drink must have to earn it.
  const VOICE = {
    clean: () => true, crisp: d => d.acid >= 0.5 && !d.creamy, bright: d => d.acid >= 0.6, bracing: d => d.acid >= 0.8,
    frosty: d => d.frozen || d.crushed, snowy: d => d.frozen, silky: d => d.creamy, velvet: d => d.creamy, plush: d => d.creamy, smooth: () => true,
    sunny: () => true, 'sun-drenched': () => true, breezy: d => d.gentle, lazy: d => d.gentle, easy: d => d.gentle, gentle: d => d.gentle, soothing: d => d.gentle,
    potent: d => d.abv >= 15, fierce: d => d.abv >= 17, spiced: d => d.spice, honeyed: d => d.has('honey-syrup', 'gardenia-mix'), minty: d => d.has('mint'),
    'nutmeg-dusted': d => d.nutmeg, steaming: d => d.hot, cozy: d => d.hot || d.creamy, slow: d => d.stirred || d.hot, contemplative: d => d.stirred,
    elegant: d => !d.long, polished: d => !d.long, decadent: d => d.creamy, indulgent: d => d.creamy, daring: () => true, audacious: () => true,
    bittersweet: d => d.bitter, wild: () => true, stormy: d => d.dark, restless: () => true, glowing: d => d.layered, swirling: d => d.layered, molten: d => d.layered && d.red,
    electric: d => d.blue, technicolor: d => d.layered, 'deceptively smooth': d => d.abv >= 15, 'sun-warmed': () => true, 'barefoot': d => d.gentle,
  };
  function voiceAdj(archetype, d, rng, prayer) {
    const ok = (archetype.taglineWords || []).map(w => String(w).toLowerCase()).filter(w => VOICE[w] && VOICE[w](d) && timeOk(w, prayer));
    return ok.length ? ok[Math.floor(rng() * ok.length)] : null;
  }
  // The type word must be true of the build; otherwise the honest family word.
  const TYPE_TRUTH = [
    [/\bmule\b/, d => d.has('ginger-beer'), d => (d.fizzy ? 'ginger highball' : 'ginger sour')],
    [/\bginger beer highball\b/, d => d.has('ginger-beer'), d => (d.fizzy ? 'highball' : 'rum sour')],
    [/\bsunrise\b/, d => d.sinkWarm && timeOk('sunrise', d.prayer), d => (TIME_WORDS.dusk.test(d.prayer) && d.layered ? 'sunset' : d.layered ? 'layered long drink' : 'long drink')],
    [/\bbowl\b/, d => d.bowl, d => (d.family === 'grog' ? 'grog' : 'orgeat punch')],
    [/\bswizzle\b/, d => d.swizzled, () => 'rum sour'],
    [/\bfrozen daiquiri\b|\bfrapp[ée]\b/, d => d.frozen, () => 'daiquiri'],
    [/\bhot buttered rum\b/, d => d.has('hot-buttered-rum-batter', 'butter', 'gardenia-mix'), () => 'hot rum'],
    [/\bTom and Jerry\b/, d => d.has('tom-and-jerry-batter'), () => 'hot punch'],
    [/\bcolada\b/, d => d.has('coconut-cream', 'coconut-milk') && d.has('pineapple-juice'), () => 'tropical punch'],
    [/\bPearl Diver-style punch\b/, d => d.has('gardenia-mix'), () => 'Beachcomber punch'],
    [/\bheavyweight\b/, d => d.sd >= 2.5, (d, w) => w.replace('heavyweight', /short/.test(w) ? 'sour' : 'punch')],
  ];
  function typeWordFor(archetype, d) {
    let w = archetype.noun || (archetype.name || 'tropical drink').toLowerCase();
    for (const [re, ok, alt] of TYPE_TRUTH) if (re.test(w) && !ok(d)) w = alt(d, w);
    return w;
  }

  // The tagline. `riffOf` names the drink this one riffs on; `cousin` replaces the type word when
  // the riff lost a defining bottle; `facts` (from drinkFacts) answers every truth check.
  function tagline({ lines, archetype, intent, riffOf, riffIds = null, look = null, stats = null, method = '', ice = '', garnish = [], rng = Math.random, facts = null, cousin = null }) {
    lines = lines.filter(l => l.muddled || (!l.garnish && (ingMap.get(l.id) || {}).role !== 'aromatic'));
    const prayer = (facts && facts.prayer) || String(intent.raw || '').toLowerCase();
    const isBase = id => (ingMap.get(id) || {}).role === 'base';
    const askedIng = new Set(Object.entries(intent.ings || {}).filter(([, w]) => w >= 1).map(([id]) => id));
    const askedSpirits = new Set(intent.spirits || []);
    const changed = riffIds ? new Set(lines.map(l => l.id).filter(id => !riffIds.includes(id))) : new Set();
    const sigIds = new Set((archetype.signature || []).filter(c => c.required).flatMap(c => c.anyOf));
    const askedTag = id => Object.entries(intent.tags || {}).some(([t, w]) => w >= 1 && ((ingVec[id] || {})[t] || 0) >= 0.5);
    const has = (...ids) => lines.some(l => ids.includes(l.id));
    const facts0 = facts || drinkFacts({ lines, stats: stats || {}, look, method, ice, garnish, archetype, prayer, intent });
    const sinkWarm = ((look && look.layers) || []).some(x => x.kind === 'sink' && (showsColor({ body: { hex: x.hex }, layers: [] }, 'red') || showsColor({ body: { hex: x.hex }, layers: [] }, 'orange') || showsColor({ body: { hex: '#ffffff' }, layers: [{ kind: 'sink', hex: x.hex, frac: 0.2 }] }, 'red')));
    const d = {
      ...facts0, prayer, has, sinkWarm,
      abv: stats ? stats.abv : 12, acid: stats ? stats.acidConc : 0.5, gentle: (stats ? stats.abv : 12) <= 12 && (stats ? stats.standardDrinks || 0 : 1) < 2,
      crushed: ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice), long: lines.reduce((t, l) => t + (l.oz || 0), 0) > 5,
      spice: has('allspice-dram', 'cinnamon-syrup', 'velvet-falernum', 'falernum-syrup', 'dons-mix', 'ginger-syrup', 'angostura', 'hot-buttered-rum-batter'),
      nutmeg: garnish.some(g => /nutmeg/i.test(g)), red: facts0.shows('red'), blue: facts0.shows('blue'), dark: facts0.shows('dark'),
    };
    let typeWord = cousin || typeWordFor(archetype, d);
    // A riff says so once: "a Navy Grog riff", never "Mai Tai cousin …, a riff on the Mai Tai".
    if (riffOf && !cousin && !typeWord.toLowerCase().includes(riffOf.toLowerCase())) typeWord = `${riffOf} riff`;
    const inType = w => typeWord.toLowerCase().includes(w.toLowerCase());
    const tasteable = l => l.muddled || (l.oz || 0) >= 0.2 || ((ingMap.get(l.id) || {}).cat === 'liqueur' && (l.oz || 0) >= 0.16) || askedIng.has(l.id);
    // A spirit the guest asked for or a riff swapped in is a hero too ("a Navy Grog riff with bourbon").
    const heroBase = id => isBase(id) && (askedIng.has(id) || askedSpirits.has(id) || changed.has(id));
    const rank = l => (askedIng.has(l.id) || askedSpirits.has(l.id) ? 4 : 0) + (changed.has(l.id) ? 3 : 0) + (askedTag(l.id) ? 2 : 0) + (!sigIds.has(l.id) ? 1 : 0) + Math.min(1, (l.oz || 0) / 2);
    // Flavors the type word already promises go unsaid ("colada" says pineapple and coconut).
    const implied = new Set(Object.entries(NOUN_IMPLIES).filter(([k]) => typeWord.toLowerCase().includes(k)).flatMap(([, v]) => v));
    // The color the guest asked for leads the line, so a hero never repeats it ("blue … with blue curaçao").
    let colorPart = null;
    const wanted = [intent.color, intent.colorLean].find(c => c && look && COLOR_WORD[c] && showsColor(look, c));
    if (wanted) colorPart = wanted === 'orange' && TIME_WORDS.dusk.test(prayer) ? 'sunset-orange' : COLOR_WORD[wanted];
    const sameAsColor = w => colorPart && w.toLowerCase().includes(colorPart.replace(/^ruby-/, ''));
    // "A coconut sour with coconut water" says coconut twice.
    const sharesType = w => w.toLowerCase().split(/\s+/).some(t => t.length >= 4 && typeWord.toLowerCase().split(/[\s-]+/).includes(t));
    const heroes = [];
    const cands = [...lines].filter(l => (!isBase(l.id) || heroBase(l.id)) && MENU[l.id] && tasteable(l) && !l.float).sort((a, b) => rank(b) - rank(a));
    for (const l of cands) {
      const w = MENU[l.id];
      if (rank(l) < 1 || inType(w) || sharesType(w) || heroes.includes(w) || sameAsColor(w)) continue;
      // What the type word already says goes unsaid even if asked; a swapped-in spirit is always said.
      if (!heroBase(l.id) && implied.has(leadOf(l.id))) continue;
      if (heroes.length < 2) heroes.push(w);
    }
    // Nothing sets it apart? Then say what it is made of.
    if (!heroes.length) for (const l of cands) { const w = MENU[l.id]; if (!inType(w) && !heroes.includes(w) && !sameAsColor(w) && !implied.has(leadOf(l.id)) && heroes.length < 2 && !['lime', 'lemon', 'soda'].includes(w)) heroes.push(w); }
    // Base adjective from a base spirit's lead flavor; smoke only from a smoky bottle.
    // Only a base that carries the drink (or one the guest asked for) lends its adjective: half an
    // ounce of gin in a rum bowl is not "piney".
    const baseOz = lines.filter(l => isBase(l.id) && !l.float).reduce((t, l) => t + (l.oz || 0), 0) || 1;
    const baseLeads = lines.filter(l => isBase(l.id) && !l.float && (l.oz || 0) >= 0.5 && ((l.oz || 0) / baseOz >= 0.4 || askedIng.has(l.id) || askedSpirits.has(l.id) || ((intent.tags || {})[leadOf(l.id)] || 0) >= 1)).map(l => leadOf(l.id)).filter(t => BASE_ADJ[t] && (t !== 'smoky' || d.smoky));
    const askedBase = baseLeads.find(t => ((intent.tags || {})[t] || 0) >= 1);
    const baseAdj = BASE_ADJ[askedBase || baseLeads[0]] || null;
    const texture = lines.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'vanilla-ice-cream'].includes(l.id) && (l.oz || 0) >= 0.75) && !/colada|cream/.test(typeWord) ? 'creamy' : null;
    const voice = !colorPart ? voiceAdj(archetype, d, rng, prayer) : null;
    // An adjective that echoes the type word ("bittersweet bitter tiki sour") is dropped.
    const typeToks = typeWord.toLowerCase().split(/[\s-]+/).filter(t => t.length >= 4);
    const echoes = w => typeToks.some(t => w.toLowerCase().startsWith(t.slice(0, 5)) || t.startsWith(w.toLowerCase().slice(0, 5))) || (/frozen|frapp/.test(typeWord.toLowerCase()) && /^(frosty|snowy)$/.test(w));
    let lead = [colorPart, texture, voice, baseAdj].filter(Boolean).filter((w, i, a) => a.indexOf(w) === i && !(w === 'silky' && texture) && !(w === 'dark' && w !== colorPart && (voice === 'stormy' || colorPart)) && !inType(w) && !echoes(w)).slice(0, 2);
    // A mood line must be true of the drink, its time and its culture; a garnish or offering it
    // names must be in the glass, a year must be the drink's own.
    const MOOD_COLOR = { red: 'red', ruby: 'red', crimson: 'red', scarlet: 'red', blue: 'blue', turquoise: 'blue', green: 'green', jade: 'green', gold: 'gold', golden: 'gold', pink: 'pink', purple: 'purple', violet: 'purple', black: 'dark', orange: 'orange' };
    const bodyColorOk = m => !Object.entries(MOOD_COLOR).some(([w, c]) => new RegExp(`\\b${w}\\b`, 'i').test(m) && !(look && showsColor({ body: look.body, layers: [] }, c)));
    const kinds = new Set(((look && look.layers) || []).map(x => x.kind));
    const structOk = m => !(/sunrise|sunset|dawn|dusk/i.test(m) && /sunk|sink|bottom|settl|bleed/i.test(m) && !sinkWarm) && !(/sunk|sink|bottom of the glass|settl/i.test(m) && !kinds.has('sink')) && !(/float|on top/i.test(m) && !kinds.has('float')) && !(/layer|gradient|band|ombr/i.test(m) && !kinds.size) && !(/froth|foam/i.test(m) && !kinds.has('foam')) && !(/flame|fire|burning|ablaze|\blit\b/i.test(m) && !d.flaming);
    const repeatsType = m => typeToks.some(t => new RegExp(`\\b${t.replace(/[^a-z0-9]/g, '.')}`, 'i').test(m));
    const mood = (intent.taglineWords || []).find(m => m && bodyColorOk(m) && structOk(m) && !POLY.test(m) && moodOk(m, d) && !repeatsType(m) && !(riffOf && m.toLowerCase().includes(riffOf.toLowerCase())));
    // Mood joins with a comma; a mood that starts with "with" drops it when the heroes use "with".
    let moodText = mood ? mood.replace(/[.]+$/, '') : '';
    const build = () => {
      const withPart = heroes.length ? ` with ${list(heroes)}` : '';
      let m = moodText;
      if (m && withPart && /^with\b/i.test(m)) m = m.replace(/^with\s+/i, '');
      const moodPart = m ? (/^(for|to|on|in|under|at|from|like|and)\b/i.test(m) && !withPart ? ` ${m}` : `, ${m}`) : '';
      const phrase = `${lead.join(', ')} ${typeWord}${withPart}${moodPart}`.replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
      return `${an(phrase).replace(/^a/, 'A')} ${phrase}.`;
    };
    // About twelve words: shed the second adjective, then the second hero, then the mood.
    const words = t => t.split(/\s+/).length;
    let out = build();
    if (words(out) > 13 && lead.length > 1) { lead = lead.slice(0, 1); out = build(); }
    if (words(out) > 13 && heroes.length > 1) { heroes.splice(1); out = build(); }
    if (words(out) > 15 && moodText) { moodText = ''; out = build(); }
    // No word twice in a row ("bitter bitter tiki sour").
    return polish(out.replace(/\b(\w+)\s+\1\b/gi, '$1'));
  }

  // The tagline for a classic poured by name, or recognised as one: its real name and credit.
  function classicTagline({ name, credit, asWritten = false, mood = '', facts = null }) {
    const m = mood && facts && moodOk(mood, facts) ? `, ${mood.replace(/^with\s+/i, '')}` : '';
    return polish(asWritten
      ? `The ${name}${credit ? ` (${credit})` : ''}, poured as written. Pray again and the gods will riff on it.`
      : `The ${name}${credit ? ` (${credit})` : ''}, as the gods pour it${m}.`);
  }

  // ---------------------------------------------------------------------------------------
  // How alike two builds are, 0 to 1: shared bottles by dose (square-rooted, so a dash still
  // counts), with near-twins (Jamaican aged for Jamaican pot still, simple for rich syrup)
  // counting most of the way. 0.95 and up is the same drink as poured at a bar.
  const KIN = [
    ['rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-dark'], ['rum-white-column', 'rum-blended-light', 'rum-gold-column'], ['rum-demerara', 'rum-black-blended', 'rum-navy'],
    ['rum-demerara-overproof', 'rum-black-overproof'], ['simple-syrup', 'rich-simple', 'cane-syrup'], ['velvet-falernum', 'falernum-syrup'], ['absinthe', 'pastis'],
    ['coconut-cream', 'coconut-milk'], ['heavy-cream', 'half-and-half'], ['orange-curacao', 'triple-sec'], ['passion-fruit-syrup', 'fassionola', 'passion-fruit-nectar'],
    ['creme-de-cacao', 'white-creme-de-cacao'], ['green-chartreuse', 'yellow-chartreuse'],
  ];
  const kinOf = new Map();
  KIN.forEach((g, i) => g.forEach(id => kinOf.set(id, i)));
  const kin = (a, b) => a !== b && kinOf.has(a) && kinOf.get(a) === kinOf.get(b);
  // A bottle the pantry lists as the other's stand-in (amaro for Campari) is kin for a riff.
  const kinish = (a, b) => kin(a, b) || (ing(a).subs || []).includes(b) || (ing(b).subs || []).includes(a);
  const weigh = lines => {
    const m = new Map();
    for (const l of lines) { if (!isPoured(l)) continue; const oz = l.muddled ? 0.25 : Math.max(0.02, l.oz || 0); m.set(l.id, (m.get(l.id) || 0) + oz); }
    for (const [k, v] of m) m.set(k, Math.sqrt(v));
    return m;
  };
  // Shared weight between two builds (near-twins at 90%), and each build's own total.
  // `wt` (optional) scales each bottle's say.
  function overlap(aLines, bLines, wt = null) {
    const A = weigh(aLines), B = weigh(bLines);
    if (wt) for (const M of [A, B]) for (const [k, v] of M) M.set(k, v * wt(k));
    let num = 0, den = 0;
    const usedB = new Set();
    const leftA = [];
    for (const [id, wa] of A) {
      if (B.has(id)) { const wb = B.get(id); num += Math.min(wa, wb); den += Math.max(wa, wb); usedB.add(id); } else leftA.push(id);
    }
    for (const id of leftA) {
      const wa = A.get(id);
      const k = [...B.keys()].find(b => !usedB.has(b) && !A.has(b) && kin(id, b));
      if (k) { const wb = B.get(k); num += 0.9 * Math.min(wa, wb); den += Math.max(wa, wb); usedB.add(k); } else den += wa;
    }
    for (const [id, wb] of B) if (!usedB.has(id)) den += wb;
    const sum = M => [...M.values()].reduce((t, v) => t + v, 0);
    return { num, den, a: sum(A), b: sum(B) };
  }
  function sameness(aLines, bLines, wt = null) {
    const o = overlap(aLines, bLines, wt);
    return o.den ? o.num / o.den : 0;
  }
  // How well a reference accounts for a drink, for picking the drink it is built on: mostly how
  // much of this drink the reference explains (rare bottles weigh most, so a strawberry colada
  // finds the Lava Flow), partly how much of the reference made it into the glass.
  function kinship(lines, refLines, wt = null) {
    const o = overlap(lines, refLines, wt);
    return o.a && o.b ? 0.6 * Math.min(1, o.num / o.a) + 0.4 * Math.min(1, o.num / o.b) : 0;
  }

  // The bottles that make a drink itself: lose one with no near-twin in its place and the card
  // says the drink is now a cousin ("no falernum, so it's a Zombie cousin"). Keyed by drink or
  // archetype; anything else falls back to the archetype's required modifiers.
  const LOAD_BEARING = {
    zombie: ['velvet-falernum', 'falernum-syrup', 'dons-mix', 'pastis', 'absinthe'],
    'mai-tai': ['orange-curacao', 'orgeat'], 'vic-mai-tai-riff': ['orange-curacao', 'orgeat'], 'hawaiian-mai-tai': ['orgeat'],
    scorpion: ['brandy', 'orgeat'], 'scorpion-bowl': ['brandy', 'orgeat'], 'fog-cutter': ['brandy', 'orgeat', 'cream-sherry', 'oloroso-sherry', 'amontillado-sherry'],
    'pina-colada': ['pineapple-juice', 'coconut-cream'], painkiller: ['pineapple-juice', 'coconut-cream', 'orange'], 'blue-hawaii': ['blue-curacao', 'pineapple-juice'],
    'bitter-tiki-sour': ['campari'], 'jungle-bird': ['campari'], 'trinidad-swizzle': ['angostura', 'mint'], 'queen-s-park-swizzle': ['angostura', 'mint'], 'navy-grog': ['grapefruit'],
    'cobras-fang': ['velvet-falernum', 'fassionola'], 'cobra-s-fang': ['velvet-falernum', 'fassionola'], hurricane: ['passion-fruit-syrup', 'fassionola'],
    'hemingway-daiquiri': ['grapefruit', 'maraschino'], 'kingston-negroni': ['campari', 'sweet-vermouth'], 'dark-n-stormy': ['ginger-beer'], 'suffering-bastard': ['ginger-beer'],
    tortuga: ['sweet-vermouth', 'creme-de-cacao'], 'tom-and-jerry': ['tom-and-jerry-batter'], 'hot-buttered-rum': ['hot-buttered-rum-batter', 'butter'],
    'missionarys-downfall': ['mint', 'peach-liqueur'], 'passion-sour': ['passion-fruit-syrup'], 'pearl-diver': ['gardenia-mix'],
  };

  // ---------------------------------------------------------------------------------------
  // What changed from the named reference, net (no swap chains), in bartender words, each move
  // tagged with its cause: the prayer (an asked bottle, flavor, color, style, or something the
  // guest ruled out), novelty (a repeat prayer's twist) or structure (a trim the guest needn't
  // hear about). A defining bottle that went missing is said plainly: "no falernum, so it's a
  // Zombie cousin".
  function netMoves({ ref, lines, archetype, intent = {}, notes = [], slotOf = () => null, refName = '' }) {
    const agg = ls => { const m = new Map(); for (const l of ls) { if (!isPoured(l)) continue; const x = m.get(l.id) || { id: l.id, oz: 0, float: false, sink: false }; x.oz += l.muddled ? 0.25 : (l.oz || 0); x.float = x.float || !!l.float; x.sink = x.sink || !!l.sink; m.set(l.id, x); } return m; };
    const R = agg(ref || []), L = agg(lines);
    const added = [...L.values()].filter(x => !R.has(x.id));
    const removed = [...R.values()].filter(x => !L.has(x.id));
    const role = id => ing(id).role, cat = id => ing(id).cat;
    const asked = id => (intent.ings || {})[id] >= 1 || (intent.spirits || []).includes(id) || (intent.prefer || {})[id] >= 1
      || Object.entries(intent.tags || {}).some(([t, w]) => w >= 1 && !STRUCTURAL.has(t) && (leadOf(id) === t || ((ingVec[id] || {})[t] || 0) >= 0.6))
      || (intent.color && (ing(id).color === intent.color || (intent.color === 'pink' && ing(id).color === 'red')))
      || (intent.style && intent.style.layered && (L.get(id) || {}).float) || (intent.style && intent.style.layered && (L.get(id) || {}).sink)
      || (FIZZ.includes(id) && ((intent.tags || {}).effervescent >= 1 || (intent.prefer || {})[id] > 0))
      || (intent.style && intent.style.zeroProof);
    const avoided = id => (intent.avoidIngs && intent.avoidIngs.has && intent.avoidIngs.has(id)) || ((intent.softAvoid || {})[id] >= 1)
      || Object.entries(intent.avoidTags || {}).some(([t, w]) => w >= 1 && (ing(id).flavors || []).includes(t)) || (intent.style && intent.style.zeroProof && (ing(id).abv || 0) > 0);
    // Pair each new bottle with the one it replaced: a near-twin, the same archetype slot, then the same job.
    const pairs = [], usedR = new Set();
    // The guest's own bottles are paired first, so "mezcal takes over from the dark rum" is the
    // prayer's move and whatever else changed is the twist.
    added.sort((x, y) => (asked(y.id) ? 1 : 0) - (asked(x.id) ? 1 : 0));
    // Closest match first across all new bottles (a near-twin, then the same slot and job, then
    // the same job, then the same slot), so lime doesn't take the orange juice's place when
    // passion fruit nectar is the bottle that did, nor tonic the lime's when yuzu did.
    const layer = (a, x) => !(a.float || a.sink) === !(x.float || x.sink);
    const sameSlot = (a, x) => !!slotOf(a.id) && slotOf(a.id) === slotOf(x.id);
    const PASSES = [(a, x) => kinish(a.id, x.id), (a, x) => sameSlot(a, x) && role(x.id) === role(a.id), (a, x) => role(x.id) === role(a.id) && layer(a, x), (a, x) => sameSlot(a, x)];
    const partner = new Map();
    for (const ok of PASSES) {
      for (const a of added) {
        if (partner.has(a.id)) continue;
        const r = removed.find(x => !usedR.has(x.id) && ok(a, x));
        if (r) { usedR.add(r.id); partner.set(a.id, r); }
      }
    }
    for (const a of added) pairs.push({ a, r: partner.get(a.id) || null });
    const leftover = removed.filter(r => !usedR.has(r.id));
    const moves = [];
    const nm = say;
    const keptBase = [...L.values()].filter(x => role(x.id) === 'base' && R.has(x.id) && !x.float);
    for (const { a, r } of pairs) {
      let text;
      if (r && role(a.id) === 'base' && !a.float) text = `${nm(a.id)} takes over from ${nm(r.id)}`;
      else if (r && a.float) text = `${an(nm(a.id))} ${nm(a.id)} float in place of the ${nm(r.id)}`;
      else if (r) text = `${nm(a.id)} in place of ${nm(r.id)}`;
      else if (a.float) text = `${an(nm(a.id))} ${nm(a.id)} float`;
      else if (a.sink) text = `${nm(a.id)} sunk to the bottom`;
      else if (role(a.id) === 'base' && keptBase.length) text = `${nm(a.id)} splits the base with the ${list(keptBase.map(x => nm(x.id)))}`;
      else if (FIZZ.includes(a.id) || a.id === 'sparkling-wine') text = `topped with ${nm(a.id)}`;
      else if (cat(a.id) === 'bitters') text = `a dash of ${nm(a.id)}`;
      else if (a.oz < 0.2) text = `a barspoon of ${nm(a.id)}`;
      else text = `${nm(a.id)} added`;
      const why = notes.map(n => n.replace(/^riff:/, '')).find(n => n.includes(nm(a.id).toLowerCase()) && / for ([a-z -]+)$/.test(n));
      // The reason is said only as a flavor word a guest would use ("for smoke"), never a slot.
      const tag = why ? ((why.match(/ for ([a-z -]+)$/) || [])[1] || '').trim().replace(/\s+/g, '-') : '';
      const reason = tag && WORD[tag] && !STRUCTURAL.has(tag) ? WORD[tag] : '';
      // A swap you can't taste (rich syrup for simple, a barspoon of anything) is no twist.
      const trivial = PLAIN.has(a.id) || ['saline', 'water', 'hot-water'].includes(a.id) || (a.oz < 0.2 && cat(a.id) !== 'bitters' && !a.float && !a.sink) || (r && kin(a.id, r.id));
      // A near-twin swap (one Jamaican rum for another) is the bar's choice unless the guest named the bottle.
      const byName = (intent.ings || {})[a.id] >= 1 || (intent.spirits || []).includes(a.id);
      const cause = r && (kin(a.id, r.id) || (PLAIN.has(a.id) && PLAIN.has(r.id))) && !byName ? 'structure' : asked(a.id) || (r && avoided(r.id)) ? 'prayer' : trivial ? 'structure' : 'novelty';
      moves.push({ text: reason && cause === 'prayer' && !text.includes(reason) ? `${text} for ${reason}` : text, cause, id: a.id, replaced: r ? r.id : null });
    }
    for (const r of leftover) moves.push({ text: `no ${nm(r.id)}`, cause: avoided(r.id) ? 'prayer' : 'structure', id: null, replaced: r.id });
    // Dose moves the prayer asked for: less sweet, more tart, stronger, gentler.
    const sweetIds = [...L.keys()].filter(id => R.has(id) && ['sweet', 'rich'].includes(role(id)));
    for (const id of sweetIds) {
      const was = R.get(id).oz, now = L.get(id).oz;
      if ((intent.sweetness || 0) < 0 && now <= was - 0.2) moves.push({ text: `less ${nm(id)}`, cause: 'prayer', id });
      if ((intent.sweetness || 0) > 0 && now >= was + 0.2) moves.push({ text: `more ${nm(id)}`, cause: 'prayer', id });
    }
    for (const id of [...L.keys()].filter(id => R.has(id) && role(id) === 'sour')) {
      const was = R.get(id).oz, now = L.get(id).oz;
      if (((intent.tartness || 0) > 0 || ((intent.tags || {}).tart || 0) >= 1) && now >= was + 0.2) moves.push({ text: `more ${nm(id)}`, cause: 'prayer', id });
    }
    // A defining bottle gone without its twin: honest about what the drink now is.
    const sig = (archetype.signature || []).filter(c => c.required);
    const own = LOAD_BEARING[String(refName || '').replace(/\(.*?\)/g, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')] || LOAD_BEARING[archetype.id];
    const defining = id => (own ? own.includes(id) : sig.some(c => c.anyOf.includes(id)) && ['modifier', 'sweet', 'rich'].includes(role(id))) && !PLAIN.has(id) && (cat(id) !== 'bitters' || (own || []).includes(id));
    const clauseOf = id => sig.find(c => c.anyOf.includes(id));
    const stillMet = id => { const c = clauseOf(id); return !own && !!c && (c.anyOf.some(x => L.has(x)) || c.anyOf.some(x => PLAIN.has(x))); };
    const lost = [...R.keys()].filter(id => !L.has(id) && defining(id) && !stillMet(id) && ![...L.keys()].some(x => kinish(x, id)));
    const cousin = lost.length && refName ? `no ${list(lost.map(nm))}, so it's ${an(refName)} ${refName} cousin` : '';
    return { moves, cousin, lost };
  }

  return { presence, named, headline, tastingNote, tagline, classicTagline, balanceLine, textureLine, drinkFacts, claimsIn, keeps, moodOk, hear, heardLabel, sayBack, sameness, kinship, netMoves, say, typeWordFor, WORD, SPIRIT_VOICE, MENU };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
