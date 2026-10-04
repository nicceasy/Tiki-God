// Recipe linter: an internal critic that checks a generated drink against the tiki technique
// rules in data/technique-rules.json (extracted from the technique research: balance, method,
// vessel, garnish, copy and the aficionado's red flags). Browser-safe ES module, no Node APIs.
//
//   const { lint } = createLinter({ rules, vocab, vessels });
//   lint(recipe, { intent }) -> [{ id, sev: 'fatal'|'major'|'minor', msg, lines?, fix? }]
//
// `intent` is optional (the engine's parsed prayer). Without it the linter reads recipe.prompt
// with a small negation-aware word test. Stats come from recipe.stats when present, otherwise
// they are computed here with the same dilution curves as web/lib/chem.js.
//
// Implemented (rule ids in parentheses):
//  - doseCaps with byFamily and the checkable exceptions: rinse, anise-forward request, Angostura
//    crown on crushed ice, bitters-base sour, c.1950 Zombie maraschino, Blue Hawaiian curaçao,
//    explicit fernet/smoky/overproof/sherry requests, grenadine sink and Dr. Funk
//    (anise-overdose, bitters-overdose, allspice-overdose, chartreuse-overdose, grenadine-for-color,
//    jamaican-white-overproof-base, smoky-bitter-bomb, brewed-coffee-cold-stirred, dose-cap);
//    minDoseIfPresent with the Navy Grog soda and Ti' Punch lime-coin exceptions (micro-dose-bulk)
//  - exclusiveGroups (two-orange-liqueurs, two-plain-syrups, coconut-pileup, redundant-red-fruit,
//    passion-pileup, bitter-stack, anise-stack, overproof-overdose, spice-sludge, lemon-and-lime,
//    dairy-stack)
//  - incompatibilities (casein-plus-citrus, casein-plus-mild-acid, heavy-cream-plus-heavy-citrus,
//    coffee-citrus-mud, blue-plus-red, blue-goes-green, blue-plus-dark-rum, midori-orange-mud,
//    spiced-rum-plus-spice-stack, passion-plus-full-lime, egg-with-carbonation-shaken)
//  - methodRules (shaken-carbonation, sparkling-shaken, ice-cream-shaken, stirred-with-juice,
//    hot-wrong, hot-vessel-unsafe, swizzle-not-swizzled, swizzle-method-mismatch, flash-blend-up
//    (also the crushed-shake-up case), frozen-no-mound, stirred-on-crushed, egg-no-dry-shake,
//    punchbowl-crushed, layer-claim-shaken, float-too-dense, sink-too-light)
//  - vesselFit (volume-overflow, volume-crowded, volume-stingy; bowls multiply by servings),
//    up-drink-in-mug, colada-in-coupe, fruit-vessel-for-up, ice-cone-misuse, bowl-single
//  - componentCounting (too-many-cooks, quarter-ounce-soup, micro-dose-accent, core-share-low)
//  - strength: overproof caps, total spirit, ethanol, family maxSpiritOz and ABV windows with the
//    frozen, bowl, lowAbv, strongest and zeroProof style overrides (overproof-overdose,
//    spirit-heavy, abv-out-of-band, zero-proof-has-alcohol, zero-proof-structure)
//  - familyRequirements and the mechanical redFlags: colada-no-coconut-or-pineapple, colada-sour,
//    mai-tai-juice, mai-tai-incomplete, mai-tai-float-or-sink, zombie-weak-structure,
//    zombie-red-or-creamy, grog-wrong, daiquiri-impostor, orgeat-punch-without-orgeat,
//    scorpion-without-brandy, fog-cutter-incomplete, buck-without-ginger, highball-served-up,
//    bitter-tiki-not-bitter, family-requirement, family-underdosed, family-forbid, family-max,
//    classic-riff-loses-signature, classic-name-misuse,
//    noun-claim-false / noun-claim-weak, cranberry-in-tiki, lime-cordial-as-citrus,
//    spiced-rum-classic, blue-or-melon-unrequested, bitter-stack-in-gentle-drink,
//    vodka-in-golden-age-family, raw-butter, fruit-named-absent, phantom-flavor,
//    dessert-without-dessert, coconut-milk-unsweetened-swap, liqueur-cloy, ratio-out-of-window,
//    acid-missing, frozen-thin, pineapple-flab, hot-too-dry-or-strong, red-zombie-or-mai-tai,
//    angostura-brown-wash, tasting-contradicts-numbers, mint-shredded-or-unstrained, fire-unsafe
//  - garnish: garnish-clutter, garnish-heavy-on-up, garnish-on-hot, garnish-missing-aroma,
//    garnish-never, cherry-in-mai-tai, garnish-duplicate, garnish-excluded-ingredient,
//    garnish-contradicts-recipe, garnish-rim, garnish-whipped-cream, garnish-tacky,
//    mint-without-dome, nutmeg-on-tart-sour
//  - copy: sour-mix, false-provenance, cliche-copy, sacred-or-offensive, adjective-soup,
//    tagline-repeat, copy-too-long, copy-too-short, strength-word-lie, color-name-lie, opacity-lie,
//    creamy-without-cream, rich-for-lean, label-names-absent-ingredient, possessive-mad-libs
//  - steps and service: steps-ice-mismatch, open-pour-up (and straws or mint bouquets on an up
//    drink, reported as garnish-heavy-on-up)
//
// Calibrated against the catalogue (every popular catalogued classic, served as written, is linted
// in development; tests lint the canonical Zombie, Mai Tai, Painkiller and Navy Grog). Where a
// rule as written rejected a real classic, it got a documented exception instead:
//  - ethanol ceiling 2.0 oz + 7.5% (the 1934 Zombie carries about 2.07 oz); rounding slack of a
//    quarter-ounce on vessel ranges, half a point on ABV windows, 5% on sugar:acid windows
//  - a defining component that is missing is fatal (colada, Mai Tai, orgeat punch); present but
//    under the canonical dose is major, family-underdosed (the Death & Co Piña Colada's 1 oz of
//    pineapple). The Zombie is judged by the research's own test (one rum, no overproof, or no
//    grapefruit/cinnamon/falernum element is fatal; the rest of the JSON stack is major, so Berry's
//    Easy Tiki Zombie passes), and only for a drink that is, names or riffs on the Zombie: Tortuga,
//    Cobra's Fang and Test Pilot share the family but not the spec
//  - vessel ranges are the comfortable fill: above them is volume-crowded (major); volume-overflow
//    (fatal) is reserved for a drink that physically can't fit (iced liquid past 75% of capacity, a
//    frozen drink that blends past a proud mound, a finished up drink bigger than the glass), so
//    the 1973 Jungle Bird (7¼ oz in a 12 oz bird) is not rejected
//  - resort punch: passion fruit syrup counts as its juice (Pat O'Brien's Hurricane) and a juice
//    already at 0.5 g acid needs no extra citrus (Tequila Sunrise); a Mai Tai-template drink built
//    on the spirit the guest asked for keeps its frame (Honi Honi, "Mai Tai with mezcal")
//  - zero-proof drinks skip spirit requirements; low-ABV requests need the spirit present, not dosed
//  - a fruit garnish the family requires or lists as typical is not a lie (the buck's lime wedge),
//    and a required garnish is never demanded for a fruit the drink doesn't contain
//  - archetypeAromaRequired replaces the family's required garnish for the named classics (the
//    Painkiller's nutmeg, not the colada's pineapple wedge)
//  - evocative name nouns (Revenant, Specter, Bird, Nightcap, Cooler, Punch, Sour, Sling, Buck)
//    fail as major, definitional ones (Colada, Mai Tai, Zombie, Grog, Swizzle, Toddy...) as fatal
//  - a swizzle that is not shaken-and-strained or on cubes is a major mismatch, not fatal
//  - fire is allowed on any bowl (the research says wide mugs and bowls; the list omits the punch bowl)
//  - when the computed look still reads blue, blue curaçao with a yellow ingredient is not green
//
// Skipped, because the recipe object can't show them:
//  - prayer-ignored / copy.prayerTrace: needs several drinks side by side (lint-battery reports
//    identical ingredient sets across prayers instead) and the engine's free-text notes
//  - named-reference-ignored: needs the catalogue of classics and pop references
//  - copy.tastingStructure (nose / palate / finish) and the headline rule's first tasting
//    sentence and hedging; only flavor and food words in the name and tagline are checked
//  - dilution model, batch scaling of bitters, fresh-juice age, artificial grenadine, heat rating
//    of ceramic mugs, jalapeño seeds, garnish blocking the straw, aquafaba/vegan swaps
//  - fire fuel and pouring practice beyond the copy and vessel (fire-unsafe is partial)

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'with', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'it', 'its', 'is', 'as', 'but', 'then', 'into', 'over', 'up', 'that', 'this', 'your', 'you', 'so', 'just', 'one', 'all', 'no', 'not']);
const DIACRITICS = /[̀-ͯ]/g;
export const fold = s => String(s || '').normalize('NFD').replace(DIACRITICS, '').toLowerCase();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole word or phrase, case- and accent-insensitive; "Pele's" is still Pele, "Zombie-style" is not Zombie.
const wordRe = w => new RegExp(`(^|[^a-z0-9'-])${esc(fold(w)).replace(/[\s-]+/g, '[\\s-]+')}(?=$|'s\\b|[^a-z0-9'-])`, 'i');
const hasWord = (text, w) => wordRe(w).test(fold(text));
const sum = a => a.reduce((s, x) => s + x, 0);
const r2 = x => Math.round(x * 100) / 100;
const EPS = 0.005;

// Bar-friendly amounts in messages.
const FR = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
export function oz(x) {
  if (!(x > 0)) return '0 oz';
  if (x < 0.2) {
    const tsp = x / 0.1667;
    if (Math.abs(tsp - Math.round(tsp)) < 0.15 && Math.round(tsp) >= 1) return `${Math.round(tsp)} tsp`;
    if (x < 0.1) return `${Math.max(1, Math.round(x / 0.03))} dash${Math.round(x / 0.03) > 1 ? 'es' : ''}`;
  }
  const whole = Math.floor(x + 1e-9);
  let best = FR[0];
  for (const f of FR) if (Math.abs(x - whole - f[0]) < Math.abs(x - whole - best[0])) best = f;
  if (Math.abs(x - whole - 1) < Math.abs(x - whole - best[0])) return `${whole + 1} oz`;
  return `${whole || ''}${best[1] || (whole ? '' : '0')} oz`;
}

// Colors: a plain HSL hue test on the look's hexes.
export function hsl(hex) {
  if (!/^#?[0-9a-f]{6}$/i.test(String(hex || ''))) return null;
  const h0 = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h0.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d < 0.06) return { h: null, s: 0, l };
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d / (1 - Math.abs(2 * l - 1) || 1), l };
}
const inHue = (c, lo, hi) => c && c.h !== null && (lo <= hi ? c.h >= lo && c.h < hi : c.h >= lo || c.h < hi);
export const HUE = {
  blue: c => inHue(c, 165, 255) && c.s > 0.2,
  aqua: c => inHue(c, 150, 210) && c.s > 0.15,
  green: c => inHue(c, 65, 165) && c.s > 0.2,
  red: c => inHue(c, 330, 14) && c.s > 0.3 && c.l < 0.7,
  pink: c => inHue(c, 300, 22) && c.l >= 0.55 && c.s > 0.2, // as web/lib/optics.js
  gold: c => inHue(c, 18, 75) && c.s > 0.2 && c.l > 0.3,
  purple: c => inHue(c, 255, 320) && c.s > 0.15,
  black: c => !!c && c.l < 0.22,
  white: c => !!c && c.l > 0.82 && c.s < 0.5,
};
// Color words a guest reads as a promise about the glass. Ambiguous words (orange, white rum,
// dark rum, coral the reef, midnight) are left out on purpose.
const COLOR_WORDS = [
  ['blue', ['blue', 'sapphire', 'azure', 'cobalt', 'electric-blue', 'deep-blue']],
  ['aqua', ['aqua', 'turquoise', 'teal', 'aquamarine']],
  ['green', ['green', 'jade', 'emerald', 'verdant']],
  ['red', ['red', 'crimson', 'scarlet', 'ruby', 'ruby-red', 'blood-red', 'cherry-red']],
  ['pink', ['pink', 'rosy', 'blush']],
  ['gold', ['gold', 'golden', 'gilded']],
  ['purple', ['purple', 'violet', 'lavender', 'amethyst']],
  ['black', ['black', 'inky', 'jet-black', 'pitch-black']],
  ['white', ['snow-white', 'milky-white', 'milk-white']],
];
// Which hue families satisfy each color word (red and pink are the same promise, more or less).
const COLOR_OK = { blue: ['blue'], aqua: ['aqua', 'blue', 'green'], green: ['green', 'aqua'], red: ['red', 'pink'], pink: ['pink', 'red'], gold: ['gold'], purple: ['purple', 'pink'], black: ['black'], white: ['white'] };

// Same dilution curves as web/lib/chem.js (Arnold's shaken/stirred, scaled by method).
function dilutionFactor(method, ice, a0) {
  const a = Math.max(0, Math.min(a0, 0.6));
  const shaken = -1.567 * a * a + 1.742 * a + 0.203;
  const stirred = -1.21 * a * a + 1.246 * a + 0.145;
  switch (method) {
    case 'hot': return 0;
    case 'blend': return 0.9;
    case 'stir': return stirred;
    case 'build': return ice === 'none' ? 0 : stirred * 0.8;
    case 'muddle-build': return stirred;
    case 'swizzle': return shaken * 1.2;
    case 'flash-blend': return shaken * 1.3;
    default: return ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice) ? shaken * 1.15 : shaken;
  }
}

