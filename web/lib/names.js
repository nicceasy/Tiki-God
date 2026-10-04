// Drink names. Leans on nautical, botanical, weather and rum-geography imagery rather than
// faux-Polynesian words — the modern tropical-bar convention, and it reads better anyway.
// Every word has to be true of the drink: a flavor needs a carrier, a color needs the look, a
// "Bowl" needs a bowl, a "Torch" needs a flame, "Smoldering" needs smoke in the glass, and a
// time of day or a culture's language appears only when the prayer brings it.

const ADJ = {
  smoky: ['Smoldering', 'Charred', 'Ember', 'Ashen'],
  'baking-spice': ['Spiced', 'Clove-Scented', 'Cinnamon', 'Spice-Route'],
  cinnamon: ['Cinnamon', 'Spice-Route'],
  allspice: ['Pimento', 'Spice-Route'],
  ginger: ['Gingered', 'Firebrand'],
  chili: ['Fire-Eater', 'Scorched', 'Red-Hot', 'Pepperpot'],
  coconut: ['Coconut', 'Palm-Shaded', 'Copra'],
  creamy: ['Velvet', 'Silken', 'Cloud'],
  honey: ['Honeyed', 'Golden'],
  vanilla: ['Vanilla', 'Moonlit'],
  tart: ['Salt-Spray', 'Bright', 'Sharp'],
  light: ['Breezy', 'Sunlit', 'Trade-Wind', 'Crystal'],
  boozy: ['Mutinous', 'Relentless', 'Dread', 'Iron', 'Last'],
  bitter: ['Crooked', 'Feral', 'Bitter'],
  funky: ['Rogue', 'Rum-Soaked', 'Wild'],
  grassy: ['Green-Cane', 'Canefield'],
  floral: ['Blooming', 'Perfumed', 'Orchid'],
  coffee: ['Midnight', 'Moonless'],
  chocolate: ['Midnight', 'Cacao'],
  herbal: ['Jungle', 'Overgrown'],
  mint: ['Green', 'Garden'],
  anise: ['Phantom', 'Absinthe-Tinged'],
  molasses: ['Blackstrap', 'Dark-Water'],
  'passion-fruit': ['Golden', 'Passion'],
  pineapple: ['Sun-Struck', 'Golden'],
  berry: ['Crimson', 'Bramble'],
  cherry: ['Scarlet', 'Ruby'],
  banana: ['Banana-Leaf', 'Banana-Boat'],
  mango: ['Monsoon', 'Sunset'],
  guava: ['Pink-Sand', 'Rosy'],
  orange: ['Sundown', 'Orange-Grove'],
  grapefruit: ['Sunrise', 'Pink'],
  warm: ['Fireside', 'Hearth'],
  effervescent: ['Sparkling', 'Bubbling'],
};
const COLOR_ADJ = { blue: ['Blue', 'Sapphire', 'Deep-Water'], red: ['Crimson', 'Scarlet', 'Red'], pink: ['Pink', 'Coral'], gold: ['Golden', 'Gilded'], dark: ['Black', 'Moonless'], green: ['Green', 'Jade'], purple: ['Violet', 'Dusk'] };

const NOUN = {
  sea: ['Reef', 'Lagoon', 'Riptide', 'Undertow', 'Castaway', 'Mariner', 'Corsair', 'Galleon', 'Anchor', 'Shipwreck', 'Tradewind', 'Maelstrom', 'Siren', 'Pearl', 'Conch', 'Coral', 'Harbor', 'Doldrums', 'Lighthouse'],
  weather: ['Monsoon', 'Squall', 'Typhoon', 'Tempest', 'Gale', 'Downpour', 'Eclipse', 'Heatwave', 'Waterspout'],
  jungle: ['Orchid', 'Hibiscus', 'Frangipani', 'Banyan', 'Mangrove', 'Canopy', 'Bamboo', 'Vine', 'Cane Field', 'Plantain'],
  creature: ['Serpent', 'Cobra', 'Viper', 'Parrot', 'Macaw', 'Toucan', 'Barracuda', 'Marlin', 'Manta', 'Jaguar', 'Gecko', 'Frigatebird', 'Flamingo', 'Moray'],
  adventure: ['Expedition', 'Voyage', 'Crossing', 'Outpost', 'Hideaway', 'Lookout', 'Compass', 'Relic', 'Doubloon', 'Lantern', 'Caldera', 'Spyglass', 'Treasure Map'],
  spooky: ['Specter', 'Phantom', 'Revenant', 'Ghost Ship', 'Wraith', 'Skull', 'Graveyard Shift'],
};

