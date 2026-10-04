// Drink names. Leans on nautical, botanical, weather and rum-geography imagery rather than
// faux-Polynesian words — the modern tropical-bar convention, and it reads better anyway.

const ADJ = {
  smoky: ['Smoldering', 'Charred', 'Ember', 'Ashen', 'Smoke-Signal'],
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
  orange: ['Sundown', 'Tangerine'],
  grapefruit: ['Sunrise', 'Pink'],
  warm: ['Fireside', 'Hearth'],
  effervescent: ['Sparkling', 'Bubbling'],
};
const COLOR_ADJ = { blue: ['Blue', 'Sapphire', 'Deep-Water'], red: ['Crimson', 'Scarlet', 'Red'], pink: ['Pink', 'Coral'], gold: ['Golden', 'Gilded'], dark: ['Black', 'Moonless'], green: ['Green', 'Jade'], purple: ['Violet', 'Dusk'] };

const NOUN = {
  sea: ['Reef', 'Lagoon', 'Riptide', 'Undertow', 'Castaway', 'Mariner', 'Corsair', 'Galleon', 'Anchor', 'Shipwreck', 'Tradewind', 'Maelstrom', 'Kraken', 'Siren', 'Pearl', 'Conch', 'Coral', 'Harbor', 'Doldrums', 'Lighthouse'],
  weather: ['Monsoon', 'Squall', 'Typhoon', 'Tempest', 'Gale', 'Downpour', 'Sundown', 'Eclipse', 'Heatwave', 'Waterspout'],
  jungle: ['Orchid', 'Hibiscus', 'Frangipani', 'Banyan', 'Mangrove', 'Canopy', 'Bamboo', 'Vine', 'Cane Field', 'Plantain'],
  creature: ['Serpent', 'Cobra', 'Viper', 'Parrot', 'Macaw', 'Toucan', 'Barracuda', 'Marlin', 'Manta', 'Jaguar', 'Gecko', 'Frigatebird', 'Flamingo', 'Moray'],
  adventure: ['Expedition', 'Voyage', 'Crossing', 'Outpost', 'Hideaway', 'Lookout', 'Compass', 'Relic', 'Doubloon', 'Lantern', 'Torch', 'Caldera', 'Spyglass', 'Treasure Map'],
  spooky: ['Specter', 'Phantom', 'Revenant', 'Ghost Ship', 'Wraith', 'Skull', 'Graveyard Shift'],
};

