#!/usr/bin/env node
// Merge researched archetype files into data/archetypes.json.
//   node scripts/archetypes-build.mjs <research.json>... [--out data/archetypes.json]
// Validates every ingredient, family and vessel id against the repo's vocabularies (unknown
// ids are dropped and reported), and derives what the composer needs from the research:
// popularity weight (from the catalogue), style flags (creamy, long, bowl, layered...),
// aromatic garnishes, the type noun used in taglines, and a typical ingredient count.
// CREDITS (below) adds who made each drink, where and when (`origin`, with how sure the record
// is), kept apart from the book or bar whose spec is poured (`edition`). The research inputs
// live outside the repo; the build is idempotent, so `node scripts/archetypes-build.mjs
// data/archetypes.json` re-applies OVERRIDES and CREDITS to the committed file as well.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(p.startsWith('/') ? p : join(root, p), 'utf8'));
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : join(root, 'data/archetypes.json');
const files = args.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));

const vocab = read('data/ingredients.json');
const ing = new Map(vocab.ingredients.map(i => [i.id, i]));
const famIds = new Set(read('data/families.json').families.map(f => f.id));
const vesselIds = new Set(read('data/vessels.json').vessels.map(v => v.id));
const drinks = read('data/drinks.json');
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const popByName = new Map();
for (const d of drinks) popByName.set(norm(d.name), Math.max(popByName.get(norm(d.name)) || 0, d.popularity));

const issues = [];
const keepIds = (list, where) => (list || []).filter(id => {
  if (typeof id !== 'string') return false;
  if (ing.has(id)) return true;
  if (/^cat:/.test(id)) return true;
  issues.push(`${where}: unknown ingredient "${id}"`);
  return false;
});
const AROMA = { mint: /mint/, nutmeg: /nutmeg/, cinnamon: /cinnamon/ };
const NOUN = {
  punch: 'punch', grog: 'grog', daiquiri: 'sour', swizzle: 'swizzle', zombie: 'Beachcomber heavyweight', 'beachcomber-sour': 'Beachcomber sour',
  'mai-tai': 'Mai Tai-style sour', 'orgeat-punch': 'orgeat punch', colada: 'colada', buck: 'highball', 'resort-punch': 'tropical punch',
  'bitter-tiki': 'bitter tiki sour', stirred: 'tropical old fashioned', hot: 'hot drink',
};

// The type word a menu uses for an original drink built on each archetype ("A smoky
// Zombie-style heavyweight with passion fruit"). Naming the classic it descends from is honest
// and tells an aficionado exactly what to expect; drink *names* never borrow it.
const NOUN_BY_ID = {
  colada: 'colada', painkiller: 'Painkiller-style colada', daiquiri: 'daiquiri', 'mai-tai': 'Mai Tai cousin', 'vic-mai-tai-riff': 'Mai Tai cousin',
  'planters-punch': "planter's punch", 'bowl-punch': 'bowl punch', 'ti-punch': "ti' punch", grog: 'grog', 'navy-grog': 'grog',
  'trinidad-swizzle': 'swizzle', 'bermuda-rum-swizzle': 'rum swizzle', 'overproof-swizzle': 'overproof swizzle', 'herbal-swizzle': 'herbal swizzle',
  'dark-n-stormy': 'ginger beer highball', mule: 'mule', 'suffering-bastard': 'ginger beer highball',
  'hemingway-daiquiri': 'Hemingway-style daiquiri', 'frozen-daiquiri': 'frozen daiquiri', 'fruit-daiquiri': 'fruit daiquiri', 'nuclear-daiquiri': 'overproof daiquiri',
  caipirinha: 'caipirinha', mojito: 'mojito', 'rum-old-fashioned': 'rum old fashioned', 'kingston-negroni': 'rum negroni', 'corn-n-oil': 'falernum sipper',
  'hot-buttered-rum': 'hot buttered rum', 'tom-and-jerry': 'Tom and Jerry', 'hot-grog': 'hot grog', 'hot-rum-punch': 'hot punch',
  zombie: 'Zombie-style heavyweight', pilot: 'short Beachcomber heavyweight', 'cobras-fang': "Cobra's Fang-style heavyweight", tortuga: 'overproof heavyweight',
  'beachcomber-spice-sour': 'Beachcomber sour', 'pearl-diver': 'Pearl Diver-style punch', 'port-au-prince': 'Beachcomber sour', 'beachcombers-gold': 'Beachcomber daiquiri',
  'missionarys-downfall': 'mint-and-pineapple frappé', scorpion: 'orgeat punch', 'fog-cutter': 'orgeat punch', 'passion-sour': 'passion fruit sour',
  'bitter-tiki-sour': 'bitter tiki sour', 'bitters-base-sour': 'bitters sour', 'tropical-stirred': 'tropical old fashioned',
  'pina-colada': 'colada', 'fruit-colada': 'fruit colada', bushwacker: 'frozen dessert colada', 'coconut-daiquiri': 'coconut daiquiri',
  'miami-vice': 'two-tone frozen swirl', 'blue-hawaii': 'Blue Hawaii-style punch', hurricane: 'Hurricane-style punch', 'resort-liqueur-punch': 'resort punch',
  'hawaiian-mai-tai': 'Hawaiian-style Mai Tai', 'tropical-itch': 'resort punch', 'pineapple-shell': 'pineapple punch', 'sunrise-float': 'sunrise',
  'scorpion-bowl': 'scorpion bowl', 'volcano-bowl': 'volcano bowl', 'zero-proof-tiki': 'zero-proof tropical',
};

