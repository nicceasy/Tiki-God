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
  banana: ['Plantation', 'Banana-Boat'],
  mango: ['Monsoon', 'Sunset'],
  guava: ['Pink-Sand', 'Rosy'],
  orange: ['Sundown', 'Tangerine'],
  grapefruit: ['Sunrise', 'Pink'],
  almond: ['Marzipan', 'Orchard'],
  warm: ['Fireside', 'Hearth'],
  effervescent: ['Sparkling', 'Bubbling'],
};
const COLOR_ADJ = { blue: ['Blue', 'Sapphire', 'Deep-Water'], red: ['Crimson', 'Scarlet', 'Red'], pink: ['Pink', 'Coral'], gold: ['Golden', 'Gilded'], dark: ['Black', 'Moonless'], green: ['Green', 'Jade'], purple: ['Violet', 'Dusk'] };

const NOUN = {
  sea: ['Reef', 'Lagoon', 'Riptide', 'Undertow', 'Castaway', 'Mariner', 'Corsair', 'Galleon', 'Anchor', 'Shipwreck', 'Tradewind', 'Maelstrom', 'Kraken', 'Siren', 'Pearl', 'Conch', 'Coral', 'Harbor', 'Doldrums', 'Lighthouse'],
  weather: ['Monsoon', 'Squall', 'Typhoon', 'Tempest', 'Gale', 'Downpour', 'Sundown', 'Eclipse', 'Heatwave', 'Waterspout'],
  jungle: ['Orchid', 'Hibiscus', 'Frangipani', 'Banyan', 'Mangrove', 'Canopy', 'Bamboo', 'Vine', 'Cane Field', 'Plantain'],
  creature: ['Serpent', 'Cobra', 'Viper', 'Parrot', 'Macaw', 'Toucan', 'Barracuda', 'Marlin', 'Manta', 'Jaguar', 'Gecko', 'Frigatebird', 'Flamingo', 'Moray'],
  adventure: ['Expedition', 'Voyage', 'Crossing', 'Outpost', 'Hideaway', 'Lookout', 'Compass', 'Idol', 'Relic', 'Doubloon', 'Lantern', 'Torch', 'Caldera', 'Spyglass', 'Treasure Map'],
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

export function makeName(rng, { family, flavorTags = [], color = null, baseIds = [], mood = null, taken = new Set() }) {
  const adjPool = [];
  if (color && COLOR_ADJ[color]) adjPool.push(...COLOR_ADJ[color], ...COLOR_ADJ[color]);
  for (const t of flavorTags.slice(0, 4)) if (ADJ[t]) adjPool.push(...ADJ[t]);
  if (!adjPool.length) adjPool.push('Lost', 'Hidden', 'Secret', 'Southern', 'Last');

  const nounThemes = mood === 'spooky' || family === 'zombie' ? ['spooky', 'adventure', 'weather']
    : family === 'bitter-tiki' ? ['creature', 'jungle']
      : family === 'grog' || family === 'punch' ? ['sea', 'weather', 'adventure']
        : family === 'hot' ? ['adventure', 'weather']
          : ['sea', 'jungle', 'creature', 'weather', 'adventure'];
  const nounPool = nounThemes.flatMap(t => NOUN[t]);
  const places = baseIds.flatMap(id => PLACE_BY_ING[id] || []);
  const famNoun = FAMILY_NOUN[family] || ['Punch'];

  for (let attempt = 0; attempt < 12; attempt++) {
    const r = rng();
    let name;
    if (r < 0.3) name = `${pick(rng, adjPool)} ${pick(rng, nounPool)}`;
    else if (r < 0.5) name = `${pick(rng, nounPool)} ${pick(rng, famNoun)}`;
    else if (r < 0.68 && places.length) name = `${pick(rng, places)} ${pick(rng, nounPool)}`;
    else if (r < 0.8 && places.length) name = `${pick(rng, nounPool)} of ${pick(rng, places)}`;
    else if (r < 0.9) name = `The ${pick(rng, nounPool)}'s ${pick(rng, NOUN.adventure)}`;
    else name = `${pick(rng, adjPool)} ${pick(rng, famNoun)}`;
    name = name.replace(/\b(\w+)\s+\1\b/i, '$1');
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${pick(rng, adjPool)} ${pick(rng, nounPool)} No. ${Math.floor(rng() * 90) + 10}`;
}