const FAMILY_NOUN = {
  punch: ['Punch', "Planter's Punch"], grog: ['Grog'], daiquiri: ['Daiquiri', 'Sour'], swizzle: ['Swizzle'],
  zombie: ['Revenant', 'Zombie', 'Specter'], 'beachcomber-sour': ['Sour', 'Cup'], 'mai-tai': ['Mai Tai'],
  'orgeat-punch': ['Bowl', 'Fog Cutter', 'Punch'], colada: ['Colada', 'Cooler'], buck: ['Buck', 'Cooler', 'Highball'],
  'resort-punch': ['Punch', 'Cooler'], 'bitter-tiki': ['Bird', 'Sour'], stirred: ['Old Fashioned', 'Nightcap'], hot: ['Toddy', 'Grog', 'Mug'],
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

// Type nouns a drink may carry in its name without claiming to be a specific classic.
const TYPE_NOUN = {
  punch: ['Punch', 'Cup'], grog: ['Grog'], daiquiri: ['Daiquiri', 'Sour'], swizzle: ['Swizzle'], zombie: ['Revenant', 'Specter'],
  'beachcomber-sour': ['Cup', 'Sour'], 'mai-tai': ['Cooler', 'Cup'], 'orgeat-punch': ['Punch', 'Bowl'], colada: ['Colada'],
  buck: ['Buck', 'Cooler', 'Highball'], 'resort-punch': ['Punch', 'Cooler'], 'bitter-tiki': ['Sour', 'Bird'], stirred: ['Nightcap'], hot: ['Toddy', 'Mug'],
};
// Words that promise a color: used only if the drink in the glass shows it.
const IMPLIES_COLOR = {
  Scarlet: 'red', Ruby: 'red', Crimson: 'red', Red: 'red', 'Red-Hot': 'red', Pink: 'pink', 'Pink-Sand': 'pink', Rosy: 'pink', Coral: 'pink',
  Golden: 'gold', Gilded: 'gold', 'Sun-Struck': 'gold', Blue: 'blue', Sapphire: 'blue', 'Deep-Water': 'blue', Green: 'green', Jade: 'green',
  Violet: 'purple', Dusk: 'purple', Black: 'dark', Moonless: 'dark', Midnight: 'dark', 'Dark-Water': 'dark', Blackstrap: 'dark', Sunrise: 'orange', Sundown: 'orange', Tangerine: 'orange',
};
// Words that promise an ingredient: used only if it is poured.
const IMPLIES_ING = {
  Hibiscus: ['hibiscus-syrup'], Orchid: [], Plantain: ['banana', 'banana-liqueur'], 'Banana-Leaf': ['banana', 'banana-liqueur'], 'Banana-Boat': ['banana', 'banana-liqueur'],
  Marzipan: ['orgeat', 'amaretto'], Coquito: ['coconut-cream', 'coconut-milk'], Piña: ['pineapple-juice'], Colada: ['coconut-cream', 'coconut-milk'], Champagne: ['sparkling-wine'], Bubbly: ['sparkling-wine'], Fizz: ['sparkling-wine', 'soda-water', 'ginger-beer'], Banana: ['banana', 'banana-liqueur'], Coco: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'], Kava: ['kava'], Cacao: ['creme-de-cacao', 'chocolate-liqueur', 'mole-bitters'], Coconut: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'],
  Copra: ['coconut-cream', 'coconut-milk', 'coconut-rum', 'coconut-water'], Honeyed: ['honey-syrup', 'gardenia-mix'], Cinnamon: ['cinnamon-syrup', 'dons-mix', 'cinnamon', 'hot-buttered-rum-batter'],
  Pimento: ['allspice-dram'], Gingered: ['ginger-syrup', 'ginger-beer', 'ginger-liqueur', 'ginger-ale'], Vanilla: ['vanilla-syrup', 'vanilla-extract', 'vanilla-ice-cream'],
  'Cane Field': ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'], 'Green-Cane': ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'], Canefield: ['rum-agricole-blanc', 'rum-agricole-vieux', 'rum-cachaca'],
  'Absinthe-Tinged': ['absinthe', 'pastis'], Bramble: ['blackberry-liqueur', 'raspberry-syrup', 'raspberry-liqueur'], Passion: ['passion-fruit-syrup', 'passion-fruit-juice', 'passion-fruit-nectar', 'passion-fruit-liqueur'],
  Sparkling: ['sparkling-wine', 'soda-water', 'tonic'], Bubbling: ['sparkling-wine', 'soda-water', 'ginger-beer', 'tonic'],
};
// Never in a name: sacred figures, colonial and caricature terms modern tiki has left behind.
// Hawaiian and other Polynesian words used as decoration (makuakāne, hoʻomaikaʻi) are out;
// a word carrying an ʻokina is treated the same way. The Mai Tai's own phrase stays for its riffs.
// Hawaiian words often arrive spelled with plain apostrophes for the ʻokina (Ho'olaule'a).
export const POLY = /[ʻ]|[a-z]'[aeiou][a-z]*'[aeiou]|\b(ho'?olaule'?a|hula|lu'?au|kama'?aina|makuakane|hoomaikai|ho'omaika'i|keiki|tutu|kupuna|lani|nani|wikiwiki|pau|hauoli|mele|kalikimaka|lūʻau|luau|haole|kanaka|menehune|ono|pupule)\b/i;
const BANNED = /\b(pele|ku|kū|lono|kane|kāne|kanaloa|maui|māui|kahuna|moai|tiki|ohana|ʻohana|aloha|mahalo|savage|cannibal|headhunter|witch ?doctor|native|plantation|planter|voodoo|hoodoo|wahine|hula|island girl|dusky|coolie|oriental|geisha|shanghai'?d|kapu|tapu|mana|idol|tribal|primitive|heathen|squaw|shrunken|tsantsa|conquistador|colonial|missionary|overseer|samoan|tahitian|maori|chief|bongo|ooga|booga|jungle princess)\b/i;
// Places only for spirits with a strong sense of place (a light column rum is from anywhere).
const PLACE_OK = new Set(['rum-demerara', 'rum-demerara-overproof', 'rum-jamaican-aged', 'rum-jamaican-pot', 'rum-jamaican-dark', 'rum-jamaican-white-overproof', 'rum-agricole-blanc', 'rum-agricole-vieux', 'rum-barbados', 'rum-haitian', 'rum-navy', 'rum-black-blended', 'rum-cachaca', 'mezcal', 'tequila-blanco', 'tequila-reposado', 'pisco', 'aquavit', 'batavia-arrack', 'scotch-islay']);

// Names come from the prayer first (its imagery words), then from what is really in the glass:
// flavor words only for flavors that lead an ingredient in the drink, color words only for colors
// the drink shows, places only for spirits with a sense of place. A classic's name appears only
// when the drink is a riff on that classic, led by the word for what changed.
export function makeName(rng, { variant = 0, archetype = null, family, intent = {}, flavorTags = [], askedTags = [], changeTags = [], color = null, shows = () => true, poured = new Set(), baseIds = [], riffOf = null, mood = null, taken = new Set() }) {
  const allowed = w => {
    if (!w || BANNED.test(w) || POLY.test(w)) return false;
    const c = IMPLIES_COLOR[w.split(' ')[0]] || IMPLIES_COLOR[w];
    if (c && !shows(c)) return false;
    const need = IMPLIES_ING[w] || IMPLIES_ING[w.split(' ')[0]];
    if (need && need.length && !need.some(id => poured.has(id))) return false;
    return true;
  };
  const prayerWords = [...new Set((intent.nameWords || []).filter(w => w && w.length <= 18).map(titleCase))].filter(allowed);
  const adjFor = tags => tags.flatMap(t => ADJ[t] || []).filter(allowed);
  const asked = adjFor(askedTags);
  const changed = adjFor(changeTags);
  const adjPool = [...new Set([...(color && COLOR_ADJ[color] ? COLOR_ADJ[color].filter(allowed) : []), ...asked, ...adjFor(flavorTags.slice(0, 4))])];
  if (!adjPool.length) adjPool.push('Hidden', 'Southern', 'Last', 'Lucky', 'Long-Lost');
  const nounThemes = mood === 'spooky' || family === 'zombie' ? ['spooky', 'adventure', 'weather']
    : family === 'bitter-tiki' ? ['creature', 'jungle']
      : family === 'grog' || family === 'punch' ? ['sea', 'weather', 'adventure']
        : family === 'hot' ? ['adventure', 'weather']
          : ['sea', 'jungle', 'creature', 'weather', 'adventure'];
  const nounPool = nounThemes.flatMap(t => NOUN[t]).filter(allowed);
  const places = baseIds.filter(id => PLACE_OK.has(id)).flatMap(id => PLACE_BY_ING[id] || []);
  // An archetype's name nouns, minus any that are a classic's own name ("Lava Flow", "Hurricane").
  const ownNouns = ((archetype && archetype.nameNouns) || []).filter(w => allowed(w) && !taken.has(w.toLowerCase()) && !(archetype.classics || []).some(c => c.toLowerCase().startsWith(w.toLowerCase())));
  const typeNoun = ownNouns.length ? ownNouns : TYPE_NOUN[family] || ['Punch'];
  const isNoun = w => /^(the |la |el )?[A-Z]/.test(w) && !/(ed|y|ish|ing)$/.test(w.split(' ').pop().toLowerCase());

  const options = [];
  if (riffOf) {
    // "Ember Mai Tai": the riff's name says what changed.
    const lead = prayerWords.find(w => !isNoun(w)) || pick(rng, changed.length ? changed : asked.length ? asked : adjPool);
    options.push(`${lead} ${riffOf}`);
  }
  if (prayerWords.length) {
    const w = prayerWords[Math.floor(rng() * Math.min(3, prayerWords.length))];
    const w2 = prayerWords.find(x => x !== w);
    if (w2) options.push(isNoun(w2) && !isNoun(w) ? `${w} ${w2}` : isNoun(w) && !isNoun(w2) ? `${w2} ${w}` : `${w} ${pick(rng, typeNoun)}`);
    options.push(isNoun(w) ? `${pick(rng, asked.length ? asked : adjPool)} ${w}` : `${w} ${pick(rng, nounPool)}`);
    options.push(`${w} ${pick(rng, typeNoun)}`);
  }
  if (asked.length) options.push(`${pick(rng, asked)} ${pick(rng, nounPool)}`);
  options.push(`${pick(rng, adjPool)} ${pick(rng, nounPool)}`, `${pick(rng, nounPool)} ${pick(rng, typeNoun)}`);
  if (places.length) options.push(`${pick(rng, nounPool)} of ${pick(rng, places)}`, `${pick(rng, places)} ${pick(rng, typeNoun)}`);
  // A repeat prayer gets a different name, not the same one again.
  const ordered = variant ? [...options.slice(variant % options.length), ...options.slice(0, variant % options.length)] : options;
  for (const name0 of ordered) {
    let name = name0.replace(/\b(\w+)\s+\1\b/i, '$1').replace(/\s+/g, ' ').trim();
    const parts = name.split(' ');
    // "Frigatebird Bird": a word that ends with the next one is a stutter.
    if (parts.some((p, i) => i < parts.length - 1 && p.toLowerCase().endsWith(parts[i + 1].toLowerCase()))) continue;
    if (BANNED.test(name) || POLY.test(name)) continue;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${pick(rng, adjPool)} ${pick(rng, nounPool)} No. ${Math.floor(rng() * 90) + 10}`;
}
