// Turns a recipe (or the page layout) into a JSON art spec that may only use parts from the
// catalog, like json-render's guardrailed component specs. The renderer draws the spec element
// by element; nothing outside the catalog can appear, so the same spec could come from anywhere.
//   { v: 1, box: [w, h], seed, elements: [{ part, params?, x, y, s?, rot?, anchor?: [ax, ay] }] }
// (x, y) is where the part's anchor lands; the part is scaled by s and turned by rot about it.
import { CATALOG, PALETTE, rimOf, levelOf, GLASS_PROFILES } from './artcatalog.js';
import { rng, seedOf, mixHex } from './ink.js';
import { vesselForDrink } from './vessels.js';

// [r, g, b, tint]: tint is how strongly an ingredient colors the drink per ounce.
const COLOR = {
  'rum-white-column': [250, 244, 225, 0.2], 'rum-gold-column': [214, 150, 60, 1], 'rum-aged-column': [190, 110, 40, 1.2],
  'rum-blended-light': [245, 235, 205, 0.3], 'rum-barbados': [200, 120, 45, 1.2], 'rum-jamaican-aged': [185, 100, 35, 1.3],
  'rum-jamaican-dark': [105, 48, 18, 2.2], 'rum-jamaican-pot': [190, 120, 40, 1.2], 'rum-jamaican-white-overproof': [250, 248, 235, 0.2],
  'rum-demerara': [125, 58, 20, 2], 'rum-demerara-overproof': [115, 52, 18, 2.2], 'rum-black-blended': [55, 24, 10, 3],
  'rum-black-overproof': [60, 26, 10, 3], 'rum-agricole-blanc': [248, 244, 228, 0.2], 'rum-agricole-vieux': [200, 128, 50, 1.2],
  'rum-haitian': [210, 140, 60, 1], 'rum-navy': [118, 54, 20, 2], 'rum-overproof-white': [250, 248, 238, 0.2],
  'rum-spiced': [190, 110, 40, 1.2], 'rum-pineapple': [220, 160, 70, 1], 'rum-cachaca': [248, 244, 230, 0.2],
  bourbon: [190, 110, 45, 1.3], rye: [185, 105, 45, 1.3], 'scotch-blended': [205, 140, 60, 1.1], 'scotch-islay': [215, 160, 70, 1],
  brandy: [175, 95, 40, 1.3], applejack: [200, 130, 55, 1.1], 'tequila-reposado': [232, 196, 118, 0.7],
  lime: [212, 228, 160, 0.7], lemon: [246, 238, 160, 0.6], grapefruit: [248, 184, 160, 0.8], orange: [255, 160, 45, 1.3], 'yuzu-juice': [245, 235, 150, 0.6],
  'pineapple-juice': [255, 214, 88, 1.2], 'passion-fruit-juice': [255, 186, 50, 1.4], 'passion-fruit-nectar': [255, 180, 60, 1.3],
  'guava-nectar': [255, 140, 140, 1.4], 'mango-nectar': [255, 176, 45, 1.4], 'papaya-nectar': [255, 150, 90, 1.3], 'apricot-nectar': [255, 165, 70, 1.3],
  'cranberry-juice': [205, 30, 60, 2.2], 'pomegranate-juice': [150, 20, 50, 2.5], 'apple-juice': [230, 196, 110, 1], 'coconut-water': [245, 245, 235, 0.3],
  'watermelon-juice': [255, 105, 120, 1.4], banana: [246, 232, 170, 1.2], strawberry: [228, 45, 70, 2],
  'demerara-syrup': [200, 140, 70, 0.8], 'honey-syrup': [240, 190, 80, 0.8], 'cinnamon-syrup': [190, 110, 60, 0.8], 'vanilla-syrup': [230, 205, 165, 0.4],
  orgeat: [246, 240, 228, 0.9], 'passion-fruit-syrup': [252, 176, 45, 1.5], grenadine: [200, 18, 50, 3.5], 'falernum-syrup': [240, 228, 195, 0.4],
  'ginger-syrup': [232, 208, 150, 0.5], 'maple-syrup': [175, 95, 35, 1.2], 'agave-syrup': [240, 220, 160, 0.3], 'raspberry-syrup': [220, 35, 90, 3],
  'pineapple-syrup': [255, 220, 120, 0.8], 'hibiscus-syrup': [190, 25, 85, 3.5], 'guava-syrup': [255, 115, 140, 2], 'lychee-syrup': [250, 240, 235, 0.3],
  'lime-cordial': [196, 228, 110, 1], 'dons-mix': [242, 170, 140, 1], 'dons-spices-2': [205, 150, 100, 0.8], 'gardenia-mix': [242, 205, 130, 1.2],
  'hot-buttered-rum-batter': [200, 140, 70, 1.5], 'five-spice-syrup': [170, 90, 50, 1], 'li-hing-mui-syrup': [220, 120, 120, 1],
  'orange-curacao': [255, 170, 60, 1.1], 'blue-curacao': [25, 120, 235, 4], 'apricot-liqueur': [240, 150, 60, 1.1], 'peach-liqueur': [250, 180, 120, 0.9],
  'cherry-heering': [120, 12, 30, 3.5], 'banana-liqueur': [250, 222, 90, 1], 'blackberry-liqueur': [85, 12, 42, 3.5], 'raspberry-liqueur': [150, 12, 50, 3.5],
  'creme-de-cassis': [70, 0, 40, 4], 'coffee-liqueur': [45, 20, 10, 4], 'creme-de-cacao': [120, 60, 30, 1.5], galliano: [255, 225, 40, 2],
  benedictine: [210, 150, 60, 1.2], 'green-chartreuse': [140, 190, 60, 2.5], 'yellow-chartreuse': [240, 220, 80, 1.8], campari: [220, 18, 40, 4],
  aperol: [255, 95, 30, 3], amaro: [90, 40, 20, 2.5], cynar: [80, 50, 20, 2.5], fernet: [50, 30, 15, 3], drambuie: [210, 140, 50, 1.3],
  'allspice-dram': [120, 40, 20, 2.5], 'velvet-falernum': [246, 236, 200, 0.4], 'passion-fruit-liqueur': [250, 150, 40, 1.5], amaretto: [200, 120, 50, 1.4],
  'hazelnut-liqueur': [190, 130, 60, 1.2], 'licor-43': [250, 210, 60, 1.5], 'irish-cream': [215, 190, 160, 1.5], 'sloe-gin': [170, 20, 60, 3],
  'ancho-reyes': [160, 60, 30, 2], 'ginger-liqueur': [240, 210, 120, 0.8], 'melon-liqueur': [110, 220, 60, 3.5], 'swedish-punsch': [220, 180, 80, 1.2],
  'sweet-vermouth': [115, 28, 20, 2.5], 'amontillado-sherry': [210, 160, 90, 1], 'px-sherry': [70, 30, 15, 3], 'ruby-port': [140, 20, 40, 3],
  'lillet-blanc': [250, 225, 130, 0.8], 'sparkling-wine': [250, 240, 190, 0.4], 'white-wine': [245, 235, 170, 0.4],
  angostura: [140, 40, 20, 5], peychauds: [220, 30, 40, 5], 'orange-bitters': [230, 140, 40, 3], 'tiki-bitters': [150, 60, 30, 4], 'mole-bitters': [100, 40, 20, 4],
  'coconut-cream': [252, 250, 244, 1.6], 'coconut-milk': [250, 250, 244, 1.4], 'heavy-cream': [255, 253, 246, 1.6], 'half-and-half': [255, 253, 246, 1.3],
  'egg-white': [250, 250, 244, 0.6], 'vanilla-ice-cream': [255, 246, 226, 1.8], butter: [250, 225, 140, 0.6],
  'ginger-beer': [238, 218, 160, 0.4], 'ginger-ale': [232, 205, 145, 0.4], cola: [70, 30, 14, 3], coffee: [58, 32, 18, 3.5], 'black-tea': [170, 88, 38, 1.5],
};
const CAT_DEFAULT = { rum: [200, 130, 50, 1], spirit: [248, 246, 238, 0.2], liqueur: [240, 210, 150, 0.6], fortified: [210, 150, 90, 1], bitters: [140, 40, 20, 4], syrup: [250, 246, 238, 0.2], citrus: [225, 230, 170, 0.6], juice: [255, 205, 100, 1], cream: [252, 250, 245, 1.5], soda: [245, 245, 240, 0.1], aromatic: [0, 0, 0, 0] };
const FIZZ = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'sparkling-wine']);

