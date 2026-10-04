import { showsColor } from './optics.js';

// Menu copy that tells the truth. Every flavor a tagline or tasting note names must be carried
// by an ingredient at a dose you can taste; the drink's type word comes from its archetype
// (which the composer guarantees it satisfies); the prayer contributes the mood, never fake
// flavors. Names echo the prayer's imagery and never borrow a classic's name unless the drink
// is a riff on it.

// How loudly an ingredient speaks per ounce, by category.
const INTENSITY = { rum: 1, spirit: 1, liqueur: 1.6, fortified: 1.2, bitters: 26, syrup: 1.2, citrus: 1.5, juice: 1, cream: 1.1, soda: 0.5, aromatic: 0 };
// Tags that describe structure rather than flavor, never named as flavors.
const STRUCTURAL = new Set(['sweet', 'tart', 'light', 'crisp', 'dry', 'rich', 'boozy', 'fruity', 'tropical', 'warm', 'citrus', 'creamy', 'effervescent']);
const WORD = {
  lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', orange: 'orange', pineapple: 'pineapple', 'passion-fruit': 'passion fruit',
  guava: 'guava', mango: 'mango', papaya: 'papaya', banana: 'banana', coconut: 'coconut', cherry: 'cherry', berry: 'red berries',
  apricot: 'apricot', peach: 'peach', 'stone-fruit': 'stone fruit', pomegranate: 'pomegranate', apple: 'apple', melon: 'melon', lychee: 'lychee',
  'dried-fruit': 'dried fruit', almond: 'almond', nutty: 'toasted nuts', vanilla: 'vanilla', cinnamon: 'cinnamon', allspice: 'allspice',
  clove: 'clove', nutmeg: 'nutmeg', ginger: 'ginger', 'baking-spice': 'baking spice', anise: 'anise', chili: 'chili heat', pepper: 'pepper',
  herbal: 'herbal notes', mint: 'mint', floral: 'floral notes', honey: 'honey', caramel: 'caramel', molasses: 'molasses', maple: 'maple', buttery: 'butter',
  chocolate: 'chocolate', coffee: 'coffee', tea: 'tea', funky: 'rum funk', grassy: 'green cane', vegetal: 'green agave', smoky: 'smoke',
  oaky: 'oak', bitter: 'a bitter edge', salty: 'salt', earthy: 'earth', agave: 'agave', juniper: 'juniper',
};
// The voice of each base spirit in a tasting note.
const SPIRIT_VOICE = {
  'rum-white-column': 'crisp white rum', 'rum-gold-column': 'smooth gold rum', 'rum-aged-column': 'mellow aged rum', 'rum-blended-light': 'lightly aged rum',
  'rum-barbados': 'round Barbados rum', 'rum-jamaican-aged': 'funky Jamaican rum', 'rum-jamaican-dark': 'dark Jamaican rum', 'rum-jamaican-pot': 'high-ester Jamaican pot still',
  'rum-jamaican-white-overproof': 'fiery Jamaican overproof', 'rum-demerara': 'molasses-rich Demerara rum', 'rum-demerara-overproof': 'burnt-sugar 151 Demerara',
  'rum-black-blended': 'inky black rum', 'rum-black-overproof': 'black overproof', 'rum-agricole-blanc': 'grassy rhum agricole', 'rum-agricole-vieux': 'aged rhum agricole',
  'rum-haitian': 'earthy Haitian rum', 'rum-navy': 'navy-strength rum', 'rum-overproof-white': 'overproof white rum', 'rum-spiced': 'spiced rum',
  'rum-pineapple': 'pineapple rum', 'rum-cachaca': 'grassy cachaça', gin: 'piney gin', 'gin-old-tom': 'soft Old Tom gin', bourbon: 'vanilla-and-oak bourbon',
  rye: 'peppery rye', 'scotch-blended': 'honeyed Scotch', 'irish-whiskey': 'Irish whiskey', brandy: 'brandy', applejack: 'apple brandy', pisco: 'floral pisco',
  'tequila-blanco': 'peppery blanco tequila', 'tequila-reposado': 'rested tequila', mezcal: 'smoky mezcal', vodka: 'vodka', aquavit: 'caraway aquavit',
  'batavia-arrack': 'Batavia arrack', okolehao: 'okolehao', 'black-tea': 'strong black tea',
};

