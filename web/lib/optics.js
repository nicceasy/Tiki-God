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
  rum: { hex: '#c98a3e', opacity: 0, tint: 1 }, spirit: { hex: '#f4f1e8', opacity: 0, tint: 0.1 },
  liqueur: { hex: '#e9cf9a', opacity: 0, tint: 0.6 }, fortified: { hex: '#c98b4e', opacity: 0, tint: 1 },
  bitters: { hex: '#7a2418', opacity: 0, tint: 4 }, syrup: { hex: '#f3ead6', opacity: 0, tint: 0.3 },
  citrus: { hex: '#e6edc0', opacity: 0.25, tint: 0.5 }, juice: { hex: '#f2c560', opacity: 0.5, tint: 1 },
  cream: { hex: '#f7f3ea', opacity: 0.95, tint: 1 }, soda: { hex: '#f6f4ec', opacity: 0, tint: 0.1 }, aromatic: { hex: '#ffffff', opacity: 0, tint: 0 },
};

export function opticsOf(ing) {
  const o = (ing && ing.optics) || {};
  const fb = CAT_FALLBACK[ing && ing.cat] || CAT_FALLBACK.spirit;
  return {
    hex: o.hex || fb.hex,
    opacity: o.opacity ?? fb.opacity,
    tint: o.tint ?? fb.tint,
    sg: o.sg ?? specificGravity(ing),
  };
}

// Specific gravity from the chemistry we already store: dissolved sugar raises it about 0.0038
// per g/100 ml; alcohol lowers it about 0.0013 per % ABV (40% spirit ≈ 0.95, simple syrup ≈ 1.23).
export function specificGravity(ing) {
  if (!ing) return 1;
  return 1 + 0.0038 * (ing.sugar || 0) - 0.0013 * (ing.abv || 0);
}

// Mix parts [{ ing, oz }] plus melted ice (waterOz) into one color.
export function mixColor(parts, waterOz = 0) {
  const total = parts.reduce((s, p) => s + p.oz, 0) + waterOz;
  if (total <= 0) return { hex: '#f3efe6', opacity: 0, clarity: 1 };
  const A = [0, 0, 0];
  let scatter = 0;
  const albedo = [0, 0, 0];
  for (const p of parts) {
    const o = opticsOf(p.ing);
    if (!o.tint && !o.opacity) continue;
    const f = p.oz / total;
    const c = lin(o.hex);
    // Absorbance of the ingredient at full strength; tint scales how hard it colors per ounce.
    for (let k = 0; k < 3; k++) A[k] += f * o.tint * -Math.log(Math.max(c[k], 0.004));
    const s = f * o.opacity;
    scatter += s;
    for (let k = 0; k < 3; k++) albedo[k] += s * c[k];
  }
  const T = A.map(a => Math.exp(-a));
  const S = 1 - Math.exp(-3.2 * scatter); // cloudiness 0..1
  const alb = scatter > 0 ? albedo.map(v => v / scatter) : [1, 1, 1];
  // Scattered light is still filtered by what the drink absorbs, but over a shorter path.
  const out = T.map((t, k) => (1 - S) * t + S * alb[k] * Math.sqrt(t));
  const clarity = (T[0] + T[1] + T[2]) / 3;
  return { hex: hexLin(out), opacity: Math.round(S * 100) / 100, clarity: Math.round(clarity * 100) / 100 };
}

const NAMED = [
  ['#f5f1e6', 'water-clear'], ['#f4ecd6', 'pale straw'], ['#f2e1a0', 'pale gold'], ['#f0c95a', 'golden'], ['#e9a640', 'deep gold'],
  ['#d98a3a', 'amber'], ['#b8692c', 'burnished amber'], ['#8a4a22', 'mahogany'], ['#5a2e16', 'dark brown'], ['#2e1a10', 'near-black'],
  ['#f6c6a0', 'peach'], ['#f29a6a', 'coral'], ['#e8743c', 'orange'], ['#e0563a', 'red-orange'], ['#c8303a', 'red'], ['#9c1e3a', 'ruby'],
  ['#f2a8b8', 'pink'], ['#d86a94', 'hot pink'], ['#8a4ab0', 'violet'], ['#3a8ad8', 'blue'], ['#5ac0c8', 'aqua'], ['#3aa88a', 'teal-green'],
  ['#9cc95a', 'green'], ['#d9e09a', 'pale green-gold'], ['#f3ead8', 'cream'], ['#ecd9b4', 'tan'], ['#c9a27a', 'café au lait'], ['#7a5a40', 'mocha'],
];
export function colorWord(hex, opacity) {
  const c = hexToRgb(hex);
  let best = NAMED[0], bd = Infinity;
  for (const n of NAMED) {
    const d = hexToRgb(n[0]).reduce((s, v, i) => s + (v - c[i]) ** 2 * [0.3, 0.59, 0.11][i], 0);
    if (d < bd) { bd = d; best = n; }
  }
  const word = best[1];
  if (opacity >= 0.7 && /cream|tan|straw|pale/.test(word)) return `creamy ${word.replace('creamy ', '')}`;
  if (opacity >= 0.45) return `cloudy ${word}`;
  return word;
}

