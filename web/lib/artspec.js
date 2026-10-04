// Turns a recipe (or the page layout) into a JSON art spec that may only use parts from the
// catalog, like json-render's guardrailed component specs. The renderer draws the spec element
// by element; nothing outside the catalog can appear, so the same spec could come from anywhere.
//   { v: 1, box: [w, h], seed, elements: [{ part, params?, x, y, s?, rot?, anchor?: [ax, ay], from? }] }
// (x, y) is where the part's anchor lands; the part is scaled by s and turned by rot about it.
// A garnish element says which garnish phrase on the card it draws (`from`).
import { CATALOG, PALETTE, rimOf, levelOf, GLASS_PROFILES, halfAt, capMound, capYAt, pigment } from './artcatalog.js';
import { rng, seedOf } from './ink.js';
import { vesselForDrink } from './vessels.js';
import { drinkLook, opticsOf } from './optics.js';

// The recipe's own vessel (every generated drink has one); older recipes fall back to their glass text.
export function pickVessel(recipe) {
  const id = recipe.vessel && recipe.vessel.id;
  if (id && GLASS_PROFILES[id]) return id;
  const v = vesselForDrink({ name: recipe.name, glass: recipe.method.glass, method: recipe.method.method, ice: recipe.method.ice, ingredients: [] });
  return GLASS_PROFILES[v] ? v : 'collins';
}