const PLACE_BY_ING = {
  'rum-demerara': ['Demerara', 'Georgetown', 'Essequibo'], 'rum-demerara-overproof': ['Demerara', 'Georgetown'],
  'rum-jamaican-aged': ['Port Royal', 'Kingston', 'Montego'], 'rum-jamaican-pot': ['Port Royal', 'Cockpit Country', 'Trelawny'],
  'rum-jamaican-dark': ['Kingston', 'Port Antonio'], 'rum-jamaican-white-overproof': ['Trelawny', 'Port Royal'],
  'rum-agricole-blanc': ['Martinique', 'Saint-Pierre'], 'rum-agricole-vieux': ['Martinique', 'Fort-de-France'],
  'rum-barbados': ['Bridgetown', 'Barbados'], 'rum-haitian': ['Port-au-Prince', 'Cap-Haïtien'],
  'rum-white-column': ['Havana', 'San Juan'], 'rum-gold-column': ['San Juan', 'Havana'], 'rum-aged-column': ['Havana', 'Santo Domingo'],
  'rum-navy': ['Tortola', 'Jost Van Dyke', 'Admiralty'], 'rum-black-blended': ['Bermuda', 'Hamilton Harbor'],
  'rum-cachaca': ['Paraty', 'Bahia'], 'tequila-blanco': ['Jalisco', 'Tequila'], 'tequila-reposado': ['Jalisco'],
  mezcal: ['Oaxaca', 'Santiago Matatlán'], bourbon: ['Kentucky', 'Bardstown'], rye: ['Monongahela'],
  gin: ['London Dock', 'Plymouth'], brandy: ['Cognac', 'Charente'], pisco: ['Lima', 'Ica'], aquavit: ['Bergen', 'Aalborg'],
  'batavia-arrack': ['Batavia', 'Java'], applejack: ['Jersey Shore'], 'scotch-blended': ['Speyside'], 'scotch-islay': ['Islay'],
};

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
const titleCase = w => w.split(/([ -])/).map(x => /^[a-z]/.test(x) && !['of', 'the', 'and', 'a', 'in', 'on', 'at'].includes(x) ? x[0].toUpperCase() + x.slice(1) : x).join('');

