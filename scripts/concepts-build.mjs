#!/usr/bin/env node
// Merge researched prayer semantics into data/concepts.json.
//   node scripts/concepts-build.mjs <semantics.json>... [--out data/concepts.json]
// Each concept maps phrases a guest might pray ("heartbreak", "Tokyo neon", "my grandmother's
// garden") to what a bartender would hear: flavor tags, bottles, things to steer away from,
// style, color, families, vessels, garnish ideas, name and tagline words, and a one-line
// reading the Shrine can say back (author-only notes in the research move to `guidance`, never
// rendered). Unknown ids are dropped and reported; a phrase claimed by two concepts stays with
// the first. The build is idempotent: `node scripts/concepts-build.mjs data/concepts.json`
// re-applies the patches to the committed file when the research inputs aren't at hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(p.startsWith('/') ? p : join(root, p), 'utf8'));
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : join(root, 'data/concepts.json');
const files = args.filter((a, i) => !a.startsWith('--') && !(outAt >= 0 && i === outAt + 1));

const vocab = read('data/ingredients.json');
const ing = new Map(vocab.ingredients.map(i => [i.id, i]));
const TAGS = new Set(vocab.flavor_tags || vocab.ingredients.flatMap(i => i.flavors || []));
const famIds = new Set(read('data/families.json').families.map(f => f.id));
const vesselIds = new Set(read('data/vessels.json').vessels.map(v => v.id));
const archIds = new Set((x => x.archetypes || x)(read('data/archetypes.json')).map(a => a.id));
// A promise keeps only bottles the pantry has; doses are ounces.
function cleanPromise(pr, where) {
  if (!pr || typeof pr !== 'object') return null;
  const ok = id => ing.has(id) || (issues.push(`${where}: promise names unknown ${id}`), false);
  const out = { ids: (pr.ids || []).filter(ok) };
  if (pr.all) out.all = true;
  const min = Object.fromEntries(Object.entries(pr.min || {}).filter(([id, v]) => ok(id) && num(v, 0, 3)));
  if (Object.keys(min).length) out.min = min;
  const max = Object.fromEntries(Object.entries(pr.max || {}).filter(([id, v]) => ok(id) && num(v, 0, 8)));
  if (Object.keys(max).length) out.max = max;
  for (const k of ['up', 'frozen', 'stirred', 'layered', 'flaming']) if (pr[k] === true) out[k] = true;
  if (num(pr.long, 1, 8)) out.long = pr.long;
  if (num(pr.abvMax, 0, 40) !== null && pr.abvMax !== undefined) out.abvMax = pr.abvMax;
  if (Array.isArray(pr.float)) out.float = pr.float.filter(ok);
  if (Array.isArray(pr.avoid)) out.avoid = pr.avoid.filter(ok);
  if (Array.isArray(pr.when)) out.when = pr.when;
  if (Array.isArray(pr.frames)) out.frames = pr.frames.filter(a => archIds.has(a) || (issues.push(`${where}: promise frame ${a} not built yet`), true));
  return out;
}
const STYLE_NUM = ['strength', 'sweetness', 'tartness', 'complexity'];
const STYLE_BOOL = ['creamy', 'frozen', 'hot', 'long', 'bitter', 'flaming', 'layered', 'bowl', 'zeroProof', 'stirred', 'simple'];
// Colors the engine knows how to pour and to check in the finished drink.
const COLOR = {
  blue: 'blue', azure: 'blue', turquoise: 'blue', aqua: 'blue', teal: 'blue', cyan: 'blue', navy: 'blue',
  red: 'red', crimson: 'red', scarlet: 'red', ruby: 'red', pink: 'pink', rose: 'pink', coral: 'pink', blush: 'pink', magenta: 'pink',
  orange: 'orange', tangerine: 'orange', sunset: 'orange', amber: 'gold', gold: 'gold', golden: 'gold', yellow: 'gold',
  green: 'green', jade: 'green', emerald: 'green', lime: 'green', purple: 'purple', violet: 'purple', lavender: 'purple',
  black: 'dark', dark: 'dark', brown: 'dark', mahogany: 'dark', white: 'white', cream: 'white', ivory: 'white', clear: 'clear', silver: 'clear',
};
const issues = [];
// Patches for bottles added after the research ran (it noted them as missing from the pantry).
const PATCH = {
  'japan-tokyo': { ings: { 'japanese-whisky': 1.6, sake: 0.5 }, vessels: { highball: 1 } },
  neon: { ings: { 'melon-liqueur': 0.8 }, color: 'green' },
  dragon: { ings: { 'pitaya-puree': 0.8 }, style: { flaming: true } },
  pele: { style: { flaming: true } },
  'hurricane-new-orleans': { ings: { fassionola: 1 } },
  // Where glass is a hazard (the pool deck, the sand, a boat), an unbreakable tumbler; a
  // promotion is a celebration (a flute or a coupe, not a rocks glass); brunch takes a wine glass.
  'pool-party': { vessels: { 'acrylic-tumbler': 1.6 } },
  beach: { vessels: { 'acrylic-tumbler': 1.5 } },
  boat: { vessels: { 'acrylic-tumbler': 1.6 } },
  promotion: { vessels: { flute: 1.6, coupe: 1.2, dof: 0 } },
  brunch: { vessels: { goblet: 1.5 } },
};
// Readings, promises and canonical answers written after the critic's rounds. A reading is said
// back to the guest in two parts: lore (past tense, or a year: kept always, it promises nothing
// about this drink) and a promise in the present tense that the drink in the glass must keep, or
// the Shrine says what was poured instead. `promise` (one object or a list) compiles into what
// the recipe must keep (web/lib/prompt.js, composer.promiseBreak): `ids` to pour (any, or `all`),
// `min` doses, `up`/`frozen`/`stirred`, `long` (ounces of lengthener), `float` (bottles floated on
// top), `abvMax`, `avoid` (bottles it must not pour) and `frames` (the archetypes that can keep
// it: Havana's Cuban classics). `archetypes` points the concept at its canonical drinks. A field
// given here replaces the research's; `ings`, `tags` and `vessels` merge (0 removes).
const DARK_RUMS = ['rum-jamaican-dark', 'rum-black-blended', 'rum-demerara', 'rum-navy', 'rum-jamaican-aged', 'rum-jamaican-pot'];
const JAMAICAN = ['rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-dark', 'rum-jamaican-white-overproof'];
const CUBAN = ['daiquiri', 'frozen-daiquiri', 'fruit-daiquiri', 'hemingway-daiquiri', 'mojito', 'coconut-daiquiri'];
const AUTHOR = {
  'bananas-foster': {
    reading: "Bananas Foster was born at Brennan's in New Orleans in 1951: bananas sautéed in butter, brown sugar and cinnamon, flamed with rum and banana liqueur and spooned over vanilla ice cream. In a glass it's aged Jamaican rum and banana liqueur, with cinnamon.",
    archetypes: { 'bananas-foster': 4, 'rum-old-fashioned': 2.5, 'fruit-colada': -2, 'pina-colada': -2 },
    families: { stirred: 1.4, colada: 0, hot: 0 },
    ings: { 'banana-liqueur': 2, 'rum-jamaican-aged': 1.6, 'rum-jamaican-dark': 0.8, 'demerara-syrup': 1.2, 'cinnamon-syrup': 1.2, 'vanilla-ice-cream': 0.8, 'hot-buttered-rum-batter': 0.8, angostura: 0.6 },
    promise: [{ ids: ['banana-liqueur'], min: { 'banana-liqueur': 0.5 } }, { ids: ['cinnamon-syrup', 'hot-buttered-rum-batter'] }],
    garnish: ['brûléed banana coin, dusted with cinnamon'],
    nameWords: ['Royal Street', 'French Quarter', 'Flambé', 'Caramel Skillet', 'Foster'],
    taglineWords: ['for a French Quarter night', 'skip the cake'],
  },
  heartbreak: { promise: { ids: ['amaro', 'cherry-heering'], all: true, min: { 'cherry-heering': 0.5 } } },
  'first-date': {
    archetypes: { 'fruit-daiquiri': 2.5 },
    specs: { 'fruit-daiquiri': ['Pineapple Daiquiri (on the rocks)'] },
    ings: { 'apricot-liqueur': 1.6, 'pineapple-juice': 1.2, 'rum-gold-column': 1.2 },
    promise: { ids: ['apricot-liqueur', 'pineapple-juice'], all: true, min: { 'apricot-liqueur': 0.5 }, up: true },
    garnish: ['a single lime wheel'],
  },
  beach: {
    reading: "Caribbean beach bars have poured rum punch by the old Bajan rhyme since the 1900s: one of sour, two of sweet, three of strong, four of weak.",
    promise: [],
  },
  'havana-nights': {
    reading: "Havana in the 1950s danced at the Tropicana and drank at El Floridita, where the Daiquiri No. 4 came blended to snow with maraschino, and at the Hotel Nacional, whose Special married rum, pineapple and apricot. Glamour over grit.",
    archetypes: { 'frozen-daiquiri': 3, 'fruit-daiquiri': 2.6, 'hemingway-daiquiri': 1, daiquiri: 1 },
    ings: { 'rum-white-column': 1.6, 'rum-gold-column': 1, maraschino: 1, 'apricot-liqueur': 0.6, 'pineapple-juice': 0.6, grenadine: 0, 'dry-vermouth': 0 },
    tags: { pineapple: 0, cherry: 0, apricot: 0, pomegranate: 0 },
    specs: { 'frozen-daiquiri': ['Daiquiri No. 4 (Florida Style)'], 'fruit-daiquiri': ['Pineapple Daiquiri (on the rocks)'] },
    promise: [
      { ids: [], frames: CUBAN },
      { when: ['frozen-daiquiri'], ids: ['maraschino'], frozen: true },
      { when: ['fruit-daiquiri'], ids: ['apricot-liqueur', 'pineapple-juice'], all: true, min: { 'apricot-liqueur': 0.5 }, up: true },
    ],
    nameWords: ['Tropicana', 'Mambo', 'Cabaret', 'Malecón', 'Cha-Cha', 'Casino'],
  },
  'cuba-havana': { promise: { ids: [], frames: CUBAN } },
  promotion: {
    archetypes: { 'mai-tai': 3 },
    specs: { 'mai-tai': ["Mai Tai (Smuggler's Cove)", 'Mai Tai (1944)'] },
    ings: { 'rum-jamaican-aged': 1.4, 'rum-agricole-vieux': 0, 'rum-aged-column': 0 },
    // On a Mai Tai: the full half ounce of orgeat, the Demerara 151 floated, the bubbles; on any
    // other frame (a second idea), an aged rum and the float, one rank up.
    promise: [
      { when: ['mai-tai', 'vic-mai-tai-riff', 'hawaiian-mai-tai'], ids: ['orgeat', 'sparkling-wine'], all: true, min: { orgeat: 0.5, 'sparkling-wine': 1 }, max: { 'sparkling-wine': 1.5 }, float: ['rum-demerara-overproof'] },
      { ids: ['rum-jamaican-aged', 'rum-jamaican-pot', 'rum-agricole-vieux', 'rum-demerara', 'rum-aged-column', 'rum-barbados'], float: ['rum-demerara-overproof'] },
    ],
    nameWords: ['Corner Office', 'Level Up', 'Commodore', 'Top Deck', 'Brass Ring'],
  },
  celebration: { reading: "A celebration wants bubbles and gold: a Mai Tai-style sour of aged rum, curaçao and orgeat topped with sparkling wine, festive without being sticky; Trader Vic's friends greeted the original with \"Maita'i roa ae\", out of this world." },
  dad: {
    archetypes: { 'vic-mai-tai-riff': 3, 'tropical-stirred': 1.2 },
    ings: { bourbon: 1.8, 'maple-syrup': 1.2, 'scotch-islay': 1 },
    promise: { ids: ['bourbon', 'maple-syrup', 'scotch-islay'], all: true, min: { 'maple-syrup': 0.25, 'scotch-islay': 0.08 }, frames: ['vic-mai-tai-riff', 'mai-tai', 'tropical-stirred', 'rum-old-fashioned'] },
    reading: "For Dad: a bourbon Mai Tai in the spirit of Trader Vic's Honi Honi, a little maple and a whisper of peat smoke, shaken short over crushed ice in a heavy rocks glass. Familiar spirit, tiki structure.",
    nameWords: ['Honi Honi', 'Captain Dad', 'Big Wheel', 'Old Man River', "Pops' Ration"],
  },
  tahiti: {
    reading: "Tahiti gave the Mai Tai its name: Trader Vic's Tahitian friends said 'maita'i roa ae', 'out of this world, the best'. The island's signatures were always vanilla and the tiare, its own gardenia. So this is a Mai Tai with Tahitian vanilla, crowned with a tiare.",
    archetypes: { 'mai-tai': 3 },
    families: { colada: 0, 'mai-tai': 2 },
    ings: { 'vanilla-syrup': 1.8, 'coconut-milk': 0, 'pineapple-juice': 0 },
    tags: { coconut: 0, pineapple: 0 },
    promise: { ids: ['vanilla-syrup'], min: { 'vanilla-syrup': 0.25 }, frames: ['mai-tai', 'vic-mai-tai-riff', 'hawaiian-mai-tai'] },
    garnish: ['tiare gardenia', 'spent lime shell', 'mint sprig'],
    nameWords: ['Tiare', "Moʻorea", 'Papeete', 'Matavai', 'Vanille', 'Teahupoʻo'],
  },
  party: {
    reading: "A party needs a big, festive bowl that's easy to love and properly built: rum punch for everyone, served from a punch bowl over a block of ice.",
    ings: { 'passion-fruit-syrup': 0.6 },
  },
  jamaica: {
    reading: "Jamaica gave the world high-ester pot-still rum (Hampden, Worthy Park, Appleton, Wray & Nephew overproof), the Planter's Punch and pimento, the berry behind allspice dram. Ginger and Ting, the island's grapefruit soda, were everyday flavors long before tiki. So this one is funky Jamaican rum and lime, with allspice and grapefruit soda.",
    archetypes: { 'planters-punch': 3 },
    ings: { 'grapefruit-soda': 1.6, 'allspice-dram': 1.2 },
    promise: [{ ids: JAMAICAN }, { ids: ['grapefruit-soda'], frames: ['planters-punch', 'bowl-punch', 'ti-punch', 'dark-n-stormy', 'mule', 'navy-grog', 'grog'] }],
  },
  snow: {
    reading: "Ski lodges of the 1950s warmed their guests with Hot Buttered Rum and Tom and Jerry. Snow calls for something steaming in a mug, with nutmeg on top.",
  },
  slushy: { reading: "Frozen is the blender's art: ice whirled to a sorbet, sweeter and fruitier than a shaken drink, because cold mutes both." },
  warming: { reading: "A cold night wants warmth: baking spice, a dark spirit and a little heat." },
  grandparents: { reading: "Our grandparents' tiki was the mid-century kind, Trader Vic's and Don's, brandy and rum and never neon. This one is gentle and familiar." },
  spring: {
    reading: "A garden is green and floral: mint, elderflower and lime, crisp and fresh as the first warm day.",
    archetypes: { 'herbal-swizzle': 1.5, 'missionarys-downfall': 1.5, mojito: 1 },
    promise: { ids: ['elderflower-liqueur', 'mint'], all: true },
  },
  'rainy-reading': { reading: "A good book wants a drink that keeps pace: slow, quiet, not too sweet, nothing to wrangle while you turn the pages." },
  afternoon: { reading: "An afternoon is unhurried: something gentle, to sip while the light moves across the room." },
  'rainy-day': { reading: "Rain wants warmth and spice: something steaming in a mug while the rain hits the window." },
  'sunset-colors': { reading: "A sunset is a gradient: red settling at the bottom under orange-gold.", promise: { ids: [], layered: true } },
  'pool-party': { reading: "A pool wants something frozen and easy, in a cup nobody minds dropping." },
  blue: { reading: "A true blue comes from blue curaçao with clear partners, so it stays blue in the glass." },
  'sunrise-colors': { reading: "A sunrise is grenadine poured last, sinking through orange so the glass shades from red to gold." },
  sunrise: { reading: "The original Tequila Sunrise, traced to the Arizona Biltmore in the 1930s, used crème de cassis; the 1970s version used orange juice and grenadine. A sunrise is a gradient: grenadine poured last sinks, so the glass shades from red at the bottom to gold at the top." },
  layered: { reading: "Tiki's layers were always functional: Trader Vic's Angostura crown on the Queen's Park Swizzle, the dark-rum float on the Planter's Punch. This one carries two or three clean bands." },
  pretty: { reading: "Pretty means color from real ingredients and a glass that shows it off." },
  teal: { reading: "Harry Yee found the ocean's teal in 1957: blue curaçao with a little pineapple. This one is turquoise, clear enough to see through." },
  jungle: { reading: "The jungle in tiki belongs to the Jungle Bird, born at the Kuala Lumpur Hilton's Aviary Bar in 1973." },
  green: {
    reading: "Green comes from green Chartreuse: herbal, bright and lime-sharp, the color of the canopy.",
    archetypes: { 'nuclear-daiquiri': 4, 'herbal-swizzle': 2.6, 'bitter-tiki-sour': -2 },
    ings: { 'green-chartreuse': 2, 'rum-jamaican-white-overproof': 1, mint: 0.6 },
    promise: { ids: ['green-chartreuse'], min: { 'green-chartreuse': 0.75 } },
  },
  'japan-tokyo': {
    reading: "Tokyo's Ginza bars became famous for precision: exact measures, clear ice, a whisky highball poured just so. This one carries Japanese whisky and yuzu.",
    taglineWords: ['with Ginza-bar precision'],
  },
  neon: { reading: "Neon is tonic's trick: its quinine fluoresces under a black light, so a tonic highball with a vivid liqueur really does glow." },
  elvis: { reading: "Elvis's tiki moment is the film Blue Hawaii (1961), shot partly at the Coco Palms on Kauaʻi, plus Girls! Girls! Girls! (1962) and Paradise, Hawaiian Style (1966). The Blue Hawaii cocktail (Harry Yee, Hilton Hawaiian Village, 1957) predates the film by four years." },
  'gilligans-island': { reading: "Gilligan's Island (CBS 1964–67) stranded seven castaways from the S.S. Minnow's three-hour tour, with coconut-everything gadgets from the Professor. Castaway comfort: coconut and pineapple, nothing too strong." },
  dragon: { reading: "A dragon breathes fire and guards its hoard: smoke, chile heat and a flame at the table." },
  pele: {
    reading: "Hawaiians have long honored Pele, goddess of volcanoes, whose home is Halemaʻumaʻu crater at Kīlauea. The ʻōhelo berry, kin to the cranberry, was offered to her before anyone ate. This one runs lava-red: hibiscus with a slow chile burn.",
    archetypes: { 'volcano-bowl': 2.5, 'overproof-swizzle': 3, 'trinidad-swizzle': 1.5 },
    ings: { 'cranberry-juice': 0, 'pomegranate-juice': 0, 'hibiscus-syrup': 1.6, 'ancho-reyes': 1.4, 'rum-demerara-overproof': 1.2, 'ginger-syrup': 0.4 },
    tags: { berry: 0, pomegranate: 0 },
    promise: { ids: ['hibiscus-syrup', 'ancho-reyes'], all: true, frames: ['volcano-bowl', 'overproof-swizzle', 'trinidad-swizzle', 'herbal-swizzle', 'bermuda-rum-swizzle', 'zombie', 'cobras-fang'] },
    taglineWords: ['from the crater at Kīlauea', 'lava-red and slow-burning'],
  },
  treasure: { reading: "Treasure is gold: aged rum, passion fruit or honey, a little spice, a glow like coins in the lamplight." },
  pirate: { reading: "Pirates of the golden age (1650–1730) sailed on rum, lime and dark sugar. This one is hearty: Jamaican rum, lime and spice." },
  sessionable: {
    reading: "Low proof is built for several rounds: a long drink on wine, sherry or bubbles with bright citrus, around seven percent.",
    ings: { 'sparkling-wine': 1.4, 'lillet-blanc': 1, 'amontillado-sherry': 0.8 },
    promise: { ids: [], abvMax: 7 },
  },
  brunch: {
    reading: "Brunch wants low proof and high brightness: a tiki mimosa of orange and sparkling wine with a little rum, golden and fizzy, built to go alongside eggs rather than replace them.",
    promise: { ids: ['sparkling-wine'], abvMax: 7 },
  },
  'zero-proof-guest': { reading: "The designated driver deserves a real tiki drink, not a glass of juice: spiced syrups, fresh citrus, a tea or ginger backbone and the full garnish ceremony, with no alcohol at all." },
  'date-night': { reading: "A date night wants something elegant and easy to talk over, at a gentle strength." },
  'pantry-simple': { reading: "Simple means three to five bottles from any good shop, and syrups you can stir up in a minute." },
  crowd: { reading: "A crowd wants one big bowl, built so everyone can have a second cup." },
  bored: { reading: "Surprise is the bartender's privilege: something you've never tasted, an unexpected but proven pairing, still balanced." },
  refreshing: { reading: "Refreshing means long, cold and bright, lightly sweet, with something aromatic like mint or ginger." },
  sophisticated: { reading: "Elegance in tiki is restraint: served up in a stemmed glass, with no juice pile-up, no garnish forest and no novelty colors.", promise: { ids: [], up: true } },
};
// Concepts the research didn't cover. "A night in Tahiti" and "a snowy night" are heard as night.
const ADD = [
  {
    id: 'night', domain: 'time', phrases: ['night', 'nights', 'at night', 'by moonlight', 'moonlit'],
    reading: "Night wants a dark rum and something to linger over, the drink you carry out under the stars.",
    tags: { molasses: 0.6, oaky: 0.4 }, ings: { 'rum-jamaican-dark': 0.8, 'rum-black-blended': 0.6, 'rum-demerara': 0.6 },
    promise: { ids: DARK_RUMS },
    nameWords: ['Moonlit', 'Night Heron', 'Starlit', 'Lantern', 'Midnight Tide'], taglineWords: ['for a night under the stars', 'after the sun goes down'],
  },
];