// The look of a finished drink: a body color and the layers its build leaves behind.
//   lines: recipe lines [{ id, oz, float, sink, garnish, role }]; dilutionOz: melted ice.
export function drinkLook(lines, ingMap, { method, ice, dilutionOz = 0 } = {}) {
  const I = l => ingMap.get(l.id);
  const poured = lines.filter(l => !l.garnish && I(l) && l.role !== 'aromatic');
  const mixed = poured.filter(l => !l.float && !l.sink && !l.crown);
  const body = mixColor(mixed.map(l => ({ ing: I(l), oz: l.oz })), dilutionOz);
  const layers = [];
  const bodyVol = mixed.reduce((s, l) => s + l.oz, 0) + dilutionOz;
  const bodySg = bodyVol ? mixed.reduce((s, l) => s + l.oz * opticsOf(I(l)).sg, 0) / Math.max(1e-6, mixed.reduce((s, l) => s + l.oz, 0)) : 1;
  const frozen = method === 'blend' || ice === 'blended';
  for (const l of poured.filter(l => l.float || l.sink || l.crown)) {
    const o = opticsOf(I(l));
    // A float only floats if it is lighter than the drink; a sink only sinks if heavier.
    const holds = l.float ? o.sg < bodySg + 0.02 : l.sink ? o.sg > bodySg - 0.02 : true;
    if (!holds) continue;
    const solo = mixColor([{ ing: I(l), oz: l.oz }], l.crown ? 0 : l.oz * 0.3);
    const frac = Math.min(0.4, Math.max(0.08, l.oz / Math.max(1, bodyVol + l.oz) * (frozen ? 1.2 : 1.6)));
    layers.push({ kind: l.float ? 'float' : l.sink ? 'sink' : 'crown', id: l.id, hex: solo.hex, opacity: solo.opacity, frac: l.crown ? 0.06 : frac });
  }
  // Shaken pineapple, egg white and cream throw a pale head of foam.
  const foamy = (method === 'shake' || method === 'flash-blend') && mixed.some(l => ['pineapple-juice', 'egg-white', 'heavy-cream', 'half-and-half'].includes(l.id) && l.oz >= 0.75);
  if (foamy && !layers.some(x => x.kind === 'float')) layers.push({ kind: 'foam', hex: mixColor([...mixed.map(l => ({ ing: I(l), oz: l.oz * 0.3 })), { ing: { optics: { hex: '#fbf7ee', opacity: 0.9, tint: 1 } }, oz: bodyVol }]).hex, opacity: 0.6, frac: 0.07 });
  const words = [colorWord(body.hex, body.opacity)];
  for (const x of layers) {
    const n = (ingMap.get(x.id) || {}).name || '';
    if (x.kind === 'float') words.push(`with a ${colorWord(x.hex, x.opacity)} float of ${n.toLowerCase().replace(/\s*\(.*\)/, '')} on top`);
    if (x.kind === 'sink') words.push(`with ${n.toLowerCase().replace(/\s*\(.*\)/, '')} settling ${colorWord(x.hex, x.opacity)} at the bottom`);
    if (x.kind === 'crown') words.push(`under a ${colorWord(x.hex, x.opacity)} crown of bitters`);
    if (x.kind === 'foam') words.push('with a pale froth');
  }
  return { body, layers, description: words.join(' ').replace(/^./, c => c.toUpperCase()) };
}