// Type nouns a drink may carry in its name without claiming to be a specific classic; each is
// checked against the build below (a Cup needs punch-cup service, a Toddy is a hot grog).
const TYPE_NOUN = {
  punch: ['Punch', 'Cup'], grog: ['Grog'], daiquiri: ['Daiquiri', 'Sour'], swizzle: ['Swizzle'], zombie: ['Revenant', 'Specter'],
  'beachcomber-sour': ['Sour', 'Cup'], 'mai-tai': ['Sour'], 'orgeat-punch': ['Punch', 'Bowl'], colada: ['Colada'],
  buck: ['Buck', 'Cooler', 'Highball'], 'resort-punch': ['Punch', 'Cooler'], 'bitter-tiki': ['Sour', 'Bird'], stirred: ['Nightcap', 'Sipper'], hot: ['Toddy', 'Mug', 'Nightcap'],
};
// Words that promise a color: used only if the drink in the glass shows it.
const IMPLIES_COLOR = {
  Scarlet: 'red', Ruby: 'red', Crimson: 'red', Red: 'red', 'Red-Hot': 'red', Pink: 'pink', 'Pink-Sand': 'pink', Rosy: 'pink', Coral: 'pink',
  Golden: 'gold', Gilded: 'gold', 'Sun-Struck': 'gold', Blue: 'blue', Sapphire: 'blue', 'Deep-Water': 'blue', Green: 'green', Jade: 'green',
  Violet: 'purple', Dusk: 'purple', Black: 'dark', Moonless: 'dark', Midnight: 'dark', 'Dark-Water': 'dark', Blackstrap: 'dark', Sunrise: 'orange', Sundown: 'orange', 'Orange-Grove': 'orange',
};
// Words that promise an ingredient: used only if it is poured.
const IMPLIES_ING = {
  Hibiscus: ['hibiscus-syrup'], Orchid: [], Plantain: ['banana', 'banana-liqueur'], 'Banana-Leaf': ['banana', 'banana-liqueur'], 'Banana-Boat': ['banana', 'banana-liqueur'],
  Marzipan: ['orgeat', 'amaretto'], Coquito: ['coconut-cream', 'coconut-milk'], Piña: ['pineapple-juice'], Colada: ['coconut-cream', 'coconut-milk'], Champagne: ['sparkling-wine'], Bubbly: ['sparkling-wine'], Fizz: ['sparkling-wine', 'soda-water', 'ginger-beer'], Banana: ['banana', 'banana-liqueur'], Coco: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'], Kava: ['kava'], Cacao: ['creme-de-cacao', 'white-creme-de-cacao', 'chocolate-liqueur', 'mole-bitters'], Coconut: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'],
  Copra: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'], Honeyed: ['honey-syrup', 'gardenia-mix'], Cinnamon: ['cinnamon-syrup', 'dons-mix', 'cinnamon', 'hot-buttered-rum-batter'],
  Pimento: ['allspice-dram'], Gingered: ['ginger-syrup', 'ginger-beer', 'ginger-liqueur', 'ginger-ale'], Vanilla: ['vanilla-syrup', 'vanilla-extract', 'vanilla-ice-cream'],
  'Cane Field': ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'], 'Green-Cane': ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'], Canefield: ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'],
  'Absinthe-Tinged': ['absinthe', 'pastis'], Bramble: ['blackberry-liqueur', 'raspberry-syrup', 'raspberry-liqueur'], Passion: ['passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola'],
  Sparkling: ['sparkling-wine', 'soda-water', 'tonic'], Bubbling: ['sparkling-wine', 'soda-water', 'ginger-beer', 'tonic'], Bubbles: ['sparkling-wine', 'soda-water', 'tonic'],
  Mule: ['ginger-beer'], Salt: ['saline', 'li-hing-mui-syrup'], 'Salt-Spray': ['saline', 'li-hing-mui-syrup'],
  Smoldering: ['mezcal', 'scotch-islay', 'lapsang-tea'], Charred: ['mezcal', 'scotch-islay', 'lapsang-tea'], Ashen: ['mezcal', 'scotch-islay', 'lapsang-tea'],
  Smoke: ['mezcal', 'scotch-islay', 'lapsang-tea'], Smoky: ['mezcal', 'scotch-islay', 'lapsang-tea'], Peat: ['scotch-islay'],
  'ʻŌhelo': ['cranberry-juice', 'raspberry-syrup', 'raspberry-liqueur', 'blackberry-liqueur', 'creme-de-cassis', 'strawberry'],
  Ohelo: ['cranberry-juice', 'raspberry-syrup', 'raspberry-liqueur', 'blackberry-liqueur', 'creme-de-cassis', 'strawberry'],
};
// Never in a name: sacred figures, colonial and caricature terms modern tiki has left behind,
// brand names (a bottle on the shelf is not a name), and stereotypes ("Smoke Signal").
// Hawaiian and other Polynesian words used as decoration (makuakāne, hoʻomaikaʻi) are out; a
// word carrying an ʻokina or kahakō, or a known Hawaiian word, is allowed only when the prayer
// itself is about Hawaiʻi or Polynesia. Hawaiian words often arrive spelled with plain
// apostrophes for the ʻokina (Ho'olaule'a). The Mai Tai's own phrase stays for its history line.
export const POLY = /[ʻ]|[a-z]'[aeiou][a-z]*'[aeiou]|\b(ho'?olaule'?a|hula|lu'?au|kama'?aina|makuakane|hoomaikai|ho'omaika'i|keiki|tutu|kupuna|lani|nani|wikiwiki|pau|hauoli|mele|kalikimaka|lūʻau|luau|haole|kanaka|menehune|ono|pupule)\b/i;
export const HAWAIIAN = /[āēīōūĀĒĪŌŪʻ]|\b(lanai|luau|hula|aloha|kahuna|mele|hana hou|huli huli|kalua|malama|ho'?omaha|kaumaha|waikiki|ohana|makai|lilikoi|hanalei|haleiwa|lanikai|menehune|maita'?i|roa a'?e|pahoehoe|ohelo|kilauea|wailua|kahala|iolani|nalu|he'?e|pikake|maile|ipu|hoku|motu|bula|tiare|papeete|moorea|matavai|teahupoo|kaua'?i|kauai|honolulu|oahu|o'ahu|molokai|vog|ali'?i|danno|kona|lei)\b/i;
const BANNED = /\b(pele|ku|kū|lono|kane|kāne|kanaloa|maui|māui|kahuna|moai|tiki|ohana|ʻohana|aloha|mahalo|savage|cannibal|headhunter|witch ?doctor|native|plantation|planter|voodoo|hoodoo|wahine|hula|island girl|dusky|coolie|oriental|geisha|shanghai'?d|kapu|tapu|mana|idol|tribal|primitive|heathen|squaw|shrunken|tsantsa|conquistador|colonial|missionary|overseer|samoan|tahitian|maori|chief|bongo|ooga|booga|jungle princess|smoke[- ]signal|kraken|gosling'?s?|pusser'?s?|bacardi|malibu|midori|kahl[uú]a|coco l[oó]pez|tia maria|hampden|appleton|myers'?s?|captain morgan|sailor jerry|lemon hart|planteray|don q|mount gay|ting|dole|tangerine|irie|ya+h? mon|jah|rasta|wah gwaan)\b/i;
// Places only for spirits with a strong sense of place (a light column rum is from anywhere).
const PLACE_OK = new Set(['rum-demerara', 'rum-demerara-overproof', 'rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-dark', 'rum-jamaican-white-overproof', 'rum-agricole-blanc', 'rum-agricole-vieux', 'rum-barbados', 'rum-haitian', 'rum-navy', 'rum-black-blended', 'rum-cachaca', 'mezcal', 'tequila-blanco', 'tequila-reposado', 'pisco', 'aquavit', 'batavia-arrack', 'scotch-islay']);

// Concepts whose prayer is about Hawaiʻi or Polynesia, where its words belong.
export const POLYNESIAN_CONCEPTS = new Set(['hawaii', 'royal-hawaiian', 'kona', 'luau', 'tahiti', 'polynesia', 'fiji', 'samoa', 'tonga', 'rapa-nui', 'new-zealand', 'elvis', 'lilo-and-stitch', 'hawaii-five-o', 'magnum-pi', 'duke', 'tiny-bubbles', 'arthur-lyman', 'pele', 'ku', 'lono', 'kanaloa', 'kane', 'laka-hula', 'maui-demigod', 'lei', 'wayfinding', 'moana', 'kava', 'brady-bunch-hawaii', 'surfing', 'dawn-patrol', 'ukulele']);
const POLY_PRAYER = /hawai|polynes|tahit|samoa|fiji|tonga|waikiki|honolulu|\bmaui\b|kauai|oahu|luau|lu'au|aloha|moana|aotearoa|maori|bora bora|moorea/i;
export const polynesianPrayer = (prayer = '', concepts = []) => POLY_PRAYER.test(prayer) || concepts.some(c => POLYNESIAN_CONCEPTS.has(c));
// Culture-specific language: Hawaiian or other Polynesian words only on a Polynesian prayer.
export const cultureOk = (text, polynesian) => polynesian || !(HAWAIIAN.test(text) || POLY.test(text));

// Time of day: a sunrise, a sunset, midnight or an afternoon is said only when the prayer's
// time says so (no "Sundown" on a sunrise, no "Midnight" on a brunch).
export const TIME_WORDS = {
  dawn: /\b(sunrise|dawn|daybreak|morning|first light|brunch|breakfast)\b/i,
  dusk: /\b(sunset|sundown|dusk|twilight|evening|golden hour)\b/i,
  night: /\b(night|nights|midnight|moonlit|moonless|moonlight|moon|nightcap|late show|after dark|starlight|starlit)\b/i,
  noon: /\b(noon|afternoon|siesta|lunch|brunch|hottest hour)\b/i,
};
export function timeOk(text, prayer = '') {
  for (const re of Object.values(TIME_WORDS)) if (re.test(text) && !re.test(prayer)) return false;
  return true;
}

// Name words that make a promise about the build, each with what the drink must have.
const NAME_TRUTH = [
  [/\bSpritz\b/i, f => f.has('sparkling-wine') || (f.has('aperol', 'campari', 'lillet-blanc', 'dry-vermouth', 'sweet-vermouth', 'white-wine', 'sake') && f.has('soda-water', 'tonic', 'grapefruit-soda'))],
  [/\b(Volcano|Crater|Caldera|Eruption)\b/i, f => f.vessel === 'volcano-bowl' || f.flaming],
  [/\bLava\b/i, f => f.vessel === 'volcano-bowl' || f.flaming || (f.archetype === 'fruit-colada' && f.has('strawberry'))],
  [/\bBowl\b/i, f => f.bowl],
  [/\b(Torch|Torchlight|Blaze|Bonfire|Inferno|Flame|Flaming|Fire Fountain|Fire Knife)\b/i, f => f.flaming],
  [/\bEmber\b/i, f => f.flaming || f.smoky],
  [/\bCup\b/i, f => f.vessel === 'punch-bowl'],
  [/\bPunch\b/i, f => f.method !== 'stir'],
  [/\bBlackstrap\b/i, f => !!f.blackBase],
  [/\bMug\b/i, f => /mug/.test(f.vessel || '')],
  [/\bToddy\b/i, f => f.archetype === 'hot-grog'],
  [/\bGrog\b/i, f => f.family === 'grog' || f.archetype === 'hot-grog' || f.has('coffee') && f.hot],
  [/\bSwizzle\b/i, f => f.method === 'swizzle'],
  [/\bFrapp[ée]\b/i, f => f.method === 'blend'],
  [/\b(Highball|Cooler)\b/i, f => f.fizzy && !f.creamy],
  [/\bColada\b/i, f => f.has('coconut-cream', 'coconut-milk') && f.has('pineapple-juice')],
  [/\bNightcap\b/i, f => f.method === 'stir' || f.hot],
  [/\b(Papa|Hemingway)\b/i, f => f.archetype === 'hemingway-daiquiri' || /hemingway|papa/i.test(f.prayer)],
  // Constante Ribalaigua died in 1952: no later year in the prayer can be his.
  [/\bConstante\b/i, f => f.who === 'Constantino Ribalaigua' && !(Number((String(f.prayer).match(/\b(1[89]\d\d|20\d\d)/) || [])[1]) > 1952)],
];
// Count words the way a guest says them: "Dog-Eared" is two.
export const wordCount = name => name.split(/[\s-]+/).filter(Boolean).length;

// Names come from the prayer first (its imagery words), then from what is really in the glass:
// flavor words only for flavors that lead an ingredient in the drink, color words only for colors
// the drink shows, places only for spirits with a sense of place. A classic's name appears only
// when the drink is a riff on that classic, led by the word for what changed.
// `facts` (all optional) describe the finished build for the truth checks above: vessel id,
// whether it is a bowl or lit, its method, archetype and family, the prayer's text and concepts,
// the classics' names it must not borrow, and the base spirit a riff changed.
export function makeName(rng, { variant = 0, archetype = null, family, intent = {}, flavorTags = [], askedTags = [], changeTags = [], color = null, shows = () => true, poured = new Set(), baseIds = [], riffOf = null, mood = null, taken = new Set(), facts = {} }) {
  const prayer = facts.prayer || intent.raw || '';
  const polynesian = polynesianPrayer(prayer, intent.concepts || []);
  const has = (...ids) => ids.some(id => poured.has(id));
  const f = { has, prayer, ...facts, archetype: archetype ? archetype.id : null, family };
  // A classic's name belongs to that classic: "Jet Pilot" on a colada is a lie.
  const classics = facts.classicNames || [];
  const ownClassic = nm => riffOf && nm.toLowerCase() === riffOf.toLowerCase() || (archetype && [archetype.name, ...(archetype.classics || [])].some(c => c.toLowerCase().replace(/\s*\(.*\)/, '') === nm.toLowerCase()));
  const borrows = w => classics.some(c => c.length >= 6 && new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(w) && !ownClassic(c));
  const allowed = w => {
    if (!w || BANNED.test(w) || !cultureOk(w, polynesian) || !timeOk(w, prayer) || borrows(w)) return false;
    const c = IMPLIES_COLOR[w.split(' ')[0]] || IMPLIES_COLOR[w];
    if (c && !shows(c)) return false;
    for (const part of [w, ...w.split(/\s+/)]) {
      const need = IMPLIES_ING[part];
      if (need && need.length && !need.some(id => poured.has(id))) return false;
    }
    if (NAME_TRUTH.some(([re, ok]) => re.test(w) && !ok(f))) return false;
    return true;
  };
  const prayerWords = [...new Set((intent.nameWords || []).filter(w => w && w.length <= 18).map(titleCase))].filter(allowed);
  const adjFor = tags => tags.flatMap(t => ADJ[t] || []).filter(allowed);
  const asked = adjFor(askedTags);
  const changed = adjFor(changeTags);
  const adjPool = [...new Set([...(color && COLOR_ADJ[color] ? COLOR_ADJ[color].filter(allowed) : []), ...asked, ...adjFor(flavorTags.slice(0, 4))])];
  if (!adjPool.length) adjPool.push(...['Hidden', 'Southern', 'Lucky', 'Long-Lost', 'Wayward'].filter(allowed));
  const nounThemes = mood === 'spooky' || family === 'zombie' ? ['spooky', 'adventure', 'weather']
    : family === 'bitter-tiki' ? ['creature', 'jungle']
      : family === 'grog' || family === 'punch' ? ['sea', 'weather', 'adventure']
        : family === 'hot' ? ['adventure', 'weather']
          : ['sea', 'jungle', 'creature', 'weather', 'adventure'];
  const nounPool = nounThemes.flatMap(t => NOUN[t]).filter(allowed);
  const places = baseIds.filter(id => PLACE_OK.has(id)).flatMap(id => PLACE_BY_ING[id] || []).filter(allowed);
  // An archetype's name nouns, minus any that are a classic's own name ("Lava Flow", "Hurricane").
  const ownNouns = ((archetype && archetype.nameNouns) || []).filter(w => allowed(w) && !taken.has(w.toLowerCase()) && !(archetype.classics || []).some(c => c.toLowerCase().startsWith(w.toLowerCase())));
  let typeNoun = ownNouns.length ? ownNouns : (TYPE_NOUN[family] || ['Punch']).filter(allowed);
  if (!typeNoun.length) typeNoun = ['Punch', 'Sour', 'Cooler'].filter(allowed);
  if (!typeNoun.length) typeNoun = ['Sour'];
  const isNoun = w => /^(the |la |el )?[A-Z]/.test(w) && !/(ed|y|ish|ing)$/.test(w.split(' ').pop().toLowerCase());

  const options = [];
  if (riffOf) {
    // "Bourbon Navy Grog", "Ember Mai Tai": the riff's name says what changed, and never
    // repeats the classic's own words in the modifier ("Rum-Soaked Hot Buttered Rum").
    const riffWords = new Set(riffOf.toLowerCase().split(/[\s-]+/));
    const fresh = w => !w.toLowerCase().split(/[\s-]+/).some(x => riffWords.has(x));
    const spirit = facts.riffSpirit && allowed(facts.riffSpirit) && fresh(facts.riffSpirit) ? facts.riffSpirit : null;
    const pool = [changed, asked, adjPool].map(p => p.filter(fresh)).find(p => p.length) || ['House'];
    const lead = spirit || prayerWords.find(w => !isNoun(w) && fresh(w)) || pick(rng, pool);
    options.push(`${lead} ${riffOf}`);
  }
  if (prayerWords.length) {
    const w = prayerWords[Math.floor(rng() * Math.min(3, prayerWords.length))];
    const w2 = prayerWords.find(x => x !== w);
    if (w2) options.push(isNoun(w2) && !isNoun(w) ? `${w} ${w2}` : isNoun(w) && !isNoun(w2) ? `${w2} ${w}` : `${w} ${pick(rng, typeNoun)}`);
    if (nounPool.length || asked.length || adjPool.length) options.push(isNoun(w) ? `${pick(rng, asked.length ? asked : adjPool)} ${w}` : `${w} ${pick(rng, nounPool)}`);
    options.push(`${w} ${pick(rng, typeNoun)}`);
  }
  if (asked.length) options.push(`${pick(rng, asked)} ${pick(rng, nounPool)}`);
  options.push(`${pick(rng, adjPool)} ${pick(rng, nounPool)}`, `${pick(rng, nounPool)} ${pick(rng, typeNoun)}`);
  if (places.length) options.push(`${pick(rng, nounPool)} of ${pick(rng, places)}`, `${pick(rng, places)} ${pick(rng, typeNoun)}`);
  // A repeat prayer gets a different name, not the same one again.
  for (let i = options.length - 1; i >= 0; i--) if (options.indexOf(options[i]) < i) options.splice(i, 1);
  // Each repeat takes the next option without wrapping back to an earlier seed's name.
  const ordered = variant ? [...options.slice(Math.min(variant, options.length)), ...[0, 1, 2, 3, 4, 5].map(() => `${pick(rng, adjPool)} ${pick(rng, nounPool)}`)] : [...options, ...[0, 1, 2, 3].map(() => `${pick(rng, adjPool)} ${pick(rng, nounPool)}`)];
  for (const name0 of ordered) {
    let name = name0.replace(/\b(\w+)\s+\1\b/i, '$1').replace(/\bundefined\b/g, '').replace(/\s+/g, ' ').trim();
    const parts = name.split(' ');
    if (parts.length < 2 && !riffOf) continue;
    // "Frigatebird Bird": a word that ends with the next one is a stutter.
    if (parts.some((p, i) => i < parts.length - 1 && p.toLowerCase().endsWith(parts[i + 1].toLowerCase()))) continue;
    // Four words at most, said the way a guest says them.
    if (wordCount(name) > 4) continue;
    if (!allowed(name)) continue;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${pick(rng, adjPool) || 'Lucky'} ${pick(rng, nounPool) || 'Lagoon'} No. ${Math.floor(rng() * 90) + 10}`;
}

// The ʻokina and kahakō, written properly wherever a Hawaiian or Tahitian word reaches the card
// (and plain apostrophes from the research turned into the ʻokina they stand for).
const DIACRITICS = [
  [/\bHo'olaule'a\b/g, 'Hoʻolauleʻa'], [/\bHo'omaika'i\b/g, 'Hoʻomaikaʻi'], [/\bHo'omaha\b/g, 'Hoʻomaha'], [/\b([Mm])aita'i roa ae\b/g, '$1aitaʻi roa aʻe'],
  [/\b([Mm])aita'i\b/g, '$1aitaʻi'], [/\b([Rr])oa [Aa]e\b/g, (m, r) => `${r}oa ${r === 'R' ? 'Aʻe' : 'aʻe'}`], [/\bKaua'i\b/g, 'Kauaʻi'], [/\b([Ll])u'au\b/g, '$1ūʻau'], [/\bHawai'i\b/g, 'Hawaiʻi'],
  [/\bWaikiki\b/g, 'Waikīkī'], [/\b([Ll])ilikoi\b/g, '$1ilikoʻi'], [/\bAli'i\b/g, 'Aliʻi'], [/\bHe'e\b/g, 'Heʻe'], [/\bO'ahu\b/g, 'Oʻahu'], [/'Ohana\b/g, 'ʻOhana'],
  [/\bPahoehoe\b/g, 'Pāhoehoe'], [/\bKilauea\b/g, 'Kīlauea'], [/\bPikake\b/g, 'Pīkake'],
];
export function polishPolynesian(text) {
  let s = String(text || '');
  for (const [re, to] of DIACRITICS) s = s.replace(re, to);
  return s;
}