// ---------------------------------------------------------------- the card's garnish → parts
// The drawing shows exactly the garnish the card names (docs/research/presentation.md §7.4,
// "drawing ⇔ card"), read with the research appendix's phrase table: the first rule that
// matches a phrase decides what it draws. Some phrases are service, not garnish (straws, the
// ice cone, an ice shell) and some draw nothing ("none"). Nothing is added by family habit.
export const GARNISH_RULES = [
  { id: 'none', re: /^none\b|no garnish|full tiki garnish/, parts: [] },
  { id: 'morse', re: /three cherr(y|ies).*(pineapple|frond)|morse|three dots/, parts: ['garnish.morse-pick'], role: 'pick' },
  { id: 'ice-cone', re: /ice cone|cone of (shaved )?ice/, parts: [], role: 'service' },
  { id: 'ice-shell', re: /ice shell|lined with (crushed|shaved) ice/, parts: [], role: 'service' },
  { id: 'scratcher', re: /back ?-?scratcher/, parts: ['garnish.back-scratcher'], role: 'tall' },
  { id: 'spiral', re: /spiral|horse'?s neck|peel snake|sidewinder/, parts: ['garnish.peel-spiral', 'garnish.peel'], role: 'inside' },
  { id: 'saturn', re: /ring around a cherry|saturn/, parts: ['garnish.peel-ring'], role: 'pick' },
  { id: 'crown', re: /(angostura|bitters)( bitters)? (crown|top)|crown of bitters/, parts: ['garnish.bitters-crown'], role: 'crown' },
  { id: 'flaming-shell', re: /flaming (lime )?shell|crouton|lime shell.*(flame|fire|lit)/, parts: ['garnish.lime-shell', 'garnish.flame', 'sparkle'], role: 'float' },
  { id: 'flaming-crater', re: /flaming crater|flame in the crater/, parts: ['garnish.lime-shell', 'garnish.flame', 'sparkle'], role: 'float' },
  { id: 'shell', re: /lime (half[- ]?)?shell|lime hull|spent lime/, parts: ['garnish.lime-shell', 'garnish.flame', 'sparkle'], role: 'float' },
  { id: 'flag', re: /\bflag\b|orange (slice|wheel|half[- ]?wheel).*cherr|cherr.*orange (slice|wheel)/, parts: ['garnish.orange-flag', 'garnish.umbrella'], role: 'rim' },
  { id: 'mint', re: /mint (bouquet|bunch|sprigs)|bouquet of mint|big mint/, parts: ['garnish.mint', 'garnish.mint-leaves'], role: 'aroma', big: true },
  { id: 'mint', re: /\bmint\b/, parts: ['garnish.mint', 'garnish.mint-leaves'], role: 'aroma' },
  { id: 'pineapple-pick', re: /pineapple (chunk|cube|stick)/, parts: ['garnish.pick'], role: 'pick' },
  { id: 'spear', re: /pineapple spear/, parts: ['garnish.pineapple-spear'], role: 'tall' },
  { id: 'crown-lid', re: /crown lid|hollowed pineapple/, parts: ['garnish.pineapple-crown-lid'], role: 'float' },
  { id: 'pineapple-wedge', re: /pineapple (wedge|slice|crescent)/, parts: ['garnish.pineapple-wedge', 'garnish.pineapple-fronds'], role: 'rim' },
  { id: 'fronds', re: /pineapple (frond|fronds|leaf|leaves)/, parts: ['garnish.pineapple-fronds'], role: 'aroma' },
  { id: 'cherry-pick', re: /cherr(y|ies) on a (pick|stick|skewer)|skewered .*cherr/, parts: ['garnish.pick'], role: 'pick' },
  { id: 'cherry', re: /cherr(y|ies)/, parts: ['garnish.cherry'], role: 'float' },
  { id: 'orange-wheel', re: /orange (wheel|slice|half[- ]?wheel|half)|^orange$/, parts: ['garnish.orange-wheel'], role: 'rim' },
  { id: 'lime-wedges-in', re: /lime wedges? (stay|in the glass|muddled)/, parts: ['garnish.lime-wedge'], role: 'inside' },
  { id: 'lime-wedge', re: /lime (wedge|crescent)/, parts: ['garnish.lime-wedge'], role: 'rim' },
  { id: 'lime-coin', re: /lime coin/, parts: ['garnish.lime-coin'], role: 'inside' },
  { id: 'lime-wheel', re: /lime (wheel|slice|disc)|dehydrated lime/, parts: ['garnish.lime-wheel'], role: 'rim' },
  { id: 'lemon-cloves', re: /lemon wheel studded with cloves|clove[- ]studded lemon/, parts: ['garnish.lemon-wheel'], role: 'float' },
  { id: 'lemon-wheel', re: /lemon (wheel|slice)s?/, parts: ['garnish.lemon-wheel'], role: 'rim' },
  { id: 'peel', re: /(orange|lemon|lime|grapefruit|citrus)( zest)? (twist|peel|zest)|twist|expressed|\bpeel\b/, parts: ['garnish.peel'], role: 'rim' },
  { id: 'nutmeg', re: /nutmeg/, parts: ['garnish.nutmeg'], role: 'dust' },
  { id: 'cinnamon-stick', re: /cinnamon (stick|quill)/, parts: ['garnish.cinnamon'], role: 'tall' },
  { id: 'dust', re: /cinnamon|cocoa|chocolate (powder|shavings|dust)|grated chocolate|coconut flakes|toasted coconut/, parts: ['garnish.dust'], role: 'dust' },
  { id: 'gardenia', re: /gardenia/, parts: ['garnish.gardenia'], role: 'float' },
  { id: 'orchid', re: /orchid|dendrobium/, parts: ['garnish.orchid'], role: 'flower' },
  { id: 'flower', re: /edible flower|borage|viola|physalis|\bflower\b/, parts: ['garnish.edible-flower'], role: 'flower' },
  { id: 'umbrella', re: /umbrella|parasol/, parts: ['garnish.umbrella'], role: 'tall' },
  { id: 'beans', re: /coffee beans?/, parts: ['garnish.beans'], role: 'float' },
  { id: 'swizzle', re: /bois l[eé]l[eé]|swizzle stick/, parts: ['garnish.swizzle-stick'], role: 'tall' },
  { id: 'stirrer', re: /stir stick|stirrer/, parts: ['garnish.swizzle-stick'], role: 'tall' },
  { id: 'cane', re: /sugar[- ]?cane/, parts: ['garnish.sugarcane'], role: 'tall' },
  { id: 'ginger-pick', re: /candied ginger/, parts: ['garnish.pick'], role: 'pick' },
  { id: 'fruit', re: /the named fruit/, parts: ['garnish.fruit-slice'], role: 'rim', named: true },
  { id: 'fruit', re: /banana|strawberr|passion[- ]fruit|mango|apple|apricot|grapefruit wedge|cucumber|ginger coin/, parts: ['garnish.fruit-slice'], role: 'rim' },
  { id: 'herb', re: /basil|rosemary|geranium/, parts: ['garnish.herb-sprig'], role: 'aroma' },
  { id: 'whipped', re: /whipped cream/, parts: ['garnish.whipped-cream'], role: 'float' },
  { id: 'straws', re: /straws?\b/, parts: [], role: 'service' },
  { id: 'block', re: /block of ice/, parts: [], role: 'service' },
];
export function garnishRule(phrase) {
  const g = String(phrase || '').toLowerCase().trim();
  return GARNISH_RULES.find(r => r.re.test(g)) || null;
}
// Every part a garnish phrase may draw (the drawing may show fewer: an interior part needs a
// clear glass, an umbrella an archetype and vessel that allow one).
export const partsForPhrase = phrase => { const r = garnishRule(phrase); return r ? r.parts.slice() : []; };

// Limits from the research appendix (`limits`).
export const UMBRELLA_ALLOWED = ['pina-colada', 'fruit-colada', 'miami-vice', 'blue-hawaii', 'hurricane', 'resort-liqueur-punch', 'hawaiian-mai-tai', 'sunrise-float', 'port-au-prince', 'planters-punch', 'zero-proof-tiki'];
export const UP_VESSELS = ['coupe', 'nick-nora', 'cocktail-glass', 'flute'];
const UMBRELLA_NEVER_VESSELS = [...UP_VESSELS, 'rocks', 'irish-coffee', 'hot-mug'];
const NO_STRAW_VESSELS = [...UP_VESSELS, 'irish-coffee', 'hot-mug', 'punch-bowl'];
const NO_STRAW_ARCHETYPES = ['ti-punch', 'rum-old-fashioned', 'kingston-negroni', 'tropical-stirred', 'daiquiri', 'hemingway-daiquiri', 'nuclear-daiquiri', 'bitters-base-sour', 'hot-buttered-rum', 'tom-and-jerry', 'hot-grog', 'hot-rum-punch', 'bowl-punch'];
const BOWLS = ['scorpion-bowl', 'tiki-bowl', 'volcano-bowl', 'punch-bowl'];
const NARROW = ['collins', 'chimney', 'highball', 'footed-pilsner', 'tulip', 'flute'];
// A drink fizzes only if something carbonated is poured into it.
export const FIZZ = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'sparkling-wine']);
const HEAP = ['crushed', 'pebble', 'shaved'];
const MAX_GARNISH = 3, MAX_DUST = 1;
const FRUIT_LINES = [['banana', /banana/], ['strawberry', /strawberr/], ['passion-fruit', /passion/], ['mango', /mango/], ['apple', /apple/], ['grapefruit', /grapefruit/]];

