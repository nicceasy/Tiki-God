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
  // Never pure black: a Goslings float still reads as liquid.
  const out = T.map((t, k) => Math.max(0.012, (1 - S) * t + S * R[k]));
  const clarity = (T[0] + T[1] + T[2]) / 3;
  return { hex: hexLin(out), opacity: Math.round(S * 100) / 100, clarity: Math.round(clarity * 100) / 100 };
}

// Color names a bartender would use, matched perceptually (CIE Lab) rather than by raw RGB.
// Warm drinks get the words a menu would use for them (honeyed amber, mango gold, burnished
// copper, rose gold), not "brown". The milky colors (café au lait, tan, mocha, cream, ivory) belong to
// drinks that coconut or dairy makes creamy; the dark browns (mahogany, molasses, dark brown,
// near-black) to drinks that really are that dark.
const NAMED = [
  ['#f5f1e6', 'water-clear'], ['#f4ecd6', 'pale straw'], ['#f2e1a0', 'pale gold'], ['#f0c95a', 'golden'], ['#f2b73a', 'passion-fruit gold'], ['#f2a32e', 'mango gold'],
  ['#e8cc94', 'pale honey'], ['#dcb07a', 'pale amber'], ['#e5b46a', 'honeyed amber'], ['#d98a3a', 'amber'], ['#c8804e', 'copper'], ['#b05a26', 'burnished copper'], ['#8f6a32', 'dark amber'], ['#f08a34', 'tangerine'], ['#ea6a30', 'sunset orange'],
  ['#8a4a22', 'mahogany'], ['#5a2e16', 'dark brown'], ['#3e1c0e', 'molasses'], ['#2e1a10', 'near-black'], ['#4a0c2c', 'deep plum'],
  ['#f6c6a0', 'peach'], ['#f2b276', 'apricot'], ['#e9a38c', 'rose gold'], ['#f29a6a', 'coral'], ['#e0563a', 'red-orange'], ['#c8303a', 'red'], ['#9c1e3a', 'ruby'], ['#7a1a1e', 'garnet'],
  ['#f2a8b8', 'pink'], ['#f6d0d8', 'blush'], ['#d65a8c', 'hibiscus pink'], ['#c2185b', 'magenta'], ['#8a4ab0', 'violet'], ['#c8b4e0', 'lavender'], ['#5a3a8a', 'deep purple'],
  ['#3a8ad8', 'blue'], ['#1a5ab8', 'deep blue'], ['#a6d8e8', 'pale aqua'], ['#7ac4dc', 'sky blue'], ['#40b0c8', 'turquoise'], ['#5ac0b0', 'lagoon teal'],
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
  tangerine: onHue(18, 40), 'sunset orange': onHue(10, 30), 'mango gold': onHue(30, 46), 'passion-fruit gold': onHue(34, 50),
  'hibiscus pink': onHue(315, 2), 'rose gold': onHue(0, 30), copper: onHue(5, 36), ruby: onHue(330, 12), 'deep plum': onHue(300, 350),
  lavender: onHue(240, 320), violet: onHue(250, 320), 'deep purple': onHue(250, 320),
};
const DARK_ONLY = new Set(['mahogany', 'dark brown', 'molasses', 'near-black', 'deep plum']);
// A creamy drink's warm browns are milky (café au lait, tan), not a spirit's amber or copper.
const CLEAR_WARM = new Set(['pale honey', 'pale amber', 'honeyed amber', 'amber', 'copper', 'burnished copper']);
const lab = hex => {
  const [r, g, b] = lin(hex);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const NAMED_LAB = NAMED.map(([h, n]) => [lab(h), n]);
// `creamy`: true when coconut or dairy clouds the drink (it may then be café au lait or tan);
// false when it doesn't; left out, every word is allowed. `layer`: a float, sink or crown band.
export function colorWord(hex, opacity, { creamy, layer = false, cocoa = false } = {}) {
  const c = lab(hex), hc = hsl(hex);
  const dark = c[0] < 38;
  let best = NAMED_LAB[0], bd = Infinity;
  for (const n of NAMED_LAB) {
    if (creamy === false && CREAMY_ONLY.has(n[1])) continue;
    if (creamy && (CLEAR_WARM.has(n[1]) || NOT_CREAMY.has(n[1]))) continue;
    if (!cocoa && COCOA_ONLY.has(n[1])) continue;
    if (WORD_GUARD[n[1]] && !WORD_GUARD[n[1]](hc)) continue;
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
export const PATH = { coupe: 5, 'nick-nora': 5, 'cocktail-glass': 5, flute: 6, rocks: 7, dof: 7, 'clay-cup': 6, highball: 6, collins: 6, chimney: 6, 'footed-pilsner': 6, 'pearl-diver': 6, tulip: 6.5, hurricane: 7.5, 'poco-grande': 7, goblet: 7, snifter: 9.5, 'scorpion-bowl': 9.5, 'tiki-bowl': 9, 'volcano-bowl': 9, 'punch-bowl': 10 };
// Mint blended into a drink (a Missionary's Downfall) dyes it; about 8 leaves ≈ ¼ oz of green.
const BLENDED_MINT = { hex: '#6fa04a', tint: 0.8, scatter: 0.3 };

// The look of a finished drink: a body color and the layers its build leaves behind.
//   lines: recipe lines [{ id, oz, float, sink, crown, garnish, muddled, role }]; dilutionOz: melted ice.
export function drinkLook(lines, ingMap, { method, ice, dilutionOz = 0, vessel = null } = {}) {
  const I = l => ingMap.get(l.id);
  // Calibration against the reference drinks preferred one path for every glass (the eye
  // judges a drink's color at the glass wall, not through its full width), so PATH is kept for
  // the drawing's wash depth only.
  const pathCm = 7;
  const poured = lines.filter(l => !l.garnish && I(l) && l.role !== 'aromatic');
  const mixed = poured.filter(l => !l.float && !l.sink && !l.crown);
  const frozen = method === 'blend' || ice === 'blended';
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
  for (const l of poured.filter(l => l.float || l.sink || l.crown)) {
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
  const creamy = mixed.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'irish-cream', 'egg-white', 'banana', 'whole-milk', 'hot-buttered-rum-batter', 'tom-and-jerry-batter'].includes(l.id) && l.oz >= 0.5);
  const cocoa = mixed.some(l => ['creme-de-cacao', 'white-creme-de-cacao', 'coffee-liqueur', 'coffee'].includes(l.id) && l.oz >= 0.5);
  const bodyWord = colorWord(body.hex, body.opacity, { creamy, cocoa }).replace(/^creamy /, creamy ? 'creamy ' : 'opaque ');
  const words = [bodyWord];
  for (const x of layers) {
    const n = ((ingMap.get(x.id) || {}).name || '').toLowerCase().replace(/\s*\(.*\)/, '');
    if (x.kind === 'float') words.push(`with a ${colorWord(x.hex, 0, { layer: true })} float of ${n} on top`);
    if (x.kind === 'sink') words.push(`with ${n} settling ${colorWord(x.hex, 0, { layer: true })} at the bottom`);
    if (x.kind === 'crown') words.push(`under a ${colorWord(x.hex, 0, { layer: true })} crown of bitters`);
    if (x.kind === 'foam') words.push('with a pale froth');
  }
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
