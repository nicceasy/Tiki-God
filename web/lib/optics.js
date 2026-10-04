// Drink optics: what a drink looks like, computed from what is actually in it.
//  - Color: each ingredient has the color it shows in a glass at full strength (`hex`), a
//    coloring strength (`tint`) and a cloudiness (`opacity`). Clear ingredients absorb light
//    (Beer–Lambert: absorbances add, weighted by volume); cloudy ones (juice pulp, cream,
//    coconut) scatter it, pulling the mix toward their own color and making it opaque.
//  - Layers: a pour stays put only if the method lets it. Shaken, blended and stirred drinks
//    are one color; what is floated last sits on top, what is drizzled last sinks, and dashes
//    of bitters on a swizzle form a crown. Specific gravity (sugar raises it, alcohol lowers
//    it) decides whether a float or sink actually holds.
// Optical data lives on each ingredient in data/ingredients.json as `optics`; a small fallback
// table covers anything missing so a drawing never goes blank.

const srgb2lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lin2srgb = v => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); };
export const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const rgbToHex = c => `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const lin = hex => hexToRgb(hex).map(srgb2lin);
const hexLin = l => rgbToHex(l.map(lin2srgb));

// Fallbacks by category when an ingredient has no optics of its own.
const CAT_FALLBACK = {
  rum: { hex: '#c98a3e', opacity: 0, tint: 1, scatter: 0 }, spirit: { hex: '#f4f1e8', opacity: 0, tint: 0.1, scatter: 0 },
  liqueur: { hex: '#e9cf9a', opacity: 0, tint: 0.6, scatter: 0 }, fortified: { hex: '#c98b4e', opacity: 0, tint: 1, scatter: 0 },
  bitters: { hex: '#7a2418', opacity: 0, tint: 4, scatter: 0 }, syrup: { hex: '#f3ead6', opacity: 0, tint: 0.3, scatter: 0 },
  citrus: { hex: '#e6edc0', opacity: 0.25, tint: 0.35, scatter: 0.2 }, juice: { hex: '#f2c560', opacity: 0.5, tint: 1, scatter: 1 },
  cream: { hex: '#f7f3ea', opacity: 0.95, tint: 0.15, scatter: 5 }, soda: { hex: '#f6f4ec', opacity: 0, tint: 0.1, scatter: 0 }, aromatic: { hex: '#ffffff', opacity: 0, tint: 0, scatter: 0 },
};

export function opticsOf(ing) {
  const o = (ing && ing.optics) || {};
  const fb = CAT_FALLBACK[ing && ing.cat] || CAT_FALLBACK.spirit;
  return {
    hex: o.hex || fb.hex,
    opacity: o.opacity ?? fb.opacity,
    tint: o.tint ?? fb.tint,
    scatter: o.scatter ?? (o.opacity !== undefined ? o.opacity * 2 : fb.scatter),
    layerHex: o.layerHex || o.hex || fb.hex,
    sg: o.sg ?? specificGravity(ing),
    behavior: o.behavior || null,
  };
}

// Specific gravity from the chemistry we store, when the data has none: ethanol lowers it
// (a water–ethanol table), dissolved sugar and acid raise it.
const ETOH = [[0, 1], [20, 0.975], [40, 0.95], [45, 0.941], [50, 0.932], [57, 0.918], [63, 0.904], [69, 0.89], [75, 0.875]];
export function specificGravity(ing) {
  if (!ing) return 1;
  const a = Math.max(0, Math.min(75, ing.abv || 0));
  let base = 1;
  for (let i = 1; i < ETOH.length; i++) if (a <= ETOH[i][0]) { const [x0, y0] = ETOH[i - 1], [x1, y1] = ETOH[i]; base = y0 + (y1 - y0) * (a - x0) / (x1 - x0); break; }
  return base + 0.00375 * (ing.sugar || 0) + 0.004 * (ing.acid || 0);
}

// The model (calibrated against 50 reference drinks, docs/research/color.md): dissolved
// colorants absorb (Beer–Lambert, absorbances add in linear light); pulp, fat and almond milk
// scatter, turning the drink cloudy and pulling it toward their own color, whitened a little,
// filtered over a shorter path. `pathCm` is how far light travels through the glass.
const KAPPA = 8, W = 0.15, BETA = 0.5;
export function mixColor(parts, waterOz = 0, { pathCm = 7 } = {}) {
  const total = parts.reduce((s, p) => s + p.oz, 0) + waterOz;
  if (total <= 0) return { hex: '#f3efe6', opacity: 0, clarity: 1 };
  const A = [0, 0, 0], alb = [0, 0, 0];
  let sigma = 0;
  for (const p of parts) {
    const o = p.optics || opticsOf(p.ing);
    if (!o.tint && !o.scatter) continue;
    const f = p.oz / total;
    const c = lin(o.hex);
    for (let k = 0; k < 3; k++) A[k] += (pathCm / 7) * f * o.tint * -Math.log(Math.max(c[k], 0.002));
    const sc = f * (o.scatter || 0);
    sigma += sc;
    for (let k = 0; k < 3; k++) alb[k] += sc * c[k];
  }
  const T = A.map(a => Math.exp(-a));
  const S = 1 - Math.exp(-KAPPA * sigma);
  const albedo = sigma > 0 ? alb.map(v => v / sigma) : [1, 1, 1];
  const R = albedo.map((a, k) => ((1 - W) * a + W) * T[k] ** BETA);
  const out = T.map((t, k) => (1 - S) * t + S * R[k]);
  const clarity = (T[0] + T[1] + T[2]) / 3;
  return { hex: rgbToHex(liquidFloor(vivid(out).map(v => lin2srgb(v) / 255)).map(v => v * 255)), opacity: Math.round(S * 100) / 100, clarity: Math.round(clarity * 100) / 100 };
}
// A drink in a glass is more colorful than a mix of absorbances and a grey scatter predicts: the
// eye judges it against the white of the ice and the paper of the menu, where its chroma reads
// full. The calibration references (docs/research/color.md) sit a little more saturated than the
// bare model (a Mai Tai 0.68 against 0.56, a Navy Grog 0.54 against 0.46), so the mix's chroma
// is raised in HSL (hue and lightness kept) by up to VIVID, most in the mid tones and fading
// out toward water-white and near-black, where a push would read as tint, not color.
export let VIVID = 1.15;
export const setVivid = k => { VIVID = k; };
function vivid(rgbLin) {
  const c = rgbLin.map(v => lin2srgb(v) / 255), mx = Math.max(...c), mn = Math.min(...c), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-4) return rgbLin;
  // (in HSL, so the hue and the lightness are exactly the model's; only the chroma rises)
  const fade = Math.max(0, Math.min(1, (0.93 - l) / 0.12)) * Math.max(0, Math.min(1, (l - 0.18) / 0.12));
  const s = d / (1 - Math.abs(2 * l - 1)), s2 = Math.min(1, s * (1 + (VIVID - 1) * fade)), k = s2 / s;
  return c.map(v => srgb2lin(255 * Math.max(0, Math.min(1, l + (v - l) * k))));
}
// Never pure black: a Goslings float still reads as liquid, so no channel drops below a dim
// floor. The floor greys the color toward its own lightness rather than lifting one channel:
// clamping only the blue of rum stirred with coffee liqueur would tint it claret (11°) when what
// the glass shows is dark coffee brown (about 25°). Dark reds keep their hue the same way.
const FLOOR = 0.114; // sRGB, about 0.012 in linear light
function liquidFloor(c) {
  const mx = Math.max(...c), mn = Math.min(...c);
  if (mn >= FLOOR) return c;
  const l = (mx + mn) / 2;
  if (l <= FLOOR) return [FLOOR, FLOOR, FLOOR];
  const k = (l - FLOOR) / (l - mn);
  return c.map(v => l + (v - l) * k);
}

// Color names a bartender would use, matched perceptually (CIE Lab) rather than by raw RGB.
// Warm drinks get the words a menu would use for them (honeyed amber, mango gold, burnished
// copper, rose gold), not "brown". The milky colors (café au lait, tan, mocha, cream, ivory) belong to
// drinks that coconut or dairy makes creamy; the dark browns (mahogany, molasses, dark brown,
// near-black, oxblood) to drinks that really are that dark. A drink named for the bottle that colors
// it (mango-gold, Campari red) has that bottle in it (drinkLook).
const NAMED = [
  ['#f5f1e6', 'water-clear'], ['#f4ecd6', 'pale straw'], ['#f2e1a0', 'pale gold'], ['#f0c95a', 'golden'], ['#f2b73a', 'passion-fruit gold'], ['#f2a32e', 'mango gold'],
  ['#e8cc94', 'pale honey'], ['#dcb07a', 'pale amber'], ['#e5b46a', 'honeyed amber'], ['#e6bc74', 'golden amber'], ['#d98a3a', 'amber'], ['#c8804e', 'copper'], ['#b05a26', 'burnished copper'], ['#8f6a32', 'dark amber'], ['#f08a34', 'tangerine'], ['#ea6a30', 'flame orange'],
  ['#b8864e', 'tawny'], ['#9c5228', 'russet'], ['#c4664e', 'terracotta'], ['#d2562e', 'blood-orange'], ['#ecbc6c', 'orange-gold'],
  ['#8a4a22', 'mahogany'], ['#86382a', 'oxblood'], ['#5a2e16', 'dark brown'], ['#3e1c0e', 'molasses'], ['#2e1a10', 'near-black'], ['#4a0c2c', 'deep plum'],
  ['#f6c6a0', 'peach'], ['#f2b276', 'apricot'], ['#e9a38c', 'rose gold'], ['#f29a6a', 'coral'], ['#e0563a', 'red-orange'], ['#c8303a', 'red'], ['#9c1e3a', 'ruby'], ['#7a1a1e', 'garnet'],
  ['#f2a8b8', 'pink'], ['#f6d0d8', 'blush'], ['#d65a8c', 'hibiscus pink'], ['#c2185b', 'magenta'], ['#8a4ab0', 'violet'], ['#c8b4e0', 'lavender'], ['#5a3a8a', 'deep purple'],
  ['#3a8ad8', 'blue'], ['#1a5ab8', 'deep blue'], ['#5a7898', 'slate blue'], ['#a6d8e8', 'pale aqua'], ['#7ac4dc', 'sky blue'], ['#40b0c8', 'turquoise'], ['#5ac0b0', 'lagoon teal'],
  ['#3aa88a', 'teal-green'], ['#b4e0c8', 'seafoam'], ['#9cc95a', 'green'], ['#c8d870', 'chartreuse'], ['#d9e09a', 'pale green-gold'], ['#6a9a4a', 'leaf green'],
  ['#eef2cf', 'pale lime'],
  ['#f3ead8', 'cream'], ['#f8ecc0', 'ivory'], ['#ecd9b4', 'tan'], ['#dcac6e', 'orange-tan'], ['#c9a27a', 'café au lait'], ['#ccb294', 'mocha'], ['#7a5a40', 'mocha'],
];
const CREAMY_ONLY = new Set(['cream', 'ivory', 'tan', 'orange-tan', 'café au lait', 'mocha']);
// Cocoa words only where there is chocolate or coffee in the glass (a Bushwacker, not a Painkiller).
const COCOA_ONLY = new Set(['mocha']);
// A creamy drink is never a fruit's color it doesn't have (a Painkiller isn't "apricot"), nor
// a clear spirit's (cream of coconut over lime is ivory, not pale straw).
const NOT_CREAMY = new Set(['apricot', 'pale straw', 'water-clear', 'pale lime']);
// Some words need more than the nearest swatch: seafoam is a pale, clearly green-blue froth.
// The fruit and gem words name a hue, so the drink has to sit on it.
const onHue = (lo, hi) => c => c.h !== null && (lo < hi ? c.h >= lo && c.h < hi : c.h >= lo || c.h < hi);
const WORD_GUARD = {
  seafoam: c => c.s >= 0.35 && c.l >= 0.7, 'pale lime': onHue(55, 95),
  tangerine: onHue(18, 40), 'flame orange': onHue(10, 30), 'mango gold': onHue(30, 46), 'passion-fruit gold': onHue(34, 50),
  'hibiscus pink': onHue(315, 2), 'rose gold': onHue(0, 30), copper: onHue(5, 36), coral: onHue(4, 30), ruby: onHue(330, 12), 'deep plum': onHue(300, 350),
  lavender: onHue(240, 320), violet: onHue(250, 320), 'deep purple': onHue(250, 320),
  // Slate is a dull, greyed blue (blue curaçao clouded by a red juice: the two pigments subtract).
  'slate blue': c => onHue(195, 250)(c) && c.s < 0.42 && c.l < 0.62,
  // Oxblood is a dark red-brown (a blackstrap Jungle Bird blushed with hibiscus), never coffee.
  oxblood: onHue(0, 20),
  // Pale honey is pale and pale amber is soft: a saturated mid amber (a Mai Tai under Champagne)
  // is honeyed amber. Peach is pinkish and pale gold is yellow, never a honey-colored amber.
  'pale honey': c => c.l >= 0.73, 'pale amber': c => c.s < 0.58, peach: onHue(5, 34), 'pale gold': onHue(40, 75),
  // Honeyed amber is a deep honey: a light golden pineapple sour (L 0.70) is not.
  'honeyed amber': c => c.l < 0.62, 'golden amber': c => c.l >= 0.6 && c.h !== null && c.h >= 32 && c.h < 46,
  // Apricot is an orange-gold fruit's color; a light amber Mai Tai with no apricot in it is golden amber.
  apricot: onHue(20, 36),
  // Tawny is a soft brown-amber (an aged-rum grog), russet a deep red-brown (strong tea, a
  // bitters-heavy sour), terracotta a rosy clay (hibiscus through grapefruit and dark rum),
  // blood-orange a deep red-orange; none of them is a pale drink.
  tawny: c => onHue(26, 38)(c) && c.s < 0.56 && c.l < 0.6, russet: c => onHue(14, 30)(c) && c.l < 0.48,
  terracotta: c => onHue(6, 20)(c) && c.s >= 0.38 && c.l < 0.62, 'blood-orange': c => onHue(8, 20)(c) && c.s >= 0.5 && c.l < 0.6,
  'orange-gold': c => onHue(32, 44)(c) && c.s >= 0.6,
};
const DARK_ONLY = new Set(['mahogany', 'oxblood', 'dark brown', 'molasses', 'near-black', 'deep plum']);
// A creamy drink's warm browns are milky (café au lait, tan), not a spirit's amber or copper.
const CLEAR_WARM = new Set(['pale honey', 'pale amber', 'honeyed amber', 'golden amber', 'amber', 'copper', 'burnished copper', 'tawny', 'russet']);
const lab = hex => {
  const [r, g, b] = lin(hex);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const NAMED_LAB = NAMED.map(([h, n]) => [lab(h), n]);
// CIEDE2000 color difference (Sharma, Wu and Dalal's formulation): how different two paints
// look. About 1 is just noticeable, 10 a clearly different shade of the same color.
export function deltaE2000(a, b) {
  const [L1, a1, b1] = lab(a), [L2, a2, b2] = lab(b), rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (x, y) => (x === 0 && y === 0 ? 0 : (Math.atan2(y, x) / rad + 360) % 360);
  const h1 = hp(ap1, b1), h2 = hp(ap2, b2), dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = Cp1 * Cp2 === 0 ? 0 : h2 - h1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2), Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = h1 + h2;
  if (Cp1 * Cp2 !== 0) hm = Math.abs(h1 - h2) <= 180 ? hm / 2 : hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T;
  const RT = -2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

// `creamy`: true when coconut or dairy clouds the drink (it may then be café au lait or tan);
// false when it doesn't; left out, every word is allowed. `layer`: a float, sink or crown band.
// `fruits`: when given, the fruits in the glass; a word named for a fruit (mango gold,
// passion-fruit gold) is then only used when that fruit is poured.
const FRUIT_WORD = { 'mango gold': 'mango', 'passion-fruit gold': 'passion', tangerine: 'orange', 'blood-orange': 'orange', apricot: 'apricot', peach: 'peach' };
export function colorWord(hex, opacity, { creamy, layer = false, cocoa = false, fruits = null } = {}) {
  const c = lab(hex), hc = hsl(hex);
  const dark = c[0] < 38;
  let best = NAMED_LAB[0], bd = Infinity;
  for (const n of NAMED_LAB) {
    if (creamy === false && CREAMY_ONLY.has(n[1])) continue;
    if (creamy && (CLEAR_WARM.has(n[1]) || NOT_CREAMY.has(n[1]))) continue;
    if (!cocoa && COCOA_ONLY.has(n[1])) continue;
    if ((cocoa || layer) && n[1] === 'oxblood') continue;
    // Coffee stirred into rum is coffee-dark, not molasses (that is a blackstrap's word).
    if (cocoa && n[1] === 'molasses') continue;
    if (WORD_GUARD[n[1]] && !WORD_GUARD[n[1]](hc)) continue;
    if (fruits && FRUIT_WORD[n[1]] && !fruits.has(FRUIT_WORD[n[1]])) continue;
    if (!dark && DARK_ONLY.has(n[1])) continue;
    // "A molasses float of Angostura" reads like a recipe line: bands get plain color words.
    if (layer && n[1] === 'molasses') continue;
    let d = (n[0][0] - c[0]) ** 2 * 1.0 + (n[0][1] - c[1]) ** 2 + (n[0][2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  let word = best[1];
  // "Creamy cream" says nothing: cream of coconut over lime is ivory.
  if (creamy && word === 'cream') word = 'ivory';
  // Fresh citrus clouds a drink: anything with a little haze isn't water-clear.
  // Lime leaves it faintly green-gold: a daiquiri is a hazy pale lime.
  if (word === 'water-clear' && opacity >= 0.08) word = `${opacity >= 0.25 ? 'cloudy' : 'hazy'} ${WORD_GUARD['pale lime'](hc) && hc.s >= 0.3 ? 'pale lime' : 'pale straw'}`;
  if (opacity >= 0.8 && /cream|ivory|tan|straw|pale|peach|apricot|gold|honey|amber|lait|mocha/.test(word)) return `creamy ${word.replace(/^(creamy|cloudy|hazy) /, '')}`;
  if (/^(cloudy|hazy) /.test(word)) return word;
  if (opacity >= 0.8) return `opaque ${word}`;
  if (opacity >= 0.45) return `cloudy ${word}`;
  return word;
}

// How far light travels through each kind of vessel (cm); opaque mugs show only the surface.
// Used for the drawing's wash depth.
export const PATH = { coupe: 5, 'nick-nora': 5, 'cocktail-glass': 5, flute: 6, rocks: 7, dof: 7, 'clay-cup': 6, highball: 6, 'acrylic-tumbler': 6.5, collins: 6, chimney: 6, 'footed-pilsner': 6, 'pearl-diver': 6, tulip: 6.5, hurricane: 7.5, 'poco-grande': 7, goblet: 7, snifter: 9.5, 'scorpion-bowl': 9.5, 'tiki-bowl': 9, 'volcano-bowl': 9, 'punch-bowl': 10 };
// Mint blended into a drink (a Missionary's Downfall) dyes it; about 8 leaves ≈ ¼ oz of green.
const BLENDED_MINT = { hex: '#6fa04a', tint: 0.8, scatter: 0.3 };

const CREAMERS = ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream', 'egg-white', 'banana', 'whole-milk', 'hot-buttered-rum-batter', 'tom-and-jerry-batter'];
// The bottles that redden a drink and the ones that gild it (the same lists the painting tilts by).
const RED_TINT = ['grenadine', 'hibiscus-syrup', 'raspberry-syrup', 'raspberry-liqueur', 'cherry-heering', 'campari', 'sloe-gin', 'cranberry-juice', 'pomegranate-juice', 'fassionola', 'strawberry', 'creme-de-cassis', 'guava-syrup', 'guava-nectar', 'watermelon-juice'];
const GOLD_TINT = ['passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'pineapple-juice', 'pineapple-syrup', 'mango-nectar', 'honey-syrup', 'apricot-nectar', 'apricot-liqueur', 'banana-liqueur', 'yellow-chartreuse'];

// The look of a finished drink: a body color and the layers its build leaves behind.
//   lines: recipe lines [{ id, oz, float, sink, crown, garnish, muddled, role }]; dilutionOz: melted ice.
export function drinkLook(lines, ingMap, { method, ice, dilutionOz = 0, vessel = null } = {}) {
  const I = l => ingMap.get(l.id);
  // Calibration against the reference drinks preferred one path for every glass (the eye
  // judges a drink's color at the glass wall, not through its full width), so PATH is kept for
  // the drawing's wash depth only.
  const pathCm = 7;
  const poured = lines.filter(l => !l.garnish && I(l) && l.role !== 'aromatic');
  const frozen = method === 'blend' || ice === 'blended';
  // A Lava Flow's strawberry purée, poured into the glass first with the colada blended over it,
  // does not settle as a band: it streaks up the walls (declared as `streak`, or a berry purée
  // marked to sink under a frozen drink).
  const streaky = l => !!l.streak || (!!l.sink && frozen && /strawberr|raspberr/.test(l.id));
  const mixed = poured.filter(l => !l.float && !l.sink && !l.crown && !l.streak);
  // Butterfly pea is a pH indicator: blue in a neutral glass, violet once citrus goes in, and
  // magenta-pink in a properly sour drink (the color-changing gin trick).
  const sourOz = mixed.filter(l => (I(l).acid || 0) >= 2).reduce((t, l) => t + l.oz, 0), mixOz = mixed.reduce((t, l) => t + l.oz, 0) || 1;
  const pea = sourOz / mixOz >= 0.15 ? '#b4428e' : sourOz / mixOz >= 0.06 ? '#7a48b0' : null;
  const parts = mixed.map(l => ({ ing: I(l), oz: l.oz, ...(pea && l.id === 'butterfly-pea-tea' ? { optics: { ...opticsOf(I(l)), hex: pea } } : {}) }));
  for (const l of lines) if (l.muddled && frozen) parts.push({ optics: BLENDED_MINT, oz: 0.25 * (l.amount || 8) / 8 });
  const body = mixColor(parts, dilutionOz, { pathCm });
  const layers = [];
  const pouredOz = mixed.reduce((s, l) => s + l.oz, 0);
  const bodyVol = pouredOz + dilutionOz;
  // A float or sink holds against the diluted body, not the neat ingredients.
  const bodySg = bodyVol ? (mixed.reduce((s, l) => s + l.oz * opticsOf(I(l)).sg, 0) + dilutionOz) / bodyVol : 1;
  for (const l of poured.filter(l => streaky(l))) {
    const o = opticsOf(I(l));
    layers.push({ kind: 'streak', id: l.id, hex: o.layerHex, opacity: o.opacity, frac: Math.min(0.6, Math.max(0.3, l.oz / Math.max(1, bodyVol) * 3)) });
  }
  for (const l of poured.filter(l => (l.float || l.sink || l.crown) && !streaky(l))) {
    const o = opticsOf(I(l));
    const holds = l.float ? o.sg < bodySg - 0.02 || ['crushed', 'pebble', 'shaved', 'ice-cone', 'blended'].includes(ice) && o.sg < bodySg : l.sink ? o.sg > bodySg + 0.02 : true;
    if (!holds) continue;
    // A layer you can't see (rich syrup is water-clear) is no layer to draw or describe.
    if ((o.tint || 0) < 0.3 && (o.scatter || 0) < 0.5) continue;
    const kind = l.float ? 'float' : l.sink ? 'sink' : 'crown';
    const frac = kind === 'crown' ? 0.06 : kind === 'float' ? Math.min(0.35, Math.max(0.08, l.oz / Math.max(1, bodyVol) * 1.3)) : Math.min(0.25, Math.max(0.15, l.oz / Math.max(1, bodyVol) * 1.6));
    const hex = kind === 'crown' ? o.hex : o.layerHex;
    // Above a sink, a mixing zone where its color bleeds into the body (grenadine in orange
    // juice reads red-orange; blue curaçao under pineapple reads green, never violet).
    const blend = kind === 'sink' ? mixColor([...mixed.map(x => ({ ing: I(x), oz: x.oz })), { ing: I(l), oz: l.oz * 2 }], dilutionOz, { pathCm }).hex : null;
    layers.push({ kind, id: l.id, hex, opacity: o.opacity, frac, ...(blend ? { blend } : {}) });
  }
  // Shaken pineapple, egg white and cream throw a pale head of foam.
  const foamy = (method === 'shake' || method === 'flash-blend') && mixed.some(l => ['pineapple-juice', 'egg-white', 'heavy-cream', 'half-and-half'].includes(l.id) && l.oz >= 0.75);
  if (foamy && !frozen && !layers.some(x => x.kind === 'float')) {
    const [a, b] = [hexToRgb(body.hex), hexToRgb('#fbf7ee')];
    layers.push({ kind: 'foam', hex: rgbToHex(a.map((v, i) => v * 0.3 + b[i] * 0.7)), opacity: 0.6, frac: mixed.some(l => l.id === 'egg-white') ? 0.09 : 0.06 });
  }
  // "Creamy" only when coconut or dairy makes it so; pulp-cloudy is "opaque" or "cloudy".
  const creamy = mixed.some(l => CREAMERS.includes(l.id) && l.oz >= 0.5);
  const cocoa = mixed.some(l => ['creme-de-cacao', 'white-creme-de-cacao', 'coffee-liqueur', 'coffee'].includes(l.id) && l.oz >= 0.5);
  // (a color word that names a fruit, tangerine or apricot, only for a glass that has that fruit
  // in it: a tagline built from the look must not promise a fruit the drink lacks)
  const fruits = new Set([['mango', /mango/], ['passion', /passion-fruit/], ['orange', /^(orange|blood-orange|tangerine|orange-curacao|triple-sec|grand-marnier)$/], ['apricot', /apricot/], ['peach', /peach/]].filter(([, re]) => mixed.some(l => re.test(l.id))).map(([f]) => f));
  let bodyWord = colorWord(body.hex, body.opacity, { creamy, cocoa, fruits }).replace(/^creamy /, creamy ? 'creamy ' : 'opaque ');
  // The bottle that colors the glass names it when it is the one a guest would know: a colada
  // gold with mango nectar is mango-gold, not tan; a clear red that is mostly Campari is Campari red.
  const hb = hsl(body.hex), shade = id => mixed.filter(l => l.id === id).reduce((t, l) => t + l.oz * (opticsOf(I(l)).tint + (opticsOf(I(l)).scatter || 0)), 0);
  const fruitGold = [['mango-nectar', 'mango-gold'], ['mango', 'mango-gold'], ['passion-fruit-nectar', 'passion-fruit gold'], ['passion-fruit-juice', 'passion-fruit gold'], ['passion-fruit-syrup', 'passion-fruit gold']]
    .map(([id, w]) => ({ w, k: shade(id) })).sort((a, b) => b.k - a.k)[0];
  if (creamy && !cocoa && fruitGold.k >= 1.5 && /^creamy (tan|orange-tan|orange-gold|pale gold|pale honey)$/.test(bodyWord) && hb.h !== null && hb.h >= 30 && hb.h < 50 && hb.s >= 0.5) bodyWord = `creamy ${fruitGold.w}`;
  // Stirred with vermouth and rum, Campari deepens to garnet; brightened with lime it stays red.
  const reds = ['campari', 'grenadine', 'hibiscus-syrup', 'raspberry-syrup', 'fassionola', 'cherry-heering', 'pomegranate-juice', 'sloe-gin', 'strawberry'];
  if (/^(cloudy )?(red|garnet)$/.test(bodyWord) && reds.every(id => id === 'campari' || shade(id) < shade('campari') * 0.5) && shade('campari') >= 2.5) {
    const citrus = mixed.some(l => (I(l).cat === 'citrus' || (I(l).acid || 0) >= 2) && l.oz >= 0.25);
    bodyWord = bodyWord.replace(/(red|garnet)$/, !citrus && hb.l < 0.36 ? 'deep Campari garnet' : 'Campari red');
  }
  // Pineapple names the glass it fills: a colada that is mostly pineapple is butter-yellow, as a
  // real Piña Colada is (ivory is for cream alone), and a shaken pineapple sour that pale is
  // pineapple gold, not a honeyed amber.
  const ozOf = ids => mixed.filter(l => ids.includes(l.id)).reduce((t, l) => t + l.oz, 0);
  const pineOz = ozOf(['pineapple-juice']), creamOz = ozOf(CREAMERS);
  const yellow = hb.h !== null && hb.h >= 38 && hb.h < 60 && hb.s >= 0.5;
  if (creamy && !cocoa && yellow && pineOz >= 4 && pineOz >= creamOz && /^creamy (ivory|cream|tan|pale gold|pale honey)$/.test(bodyWord)) bodyWord = pineOz >= 2 * creamOz ? 'creamy butter-yellow' : 'creamy pineapple-cream';
  const top = mixed.map(l => ({ id: l.id, k: shade(l.id) })).sort((a, b) => b.k - a.k)[0];
  if (!creamy && yellow && hb.s >= 0.6 && hb.l >= 0.62 && hb.l < 0.75 && top && top.id === 'pineapple-juice' && /^(opaque |cloudy )?(golden|pale gold|pale honey|pale amber|honeyed amber|golden amber|orange-gold)$/.test(bodyWord)) bodyWord = bodyWord.replace(/[a-z -]+$/, m => (/^(opaque|cloudy) /.test(m) ? m.split(' ')[0] + ' ' : '') + 'pineapple gold');
  // A copper drink reddened by a red syrup (fassionola, grenadine, hibiscus) is rust-red, as the
  // painting tilts it (artspec.js paintTilt: red carriers at least 5% of the glass and outweighing
  // the gold ones).
  const share = ids => ozOf(ids) / (mixed.reduce((t, l) => t + l.oz, 0) || 1);
  const red = share(RED_TINT), gold = share(GOLD_TINT);
  if (!creamy && /^(cloudy |opaque )?(burnished copper|copper|terracotta|russet|blood-orange)$/.test(bodyWord) && hb.h !== null && hb.h >= 15 && hb.h < 24 && hb.s >= 0.5 && red >= 0.05 && red > gold * 1.2) bodyWord = bodyWord.replace(/(burnished copper|copper|terracotta|russet|blood-orange)$/, 'rust-red');
  // The rum ambers are told apart by what else is in them, so a menu of grogs and Zombies isn't
  // one copper: a teaspoon of grenadine (with Don's Mix) leaves a Zombie a ruddy amber, as the
  // 1934 original reads; a grog sweetened with honey is honeyed amber; orange and pineapple
  // juice make a swizzle an orange-amber, and a glass that is mostly orange juice tangerine.
  const warmRum = /^(cloudy |opaque )?(copper|tawny|amber)$/;
  const redShare = (ozOf(RED_TINT) + 0.5 * ozOf(['dons-mix'])) / (mixed.reduce((t, l) => t + l.oz, 0) || 1);
  const sweeteners = mixed.filter(l => I(l).role === 'sweet' || (I(l).cat === 'syrup' && (I(l).sugar || 0) >= 40));
  const honeyLed = ozOf(['honey-syrup']) >= 0.75 && sweeteners.every(l => l.id === 'honey-syrup' || l.oz < ozOf(['honey-syrup']));
  if (!creamy && warmRum.test(bodyWord) && hb.h !== null && hb.h >= 18 && hb.h < 32 && redShare >= 0.02 && red < 0.05) bodyWord = bodyWord.replace(/(copper|tawny|amber)$/, 'ruddy amber');
  else if (!creamy && warmRum.test(bodyWord) && hb.h !== null && hb.h >= 24 && hb.h < 40 && hb.l < 0.62 && honeyLed) bodyWord = bodyWord.replace(/(copper|tawny|amber)$/, 'honeyed amber');
  else if (!creamy && warmRum.test(bodyWord) && body.opacity >= 0.45 && hb.h !== null && hb.h >= 24 && hb.h < 38 && ozOf(['orange']) >= 0.75 && ozOf(['orange', 'pineapple-juice']) >= 1.5) bodyWord = bodyWord.replace(/(copper|tawny|amber)$/, hb.s >= 0.75 && hb.l >= 0.56 && top && top.id === 'orange' ? 'tangerine' : 'orange-amber');
  // Campari and pineapple make coral (the Jungle Bird), however dark the rum leaves it.
  if (!creamy && /^(cloudy |opaque )?(terracotta|copper|rust-red|red-orange|flame orange|blood-orange)$/.test(bodyWord) && hb.h !== null && hb.h >= 5 && hb.h < 26 && ozOf(['campari']) >= 0.5 && ozOf(['pineapple-juice']) >= 2) bodyWord = bodyWord.replace(/[a-z-]+( [a-z-]+)?$/, m => (/^(opaque|cloudy) /.test(m) ? m.split(' ')[0] + ' ' : '') + 'coral');
  // Passion fruit names a clear-to-cloudy gold it colors (tea or a little rum under it), as mango
  // names a colada.
  if (!creamy && fruitGold.w === 'passion-fruit gold' && fruitGold.k >= 1.2 && top && /^passion-fruit/.test(top.id) && hb.h !== null && hb.h >= 34 && hb.h < 50 && hb.s >= 0.6 && /^(cloudy |opaque )?(amber|golden amber|honeyed amber|pale amber|tawny|apricot|orange-gold|golden|tangerine|mango gold)$/.test(bodyWord)) bodyWord = bodyWord.replace(/[a-z-]+( [a-z-]+)?$/, m => (/^(opaque|cloudy) /.test(m) ? m.split(' ')[0] + ' ' : '') + 'passion-fruit gold');
  // Melon liqueur is the green of a neon drink.
  if (!creamy && top && top.id === 'melon-liqueur' && hb.h !== null && hb.h >= 70 && hb.h < 140 && hb.s >= 0.4 && /^(cloudy |hazy )?(pale green-gold|pale lime|green|leaf green)$/.test(bodyWord)) bodyWord = bodyWord.replace(/(pale green-gold|pale lime|green|leaf green)$/, 'melon green');
  // Banana blended into a Bushwacker lightens its mocha: a banana café.
  if (creamy && cocoa && ozOf(['banana']) >= 1 && /^creamy (mocha|café au lait|tan)$/.test(bodyWord)) bodyWord = 'creamy banana-café';
  const words = [bodyWord];
  for (const x of layers) {
    const n = ((ingMap.get(x.id) || {}).name || '').toLowerCase().replace(/\s*\(.*\)/, '');
    if (x.kind === 'float') words.push(`with a ${colorWord(x.hex, 0, { layer: true })} float of ${n} on top`);
    if (x.kind === 'sink') words.push(`with ${n} settling ${colorWord(x.hex, 0, { layer: true })} at the bottom`);
    if (x.kind === 'crown') words.push(`under a ${colorWord(x.hex, 0, { layer: true })} crown of bitters`);
    if (x.kind === 'foam') words.push('with a pale froth');
    if (x.kind === 'streak') words.push(`with ${n} streaking ${colorWord(x.hex, 0, { layer: true })} up through it`);
  }
  // A Champagne top in a clear glass sparkles.
  if (words.length === 1 && !frozen && body.opacity < 0.8 && mixed.some(l => l.id === 'sparkling-wine' && l.oz >= 1)) words.push('with a sparkle');
  return { body, layers, description: words.join(' ').replace(/^./, c => c.toUpperCase()) };
}

// Hue, saturation and lightness of a hex color (hue in degrees, null for greys).
export function hsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d < 0.06) return { h: null, s: 0, l };
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d / (1 - Math.abs(2 * l - 1) || 1), l };
}
// Whether a color reads as what a guest means by a color word.
export const COLOR_TEST = {
  blue: c => c.h !== null && c.h >= 165 && c.h <= 255 && c.s > 0.2,
  green: c => c.h !== null && c.h >= 70 && c.h < 165 && c.s > 0.2,
  red: (c, layer) => c.h !== null && (c.h >= 340 || c.h < 14) && c.s > 0.45 && c.l >= (layer ? 0.2 : 0.37) && c.l < 0.62,
  pink: c => c.h !== null && (c.h >= 315 || c.h < 22) && c.l >= 0.55,
  orange: c => c.h !== null && c.h >= 14 && c.h < 40 && c.s > 0.45 && c.l >= 0.38,
  gold: c => c.h !== null && c.h >= 36 && c.h < 62 && c.s > 0.35 && c.l > 0.35,
  purple: c => c.h !== null && c.h >= 255 && c.h < 315 && c.s > 0.15,
  dark: c => c.l < 0.3,
  white: c => c.l > 0.82 && c.s < 0.45,
  clear: c => c.l > 0.85 && c.s < 0.3,
};
// Does the finished drink (its body, or a layer at least a tenth of the glass) show this color?
export function showsColor(look, color) {
  const test = COLOR_TEST[color];
  if (!test || !look) return true;
  if (color === 'clear') return look.body.opacity < 0.2 && test(hsl(look.body.hex));
  if (color === 'white') return look.body.opacity >= 0.6 && test(hsl(look.body.hex));
  // A band at least a tenth of the glass counts; a deep ruby sink reads as red.
  if (look.body && look.body.hex && test(hsl(look.body.hex), false)) return true;
  return (look.layers || []).filter(x => x.kind !== 'foam' && (x.frac || 0) >= 0.08).some(x => x.hex && test(hsl(x.hex), true));
}

// How far a look is from a color word (0 = shows it). Used to keep the closest attempt when no
// build can honor the color outright.
const TARGET = { blue: [205, 0.6, 0.55], green: [120, 0.5, 0.5], red: [355, 0.7, 0.4], pink: [340, 0.6, 0.75], orange: [28, 0.75, 0.55], gold: [45, 0.7, 0.55], purple: [280, 0.4, 0.45], dark: [30, 0.4, 0.15], white: [45, 0.2, 0.92], clear: [50, 0.1, 0.95] };
export function colorDistance(look, color) {
  if (!look || !TARGET[color]) return 0;
  if (showsColor(look, color)) return 0;
  const [th, ts, tl] = TARGET[color];
  const d = x => {
    const c = hsl(x.hex);
    const dh = c.h === null ? 180 : Math.min(Math.abs(c.h - th), 360 - Math.abs(c.h - th));
    return dh / 180 + Math.abs(c.s - ts) * 0.5 + Math.abs(c.l - tl);
  };
  return Math.min(...[look.body, ...(look.layers || []).filter(x => x.kind !== 'foam')].filter(x => x && x.hex).map(d));
}