// The card's garnish, read into drawable items: each phrase once, two phrases for one thing
// merged ("citrus peel" and "clove-studded orange peel"), then the budget — one hero, one or two
// supporting garnishes and one dust (§2.2.9). Flowers go first when there are too many.
export function garnishPlan(recipe) {
  const items = [], service = [];
  for (const phrase of recipe.garnish || []) {
    const rule = garnishRule(phrase);
    if (!rule) continue;
    if (!rule.parts.length) { if (rule.role === 'service') service.push({ rule, phrase }); continue; }
    const same = items.find(x => x.rule.id === rule.id);
    if (same) { same.also.push(phrase); if (rule.big) same.big = true; continue; }
    items.push({ rule, phrase, also: [], big: !!rule.big });
  }
  const dusts = items.filter(x => x.rule.role === 'dust').slice(0, MAX_DUST);
  const rest = items.filter(x => x.rule.role !== 'dust');
  while (rest.length > MAX_GARNISH) {
    let i = -1;
    for (let k = rest.length - 1; k >= 0; k--) if (rest[k].rule.role === 'flower') { i = k; break; }
    rest.splice(i >= 0 ? i : rest.length - 1, 1);
  }
  return { items: [...rest, ...dusts], service };
}

const lc = s => String(s || '').toLowerCase();
const has = (plan, id) => plan.items.find(x => x.rule.id === id);
const okHex = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const lum = h => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255; };

// The drink's look from the optics model. The engine computes it; a swizzle's bitters are dashed
// over the ice as a crown, so when the card crowns a drink whose look mixed them into the body,
// the look is recomputed with those dashes held back (same model, same lines).
function lookFor(recipe, ingMap, crowned) {
  const method = recipe.method.method, ice = recipe.method.ice;
  const dilutionOz = recipe.stats ? Math.max(0, (recipe.stats.finalOz || 0) - (recipe.stats.volOz || 0)) : 0;
  let look = recipe.look && recipe.look.body ? recipe.look : null;
  const lines = (recipe.lines || []).filter(l => Number.isFinite(l.oz));
  const bitters = ingMap ? lines.filter(l => !l.float && !l.sink && (ingMap.get(l.id) || {}).cat === 'bitters') : [];
  if (ingMap && (!look || !okHex(look.body.hex) || (crowned && bitters.length && !look.layers.some(x => x.kind === 'crown')))) {
    look = drinkLook(lines.map(l => (crowned && bitters.includes(l) ? { ...l, crown: true } : l)), ingMap, { method, ice, dilutionOz });
  }
  if (!look) look = { body: { hex: PALETTE.butter, opacity: 0.3, clarity: 0.6 }, layers: [] };
  // On the ice the crown shows the bitters' own color (their optics hex), soaked into white ice,
  // not the near-black of the undiluted dash.
  let crown = look.layers.find(x => x.kind === 'crown');
  if (crowned) {
    const ing = ingMap && (ingMap.get((bitters[0] || {}).id) || ingMap.get('angostura'));
    crown = { kind: 'crown', hex: ing ? opticsOf(ing).hex : (crown ? crown.hex : '#8c2814'), opacity: 0, frac: 0.06 };
  }
  return { look, crown };
}