// Phrases the research gave to the wrong concept: "garden" alone is flowers and herbs, not a
// garden party with a punch bowl.
const MOVE = { garden: 'spring', gardens: 'spring', elegant: 'sophisticated', classy: 'sophisticated', 'havana 1950s': 'havana-nights', 'street party': 'party', 'block party': 'party' };
// Guest-facing readings. The research wrote each reading for two audiences: what the Shrine
// says back to the guest, and notes for whoever builds the drink ("Respect: …", "(… don't
// reuse.)", the list of jokes to keep away from a deity, "isn't in the pantry"). The notes move
// to `guidance`, which is kept for authors and never rendered.
const GUIDANCE = [
  /^Respect(fully)?\b|^Treat the lore\b|^Read the domain the god governs/,
  /\bdon'?t (reuse|borrow|use|name|mimic|stereotype)\b|\bdo not (reuse|invent)\b|\bcatalogue (drink|name)s?\b/i,
  /\bnever caricature\b|\bjokes?\b|\bclich[ée]s?\b|\bin any drink name\b|\bAvoid naming\b|\bAvoid the brand name\b|\bname the drink after\b|\bout of names\b/i,
  /\b(isn'?t|aren'?t|is not|are not) (in the pantry|stocked)\b|\bnot in the pantry\b|\bmissing from the pantry\b|\bif they were in the pantry\b|\bIt isn'?t stocked\b|\bThe local pantry\b|\bWith this pantry\b|\bin this pantry\b/i,
  /\buncertain\b|\bcolor model\b/i,
  /^Avoid\b/,
  // Notes to the bartender rather than words for the guest: "Read it as …", "Families: …",
  // "Target …", imperatives ("Keep the yellow small", "Shake the body"), "only if asked".
  /^Read (it |them |as\b|[A-Z][a-z]+ as\b)|^Families:|^Target\b|^Cold:|^Hot:|\bmust come from\b|\bonly if asked\b/,
  /^(Keep|Balance|Build|Count|Shake|Use|Include|Increase|Blend|Exclude|Pour|Float|Sink|Add|Make(?!-at)|Garnish|Lean|Skip|Swap|Think)\b/,
];
const isGuidance = s => GUIDANCE.some(re => re.test(s.trim()));
// Sentences end at . or ? before a capital (or an opening parenthesis or quote), so "1.2 times",
// "St. Thomas", "c. 1934" and "Girls! Girls! Girls!" stay whole.
const SENTENCE_BREAK = /(?<=[.?]["')\]]*)(?<!\b(?:St|Mt|Mr|Mrs|Dr|Jr|Sr|c|ca|vs|No|[A-Z])\.)\s+(?=[A-Z("'ʻ‘“])/;
function splitReading(text) {
  const keep = [], notes = [];
  for (const sentence of String(text || '').split(SENTENCE_BREAK)) {
    let s = sentence.trim();
    if (!s) continue;
    // An aside for the author inside a sentence the guest should read: "(… don't reuse.)".
    s = s.replace(/\s*\(([^)]*)\)/g, (m, inner) => (isGuidance(inner) ? (notes.push(inner.trim()), '') : m)).replace(/\s+([.,;:!?])/g, '$1');
    if (/^\(.*\)\.?$/.test(s) && isGuidance(s.slice(1, -1))) { notes.push(s); continue; }
    if (isGuidance(s)) notes.push(s);
    else if (s.replace(/[\s.()]/g, '')) keep.push(s);
  }
  return { reading: keep.join(' '), guidance: notes.join(' ') };
}
// Name and tagline words a concept should not offer: a place word from another place (Kyoto is
// not Tokyo), "Smoke Signal" (a stereotype, not a smoke), and Hawaiian words on concepts that
// aren't Hawaiian (a party is not a hoʻolauleʻa, a promotion is not a hoʻomaikaʻi).
const DROP_WORDS = {
  'japan-tokyo': ['Kyoto'],
  campfire: ['Smoke Signal'],
  'tiki-torch': ['Smoke Signal'],
  party: ["Ho'olaule'a", "Ho'olaule'a: a celebration", 'Big Kahuna Bowl'],
  promotion: ["Ho'omaika'i", "Ho'omaika'i: congratulations"],
  heartbreak: ['Kaumaha'],
  'self-care': ['Malama', "Ho'omaha", 'Malama: take care'],
  karaoke: ['Mele', 'Hana Hou', 'Hana hou! (encore!)'],
  // An offering to a goddess is not a flavor note; a name is not a coconut-copra joke.
  pele: ['with the first berry set aside'],
};
const keepWord = (id, w) => !(DROP_WORDS[id] || []).includes(w);
const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();

// A phrase two concepts both claim goes to the one that names it most directly: the concept
// whose id is the phrase ("dreamsicle") beats a broad one that lists it ("childhood"); then the
// one with fewer phrases (more specific); then the first.
const slug = s => norm(s).replace(/['\s]+/g, '-');
const all = [];
for (const f of files) for (const c of read(f).concepts || []) all.push({ c, f });
for (const c of ADD) if (!all.some(x => x.c.id === c.id)) all.push({ c: JSON.parse(JSON.stringify(c)), f: 'authored' });
const merge = (a, b) => ({ ...(a || {}), ...(b || {}) });
for (const x of all) {
  const au = AUTHOR[x.c.id];
  if (!au) continue;
  const c = x.c;
  for (const k of ['ings', 'tags', 'vessels', 'families', 'archetypes']) if (au[k]) c[k] = merge(c[k], au[k]);
  for (const k of ['reading', 'garnish', 'nameWords', 'taglineWords', 'color', 'specs']) if (au[k] !== undefined) c[k] = au[k];
  if (au.promise !== undefined) c.promise = au.promise;
  if (au.style) c.style = merge(c.style, au.style);
}
const seenIds = new Map();
for (const x of all) {
  if (!x.c.id || !Array.isArray(x.c.phrases)) continue;
  // The same concept id twice (a research script's duplicate): keep the richer one.
  const prev = seenIds.get(x.c.id);
  if (prev && (prev.c.phrases || []).length >= x.c.phrases.length) { x.dup = true; issues.push(`${x.c.id}: duplicate concept dropped`); continue; }
  if (prev) prev.dup = true;
  seenIds.set(x.c.id, x);
}
// Function words are never a wish ("and" is not Peru).
const FUNCTION_WORDS = new Set(['and', 'the', 'for', 'with', 'you', 'our', 'but', 'not', 'too', 'are', 'was', 'has', 'had', 'get', 'got', 'its', 'his', 'her', 'him', 'she', 'they', 'them', 'this', 'that', 'from', 'into', 'onto', 'over', 'very', 'just', 'some', 'any', 'all', 'one', 'two', 'few', 'lot', 'out', 'off', 'way', 'who', 'why', 'how', 'what', 'when', 'where', 'can', 'may', 'will', 'like', 'make', 'made', 'more', 'less', 'much', 'drink', 'drinks', 'something']);
const owner = new Map();
for (const [n, id] of Object.entries(MOVE)) { const x = all.find(x => x.c.id === id && !x.dup); if (x && !x.c.phrases.includes(n)) x.c.phrases.push(n); }
const claimScore = (x, n) => (slug(x.c.id) === slug(n) ? 100 : slug(x.c.id).includes(slug(n)) || slug(n).includes(slug(x.c.id)) ? 50 : 0) - x.c.phrases.length * 0.1;
for (const x of all) {
  if (x.dup || !x.c.id || !Array.isArray(x.c.phrases)) continue;
  for (const p of x.c.phrases) {
    const n = norm(p);
    if (!n || n.length < 3 || FUNCTION_WORDS.has(n)) continue;
    const cur = owner.get(n);
    if (MOVE[n]) { if (x.c.id === MOVE[n]) owner.set(n, x); continue; }
    if (!cur || claimScore(x, n) > claimScore(cur, n)) owner.set(n, x);
  }
}
const claimed = new Map();
const concepts = [];
const ids = new Set();
for (const x of all) {
  const { c, f } = x;
  const pt = PATCH[c.id];
  if (pt) { c.ings = { ...(c.ings || {}), ...(pt.ings || {}) }; c.vessels = { ...(c.vessels || {}), ...(pt.vessels || {}) }; c.style = { ...(c.style || {}), ...(pt.style || {}) }; if (pt.color) c.color = pt.color; }
  if (x.dup) continue;
  {
    const where = `${f.split('/').pop()}:${c.id}`;
    if (!c.id || !Array.isArray(c.phrases)) { issues.push(`${where}: no id/phrases`); continue; }
    let id = c.id;
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    const phrases = [];
    for (const p of c.phrases) {
      const n = norm(p);
      if (!n || n.length < 3 || owner.get(n) !== x || claimed.has(n)) continue;
      claimed.set(n, id); phrases.push(n);
    }
    if (!phrases.length) { issues.push(`${where}: every phrase belongs to a more specific concept`); continue; }
    const tags = {};
    for (const [t, w] of Object.entries(c.tags || {})) {
      const v = num(w, -2, 2);
      if (!TAGS.has(t)) { issues.push(`${where}: unknown tag ${t}`); continue; }
      if (v) tags[t] = v;
    }
    const ings = {};
    for (const [i, w] of Object.entries(c.ings || {})) {
      if (!ing.has(i)) { issues.push(`${where}: unknown ingredient ${i}`); continue; }
      const v = num(w, 0, 3);
      if (v) ings[i] = v;
    }
    const avoid = (c.avoid || []).filter(i => ing.has(i) || (issues.push(`${where}: unknown avoid ${i}`), false));
    const style = {};
    for (const k of STYLE_NUM) { const v = num((c.style || {})[k], -2, 2); if (v) style[k] = v; }
    for (const k of STYLE_BOOL) if ((c.style || {})[k] === true) style[k] = true;
    const families = {};
    for (const [fam, w] of Object.entries(c.families || {})) {
      if (!famIds.has(fam)) { issues.push(`${where}: unknown family ${fam}`); continue; }
      const v = num(w, -3, 3);
      if (v) families[fam] = v;
    }
    const vessels = {};
    for (const [v, w] of Object.entries(c.vessels || {})) {
      if (!vesselIds.has(v)) { issues.push(`${where}: unknown vessel ${v}`); continue; }
      const x = num(w, -3, 3);
      if (x) vessels[v] = x;
    }
    const color = c.color ? COLOR[norm(c.color).split(' ')[0]] || null : null;
    if (c.color && !color && !['pale', 'tan', 'beige', 'amber-pale'].includes(norm(c.color))) issues.push(`${where}: unknown color ${c.color}`);
    const said = splitReading(c.reading);
    const rec = { id, phrases, domain: c.domain || '', reading: said.reading };
    const guidance = [c.guidance, said.guidance].filter(Boolean).join(' ');
    if (guidance) rec.guidance = guidance;
    if (Object.keys(tags).length) rec.tags = tags;
    if (Object.keys(ings).length) rec.ings = ings;
    if (avoid.length) rec.avoid = avoid;
    if (Object.keys(style).length) rec.style = style;
    if (color) rec.color = color;
    if (Object.keys(families).length) rec.families = families;
    if (Object.keys(vessels).length) rec.vessels = vessels;
    // The canonical drinks a concept points at (archetype ids; one another lane hasn't built yet
    // simply scores nothing).
    const archs = {};
    for (const [a, w] of Object.entries(c.archetypes || {})) { const v = num(w, -4, 4); if (v) archs[a] = v; if (!archIds.has(a)) issues.push(`${where}: archetype ${a} not built yet`); }
    if (Object.keys(archs).length) rec.archetypes = archs;
    if (c.specs && typeof c.specs === 'object') rec.specs = c.specs;
    const promise = [].concat(c.promise || []).map(pr => cleanPromise(pr, where)).filter(Boolean);
    if (c.promise !== undefined) rec.promise = promise;
    if ((c.garnish || []).length) rec.garnish = c.garnish.slice(0, 4);
    if ((c.nameWords || []).length) rec.nameWords = c.nameWords.filter(w => typeof w === 'string' && w.length <= 18 && keepWord(c.id, w)).slice(0, 8);
    if ((c.taglineWords || []).length) rec.taglineWords = c.taglineWords.filter(w => typeof w === 'string' && w.length <= 48 && keepWord(c.id, w)).slice(0, 4);
    concepts.push(rec);
  }
}
writeFileSync(out, '{\n  "about": "What a bartender hears in a prayer: phrases mapped to flavors, bottles, style, color, families, vessels, garnish, name and tagline words, with a reading said back to the guest. Compiled from research by scripts/concepts-build.mjs.",\n  "concepts": [\n' + concepts.map(c => '    ' + JSON.stringify(c)).join(',\n') + '\n  ]\n}\n');
const byDomain = {};
for (const c of concepts) byDomain[c.domain || '?'] = (byDomain[c.domain || '?'] || 0) + 1;
console.log(`${concepts.length} concepts, ${claimed.size} phrases → ${out}`);
console.log(Object.entries(byDomain).map(([d, n]) => `${d}:${n}`).join(' '));
if (issues.length) console.log(`${issues.length} issues:\n  ` + issues.slice(0, 60).join('\n  ') + (issues.length > 60 ? `\n  ... ${issues.length - 60} more` : ''));
