// Every drink gets one specific vessel from data/vessels.json. Catalogued drinks are mapped from
// their free-text `glass` field (plus a few identity-defining classics by name); generated drinks
// choose one in engine.js from the family's vessel habits, the drink's service and its volume.

// A drink's service, from how it's made: which vessels can hold it.
export function serviceOf(method, ice) {
  if (method === 'hot') return 'hot';
  if (method === 'blend' || ice === 'blended') return 'frozen';
  if (method === 'flash-blend' || method === 'swizzle' || ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice)) return 'crushed';
  if (method === 'build' || method === 'muddle-build' || ice === 'block') return 'rocks';
  return 'shaken'; // shaken or stirred with cubes, then served up or over fresh ice
}
// Which vessel serve styles accept each drink service.
export const SERVICE_FITS = {
  hot: ['hot'], frozen: ['frozen'], crushed: ['crushed'], rocks: ['rocks'], shaken: ['up', 'rocks'],
};

// Classics whose vessel is part of their identity: the glass or mug is named for the drink,
// or the drink was created for it. Checked before the glass text.
export const BY_NAME = {
  'pearl diver': 'pearl-diver',
  'painkiller': 'enamel-tin',
  'shrunken skull': 'skull-mug',
  "barrel o' rum": 'barrel-mug',
  'rum barrel': 'barrel-mug',
  'scorpion bowl': 'scorpion-bowl',
  'volcano bowl': 'volcano-bowl',
  'samoan fog cutter': 'fog-cutter-mug',
  'hurricane': 'hurricane',
};

// First match wins, most specific vessel first: in "tall glass or tiki mug" the mug is the
// point. Ceramics and novelties, then named specialty glasses, then generic glassware.
export const GLASS_RULES = [
  [/volcano/, 'volcano-bowl'],
  [/scorpion bowl|tiki bowl|kava bowl|lovers|mystery bowl|bowl for two/, 'scorpion-bowl'],
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