export function drinkSpec(recipe, ingMap) {
  const seed = seedOf(`${recipe.name}|${recipe.seed ?? 0}`);
  const r = rng(seed);
  const kind = pickVessel(recipe);
  const R = rimOf(kind), G = GLASS_PROFILES[kind], hw = R.hw, H = 440 - R.y;
  const method = recipe.method.method;
  const steps = lc((recipe.method.steps || []).join(' '));
  const archetype = (recipe.archetype && recipe.archetype.id) || '';
  const hot = method === 'hot';
  const frozen = !hot && (method === 'blend' || recipe.method.ice === 'blended');
  const plan = garnishPlan(recipe);
  const UP = UP_VESSELS.includes(kind), BOWL = BOWLS.includes(kind), clear = !G.opaque;
  // Ice as served: flash-blended drinks are crushed ice, not a frozen dome; hot drinks have none.
  let iceStyle = hot ? 'none' : frozen ? 'blended' : recipe.method.ice === 'blended' ? 'crushed' : recipe.method.ice || 'none';
  if (UP && HEAP.includes(iceStyle)) iceStyle = 'none';
  // A shaved-ice shell the card names lines the glass (Beachcomber's Gold), whatever else the
  // method says about the ice.
  if (plan.service.some(x => x.rule.id === 'ice-shell') && !G.opaque && kind !== 'flute' && !hot && !frozen) iceStyle = 'ice-shell';
  const heaped = HEAP.includes(iceStyle) && !UP;
  const cone = iceStyle === 'ice-cone';
  const iceSeed = seed % 997;
  const fill = UP ? 0.86 : BOWL ? 0.72 : kind === 'irish-coffee' ? 0.8 : heaped ? 0.92 : 0.84;
  const level = levelOf(kind, fill);
  const crowned = !!has(plan, 'crown') || /to form a crown/.test(steps);
  const { look, crown } = lookFor(recipe, ingMap, crowned);
  const float = look.layers.find(x => x.kind === 'float' && okHex(x.hex));
  const flaming = !!(recipe.style && recipe.style.flaming) || /light it/.test(steps);
  // Glazes are neutral and fixed (wood tones): a teal mug reads as a teal drink. Hot mugs and
  // bowls are pale.
  const glaze = hot || BOWL ? PALETTE.woodPale : [PALETTE.wood, PALETTE.woodPale][Math.floor(r() * 2)];
  const swizzled = method === 'swizzle';
  const frosted = !hot && (swizzled || kind === 'julep-cup' || iceStyle === 'shaved');
  const frostAmount = swizzled || kind === 'julep-cup' ? 1 : 0.45;

  // Where things rest: the ice heap, the frozen dome, the mug's rim or the drink's surface.
  const M = heaped ? capMound(kind, iceSeed, iceStyle) : null;
  const capAt = x => {
    if (M) return capYAt(M.top, x);
    if (frozen) { const u = Math.max(0, Math.min(1, (x - (R.cx - hw * 0.96)) / (hw * 1.92))); return R.y - Math.sin(Math.PI * u) * 32; }
    if (cone) return R.y + 2;
    return G.opaque ? R.y + 1 : level;
  };
  const surfaceY = G.opaque ? R.y + 1 : frozen ? R.y - 20 : level;

  const els = [];
  const garnishEls = [];
  // Scale a tall part standing at y so it stays inside the drawing box (never below 0.7).
  const fitUp = (y, height, s = 1) => Math.max(0.7, Math.min(s, (y - 6) / height));
  const put = (part, params, x, y, { s = 1, rot = 0, anchor = [0, 0], from, z = 50 } = {}) => garnishEls.push({ part, params, x, y, s, rot, anchor, from, z });
  const full = (part, params, from, z) => garnishEls.push({ part, params, x: 0, y: 0, from, z });

  // ---- the card's garnish, item by item
  const get = id => has(plan, id);
  const shell = get('shell') || get('flaming-shell') || get('flaming-crater');
  const cupUp = shell && (shell.rule.id !== 'shell' || flaming);
  const mintItem = get('mint'), fronds = get('fronds'), herb = get('herb');
  const wedge = get('pineapple-wedge');
  const wantsFronds = !!fronds || (wedge && /frond/.test(lc(wedge.phrase)));
  const flag = get('flag');
  const allowUmbrella = UMBRELLA_ALLOWED.includes(archetype) && !UMBRELLA_NEVER_VESSELS.includes(kind) && !hot && method !== 'stir';

  // The straw: one, back-right, for drinks that take one; bowls get a fan of long ones; the
  // Navy Grog's single straw runs dead center out of the cone. None served up, hot or stirred.
  const strawPhrase = plan.service.find(x => x.rule.id === 'straws' || x.rule.id === 'ice-cone');
  // A straw the card names is drawn (a bowl's long straws, a Caipirinha's short one) unless the
  // drink is served up, hot or stirred; otherwise a straw goes where the service takes one.
  const named = plan.service.some(x => x.rule.id === 'straws' || x.rule.id === 'ice-cone');
  const takesStraw = !UP && !hot && !NO_STRAW_ARCHETYPES.includes(archetype) && method !== 'stir'
    && (named || (!NO_STRAW_VESSELS.includes(kind) && (BOWL || cone || !['none', 'ice-shell'].includes(iceStyle)) && !['rocks', 'clay-cup'].includes(kind)));
  const shortStraw = !!strawPhrase && /short/.test(lc(strawPhrase.phrase));
  const flip = !!flag; // a flag takes the front right, so the straw moves to the left
  const sgn = flip ? -1 : 1;

  // Composition on the cap: the Mai Tai's island (shell dome-up) with the mint planted at its
  // edge like a palm, the straw right beside the mint.
  const island = shell && !cupUp && (mintItem || herb);
  const islandX = R.cx - sgn * hw * 0.24;
  let strawCapX = R.cx + sgn * hw * 0.42;
  if (island) strawCapX = islandX + sgn * (32 + hw * 0.16);

  // Heights: the vessel stays the subject (a garnish crown under ~0.6 of its height, except a
  // mint bouquet on a short glass); the straw stands above the mint.
  const mintH = BOWL ? 118 : Math.max(98, Math.min(125, H * 0.55)) * (island ? 1.05 : 1);
  const frondH = Math.max(115, Math.min(175, H * 0.72));
  const tallest = Math.max(mintItem || herb ? mintH : 0, wantsFronds ? frondH : 0);

  const straws = [];
  if (takesStraw) {
    if (cone) {
      const coneTop = R.y - 38;
      straws.push({ x: R.cx, foot: coneTop + 16, len: 150, rot: 0 });
    } else if (BOWL) {
      const n = Math.min(4, Math.max(2, recipe.servings || 2));
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        straws.push({ x: R.cx + k * hw * 0.22, foot: R.y + 6, len: Math.min(270, R.y - 20), rot: k * 0.32 });
      }
    } else {
      const rot = sgn * 0.14, foot = G.opaque ? R.y + 4 : R.bottom - 14;
      const cap = capAt(strawCapX);
      const rise = shortStraw ? 64 : Math.max(clear && H > 200 ? 140 : 112, tallest + 26);
      const len = Math.min(foot - cap + rise, (foot - 6) / Math.cos(rot));
      straws.push({ x: strawCapX - Math.tan(rot) * (foot - cap), foot, len, rot });
    }
  }
  const zStraw = 20;
  for (const s of straws) put('straw', { len: s.len }, s.x, s.foot, { rot: s.rot, anchor: [6, s.len], z: zStraw, from: strawPhrase ? strawPhrase.phrase : undefined });

  // Slots on the cap and rim, so two garnishes never sit in one place.
  const taken = [];
  const free = (x, w) => !taken.some(([a, b]) => x + w / 2 > a && x - w / 2 < b);
  const claim = (x, w) => { taken.push([x - w / 2, x + w / 2]); return x; };
  const overlap = (x, w) => taken.reduce((t, [a, b]) => t + Math.max(0, Math.min(b, x + w / 2) - Math.max(a, x - w / 2)), 0);
  const slot = (prefs, w) => {
    for (const p of prefs) { const x = R.cx + p * hw; if (free(x, w)) return claim(x, w); }
    const best = prefs.map(p => R.cx + p * hw).sort((a, b) => overlap(a, w) - overlap(b, w))[0];
    return claim(best, w);
  };
  if (straws.length && !BOWL) claim(strawCapX, 12);

  // Rim fruit: front-left, opposite the straw; a second goes front-right.
  let rimSide = -sgn;
  const rimX = () => { const x = R.cx + rimSide * hw * 0.96; rimSide = -rimSide; return x; };
  // Fruit that sits on the rim, and a loose cherry (tucked against it), go first so the cap's
  // floaters and flowers find the room that is left.
  const RIM = ['pineapple-wedge', 'lime-wedge', 'lime-wheel', 'lemon-wheel', 'orange-wheel', 'peel', 'fruit', 'flag', 'cherry'];
  const rimFruit = plan.items.filter(it => RIM.includes(it.rule.id) || (it.rule.id === 'spiral' && !(clear && !UP)));

  // Rim fruit, front-left first; a loose cherry is tucked against the first wheel or wedge.
  let lastRim = null;
  for (const it of rimFruit) {
    const id = it.rule.id, from = it.phrase, g = lc([it.phrase, ...it.also].join(' '));
    if (id === 'cherry') continue;
    if (id === 'flag') {
      const x = R.cx + hw * 0.92;
      claim(R.cx + hw * 0.78, hw * 0.44);
      put('garnish.orange-flag', {}, x, R.y + 4, { rot: 0.18, from, z: 72 });
      lastRim = { x, y: R.y - 40, r: 30 };
      if (allowUmbrella) put('garnish.umbrella', {}, x - 18, R.y - 10, { rot: 0.32, s: fitUp(R.y - 10, 152, 0.9), from, z: 33 });
      continue;
    }
    const x = rimX(), side = x < R.cx ? -1 : 1;
    claim(R.cx + side * hw * 0.78, hw * 0.44);
    if (id === 'orange-wheel' || id === 'lime-wheel' || id === 'lemon-wheel') {
      const half = NARROW.includes(kind) || (G.opaque && id === 'orange-wheel');
      const rr = id === 'orange-wheel' ? 55 : id === 'lemon-wheel' ? 42 : 38;
      put(`garnish.${id}`, { half }, x, R.y + (half ? 4 : 2), { rot: side * (half ? 0.38 : 0.3), from, z: 72 });
      lastRim = { x: x - side * rr * 0.1, y: R.y - (half ? rr * 0.55 : rr * 0.6), r: rr };
    } else if (id === 'lime-wedge') {
      put('garnish.lime-wedge', {}, x - side * 6, R.y + 3, { rot: side * 0.5, from, z: 72 });
      lastRim = { x, y: R.y - 12, r: 26 };
    } else if (id === 'pineapple-wedge') {
      put('garnish.pineapple-wedge', {}, x - side * 10, R.y + 4, { rot: side * 0.45, from, z: 71 });
      lastRim = { x: x - side * 10, y: R.y - 14, r: 40 };
    } else if (id === 'peel' || id === 'spiral') {
      const citrus = (g.match(/orange|lemon|lime|grapefruit/) || [/clove/.test(g) ? 'orange' : 'lemon'])[0];
      const px = R.cx + hw - 32, py = hot || UP || G.opaque ? R.y + 2 : R.y + 6;
      put('garnish.peel', { citrus: /citrus/.test(g) && !/orange|lemon|lime|grapefruit/.test(g) ? 'orange' : citrus, cloves: /clove/.test(g) }, px, py, { rot: -0.1, from, z: 72 });
    } else if (id === 'fruit') {
      // the fruit the card names, or for "the named fruit" the one in the drink's lines
      let fruit = (FRUIT_LINES.find(([, re]) => re.test(g)) || [])[0];
      if (/cucumber/.test(g)) fruit = 'cucumber';
      if (/ginger/.test(g)) fruit = 'ginger';
      if (!fruit && /named fruit/.test(g)) fruit = (FRUIT_LINES.find(([, re]) => (recipe.lines || []).some(l => re.test(l.id))) || [])[0];
      if (!fruit) continue;
      put('garnish.fruit-slice', { fruit }, x, R.y + 2, { rot: side * 0.3, from, z: 72 });
      lastRim = { x, y: R.y - 20, r: 24 };
    }
  }
  const cherryIt = rimFruit.find(x => x.rule.id === 'cherry');
  if (cherryIt) {
    const n = /cherries/.test(lc(cherryIt.phrase)) && BOWL ? 2 : 1;
    for (let k = 0; k < n; k++) {
      if (lastRim && k === 0) {
        const side = lastRim.x < R.cx ? 1 : -1;
        claim(lastRim.x + side * lastRim.r * 0.55, 34);
        put('garnish.cherry', {}, lastRim.x + side * lastRim.r * 0.55, Math.min(capAt(lastRim.x + side * lastRim.r * 0.5) + 6, lastRim.y + lastRim.r * 0.9), { rot: -side * 0.2, from: cherryIt.phrase, z: 80 });
      } else {
        const x = slot([0.05, -0.25, 0.3], 34);
        put('garnish.cherry', {}, x, capAt(x) + 5, { rot: 0.2, from: cherryIt.phrase, z: 80 });
      }
    }
  }

  for (const it of plan.items) {
    const id = it.rule.id, from = it.phrase, g = lc([it.phrase, ...it.also].join(' '));
    if (id === 'mint' || id === 'herb') {
      const x = cone ? R.cx - 14 : island ? islandX + sgn * 30 : BOWL ? R.cx + hw * 0.08 : straws.length ? strawCapX - sgn * hw * 0.16 : R.cx + 0.1 * hw;
      const y = cone ? R.y - 30 : capAt(x) + 7;
      claim(x, 30);
      const h = Math.min(cone ? mintH * 0.85 : mintH, y - 14);
      if (id === 'mint') put('garnish.mint', { big: it.big || BOWL, h }, x, y, { rot: cone ? -0.22 : -sgn * (island ? 0.16 : 0.1), from, z: 40 });
      else put('garnish.herb-sprig', { herb: (g.match(/basil|rosemary|geranium/) || ['basil'])[0], h }, x, y, { rot: -sgn * 0.1, from, z: 40 });
      // Mint pressed into the bottom of a swizzle, or muddled through a Mojito, shows through clear glass.
      const muddled = method === 'muddle-build';
      if (id === 'mint' && clear && !UP && (muddled || /(press|muddle)[^.]*mint/.test(steps))) full('garnish.mint-leaves', { kind, fill, seed: iceSeed + 4, n: muddled ? 9 : 7, zone: muddled ? 0.7 : 0.22 }, from, 6);
    } else if (id === 'fronds' || (id === 'pineapple-wedge' && wantsFronds && !get('fronds'))) {
      // fronds rise just behind the straw, taller than any mint
      const x = straws.length && !BOWL ? strawCapX - sgn * hw * 0.04 : R.cx + 0.05 * hw;
      put('garnish.pineapple-fronds', { h: Math.min(frondH, capAt(x) - 2) }, x, capAt(x) + 10, { rot: sgn * 0.08, from, z: 38 });
    } else if (RIM.includes(id)) {
      continue; // placed above
    } else if (id === 'shell' || id === 'flaming-shell' || id === 'flaming-crater') {
      if (cupUp) {
        // the flaming crouton: a shell cut side up on the cap (or in the volcano's crater)
        const inCrater = kind === 'volcano-bowl';
        const x = inCrater ? R.cx : slot([-0.3, -0.08, 0.2], 70), y = inCrater ? 286 : capAt(x) + 2;
        put('garnish.lime-shell', { orientation: 'cup-up', seed: iceSeed }, x, y, { s: inCrater ? 0.6 : 1, from, z: 60 });
        put('garnish.flame', { h: inCrater ? 46 : 54 }, x, y - (inCrater ? 6 : 9), { from, z: 90 });
        put('sparkle', {}, x, y - (inCrater ? 54 : 62), { anchor: [30, 40], s: 0.9, from, z: 91 });
      } else if (cone) {
        // floating on the drink at the cone's foot, in front of it, seen through the glass
        put('garnish.lime-shell', { orientation: 'dome-up', seed: iceSeed }, R.cx - hw * 0.18, (clear ? level : R.y) + 12, { s: 0.75, rot: 0.06, from, z: clear ? 10 : 60 });
      } else {
        const x = island ? claim(islandX, 80) : slot([-0.28, -0.05, 0.25], 80);
        put('garnish.lime-shell', { orientation: 'dome-up', seed: iceSeed }, x, capAt(x) + 8, { rot: (r() - 0.5) * 0.12, from, z: 60 });
      }
    } else if (id === 'orchid' || id === 'flower') {
      const n = BOWL && /orchids|flowers/.test(g) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = slot(BOWL ? [-0.62, 0.62, -0.1] : [-0.42, 0.05, -0.15, 0.3, -0.9], 46);
        put(id === 'orchid' ? 'garnish.orchid' : 'garnish.edible-flower', { size: BOWL || hw < 72 ? 0.85 : 1 }, x, Math.min(capAt(x), R.y) - (BOWL ? 6 : 10), { rot: (r() - 0.5) * 0.5, from, z: 62 });
      }
    } else if (id === 'gardenia') {
      const x = slot([-0.22, 0.1, -0.5], 100);
      put('garnish.gardenia', { r: BOWL ? 58 : 46 }, x, (UP ? surfaceY : capAt(x)) + (BOWL ? 6 : -2), { from, z: 69 });
    } else if (id === 'beans') {
      const x = slot([0, -0.2, 0.2], 50);
      put('garnish.beans', {}, x, capAt(x) - 4, { from, z: 63 });
    } else if (id === 'whipped') {
      const x = slot([-0.05, 0.2], 60);
      put('garnish.whipped-cream', {}, x, capAt(x) + 4, { from, z: 58 });
    } else if (id === 'crown-lid') {
      put('garnish.pineapple-crown-lid', {}, R.cx - hw * 0.12, capAt(R.cx) - 6, { rot: -0.3, from, z: 64 });
      claim(R.cx - hw * 0.12, 60);
    } else if (['morse', 'pineapple-pick', 'cherry-pick', 'ginger-pick', 'saturn'].includes(id)) {
      const items = id === 'morse' ? null : id === 'pineapple-pick' ? (/cherr/.test(g) ? ['chunk', 'cherry'] : ['chunk']) : id === 'ginger-pick' ? ['ginger'] : id === 'saturn' ? null : ['cherry'];
      const part = id === 'morse' ? 'garnish.morse-pick' : id === 'saturn' ? 'garnish.peel-ring' : 'garnish.pick';
      if (items && !UP && (id === 'cherry-pick' || heaped || frozen)) {
        // fruit on a pick stands in the ice, leaning out at about 30°
        const x = slot([-0.32, 0, 0.3, -0.55], 30), lean = x > strawCapX ? 1 : -1;
        put(part, { items, lead: 46 }, x, capAt(x) + 12, { rot: -Math.PI / 2 + lean * 0.42, from, z: 66 });
      } else {
        // laid across the rim at about -15°, the pick showing past the fruit at both ends
        put(part, items ? { items } : {}, R.cx + hw * 0.06, R.y - (UP ? 4 : 2), { rot: -0.26 * sgn, from, z: 70 });
      }
    } else if (['scratcher', 'spear', 'umbrella', 'cinnamon-stick', 'swizzle', 'stirrer', 'cane'].includes(id)) {
      // Tall things stand in the ice. In a clear glass the part below the cap shows through;
      // in a mug it is hidden, so the drawing starts just inside the rim.
      if (id === 'umbrella' && !allowUmbrella) continue;
      const x = slot(id === 'umbrella' ? [-0.18, -0.4, 0.05] : id === 'scratcher' ? [-0.22, -0.02] : [-0.3, -0.08, 0.15], 16);
      const lean = id === 'umbrella' ? -0.24 * sgn : id === 'scratcher' ? -0.06 * sgn : (x < R.cx ? -0.12 : 0.12);
      const inMug = y => (G.opaque ? Math.min(y, R.y + 5) : y);
      if (id === 'scratcher') {
        // the one garnish allowed to run long: about the vessel's height above the rim, its hand in the box
        const foot = clear ? R.bottom - 12 : R.y + 5, topY = Math.max(52, R.y - 1.1 * H);
        put('garnish.back-scratcher', { len: foot - topY }, x, foot, { rot: lean, from, z: 30 });
      } else if (id === 'swizzle' || id === 'stirrer') {
        const foot = clear && !hot ? R.bottom - 8 : inMug(capAt(x) + 14), topY = Math.max(id === 'stirrer' ? 30 : 8, capAt(x) - (id === 'stirrer' ? 70 : 95));
        put('garnish.swizzle-stick', { len: foot - topY, plain: id === 'stirrer' }, x, foot, { rot: lean * 0.6, from, z: 31 });
      } else if (id === 'spear') {
        const foot = inMug(capAt(x) + 44);
        put('garnish.pineapple-spear', { len: Math.min(150 - (capAt(x) + 44 - foot), foot - 10) }, x, foot, { rot: lean, from, z: 32 });
      } else if (id === 'umbrella') {
        const foot = inMug(capAt(x) + 22);
        put('garnish.umbrella', {}, x, foot, { rot: lean, s: fitUp(foot, 152), from, z: 33 });
      } else if (id === 'cane') {
        const foot = clear && !hot ? Math.min(R.bottom - 12, capAt(x) + 60) : inMug(capAt(x) + 16);
        put('garnish.sugarcane', { len: Math.min(200, foot - 10) }, x, foot, { rot: lean, from, z: 31 });
      } else {
        const foot = hot && clear ? level + 24 : inMug(capAt(x) + 34);
        put('garnish.cinnamon', { len: Math.min(132 - (capAt(x) + 34 - foot), foot - 10) }, x, foot, { rot: lean + 0.1, from, z: 34 });
      }
    } else if (id === 'spiral') {
      if (clear && !UP) full('garnish.peel-spiral', { kind, citrus: (g.match(/orange|lemon|lime|grapefruit/) || ['orange'])[0] }, from, 7);
    } else if (id === 'lime-coin') {
      if (clear) put('garnish.lime-coin', {}, R.cx - hw * 0.1, R.bottom - 10, { rot: 0.1, from, z: 8 });
    } else if (id === 'lime-wedges-in') {
      if (clear) [-0.35, 0.3, 0].forEach((k, i) => put('garnish.lime-wedge', { slot: false }, R.cx + k * hw, R.bottom - 14 - i * 18, { rot: (r() - 0.5) * 1.6, s: 0.8, from, z: 8 }));
    } else if (id === 'lemon-cloves') {
      // a clove-studded lemon wheel floating on the hot drink
      put('garnish.lemon-wheel', { cloves: true, flat: G.rimTilt + 0.08, slot: false }, R.cx - hw * 0.2, surfaceY - 2, { from, z: 60 });
    } else if (id === 'crown') {
      if (crown) full('garnish.bitters-crown', { kind, hex: crown.hex, fill, seed: iceSeed, style: iceStyle }, from, 12);
    } else if (id === 'nutmeg' || id === 'dust') {
      const spice = id === 'nutmeg' ? 'nutmeg' : /cocoa|chocolate/.test(g) ? 'cocoa' : /coconut/.test(g) ? 'coconut' : 'cinnamon';
      // The Painkiller's signal is a heavy cap; elsewhere a lighter dusting.
      const density = id === 'nutmeg' && (archetype === 'painkiller' || /heavy/.test(g)) ? 0.9 : 0.5;
      let region;
      if (M) region = M.poly;
      else if (frozen) { region = []; for (let i = 0; i <= 10; i++) { const x = R.cx - hw * 0.85 + i * hw * 0.17; region.push([x, capAt(x) + 3]); } region.push([R.cx + hw * 0.85, R.y + 2], [R.cx - hw * 0.85, R.y + 2]); }
      else { const w = (G.opaque ? hw - 8 : halfAt(G, level) - 5); region = ellPts(R.cx, surfaceY, w * 0.92, Math.max(12, w * R.tilt * 0.92)); }
      full(id === 'nutmeg' ? 'garnish.nutmeg' : 'garnish.dust', { region, spice, density, seed: iceSeed + 7 }, from, 95);
    }
  }

  // ---- assemble, back to front: glass, drink, ice, what is inside the glass, then the garnish
  els.push({ part: 'glass', params: { kind, glaze, flaming: flaming && kind === 'volcano-bowl' && !(shell && cupUp), lid: !!get('crown-lid') && kind === 'pineapple', front: clear ? 'without' : 'with' }, x: 0, y: 0 });
  els.push({ part: 'liquid', params: { kind, fill, body: look.body, layers: look.layers, frozen, frost: frosted, shell: iceStyle === 'ice-shell' ? 9 : 0, crushed: heaped, crownOnIce: crowned && heaped, froth: UP && !frozen && (method === 'shake' || method === 'flash-blend'), seed: iceSeed }, x: 0, y: 0 });
  // Bubbles rise only through a drink with something carbonated in it (and behind the ice).
  if (!hot && (recipe.lines || []).some(l => FIZZ.has(l.id))) els.push({ part: 'fizz', params: { kind, fill, seed: seed % 991 }, x: 0, y: 0 });
  if (iceStyle !== 'none' && iceStyle !== 'blended') {
    // A float on crushed ice soaks the cap; a crown is painted by its own part.
    const soak = heaped && float && !crowned ? { hex: float.hex, alpha: 0.022 + 0.02 * lum(float.hex), reach: 0.1 } : null;
    // A cube stands lit in the drink: paper-white, glowing faintly with the drink's lightest tone.
    const tint = pigment(look.body.hex, { opacity: look.body.opacity, clarity: look.body.clarity }).surf;
    els.push({ part: 'ice', params: { kind, style: iceStyle, fill, seed: iceSeed, soak, tint }, x: 0, y: 0 });
  }
  if (crowned && crown && !has(plan, 'crown')) full('garnish.bitters-crown', { kind, hex: crown.hex, fill, seed: iceSeed, style: iceStyle }, '(steps) dash the bitters over the ice to form a crown', 12);
  if (frosted) els.push({ part: 'glass.frost', params: { kind, seed: iceSeed + 2, amount: frostAmount }, x: 0, y: 0 });
  if (UP && !hot && iceStyle !== 'ice-shell') els.push({ part: 'glass.condensation', params: { kind, seed: iceSeed + 3 }, x: 0, y: 0 });
  // The front of the rim passes in front of whatever sits inside the glass.
  if (clear) garnishEls.push({ part: 'glass.front', params: { kind }, x: 0, y: 0, z: 16 });
  garnishEls.sort((a, b) => a.z - b.z).forEach(({ z, ...e }) => els.push(e.from === undefined ? (({ from, ...rest }) => rest)(e) : e));
  if (hot && iceStyle === 'none') els.push({ part: 'steam', params: { kind }, x: 0, y: 0 });
  return { v: 1, box: [300, 460], fit: 'content-y', seed, kind, elements: els };
}

