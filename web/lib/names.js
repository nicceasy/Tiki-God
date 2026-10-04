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
const titleCase = w => w.split(/([ -])/).map(x => /^[a-z]/.test(x) && !['of', 'the', 'and', 'a', 'in', 'on', 'at'].includes(x) ? x[0].toUpperCase() + x.slice(1) : x).join('');

// Type nouns a drink may carry in its name without claiming to be a specific classic.
const TYPE_NOUN = {
  punch: ['Punch', 'Cup'], grog: ['Grog'], daiquiri: ['Daiquiri', 'Sour'], swizzle: ['Swizzle'], zombie: ['Revenant', 'Specter'],
  'beachcomber-sour': ['Cup', 'Punch'], 'mai-tai': ['Cooler', 'Cup'], 'orgeat-punch': ['Punch', 'Bowl'], colada: ['Colada'],
  buck: ['Buck', 'Mule', 'Cooler', 'Highball'], 'resort-punch': ['Punch', 'Cooler'], 'bitter-tiki': ['Sour', 'Cup'], stirred: ['Nightcap'], hot: ['Toddy', 'Grog', 'Mug'],
};

// Names come from the prayer first (its imagery words), then from what is really in the glass:
// flavor adjectives only for flavors the drink carries, places only for the spirits it pours.
// A classic's name appears only when the drink is a riff on that classic.
export function makeName(rng, { archetype = null, family, intent = {}, flavorTags = [], color = null, baseIds = [], riffOf = null, mood = null, taken = new Set() }) {
  const prayerWords = [...new Set((intent.nameWords || []).filter(w => w && w.length <= 18))].map(titleCase);
  const adjPool = [];
  if (color && COLOR_ADJ[color]) adjPool.push(...COLOR_ADJ[color]);
  for (const t of flavorTags.slice(0, 4)) if (ADJ[t]) adjPool.push(...ADJ[t]);
  if (!adjPool.length) adjPool.push('Hidden', 'Southern', 'Last', 'Lucky');
  const nounThemes = mood === 'spooky' || family === 'zombie' ? ['spooky', 'adventure', 'weather']
    : family === 'bitter-tiki' ? ['creature', 'jungle']
      : family === 'grog' || family === 'punch' ? ['sea', 'weather', 'adventure']
        : family === 'hot' ? ['adventure', 'weather']
          : ['sea', 'jungle', 'creature', 'weather', 'adventure'];
  const nounPool = nounThemes.flatMap(t => NOUN[t]);
  const places = baseIds.flatMap(id => PLACE_BY_ING[id] || []);
  const typeNoun = (archetype && archetype.nameNouns) || TYPE_NOUN[family] || ['Punch'];
  const isNoun = w => /^(the |la |el )?[A-Z]/.test(w) && !/(ed|y|ish|ing)$/.test(w.split(' ').pop().toLowerCase());

  const options = [];
  if (riffOf) {
    const lead = prayerWords[0] || pick(rng, adjPool);
    options.push(`${lead} ${riffOf}`, `${pick(rng, adjPool)} ${riffOf}`);
  }
  if (prayerWords.length) {
    const w = prayerWords[Math.floor(rng() * Math.min(3, prayerWords.length))];
    const w2 = prayerWords.find(x => x !== w);
    options.push(`${w} ${pick(rng, typeNoun)}`);
    options.push(isNoun(w) ? `${pick(rng, adjPool)} ${w}` : `${w} ${pick(rng, nounPool)}`);
    if (w2) options.push(isNoun(w2) ? `${w} ${w2}` : `${w2} ${w}`);
    if (places.length) options.push(`${w} of ${pick(rng, places)}`);
  }
  options.push(`${pick(rng, adjPool)} ${pick(rng, nounPool)}`, `${pick(rng, nounPool)} ${pick(rng, typeNoun)}`);
  if (places.length) options.push(`${pick(rng, nounPool)} of ${pick(rng, places)}`, `${pick(rng, places)} ${pick(rng, typeNoun)}`);
  for (const name0 of options) {
    const name = name0.replace(/\b(\w+)\s+\1\b/i, '$1').replace(/\s+/g, ' ').trim();
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `${pick(rng, adjPool)} ${pick(rng, nounPool)} No. ${Math.floor(rng() * 90) + 10}`;
}