// Negation-aware reading of a prayer: is this word asked for (and not "no X", "X-free")?
const NEG = new Set(['no', 'not', 'without', 'minus', 'hold', 'skip', 'sans', 'nix', 'avoid', 'hate', 'hates', 'allergic', 'except', 'nothing', 'never', 'zero', 'than', 'nor']);
function mentions(prompt, word) {
  const t = fold(prompt);
  // A word after a hyphen is the tail of a compound ("sunset-orange" is a color, not orange juice).
  const re = new RegExp(`(^|[^a-z-])(${esc(fold(word)).replace(/\s+/g, '[\\s-]+')})([a-z-]*)`, 'g');
  const out = { pos: false, neg: false };
  let m;
  while ((m = re.exec(t))) {
    const after = m[3] || '';
    // "bananas", "coconutty", "nut-free" are the word; "nutmeg" is another word.
    if (!/^(s|es|y|ty|ed|d|ies)?(-[a-z-]*)?$/.test(after)) continue;
    const clause = t.slice(0, m.index + m[1].length).split(/[,.;:!?]|\bbut\b|\band\b/).pop();
    const before = clause.split(/[^a-z']+/).filter(Boolean).slice(-3);
    const negated = /-free\b/.test(after) || /^\s*free\b/.test(t.slice(m.index + m[0].length)) || before.some(w => NEG.has(w));
    if (negated) out.neg = true; else out.pos = true;
  }
  return out;
}

// Fruit and food words that promise a flavor. [word, flavor tag, specific ids (optional)].
const FOOD = [
  ['pineapple', 'pineapple'], ['banana', 'banana'], ['plantain', 'banana'], ['coconut', 'coconut'], ['copra', 'coconut'],
  ['mango', 'mango'], ['guava', 'guava'], ['papaya', 'papaya'], ['passion fruit', 'passion-fruit'], ['passionfruit', 'passion-fruit'],
  ['maracuja', 'passion-fruit'], ['lime', 'lime'], ['lemon', 'lemon'], ['grapefruit', 'grapefruit'], ['orange', 'orange'],
  ['tangerine', 'orange'], ['cherr', 'cherry'], ['strawberr', 'berry', ['strawberry']], ['raspberr', 'berry', ['raspberry-syrup', 'raspberry-liqueur']],
  ['blackberr', 'berry', ['blackberry-liqueur']], ['cranberr', 'berry', ['cranberry-juice']], ['berr', 'berry'], ['apricot', 'apricot'],
  ['peach', 'peach'], ['pomegranate', 'pomegranate'], ['apple', 'apple'], ['watermelon', 'melon'], ['melon', 'melon'],
  ['lychee', 'lychee'], ['coffee', 'coffee'], ['espresso', 'coffee'], ['chocolate', 'chocolate'], ['cacao', 'chocolate'],
  ['cocoa', 'chocolate'], ['vanilla', 'vanilla'], ['honey', 'honey'], ['almond', 'almond'], ['marzipan', 'almond'],
  ['ginger', 'ginger'], ['cinnamon', 'cinnamon'], ['nutmeg', 'nutmeg'], ['mint', 'mint'], ['clove', 'clove'],
  ['allspice', 'allspice'], ['pimento', 'allspice'], ['molasses', 'molasses'], ['maple', 'maple'], ['caramel', 'caramel'],
  ['butter', 'buttery'], ['anise', 'anise'], ['licorice', 'anise'], ['absinthe', 'anise'],
];
// Aromas a garnish alone may supply (the headline rule: mint, nutmeg, cinnamon).
const GARNISH_AROMA = new Set(['mint', 'nutmeg', 'cinnamon', 'clove']);
// Tags a dash of bitters may honestly lend to the copy ("as spice").
const BITTERS_TAGS = new Set(['cinnamon', 'clove', 'allspice', 'nutmeg', 'ginger', 'baking-spice', 'anise', 'chocolate', 'orange']);

// What a riff or a borrowed classic name must keep (research §5.1, classic-riff-loses-signature).
const PASSION = ['passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur'];
const SIGNATURE = {
  'jungle bird': { need: [['campari'], ['pineapple-juice']], what: 'Campari and pineapple' },
  hurricane: { need: [PASSION], what: 'passion fruit' },
  'navy grog': { need: [['grapefruit', 'dons-mix']], what: 'grapefruit' },
  "queen's park swizzle": { need: [['mint'], ['angostura']], what: 'mint and Angostura' },
  saturn: { need: [PASSION, ['gin', 'gin-old-tom']], what: 'gin and passion fruit' },
  "missionary's downfall": { need: [['mint']], what: 'mint' },
  painkiller: { need: [['orange'], ['pineapple-juice'], ['coconut-cream', 'coconut-milk'], ['nutmeg']], what: 'orange, pineapple, cream of coconut and nutmeg' },
};

// Place words in names, and the spirits that earn them (the imagery in names.js).
const PLACES = {
  demerara: ['rum-demerara', 'rum-demerara-overproof'], georgetown: ['rum-demerara', 'rum-demerara-overproof'], essequibo: ['rum-demerara'],
  'port royal': ['rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-white-overproof'], kingston: ['rum-jamaican-aged', 'rum-jamaican-dark'],
  montego: ['rum-jamaican-aged'], 'cockpit country': ['rum-jamaican-pot'], trelawny: ['rum-jamaican-pot', 'rum-jamaican-white-overproof'],
  'port antonio': ['rum-jamaican-dark'], martinique: ['rum-agricole-blanc', 'rum-agricole-vieux'], 'saint-pierre': ['rum-agricole-blanc'],
  'fort-de-france': ['rum-agricole-vieux'], bridgetown: ['rum-barbados'], barbados: ['rum-barbados'], 'port-au-prince': ['rum-haitian'],
  'cap-haitien': ['rum-haitian'], havana: ['rum-white-column', 'rum-gold-column', 'rum-aged-column'], 'san juan': ['rum-white-column', 'rum-gold-column'],
  'santo domingo': ['rum-aged-column'], tortola: ['rum-navy'], 'jost van dyke': ['rum-navy'], admiralty: ['rum-navy'],
  bermuda: ['rum-black-blended'], 'hamilton harbor': ['rum-black-blended'], paraty: ['rum-cachaca'], bahia: ['rum-cachaca'],
  jalisco: ['tequila-blanco', 'tequila-reposado'], oaxaca: ['mezcal'], kentucky: ['bourbon'], bardstown: ['bourbon'], monongahela: ['rye'],
  'london dock': ['gin'], plymouth: ['gin'], cognac: ['brandy'], charente: ['brandy'], lima: ['pisco'], ica: ['pisco'], bergen: ['aquavit'],
  aalborg: ['aquavit'], batavia: ['batavia-arrack'], java: ['batavia-arrack'], speyside: ['scotch-blended'], islay: ['scotch-islay'],
};

// Garnish text as comparable tokens: "Spent lime half-shell" ~ "spent lime shell" ~ "lime shell".
const G_FILLER = new Set(['a', 'an', 'the', 'and', 'with', 'of', 'on', 'in', 'to', 'or', 'over', 'fresh', 'freshly', 'grated', 'paper', 'cocktail', 'spent', 'half', 'big', 'heavy', 'small', 'large', 'long', 'frond', 'expressed', 'floating', 'dusted', 'one', 'per', 'guest', 'each', 'some', 'lightly', 'whole', 'bitter', 'bitters']);
const G_SYN = { twist: 'peel', zest: 'peel', spiral: 'peel', ring: 'peel', wheel: 'cut', slice: 'cut', wedge: 'cut', spear: 'cut', chunk: 'cut', stick: 'cut', piece: 'cut', halfwheel: 'cut', parasol: 'umbrella', top: 'crown' };
function singular(w) {
  if (w.length <= 3 || /(ss|us|is)$/.test(w) || w === 'molasses') return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ch|sh|x)es$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}
export function garnishTokens(text) {
  const t = fold(text).replace(/\(.*?\)/g, ' ').replace(/half-wheel/g, 'halfwheel').replace(/[^a-z']+/g, ' ');
  const out = new Set();
  for (const raw of t.split(' ')) {
    if (!raw) continue;
    const w = singular(raw.replace(/'s$/, ''));
    if (G_FILLER.has(w)) continue;
    out.add(G_SYN[w] || w);
  }
  return out;
}
// Does a garnish (free text) show an item named in the rules ("mint sprig", "pineapple wedge and fronds")?
export function garnishMatches(garnishText, itemText) {
  const need = garnishTokens(itemText);
  if (!need.size) return false;
  const have = garnishTokens(garnishText);
  for (const w of need) if (!have.has(w)) return false;
  return true;
}

const SEV_RANK = { fatal: 0, major: 1, minor: 2 };
const PROPER = /^(Angostura|Peychaud|Green|Yellow|Campari|Aperol|Cynar|Fernet|Galliano|Bénédictine|Drambuie|Licor|Irish|Jamaican|Demerara|Barbados|Haitian|London|Old|Islay|Batavia|Okolehao|Cherry Heering|Swedish|Pedro|Amontillado|Lillet|Don's|Chinese|Li hing|Pisco|Cachaça|Tequila|Mezcal|Bourbon|Rye|Cognac)/;

export function createLinter({ rules, vocab, vessels } = {}) {
  const R = rules || {};
  const ingList = Array.isArray(vocab) ? vocab : (vocab && vocab.ingredients) || [];
  const units = (vocab && vocab.units) || {};
  const ingMap = new Map(ingList.map(i => [i.id, i]));
  const vList = Array.isArray(vessels) ? vessels : (vessels && vessels.vessels) || [];
  const vesselById = new Map(vList.map(v => [v.id, v]));
  const SET = {};
  for (const [k, ids] of Object.entries(R.sets || {})) SET[k] = new Set(ids);
  const S = name => SET[name] || new Set();
  const idsOf = spec => typeof spec === 'string' ? (SET[spec] ? [...SET[spec]] : [spec]) : Array.isArray(spec) ? spec : [];
  const W = R.familyWindows || {};
  const G = R.garnish || {};
  const COPY = R.copy || {};
  const overproof = new Set((R.strength && R.strength.overproofIds) || [...S('overproof')]);

  // "Dark Jamaican rum (...)" -> "dark Jamaican rum"
  const nameOf = id => {
    const ing = ingMap.get(id);
    const n = ((ing && ing.name) || id).replace(/\s*\(.*?\)/g, '').replace(/\s*\/.*$/, '').trim();
    return PROPER.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
  };
  const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] || '');
  const names = ids => list([...new Set(ids)].map(nameOf));

  function context(recipe, intent) {
    const C = { recipe, intent: intent || null };
    C.fam = (recipe.family && (recipe.family.id || recipe.family)) || null;
    if (typeof C.fam !== 'string') C.fam = null;
    C.arch = recipe.archetype || {};
    C.archId = C.arch.id || '';
    C.archName = C.arch.name || '';
    C.lines = (recipe.lines || []).filter(l => l && l.id).map(l => ({ ...l, oz: Number(l.oz) || 0, ing: ingMap.get(l.id) || null }));
    C.poured = C.lines.filter(l => !l.garnish);
    C.garnishLines = C.lines.filter(l => l.garnish);
    C.present = new Set(C.poured.map(l => l.id));
    C.has = id => C.present.has(id);
    C.anyIn = ids => [...ids].filter(id => C.present.has(id));
    C.ozOf = id => sum(C.poured.filter(l => l.id === id).map(l => l.oz));
    C.ozIn = ids => { const s = ids instanceof Set ? ids : new Set(ids); return sum(C.poured.filter(l => s.has(l.id)).map(l => l.oz)); };
    const m = recipe.method || {};
    C.method = m.method || 'shake';
    C.ice = m.ice || 'crushed';
    C.steps = (m.steps || []).map(String);
    C.stepsText = fold(C.steps.join(' \n '));
    C.vId = (recipe.vessel && recipe.vessel.id) || m.vessel || null;
    C.v = C.vId ? vesselById.get(C.vId) || null : null;
    C.servings = Math.max(1, Math.round(Number(recipe.servings) || 1));
    C.isBowlVessel = S('bowlVessels').has(C.vId);
    C.isUp = !!m.up || S('upVessels').has(C.vId) || C.vId === 'flute';
    C.crushed = S('crushedIce').has(C.ice);
    C.garnish = (recipe.garnish || []).map(String).filter(g => g.trim() && !/^none\b/i.test(g.trim()));
    // Aromatic garnish lines (nutmeg, mint) count as garnish too.
    C.garnishAll = [...C.garnish, ...C.garnishLines.map(l => nameOf(l.id))];
    C.garnishHas = item => C.garnishAll.some(g => garnishMatches(g, item));
    C.name = String(recipe.name || '');
    C.tagline = String(recipe.tagline || '');
    C.tasting = String((recipe.explanation && recipe.explanation.tasting) || '');
    C.copyText = [C.name, C.tagline, C.tasting].join(' \n ');
    C.prompt = String((intent && intent.raw) || recipe.prompt || '');
    C.style = { ...(recipe.style || {}), ...((intent && intent.style) || {}) };
    C.asks = w => mentions(C.prompt, w).pos;
    C.asksAny = ws => ws.some(w => C.asks(w));
    // What the guest ruled out: the parsed intent if we have it, else "no X" / "X-free" in the prayer.
    const avoidIngs = new Set(intent && intent.avoidIngs ? [...intent.avoidIngs] : []);
    const avoidTags = new Set(Object.entries((intent && intent.avoidTags) || {}).filter(([, w]) => w > 0).map(([t]) => t));
    for (const [word, tag, ids] of FOOD) {
      if (word === 'berr' || word === 'butter') continue;
      if (mentions(C.prompt, word).neg) { avoidTags.add(tag); for (const id of ids || []) avoidIngs.add(id); }
    }
    if (mentions(C.prompt, 'nut').neg) { avoidTags.add('almond'); avoidTags.add('nutty'); }
    C.avoidIngs = avoidIngs;
    C.avoidTags = avoidTags;
    // Strength asked for: the parsed number, else the prayer's words.
    if (intent && typeof intent.strength === 'number') C.strengthAsk = intent.strength;
    else C.strengthAsk = C.asksAny(['strongest', 'booziest', 'most potent']) ? 2 : C.asksAny(['strong', 'potent', 'dangerous', 'boozy', 'two per customer']) ? 1.2
      : C.asksAny(['low abv', 'low-abv', 'low proof', 'session', 'sessionable', 'brunch', 'light']) ? -1.2 : 0;
    C.zeroProof = !!C.style.zeroProof || C.asksAny(['zero-proof', 'zero proof', 'alcohol-free', 'alcohol free', 'mocktail', 'designated driver', 'non-alcoholic', 'virgin']);
    // styleOverrides.*.appliesWhen.prayerAsks, read negation-aware ("not too strong" is neither).
    C.lowAbv = !C.zeroProof && C.asksAny(['low abv', 'low-abv', 'low proof', 'low-proof', 'low alcohol', 'session', 'sessionable', 'brunch', 'light', 'day drinking']);
    C.strongest = !C.zeroProof && !C.lowAbv && (C.strengthAsk >= 1.2 || C.asksAny(['strongest', 'strong', 'dangerous', 'potent']));
    C.stats = computeStats(C, recipe.stats || {});
    // The look: body plus any layer big enough to see.
    const look = recipe.look || null;
    C.look = look;
    C.hues = look && look.body ? [look.body, ...(look.layers || []).filter(x => x && x.kind !== 'foam' && (x.frac || 0) >= 0.08)].map(x => hsl(x.hex)).filter(Boolean) : [];
    C.bodyHue = look && look.body ? hsl(look.body.hex) : null;
    return C;
  }

  // Per-serving chemistry. Uses the engine's stats where given; always counts spirit and ethanol.
  function computeStats(C, given) {
    let vol = 0, alc = 0, sugar = 0, acid = 0, spirit = 0;
    for (const l of C.poured) {
      const ing = l.ing;
      if (!ing) continue;
      const ml = l.oz * 29.5735;
      vol += l.oz;
      alc += l.oz * (ing.abv || 0) / 100;
      sugar += ml * (ing.sugar || 0) / 100;
      acid += ml * (ing.acid || 0) / 100;
      if (S('spirits').has(l.id)) spirit += l.oz;
    }
    const abvPre = vol > 0 ? alc / vol : 0;
    const dil = dilutionFactor(C.method, C.ice, abvPre);
    const finalOz = vol * (1 + dil);
    const finalMl = finalOz * 29.5735;
    const fin = (k, v) => (Number.isFinite(given[k]) ? given[k] : v);
    return {
      volOz: fin('volOz', vol),
      finalOz: fin('finalOz', finalOz),
      abv: fin('abv', finalOz > 0 ? alc / finalOz * 100 : 0),
      sugarConc: fin('sugarConc', finalMl > 0 ? sugar / finalMl * 100 : 0),
      acidConc: fin('acidConc', finalMl > 0 ? acid / finalMl * 100 : 0),
      sweetSour: given.sweetSour === null ? null : fin('sweetSour', acid > 0.05 ? sugar / acid : null),
      ethanolOz: alc, spiritOz: spirit, sugarG: sugar, acidG: acid,
    };
  }

  // ---------- 1. dose caps and minimum doses ----------
  const BITTERS = new Set(['angostura', 'peychauds', 'orange-bitters', 'tiki-bitters', 'mole-bitters']);
  const DOSE_ID = { pastis: 'anise-overdose', absinthe: 'anise-overdose', 'allspice-dram': 'allspice-overdose', 'green-chartreuse': 'chartreuse-overdose', grenadine: 'grenadine-for-color', 'rum-jamaican-white-overproof': 'jamaican-white-overproof-base', fernet: 'smoky-bitter-bomb', 'scotch-islay': 'smoky-bitter-bomb', coffee: 'brewed-coffee-cold-stirred' };
  const DOSE_SEV = { 'anise-overdose': 'fatal', 'bitters-overdose': 'major', 'allspice-overdose': 'major', 'chartreuse-overdose': 'minor', 'grenadine-for-color': 'major', 'jamaican-white-overproof-base': 'minor', 'smoky-bitter-bomb': 'minor', 'brewed-coffee-cold-stirred': 'major' };
  function checkDoses(C, add) {
    for (const [id, cap] of Object.entries(R.doseCaps || {})) {
      if (!C.has(id) || typeof cap.maxOz !== 'number') continue;
      // The Zombie's grenadine is judged by zombie-red-or-creamy (fatal), not here.
      if (id === 'grenadine' && C.fam === 'zombie') continue;
      for (const l of C.poured.filter(x => x.id === id)) {
        let max = cap.maxOz, why = '';
        if (cap.byFamily && C.fam in cap.byFamily) { max = cap.byFamily[C.fam]; why = ` in a ${C.fam}`; }
        if (id === 'pastis' || id === 'absinthe') {
          if (l.unit === 'rinse') { max = Math.max(max, 0.1); why = ' as a rinse'; }
          if (C.asksAny(['anise', 'absinthe', 'pastis', 'licorice', 'herbsaint', 'pernod'])) { max = Math.max(max, 0.25); why = ' even for an anise-forward drink'; }
        }
        if (id === 'angostura') {
          if ((C.method === 'swizzle' || l.crown) && C.crushed) { max = Math.max(max, 0.25); why = ' even as a crown'; }
          if (/bitters/.test(C.archId) || /bitters/i.test(C.archName)) { max = Math.max(max, 1.5); why = ' even in a bitters-base sour'; }
        }
        if (id === 'maraschino' && C.fam === 'zombie') max = Math.max(max, 0.75);
        if (id === 'grenadine') {
          if (l.sink) { max = Math.max(max, 0.5); why = ' even as a sink'; }
          if (/dr\.?\s*funk/i.test(C.name + ' ' + C.archName)) max = Math.max(max, 1);
        }
        if (id === 'green-chartreuse' && (/herbal-swizzle|chartreuse/.test(C.archId) || /chartreuse swizzle/i.test(C.name + ' ' + C.archName))) max = Math.max(max, 1.5);
        if (id === 'fernet' && C.asksAny(['fernet', 'bitter', 'medicinal', 'amaro'])) max = Math.max(max, 0.5);
        if (id === 'scotch-islay' && C.asksAny(['smoky', 'smoke', 'smoked', 'peat', 'peaty', 'islay', 'scotch'])) max = Math.max(max, 2);
        if (id === 'blue-curacao' && (C.archId === 'blue-hawaii' || /blue hawaii/i.test(C.name + ' ' + C.archName + ' ' + C.prompt))) max = Math.max(max, 1);
        if (id === 'rum-jamaican-white-overproof' && C.asksAny(['overproof', 'wray', 'rum fire', 'rum-fire'])) max = Math.max(max, 1.5);
        if (id === 'coffee' && C.method === 'hot') max = Math.max(max, (cap.byFamily && cap.byFamily.hot) || 6);
        if (id === 'amontillado-sherry' && (C.lowAbv || C.asks('sherry'))) max = Math.max(max, 2);
        if (l.oz <= max + EPS) continue;
        const rid = DOSE_ID[id] || (BITTERS.has(id) ? 'bitters-overdose' : 'dose-cap');
        const sev = DOSE_SEV[rid] || (S('seasonings').has(id) ? 'major' : 'minor');
        let msg;
        if (rid === 'anise-overdose') msg = `${oz(l.oz)} of ${nameOf(id)} turns the whole drink to licorice; anise goes in by the drop (Don used six), never more than ${oz(max)}${why}.`;
        else if (rid === 'bitters-overdose') msg = `${oz(l.oz)} of ${nameOf(id)} washes the drink brown and medicinal; ${max >= 0.2 ? oz(max) : `${Math.round(max / 0.03)} dashes`} is the ceiling${why}.`;
        else if (rid === 'grenadine-for-color') msg = max === 0 ? `Grenadine has no place in a Mai Tai; it turns it pink and candy-sweet.` : `${oz(l.oz)} of grenadine is colouring, not seasoning: keep it to ${oz(max)}${why}, or pour it last as a deliberate sink.`;
        else if (rid === 'brewed-coffee-cold-stirred') msg = `${oz(l.oz)} of brewed coffee in a cold drink is watery and flat; use coffee liqueur or a cold-brew splash, or make it a hot drink.`;
        else msg = `${oz(l.oz)} of ${nameOf(id)} is past the ${oz(max)} it can carry${why}; it will take over the drink.`;
        add(rid, sev, msg, { lines: [id], fix: cap.typical ? `typical dose: ${cap.typical}` : undefined });
      }
    }
    const MIN = R.minDoseIfPresent || {};
    for (const l of C.poured) {
      const min = MIN[l.id];
      if (typeof min !== 'number' || l.oz <= 0 || l.oz >= min - EPS) continue;
      if (l.id === 'soda-water' && l.oz >= 0.75 - EPS && ['grog', 'beachcomber-sour', 'punch'].includes(C.fam) && ['shake', 'flash-blend'].includes(C.method)) continue; // Navy Grog's ¾ oz in the shaker
      if (l.id === 'lime' && l.oz >= 0.08 - EPS && (C.archId === 'ti-punch' || /ti'? ?punch/i.test(C.name))) continue; // the Ti' Punch lime coin
      const carb = S('carbonated').has(l.id);
      add('micro-dose-bulk', 'minor', carb
        ? `${oz(l.oz)} of ${nameOf(l.id)} isn't a top; under ${oz(min)} the fizz just disappears.`
        : `${oz(l.oz)} of ${nameOf(l.id)} adds a line to the card and nothing to the glass; use at least ${oz(min)} or drop it.`, { lines: [l.id] });
    }
  }

  // A carbonated or sparkling line poured last rather than shaken in.
  const TOP_KEY = { 'soda-water': 'soda', 'ginger-beer': 'ginger beer', 'ginger-ale': 'ginger ale', 'lemon-lime-soda': 'lemon-lime', 'sparkling-wine': 'sparkling|champagne|prosecco|cava', cola: 'cola', tonic: 'tonic' };
  function isTop(C, l) {
    if (l.top || l.unit === 'top' || l.float) return true;
    const key = new RegExp(TOP_KEY[l.id] || esc(fold(nameOf(l.id))));
    return C.steps.some(s => { const f = fold(s); return key.test(f) && (/\btop(ped)?\b|\bfinish with\b|\blengthen with\b|\bexcept the\b/.test(f)); });
  }

  // ---------- 2. exclusive groups ----------
  const EXCL = {
    orangeLiqueurs: ['two-orange-liqueurs', n => `${n} are orange liqueurs doing one job; keep one.`],
    plainSyrups: ['two-plain-syrups', n => `${n} are the same sweetener twice; keep one plain syrup.`],
    coconutSources: ['coconut-pileup', n => `${n}: that many coconut sources is cloying and muddy; one cream of coconut, plus at most ½ oz coconut rum.`],
    redFruit: ['redundant-red-fruit', n => `${n}: more than two red-fruit sweeteners reads as generic red punch.`],
    passionSources: ['passion-pileup', n => `${n}: three passion fruit sources is redundant; syrup or purée plus one other at most.`],
    bitterLiqueurs: ['bitter-stack', n => `${n}: aggressive bitter liqueurs fight each other outside a bitter tiki drink; keep one.`],
    anise: ['anise-stack', n => `${n}: one anise source is plenty.`],
    overproof: ['overproof-overdose', n => `${n}: two different overproofs in one drink is dangerous, not just strong; one overproof at ¾–1 oz.`],
    spiceCarriers: ['spice-sludge', n => `${n}: more than three spice carriers is pumpkin-latte mud; pick two spices.`],
  };
  function checkExclusive(C, add) {
    for (const g of R.exclusiveGroups || []) {
      if (g.allowFamilies && g.allowFamilies.includes(C.fam)) continue;
      const found = C.anyIn(g.set ? S(g.set) : g.ids || []);
      const max = (g.maxByFamily && g.maxByFamily[C.fam]) ?? g.max;
      if (found.length <= max) continue;
      let id, msg;
      if (g.set && EXCL[g.set]) [id, msg] = [EXCL[g.set][0], EXCL[g.set][1](names(found))];
      else if ((g.ids || []).includes('lime')) [id, msg] = ['lemon-and-lime', `Lemon and lime together pull against each other in a ${C.fam || 'drink like this'}; pick one citrus.`];
      else [id, msg] = ['dairy-stack', `${names(found)} do the same creamy job twice; keep one.`];
      add(id, g.sev || 'minor', msg, { lines: found });
    }
    // The coconut pile-up the generator actually made: coconut rum + cream of coconut + dairy.
    if (C.has('coconut-rum') && C.has('coconut-cream') && C.anyIn(S('allDairy')).length)
      add('coconut-pileup', 'major', `Coconut rum, cream of coconut and ${names(C.anyIn(S('allDairy')))} is a cloying pile-up; one cream of coconut does the job.`, { lines: ['coconut-rum', 'coconut-cream', ...C.anyIn(S('allDairy'))] });
  }

  // ---------- 3. incompatibilities ----------
  const cmpOz = (x, spec) => {
    const m = /^(>=|>|<=|<)\s*([\d.]+)/.exec(String(spec || '').trim());
    if (!m) return true;
    const v = Number(m[2]);
    return m[1] === '>=' ? x >= v - EPS : m[1] === '>' ? x > v + EPS : m[1] === '<=' ? x <= v + EPS : x < v - EPS;
  };
  function checkIncompat(C, add) {
    const copy = fold(C.copyText);
    for (const inc of R.incompatibilities || []) {
      let B = idsOf(inc.b);
      if (inc.id === 'blue-goes-green') B = B.filter(id => !S('darkSpirits').has(id)); // blue + dark rum has its own (fatal) rule
      const aHit = C.anyIn(idsOf(inc.a)), bHit = C.anyIn(B);
      if (!aHit.length || !bHit.length) continue;
      const aOz = C.ozIn(aHit), bOz = C.ozIn(bHit);
      if (inc.whenOzA && !cmpOz(aOz, inc.whenOzA)) continue;
      if (inc.whenOzB && !cmpOz(bOz, inc.whenOzB)) continue;
      const u = inc.unless || {};
      if (u.method && u.method.includes(C.method)) continue;
      if (u.layered && C.poured.some(l => (aHit.includes(l.id) || bHit.includes(l.id)) && (l.float || l.sink))) continue;
      if (u.carbonatedIsTop && C.poured.filter(l => bHit.includes(l.id)).every(l => isTop(C, l))) continue;
      const callsBlue = /\bblue\b/.test(copy.replace(/blue hawaii(an)?/g, ''));
      if (inc.allowIfCopyColor && !callsBlue && inc.allowIfCopyColor.some(w => hasWord(copy, w))) continue;
      if (inc.id === 'blue-goes-green' && C.hues.some(h => HUE.blue(h))) continue; // the computed look still reads blue at these doses
      const a = names(aHit), b = names(bHit);
      const msg = {
        'casein-plus-citrus': `${a} with ${b} curdles in the glass: casein splits below about pH 5.5 (the Cement Mixer effect).`,
        'casein-plus-mild-acid': `${a} with ${b} slowly curdles and turns bitter if it sits; blend it and serve at once.`,
        'heavy-cream-plus-heavy-citrus': `Heavy cream with ${oz(bOz)} of ${b} risks a split, grainy texture; keep the citrus to ½ oz, or use coconut.`,
        'coffee-citrus-mud': `${a} with ${oz(bOz)} of ${b}: brown and sour clash. Coffee wants coconut, cream, spice or orange peel.`,
        'blue-plus-red': `Blue curaçao stirred into ${b} turns purple-brown mud; sink the red or float the blue over a pale base.`,
        'blue-goes-green': `Blue curaçao with ${b} reads green or teal, not blue (blue plus yellow is green)${callsBlue ? ', yet the copy calls it blue' : ''}; call it aqua or turquoise, or build the blue on a clear base.`,
        'blue-plus-dark-rum': `Blue curaçao with ${b} is swamp green-brown in the glass; a blue drink needs a clear base.`,
        'midori-orange-mud': `Melon liqueur with ${b} goes olive-brown; pair melon with pineapple, lime or a clear base.`,
        'spiced-rum-plus-spice-stack': `Spiced rum plus ${b} stacks vanilla spice on spice; build the spice from one real modifier.`,
        'passion-plus-full-lime': `Passion fruit purée already brings acid; with ${oz(bOz)} of ${b} as well it turns sharp. Cut the citrus by about the purée's lime-equivalent.`,
        'egg-with-carbonation-shaken': `Egg white shaken with ${b} loses both the foam and the fizz; shake the egg, then top with the bubbles.`,
      }[inc.id] || `${a} with ${b}: ${inc.why || 'a known clash'}.`;
      add(inc.id, inc.sev || 'minor', msg, { lines: [...aHit, ...bHit] });
    }
  }

  // ---------- 4. method rules ----------
  const MR = Object.fromEntries((R.methodRules || []).map(r => [r.id, r]));
  const VERB = { shake: 'shaken', 'flash-blend': 'flash-blended', blend: 'blended', swizzle: 'swizzled', stir: 'stirred', build: 'built', 'muddle-build': 'built', hot: 'served hot' };
  // A swizzle is built in the glass on crushed ice: shaken-and-strained or cubed is no swizzle at
  // all (fatal); another method on crushed ice is a mismatch (major).
  function swizzleProblem(C) {
    if (C.method === 'swizzle' && ['crushed', 'pebble', 'shaved'].includes(C.ice)) return null;
    if (['cubed', 'block', 'none'].includes(C.ice) || (['shake', 'stir'].includes(C.method) && !C.crushed)) return 'fatal';
    return 'major';
  }
  function checkMethod(C, add) {
    const carb = new Set(idsOf((MR['shaken-carbonation'] || {}).ids || 'carbonated'));
    for (const rid of ['shaken-carbonation', 'sparkling-shaken']) {
      const r = MR[rid];
      if (!r || !r.forbiddenMethods.includes(C.method)) continue;
      const ids = rid === 'sparkling-shaken' ? new Set(idsOf(r.ids)) : new Set([...carb].filter(id => !(MR['sparkling-shaken'] && idsOf(MR['sparkling-shaken'].ids).includes(id))));
      for (const l of C.poured.filter(x => ids.has(x.id))) {
        if (r.unlessTop && isTop(C, l)) continue;
        const sd = r.smallDoseException;
        if (sd && sd.ids.includes(l.id) && l.oz <= sd.maxOz + EPS && sd.families.includes(C.fam)) continue;
        add(rid, r.sev || 'fatal', `${oz(l.oz)} of ${nameOf(l.id)} ${VERB[C.method] || C.method} with the rest: carbonation is never shaken or blended (it blows the tin and the fizz is gone). Shake the rest, then top with the ${nameOf(l.id)} and lift once.`, { lines: [l.id], fix: 'shake the rest, strain, top with the carbonated mixer' });
      }
    }
    const icr = MR['ice-cream-shaken'];
    if (icr && C.has('vanilla-ice-cream') && !icr.requiredMethod.includes(C.method))
      add('ice-cream-shaken', icr.sev || 'major', `Ice cream ${VERB[C.method] || C.method} doesn't emulsify; ice cream drinks are blended.`, { lines: ['vanilla-ice-cream'] });
    const swj = MR['stirred-with-juice'];
    if (swj && swj.when.method.includes(C.method)) {
      const bad = C.poured.filter(l => swj.forbidIds.includes(l.id) && !(swj.maxOzException && l.oz <= (swj.maxOzException[l.id] ?? -1) + EPS));
      if (bad.length) add('stirred-with-juice', swj.sev || 'major', `A stirred drink with ${names(bad.map(l => l.id))}: juice, dairy and egg need shaking to mix and aerate. Shake it, or take them out.`, { lines: bad.map(l => l.id) });
    }
    const hot = MR['hot-wrong'];
    if (hot && C.method === 'hot') {
      if (C.ice !== 'none') add('hot-wrong', hot.sev || 'fatal', `A hot drink on ${C.ice} ice is neither hot nor cold; hot drinks take no ice.`);
      const fizz = C.anyIn(idsOf(hot.forbidIds));
      if (fizz.length) add('hot-wrong', hot.sev || 'fatal', `${names(fizz)} in a hot drink goes flat at once; no carbonation in a hot drink.`, { lines: fizz });
      for (const [id, max] of Object.entries(hot.maxOz || {})) {
        const x = C.ozOf(id);
        if (x > max + EPS) add('hot-wrong', hot.sev || 'fatal', `${oz(x)} of ${nameOf(id)} in a hot drink is harsh and splits butter or cream; use peel instead${max > 0 ? `, or at most ${oz(max)}` : ''}.`, { lines: [id] });
      }
      const safe = S(hot.requireVessel || 'heatSafeVessels').has(C.vId) || (C.v && (C.v.serve || []).includes('hot')) || (C.vId === 'punch-bowl' && C.servings >= 2);
      if (C.vId && !safe) add('hot-vessel-unsafe', 'major', `A hot drink in a ${(C.v && C.v.name) || C.vId} isn't safe; use a preheated toddy mug or an Irish coffee glass.`);
    }
    if (C.fam === 'swizzle') {
      const p = swizzleProblem(C);
      if (p === 'fatal') add('swizzle-not-swizzled', 'fatal', `A swizzle ${VERB[C.method] || C.method} on ${C.ice} ice isn't a swizzle: the method is the name. Build it in the glass and swizzle it over crushed ice until the glass frosts.`);
      else if (p === 'major') add('swizzle-method-mismatch', 'major', `A swizzle that is ${VERB[C.method] || C.method} rather than swizzled in the glass; spin a swizzle stick through crushed ice until the glass frosts.`);
    }
    const crushedService = C.method === 'flash-blend' || (C.method === 'shake' && ['crushed', 'pebble', 'shaved'].includes(C.ice));
    const iceShell = (C.ice === 'shaved' && C.vId === 'coupe') || C.archId === 'beachcombers-gold' || C.garnishHas('ice shell');
    if (crushedService && S('upVessels').has(C.vId) && !iceShell)
      add('flash-blend-up', 'major', `A ${C.method === 'flash-blend' ? 'flash-blended' : 'crushed-ice'} drink poured into a ${(C.v && C.v.name) || C.vId}: there's nowhere for the ice to go. Open-pour it into a crushed-ice vessel, or shake with cubes and strain it up.`);
    const fz = MR['frozen-vessel'];
    if (fz && C.method === 'blend' && C.vId && !fz.allowedVessels.includes(C.vId))
      add('frozen-no-mound', fz.sev || 'minor', `A frozen drink in a ${(C.v && C.v.name) || C.vId} has no room for a proud mound; use a poco grande, hurricane, goblet or a coupe.`);
    const soc = MR['stirred-on-crushed'];
    if (soc && soc.when.family.includes(C.fam) && soc.forbidIce.includes(C.ice))
      add('stirred-on-crushed', soc.sev || 'major', `A stirred, spirit-forward drink on ${C.ice} ice drowns in minutes; serve it on one large block, or up.`);
    if (C.has('egg-white') && C.method !== 'flash-blend' && C.steps.length && !/dry[- ]?shake|reverse dry|without ice/.test(C.stepsText))
      add('egg-no-dry-shake', 'minor', `Egg white shaken straight on ice never foams properly; dry-shake it first (or flash-blend).`, { lines: ['egg-white'] });
    if (C.vId === 'punch-bowl' && !['block', 'cubed'].includes(C.ice))
      add('punchbowl-crushed', 'minor', `A ladled punch bowl on ${C.ice} ice is drowned in twenty minutes; build it over one large block.`);
    // Layering claims need a float or sink line (a bitters crown counts as a gradient, not a float).
    const crown = C.poured.some(l => l.crown) || (C.method === 'swizzle' && C.poured.some(l => BITTERS.has(l.id)) && C.crushed);
    const layered = C.poured.some(l => l.float || l.sink);
    if (!layered) {
      const claims = [];
      for (const [w, crownOk] of [['layered', 1], ['layers', 1], ['sunrise', 0], ['gradient', 1], ['ombre', 1], ['two-tone', 1], ['float', 0], ['floats', 0], ['floated', 0], ['sink', 0], ['sinks', 0]])
        if (hasWord(C.copyText, w) && !(crownOk && crown)) claims.push(w);
      if (claims.length) add('layer-claim-shaken', 'major', `The copy promises ${list(claims.map(w => `"${w}"`))}, but nothing is floated or sunk: everything is ${VERB[C.method] || 'mixed'} together. Add a final float or sink, or change the words.`);
    }
    for (const l of C.poured.filter(x => x.float)) {
      const ing = l.ing || {};
      if (!((ing.abv >= 35 && (ing.sugar || 0) <= 10) || (l.id === 'amontillado-sherry' && C.crushed)))
        add('float-too-dense', 'major', `A float of ${nameOf(l.id)} won't float: at ${ing.abv || 0}% ABV and ${ing.sugar || 0} g sugar it is heavier than the drink and sinks. Float a high-proof, dry spirit instead.`, { lines: [l.id] });
    }
    for (const l of C.poured.filter(x => x.sink)) {
      const ing = l.ing || {};
      if (!((ing.sugar || 0) >= 25 && (ing.abv || 0) <= 30))
        add('sink-too-light', 'major', `${cap(nameOf(l.id))} can't sink: it isn't dense enough. Sink a sugary syrup or liqueur (grenadine, cassis).`, { lines: [l.id] });
    }
    const mint = C.poured.some(l => l.id === 'mint' && (l.muddled || C.method === 'muddle-build'));
    if (mint && C.isUp && C.steps.length && !/fine[- ]strain|double[- ]strain/.test(C.stepsText))
      add('mint-shredded-or-unstrained', 'minor', `Muddled mint in a drink served up needs a fine strain, or the guest drinks shredded leaves.`, { lines: ['mint'] });
  }

  // ---------- 5. vessel fit and service ----------
  const vName = C => (C.v && C.v.name) || C.vId;
  function checkVessel(C, add) {
    if (!C.vId) return;
    const vf = R.vesselFit || {};
    const range = (vf.ranges || {})[C.vId];
    const sev = vf.sev || { overflow: 'fatal', stingy: 'major' };
    // The ranges are the comfortable fill (research §1.5). Below them is stingy (major). Above them
    // is crowded (major); it overflows (fatal) only when it physically can't fit: iced liquid past
    // 75% of the vessel, a frozen drink that blends past a proud mound, or a finished up drink
    // bigger than the glass. (Hard-capping at the range would reject the 1973 Jungle Bird.)
    const total = C.isBowlVessel ? C.stats.volOz * C.servings : C.stats.volOz;
    const forN = C.isBowlVessel && C.servings > 1 ? ` for ${C.servings}` : '';
    const capOz = C.v && C.v.capacity;
    const upService = (C.isUp || C.ice === 'none') && !C.isBowlVessel && C.method !== 'blend' && !(C.ice === 'shaved' && C.vId === 'coupe');
    let overflow = false;
    if (capOz && upService && C.stats.finalOz > capOz + 0.1) {
      overflow = true;
      add('volume-overflow', sev.overflow, `${oz(C.stats.finalOz)} finished, served without ice, in a ${capOz} oz ${vName(C)}: it won't fit.`);
    } else if (capOz && C.method === 'blend' && total * 1.9 > capOz * 1.15) {
      overflow = true;
      add('volume-overflow', sev.overflow, `${oz(total)} of liquid blends with its ice to about ${oz(total * 1.9)}, more than a ${capOz} oz ${vName(C)} holds even with a mound; choose a bigger vessel or scale it down.`);
    } else if (capOz && !upService && C.method !== 'blend' && total > capOz * 0.75 + EPS) {
      overflow = true;
      add('volume-overflow', sev.overflow, `${oz(total)} of liquid${forN} in a ${capOz} oz ${vName(C)} leaves no room for the ice; it overflows. Choose a bigger vessel or scale it down.`);
    }
    if (range) {
      const [lo, hi] = range;
      const tol = Math.max(0.25, hi * 0.03);
      if (!overflow && total > hi + tol) add('volume-crowded', 'major', `${oz(total)} of liquid${forN} crowds a ${vName(C)} (it takes ${lo}–${hi} oz before ice); choose a bigger vessel or scale it down.`);
      else if (total < lo - tol) add('volume-stingy', sev.stingy, `${oz(total)} of liquid${forN} in a ${vName(C)} (it wants ${lo}–${hi} oz) looks like a mistake at the bottom of the glass; use a smaller vessel or scale it up.`);
    }
    if (C.ice === 'none' && C.method !== 'hot' && S('opaqueVessels').has(C.vId))
      add('up-drink-in-mug', 'major', `A drink strained up with no ice, hidden in a ${vName(C)}; serve it in a coupe or Nick & Nora, or fill the mug with crushed ice.`);
    if (C.fam === 'colada' && S('upVessels').has(C.vId) && C.method !== 'stir')
      add('colada-in-coupe', 'minor', `A colada served up in a ${vName(C)}; it belongs in a hurricane, poco grande, coconut or pineapple.`);
    if (['coconut', 'pineapple'].includes(C.vId) && (!['crushed', 'pebble', 'shaved', 'blended', 'ice-cone'].includes(C.ice) || C.method === 'stir'))
      add('fruit-vessel-for-up', 'major', `A ${vName(C)} is for a long crushed-ice or frozen drink, not a ${C.method === 'stir' ? 'stirred' : `${C.ice}-ice`} one.`);
    if (C.ice === 'ice-cone' && ((C.fam !== 'grog' && !C.asks('ice cone')) || !['dof', 'rocks'].includes(C.vId)))
      add('ice-cone-misuse', 'minor', `The ice cone is the Navy Grog's signature, served in a double old fashioned; here it's on a ${C.fam || 'non-grog'} drink in a ${vName(C)}.`);
    if ((C.isBowlVessel || hasWord(C.name, 'bowl')) && C.servings < ((R.styleOverrides && R.styleOverrides.bowl && R.styleOverrides.bowl.minServings) || 2))
      add('bowl-single', 'major', `A bowl for one: bowls are communal. Scale it to at least two servings, or pour it into a glass.`);
  }

  // ---------- 6. component counting ----------
  const CC = R.componentCounting || {};
  const isSeasoning = l => (CC.seasoningUnits || []).includes(l.unit) || S('seasonings').has(l.id);
  function checkComponents(C, add) {
    const n = C.poured.length;
    const max = Math.min((W[C.fam] && W[C.fam].maxComponents) || 11, 11);
    if (n > max) add('too-many-cooks', 'major', `${n} components where a ${C.fam || 'drink'} carries ${max} at most: too many cooks. Give each job (base, acid, sweetener, body, accent) one ingredient.`);
    const small = C.poured.filter(l => !isSeasoning(l) && l.oz > 0 && l.oz <= 0.25 + EPS);
    const lim = C.fam === 'zombie' ? CC.maxNonSeasoningAtOrBelowQuarterOzZombie ?? 4 : CC.maxNonSeasoningAtOrBelowQuarterOz ?? 3;
    if (small.length > lim) add('quarter-ounce-soup', 'major', `${small.length} pours at a quarter ounce or less (${names(small.map(l => l.id))}): that's mud, not complexity. Fold them into two or three real modifiers.`, { lines: small.map(l => l.id) });
    const MIN = R.minDoseIfPresent || {};
    for (const l of C.poured) {
      if (isSeasoning(l) || l.muddled || !(l.oz > 0) || l.oz >= 0.25 - EPS || l.id in MIN || S('accentsAllowedBelowQuarter').has(l.id)) continue;
      add('micro-dose-accent', 'minor', `${oz(l.oz)} of ${nameOf(l.id)} is too little to taste; give it a quarter ounce or drop it.`, { lines: [l.id] });
    }
    const mcs = CC.minCoreShare;
    if (mcs && !(mcs.exemptFamilies || []).includes(C.fam) && !C.zeroProof && C.stats.volOz > 0) {
      const spirits = sum(C.poured.filter(l => S('spirits').has(l.id) && !l.float).map(l => l.oz));
      const top = role => Math.max(0, ...C.poured.filter(l => l.ing && role.includes(l.ing.role) && !S('spirits').has(l.id)).map(l => l.oz));
      const core = spirits + top(['sour']) + top(['juice', 'rich', 'lengthener']);
      const share = core / C.stats.volOz;
      if (share < mcs.value - 0.02) add('core-share-low', 'minor', `Base, citrus and body make up only ${Math.round(share * 100)}% of the drink; the modifiers are running it. Aim for ${Math.round(mcs.value * 100)}% or more.`);
    }
  }

  // ---------- 7. strength ----------
  function abvBand(C) {
    const so = R.styleOverrides || {};
    if (C.zeroProof && so.zeroProof) return [so.zeroProof.abv, 'zero-proof drink'];
    if (C.lowAbv && so.lowAbv) return [so.lowAbv.abv, 'low-ABV drink'];
    if (C.strongest && so.strongest) return [so.strongest.abv, '"strongest" request'];
    // A blended colada is mostly pineapple, coconut and ice: by the frozen dilution model
    // (water about equal to the poured volume) a 2 oz Caribe Hilton lands near 4–5%.
    if (C.method === 'blend' && so.frozen && C.fam === 'colada') return [[4, so.frozen.abv[1]], 'frozen colada'];
    if (C.method === 'blend' && so.frozen) return [so.frozen.abv, 'frozen drink'];
    if (C.isBowlVessel && so.bowl) return [so.bowl.abv, 'bowl'];
    return [W[C.fam] && W[C.fam].abv, FAM_LABEL[C.fam] || C.fam];
  }
  function checkStrength(C, add) {
    const st = R.strength || {};
    const so = R.styleOverrides || {};
    const bases = C.poured.filter(l => S('spirits').has(l.id) && l.oz > 0);
    for (const l of C.poured.filter(x => overproof.has(x.id))) {
      const sole = !bases.some(b => !overproof.has(b.id));
      const max = sole ? st.maxOverproofOzSoleBase ?? 1.5 : st.maxOverproofOz ?? 1;
      if (l.oz > max + EPS) add('overproof-overdose', 'fatal', `${oz(l.oz)} of ${nameOf(l.id)}: overproof is a seasoning dose, ¾–1 oz${sole ? ' (1½ as the only rum of a small drink)' : ''}, never a pour.`, { lines: [l.id] });
    }
    const maxAll = st.maxSpiritOzSingle ?? 4;
    if (C.stats.spiritOz > maxAll + EPS) add('overproof-overdose', 'fatal', `${oz(C.stats.spiritOz)} of spirit in one serving is past the Zombie's own ceiling of ${maxAll} oz; that's dangerous, not strong.`, { lines: bases.map(l => l.id) });
    // The 1934 Zombie, the reference ceiling, carries about 2.07 oz of ethanol: allow 7.5%.
    const ethCap = Math.min(st.maxEthanolOzSingle ?? 2, (C.strongest && so.strongest && so.strongest.maxEthanolOz) || Infinity) * 1.075;
    if (C.stats.ethanolOz > ethCap) add('overproof-overdose', 'fatal', `About ${r2(C.stats.ethanolOz)} oz of pure alcohol in one serving, more than the 1934 Zombie (Don limited that to two per customer).`);
    let famMax = (W[C.fam] && W[C.fam].maxSpiritOz) || maxAll, why = C.fam ? `a ${C.fam}` : 'this drink';
    if (C.method === 'blend' && so.frozen && so.frozen.maxSpiritOz < famMax) { famMax = so.frozen.maxSpiritOz; why = 'a frozen drink (it won\'t hold its texture)'; }
    if (C.isBowlVessel && so.bowl && so.bowl.maxSpiritOzPerGuest < famMax) { famMax = so.bowl.maxSpiritOzPerGuest; why = 'a bowl, per guest'; }
    if (C.stats.spiritOz > famMax + EPS && C.stats.spiritOz <= maxAll + EPS)
      add('spirit-heavy', 'major', `${oz(C.stats.spiritOz)} of spirit is more than ${why} carries (${famMax} oz).`, { lines: bases.map(l => l.id) });
    const [band, label] = abvBand(C);
    const abv = C.stats.abv;
    if (C.zeroProof && abv > 0.5) {
      add('zero-proof-has-alcohol', 'fatal', `Promised zero-proof, but it pours at ${r2(abv)}% ABV (${names(C.poured.filter(l => (l.ing || {}).abv > 0.5).map(l => l.id))}); a designated driver has to be able to trust it.`);
    } else if (band && (abv < band[0] - 0.5 || abv > band[1] + 0.5)) {
      add('abv-out-of-band', 'major', `${r2(abv)}% ABV is ${abv < band[0] ? 'below' : 'above'} the ${band[0]}–${band[1]}% ${an(label)} should land in after dilution.`);
    }
    if (C.zeroProof) {
      const body = C.anyIn(['black-tea', 'coconut-cream', 'coconut-milk', 'coconut-water', 'ginger-beer', 'passion-fruit-nectar', 'guava-nectar', 'mango-nectar', 'papaya-nectar', 'apricot-nectar', 'pineapple-juice']);
      if (C.stats.acidConc < 0.45 || !body.length)
        add('zero-proof-structure', 'minor', `A zero-proof drink still needs ${C.stats.acidConc < 0.45 ? 'real acid' : 'body (tea, coconut, a nectar or ginger beer)'} to stand in for the rum.`);
    }
  }

  // ---------- 8. family requirements, name nouns, classic names, family labels ----------
  const SET_WORD = { rums: 'rum', agedOrFunkyRum: 'an aged or Jamaican rum', spirits: 'spirit', overproof: 'an overproof rum', bulkJuices: 'a juice or nectar', carbonated: 'a carbonated mixer' };
  const orList = spec => typeof spec === 'string' && SET_WORD[spec] ? SET_WORD[spec] : [...new Set(idsOf(spec))].map(nameOf).join(' or ');
  const SPIRIT_SETS = new Set(['spirits', 'rums', 'agedOrFunkyRum', 'overproof']);
  // One requirement clause -> { ok, what, absent }: absent means none of its ingredients is there
  // at all (a defining component missing); otherwise it is there but under the canonical dose.
  function clause(C, cl, famId) {
    if (SPIRIT_SETS.has(cl.anyOf) || SPIRIT_SETS.has(cl.countOf)) {
      if (C.zeroProof) return { ok: true }; // a zero-proof drink keeps the frame without the spirit
      if (C.lowAbv && cl.minOz) cl = { ...cl, minOz: undefined }; // a low-ABV request may pour less
    }
    if (cl.countOf) {
      const ex = new Set(cl.excluding ? idsOf(cl.excluding) : []);
      let pool = idsOf(cl.countOf).filter(id => !ex.has(id));
      if (famId === 'resort-punch' && cl.countOf === 'bulkJuices') pool = pool.concat(PASSION); // the Hurricane's body is passion fruit syrup
      const n = C.anyIn(pool).length;
      return { ok: n >= cl.min, absent: n === 0, what: cl.min > 1 ? `${cl.min} different ${cl.countOf === 'rums' ? 'rums' : orList(cl.countOf)}${cl.excluding ? ` besides the ${(SET_WORD[cl.excluding] || cl.excluding).replace(/^an? /, '')}` : ''}` : orList(cl.countOf) };
    }
    if (cl.allOf) {
      const ok = cl.allOf.every(id => C.has(id)) && (!cl.plusAnyOf || C.anyIn(cl.plusAnyOf).length > 0);
      return { ok, absent: !C.anyIn([...cl.allOf, ...(cl.plusAnyOf || [])]).length, what: `${names(cl.allOf)}${cl.plusAnyOf ? ` plus ${orList(cl.plusAnyOf)}` : ''}` };
    }
    const ids = idsOf(cl.anyOf);
    const x = C.ozIn(ids);
    const absent = C.anyIn(ids).length === 0;
    let ok = !absent && (cl.minOz == null || x >= cl.minOz - EPS) && (cl.maxOz == null || x <= cl.maxOz + EPS);
    // A resort punch whose juice already carries the acid (the Tequila Sunrise) needs no extra citrus.
    if (!ok && famId === 'resort-punch' && ids.includes('lime') && C.stats.acidConc >= 0.5) ok = true;
    // A rum-template drink made on the spirit the guest asked for ("a Mai Tai with mezcal", Vic's
    // bourbon Honi Honi) keeps its frame: the asked-for spirit stands in for the aged rum.
    if (!ok && cl.anyOf === 'agedOrFunkyRum') {
      const asked = new Set((C.intent && C.intent.spirits) || []);
      ok = C.poured.some(l => S('spirits').has(l.id) && !S('rums').has(l.id) && l.oz >= 0.75 - EPS
        && (asked.has(l.id) || C.asks(nameOf(l.id).split(' ').pop()) || fold(`${C.name} ${C.tagline}`).includes(fold(nameOf(l.id)).split(' ').pop())));
    }
    return { ok, absent, what: `${cl.minOz != null ? `${oz(cl.minOz)}${cl.maxOz != null ? `–${oz(cl.maxOz)}` : ''} of ` : ''}${orList(cl.anyOf)}` };
  }
  // Unmet requirements of a family: [{ kind, what, absent, ids }].
  function familyGaps(C, famId) {
    const req = (R.familyRequirements || {})[famId];
    if (!req) return [];
    const out = [];
    for (const cl of req.requireAll || []) { const r = clause(C, cl, famId); if (!r.ok) out.push({ kind: 'require', what: r.what, absent: r.absent }); }
    if (req.requireAny && req.requireAny.length) {
      const rs = req.requireAny.map(cl => clause(C, cl, famId));
      if (!rs.some(r => r.ok)) out.push({ kind: 'require', what: rs.map(r => r.what).join(', or '), absent: rs.every(r => r.absent) });
    }
    if (req.minRums && !C.zeroProof && C.anyIn(S('rums')).length < req.minRums) out.push({ kind: 'require', what: 'rum', absent: true });
    if (req.requireMethod && C.method !== req.requireMethod) out.push({ kind: 'method', what: `to be ${VERB[req.requireMethod] || req.requireMethod}` });
    for (const id of C.anyIn(idsOf(req.forbid || []))) out.push({ kind: 'forbid', what: nameOf(id), ids: [id] });
    for (const [id, max] of Object.entries(req.maxOz || {})) if (C.ozOf(id) > max + EPS) out.push({ kind: 'maxOz', what: `${oz(C.ozOf(id))} of ${nameOf(id)} (at most ${oz(max)})`, ids: [id] });
    return out;
  }
  // A missing defining component is fatal where the research says so (colada, Mai Tai, Zombie,
  // orgeat punch); the same component present but under the canonical dose is major.
  const isZombieProper = C => !C.archId || C.archId === 'zombie' || hasWord(C.name, 'zombie') || /zombie/i.test(`${recipeRiffName(C) || ''} ${(C.recipe.classic && C.recipe.classic.name) || ''}`);
  function requireFindings(C, add, fam, gaps) {
    const label = FAM_LABEL[fam] || fam;
    const absent = gaps.filter(g => g.absent).map(g => g.what), under = gaps.filter(g => !g.absent).map(g => g.what);
    const short = () => under.length && add('family-underdosed', 'major', `${cap(an(label))} with too little of what defines it: it wants ${list(under)}.`);
    if (fam === 'zombie') {
      // Research §5.1: one rum, no overproof, or no grapefruit/cinnamon/falernum element at all.
      const core = [];
      if (!C.zeroProof && C.anyIn(S('rums')).length < 2) core.push('a second rum');
      if (!C.zeroProof && !C.anyIn(S('overproof')).length) core.push('an overproof rum');
      if (!C.has('lime')) core.push('lime');
      if (!C.anyIn(['dons-mix', 'grapefruit', 'cinnamon-syrup', 'passion-fruit-syrup', 'velvet-falernum', 'falernum-syrup', 'maraschino']).length) core.push('a grapefruit, cinnamon or falernum element');
      if (isZombieProper(C) && core.length) add('zombie-weak-structure', 'fatal', `A Zombie without ${list(core)}: the defining stack is several rums with an overproof seasoning, lime, and Don's grapefruit-cinnamon or falernum.`);
      else add('family-underdosed', 'major', `${isZombieProper(C) ? 'A Zombie' : 'A Zombie-family heavyweight'} short of the full Beachcomber stack: it wants ${list(gaps.map(g => g.what))}.`);
      return;
    }
    if (fam === 'colada' || fam === 'mai-tai') {
      // Cousins by definition: the Bushwacker (chocolate and coconut, no pineapple), the Miami
      // Vice's two halves, and Vic's own spirit swaps on the Mai Tai (the Honi Honi's bourbon).
      // And a drink whose missing part the guest ruled out (orgeat in a nut-free Mai Tai) is
      // honestly a cousin; the engine says so on the card.
      const waived = ((C.recipe.check || {}).waived || []).length > 0;
      const cousin = waived || (fam === 'colada' && ['bushwacker', 'miami-vice'].includes(C.archId)) || (fam === 'mai-tai' && C.archId === 'vic-mai-tai-riff');
      if (absent.length && cousin) { add('family-requirement', 'major', `${cap(an(label))} cousin without ${list(absent)}.`); short(); return; }
      if (absent.length) add(fam === 'colada' ? 'colada-no-coconut-or-pineapple' : 'mai-tai-incomplete', 'fatal', fam === 'colada'
        ? `A colada without ${list(absent)}: colada means pineapple and coconut cream${C.anyIn(S('coconutSources')).length && !C.anyIn(S('coconutBody')).length ? ' (coconut rum alone is thin and sweet, with no body)' : ''}.`
        : `A Mai Tai without ${list(absent)}: the 1944 template is aged rum, lime, orange curaçao, orgeat and rich syrup.`);
      short();
      return;
    }
    if (fam === 'orgeat-punch') {
      const o = gaps.find(g => /orgeat/i.test(g.what));
      if (o && o.absent) add('orgeat-punch-without-orgeat', 'fatal', `An orgeat punch without orgeat: the label names the ingredient. Add ½ oz orgeat or call it something else.`);
      const rest = gaps.filter(g => g !== o || !o.absent).map(g => g.what);
      if (rest.length) add('family-requirement', 'major', `An orgeat punch short of ${list(rest)}.`);
      return;
    }
    const what = list(gaps.map(g => g.what));
    const [id, msg] = {
      grog: ['grog-wrong', `A grog without ${what}: Navy Grog is lime and white grapefruit with honey, or rum, lime and water.`],
      daiquiri: [/daiquiri/i.test(`${C.archId} ${C.archName}`) ? 'daiquiri-impostor' : 'family-requirement', `A ${/daiquiri/i.test(`${C.archId} ${C.archName}`) ? 'daiquiri' : 'daiquiri-family sour'} without ${what}: the Daiquiri is spirit, lime and sugar.`],
      'bitter-tiki': ['bitter-tiki-not-bitter', `A bitter tiki drink without ${what}: it needs Campari, an amaro or a real dose of bitters.`],
      buck: ['family-requirement', `A buck without ${what}: it is lengthened with a carbonated top.`],
    }[fam] || ['family-requirement', `${cap(an(label))} without ${what}.`];
    add(id, 'major', msg);
  }
  const FAM_LABEL = { colada: 'colada', 'mai-tai': 'Mai Tai', zombie: 'Zombie', grog: 'grog', swizzle: 'swizzle', daiquiri: 'daiquiri', 'orgeat-punch': 'orgeat punch', buck: 'buck', 'resort-punch': 'resort punch', 'bitter-tiki': 'bitter tiki drink', punch: 'punch', 'beachcomber-sour': 'Beachcomber sour', stirred: 'stirred drink', hot: 'hot drink' };
  // Ids a more specific red flag reports, so the generic family-forbid stays quiet about them.
  const FORBID_ELSEWHERE = new Set(['rum-spiced', 'vodka', 'cranberry-juice', 'grenadine']);
  const hawaiianLabel = C => /hawaiian/i.test(`${C.name} ${C.tagline} ${C.archName} ${C.archId}`) || C.asks('royal hawaiian');
  function checkFamily(C, add) {
    const fam = C.fam;
    const label = FAM_LABEL[fam] || fam;
    const gaps = familyGaps(C, fam);
    const reqGaps = gaps.filter(g => g.kind === 'require');
    for (const g of gaps) {
      if (g.kind === 'method') continue; // the swizzle method has its own rule
      if (g.kind === 'forbid' && FORBID_ELSEWHERE.has(g.ids[0])) continue;
      if (g.kind === 'forbid' && fam === 'stirred' && C.method === 'stir') continue; // stirred-with-juice said it
      if (fam === 'stirred' && g.kind === 'forbid' && g.ids[0] === 'lime' && C.ozOf('lime') <= 0.25 + EPS) continue; // Corn 'n Oil squeeze
      if (fam === 'hot' && C.method === 'hot' && g.kind !== 'require') continue; // hot-wrong said it
      if (g.kind === 'forbid' && fam === 'mai-tai' && ['pineapple-juice', 'orange'].includes(g.ids[0])) {
        if (!hawaiianLabel(C)) add('mai-tai-juice', 'fatal', `${nameOf(g.ids[0])} in a Mai Tai: the juice version is a later Hawaii drift, not the drink. Rum, lime, curaçao, orgeat and a little rich syrup; juice only in a Royal Hawaiian riff that says so.`, { lines: g.ids });
        continue;
      }
      if (g.kind === 'forbid' && fam === 'zombie' && (S('coconutSources').has(g.ids[0]) || S('allDairy').has(g.ids[0]) || g.ids[0] === 'blue-curacao')) {
        add('zombie-red-or-creamy', 'fatal', `${nameOf(g.ids[0])} in a Zombie: no cream, coconut or blue in the Beachcomber's heavyweight.`, { lines: g.ids });
        continue;
      }
      if (g.kind === 'forbid') { add('family-forbid', 'major', `${cap(g.what)} has no business in ${an(label)}.`, { lines: g.ids }); continue; }
      if (g.kind === 'maxOz') { add(fam === 'colada' ? 'colada-sour' : 'family-max', 'major', `${g.what} makes the ${label} too sour; fat and heavy acid read sour and can split.`, { lines: g.ids }); continue; }
    }
    if (reqGaps.length) requireFindings(C, add, fam, reqGaps);
    if (fam === 'zombie' && C.ozOf('grenadine') > 0.17 + EPS) {
      const proper = isZombieProper(C);
      add('zombie-red-or-creamy', proper ? 'fatal' : 'major', `${oz(C.ozOf('grenadine'))} of grenadine in a ${proper ? 'Zombie' : 'Zombie-family heavyweight'}: the grenadine is a teaspoon of seasoning, not colour.`, { lines: ['grenadine'] });
    }
    if (fam === 'mai-tai') {
      const bad = C.poured.filter(l => (l.float && S('rums').has(l.id)) || l.sink);
      if (bad.length) add('mai-tai-float-or-sink', 'major', `A ${list(bad.map(l => l.float ? `${nameOf(l.id)} float` : `${nameOf(l.id)} sink`))} on a Mai Tai is resort corruption; finish it with the lime shell and mint instead.`, { lines: bad.map(l => l.id) });
    }
    if (fam === 'colada' && C.has('coconut-milk') && !C.has('coconut-cream')) {
      const sweetG = sum(C.poured.filter(l => l.ing && ['sweet', 'modifier'].includes(l.ing.role)).map(l => l.oz * 29.5735 * (l.ing.sugar || 0) / 100));
      if (sweetG < 0.5 * 29.5735 * 0.615) add('coconut-milk-unsweetened-swap', 'minor', `Unsweetened coconut milk with almost no sugar makes a thin, sour colada; use cream of coconut, or add rich syrup.`, { lines: ['coconut-milk'] });
    }
  }

  // Name nouns (rules.nameNouns): the type word in a name is a contract.
  const has2 = (C, ids, min = 0) => C.ozIn(ids) >= min - EPS && C.anyIn(ids).length > 0;
  const sourOz = C => sum(C.poured.filter(l => l.ing && l.ing.role === 'sour').map(l => l.oz));
  const NOUNS = [
    // [noun, severity, test -> problem text or null, family it belongs to (skip if the drink is that family)]
    ['Piña Colada', 'fatal', C => nounGaps(C, 'colada') || (C.stats.spiritOz < 1 && !C.zeroProof ? 'needs rum' : null), null],
    ['Colada', 'fatal', C => nounGaps(C, 'colada'), 'colada'],
    ['Mai Tai', 'fatal', C => {
      if (hawaiianLabel(C)) return null; // a Royal Hawaiian / Hawaiian-style Mai Tai says what it is
      const juice = familyGaps(C, 'mai-tai').filter(x => x.kind === 'forbid' && ['pineapple-juice', 'orange'].includes(x.ids[0]));
      return juice.length ? `has no ${list(juice.map(x => x.what))} in it` : nounGaps(C, 'mai-tai');
    }, 'mai-tai'],
    ['Zombie', 'fatal', C => {
      const core = [];
      if (C.anyIn(S('rums')).length < 2) core.push('a second rum');
      if (!C.anyIn(S('overproof')).length) core.push('an overproof rum');
      if (!C.has('lime')) core.push('lime');
      if (!C.anyIn(['dons-mix', 'grapefruit', 'cinnamon-syrup', 'passion-fruit-syrup', 'velvet-falernum', 'falernum-syrup', 'maraschino']).length) core.push('a grapefruit, cinnamon or falernum element');
      if (core.length) return `needs ${list(core)}`;
      const g = familyGaps(C, 'zombie').filter(x => x.kind === 'require');
      return g.length ? { text: `wants the full stack: ${list(g.map(x => x.what))}`, sev: 'major' } : null;
    }, 'zombie'],
    ['Grog', 'fatal', C => { if (!familyGaps(C, 'grog').some(x => x.kind === 'require')) return null; const hotGrog = C.method === 'hot' && C.anyIn(S('rums')).length && C.anyIn(['hot-water', 'water', 'black-tea', 'coffee']).length && (C.anyIn(['lime', 'lemon', 'orange']).length || C.anyIn(S('spiceCarriers')).length || C.garnishHas('cinnamon') || C.garnishHas('nutmeg')); return hotGrog ? null : 'needs lime and grapefruit with honey or allspice, or rum, lime and water'; }, 'grog'],
    ['Swizzle Stick', 'major', () => 'is a bar tool, never a drink', null],
    ['Swizzle', 'fatal', C => { const p = swizzleProblem(C); return p === 'fatal' ? 'needs to be swizzled on crushed ice' : null; }, 'swizzle'],
    ['Daiquiri', 'major', C => {
      if (!has2(C, S('spirits'), 1.5) || sourOz(C) < 0.5 - EPS) return 'needs spirit, lime and sugar';
      if (C.anyIn(S('allDairy')).length) return 'has no cream in it';
      if (C.poured.length > 5) return 'is five ingredients at most';
      const nonRum = C.poured.filter(l => S('spirits').has(l.id) && !S('rums').has(l.id) && l.oz >= 0.75);
      if (nonRum.length && !nonRum.some(l => fold(C.name).includes(fold(nameOf(l.id)).split(' ').pop()))) return `has to name its ${nameOf(nonRum[0].id)} base`;
      return null;
    }, null],
    ['Buck', 'major', C => has2(C, ['ginger-beer', 'ginger-ale'], 2) ? null : 'is lengthened with at least 2 oz of ginger beer or ginger ale', null],
    ['Mule', 'major', C => has2(C, ['ginger-beer'], 2) && C.has('lime') ? null : 'is ginger beer and lime', null],
    ['Highball', 'fatal', C => C.ozIn(S('carbonated')) >= 2.5 - EPS && ['build', 'muddle-build'].includes(C.method) ? null : 'is a built drink with a carbonated top of 2½ oz or more', null],
    ['Fizz', 'fatal', C => sourOz(C) > 0 && C.anyIn(['soda-water', 'sparkling-wine']).length && !C.crushed ? null : 'is citrus and sugar topped with soda, with no crushed-ice mound', null],
    ['Flip', 'fatal', C => (C.has('egg-white') || C.has('whole-egg')) && (C.garnishHas('nutmeg') || C.has('nutmeg')) ? null : 'needs egg and nutmeg', null],
    ['Nog', 'fatal', C => C.anyIn(['egg-white', 'whole-egg', ...S('allDairy')]).length ? null : 'needs egg or dairy', null],
    ['Toddy', 'fatal', C => C.method === 'hot' ? null : 'is served hot', null],
    ['Julep', 'fatal', C => (C.has('mint') || C.garnishHas('mint')) && C.crushed ? null : 'is mint over crushed ice', null],
    ['Smash', 'major', C => C.crushed && (C.method === 'muddle-build' || C.poured.some(l => l.muddled)) ? null : 'is muddled herb or fruit over crushed ice', null],
    ['Old Fashioned', 'fatal', C => ['stir', 'build'].includes(C.method) && !C.poured.some(l => l.ing && ['sour', 'juice'].includes(l.ing.role)) && C.anyIn(BITTERS).length ? null : 'is stirred or built, with bitters and no juice', null],
    ['Nightcap', 'major', C => C.method === 'hot' || (C.method === 'stir' && C.stats.abv >= 18) ? null : 'is stirred and strong, or hot', null],
    ['Sling', 'major', C => C.stats.spiritOz > 0 && sourOz(C) > 0 && C.poured.some(l => l.ing && ['juice', 'lengthener'].includes(l.ing.role)) ? null : 'is spirit, citrus and sugar lengthened with soda, water or juice (the Raffles uses pineapple)', null],
    // Shaken or swizzled over crushed ice, the melt is the punch's "four of weak".
    ['Punch', 'major', C => C.isBowlVessel || (sourOz(C) > 0 && (C.crushed || C.poured.some(l => l.ing && ['juice', 'lengthener'].includes(l.ing.role)))) ? null : 'is spirit, citrus, sugar and a lengthener, or a bowl', null],
    ['Sour', 'major', C => sourOz(C) >= 0.5 - EPS ? null : 'needs at least ½ oz of citrus', null],
    ['Cooler', 'major', C => C.stats.volOz >= 5 - EPS && C.ice !== 'none' && C.poured.some(l => l.ing && ['juice', 'lengthener'].includes(l.ing.role)) ? null : 'is long (5 oz or more) on ice', null],
    ['Revenant', 'major', C => C.stats.abv >= 15 - 0.5 ? null : 'promises a heavyweight (15% ABV or more)', null],
    ['Specter', 'major', C => C.stats.abv >= 15 - 0.5 ? null : 'promises a heavyweight (15% ABV or more)', null],
    ['Bird', 'major', C => C.fam === 'bitter-tiki' || C.vId === 'bird-mug' ? null : 'belongs to the bitter Jungle Bird line or the bird mug', null],
  ];
  // Requirements a noun borrows from a family: absent components fail it, under-dosed ones weaken it.
  function nounGaps(C, famId) {
    const g = familyGaps(C, famId).filter(x => x.kind === 'require');
    if (!g.length) return null;
    const absent = g.filter(x => x.absent);
    return absent.length ? `needs ${list(absent.map(x => x.what))}` : { text: `wants ${list(g.map(x => x.what))}`, sev: 'major' };
  }
  function checkNames(C, add) {
    let name = fold(C.name);
    for (const [noun, sev0, test, famOf] of NOUNS) {
      const n = fold(noun);
      if (!hasWord(name, n)) continue;
      name = name.replace(new RegExp(esc(n).replace(/\s+/g, '[\\s-]+'), 'gi'), ' '); // "Piña Colada" is not also a "Colada"
      if (famOf && famOf === C.fam) continue; // the family check already holds it to this
      const res = test(C);
      if (!res) continue;
      const problem = typeof res === 'string' ? res : res.text;
      const sev = typeof res === 'string' ? sev0 : res.sev;
      const definitional = sev === 'fatal';
      const id = noun === 'Buck' && !C.anyIn(['ginger-beer', 'ginger-ale', 'ginger-syrup', 'ginger-fresh', 'ginger-liqueur']).length ? 'buck-without-ginger'
        : noun === 'Daiquiri' ? 'daiquiri-impostor' : definitional ? 'noun-claim-false' : 'noun-claim-weak';
      add(id, sev, `Called a ${noun}, but a ${noun} ${problem}. Use a noun the drink earns.`);
    }
    if ((hasWord(C.name, 'Highball') || hasWord(C.name, 'Cooler')) && (C.isUp || C.ice === 'none'))
      add('highball-served-up', 'major', `A ${hasWord(C.name, 'Highball') ? 'highball' : 'cooler'} served up: it's long and iced by definition. Build it in a highball or collins on cubes.`);
    if (hasWord(C.name, 'Scorpion') || (C.fam === 'orgeat-punch' && C.vId === 'scorpion-bowl'))
      if (C.ozOf('brandy') < 0.5 - EPS) add('scorpion-without-brandy', 'major', `A Scorpion without brandy: Vic's is rum and brandy with orange, lemon and orgeat. Add ½–1 oz brandy per serving.`);
    if (hasWord(C.name, 'Fog Cutter') && !(C.has('gin') && C.anyIn(['brandy', 'pisco']).length && C.has('amontillado-sherry')))
      add('fog-cutter-incomplete', 'major', `A Fog Cutter without its gin, brandy and sherry float isn't one.`);
    // Classic names and riffs keep their signature.
    // Classic names and riffs keep their signature: { text, sev } of what's lost, or null.
    const noun = n => NOUNS.find(x => x[0] === n)[2];
    const asRes = r => !r ? null : typeof r === 'string' ? { text: r, sev: 'fatal' } : r;
    const lostSig = key => {
      if (key === 'mai tai') return asRes(noun('Mai Tai')(C));
      if (key === 'zombie') return asRes(noun('Zombie')(C));
      const sig = SIGNATURE[key];
      if (!sig) return null;
      return sig.need.some(ids => !(C.anyIn(ids).length || ids.some(id => C.garnishHas(nameOf(id).split(' ').pop())))) ? { text: `has lost its ${sig.what}`, sev: 'fatal' } : null;
    };
    let namedClassic = null;
    for (const key of Object.keys(SIGNATURE)) {
      if (!hasWord(C.name, key)) continue;
      namedClassic = key;
      const lost = lostSig(key);
      if (lost) add('classic-name-misuse', 'fatal', `Called a ${(C.name.match(new RegExp(esc(key).replace(/\s+/g, '\\s+'), 'i')) || [key])[0]}, but it ${lost.text}. Classic names are specs: keep the signature, or give it an original name.`);
    }
    const riff = recipeRiffName(C);
    if (riff && fold(riff) !== namedClassic && !hasWord(C.name, riff)) {
      const lost = lostSig(fold(riff));
      if (lost) add('classic-riff-loses-signature', 'major', `A riff on the ${riff} that ${lost.text.replace(/^needs/, 'has lost')}; keep the signature and vary the rest.`);
    }
    // Family labels in the tagline (copy.familyLabelMustBeTrue).
    const tag = fold(C.tagline);
    if ((hasWord(tag, 'orgeat') || hasWord(C.name, 'orgeat')) && C.ozOf('orgeat') < 0.25 - EPS && C.fam !== 'orgeat-punch')
      add('orgeat-punch-without-orgeat', C.has('orgeat') ? 'major' : 'fatal', `The copy names orgeat, but there's ${C.has('orgeat') ? 'only a trace of' : 'no'} orgeat in the drink.`, { lines: ['orgeat'] });
    const colada = (hasWord(tag, 'colada') || hasWord(C.name, 'colada')) && C.fam !== 'colada' && !hasWord(C.name, 'colada') ? asRes(nounGaps(C, 'colada')) : null;
    if (colada) add(colada.sev === 'fatal' ? 'colada-no-coconut-or-pineapple' : 'family-underdosed', colada.sev, `The copy calls it a colada, but it ${colada.text}.`);
    const labels = [
      [/\bgrog\b/, 'grog', () => asRes(noun('Grog')(C))],
      [/\bswizzle\b/, 'swizzle', () => swizzleProblem(C) ? { text: 'is swizzled in the glass on crushed ice', sev: swizzleProblem(C) } : null],
      [/\bmai tai cousin\b/, 'mai-tai', () => lostSig('mai tai')],
      [/\b(beachcomber|zombie)-style heavyweight\b/, 'zombie', () => lostSig('zombie')],
    ];
    for (const [re, famOf, test] of labels) {
      if (!re.test(tag) || famOf === C.fam) continue;
      const p = test();
      if (p) add('label-names-absent-ingredient', p.sev, `The tagline says "${tag.match(re)[0]}", but a ${famOf === 'mai-tai' ? 'Mai Tai' : famOf} ${p.text}.`);
    }
  }
  const recipeRiffName = C => (C.recipe.riffOf && (C.recipe.riffOf.name || C.recipe.riffOf)) || null;

  // ---------- 9. the other mechanical red flags ----------
  const GOLDEN = ['mai-tai', 'zombie', 'grog', 'swizzle', 'beachcomber-sour'];
  function checkRedFlags(C, add) {
    const fam = C.fam;
    if (C.has('cranberry-juice') && !C.asks('cranberr'))
      add('cranberry-in-tiki', 'major', `Cranberry juice cocktail is a 1960s vodka-highball ingredient, not a tropical one; use hibiscus, real grenadine, pomegranate, passion fruit or guava.`, { lines: ['cranberry-juice'] });
    if (fam !== 'buck' && C.has('lime-cordial') && !C.anyIn(['lime', 'lemon', 'grapefruit']).length)
      add('lime-cordial-as-citrus', 'major', `Lime cordial is the only acid: it's a sweet-sour flavouring, not fresh lime.`, { lines: ['lime-cordial'] });
    if (['mai-tai', 'zombie', 'grog', 'swizzle', 'daiquiri', 'beachcomber-sour'].includes(fam) && C.has('rum-spiced'))
      add('spiced-rum-classic', 'major', `Spiced rum in a ${FAM_LABEL[fam]} builds the spice from vanilla-flavoured rum; use an aged rum with allspice, cinnamon or falernum.`, { lines: ['rum-spiced'] });
    const loud = C.anyIn(['blue-curacao', 'melon-liqueur']).filter(id => !(id === 'blue-curacao' && fam === 'zombie'));
    const colorAsk = (C.intent && C.intent.color) || C.asksAny(['blue', 'green', 'neon', 'color', 'colour', 'blue hawaii', 'midori', 'pool', 'ocean', 'lagoon', 'sea', 'aqua', 'turquoise', 'teal', 'electric']);
    if (loud.length && !colorAsk)
      add('blue-or-melon-unrequested', 'major', `${names(loud)} nobody asked for: an artificial-colour shortcut and a resort cliché.`, { lines: loud });
    const gentle = ['gentle', 'floral', 'garden', 'sunny', 'brunch', 'romantic', 'grandmother', 'light', 'elegant', 'morning'].filter(w => C.asks(w));
    const bitter = C.anyIn(S('aggressiveBitter'));
    if (gentle.length && bitter.length >= 2)
      add('bitter-stack-in-gentle-drink', 'fatal', `${names(bitter)} in a drink the guest asked to be ${gentle[0]}: build it from flowers, herbs, honey and citrus instead.`, { lines: bitter });
    if (GOLDEN.includes(fam) && C.has('vodka') && !C.asks('vodka'))
      add('vodka-in-golden-age-family', 'major', `Vodka in a ${FAM_LABEL[fam]}: rum is the point of the family.`, { lines: ['vodka'] });
    if (C.has('butter'))
      add('raw-butter', 'major', C.method === 'hot' ? `A raw pat of butter leaves a greasy slick; work it into a hot buttered rum batter.` : `Butter in a cold drink seizes into a greasy slick; batter belongs in hot drinks only.`, { lines: ['butter'] });
    const dessertAsk = ['dessert', 'bananas foster', 'chocolate', 'pie', 'cake', 'ice cream', 'sundae', 'horchata', 'dreamsicle'].filter(w => C.asks(w));
    if (dessertAsk.length && (!C.anyIn([...S('creamyMakers'), 'hot-buttered-rum-batter', 'creme-de-cacao', 'coffee-liqueur', 'banana-liqueur', 'vanilla-syrup']).length || C.has('grapefruit')))
      add('dessert-without-dessert', 'major', `The guest asked for ${dessertAsk[0]}, and got a ${C.has('grapefruit') ? 'grapefruit sour' : 'drink with nothing rich in it'}; build it on cream, coconut, banana, cacao, coffee or vanilla.`);
    const sweetLiq = C.poured.filter(l => S('sweetLiqueurs').has(l.id));
    const liqOz = sum(sweetLiq.map(l => l.oz));
    if (liqOz > 1.5 + EPS && !(fam === 'resort-punch' || ['resort-liqueur-punch', 'herbal-swizzle'].includes(C.archId) || /rum runner|chartreuse/i.test(C.name)))
      add('liqueur-cloy', 'major', `${oz(liqOz)} of sweet liqueur (${names(sweetLiq.map(l => l.id))}) is cloying; trim it to 1½ oz and lean on fresh acid.`, { lines: sweetLiq.map(l => l.id) });
    // Balance.
    const win = W[fam] || {};
    const r = C.stats.sweetSour;
    if (win.sugarToAcid && r !== null && r !== undefined && C.stats.acidConc >= 0.1) {
      const [lo, hi] = win.sugarToAcid;
      if (r < lo * 0.95 || r > hi * 1.05)
        add('ratio-out-of-window', 'major', `Sugar to acid is ${r2(r)}:1, ${r < lo ? 'too sharp' : 'too sweet'} for ${an(FAM_LABEL[fam] || fam)} (${lo}–${hi}:1 after dilution).`);
    }
    if (fam && !['colada', 'stirred', 'hot', 'buck'].includes(fam) && C.stats.acidConc < 0.4 - EPS)
      add('acid-missing', 'fatal', `Only ${r2(C.stats.acidConc)} g of acid per 100 ml: a ${FAM_LABEL[fam] || fam} is a sour, and this one has lost its citrus. Restore the lime.`);
    if (C.method === 'blend' && C.stats.sugarConc < 8.5 - 0.25)
      add('frozen-thin', 'major', `A frozen drink at ${r2(C.stats.sugarConc)} g sugar per 100 ml tastes thin and icy; cold mutes sugar, so frozen drinks need 20–50% more than a shaken sour.`);
    const pine = C.ozOf('pineapple-juice'), cit = C.ozOf('lime') + C.ozOf('lemon');
    if (pine > 0 && !['colada', 'resort-punch', 'bitter-tiki'].includes(fam) && pine > 3 * cit + EPS)
      add('pineapple-flab', 'minor', `${oz(pine)} of pineapple against ${oz(cit)} of lime or lemon goes flabby; add citrus, or call it a resort punch.`, { lines: ['pineapple-juice'] });
    if (C.method === 'hot' && (C.stats.sugarConc < 2.5 || C.stats.abv > 14))
      add('hot-too-dry-or-strong', 'minor', C.stats.abv > 14 ? `A hot drink at ${r2(C.stats.abv)}% ABV burns; lengthen it with more hot water.` : `A hot drink with almost no sugar tastes thin; more batter or syrup.`);
    // Colour physics the copy can't fix.
    if (['zombie', 'mai-tai'].includes(fam) && C.bodyHue && (HUE.red(C.bodyHue) || HUE.pink(C.bodyHue)))
      add('red-zombie-or-mai-tai', 'major', `A ${FAM_LABEL[fam]} that reads red or pink is grenadine abuse; it should be amber or copper.`);
    const ango = C.poured.filter(l => l.id === 'angostura' && !l.crown && !(C.method === 'swizzle' && C.crushed));
    const pale = C.anyIn(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream']).length || (C.bodyHue && C.bodyHue.l > 0.8);
    if (ango.length && pale && C.ozIn(['angostura']) > 0.09 + EPS)
      add('angostura-brown-wash', 'minor', `${oz(C.ozIn(['angostura']))} of Angostura stirred into a pale drink turns it beige; crown it on top instead, or keep it to 1–2 dashes.`, { lines: ['angostura'] });
    // Tasting words against the numbers (lower third of the window is tart, upper third sweet).
    if (win.sugarToAcid && r !== null && r !== undefined && C.tasting) {
      const [lo, hi] = win.sugarToAcid, p = (r - lo) / (hi - lo), t = fold(C.tasting + ' ' + C.tagline);
      if (['tart', 'bracing', 'puckering'].some(w => mentions(t, w).pos) && p > 0.75) add('tasting-contradicts-numbers', 'major', `The copy calls it tart, but at ${r2(r)}:1 sugar to acid it sits at the sweet end of the ${FAM_LABEL[fam] || fam} window.`);
      else if (['lush', 'cloying', 'on the sweet side', 'dessert-sweet'].some(w => mentions(t, w).pos) && p < 0.25) add('tasting-contradicts-numbers', 'major', `The copy calls it lush, but at ${r2(r)}:1 sugar to acid it sits at the tart end of the ${FAM_LABEL[fam] || fam} window.`);
    }
    // Fire.
    const fire = C.garnish.filter(g => /\b(flaming|flame|fire|lit|burning|sparks?|crater)\b/i.test(g));
    if (fire.length) {
      const fv = G.fireAllowedVessels || [];
      if (C.vId && !fv.includes(C.vId) && !C.isBowlVessel) add('fire-unsafe', 'major', `Fire on a ${vName(C)}: flames belong on wide mugs and bowls only, never a narrow glass or a coupe.`);
      else if (C.garnish.some(g => /mint bouquet|umbrella/i.test(g))) add('fire-unsafe', 'major', `A flaming garnish next to a mint bouquet or a paper umbrella is a fire hazard; keep the flame clear.`);
    }
    if (/flaming (151|overproof)|flaming float|set (it )?(alight|on fire)/i.test(C.copyText + ' ' + C.steps.join(' ')))
      add('fire-unsafe', 'major', `A flaming overproof float is a chain-restaurant habit with a burn record; use a lemon-extract crouton in a lime shell, lit on a wide mug.`);
  }

  // Fruit and food words: in the name or tagline they must be in the glass (fatal if absent,
  // major if only a secondary note of something else carries them); in the prayer, the guest
  // asked for them (fatal if absent).
  function carriers(C, tag, ids) {
    const full = [], weak = [];
    if (ids) {
      for (const id of ids) if (C.has(id)) full.push(id);
      return { full, weak };
    }
    for (const l of C.poured) {
      const ing = l.ing;
      if (!ing || !(ing.flavors || []).includes(tag)) continue;
      // The first flavor tag headlines; a homemade mix (Don's Mix is grapefruit AND cinnamon syrup)
      // honestly carries its second one too.
      const first = ing.flavors[0] === tag || (ing.cat === 'syrup' && ing.flavors[1] === tag);
      const min = (R.minDoseIfPresent || {})[l.id] ?? (ing.role === 'base' ? 0.5 : 0.25);
      const bitters = ing.cat === 'bitters' && BITTERS_TAGS.has(tag);
      if ((first && (l.oz >= min - EPS || l.muddled)) || bitters) full.push(l.id);
      else weak.push(l.id);
    }
    if (GARNISH_AROMA.has(tag) && C.garnishAll.some(g => hasWord(g, tag))) full.push(`${tag} garnish`);
    return { full, weak };
  }
  function checkFoodWords(C, add) {
    const seen = new Set();
    for (const [where, text] of [['name', C.name], ['tagline', C.tagline.replace(/\(.*?\)/g, ' ')]]) {
      for (const [word, tag, ids] of FOOD) {
        const m = mentions(text, word);
        if (!m.pos || seen.has(tag + (ids || []).join())) continue;
        if (word === 'berr' && FOOD.some(([w, t, x]) => x && mentions(text, w).pos)) continue;
        if (word === 'orange' && where === 'name') continue; // a colour word in names
        seen.add(tag + (ids || []).join());
        const shown = word.replace(/rr$/, 'rry').replace(/err$/, 'erry').replace(/^cherr$/, 'cherry');
        const { full, weak } = carriers(C, tag, ids);
        if (full.length) continue;
        if (weak.length) add('phantom-flavor', 'major', `The ${where} promises ${shown}, but only ${names(weak)} ${weak.length > 1 ? 'hint' : 'hints'} at it as a secondary note; name what's really in the glass, or say it hedged ("a ${shown}-ish note from the ${nameOf(weak[0])}").`, { lines: weak });
        else add('fruit-named-absent', 'fatal', `The ${where} promises ${shown}, and there's no ${shown} in the drink.`);
      }
    }
    for (const [word, tag, ids] of FOOD) {
      if (word === 'berr' || ['clove', 'butter', 'anise', 'absinthe'].includes(word)) continue;
      if (!C.asks(word) || seen.has(`ask:${tag}`)) continue;
      seen.add(`ask:${tag}`);
      const { full, weak } = carriers(C, tag, ids);
      const shown = word.replace(/^cherr$/, 'cherry').replace(/rr$/, 'rry');
      if (!full.length && !weak.length) add('fruit-named-absent', 'fatal', `The guest asked for ${shown} and there's none in the drink.`);
    }
    if (C.asks('banana') && C.asks('frozen') && C.method === 'blend' && !C.has('banana'))
      add('fruit-named-absent', 'fatal', `A frozen banana drink needs a real banana in the blender, not only banana liqueur.`, { lines: C.anyIn(['banana-liqueur']) });
  }

  // ---------- 10. garnish ----------
  function serviceKind(C) {
    if (C.method === 'hot') return 'hot';
    if (C.isBowlVessel) return 'bowl';
    if (C.v && C.v.kind === 'fruit') return 'fruit-vessel';
    if (C.isUp) return 'up';
    if (C.v && ['ceramic', 'metal'].includes(C.v.kind)) return 'mug';
    if (['rocks', 'dof', 'clay-cup'].includes(C.vId)) return C.crushed ? 'short-crushed' : 'rocks';
    return 'tall';
  }
  const SERVICE_WORD = { up: 'drink served up', rocks: 'rocks drink', 'short-crushed': 'short crushed-ice drink', tall: 'tall drink', mug: 'mug', 'fruit-vessel': 'fruit shell', bowl: 'bowl', hot: 'hot drink' };
  // archetypeAromaRequired, for the named classics and their riffs, replaces the family's list.
  function aromaRequired(C) {
    const A = G.archetypeAromaRequired || {};
    const cands = [C.recipe.classic && C.recipe.classic.name, recipeRiffName(C), C.archName].filter(Boolean).map(fold);
    for (const [k, v] of Object.entries(A)) {
      const key = fold(k);
      if (cands.some(c => c === key || c.startsWith(`${key} `) || c.startsWith(`${key}&`))) return { items: v, why: k };
    }
    return null;
  }
  function checkGarnish(C, add) {
    const gs = C.garnish;
    const svc = serviceKind(C);
    let max = (G.maxElementsByService || {})[svc];
    const spare = C.asksAny(['elegant', 'minimal', 'minimalist', 'understated']);
    if (spare) max = Math.min(max ?? 1, 1);
    // Up: one small thing, nothing that needs an ice dome, no straws.
    if (svc === 'up') {
      const heavy = gs.filter(g => (G.forbiddenOnUp || []).some(item => !/\+/.test(item) && garnishMatches(g, item)) || /\bstraws?\b|umbrella/i.test(g));
      if (gs.some(g => garnishMatches(g, 'orchid')) && gs.some(g => garnishMatches(g, 'cherry'))) heavy.push('orchid and cherry');
      if (/\bstraws?\b/.test(C.stepsText) && !heavy.some(h => /straw/i.test(h))) heavy.push('a straw');
      if (heavy.length) add('garnish-heavy-on-up', 'major', `${cap(list(heavy))} on a ${vName(C) || 'drink served up'}: an up glass takes one small garnish (a wheel, a twist, a cherry on a pick) or none.`);
      else if (gs.length > 1) add('garnish-heavy-on-up', 'major', `${gs.length} garnishes on a ${vName(C) || 'drink served up'} (${list(gs)}); an up glass takes one small element or none.`);
    } else if (max !== undefined && gs.length > max) {
      add('garnish-clutter', 'minor', `${gs.length} garnishes (${list(gs)}) is more than ${spare ? 'an elegant drink wants' : `a ${SERVICE_WORD[svc]} carries`} (${max}); edit down to what does a job.`);
    }
    if (svc === 'hot') {
      const bad = gs.filter(g => (G.forbiddenOnHot || []).some(item => garnishMatches(g, item)));
      if (bad.length) add('garnish-on-hot', 'major', `${cap(list(bad))} on a hot drink: hot drinks take spice and peel, not ice, mint or tropical fruit.`);
    }
    // Required aroma.
    const ar = aromaRequired(C);
    const fam = (G.byFamily || {})[C.fam] || {};
    const required = ar ? ar.items : fam.required || [];
    const missing = required.filter(item => {
      if (C.garnishAll.some(g => garnishMatches(g, item))) return false;
      if (/swizzle stick/i.test(item) && C.method === 'swizzle') return false; // the stick that swizzled it stays in
      if (/nutmeg/i.test(item) && C.fam === 'hot' && C.garnishAll.some(g => garnishMatches(g, 'cinnamon'))) return false;
      if (/angostura crown/i.test(item) && C.method === 'swizzle' && C.has('angostura')) return false; // dashed on top of the ice
      if (/ice cone/i.test(item) && C.ice === 'ice-cone') return false;
      // Never demand a fruit garnish for a fruit the drink doesn't contain: that would be a lie.
      const sig = Object.entries((G.truth && G.truth.signals) || {}).find(([k, ids]) => ids.length && garnishMatches(item, k));
      if (sig && !sig[1].some(id => C.has(id))) return false;
      return true;
    });
    if (missing.length) add('garnish-missing-aroma', 'major', `${ar ? `The ${ar.why}` : `A ${FAM_LABEL[C.fam] || C.fam}`} is defined by its ${list(missing)}, and it's missing.`);
    // Never on this family.
    for (const item0 of fam.never || []) {
      if (/float|sink/i.test(item0)) continue; // lines, judged by mai-tai-float-or-sink
      if (/\(alone\)/i.test(item0) && gs.length !== 1) continue;
      if (/\(on coupe\)/i.test(item0) && svc !== 'up') continue;
      const item = item0.replace(/\s*\(.*?\)\s*/g, ' ').trim();
      const hit = gs.find(g => garnishMatches(g, item));
      if (!hit) continue;
      if (C.fam === 'mai-tai' && /cherr|flag/i.test(item)) add('cherry-in-mai-tai', 'minor', `A cherry or flag on a Mai Tai; it wants the spent lime shell and mint.`);
      else add('garnish-never', 'minor', `${cap(hit)} doesn't belong on a ${FAM_LABEL[C.fam] || C.fam}.`);
    }
    // One of each kind.
    for (const group of G.duplicates || []) {
      const hits = gs.filter(g => group.some(item => garnishMatches(g, item)));
      if (hits.length > 1) add('garnish-duplicate', 'minor', `${cap(list(hits))} are the same garnish twice; keep one.`);
    }
    // Truth: fruit on the glass is a promise about what's in it.
    const conventional = new Set(['punch', 'resort-punch', 'beachcomber-sour', 'zombie', 'colada', 'bitter-tiki']);
    for (const g of gs) {
      for (const [key, ids] of Object.entries((G.truth && G.truth.signals) || {})) {
        if (!ids.length || !garnishMatches(g, key)) continue;
        const ing = ingMap.get(ids[0]);
        const tag = ing && ing.flavors ? (ids[0] === 'strawberry' ? 'berry' : ing.flavors[0]) : null;
        if (ids.some(id => C.avoidIngs.has(id)) || (tag && C.avoidTags.has(tag)))
          add('garnish-excluded-ingredient', 'fatal', `${cap(g)} on the glass shows ${tag ? tag.replace('-', ' ') : nameOf(ids[0])}, which the guest ruled out.`);
        else if (!ids.some(id => C.has(id))) {
          const flag = conventional.has(C.fam) && ['pineapple', 'orange', 'lime', 'lemon'].includes(tag);
          // A garnish the family requires or lists as typical is convention (the buck's lime wedge is squeezed in).
          const typical = [...(fam.typical || []), ...(fam.required || [])].some(t => garnishMatches(g, t.replace(/\s*\(.*?\)\s*/g, ' ')));
          if (!flag && !typical) add('garnish-contradicts-recipe', 'major', `${cap(g)} promises ${tag ? tag.replace('-', ' ') : 'a fruit'} that isn't in the drink; garnish from what's in the glass.`);
        }
        break;
      }
    }
    if (gs.some(g => /\brim\b/i.test(g)) && !C.has('li-hing-mui-syrup'))
      add('garnish-rim', 'minor', `A salt or sugar rim on a tiki drink; leave it off (a li hing mui rim only with li hing mui inside).`);
    if (gs.some(g => /whipped cream/i.test(g)) && !(C.asksAny(['dessert', 'sundae', 'ice cream', 'milkshake']) && (C.method === 'blend' || C.anyIn(S('creamyMakers')).length)))
      add('garnish-whipped-cream', 'minor', `Whipped cream on a drink that isn't built as a dessert.`);
    if (gs.some(g => /glitter|glow ?stick|gummy/i.test(g))) add('garnish-tacky', 'minor', `Glitter, glow sticks and gummy candy are carelessness, not fun.`);
    if (gs.some(g => garnishMatches(g, 'mint bouquet')) && !C.crushed && svc !== 'up')
      add('mint-without-dome', 'minor', `A mint bouquet needs a crushed-ice dome to stand in; on ${C.ice} ice it flops.`);
    if (gs.some(g => garnishMatches(g, 'nutmeg')) && svc === 'up' && !['colada', 'punch', 'hot'].includes(C.fam) && !C.anyIn(S('creamyMakers')).length)
      add('nutmeg-on-tart-sour', 'minor', `Grated nutmeg on a lean sour served up; nutmeg belongs on rich, creamy, punch and hot drinks.`);
  }

  // ---------- 11. steps and service ----------
  const ICE_OK = { crushed: ['crushed', 'pebble', 'shaved'], pebble: ['crushed', 'pebble', 'shaved'], shaved: ['crushed', 'pebble', 'shaved'], 'ice-cone': ['ice-cone', 'shaved', 'crushed'], cubed: ['cubed', 'block'], block: ['cubed', 'block'], none: [], blended: ['crushed', 'pebble', 'shaved'] };
  // The ice a step serves the drink on (not the ice it is shaken or blended with).
  function servedIce(step) {
    const s = fold(step).replace(/\(.*?\)/g, ' ').replace(/,\s*or\b[^.;]*/g, ' ');
    const out = [];
    const grab = re => { let m; const g = new RegExp(re.source, 'g'); while ((m = g.exec(s))) out.push(m[1] || 'block'); };
    grab(/\bover (?:fresh |more |some |plenty of )?(cubed|crushed|pebble|shaved) ice\b/);
    grab(/\bover (?:one |a )?(?:single )?(?:large |big )?(?:cube|block|rock)\b()/);
    if (/\bover an? (?:shaved[- ])?ice cone\b/.test(s)) out.push('ice-cone');
    grab(/\btop (?:it |up |off )?with (?:more |fresh )?(crushed|pebble|shaved|cubed) ice\b/);
    grab(/\b(?:pack|fill)\b[^.;]*?\bwith (?:more |fresh )?(crushed|pebble|shaved|cubed) ice\b/);
    grab(/\bmound (?:more |some )?(crushed|pebble|shaved) ice\b/);
    return out.map(x => x || 'block');
  }
  function checkSteps(C, add) {
    if (!C.steps.length) return;
    const served = new Set(C.steps.flatMap(servedIce));
    const ok = ICE_OK[C.ice];
    if (ok) {
      const bad = [...served].filter(t => !ok.includes(t));
      if (bad.length) add('steps-ice-mismatch', 'major', `The steps serve it on ${list(bad.map(t => t === 'block' ? 'a large cube' : t === 'ice-cone' ? 'an ice cone' : `${t} ice`))}, but the recipe says ${C.ice === 'none' ? 'no ice' : `${C.ice} ice`}; the dilution and the look are computed for the wrong glass.`);
    }
    if (/\bice and all\b|\bopen[- ]pour\b|\bdump (?:the tin|everything)\b/.test(C.stepsText) && (C.isUp || C.ice === 'none'))
      add('open-pour-up', 'major', `The steps open-pour the drink, ice and all, into ${C.isUp ? `a ${vName(C) || 'glass served up'}` : 'a glass served without ice'}; strain it instead.`);
  }

  // ---------- 12. copy ----------
  const FLAVOR_ADJ = new Set(['tropical', 'fruity', 'funky', 'smoky', 'spicy', 'spiced', 'creamy', 'rich', 'tart', 'sweet', 'bitter', 'floral', 'herbal', 'nutty', 'zesty', 'juicy', 'tangy', 'grassy', 'earthy', 'piney', 'boozy', 'lush', 'velvety', 'silky', 'bright']);
  const FOOD_WORDS = new Set(FOOD.map(f => f[0]).concat(['cherry', 'cherries', 'strawberry', 'raspberry', 'berries', 'berry']));
  const words = text => fold(text).replace(/\(.*?\)/g, ' ').split(/\s+/).map(w => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')).filter(w => /[a-z0-9]/.test(w));
  function checkCopy(C, add) {
    const copy = fold(C.copyText);
    const spec = fold([C.steps.join(' '), C.garnish.join(' '), C.poured.map(l => l.name || '').join(' ')].join(' '));
    const flagged = new Set();
    const ban = (phrases, id, sev, msg, where = copy) => {
      for (const p of phrases) {
        const f = fold(p);
        if (flagged.has(f) || !wordRe(f).test(where)) continue;
        flagged.add(f);
        add(id, sev, msg(p));
      }
    };
    const rf = Object.fromEntries((R.redFlags || []).map(f => [f.id, f]));
    // Sour mix in the spec is fatal; in prose, "sweet and sour" is only the mix when it says so.
    const sourMix = (rf['sour-mix'] && rf['sour-mix'].phrases) || ['sour mix', 'sweet and sour', 'margarita mix', 'pina colada mix', 'bottled lime'];
    ban(sourMix, 'sour-mix', 'fatal', p => `"${p}" in the spec: the decline-era shortcut that killed tiki. Fresh citrus and syrup only.`, spec);
    ban(sourMix.filter(p => !/^sweet[- ]and[- ]sour$/.test(p)).concat(['sweet and sour mix', 'sweet-and-sour mix']), 'sour-mix', 'fatal', p => `The copy mentions "${p}": fresh citrus and syrup only.`);
    const prov = ((rf['false-provenance'] && rf['false-provenance'].phrases) || []).concat((COPY.bannedPhrases || []).filter(p => /don's|vic's|authentic|since \d/i.test(p)));
    ban(prov, 'false-provenance', 'major', p => `"${p}" on a generated drink is false history; say "in the Beachcomber manner" instead.`);
    ban(COPY.bannedPhrases || [], 'cliche-copy', 'minor', p => `"${p}" is menu cliché; write like a 1950s menu: specific, wry and short.`);
    const terms = (COPY.bannedNameTerms || []).filter(t => hasWord(copy, t));
    if (terms.length) add('sacred-or-offensive', 'major', `${list(terms.map(t => `"${t}"`))}: real deity names or colonial caricature. Use nautical, botanical, weather or rum-geography imagery.`);
    // Tagline shape.
    const tw = words(C.tagline.replace(/\(.*?\)/g, ' '));
    const [tlo, thi] = COPY.taglineWords || [8, 20];
    if (C.tagline && tw.length > thi) add('copy-too-long', 'minor', `The tagline runs ${tw.length} words; keep it under ${thi + 1}.`);
    else if (C.tagline && tw.length < tlo) add('copy-too-short', 'minor', `The tagline is ${tw.length} words; give it a verb and a story beat (${tlo}–${thi} words).`);
    const sentences = (C.tasting.match(/[^.!?]+[.!?]+/g) || []).filter(s => /[a-z]/i.test(s));
    if (sentences.length > 3) add('copy-too-long', 'minor', `The tasting note is ${sentences.length} sentences; three at most.`);
    if (COPY.noRepeatedWords !== false) {
      const counts = {};
      // "...a riff on the Mai Tai" names its source; that isn't a repeat.
      const ref = new Set(words(`${recipeRiffName(C) || ''} ${(C.recipe.classic && C.recipe.classic.name) || ''}`));
      for (const w of tw) if (!STOP.has(w) && w.length >= 3 && !ref.has(w)) counts[w] = (counts[w] || 0) + 1;
      const rep = Object.keys(counts).filter(w => counts[w] > 1);
      const flav = rep.filter(w => FLAVOR_ADJ.has(w) || FOOD_WORDS.has(w));
      if (flav.length) add('adjective-soup', 'major', `The tagline says ${list(flav.map(w => `"${w}"`))} twice: adjective soup.`);
      else if (rep.length) add('tagline-repeat', 'minor', `The tagline repeats ${list(rep.map(w => `"${w}"`))}.`);
    }
    const typeWords = new Set(words(FAM_LABEL[C.fam] || '')); // "bitter tiki drink" is a type, not an adjective
    const adjs = [...new Set(tw.filter(w => FLAVOR_ADJ.has(w) && !typeWords.has(w)))];
    if (adjs.length > (COPY.maxFlavorAdjectivesInTagline ?? 2)) add('adjective-soup', 'major', `The tagline stacks ${adjs.length} flavor adjectives (${list(adjs)}); two at most, and a verb.`);
    // Strength words against the ABV (a point of slack either side).
    const abv = C.stats.abv;
    const nameTag = `${C.name} \n ${C.tagline}`.replace(/\blight(?=[\s-]+(rum|bodied|body|froth|foam))/gi, '').replace(/\bstrong(?=\s+(black\s+)?(tea|coffee))/gi, '');
    for (const [k, [lo, hi]] of Object.entries(COPY.strengthWords || {})) {
      const w = k.split('|').find(x => hasWord(nameTag, x));
      if (w && (abv < lo - 1 || abv > hi + 1)) add('strength-word-lie', 'major', `"${w}" at ${r2(abv)}% ABV: the copy has to match the numbers (that word means ${lo}–${hi}%).`);
    }
    // Colour words in the name or tagline must be colours the drink shows.
    if (C.hues.length) {
      // "Blue Hawaii" is a name; "red berries", "pink grapefruit", "black tea" are flavors.
      const text = `${C.name} \n ${C.tagline}`.replace(/blue hawaii(an)?/gi, '')
        .replace(/\b(red|pink|black|white|golden|gold|dark)[\s-]+(berries|berry|fruits?|grapefruit|pepper|peppercorns?|tea|rum|cane|sugar|rums)\b/gi, '');
      for (const [hueName, ws] of COLOR_WORDS) {
        const w = ws.find(x => hasWord(text, x));
        if (!w) continue;
        const ok = hueName === 'white'
          ? C.look.body && (C.look.body.opacity || 0) >= 0.6 && HUE.white(C.bodyHue)
          : C.hues.some(h => COLOR_OK[hueName].some(t => HUE[t](h)));
        if (!ok) add('color-name-lie', 'major', `"${w}" in the ${hasWord(C.name, w) ? 'name' : 'tagline'}, but the drink pours ${(C.look && C.look.description) ? C.look.description.toLowerCase().replace(/\.$/, '') : 'another colour'}.`);
      }
    }
    const opaque = C.poured.filter(l => S('opaqueMakers').has(l.id) && l.oz >= 0.25 - EPS);
    const clearWord = ['crystal-clear', 'crystal', 'clear', 'transparent', 'see-through'].find(w => hasWord(C.copyText, w));
    if (clearWord && (opaque.length || (C.look && C.look.body && C.look.body.opacity >= 0.3)))
      add('opacity-lie', 'minor', `"${clearWord}" for a drink clouded by ${opaque.length ? names(opaque.map(l => l.id)) : 'what is in it'}.`, { lines: opaque.map(l => l.id) });
    const creamyText = C.copyText.replace(/velvet falernum/gi, '');
    const creamWord = ['creamy', 'velvety', 'velvet', 'silken'].find(w => hasWord(creamyText, w));
    const creamy = C.poured.filter(l => S('creamyMakers').has(l.id) && (l.oz >= 0.25 - EPS || l.id === 'egg-white' || l.unit === 'piece'));
    if (creamWord && !creamy.length) add('creamy-without-cream', 'major', `"${creamWord}" with nothing creamy in it (no coconut, cream, egg, banana or ice cream).`);
    if (hasWord(C.copyText.replace(/molasses-rich/gi, ''), 'rich')) {
      const darkOz = C.ozIn(['rum-jamaican-dark', 'rum-navy', 'rum-demerara', 'rum-black-blended', 'rum-demerara-overproof', 'rum-black-overproof']);
      if (!(C.stats.sugarConc >= 8 || creamy.length || darkOz >= 1 - EPS)) add('rich-for-lean', 'minor', `"Rich" for a lean drink (${r2(C.stats.sugarConc)} g sugar per 100 ml, nothing creamy, no dark rum).`);
    }
    if (/^the [a-z'-]+'s [a-z'-]+/i.test(C.name.trim())) add('possessive-mad-libs', 'minor', `"${C.name}" reads like mad-libs; two evocative words do more.`);
    const of = /\bof ([a-z' -]+)$/i.exec(fold(C.name).trim());
    if (of) {
      const place = of[1].trim();
      const ids = PLACES[place];
      if (ids && C.ozIn(ids) < 1 - EPS && !C.asks(place)) add('possessive-mad-libs', 'minor', `"of ${of[1].trim().replace(/\b\w/g, c => c.toUpperCase())}" with no spirit from there at a real pour; place words are earned by the bottle or the prayer.`);
    }
  }

  // ---------- the linter ----------
  const FIX = Object.fromEntries((R.redFlags || []).filter(f => f.fix).map(f => [f.id, f.fix]));
  const CHECKS = [checkDoses, checkExclusive, checkIncompat, checkMethod, checkVessel, checkComponents, checkStrength, checkFamily, checkNames, checkRedFlags, checkFoodWords, checkGarnish, checkSteps, checkCopy];
  function lint(recipe, { intent } = {}) {
    if (!recipe || !Array.isArray(recipe.lines)) return [{ id: 'unreadable', sev: 'fatal', msg: 'There is no recipe here to check.' }];
    const C = context(recipe, intent);
    const out = [];
    const seen = new Set();
    const add = (id, sev, msg, extra = {}) => {
      const lines = extra.lines && extra.lines.length ? [...new Set(extra.lines)] : null;
      const key = `${id}|${lines ? [...lines].sort().join(',') : ''}|${lines ? '' : msg}`;
      if (seen.has(key)) return;
      seen.add(key);
      const f = { id, sev, msg: cap(msg) };
      if (lines) f.lines = lines;
      const fix = extra.fix || FIX[id];
      if (fix) f.fix = fix;
      out.push(f);
    };
    for (const check of CHECKS) {
      try { check(C, add); } catch (e) { add('linter-error', 'minor', `The ${check.name} check failed on this recipe: ${e && e.message}`); }
    }
    return out.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);
  }
  return { lint, context };
}
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const an = w => `${/^[aeiou]/i.test(String(w || '')) && !/^(u[a-z]{2}|one)/i.test(String(w || '')) ? 'an' : 'a'} ${w}`;