const hex = rgb => `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// The drink's color, mixed from what's in it by volume and tint strength, then pushed a little
// toward watercolor: a pale drink still gets a visible, ice-cool wash.
export function liquidColor(lines, ingMap) {
  let r = 0, g = 0, b = 0, w = 0;
  for (const l of lines) {
    if (l.garnish || l.float) continue;
    const ing = ingMap.get(l.id);
    if (!ing) continue;
    const c = COLOR[l.id] || CAT_DEFAULT[ing.cat] || [240, 230, 200, 0.5];
    const k = Math.max(l.oz || 0, 0.02) * c[3];
    r += c[0] * k; g += c[1] * k; b += c[2] * k; w += k;
  }
  let rgb = w ? [r / w, g / w, b / w] : [240, 230, 200];
  let color = hex(rgb);
  const lum = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) / 255;
  if (lum > 0.86) color = mixHex(color, PALETTE.ice, 0.45);
  return color;
}

// The recipe's own vessel (every generated drink has one); older recipes fall back to their glass text.
export function pickVessel(recipe) {
  const id = recipe.vessel && recipe.vessel.id;
  if (id && GLASS_PROFILES[id]) return id;
  const v = vesselForDrink({ name: recipe.name, glass: recipe.method.glass, method: recipe.method.method, ice: recipe.method.ice, ingredients: [] });
  return GLASS_PROFILES[v] ? v : 'collins';
}

// Anchor of each garnish part in its own box: the point that touches the drink.
const ANCHOR = {
  'garnish.mint': [35, 88], 'garnish.lime-wheel': [30, 30], 'garnish.orange-wheel': [30, 30], 'garnish.lime-shell': [30, 20],
  'garnish.cherry': [18, 58], 'garnish.orchid': [30, 30], 'garnish.umbrella': [45, 88], 'garnish.pineapple-wedge': [35, 34],
  'garnish.cinnamon': [12, 80], 'garnish.beans': [26, 11], 'garnish.peel': [12, 4],
};

export function drinkSpec(recipe, ingMap) {
  const seed = seedOf(`${recipe.name}|${recipe.seed ?? 0}`);
  const r = rng(seed);
  const kind = pickVessel(recipe);
  const R = rimOf(kind), G = GLASS_PROFILES[kind];
  const method = recipe.method.method;
  const hot = method === 'hot';
  const frozen = method === 'blend' || recipe.method.ice === 'blended';
  const iceStyle = hot ? 'none' : frozen ? 'blended' : recipe.method.ice;
  const UP = ['coupe', 'nick-nora', 'cocktail-glass', 'flute'];
  const BOWL = ['scorpion-bowl', 'volcano-bowl', 'punch-bowl'].includes(kind);
  const heaped = ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(iceStyle) && !UP.includes(kind);
  const fill = UP.includes(kind) ? 0.86 : BOWL ? 0.72 : kind === 'irish-coffee' ? 0.8 : 0.84;
  const level = levelOf(kind, fill);
  const color = liquidColor(recipe.lines, ingMap);
  const floats = recipe.lines.filter(l => l.float && !l.garnish);
  const bitters = recipe.lines.some(l => (ingMap.get(l.id) || {}).cat === 'bitters');
  const crown = floats.length ? liquidColor(floats.map(f => ({ ...f, float: false })), ingMap) : method === 'swizzle' && bitters ? '#8C2F1C' : null;
  const g = (recipe.garnish || []).join(' ').toLowerCase();
  const flaming = !!(recipe.style && recipe.style.flaming) || recipe.method.steps.some(s => /light it/i.test(s));
  const glaze = [PALETTE.wood, PALETTE.lagoon, PALETTE.frond, PALETTE.woodPale][Math.floor(r() * 4)];

  const els = [];
  const add = (part, params, x, y, s = 1, rot = 0) => els.push({ part, params, x, y, s, rot, anchor: ANCHOR[part] });
  els.push({ part: 'glass', params: { kind, glaze, flaming }, x: 0, y: 0 });
  els.push({ part: 'liquid', params: { kind, fill, color, crown, frozen }, x: 0, y: 0 });
  if (iceStyle !== 'none' && iceStyle !== 'blended' && !(UP.includes(kind) && !heaped)) els.push({ part: 'ice', params: { kind, style: iceStyle, fill, seed: seed % 997 }, x: 0, y: 0 });
  if (recipe.lines.some(l => FIZZ.has(l.id))) els.push({ part: 'fizz', params: { kind, fill, seed: seed % 991 }, x: 0, y: 0 });

  // Where things rest: on the ice heap, the frozen dome, or the surface.
  const top = heaped ? R.y - 14 : frozen ? R.y - 24 : G.opaque ? R.y : level;
  const hw = R.hw;
  const tall = ![...UP, 'hot-mug', 'irish-coffee', 'rocks', 'clay-cup', 'punch-bowl'].includes(kind) && !hot && method !== 'stir';
  const garnishes = [];
  if (/mint/.test(g)) garnishes.push(() => add('garnish.mint', { big: /bouquet|big/.test(g) }, R.cx - hw * 0.34, top + 6, BOWL ? 1.25 : 1.05, -0.12));
  if (/pineapple/.test(g)) garnishes.push(() => add('garnish.pineapple-wedge', {}, R.cx + hw * 0.96, R.y - 4, 0.9, 0.55));
  if (/lime (wheel|wedge|slice)/.test(g)) garnishes.push(() => add('garnish.lime-wheel', {}, R.cx - hw * 0.96, R.y + 2, 0.72, -0.3));
  else if (/orange (wheel|slice|half)|^orange$/.test(g)) garnishes.push(() => add('garnish.orange-wheel', {}, R.cx - hw * 0.96, R.y + 2, 0.72, -0.3));
  if (/spent lime|lime shell/.test(g) || flaming) garnishes.push(() => add('garnish.lime-shell', {}, R.cx + hw * 0.05, top - 4, 0.9, 0.08));
  if (/cherr/.test(g)) garnishes.push(() => add('garnish.cherry', {}, R.cx + hw * 0.42, top - 2, 0.85, 0.15));
  if (/orchid|flower/.test(g)) garnishes.push(() => add('garnish.orchid', {}, R.cx - hw * 0.5, top - 8, 0.85, 0.2));
  if (/cinnamon/.test(g)) garnishes.push(() => add('garnish.cinnamon', {}, R.cx + hw * 0.22, (G.opaque ? R.y + 10 : hot ? level + 18 : top + 18), 0.95, 0.22));
  if (/coffee bean/.test(g)) garnishes.push(() => add('garnish.beans', {}, R.cx, top - 2, 0.8, 0));
  if (/twist|zest|peel/.test(g) && !/lime zest/.test(g)) garnishes.push(() => add('garnish.peel', {}, R.cx + hw * 0.9, R.y - 2, 0.8, -0.1));
  if (/nutmeg/.test(g)) garnishes.push(() => els.push({ part: 'garnish.nutmeg', params: { rx: hw * 0.55, ry: hw * 0.55 * G.rimTilt + 2, seed: seed % 983 }, x: R.cx - hw * 0.55, y: top - hw * 0.55 * G.rimTilt - 2 }));
  const umbrella = /umbrella/.test(g) || ['colada', 'resort-punch'].includes(recipe.family.id);

  if (tall) {
    const straws = BOWL ? Math.min(3, Math.max(2, recipe.servings || 2)) : 1;
    for (let i = 0; i < straws; i++) {
      // Through a clear glass the straw shows all the way down; a mug hides all but the top.
      const foot = G.opaque ? R.y + 4 : R.bottom - 14;
      const len = G.opaque ? 92 : (R.bottom - R.y) * 0.9 + 70;
      const tilt = straws > 1 ? (i - (straws - 1) / 2) * 0.32 : 0.14;
      els.push({ part: 'straw', params: { len }, x: R.cx + hw * (straws > 1 ? (i - (straws - 1) / 2) * 0.3 : 0.3), y: foot, s: 1, rot: tilt, anchor: [7, len] });
    }
  }
  garnishes.slice(0, 4).forEach(f => f());
  if (umbrella && !UP.includes(kind)) add('garnish.umbrella', {}, R.cx - hw * 0.12, top + 4, 0.95, -0.22);
  if (hot) els.push({ part: 'steam', params: { kind }, x: 0, y: 0 });
  return { v: 1, box: [300, 460], fit: 'content-y', seed, kind, elements: els };
}

// The decorative drawings around the prayer. `text` is the prayer column's box in hero pixels;
// nothing is drawn over it. Wide screens get two side columns, phones a band above the title.
export function sceneSpec(w, h, text) {
  const els = [];
  const put = (part, params, cx, cy, target, maxW, rot = 0) => {
    const [bw, bh] = CATALOG[part](params).box;
    const s = Math.max(0.3, Math.min(target / bh, maxW / bw));
    els.push({ part, params, x: cx, y: cy, s, rot, anchor: [bw / 2, bh / 2] });
  };
  const left = text.left, right = w - text.right;
  if (Math.min(left, right) >= 150) {
    const lx = left / 2, rx = text.right + right / 2, lw = left - 36, rw = right - 36;
    const H = Math.max(h, 460);
    put('flower.hibiscus', { seed: 3 }, lx + 6, H * 0.2, 150, lw, -0.25);
    put('mug.moai', { glaze: PALETTE.wood }, lx - 10, H * 0.56, 176, lw, 0.04);
    put('flower.plumeria', { seed: 5 }, lx + 34, H * 0.87, 92, lw, 0.4);
    put('leaf.monstera', {}, rx + 4, H * 0.24, 160, rw, 0.5);
    put('fruit.pineapple', {}, rx - 6, H * 0.7, 190, rw, -0.1);
  } else {
    const band = Math.max(90, text.top - 12), third = w / 3;
    put('flower.hibiscus', { seed: 3 }, third * 0.52, band * 0.5, band * 0.78, third - 8, -0.25);
    put('mug.moai', { glaze: PALETTE.wood }, w / 2, band * 0.52, band * 0.92, third, 0.03);
    put('leaf.monstera', {}, w - third * 0.52, band * 0.5, band * 0.84, third - 8, 0.5);
  }
  return { v: 1, box: [w, h], seed: 7, elements: els };
}

// Small drawings are built at their display size so the ink keeps a readable weight.
export const idolSpec = (w, h, blink = false) => {
  const s = Math.min(w / 170, h / 214);
  return { v: 1, box: [w, h], seed: 21, elements: [{ part: 'idol.ku', params: { blink }, x: w / 2, y: h, s, anchor: [85, 212] }] };
};
export const frameSpec = (w, h) => ({ v: 1, box: [w + 12, h + 12], seed: 31, elements: [{ part: 'frame', params: { w, h, r: Math.min(18, h / 2.6) }, x: 6, y: 6 }] });

// Guardrails: only catalog parts, finite numbers, a bounded number of elements.
export function validateSpec(spec) {
  const errors = [];
  if (!spec || spec.v !== 1 || !Array.isArray(spec.box) || spec.box.length !== 2) errors.push('bad spec header');
  const els = Array.isArray(spec && spec.elements) ? spec.elements : [];
  if (els.length > 48) errors.push('too many elements');
  const ok = [];
  els.slice(0, 48).forEach((e, i) => {
    const nums = [e.x, e.y, e.s ?? 1, e.rot ?? 0, ...(e.anchor || [])];
    if (!Object.prototype.hasOwnProperty.call(CATALOG, e.part)) errors.push(`element ${i}: unknown part "${e.part}"`);
    else if (!nums.every(Number.isFinite)) errors.push(`element ${i}: non-numeric placement`);
    else if (e.params != null && (typeof e.params !== 'object' || Array.isArray(e.params))) errors.push(`element ${i}: params must be an object`);
    else ok.push(e);
  });
  return { ok: errors.length === 0, errors, elements: ok };
}
