// Every drink gets one specific vessel from data/vessels.json. Catalogued drinks are mapped from
// their free-text `glass` field (plus a few identity-defining classics by name); generated drinks
// choose one in engine.js from the family's vessel habits, the drink's service and its volume.

// A drink's service, from how it's made: which vessels can hold it.
export function serviceOf(method, ice) {
  if (method === 'hot') return 'hot';
  if (method === 'blend' || ice === 'blended') return 'frozen';
  if (method === 'flash-blend' || method === 'swizzle' || ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice)) return 'crushed';
  if (method === 'build' || method === 'muddle-build' || ice === 'block') return 'rocks';
  // Shaken or stirred and strained with no ice at all: only a stemmed glass, never an empty tumbler.
  if (ice === 'none') return 'up';
  return 'shaken'; // shaken or stirred with cubes, then served up or over fresh ice
}
// Which vessel serve styles accept each drink service.
export const SERVICE_FITS = {
  hot: ['hot'], frozen: ['frozen'], crushed: ['crushed'], rocks: ['rocks'], shaken: ['up', 'rocks'], up: ['up'],
};

// Classics whose vessel is part of their identity: the glass or mug is named for the drink, or
// the drink was created for it (sources in docs/vessels.md). Checked before the glass text, so
// every spec of the drink shares it.
export const BY_NAME = {
  'zombie': 'chimney', // the chimney is nicknamed the Zombie glass (Don the Beachcomber, 1934)
  'tortuga': 'chimney', // Trader Vic: "14 oz chimney glass"
  'mai tai': 'dof', // Trader Vic's guide: "mai tai (double old-fashioned) glass"
  'navy grog': 'dof', // around a shaved-ice cone
  'fog cutter': 'fog-cutter-mug',
  'samoan fog cutter': 'fog-cutter-mug',
  'singapore sling': 'tulip', // Raffles' own sling glass
  'three dots and a dash': 'footed-pilsner', // Don the Beachcomber
  'pearl diver': 'pearl-diver',
  'painkiller': 'enamel-tin',
  "sidewinder's fang": 'snifter',
  'shrunken skull': 'skull-mug',
  "barrel o' rum": 'barrel-mug',
  'rum barrel': 'barrel-mug',
  'pi yi': 'pineapple',
  'coconaut': 'coconut',
  'scorpion bowl': 'scorpion-bowl',
  'tiki bowl': 'tiki-bowl',
  'kava bowl': 'tiki-bowl',
  'mystery drink': 'tiki-bowl',
  'volcano bowl': 'volcano-bowl',
  'hurricane': 'hurricane',
};

// First match wins, most specific vessel first: in "tall glass or tiki mug" the mug is the
// point. Ceramics and novelties, then named specialty glasses, then generic glassware.
export const GLASS_RULES = [
  [/acrylic|unbreakable|plastic/, 'acrylic-tumbler'],
  [/volcano/, 'volcano-bowl'],
  [/tiki bowl|kava bowl|mystery bowl|bowl for two/, 'tiki-bowl'],
  [/scorpion bowl|lovers/, 'scorpion-bowl'],
  [/punch bowl/, 'punch-bowl'],
  [/skull/, 'skull-mug'],
  [/barrel|rum keg/, 'barrel-mug'],
  [/fog cutter/, 'fog-cutter-mug'],
  [/moai|easter island/, 'moai-mug'],
  [/bird|parrot/, 'bird-mug'],
  [/coconut/, 'coconut'],
  [/pineapple/, 'pineapple'],
  [/pusser|enamel|tin mug/, 'enamel-tin'],
  [/copper/, 'copper-mug'],
  [/julep|swizzle cup|metal/, 'julep-cup'],
  [/clay cup|canch/, 'clay-cup'],
  [/tiki mug|bali hai|hawaiian eye|headhunter|ceramic|cartridge|two tiki mugs/, 'ku-mug'],
  [/chimney|zombie/, 'chimney'],
  [/pearl diver/, 'pearl-diver'],
  [/hurricane/, 'hurricane'],
  [/poco|colada glass/, 'poco-grande'],
  [/snifter/, 'snifter'],
  [/sling|tulip/, 'tulip'],
  [/pilsner|footed/, 'footed-pilsner'],
  [/irish coffee/, 'irish-coffee'],
  [/toddy|tom (and|&) jerry|preheated mug|8 oz mug|warm mug/, 'hot-mug'],
  [/saucer|frapp|ice shell|spanish-comb|lined with (crushed|shaved)/, 'coupe'],
  [/flute|champagne glass/, 'flute'],
  [/goblet|wine glass|cider glass|supreme/, 'goblet'],
  [/nick/, 'nick-nora'],
  [/coupe|sour \(delmonico\)|delmonico/, 'coupe'],
  [/cocktail glass|martini|stemmed|copita/, 'cocktail-glass'],
  [/double|dof|mai tai glass/, 'dof'],
  [/old.fashioned|rocks|tumbler|small bar glass|punch glass/, 'OLD_FASHIONED'],
  [/collins|tall|pint|fizz|1[2-6].?oz|chilled tall|cucumber|specialty/, 'collins'],
  [/highball|10.?oz|8.?oz|glass$/, 'highball'],
  [/mug/, 'ku-mug'],
];