const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] || '');
const strip = n => n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export function createCopywriter({ ingMap, ingVec }) {
  // Which flavors a drink really carries: tag → { score, carriers }.
  function presence(lines, floor = 0.05) {
    const total = lines.filter(l => !l.garnish).reduce((s, l) => s + (l.oz || 0), 0) || 1;
    const out = {};
    for (const l of lines) {
      const ing = ingMap.get(l.id);
      if (!ing) continue;
      const k = l.garnish || ing.role === 'aromatic' ? 0.25 : ((l.oz || 0) / total) * (INTENSITY[ing.cat] ?? 1) * (ing.role === 'base' ? 1.2 : 1);
      for (const [t, w] of Object.entries(ingVec[l.id] || {})) {
        const v = w * k;
        if (!out[t]) out[t] = { tag: t, score: 0, carriers: [] };
        out[t].score += v;
        if (v >= Math.min(0.04, floor * 0.8)) out[t].carriers.push(l.id);
      }
    }
    return Object.values(out).filter(x => x.score >= floor && x.carriers.length).sort((a, b) => b.score - a.score);
  }

  const named = pres => pres.filter(x => !STRUCTURAL.has(x.tag) && WORD[x.tag]);

  function tastingNote({ lines, stats, archetype, look, method, ice, rng }) {
    const pres = named(presence(lines));
    const used = new Set();
    const take = (pred, n) => {
      const out = [];
      for (const x of pres) if (!used.has(x.tag) && pred(x) && out.length < n) { out.push(WORD[x.tag]); used.add(x.tag); }
      return out;
    };
    const carriedBy = roles => x => x.carriers.some(id => roles.includes((ingMap.get(id) || {}).role));
    const bases = lines.filter(l => (ingMap.get(l.id) || {}).role === 'base' && !l.float && (l.oz || 0) >= 0.4).sort((a, b) => b.oz - a.oz);
    for (const b of bases) for (const t of Object.keys(ingVec[b.id] || {})) used.add(t);
    const open = take(carriedBy(['sour', 'juice', 'lengthener']), 2);
    const middle = take(carriedBy(['sweet', 'modifier', 'rich']), 2);
    const finish = take(carriedBy(['accent', 'aromatic', 'modifier']), 2);
    const voices = bases.slice(0, 2).map(b => SPIRIT_VOICE[b.id] || strip(ingMap.get(b.id).name).toLowerCase());
    const floats = lines.filter(l => l.float);
    const bits = [];
    if (open.length) bits.push(`${cap(list(open))} up front`);
    if (voices.length) bits.push(`${bits.length ? 'then ' : ''}${list(voices)} ${voices.length > 1 ? 'carry' : 'carries'} the middle${middle.length ? `, with ${list(middle)}` : ''}`);
    else if (middle.length) bits.push(`${bits.length ? 'then ' : ''}${list(middle)} in the middle`);
    if (finish.length) bits.push(`it finishes on ${list(finish)}`);
    let s = bits.length ? `${cap(bits.join('; '))}.` : '';
    if (floats.length) s += ` The ${list(floats.map(f => strip(ingMap.get(f.id).name).toLowerCase()))} float hits first, then sinks into the rest.`;
    const texture = textureLine(lines, method, ice);
    if (texture) s += ` ${texture}`;
    s += ` ${balanceLine(stats, archetype, lines)} ${strengthLine(stats.abv, rng)}`;
    return s.trim();
  }

  function textureLine(lines, method, ice) {
    const has = ids => lines.some(l => ids.includes(l.id) && (l.oz || 0) >= 0.5);
    if (method === 'blend' || ice === 'blended') return 'Thick and frosty, like a slushie for grown-ups.';
    if (has(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream'])) return 'Silky and rich from the coconut and cream.';
    if (has(['soda-water', 'ginger-beer', 'ginger-ale', 'sparkling-wine', 'tonic', 'cola'])) return 'Long and fizzy.';
    if (has(['egg-white'])) return 'Topped with a soft, silky foam.';
    if (method === 'stir') return 'Silky and spirit-forward, sipped slowly over one big cube.';
    if (method === 'swizzle') return 'Swizzled until the glass frosts.';
    if (method === 'hot') return 'Steaming and soothing.';
    return '';
  }

  function balanceLine(stats, archetype, lines) {
    const r = stats.sweetSour;
    const creamy = lines.some(l => ['coconut-cream', 'heavy-cream', 'vanilla-ice-cream'].includes(l.id) && (l.oz || 0) >= 0.75);
    if (stats.acidConc < 0.2) return creamy ? 'Rich and round rather than tart.' : 'Soft and round, with almost no sourness.';
    const band = archetype && archetype.ratios && archetype.ratios.sugarToAcid;
    const lo = band ? band[0] : 8, hi = band ? band[1] : 14;
    if (r === null) return '';
    if (r < lo * 0.9) return 'Tart and bracing.';
    if (r > hi * 1.1) return 'On the lush side, with just enough acid to stay bright.';
    return 'Sweet and sour in balance.';
  }

  function strengthLine(abv, rng) {
    if (abv <= 0.5) return 'No alcohol at all, but all of the ritual.';
    if (abv < 8) return 'Light enough for a long afternoon.';
    if (abv < 13) return 'Easy-drinking strength.';
    if (abv < 17) return 'It has some muscle; the ice is part of the recipe.';
    return 'Strong. Don the Beachcomber limited his Zombie to two per guest, and the same goes here.';
  }

  // "A creamy colada with mango and lime, for a slow Sunday."
  // Base spirits lend one adjective at most ("smoky", "funky"); the named flavors come from
  // what was added to the spirit, the ones the guest asked for first. A flavor carried only by
  // a dash of bitters isn't worth naming unless it was asked for.
  const BASE_ADJ = { smoky: 'smoky', funky: 'funky', grassy: 'grassy', molasses: 'dark', agave: 'agave-bright', juniper: 'piney', oaky: 'oak-aged' };
  const SPICES = new Set(['cinnamon', 'clove', 'allspice', 'nutmeg', 'ginger', 'pepper', 'chili']);
  const COLOR_WORD = { blue: 'blue', green: 'green', red: 'ruby-red', pink: 'pink', gold: 'golden', purple: 'violet', dark: 'dark', orange: 'sunset-orange', white: 'snow-white', clear: 'crystal-clear' };
  function tagline({ lines, archetype, intent, riffOf, riffIds = null, look = null }) {
    const isBase = id => (ingMap.get(id) || {}).role === 'base';
    // The tagline describes what is in the glass; garnish aromas (a mint sprig) aren't flavors of the drink.
    lines = lines.filter(l => !l.garnish && (ingMap.get(l.id) || {}).role !== 'aromatic');
    const ozOf = id => lines.filter(l => l.id === id).reduce((s, l) => s + (l.oz || 0), 0);
    const askedIng = new Set(Object.entries(intent.ings || {}).filter(([, w]) => w >= 1).map(([id]) => id));
    const changed = riffIds ? new Set(lines.map(l => l.id).filter(id => !riffIds.includes(id))) : new Set();
    const asked = t => (intent.tags[t] || 0) >= 1 || lines.some(l => (askedIng.has(l.id) || changed.has(l.id)) && ((ingVec[l.id] || {})[t] || 0) >= 0.5);
    const pres = named(presence(lines)).filter(x => !(archetype.taglineSkip || []).includes(x.tag) && x.carriers.some(id => !isBase(id))
      && (asked(x.tag) || x.carriers.some(id => !isBase(id) && ozOf(id) >= 0.2)));
    const baseTags = named(presence(lines.filter(l => isBase(l.id) && !l.float)));
    const askedBase = baseTags.find(x => BASE_ADJ[x.tag] && asked(x.tag));
    const baseAdj = (askedBase || baseTags.find(x => BASE_ADJ[x.tag]) || {}).tag;
    const typeWord = archetype.noun || (archetype.name || 'tropical drink').toLowerCase();
    // Name what makes this one different; the flavors every drink of its type has go unsaid
    // unless the guest asked for them or there is nothing else to say.
    const defining = new Set(archetype.flavorProfile || []);
    const inType = x => typeWord.toLowerCase().includes(WORD[x.tag]);
    const order = [...pres.filter(x => asked(x.tag) && !inType(x)), ...pres.filter(x => !asked(x.tag) && !inType(x) && !defining.has(x.tag))];
    // A flavor the guest asked for is named even when it's a supporting note.
    const faint = named(presence(lines, 0.015)).filter(x => asked(x.tag) && !inType(x) && !order.some(o => o.tag === x.tag) && x.carriers.some(id => !isBase(id)));
    const pool = order.length || faint.length ? [...order.filter(x => asked(x.tag)), ...faint, ...order.filter(x => !asked(x.tag))] : pres.filter(x => !inType(x));
    let words = [...new Set(pool.map(x => x.tag))];
    if (words.some(t => SPICES.has(t))) words = words.filter(t => t !== 'baking-spice');
    if (baseAdj) words = words.filter(t => t !== baseAdj);
    const flav = words.slice(0, 2).map(t => WORD[t]);
    const texture = lines.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'vanilla-ice-cream'].includes(l.id) && (l.oz || 0) >= 0.75) && !/colada|cream/.test(typeWord) ? 'creamy ' : '';
    const mood = (intent.taglineWords || []).find(Boolean);
    const riff = riffOf ? `, a riff on the ${riffOf}` : '';
    const adj = baseAdj ? `${BASE_ADJ[baseAdj]} ` : '';
    // A color the guest asked for, named only if the drink really shows it.
    let colorPart = '';
    if (intent.color && look && COLOR_WORD[intent.color] && showsColor(look, intent.color)) colorPart = `${COLOR_WORD[intent.color]} `;
    const withPart = flav.length ? ` with ${list(flav)}` : '';
    const moodPart = mood ? (/^(for|to|with|on|in|under|at|from|like)\b/i.test(mood) ? ` ${mood}` : `, ${mood}`) : '';
    const lead = [colorPart.trim(), texture.trim(), adj.trim()].filter(Boolean);
    const phrase = `${lead.length > 1 ? lead.slice(0, -1).join(', ') + ', ' + lead[lead.length - 1] : lead[0] || ''} ${typeWord}${withPart}${riff}${moodPart}`.replace(/\s+/g, ' ').trim();
    return `${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}.`;
  }

  return { presence, named, tastingNote, tagline, WORD, SPIRIT_VOICE };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
