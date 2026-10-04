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
      const k = l.muddled ? 0.6 : l.garnish || ing.role === 'aromatic' ? 0.25 : ((l.oz || 0) / total) * (INTENSITY[ing.cat] ?? 1) * (ing.role === 'base' ? 1.2 : 1);
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

  // Flavors that may headline a name or tagline: the lead flavor of an ingredient poured at a
  // dose you can taste (a quarter ounce, a teaspoon of something loud, or mint worked into the
  // drink). Secondary notes (the banana in Jamaican rum's funk) never headline.
  const LOUD = new Set(['liqueur', 'syrup', 'fortified']);
  function headline(lines) {
    const out = new Map();
    for (const l of lines) {
      const ing = ingMap.get(l.id);
      if (!ing || (l.garnish && !l.muddled)) continue;
      const lead = (ing.flavors || []).find(t => !STRUCTURAL.has(t) && WORD[t]);
      if (!lead) continue;
      const ok = l.muddled || (l.oz || 0) >= 0.25 || (LOUD.has(ing.cat) && (l.oz || 0) >= 0.16);
      if (!ok || ing.cat === 'bitters') continue;
      out.set(lead, (out.get(lead) || 0) + (l.oz || 0.5) * (INTENSITY[ing.cat] ?? 1));
    }
    return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }

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
  const NOUN_IMPLIES = {
    colada: ['pineapple', 'coconut', 'creamy'], 'mai tai': ['almond', 'orange', 'lime'], grog: ['lime', 'grapefruit', 'honey'], daiquiri: ['lime'],
    swizzle: ['lime', 'mint'], 'passion fruit': ['passion-fruit', 'lemon'], 'orgeat punch': ['almond', 'orange', 'lemon'], 'falernum': ['lime', 'clove', 'almond'],
    'beachcomber sour': ['lime', 'honey', 'allspice'], zombie: ['lime', 'grapefruit', 'cinnamon', 'anise'], 'ginger beer': ['ginger'], mule: ['ginger', 'lime'],
    mojito: ['mint', 'lime'], caipirinha: ['lime'], 'bitter tiki': ['bitter', 'pineapple'], 'old fashioned': [], negroni: ['bitter'], 'hot buttered rum': ['buttery', 'baking-spice'],
    painkiller: ['pineapple', 'coconut', 'orange', 'nutmeg'], hurricane: ['passion-fruit'], 'blue hawaii': ['pineapple'], 'scorpion': ['almond', 'orange'], sunrise: ['orange', 'pomegranate'],
  };
  // How a menu names a bottle in a tagline: the thing you taste, not the label.
  const MENU = {
    'pineapple-juice': 'pineapple', 'coconut-cream': 'coconut', 'coconut-milk': 'coconut', 'coconut-water': 'coconut water', 'coconut-rum': 'coconut',
    orange: 'orange', lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', 'passion-fruit-syrup': 'passion fruit', 'passion-fruit-juice': 'passion fruit',
    'passion-fruit-nectar': 'passion fruit', 'passion-fruit-liqueur': 'passion fruit', 'guava-nectar': 'guava', 'guava-syrup': 'guava', 'mango-nectar': 'mango',
    'papaya-nectar': 'papaya', banana: 'banana', strawberry: 'strawberry', 'banana-liqueur': 'banana', 'velvet-falernum': 'falernum', 'falernum-syrup': 'falernum', 'allspice-dram': 'allspice',
    'cinnamon-syrup': 'cinnamon', 'ginger-syrup': 'ginger', 'ginger-beer': 'ginger beer', 'ginger-liqueur': 'ginger', 'honey-syrup': 'honey', 'orgeat': 'orgeat',
    grenadine: 'grenadine', 'hibiscus-syrup': 'hibiscus', maraschino: 'maraschino', 'blue-curacao': 'blue curaçao', 'orange-curacao': 'curaçao', campari: 'Campari',
    aperol: 'Aperol', 'green-chartreuse': 'green Chartreuse', 'yellow-chartreuse': 'yellow Chartreuse', 'coffee-liqueur': 'coffee', coffee: 'coffee',
    'creme-de-cacao': 'chocolate', 'vanilla-syrup': 'vanilla', 'vanilla-ice-cream': 'vanilla ice cream', 'heavy-cream': 'cream', 'half-and-half': 'cream',
    'dons-mix': "Don's Mix", 'gardenia-mix': 'Gardenia Mix', 'hot-buttered-rum-batter': 'spiced butter', 'peach-liqueur': 'peach', 'apricot-liqueur': 'apricot',
    'cherry-heering': 'cherry', 'lychee-syrup': 'lychee', 'lychee-liqueur': 'lychee', 'melon-liqueur': 'melon', 'sparkling-wine': 'bubbles', 'soda-water': 'soda',
    'black-tea': 'black tea', 'li-hing-mui-syrup': 'li hing mui', 'five-spice-syrup': 'five-spice', 'yuzu-juice': 'yuzu', 'pomegranate-juice': 'pomegranate',
    'raspberry-syrup': 'raspberry', 'elderflower-liqueur': 'elderflower', absinthe: 'absinthe', pastis: 'anise', angostura: 'Angostura', mint: 'mint',
    mezcal: 'mezcal', 'scotch-islay': 'Islay Scotch', 'rum-jamaican-pot': 'Jamaican funk', 'rum-demerara-overproof': '151', 'rum-agricole-blanc': 'agricole',
    'rum-agricole-vieux': 'aged agricole', 'tequila-blanco': 'tequila', 'tequila-reposado': 'reposado', gin: 'gin', bourbon: 'bourbon', rye: 'rye', brandy: 'brandy',
    pisco: 'pisco', 'rum-cachaca': 'cachaça', 'batavia-arrack': 'arrack', aquavit: 'aquavit',
  };
  // Voice adjectives a menu may lean on, each with what the drink must have to earn it.
  const VOICE = {
    clean: () => true, crisp: d => d.acid >= 0.5 && !d.creamy, bright: d => d.acid >= 0.6, bracing: d => d.acid >= 0.8,
    frosty: d => d.frozen || d.crushed, snowy: d => d.frozen, silky: d => d.creamy, velvet: d => d.creamy, plush: d => d.creamy, smooth: () => true,
    sunny: () => true, 'sun-drenched': () => true, breezy: d => d.abv <= 12, lazy: d => d.abv <= 12, easy: d => d.abv <= 12, gentle: d => d.abv <= 12, soothing: d => d.abv <= 12,
    potent: d => d.abv >= 15, fierce: d => d.abv >= 17, spiced: d => d.spice, honeyed: d => d.has('honey-syrup', 'gardenia-mix'), minty: d => d.has('mint'),
    'nutmeg-dusted': d => d.nutmeg, steaming: d => d.hot, cozy: d => d.hot || d.creamy, slow: d => d.stirred || d.hot, contemplative: d => d.stirred,
    elegant: d => !d.long, polished: d => !d.long, decadent: d => d.creamy, indulgent: d => d.creamy, daring: () => true, audacious: () => true,
    bittersweet: d => d.bitter, wild: () => true, stormy: d => d.dark, restless: () => true, glowing: d => d.layered, swirling: d => d.layered, molten: d => d.layered && d.red,
    electric: d => d.blue, technicolor: d => d.layered, 'deceptively smooth': d => d.abv >= 15, 'sun-warmed': () => true, 'barefoot': d => d.abv <= 12,
  };
  function voiceAdj(archetype, d, rng) {
    const ok = (archetype.taglineWords || []).map(w => String(w).toLowerCase()).filter(w => VOICE[w] && VOICE[w](d));
    return ok.length ? ok[Math.floor(rng() * ok.length)] : null;
  }

  // "A frosty colada with mango and lime, for a slow Sunday." The type word is the archetype's;
  // the heroes are the bottles that set this drink apart (asked for, changed, or outside the
  // archetype's signature), named the way a menu would; the prayer contributes the mood.
  function tagline({ lines, archetype, intent, riffOf, riffIds = null, look = null, stats = null, method = '', ice = '', garnish = [], rng = Math.random }) {
    lines = lines.filter(l => l.muddled || (!l.garnish && (ingMap.get(l.id) || {}).role !== 'aromatic'));
    const isBase = id => (ingMap.get(id) || {}).role === 'base';
    const askedIng = new Set(Object.entries(intent.ings || {}).filter(([, w]) => w >= 1).map(([id]) => id));
    const changed = riffIds ? new Set(lines.map(l => l.id).filter(id => !riffIds.includes(id))) : new Set();
    const sigIds = new Set((archetype.signature || []).filter(c => c.required).flatMap(c => c.anyOf));
    const askedTag = id => Object.entries(intent.tags || {}).some(([t, w]) => w >= 1 && ((ingVec[id] || {})[t] || 0) >= 0.5);
    const typeWord = archetype.noun || (archetype.name || 'tropical drink').toLowerCase();
    const inType = w => typeWord.toLowerCase().includes(w.toLowerCase());
    const tasteable = l => l.muddled || (l.oz || 0) >= 0.2 || ((ingMap.get(l.id) || {}).cat === 'liqueur' && (l.oz || 0) >= 0.16) || askedIng.has(l.id);
    const rank = l => (askedIng.has(l.id) ? 4 : 0) + (changed.has(l.id) ? 3 : 0) + (askedTag(l.id) ? 2 : 0) + (!sigIds.has(l.id) ? 1 : 0) + Math.min(1, (l.oz || 0) / 2);
    // Flavors the type word already promises go unsaid ("colada" says pineapple and coconut);
    // the rest of the archetype's profile (a Lava Flow's strawberry) is worth naming.
    const implied = new Set(Object.entries(NOUN_IMPLIES).filter(([k]) => typeWord.toLowerCase().includes(k)).flatMap(([, v]) => v));
    const profile = implied;
    const leadOf = id => ((ingMap.get(id) || {}).flavors || [])[0];
    const heroes = [];
    const cands = [...lines].filter(l => !isBase(l.id) && MENU[l.id] && tasteable(l)).sort((a, b) => rank(b) - rank(a));
    for (const l of cands) {
      const w = MENU[l.id];
      const mustSay = askedIng.has(l.id) || changed.has(l.id) || askedTag(l.id);
      if (rank(l) < 1 || inType(w) || heroes.includes(w)) continue;
      if (!mustSay && profile.has(leadOf(l.id))) continue;
      if (heroes.length < 2) heroes.push(w);
    }
    // Nothing sets it apart? Then say what it is made of.
    if (!heroes.length) for (const l of cands) { const w = MENU[l.id]; if (!inType(w) && !heroes.includes(w) && heroes.length < 2 && !['lime', 'lemon', 'soda'].includes(w)) heroes.push(w); }
    // Base adjective: a spirit the guest asked for or a split base speaks first ("smoky", "funky").
    const baseTags = named(presence(lines.filter(l => isBase(l.id) && !l.float)));
    const askedBase = baseTags.find(x => BASE_ADJ[x.tag] && (intent.tags[x.tag] || 0) >= 1);
    const baseAdj = (askedBase || baseTags.find(x => BASE_ADJ[x.tag]) || {}).tag;
    const texture = lines.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'vanilla-ice-cream'].includes(l.id) && (l.oz || 0) >= 0.75) && !/colada|cream/.test(typeWord) ? 'creamy' : null;
    let colorPart = null;
    const wanted = [intent.color, intent.colorLean].find(c => c && look && COLOR_WORD[c] && showsColor(look, c));
    if (wanted) colorPart = COLOR_WORD[wanted];
    const has = (...ids) => lines.some(l => ids.includes(l.id));
    const facts = {
      abv: stats ? stats.abv : 12, acid: stats ? stats.acidConc : 0.5, creamy: !!texture || /colada|cream/.test(typeWord) && has('coconut-cream', 'coconut-milk', 'heavy-cream'),
      frozen: method === 'blend', crushed: ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(ice), hot: method === 'hot', stirred: method === 'stir',
      long: lines.reduce((t, l) => t + (l.oz || 0), 0) > 5, spice: has('allspice-dram', 'cinnamon-syrup', 'velvet-falernum', 'falernum-syrup', 'dons-mix', 'ginger-syrup', 'angostura', 'hot-buttered-rum-batter'),
      bitter: has('campari', 'aperol', 'amaro', 'cynar', 'fernet') || lines.some(l => l.id === 'angostura' && (l.oz || 0) >= 0.5), nutmeg: garnish.some(g => /nutmeg/i.test(g)),
      layered: !!(look && (look.layers || []).some(x => x.kind === 'sink' || x.kind === 'float')), red: !!(look && showsColor(look, 'red')), blue: !!(look && showsColor(look, 'blue')),
      dark: !!(look && showsColor(look, 'dark')), has,
    };
    const voice = !colorPart ? voiceAdj(archetype, facts, rng) : null;
    const lead = [colorPart, texture, voice, baseAdj ? BASE_ADJ[baseAdj] : null].filter(Boolean).filter((w, i, a) => a.indexOf(w) === i && !(w === 'silky' && texture) && !(w === 'dark' && voice === 'stormy')).slice(0, 2);
    // A mood line that names a color ("red all the way through") is said only if the glass shows it.
    const MOOD_COLOR = { red: 'red', ruby: 'red', crimson: 'red', scarlet: 'red', blue: 'blue', turquoise: 'blue', green: 'green', jade: 'green', gold: 'gold', golden: 'gold', pink: 'pink', purple: 'purple', violet: 'purple', black: 'dark', orange: 'orange' };
    const moodOk = m => !Object.entries(MOOD_COLOR).some(([w, c]) => new RegExp(`\\b${w}\\b`, 'i').test(m) && !(look && showsColor({ body: look.body, layers: [] }, c)));
    const mood = (intent.taglineWords || []).find(m => m && moodOk(m));
    const riff = riffOf ? `, a riff on the ${riffOf}` : '';
    const heroWords = heroes.map(w => colorPart && w.startsWith(colorPart + ' ') ? w.slice(colorPart.length + 1) : w);
    const withPart = heroWords.length ? ` with ${list(heroWords)}` : '';
    const moodPart = mood ? (/^(for|to|with|on|in|under|at|from|like|and)\b/i.test(mood) ? ` ${mood}` : `, ${mood}`) : '';
    const phrase = `${lead.join(', ')} ${typeWord}${withPart}${riff}${moodPart}`.replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
    let out = `${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}.`;
    // No word twice in a row ("bitter bitter tiki sour").
    return out.replace(/\b(\w+)\s+\1\b/gi, '$1').replace(/\s+([,.])/g, '$1');
  }

  return { presence, named, headline, tastingNote, tagline, WORD, SPIRIT_VOICE };
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