// "Old fashioned" means two different glasses in tiki books: the single rocks glass for a short
// stirred or built drink, the double for anything poured over crushed ice or long.
function oldFashioned(drink) {
  const svc = serviceOf(drink.method, drink.ice);
  const oz = (drink.ingredients || []).reduce((s, l) => s + (['oz'].includes(l.unit) ? l.amount || 0 : 0), 0) / (drink.servings || 1);
  return svc === 'crushed' || svc === 'frozen' || oz >= 3.25 ? 'dof' : 'rocks';
}

// A vessel with no drawing of its own yet borrows one (data/vessels.json `drawAs`).
export function drawingOf(vessel, profiles) {
  if (!vessel) return null;
  return profiles && profiles[vessel.id] ? vessel.id : vessel.drawAs || vessel.id;
}

export function vesselForDrink(drink, familyDefault = null) {
  const name = (drink.name || '').toLowerCase().trim();
  if (BY_NAME[name]) return BY_NAME[name];
  if (drink.method === 'hot') {
    const g = (drink.glass || '').toLowerCase();
    return /irish coffee/.test(g) ? 'irish-coffee' : 'hot-mug';
  }
  const g = (drink.glass || '').toLowerCase().replace(/[’']/g, "'");
  for (const [re, id] of GLASS_RULES) if (re.test(g)) return id === 'OLD_FASHIONED' ? oldFashioned(drink) : id;
  return familyDefault || 'collins';
}

// ---------- the capacity budget (round-3 critique §1) ----------
// One model of what a vessel must hold, shared by the engine (needOf, fitVessel, chooseVessel),
// the linter and the tests: the liquid, the ice it is served on, and a little headroom.
// - Where the glass's own ice did the diluting (an open pour "ice and all", a swizzle, a build
//   over cubes), the meltwater came out of that ice: the budget is the poured liquid plus the
//   glass's ice. Where the drink was shaken or stirred on ice that was thrown away and strained
//   onto fresh ice, it is the finished liquid (dilution included) plus the fresh ice.
// - The ice a glass holds, as a share of its capacity: fresh cubes about 45%; packed crushed,
//   pebble or shaved ice about 50%; one large block about 35%; a Navy Grog cone about 30%; a
//   shaved-ice shell lining a stemmed glass about 30%.
// - Half an ounce of headroom everywhere. A drink served up fills a coupe or cocktail glass to
//   80% at most (5½ oz in a 7 oz coupe), a flute or anything topped with bubbles to 85%. A
//   frozen drink fills to about 92% and domes above it (a frappé heaps a little over a saucer's
//   rim; a frozen drink of about eleven ounces goes in a 12 oz poco grande, never lost in a
//   hurricane at under 60%); a hot one keeps a tenth of the mug (¾ oz at least)
//   free so it doesn't slosh and a Tom and Jerry has room for its foam.
// - Bowls: crushed ice is 40–50% voids, so most of the mix sits in the interstices. A crushed-ice
//   bowl holds the mix plus the solid share of the ice it is shaken with and poured over (2 cups
//   per round of two, over a 1-cup bed); a punch bowl holds the batch, about a fifth of it again
//   in cold water, and the block frozen the night before.
// `oz` is the drink's own measure (it scales with the pours, so a trim can aim at `hi`), `need`
// is everything the vessel holds, and `r` is need over capacity.
export const ICE_SHARE = { cubed: 0.45, crushed: 0.5, pebble: 0.5, shaved: 0.5, block: 0.35, 'ice-cone': 0.3, shell: 0.3 };
export const HEADROOM = 0.5;
export const CRUSHED_SOLID = 0.55;
export const BOWL_ROUND_ICE = 16, BOWL_BED = 8;
// (Shaken or flash-blended on crushed, pebble or shaved ice and poured ice and all, as Trader
// Vic built the Mai Tai: "shake with shaved ice", the lot into the double old fashioned.)
const OWN_ICE = (method, ice) => ['swizzle', 'build', 'muddle-build'].includes(method) || (['shake', 'flash-blend'].includes(method) && ['crushed', 'pebble', 'shaved'].includes(ice));
// The ice a flash-blend takes: about 6 oz for one drink, a little less than the liquid for more.
export const flashIceFor = oz => Math.max(6, oz * 0.9);
export function fillBudget({ volOz = 0, finalOz = 0 } = {}, v, { method = 'shake', ice = 'cubed', servings = 1, fizz = false, fizzOz = 0 } = {}) {
  const cap = v.capacity, serve = v.serve || [];
  // A topper poured into the glass after the shake (soda, ginger beer, bubbles) was never on the
  // shaker's ice: only the shaken part carries the dilution.
  if (fizzOz > 0 && volOz > 0 && finalOz > volOz && !['build', 'muddle-build', 'swizzle', 'blend', 'hot'].includes(method)) finalOz -= (finalOz - volOz) * Math.min(1, fizzOz / volOz);
  const service = serviceOf(method, ice);
  const bowl = serve.includes('bowl');
  const n = bowl ? Math.max(1, servings) : 1;
  const stemmed = serve.includes('up') && !serve.includes('rocks');
  let kind, oz, iceOz = 0, head = HEADROOM, hi, lo, need = null, open = false;
  if (bowl && v.id === 'punch-bowl') {
    kind = 'punch';
    oz = (method === 'hot' ? finalOz : volOz * 1.2) * n;
    // The block: a quart frozen the night before for a big batch, a pint for a small one (ice is
    // about 9% bigger than its water).
    iceOz = method === 'hot' ? 0 : (oz > 40 ? 32 : 16) * 1.09;
    hi = cap - iceOz - head; lo = 0.25 * cap;
  } else if (bowl) {
    kind = 'bowl';
    if (method === 'blend') { oz = finalOz * n; hi = cap * 0.9; lo = 0.2 * cap; }
    else {
      oz = volOz * n;
      const per = Math.min(2, n), rounds = Math.ceil(n / per);
      const heap = ['swizzle', 'build', 'muddle-build', 'stir'].includes(method) ? cap * 2 / 3
        : method === 'flash-blend' ? rounds * flashIceFor(volOz * per) + BOWL_BED : rounds * BOWL_ROUND_ICE + BOWL_BED;
      iceOz = CRUSHED_SOLID * heap;
      // (Mix that fits the voids takes no room of its own: the heap is the volume.)
      need = Math.max(oz + iceOz, heap) + head;
      hi = cap - iceOz - head; lo = 0.15 * cap;
    }
  } else if (service === 'hot') {
    kind = 'hot'; oz = finalOz; head = Math.max(0.75, 0.1 * cap); hi = cap - head; lo = 0.6 * cap;
  } else if (service === 'frozen') {
    kind = 'frozen'; oz = finalOz; head = 0; hi = (stemmed ? 1.05 : 0.92) * cap; lo = 0.6 * cap;
  } else if (stemmed && ['crushed', 'pebble', 'shaved'].includes(ice)) {
    // A shaved-ice shell pressed into a stemmed glass, the drink strained into its hollow.
    kind = 'shell'; oz = finalOz; iceOz = ICE_SHARE.shell * cap; hi = Math.min(cap - iceOz - head, 0.8 * cap); lo = 0.5 * hi;
  } else if (stemmed) {
    kind = 'up'; oz = finalOz; hi = Math.min(cap - head, cap * (v.id === 'flute' || fizz ? 0.85 : 0.8)); lo = 0.55 * cap;
  } else {
    open = OWN_ICE(method, ice);
    kind = ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice) || ['swizzle', 'flash-blend'].includes(method) ? 'crushed' : 'rocks';
    oz = open ? volOz : finalOz;
    iceOz = (ICE_SHARE[ice] || (method === 'swizzle' || method === 'flash-blend' ? ICE_SHARE.crushed : 0)) * cap;
    hi = cap - iceOz - head; lo = 0.5 * hi;
  }
  if (need === null) need = oz + iceOz + head;
  return { kind, oz, lo, hi, ice: iceOz, head, need, cap, r: need / cap, open, servings: n };
}
// The same budget for a finished card (its stats, method, vessel and servings).
const FIZZ_IDS = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda', 'sparkling-wine']);
export function recipeFill(recipe, vessel) {
  if (!recipe || !vessel) return null;
  const m = recipe.method || {};
  const tops = (recipe.lines || []).filter(l => FIZZ_IDS.has(l.id) && !l.garnish && !l.float && !l.sink);
  return fillBudget(recipe.stats || {}, vessel, { method: m.method, ice: m.ice, servings: recipe.servings || 1, fizz: tops.length > 0, fizzOz: tops.reduce((t, l) => t + (l.oz || 0), 0) });
}