// Corrections the research asked for once the missing ingredients existed (it had to use
// proxies): the real Tom & Jerry batter, fassionola in the Hurricane and Cobra's Fang, cane
// syrup in a Ti' Punch, the right sherries on a Fog Cutter.
const swapIn = (a, comp, ids) => { const c = (a.signature || []).find(x => x.component === comp); if (c) c.anyOf = [...new Set([...ids, ...c.anyOf])]; };
const OVERRIDES = {
  'tom-and-jerry': a => {
    a.signature = [
      { component: 'brandy + rum', required: true, anyOf: ['brandy', 'rum-jamaican-aged', 'rum-jamaican-dark', 'rum-aged-column'], ozRange: [1.5, 2.5] },
      { component: 'Tom & Jerry batter', required: true, anyOf: ['tom-and-jerry-batter'], ozRange: [0.75, 1.25] },
      { component: 'hot liquid', required: true, anyOf: ['whole-milk', 'hot-water'], ozRange: [3, 5] },
    ];
    a.canonicalSpecs = [
      { name: 'Tom and Jerry (Jerry Thomas, 1862)', source: 'Jerry Thomas, How to Mix Drinks (1862)', confidence: 'medium', lines: [{ id: 'tom-and-jerry-batter', oz: 1, unit: 'oz' }, { id: 'brandy', oz: 1.5, unit: 'oz' }, { id: 'rum-jamaican-aged', oz: 0.5, unit: 'oz' }, { id: 'hot-water', oz: 4, unit: 'oz' }, { id: 'nutmeg', oz: 0, unit: 'garnish' }], method: 'hot', ice: 'none', vessel: 'hot-mug', garnish: ['freshly grated nutmeg'] },
      { name: 'Tom and Jerry (hot milk, Midwest holiday)', source: 'Midwest holiday tradition', confidence: 'medium', lines: [{ id: 'tom-and-jerry-batter', oz: 1, unit: 'oz' }, { id: 'brandy', oz: 1, unit: 'oz' }, { id: 'rum-jamaican-aged', oz: 1, unit: 'oz' }, { id: 'whole-milk', oz: 4, unit: 'oz' }, { id: 'nutmeg', oz: 0, unit: 'garnish' }], method: 'hot', ice: 'none', vessel: 'hot-mug', garnish: ['freshly grated nutmeg'] },
    ];
  },
  hurricane: a => {
    swapIn(a, 'passion fruit', ['fassionola']);
    const pat = a.canonicalSpecs.find(sp => /O'Brien/.test(sp.name));
    if (pat) pat.lines = pat.lines.map(l => l.id === 'passion-fruit-syrup' ? { ...l, id: 'fassionola', orig: 'red passion fruit syrup (Fassionola)' } : l);
  },
  'cobras-fang': a => {
    swapIn(a, 'fassionola / passion fruit syrup', ['fassionola']);
    const don = a.canonicalSpecs.find(sp => sp.name === "Cobra's Fang");
    if (don) don.lines = don.lines.map(l => l.id === 'passion-fruit-syrup' ? { ...l, id: 'fassionola' } : l);
  },
  'ti-punch': a => {
    swapIn(a, 'cane syrup', ['cane-syrup']);
    for (const sp of a.canonicalSpecs) sp.lines = sp.lines.map(l => l.id === 'rich-simple' ? { ...l, id: 'cane-syrup' } : l);
  },
  'fog-cutter': a => {
    swapIn(a, 'sherry float', ['cream-sherry', 'oloroso-sherry']);
    for (const sp of a.canonicalSpecs) {
      if (/Samoan/.test(sp.name)) sp.lines = sp.lines.map(l => l.id === 'px-sherry' ? { ...l, id: 'cream-sherry' } : l);
      if (/Smuggler/.test(sp.name)) sp.lines = sp.lines.map(l => l.id === 'amontillado-sherry' ? { ...l, id: 'oloroso-sherry' } : l);
    }
  },
};

// Credits. A drink's origin (who, where, when, and how sure the record is) is a different fact
// from the book or bar whose spec is poured: the Queen's Park Swizzle came from the Queen's Park
// Hotel in the 1920s and Trader Vic printed it in 1946. `text` is what a card prints; `year` is
// for era checks ("the way they poured it in '58"); `house` says whose house rules apply
// (Don's two-per-guest limit belongs to Don's drinks). `confidence`: documented (in print or
// first-hand), attributed (the accepted story) or disputed (rival claims, named in the text).
// `drinks` covers the other classics an archetype holds; `specs` names each spec's drink and the
// edition being poured when the spec's own name doesn't say it plainly.
const O = (text, year, extra = {}) => ({ text, year: year ?? null, confidence: 'documented', ...extra });
const ATTR = { confidence: 'attributed' }, DISP = { confidence: 'disputed' };
const DON = { house: 'don' }, VIC = { house: 'vic' };
const CREDITS = {
  'planters-punch': {
    origin: O('Jamaica, 19th century', 1878, { drink: "Planter's Punch", ...ATTR }),
    drinks: { 'Bajan Rum Punch': O('Barbados, traditional', null, ATTR), 'Jamaican Rum Punch': O('Jamaica, traditional', null, ATTR) },
    specs: {
      "Planter's Punch (1908 rhyme)": { drink: "Planter's Punch", edition: 'the 1908 New York Times rhyme' },
      'Bajan Rum Punch (1-2-3-4)': { drink: 'Bajan Rum Punch' },
      "Planter's Punch, Angostura Bar (Trinidad, 1934)": { drink: "Planter's Punch", edition: 'as mixed at the Angostura Bar, Trinidad, 1934' },
      "Trader Vic's Planter's Punch (1946)": { drink: "Planter's Punch", edition: 'as Trader Vic printed it in 1946' },
      'Jamaican Rum Punch (island party style)': { drink: 'Jamaican Rum Punch' },
    },
  },
  'bowl-punch': {
    origin: O('Schuylkill Fishing Company, Philadelphia, 1732', 1732, { drink: 'Fish House Punch', ...ATTR }),
    drinks: { 'Arrack Punch': O('the East India trade, late 17th century', 1680, ATTR) },
    specs: {
      'Fish House Punch (Jerry Thomas, 1862) per cup': { drink: 'Fish House Punch', edition: 'as Jerry Thomas printed it in 1862' },
      'Fish House Punch (single serve)': { drink: 'Fish House Punch', edition: "Difford's single serve" },
      'Arrack Punch (Boothby, 1908)': { drink: 'Arrack Punch', edition: 'as William Boothby printed it in 1908' },
    },
  },
  'ti-punch': {
    origin: O('Martinique, traditional', null, { drink: "Ti' Punch", ...ATTR }),
    drinks: { "Ti' Punch Vieux": O('Martinique, traditional', null, ATTR), 'Petit punch': O('Guadeloupe, traditional', null, ATTR) },
    specs: { "Ti' Punch (Martinique, traditional)": { drink: "Ti' Punch" }, "Ti' Punch Vieux": { drink: "Ti' Punch Vieux", edition: "Smuggler's Cove spec" } },
  },
  grog: {
    origin: O('Admiral Edward Vernon, Royal Navy, 1740', 1740, { drink: 'Grog', who: 'Admiral Edward Vernon' }),
    specs: {
      'Grog (single serve)': { drink: 'Grog', edition: "Difford's single serve" },
      "Vernon's ration (1740, illustrative)": { drink: 'Grog', edition: "Vernon's 1740 ration" },
    },
  },
  'navy-grog': {
    origin: O('Don the Beachcomber, c. 1941', 1941, { drink: 'Navy Grog', ...DON }),
    specs: { 'Navy Grog (Don the Beachcomber)': { drink: 'Navy Grog' }, "Navy Grog (Trader Vic's)": { drink: 'Navy Grog', edition: "Trader Vic's version" } },
  },
  'trinidad-swizzle': {
    origin: O("Queen's Park Hotel, Port of Spain, 1920s", 1920, { drink: "Queen's Park Swizzle", ...ATTR }),
    drinks: { 'West Indian Swizzle': O('Trinidad, in print by 1924', 1924), 'Demerara Swizzle': O('Guyana, traditional', null, ATTR) },
    specs: {
      "Queen's Park Swizzle (Trader Vic, 1946)": { drink: "Queen's Park Swizzle", edition: 'published by Trader Vic, 1946' },
      "Queen's Park Swizzle (modern, PUNCH)": { drink: "Queen's Park Swizzle", edition: 'PUNCH spec' },
      'West Indian Swizzle (Angostura, 1924)': { drink: 'West Indian Swizzle', edition: "Angostura's 1924 booklet" },
    },
    classics: { 'West Indian / Trinidad Rum Swizzle (1924)': 'West Indian Swizzle (Trinidad, in print by 1924)' },
  },
  'bermuda-rum-swizzle': {
    origin: O("Swizzle Inn, Bailey's Bay, Bermuda, 1932, by the inn's account", 1932, { drink: 'Rum Swizzle', ...ATTR }),
    drinks: { 'Bermuda Rum Swizzle': O("Swizzle Inn, Bailey's Bay, Bermuda, 1932, by the inn's account", 1932, ATTR) },
    specs: { 'Rum Swizzle (Swizzle Inn)': { drink: 'Rum Swizzle' } },
  },
  'overproof-swizzle': {
    origin: O('Don the Beachcomber', null, { drink: '151 Swizzle', ...DON }),
    specs: { '151 Swizzle (Mai-Kai reconstruction)': { drink: '151 Swizzle', edition: "the Mai-Kai's version, as The Atomic Grog rebuilt it" } },
  },
  'herbal-swizzle': {
    origin: O('Marco Dionysos, San Francisco, early 2000s', 2003, { drink: 'Chartreuse Swizzle', who: 'Marco Dionysos' }),
    drinks: { 'Green Swizzle': O('Barbados and Trinidad, c. 1900', 1900, ATTR) },
    specs: { 'Green Swizzle (Wondrich)': { drink: 'Green Swizzle', edition: "David Wondrich's reading" } },
  },
  'dark-n-stormy': {
    origin: O("Bermuda; a Gosling's trademark", null, { drink: "Dark 'n Stormy", ...ATTR }),
    specs: {
      "Dark 'n Stormy (Gosling's official)": { drink: "Dark 'n Stormy", edition: "Gosling's own spec" },
      "Dark 'n Stormy (with lime and bitters)": { drink: "Dark 'n Stormy", edition: 'the bar version with lime and bitters' },
    },
  },
  mule: {
    origin: O("Cock 'n' Bull, Los Angeles, c. 1941", 1941, { drink: 'Moscow Mule', ...ATTR }),
    drinks: { 'Gin-Gin Mule': O('Audrey Saunders, New York, 2000', 2000, { who: 'Audrey Saunders' }), 'Jamaican Mule': O('', null) },
    specs: {
      'Gin-Gin Mule (Pegu Club)': { drink: 'Gin-Gin Mule', edition: 'Pegu Club spec' },
      'Jamaican Mule (Easy Tiki)': { drink: 'Jamaican Mule', edition: "Jelani Johnson's Easy Tiki spec" },
      'Jamaican Mule (copper-mug highball)': { drink: 'Jamaican Mule' },
    },
    classics: { "Moscow Mule template (Cock 'n' Bull, 1941)": "Moscow Mule (Cock 'n' Bull, Los Angeles, c. 1941)" },
  },
  'suffering-bastard': {
    origin: O("Joe Scialom, Shepheard's Hotel, Cairo, 1942", 1942, { drink: 'Suffering Bastard', who: 'Joe Scialom' }),
    drinks: { 'Dead Bastard': O('Joe Scialom', null, { who: 'Joe Scialom' }), 'Dying Bastard': O('Joe Scialom', null, { who: 'Joe Scialom' }) },
    specs: { 'Suffering Bastard (Scialom, 1942)': { drink: 'Suffering Bastard' }, 'Dead Bastard': { drink: 'Dead Bastard' } },
  },
  daiquiri: {
    origin: O('Daiquirí, Cuba, c. 1898, attributed to Jennings Cox', 1898, { drink: 'Daiquiri', who: 'Jennings Cox', ...ATTR }),
    drinks: { 'Daiquiri No. 1': O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1934, { who: 'Constantino Ribalaigua' }) },
    specs: {
      'Daiquiri No. 1 (El Floridita)': { drink: 'Daiquiri No. 1' },
      "Daiquiri No. 1 (Smuggler's Cove)": { drink: 'Daiquiri No. 1', edition: "Smuggler's Cove spec" },
      'Daiquiri (modern craft standard)': { drink: 'Daiquiri', edition: 'the modern craft standard' },
    },
  },
  'hemingway-daiquiri': {
    origin: O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1935, { drink: 'Hemingway Daiquiri', who: 'Constantino Ribalaigua' }),
    drinks: {
      'E. Hemingway Special': O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1935, { who: 'Constantino Ribalaigua' }),
      'Hemingway Special': O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1935, { who: 'Constantino Ribalaigua' }),
      'Papa Doble': O('El Floridita, Havana, 1930s', 1935, ATTR),
    },
    specs: {
      'E. Hemingway Special (Floridita, 1939)': { drink: 'Hemingway Daiquiri', edition: "the Floridita's 1939 menu" },
      'Papa Doble': { drink: 'Papa Doble', edition: 'as A. E. Hotchner recorded it' },
      'Hemingway Special (IBA)': { drink: 'Hemingway Daiquiri', edition: 'IBA spec' },
    },
  },
  'frozen-daiquiri': {
    origin: O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1934, { drink: 'Frozen Daiquiri', who: 'Constantino Ribalaigua' }),
    drinks: {
      'Daiquiri No. 4': O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1934, { who: 'Constantino Ribalaigua' }),
      'Daiquiri No. 3': O('Constantino Ribalaigua, El Floridita, Havana, 1930s', 1934, { who: 'Constantino Ribalaigua' }),
      'Strawberry Daiquiri': O('', null),
      'Banana Daiquiri': O("Mountain Top, St. Thomas, by the bar's own claim", null, DISP),
    },
    specs: {
      'Daiquiri No. 4 (Florida Style)': { drink: 'Daiquiri No. 4' },
      'Strawberry Daiquiri (frozen)': { drink: 'Strawberry Daiquiri' },
      'Banana Daiquiri (frozen)': { drink: 'Banana Daiquiri' },
    },
  },
  'fruit-daiquiri': {
    origin: O("Mountain Top, St. Thomas, by the bar's own claim", null, { drink: 'Banana Daiquiri', ...DISP }),
    drinks: { 'Pineapple Daiquiri': O('', null), 'Passion Fruit Daiquiri': O('', null), 'Strawberry Daiquiri': O('', null) },
    specs: {
      'Frozen Banana Daiquiri (Tropical Standard)': { drink: 'Banana Daiquiri', edition: 'Tropical Standard spec' },
      'Banana Daiquiri (shaken, modern)': { drink: 'Banana Daiquiri', edition: 'a modern build with crème de banane' },
      'Pineapple Daiquiri (on the rocks)': { drink: 'Pineapple Daiquiri' },
      'Frozen Strawberry Daiquiri (Tropical Standard)': { drink: 'Strawberry Daiquiri', edition: 'Tropical Standard spec' },
    },
  },
  'nuclear-daiquiri': { origin: O('Gregor de Gruyther, LAB, London, 2005', 2005, { drink: 'Nuclear Daiquiri', who: 'Gregor de Gruyther' }) },
  caipirinha: {
    origin: O('Brazil, early 20th century', 1918, { drink: 'Caipirinha', ...ATTR }),
    specs: { 'Caipirinha (bar standard)': { drink: 'Caipirinha', edition: 'the Brazilian bar standard' }, 'Caipirinha de Maracujá': { drink: 'Caipirinha de Maracujá' } },
    drinks: { 'Caipirinha de Maracujá': O('Brazil', null, ATTR) },
  },
  mojito: {
    origin: O("Havana; in print by 1931, in Sloppy Joe's bar guide", 1931, { drink: 'Mojito' }),
    specs: { 'Mojito Criollo No. 1 (Bar La Florida, 1934)': { drink: 'Mojito', edition: "Bar La Florida's 1934 menu" }, 'Mojito (modern bar)': { drink: 'Mojito', edition: 'a modern bar build' } },
  },
  'rum-old-fashioned': {
    origin: O('', null, { drink: 'Rum Old Fashioned' }),
    drinks: { 'Tiki Old Fashioned': O('', null) },
    specs: { 'Rum Old Fashioned (classic build)': { drink: 'Rum Old Fashioned', edition: 'the classic build' } },
  },
  'kingston-negroni': {
    origin: O('Joaquín Simó, Death & Co, New York, 2009', 2009, { drink: 'Kingston Negroni', who: 'Joaquín Simó' }),
    specs: { 'Kingston Negroni (Simó)': { drink: 'Kingston Negroni' }, 'Kingston Negroni (rum-forward variant)': { drink: 'Kingston Negroni', edition: 'a rum-forward bar variant' } },
  },
  'corn-n-oil': {
    origin: O('Barbados, traditional', null, { drink: "Corn 'n' Oil", ...ATTR }),
    specs: { "Corn 'n' Oil (Zig Zag float)": { drink: "Corn 'n' Oil", edition: "Murray Stenson's Zig Zag Café float" }, "Corn 'n' Oil (Bajan half-and-half)": { drink: "Corn 'n' Oil", edition: 'the Bajan half-and-half' } },
  },
  'hot-buttered-rum': {
    origin: O('colonial America; Jerry Thomas printed it in 1862', 1750, { drink: 'Hot Buttered Rum', ...ATTR }),
    drinks: { 'Hot Spiced Rum': O('Jerry Thomas, 1862', 1862, { who: 'Jerry Thomas' }), 'Coffee Grog': O('Don the Beachcomber', null, DON) },
    specs: {
      'Hot Buttered Rum (Trader Vic)': { drink: 'Hot Buttered Rum', edition: "Trader Vic's batter" },
      'Hot Spiced Rum (Jerry Thomas, 1862)': { drink: 'Hot Spiced Rum' },
      'Coffee Grog (Don the Beachcomber)': { drink: 'Coffee Grog' },
    },
    classics: { 'Hot Buttered Rum (Trader Vic batter)': "Hot Buttered Rum (colonial America; Trader Vic's batter)" },
  },
  'tom-and-jerry': {
    origin: O("named for Pierce Egan's 1821 Tom and Jerry; Jerry Thomas claimed it", 1821, { drink: 'Tom and Jerry', ...DISP }),
    specs: { 'Tom and Jerry (Jerry Thomas, 1862)': { drink: 'Tom and Jerry', edition: 'as Jerry Thomas printed it in 1862' }, 'Tom and Jerry (hot milk, Midwest holiday)': { drink: 'Tom and Jerry', edition: 'the Midwest holiday way, with hot milk' } },
  },
  'hot-grog': {
    origin: O("the Royal Navy's grog of 1740, served hot", 1740, { drink: 'Hot Grog' }),
    drinks: { 'Hot Rum': O('Jerry Thomas, 1862', 1862, { who: 'Jerry Thomas' }) },
    specs: { 'Hot Grog (clove-studded lemon)': { drink: 'Hot Grog', edition: 'the household recipe with a clove-studded lemon' }, 'Hot Rum (Jerry Thomas, 1862)': { drink: 'Hot Rum' } },
    classics: { "Hot Grog (sailors' / Scandinavian)": 'Hot Grog (Royal Navy grog, served hot)' },
  },
  'hot-rum-punch': {
    origin: O('Victorian England; Charles Dickens wrote his recipe down in 1847', 1847, { drink: 'Hot Rum Punch' }),
    drinks: { "Charles Dickens's Punch": O('Charles Dickens, 1847', 1847, { who: 'Charles Dickens' }), 'Hot Brandy and Rum Punch': O('Jerry Thomas, 1862', 1862, { who: 'Jerry Thomas' }) },
    specs: { "Charles Dickens's Punch (1847) per cup": { drink: "Charles Dickens's Punch" }, 'Hot Brandy and Rum Punch (Jerry Thomas, 1862) per cup': { drink: 'Hot Brandy and Rum Punch' } },
  },
  zombie: {
    origin: O('Don the Beachcomber, Hollywood, c. 1934', 1934, { drink: 'Zombie', ...DON }),
    drinks: { "Trader Vic's Zombie": O('Trader Vic, 1946', 1946, VIC) },
    specs: {
      'Zombie (1934)': { drink: 'Zombie', edition: "Jeff Berry's decode" },
      'Zombie (Don the Beachcomber, c. 1950)': { drink: 'Zombie', edition: "Don's c. 1950 version" },
      "Trader Vic's Zombie (1946)": { drink: "Trader Vic's Zombie" },
    },
  },
  pilot: {
    origin: O('Don the Beachcomber, c. 1941', 1941, { drink: 'Test Pilot', ...DON }),
    drinks: { 'Jet Pilot': O("The Luau, Beverly Hills, c. 1958, from Don's Test Pilot", 1958, ATTR) },
    specs: { 'Jet Pilot (Smuggler\'s Cove)': { drink: 'Jet Pilot', edition: "Smuggler's Cove spec" } },
  },
  'cobras-fang': {
    origin: O('Don the Beachcomber, c. 1937', 1937, { drink: "Cobra's Fang", ...DON }),
    drinks: { 'Kon-Tiki Cobra': O('Kon-Tiki, Chicago', null, ATTR) },
    specs: { 'Kon-Tiki Cobra': { drink: 'Kon-Tiki Cobra' } },
  },
  'beachcomber-spice-sour': {
    origin: O('Don the Beachcomber, 1940s', 1942, { drink: 'Three Dots and a Dash', ...DON }),
    drinks: { 'Nui Nui': O('Don the Beachcomber, 1930s', 1935, DON) },
    specs: { 'Nui Nui (Easy Tiki)': { drink: 'Nui Nui', edition: "Brian Miller's Easy Tiki spec" } },
  },
  'pearl-diver': {
    origin: O('Don the Beachcomber, c. 1937', 1937, { drink: 'Pearl Diver', ...DON }),
    specs: { 'Pearl Diver (Easy Tiki)': { drink: 'Pearl Diver', edition: "Gaby Mlynarczyk's Easy Tiki spec" } },
  },
  'port-au-prince': { origin: O('Don the Beachcomber, late 1930s', 1938, { drink: 'Port au Prince', ...DON }) },
  'beachcombers-gold': {
    origin: O('Don the Beachcomber, c. 1937', 1937, { drink: "Beachcomber's Gold", ...DON }),
    specs: { "Beachcomber's Gold (rum-and-vermouth version)": { drink: "Beachcomber's Gold", edition: 'the later rum-and-vermouth version' } },
  },
  'missionarys-downfall': {
    origin: O('Don the Beachcomber, 1940s', 1940, { drink: "Missionary's Downfall", ...DON }),
    specs: {
      "Missionary's Downfall (Easy Tiki)": { drink: "Missionary's Downfall", edition: "Scotty Schuder's Easy Tiki spec" },
      "Shaken Missionary's Downfall": { drink: "Missionary's Downfall", edition: 'shaken, the Easy Tiki way' },
    },
  },
  'mai-tai': {
    origin: O("Trader Vic, Oakland, 1944; Don the Beachcomber's camp pointed to his 1933 Q.B. Cooler", 1944, { drink: 'Mai Tai', ...VIC, ...DISP }),
    drinks: { 'Royal Hawaiian Mai Tai': O("Royal Hawaiian Hotel, Waikīkī, 1953, from Trader Vic's recipe", 1953, VIC) },
    specs: {
      'Mai Tai (1944)': { drink: 'Mai Tai', edition: "Vic's own account of the 1944 formula" },
      "Mai Tai (Trader Vic's second formula)": { drink: 'Mai Tai', edition: "Vic's second formula" },
      'Royal Hawaiian Mai Tai (1956 recipe)': { drink: 'Royal Hawaiian Mai Tai', edition: "the hotel's 1956 recipe" },
    },
  },
  'vic-mai-tai-riff': {
    origin: O('Trader Vic', null, { drink: 'Honi Honi', ...VIC }),
    drinks: { 'Menehune Juice': O('Trader Vic', null, VIC), 'Pinky Gonzales': O("Trader Vic's Señor Pico, 1964", 1964, VIC) },
  },
  scorpion: {
    origin: O('Trader Vic, 1946', 1946, { drink: 'Scorpion', ...VIC }),
    drinks: { 'Scorpion Bowl': O('Trader Vic, 1946', 1946, VIC) },
    specs: {
      'Scorpion (individual)': { drink: 'Scorpion', edition: "Vic's individual spec of 1972" },
      'Scorpion Bowl (1946)': { drink: 'Scorpion Bowl' },
      "Scorpion Bowl (Smuggler's Cove)": { drink: 'Scorpion Bowl', edition: "Smuggler's Cove spec, after The Luau" },
      "Scorpion (Kelbo's)": { drink: 'Scorpion', edition: "Kelbo's version" },
    },
  },
  'fog-cutter': {
    origin: O('Trader Vic, 1940s', 1946, { drink: 'Fog Cutter', ...VIC }),
    drinks: { 'Samoan Fog Cutter': O('Trader Vic, 1950s', 1950, VIC) },
  },
  tortuga: { origin: O('Trader Vic, 1946', 1946, { drink: 'Tortuga', ...VIC }), specs: { 'Tortuga (modern reading)': { drink: 'Tortuga', edition: 'a modern reading' } } },
  'passion-sour': {
    origin: O('J. "Popo" Galsini, 1967', 1967, { drink: 'Saturn', who: 'J. "Popo" Galsini' }),
    drinks: { 'Port Light': O('Kahiki Supper Club, Columbus, c. 1961', 1961, ATTR) },
    specs: { 'Port Light (Kahiki)': { drink: 'Port Light' }, "Port Light (Smuggler's Cove)": { drink: 'Port Light', edition: "Smuggler's Cove spec" } },
  },
  'bitter-tiki-sour': {
    origin: O('Aviary Bar, Kuala Lumpur Hilton, 1970s, attributed to Jeffrey Ong', 1973, { drink: 'Jungle Bird', who: 'Jeffrey Ong', ...ATTR }),
    drinks: { 'Bitter Mai Tai': O('Jeremy Oertel, Dram, Brooklyn, c. 2012', 2012, { who: 'Jeremy Oertel' }) },
    specs: { 'Jungle Bird (1973)': { drink: 'Jungle Bird', edition: "the hotel's original" }, 'Jungle Bird (González)': { drink: 'Jungle Bird', edition: "Giuseppe González's re-spec" } },
    classics: { 'Jungle Bird (Jeffrey Ong, Kuala Lumpur Hilton, 1973)': 'Jungle Bird (Aviary Bar, Kuala Lumpur Hilton, 1970s)' },
  },
  'bitters-base-sour': {
    origin: O('Giuseppe González, Clover Club, Brooklyn, 2009', 2009, { drink: 'Trinidad Sour', who: 'Giuseppe González' }),
    drinks: { 'Trinidad Especial': O('Valentino Bolognese, 2008', 2008, { who: 'Valentino Bolognese' }) },
  },
  'tropical-stirred': {
    origin: O('Joaquín Simó, Death & Co, New York, 2009', 2009, { drink: 'Kingston Negroni', who: 'Joaquín Simó' }),
    drinks: { 'Paniolo Old Fashioned': O("Smuggler's Cove, San Francisco", null, ATTR) },
  },
  'pina-colada': {
    origin: O('Caribe Hilton, San Juan, 1954, attributed to Ramón "Monchito" Marrero; Barrachina also claims it', 1954, { drink: 'Piña Colada', who: 'Ramón "Monchito" Marrero', ...DISP }),
    drinks: { 'Chi Chi': O('', null) },
    specs: {
      'Piña Colada (Caribe Hilton house recipe)': { drink: 'Piña Colada', edition: "the Caribe Hilton's published recipe" },
      "Piña Colada (Monchito's original, by weight)": { drink: 'Piña Colada', edition: "Monchito's recipe, by weight" },
      'Piña Colada (Barrachina)': { drink: 'Piña Colada', edition: "Barrachina's method" },
      "Erick Castro's Piña Colada": { drink: 'Piña Colada', edition: "Erick Castro's spec" },
    },
  },
  painkiller: {
    origin: O('Soggy Dollar Bar, Jost Van Dyke, BVI, 1970s, attributed to Daphne Henderson', 1971, { drink: 'Painkiller', who: 'Daphne Henderson', ...ATTR }),
    drinks: { "Pusser's Painkiller": O('Soggy Dollar Bar, Jost Van Dyke, BVI, 1970s, attributed to Daphne Henderson', 1971, ATTR) },
    specs: {
      "Pusser's Painkiller (No. 2)": { drink: 'Painkiller', edition: "Pusser's No. 2" },
      'Painkiller (Grog Log)': { drink: 'Painkiller', edition: "Jeff Berry's Grog Log spec" },
      "Matthew Belanger's Painkiller": { drink: 'Painkiller', edition: "Matthew Belanger's spec" },
    },
  },
  'fruit-colada': {
    // The family's root is the Piña Colada itself (an ancestor, not this archetype's own drink).
    origin: O('Caribe Hilton, San Juan, 1954, attributed to Ramón "Monchito" Marrero; Barrachina also claims it', 1954, { drink: 'Piña Colada', who: 'Ramón "Monchito" Marrero', ancestor: true, ...DISP }),
    drinks: { 'Lava Flow': O('a Hawaiian resort drink', null, ATTR), 'Blue Hawaiian': O("a resort cousin of Harry Yee's Blue Hawaii", null, ATTR), 'Banana Colada': O('', null), 'Strawberry Colada': O('', null) },
  },
  bushwacker: {
    origin: O("Ship's Store, St. Thomas, 1975; popularized at the Sandshaker, Pensacola Beach", 1975, { drink: 'Bushwacker', ...ATTR }),
    drinks: { 'Dirty Banana': O('a Jamaican resort drink', null, ATTR) },
    specs: {
      'Bushwacker (1975 original)': { drink: 'Bushwacker', edition: 'a reconstruction of the 1975 original' },
      'Bushwacker (Gulf Coast rum version)': { drink: 'Bushwacker', edition: "the Sandshaker's rum version" },
    },
    classics: { 'Bushwacker (Sandshaker, Pensacola)': "Bushwacker (Ship's Store, St. Thomas, 1975)" },
  },
  'coconut-daiquiri': {
    origin: O('', null, { drink: 'Coconut Daiquiri' }),
    drinks: { 'Frozen Coconut Daiquiri': O('', null) },
    specs: { 'Coconut Daiquiri (Montanya)': { drink: 'Coconut Daiquiri', edition: "Montanya Distillers' house recipe" }, 'Coconut Daiquiri (shaken, up)': { drink: 'Coconut Daiquiri' } },
  },
  'miami-vice': { origin: O('Florida, 1980s, named for the TV show', 1984, { drink: 'Miami Vice', ...ATTR }) },
  'blue-hawaii': {
    origin: O('Harry Yee, Hilton Hawaiian Village, Waikīkī, 1957', 1957, { drink: 'Blue Hawaii', who: 'Harry Yee' }),
    specs: { 'Blue Hawaii (Harry Yee, 1957)': { drink: 'Blue Hawaii' }, "Garret Richard's Blue Hawaii": { drink: 'Blue Hawaii', edition: "Garret Richard's spec" } },
  },
  hurricane: {
    origin: O("Pat O'Brien's, New Orleans, 1940s", 1940, { drink: 'Hurricane', house: 'pat', ...ATTR }),
    specs: {
      "Hurricane (Pat O'Brien's, 1956)": { drink: 'Hurricane', edition: "as Pat O'Brien's printed it in 1956" },
      'Hurricane (Beachbum Berry)': { drink: 'Hurricane', edition: "Jeff Berry's spec" },
      'Hurricane (fresh modern)': { drink: 'Hurricane', edition: 'a fresh modern build' },
    },
  },
  'resort-liqueur-punch': {
    origin: O('Holiday Isle, Islamorada, Florida Keys, 1972', 1972, { drink: 'Rum Runner', ...ATTR }),
    drinks: {
      'Bahama Mama': O('credited to Oswald Greenslade, Nassau Beach Hotel, 1961', 1961, ATTR),
      'Goombay Smash': O("Miss Emily's Blue Bee Bar, Green Turtle Cay, Bahamas", null, ATTR),
      'Yellow Bird': O('a Caribbean resort drink', null, ATTR),
    },
    specs: {
      'Rum Runner (Holiday Isle)': { drink: 'Rum Runner' },
      'Rum Runner (modern, shaken)': { drink: 'Rum Runner', edition: 'a modern shaken build' },
      'Bahama Mama (coffee style)': { drink: 'Bahama Mama', edition: 'the coffee-liqueur style' },
      'Bahama Mama (Lost Lake)': { drink: 'Bahama Mama', edition: "Paul McGee's Lost Lake spec" },
    },
  },
  'hawaiian-mai-tai': {
    origin: O("Royal Hawaiian Hotel, Waikīkī, 1953, from Trader Vic's recipe", 1953, { drink: 'Royal Hawaiian Mai Tai', ...VIC }),
    drinks: { 'Hawaiian Mai Tai': O('a Hawaiian hotel-bar style', null, ATTR) },
    specs: { 'Royal Hawaiian Mai Tai (current)': { drink: 'Royal Hawaiian Mai Tai', edition: "the hotel's current recipe" }, 'Hawaiian Mai Tai (hotel-bar composite)': { drink: 'Hawaiian Mai Tai' } },
  },
  'tropical-itch': {
    origin: O('Harry Yee, Hilton Hawaiian Village, Waikīkī, late 1950s', 1957, { drink: 'Tropical Itch', who: 'Harry Yee' }),
    specs: { 'Tropical Itch (Harry Yee)': { drink: 'Tropical Itch' } },
  },
  'pineapple-shell': {
    origin: O('Don the Beachcomber', null, { drink: 'Pi Yi', ...DON }),
    drinks: { 'Chief Lapu Lapu': O('a mid-century standard', null, ATTR), 'Lapu Lapu': O('a mid-century standard', null, ATTR) },
    specs: { 'Pi Yi (Beachbum Berry)': { drink: 'Pi Yi', edition: "Jeff Berry's spec" }, 'Pi Yi (Don the Beachcomber, Hawaii)': { drink: 'Pi Yi', edition: "Don's Hawaiian-era recipe" } },
  },
  'sunrise-float': {
    origin: O('the Trident, Sausalito, early 1970s; a crème de cassis original is credited to the Arizona Biltmore', 1971, { drink: 'Tequila Sunrise', ...ATTR }),
    specs: {
      'Tequila Sunrise (Arizona Biltmore)': { drink: 'Tequila Sunrise', origin: O('Arizona Biltmore, Phoenix, 1930s, attributed to Gene Sulit', 1935, { drink: 'Tequila Sunrise', ...ATTR }) },
      'Hawaiian Mai Tai float (reference)': { drink: 'Royal Hawaiian Mai Tai' },
    },
  },
  'scorpion-bowl': {
    origin: O('Trader Vic, 1946', 1946, { drink: 'Scorpion Bowl', ...VIC }),
    drinks: { 'Scorpion Punch': O('Trader Vic, 1946', 1946, VIC), 'Kava Bowl': O('Trader Vic, c. 1942', 1942, VIC), 'Flaming Volcano': O('a Chinese-American restaurant bowl', null, ATTR) },
    specs: {
      'Scorpion Punch (1946, for twelve)': { drink: 'Scorpion Punch', edition: "Vic's 1946 bowl for twelve" },
      'Scorpion (for three or four)': { drink: 'Scorpion Bowl', edition: "Vic's 1972 bowl for three or four" },
      'Flaming Volcano (Chinese-American restaurant style)': { drink: 'Flaming Volcano' },
      "Scorpion Bowl (Jacoby's)": { drink: 'Scorpion Bowl', edition: "Jacoby's spec" },
    },
  },
  'volcano-bowl': {
    origin: O('a mid-century California bowl in the Don the Beachcomber style', null, { drink: 'Volcano Bowl', ...ATTR }),
    drinks: { 'Mystery Drink': O("the Mai-Kai's gong-announced bowl", null, ATTR) },
  },
  'zero-proof-tiki': { origin: O('', null, { drink: 'Zero-Proof Tiki' }) },
};
// Writes a's origin, its other classics' origins, each spec's drink and edition, and corrected
// classic labels. Additive to OVERRIDES and safe to run on the committed file.
function applyCredits(a) {
  const c = CREDITS[a.id];
  if (!c) return;
  a.origin = c.origin;
  a.origins = { [c.origin.drink]: c.origin, ...(c.drinks || {}) };
  for (const sp of a.canonicalSpecs || []) {
    const s = (c.specs || {})[sp.name] || {};
    sp.drink = s.drink || sp.drink || sp.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+per cup$/, '').trim();
    // "(Smuggler's Cove)", "(IBA)": the spec's own name says whose edition it is.
    const paren = (sp.name.match(/\(([^)]*)\)/) || [])[1] || '';
    if (s.edition) sp.edition = s.edition;
    else if (!sp.edition && /^(Smuggler's Cove|Death & Co|Difford's|IBA|PUNCH|Easy Tiki|Tropical Standard|Three Dots and a Dash|Tern Club)$/.test(paren)) sp.edition = `${paren} spec`;
    if (s.origin) sp.origin = s.origin;
  }
  if (c.classics) a.classics = (a.classics || []).map(x => c.classics[x] || x);
}