function ellPts(cx, cy, rx, ry, n = 18) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

// The decorative drawings around the prayer. `text` is the prayer column's box in hero pixels;
// nothing is drawn over it. Wide screens get two side columns, phones a band above the title.
// Botanical and nautical subjects only: no carved figures as décor (presentation.md §6.2).
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
    put('float.glass', {}, lx - 6, H * 0.56, 150, lw, 0.08);
    put('flower.plumeria', { seed: 5 }, lx + 34, H * 0.87, 92, lw, 0.4);
    put('leaf.monstera', {}, rx + 4, H * 0.24, 160, rw, 0.5);
    put('fruit.pineapple', {}, rx - 6, H * 0.7, 190, rw, -0.1);
  } else {
    const band = Math.max(90, text.top - 12), third = w / 3;
    put('flower.hibiscus', { seed: 3 }, third * 0.52, band * 0.5, band * 0.78, third - 8, -0.25);
    put('float.glass', {}, w / 2, band * 0.52, band * 0.86, third, 0.05);
    put('leaf.monstera', {}, w - third * 0.52, band * 0.5, band * 0.84, third - 8, 0.5);
  }
  return { v: 1, box: [w, h], seed: 7, elements: els };
}

// Small drawings are built at their display size so the ink keeps a readable weight. The idol
// keeps its eyes open: a deity is not a toy to wink at (presentation.md §6.2), so the "blink"
// frame draws the same open face.
export const idolSpec = (w, h) => {
  const s = Math.min(w / 170, h / 214);
  return { v: 1, box: [w, h], seed: 21, elements: [{ part: 'idol.ku', params: { blink: false }, x: w / 2, y: h, s, anchor: [85, 212] }] };
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