const seen = new Map();
for (const f of files) {
  const data = read(f);
  for (const a0 of data.archetypes || []) {
    const a = JSON.parse(JSON.stringify(a0));
    if (OVERRIDES[a.id]) OVERRIDES[a.id](a);
    applyCredits(a);
    const where = `${a.id}`;
    if (!famIds.has(a.family)) { issues.push(`${where}: unknown family "${a.family}"`); continue; }
    const sig = (a.signature || []).map(c => ({ ...c, anyOf: keepIds(c.anyOf, `${where}.signature.${c.component}`) })).filter(c => c.anyOf.length || !c.required);
    // A required component with no known ingredient is either presentation (an ice shell) or a
    // missing ingredient; it is dropped from the signature and reported for review.
    const lost = (a.signature || []).filter(c => c.required && !keepIds(c.anyOf, '').length);
    if (lost.length) issues.push(`${where}: REVIEW required component(s) with no known ingredient, dropped: ${lost.map(c => `${c.component} [${(c.anyOf || []).join(', ')}]`).join('; ')}`);
    const opt = (a.optional || []).map(o => ({ ...o, anyOf: keepIds(o.anyOf, `${where}.optional.${o.slot}`) })).filter(o => o.anyOf.length);
    // Spec lines carry volume in oz; some research files put the count in `oz` and the volume in
    // `ozEq` ("2 tsp" as oz: 2, ozEq: 0.333). Normalize to oz = volume, amount = count.
    const normLine = l => {
      const { ozEq, ...rest } = l;
      if (ozEq === undefined) return rest;
      const counted = l.unit && l.unit !== 'oz';
      return { ...rest, oz: ozEq, ...(counted ? { amount: l.amount ?? l.oz } : {}) };
    };
    // Bowl specs are written for the whole bowl ("Scorpion Punch, for twelve"); the composer
    // works per drink, so they are divided down and keep `batchOf` for the record.
    const perDrink = (l, n) => n > 1 ? { ...l, oz: Math.round(l.oz / n * 1000) / 1000, ...(l.amount !== undefined && l.unit !== 'oz' ? { amount: Math.max(1, Math.round(l.amount / n)) } : {}) } : l;
    const specs = (a.canonicalSpecs || []).map(sp => {
      const n = sp.servings > 1 ? sp.servings : 1;
      const { servings, ...rest } = sp;
      return { ...rest, ...(n > 1 ? { batchOf: n } : {}), lines: (sp.lines || []).filter(l => ing.has(l.id)).map(normLine).map(l => perDrink(l, n)), vessel: vesselIds.has(sp.vessel) ? sp.vessel : undefined };
    }).filter(sp => sp.lines.length);
    const vessels = (a.vessels || []).filter(v => vesselIds.has(v));
    const allIds = new Set([...sig, ...opt].flatMap(c => c.anyOf));
    const garnishText = [...((a.garnish || {}).required || []), ...((a.garnish || {}).typical || [])].join(' ').toLowerCase();
    const reqIds = new Set(sig.filter(c => c.required).flatMap(c => c.anyOf));
    const weight = Math.max(1, ...(a.classics || []).map(c => popByName.get(norm(c)) || 0));
    const rec = {
      id: a.id, name: a.name, family: a.family, noun: a.noun || NOUN_BY_ID[a.id] || NOUN[a.family] || a.name.toLowerCase(),
      nameNouns: a.nameNouns, definition: a.definition, classics: a.classics || [], weight,
      creamy: a.creamy ?? sig.some(c => c.required && c.anyOf.some(id => ['cream'].includes((ing.get(id) || {}).cat))),
      long: a.long ?? sig.some(c => c.required && c.anyOf.some(id => (ing.get(id) || {}).role === 'lengthener')),
      bowl: a.bowl ?? (vessels.some(v => /bowl/.test(v)) && (a.methods || []).length > 0 && /bowl/i.test(a.name)),
      layered: a.layered ?? [...sig, ...opt].some(c => c.float || c.sink || c.crown),
      flaming: a.flaming ?? /flam|volcano/i.test(a.name + ' ' + (a.look || '')),
      zeroProof: a.zeroProof,
      signature: sig, optional: opt, forbidden: keepIds((a.forbidden || []).filter(x => ing.has(x) || /^cat:/.test(x)), `${where}.forbidden`),
      canonicalSpecs: specs, ratios: a.ratios || {}, methods: a.methods || ['shake'], ice: a.ice || ['crushed'], vessels,
      garnish: a.garnish || {}, aromatics: Object.keys(AROMA).filter(k => AROMA[k].test(garnishText) && ing.has(k)),
      look: a.look || '', flavorProfile: a.flavorProfile || [], taglineWords: a.taglineWords || [], substitutions: a.substitutions || [],
      redFlags: a.redFlags || [], prayerFit: a.prayerFit || [],
      typicalCount: specs.length ? Math.round(specs.reduce((s, sp) => s + sp.lines.filter(l => (ing.get(l.id) || {}).role !== 'aromatic').length, 0) / specs.length) : sig.length,
    };
    if (a.origin) { rec.origin = a.origin; rec.origins = a.origins; }
    if (seen.has(rec.id)) issues.push(`${where}: duplicate id from ${f}; later one wins`);
    seen.set(rec.id, rec);
    void reqIds; void allIds;
  }
}
const archetypes = [...seen.values()];
writeFileSync(out, '{\n  "about": "Proven drink structures the generator builds from (see web/lib/composer.js). Compiled from research by scripts/archetypes-build.mjs.",\n  "archetypes": [\n' + archetypes.map(a => '    ' + JSON.stringify(a)).join(',\n') + '\n  ]\n}\n');
console.log(`${archetypes.length} archetypes → ${out}`);
if (issues.length) console.log(`${issues.length} issues:\n  ` + issues.slice(0, 80).join('\n  '));
