// Tiki drink generator. Everything it knows comes from the database (data/drinks.json)
// via the statistics in data/model.json; this file turns a prompt into a balanced recipe
// and explains where each choice came from.
import { indexIngredients, analyzeLines, lineOz, roleOf, round, sugarBand, balanceWord } from './chem.js';
import { flavorVector, normalize, cosine, lineImpact, tagWeights } from './flavor.js';
import { parsePrompt, buildNameIndex, indexConcepts, rawSpan } from './prompt.js';
import { snap, amountString, pieceName } from './format.js';
import { makeName, polynesianPrayer } from './names.js';
import { serviceOf, SERVICE_FITS, fillBudget, flashIceFor, BOWL_ROUND_ICE, BOWL_BED } from './vessels.js';
import { createComposer, doseCap } from './composer.js';
import { createCopywriter, creditText, decap, polish, strengthCopy } from './copy.js';
import { drinkLook, showsColor, colorDistance, opticsOf, hsl, COLOR_TEST } from './optics.js';
import { createLinter } from './lint.js';

const PLAIN = new Set(['simple-syrup', 'rich-simple', 'demerara-syrup', 'cane-syrup', 'agave-syrup']);
const ROLE_ORDER = ['base', 'sour', 'juice', 'sweet', 'modifier', 'rich', 'accent', 'lengthener'];
const USABLE = new Set(['common', 'specialty', 'homemade']);

// Ingredients that shouldn't appear together (same job, different bottle).
const GROUPS = [
  ['orange-curacao', 'triple-sec', 'blue-curacao'],
  ['velvet-falernum', 'falernum-syrup'],
  ['simple-syrup', 'rich-simple', 'demerara-syrup', 'agave-syrup', 'maple-syrup'],
  ['absinthe', 'pastis'],
  ['heavy-cream', 'half-and-half', 'irish-cream', 'vanilla-ice-cream'],
  ['passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-liqueur'],
  ['grenadine', 'raspberry-syrup', 'hibiscus-syrup'],
  ['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'sparkling-wine', 'coffee', 'black-tea', 'hot-water'],
  ['cinnamon-syrup', 'dons-mix'],
  ['honey-syrup', 'gardenia-mix'],
  ['vanilla-syrup', 'dons-spices-2'],
  ['allspice-dram', 'dons-spices-2'],
  ['coconut-cream', 'coconut-milk'],
  ['gin', 'gin-old-tom'],
  ['tequila-blanco', 'tequila-reposado'],
  ['bourbon', 'rye', 'irish-whiskey', 'scotch-blended'],
  ['green-chartreuse', 'yellow-chartreuse'],
  ['campari', 'aperol', 'amaro', 'cynar', 'fernet'],
  ['blackberry-liqueur', 'raspberry-liqueur', 'creme-de-cassis'],
  ['apricot-liqueur', 'peach-liqueur'],
  ['rum-demerara-overproof', 'rum-black-overproof', 'rum-overproof-white'],
  ['rum-agricole-blanc', 'rum-agricole-vieux'],
  ['lemon', 'yuzu-juice'],
  ['pineapple-juice', 'pineapple-syrup'],
  ['guava-nectar', 'guava-syrup'],
  ['lychee-syrup', 'lychee-liqueur'],
  ['ginger-syrup', 'ginger-liqueur'],
  ['cherry-heering', 'maraschino'],
  ['coffee-liqueur', 'coffee'],
  ['nutmeg', 'cinnamon', 'clove'],
];
const DAIRY = new Set(['heavy-cream', 'half-and-half', 'irish-cream', 'vanilla-ice-cream']);
const NA_SWAP = {
  'velvet-falernum': 'falernum-syrup', 'orange-curacao': 'orange', 'triple-sec': 'orange', 'blue-curacao': 'orange',
  'allspice-dram': 'cinnamon-syrup', 'passion-fruit-liqueur': 'passion-fruit-syrup', 'coconut-rum': 'coconut-cream',
  'banana-liqueur': 'banana', 'apricot-liqueur': 'apricot-nectar', 'peach-liqueur': 'apricot-nectar',
  'lychee-liqueur': 'lychee-syrup', 'ginger-liqueur': 'ginger-syrup', 'coffee-liqueur': 'coffee',
  'blackberry-liqueur': 'raspberry-syrup', 'raspberry-liqueur': 'raspberry-syrup', 'creme-de-cassis': 'raspberry-syrup',
  'amaretto': 'orgeat', 'dons-spices-2': 'vanilla-syrup', 'elderflower-liqueur': 'lychee-syrup', 'irish-cream': 'heavy-cream',
  'melon-liqueur': 'watermelon-juice', 'cherry-heering': 'grenadine', 'maraschino': 'grenadine',
};

// Deterministic PRNG so a prompt + seed always makes the same drink.
export function rngFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Near-ties in a "best answer" pick are broken by the prayer itself, so two prayers that land
// on the same frame don't both get the same spec, twist and glass.
let TIE = null;
function softPick(rng, scored, temperature, greedy) {
  if (!scored.length) return null;
  scored.sort((a, b) => b.s - a.s);
  if (greedy) {
    const near = TIE ? scored.filter(x => x.s >= scored[0].s - 0.3) : [];
    return near.length > 1 ? near[Math.floor(TIE() * near.length)].item : scored[0].item;
  }
  const top = scored.slice(0, 6);
  const max = top[0].s;
  const ws = top.map(x => Math.exp((x.s - max) / temperature));
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = rng() * tot;
  for (let i = 0; i < top.length; i++) { r -= ws[i]; if (r <= 0) return top[i].item; }
  return top[0].item;
}

function interpQ(q, s) {
  // s in [-2, 2] → quantile of the family distribution.
  if (!q) return null;
  const pts = [[-2, q.p10 * 0.85], [-1, q.p25], [0, q.median], [1, q.p75], [2, q.p90]];
  const x = Math.max(-2, Math.min(2, s));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return q.median;
}

export function createEngine({ vocab, families, drinks, model, vessels = { vessels: [] }, archetypes: archetypeData = { archetypes: [] }, concepts: conceptData = { concepts: [] }, rules = null }) {
  // The technique research's family windows (data/technique-rules.json), when supplied: balance
  // aims inside both the archetype's own band and the family's.
  const famWin = fam => ((rules || {}).familyWindows || {})[fam] || {};
  // How much liquid (before ice) each vessel wants: too little looks like a mistake at the bottom
  // of the glass, too much crowds it.
  const fillRange = id => (((rules || {}).vesselFit || {}).ranges || {})[id] || null;
  const archetypes = archetypeData.archetypes || [];
  const concepts = conceptData.concepts || [];
  const vesselList = vessels.vessels || [];
  const vesselById = Object.fromEntries(vesselList.map(v => [v.id, v]));
  const ingMap = indexIngredients(vocab);
  const units = vocab.units;
  const famList = families.families;
  const famById = Object.fromEntries(famList.map(f => [f.id, f]));
  const drinkById = Object.fromEntries(drinks.map(d => [d.id, d]));
  const nameIndex = buildNameIndex(drinks);
  const takenNames = new Set(drinks.map(d => d.name.toLowerCase()));
  const groupOf = new Map();
  GROUPS.forEach((g, i) => g.forEach(id => { if (!groupOf.has(id)) groupOf.set(id, []); groupOf.get(id).push(i); }));

  const ingVec = {};
  for (const ing of vocab.ingredients) ingVec[ing.id] = tagWeights(ing.flavors || []);
  const usable = ing => ing && USABLE.has(ing.avail) && ing.cost <= 3;
  const byRole = {};
  // Plain and hot water are facts of old punch recipes, not creative choices.
  const NOT_CREATIVE = new Set(['water', 'hot-water']);
  for (const ing of vocab.ingredients) if (usable(ing) && !NOT_CREATIVE.has(ing.id)) (byRole[ing.role] ||= []).push(ing.id);

  // Pre-compute drink vectors for similarity / lineage.
  const drinkVec = {};
  for (const d of drinks) drinkVec[d.id] = profileOf(d.ingredients, d.servings || 1, d.method, d.ice);
  // Famous drinks by ingredient, for "the rum behind the Zombie and Navy Grog".
  const famousWith = {};
  for (const d of [...drinks].sort((a, b) => b.popularity - a.popularity || (a.year ?? 9999) - (b.year ?? 9999))) {
    for (const id of new Set(d.ingredients.map(l => l.id))) (famousWith[id] ||= []).push(d.id);
  }

  function profileOf(lines, servings, method, ice) {
    const chem = analyzeLines(lines, ingMap, units, { method, ice, servings });
    const flavor = normalize(flavorVector(lines, ingMap, units, servings, chem));
    const tokens = {};
    for (const l of lines) {
      const ing = ingMap.get(l.id);
      if (!ing) continue;
      const w = Math.min(lineImpact(l, ing, units, servings), 3);
      tokens[l.id] = (tokens[l.id] || 0) + w;
      const catTok = ing.cat === 'rum' ? 'cat:rum' : `cat:${ing.cat}:${ing.role}`;
      tokens[catTok] = (tokens[catTok] || 0) + w * 0.35;
    }
    return { chem, flavor, tokens };
  }

  function similarity(p, q) {
    let mn = 0, mx = 0;
    const keys = new Set([...Object.keys(p.tokens), ...Object.keys(q.tokens)]);
    for (const k of keys) { const a = p.tokens[k] || 0, b = q.tokens[k] || 0; mn += Math.min(a, b); mx += Math.max(a, b); }
    return 0.55 * (mx ? mn / mx : 0) + 0.45 * cosine(p.flavor, q.flavor);
  }

  function neighbors(profile, { exclude = new Set(), n = 4 } = {}) {
    const out = [];
    for (const d of drinks) {
      if (exclude.has(d.id)) continue;
      const s = similarity(profile, drinkVec[d.id]);
      out.push({ id: d.id, s: s + d.popularity * 0.012 });
    }
    return out.sort((a, b) => b.s - a.s).slice(0, n);
  }

  // Ingredient-set overlap with the nearest catalogued drink (ignores amounts and garnish).
  function closestTwin(lines) {
    const mine = new Set(lines.filter(l => l.role !== 'aromatic').map(l => l.id));
    let best = null;
    for (const d of drinks) {
      const theirs = new Set(d.ingredients.filter(l => !l.garnish && ingMap.has(l.id) && ingMap.get(l.id).role !== 'aromatic').map(l => l.id));
      let inter = 0;
      for (const x of mine) if (theirs.has(x)) inter++;
      const s = inter / (mine.size + theirs.size - inter || 1);
      if (!best || s > best.s) best = { id: d.id, s };
    }
    return best;
  }

  const pairInfo = (a, b) => (model.pairs[a] && model.pairs[a][b]) || null;
  function compat(c, chosenIds) {
    if (!chosenIds.length) return 0;
    let sum = 0;
    for (const o of chosenIds) {
      if (o === c) continue;
      const p = pairInfo(c, o);
      if (p) sum += Math.max(-2, Math.min(3, p.pmi)) * Math.min(1, 0.4 + p.n / 8);
      else sum += tagAffinity(c, o) * 0.4;
    }
    return sum / chosenIds.length;
  }
  function tagAffinity(a, b) {
    const ta = (ingMap.get(a) || {}).flavors || [], tb = (ingMap.get(b) || {}).flavors || [];
    let s = 0, n = 0;
    for (const x of ta) for (const y of tb) {
      if (x === y) { s += 0.5; n++; continue; }
      const v = model.tagPairs[x] && model.tagPairs[x][y];
      if (v !== undefined) { s += v; n++; }
    }
    return n ? s / n : 0;
  }

  function intentMatch(id, intent) {
    const v = ingVec[id] || {};
    let s = 0;
    for (const [t, w] of Object.entries(intent.tags)) if (v[t]) s += w * v[t];
    for (const [t, w] of Object.entries(intent.avoidTags)) if (v[t]) s -= w * v[t] * 4;
    const ing = ingMap.get(id);
    const map = { blue: ['blue'], red: ['red'], pink: ['pink', 'red'], gold: ['yellow', 'orange'], green: ['green'], purple: [], dark: [], orange: ['orange'] };
    if (intent.color && ing.color && (map[intent.color] || []).includes(ing.color)) s += 1.5;
    else if (intent.colorLean && ing.color && (map[intent.colorLean] || []).includes(ing.color)) s += 0.5;
    if (intent.color === 'dark' && ['rum-black-blended', 'rum-jamaican-dark', 'rum-demerara', 'rum-black-overproof', 'coffee-liqueur'].includes(id)) s += 1;
    if (intent.ings[id]) s += intent.ings[id] * 1.5;
    if (intent.prefer && intent.prefer[id]) s += intent.prefer[id] * 1.1;
    return s;
  }

  function forbidden(id, intent) {
    const ing = ingMap.get(id);
    if (!usable(ing)) return true;
    if (intent.avoidIngs.has(id)) return true;
    for (const [t, w] of Object.entries(intent.avoidTags)) if (w >= 1 && (ing.flavors || []).includes(t)) return true;
    if (ing.cat === 'rum' && intent.avoidSpirits.has('rum')) return true;
    if (intent.avoidSpirits.has(id)) return true;
    if (intent.style.zeroProof && ing.abv > 0 && ing.cat !== 'bitters') return true;
    // Whole fruit (a banana, strawberries) only works in the blender.
    if (ing.oz_per_piece && ing.id !== 'egg-white' && !blenderContext) return true;
    return false;
  }
  let blenderContext = false;

  function conflicts(id, chosenIds) {
    const gs = groupOf.get(id);
    if (!gs) return false;
    return chosenIds.some(o => o !== id && (groupOf.get(o) || []).some(g => gs.includes(g)));
  }

  // ---------- family choice ----------
  function familyScores(intent) {
    const out = [];
    for (const f of famList) {
      const F = model.families[f.id];
      if (!F || !F.n) continue;
      let s = Math.log(1 + F.weight) * 0.2;
      for (const [t, w] of Object.entries(intent.tags)) s += w * (F.flavor[t] || 0) * 2.2;
      for (const [t, w] of Object.entries(intent.avoidTags)) s -= w * (F.flavor[t] || 0) * 2;
      s += (intent.fam[f.id] || 0) * 1.6;
      const st = intent.style;
      if (st.hot) s += f.id === 'hot' ? 8 : -3;
      else if (f.id === 'hot') s -= 4;
      if (st.creamy) s += { colada: 2.5, hot: 0.5, 'resort-punch': 0.6 }[f.id] || 0;
      if (st.bitter) s += { 'bitter-tiki': 3, stirred: 0.6 }[f.id] || 0;
      if (st.stirred) s += f.id === 'stirred' ? 5 : -1;
      else if (f.id === 'stirred') s -= 1.5;
      if (st.long) s += { buck: 2, grog: 1, swizzle: 1, 'resort-punch': 0.6, punch: 0.6 }[f.id] || 0;
      if (st.frozen) s += { colada: 1.2, daiquiri: 1.2, 'resort-punch': 1 }[f.id] || 0;
      if (st.bowl) s += { 'orgeat-punch': 2.5, punch: 1.2, zombie: 0.5, 'resort-punch': 0.6 }[f.id] || 0;
      if (st.classic) s += { zombie: 0.8, 'beachcomber-sour': 0.8, 'mai-tai': 0.8, grog: 0.8, 'orgeat-punch': 0.5, 'bitter-tiki': -1 }[f.id] || 0;
      if (st.modern) s += { 'bitter-tiki': 1, stirred: 0.5, daiquiri: 0.3 }[f.id] || 0;
      if (st.zeroProof) s += { colada: 1, 'resort-punch': 1, buck: 1, grog: 0.5, stirred: -5 }[f.id] || 0;
      s += intent.strength * ({ zombie: 1.4, 'beachcomber-sour': 0.4, stirred: 0.8, grog: 0.3, buck: -0.8, colada: -0.6, 'resort-punch': -0.4 }[f.id] || 0);
      s += intent.complexity * ({ zombie: 0.8, 'beachcomber-sour': 0.8, 'resort-punch': 0.3, daiquiri: -0.8, buck: -0.6, punch: -0.3 }[f.id] || 0);
      const nonRum = intent.spirits.filter(x => x !== 'rum');
      if (nonRum.length) s += { 'orgeat-punch': 0.8, buck: 0.6, stirred: 0.4, daiquiri: 0.4, 'mai-tai': 0.4, zombie: -0.4, grog: -0.4 }[f.id] || 0;
      out.push({ item: f.id, s });
    }
    return out;
  }

  // ---------- building ----------
  function candidateScore(id, role, F, intent, chosenIds) {
    const famShare = (F.ingredients[id] || {}).share || 0;
    const glob = (model.ingredients[id] || {}).share || 0;
    const ing = ingMap.get(id);
    let s = 1.6 * Math.log(0.02 + famShare) + 0.6 * Math.log(0.004 + glob);
    s += 2.4 * intentMatch(id, intent);
    // Does it taste like it belongs in this family?
    let fit = 0;
    for (const [t, w] of Object.entries(ingVec[id] || {})) fit += w * (F.flavor[t] || 0);
    s += 1.5 * fit;
    s += 1.1 * compat(id, chosenIds);
    if (ing.avail === 'specialty') s -= 0.35;
    if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'demerara-syrup', 'honey-syrup'].includes(id)) s -= intent.style.simple ? 1.5 : 0.25;
    if (ing.cost >= 3) s -= 0.8;
    if (intent.style.simple && ing.avail !== 'common' && ing.avail !== 'homemade') s -= 1;
    if (DAIRY.has(id) && chosenIds.some(o => (ingMap.get(o) || {}).role === 'sour')) s -= 3;
    // Novelty-colored liqueurs only when the color was asked for.
    if ((ing.color === 'blue' || ing.color === 'green') && intent.color !== ing.color) s -= 3;
    // …and nothing that muddies the color that was asked for (blue + grenadine = purple).
    const CLASH = { blue: ['red', 'pink', 'orange', 'yellow'], red: ['blue', 'green'], pink: ['blue', 'green'], green: ['red', 'pink'], gold: ['blue', 'red'] };
    if (intent.color && ing.color && (CLASH[intent.color] || []).includes(ing.color)) s -= 8;
    return s;
  }

  function sampleCount(dist, adjust, rng, greedy) {
    const d = dist || [1, 0, 0, 0];
    const e = d[1] + 2 * d[2] + 3 * d[3];
    if (greedy) return Math.max(0, Math.round(e + adjust));
    let r = rng(), k = 0;
    for (; k < 3; k++) { r -= d[k]; if (r <= 0) break; }
    return Math.max(0, Math.round(k + adjust * 0.8));
  }

  function chooseBase(F, famId, intent, rng, greedy, count, notes) {
    const chosen = [];
    const requested = intent.spirits.filter(x => x !== 'rum' && !forbidden(x, intent));
    const rumReq = Object.keys(intent.ings).filter(id => (ingMap.get(id) || {}).cat === 'rum' && intent.ings[id] >= 1 && !forbidden(id, intent));
    for (const s of requested) if (!chosen.includes(s)) chosen.push(s);
    for (const s of rumReq) if (!chosen.includes(s) && !conflicts(s, chosen)) chosen.push(s);
    const onlyRequested = requested.length && (intent.avoidSpirits.has('rum') || / only | just /.test(` ${intent.raw.toLowerCase()} `));
    let n = Math.max(count, chosen.length, 1);
    if (requested.length && !rumReq.length) {
      // A non-rum base keeps a rum partner only when the family is built on rum blends.
      const rumBlendFamily = ((F.metrics.nRums || {}).median || 0) >= 2;
      n = onlyRequested ? requested.length : Math.max(requested.length, rumBlendFamily ? requested.length + 1 : requested.length);
      if (!onlyRequested && !greedy && rng() < 0.35) n = requested.length + 1;
    }
    const pool = (byRole.base || []).filter(id => {
      const ing = ingMap.get(id);
      if (forbidden(id, intent)) return false;
      if (ing.cat !== 'rum' && !requested.includes(id)) return false; // unrequested non-rum spirits stay out
      return true;
    });
    while (chosen.length < n) {
      const scored = pool.filter(id => !chosen.includes(id) && !conflicts(id, chosen)).map(id => {
        const ing = ingMap.get(id);
        let s = candidateScore(id, 'base', F, intent, chosen);
        if (ing.abv >= 60 && intent.strength < 0.5 && !intent.ings[id]) s -= 1.5;
        if (ing.abv >= 60 && intent.strength >= 1) s += 1.2;
        if (id === 'rum-spiced' || id === 'rum-pineapple') s -= 1.2;
        return { item: id, s };
      });
      const pick = softPick(rng, scored, 0.8, greedy);
      if (!pick) break;
      chosen.push(pick);
    }
    if (requested.length && chosen.some(id => ingMap.get(id).cat === 'rum')) notes.push('split-base');
    return chosen;
  }

  function buildFresh(famId, intent, rng, greedy, notes) {
    const F = model.families[famId];
    const lines = [];
    const ids = () => lines.map(l => l.id);
    const maxIngr = Math.round((F.metrics.nIngredients.p75 || 6) + Math.max(0, intent.complexity) * 1.5 + (intent.complexity < 0 ? intent.complexity : 0));
    const adj = {
      base: (intent.strength >= 1 ? 1 : 0) + (intent.complexity >= 1 ? 0.5 : 0) - (intent.complexity <= -1 ? 0.6 : 0),
      sour: 0, juice: (intent.complexity < 0 ? -0.6 : 0) + (intent.style.long ? 0.2 : 0),
      sweet: intent.complexity < 0 ? -0.4 : 0,
      modifier: intent.complexity * 0.5 + (intent.style.bitter ? 0.6 : 0),
      rich: intent.style.creamy ? 1 : (intent.style.creamy === false ? -3 : 0),
      ...(intent.style.zeroProof ? { juice: 1, sweet: 1 } : {}),
      accent: intent.complexity * 0.5,
      lengthener: intent.style.long || intent.style.hot ? 1 : 0,
    };
    for (const role of ROLE_ORDER) {
      let count = role === 'base' && intent.style.zeroProof ? 0 : sampleCount(F.roleCount[role], adj[role] || 0, rng, greedy);
      if (role === 'base') {
        if (intent.style.zeroProof) {
          // Zero-proof: strong-brewed tea stands in for the spirit's tannin and length.
          if (!forbidden('black-tea', intent)) lines.push({ id: 'black-tea', role: 'juice', oz: Math.max(1.5, ((F.roleOz.base || {}).median || 2) * 0.9), req: true });
          continue;
        }
        const bases = chooseBase(F, famId, intent, rng, greedy, Math.max(1, count), notes);
        for (const id of bases) lines.push({ id, role: 'base' });
        continue;
      }
      if (role === 'lengthener' && (intent.style.long || intent.style.hot)) count = Math.max(count, 1);
      if (role === 'rich' && intent.style.creamy) count = Math.max(count, 1);
      if (role === 'sour' && (F.roleCount.sour || [1])[0] < 0.5 && !intent.style.hot) count = Math.max(count, 1);
      count = Math.min(count, role === 'accent' ? 3 : role === 'lengthener' ? 1 : 2);
      for (let i = 0; i < count; i++) {
        if (lines.length >= maxIngr) break;
        const base = role === 'lengthener' && intent.style.hot ? ['hot-water', 'coffee', 'black-tea'] : (byRole[role] || []);
        const pool = base.filter(id => !ids().includes(id) && !forbidden(id, intent) && !conflicts(id, ids()));
        let scored = pool.map(id => ({ item: id, s: candidateScore(id, role, F, intent, ids()) }));
        if (role === 'lengthener' && intent.style.hot) scored = scored.filter(x => ['hot-water', 'coffee', 'black-tea'].includes(x.item)).map(x => ({ ...x, s: x.s + 3 }));
        if (role === 'lengthener' && !intent.style.hot) scored = scored.filter(x => x.item !== 'hot-water');
        const pick = softPick(rng, scored, 0.75, greedy);
        if (pick) lines.push({ id: pick, role });
      }
    }
    return lines;
  }

  function buildRiff(src, intent, rng, greedy, notes) {
    const lines = src.ingredients
      .filter(l => ingMap.has(l.id))
      .map(l => ({ id: l.id, role: roleOf(l, ingMap.get(l.id)), oz: lineOz(l, ingMap.get(l.id), units) / (src.servings || 1), float: l.float, garnish: l.garnish }));
    const changes = [];
    const ids = () => lines.map(l => l.id);
    // Replace unusable/forbidden ingredients with the closest allowed substitute.
    let teaUsed = false;
    for (const l of lines) {
      const ing = ingMap.get(l.id);
      if (!forbidden(l.id, intent)) continue;
      if (intent.style.zeroProof && ing.role === 'base' && !teaUsed && !l.float && !forbidden('black-tea', intent)) {
        changes.push(`strong black tea stands in for the ${prose(l.id)}`);
        l.id = 'black-tea'; l.role = 'juice'; l.req = true; teaUsed = true;
        continue;
      }
      const subs = [...(ing.subs || []), ...(intent.style.zeroProof && NA_SWAP[l.id] ? [NA_SWAP[l.id]] : [])];
      const sub = subs.find(s => !forbidden(s, intent) && !ids().includes(s));
      if (sub) { changes.push(`swapped ${ingMap.get(l.id).name.toLowerCase()} for ${ingMap.get(sub).name.toLowerCase()}`); l.id = sub; l.role = ingMap.get(sub).role; }
      else { changes.push(`dropped ${ing.name.toLowerCase()}`); l.drop = true; }
    }
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].drop) lines.splice(i, 1);
    // Swap the base to requested spirits.
    const requested = [...intent.spirits.filter(x => x !== 'rum'), ...Object.keys(intent.ings).filter(id => (ingMap.get(id) || {}).cat === 'rum' && intent.ings[id] >= 1)]
      .filter(id => !forbidden(id, intent) && !ids().includes(id));
    if (requested.length) {
      const bases = lines.filter(l => l.role === 'base' && !l.float).sort((a, b) => b.oz - a.oz);
      requested.forEach((id, i) => {
        const target = bases[i];
        if (target) {
          changes.push(`${ingMap.get(id).name.toLowerCase()} takes over from ${ingMap.get(target.id).name.toLowerCase()}`);
          target.id = id;
        } else {
          lines.push({ id, role: 'base', oz: 0.75 });
          changes.push(`added ${ingMap.get(id).name.toLowerCase()}`);
        }
      });
    }
    // Inject requested flavors / ingredients that aren't already there.
    injectRequests(lines, model.families[src.family], intent, rng, greedy, changes);
    if (intent.sweetness) changes.push(intent.sweetness < 0 ? 'rebalanced drier' : 'rebalanced sweeter');
    if (intent.strength) changes.push(intent.strength < 0 ? 'eased back the proof' : 'pushed the proof up');
    if (intent.tartness) changes.push('sharpened the citrus');
    // Nothing asked for (or only a rebalance)? Make a genuine variation rather than handing back the original.
    if (!changes.length) varyOne(lines, model.families[src.family], intent, rng, greedy, changes);
    notes.push(...changes.map(c => "riff:" + c));
    return lines;
  }

  const swappedOut = new Set();
  function varyOne(lines, F, intent, rng, greedy, changes) {
    const swappable = lines.filter(l => ['sweet', 'modifier', 'base', 'juice'].includes(l.role) && !l.float && !l.garnish && !l.req && !intent.ings[l.id] && intentMatch(l.id, intent) < 0.8);
    if (!swappable.length) return;
    // Seed 0 varies the most characterful modifier; later seeds roam.
    const smallest = r => swappable.filter(l => l.role === r).sort((a, b) => (a.oz ?? 0) - (b.oz ?? 0))[0];
    const victim = greedy
      ? ['modifier', 'sweet', 'juice', 'base'].map(smallest).find(Boolean)
      : swappable[Math.floor(rng() * swappable.length)];
    const others = lines.filter(l => l !== victim).map(l => l.id);
    // A real variation changes flavor: no swapping within the victim's own group (curaçao → triple sec).
    const pool = (byRole[victim.role] || []).filter(id => id !== victim.id && !others.includes(id) && !forbidden(id, intent) && !conflicts(id, others) && !conflicts(id, [victim.id]));
    const plain = id => { const f = ingMap.get(id).flavors || []; return f.length === 1 && f[0] === 'sweet'; };
    const scored = pool.filter(id => !swappedOut.has(id)).map(id => ({
      item: id,
      s: candidateScore(id, victim.role, F, intent, others) + 0.6 * tagAffinity(id, victim.id) + 1.5 * intentMatch(id, intent) - (plain(id) && !plain(victim.id) ? 5 : 0),
    }));
    const pick = softPick(rng, scored, 0.6, greedy);
    if (!pick) return;
    changes.push(`swapped ${ingMap.get(victim.id).name.toLowerCase()} for ${ingMap.get(pick).name.toLowerCase()}`);
    swappedOut.add(victim.id);
    victim.id = pick;
    victim.oz = undefined;
  }

  // A flavor counts as present only if some ingredient carries it prominently.
  function flavorCoverage(lines, tag) {
    let best = 0;
    for (const l of lines) best = Math.max(best, (ingVec[l.id] || {})[tag] || 0);
    return best >= 0.55 ? best : 0;
  }

  function injectRequests(lines, F, intent, rng, greedy, changes) {
    const ids = () => lines.map(l => l.id);
    // Explicit ingredient asks.
    for (const [id, w] of Object.entries(intent.ings).sort((a, b) => b[1] - a[1])) {
      if (w < 1.5 || ids().includes(id) || forbidden(id, intent)) continue;
      const ing = ingMap.get(id);
      if (ing.cat === 'rum') continue;
      const clash = lines.findIndex(l => conflicts(id, [l.id]));
      if (clash >= 0) { changes.push(`swapped ${ingMap.get(lines[clash].id).name.toLowerCase()} for ${ing.name.toLowerCase()}`); lines[clash] = { id, role: ing.role, req: true }; }
      else { lines.push({ id, role: ing.role, req: true }); changes.push(`added ${ing.name.toLowerCase()}`); }
    }
    // Flavor asks: make sure each strongly requested tag is carried by something.
    const asks = Object.entries(intent.tags).filter(([t, w]) => w >= 1.4 && !['light', 'crisp', 'boozy', 'dry', 'rich', 'tart', 'sweet', 'warm', 'effervescent', 'fruity', 'tropical'].includes(t)).sort((a, b) => b[1] - a[1]);
    for (const [tag] of asks) {
      if (flavorCoverage(lines, tag) > 0) continue;
      const pool = vocab.ingredients.filter(i => (i.flavors || []).includes(tag) && !forbidden(i.id, intent) && !ids().includes(i.id) && i.role !== 'base');
      const scored = pool.map(i => ({ item: i.id, s: candidateScore(i.id, i.role, F, intent, ids()) + (ingVec[i.id][tag] || 0) * 6 + (i.role === 'aromatic' ? -1.5 : 0) + (i.role === 'accent' && !['anise', 'bitter', 'salty'].includes(tag) ? -1 : 0) }));
      const pick = softPick(rng, scored, 0.6, greedy);
      if (!pick) continue;
      const ing = ingMap.get(pick);
      const clash = lines.findIndex(l => conflicts(pick, [l.id]));
      if (clash >= 0) {
        if (lines[clash].req) continue;
        changes.push(`swapped ${ingMap.get(lines[clash].id).name.toLowerCase()} for ${ing.name.toLowerCase()}`); lines[clash] = { id: pick, role: ing.role, req: true };
      } else {
        // Keep the drink from bloating: at the cap, trade out the least on-brief line of the same role
        // (or an accent) — never the drink's only sweetener or acid.
        const cap = Math.round((F.metrics.nIngredients.p90 || 8) + 1 + Math.max(0, intent.complexity));
        if (lines.filter(l => l.role !== 'aromatic').length >= cap) {
          const sameRole = r => lines.filter(l => l.role === r).length;
          const cands = lines.map((l, i) => ({ i, l })).filter(x => !x.l.req && (x.l.role === ing.role || x.l.role === 'accent') && !intent.ings[x.l.id] && !((x.l.role === 'sweet' || x.l.role === 'sour') && sameRole(x.l.role) <= 1));
          if (cands.length) {
            cands.sort((a, b) => intentMatch(a.l.id, intent) - intentMatch(b.l.id, intent));
            const out = cands[0];
            changes.push(`swapped ${ingMap.get(out.l.id).name.toLowerCase()} for ${ing.name.toLowerCase()}`);
            lines[out.i] = { id: pick, role: ing.role, req: true };
            continue;
          }
        }
        lines.push({ id: pick, role: ing.role, req: true });
        changes.push(`added ${ing.name.toLowerCase()} for ${tag.replace('-', ' ')}`);
      }
    }
  }

  // Every drink in a sour-based family needs an acid and a sugar source; creamy drinks need no dairy-curdling acid.
  function ensureStructure(lines, famId, intent) {
    const F = model.families[famId];
    const ids = () => lines.map(l => l.id);
    const has = pred => lines.some(l => pred(ingMap.get(l.id), l));
    const needAcid = F.metrics.acidConc && F.metrics.acidConc.median > 0.35 && !intent.style.hot;
    if (needAcid && !has(i => i.acid >= 2)) {
      const pick = ['lime', 'lemon', 'grapefruit'].filter(id => !forbidden(id, intent)).sort((a, b) => ((F.ingredients[b] || {}).share || 0) - ((F.ingredients[a] || {}).share || 0))[0];
      if (pick) lines.push({ id: pick, role: 'sour' });
    }
    const needSugar = F.metrics.sugarConc && F.metrics.sugarConc.median > 3;
    if (needSugar && !has((i, l) => i.sugar >= 25 && l.role !== 'base')) {
      const pool = (byRole.sweet || []).filter(id => !forbidden(id, intent) && !conflicts(id, ids()));
      const pick = softPick(() => 0.5, pool.map(id => ({ item: id, s: candidateScore(id, 'sweet', F, intent, ids()) })), 1, true);
      if (pick) lines.push({ id: pick, role: 'sweet' });
    }
    if (intent.sweetness < 0 && !has(i => i.acid >= 2) && !intent.style.hot && famId !== 'stirred' && !forbidden('lime', intent)) {
      lines.push({ id: 'lime', role: 'sour', oz: 0.375, req: true, note: 'a little lime to cut the sweetness' });
    }
    if (has(i => DAIRY.has(i.id)) && has(i => i.acid >= 2)) {
      for (const l of lines) if (DAIRY.has(l.id) && !forbidden('coconut-cream', intent) && !ids().includes('coconut-cream')) { l.id = 'coconut-cream'; l.role = 'rich'; }
    }
  }

  // ---------- dosing & balance ----------
  function initialDoses(lines, famId, intent) {
    const F = model.families[famId];
    const defaults = { sour: 0.75, juice: 1, sweet: 0.5, modifier: 0.5, rich: 1, accent: 0.03, lengthener: 2, aromatic: 0 };
    const bases = lines.filter(l => l.role === 'base');
    const baseTotal = (() => {
      const q = F.roleOz.base;
      let t = q ? q.median : 2;
      if (intent.strength) t *= 1 + 0.18 * intent.strength;
      if (q) t = Math.max(q.p10 * 0.9, Math.min(q.p90 * 1.15, t));
      if (famId === 'stirred' || intent.style.stirred) t = Math.max(t, 2);
      if (intent.strength >= 0 && !['colada', 'resort-punch'].includes(famId)) t = Math.max(t, 1.75);
      return Math.max(1, t);
    })();
    const splits = { 1: [1], 2: [0.55, 0.45], 3: [0.4, 0.35, 0.25], 4: [0.34, 0.26, 0.24, 0.16] };
    const sp = splits[Math.min(bases.length, 4)] || [];
    // Overproof and funky rums lead from behind.
    const ordered = [...bases].sort((a, b) => (ingMap.get(a.id).abv >= 60) - (ingMap.get(b.id).abv >= 60));
    ordered.forEach((l, i) => {
      if (l.oz !== undefined) return;
      let oz = baseTotal * (sp[i] || 0.2);
      const st = model.ingredients[l.id];
      if (ingMap.get(l.id).abv >= 60) oz = Math.min(oz, st ? Math.max(st.doseQ[1], 0.5) : 0.75);
      l.oz = oz;
    });
    for (const l of lines) {
      if (l.oz !== undefined) continue;
      const fi = F.ingredients[l.id], gi = model.ingredients[l.id];
      l.oz = (fi && fi.dose) || (gi && gi.dose) || defaults[l.role] || 0.5;
      if (l.role === 'accent' && ingMap.get(l.id).cat !== 'bitters' && !gi) l.oz = 0.06;
    }
    // Keep each role near the family's typical total.
    for (const role of ['sour', 'juice', 'sweet', 'modifier', 'rich']) {
      const rl = lines.filter(l => l.role === role && !l.range && !l.fromSpec);
      if (!rl.length) continue;
      const q = F.roleOz[role];
      if (!q || !q.median) continue;
      const total = rl.reduce((s, l) => s + l.oz, 0);
      const hi = Math.max(q.p75, q.median) * 1.2, lo = q.median * 0.6;
      // Only acid gets topped up to the family norm; liqueurs and juices only get trimmed.
      const k = total > hi ? hi / total : total < lo && role === 'sour' ? lo / total : 1;
      // Lines the prompt asked for keep a dose you can actually taste.
      rl.forEach(l => { l.oz *= l.req && k < 1 ? Math.max(k, 0.85) : k; });
    }
    for (const l of lines) {
      if (l.req && !l.fromSpec && ['modifier', 'sweet', 'juice'].includes(l.role)) l.oz = Math.max(l.oz, l.colorKey ? 0.75 : 0.5);
      l.oz0 = l.oz;
    }
  }

  function targetsFor(famId, intent, method, ice) {
    const m = model.families[famId].metrics;
    return {
      abvBand: intent.style.zeroProof ? null : [interpQ(m.abv, intent.strength - 1), interpQ(m.abv, intent.strength + 1)],
      abv: intent.style.zeroProof ? 0 : interpQ(m.abv, intent.strength),
      sugar: interpQ(m.sugarConc, intent.sweetness * 1.1 - (intent.tartness > 0 ? 0.3 : 0)),
      acid: (m.acidConc && m.acidConc.median > 0.25) ? interpQ(m.acidConc, intent.tartness * 1.1 - (intent.sweetness > 0 ? 0.3 : 0)) : null,
      vol: m.volOz,
      method, ice,
    };
  }

  // A riff keeps its parent's balance unless the prompt asks to move it.
  function riffTargets(src, famId, intent, svc) {
    const base = targetsFor(famId, intent, svc.method, svc.ice);
    const f = model.drinks[src.id];
    if (!f) return base;
    const abv = f.abv * (1 + 0.15 * intent.strength);
    return {
      ...base,
      abvBand: intent.style.zeroProof ? null : [abv * 0.9, abv * 1.1],
      abv: intent.style.zeroProof ? 0 : abv,
      sugar: f.sugarConc * (1 + 0.16 * intent.sweetness),
      acid: f.acidConc > 0.25 ? f.acidConc * (1 + 0.16 * intent.tartness) : null,
    };
  }

  // (leanBlend: this build's frozen drink was asked less sweet and is blended with less ice; set
  // per build in generateOnce, never carried from one prayer to the next.)
  let leanBlend = false;
  function chemOf(lines, method, ice) {
    return analyzeLines(lines.map(l => ({ id: l.id, amount: l.oz, unit: 'oz', garnish: l.role === 'aromatic' })), ingMap, units, { method, ice, lean: leanBlend && method === 'blend' });
  }

  // Levers are defined by chemistry, not by label: anything acidic moves acid, anything
  // sugary (syrups, liqueurs, cream of coconut) moves sugar. The spirit pour is the anchor —
  // concentrations alone can't fix a drink's size — and only moves if ABV leaves the family's band.
  function balance(lines, T) {
    const I = l => ingMap.get(l.id);
    const clampLine = l => {
      let lo = l.req ? l.oz0 * 0.8 : l.role === 'sweet' ? Math.min(0.08, l.oz0) : l.oz0 * 0.4;
      let hi = Math.max(l.oz0 * 2.5, 0.5);
      // An archetype's ranges are hard edges: a colada never thins its pineapple to a splash.
      if (l.range) { lo = Math.max(lo, l.range[0] * 0.85); hi = Math.min(hi, l.range[1] * 1.15); }
      l.oz = Math.max(lo, Math.min(hi, l.oz));
    };
    const acidLevers = lines.filter(l => I(l).acid >= 2 && l.role !== 'aromatic');
    let sugarLevers = lines.filter(l => l.role === 'sweet' && I(l).sugar >= 20);
    if (!sugarLevers.length) sugarLevers = lines.filter(l => I(l).sugar >= 20 && l.role !== 'base' && l.role !== 'aromatic');
    const base = lines.filter(l => l.role === 'base' && I(l).abv >= 30);
    const solve = () => {
      for (let iter = 0; iter < 12; iter++) {
        let c = chemOf(lines, T.method, T.ice);
        if (T.acid && acidLevers.length && c.acidConc > 0) {
          const k = Math.max(0.85, Math.min(1.2, (T.acid / c.acidConc) ** 0.9));
          acidLevers.forEach(l => { l.oz *= k; clampLine(l); });
        }
        c = chemOf(lines, T.method, T.ice);
        if (T.sugar && sugarLevers.length && c.sugarConc > 0) {
          const k = Math.max(0.82, Math.min(1.2, (T.sugar / c.sugarConc) ** 1.1));
          sugarLevers.forEach(l => { l.oz *= k; clampLine(l); });
        }
      }
    };
    solve();
    if (T.abvBand && base.length) {
      for (let pass = 0; pass < 3; pass++) {
        const c = chemOf(lines, T.method, T.ice);
        const [lo, hi] = T.abvBand;
        if (c.abv >= lo && c.abv <= hi) break;
        const k = c.abv > hi ? Math.max(0.8, hi / c.abv) : Math.min(1.25, lo / Math.max(c.abv, 0.1));
        base.forEach(l => { l.oz = Math.max(l.oz0 * 0.75, Math.min(l.oz0 * 1.35, l.oz * k)); });
        solve();
      }
    }
    // Keep the drink a sensible size: grow a thimble, trim a bucket (juicy lines first).
    let c2 = chemOf(lines, T.method, T.ice);
    if (T.vol && c2.volOz < T.vol.p25 * 0.8) {
      const k = Math.min(1.4, (T.vol.p25 * 0.9) / c2.volOz);
      lines.forEach(l => { if (['base', 'juice', 'lengthener', 'sour'].includes(l.role)) l.oz *= k; });
      solve();
      c2 = chemOf(lines, T.method, T.ice);
    }
    if (T.vol && c2.volOz > T.vol.p90 * 1.15) {
      const trim = lines.filter(l => ['juice', 'lengthener', 'rich'].includes(l.role) && !l.req);
      const trimVol = trim.reduce((a, l) => a + l.oz, 0);
      const excess = c2.volOz - T.vol.p90 * 1.1;
      if (trimVol > 0) trim.forEach(l => { l.oz = Math.max(l.oz0 * 0.5, l.oz - excess * (l.oz / trimVol)); });
    }
  }

  // Balance against a proven reference (the canonical spec the build started from, or the drink
  // being riffed): its sugar-to-acid ratio, moved by the prayer and kept inside the archetype's
  // band. "Less sweet", "very tart" and a frozen build are targets, not hints: the card has to
  // taste different from the reference. Only sweeteners and citrus move; spirits move only for
  // a stronger or gentler ask; liqueurs, juices and modifiers keep their spec doses. The body is
  // balanced on its own: a sink blooms into a drink that is already right, a float sits on it.
  function balanceTo(lines, ref, A, intent, svc, notes = [], refMethod = null) {
    const I = l => ingMap.get(l.id);
    const live = lines.filter(l => l.role !== 'aromatic' && !l.garnish);
    const edge = (l, lo, hi) => {
      let a = lo, b = hi;
      if (l.range) { a = Math.max(a, l.range[0] * 0.85); b = Math.min(b, l.range[1] * 1.15); }
      // An identity-core dose (a Mai Tai's half-ounce of orgeat) is a floor no balance moves under.
      if (l.min) { a = Math.max(a, l.min); b = Math.max(b, l.min); }
      l.oz = Math.max(Math.min(a, b), Math.min(b, l.oz));
    };
    const k = Math.max(-2, Math.min(2, intent.strength || 0));
    if (k && !intent.style.zeroProof) for (const l of live.filter(l => l.role === 'base' && !l.float)) { l.oz *= 1 + 0.12 * k; edge(l, l.oz0 * 0.75, l.oz0 * 1.3); }
    // Never past the archetype's own spirit range: a Zombie is already as strong as a drink should be.
    const baseCap = ((A.ratios || {}).baseOz || [])[1];
    const pour = live.filter(l => l.role === 'base' && !l.float && !l.sink);
    const poured = pour.reduce((t, l) => t + l.oz, 0);
    if (baseCap && poured > baseCap * 1.05) for (const l of pour) l.oz *= baseCap / poured;
    const sweet = Math.max(-2, Math.min(2, intent.sweetness || 0)), tart = Math.max(-2, Math.min(2, intent.tartness || 0));
    let finalR = null;
    const bodyOf = L => L.filter(l => !l.sink && !l.float);
    const chemBody = () => chemOf(bodyOf(lines), svc.method, svc.ice);
    const refChem = ref && ref.length ? chemOf(bodyOf(ref), refMethod || svc.method, svc.ice) : null;
    // (Don's Mix split into its parts moves as one: its cinnamon is never a lever of its own.)
    const sweetAll = live.filter(l => l.role === 'sweet' && I(l).sugar >= 20 && !l.sink && !l.float && !l.ratioOf);
    const sweetening = live.filter(l => !l.sink && !l.float && !l.ratioOf && l.role !== 'base' && I(l).sugar >= 20 && (l.role === 'sweet' || l.role === 'rich' || l.role === 'modifier'));
    const sour = live.filter(l => l.role === 'sour' && I(l).acid >= 2);
    const snapOz = () => live.map(l => l.oz).join();
    const was = new Map(live.map(l => [l, l.oz]));
    // A sweet drink with no acid at all, asked to be less sweet, gets a little lime.
    if (sweet <= -1 && !sour.length && !['stirred', 'hot'].includes(A.family) && !(A.forbidden || []).includes('lime') && ingMap.has('lime') && !forbidden('lime', intent)) {
      const l = { id: 'lime', role: 'sour', oz: 0.5, oz0: 0.5, slot: 'asked', req: true };
      lines.push(l); live.push(l); sour.push(l);
      notes.push('½ oz of lime to cut the sweetness');
    }
    // "Tart" moves the citrus itself.
    if (tart > 0) for (const l of sour) { l.oz *= 1 + 0.18 * tart; edge(l, l.oz0, Math.max(l.oz0 * 1.5, 1.25)); }
    const band = (A.ratios || {}).sugarToAcid;
    let R = refChem && refChem.sweetSour ? refChem.sweetSour : band ? (band[0] + band[1]) / 2 : null;
    // A frozen drink drinks colder and wetter than the shaken spec: it wants more sugar.
    const frozenNow = svc.method === 'blend', frozenRef = refMethod === 'blend';
    const tiers = sw => [sw.filter(l => PLAIN.has(l.id) && !l.req), sw.filter(l => !PLAIN.has(l.id) && !l.req), sw.filter(l => l.req)];
    const lower = l => sweet < 0 ? Math.max(0.1, l.oz0 * (l.req ? 0.6 : 0.4)) : l.req ? l.oz0 * 0.85 : Math.max(0.1, l.oz0 * 0.5);
    // "Less sweet" never adds sugar back, whatever the ratio wants.
    const upper = l => sweet <= -0.6 ? l.oz0 : Math.min(doseCap(l.id, A.family, (intent.ings[l.id] || 0) >= 1), Math.max(0.25, l.oz0 * (frozenNow && !frozenRef ? 2 : 1.6)));
    const move = (levers, f) => {
      for (const tier of tiers(levers)) {
        const s0 = snapOz();
        for (const l of tier) { l.oz *= f; edge(l, lower(l), upper(l)); }
        if (snapOz() !== s0) return true;
      }
      return false;
    };
    const c0 = chemBody();
    if (R && c0.acidG >= 0.05) {
      R *= Math.exp(0.22 * sweet - 0.14 * tart);
      if (frozenNow && !frozenRef) R *= 1.3;
      if (band) R = Math.max(band[0] * (sweet < 0 || tart > 0 ? 0.7 : 0.9), Math.min(band[1] * (sweet > 0 || frozenNow ? 1.35 : 1.1), R));
      // Inside the family's window too, where it overlaps the archetype's (a Hemingway stays
      // tart, a Mai Tai doesn't drift sharp), unless the guest asked to move it.
      const W = famWin(A.family).sugarToAcid;
      if (W && Math.abs(sweet) < 0.6 && Math.abs(tart) < 0.6 && !frozenNow) {
        const lo = band ? Math.max(band[0], W[0]) : W[0], hi = band ? Math.min(band[1], W[1]) : W[1];
        if (lo <= hi) R = Math.max(lo * 1.03, Math.min(hi * 0.97, R));
      }
      // An ask lands in its end of the family's window, however sweet the reference was: "very
      // tart" is in the lower third, "sweet" in the upper.
      if (W && (sweet <= -0.6 || tart >= 0.6)) R = Math.min(R, W[0] + (W[1] - W[0]) * 0.3);
      if (W && sweet >= 0.6 && tart <= 0) R = Math.max(R, W[0] + (W[1] - W[0]) * 0.7);
      finalR = R;
      for (let iter = 0; iter < 30; iter++) {
        const c = chemBody();
        if (c.acidG < 0.05) break;
        const r = c.sugarG / c.acidG;
        if (Math.abs(r / R - 1) < 0.04) break;
        const f = Math.max(0.85, Math.min(1.18, (R / r) ** 0.8));
        if (move(sweetAll.length ? sweetAll : sweetening, f)) continue;
        // Sugar can't move any further: the citrus does, a little.
        const before = snapOz();
        const g = Math.max(0.9, Math.min(1.1, (r / R) ** 0.8));
        for (const l of sour) { l.oz *= g; edge(l, l.oz0 * (tart > 0 || sweet <= -0.6 ? 1 : 0.75), Math.max(l.oz0 * (tart > 0 ? 1.5 : 1.25), tart > 0 ? 1.25 : 0)); }
        if (snapOz() === before) break;
      }
      // "Less sweet" is less sugar in the glass, not just more acid beside it: at least 15% under
      // the reference for each step of the ask.
      if (sweet <= -0.6 && refChem && refChem.sugarConc > 0) {
        const S = refChem.sugarConc * (1 - Math.min(0.35, 0.18 * -sweet));
        for (let iter = 0; iter < 12 && chemBody().sugarConc > S; iter++) if (!move(sweetening, 0.9)) break;
        const c = chemBody();
        if (c.acidG > 0.05) R = c.sugarG / c.acidG;
      }
      // "Tart" is more acid in the glass than the reference had, not just less sugar beside it.
      if (tart >= 0.6 && refChem && refChem.acidConc > 0 && sour.length) {
        const T = refChem.acidConc * (1 + Math.min(0.4, 0.15 * tart));
        for (let iter = 0; iter < 10 && chemBody().acidConc < T; iter++) {
          const before = snapOz();
          for (const l of sour) l.oz = Math.min(1.25, l.oz * 1.08);
          if (snapOz() === before) break;
        }
        for (const l of sour) l.oz0 = Math.max(l.oz0, l.oz);
        const c = chemBody();
        if (c.acidG > 0.05) R = Math.min(R, c.sugarG / c.acidG);
      }
      // A frozen drink under 8 g of sugar per 100 ml tastes like sour shaved ice.
      if (frozenNow) for (let iter = 0; iter < 12 && chemBody().sugarConc < 8.6; iter++) if (!move(sweetAll.length ? sweetAll : sweetening, 1.12)) break;
      // And a sour is sour: at least half a gram of acid per 100 ml (0.55 frozen), the citrus
      // raised to as much as an ounce and a quarter.
      const acidFloor = frozenNow ? 0.55 : 0.5;
      if (band && band[1] < 30 && !sour.length && chemBody().acidConc < acidFloor && ingMap.has('lime') && !forbidden('lime', intent) && !(A.forbidden || []).includes('lime')) {
        const l = { id: 'lime', role: 'sour', oz: 0.5, oz0: 0.5, slot: 'citrus', req: true };
        lines.push(l); live.push(l); sour.push(l);
        notes.push('½ oz of lime, so it drinks like a punch and not a glass of juice');
      }
      if (band && band[1] < 30) for (let iter = 0; iter < 10 && chemBody().acidConc < acidFloor; iter++) {
        const before = snapOz();
        for (const l of sour) { l.oz = Math.min(Math.max(1.25, l.oz0), l.oz * 1.12); }
        if (snapOz() === before) break;
      }
    } else {
      // No acid to balance against (a hot buttered rum, a stirred drink): hold the sugar near the
      // reference's, or near what the research says a hot drink wants (3–7 g per 100 ml).
      let S = refChem && refChem.sugarConc > 0.5 ? refChem.sugarConc : A.family === 'hot' ? 5 : null;
      if (A.family === 'hot') S = Math.max(3.5, Math.min(7, S || 5));
      if (S) {
        S *= Math.exp(0.25 * sweet);
        for (let iter = 0; iter < 20; iter++) {
          const c = chemBody();
          if (!c.sugarConc || Math.abs(c.sugarConc / S - 1) < 0.05) break;
          if (!move(sweetAll.length ? sweetAll : sweetening, Math.max(0.85, Math.min(1.2, S / c.sugarConc)))) break;
        }
      }
    }
    // Say what the ask changed, in bartender words.
    const changed = (L, dir) => L.filter(l => was.has(l) && (dir < 0 ? l.oz < was.get(l) - 0.09 : l.oz > was.get(l) + 0.09));
    const less = changed(sweetening, -1), more = changed(sour, 1);
    if (sweet < 0 && less.length) notes.push(`less ${list(less.map(l => prose(l.id)))}, so it's less sweet`);
    if (tart > 0 && more.length) notes.push(`more ${list(more.map(l => prose(l.id)))}, so it's tarter`);
    if (frozenNow && !frozenRef && changed(sweetening, 1).length) notes.push('a little more sugar, because a frozen drink tastes less sweet');
    return finalR;
  }

  // Rounding to bar measures (quarter ounces, teaspoons) can undo a balance: nudge one sweetener
  // or citrus a measure at a time toward the target ratio while that gets closer.
  function settle(lines, T, A, intent, svc) {
    if (!T) return;
    const I = l => ingMap.get(l.id);
    const levers = lines.filter(l => !l.garnish && !l.float && !l.sink && !l.muddled && l.role !== 'aromatic' && l.unit !== 'piece'
      && ((l.role === 'sweet' && I(l).sugar >= 20) || (l.role === 'sour' && I(l).acid >= 2)));
    const err = () => { const c = chemOf(lines.filter(l => !l.sink && !l.float), svc.method, svc.ice); return c.acidG > 0.05 ? Math.abs(Math.log(c.sugarG / c.acidG / T)) : 0; };
    const stirred = svc.method === 'stir';
    for (let k = 0; k < 4; k++) {
      const e0 = err();
      if (e0 < 0.07) return;
      let best = null;
      for (const l of levers) for (const d of [1, -1]) {
        // Never against the guest's ask: no sugar back into "less sweet", no citrus out of "tart".
        if ((intent.sweetness || 0) <= -0.6 && d > 0 && l.role === 'sweet') continue;
        if (((intent.tartness || 0) >= 0.6 || (intent.sweetness || 0) <= -0.6) && d < 0 && l.role === 'sour') continue;
        const keep = { oz: l.oz, amount: l.amount, unit: l.unit };
        const step = l.oz >= 0.5 || (d > 0 && l.oz >= 0.33) ? 0.25 : 1 / 12;
        const floor = Math.max(l.min || 0, l.taste || 0, l.role === 'sour' ? 0.25 : stirred ? 1 / 12 : 0.25);
        if (l.ratioOf) continue;
        const cap = Math.min(doseCap(l.id, A.family, (intent.ings[l.id] || 0) >= 1), l.range ? l.range[1] * 1.25 : Infinity, l.role === 'sour' ? (svc.method === 'hot' ? 0.5 : 1.5) : Infinity);
        const next = l.oz + d * step;
        if (next < floor - 0.01 || next > cap + 0.01) continue;
        l.oz = next; finalizeAmounts([l]);
        const e1 = err();
        if (e1 < e0 - 0.03 && (!best || e1 < best.e)) best = { l, oz: l.oz, amount: l.amount, unit: l.unit, e: e1 };
        Object.assign(l, keep);
      }
      if (!best) return;
      Object.assign(best.l, { oz: best.oz, amount: best.amount, unit: best.unit });
    }
  }

  // A color the guest asked for has to be in the glass. Try, in order: refill a slot with a
  // bottle of that color, open an optional slot for one, lighten a slot whose bottle muddies
  // it (dark rum under blue curaçao turns the drink swamp-green), and as a last resort pour
  // the classic carrier for that color (a grenadine sunrise for red, blue curaçao for blue).
  // Each try is judged by the optics model on the finished doses.
  const LAST_RESORT = {
    red: { id: 'grenadine', oz: 0.5, sink: true }, pink: { id: 'grenadine', oz: 0.5, sink: true }, blue: { id: 'blue-curacao', oz: 0.75 },
    // Vivid colorants first (Aperol's orange, passion fruit's gold, a cassis sink's plum); a juice
    // only as the last of the last resorts.
    gold: { id: 'passion-fruit-syrup', oz: 0.5, alts: [{ id: 'yellow-chartreuse', oz: 0.5 }] }, orange: { id: 'aperol', oz: 0.5, alts: [{ id: 'passion-fruit-syrup', oz: 0.75 }, { id: 'orange', oz: 1 }] },
    // "Dark" is the body itself (black rum poured in, the base giving way), a float only on top of that.
    dark: { id: 'rum-black-blended', oz: 1, alts: [{ id: 'rum-black-overproof', oz: 0.5 }, { id: 'rum-black-blended', oz: 0.5, float: true }] },
    green: { id: 'melon-liqueur', oz: 0.75, alts: [{ id: 'green-chartreuse', oz: 0.5 }] }, purple: { id: 'creme-de-violette', oz: 0.5, alts: [{ id: 'creme-de-cassis', oz: 0.5, sink: true }] },
  };
  // (Dark is read in the body, L 0.3 or less: a black float over a golden drink is golden.)
  const bodyShows = (look, color) => color === 'dark' ? !!(look && look.body && hsl(look.body.hex).l <= 0.3) : showsColor(look, color);
  function colorPass(lines, A, intent, svc, notes) {
    const color = intent.color;
    if (!COLOR_TEST[color]) return true;
    const lookOf = L => { const c = chemOf(L, svc.method, svc.ice); return drinkLook(L, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: c.finalOz - c.volOz }); };
    const showsColor = bodyShows;
    // A demanded color that shows only as its dusty version (slate for blue) is cleaned up, if a
    // bottle that muddies it can come out; otherwise it stands.
    const satOf = L => hsl(lookOf(L).body.hex).s;
    const dull = ['blue', 'green', 'purple', 'pink', 'red'].includes(color) && satOf(lines) < 0.4;
    if (showsColor(lookOf(lines), color) && !dull) return true;
    const test = COLOR_TEST[color];
    const isCarrier = id => { const o = opticsOf(ingMap.get(id)); return o.tint >= 0.8 && test(hsl(o.hex)); };
    const ok = id => ingMap.has(id) && !forbidden(id, intent) && !(A.forbidden || []).includes(id);
    const slots = [...(A.signature || []), ...(A.optional || [])];
    const tries = [];
    // More of the color's own carrier and less of what fights it: a Blue Hawaii goes aqua with an
    // ounce of curaçao and less pineapple (half an ounce against three is sea-green).
    const carriers = lines.filter(l => !l.garnish && isCarrier(l.id) && !l.sink && !l.float);
    if (carriers.length) tries.push({ why: `more ${prose(carriers[0].id)} and less of what clouds it, for the color`, edit: L => {
      for (const c of carriers) { const x = L[lines.indexOf(c)]; if (x) x.oz = Math.max(x.oz, Math.min(1, doseCap(x.id, A.family, true))); }
      for (const l of lines) {
        if (isCarrier(l.id) || l.garnish || l.float || l.sink || !(l.oz > 1)) continue;
        const o = opticsOf(ingMap.get(l.id));
        if (o.tint < 0.3 && !(o.scatter > 0.05)) continue;
        const x = L[lines.indexOf(l)];
        if (x) x.oz = Math.max(l.range ? l.range[0] : 0, x.oz * 0.6, 1);
      }
    } });
    for (const l of lines) {
      if (l.req || l.garnish || !l.slot) continue;
      const slot = slots.find(c => (c.component || c.slot) === l.slot);
      if (!slot) continue;
      for (const id of slot.anyOf) if (id !== l.id && ok(id) && !lines.some(x => x.id === id) && isCarrier(id)) tries.push({ why: `${prose(id)} in place of ${prose(l.id)} for the color`, edit: L => { const x = L[lines.indexOf(l)]; if (!x) return; x.id = id; x.role = ingMap.get(id).role; x.oz = Math.min(x.oz, doseCap(id, A.family), slot.ozRange ? slot.ozRange[1] : Infinity); x.oz0 = x.oz; } });
    }
    for (const o of A.optional || []) {
      if (lines.filter(l => l.slot === o.slot).length >= (o.maxCount || 1)) continue;
      for (const id of o.anyOf) if (ok(id) && !lines.some(x => x.id === id) && isCarrier(id)) {
        const r = o.ozRange || [0.5, 0.75];
        tries.push({ why: `${prose(id)} for the color`, edit: L => { L.push({ id, role: ingMap.get(id).role, oz: r[1], slot: o.slot, range: r, req: true, float: !!o.float, sink: !!o.sink }); } });
      }
    }
    const muddy = lines.filter(l => !l.req && l.slot && opticsOf(ingMap.get(l.id)).tint >= 1 && !isCarrier(l.id));
    // A lighter stand-in must do the same job: a juice for a juice, never a second soda.
    const fizzy = lines.some(l => FIZZ.has(l.id));
    const sameJob = (from, to) => ingMap.get(to).role === ingMap.get(from).role && OVER(to) === OVER(from) && !(FIZZ.has(to) && fizzy && !FIZZ.has(from));
    for (const l of muddy) {
      const slot = slots.find(c => (c.component || c.slot) === l.slot);
      const clear = slot && slot.anyOf.filter(id => ok(id) && sameJob(l.id, id) && !lines.some(x => x.id === id) && opticsOf(ingMap.get(id)).tint < opticsOf(ingMap.get(l.id)).tint * 0.7).sort((x, y) => opticsOf(ingMap.get(x)).tint - opticsOf(ingMap.get(y)).tint);
      for (const alt of (clear || []).slice(0, 3)) tries.push({ why: `${prose(alt)} in place of ${prose(l.id)} so the color stays true`, edit: L => { const x = L[lines.indexOf(l)]; if (!x) return; x.id = alt; x.role = ingMap.get(alt).role; }, muddy: true });
    }
    // A bottle that muddies the demanded color (watermelon under blue curaçao is slate) comes out,
    // unless the guest named it or the frame can't be itself without it.
    const sigReq = (A.signature || []).filter(c => c.required);
    const soleIn = l => sigReq.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    for (const l of lines.filter(l => !l.garnish && !l.float && !l.sink && !l.muddled && l.role !== 'base' && !isCarrier(l.id) && !soleIn(l) && !((intent.ings[l.id] || 0) >= 1.5))) {
      const o = opticsOf(ingMap.get(l.id)), h = hsl(o.hex);
      if (o.tint < 1 || h.s < 0.3) continue;
      tries.push({ why: `no ${prose(l.id)}, so the ${color} stays true`, edit: L => { const x = L[lines.indexOf(l)]; if (x) x.drop = true; }, muddy: true });
    }
    // A dark float over a light color is mud on top: drop it.
    for (const l of lines.filter(l => (l.float || l.sink) && !l.req && !isCarrier(l.id) && !['dark', 'red', 'pink'].includes(color))) {
      tries.push({ why: `no ${prose(l.id)} ${l.float ? 'float' : 'sink'}, so the color stays true`, edit: L => { const x = L[lines.indexOf(l)]; if (x) x.drop = true; }, muddy: true });
    }
    const lr0 = LAST_RESORT[color];
    for (const lr of lr0 ? [lr0, ...(lr0.alts || [])] : []) if (ok(lr.id) && !lines.some(x => x.id === lr.id)) {
      tries.push({ why: lr.sink ? `${prose(lr.id)} sunk to the bottom for the color` : lr.float ? `a ${prose(lr.id)} float for the color` : `${prose(lr.id)} for the color`, edit: L => { L.push({ id: lr.id, role: ingMap.get(lr.id).role, oz: lr.oz, sink: !!lr.sink, float: !!lr.float, req: true, slot: 'color' }); } });
    }
    if (typeof process !== "undefined" && process.env && process.env.DEBUG_COLOR) console.log("colorPass", color, lines.map(l => `${l.id}${l.req ? "*" : ""}:${l.slot}`).join(" "), "tries:", tries.map(t => t.why).join(" / "));
    const clone = () => lines.map(l => ({ ...l }));
    // Single moves first, then a muddy fix paired with each color move.
    const plans = [...tries.filter(t => !t.muddy).map(t => [t]), ...tries.filter(t => t.muddy).flatMap(m => [[m], ...tries.filter(t => !t.muddy).map(t => [m, t])])];
    // The spirit budget holds through a color move: a strong liqueur that pours the color (green
    // Chartreuse at 55%) counts toward it, and the base gives way for it, never under an ounce.
    const spiritEq = L => L.filter(l => !l.garnish && !l.float && !l.sink && ((l.role === 'base' && (ingMap.get(l.id).abv || 0) > 0) || (l.role === 'modifier' && (ingMap.get(l.id).abv || 0) >= 45))).reduce((t, l) => t + (l.oz || 0) * (l.role === 'base' ? 1 : (ingMap.get(l.id).abv || 0) / 40), 0);
    const budget = Math.max(spiritEq(lines), A.family === 'zombie' || (intent.strength || 0) > 0 ? 3 : 2.5);
    const withinBudget = L => {
      for (let i = 0; i < 8 && spiritEq(L) > budget + 0.05; i++) {
        const body = L.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish && (ingMap.get(l.id).abv || 0) > 0);
        const b = body.filter(l => l.oz > 0.5 + 0.01).sort((x, y) => y.oz - x.oz)[0];
        if (!b || body.reduce((t, l) => t + l.oz, 0) - 0.25 < 1 - 0.01) break;
        b.oz -= 0.25;
      }
      return spiritEq(L) <= budget + 0.05;
    };
    const s0 = satOf(lines);
    // The first plan that shows the color wins; a dusty color keeps looking for a cleaner one.
    let best = null;
    for (const plan of dull && showsColor(lookOf(lines), color) ? plans.filter(p => p.length === 1 && p[0].muddy) : plans) {
      let L = clone();
      plan.forEach(t => t.edit(L));
      L = L.filter(x => !x.drop);
      if (!withinBudget(L)) continue;
      finalizeAmounts(L);
      if (!showsColor(lookOf(L), color)) continue;
      const sat = satOf(L);
      if (!best || sat > best.sat + 0.02) best = { L, plan, sat };
      if (!dull || sat >= 0.5) break;
    }
    if (best && (!dull || best.sat >= s0 + 0.1)) {
      lines.splice(0, lines.length, ...best.L);
      best.plan.forEach(t => notes.push(t.why));
      return true;
    }
    if (dull && showsColor(lookOf(lines), color)) return true;
    notes.push(`couldn't make it ${color} without wrecking it`);
    return false;
  }

  // A color the prayer only leans toward (a dragon leans red, a promotion gold, a floral prayer
  // pink) is a preference, never a demand: the same moves as colorPass, judged softly. A move
  // stays only if the drink gets visibly closer to the leaning, keeps its balance, its strength,
  // its size and its frame; otherwise the drink is poured as built. Carriers are real bottles of
  // that color (passion fruit and mango for gold, grenadine and hibiscus for red, guava and
  // pitaya for pink, violette for purple), never a loud blue or green the prayer didn't ask for.
  // Carriers are colorants, bottles that dye a drink, never the juice that is already the drink's
  // body: more pineapple "for a golden glow" only browns a rum drink further (the round-2 sheets
  // were more than half orange and copper). A leaning reaches for the vivid bottle that suits the
  // frame: passion fruit for gold, hibiscus and grenadine for red, a cassis sink for purple, melon
  // and Chartreuse for green, blue curaçao for blue.
  const LEAN_CARRIERS = {
    gold: ['passion-fruit-syrup', 'passion-fruit-liqueur', 'galliano', 'yellow-chartreuse', 'licor-43'],
    orange: ['passion-fruit-syrup', 'passion-fruit-liqueur', 'aperol', 'apricot-liqueur', 'guava-syrup'],
    red: ['grenadine', 'hibiscus-syrup', 'raspberry-syrup', 'fassionola', 'strawberry', 'pomegranate-juice', 'campari', 'cherry-heering', 'raspberry-liqueur', 'sloe-gin', 'watermelon-juice'],
    pink: ['guava-syrup', 'hibiscus-syrup', 'raspberry-syrup', 'pitaya-puree', 'strawberry', 'watermelon-juice', 'grenadine', 'li-hing-mui-syrup'],
    purple: ['creme-de-violette', 'butterfly-pea-tea', 'blackberry-liqueur', 'creme-de-cassis'],
    green: ['melon-liqueur', 'green-chartreuse'],
    blue: ['blue-curacao', 'butterfly-pea-tea'],
  };
  // The hue, saturation and lightness each leaning aims at: saturated, never the dusty version.
  const LEAN_AIM = { gold: [48, 0.9, 0.6], orange: [26, 0.9, 0.58], red: [354, 0.8, 0.47], pink: [338, 0.72, 0.62], purple: [290, 0.55, 0.45], green: [95, 0.65, 0.55], blue: [195, 0.7, 0.55] };
  const LEAN_WHY = { gold: 'for a golden glow', orange: 'for a sunset-orange glow', red: 'for a ruby blush', pink: 'for a pink blush', purple: 'for a violet tint', green: 'for a green glint', blue: 'for a blue glint' };
  // A leaning from the prayer's own moods when no concept gave one: a floral prayer leans pink,
  // a berry one red, a tropical one gold.
  function hueLean(intent, open = null) {
    // Of the prayer's color-bearing concepts, the most vivid leaning wins: a grandmother's garden
    // leans spring-green, not the grandparents' gold (gold is what an amber rum drink is already).
    const fromConcepts = (intent.concepts || []).map(id => (conceptById.get(id) || {}).color).filter(c => LEAN_AIM[c]);
    if (fromConcepts.length) { intent.leanSource = 'concept'; return fromConcepts.find(c => !['gold', 'orange'].includes(c)) || fromConcepts[0]; }
    if (intent.colorLean) { intent.leanSource = 'concept'; return LEAN_AIM[intent.colorLean] ? intent.colorLean : null; }
    // "Surprise me" is an invitation: the gods pick a color too.
    if (open) { intent.leanSource = 'surprise'; const pal = ['pink', 'red', 'green', 'blue', 'purple', 'gold']; return pal[Math.floor(open() * pal.length)]; }
    intent.leanSource = 'mood';
    const t = intent.tags || {};
    const w = (...ks) => Math.max(0, ...ks.map(k => t[k] || 0));
    // Only moods lean: a fruit the guest named (passion fruit, cherry) is poured anyway and brings
    // its own color. A tropical mood no longer leans gold: an amber rum drink is gold already.
    const cands = [['pink', w('floral') * 0.9], ['red', w('berry')]].filter(x => x[1] >= 0.75).sort((a, b) => b[1] - a[1]);
    return cands.length ? cands[0][0] : null;
  }
  function ownLean(lines, A) {
    let best = null, bw = 0;
    for (const l of lines) {
      if (l.garnish || l.float || l.sink || l.crown) continue;
      for (const lean of ['gold', 'orange', 'red', 'pink', 'purple', 'green', 'blue']) {
        if (!LEAN_CARRIERS[lean].includes(l.id) || (['red', 'pink'].includes(lean) && ['zombie', 'mai-tai'].includes(A.family))) continue;
        const w = (l.oz || 0) * opticsOf(ingMap.get(l.id)).tint;
        if (w > bw) { bw = w; best = lean; }
        break;
      }
    }
    return bw >= 0.3 ? best : null;
  }
  function leanScore(look, lean) {
    const [th, ts, tl] = LEAN_AIM[lean];
    const d = x => {
      const c = hsl(x.hex);
      const dh = c.h === null ? 180 : Math.min(Math.abs(c.h - th), 360 - Math.abs(c.h - th));
      // Darker than the leaning's color is mud, not ruby (pomegranate under black rum is mahogany).
      return dh / 90 + Math.max(0, ts - c.s) * 1.2 + Math.max(0, tl - 0.12 - c.l) * 2;
    };
    // The body is what the eye reads; a sink or float band counts for a little less.
    const bands = (look.layers || []).filter(x => x.kind !== 'foam' && x.kind !== 'crown' && (x.frac || 0) >= 0.12);
    return Math.min(d(look.body), ...bands.map(x => d(x) + 0.2));
  }
  function leanPass(lines, A, intent, svc, notes, target, lean, own = false) {
    if (!lean || !LEAN_AIM[lean]) return;
    // A leaning read only from the prayer's mood (a floral word) keeps the frame's own look: it
    // may only turn up a carrier the drink already pours.
    if (intent.leanSource === 'mood') own = true;
    const lookOf = L => { const c = chemOf(L, svc.method, svc.ice); return drinkLook(L, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: c.finalOz - c.volOz }); };
    const carrierSet = new Set(LEAN_CARRIERS[lean] || []);
    const ok = id => ingMap.has(id) && !forbidden(id, intent) && !(A.forbidden || []).includes(id) && !(A.forbidden || []).includes(`cat:${ingMap.get(id).cat}`) && !((intent.softAvoid || {})[id] >= 1);
    const fits = (id, L, except) => !L.some(x => x.id === id) && !conflicts(id, L.filter(x => x !== except && !x.garnish).map(x => x.id));
    const slots = [...(A.signature || []), ...(A.optional || [])];
    const why = LEAN_WHY[lean];
    const tries = [];
    // What the prayer was promised (the pirate's Demerara, dad's bourbon) or leans on stays put.
    const promised = new Set((intent.promises || []).flatMap(pr => pr.ids || []));
    const kept = l => l.req || promised.has(l.id) || ((intent.prefer || {})[l.id] || 0) >= 0.8;
    const sigReq = (A.signature || []).filter(c => c.required);
    const sole = l => sigReq.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    // More of the color's carrier already in the glass, up to its slot's ceiling (a quarter-ounce
    // of grenadine in a Port au Prince becomes a half).
    for (const l of lines) {
      if (l.garnish || l.float || l.sink || l.crown || !carrierSet.has(l.id)) continue;
      const slot = slots.find(c => (c.component || c.slot) === l.slot);
      // A bottle that exists for this very color (blue curaçao for a blue leaning) may go a
      // quarter-ounce past its slot, as the resort Blue Hawaii's full ounce does.
      const own = ingMap.get(l.id).color === lean ? 0.25 : 0;
      const cap = Math.min(doseCap(l.id, A.family, !!own), (slot && slot.ozRange ? slot.ozRange[1] : 0.75) + own, l.range ? l.range[1] + own : Infinity, own ? 1 : Infinity);
      if (cap >= l.oz + 0.2) tries.push({ on: l, id: l.id, cost: 0.02, why: `more ${prose(l.id)}, ${why}`, edit: L => { const x = L[lines.indexOf(l)]; if (x) { x.oz = cap; x.oz0 = Math.max(x.oz0 || 0, cap); } } });
    }
    // A dark brew poured as a backbone or a top (strong black tea in a zero-proof punch) gives a
    // warm carrier room to show: less of it, down to its slot's floor (never in a hot drink, where
    // the tea is the drink).
    if (['gold', 'orange', 'pink', 'red'].includes(lean) && svc.method !== 'hot') for (const l of lines) {
      const ing = ingMap.get(l.id), o = opticsOf(ing);
      if (kept(l) || l.garnish || l.float || l.sink || !l.slot || carrierSet.has(l.id) || (ing.abv || 0) > 0 || !(ing.cat === 'soda' || /tea|coffee/.test(l.id))) continue;
      if (o.tint < 1.2 || (o.scatter || 0) >= 0.5 || hsl(o.hex).l >= 0.5) continue;
      const slot = slots.find(c => (c.component || c.slot) === l.slot);
      const lo = Math.max(slot && slot.ozRange ? slot.ozRange[0] : l.oz, l.range ? l.range[0] : 0);
      if (l.oz >= lo + 0.5) tries.push({ on: l, cost: 0.03, why: `less ${prose(l.id)}, so the ${lean} shows`, edit: L => { const x = L[lines.indexOf(l)]; if (x) { x.oz = lo; x.oz0 = Math.min(x.oz0 || lo, lo); x.held = true; } } });
    }
    // A drink with no leaning of its own only gets more of the color it already carries.
    if (!own) {
      // Refill a slot with a bottle of that color (passion fruit syrup in place of simple syrup),
      // never trading away a color the drink already has (the strawberries in a fruit colada).
      const colored = id => Object.entries(LEAN_CARRIERS).some(([k, ids]) => k !== lean && ids.includes(id));
      for (const l of lines) {
        if (kept(l) || l.garnish || !l.slot || l.float || l.sink || l.crown || colored(l.id)) continue;
        const slot = slots.find(c => (c.component || c.slot) === l.slot);
        if (!slot) continue;
        const from = ingMap.get(l.id);
        for (const id of slot.anyOf) {
          if (id === l.id || !carrierSet.has(id) || !ok(id) || !fits(id, lines, l)) continue;
          // Same job only: a sweetener for a sweetener, a juice for a juice, never a spirit for a syrup.
          const to = ingMap.get(id);
          if (to.role !== from.role || (from.abv || 0) >= 30 && !((to.abv || 0) >= 30)) continue;
          if ((from.acid || 0) >= 2 && !((to.acid || 0) >= 2)) continue;
          // …and never at the cost of something the prayer asked for (allspice for a spiced prayer).
          if (intentMatch(id, intent) < intentMatch(l.id, intent) - 0.3) continue;
          tries.push({ on: l, id, cost: 0, why: `${prose(id)} in place of ${prose(l.id)}, ${why}`, edit: L => { const x = L[lines.indexOf(l)]; if (!x) return; x.id = id; x.role = to.role; x.oz = Math.min(x.oz, doseCap(id, A.family), slot.ozRange ? slot.ozRange[1] : Infinity); x.oz0 = x.oz; x.fromSpec = false; } });
        }
      }
      // Open an optional slot for one (a half-ounce of passion fruit, a hibiscus sink).
      for (const o of A.optional || []) {
        if (lines.filter(l => l.slot === o.slot).length >= (o.maxCount || 1)) continue;
        for (const id of o.anyOf) if (carrierSet.has(id) && ok(id) && fits(id, lines)) {
          const r = o.ozRange || [0.5, 0.75];
          const fl = !!o.float || /\bfloat\b/.test(o.slot), sk = !!o.sink || /\bsink\b/.test(o.slot);
          tries.push({ on: o, id, cost: 0.02, why: sk ? `${prose(id)} sunk to the bottom, ${why}` : `${prose(id)} ${why}`, edit: L => { L.push({ id, role: ingMap.get(id).role, oz: (r[0] + r[1]) / 2, oz0: (r[0] + r[1]) / 2, slot: o.slot, range: r, float: fl, sink: sk }); } });
        }
      }
      // The ways a bartender works a colored bottle in without a slot for it: a colored syrup takes
      // the plain syrup's job (passion fruit for simple), a colored juice trades part of the main
      // juice (mango for some of the pineapple), or a modest pour of a colored liqueur.
      const stirredish = svc.method === 'stir' || A.family === 'stirred' || svc.method === 'hot';
      const plain = lines.find(l => PLAIN.has(l.id) && !kept(l) && !l.sink && !l.float);
      const mainJuice = lines.filter(l => l.role === 'juice' && !kept(l) && !l.sink && !l.float && l.oz >= 1.5).sort((x, y) => y.oz - x.oz)[0];
      for (const id of carrierSet) {
        if (!ok(id) || lines.some(x => x.id === id)) continue;
        const role = ingMap.get(id).role;
        if (role === 'sweet' && plain && fits(id, lines, plain) && !tries.some(t => t.id === id)) {
          tries.push({ on: plain, id, cost: 0.02, why: `${prose(id)} in place of ${prose(plain.id)}, ${why}`, edit: L => { const x = L[lines.indexOf(plain)]; if (!x) return; x.id = id; x.role = role; x.oz = Math.min(Math.max(x.oz, 0.5), doseCap(id, A.family)); x.oz0 = x.oz; x.range = null; x.fromSpec = false; } });
        } else if (role === 'juice' && mainJuice && !stirredish && fits(id, lines) && (opticsOf(ingMap.get(id)).tint || 0) >= 1.2) {
          // Only a juice that really dyes (pomegranate, watermelon) trades in, never one more cloudy nectar.
          const oz = Math.min(1, Math.max(0.5, Math.round(mainJuice.oz / 3 * 4) / 4));
          tries.push({ on: mainJuice, id, cost: 0.03, why: `${oz} oz of the ${prose(mainJuice.id)} traded for ${prose(id)}, ${why}`, edit: L => { const x = L[lines.indexOf(mainJuice)]; if (!x) return; x.oz -= oz; if (x.range) x.range = [Math.min(x.range[0], x.oz), x.range[1]]; L.push({ id, role, oz, oz0: oz, slot: 'color', range: null }); } });
        } else if (role === 'modifier' && fits(id, lines) && (!(ingMap.get(id).color === 'blue' || ingMap.get(id).color === 'green') || ingMap.get(id).color === lean) && !stirredish
          // A liqueur joins only a drink it belongs in (no Galliano in a Mai Tai).
          // (A prayer whose reading carries the color, a dragon's red, may reach a little further.)
          && compat(id, lines.filter(l => !l.garnish).map(l => l.id)) >= (intent.leanSource === 'concept' ? 0.05 : 0.15) && intentMatch(id, intent) >= 0) {
          tries.push({ on: 'modifier', id, cost: 0.06, why: `½ oz of ${prose(id)} ${why}`, edit: L => { L.push({ id, role, oz: 0.5, oz0: 0.5, slot: 'color', range: null }); } });
        }
      }
      // A colored liqueur may take an uncolored accent liqueur's place (green Chartreuse for the
      // maraschino in a garden daiquiri: a Last Word's pairing), at the accent's dose or half an ounce.
      for (const l of lines) {
        const from = ingMap.get(l.id);
        if (kept(l) || l.garnish || l.float || l.sink || l.role !== 'modifier' || carrierSet.has(l.id) || colored(l.id) || sole(l) || (opticsOf(from).tint || 0) >= 0.8) continue;
        for (const id of carrierSet) {
          const to = ingMap.get(id);
          if (!to || !ok(id) || to.role !== 'modifier' || !fits(id, lines, l) || stirredish && (to.color === 'blue' || to.color === 'green')) continue;
          const oz = Math.min(Math.max(l.oz, 0.5), doseCap(id, A.family));
          tries.push({ on: l, id, cost: 0.04, why: `${prose(id)} in place of ${prose(l.id)}, ${why}`, edit: L => { const x = L[lines.indexOf(l)]; if (!x) return; x.id = id; x.role = to.role; x.oz = oz; x.oz0 = oz; x.fromSpec = false; x.range = null; } });
        }
      }
      // A bright leaning wants a bright spirit: a dark rum that isn't the guest's (or the frame's
      // only) rum gives way to a golder one that does the same job.
      const fizzy = lines.some(l => FIZZ.has(l.id));
      const sameJob = (from, to) => ingMap.get(to).role === ingMap.get(from).role && OVER(to) === OVER(from) && !(FIZZ.has(to) && fizzy && !FIZZ.has(from));
      // (A red leaning counts: an aged rum turns hibiscus to brick.)
      const warm = ['gold', 'orange', 'pink', 'red'].includes(lean);
      // A cool leaning is clouded by a yellow-green bottle too (lime cordial under blue curaçao).
      const cool = ['blue', 'purple'].includes(lean), yellowish = hx => { const c = hsl(hx); return c.h !== null && c.h >= 30 && c.h < 100 && c.s > 0.3; };
      // Muddy means a brown bottle (a dark rum, an amaro), never another color's carrier (Campari).
      const muddy = lines.filter(l => { const o = opticsOf(ingMap.get(l.id)); return !kept(l) && l.slot && !l.float && !l.sink && !carrierSet.has(l.id) && !(colored(l.id) && !(cool && yellowish(o.hex))) && (o.tint >= 1.8 && hsl(o.hex).l < 0.35 || warm && o.tint >= 1.5 && hsl(o.hex).l < 0.5 || cool && o.tint >= 0.8 && o.scatter < 0.5 && yellowish(o.hex)); });
      for (const l of muddy) {
        const slot = slots.find(c => (c.component || c.slot) === l.slot);
        const tl = opticsOf(ingMap.get(l.id)).tint;
        const clear = slot ? slot.anyOf.filter(id => ok(id) && sameJob(l.id, id) && fits(id, lines, l) && !lines.some(x => x !== l && x.role === 'base' && !x.float && spiritOrigin(x.id) === spiritOrigin(id)) && intentMatch(id, intent) >= intentMatch(l.id, intent) - 0.15 && opticsOf(ingMap.get(id)).tint < tl * 0.8 && hsl(opticsOf(ingMap.get(id)).hex).l >= 0.4 && !(cool && yellowish(opticsOf(ingMap.get(id)).hex) && opticsOf(ingMap.get(id)).tint >= 0.5)) : [];
        for (const alt of clear.sort((x, y) => opticsOf(ingMap.get(y)).tint - opticsOf(ingMap.get(x)).tint).slice(0, 2)) tries.push({ cost: 0.04, muddy: true, why: `${prose(alt)} in place of ${prose(l.id)}, so it glows`, edit: L => { const x = L[lines.indexOf(l)]; if (!x) return; x.id = alt; x.role = ingMap.get(alt).role; } });
        // A colored sweetener beside a plain syrup folds into it (the lime cordial's half-ounce
        // becomes simple syrup), so the cool color isn't greened.
        const plainNow = lines.find(x => x !== l && PLAIN.has(x.id) && !x.sink && !x.float);
        if (cool && l.role === 'sweet' && plainNow && !clear.length) tries.push({ cost: 0.04, muddy: true, why: `${prose(plainNow.id)} in place of ${prose(l.id)}, so the ${lean} stays clean`, edit: L => { const x = L[lines.indexOf(l)], p = L[lines.indexOf(plainNow)]; if (!x || !p) return; p.oz += x.oz; p.oz0 = p.oz; x.drop = true; } });
      }
      // A cool leaning drowned by a cloudy yellow juice: less of the juice, inside its range
      // (a Blue Hawaii goes turquoise when the pineapple is cut to twice the curaçao; at six
      // times it is sea-green).
      if (['blue', 'green', 'purple'].includes(lean)) {
        const dye = lines.filter(l => carrierSet.has(l.id) && !l.float && !l.sink && !l.garnish).reduce((t, l) => t + l.oz, 0);
        for (const l of lines) {
          const o = opticsOf(ingMap.get(l.id)), h = hsl(o.hex).h;
          // A juice the prayer asked for (Hawaii's pineapple) is trimmed, never taken out.
          if (!dye || l.float || l.sink || l.garnish || l.role !== 'juice' || (o.scatter || 0) < 0.5 || h === null || h < 25 || h > 65) continue;
          const slot = slots.find(c => (c.component || c.slot) === l.slot);
          const lo = Math.max(slot && slot.ozRange ? slot.ozRange[0] : 1, l.range ? l.range[0] : 0, 1, Math.round(dye * 2 * 4) / 4);
          if (l.oz >= lo + 0.5) tries.push({ on: l, cost: 0.03, why: `less ${prose(l.id)}, so the ${lean} isn't clouded`, edit: L => { const x = L[lines.indexOf(l)]; if (x) { x.oz = lo; x.oz0 = Math.min(x.oz0 || lo, lo); x.held = true; } } });
        }
      }
      // Red and pink in a clear glass: a grenadine or hibiscus sink, the sunrise move.
      if (['red', 'pink', 'purple'].includes(lean) && !['hot', 'blend', 'stir'].includes(svc.method) && A.family !== 'stirred' && !lines.some(l => l.sink)) {
        for (const id of lean === 'purple' ? ['creme-de-cassis', 'blackberry-liqueur'] : ['grenadine', 'hibiscus-syrup']) if (ok(id) && fits(id, lines)) {
          tries.push({ on: 'sink', id, cost: 0.06, why: `${prose(id)} sunk to the bottom, ${why}`, edit: L => { L.push({ id, role: ingMap.get(id).role, oz: 0.5, oz0: 0.5, sink: true, slot: 'color', req: true }); } });
          break;
        }
      }
    }
    const DBG = typeof process !== 'undefined' && process.env && process.env.DEBUG_LEAN;
    if (!tries.length) return;
    const ratio = L => { const c = chemOf(L.filter(l => !l.sink && !l.float), svc.method, svc.ice); return c.acidG > 0.05 ? c.sugarG / c.acidG : null; };
    const look0 = lookOf(lines), c0 = chemOf(lines, svc.method, svc.ice), r0 = ratio(lines), s0 = leanScore(look0, lean);
    // A leaning read from the prayer's mood (a tropical prayer leans gold) never dims a drink that
    // already has a color of its own (a strawberry colada's blush).
    const b0 = hsl(look0.body.hex);
    if (!intent.colorLean && !own && b0.h !== null && b0.s >= 0.4 && (b0.h < 15 || b0.h >= 70) && leanScore(look0, lean) > 0.5) return;
    const T = target || r0;
    const err = r => (T && r ? Math.abs(Math.log(r / T)) : 0);
    const e0 = err(r0);
    // The family's sugar-to-acid window and component ceiling, as the critic reads them.
    // (A frozen drink sits sweeter for its acid: cold mutes sugar. The band pass squares it after.)
    const W0 = famWin(A.family).sugarToAcid, W = W0 && svc.method === 'blend' ? [W0[0], W0[1] * 1.3] : W0, maxN = Math.min(famWin(A.family).maxComponents || 11, 11);
    const count = L => L.filter(l => !l.garnish && !(l.role === 'aromatic' && !l.muddled)).length;
    const out0 = c0.sweetSour && W ? Math.max(0, Math.log(W[0] * 0.97 / c0.sweetSour), Math.log(c0.sweetSour / (W[1] * 1.03))) : 0;
    const clone = () => lines.map(l => ({ ...l }));
    // Single moves first; then the most promising moves in pairs (a hibiscus syrup for the plain
    // syrup and pomegranate for some of the pineapple), each with a muddy-rum fix.
    const moves = tries.filter(t => !t.muddy), muds = tries.filter(t => t.muddy);
    const apart = (a, b) => a.on !== b.on && (!a.id || a.id !== b.id);
    const singles = [...moves.map(t => [t]), ...muds.map(m => [m]), ...muds.flatMap(m => moves.filter(t => apart(m, t)).map(t => [m, t]))];
    const tried = new Map();
    let best = null;
    const runPlans = plans => { for (const plan of plans) {
      let L = clone();
      plan.forEach(t => t.edit(L));
      L = L.filter(x => !x.drop);
      finalizeAmounts(L);
      // A sweet carrier added on top pays for itself out of the plain syrup.
      const whole = X => chemOf(X, svc.method, svc.ice).sweetSour;
      if (T || W) for (let i = 0; i < 8 && (T && ratio(L) && Math.log(ratio(L) / T) > 0.06 || W && whole(L) > W[1] * 1.02 && whole(L) > (c0.sweetSour || 0)); i++) {
        const plain = L.filter(l => PLAIN.has(l.id) && !l.req && !l.sink && !l.float && l.oz > 0.1).sort((a, b) => b.oz - a.oz)[0];
        if (!plain) break;
        plain.oz = Math.max(0, plain.oz - (plain.oz > 0.3 ? 0.25 : 1 / 12));
        if (plain.oz < 0.08) L.splice(L.indexOf(plain), 1);
        finalizeAmounts(L);
      }
      // …and a tart one (passion fruit purée) out of the lime, never below the sour's floor.
      if (T) for (let i = 0; i < 6 && ratio(L) && Math.log(ratio(L) / T) < -0.06; i++) {
        const sour = L.filter(l => l.role === 'sour' && !l.req && !l.sink && !l.float && l.oz > Math.max(0.5, l.range ? l.range[0] : 0) + 0.06).sort((a, b) => b.oz - a.oz)[0];
        if (!sour) break;
        sour.oz = Math.max(0.5, sour.range ? sour.range[0] : 0, sour.oz - 0.125);
        finalizeAmounts(L);
      }
      settle(L, T, A, intent, svc);
      const c = chemOf(L, svc.method, svc.ice), look = lookOf(L), body = hsl(look.body.hex);
      const out = c.sweetSour && W ? Math.max(0, Math.log(W[0] * 0.97 / c.sweetSour), Math.log(c.sweetSour / (W[1] * 1.03))) : 0;
      // Off the spec's ratio is fine when the move brings a drink that sat outside its family's
      // window back toward it (and the guest asked for no particular sweetness).
      const mended = Math.abs(intent.sweetness || 0) < 0.5 && Math.abs(intent.tartness || 0) < 0.5 && out0 > 0.1 && out < out0 - 0.08;
      // …and inside the absolute band: a color is never bought with a cloying drink.
      const band = bandOf(L, A, intent, svc);
      const rej = err(ratio(L)) > Math.max(0.12, e0 + 0.04) && !mended || out > out0 + 0.01 || (c.sugarConc > band.sugar[1] + 0.2 && c.sugarConc > c0.sugarConc + 0.1) ? 'balance'
        : count(L) > Math.max(maxN, count(lines)) ? 'too many bottles'
        // A Zombie or a Mai Tai that reads red is grenadine abuse.
        : ['zombie', 'mai-tai'].includes(A.family) && (COLOR_TEST.red(body) || COLOR_TEST.pink(body)) ? 'red zombie'
        : !intent.style.zeroProof && c.abv < c0.abv * 0.85 ? 'abv' : c.volOz > c0.volOz * 1.15 + 0.25 ? 'volume'
        : !composer.satisfies(A, L, intent.ings, id => forbidden(id, intent)).ok ? 'frame' : null;
      const s = leanScore(look, lean) + plan.reduce((a, t) => a + t.cost, 0) + (plan.length - 1) * 0.05;
      if (DBG) console.log(`  lean ${lean} ${A.id}: ${plan.map(t => t.why).join(' + ')} ${rej || ''} ${s.toFixed(2)} vs ${s0.toFixed(2)} ${look.body.hex}`);
      if (plan.length === 1) tried.set(plan[0], { s, rej });
      if (rej) continue;
      if (s < s0 - (intent.leanSource === 'concept' ? 0.03 : 0.045) && (!best || s < best.s)) best = { s, L, plan };
    } };
    runPlans(singles);
    // A soft leaning stays soft: pairs only for a prayer that leans, never for a drink's own carrier.
    if (!own) {
      const top = moves.filter(t => tried.has(t) && !['frame', 'too many bottles'].includes(tried.get(t).rej) && tried.get(t).s < s0).sort((a, b) => tried.get(a).s - tried.get(b).s).slice(0, 5);
      const pairs = [];
      for (let i = 0; i < top.length; i++) for (let k = i + 1; k < top.length; k++) if (apart(top[i], top[k])) pairs.push([top[i], top[k]]);
      runPlans(pairs);
    }
    // A cool color keeps its proportion when a bigger glass is filled: the yellow juice that
    // would green it doesn't grow.
    const hold = L => { if (['blue', 'green', 'purple'].includes(lean)) for (const l of L) { const o = opticsOf(ingMap.get(l.id)), h = hsl(o.hex).h; if (l.role === 'juice' && (o.scatter || 0) >= 0.5 && h !== null && h >= 25 && h <= 65) l.held = true; } };
    if (!best) { hold(lines); return; }
    hold(best.L);
    lines.splice(0, lines.length, ...best.L);
    best.plan.forEach(t => notes.push(t.why));
  }

  // A low-ABV prayer means 7% or less on the card: liqueurs come down to half an ounce first
  // (they are sugar and alcohol), then the spirit (never below three-quarters of an ounce), then
  // the drink is lengthened with its own juice or soda, never with more wine.
  // It also holds the drink to about one standard drink (a low-ABV card reads "light", never "the
  // strength of a normal cocktail"), and it runs again after every later pass that moves doses.
  function gentle(lines, A, intent, svc, notes, quiet = false) {
    const T = 6.8, SD = 1.05;
    let c = chemOf(lines, svc.method, svc.ice);
    if (c.abv <= T && c.alcMl / 17.74 <= SD) return;
    for (const l of lines) if (l.role === 'lengthener' && (ingMap.get(l.id).abv || 0) > 0 && l.oz > 2) l.oz = 2;
    for (const l of lines) if (l.role === 'modifier' && (ingMap.get(l.id).abv || 0) >= 15 && l.oz > 0.5) l.oz = Math.max(0.5, l.oz * 0.6);
    c = chemOf(lines, svc.method, svc.ice);
    const bases = lines.filter(l => l.role === 'base' && !l.float && !l.sink);
    for (let i = 0; i < 12 && (c.abv > T || c.alcMl / 17.74 > SD); i++) {
      const total = bases.reduce((t, l) => t + l.oz, 0);
      if (total <= 0.8) break;
      // A bar measure at a time (an ounce becomes three-quarters, never 0.9 rounded back to one).
      for (const b of bases) b.oz = Math.max(bases.length > 1 ? 0.5 : 0.75, Math.min(b.oz * 0.9, rungDown(b.oz)));
      finalizeAmounts(bases);
      const c1 = chemOf(lines, svc.method, svc.ice);
      if (c1.alcMl >= c.alcMl - 0.01) { c = c1; break; }
      c = c1;
    }
    // Still past a standard drink: the wine top comes down before anything is lengthened.
    for (const l of lines) if (c.alcMl / 17.74 > SD && l.role === 'lengthener' && (ingMap.get(l.id).abv || 0) > 0 && l.oz > 1) { l.oz = Math.max(1, l.oz - 0.5); c = chemOf(lines, svc.method, svc.ice); }
    if (c.abv > T && !['hot', 'stir'].includes(svc.method)) {
      let top = svc.method !== 'blend' && lines.find(l => l.role === 'lengthener' && !(ingMap.get(l.id).abv > 0) && !l.float && !l.sink)
        || lines.filter(l => l.role === 'juice' && !l.sink && !l.float).sort((x, y) => y.oz - x.oz)[0];
      if (!top && svc.method !== 'blend' && !forbidden('soda-water', intent)) { top = { id: 'soda-water', role: 'lengthener', oz: 1, slot: 'top', req: true }; lines.push(top); }
      for (let i = 0; top && i < 10 && c.abv > T; i++) { top.oz += 0.5; c = chemOf(lines, svc.method, svc.ice); }
      if (top) finalizeAmounts([top]);
    }
    if (!quiet) notes.push(`kept gentle: about ${Math.round(c.abv)}% ABV`);
  }

  // ---------- what a pro fixes before pouring ----------
  // A recipe a bartender would pour without adjusting: one line per job (2½ oz Jamaican and
  // ½ oz Jamaican pot still is one Jamaican pour), at most one overproof in the body, at most
  // three spirits and two citruses, one fizzy top, and floats that are a float, not the base.
  const OVER = id => (ingMap.get(id).abv || 0) >= 60;
  const FIZZ = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda']);
  const spiritOrigin = id => {
    const m = /^rum-(jamaican|demerara|agricole)/.exec(id);
    if (m && !OVER(id)) return m[1];
    return { 'rum-white-column': 'light', 'rum-blended-light': 'light' }[id] || id;
  };
  function structure(lines, A, intent, notes, svc = null, anchor = null) {
    const body = () => lines.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish && ingMap.get(l.id).abv > 0);
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1);
    const asked = l => (intent.ings[l.id] || 0) >= 1 || (intent.spirits || []).includes(l.id);
    const fold = (from, into, why) => {
      into.oz += from.oz; into.oz0 = (into.oz0 || into.oz) + (from.oz0 || from.oz);
      if (into.range) into.range = [into.range[0], Math.max(into.range[1], into.oz)];
      lines.splice(lines.indexOf(from), 1);
      if (why) notes.push(why);
    };
    // Same origin, same job: one pour.
    for (const l of body()) {
      if (!lines.includes(l)) continue;
      const twin = body().find(x => x !== l && spiritOrigin(x.id) === spiritOrigin(l.id));
      if (!twin || (sole(l) && sole(twin))) continue;
      const [keep, drop] = sole(twin) && !sole(l) ? [twin, l] : sole(l) && !sole(twin) ? [l, twin] : (asked(twin) && !asked(l)) || twin.oz > l.oz ? [twin, l] : [l, twin];
      if (asked(drop)) continue;
      fold(drop, keep, `one ${prose(keep.id)} pour instead of two of the same kind`);
    }
    // A batter already is the butter and the sugar: no plain syrup, and no honey or maple padding
    // it out either (unless the guest asked for one by name).
    const batter = lines.find(l => ['hot-buttered-rum-batter', 'tom-and-jerry-batter'].includes(l.id));
    if (batter) for (const l of lines.filter(l => l.id === 'butter' || PLAIN.has(l.id) || (l.role === 'sweet' && l !== batter && !l.sink && !l.float && !asked(l)))) { lines.splice(lines.indexOf(l), 1); batter.oz = Math.min(1, batter.oz + l.oz * 0.5); notes.push(`no separate ${prose(l.id)}: the batter is the butter and the sugar`); }
    // Water is a line only when the drink is built over a block or batched: shaken, swizzled,
    // blended or built over ice, the ice is the water (two ounces more drowns a tart ask).
    if (svc && !intent.asWritten && !(svc.method === 'build' && svc.ice === 'block') && svc.method !== 'hot' && (intent.servings || 1) < 2) {
      for (const l of lines.filter(l => l.id === 'water' && !asked(l))) { lines.splice(lines.indexOf(l), 1); notes.push('no water line: the ice does the diluting'); }
    }
    if (!intent.asWritten) oneSweetener(lines, A, intent, notes, asked, anchor);
    // One overproof in the body; a second is the same job twice.
    const hot = body().filter(l => OVER(l.id));
    // (A Tortuga's two overproofs are the drink: its identity core is never folded.)
    for (const l of hot.slice(1).filter(l => !asked(l) && !composer.coreHeld(A, lines, l))) fold(l, hot[0], `one overproof (${prose(hot[0].id)}), not two`);
    // Three spirits at most: Don layered three rums, never five.
    while (body().length > 3) {
      const b = body().sort((x, y) => x.oz - y.oz);
      const victim = b.find(l => !asked(l) && !sole(l) && !composer.coreHeld(A, lines, l));
      if (!victim) break;
      fold(victim, b[b.length - 1], `the ${prose(victim.id)} folded into the ${prose(b[b.length - 1].id)}: three spirits is plenty`);
    }
    // Two citruses at most (lime and grapefruit in a grog is a pairing; lime, lemon and grapefruit is a crowd).
    const sour = () => lines.filter(l => l.role === 'sour' && !l.garnish && (ingMap.get(l.id).acid || 0) >= 2);
    while (sour().length > 2) {
      const sr = sour().sort((x, y) => x.oz - y.oz);
      const victim = sr.find(l => !asked(l) && !sole(l));
      if (!victim) break;
      fold(victim, sr[sr.length - 1], null);
      notes.push(`no ${prose(victim.id)}: two citruses are plenty`);
    }
    // One fizzy top.
    const fizz = lines.filter(l => FIZZ.has(l.id) && !l.float && !l.sink);
    if (fizz.length > 1) {
      const keep = fizz.find(asked) || fizz.find(l => l.req) || fizz.sort((x, y) => y.oz - x.oz)[0];
      for (const f of fizz.filter(f => f !== keep && !asked(f))) fold(f, keep, `all ${prose(keep.id)} on top, not two sodas`);
    }
    // A float is a float: half an ounce, whatever the rum (more is a near-neat first sip). The
    // Dark 'n Stormy's cloud is its whole pour of black rum, never an overproof one, on twice
    // its volume of ginger beer at least.
    for (const l of lines.filter(l => l.float && l.role === 'base')) {
      if (A.id === 'dark-n-stormy') {
        if (OVER(l.id) && !asked(l) && ingMap.has('rum-black-blended') && !forbidden('rum-black-blended', intent)) { notes.push(`black rum, not ${prose(l.id)}, for the cloud`); l.id = 'rum-black-blended'; }
        const gb = lines.find(x => FIZZ.has(x.id) && !x.float && !x.sink);
        if (gb && gb.oz < l.oz * 2.25) { gb.oz = Math.min(5, Math.max(gb.oz, Math.ceil(l.oz * 2.25 * 2) / 2)); gb.oz0 = gb.oz; }
        continue;
      }
      const cap = 0.5;
      if (l.oz > cap) {
        const lead = body().sort((x, y) => y.oz - x.oz)[0];
        if (lead && !OVER(l.id)) lead.oz += l.oz - cap;
        l.oz = cap; l.oz0 = cap;
      }
    }
    coreDoses(lines, A, notes, anchor);
  }

  // One sweetener per job, enforced last (and again by every balance after a pass that could add
  // one). Riff discipline: a flavored syrup the prayer brought REPLACES the plain syrup at its
  // sugar equivalent; it is never added beside it (a vanilla Mai Tai is orgeat and vanilla, no
  // rock candy). A "generic" sweetener is a plain syrup, or a syrup that only fills a frame's
  // sugar slot (the Volcano Bowl's maple, Rose's in a Blue Hawaii); identity syrups (a Mai Tai's
  // orgeat, a Hurricane's Fassionola) keep their jobs. So:
  //  - one generic sweetener at most;
  //  - a new flavored syrup (not in the reference) takes the generic sweetener's sugar;
  //  - one fruit syrup per drink (Fassionola or grenadine, passion fruit or Fassionola), the
  //    guest's or the frame's own kept;
  //  - no flavored syrup beside the same fruit's juice (passion syrup on passion purée);
  //  - a stirred drink takes one syrup;
  //  - a plain syrup under a quarter-ounce beside a sweetener that already carries the sugar goes.
  // The reference's own pair (a Mai Tai's orgeat and rock candy) is the spec, and stays.
  const FRUIT_SYRUPS = new Set(['passion-fruit-syrup', 'fassionola', 'grenadine', 'hibiscus-syrup', 'raspberry-syrup', 'guava-syrup', 'pineapple-syrup', 'li-hing-mui-syrup', 'strawberry-syrup', 'mango-syrup', 'pomegranate-molasses', 'blackberry-syrup']);
  function oneSweetener(lines, A, intent, notes, asked, anchor = null) {
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    const free = l => !l.sink && !l.float && !l.garnish && !l.crown && !l.muddled;
    const sugarOf = l => (l.oz || 0) * (ingMap.get(l.id).sugar || 0);
    const per = id => ingMap.get(id).sugar || 1;
    const syrups = () => lines.filter(l => l.role === 'sweet' && free(l) && (ingMap.get(l.id).sugar || 0) >= 20 && !['hot-buttered-rum-batter', 'tom-and-jerry-batter'].includes(l.id));
    const genericJob = c => c.anyOf.some(id => PLAIN.has(id));
    const identity = l => sig.some(c => c.anyOf.includes(l.id) && !genericJob(c));
    const generic = l => PLAIN.has(l.id) || (!identity(l) && sig.some(c => c.anyOf.includes(l.id) && genericJob(c)));
    const inRef = l => !!anchor && anchor.ids.has(l.id);
    const promised = new Set((intent.promises || []).flatMap(pr => pr.ids || []));
    const kept = l => asked(l);
    const remove = (l, into, why, swap = false) => {
      if (into) {
        const cap = Math.max(into.oz, Math.min(doseCap(into.id, A.family, asked(into) || promised.has(into.id)), 1));
        // A swap is like for like: the new syrup pours the old one's sugar (never less than a
        // quarter-ounce you can taste), so the reference's proportions survive.
        if (swap) into.oz = Math.min(Math.max(doseCap(into.id, A.family, true), 0.25), Math.max(0.25, into.min || 0, sugarOf(l) / per(into.id)));
        else into.oz = Math.min(cap, into.oz + sugarOf(l) / per(into.id));
        into.oz0 = Math.max(into.oz0 || 0, into.oz);
        if (into.range) into.range = [into.range[0], Math.max(into.range[1], into.oz)];
        finalizeAmounts([into]);
      }
      lines.splice(lines.indexOf(l), 1);
      if (why) notes.push(why);
    };
    const signed = l => (l.twist || l.swapped) ? 1 : 0;
    const rank = (x, y) => (kept(y) - kept(x)) || (signed(y) - signed(x)) || ((intent.color && y.slot === 'color' ? 1 : 0) - (intent.color && x.slot === 'color' ? 1 : 0)) || ((identity(y) ? 1 : 0) - (identity(x) ? 1 : 0)) || ((promised.has(y.id) ? 1 : 0) - (promised.has(x.id) ? 1 : 0)) || ((inRef(y) ? 1 : 0) - (inRef(x) ? 1 : 0)) || ((y.hero ? 1 : 0) - (x.hero ? 1 : 0)) || (sugarOf(y) - sugarOf(x));
    // One generic sweetener: two plain syrups (or rich simple and Rose's) are one.
    const gens = syrups().filter(generic).sort(rank);
    for (const g of gens.slice(1)) if (!kept(g) && lines.includes(g)) remove(g, gens[0], `one ${prose(gens[0].id)}, not ${prose(g.id)} beside it: one sweetener per job`);
    // A new flavored syrup takes the generic sweetener's job (and its sugar).
    for (const g of syrups().filter(generic)) {
      if (kept(g)) continue;
      const carriers = syrups().filter(l => l !== g && !generic(l) && (ingMap.get(l.id).sugar || 0) >= 45 && (l.oz || 0) >= 1 / 6 - 0.01
        && (!anchor || !inRef(l) || !inRef(g))
        // (A frame whose sugar slot only this syrup fills keeps it beside an identity syrup: a
        // Mai Tai's rock candy stays beside its orgeat; a vanilla syrup takes it over.)
        && !(identity(l) && sole(g) && !FRUIT_SYRUPS.has(l.id)))
        .sort((x, y) => ((inRef(x) ? 1 : 0) - (inRef(y) ? 1 : 0)) || rank(x, y));
      const c = carriers[0];
      if (c) { c.sugarJob = true; remove(g, c, `no ${prose(g.id)}: the ${prose(c.id)} takes its place as the sweetener`, !!anchor && !inRef(c) && !asked(c)); continue; }
      const top = lines.find(l => ['ginger-beer', 'cola', 'ginger-ale', 'lemon-lime-soda'].includes(l.id) && free(l) && (l.oz || 0) >= 2);
      if (top && !sole(g)) remove(g, null, `no ${prose(g.id)}: the ${prose(top.id)} is the sweetener`);
    }
    // One fruit syrup.
    const fruit = syrups().filter(l => FRUIT_SYRUPS.has(l.id)).sort(rank);
    for (const f of fruit.slice(1)) {
      if (!lines.includes(f) || kept(f) || (identity(f) && sole(f))) continue;
      remove(f, fruit[0], `no ${prose(f.id)} beside the ${prose(fruit[0].id)}: one fruit syrup is the job`);
    }
    // No syrup of a fruit the glass already pours as juice or purée.
    const lead = id => (ingMap.get(id).flavors || [])[0];
    for (const f of syrups().filter(l => !generic(l) && !kept(l) && !identity(l) && !inRef(l))) {
      const twin = lines.find(x => x !== f && free(x) && ['juice', 'rich'].includes(x.role) && lead(x.id) && lead(x.id) === lead(f.id));
      if (!twin) continue;
      const into = syrups().filter(x => x !== f).sort(rank)[0] || null;
      remove(f, into, `no ${prose(f.id)}: the ${prose(twin.id)} already brings it`);
    }
    // A stirred drink takes its sugar by one syrup.
    if (A.family === 'stirred') {
      const sy = syrups().sort(rank);
      for (const x of sy.slice(1)) if (lines.includes(x) && !kept(x) && !(identity(x) && sole(x))) remove(x, sy[0], `no ${prose(x.id)} beside the ${prose(sy[0].id)}: a stirred drink takes one syrup`);
    }
    // Two flavored tokens are one job too: the guest's (or the larger) keeps it.
    const flav = syrups().filter(l => !generic(l) && !(identity(l) && sole(l)));
    if (flav.length >= 2 && flav.some(l => l.oz < 0.45)) {
      const keep = [...flav].sort(rank)[0];
      for (const l of flav.filter(l => l !== keep && l.oz < 0.45 && !kept(l) && !(anchor && inRef(l) && inRef(keep)))) remove(l, keep, `no ${prose(l.id)} beside the ${prose(keep.id)}: one sweetener per job`);
    }
    // A plain syrup under a quarter-ounce beside a sweetener that already carries the sugar is a token.
    for (const g of syrups().filter(l => PLAIN.has(l.id) && (l.oz || 0) < 0.25 - 0.01 && !kept(l))) {
      if (anchor && anchor.dose.has(g.id) && Math.abs(anchor.dose.get(g.id) - g.oz) < 0.05) continue;
      const other = lines.filter(l => l !== g && free(l) && l.role !== 'base' && (ingMap.get(l.id).sugar || 0) >= 20).reduce((t, l) => t + sugarOf(l), 0);
      if (other >= sugarOf(g) * 2) remove(g, null, `no ${prose(g.id)}: a teaspoon beside the ${prose(lines.filter(l => l !== g && free(l) && l.role !== 'base' && (ingMap.get(l.id).sugar || 0) >= 20).sort((x, y) => sugarOf(y) - sugarOf(x))[0].id)} is a token`);
    }
  }

  // The identity core at the dose that makes the drink what it says (composer.coreMinimums):
  // a Mai Tai's half-ounce of orgeat, three-quarters of batter, a Hotel Nacional's half-ounce of
  // apricot, a swizzle's four-dash crown, and Don's Mix split two of grapefruit to one of cinnamon.
  // The minimum rides on the line, so no later pass trims under it.
  function donsRatio(lines, A, notes) {
    const gf = lines.find(l => l.id === 'grapefruit' && !l.garnish), cin = lines.find(l => l.id === 'cinnamon-syrup' && !l.garnish);
    if (!gf || !cin || A.family !== 'zombie') return;
    cin.ratioOf = gf;
    if (gf.oz >= cin.oz * 2 - 0.02) return;
    const t = gf.oz + cin.oz;
    gf.oz = Math.max(1 / 3, t * 2 / 3); cin.oz = Math.max(1 / 6, t / 3);
    finalizeAmounts([gf, cin]);
    if (gf.oz < cin.oz * 2 - 0.02) { cin.oz = LADDER.filter(x => x <= gf.oz / 2 + 0.01).pop() || 1 / 12; finalizeAmounts([cin]); }
    gf.oz0 = gf.oz; cin.oz0 = cin.oz;
    if (notes && !notes.includes("Don's Mix kept two of grapefruit to one of cinnamon")) notes.push("Don's Mix kept two of grapefruit to one of cinnamon");
  }
  // (A core minimum never exceeds the reference's own dose: that would be a change nobody chose,
  // a Smuggler's Cove HBR's half-ounce of batter is its own spec.) A core maximum (a Daiquiri
  // No. 4's teaspoon to a third of an ounce of rich syrup) rides on the line the same way.
  function coreDoses(lines, A, notes, anchor = null) {
    donsRatio(lines, A, notes);
    for (const m of composer.coreMinimums(A, lines)) {
      if (m.line.id === 'grapefruit') continue;
      if (m.max !== undefined) { m.line.max = m.line.max === undefined ? m.max : Math.min(m.line.max, m.max); if ((m.line.oz || 0) > m.max + 0.01) { m.line.oz = m.max; finalizeAmounts([m.line]); } continue; }
      const own = anchor && anchor.dose.has(m.line.id) ? anchor.dose.get(m.line.id) : Infinity;
      const min = Math.min(m.min, own);
      m.line.min = Math.max(m.line.min || 0, min);
      if ((m.line.oz || 0) < min - 0.01) { m.line.oz = min; m.line.oz0 = Math.max(m.line.oz0 || 0, min); }
    }
  }

  // After balance: every line is a dose you can taste and the spirit is a real pour. No teaspoon
  // of brandy in a bowl, no half-teaspoon of syrup in a Painkiller, no ounce-of-rum smoothie,
  // no four-ounce sunset sipper.
  const POTENT = new Set(['grenadine', 'maraschino', 'allspice-dram', 'absinthe', 'pastis', 'fernet', 'scotch-islay', 'almond-extract', 'vanilla-extract', 'orange-flower-water', 'rose-water', 'saline']);
  const SMOKE = new Set(['mezcal']);
  function floors(lines, A, intent, svc, notes) {
    const live = () => lines.filter(l => !l.garnish && l.role !== 'aromatic' && !l.muddled);
    const body = () => live().filter(l => l.role === 'base' && !l.float && !l.sink && ingMap.get(l.id).abv > 0);
    const asked = l => (intent.ings[l.id] || 0) >= 1 || (intent.spirits || []).includes(l.id);
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => c.anyOf.includes(x.id)).length === 1);
    const stirred = svc.method === 'stir' || svc.method === 'build' && A.family === 'stirred';
    const gentleAsk = (intent.strength || 0) <= -1 || intent.style.zeroProof;
    const B = (A.ratios || {}).baseOz;
    // The spirit: a real pour, never a smoothie and never a bucket.
    if (!gentleAsk && B && B[1] > 1 && body().length) {
      const total = body().reduce((t, l) => t + l.oz, 0);
      const want = ['colada'].includes(A.family) || svc.method === 'blend' ? 2 : 1.5;
      const floor = Math.max(B[0], Math.min(want, B[1]));
      if (total < floor - 0.05) { const k = floor / total; for (const l of body()) l.oz *= k; notes.push(`a full ${fracOz(floor)} oz of spirit so it isn't a smoothie`); }
    }
    {
      const zombieLine = A.family === 'zombie' && (intent.strength || 0) > 0;
      const bowlCup = (intent.servings || 1) > 1;
      // A party punch is a cup you can have two of: an ounce and three-quarters of spirit.
      const party = (intent.servings || 1) >= 6;
      if (party) for (const l of live().filter(l => l.role === 'base' && (l.float || l.sink))) { l.float = false; l.sink = false; if (OVER(l.id)) l.oz = Math.min(l.oz, 0.5); }
      // Two and a half ounces is a full pour; three is for the named heavyweights (the Zombie
      // line) only. A high-proof liqueur (Chartreuse at 55%) is spirit too, and counts.
      const cap = party ? 1.75 : bowlCup ? 2 : zombieLine ? Math.max(3, (B || [])[1] || 3) : A.family === 'zombie' || intent.asWritten ? 3 : 2.5;
      const strongLiq = () => live().filter(l => l.role === 'modifier' && (ingMap.get(l.id).abv || 0) >= 45 && !l.float && !l.sink);
      const liqEq = () => strongLiq().reduce((t, l) => t + l.oz * (ingMap.get(l.id).abv || 0) / 40, 0);
      const total = body().reduce((t, l) => t + l.oz, 0);
      if (total + liqEq() > cap + 0.05) {
        // The base gives way first (never under an ounce and a half, or an ounce beside the
        // liqueur), then the liqueur comes down to three-quarters.
        const room = Math.max(liqEq() > 0 ? 1 : Math.min(1.5, cap), cap - liqEq());
        if (total > room + 0.05) { const k = room / total; for (const l of body()) l.oz *= k; }
        // In bar measures: rounding must not put back what the cap took (1¼ + 1¼ + ¾ is not 3).
        finalizeAmounts(body());
        for (let i = 0; i < 8 && body().reduce((t, l) => t + l.oz, 0) > room + 0.05; i++) {
          const big = body().filter(l => l.oz > (OVER(l.id) ? 0.5 : 0.75) + 0.01).sort((x, y) => y.oz - x.oz)[0];
          if (!big) break;
          big.oz = Math.max(OVER(big.id) ? 0.5 : 0.75, rungDown(big.oz)); finalizeAmounts([big]);
        }
        for (const l of strongLiq()) if (body().reduce((t, x) => t + x.oz, 0) + liqEq() > cap + 0.05 && l.oz > 0.75 && !asked(l)) l.oz = Math.max(0.75, l.min || 0);
        notes.push('the spirit kept to a single full pour');
      }
    }
    // Coconut rum is an accent beside the rum, half an ounce, unless the guest asked for it.
    for (const l of live().filter(l => l.id === 'coconut-rum' && !asked(l) && l.oz > 0.5)) l.oz = 0.5;
    // Overproof is a seasoning: an ounce beside other spirits, an ounce and a half as the only
    // one (a Cobra's Fang), two if the guest asked for it by name.
    for (const l of body()) if (OVER(l.id)) {
      const cap = asked(l) ? 2 : body().length > 1 ? 1 : 1.5;
      if (l.oz > cap + 0.01) { const other = body().filter(x => x !== l && !OVER(x.id)).sort((x, y) => y.oz - x.oz)[0]; if (other) other.oz += Math.min(l.oz - cap, 0.5); l.oz = cap; }
    }
    // A buck is lengthened: two ounces of its fizz at least.
    if (A.family === 'buck') for (const l of live().filter(l => FIZZ.has(l.id) && l.oz < 2)) l.oz = 2;
    // Sweet liqueurs past an ounce and a half cloy (outside the resort punches built on them).
    if (A.family !== 'resort-punch') {
      const liq = live().filter(l => l.role === 'modifier' && (ingMap.get(l.id).sugar || 0) >= 20 && !asked(l));
      const t = liq.reduce((s, l) => s + l.oz, 0);
      if (t > 1.5) for (const l of liq) l.oz *= 1.5 / t;
    }
    // A stirred drink takes its syrup by the barspoon: half an ounce at most, and a barspoon when
    // vermouth, Campari or a liqueur already carries the sugar (a Kingston Negroni needs no
    // half-ounce of li hing mui syrup).
    if (A.family === 'stirred' || svc.method === 'stir') {
      const liqSugar = live().filter(l => ['modifier', 'rich'].includes(l.role) && (ingMap.get(l.id).sugar || 0) >= 12).reduce((t, l) => t + l.oz, 0);
      const cap = liqSugar >= 1 ? 1 / 6 : 0.5;
      for (const l of live().filter(l => l.role === 'sweet' && l.oz > cap + 0.01 && !asked(l))) { l.oz = cap; if (cap < 0.5) notes.push(`a barspoon of ${prose(l.id)}: the liqueurs carry the sugar`); }
    }
    // Hot drinks take citrus as a whisper: half an ounce at most (more splits the butter).
    if (svc.method === 'hot') for (const l of live().filter(l => l.role === 'sour' && l.oz > 0.5)) l.oz = 0.5;
    // A party cup is about a standard drink and a half, whatever the frame.
    if ((intent.servings || 1) >= 6) for (let i = 0; i < 6; i++) {
      const c = chemOf(lines, svc.method, svc.ice);
      if (c.alcMl / 17.74 <= 1.6) break;
      for (const l of body()) l.oz *= 0.9;
    }
    // Smoke is a seasoning in a split: mezcal at three-quarters of an ounce, an ounce if asked.
    for (const l of body()) if (SMOKE.has(l.id) && body().length > 1) {
      const cap = asked(l) ? 1 : 0.75;
      if (l.oz > cap) { const lead = body().filter(x => x !== l).sort((x, y) => y.oz - x.oz)[0]; lead.oz += l.oz - cap; l.oz = cap; }
    }
    // Each spirit in a split is a pour you can taste: ¾ oz (½ oz of overproof).
    const split = body();
    if (split.length > 1) for (const l of [...split].sort((x, y) => x.oz - y.oz)) {
      const floor = OVER(l.id) ? 0.5 : 0.75;
      if (!lines.includes(l) || l.oz >= floor - 0.01) continue;
      const lead = body().filter(x => x !== l).sort((x, y) => y.oz - x.oz)[0];
      // A sliver nobody asked for joins the lead pour; anything more gets a real pour, mostly
      // borrowed from the lead so the drink doesn't get stronger.
      if (lead && l.oz < 0.4 && !asked(l) && !l.req && !sole(l)) { lead.oz += l.oz; lines.splice(lines.indexOf(l), 1); notes.push(`the ${prose(l.id)} folded into the ${prose(lead.id)}`); continue; }
      const give = lead ? Math.max(0, Math.min(floor - l.oz, lead.oz - 0.75)) : 0;
      if (lead) lead.oz -= give;
      l.oz = floor;
    }
    // Everything else: juices at half an ounce, syrups and liqueurs at a quarter. Teaspoons are
    // for grenadine, potent accents, and the sugar in a stirred drink.
    for (const l of [...live()]) {
      if (!lines.includes(l) || l.role === 'base' || l.role === 'lengthener' || l.role === 'accent' || POTENT.has(l.id)) continue;
      const ing = ingMap.get(l.id);
      if (ing.cat === 'bitters' || ing.oz_per_piece || l.unit === 'dash' || l.unit === 'drop') continue;
      const floor = l.role === 'juice' ? 0.5 : (l.role === 'sweet' && stirred) ? 0.08 : 0.25;
      if (l.oz >= floor - 0.01) continue;
      const kin = live().find(x => x !== l && x.role === l.role && (l.role !== 'sweet' || PLAIN.has(x.id) === PLAIN.has(l.id) || PLAIN.has(l.id)));
      if (l.ratioOf || l.min) continue;
      if (asked(l) || l.req || l.twist || sole(l) || (l.role === 'sweet' && !kin)) { l.oz = floor; continue; }
      if (kin && PLAIN.has(l.id) && (l.role === 'sweet' || l.role === 'sour')) { kin.oz += l.oz; lines.splice(lines.indexOf(l), 1); continue; }
      lines.splice(lines.indexOf(l), 1);
      notes.push(`left out the ${prose(l.id)}: too little to taste`);
    }
    for (const l of live()) if (l.min && l.oz < l.min - 0.01) l.oz = l.min;
    if (intent.asWritten) return;
    tokens(lines, A, intent, svc, notes);
    lineBudget(lines, A, intent, notes);
  }

  // A named flavor is a dose you can taste in the finished glass. In a drink of twelve ounces or
  // more that is half an ounce (a quarter-ounce of vanilla in a 19-ounce colada is a rumor); in a
  // short one, a quarter; the potent ones (grenadine, allspice dram, maraschino) a teaspoon or
  // more on the same scale, and smoke a quarter-ounce of Islay. Twin quarter-ounce citruses are
  // one citrus. Under the floor, a line the guest asked for, or that makes the drink what it is,
  // is raised to it; anything else is left out (and so never named in the tasting).
  const SEASONING = new Set(['absinthe', 'pastis', 'saline', 'almond-extract', 'vanilla-extract', 'orange-flower-water', 'rose-water']);
  function tokens(lines, A, intent, svc, notes) {
    const asked = l => (intent.ings[l.id] || 0) >= 1 || (intent.spirits || []).includes(l.id);
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    // (Smoke is a seasoning by the quarter-ounce, whatever its role: Islay is poured, not dripped.)
    const live = () => lines.filter(l => !l.garnish && !l.muddled && (!['aromatic', 'base', 'lengthener'].includes(l.role) || l.id === 'scotch-islay') && !l.float && !l.sink && !l.crown);
    const sugary = l => (ingMap.get(l.id).sugar || 0) >= 20, acidic = l => (ingMap.get(l.id).acid || 0) >= 2;
    const lastJob = l => (sugary(l) && !lines.some(x => x !== l && !x.garnish && x.role !== 'base' && sugary(x))) || (l.role === 'sour' && acidic(l) && !lines.some(x => x !== l && !x.garnish && x.role === 'sour' && acidic(x)));
    // Twin citruses: one pour of the one that matters (the guest's yuzu, or the larger).
    const twins = live().filter(l => l.role === 'sour' && acidic(l) && l.oz <= 0.34);
    if (twins.length >= 2) {
      const keep = [...twins].sort((x, y) => (asked(y) - asked(x)) || ((y.hero ? 1 : 0) - (x.hero ? 1 : 0)) || ((y.req ? 1 : 0) - (x.req ? 1 : 0)) || (y.oz - x.oz))[0];
      for (const l of twins.filter(l => l !== keep)) { keep.oz += l.oz; keep.oz0 = keep.oz; lines.splice(lines.indexOf(l), 1); notes.push(`one ${prose(keep.id)} pour instead of two quarter-ounce citruses`); }
    }
    const fin = chemOf(lines, svc.method, svc.ice).finalOz;
    const named = Math.max(0.25, Math.min(0.5, fin * 0.04));
    const potent = Math.max(1 / 12, Math.min(0.25, fin * 0.016));
    for (const l of [...live()]) {
      const ing = ingMap.get(l.id);
      // (A plain syrup is no flavor: its dose is the band's business.)
      if (ing.cat === 'bitters' || l.id === 'na-bitters' || ing.oz_per_piece || SEASONING.has(l.id) || PLAIN.has(l.id) || ['dash', 'drop'].includes(l.unit)) continue;
      const smoke = l.id === 'scotch-islay';
      const floor = smoke ? 0.25 : POTENT.has(l.id) ? potent : named;
      // Whatever stays is held at a tasteable dose by every later pass (l.min).
      // (The floor is for the drink as it is now: one trimmed to a flute tastes a quarter-ounce.)
      if (l.oz >= floor - 0.02) { if (!l.ratioOf) l.taste = Math.min(l.oz, floor); continue; }
      // A riff's signed change (the allspice in its second spice slot) is the riff: it is raised, not lost.
      if (asked(l) || l.hero || l.twist || l.swapped || sole(l) || l.min || l.ratioOf || lastJob(l) || smoke || (l.req && !PLAIN.has(l.id))) {
        l.oz = Math.min(floor, doseCap(l.id, A.family, true)); l.oz0 = Math.max(l.oz0 || 0, l.oz); if (!l.ratioOf) l.taste = Math.max(l.taste || 0, l.oz);
        continue;
      }
      lines.splice(lines.indexOf(l), 1);
      notes.push(`left out the ${prose(l.id)}: too little to taste in a drink this size`);
    }
  }

  // Seven poured lines at most (mint and dashes count): past that a drink is a crowd, not a
  // recipe. The Zombie line's heavyweights may run to ten, as Don's and Smuggler's Cove's do. What goes first is what
  // the guest didn't ask for and the frame doesn't need: a seasoning, then the smallest pour.
  function lineBudget(lines, A, intent, notes) {
    // (Riff discipline: a Zombie-line riff is its reference and two or three changes, nine lines at
    // most, not ten of teaspoons and dashes; a layer the prayer asked for, a sunrise's sink, is the
    // one line past seven a drink may pour.)
    const max = (A.family === 'zombie' ? 9 : 7) + (intent.style.layered && lines.some(l => (l.sink || l.float) && !l.garnish) ? 1 : 0);
    const asked = l => (intent.ings[l.id] || 0) >= 1 || (intent.spirits || []).includes(l.id);
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    const poured = () => lines.filter(l => !l.garnish && (l.role !== 'aromatic' || l.muddled));
    const sugary = l => (ingMap.get(l.id).sugar || 0) >= 20, acidic = l => (ingMap.get(l.id).acid || 0) >= 2;
    const lastJob = l => (sugary(l) && l.role !== 'base' && !poured().some(x => x !== l && x.role !== 'base' && !x.sink && !x.float && sugary(x))) || (acidic(l) && l.role === 'sour' && !poured().some(x => x !== l && x.role === 'sour' && acidic(x)));
    const promised = new Set((intent.promises || []).flatMap(pr => pr.ids || []));
    for (let guard = 0; guard < 8 && poured().length > max; guard++) {
      // (The bottle that pours a color the guest demanded is the prayer's own, as asked for.)
      const base = l => !asked(l) && !sole(l) && !l.min && !l.ratioOf && !l.float && !l.sink && !l.crown && !l.muddled && l.role !== 'base' && !lastJob(l) && !promised.has(l.id) && !(intent.color && l.slot === 'color');
      let cands = poured().filter(l => base(l) && !l.req && !l.hero);
      if (!cands.length) cands = poured().filter(l => base(l) && !l.hero);
      if (!cands.length) cands = poured().filter(l => base(l));
      // Two promised liqueurs (a garden's peach and elderflower) keep one.
      // Two promises in one glass (a grandmother's brandy and a spring garden's elderflower) when
      // only one fits: the other promise keeps the drink, the weaker liqueur goes.
      if (!cands.length) {
        // A fourth spirit (three in the body and a float) folds into the lead pour, before any
        // promise is given up.
        const body = poured().filter(l => l.role === 'base' && !l.float && !l.sink && (ingMap.get(l.id).abv || 0) > 0).sort((x, y) => x.oz - y.oz);
        const fold = body.length > 2 && body.find(l => !asked(l) && !sole(l) && !OVER(l.id) && !promised.has(l.id));
        if (fold) {
          const lead = body[body.length - 1] === fold ? body[body.length - 2] : body[body.length - 1];
          lead.oz += fold.oz; lead.oz0 = (lead.oz0 || lead.oz) + (fold.oz0 || fold.oz);
          lines.splice(lines.indexOf(fold), 1);
          notes.push(`the ${prose(fold.id)} folded into the ${prose(lead.id)} to keep it to ${max} bottles`);
          continue;
        }
      }
      // A float over a drink that already layers with its sink (a sunrise needs no dark cap)
      // joins the body's lead pour.
      if (!cands.length && poured().some(l => l.sink)) {
        const fl = poured().find(l => l.float && l.role === 'base' && !asked(l) && !OVER(l.id) && !sole(l));
        const lead = poured().filter(l => l.role === 'base' && !l.float && !l.sink && (ingMap.get(l.id).abv || 0) > 0).sort((x, y) => y.oz - x.oz)[0];
        if (fl && lead) { lead.oz += fl.oz; lead.oz0 = (lead.oz0 || lead.oz) + fl.oz; lines.splice(lines.indexOf(fl), 1); notes.push(`no ${prose(fl.id)} float: the sink is the layer, and the rum joins the ${prose(lead.id)}`); continue; }
      }
      if (!cands.length && poured().filter(l => promised.has(l.id)).length > 1) cands = poured().filter(l => promised.has(l.id) && !asked(l) && !sole(l) && !l.min && l.role !== 'base' && !lastJob(l)).sort((x, y) => ((intent.prefer || {})[x.id] || 0) - ((intent.prefer || {})[y.id] || 0)).slice(0, 1);
      if (!cands.length) break;
      const seasoning = l => ingMap.get(l.id).cat === 'bitters' || SEASONING.has(l.id) || l.role === 'accent';
      // A riff's signed change (its twist) is the last to go: it is what makes the riff.
      cands.sort((x, y) => ((x.twist || x.swapped ? 1 : 0) - (y.twist || y.swapped ? 1 : 0)) || (seasoning(y) - seasoning(x)) || (x.oz - y.oz));
      const drop = cands[0];
      lines.splice(lines.indexOf(drop), 1);
      notes.push(`left out the ${prose(drop.id)} to keep it to ${max} bottles`);
    }
  }

  // ---------- absolute bands ----------
  // The ratio can't see a 26-gram punch (26.4 to 1.38 is a fine ratio). After every pass that
  // moves a dose (balance, floors, color, the punch bowl's block, a vessel fit), the drink is held
  // inside the absolute band for how it is made (chem.js sugarBand): over the ceiling, the plain
  // syrup goes first, then flavored syrups, liqueurs and nectars come down; under the floor, the
  // plain syrup comes up, and if there is none (a frozen sour sweetened only by a capped liqueur)
  // a half-ounce of rich simple or demerara goes in; acid past the ceiling comes out of the citrus.
  // A classic poured as written keeps its spec; a directional ask moves the band.
  const LADDER = [1 / 12, 1 / 6, 0.25, 1 / 3, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const rungUp = oz => LADDER.find(x => x > oz + 0.01);
  const rungDown = oz => [...LADDER].reverse().find(x => x < oz - 0.01) || 0;
  const CREAMY = new Set(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'whole-milk', 'irish-cream', 'tom-and-jerry-batter']);
  const DESSERT = new Set(['creme-de-cacao', 'vanilla-ice-cream', 'irish-cream', 'coffee-liqueur', 'chocolate-syrup']);
  const LONG_TOPS = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda', 'sparkling-wine']);
  function bandOf(lines, A, intent, svc) {
    const live = lines.filter(l => !l.garnish && !l.muddled);
    const citrus = live.filter(l => l.role === 'sour' && (ingMap.get(l.id).acid || 0) >= 2).reduce((t, l) => t + (l.oz || 0), 0);
    const creamy = live.some(l => CREAMY.has(l.id) && (l.oz || 0) >= 0.5);
    const dessert = creamy && live.some(l => DESSERT.has(l.id));
    const c = chemOf(lines, svc.method, svc.ice);
    // A flash-blended or swizzled sour is a shaken sour served over its crushed ice: the same band.
    const method = ['flash-blend', 'swizzle'].includes(svc.method) ? 'shake' : svc.method;
    const b = sugarBand({ method, ice: svc.ice, servings: intent.servings, punchBowl: svc.vessel === 'punch-bowl', sour: citrus >= 0.5 || c.acidConc >= 0.45, creamy, dessert, sweetness: intent.sweetness, tartness: intent.tartness }, (rules || {}).absoluteBands);
    // Dry floors only for the real heavyweights (three ounces of spirit or more, or an overproof in
    // the body): the Zombie line sits near 4 g by design, and a grog or a Scorpion bowl drier than a
    // daiquiri (its floor no higher than the middle of its family's window). Every other sour, up
    // or flash-blended, holds 7.5–11 g.
    const body = live.filter(l => l.role === 'base' && !l.float && !l.sink && (ingMap.get(l.id).abv || 0) >= 30);
    const heavy = body.reduce((t, l) => t + (l.oz || 0), 0) >= 3 - 0.01 || body.some(l => OVER(l.id));
    if (b.kind === 'shakenSour') {
      const fw = famWin(A.family).sugarConc;
      if (heavy && A.family === 'zombie') b.sugar = [0, b.sugar[1]];
      else if (heavy && fw) b.sugar = [Math.min(b.sugar[0], b.sugar[0] * ((fw[0] + fw[1]) / 2) / 8), b.sugar[1]];
      else b.sugar = [Math.min(b.sugar[0], 7.5), b.sugar[1]];
    }
    // A long drink topped with soda, ginger beer or bubbles is a highball, not a shaken sour: the
    // top carries (or lengthens) the sugar, so no sour floor.
    if (b.kind === 'shakenSour' && live.some(l => LONG_TOPS.has(l.id) && !l.float && (l.oz || 0) >= 2 - 0.01)) b.sugar = [0, b.sugar[1]];
    // A low-ABV build is a long drink, lengthened on purpose: no sour floor either.
    if ((intent.strength || 0) <= -1.5) b.sugar = [Math.min(b.sugar[0], 6), b.sugar[1]];
    return b;
  }
  function bandPass(lines, A, intent, svc, notes, { maxFinal = Infinity, anchor = null } = {}) {
    // Canon as written keeps its spec; only its identity core is held to its dose. (Not a frozen
    // drink: cold mutes sugar, and a blender spec written for a riper fruit or a smaller scoop of
    // ice still has to clear the frozen floor.)
    if (intent.asWritten && !lines.some(l => l.slot === 'color') && svc.method !== 'blend') {
      donsRatio(lines, A, notes);
      for (const l of lines) if (l.min && (l.oz || 0) < l.min - 0.01) { l.oz = l.min; finalizeAmounts([l]); }
      return null;
    }
    // A color or a leaning may have added a bottle, or a vessel fit shrunk one to a token, since
    // the floors: the line ceiling and the taste floor first.
    lineBudget(lines, A, intent, notes);
    tokens(lines, A, intent, svc, notes);
    // A top that grew since structure() (a highball's ginger beer lengthened to two ounces) can
    // carry the sugar now: one sweetener per job, again.
    oneSweetener(lines, A, intent, notes, l => (intent.ings[l.id] || 0) >= 1.5 || (intent.spirits || []).includes(l.id), anchor);
    const low = (intent.strength || 0) <= -1.5 && !intent.style.zeroProof;
    if (low) gentle(lines, A, intent, svc, notes, true);
    // The identity core at its dose, whatever the passes since did to it.
    donsRatio(lines, A, notes);
    for (const l of lines) if (l.min && (l.oz || 0) < l.min - 0.01) { l.oz = l.min; finalizeAmounts([l]); }
    const B = bandOf(lines, A, intent, svc);
    const tartAsk = (intent.tartness || 0) >= 0.6;
    // Acid answers to the reference too: within a tenth of its own (a riff never drifts sharp),
    // about 0.95 g at most in a punch or a bowl nobody asked to be tart, 0.7 for a creamy ask.
    if (!tartAsk) {
      const caps = [B.acid ? B.acid[1] : 1.2];
      if (B.kind === 'punch' || (intent.servings || 1) >= 2) caps.push(0.95);
      if (anchor && anchor.acid > 0.3) caps.push(Math.max(anchor.acid * 1.1, B.acid && B.acid[0] ? B.acid[0] + 0.05 : 0.5));
      if (creamyAsk(intent) && lines.some(l => l.id === 'coconut-cream' && !l.garnish)) caps.push(0.7);
      B.acid = [B.acid ? B.acid[0] : 0, Math.min(...caps)];
      if (B.acid[0] > B.acid[1]) B.acid[0] = B.acid[1] * 0.85;
    }
    // Citrus stays within a quarter-ounce of the reference's unless the prayer says tart.
    // (In proportion: a riff poured smaller than its reference, a Hurricane at 2½ oz of rum rather
    // than four, carries the citrus in the same proportion. A new flavored syrup stacked on the
    // reference earns no extra citrus.)
    const spiritNow = lines.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish && (ingMap.get(l.id).abv || 0) >= 30).reduce((t, l) => t + (l.oz || 0), 0);
    const scale = anchor && anchor.base > 0 && spiritNow > 0 ? Math.max(0.6, Math.min(1.25, spiritNow / anchor.base)) : 1;
    const stacked = !!anchor && lines.some(l => l.role === 'sweet' && !l.garnish && !l.sink && !l.float && (ingMap.get(l.id).sugar || 0) >= 45 && !anchor.ids.has(l.id));
    const citrusCap = anchor && anchor.citrus > 0 && !tartAsk ? anchor.citrus * scale + (stacked ? 0.13 : 0.25) : Infinity;
    const refCitrus = l => anchor && anchor.citrusById.has(l.id) ? anchor.citrusById.get(l.id) * scale : 0;
    const before = new Map(lines.filter(l => !l.garnish).map(l => [l.id, l.oz || 0]));
    const asked = l => (intent.ings[l.id] || 0) >= 1;
    const sig = (A.signature || []).filter(c => c.required);
    const sole = l => sig.some(c => c.anyOf.includes(l.id) && lines.filter(x => !x.garnish && c.anyOf.includes(x.id)).length === 1);
    const free = l => !l.garnish && !l.muddled && !l.float && !l.sink && !l.crown && !l.ratioOf && l.role !== 'aromatic' && !['dash', 'drop', 'piece'].includes(l.unit) && !(l.id === 'grapefruit' && lines.some(x => x.ratioOf === l));
    const sugarOf = l => ingMap.get(l.id).sugar || 0;
    const set = (l, oz) => { l.oz = oz; l.oz0 = Math.min(l.oz0 || oz, oz); finalizeAmounts([l]); };
    const floorOf = l => Math.max(l.min || 0, l.taste || 0, l.range && sole(l) ? Math.min(l.range[0], 0.5) : 0);
    const tart = (intent.tartness || 0) >= 0.6, lessSweet = (intent.sweetness || 0) <= -0.6;
    const said = [];
    // Down: one bar measure off the first lever that can give.
    const lower = () => {
      const otherSugar = l => lines.some(x => x !== l && !x.garnish && x.role !== 'base' && sugarOf(x) >= 20);
      const tiers = [
        lines.filter(l => free(l) && PLAIN.has(l.id)).map(l => [l, otherSugar(l) && !sole(l) ? 0 : 1 / 6]),
        lines.filter(l => free(l) && l.role === 'sweet' && !PLAIN.has(l.id) && sugarOf(l) >= 20).map(l => [l, Math.max(asked(l) ? 0.5 : 0.25, floorOf(l))]),
        lines.filter(l => free(l) && ['modifier', 'accent'].includes(l.role) && sugarOf(l) >= 20).map(l => [l, Math.max(asked(l) || sole(l) ? 0.5 : 0.25, floorOf(l))]),
        lines.filter(l => free(l) && l.role === 'juice' && sugarOf(l) >= 12).map(l => [l, Math.max(1, l.range ? l.range[0] : 0, floorOf(l))]),
        lines.filter(l => free(l) && l.role === 'rich' && sugarOf(l) >= 20).map(l => [l, Math.max(0.5, l.range ? l.range[0] : 0, floorOf(l))]),
        // Last of all, past the ceiling with nothing else to give: the cream of coconut below its
        // blender range (a shaken colada needs less of it than a frozen one), never under ¾ oz.
        lines.filter(l => free(l) && l.role === 'rich' && sugarOf(l) >= 20 && chemOf(lines, svc.method, svc.ice).sugarConc > B.sugar[1] + 0.05).map(l => [l, Math.max(0.75, l.min || 0, l.range ? l.range[0] * 0.6 : 0)]),
      ];
      // (A move that rounding puts straight back, a third of an ounce snapping to a half, is no
      // move: the next lever is tried.)
      for (const tier of tiers) {
        const can = tier.filter(([l, lo]) => l.oz > lo + 0.01).sort((x, y) => y[0].oz * sugarOf(y[0]) - x[0].oz * sugarOf(x[0]));
        for (const [l, lo] of can) {
          const was = l.oz, was0 = l.oz0;
          let next = Math.max(lo, rungDown(l.oz));
          // A plain syrup under a teaspoon is a token: it goes, if it may.
          if (PLAIN.has(l.id) && next < 1 / 6 - 0.01 && lo === 0) next = 0;
          if (next < 0.05) { lines.splice(lines.indexOf(l), 1); said.push(`no ${prose(l.id)}`); return true; }
          set(l, next);
          if (l.oz < was - 0.01) { said.push(`less ${prose(l.id)}`); return true; }
          l.oz = was; l.oz0 = was0; finalizeAmounts([l]);
        }
      }
      return false;
    };
    // Up: the plain syrup first; with none, a plain syrup goes in (demerara beside a dark or
    // aged rum, rich simple otherwise), then the flavored syrups, then the cream.
    const roomUp = l => !(l.max !== undefined && (l.oz || 0) >= l.max - 0.01);
    const upTo = (l, oz) => Math.min(oz, l.max === undefined ? Infinity : l.max);
    const raise = () => {
      // "Less sweet" is a hard constraint: no pass puts sugar back past the reference's own dose.
      if ((intent.sweetness || 0) <= -0.6 && !lines.some(l => free(l) && l.role !== 'base' && sugarOf(l) >= 20 && roomUp(l))) return false;
      // A punch's own water line comes out before any sugar goes in (the batch water does that job).
      const water = lines.find(l => l.id === 'water' && !asked(l));
      if (water) { set(water, Math.max(0, water.oz - 0.5)); if (water.oz < 0.25) lines.splice(lines.indexOf(water), 1); said.push('less water'); return true; }
      // In a glass already full, the sugar comes in denser, not bigger: rich simple for simple.
      const thin = maxFinal < Infinity && lines.find(l => free(l) && l.id === 'simple-syrup');
      if (thin && ingMap.has('rich-simple') && !forbidden('rich-simple', intent)) { thin.id = 'rich-simple'; said.push('more rich simple syrup'); return true; }
      // …and a colada's dairy gives a quarter-ounce to the cream of coconut.
      const coco = maxFinal < Infinity && lines.find(l => free(l) && l.id === 'coconut-cream'), dairy = coco && lines.find(l => free(l) && ['heavy-cream', 'half-and-half', 'whole-milk'].includes(l.id) && l.oz >= 0.25);
      if (dairy) { set(dairy, Math.max(0, dairy.oz - 0.25)); if (dairy.oz < 0.1) lines.splice(lines.indexOf(dairy), 1); set(coco, coco.oz + 0.25); coco.oz0 = coco.oz; said.push(`more ${prose(coco.id)}`); return true; }
      // A creamy drink's sweetener is its cream of coconut: that comes up first.
      const cream = B.kind === 'frozenCreamy' && lines.filter(l => free(l) && roomUp(l) && l.role === 'rich' && sugarOf(l) >= 20 && l.oz < Math.min(2.5, Math.max(1.5, l.range ? l.range[1] * 1.15 : 2)) - 0.01)[0];
      if (cream) { set(cream, upTo(cream, rungUp(cream.oz))); cream.oz0 = cream.oz; said.push(`more ${prose(cream.id)}`); return true; }
      // The flavored syrup that took the plain syrup's job takes the extra sugar first.
      const job = lines.filter(l => free(l) && roomUp(l) && l.sugarJob && l.oz < Math.min(1, doseCap(l.id, A.family, asked(l))) - 0.01)[0];
      if (job) { set(job, upTo(job, Math.min(rungUp(job.oz), Math.min(1, doseCap(job.id, A.family, asked(job)))))); job.oz0 = job.oz; said.push(`more ${prose(job.id)}`); return true; }
      const sugarSlot = l => (A.signature || []).some(c => c.required && c.anyOf.includes(l.id) && c.anyOf.some(id => PLAIN.has(id)));
      const plain = lines.filter(l => free(l) && roomUp(l) && (PLAIN.has(l.id) || (l.role === 'sweet' && sugarSlot(l) && sugarOf(l) >= 20)) && l.oz < 1 - 0.01).sort((x, y) => y.oz - x.oz)[0];
      if (plain) { set(plain, upTo(plain, rungUp(plain.oz))); said.push(`more ${prose(plain.id)}`); return true; }
      // A flavored syrup already doing the job (the honey in a Missionary's Downfall) takes the
      // extra sugar before a second sweetener goes in.
      const cap1 = l => Math.min(1, doseCap(l.id, A.family, asked(l)));
      const lead = lines.filter(l => free(l) && roomUp(l) && l.role === 'sweet' && !PLAIN.has(l.id) && sugarOf(l) >= 45 && l.oz >= 0.5 - 0.01 && l.oz < cap1(l) - 0.01).sort((x, y) => y.oz - x.oz)[0];
      if (lead) { set(lead, upTo(lead, Math.min(rungUp(lead.oz), cap1(lead)))); lead.oz0 = lead.oz; said.push(`more ${prose(lead.id)}`); return true; }
      // A sweet liqueur the frame is built on (a swizzle's falernum) is its sweetener: it comes up
      // before anything new goes in, to three-quarters of an ounce at most.
      const sigSweet = lines.filter(l => free(l) && roomUp(l) && l.role === 'modifier' && sugarOf(l) >= 25 && (A.signature || []).some(c => c.required && c.anyOf.includes(l.id)) && l.oz < Math.min(0.75, doseCap(l.id, A.family, asked(l))) - 0.01)[0];
      if (sigSweet) { set(sigSweet, upTo(sigSweet, Math.min(rungUp(sigSweet.oz), 0.75, doseCap(sigSweet.id, A.family, asked(sigSweet))))); sigSweet.oz0 = sigSweet.oz; said.push(`more ${prose(sigSweet.id)}`); return true; }
      const hasPlain = lines.some(l => free(l) && (PLAIN.has(l.id) || (l.role === 'sweet' && (A.signature || []).some(c => c.required && c.anyOf.includes(l.id) && c.anyOf.some(id => PLAIN.has(id))))));
      // "Less sweet" already lowered the band; under even that floor, the drink still needs sugar.
      const lessSweet = (intent.sweetness || 0) <= -0.6 && !(chemOf(lines, svc.method, svc.ice).sugarConc < B.sugar[0] - 0.15);
      const count = lines.filter(l => !l.garnish && (l.role !== 'aromatic' || l.muddled)).length;
      // At the line ceiling, a seasoning nobody asked for (saline drops) makes room for the sugar.
      const maxN = A.family === 'zombie' ? 9 : 7;
      if (!hasPlain && count >= maxN && !lessSweet) {
        const sea = lines.find(l => !l.garnish && SEASONING.has(l.id) && !asked(l) && !sole(l) && !l.twist && !l.swapped);
        if (sea) { lines.splice(lines.indexOf(sea), 1); said.push(`left out the ${prose(sea.id)}`); }
      }
      // At the line ceiling with no syrup to raise, a small fruit pour that has a syrup twin (passion
      // fruit, pineapple, guava) comes as the syrup: the same fruit, and it sweetens as well.
      if (!hasPlain && count >= maxN && !lessSweet) {
        const sigIds = new Set([...(A.signature || []), ...(A.optional || [])].flatMap(c => c.anyOf || []));
        const twin = l => { const id = `${l.id.replace(/-(juice|nectar|puree)$/, '')}-syrup`; return ingMap.has(id) && !forbidden(id, intent) && !(A.forbidden || []).includes(id) && (!sigIds.has(l.id) || sigIds.has(id)) ? id : null; };
        const j = lines.find(l => free(l) && l.role === 'juice' && !l.held && !asked(l) && l.oz <= 1 + 1e-6 && twin(l));
        if (j) { const id = twin(j), was = j.id; j.id = id; j.role = 'sweet'; j.oz = Math.min(j.oz, doseCap(id, A.family, false)); j.oz0 = j.oz; j.swapped = true; finalizeAmounts([j]); said.push(`${prose(id)} in place of ${prose(was)}`); return true; }
      }
      // (A ginger beer or cola top already is the sweetener: no plain syrup goes in beside it.)
      const sweetTop = lines.some(l => ['ginger-beer', 'cola', 'ginger-ale', 'lemon-lime-soda'].includes(l.id) && !l.float && !l.sink && !l.garnish && (l.oz || 0) >= 2);
      // (Nor beside a flavored syrup already doing the job, a mule's ginger syrup, unless the frame
      // itself is built on a plain syrup, a Mai Tai's rock candy: one sweetener per job.)
      // (A frozen drink under its floor still gets the rich simple: cold mutes sugar.)
      const flavoredJob = (svc.method !== 'blend' && lines.some(l => free(l) && l.role === 'sweet' && !PLAIN.has(l.id) && sugarOf(l) >= 45 && l.oz >= 0.25 - 0.01)
        && !(A.signature || []).some(c => c.required && (c.anyOf || []).some(id => PLAIN.has(id)))) || lines.some(l => l.sugarJob && free(l));
      if (!hasPlain && !sweetTop && !flavoredJob && lines.filter(l => !l.garnish && (l.role !== 'aromatic' || l.muddled)).length < maxN && !lessSweet) {
        const dark = lines.some(l => l.role === 'base' && /jamaican|demerara|navy|black|barbados|aged/.test(l.id));
        const slotPlain = [...(A.signature || []), ...(A.optional || [])].flatMap(c => c.anyOf || []).find(id => PLAIN.has(id) && ingMap.has(id) && !forbidden(id, intent));
        const id = [slotPlain, dark ? 'demerara-syrup' : 'rich-simple', 'rich-simple', 'simple-syrup'].find(x => x && ingMap.has(x) && !forbidden(x, intent) && !(A.forbidden || []).includes(x));
        if (id) { const l = { id, role: 'sweet', oz: 0.25, oz0: 0.25, slot: 'sugar', req: false }; finalizeAmounts([l]); lines.push(l); said.push(`added ${prose(id)}`); return true; }
      }
      const flav = lines.filter(l => free(l) && roomUp(l) && l.role === 'sweet' && !PLAIN.has(l.id) && sugarOf(l) >= 20 && l.oz < Math.min(1, doseCap(l.id, A.family, asked(l))) - 0.01).sort((x, y) => y.oz - x.oz)[0];
      if (flav) { set(flav, upTo(flav, Math.min(rungUp(flav.oz), Math.min(1, doseCap(flav.id, A.family, asked(flav)))))); flav.oz0 = flav.oz; said.push(`more ${prose(flav.id)}`); return true; }
      const rich = lines.filter(l => free(l) && roomUp(l) && l.role === 'rich' && sugarOf(l) >= 20 && l.oz < Math.max(2, l.range ? l.range[1] * 1.15 : 2) - 0.01)[0];
      if (rich) { set(rich, upTo(rich, rungUp(rich.oz))); rich.oz0 = rich.oz; said.push(`more ${prose(rich.id)}`); return true; }
      return false;
    };
    const sours = () => lines.filter(l => free(l) && l.role === 'sour' && (ingMap.get(l.id).acid || 0) >= 2);
    const lowerAcid = () => {
      // (The citrus furthest above its reference dose gives first.)
      const s = sours().filter(l => l.oz > Math.max(sours().length > 1 ? 0.25 : 0.5, l.min || 0, tart ? (l.oz0 || 0) * 0.85 : 0) + 0.01).sort((x, y) => (anchor ? (y.oz - refCitrus(y)) - (x.oz - refCitrus(x)) : 0) || y.oz - x.oz)[0];
      if (!s) return false;
      set(s, Math.max(sours().length > 1 ? 0.25 : 0.5, rungDown(s.oz))); said.push(`less ${prose(s.id)}`);
      return true;
    };
    const citrusNow = () => sours().reduce((t, l) => t + l.oz, 0);
    const raiseAcid = () => {
      if (citrusNow() + 0.125 > citrusCap + 0.01) return false;
      const s = sours().filter(l => l.oz < 1.25 - 0.01 && rungUp(l.oz) - l.oz + citrusNow() <= citrusCap + 0.01).sort((x, y) => y.oz - x.oz)[0];
      if (!s) return false;
      set(s, rungUp(s.oz)); s.oz0 = s.oz; said.push(`more ${prose(s.id)}`);
      return true;
    };
    // Inside the band, the family's sugar-to-acid window still holds (a frozen daiquiri gets its
    // sugar with the lime to match, not on its own): moved only within the band's edges.
    // (Anchored: the reference's own ratio, as the balance moved it for the prayer, ±10%; the
    // family's research window only when there is no reference.)
    const W = anchor && anchor.T ? [anchor.T * 0.9, anchor.T * 1.1] : famWin(A.family).sugarToAcid;
    const sweetAsk = intent.sweetness || 0;
    const ratioHi = c => W && c.acidG > 0.05 && c.sweetSour > W[1] * 1.03 && sweetAsk <= 0.5;
    const ratioLo = c => W && c.acidG > 0.05 && c.sweetSour < W[0] * 0.97 && !tart && !lessSweet;
    const acidRoom = c => sours().length && c.acidConc < (B.acid ? B.acid[1] : 1.2) - 0.06 && !((intent.tartness || 0) <= -0.6);
    const stuck = new Set(), acted = new Set();
    for (let i = 0; i < 48; i++) {
      const c = chemOf(lines, svc.method, svc.ice);
      const todo = [
        ['sugarHi', c.sugarConc > B.sugar[1] + 0.05, lower],
        ['acidHi', B.acid && c.acidConc > B.acid[1] + 0.02, lowerAcid],
        ['citrusHi', citrusNow() > citrusCap + 0.13, lowerAcid],
        // Loud both ways (over 10 g of sugar against more than a gram of acid): the citrus comes
        // down first, and the ratio brings the sugar down with it.
        ['loud', !tartAsk && c.sugarConc > 10 && c.acidConc > 1.0 && B.kind !== 'frozenCreamy', lowerAcid],
        ['sugarLo', c.sugarConc < B.sugar[0] - 0.15, raise],
        ['acidLo', B.acid && B.acid[0] > 0 && c.acidConc < B.acid[0] - 0.02 && sours().length, raiseAcid],
        // "Tart" is a hard constraint: a gram of acid or more, whatever trim came before.
        ['tartLo', tartAsk && c.acidConc < 1.05 && sours().length, raiseAcid],
        ['ratioHiAcid', ratioHi(c) && acidRoom(c), raiseAcid],
        ['ratioHiSugar', ratioHi(c) && c.sugarConc > B.sugar[0] + 0.4, lower],
        ['ratioLoSugar', ratioLo(c) && c.sugarConc < B.sugar[1] - 0.4, raise],
        ['ratioLoAcid', ratioLo(c) && c.acidConc > 0.55, lowerAcid],
      ].filter(([k, bad]) => bad && !stuck.has(k));
      if (!todo.length) break;
      const [k, , act] = todo[0];
      acted.add(k);
      // Never past the other edge: raising sugar stops at the ceiling, lowering at the floor.
      const snap0 = lines.map(l => ({ ...l }));
      if (!act()) { stuck.add(k); continue; }
      let c1 = chemOf(lines, svc.method, svc.ice);
      // A glass already full that still needs its sugar makes room in the spirit, a bar measure at
      // a time (never under half an ounce a pour or an ounce in all): a little gentler, in balance.
      if ((k === 'sugarLo' || k === 'tartLo') && c1.finalOz > maxFinal + 0.05) {
        // (First a juice the frame doesn't need, a lengthener nobody promised; then the spirit,
        // only down to the frame's own smallest pour, an ounce and a half for most.)
        const promisedIds = new Set((intent.promises || []).flatMap(pr => pr.ids || []));
        const spirits = () => lines.filter(l => l.role === 'base' && free(l) && (ingMap.get(l.id).abv || 0) >= 30 && ingMap.get(l.id).cat !== 'bitters');
        // (A frozen drink or a colada keeps its two ounces: it isn't a smoothie.)
        const spiritFloor = A.family === 'colada' || svc.method === 'blend' ? 2 : Math.max(1, Math.min(1.5, ((A.ratios || {}).baseOz || [1.5])[0]));
        for (let r = 0; r < 6 && c1.finalOz > maxFinal + 0.05; r++) {
          // (A float of overproof is spirit in the glass too.)
          const total = spirits().reduce((t, l) => t + l.oz, 0) + lines.filter(l => l.role === 'base' && l.float && !l.garnish && (ingMap.get(l.id).abv || 0) >= 30).reduce((t, l) => t + (l.oz || 0), 0);
          const room = lines.filter(l => free(l) && ['juice', 'lengthener'].includes(l.role) && sugarOf(l) < 20 && !sole(l) && !asked(l) && !l.held && !promisedIds.has(l.id) && l.oz > (l.role === 'lengthener' ? 1 : 0.5) + 0.01).sort((x, y) => y.oz - x.oz)[0];
          const b = !room && spirits().filter(l => l.oz > 0.5 + 0.01 && !asked(l)).sort((x, y) => y.oz - x.oz)[0];
          if (room) set(room, Math.max(room.role === 'lengthener' ? 1 : 0.5, rungDown(room.oz)));
          else if (b && total - 0.25 >= spiritFloor - 0.01) set(b, Math.max(0.5, b.oz - 0.25));
          else break;
          c1 = chemOf(lines, svc.method, svc.ice);
        }
      }
      const overshot = c1.finalOz > maxFinal + 0.05 || (/Lo(Sugar)?$/.test(k) && /sugar|Sugar/.test(k) && c1.sugarConc > B.sugar[1] + 0.3)
        || (/Hi(Sugar)?$/.test(k) && /sugar|Sugar/.test(k) && B.sugar[0] > 0 && c1.sugarConc < B.sugar[0] - 0.3)
        || (/Acid$/.test(k) && /^ratio/.test(k) && (c1.acidConc > (B.acid ? B.acid[1] : 1.2) + 0.03 || c1.acidConc < (B.acid ? B.acid[0] : 0) - 0.03))
        // A ratio move that swings past the other end of the window is no better.
        || (/^ratioHi/.test(k) && W && c1.sweetSour < W[0] * 0.97) || (/^ratioLo/.test(k) && W && c1.sweetSour > W[1] * 1.03);
      if (typeof process !== 'undefined' && process.env && process.env.DEBUG_BAND) console.log('band', k, overshot ? 'OVERSHOT' : 'ok', lines.map(l => `${l.id}:${l.oz}`).join(' '), c1.finalOz.toFixed(2), maxFinal);
      if (overshot) { lines.splice(0, lines.length, ...snap0); said.pop(); stuck.add(k); }
    }
    if (said.length) {
      // What actually changed, net: a syrup added and then trimmed back is "added", once.
      const after = new Map(lines.filter(l => !l.garnish).map(l => [l.id, l.oz || 0]));
      const uniq = [];
      for (const [id, oz] of after) { const b = before.get(id); if (b === undefined) uniq.push(`added ${prose(id)}`); else if (oz > b + 0.02) uniq.push(`more ${prose(id)}`); else if (oz < b - 0.02) uniq.push(`less ${prose(id)}`); }
      for (const [id] of before) if (!after.has(id) && !SEASONING.has(id)) uniq.push(`no ${prose(id)}`);
      for (const [id] of before) if (!after.has(id) && SEASONING.has(id)) uniq.push(`left out the ${prose(id)}`);
      const up = uniq.some(x => /^(more|added)/.test(x)), down = uniq.some(x => /^(less|no) /.test(x));
      const why = { hotCreamy: ['a hot drink needs a little sugar', 'even a creamy hot drink cloys that sweet'], shakenSour: ['a shaken sour this lean tastes thin', 'a shaken sour this sweet cloys'], frozenSour: ['a frozen drink needs the sugar (cold mutes it)', 'even frozen, that much sugar cloys'], frozenCreamy: ['a frozen drink needs the sugar (cold mutes it)', 'even frozen, that much sugar cloys'], punch: ['a punch over a block wants a little more sugar', 'a punch that sweet cloys by the second cup'], stirred: ['', 'a stirred drink stays under ten grams of sugar'], hot: ['a hot drink needs a little sugar', 'a hot drink that sweet cloys'] }[B.kind] || ['', 'that much sugar cloys'];
      // The reason is the band that moved it; a move made only for the sugar-to-sour ratio says so.
      const onlyRatio = [...acted].every(k => k.startsWith('ratio'));
      const reason = onlyRatio ? 'so the sweet and the sour meet' : acted.has('acidHi') && !acted.has('sugarHi') && !acted.has('sugarLo') ? 'it was sharper than it should be' : acted.has('sugarLo') || (up && !down) ? why[0] : why[1];
      if (uniq.length) notes.push(`${list(uniq.slice(0, 3))}${reason ? `: ${reason}` : ''}`);
    }
    return B;
  }
  // ---------- the reference, the asks, and the one final pass ----------
  // Riff discipline: a generated drink is a proven reference (the spec it started from, or the
  // drink it riffs on) plus two or three deliberate changes. The anchor records that reference:
  // its bottles and doses, its citrus, its sugar-to-acid ratio and its acid as this drink is
  // served. Later passes correct only what the changes disturbed, against it, never against a
  // family mean.
  function anchorOf(ref, refMethod, svc) {
    if (!ref || !ref.length) return null;
    const live = ref.filter(l => !l.garnish && ingMap.has(l.id) && (ingMap.get(l.id).role !== 'aromatic'));
    const body = live.filter(l => !l.sink && !l.float);
    const acidic = l => l.role === 'sour' && (ingMap.get(l.id).acid || 0) >= 2;
    const citrusById = new Map();
    for (const l of body.filter(acidic)) citrusById.set(l.id, (citrusById.get(l.id) || 0) + (l.oz || 0));
    const dose = new Map();
    for (const l of live) dose.set(l.id, (dose.get(l.id) || 0) + (l.oz || 0));
    const own = chemOf(body, refMethod || svc.method, svc.ice);
    const now = chemOf(body, svc.method, svc.ice);
    return {
      ids: new Set(live.map(l => l.id)), dose, citrusById,
      citrus: [...citrusById.values()].reduce((t, x) => t + x, 0),
      count: live.length, R: own.sweetSour, acid: now.acidConc, sugar: now.sugarConc, T: null,
      base: body.filter(l => (ingMap.get(l.id).role === 'base') && (ingMap.get(l.id).abv || 0) >= 30).reduce((t, l) => t + (l.oz || 0), 0),
    };
  }

  // Directional asks are hard constraints that every later pass respects. "Creamy" or
  // "coconutty" holds cream of coconut at an ounce or more (and, in the band, acid at 0.7 or
  // less); "less sweet" caps every sweetener at the reference's own dose (or where it stands now),
  // so no later pass can put sugar back; a frozen Painkiller asked less sweet keeps its cream of
  // coconut at an ounce at most.
  const creamyAsk = intent => !!(intent.style.creamy || ((intent.tags || {}).creamy || 0) >= 1 || ((intent.tags || {}).coconut || 0) >= 1.5);
  function askHolds(lines, A, intent, anchor) {
    const live = lines.filter(l => !l.garnish && !l.muddled && !l.float && !l.sink);
    if (creamyAsk(intent) && !intent.style.hot) for (const l of live.filter(l => l.id === 'coconut-cream')) {
      l.min = Math.max(l.min || 0, 1);
      if ((l.oz || 0) < 1 - 0.01) { l.oz = 1; l.oz0 = Math.max(l.oz0 || 0, 1); }
    }
    if ((intent.sweetness || 0) <= -0.6) for (const l of live.filter(l => l.role !== 'base' && (ingMap.get(l.id).sugar || 0) >= 20)) {
      const ref = anchor && anchor.dose.has(l.id) ? anchor.dose.get(l.id) : Infinity;
      const cap = Math.min(ref, l.oz || 0, l.id === 'coconut-cream' ? 1 : Infinity);
      // (Set once, from the reference or the dose the balance chose: a later trim never ratchets it down.)
      if (l.max === undefined) l.max = Math.max(l.min || 0, cap);
      if (l.oz > l.max + 0.01) l.oz = l.max;
    }
  }

  // A drink that promises to be long and fizzy (a highball, bubbles for a celebration, Tokyo's
  // neon tonic, a street party's soda) pours at least two ounces of it per serve (three for a
  // promise that says so); the extra length comes out of the main juice, like for like.
  function carbonation(lines, A, intent, svc, notes) {
    if (svc.method === 'hot' || svc.method === 'blend') return;
    const promised = Math.max(0, ...(intent.promises || []).map(pr => +pr.long || 0));
    const wants = !!(intent.style.long || ((intent.tags || {}).effervescent || 0) >= 1 || promised > 0);
    if (!wants) return;
    const low = (intent.strength || 0) <= -1.5;
    const tops = lines.filter(l => LONG_TOPS.has(l.id) && !l.float && !l.sink && !l.garnish && !(low && (ingMap.get(l.id).abv || 0) > 0)).sort((x, y) => y.oz - x.oz);
    if (!tops.length) return;
    const top = tops[0], want = Math.max(2, Math.min(4, promised || 2));
    if (top.oz >= want - 0.01) return;
    const add = want - top.oz;
    top.oz = want; top.oz0 = Math.max(top.oz0 || 0, want); top.min = Math.max(top.min || 0, want);
    finalizeAmounts([top]);
    const juice = lines.filter(l => l.role === 'juice' && !l.held && !l.float && !l.sink && !l.garnish && !(intent.ings[l.id] >= 1) && l.oz > 1.5).sort((x, y) => y.oz - x.oz)[0];
    if (juice) { juice.oz = Math.max(1, juice.oz - add); juice.oz0 = Math.min(juice.oz0 || juice.oz, juice.oz); finalizeAmounts([juice]); }
    notes.push(`${fracOz(want)} oz of ${prose(top.id)}${juice ? ` (less ${prose(juice.id)})` : ''}, so it really drinks long and fizzy`);
  }

  // The balance half of the final pass: one sweetener per job, the identity core at its dose,
  // the asks held, then the absolute band anchored to the reference, never past `maxFinal`
  // finished ounces. A color the guest demanded is checked once more after it.
  function settleFinal(lines, A, intent, svc, notes, { anchor = null, maxFinal = Infinity } = {}) {
    // "Less sweet" frozen reaches the frozen floor with less dilution (less ice in the blender),
    // never with more sweetener.
    if (svc.method === 'blend' && (intent.sweetness || 0) <= -0.6 && !svc.lessIce) {
      svc.lessIce = true; leanBlend = true;
      notes.push('blended with less ice, so it is less sweet without tasting thin');
    }
    if (!(intent.asWritten && !lines.some(l => l.slot === 'color') && svc.method !== 'blend')) {
      carbonation(lines, A, intent, svc, notes);
      oneSweetener(lines, A, intent, notes, l => (intent.ings[l.id] || 0) >= 1.5 || (intent.spirits || []).includes(l.id), anchor);
      coreDoses(lines, A, notes, anchor);
      askHolds(lines, A, intent, anchor);
    }
    bandPass(lines, A, intent, svc, notes, { maxFinal, anchor });
    if (intent.color && COLOR_TEST[intent.color] && !intent.asWritten) {
      const k = chemOf(lines, svc.method, svc.ice);
      const shows = showsColor(drinkLook(lines, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: Math.max(0, k.finalOz - k.volOz) }), intent.color);
      const before = lines.map(l => `${l.id}:${l.oz}`).join();
      if (colorPass(lines, A, intent, svc, notes) && lines.map(l => `${l.id}:${l.oz}`).join() !== before) bandPass(lines, A, intent, svc, notes, { maxFinal, anchor });
      void shows;
    }
  }

  // The one final balance-and-fit pass. It runs on every path (a classic as written, a riff, a
  // vessel the guest asked for): the balance above, then the capacity check with service's
  // needOf (one capacity model), then the balance again told never to grow past the glass, until
  // the drink holds both. A classic poured as written that overflows moves to a glass that holds
  // it (service's chooseVessel) instead of being scaled; a hot drink scales every line together,
  // so the hot water never shrinks alone, and holds 12% ABV or less. Last, every line prints
  // exactly the ounces the stats were computed from.
  function finalPass(lines, A, intent, svc, notes, { pick = null, classic = false, anchor = null, rechoose = null } = {}) {
    const n = intent.servings || 1;
    const load = v => needOf(chemOf(lines, svc.method, svc.ice), v, svc, n);
    const over = v => { const x = load(v); return x.oz > x.hi + 0.02; };
    if (!classic) settleFinal(lines, A, intent, svc, notes, { anchor });
    const canonical = classic || intent.asWritten;
    for (let r = 0; pick && r < 5 && over(pick.v); r++) {
      // (A drink far too big for its glass is better served in another than shrunk by a fifth or
      // more; a classic as written is never shrunk while another glass holds it.)
      const x0 = load(pick.v);
      const longTop = lines.some(l => LONG_TOPS.has(l.id) && !l.float && (l.min || 0) >= 2 - 0.01);
      if (rechoose && r === 0 && !['asked', 'occasion'].includes(pick.why) && (canonical || longTop || x0.oz > x0.hi * 1.15)) {
        const alt = rechoose();
        if (alt && alt.v.id !== pick.v.id) {
          const y = load(alt.v);
          if (y.oz <= y.hi + 0.02 && y.oz >= y.lo * 0.85) {
            for (let i = notes.length - 1; i >= 0; i--) if (/^(scaled to fit|a bigger pour so it fills) /.test(notes[i])) notes.splice(i, 1);
            pick = alt; (svc.waived = svc.waived || []).push('vessel by fit'); continue;
          }
        }
      }
      if (svc.method === 'hot') scaleTogether(lines, svc, pick.v, n);
      if (over(pick.v)) fitVessel(lines, svc, pick.v, notes, A, n, false);
      if (over(pick.v)) fitVessel(lines, svc, pick.v, notes, A, n, false, true);
      // (The balance may use whatever room the glass still has, never more: `oz` scales with the pours.)
      if (!classic && r < 3) { const x = load(pick.v), f = chemOf(lines, svc.method, svc.ice).finalOz; settleFinal(lines, A, intent, svc, notes, { anchor, maxFinal: x.oz > 0 ? f * Math.max(1, x.hi / x.oz) : f }); }
    }
    if (svc.method === 'hot' && !classic && !intent.style.zeroProof) hotStrength(lines, A, intent, svc, notes, pick, n, anchor);
    printTrue(lines);
    // A note that promised length the glass then took back is no longer true.
    const top = lines.filter(l => LONG_TOPS.has(l.id) && !l.float && !l.sink).reduce((t, l) => Math.max(t, l.oz || 0), 0);
    for (let i = notes.length - 1; i >= 0; i--) { const m = notes[i].match(/^(\S+) oz of .*, so it really drinks long and fizzy$/); if (m && top < 2 - 0.01) notes.splice(i, 1); }
    // A note that promised a full pour the glass then took back is no longer true.
    const body = lines.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish).reduce((t, l) => t + (l.oz || 0), 0);
    const ozOf = t => { const m = t.match(/^(\d*)([¼½¾⅓⅔⅛]?)$/); return m ? (+m[1] || 0) + ({ '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 }[m[2]] || 0) : 0; };
    for (let i = notes.length - 1; i >= 0; i--) { const m = notes[i].match(/^a full (\S+) oz of spirit so it isn't a smoothie$/); if (m && body < ozOf(m[1]) - 0.05) notes.splice(i, 1); }
    return pick;
  }
  // Every line down together, a bar measure at a time, until the glass holds it.
  function scaleTogether(lines, svc, v, n) {
    const live = lines.filter(l => !l.garnish && !l.muddled && l.role !== 'aromatic' && (l.oz || 0) > 0 && !['dash', 'drop'].includes(l.unit));
    for (let i = 0; i < 12; i++) {
      const x = needOf(chemOf(lines, svc.method, svc.ice), v, svc, n);
      if (x.oz <= x.hi + 0.02) return;
      const k = Math.max(0.85, Math.min(0.97, x.hi / x.oz));
      const was = live.map(l => l.oz).join();
      for (const l of live) l.oz *= k;
      finalizeAmounts(live);
      if (live.map(l => l.oz).join() === was) for (const l of live.filter(l => l.oz > 0.5).sort((a, b) => b.oz - a.oz).slice(0, 1)) { l.oz = rungDown(l.oz); finalizeAmounts([l]); }
    }
  }
  // A hot drink is a toddy, not a nip in a mug: 12% ABV at most. More hot water first, while the
  // mug holds it; then the spirit comes down a quarter-ounce at a time, never under an ounce and a half.
  function hotStrength(lines, A, intent, svc, notes, pick, n, anchor) {
    const CAP = 12;
    const water = lines.find(l => l.role === 'lengthener' && /hot-water|black-tea|lapsang-tea|coffee|whole-milk/.test(l.id) && !l.float && !l.sink);
    const spirits = () => lines.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish && (ingMap.get(l.id).abv || 0) >= 30);
    let moved = false;
    for (let i = 0; i < 16; i++) {
      const c = chemOf(lines, svc.method, svc.ice);
      if (c.abv <= CAP) break;
      if (water && pick) {
        water.oz += 0.5;
        const x = needOf(chemOf(lines, svc.method, svc.ice), pick.v, svc, n);
        if (x.oz <= x.hi + 0.02) { finalizeAmounts([water]); moved = true; continue; }
        water.oz -= 0.5;
      }
      const total = spirits().reduce((t, l) => t + l.oz, 0);
      const b = spirits().filter(l => l.oz > 0.5 + 0.01).sort((x, y) => y.oz - x.oz)[0];
      if (!b || total - 0.25 < 1.5 - 0.01) break;
      b.oz -= 0.25; finalizeAmounts([b]); moved = true;
      if (water) { water.oz += 0.25; finalizeAmounts([water]); if (pick && needOf(chemOf(lines, svc.method, svc.ice), pick.v, svc, n).oz > needOf(chemOf(lines, svc.method, svc.ice), pick.v, svc, n).hi + 0.02) { water.oz -= 0.5; finalizeAmounts([water]); } }
    }
    if (moved) {
      bandPass(lines, A, intent, svc, notes, { maxFinal: chemOf(lines, svc.method, svc.ice).finalOz, anchor });
      notes.push(`about ${Math.round(chemOf(lines, svc.method, svc.ice).abv)}% ABV: a hot drink is sipped long, not knocked back`);
    }
  }
  // Print what you compute: a line whose printed amount (amount × unit) is not the ounces the
  // stats were computed from is snapped again, so the card and the chemistry agree.
  function printTrue(lines) {
    for (const l of lines) {
      if (l.muddled || l.garnish || l.role === 'aromatic' || l.amount === null || l.amount === undefined) continue;
      const ing = ingMap.get(l.id);
      const f = l.unit === 'piece' ? (ing.oz_per_piece || 0) : units[l.unit];
      if (f === undefined || f === null) continue;
      if (Math.abs(l.amount * f - (l.oz || 0)) > 0.02) finalizeAmounts([l]);
    }
  }
  const fracOz = x => fracStr(Math.round(x * 4) / 4);

  function finalizeAmounts(lines) {
    for (const l of lines) {
      if (l.muddled) { l.oz = 0; continue; }
      const ing = ingMap.get(l.id);
      const s = snap(l.oz, ing, l.role);
      l.amount = s.amount; l.unit = s.unit; l.oz = s.oz;
    }
  }

  // ---------- method, glass, garnish ----------
  // Canonical service (round-2 critique §3): a named classic, or a drink built from one of its
  // proven specs, is served the way that spec serves it: its method, its ice and its vessel (a
  // Daiquiri No. 4 is the Floridita frappé, a Hemingway goes up in a coupe, a Missionary's
  // Downfall is blended, a Painkiller comes in the Pusser's tin, a Pi Yi in its pineapple), and
  // it keeps the aromatic it is muddled around (the Gin-Gin Mule's mint). A drink whose lines
  // turn out to be a proven classic is that classic. The prayer may fix the method (frozen, hot,
  // stirred, served up) or the vessel; what it overrides is recorded in svc.waived, and
  // svc.canon names the service the canon would have given, for the card and its checks.
  function service(svc, A, lines, intent, notes, riffSrc = null, post = false) {
    // Bitters a spec marks to sit on top are a crown dashed onto the ice, not a float.
    if (!post) for (const l of lines) if (l.float && (ingMap.get(l.id).cat === 'bitters' || ['dash', 'drop'].includes(l.unit))) { l.float = false; l.crown = true; }
    // A celebration topped with bubbles goes up in a flute or a coupe (a Sparkling Mai Tai), if
    // nothing in it needs ice or length: shaken with cubes, strained, then topped.
    const aff = intent.vesselAffinity || {};
    const bubbles = lines.some(l => l.id === 'sparkling-wine' && !l.float && !l.sink && !l.garnish);
    const long = lines.some(l => (l.role === 'lengthener' && l.id !== 'sparkling-wine') || (l.role === 'juice' && l.oz > 2)) || A.creamy;
    const celebrate = !post && bubbles && !long && Math.max(aff.flute || 0, aff.coupe || 0) >= 1.4 && (intent.servings || 1) < 2 && !intent.vessel
      && !intent.style.frozen && !intent.style.hot && !intent.style.stirred && (A.methods || []).includes('shake') && !svc.wantUp
      // (A low-ABV prayer is a long drink, lengthened on purpose: a flute can't hold it at 7%.)
      && !((intent.strength || 0) <= -1.5);
    if (celebrate) {
      svc.method = 'shake'; svc.ice = 'cubed'; svc.wantUp = true;
      notes.push('served up and topped with bubbles, for the celebration');
    }
    const specByRef = id => {
      const [aid, ...rest] = String(id || '').split(':');
      const a = archetypes.find(x => x.id === aid);
      const sp = a && (a.canonicalSpecs || []).find(x => x.name === rest.join(':'));
      return sp ? { a, sp } : null;
    };
    let canon = null;
    // The classic these lines are (95% the same as a proven spec or a well-known drink).
    let best = null;
    for (const c of pool()) {
      const sm = copy.sameness(lines, c.lines);
      if (sm >= 0.95 && (!best || sm > best.sm + 1e-9 || (Math.abs(sm - best.sm) < 1e-9 && c.kind === 'spec' && best.c.kind !== 'spec'))) best = { c, sm };
    }
    if (best && best.c.kind === 'spec') { const f = specByRef(best.c.id); if (f && f.sp.method) canon = { name: best.c.name, spec: f.sp, method: f.sp.method, ice: f.sp.ice, vessel: f.sp.vessel, exact: true }; }
    else if (best && drinkById[best.c.id]) { const d = drinkById[best.c.id]; canon = { name: d.name, drink: d, method: d.method, ice: d.ice, vessel: d.vessel, exact: true }; }
    // After balancing, only a drink that has become a classic outright changes its service.
    if (post && (!canon || (svc.canon && svc.canon.name === canon.name && svc.canon.method === canon.method))) return false;
    // Else the spec it was built from, or the drink it riffs on.
    const started = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
    const sp = started && (A.canonicalSpecs || []).find(x => x.name === started);
    if (!canon && riffSrc) canon = { name: riffSrc.name, drink: riffSrc, method: riffSrc.method, ice: riffSrc.ice, vessel: riffSrc.vessel };
    if (!canon && sp && sp.method) canon = { name: sp.drink || sp.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), spec: sp, method: sp.method, ice: sp.ice, vessel: sp.vessel };
    if (!canon) return false;
    svc.canon = { name: canon.name, method: canon.method, ice: canon.ice, vessel: canon.vessel };
    const waive = w => { if (!(svc.waived = svc.waived || []).includes(w)) svc.waived.push(w); };
    // The aromatic its spec muddles in goes back in (unless the guest refused it).
    const canonLines = canon.spec ? specLines(canon.spec) : canon.drink ? asPoured(linesOf(canon.drink)) : [];
    const rawLines = canon.spec ? canon.spec.lines : canon.drink ? canon.drink.ingredients : [];
    if (!post) for (const l of canonLines) {
      if (!l.muddled || lines.some(x => x.id === l.id && x.muddled) || forbidden(l.id, intent)) continue;
      const src = rawLines.find(x => x.id === l.id && !x.garnish) || {};
      const g = lines.findIndex(x => x.id === l.id);
      if (g >= 0) lines.splice(g, 1);
      lines.push({ id: l.id, role: 'aromatic', oz: 0, unit: src.unit || 'leaves', amount: src.amount || 8, muddled: true, garnish: false, fromSpec: canon.name });
    }
    // What the prayer fixed: frozen, hot, stirred or served up (a frappé in a coupe is still
    // served up); a vessel asked for; a named drink prayed again and blended this time.
    const upCanon = !!(vesselById[canon.vessel] && vesselById[canon.vessel].serve.includes('up'));
    const fixed = !!(intent.vessel || (svc.wantUp && !upCanon) || intent.style.hot || intent.style.stirred || (intent.style.frozen && svc.method === 'blend') || notes.some(n => /^blended this time/.test(n)));
    const hot = m => m === 'hot';
    if (!canon.method || hot(canon.method) !== hot(svc.method)) return false;
    if (fixed) { if (canon.method !== svc.method) waive(intent.vessel ? 'method by vessel' : 'method by prayer'); return false; }
    // Only a service the frame knows, unless the lines are that classic outright.
    if (!canon.exact && !(A.methods || []).includes(canon.method)) return false;
    if (canon.method === svc.method && (canon.ice || svc.ice) === svc.ice) return false;
    // Carbonation is never blended.
    if (canon.method === 'blend' && lines.some(l => FIZZY.has(l.id) && !l.float && !l.sink && !l.garnish)) return false;
    svc.method = canon.method;
    // A blender takes its own ice; a flash-blend or a swizzle is crushed ice, whatever the book wrote.
    svc.ice = canon.method === 'blend' ? 'blended' : ['flash-blend', 'swizzle'].includes(canon.method) && !['crushed', 'pebble', 'shaved', 'ice-cone'].includes(canon.ice) ? 'crushed' : canon.ice || svc.ice;
    if (svc.method === 'blend') blenderContext = true;
    return true;
  }

  // ---------- vessel ----------
  // Every drink gets one specific vessel. Asked-for beats a named classic's own (unless the
  // prayer's occasion fixes another, which the card records as waived), then the riff source's,
  // then the occasion's (an unbreakable tumbler by the pool, a flute for a celebration), then the
  // archetype's and the family's habits. The vessel must take the drink's service (up, rocks,
  // crushed, frozen, hot, bowl) and hold it inside the capacity band (needOf): a small drink goes
  // in a small vessel, a big one is never crammed into a small one.
  const CONF = { high: 3, medium: 2, low: 1 };
  const OPAQUE_VESSELS = new Set(['ku-mug', 'moai-mug', 'skull-mug', 'barrel-mug', 'fog-cutter-mug', 'bird-mug', 'coconut', 'pineapple', 'clay-cup', 'hot-mug', 'enamel-tin', 'copper-mug', 'julep-cup', 'tiki-bowl', 'volcano-bowl', 'scorpion-bowl']);
  function chooseVessel(famId, intent, svc, chem, src, rng, greedy, A = null, layers = [], opts = {}) {
    if (!vesselList.length) return null;
    const service = serviceOf(svc.method, svc.ice);
    const servings = intent.servings || 1;
    const bowl = (!!intent.style.bowl && servings >= 2) || servings >= 3;
    // A punch bowl is for a crowd; the tiki, volcano and Scorpion bowls are for two to six.
    const bowlFor = v => v.id === 'punch-bowl' ? servings >= 6 : servings <= 6;
    // A swizzle stick needs straight sides to spin: no pinched hurricane, no stem, no snifter.
    const swizzleOk = v => svc.method !== 'swizzle' || ['collins', 'highball', 'footed-pilsner', 'julep-cup', 'dof', 'chimney', 'acrylic-tumbler', 'acrylic-ribbed'].includes(v.id);
    // Shaved ice pressed into a stemmed glass as a shell (the Floridita's Hemingway, Don's
    // Beachcomber's Gold) is how a canonical spec serves it, never a default.
    const canonV0 = svc.canon && vesselById[svc.canon.vessel];
    const shell = v => svc.ice === 'shaved' && v.serve.includes('up') && v.id !== 'flute' && !!canonV0 && canonV0.serve.includes('up');
    const takes = v => (v.serve.includes('bowl') ? bowl && bowlFor(v) : !bowl && (SERVICE_FITS[service].some(x => v.serve.includes(x)) || shell(v))) && swizzleOk(v);
    // A color, a sink, a float or a crown has to be seen: no opaque mug, tin or shell for it.
    const showy = !!(intent.color || intent.style.layered || (layers || []).length);
    const seen = v => !(showy && (OPAQUE_VESSELS.has(v.id) || !['glass', 'acrylic', 'bowl'].includes(v.kind)));
    // An archetype's own vessel (the Tom and Jerry's milk glass, the Painkiller's tin, the Papa
    // Doble's goblet) stands for the generic one its spec names when it takes the same service.
    const identity = A ? vesselList.filter(v => (v.archetypes || []).includes(A.id) && takes(v) && seen(v)) : [];
    const canonV = canonV0 && identity.find(v => v.kind !== canonV0.kind && vesselClass(v.id) === vesselClass(canonV0.id) || (v.serve.includes('hot') && canonV0.serve.includes('hot'))) || canonV0;
    // A classic poured as written keeps its doses: it moves to a vessel that holds it as it is
    // rather than being scaled to one that doesn't (a trim would make it something else).
    const asWritten = !!(opts.asWritten || intent.asWritten);
    // 1 inside the band; a little over is trimmed to fit; under it, the drink looks lost. A trim
    // holds the spirit at an ounce and a half, so the smallest balanced drink has to fit.
    const baseOz = (chem.byRole || {}).base || 0;
    // (A gentle pour already under it scales with everything else.)
    // (Not a low-ABV drink: its half-ounce pours can't come down a bar measure, so a trim would
    // only shorten the juice and soda that keep it light. It needs a glass that holds it whole.)
    const least = (intent.strength || 0) <= -1.5 ? 1 : baseOz > 1.5 ? 1.5 / baseOz : baseOz > 0 && baseOz < 1.5 ? 0.6 : 1;
    const fitOf = v => {
      const x = needOf(chem, v, svc, servings);
      if (asWritten ? x.oz > x.hi + 0.05 : x.oz > x.hi * 1.15 || x.oz * least > x.hi * 1.02) return 0;
      if (x.oz > x.hi) return 0.6;
      if (x.oz < x.lo * 0.7) return 0;
      return x.oz >= x.lo ? 1 : 0.4 * Math.pow(x.oz / x.lo, 2);
    };
    // How snugly it sits (1 at the top of the band, less in a glass it would be lost in): small
    // drinks go in small vessels.
    const snugOf = v => { const x = needOf(chem, v, svc, servings); return x.hi > 0 ? Math.max(0.25, Math.min(1, x.oz / x.hi)) : 0.25; };
    const asked = intent.vessel && vesselById[intent.vessel];
    if (asked) {
      if (canonV && canonV.id !== asked.id) (svc.waived = svc.waived || []).push('vessel by prayer');
      return { v: asked, why: 'asked' };
    }
    const ok = v => takes(v) && fitOf(v) > 0 && seen(v);
    const aff = intent.vesselAffinity || {};
    // (A vessel shares the occasion affinity of the one it is `like`: the ribbed acrylic tumbler
    // by the pool, the big wine glass where a prayer leans toward stemware.)
    const affOf = v => Math.max(aff[v.id] || 0, v.like ? aff[v.like] || 0 : 0);
    // The occasion's own vessel, when the prayer leans on it hard; a drink a little too big for
    // it is trimmed to fit and a little small grown (fitVessel), since the occasion is the point,
    // and more so where glass itself is the hazard (the unbreakable tumbler by the pool).
    // (Where the vessel is the point because glass is the hazard, the trim may hold the spirit at
    // its real pour and take the rest down to three-fifths: a frozen drink packed with fruit fits
    // the pool's tumbler a little stronger, never weaker.)
    const heldPour = A && (A.family === 'colada' || svc.method === 'blend') ? 2 : 1.5;
    const leastHeld = (intent.strength || 0) > -1.5 && chem.volOz > 0 && baseOz > 0 ? Math.min(least, (Math.min(baseOz, heldPour) + 0.6 * Math.max(0, chem.volOz - baseOz)) / chem.volOz) : least;
    const glassy = v => ['glass', 'milk-glass'].includes(v.kind);
    // (A riff a little small for the classic's own glass grows into it: fitVessel adds juice and
    // sweet in proportion, never past a fifth more.)
    const growable = v => { if (asWritten) return false; const x = needOf(chem, v, svc, servings); return x.oz <= x.hi && x.oz >= x.lo * 0.8; };
    const relaxed = v => { const x = needOf(chem, v, svc, servings); return x.oz <= x.hi * 1.25 && x.oz >= x.lo * 0.85; };
    const trimTo = v => {
      const x = needOf(chem, v, svc, servings);
      if (asWritten) return x.oz <= x.hi + 0.05 && x.oz >= x.lo * 0.85;
      return x.oz <= x.hi * (glassy(v) ? 1.6 : 2) && x.oz * (glassy(v) ? least : leastHeld) <= x.hi * (glassy(v) ? ['up', 'shell'].includes(x.kind) ? 1.12 : 1.05 : 1.2) && x.oz >= x.lo * (glassy(v) ? 0.95 : 0.75);
    };
    // (Of the vessels the occasion leans on equally, the one the drink fits best.)
    const occasion = vesselList.filter(v => affOf(v) >= 1.5 && takes(v) && seen(v) && trimTo(v))
      .sort((a, b) => affOf(b) - affOf(a) || (fitOf(b) === 1) - (fitOf(a) === 1) || snugOf(b) - snugOf(a))[0] || null;
    // The occasion overrides a classic's own vessel only where it is the point: glass is the
    // hazard (acrylic), the vessel is the theme (a barrel mug for pirates, a coconut), bubbles go
    // up in a flute, or a drink to be seen can't hide in the classic's opaque mug. One clear
    // glass for another is no reason to leave the canon (a sunrise Hurricane stays in its
    // hurricane glass).
    const occasionWins = o => !!o && (!glassy(o) || o.id === 'flute' || (svc.wantUp && o.serve.includes('up')) || !seen(canonV) || affOf(o) >= 2.5);
    // Fire the prayer asked for, on a drink that can carry it (a crushed or frozen cap, a bowl),
    // needs a vessel that can take the flame: that fixes the vessel too.
    const fire = !!((intent.askedStyle || {}).flaming || intent.style.flaming) && (bowl || ['crushed', 'frozen'].includes(service));
    const FIRE_OK = (((rules || {}).garnish || {}).fire || {}).allowedVessels || [...FIRE_VESSELS];
    const fireBars = v => fire && !FIRE_OK.includes(v.id) && FIRE_OK.some(id => vesselById[id] && ok(vesselById[id]));
    // The same class of vessel as the canon's (a poco grande for a hurricane, both resort glasses),
    // from the archetype's own glassware, that the drink fits snugly: a small frozen drink is not
    // lost in the classic's twenty-ounce glass, and a classic as written that won't fit with its
    // ice moves rather than being scaled.
    const sibling = () => {
      if (!canonV) return null;
      const mine = new Set([...(A && A.vessels) || [], ...identity.map(v => v.id), canonV.id]);
      const sameClass = v => vesselClass(v.id) === vesselClass(canonV.id) || (mine.has(v.id) && v.kind === canonV.kind);
      return vesselList.filter(v => v.id !== canonV.id && sameClass(v) && takes(v) && seen(v) && !fireBars(v) && fitOf(v) === 1)
        .sort((a, b) => (mine.has(b.id) - mine.has(a.id)) || snugOf(b) - snugOf(a))[0] || null;
    };
    if (canonV && fireBars(canonV)) (svc.waived = svc.waived || []).push('vessel by prayer');
    // A named classic is served the way the canon serves it, unless the occasion fixes another
    // vessel (two stemmed glasses for an up drink are the same service: only the glass is waived).
    // (Its own vessel is worth a trim or a little growth, as an occasion's is.)
    // (A classic as written that no sibling holds stays in its own vessel and gives a little there,
    // rather than leaving its class: a Suffering Bastard in a collins, never a wine glass.)
    else if (canonV && takes(canonV) && seen(canonV) && (fitOf(canonV) >= 0.4 || trimTo(canonV) || growable(canonV) || (asWritten && relaxed(canonV)))) {
      if (occasion && occasion.id !== canonV.id && occasionWins(occasion)) {
        (svc.waived = svc.waived || []).push(occasion.serve.includes('up') && canonV.serve.includes('up') ? 'stemmed glass by prayer' : 'vessel by prayer');
        return { v: occasion, why: 'occasion' };
      }
      // (A frozen drink lost in the classic's big glass, or a classic as written that doesn't fit
      // it, goes to a sibling; anything else is grown or trimmed in its own vessel.)
      const sib = fitOf(canonV) < (asWritten ? 1 : 0.4) && (asWritten || service === 'frozen') && !(occasion && occasionWins(occasion)) ? sibling() : null;
      if (sib) { (svc.waived = svc.waived || []).push('vessel by fit'); return { v: sib, why: 'canon' }; }
      return { v: canonV, why: 'canon' };
    }
    else if (canonV && (bowl ? !canonV.serve.includes('bowl') : !takes(canonV) && (intent.style.frozen || intent.style.hot || intent.style.stirred))) (svc.waived = svc.waived || []).push('vessel by prayer');
    else if (canonV) {
      (svc.waived = svc.waived || []).push('vessel by fit');
      // (Where the canon's own glass can't hold it, the occasion's comes before a sibling.)
      const sib = !occasion ? sibling() : null;
      if (sib) return { v: sib, why: 'canon' };
    }
    // A riff keeps its source's vessel, or failing that the vessel of another spec of the same
    // drink that suits this serving (a single Scorpion rather than the bowl).
    if (src && famId === src.family) {
      const sameName = drinks.filter(d => d.name === src.name && d.vessel).sort((a, b) => (b.popularity - a.popularity) || ((CONF[b.confidence] || 0) - (CONF[a.confidence] || 0)));
      for (const d of [src, ...sameName]) {
        const v = vesselById[d.vessel];
        if (v && ok(v) && fitOf(v) >= 0.4 && !fireBars(v) && !(occasion && occasion.id !== v.id)) return { v, why: 'riff' };
      }
    }
    if (occasion) return { v: occasion, why: 'occasion' };
    const F = (model.families[famId] || {}).vessels || {};
    // The archetype's own glassware first (a Hemingway goes up in a coupe, never in a rocks
    // glass), joined by its identity vessels, by what the prayer leans toward, by fire-safe
    // vessels when fire is asked for, and by the other hot vessels for a hot drink.
    const own = A && A.vessels && A.vessels.length ? new Set(A.vessels) : null;
    if (own) {
      for (const v of identity) own.add(v.id);
      if (svc.wantUp) for (const id of ['coupe', 'nick-nora']) own.add(id);
      for (const v of vesselList) if (affOf(v) >= 1) own.add(v.id);
      if (fire) for (const id of FIRE_OK) own.add(id);
      if (service === 'hot') for (const v of vesselList) if (v.serve.includes('hot')) own.add(v.id);
    }
    const pool = vesselList.filter(ok);
    const ownPool = own ? pool.filter(v => own.has(v.id)) : [];
    // Nothing holds it: the biggest vessel of the right kind, and the drink is scaled to fit.
    const biggest = () => { const t = vesselList.filter(v => takes(v) && (!own || own.has(v.id))); const u = t.length ? t : vesselList.filter(takes); return u.length ? [u.sort((a, b) => b.capacity - a.capacity)[0]] : []; };
    // A vessel the drink sits comfortably in beats one it would be lost in or trimmed for.
    const snug = list => (list.some(v => fitOf(v) === 1) ? list.filter(v => fitOf(v) === 1) : list);
    const candidates = snug(ownPool.length ? ownPool : pool.length ? pool : biggest());
    const scored = [];
    for (const v of candidates) {
      const fit = fitOf(v) || 0.3;
      let w = (F[v.id] || 0) + 0.3 * ((v.families || {})[famId] || 0) + 0.004;
      if (A && A.vessels) { const i = A.vessels.indexOf(v.id); if (i >= 0) w += 0.6 / (1 + i); }
      if (identity.includes(v)) w += 1;
      w += 0.5 * affOf(v);
      if (svc.wantUp && v.serve.includes('up')) w += 3;
      // Fire wants a wide ceramic vessel that can take it, never a thin glass.
      if (fire) w *= FIRE_OK.includes(v.id) ? 2.5 : 0.4;
      if (bowl && v.id === 'volcano-bowl' && intent.style.flaming) w += 2;
      if (bowl && v.id === 'punch-bowl' && ['punch', 'stirred', 'buck'].includes(famId)) w += 0.5;
      if (bowl && v.id === 'tiki-bowl' && servings <= 3) w += 0.4;
      if (service === 'frozen' && ['hurricane', 'poco-grande', 'coconut', 'pineapple', 'goblet'].includes(v.id)) w += 0.15;
      // Glass is for where it is a hazard: acrylic only by the pool, the beach or the boat.
      // (The same for the big wine glass: it is brunch's and the spritz's, asked for by the occasion.)
      if ((v.kind === 'acrylic' || v.like) && affOf(v) < 1 && !identity.includes(v)) w *= 0.1;
      scored.push({ item: v, s: Math.log(w * fit * snugOf(v)) });
    }
    if (typeof process !== 'undefined' && process.env && process.env.CVDEBUG) console.error('[cv]', A && A.id, service, chem.volOz.toFixed(2), chem.finalOz.toFixed(2), 'canon', canonV && canonV.id, scored.map(x => `${x.item.id}:${x.s.toFixed(2)}`).join(' '), '| pool', pool.map(v => `${v.id}:${fitOf(v)}`).join(' '));
    if (!scored.length) return { v: vesselById[bowl ? 'punch-bowl' : 'collins'] || vesselList[0], why: 'fallback' };
    return { v: softPick(rng, scored, 0.7, greedy), why: 'family' };
  }

  // The last resort when nothing the archetype, family or prayer offers fits: what the glass
  // itself suggests, in vocabulary words (chooseGarnish still checks each against the drink).
  function garnishFor(famId, intent, lines, flavorTop) {
    const g = [];
    const ids = lines.map(l => l.id);
    if (ids.includes('mint') || intent.tags.mint) g.push('mint sprig');
    if (ids.includes('nutmeg')) g.push('freshly grated nutmeg');
    if (ids.includes('cinnamon') || famId === 'hot') g.push('cinnamon stick');
    if (famId === 'colada' || famId === 'bitter-tiki' || flavorTop.includes('pineapple')) g.push('pineapple wedge');
    if (flavorTop.includes('coffee')) g.push('three coffee beans');
    if (flavorTop.includes('floral') || intent.tags.floral) g.push('edible flower');
    if (famId === 'stirred') g.push('expressed orange peel');
    g.push(flavorTop.includes('orange') ? 'orange wheel' : 'lime wheel', 'lemon wheel', 'expressed orange peel', 'expressed lemon peel', 'grapefruit twist', 'cherry on a pick');
    return [...new Set(g)];
  }

  const NICE = {
    lime: 'fresh lime juice', lemon: 'fresh lemon juice', grapefruit: 'fresh grapefruit juice', orange: 'fresh orange juice',
    'pineapple-juice': 'pineapple juice', 'honey-syrup': 'honey syrup (1:1)', 'simple-syrup': 'simple syrup (1:1)', 'rich-simple': 'rich simple syrup (2:1)',
    'demerara-syrup': 'demerara syrup (2:1)', 'soda-water': 'soda water', 'coconut-cream': 'cream of coconut', angostura: 'Angostura bitters',
  };
  const displayName = id => NICE[id] || ingMap.get(id).name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const prose = id => {
    const n = displayName(id);
    return /^(Jamaican|Demerara|Barbados|Haitian|Angostura|Campari|Aperol|Galliano|Bénédictine|Green Chartreuse|Yellow Chartreuse|Cherry Heering|Don's|Gardenia|London|Old Tom|Irish|Islay|Batavia|Okolehao|Peychaud's|Pedro|Licor|Fernet|Drambuie|Cynar|Lillet|Blue|Tequila|Mezcal|Pisco|Cachaça|Bourbon|Rye|Brandy|Vodka|Aquavit|Navy)/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
  };

  // Method steps that match the build: what goes in the tin, what is held back to top, float,
  // sink or crown the drink, and the garnish last.
  // Technique a bartender wouldn't break: egg white needs a dry shake and never meets a
  // swizzle stick or blender; cream and dairy are shaken or blended, never stirred; nothing
  // carbonated goes in the tin (it is held back and topped). Returns notes on what changed.
  const EGG = new Set(['egg-white', 'whole-egg']);
  const DAIRY = new Set(['heavy-cream', 'half-and-half', 'whole-milk', 'vanilla-ice-cream', 'coconut-cream', 'coconut-milk', 'irish-cream']);
  function fixTechnique(svc, lines, notes) {
    const has = set => lines.some(l => set.has(l.id) && !l.garnish);
    if (has(EGG) && ['swizzle', 'blend', 'flash-blend', 'build', 'muddle-build', 'stir'].includes(svc.method)) {
      notes.push(`shaken, not ${svc.method === 'blend' ? 'blended' : svc.method === 'flash-blend' ? 'flash-blended' : svc.method + 'ed'}: egg white needs a dry shake`);
      svc.method = 'shake';
      if (['blended', 'shaved', 'ice-cone'].includes(svc.ice)) svc.ice = 'cubed';
    }
    if (has(DAIRY) && svc.method === 'stir') { svc.method = 'shake'; notes.push('shaken rather than stirred, because cream needs the air'); }
  }

  // Method steps that match the build: what goes in the tin, what is held back to top, float,
  // sink or crown the drink, the ice exactly as served, and the garnish last. Only carbonation is
  // topped (still wine goes in the tin with everything else), and on crushed ice the topper goes
  // in before the last of the ice, so there is room for it. A blender takes about 1.1× the
  // liquid in ice; a flash-blend about 6 oz for one drink and more for a big one. A group gets
  // one method for its vessel instead of "multiply by eight": a crushed-ice bowl is shaken in
  // rounds and poured over fresh crushed ice; a punch bowl is stirred with cold water over a
  // block frozen the night before and ladled; glasses are filled from a pitcher.
  const ICE_WORD = { crushed: 'crushed ice', pebble: 'pebble ice', shaved: 'shaved ice', cubed: 'cubed ice', block: 'one large block', 'ice-cone': 'an ice cone', none: 'no ice', blended: 'ice' };
  const FIZZY = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'grapefruit-soda', 'sparkling-wine']);
  const HOT_TOPS = ['hot-water', 'coffee', 'black-tea', 'lapsang-tea', 'whole-milk'];
  const PASTES = ['hot-buttered-rum-batter', 'butter', 'gardenia-mix', 'tom-and-jerry-batter'];
  const an = s => `${/^[aeiou]/i.test(s) && !/^(u|one)/i.test(s) ? 'an' : 'a'} ${s}`;
  const pluralOf = s => (/(ss|sh|ch|x)$/.test(s) ? `${s}es` : /s$/.test(s) ? s : `${s}s`);
  // Ice the way a host measures it: "6 oz", "1¼ cups (10 oz)".
  const measure = oz => { if (oz < 7.5) return `${Math.max(1, Math.round(oz))} oz`; const q = Math.round(oz / 2) * 2, c = q / 8; return `${fracStr(c)} cup${c > 1 ? 's' : ''} (${q} oz)`; };
  const ozOf = oz => `${fracStr(Math.round(oz * 4) / 4)} oz`;
  // Frozen: about as much ice as liquid, so the finished drink is about twice the pour and the
  // vessel was chosen for that (needOf); more overflows, less turns to soup.
  const blendIce = oz => oz;
  // Flash-blend: about 6 oz for one drink, a little less than the liquid for a round of two.
  const flashIce = flashIceFor;
  // The shaker's crushed ice for an open pour is the glass's ice: sized to the vessel, not a
  // fixed scoop (a 12 oz coconut takes about 1¼ cups, a 13½ oz chimney about 1½).
  const shakerIce = v => (v ? Math.max(6, Math.min(16, v.capacity * 0.8)) : 12);
  // The wall a sink runs down, named for what the vessel is (a tin mug is not a glass).
  const wallOf = v => (!v || v.kind === 'glass' ? 'glass' : v.serve.includes('bowl') ? 'bowl' : v.id === 'coconut' ? 'shell' : v.id === 'pineapple' ? 'pineapple' : /cup/.test(v.name) ? 'cup' : 'mug');
  // How each card phrase reads in a sentence.
  const SAY = {
    'heavy nutmeg cap': 'a heavy cap of freshly grated nutmeg', 'swizzle stick left in': 'the swizzle stick left standing in the ice',
    'straw through the ice cone': 'a straw run down through the cone', 'stir stick': 'a stir stick for the guest',
    'lime coin in the glass': 'the lime coin dropped into the glass', 'lime wedges in the glass': 'the lime wedges left in the glass',
    'pineapple crown lid': "the pineapple's own crown set on as a lid", 'candied ginger on a pick': 'a piece of candied ginger on a pick',
    'pineapple wedge and fronds': 'a pineapple wedge with its fronds', 'brûléed banana coin on a pick': 'a cinnamon-dusted brûléed banana coin on a pick',
    'tiare gardenia': 'a tiare, the gardenia of Tahiti', 'edible flower': 'an edible flower', 'lime wheels floating': 'lime wheels floated on top', 'lemon wheels floating': 'lemon wheels floated on top', 'orange wheels floating': 'orange wheels floated on top',
  };
  const sayGarnish = (x, all) => (x === 'cherry' ? (all.some(o => /wheel/.test(o)) ? 'a cherry tucked against the wheel' : 'a cherry') : SAY[x] || (/^(a |an |the |three |freshly |grated |toasted |whipped )/.test(x) ? x : an(x)));
  // Fire, done right (technique.md §2.19): a lime shell boat, lemon extract, a long lighter,
  // nothing that burns within reach, and out before anyone drinks.
  // (Straws and mint are kept clear by the steps before it: the straws wait beside the bowl until
  // the flame is out, the mint goes on the far rim.)
  const fireStep = (must, citrus, vid) => `${must ? 'Fire, last and carefully' : 'Theater, if you like (optional, and carefully)'}: set a spent ${citrus} shell cut side up ${vid === 'volcano-bowl' ? "in the volcano's central well" : 'on the ice'}, drop in a sugar cube soaked in lemon extract (or a little 151 rum) and light it with a long lighter; a pinch of cinnamon dusted through the flame throws sparks. Keep hair, sleeves, straws and flowers clear, never pour spirit from the bottle toward a flame, and blow it out (or cover it with a saucer) before anyone drinks.`;
  function steps(svc, lines, intent, garnish = []) {
    const v = vesselById[svc.vessel] || null;
    const g = svc.glass, aG = an(g), gs = pluralOf(g);
    const n = intent.servings > 1 ? intent.servings : 1;
    const bowl = n > 1 && !!(v && v.serve.includes('bowl'));
    const punchBowl = bowl && svc.vessel === 'punch-bowl';
    const each = n > 1 && !bowl; // a group served in glasses
    const upGlass = !!svc.up || !!(v && v.serve.includes('up'));
    const wall = wallOf(v), opaque = OPAQUE_VESSELS.has(svc.vessel) || (!!v && !['glass', 'bowl'].includes(v.kind)) || svc.vessel === 'scorpion-bowl';
    const poured = lines.filter(l => l.role !== 'aromatic' && !l.garnish);
    // Bitters marked to sit on top are a crown dashed onto the ice, never "floated" off a spoon.
    const bitters = l => ingMap.get(l.id).cat === 'bitters' || ['dash', 'drop'].includes(l.unit);
    const floats = poured.filter(l => l.float && !bitters(l)), sinks = poured.filter(l => l.sink);
    // (Only bitters the build marks as a crown: a Bermuda swizzle stirs its bitters in.)
    const crowns = poured.filter(l => !l.sink && (l.crown || (l.float && bitters(l))));
    const fizz = poured.filter(l => !l.float && !l.sink && FIZZY.has(l.id));
    const hotTop = svc.method === 'hot' ? poured.find(l => HOT_TOPS.includes(l.id) && !l.float) : null;
    // A Lava Flow's strawberry goes into the glass first; the colada is blended and poured over it,
    // so the red streaks up the walls.
    const streaks = svc.method === 'blend' ? poured.filter(l => l.streak) : [];
    // A whisper of a smoky spirit (balance marks it `rinse`: an Islay rinse) coats the glass and
    // is poured out; it never goes in the tin.
    const rinses = poured.filter(l => l.rinse && !l.float && !l.sink);
    const held = [...floats, ...sinks, ...crowns, ...fizz, ...streaks, ...rinses, ...(hotTop ? [hotTop] : [])];
    const name = l => displayName(l.id).toLowerCase();
    const except = held.length ? ` except the ${list(held.map(name))}` : '';
    const mixOz = poured.filter(l => !held.includes(l)).reduce((t, l) => t + (l.oz || 0), 0); // one drink's worth into the tin
    const egg = poured.some(l => EGG.has(l.id));
    // Steps come from the lines: an herb is pressed only when it is poured (muddled), never
    // because a sprig sits on top as garnish. In the glass for a swizzle or a muddled build; in
    // the tin for a shaken or flash-blended drink (and strained fine if it is strained at all);
    // a blender takes the leaves whole.
    const herb = lines.find(l => ['mint', 'basil'].includes(l.id) && l.muddled);
    const mint = !!herb && ['swizzle', 'muddle-build'].includes(svc.method);
    const herbName = herb ? name(herb).replace(/^fresh /, '') : '';
    const tinHerb = !!herb && ['shake', 'flash-blend', 'stir'].includes(svc.method);
    const heap = ['crushed', 'pebble', 'shaved'].includes(svc.ice) || (svc.method === 'swizzle' && svc.ice !== 'ice-cone');
    const iceKind = ['pebble', 'shaved'].includes(svc.ice) ? svc.ice : 'crushed';
    const room = fizz.length > 0 && heap && !upGlass; // leave room for the topper, then crown with ice
    // Rounds a tin can hold: two drinks, or one at a time for a big drink; a blender takes two.
    // (A bowl's rounds are always two serves, in a large tin when they are big: the shaker's 2
    // cups of ice and a 1-cup bed are what the bowl's capacity budget counts, vessels.js.)
    const bigTin = bowl && !['blend', 'flash-blend'].includes(svc.method) && mixOz * 2 > 12;
    const per = bowl || ['blend', 'flash-blend'].includes(svc.method) || mixOz * 2 <= 12 ? Math.min(2, n) : 1;
    const rounds = Math.ceil(n / per), perRound = mixOz * per, eachTime = rounds > 1 ? ' each time' : '';
    const inRounds = rounds > 1 ? `in ${rounds} rounds of ${numberWord(per)} drink${per > 1 ? 's' : ''} (about ${ozOf(perRound)} of the mix each round)` : `all at once (about ${ozOf(perRound)} of the mix)`;
    const out = [];
    let cups = 0;
    const paste = svc.method === 'hot' ? poured.find(l => PASTES.includes(l.id)) : null;
    // A frappé served in a stemmed glass (the Floridita's Daiquiri No. 4) is blended with about a
    // cup of shaved ice and heaped; a blender drink built on ice cream takes only a little ice
    // (about 4 oz) and a short blend, or it turns icy and the butter flecks.
    const frappe = svc.method === 'blend' && upGlass;
    const creamBlend = svc.method === 'blend' && poured.some(l => l.id === 'vanilla-ice-cream');
    const blenderIce = oz => frappe ? `about ${measure(Math.min(8, Math.max(6, oz * 2)))} of shaved ice` : creamBlend ? `about ${measure(Math.max(3, Math.min(5, oz * 0.5)))} of ice` : `about ${measure(blendIce(oz))} of ice`;
    const blendHow = creamBlend ? 'Blend briefly, just until smooth (the ice cream thins fast)' : frappe ? 'Blend to a fine snow' : 'Blend until smooth and thick';
    // Zero-proof: no spirit to tame, so a short shake on less ice keeps the juices bright.
    const zero = !!intent.style.zeroProof;
    const shakeCubed = zero ? 'cubed ice (a little less than usual) for 5–6 seconds' : 'cubed ice, hard, for 10–12 seconds';
    // A Tom and Jerry's batter is whipped egg: it is loosened with the spirits, never melted, and
    // the hot water or milk goes in slowly while whisking so the mug foams.
    const eggBatter = !!paste && paste.id === 'tom-and-jerry-batter';
    const hotSteps = (where, many) => {
      out.push(`${many ? `For ${n}: preheat` : 'Preheat'} ${where} with boiling water, then empty ${many ? 'them' : 'it'}.`);
      if (eggBatter) {
        out.push(`${many ? `Spoon ${ozOf(paste.oz)} of the ${name(paste)} into each warmed ${g}` : `Spoon the ${name(paste)} into the warmed ${g}`}.`);
        const spirits = poured.filter(l => l !== paste && !held.includes(l));
        if (spirits.length) out.push(`Add the ${list(spirits.map(name))}${many ? ' to each' : ''} and stir to loosen the batter.`);
        return;
      }
      if (paste) out.push(`${many ? `Divide the ${name(paste)} between them, add a splash of hot water to each` : `Add the ${name(paste)} with a splash of ${hotTop ? `the ${name(hotTop)}` : 'hot water'}`} and stir until it melts.`);
      // "The rest" is what isn't held back: the hot water, and any float, sink or crown that goes on last.
      out.push(`${many ? 'Divide' : 'Add'} ${paste ? 'the rest' : many ? 'the batch totals' : 'everything'}${except}${many ? ` between the ${gs}` : ''} and stir.`);
    };
    // Where a single drink ends up, in the ice it is actually served on.
    const serveOn = () => {
      if (upGlass && svc.ice === 'shaved') return `Press shaved ice into ${aG} to line it like a shell (freeze it a few minutes if you can), then strain the drink into the hollow.`;
      if (svc.up || svc.ice === 'none' || (upGlass && svc.ice === 'cubed')) return `Double-strain into a chilled ${g}.`;
      const strain = tinHerb ? 'Double-strain' : 'Strain';
      switch (svc.ice) {
        case 'cubed': return `${strain} into ${aG} over fresh cubed ice.`;
        case 'block': return `${strain} into ${aG} over one large cube or block.`;
        case 'shaved': return room ? `Pack ${aG} two-thirds full of shaved ice and strain the drink over it, leaving room at the top.` : `Pack ${aG} with shaved ice and strain the drink over it; mound more shaved ice on top.`;
        case 'ice-cone': return `Strain into ${aG} over an ice cone (shaved ice packed around a chopstick in a pilsner glass, frozen and unmolded), or over one large cube if you have no cone.`;
        default: return `Open-pour, ice and all, into ${aG}${room ? ', leaving room at the top.' : `; top with ${iceKind} ice to fill.`}`;
      }
    };
    // The same for a round of drinks poured into several glasses.
    const serveMany = () => {
      if (upGlass && svc.ice === 'shaved') return `Line ${n} ${gs} with pressed shaved ice and strain the drink into the hollows.`;
      if (svc.up || svc.ice === 'none' || (upGlass && svc.ice === 'cubed')) return `Double-strain into ${n} chilled ${gs}.`;
      switch (svc.ice) {
        case 'cubed': return `Strain into ${n} ${gs} over fresh cubed ice.`;
        case 'block': return `Strain into ${n} ${gs}, each over one large cube.`;
        case 'shaved': return `Pack ${n} ${gs} ${room ? 'two-thirds full ' : ''}with shaved ice and divide the drink between them${room ? ', leaving room at the top.' : '; mound more shaved ice on top.'}`;
        case 'ice-cone': return `Strain into ${n} ${gs}, each over an ice cone (shaved ice packed around a chopstick in a pilsner glass, frozen and unmolded) or one large cube.`;
        default: return `Open-pour the drinks, ice and all, into ${n} ${gs}${room ? ', leaving room at the top.' : `; top each with ${iceKind} ice to fill.`}`;
      }
    };

    if (punchBowl && svc.method === 'hot') {
      // A hot punch: warm the bowl, no ice anywhere.
      out.push(`For ${n}: warm the punch bowl with hot water, then empty it.`);
      if (paste) out.push(`Whisk the ${name(paste)} in the bowl with a splash of hot water until it melts.`);
      out.push(`Stir in ${paste ? 'the rest of the batch totals' : 'the batch totals'}${hotTop ? ` except the ${name(hotTop)}, then add ${measure(hotTop.oz * n)} of steaming ${name(hotTop)}` : ''}.`);
      cups = Math.max(n, Math.round(poured.reduce((t, l) => t + (l.oz || 0), 0) * n / 4.5));
    } else if (punchBowl && !egg) {
      // Ladled punch: a block, not crushed ice (crushed drowns a bowl in twenty minutes), and cold
      // water standing in for the dilution a shake would give.
      const mixTotal = mixOz * n;
      const water = poured.filter(l => l.id === 'water').reduce((t, l) => t + (l.oz || 0), 0) * n;
      const add = Math.max(0, mixTotal * 0.2 - water);
      out.push(`The night before, freeze a block of ice: fill a ${mixTotal + add > 40 ? 'quart' : 'pint'} container with water and freeze it.`);
      out.push(`For ${n}: in the punch bowl, stir the batch totals${except}${add >= 1 ? ` with ${measure(add)} of cold water (the dilution a shake would give)` : ''} until the sugar dissolves.`);
      out.push('Slide in the block just before serving.');
      cups = Math.max(n, Math.round((poured.reduce((t, l) => t + (l.oz || 0), 0) * n + add) / 4.5));
    } else if (bowl) {
      // A crushed-ice bowl: mixed in rounds a tin or blender can hold, poured over fresh ice in the bowl.
      out.push(`For ${n}: measure the batch totals${except} into a pitcher and stir.`);
      if (mint) out.push(`Lightly press the mint in the bottom of the ${wall}.`);
      // The rounds bring their own ice: they go over a modest bed, about a fifth of the bowl.
      const bed = measure(BOWL_BED);
      const pour = `Pour ${rounds > 1 ? 'each round' : 'it'}, ice and all, into the ${g}${punchBowl ? ' over the block' : ` over a modest bed of about ${bed} of fresh crushed ice`}${room ? ', leaving room at the top.' : '.'}`;
      if (punchBowl) out.unshift('The night before, freeze a block of ice: fill a quart container with water and freeze it.');
      switch (svc.method) {
        case 'blend':
          if (streaks.length) out.push(`Purée the ${list(streaks.map(name))} and spoon the purée into the bottom of the ${g}.`);
          out.push(`Blend ${inRounds} with ${blenderIce(perRound)}${eachTime}, ${creamBlend ? 'briefly, just until smooth' : 'until smooth and thick'}; pour ${streaks.length ? 'slowly over the purée' : 'into the ' + g}${streaks.length ? ', so the red streaks up the sides' : ''}.`);
          break;
        case 'flash-blend':
          out.push(`Flash-blend ${inRounds} with about ${measure(flashIceFor(perRound))} of crushed ice${eachTime}, for 3–5 seconds (or shake hard in a tin full of crushed ice).`);
          out.push(pour);
          break;
        case 'build': case 'muddle-build': case 'swizzle': case 'stir':
          out.push(`Fill the ${g} two-thirds with ${iceKind} ice, pour in the mix and ${svc.method === 'swizzle' ? 'swizzle' : 'stir'} until the outside of the bowl is cold${room ? ', leaving room at the top.' : `; mound more ${iceKind} ice on top.`}`);
          break;
        default:
          if (egg) out.push('Dry-shake each round without ice for 10 seconds to whip the egg white.');
          out.push(`Shake ${inRounds}, ${rounds > 1 ? `each in a ${bigTin ? 'large ' : ''}tin` : `in a ${bigTin ? 'large ' : ''}tin`} with about ${measure(BOWL_ROUND_ICE)} of crushed ice, for 8–10 seconds.`);
          out.push(pour);
      }
      if (punchBowl) cups = Math.max(n, Math.round(poured.reduce((t, l) => t + (l.oz || 0), 0) * n * 1.2 / 4.5));
    } else if (each) {
      // Glasses for a group: a pitcher of the mix, then the method in rounds.
      if (svc.method === 'hot') hotSteps(`${n} ${gs}`, true);
      else if (mixOz >= 0.25) out.push(`For ${n}: measure the batch totals${except} into a pitcher and stir.`);
      if (mint) out.push(`Lightly press the mint into the bottoms of ${n} ${gs}.`);
      switch (svc.method) {
        case 'hot': break;
        case 'stir':
          out.push(`Add cubed ice to the pitcher, stir for 30 seconds and strain into ${upGlass || svc.ice === 'none' ? `${n} chilled ${gs}` : `${n} ${gs}, each over one large cube`}.`);
          break;
        case 'build': case 'muddle-build':
          out.push(mixOz < 0.25 ? `For ${n}: fill ${n} ${gs} with ${svc.ice === 'block' ? 'a large cube each' : ICE_WORD[svc.ice] || 'ice'}.` : svc.ice === 'none' ? `Divide the mix between ${n} ${gs} and stir briefly.` : svc.ice === 'block' ? `Set a large cube in each of ${n} ${gs}, divide the mix between them and stir each briefly.`
            : `Fill ${n} ${gs} with ${ICE_WORD[svc.ice] || 'ice'}, divide the mix between them${room ? ', leaving room at the top,' : ''} and stir each briefly.`);
          break;
        case 'swizzle':
          out.push(`Divide the mix between ${n} ${gs}, fill each two-thirds with ${iceKind} ice and swizzle until the ${wall} frosts over${room ? ', leaving room at the top.' : `; pack with more ${iceKind} ice.`}`);
          break;
        case 'blend':
          if (streaks.length) out.push(`Purée the ${list(streaks.map(name))} and spoon ${ozOf(streaks.reduce((t, l) => t + (l.oz || 0), 0))} of the purée into the bottom of each of ${n} ${gs}.`);
          out.push(`Blend ${inRounds} with ${blenderIce(perRound)}${eachTime}, ${creamBlend ? 'briefly, just until smooth' : frappe ? 'to a fine snow' : 'until smooth and thick'}; ${frappe ? 'heap it into' : `pour ${streaks.length ? 'slowly over the purée in' : 'into'}`} ${n} ${frappe ? 'chilled ' : ''}${gs}${streaks.length ? ', so the red streaks up the walls' : ''}.`);
          break;
        case 'flash-blend':
          out.push(`Flash-blend ${inRounds} with about ${measure(flashIce(perRound))} of crushed ice${eachTime}, for 3–5 seconds (or shake hard with crushed ice).`);
          out.push(['ice-cone', 'shaved'].includes(svc.ice) || upGlass ? serveMany() : `Pour the drinks, ice and all, into ${n} ${gs}${room ? ', leaving room at the top.' : '; top each with more crushed ice.'}`);
          break;
        default: {
          const cubed = ['cubed', 'none', 'block'].includes(svc.ice);
          if (egg) out.push('Dry-shake each round without ice for 10 seconds to whip the egg white.');
          out.push(`Shake ${inRounds} with ${cubed ? shakeCubed : zero ? 'about 1½ cups of crushed ice for 5–6 seconds' : 'about 2 cups of crushed ice for 8–10 seconds'}.`);
          out.push(serveMany());
        }
      }
    } else {
      if (mint) out.push(`Lightly press the ${herbName} in the bottom of ${aG}.`);
      if (tinHerb) out.push(`Press the ${herbName} gently in the bottom of the ${svc.method === 'flash-blend' ? 'blender cup' : svc.method === 'stir' ? 'mixing glass' : 'tin'} to wake it up (bruise it, don't shred it).`);
      switch (svc.method) {
        case 'flash-blend':
          out.push(`Add everything${except} to a blender cup with about ${measure(Math.min(flashIce(mixOz), Math.max(6, (v ? v.capacity : 14) - mixOz)))} of crushed ice.`);
          out.push('Flash-blend for 3–5 seconds (or shake very hard with crushed ice if you have no spindle mixer).');
          out.push(['ice-cone', 'shaved'].includes(svc.ice) || upGlass ? serveOn() : `Pour everything, ice and all, into ${aG}${room ? ', leaving room at the top.' : `; top with more ${iceKind} ice.`}`);
          break;
        case 'blend':
          if (streaks.length) out.push(`Purée the ${list(streaks.map(name))} and spoon the purée into the bottom of ${aG} first.`);
          out.push(`Add everything${except}${herb ? `, the ${herbName} leaves too,` : ''} to a blender with ${blenderIce(mixOz)}.`);
          out.push(streaks.length ? `${blendHow}, then pour it slowly into the ${g} over the purée, so the red streaks up the walls. Don't stir.` : frappe ? `${blendHow}, then heap it into a chilled ${g}.` : `${blendHow}, then pour into ${aG}.`);
          break;
        case 'swizzle':
          out.push(`Add everything${except} to ${aG}.`);
          out.push(`Fill two-thirds with ${iceKind} ice and swizzle until the ${wall} frosts over${room ? ', leaving room at the top.' : `; pack with more ${iceKind} ice.`}`);
          break;
        case 'stir':
          out.push(`Stir everything${except} with cubed ice for 20–30 seconds.`);
          out.push(svc.ice === 'none' || svc.up ? `Strain into a chilled ${g}.` : `Strain into ${aG} over one large cube.`);
          break;
        case 'build':
        case 'muddle-build':
          out.push(mixOz < 0.25 ? `Fill ${aG} with ${ICE_WORD[svc.ice] || 'ice'}${room ? ', leaving room at the top' : ''}.` : svc.ice === 'none' ? `Build everything${except} in ${aG} and stir briefly.` : `Build everything${except} in ${aG} over ${ICE_WORD[svc.ice] || 'ice'}${room ? ', leaving room at the top,' : ''} and stir briefly.`);
          break;
        case 'hot':
          hotSteps(aG, false);
          break;
        default:
          if (egg) out.push(`Dry-shake everything${except} without ice for 10 seconds to whip the egg white.`);
          // An ice shell in a stemmed glass is filled from a tin shaken on cubes.
          if (['cubed', 'none', 'block'].includes(svc.ice) || (upGlass && svc.ice === 'shaved')) out.push(`${egg ? 'Add cubed ice and shake' : `Shake everything${except} with`} ${egg ? (zero ? 'for 5–6 seconds' : 'hard for 10–12 seconds') : shakeCubed}.`);
          else out.push(`${egg ? 'Add crushed ice and shake' : `Shake everything${except} with about ${measure(zero ? shakerIce(v) * 0.75 : shakerIce(v))} of crushed ice`} for ${zero ? '5–6' : '8–10'} seconds.`);
          out.push(serveOn());
      }
    }

    if (rinses.length) {
      const r = `Rinse ${each ? `each of the ${n} ${gs}` : bowl ? `the ${g}` : `the ${svc.method === 'hot' ? 'warmed' : 'chilled'} ${g}`} with the ${list(rinses.map(name))}: swirl ${each ? 'a splash in each' : `the ${rinses.length > 1 ? 'measures' : ozOf(rinses[0].oz)}`} to coat the inside, then pour out the excess.`;
      out.splice(svc.method === 'hot' ? Math.min(1, out.length) : 0, 0, r);
    }
    // What was held back goes in last: the hot water, the topper (then the last of the ice), the
    // sink down the wall, the float over a spoon, the bitters crown on the ice.
    if (hotTop && !punchBowl && eggBatter) out.push(`Pour in ${each ? `${ozOf(hotTop.oz)} of ` : hotTop.amount ? `${fracStr(hotTop.amount)} oz of ` : 'the '}${hotTop.id === 'whole-milk' ? 'hot milk' : 'hot water (or hot milk)'}${each ? ' per mug' : ''} slowly, whisking as you pour, so it foams up to the rim.`);
    else if (hotTop && !punchBowl) out.push(each ? `Top each with ${ozOf(hotTop.oz)} of steaming ${name(hotTop)} and stir.` : `Top with ${hotTop.amount ? `${fracStr(hotTop.amount)} oz of ` : ''}steaming ${name(hotTop)} and stir.`);
    if (fizz.length) {
      const what = list(fizz.map(name));
      out.push(punchBowl ? `Top with the ${what} in the bowl at the last minute and give one gentle lift with the ladle.`
        : bowl ? `Top with the ${what} in the bowl and give one gentle lift with a long spoon.`
          : each ? `Top with ${list(fizz.map(f => `${ozOf(f.oz)} of the ${name(f)}`))} in each glass and give each one gentle lift with the spoon.`
            : `Top with the ${what} and give one gentle lift with the spoon.`);
      if (room) out.push(bowl ? 'Mound fresh crushed ice on top.' : each ? `Crown each with fresh ${iceKind} ice.` : `Crown with fresh ${iceKind} ice.`);
    }
    for (const f of sinks) {
      const where = each ? `each ${wall}` : `the ${wall}`, amt = each ? `${ozOf(f.oz)} of the ` : 'the ';
      out.push(opaque
        ? `Pour ${amt}${name(f)} slowly down the inside of ${where} so it sinks to the bottom. In an opaque ${wall} the blush stays hidden until the guest stirs, so tell them it's there.`
        : `Pour ${amt}${name(f)} slowly down the inside of ${where}; it sinks and blushes upward. Don't stir: let the guest do it.`);
    }
    for (const f of floats) out.push(`Float ${each ? `${ozOf(f.oz)} of the ${name(f)} on each drink` : `the ${name(f)} on top`}: pour it gently over the back of a bar spoon.`);
    if (crowns.length) out.push(`Dash the ${list(crowns.map(b => displayName(b.id)))} over the top of the ice${each ? ' in each glass' : ''} to form a crown.`);
    const flame = garnish.find(x => /flaming/.test(x));
    const straws = garnish.find(x => /long straws$/.test(x));
    // A ladled punch hands its sticks out with the cups (the Tropical Itch's back-scratcher).
    const perCup = cups ? garnish.filter(x => /back-scratcher/.test(x)) : [];
    if (cups) out.push(`Ladle into punch cups, 4–5 oz each: about ${cups} cups${perCup.length ? `, each with ${list(perCup.map(x => an(x)))}` : ''}.`);
    // Fire: a flaming garnish always brings its lighting and safety step; a fire-safe bowl of
    // crushed ice, or a prayer that asked for fire in a vessel that can take it, may have it as theater.
    const lit = !!flame || (intent.style.flaming && FIRE_VESSELS.has(svc.vessel) && (heap || svc.method === 'blend' || bowl) && svc.method !== 'hot');
    const theater = !lit && svc.method !== 'hot' && heap && bowl && FIRE_BOWLS.has(svc.vessel);
    const dress = garnish.filter(x => x !== flame && x !== straws && !perCup.includes(x));
    // (Beside a flame, the mint goes on the far rim and the straws wait on the side.)
    const far = (lit || theater) && dress.some(x => /\bmint\b/.test(x)) ? ', the mint on the far rim, away from where the flame will be' : '';
    if (dress.length) out.push(`Garnish ${bowl ? 'the bowl ' : each ? 'each ' : ''}with ${list(dress.map(x => sayGarnish(x, dress)))}${far}.`);
    if (straws) out.push(`Serve with ${straws}, one per guest (about ${ozOf(poured.reduce((t, l) => t + (l.oz || 0), 0))} of the mix each)${lit ? ', laid beside the bowl until the flame is out' : theater ? ', laid beside the bowl if you light it' : ''}.`);
    const citrus = poured.some(l => l.id === 'lime') || !poured.some(l => l.id === 'lemon') ? 'lime' : 'lemon';
    if (lit) out.push(fireStep(true, citrus, svc.vessel));
    else if (svc.method === 'hot' && intent.style.flaming) out.push('Theater, if you like (optional, and carefully): warm a spoonful of the rum in a ladle, light it away from guests and anything that burns, let it flicker a few seconds, then blow it out and stir it in. Never pour spirit from the bottle toward a flame.');
    else if (theater) out.push(fireStep(false, citrus, svc.vessel));
    return out;
  }
  // A batch total a host can measure: cups past 8 oz, ounces below, teaspoons only for small
  // accents, dashes and drops as such. Bitters, anise, saline and extracts scale at about ¾ past
  // four servings (technique.md §2.18): they pile up in a big batch.
  function batchAmount(l, n) {
    const ing = ingMap.get(l.id) || {};
    const k = n > 4 && (['dash', 'drop'].includes(l.unit) || ing.cat === 'bitters' || ['absinthe', 'pastis', 'saline', 'vanilla-extract'].includes(l.id)) ? 4 + (n - 4) * 0.75 : n;
    if (l.unit === 'dash') { const d = Math.max(1, Math.round(l.amount * k)); return `${d} dash${d === 1 ? '' : 'es'}`; }
    if (l.unit === 'drop') { const d = Math.max(1, Math.round(l.amount * k)); return d >= 24 ? `${fracStr(Math.round(d / 96 * 4) / 4)} tsp` : `${d} drops`; }
    if (l.unit === 'piece') return `${fracStr(l.amount * n)}`;
    const oz = l.oz * k;
    if (oz >= 8) { const cups = Math.round(oz / 8 * 4) / 4; return `${fracStr(cups)} cup${cups > 1 ? 's' : ''} (${Math.round(oz)} oz)`; }
    if (oz < 0.375) return `${Math.max(1, Math.round(oz * 6))} tsp`;
    return `${fracStr(Math.round(oz * 4) / 4)} oz`;
  }
  const fracStr = x => { const w = Math.floor(x), r = x - w; const f = r >= 0.7 ? '¾' : r >= 0.45 ? '½' : r >= 0.2 ? '¼' : ''; return `${w || ''}${f}` || '0'; };
  const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : (a[0] || '');

  // ---------- explanation ----------
  function describeRum(id) {
    const ing = ingMap.get(id);
    const uniq = [...new Set((famousWith[id] || []).slice(0, 6).map(x => drinkById[x].name))];
    return `${prose(id)}${ing.examples && ing.examples.length ? ` (${ing.examples.slice(0, 2).join(', ')})` : ''}${uniq.length ? `, the style behind the ${uniq.slice(0, 2).join(' and ')}` : ''}`;
  }

  function lineageText(famId) {
    const f = famById[famId];
    const chain = [];
    let cur = f;
    const seen = new Set();
    while (cur && cur.parents && cur.parents.length && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = famById[cur.parents[0]];
      if (cur) chain.push(cur.name);
    }
    return { family: f, chain };
  }

  function explain(recipe, profile, famId, intent, riffSrc, notes) {
    const F = model.families[famId];
    const fam = famById[famId];
    const exclude = new Set();
    const nb = neighbors(profile, { exclude, n: 5 });
    const influences = nb.map(x => {
      const d = drinkById[x.id];
      const shared = [...new Set(d.ingredients.map(l => l.id))].filter(id => recipe.lines.some(l => l.id === id) && ingMap.get(id).role !== 'aromatic');
      return {
        id: d.id, name: d.name, variant: d.variant || '', year: d.year, circa: !!d.circa, creator: d.creator || '', venue: d.venue || '',
        // The same hedged credit the card uses ("Kuala Lumpur Hilton, 1970s, attributed").
        credit: creditText(originOf(d)) || '',
        family: d.family, similarity: round(x.s, 2),
        shared: shared.map(id => prose(id)),
      };
    }).filter(x => !riffSrc || x.id !== riffSrc.id).filter((x, i, a) => a.findIndex(y => y.name === x.name) === i).slice(0, 4);

    // Pairings with pedigree.
    const ids = [...new Set(recipe.lines.filter(l => l.role !== 'aromatic').map(l => l.id))];
    const pairs = [];
    const novel = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const p = pairInfo(ids[i], ids[j]);
      const trivial = ['simple-syrup', 'rich-simple'].includes(ids[i]) || ['simple-syrup', 'rich-simple'].includes(ids[j]);
      if (p && p.n >= 3 && p.pmi > 0.3 && !trivial) pairs.push({ a: ids[i], b: ids[j], ...p });
      else if ((!p || p.n <= 1) && !trivial && ingMap.get(ids[i]).role !== 'base' && ingMap.get(ids[j]).role !== 'base') novel.push({ a: ids[i], b: ids[j], aff: tagAffinity(ids[i], ids[j]) });
    }
    pairs.sort((x, y) => y.pmi * Math.log(1 + y.n) - x.pmi * Math.log(1 + x.n));
    novel.sort((x, y) => y.aff - x.aff);

    const m = F.metrics;
    const st = recipe.stats;
    const whyItWorks = [];
    if (st.sweetSour !== null && m.sweetSour) {
      const inRange = st.sweetSour >= m.sweetSour.p25 && st.sweetSour <= m.sweetSour.p75;
      whyItWorks.push(F.n >= 4
        ? `Sugar-to-acid ratio ≈ ${st.sweetSour.toFixed(1)} : 1 by weight — ${inRange ? 'inside' : st.sweetSour < m.sweetSour.p25 ? 'on the tart side of' : 'on the rich side of'} the ${fam.name} family's typical range (${m.sweetSour.p25}–${m.sweetSour.p75} across ${F.n} drinks).`
        : `Sugar-to-acid ratio ≈ ${st.sweetSour.toFixed(1)} : 1 by weight (the database-wide sweet spot is ${model.global.sweetSour.p25}–${model.global.sweetSour.p75}).`);
    }
    if (m.abv) {
      const cmp = comparableByAbv(st.abv);
      whyItWorks.push(`About ${st.abv.toFixed(1)}% ABV after dilution (family median ${m.abv.median}%)${cmp ? ` — roughly the strength of a ${cmp}` : ''}.`);
    }
    for (const p of pairs.slice(0, 3)) {
      whyItWorks.push(`${cap(prose(p.a))} + ${prose(p.b)}: paired in ${plural(p.n, 'drink')} in the database (${p.ex.map(x => drinkById[x] ? drinkById[x].name : x).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(', ')}), ${p.pmi >= 1.5 ? 'a signature combination' : 'a proven match'}.`);
    }
    if (novel.length && novel[0].aff > 0.15) {
      const n0 = novel[0];
      whyItWorks.push(`New territory: ${prose(n0.a)} with ${prose(n0.b)} is rare in the canon, but their flavor families (${(ingMap.get(n0.a).flavors || []).slice(0, 2).join(', ')} / ${(ingMap.get(n0.b).flavors || []).slice(0, 2).join(', ')}) co-occur often in proven drinks.`);
    }
    const rums = recipe.lines.filter(l => l.role === 'base' && ingMap.get(l.id).cat === 'rum');
    if (rums.length >= 2) {
      const key = rums.map(r => r.id).sort().join('+');
      const combo = model.rumCombos.find(c => c.rums.slice().sort().join('+') === key);
      whyItWorks.push(`Rum blend in the Beachcomber tradition: ${rums.map(r => describeRum(r.id)).join('; ')}.${combo ? ` This exact blend appears in ${plural(combo.n, 'catalogued drink')} (e.g. ${[...new Set(combo.ex.map(x => drinkById[x].name))].slice(0, 2).join(', ')}).` : ''}`);
    } else if (rums.length === 1) {
      whyItWorks.push(`Base: ${describeRum(rums[0].id)}.`);
    }

    const { chain } = lineageText(famId);
    const lineage = [];
    if (riffSrc) {
      const changes = notes.filter(n => n.startsWith('riff:')).map(n => n.slice(5));
      lineage.push(`A riff on the ${riffSrc.name}${riffSrc.variant ? ` (${riffSrc.variant})` : ''}${riffSrc.creator ? `, ${riffSrc.creator}` : ''}${riffSrc.year ? `, ${riffSrc.circa ? 'c. ' : ''}${riffSrc.year}` : ''}: ${changes.length ? changes.join('; ') : 'rebalanced'}.`);
      if (riffSrc.notes) lineage.push(riffSrc.notes);
    }
    const moves = notes.filter(n => !n.startsWith('riff:') && n !== 'split-base');
    if (!riffSrc && moves.length) lineage.push(`Design moves: ${moves.join('; ')}.`);
    lineage.push(`Family: ${fam.name} — ${fam.tagline} ${firstSentences(fam.origin, 2)}`);
    if (chain.length) lineage.push(`Line of descent: ${[fam.name, ...chain].join(' ← ')}.`);
    if (notes.includes('split-base')) lineage.push('Split base: pairing a non-rum spirit with a rum partner is a revival-era move (see the Tia Mia and the Chartreuse Swizzle) that keeps the tiki backbone while changing the accent.');

    const ingredientNotes = [];
    for (const l of recipe.lines) {
      const ing = ingMap.get(l.id);
      if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'saline'].includes(ing.id)) ingredientNotes.push(`${ing.name}: ${ing.examples.join('; ')}.`);
      else if (ing.avail === 'specialty') ingredientNotes.push(`${ing.name}: look for ${ing.examples.slice(0, 3).join(', ') || 'a well-stocked shop'}${ing.subs.length ? `; swap in ${ing.subs.map(s => ingMap.get(s).name.toLowerCase()).join(' or ')} if needed` : ''}.`);
    }

    const tasting = tastingNote(recipe.lines.map(l => ({ ...l, role: l.garnish ? 'aromatic' : l.role })), recipe.stats, famId);
    let vessel = '';
    if (recipe.vessel) {
      const v = recipe.vessel, share = (F.vessels || {})[v.id] || 0;
      const an = n => `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
      const why = v.why === 'asked' ? 'as you asked'
        : v.why === 'riff' && riffSrc ? `the way the ${riffSrc.name} is served`
        : share >= 0.05 ? `the ${fam.name} family's ${share >= 0.3 ? 'usual' : 'occasional'} vessel (${Math.round(share * 100)}% of the catalogued family)`
        : `a vessel that suits its size and ice`;
      vessel = `Served in ${an(v.name)}, ${why}.`;
    }
    return { tasting, influences, whyItWorks, lineage, ingredientNotes, vessel };
  }

  // A palate walk: opening (acid, juice, fizz) → body (spirits, richness) → finish (spice, bitters, aromatics).
  const TASTE = {
    lime: 'lime', lemon: 'lemon', grapefruit: 'grapefruit', orange: 'orange', citrus: 'citrus', tart: 'sharp acidity',
    pineapple: 'pineapple', 'passion-fruit': 'passion fruit', guava: 'guava', mango: 'mango', papaya: 'papaya', banana: 'banana',
    coconut: 'coconut', cherry: 'cherry', berry: 'red berries', apricot: 'apricot', peach: 'peach', pomegranate: 'pomegranate',
    apple: 'apple', melon: 'melon', lychee: 'lychee', 'dried-fruit': 'dried fruit', almond: 'almond', nutty: 'nuttiness',
    vanilla: 'vanilla', cinnamon: 'cinnamon', allspice: 'allspice', clove: 'clove', nutmeg: 'nutmeg', ginger: 'ginger',
    'baking-spice': 'baking spice', anise: 'anise', chili: 'chili heat', pepper: 'pepper', herbal: 'herbs', mint: 'mint',
    floral: 'florals', honey: 'honey', caramel: 'caramel', molasses: 'molasses', maple: 'maple', buttery: 'butter',
    chocolate: 'chocolate', coffee: 'coffee', tea: 'tea', funky: 'overripe-banana funk', grassy: 'green cane', vegetal: 'green notes',
    smoky: 'smoke', oaky: 'oak', rich: 'richness', creamy: 'cream', effervescent: 'fizz', bitter: 'bitterness', salty: 'salinity',
    earthy: 'earthiness', agave: 'agave', juniper: 'juniper', light: 'clean cane', crisp: 'crispness', dry: 'dryness',
  };
  function tastingNote(lines, stats, famId) {
    const phase = pred => {
      const v = {};
      for (const l of lines) {
        const ing = ingMap.get(l.id);
        if (!pred(l, ing)) continue;
        const w = l.role === 'aromatic' ? 0.3 : Math.max(0.1, l.oz || 0.1) * (l.role === 'accent' ? 6 : l.role === 'modifier' ? 1.5 : 1);
        for (const [t, x] of Object.entries(ingVec[l.id] || {})) if (TASTE[t] && t !== 'sweet') v[t] = (v[t] || 0) + w * x;
      }
      return Object.entries(v).sort((a, b) => b[1] - a[1]).map(([t]) => TASTE[t]);
    };
    const used = new Set();
    const take = (arr, n) => { const out = []; for (const x of arr) { if (!used.has(x) && out.length < n) { out.push(x); used.add(x); } } return out; };
    const citrusNamed = lines.some(l => ['lime', 'lemon', 'grapefruit', 'orange', 'yuzu-juice'].includes(l.id));
    if (citrusNamed) used.add('citrus');
    const open = take(phase((l, i) => ['sour', 'juice', 'lengthener'].includes(l.role)), 2);
    const body = take(phase((l, i) => ['base', 'rich', 'sweet'].includes(l.role)), 3);
    const finish = take(phase((l, i) => ['modifier', 'accent', 'aromatic'].includes(l.role)), 3);
    const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0];
    // The balance word from absolute numbers (chem.js balanceWord), never the ratio alone.
    const creamy = lines.some(l => CREAMY.has(l.id) && (l.oz || 0) >= 0.5), buttery = lines.some(l => /batter|butter/.test(l.id));
    const balanceLine = balanceWord(stats, { method: famId === 'hot' ? 'hot' : '', creamy, buttery });
    const strength = stats.abv >= 18 ? 'It drinks strong; the ice is doing a lot of work.' : stats.abv >= 13 ? 'Assertive, but the dilution keeps it easy.' : stats.abv >= 8 ? 'Moderate strength, built for sipping through a straw.' : stats.abv > 0.5 ? 'Gentle enough for a long afternoon.' : 'No alcohol at all.';
    const bits = [];
    if (open.length) bits.push(`It opens on ${list(open)}`);
    if (body.length) bits.push(`${bits.length ? 'then' : 'It'} settles into ${list(body)}`);
    if (finish.length) bits.push(`and finishes with ${list(finish)}`);
    return `${bits.join(', ')}. ${balanceLine} ${strength}`;
  }

  function comparableByAbv(abv) {
    const famous = drinks.filter(d => d.popularity >= 4 && model.drinks[d.id]);
    let best = null;
    for (const d of famous) {
      const a = model.drinks[d.id].abv;
      if (!best || Math.abs(a - abv) < Math.abs(best.a - abv)) best = { a, name: d.name };
    }
    return best && Math.abs(best.a - abv) < 2.5 ? best.name : null;
  }

  // ---------- public ----------
  const composer = createComposer({ archetypes, ingMap, model });
  const copy = createCopywriter({ ingMap, ingVec });
  const conceptIndex = indexConcepts(concepts);
  const ctx = {
    // A concept's soft avoid never blocks the bottle that makes the color the guest asked for.
    // Nor one that leads with a flavor the guest named outright (coffee liqueur in "a coffee
    // nightcap", though the nightcap concept steers away from coffee).
    forbidden: (id, intent) => forbidden(id, intent) || (intent.softAvoid && intent.softAvoid[id] >= 1 && !intent.ings[id] && !(intent.color && (ingMap.get(id) || {}).color === intent.color)
      && !(((ingMap.get(id) || {}).flavors || [])[0] && (intent.tags[ingMap.get(id).flavors[0]] || 0) - ((intent.conceptTags || {})[ingMap.get(id).flavors[0]] || 0) >= 1.5)),
    intentMatch, compat, conflicts, softPick, ingVec, naSwap: NA_SWAP, maxComponents: fam => famWin(fam).maxComponents || null,
  };
  const linesOf = d => d.ingredients.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: roleOf(l, ingMap.get(l.id)), oz: lineOz(l, ingMap.get(l.id), units) / (d.servings || 1), float: !!l.float, garnish: !!l.garnish }));

  // Which archetype a catalogued drink belongs to: the one that names it as a classic and that
  // its spec actually satisfies, else any archetype of its family that it satisfies.
  function archetypeForDrink(d) {
    const nm = d.name.toLowerCase();
    const L = linesOf(d);
    const named = archetypes.filter(a => (a.classics || []).some(c => c.toLowerCase().replace(/\s*\(.*\)/, '') === nm));
    const fits = named.find(a => composer.satisfies(a, L).ok);
    if (fits) return fits;
    return archetypes.find(a => a.family === d.family && composer.satisfies(a, L).ok) || named[0] || null;
  }

  // A riff on a drink no archetype covers keeps the source drink itself as its frame: its own
  // family, service and vessel, and nothing else claimed for it.
  function adHocArchetype(d) {
    // Its type word comes from a kin archetype only if the drink is one (a Cuba Libre has no
    // ginger beer, so it isn't a "ginger beer highball"); otherwise the family's plain word.
    const kin = archetypes.find(a => a.family === d.family && composer.satisfies(a, linesOf(d)).ok);
    const PLAIN_NOUN = { punch: 'rum punch', grog: 'grog', daiquiri: 'sour', swizzle: 'swizzle', zombie: 'heavyweight', 'beachcomber-sour': 'Beachcomber sour', 'mai-tai': 'Mai Tai cousin', 'orgeat-punch': 'orgeat punch', colada: 'colada', buck: 'highball', 'resort-punch': 'resort punch', 'bitter-tiki': 'bitter tiki sour', stirred: 'stirred drink', hot: 'hot drink' };
    return {
      id: `riff:${d.id}`, name: d.name, family: d.family, noun: kin ? kin.noun : PLAIN_NOUN[d.family] || famById[d.family].name.toLowerCase(),
      definition: '', signature: [], optional: [], forbidden: [], canonicalSpecs: [], ratios: {},
      methods: [d.method || 'shake'], ice: [d.ice || 'crushed'], vessels: d.vessel ? [d.vessel] : [], garnish: { typical: [] }, flavorProfile: [], aromatics: [],
    };
  }

  // "Layered" (a sunrise, a sunset, dawn) is poured as a real layer, never narrated: a dense bottle
  // the drink already shakes in becomes the sink (the grenadine poured last, "don't stir"), or one
  // goes in: grenadine (or hibiscus) for red and orange, blue curaçao under a pale body for blue,
  // cassis for purple. Like for like: the sink takes the plain syrup's job at its sugar. A dark
  // rum float only where the color allows one; never a dark cap over a sunrise.
  const SINKS = { blue: ['blue-curacao'], purple: ['creme-de-cassis', 'blackberry-liqueur'], green: [], dark: [], white: [], clear: [] };
  function addLayer(lines, A, intent, notes) {
    if (!intent.style.layered) return;
    if (lines.some(l => l.sink)) return;
    const avoid = id => !ingMap.has(id) || forbidden(id, intent) || (A.forbidden || []).includes(id);
    const order = SINKS[intent.color] || (intent.style.creamy ? [] : ['grenadine', 'hibiscus-syrup', 'creme-de-cassis']);
    const sugarOf = id => ingMap.get(id).sugar || 0;
    for (const id of order) {
      const own = lines.find(l => l.id === id && !l.float && !l.sink && !l.garnish && !l.crown);
      if (!own) continue;
      own.sink = true; own.slot = 'sink'; own.req = true; own.oz = Math.max(own.oz || 0, 0.5); own.oz0 = own.oz;
      notes.push(`the ${prose(id)} poured last so it sinks, ${intent.color === 'blue' ? 'blue under the gold' : 'a sunrise from the bottom up'}`);
      return;
    }
    if (lines.some(l => l.float || l.crown) && !order.length) return;
    for (const id of order) {
      if (avoid(id) || lines.some(l => l.id === id)) continue;
      const l = { id, role: ingMap.get(id).role, oz: 0.75, oz0: 0.75, sink: true, slot: 'sink', req: true };
      const plain = sugarOf(id) >= 40 && lines.filter(x => PLAIN.has(x.id) && !x.float && !x.sink && !x.garnish).sort((x, y) => y.oz - x.oz)[0];
      if (plain) {
        l.oz = l.oz0 = Math.max(0.5, Math.min(0.75, Math.round((plain.oz || 0) * sugarOf(plain.id) / sugarOf(id) * 4) / 4));
        lines.splice(lines.indexOf(plain), 1);
        notes.push(`${prose(id)} sunk to the bottom in place of the ${prose(plain.id)}, so it layers`);
      } else notes.push(`${prose(id)} poured last so it sinks into a ${intent.color === 'blue' ? 'blue dawn' : 'sunrise'}`);
      lines.push(l);
      return;
    }
    if (lines.some(l => l.float || l.sink || l.crown)) return;
    const rumBased = lines.some(l => (ingMap.get(l.id) || {}).cat === 'rum');
    if (rumBased && !avoid('rum-jamaican-dark') && !lines.some(l => l.id === 'rum-jamaican-dark') && [undefined, null, 'dark'].includes(intent.color)) {
      lines.push({ id: 'rum-jamaican-dark', role: 'base', oz: 0.5, float: true, slot: 'float', req: true });
      notes.push('a dark rum float for a layered top');
    }
  }

  // Capacity physics (round-3 critique §1): one model, `fillBudget` in vessels.js, shared with the
  // linter and the tests. The vessel holds the liquid, the ice it is served on and headroom: the
  // poured liquid plus the glass's own ice where that ice did the diluting (ice and all, a
  // swizzle, a build), the finished liquid plus fresh ice where it was strained onto it; up
  // drinks to 80% of a coupe (85% of a flute or with bubbles), a shaved-ice shell taking 30% of
  // its coupe, frozen drinks domed to 95%, hot drinks a tenth short of the rim, bowls with the
  // ice's voids holding the mix. `oz` is the drink's own measure (it scales with the pours) and
  // must sit in [lo, hi]; the research's fill ranges (pre-dilution liquid) narrow the band where
  // they are tighter. Every path ends here: balance calls it last, after its final pass.
  function needOf(c, v, svc, n = 1) {
    const fizzOz = Object.entries(c.byId || {}).filter(([id]) => FIZZY.has(id)).reduce((t, [, oz]) => t + oz, 0);
    const x = fillBudget(c, v, { method: svc.method, ice: svc.ice, servings: n, fizz: fizzOz > 0, fizzOz });
    const range = fillRange(v.id);
    if (range && c.volOz > 0 && !['frozen', 'hot'].includes(x.kind)) {
      const per = x.oz / (c.volOz * x.servings);
      x.hi = Math.min(x.hi, range[1] * 1.03 * per);
      // (Below the research's comfortable fill the drink looks stingy; that, not a share of the
      // glass, is where it starts to look lost.)
      x.lo = Math.min(range[0] * 0.97 * per, x.hi * 0.8);
    }
    return x;
  }
  // A drink scaled to the vessel it goes in: too much and every line gives way in proportion,
  // the spirit kept to a real pour (an ounce and a half); too little for the vessel and the
  // juices, sweeteners and lengtheners grow (never a heavyweight's spirit).
  function fitVessel(lines, svc, v, notes, A = {}, n = 1, grow = true, strict = false) {
    const load = () => needOf(chemOf(lines, svc.method, svc.ice), v, svc, n);
    let x = load();
    const live = lines.filter(l => !l.garnish && !l.muddled && l.role !== 'aromatic' && l.oz > 0);
    const base = live.filter(l => l.role === 'base' && !l.float && !l.sink);
    const baseTotal = base.reduce((t, l) => t + l.oz, 0);
    const spirit = baseTotal;
    if (grow && x.oz < x.lo * 0.98 && A.family !== 'zombie' && spirit <= 2.25) {
      // A juice cut for the color (the Blue Hawaii's pineapple) stays cut.
      const grow = lines.filter(l => !l.garnish && !l.muddled && !l.held && ['juice', 'sour', 'sweet', 'rich', 'lengthener'].includes(l.role) && !POTENT.has(l.id) && !['dash', 'drop'].includes(l.unit));
      const growOz = grow.reduce((t, l) => t + l.oz, 0);
      if (!growOz) return false;
      // The shortfall in liquid ounces (a frozen or up drink is measured finished, after its ice).
      const c0 = chemOf(lines, svc.method, svc.ice);
      // (`oz` is the drink's own measure, so it scales with the pours: poured, finished or per bowl.)
      const perOz = x.oz / Math.max(c0.volOz, 0.1);
      // A ladled punch with nothing long in it is lengthened the way punch always was: cold water
      // (the "weak" of one sour, two sweet, three strong, four weak), not more syrup and citrus.
      if (v.id === 'punch-bowl' && ingMap.has('water') && !lines.some(l => !l.garnish && ['juice', 'lengthener'].includes(l.role))) {
        lines.push({ id: 'water', role: 'lengthener', oz: Math.min(2.5, (x.lo - x.oz) / perOz * 1.02) });
        finalizeAmounts(lines);
        notes.push('cold water to lengthen the punch for the bowl');
        return true;
      }
      const k = Math.min(1.5, 1 + (x.lo - x.oz) / perOz / growOz * 1.02);
      for (const l of grow) l.oz *= k;
      finalizeAmounts(lines);
      notes.push(`a bigger pour so it fills ${/^[aeiou]/i.test(v.name) ? 'an' : 'a'} ${v.name}`);
      return true;
    }
    if (x.oz <= x.hi) return false;
    // The big pours give way; an accent of half an ounce or less keeps the dose you can taste.
    const trimmable = l => !(ingMap.get(l.id).cat === 'bitters' || ['dash', 'drop'].includes(l.unit)) && l.oz > 0.5 + 1e-6;
    // (A frozen drink or a colada keeps the two ounces floors() gave it: it isn't a smoothie.)
    const realPour = A.family === 'colada' || svc.method === 'blend' ? 2 : 1.5;
    for (let i = 0; i < 30 && x.oz > x.hi; i++) {
      const k = Math.max(0.85, Math.min(0.97, x.hi / x.oz));
      const baseNow = base.reduce((t, l) => t + l.oz, 0);
      for (const l of live) {
        // A real pour keeps its ounce and a half; a gentle one (already under it) scales with
        // everything else, so trimming never makes a low-ABV drink stronger.
        // Last of all (strict), everything scales together: the balance holds, the glass doesn't overflow.
        if (!strict && l.role === 'base' && !l.float && !l.sink && baseTotal >= Math.min(realPour, baseTotal) && baseTotal >= 1.5 && baseNow * k < Math.min(realPour, baseTotal) - 0.01) continue;
        if (trimmable(l)) l.oz *= k;
      }
      x = load();
    }
    finalizeAmounts(lines);
    // Rounding to bar measures can tip it back over: take a quarter ounce off the longest pour
    // that isn't the spirit until it fits.
    // (A pour already at its smallest bar measure, a one-ounce top, is set aside; last of all
    // (strict), the spirit gives a quarter ounce, never under an ounce.)
    const atFloor = new Set();
    for (let i = 0; i < 12 && (x = load()).oz > x.hi + 0.05; i++) {
      const l = live.filter(y => trimmable(y) && !atFloor.has(y) && !(y.role === 'base' && !y.float && !y.sink) && y.oz > 0.5).sort((a, b) => b.oz - a.oz)[0]
        || (strict ? live.filter(y => !atFloor.has(y) && y.role === 'base' && !y.float && !y.sink && y.oz > 1 + 1e-6).sort((a, b) => b.oz - a.oz)[0] : null);
      if (!l) break;
      // Down one bar measure (a soda pours in half ounces, a syrup in quarters).
      const was = l.oz;
      for (let t = was - 0.125; t > 0.2; t -= 0.125) { l.oz = t; finalizeAmounts([l]); if (l.oz < was - 0.01) break; }
      if (l.oz >= was - 0.01) { l.oz = was; finalizeAmounts([l]); atFloor.add(l); }
      finalizeAmounts(lines);
    }
    const said = `scaled to fit ${/^[aeiou]/i.test(v.name) ? 'an' : 'a'} ${v.name}`;
    if (!notes.includes(said)) notes.push(said);
    return true;
  }
  const PARTY = new Set(['party', 'luau', 'wedding', 'bachelorette', 'bachelor', 'friends-group', 'coworkers', 'celebration-of-life', 'dinner-party', 'game-day', 'crowd', 'garden-party']);

  // Classics an archetype names that the catalogue doesn't carry ("Tom and Jerry", "Pi Yi"):
  // naming one asks for its frame.
  const classicIndex = [];
  for (const a of archetypes) for (const c of a.classics || []) {
    const key = c.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' &-]+/g, ' ').replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
    if (key.length >= 6 && !nameIndex.some(n => n.key === key)) classicIndex.push({ key, a, name: c.replace(/\s*\(.*?\)\s*/g, ' ').trim() });
  }
  classicIndex.sort((x, y) => y.key.length - x.key.length);

  // The internal critic: a build the technique linter calls fatal (a colada with no coconut, an
  // overflowing glass, an overproof pour) is rebuilt on the next frame that answers the prayer,
  // up to three times, and the build with the fewest fatal findings is served.
  const linter = rules ? createLinter({ rules, vocab, vessels }) : null;
  // Is this frame the prayer's own answer: a drink it names, a family word, a concept that answers
  // with it, or a reading that names one of its classics ("a vanilla Mai Tai" for Tahiti)?
  function namedFrame(a, intent) {
    if ((intent.fam[a.family] || 0) >= 1 || ((intent.archetypes || {})[a.id] || 0) >= 0.5) return true;
    if (intent.namedClassic && intent.namedClassic.a === a) return true;
    const names = [...(a.classics || []).map(c => c.replace(/\s*\(.*?\)\s*/g, ' ').trim()), ...Object.keys(a.origins || {})].filter(n => n.length >= 5).map(n => normName(n));
    return (intent.readings || []).some(r => !r.negated && r.reading && names.some(n => ` ${normName(r.reading)} `.includes(` ${n} `)));
  }
  function spreadToSiblings(scored, intent, prompt, seed) {
    const ranked = [...scored].sort((x, y) => y.s - x.s);
    const top = ranked[0];
    if (namedFrame(top.a, intent)) return scored;
    const sibs = new Set(top.a.siblings || []);
    const pool = ranked.filter(x => x === top || (sibs.has(x.a.id) && x.s >= top.s - 1.25));
    if (pool.length < 2) return scored;
    // The best-known frames (a catalogue weight of 5: the Mai Tai, the Zombie, the Piña Colada)
    // are every prayer's easy answer; within the pool they give way to a lesser-poured sibling.
    const pick = softPick(rngFrom(`siblings::${prompt.toLowerCase().trim()}::${seed}`), pool.map(x => ({ item: x, s: x.s - 0.3 * ((x.a.weight || 1) - 1) })), 0.7, false);
    return [{ ...pick, s: top.s + 1 }, ...scored.filter(x => x !== pick)];
  }

  // Praying again brings a different idea. A later seed must change the archetype, the service
  // temperature, the vessel class or the hero spirit, and share under 60% of its bottles with
  // an earlier seed (70% for a drink the guest named, which keeps its name); otherwise it is
  // re-planned on a sibling: another frame for an open prayer (a Zombie's Jet Pilot), the named
  // drink's sibling classic for a named one (a Hot Buttered Rum's Tom and Jerry).
  const bottleSet = r => new Set(r.lines.filter(l => !l.garnish).map(l => l.id));
  const STRUCTURAL_TAGS = new Set(['sweet', 'tart', 'light', 'crisp', 'dry', 'rich', 'boozy', 'warm', 'fruity', 'tropical', 'citrus', 'creamy', 'effervescent']);
  const jaccard = (a, b) => { const i = [...a].filter(x => b.has(x)).length; return i / (a.size + b.size - i || 1); };
  const tempOf = r => (r.method.method === 'hot' ? 'hot' : r.method.method === 'blend' ? 'frozen' : 'cold');
  const heroOf = r => { const b = r.lines.filter(l => l.role === 'base' && !l.float && !l.sink && !l.garnish).sort((x, y) => y.oz - x.oz)[0]; return b ? b.id : ''; };
  const namedIn = prompt => {
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
    if (intent.riffOf) return true;
    const text = ` ${prompt.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ')} `;
    return classicIndex.some(c => text.includes(` ${c.key} `));
  };
  // Which edition of a drink a build is: the reference it is anchored to.
  const branchOf = r => `${(r.reference || {}).name || ''}|${(r.reference || {}).edition || ''}`;
  function sameIdea(r, p, named) {
    // For a drink the guest named, a swapped rum is a twist, not a new idea: it takes another
    // branch of the drink, another temperature or glass, or its sibling.
    // "X but Y" answered with other bottles is a new idea too.
    const src = r.riffOf && drinkById[r.riffOf.id], ids = src ? new Set(src.ingredients.map(l => l.id)) : null;
    const change = x => ids ? [...bottleSet(x)].filter(id => !ids.has(id) && (ingMap.get(id) || {}).role !== 'base') : [];
    const answered = src && change(r).length && change(p).length && !change(r).some(id => change(p).includes(id));
    const moved = r.archetype.id !== p.archetype.id || tempOf(r) !== tempOf(p) || vesselClass(r.vessel && r.vessel.id) !== vesselClass(p.vessel && p.vessel.id)
      || (named ? branchOf(r) !== branchOf(p) || answered : heroOf(r) !== heroOf(p));
    return !moved || jaccard(bottleSet(r), bottleSet(p)) >= (named ? 0.7 : 0.6);
  }
  function generate(prompt, opts = {}) {
    const seed = opts.seed || 0;
    if (seed > 0 && !opts.prior) {
      const cache = opts.cache || new Map();
      const priors = [];
      for (let s0 = Math.max(0, seed - 3); s0 < seed; s0++) {
        if (!cache.has(s0)) cache.set(s0, generate(prompt, { ...opts, seed: s0, cache }));
        priors.push(cache.get(s0));
      }
      opts = { ...opts, prior: new Set(priors.map(r => r.archetype.id)), priorSets: priors.map(bottleSet), priorRecipes: priors, cache };
    }
    copyPrior = opts.priorRecipes || [];
    const first = generateOnce(prompt, opts);
    if (!linter || (first.classic && !(opts.priorRecipes && opts.priorRecipes.length))) return first;
    const fatal = r => { try { return linter.lint(r, { intent: parsePrompt(prompt, { nameIndex, concepts: conceptIndex }) }).filter(f => f.sev === 'fatal'); } catch { return []; } };
    let best = first, bestF = first.classic ? [] : fatal(first);
    const avoid = new Set([first.archetype.id]);
    for (let i = 0; bestF.length && !first.classic && i < 3; i++) {
      const t = generateOnce(prompt, { ...opts, avoid });
      if (avoid.has(t.archetype.id)) break;
      avoid.add(t.archetype.id);
      const f = fatal(t);
      if (f.length < bestF.length) { best = t; bestF = f; }
    }
    // The same idea as an earlier seed: re-plan on a sibling, keeping whichever build is a new
    // idea with no more fatal findings.
    if (opts.priorRecipes && opts.priorRecipes.length) {
      const named = namedIn(prompt);
      const close = r => opts.priorRecipes.some(p => sameIdea(r, p, named));
      const away = new Set([...opts.prior, ...avoid]);
      for (let i = 0; close(best) && i < 4; i++) {
        const t = generateOnce(prompt, { ...opts, avoid: new Set(away), sibling: named && i === 0 });
        away.add(t.archetype.id);
        if (close(t)) continue;
        // A new idea never breaks what the first build kept (the color demanded, a reading's promise).
        if (best.kept && t.kept && ((best.kept.color && !t.kept.color) || t.kept.broken > best.kept.broken)) continue;
        const f = fatal(t);
        if (f.length <= bestF.length) { best = t; bestF = f; }
      }
    }
    best.critic = { fatal: bestF.map(f => f.id), rebuilt: best !== first };
    return best;
  }

  function generateOnce(prompt, { seed = 0, avoid = null, prior = null, priorSets = null, sibling = false } = {}) {
    swappedOut.clear();
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
    // What the earlier seeds poured, so a repeat prayer starts from a spec far from them.
    intent.avoidSets = priorSets;
    // The color the prayer leans toward (never a demand), for the lean pass.
    if (!intent.color) intent.hueLean = hueLean(intent, /\bsurprise\b/i.test(prompt) && !intent.riffOf ? rngFrom(`${prompt}::${seed}::hue`) : null);
    if (!intent.riffOf) {
      const text = ` ${prompt.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ')} `;
      const hit = classicIndex.find(c => text.includes(` ${c.key} `));
      if (hit) { intent.archetypes[hit.a.id] = (intent.archetypes[hit.a.id] || 0) + 4; intent.matched.push({ phrase: hit.key, label: `the ${hit.name}` }); intent.namedClassic = hit; }
    }
    // How many it serves. A number in the prayer is the number. A party with no number gets a
    // batch for eight; a bowl asked for by name serves two (four for the big Scorpion bowl); a
    // prayer that only leans toward sharing gets a bowl for two if the drink is a bowl drink,
    // and one drink otherwise. Nothing is ever poured into a bowl for one.
    const askedBowl = intent.vessel && vesselById[intent.vessel] && vesselById[intent.vessel].serve.includes('bowl');
    if (askedBowl && (intent.servings || 1) < 2) { intent.servings = vesselById[intent.vessel].capacity >= 60 ? 4 : 2; intent.style.bowl = true; }
    else if (!intent.servingsAsked && !intent.vessel && (intent.servings || 1) < 2 && intent.concepts.some(id => PARTY.has(id))) {
      intent.servings = 8; intent.style.bowl = true; intent.party = true;
    }
    const servings0 = intent.servings || 1, bowl0 = !!intent.style.bowl;
    const rng = rngFrom(`${prompt}::${seed}`);
    TIE = rngFrom(`tie::${prompt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}::${seed}`);
    const greedy = seed === 0;
    let riffSrc = intent.riffOf ? drinkById[intent.riffOf] : null;
    // Of the drinks that share a name, the one that is what the name says (Harry Yee's Tropical
    // Itch, with its whiskey, rum and passion fruit, rather than a modern bar's namesake).
    if (riffSrc) {
      const named = d => archetypes.filter(a => (a.classics || []).some(c => c.toLowerCase().replace(/\s*\(.*\)/, '') === d.name.toLowerCase()));
      const real = d => { const n = named(d); const a = n.length ? n.find(a => composer.satisfies(a, linesOf(d)).ok) : archetypeForDrink(d); return !!a && composer.satisfies(a, linesOf(d)).ok; };
      if (!real(riffSrc)) {
        const better = drinks.filter(d => d.name === riffSrc.name && d !== riffSrc && real(d)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
        const nm = riffSrc.name.toLowerCase();
        const frame = archetypes.find(a => (a.classics || []).some(c => c.toLowerCase().replace(/\s*\(.*\)/, '') === nm) && (a.canonicalSpecs || []).some(sp => sp.name.toLowerCase().startsWith(nm)));
        if (better) { riffSrc = better; intent.riffOf = better.id; }
        // No catalogued version is what the name means today (a Hot Buttered Rum is its batter):
        // the archetype's own canonical spec is the classic.
        else if (frame) {
          riffSrc = null; intent.riffOf = null;
          intent.namedClassic = { key: nm, a: frame, name: riffSrc ? riffSrc.name : frame.canonicalSpecs.find(sp => sp.name.toLowerCase().startsWith(nm)).name.replace(/\s*\(.*\)\s*/, '').trim() };
          intent.archetypes[frame.id] = (intent.archetypes[frame.id] || 0) + 4;
        }
      }
    }
    // Praying again on a named drink whose own branches are all the same idea: its sibling
    // classic in the same family (a Hot Buttered Rum's Tom and Jerry, a Coffee Grog), said as such.
    if (sibling) {
      const own = riffSrc ? archetypeForDrink(riffSrc) : intent.namedClassic ? intent.namedClassic.a : null;
      // The named drink's own bottles (its batter, its overproofs) belong to it, not the sibling;
      // of the siblings that answer the rest of the prayer, the one least like it.
      const mine = new Set(riffSrc ? riffSrc.ingredients.map(l => l.id) : ((own && own.canonicalSpecs) || []).flatMap(sp => sp.lines.map(l => l.id)));
      for (const id of mine) {
        if ((ingMap.get(id) || {}).role === 'base') continue;
        delete intent.ings[id]; delete (intent.prefer || {})[id];
        const lead = ((ingMap.get(id) || {}).flavors || [])[0];
        if (lead && intent.tags[lead] && !((intent.conceptTags || {})[lead] >= intent.tags[lead])) delete intent.tags[lead];
      }
      intent.promises = (intent.promises || []).map(pr => ({ ...pr, ids: pr.ids.filter(id => !mine.has(id) || (ingMap.get(id) || {}).role === 'base') })).filter(pr => pr.ids.length || pr.up || pr.flaming || pr.layered);
      const overlap = a => Math.max(0, ...(a.canonicalSpecs || []).map(sp => { const ids = new Set(sp.lines.map(l => l.id)); const i = [...ids].filter(x => mine.has(x)).length; return i / (ids.size + mine.size - i || 1); }));
      const sibs = own ? archetypes.filter(a => a.family === own.family && a !== own && !(avoid && avoid.has(a.id))).map(a => ({ a, s: composer.scoreArchetype(a, intent, ctx).s })).filter(x => Number.isFinite(x.s)).sort((x, y) => y.s - x.s) : [];
      if (sibs.length) sibs.sort((x, y) => (x.s >= sibs[0].s - 3 ? 0 : 1) - (y.s >= sibs[0].s - 3 ? 0 : 1) || overlap(x.a) - overlap(y.a) || y.s - x.s);
      if (sibs.length) {
        intent.siblingOf = riffSrc ? riffSrc.name : intent.namedClassic.name;
        riffSrc = null; intent.riffOf = null; intent.namedClassic = null;
        intent.archetypes[sibs[0].a.id] = (intent.archetypes[sibs[0].a.id] || 0) + 6;
        avoid = new Set([...(avoid || []), own.id]);
      }
    }
    if (!intent.style.hot && Object.entries(intent.ings).some(([id, w]) => w >= 1.5 && (ingMap.get(id) || {}).oz_per_piece && id !== 'egg-white')) intent.style.frozen = true;
    blenderContext = !!intent.style.frozen || (riffSrc && riffSrc.method === 'blend');
    // A fruit-named frozen drink has the fruit in the blender, not only its liqueur.
    if (intent.style.frozen && !intent.style.hot) for (const ing of ingMap.values()) {
      if (!ing.oz_per_piece || forbidden(ing.id, intent)) continue;
      const lead = (ing.flavors || [])[0];
      if (lead && (intent.tags[lead] || 0) - ((intent.conceptTags || {})[lead] || 0) >= 1.5 && !(intent.ings[ing.id] >= 1.5)) intent.ings[ing.id] = 1.5;
    }

    const blank = !Object.keys(intent.tags).length && !intent.spirits.length && !Object.keys(intent.ings).length && !Object.keys(intent.style).length && !Object.keys(intent.fam).length && !intent.concepts.length;
    // One build on one archetype. A color prayer the build can't honor tries the next-best
    // archetypes (a Blue Hawaii-shaped drink rather than a dark rum swizzle dyed blue).
    let classic = null;
    let skipped = new Set();
    const attempt = forced => {
      const notes = [];
      leanBlend = false;
      let A = null, lines;
      classic = null;
      blenderContext = !!intent.style.frozen || (riffSrc && riffSrc.method === 'blend');
      if (!forced && riffSrc && !(intent.style.hot && riffSrc.family !== 'hot')) {
        const real = archetypeForDrink(riffSrc);
        A = real || adHocArchetype(riffSrc);
        // The named drink is the spec. Bare ("zombie"), the first prayer pours the classic as
        // written and credited; praying again riffs on it with one signed change. With a twist
        // ("a Mai Tai with mezcal"), exactly that twist is made inside the archetype's slots.
        const srcLines = riffSrc.ingredients.filter(l => ingMap.has(l.id)).map(l => {
          const ing = ingMap.get(l.id);
          return { id: l.id, role: roleOf(l, ing), oz: lineOz(l, ing, units) / (riffSrc.servings || 1), unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, garnish: !!l.garnish || ing.role === 'aromatic', fromSpec: riffSrc.name, label: composer.specLabel(l) };
        });
        const bare = !Object.keys(intent.tags).length && !intent.spirits.length && !Object.keys(intent.ings).length && !Object.keys(intent.style).filter(k => k !== 'bowl').length && !intent.concepts.length && !intent.color && !intent.diets.length && !intent.strength && !intent.sweetness && !intent.tartness
          // "no orange, a painkiller" isn't the classic as written.
          && !(intent.avoidIngs && intent.avoidIngs.size) && !Object.values(intent.avoidTags || {}).some(w => w > 0);
        if (real && bare && seed === 0) {
          lines = srcLines.map(l => ({ ...l, slot: composer.slotOf(A, l.id), req: true }));
          classic = riffSrc;
        } else if (real) {
          // Praying again on a named drink takes the other historical branch where there is one
          // (Vic's Navy Grog against Don's), then makes the same asked change.
          // Only a branch that keeps what the drink's name promises (a Chartreuse Swizzle's
          // chartreuse) counts.
          const STOPW = new Set(['fresh', 'juice', 'syrup', 'liqueur', 'rum', 'aged', 'light', 'dark', 'white', 'blended', 'style', 'simple', 'rich', 'sweet', 'bitters']);
          const named = srcLines.filter(l => ingMap.get(l.id).name.toLowerCase().split(/[^a-z']+/).some(w => w.length >= 4 && !STOPW.has(w) && riffSrc.name.toLowerCase().includes(w)));
          // (and that keeps the named drink's identity core: a Jungle Bird's branches all pour pineapple).
          const keeps = sp => named.every(n => sp.lines.some(x => x.id === n.id)) && !coreLost(riffSrc.name, specLines(sp));
          const branch = (A.canonicalSpecs || []).filter(keeps);
          // "X but Y" prayed again answers Y another way: the bottles earlier seeds poured for it
          // are set aside, and the weight they carried moves to the next flavor of the same ask
          // (a tropical Mai Tai's passion fruit, then its pineapple or guava).
          let shifted = false;
          if (seed > 0 && !bare && intent.avoidSets) {
            const srcIds = new Set(riffSrc.ingredients.map(l => l.id));
            const used = [...new Set(intent.avoidSets.flatMap(x => [...x]))].filter(id => !srcIds.has(id) && ingMap.has(id) && ingMap.get(id).role !== 'base');
            const leadOf = id => (ingMap.get(id).flavors || [])[0];
            for (const id of used) {
              const lead = leadOf(id), w = lead ? (intent.tags[lead] || 0) - ((intent.conceptTags || {})[lead] || 0) : 0;
              if (w < 1 || (intent.ings[id] || 0) >= 1) continue;
              intent.softAvoid[id] = Math.max(intent.softAvoid[id] || 0, 1);
              const next = Object.entries(intent.tags).filter(([t]) => t !== lead && !STRUCTURAL_TAGS.has(t) && !used.some(u => leadOf(u) === t)).sort((x, y) => y[1] - x[1])[0];
              if (next) intent.tags[next[0]] = next[1] + w;
              intent.tags[lead] = 0;
              shifted = true;
            }
          }
          intent.specOnly = keeps;
          intent.riffBranch = seed > 0 && branch.length > 1;
          lines = seed > 0 && branch.length > 1 ? composer.compose(A, intent, ctx, rng, greedy, notes, null, seed) : composer.compose(A, intent, ctx, rng, greedy, notes, { lines: srcLines });
          intent.specOnly = null; intent.riffBranch = false;
          // A bare name prayed again gets one signed change of its own; a prayer that asked for a
          // change already has its new idea (another branch, another answer to its word).
          if (bare || (seed > 0 && !shifted && branch.length <= 1)) { const v = composer.twist(A, lines, intent, ctx, rng, false) || composer.vary(A, lines, intent, ctx, rng, false); if (v) notes.push(v); }
        } else {
          lines = buildRiff(riffSrc, intent, rng, greedy, notes);
          for (const l of lines) l.slot = null;
        }
        // A riff keeps its source's spirit budget: a requested spirit and a repaired base share
        // the pour instead of doubling it (Mai Tai with mezcal is 1 + 1, not 2 + 2).
        const srcBase = linesOf(riffSrc).filter(l => l.role === 'base' && !l.float && !l.garnish).reduce((t, l) => t + l.oz, 0);
        const bases = lines.filter(l => l.role === 'base' && !l.float && !l.sink);
        const total = bases.reduce((t, l) => t + (l.oz || 0), 0);
        if (srcBase && total > srcBase * 1.15) {
          const k = srcBase / total;
          for (const b of bases) { b.oz = Math.max(0.5, Math.round(b.oz * k * 4) / 4); b.oz0 = b.oz; }
          notes.push(`split the ${Math.round(srcBase * 4) / 4} oz of spirit between ${bases.length} bottles`);
        }
      }
      // A classic the archetypes name but the catalogue lacks ("a Tom and Jerry", "a scorpion
      // bowl"): bare, the first prayer pours its canonical spec, credited.
      const nc = intent.namedClassic;
      // Bare: nothing asked beyond the name (a concept that only matched the name itself counts as nothing).
      const extraReadings = nc ? intent.readings.filter(r => !nc.key.includes(r.phrase)) : [];
      const bareNamed = nc && !intent.spirits.length && !Object.keys(intent.ings).length && !intent.color && !intent.diets.length && !extraReadings.length && !Object.entries(intent.tags).some(([t, w]) => w - ((intent.conceptTags || {})[t] || 0) >= 0.5);
      if (!forced && !A && nc && bareNamed && seed === 0) {
        const nk = nc.name.toLowerCase();
        const sp = (nc.a.canonicalSpecs || []).find(x => x.name.toLowerCase().startsWith(nk) || nk.startsWith(x.name.toLowerCase().replace(/\s*\(.*/, ''))) || (nc.a.canonicalSpecs || [])[0];
        if (sp) {
          A = nc.a;
          lines = sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: ingMap.get(l.id).role, oz: l.oz, unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, garnish: ingMap.get(l.id).role === 'aromatic', slot: composer.slotOf(A, l.id), req: true, fromSpec: sp.name, label: composer.specLabel(l) }));
          classic = { id: `${A.id}:${sp.name}`, name: sp.name.replace(/\s*\(.*\)\s*/, '').trim(), source: sp.source || '', creator: '', venue: '', year: null, fromArchetype: sp };
          notes.push(`spec:${sp.name}`);
        }
      }
      if (!A) {
        let scored = archetypes.map(a => composer.scoreArchetype(a, intent, ctx)).filter(x => Number.isFinite(x.s) && !(avoid && avoid.has(x.a.id)));
        const firstChoice = scored.length ? [...scored].sort((x, y) => y.s - x.s)[0].a : null;
        // Praying again should bring a different idea, not the same drink a quarter ounce off:
        // each later seed sets aside the frames earlier seeds would have chosen, as long as
        // something else still answers the prayer nearly as well.
        if (seed > 0 && !blank && scored.length > 1) {
          const ranked = [...scored].sort((x, y) => y.s - x.s);
          const best = ranked[0].s;
          // Still on-prayer: the alternatives must be able to carry the prayer's leading flavor
          // (a bananas-foster prayer stays banana on every seed).
          // The lead is a flavor the guest said outright; a concept's leanings don't pin the frame.
          const lead = Object.entries(intent.tags).map(([t, w]) => [t, w - ((intent.conceptTags || {})[t] || 0)]).filter(([t]) => !['sweet', 'tart', 'light', 'rich', 'boozy', 'warm', 'fruity', 'tropical', 'citrus', 'creamy', 'effervescent', 'crisp', 'dry'].includes(t)).sort((a, b) => b[1] - a[1])[0];
          let near = ranked.filter(x => x.s >= best - 3.5 && (!lead || lead[1] < 1 || composer.carries(x.a, lead[0], intent, ctx)));
          // Nothing else carries it: any frame that answers the prayer nearly as well will do.
          if (near.length <= 1) near = ranked.filter(x => x.s >= best - 2.5);
          // The frames earlier seeds actually served (after their own retries) are set aside first.
          const served = near.filter(x => prior && prior.has(x.a.id));
          const skip = new Set(served.length ? served.slice(0, near.length - 1).map(x => x.a) : near.slice(0, Math.min(seed, near.length - 1)).map(x => x.a));
          if (near.length > 1) { scored = near.filter(x => !skip.has(x.a)); skipped = skip; }
        }
        // A tie on a later seed goes to the lesser-poured frame: the best-known ones (catalogue
        // weight 4 or 5: the colada, the Mai Tai, the Zombie) are every prayer's easy answer.
        if (seed > 0 && !blank && scored.length > 1) {
          const top = Math.max(...scored.map(x => x.s));
          const tie = scored.filter(x => x.s >= top - 0.3);
          // (Only a sibling of a best-known frame in the tie: the Lava Flow gives way to the
          // Painkiller, never to an unrelated frame that merely ties.)
          const hubs = tie.filter(x => (x.a.weight || 1) >= 4);
          const kin = new Set(hubs.flatMap(x => x.a.siblings || []));
          const lesser = tie.filter(x => (x.a.weight || 1) < 4 && kin.has(x.a.id) && !namedFrame(x.a, intent) === !namedFrame(tie.sort((p, q) => q.s - p.s)[0].a, intent));
          // (A prayer that ties everything, "not too sweet, very tart", keeps its own tie-break.)
          if (lesser.length && lesser.length < tie.length && tie.length <= 4 && !tie.some(x => x.s === top && namedFrame(x.a, intent))) scored = scored.filter(x => !tie.includes(x) || lesser.includes(x));
        }
        // An open prayer with nothing to steer it still never repeats the frame an earlier seed served.
        if (blank && prior && prior.size && scored.some(x => !prior.has(x.a.id))) scored = scored.filter(x => !prior.has(x.a.id));
        // Deterministic sibling choice: a frame the prayer didn't name (no drink, family word or
        // reading points at it) gives way, by the prayer's own hash, to a sibling that answers
        // nearly as well, so neighboring prayers don't all pour the same drink (the Zombie's Jet
        // Pilot, the Mai Tai's Menehune Juice, the colada's Painkiller in the tin).
        // (Seed 0 only: a later seed already sets aside the frames earlier seeds served.)
        if (!forced && !blank && seed === 0 && scored.length > 1) scored = spreadToSiblings(scored, intent, prompt, seed);
        A = forced || softPick(rng, scored.map(x => ({ item: x.a, s: x.s })), blank ? 2.5 : 0.8, (greedy || seed > 0) && !blank)
          // Nothing can be built as asked (every archetype needs something the guest ruled out):
          // fall back to the most forgiving frame, a planter's punch.
          || composer.byId['planters-punch'] || archetypes[0];
        if ((A.methods || [])[0] === 'blend') blenderContext = true;
        lines = composer.compose(A, intent, ctx, rng, greedy, notes, null, seed);
        // A repeat prayer on the same frame still makes one signed change of its own.
        // (Only when an earlier seed served this same frame: a frame of its own is the new idea.)
        if (seed > 0 && ((prior && prior.size ? prior.has(A.id) : A === firstChoice) || (A.canonicalSpecs || []).length <= 1)) { const v = composer.twist(A, lines, intent, ctx, rng, false) || composer.vary(A, lines, intent, ctx, rng, false); if (v) notes.push(v); }
        if (blank) intent.complexity = Math.max(intent.complexity, 0.4);
        // An open prayer that drew a proven spec it didn't name, and changed nothing in it, makes
        // one move of its own words: the drink reflects this prayer, and two prayers that land on
        // the same classic don't pour it twice.
        {
          const started = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
          const sp0 = started && (A.canonicalSpecs || []).find(x => x.name === started);
          const ids = ls => new Set(ls.filter(l => !l.garnish && ingMap.has(l.id) && ingMap.get(l.id).role !== 'aromatic').map(l => l.id));
          const mine = ids(lines), theirs = sp0 ? ids(sp0.lines) : null;
          // (A directional ask, "very tart" or "stronger", already reflects the prayer in the doses.)
          const directional = intent.sweetness || intent.tartness || intent.strength;
          // (Barely changed: nothing but the spec's own bottles, or a near-twin swapped in.)
          const barely = sp0 && ([...mine].every(id => theirs.has(id)) || copy.sameness(lines.map(l => ({ ...l, garnish: l.role === 'aromatic' && !l.muddled })), specLines(sp0)) >= 0.8);
          if (sp0 && !forced && !directional && !namedFrame(A, intent) && barely) {
            // (The prayer's own hash chooses among the moves that suit it, so two prayers that ask
            // for the same thing in different words still mark their drinks differently.)
            const v = composer.twist(A, lines, intent, ctx, rngFrom(`${prompt}::${seed}::mark`), false, 2) || composer.vary(A, lines, intent, ctx, rngFrom(`${prompt}::${seed}::mark`), false);
            if (v) notes.push(v);
          }
        }
        // A fresh build that lands on top of an existing recipe isn't new: swap one filling.
        for (let tries = 0; tries < 3; tries++) {
          const twin = closestTwin(lines);
          if (!twin || twin.s < 0.85) break;
          const v = composer.twist(A, lines, intent, ctx, rng, greedy && tries === 0) || composer.vary(A, lines, intent, ctx, rng, greedy && tries === 0);
          if (!v) break;
          notes.push(`${v}, to make it more than a ${drinkById[twin.id].name}`);
        }
      }
      const famId = A.family;
      blenderContext = blenderContext || (A.methods || [])[0] === 'blend';
      lines = lines.filter(l => ingMap.has(l.id));
      addLayer(lines, A, intent, notes);

      // Mint the archetype is built on is an ingredient (blended, muddled or swizzled in), not a garnish.
      for (const l of lines) if (['mint', 'basil'].includes(l.id) && (A.signature || []).some(c => c.required && c.anyOf.includes(l.id))) {
        l.muddled = true; l.garnish = false; l.role = 'aromatic'; l.unit = 'leaves'; l.amount = l.unit === 'leaves' && l.amount >= 6 ? l.amount : 10;
      }
      // (A spec that lists the mint twice, in the blender and as the sprig, pours it once.)
      for (let i = lines.length - 1; i >= 0; i--) if (lines[i].muddled && lines.findIndex(x => x.id === lines[i].id && x.muddled) < i) lines.splice(i, 1);
      // Aromatic garnishes the archetype calls for (mint on a Mai Tai, nutmeg on a Painkiller).
      for (const id of A.aromatics || []) if (!lines.some(l => l.id === id) && !forbidden(id, intent)) lines.push({ id, role: 'aromatic', garnish: true });
      for (const l of lines) if (intent.ings[l.id] || Object.entries(intent.tags).some(([t, w]) => w >= 1.4 && ((ingVec[l.id] || {})[t] || 0) >= 0.55)) l.req = true;

      // Service from the archetype, bent by the prayer where the archetype allows it.
      const methods = A.methods || ['shake'], ices = A.ice || ['crushed'];
      const svc = { method: methods[0], ice: ices[0], glass: '' };
      // A blender takes its own ice: a frame whose first method is the blender serves it blended,
      // whatever ice its other services list first (a Pi Yi isn't "blended on crushed").
      if (svc.method === 'blend') svc.ice = 'blended';
      if (riffSrc && A === archetypeForDrink(riffSrc)) { svc.method = riffSrc.method; svc.ice = riffSrc.ice; }
      // Praying again on a named drink with only one historical branch changes how it's served
      // instead: frozen this time, if the frame allows it (a Painkiller frappé).
      if (riffSrc && seed > 0 && !intent.style.hot && !intent.style.stirred && svc.method !== 'blend' && methods.includes('blend') && seed % 2 === 1) {
        svc.method = 'blend'; svc.ice = 'blended'; blenderContext = true;
        notes.push('blended this time, frozen and frothy');
      }
      if (intent.style.frozen && methods.includes('blend')) { svc.method = 'blend'; svc.ice = 'blended'; }
      if (intent.style.hot && methods.includes('hot')) { svc.method = 'hot'; svc.ice = 'none'; }
      if (intent.style.stirred && methods.includes('stir')) { svc.method = 'stir'; svc.ice = ices.includes('block') ? 'block' : 'cubed'; }
      // A reading that promised the drink served up (a first date: nothing to fight with) gets a
      // shaken drink in a chilled glass, if nothing in it needs ice or length.
      const asked = intent.askedStyle || {};
      const upAsked = (intent.promises || []).some(pr => pr.up) && !asked.frozen && !asked.long && !intent.style.hot && !intent.style.creamy;
      svc.wantUp = upAsked && methods.includes('shake') && !A.creamy && !lines.some(l => l.role === 'lengthener' || (l.role === 'juice' && l.oz > 2));
      if (svc.wantUp) { svc.method = 'shake'; svc.ice = 'cubed'; if (!asked.frozen) blenderContext = false; }
      // A bowl drink is for sharing: asked for one, the gods pour it for two. Any other drink
      // asked for one is one drink in a glass, whatever the prayer leaned toward.
      intent.servings = servings0; intent.style.bowl = bowl0;
      if (servings0 < 2 && (A.bowl || /bowl/.test(A.id)) && (A.methods || [])[0] !== 'hot' && (!intent.vessel || askedBowl)) {
        intent.servings = 2; intent.style.bowl = true;
        notes.push(`a ${A.name.toLowerCase().replace(/ \(.*\)/, '')} is for sharing, so this one serves two`);
      } else if (servings0 < 2) intent.style.bowl = false;
      if (intent.party && intent.servings === 8) notes.push('a party gets a batch: this one serves eight');
    const askedV = intent.vessel && vesselById[intent.vessel];
      if (askedV && !askedV.serve.includes('bowl') && !SERVICE_FITS[serviceOf(svc.method, svc.ice)].some(x => askedV.serve.includes(x))) {
        if (askedV.serve.includes('crushed')) { if (svc.method === 'blend' || svc.method === 'stir') svc.method = 'shake'; svc.ice = 'crushed'; }
        else if (askedV.serve.includes('frozen')) { svc.method = 'blend'; svc.ice = 'blended'; }
        else if (askedV.serve.includes('up')) { if (!['shake', 'stir'].includes(svc.method)) svc.method = 'shake'; svc.ice = 'cubed'; }
        else if (askedV.serve.includes('rocks')) { if (!['shake', 'stir', 'build'].includes(svc.method)) svc.method = 'shake'; svc.ice = 'cubed'; }
      }

      service(svc, A, lines, intent, notes, riffSrc && A === archetypeForDrink(riffSrc) ? riffSrc : null);
      fixTechnique(svc, lines, notes);
      // Bitters dashed over a swizzle's crushed ice sit on top as a crown (the Queen's Park's rust
      // cap), unless the archetype's own garnish rules forbid one: a Bermuda swizzle keeps its
      // bitters inside the drink.
      const crownBarred = ((A.garnish || {}).never || []).some(x => /\b(bitters|angostura) crown\b/i.test(x));
      if (svc.method === 'swizzle' && !crownBarred) for (const l of lines) if (ingMap.get(l.id).cat === 'bitters' && !l.float && !l.sink && (l.oz || 0) < 0.3) l.crown = true;
      // Doses: the composer set them inside the archetype's ranges; balance pulls sugar, acid and
      // strength onto the archetype's targets without leaving those ranges.
      initialDoses(lines, famId, intent);
      const specName = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
      const spec = specName && (A.canonicalSpecs || []).find(sp => sp.name === specName);
      const ref = riffSrc ? linesOf(riffSrc).filter(l => !l.garnish) : spec ? spec.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, oz: l.oz, role: ingMap.get(l.id).role })) : null;
      // A canonical spec poured untouched (a bare "a swizzle" is the 1946 Queen's Park) is canon
      // as written: it keeps its spirit, its sugar and its acid; only the identity core's doses apply.
      intent.asWritten = !classic && !riffSrc && !!spec && notes.every(n => n.startsWith('spec:')) && lines.every(l => l.garnish || (l.role === 'aromatic' && !l.muddled) || l.fromSpec === spec.name);
      const refMethod = riffSrc ? riffSrc.method : spec ? (spec.method || (A.methods || [])[0]) : null;
      // The reference the build answers to (its bottles, doses, ratio and acid): every later pass
      // corrects only what the prayer's changes disturbed, against this.
      const anchor = classic ? null : anchorOf(ref, refMethod, svc);
      if (!classic) structure(lines, A, intent, notes, svc, anchor);
      if (!classic) askHolds(lines, A, intent, anchor);
      const target = classic ? null : balanceTo(lines, ref, A, intent, svc, notes, refMethod);
      if (anchor) anchor.T = target;
      if (!classic && (intent.strength || 0) <= -1.5 && !intent.style.zeroProof) gentle(lines, A, intent, svc, notes);
      if (!classic) {
        // Balance and color moves never push an accent past its cap (2 oz of blue curaçao is dye, not a drink).
        for (const l of lines) { const cap = doseCap(l.id, A.family, (intent.ings[l.id] || 0) >= 1); if (l.oz > cap && !(l.fromSpec && l.oz <= (l.oz0 || 0) + 0.01)) l.oz = cap; }
        floors(lines, A, intent, svc, notes);
      }
      finalizeAmounts(lines);
      if (!classic) settle(lines, target, A, intent, svc);
      let colorOk = intent.color ? colorPass(lines, A, intent, svc, notes) : true;
      if (!intent.color && !classic && !(riffSrc && !intent.colorLean && !hueLean(intent))) {
        if (intent.hueLean) leanPass(lines, A, intent, svc, notes, target, intent.hueLean);
        // No leaning at all: the drink's own color carrier (its passion fruit, its grenadine) may
        // sing a little louder, inside its range and its balance.
        else if (!riffSrc) { const own = ownLean(lines, A); if (own) leanPass(lines, A, intent, svc, notes, target, own, true); }
      }
      // Balanced into a proven classic outright (a Daiquiri No. 4): served the way it is.
      if (!classic && service(svc, A, lines, intent, notes, null, true)) settle(lines, target, A, intent, svc);
      // A spec the passes above had to change (a full pour of spirit, a color) is no longer as written.
      if (intent.asWritten && !notes.every(n => n.startsWith('spec:'))) intent.asWritten = false;
      // The one balance pass (the same one that runs again, with the glass, once a vessel is
      // chosen), so each candidate build is judged as it will be poured.
      if (!classic) settleFinal(lines, A, intent, svc, notes, { anchor });
      const c = chemOf(lines, svc.method, svc.ice);
      const looks = () => drinkLook(lines, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: c.finalOz - c.volOz });
      if (intent.color && colorOk && !classic && COLOR_TEST[intent.color]) colorOk = showsColor(looks(), intent.color);
      const colorMiss = colorOk ? 0 : colorDistance(looks(), intent.color);
      const broken = promisesBroken(lines, svc, A, c);
      return { A, lines, notes, svc, colorOk, colorMiss, broken, score: (scoreOf.get(A) ?? -Infinity), servings: intent.servings, bowl: intent.style.bowl, asWritten: intent.asWritten, anchor, target };
    };
    // How well a build keeps the prayer: the color it demanded, and each reading's promise.
    // (composer.promiseBreak: the promised bottles at their doses, the service, the float, the
    // strength; a promise this pantry can't pour, or the guest ruled out, can't be broken.)
    const promisesBroken = (lines, svc, A, chem = null) => (intent.promises || []).reduce((t, pr) => t + composer.promiseBreak(pr, { lines, svc, A, intent, forbidden, chem }), 0);
    const scoreOf = new Map(archetypes.map(a => { const x = composer.scoreArchetype(a, intent, ctx); return [a, x.s]; }));
    let built = attempt(null);
    const worse = (t, b) => (t.colorOk ? 0 : 1) * 10 + t.colorMiss + t.broken * 2 >= (b.colorOk ? 0 : 1) * 10 + b.colorMiss + b.broken * 2 - 0.05;
    if ((!built.colorOk || built.broken) && !riffSrc && !classic && !intent.namedClassic) {
      const ranked = archetypes.map(a => ({ a, s: scoreOf.get(a) })).filter(x => Number.isFinite(x.s) && x.a !== built.A && !skipped.has(x.a) && !(avoid && avoid.has(x.a.id)) && x.s >= (scoreOf.get(built.A) ?? 0) - (built.colorOk ? 4 : 9)).sort((x, y) => y.s - x.s);
      // A color the guest demanded that none of the closest frames could pour (a neon prayer's
      // second idea landing on a Mojito, which never takes melon liqueur): look a little further
      // down the list, at frames that allow the color's bottle or have a slot for one of its carriers.
      const canCarry = a => {
        const lr = LAST_RESORT[intent.color], test = COLOR_TEST[intent.color];
        if (lr && !(a.forbidden || []).includes(lr.id) && !forbidden(lr.id, intent)) return true;
        return [...(a.signature || []), ...(a.optional || [])].some(sl => (sl.anyOf || []).some(id => ingMap.has(id) && opticsOf(ingMap.get(id)).tint >= 0.8 && test(hsl(opticsOf(ingMap.get(id)).hex))));
      };
      const further = intent.color && !built.colorOk && COLOR_TEST[intent.color] ? ranked.slice(8).filter(x => canCarry(x.a)).slice(0, 6) : [];
      for (const x of [...ranked.slice(0, 8), ...further]) {
        if (built.colorOk && !built.broken) break;
        const t = attempt(x.a);
        if (!worse(t, built)) built = t;
      }
    }
    const { A, notes, svc } = built;
    leanBlend = !!svc.lessIce;
    intent.asWritten = built.asWritten;
    intent.servings = built.servings; intent.style.bowl = built.bowl;
    let lines = built.lines;
    // A riff that changed nothing isn't a riff: it's the classic, poured as written and credited.
    if (riffSrc && !classic && seed === 0 && A === archetypeForDrink(riffSrc)) {
      const src = linesOf(riffSrc).filter(l => !l.garnish);
      const mine = lines.filter(l => !l.garnish && l.role !== 'aromatic');
      const same = src.length === mine.length && src.every(x => mine.some(l => l.id === x.id && Math.abs(l.oz - x.oz) <= Math.max(0.13, x.oz * 0.1)));
      if (same) classic = riffSrc;
    }
    const famId = A.family;
    lines.sort((a, b) => ROLE_ORDER.concat(['aromatic']).indexOf(a.role) - ROLE_ORDER.concat(['aromatic']).indexOf(b.role) || b.oz - a.oz);

    // The glass: one capacity model (service's needOf) decides it, and the one final balance-and-fit
    // pass (finalPass) holds the drink inside its band, inside that glass, and prints what it computed.
    let chem = chemOf(lines, svc.method, svc.ice);
    let pick = chooseVessel(famId, intent, svc, chem, riffSrc, rngFrom(`${prompt}::${seed}::vessel`), greedy, A, lines.filter(l => l.float || l.sink || l.crown));
    const usePick = p => { pick = p; if (pick) { svc.glass = pick.v.name; svc.vessel = pick.v.id; svc.up = pick.v.serve.includes('up') && ['shaken', 'up'].includes(serviceOf(svc.method, svc.ice)); } };
    usePick(pick);
    // A punch bowl is built over a block and ladled, whatever the single serve would be.
    if (pick && pick.v.id === 'punch-bowl' && svc.method !== 'hot') { svc.ice = 'block'; if (['shake', 'flash-blend', 'swizzle', 'blend'].includes(svc.method)) svc.method = 'build'; }
    // A vessel the guest asked for (a coconut holds twelve ounces) gets a drink scaled to fit it;
    // a built drink grows to fill a glass it would look lost in. (Growing happens here only: the
    // final pass after it never makes the drink bigger.)
    if (pick && (!classic || pick.why === 'asked')) { const x = needOf(chemOf(lines, svc.method, svc.ice), pick.v, svc, intent.servings || 1); if (x.oz < x.lo * 0.98 || pick.why === 'asked') fitVessel(lines, svc, pick.v, notes, A, intent.servings || 1); }
    // A blended Lava Flow is built around its strawberry poured first (its identity core): the
    // purée streaks up through the colada instead of mixing into it.
    if (svc.method === 'blend' && A.family === 'colada' && [svc.canon && svc.canon.name, ...notes.filter(n => n.startsWith('spec:')).map(n => n.slice(5))].some(x => /^lava flow/i.test(x || '')))
      for (const l of lines) if (l.id === 'strawberry' && !l.garnish && !l.float && !l.sink) l.streak = true;
    // A classic poured as written that overflows its glass goes into another glass (service's
    // chooseVessel, judged on the drink as it now is), never a scaled-down spec.
    const rechoose = () => {
      const tmp = { ...svc, canon: null, waived: [...(svc.waived || [])] };
      const layers = lines.filter(l => l.float || l.sink || l.crown);
      return chooseVessel(famId, intent, tmp, chemOf(lines, svc.method, svc.ice), null, rngFrom(`${prompt}::${seed}::vessel2`), true, A, layers);
    };
    usePick(finalPass(lines, A, intent, svc, notes, { pick, classic: !!classic, anchor: built.anchor, rechoose }));
    lines.sort((a, b) => ROLE_ORDER.concat(['aromatic']).indexOf(a.role) - ROLE_ORDER.concat(['aromatic']).indexOf(b.role) || b.oz - a.oz);
    chem = chemOf(lines, svc.method, svc.ice);
    const profile = profileOf(lines.map(l => ({ id: l.id, amount: l.oz, unit: 'oz', garnish: l.role === 'aromatic' })), 1, svc.method, svc.ice);
    const flavorTop = copy.named(copy.presence(lines.filter(l => l.role !== 'aromatic' || l.muddled))).map(x => x.tag).slice(0, 5);
    let garnish = chooseGarnish(A, intent, lines, flavorTop, svc, pick ? pick.v : null, { rng: rngFrom(`${prompt}::${seed}::garnish`) });
    const look = drinkLook(lines, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: Math.max(0, chem.finalOz - chem.volOz), vessel: svc.vessel });
    const heads = copy.headline(lines);
    const srcIds = riffSrc ? new Set(riffSrc.ingredients.map(l => l.id)) : null;
    const name = makeName(rngFrom(`${prompt}::${seed}::name`), {
      variant: seed, archetype: A, family: famId, intent, flavorTags: heads,
      askedTags: heads.filter(t => (intent.tags[t] || 0) >= 1),
      changeTags: srcIds ? copy.headline(lines.filter(l => !srcIds.has(l.id))) : [],
      color: [intent.color, intent.colorLean].find(c => c && showsColor(look, c)) || null,
      shows: c => showsColor(look, c), poured: new Set(lines.filter(l => !l.garnish || l.muddled).map(l => l.id)),
      baseIds: lines.filter(l => l.role === 'base').map(l => l.id), riffOf: riffSrc ? riffSrc.name : null, taken: takenNames,
      facts: nameFacts({ lines, A, intent, svc, vessel: pick ? pick.v : null, garnish, riffSrc, look, chem }),
    });
    // A name that points at a garnish (an Orchid, a Sakura, something Blooming) wears it.
    const named = garnishPromises({ concepts: [], tags: {} }, name).filter(x => !garnish.includes(x));
    if (named.length) garnish = chooseGarnish(A, intent, lines, flavorTop, svc, pick ? pick.v : null, { rng: rngFrom(`${prompt}::${seed}::garnish`), promised: named });
    const recipe = {
      name: classic ? classic.name : name,
      classic: classic ? classicRecord(classic) : null,
      prompt,
      seed,
      archetype: { id: A.id, name: A.name, definition: A.definition || '' },
      family: { id: famId, name: famById[famId].name },
      riffOf: riffSrc ? { id: riffSrc.id, name: riffSrc.name } : null,
      heard: [...new Set(intent.matched.map(m => m.label))],
      servings: intent.servings,
      lines: lines.filter(l => l.role !== 'aromatic' || l.muddled).map(l => ({
        // (A swapped line loses its spec's word for the bottle it replaced.)
        id: l.id, name: (l.label && !l.swapped && !(l.was || []).length) ? l.label : displayName(l.id), role: l.role, oz: round(l.oz, 3), amount: l.amount, unit: l.unit, float: !!l.float, sink: !!l.sink, ...(l.streak ? { streak: true } : {}),
        garnish: l.role === 'aromatic' && !l.muddled, muddled: !!l.muddled, examples: ingMap.get(l.id).examples || [], avail: ingMap.get(l.id).avail,
      })),
      method: { ...svc, steps: steps(svc, lines, intent, garnish) },
      batch: intent.servings > 1 ? lines.filter(l => l.role !== 'aromatic').map(l => ({ id: l.id, name: displayName(l.id), total: batchAmount(l, intent.servings) })) : null,
      vessel: pick ? { id: pick.v.id, name: pick.v.name, kind: pick.v.kind, story: pick.v.story || '', why: pick.why } : null,
      garnish,
      flavor: flavorTop,
      look,
      stats: {
        abv: round(chem.abv, 1), sugarConc: round(chem.sugarConc, 1), acidConc: round(chem.acidConc, 2),
        sweetSour: chem.sweetSour === null ? null : round(chem.sweetSour, 1), volOz: round(chem.volOz, 2), finalOz: round(chem.finalOz, 1),
        family: pickMetrics(model.families[famId].metrics),
      },
    };
    recipe.style = { ...intent.style };
    // Whether the build kept the prayer's demands (its color, each reading's promise), so a
    // re-plan for a new idea never trades a kept promise away.
    recipe.kept = { color: !!built.colorOk, broken: built.broken || 0 };
    recipe.notes = [...new Set(notes.filter(n => n !== 'split-base').map(n => n.replace(/^riff:/, '')))];
    recipe.stats.standardDrinks = round(chem.alcMl / 17.74, 1);
    recipe.check = composer.satisfies(A, lines, intent.ings, id => forbidden(id, intent), { doses: !classic });
    recipe.explanation = explain(recipe, profile, famId, intent, riffSrc, notes);
    finishCopy(recipe, { A, intent, riffSrc, notes, lines, look, svc, garnish, classic, seed, prompt });
    return recipe;
  }

  // ---------- credits, references and the card's words ----------
  // Who made a drink, where and when, comes from the archetypes' researched origins (kept apart
  // from the book whose spec is poured); a catalogue drink no origin covers is credited from its
  // own record.
  const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const conceptById = new Map(concepts.map(c => [c.id, c]));
  const originByName = new Map();
  for (const a of archetypes) for (const [nm, o] of Object.entries(a.origins || {})) if (!originByName.has(normName(nm))) originByName.set(normName(nm), { ...o, drink: o.drink || nm });
  // Which archetypes count a drink as their own: its credited drinks and its canonical specs.
  const ownerByName = new Map();
  for (const a of archetypes) {
    for (const nm of [...Object.entries(a.origins || {}).filter(([, o]) => !o.ancestor).map(([k]) => k), ...(a.canonicalSpecs || []).map(sp => sp.drink || sp.name)]) {
      const k = normName(nm);
      if (!ownerByName.has(k)) ownerByName.set(k, new Set());
      ownerByName.get(k).add(a.id);
    }
  }
  const GENERIC_DRINK = /^(daiquiri|frozen daiquiri|swizzle|rum swizzle|punch|rum punch|grog|colada|sour|mule|highball|cooler|hot grog|hot rum|rum old fashioned|tiki old fashioned|zero proof tiki)$/;
  const classicNames = [...new Set(archetypes.flatMap(a => [...(a.classics || []).map(c => c.replace(/\s*\(.*\)\s*/, '').trim()), ...Object.keys(a.origins || {})]))].filter(n => n.length >= 6 && !GENERIC_DRINK.test(normName(n)));
  function originOf(x) {
    const d = typeof x === 'string' ? { name: x } : x;
    const o = originByName.get(normName(d.name));
    if (o) return o;
    if (!d.id) return null;
    const when = d.year ? (d.circa && d.year % 10 === 0 ? `${d.year}s` : `${d.circa ? 'c. ' : ''}${d.year}`) : '';
    const who = d.creator && !/\(/.test(d.creator) && d.creator !== 'Donn Beach' ? d.creator : '';
    const venue = String(d.venue || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const text = [who, venue, when].filter(Boolean).join(', ');
    const all = `${d.creator || ''} ${d.venue || ''}`;
    return { drink: d.name, text, year: d.year || null, who: d.creator || '', house: /Donn Beach|Don the Beachcomber/.test(all) ? 'don' : /Bergeron|Trader Vic/.test(all) ? 'vic' : null, confidence: 'documented' };
  }
  // A spec's mint pressed into the glass (leaves or a sprig with a dose) is in the drink, the
  // way the finished build marks it muddled; a sprig on top is garnish.
  const specLines = sp => sp.lines.filter(l => ingMap.has(l.id)).map(l => {
    const inGlass = ingMap.get(l.id).role === 'aromatic' && ['leaves', 'sprig'].includes(l.unit) && (l.amount || l.oz) > 0;
    return { id: l.id, oz: l.oz, float: !!l.float, sink: !!l.sink, garnish: ingMap.get(l.id).role === 'aromatic' && !inGlass, muddled: inGlass };
  });
  const asPoured = ls => ls.map(l => (ingMap.get(l.id) || {}).role === 'aromatic' && !l.garnish ? { ...l, muddled: true } : l);
  // The year an edition was written down: the spec's own date ("Scorpion Bowl (1946)", "Vic's
  // 1972 individual spec"), else the year of the drink's origin.
  // Only a documented date: a spec's own ("Scorpion Bowl (1946)"), or the origin's for the first
  // spec of a drink with no other edition named (a modern reading of the Tortuga is not 1946).
  const editionYear = (sp, o, first = false) => { const m = `${sp.name || ''} ${sp.edition || sp.variant || ''}`.match(/\b(1[6-9]\d\d|20\d\d)\b/); return m ? +m[1] : first && !sp.edition && !sp.variant && o && o.confidence === 'documented' ? o.year || null : null; };
  const fromSpec = (sp, A) => {
    const name = sp.drink || sp.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const o = sp.origin || originOf(name) || (A && A.origin && normName(A.origin.drink) === normName(name) ? A.origin : null);
    const r = {
      kind: 'spec', id: `${A ? A.id : ''}:${sp.name}`, specName: sp.name, name, lines: specLines(sp), origin: o, credit: creditText(o), edition: sp.edition || '', archetype: A ? A.id : null,
      service: { method: sp.method || (A && (A.methods || [])[0]) || null, ice: sp.ice || null, vessel: sp.vessel || null, garnish: sp.garnish || [] },
      // The first spec an archetype lists for a drink is that drink's own name; another edition
      // of it is titled by its edition ("Zombie, the Smuggler's Cove way").
      flagship: !A || (A.canonicalSpecs || []).find(x => (x.drink || x.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()) === name) === sp,
    };
    r.year = editionYear(sp, o, r.flagship);
    return r;
  };
  // A catalogue drink's edition is the book or bar its variant names ("Smuggler's Cove spec").
  const variantEdition = v => ((String(v || '').match(/^([^(,;]*?\bspec)\b/) || [])[1] || '').trim();
  const fromDrink = d => { const o = originOf(d); return { kind: 'drink', id: d.id, name: d.name, lines: asPoured(linesOf(d)), origin: o, credit: creditText(o), edition: variantEdition(d.variant), popularity: d.popularity, service: { method: d.method || null, ice: d.ice || null, vessel: d.vessel || null, garnish: d.garnish || [] }, year: editionYear({ variant: d.variant }, o, !d.variant), flagship: !d.variant }; };
  // Every proven spec a finished drink could turn out to be: the archetypes' canonical specs and
  // the catalogue's better-known drinks (a templated zero-proof spec is no classic).
  let refPool = null;
  const pool = () => refPool || (refPool = [
    ...archetypes.filter(a => a.id !== 'zero-proof-tiki').flatMap(a => (a.canonicalSpecs || []).map(sp => fromSpec(sp, a))),
    ...drinks.filter(d => d.popularity >= 2).map(fromDrink),
  ].filter(r => r.lines.length));

  // Identity cores (the archetypes' `cores`): what a classic cannot lose and still be poured
  // under its name. A Tortuga is both its overproofs, a Lava Flow its strawberry, a Jungle Bird
  // its pineapple, a Navy Grog its honey or allspice. A build without the core is never named,
  // stamped or credited as that drink; `otherwise` says what it is instead.
  const CORES = archetypes.flatMap(a => (a.cores || []).map(c => ({ ...c, key: normName(c.drink) })));
  const coreOf = name => { const n = ` ${normName(name)} `; return CORES.find(c => n.includes(` ${c.key} `)) || null; };
  function coreLost(name, lines) {
    const c = coreOf(name);
    if (!c) return null;
    const have = new Set(lines.filter(l => !l.garnish || l.muddled).map(l => l.id));
    const miss = c.needs.filter(n => n.anyOf.filter(id => have.has(id)).length < (n.count || 1));
    if (!miss.length) return null;
    const instead = c.otherwise ? Object.keys(c.otherwise).find(id => have.has(id)) : null;
    return { drink: c.drink, what: miss.map(n => n.what), otherwise: instead ? c.otherwise[instead] : null };
  }

  // The named reference a card anchors to: the drink the guest named; else the nearest proven
  // spec of this archetype or catalogue drink of its family (a strawberry colada is a Lava Flow,
  // not a Blue Hawaiian with its blue taken out). The spec the build started from wins a tie.
  // Rare bottles say more about which drink this is than lime and simple syrup do: each bottle is
  // weighted by how few proven specs pour it. A drink that lost a reference's identity core is
  // never anchored to it (a banana colada isn't "built on the Lava Flow").
  let idf = null;
  const rarity = id => {
    if (!idf) {
      const df = new Map();
      const all = pool();
      for (const r of all) for (const id0 of new Set(r.lines.filter(l => !l.garnish).map(l => l.id))) df.set(id0, (df.get(id0) || 0) + 1);
      idf = id0 => 1 + Math.log((all.length + 1) / (1 + (df.get(id0) || 0)));
    }
    return idf(id);
  };
  function referenceFor(lines, A, riffSrc, notes) {
    if (riffSrc) {
      const r = fromDrink(riffSrc);
      const lost = coreLost(r.name, lines);
      if (!lost) {
        // Praying again took another branch of the named drink (González's Jungle Bird, the Royal
        // Hawaiian's Mai Tai): that branch is the reference when it is the nearer one, so its own
        // bottles are never sold as a twist.
        const started = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
        const sp = started && (A.canonicalSpecs || []).find(x => x.name === started);
        const own = { ...r, similarity: copy.sameness(lines, r.lines) };
        if (sp) { const b = fromSpec(sp, A); b.similarity = copy.sameness(lines, b.lines); if (b.similarity > own.similarity) return b; }
        return own;
      }
      // The named drink without its core is the drink it became (a Jungle Bird with no pineapple
      // is Oertel's Bitter Mai Tai), and the card says so.
      return { ...referenceFor(lines, A, null, notes), coreLost: { ...lost, of: r.name } };
    }
    const startedFrom = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
    // The archetype's own proven specs come first; a family cousin from the catalogue has to be
    // clearly nearer to win (a sunrise is not "built on the Hurricane").
    // A catalogue drink another archetype owns (the Miami Vice, the Hurricane) is that
    // archetype's anchor, not this one's.
    const ownersOf = nm => ownerByName.get(normName(nm)) || null;
    const cands = [
      ...(A.canonicalSpecs || []).map(sp => ({ ...fromSpec(sp, A), bonus: sp.name === startedFrom ? 0.05 : 0.04 })),
      ...drinks.filter(d => d.family === A.family && (d.popularity >= 3 || originByName.has(normName(d.name))) && (!ownersOf(d.name) || ownersOf(d.name).has(A.id))).map(d => ({ ...fromDrink(d), bonus: 0 })),
    ].filter(c => c.lines.length);
    let best = null, lostFrom = null;
    for (const c of cands) {
      const score = copy.kinship(lines, c.lines, rarity) + c.bonus;
      const lost = coreLost(c.name, lines);
      if (lost) { if (!lostFrom || score > lostFrom.score) lostFrom = { lost, score }; continue; }
      if (!best || score > best.score) best = { ...c, score };
    }
    // The spec it started from lost its core and nothing else is near: the drink it is instead
    // ("Banana Colada"), credited to no one rather than to the drink it isn't.
    if (lostFrom && lostFrom.lost.otherwise && (!best || lostFrom.score > best.score + 0.1)) {
      const nm = lostFrom.lost.otherwise;
      const known = cands.find(c => normName(c.name) === normName(nm));
      if (known) best = { ...known, score: 0 };
    }
    // Said only when the drink it lost its core from was the nearer one.
    if (best) { if (lostFrom && lostFrom.score > best.score) best.coreLost = lostFrom.lost; best.similarity = copy.sameness(lines, best.lines); delete best.score; }
    return best || { kind: 'frame', name: A.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), lines: [], origin: A.origin || null, credit: creditText(A.origin), edition: '', similarity: 0, coreLost: lostFrom ? lostFrom.lost : null };
  }

  // ---------- the canon contract ----------
  // A card says one of three things about the canon, each in its own words:
  //  - as written: the lines, method, ice, vessel and required garnish of a named edition, with
  //    its date ("the Zombie, poured as written in 1934");
  //  - a house riff on X: X's lines at about 0.4 sameness or more, with every change listed,
  //    the method and the bitters included ("blended instead of shaken");
  //  - a cousin: no proven spec is close enough to name, so the card names only the family
  //    ("a cousin of the sunrise drinks").
  // Any twist or prayer move takes the canon stamp away. A vessel the prayer fixed is waived and
  // said ("in the coconut you asked for"); a batch for a bowl says the lines were batched.
  const METHOD_CLASS = { shake: 'shaken', 'flash-blend': 'shaken', blend: 'blended', stir: 'stirred', build: 'built', 'muddle-build': 'built', swizzle: 'swizzled', hot: 'hot' };
  const METHOD_SAID = { shaken: 'shaken', blended: 'blended', stirred: 'stirred', built: 'built in the glass', swizzled: 'swizzled', hot: 'served hot' };
  const VESSEL_CLASS = { coupe: 'up', 'nick-nora': 'up', 'cocktail-glass': 'up', rocks: 'short', dof: 'short', 'clay-cup': 'short', highball: 'tall', collins: 'tall', chimney: 'tall', 'footed-pilsner': 'pilsner', tulip: 'pilsner', 'pearl-diver': 'pilsner', hurricane: 'resort', 'poco-grande': 'resort', goblet: 'resort', snifter: 'resort', 'ku-mug': 'mug', 'moai-mug': 'mug', 'skull-mug': 'mug', 'barrel-mug': 'mug', 'fog-cutter-mug': 'mug', 'bird-mug': 'mug', 'scorpion-bowl': 'bowl', 'tiki-bowl': 'bowl', 'volcano-bowl': 'bowl', 'hot-mug': 'hot', 'irish-coffee': 'hot' };
  // (A vessel the library classes itself, data/vessels.json `class`, when the map doesn't name it.)
  const vesselClass = id => VESSEL_CLASS[id] || (vesselById[id] || {}).class || id || '';
  const servedAs = (method, ice, vid) => {
    const v = vesselById[vid];
    if (method === 'hot') return 'hot';
    if (method === 'blend' || ice === 'blended') return 'frozen';
    if (v && v.serve.includes('bowl')) return 'bowl';
    if (ice === 'ice-cone') return 'cone';
    // Shaken with shaved ice and strained into a coupe is still served up.
    if ((v && v.serve.includes('up') && !v.serve.includes('rocks') && !v.serve.includes('crushed')) || ice === 'none') return 'up';
    if (['crushed', 'shaved', 'pebble'].includes(ice)) return 'crushed';
    return 'rocks';
  };
  const SERVED_SAID = { up: 'served up', rocks: 'over ice', crushed: 'over crushed ice', cone: 'over an ice cone', frozen: 'frozen', hot: 'hot', bowl: 'in a bowl' };
  const anV = id => { const n = (vesselById[id] || {}).name || String(id).replace(/-/g, ' '); return `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`; };
  // How the service differs from the edition's: method, ice and vessel, then the garnish the
  // archetype requires. Each difference is { text, waived } (waived: the prayer fixed it).
  function serviceDiffs(ref, svc, vesselId, intent = {}, A = null, garnish = null) {
    const out = [];
    const rs = ref && ref.service;
    if (!rs || !rs.method || !svc) return out;
    const mA = METHOD_CLASS[svc.method] || svc.method, mR = METHOD_CLASS[rs.method] || rs.method;
    const sA = servedAs(svc.method, svc.ice, vesselId), sR = servedAs(rs.method, rs.ice, rs.vessel);
    const asked = !!intent.vessel && intent.vessel === vesselId;
    const bowl = !!(vesselById[vesselId] && vesselById[vesselId].serve.includes('bowl'));
    const batched = bowl && (intent.servings || 1) > 1 && !(vesselById[rs.vessel] && vesselById[rs.vessel].serve.includes('bowl'));
    const nm = (vesselById[vesselId] || {}).name || vesselId;
    // A batch for a bowl is built over its block, whatever the single drink's method: the lines
    // are the edition's, batched, and the card says so in those words.
    if (batched && mA !== mR && mA === 'built') out.push({ text: `batched over a block in the ${nm} instead of ${METHOD_SAID[mR] || mR}`, waived: false, batched, kind: 'method' });
    else if (mA !== mR) {
      const how = sA !== sR && !['frozen', 'hot', 'bowl'].includes(sA) && mA !== 'hot' ? `${METHOD_SAID[mA] || mA} and ${SERVED_SAID[sA]}` : METHOD_SAID[mA] || mA;
      out.push({ text: `${how} instead of ${METHOD_SAID[mR] || mR}`, waived: false, batched, kind: 'method' });
    } else if (sA !== sR && !(sA === 'bowl' && (asked || batched))) {
      out.push({ text: `${SERVED_SAID[sA]} rather than ${SERVED_SAID[sR]}`, waived: false, batched, kind: 'ice' });
    }
    if (rs.vessel && vesselId && vesselClass(vesselId) !== vesselClass(rs.vessel) && !(batched && out.some(d => d.kind === 'method' && d.batched && /batched/.test(d.text)))) {
      out.push({ text: asked ? `in the ${nm} you asked for` : batched ? `batched for the ${nm}` : `in ${anV(vesselId)} rather than ${anV(rs.vessel)}`, waived: asked || batched, batched, kind: 'vessel' });
    }
    // The garnish the archetype requires (a Queen's Park's mint, a Painkiller's nutmeg), when the
    // edition itself carries it.
    if (A && garnish) {
      const said = garnish.join(' ').toLowerCase(), spec = (rs.garnish || []).join(' ').toLowerCase();
      for (const g of ((A.garnish || {}).required || [])) {
        const word = (String(g).toLowerCase().match(/\b(mint|nutmeg|orchid|gardenia|cinnamon|lime shell|pineapple wedge|cherry|orange peel|lemon peel)\b/) || [])[1];
        if (word && spec.includes(word.split(' ')[0]) && !said.includes(word.split(' ')[0])) out.push({ text: `without its ${String(g).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim()}`, waived: false, kind: 'garnish' });
      }
    }
    return out;
  }
  // Dose changes a guest can taste on lines both share (a quarter ounce or more, and a fifth or
  // more of the pour), said with both measures.
  function doseDiffs(refLines, lines, said = []) {
    const agg = ls => { const m = new Map(); for (const l of ls) if ((!l.garnish || l.muddled) && !l.muddled) m.set(l.id, (m.get(l.id) || 0) + (l.oz || 0)); return m; };
    const R = agg(refLines), L = agg(lines), out = [];
    for (const [id, now] of L) {
      if (!R.has(id)) continue;
      const was = R.get(id);
      if (Math.abs(now - was) < 0.24 || Math.abs(now - was) < was * 0.2) continue;
      const nm = copy.say(id);
      if (said.some(t => t.includes(nm))) continue;
      out.push(`${now > was ? 'more' : 'less'} ${nm} (${fracStr(Math.round(now * 4) / 4)} oz, not ${fracStr(Math.round(was * 4) / 4)})`);
    }
    return out.slice(0, 3);
  }
  // A prayer that names a dish (bananas foster, key lime pie) is answered by a drink, never by a
  // classic stamped as the gods' own pour of it.
  const namesDish = intent => (intent.readings || []).some(r => !r.negated && (conceptById.get(r.concept) || {}).domain === 'food');
  function canonOf({ ref, lines, svc, vessel, garnish, mv, intent, A, classic }) {
    const kin = A.kin || `the ${A.noun || 'family'}`;
    const sim = classic ? 1 : ref ? ref.similarity || 0 : 0;
    if (!ref || ref.kind === 'frame' || !(ref.lines || []).length || sim < 0.4) return { state: 'cousin', of: null, kin, similarity: round(sim, 2), changes: [], service: [], waived: [], unsaid: [] };
    const svcD = serviceDiffs(ref, svc, vessel ? vessel.id : null, intent, A, garnish);
    const moves = (mv && mv.moves) || [];
    const moved = moves.filter(m => m.cause !== 'structure');
    const doses = classic ? [] : doseDiffs(ref.lines, lines, moves.map(m => m.text));
    const firm = svcD.filter(d => !d.waived), waived = svcD.filter(d => d.waived);
    const dish = !classic && !intent.riffOf && !intent.namedClassic && namesDish(intent);
    const asWritten = (classic || sim >= 0.95) && !moved.length && !firm.length && !doses.length && !(mv && mv.cousin) && !dish && !ref.coreLost;
    // Bitters and any change the card prints nowhere else (a structure move, a dose, the service).
    const printed = new Set(moved.map(m => m.text));
    const unsaid = [...firm.map(d => d.text), ...waived.map(d => d.text), ...moves.filter(m => m.cause === 'structure' && /\b(bitters|angostura)\b/i.test(m.text)).map(m => m.text).filter(t => !printed.has(t)), ...doses.slice(0, 2)];
    return {
      state: asWritten ? 'as-written' : 'house-riff', of: ref.name, edition: ref.edition || '', year: ref.year || null, kin, similarity: round(sim, 2),
      changes: [...moves.map(m => m.text), ...doses, ...svcD.map(d => d.text)], service: firm.map(d => d.text), waived: waived.map(d => d.text),
      batched: svcD.some(d => d.batched) && !moved.length, unsaid: [...new Set(unsaid)], dish, siblingOf: intent.siblingOf || null,
    };
  }
  // A drink 95% the same as a proven spec, served the way that edition serves it (method, ice and
  // vessel), is that drink, and the card says so. Lines alone don't make a classic: a shaken,
  // served-up "Daiquiri No. 4" is a daiquiri (the No. 4 is a frappé). A build that lost the
  // spec's identity core is never it.
  function exactClassic(lines, svc = null, vesselId = null, intent = {}) {
    let best = null;
    for (const c of pool()) {
      const s = copy.sameness(lines, c.lines);
      if (s < 0.95 || coreLost(c.name, lines)) continue;
      if (svc && serviceDiffs(c, svc, vesselId, intent).some(d => !d.waived)) continue;
      // Near-ties go to the drink's own edition (the 1946 Tortuga over a modern reading of it),
      // then to an archetype's spec over a catalogue record.
      const rank = x => (x.flagship !== false ? 0.02 : 0) + (x.kind === 'spec' ? 1e-6 : 0);
      if (!best || s + rank(c) > best.similarity + rank(best) + 1e-9) best = { ...c, similarity: s };
    }
    return best;
  }
  // The title a recognized classic is printed under: its own name for the edition that is the
  // drink, the edition's name for any other ("Zombie, the Smuggler's Cove way"), so two classics
  // in one evening never share a title.
  function classicTitle(c) {
    if (c.flagship !== false || !c.edition) return c.name;
    const m = /^(?:the )?(.+?) spec\b/i.exec(c.edition);
    return !m ? `${c.name}, ${c.edition}` : /'s$/.test(m[1]) ? `${c.name}, ${m[1]} way` : `${c.name}, the ${m[1]} way`;
  }
  function classicRecord(c) {
    const sp = c.fromArchetype;
    const name = sp ? (sp.drink || c.name) : c.name;
    const o = (sp && sp.origin) || originOf(sp ? name : c) || {};
    return { id: c.id, name, credit: creditText(o), edition: sp ? sp.edition || '' : '', origin: o, creator: o.who || c.creator || '', venue: c.venue || '', year: o.year || c.year || null, circa: !!c.circa, source: c.source || (sp && sp.source) || '', editionYear: sp ? editionYear(sp, o) : null };
  }
  // What the name generator needs to keep its words true of the build.
  const SPIRIT_NAME = { bourbon: 'Bourbon', rye: 'Rye', mezcal: 'Mezcal', 'tequila-blanco': 'Tequila', 'tequila-reposado': 'Reposado', gin: 'Gin', pisco: 'Pisco', 'rum-cachaca': 'Cachaça', 'rum-agricole-blanc': 'Agricole', 'rum-agricole-vieux': 'Agricole', 'scotch-islay': 'Islay', brandy: 'Brandy', vodka: 'Vodka', 'japanese-whisky': 'Whisky', aquavit: 'Aquavit', 'batavia-arrack': 'Arrack' };
  // The flame the steps will light (steps(): a flaming garnish, or fire asked for in a fire-safe
  // vessel over a crushed, frozen or bowl cap).
  const litBy = (garnish, intent, svc, vessel) => {
    const vid = vessel ? vessel.id : '';
    const heap = ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(svc.ice) || ['flash-blend', 'swizzle'].includes(svc.method);
    const bowl = !!(vessel && vessel.serve.includes('bowl'));
    return garnish.some(g => /flaming/.test(g)) || (!!intent.style.flaming && FIRE_VESSELS.has(vid) && (heap || svc.method === 'blend' || bowl) && svc.method !== 'hot');
  };
  // The cards an earlier seed of the same prayer served (set by generate()), so the next one's
  // name and tagline say something new.
  let copyPrior = [];
  function nameFacts({ lines, A, intent, svc, vessel, garnish, riffSrc, look = null, chem = null }) {
    const poured = lines.filter(l => !l.garnish || l.muddled);
    const ozOf = ids => poured.filter(l => ids.includes(l.id)).reduce((t, l) => t + (l.oz || 0), 0);
    const srcIds = riffSrc ? new Set(riffSrc.ingredients.map(l => l.id)) : null;
    const swapped = srcIds && poured.find(l => l.role === 'base' && !srcIds.has(l.id) && SPIRIT_NAME[l.id] && (intent.spirits.includes(l.id) || (intent.ings[l.id] || 0) >= 1));
    return {
      vessel: vessel ? vessel.id : '', bowl: !!(vessel && vessel.serve.includes('bowl')), method: svc.method, hot: svc.method === 'hot',
      // Lit only if the steps will light it: the flaming garnish, or the fire the steps add in a
      // fire-safe vessel over a crushed or frozen cap (see steps()); never intent alone.
      flaming: litBy(garnish, intent, svc, vessel),
      gtext: garnish.join(' ').toLowerCase(), lookText: look ? look.description || '' : '', sd: chem ? chem.alcMl / 17.74 : 0,
      showsWater: !!look && (showsColor(look, 'blue') || showsColor(look, 'green')),
      orangeOz: ozOf(['orange']), rumOz: ozOf(poured.filter(l => (ingMap.get(l.id) || {}).cat === 'rum' && !l.float).map(l => l.id)),
      priorNames: copyPrior.map(r => r.nickname || r.name),
      fizzy: ozOf(['soda-water', 'ginger-beer', 'ginger-ale', 'sparkling-wine', 'tonic', 'cola', 'grapefruit-soda', 'lemon-lime-soda']) >= 0.75,
      creamy: ozOf(['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream']) >= 0.5, smoky: poured.some(l => ['mezcal', 'scotch-islay', 'lapsang-tea'].includes(l.id)),
      prayer: intent.raw || '', classicNames, riffSpirit: swapped ? SPIRIT_NAME[swapped.id] : null, who: (A.origin || {}).who || '',
      blackBase: poured.some(l => ['rum-black-blended', 'rum-black-overproof'].includes(l.id) && !l.float && (l.oz || 0) >= 0.75),
    };
  }

  // Every word on the card, written last, from the finished drink: the named reference and its
  // credit, a real classic recognized by its real name, the net moves, the reading said back,
  // the tagline, the tasting note and the Why lines.
  function finishCopy(recipe, { A, intent, riffSrc, notes, lines, look, svc, garnish, classic, prompt }) {
    const vessel = recipe.vessel ? vesselById[recipe.vessel.id] : null;
    let ref = classic ? { ...(classic.fromArchetype ? fromSpec(classic.fromArchetype, A) : fromDrink(classic)), similarity: 1 } : referenceFor(lines, A, riffSrc, notes);
    // A riff on a drink the guest named keeps its riff name ("Bourbon Navy Grog"); a fresh
    // build that turns out to be a proven classic is printed as that classic.
    // A prayer that names a dish gets a drink for it, not another classic stamped in its place.
    if (!classic && !riffSrc && !namesDish(intent)) {
      const ex = exactClassic(lines, svc, vessel ? vessel.id : null, intent);
      if (ex) {
        if (normName(ex.name) !== normName(recipe.name)) recipe.nickname = recipe.name;
        recipe.name = classicTitle(ex);
        recipe.classic = { id: ex.id, name: recipe.name, drink: ex.name, credit: ex.credit, edition: ex.edition, origin: ex.origin, creator: (ex.origin || {}).who || '', venue: '', year: (ex.origin || {}).year || null, circa: false, source: '', recognized: true };
        ref = ex;
      }
    }
    if (classic) { recipe.classic.credit = ref.credit || recipe.classic.credit; recipe.name = recipe.classic.name; }
    recipe.reference = { kind: ref.kind, id: ref.id || null, name: ref.name, credit: ref.credit || '', edition: ref.edition || '', similarity: round(ref.similarity || 0, 2), year: (ref.origin || {}).year ?? null };
    const origin = ref.origin || A.origin || null;
    const perGuest = (intent.servings || 1) > 1;
    const facts = copy.drinkFacts({ lines, stats: recipe.stats, look, method: svc.method, ice: svc.ice, up: svc.up, vessel, garnish, archetype: A, prayer: prompt, concepts: intent.concepts, riffOf: riffSrc ? riffSrc.name : '', origin, servings: intent.servings || 1, steps: recipe.method.steps, polynesian: polynesianPrayer(prompt, intent.concepts), intent, reference: { name: ref.name, similarity: ref.similarity || 0 } });
    const same = classic || (recipe.classic && ref.similarity >= 0.999);
    const mv = same ? { moves: [], cousin: '', lost: [] } : copy.netMoves({ ref: ref.lines, lines, archetype: A, intent, notes, slotOf: id => composer.slotOf(A, id), refName: ref.name, refSim: ref.similarity || 0 });
    // The canon contract: as written, a house riff with every change listed, or a cousin.
    recipe.canon = canonOf({ ref, lines, svc, vessel, garnish, mv, intent, A, classic });
    if (ref.coreLost) recipe.canon.coreLost = ref.coreLost;
    if (recipe.check) recipe.check.canon = { state: recipe.canon.state, of: recipe.canon.of, changes: recipe.canon.changes };
    // A recognized classic that turns out not to be the edition as written (a move, a dose, the
    // service) keeps its house name; the card says what it's a riff on instead.
    if (recipe.classic && recipe.classic.recognized && recipe.canon.state !== 'as-written') { if (recipe.nickname) recipe.name = recipe.nickname; delete recipe.nickname; recipe.classic = null; }
    recipe.explanation.reading = readPrayer(intent, A, notes, recipe, { facts, ref, mv });
    const house = (origin || {}).house || null;
    if (recipe.classic) {
      const mood = (intent.taglineWords || []).find(m => copy.moodOk(m, facts) && !copyPrior.some(r => String(r.tagline || '').toLowerCase().includes(m.toLowerCase())));
      recipe.tagline = copy.classicTagline({ name: recipe.classic.name, credit: recipe.classic.credit, asWritten: recipe.canon.state === 'as-written', mood, facts });
    } else {
      recipe.tagline = copy.tagline({ lines, archetype: A, intent, riffOf: riffSrc ? riffSrc.name : null, riffIds: riffSrc ? riffSrc.ingredients.map(l => l.id) : null, look, stats: recipe.stats, method: svc.method, ice: svc.ice, garnish, rng: rngFrom(`${prompt}::${recipe.seed}::tag`), facts, cousin: mv.cousin ? `${ref.name} cousin` : null, prior: copyPrior.map(r => r.tagline) });
    }
    recipe.explanation.tasting = copy.tastingNote({ lines, stats: recipe.stats, archetype: A, look, method: svc.method, ice: svc.ice, garnish, intent, house, perGuest });
    recipe.explanation.whyItWorks = whyLines(recipe, A, intent, { ref, mv, house, perGuest });
    recipe.explanation.prayer = recipe.explanation.reading.heard.map(h => ({ phrase: h.phrase, reading: h.meaning }));
    const rd = recipe.explanation.reading;
    const kept = (recipe.explanation.lineage || []).filter(x => !/^(A riff on|Design moves:)/.test(x));
    recipe.explanation.lineage = [rd.builtOn.text, rd.moves.length ? `${cap(rd.moves.join('; '))}.` : '', ...kept].filter(Boolean).map(polish);
    // Bottle names keep their capitals inside the steps ("the dark Jamaican rum float"), and
    // whole fruit reads the way a recipe says it ("½ ripe banana", "2 strawberries").
    recipe.method.steps = recipe.method.steps.map(polish);
    // Lit only if a step lights it (the drawing and the name read this, never the wish alone).
    recipe.style.flaming = recipe.method.steps.some(x => /^Fire, last and carefully/.test(x)) || recipe.garnish.some(g => /flaming/.test(g));
    for (const l of recipe.lines) if (l.unit === 'piece') l.name = pieceName(l.id, l.name, l.amount);
    recipe.name = polish(recipe.name);
    if (recipe.nickname) recipe.nickname = polish(recipe.nickname);
  }

  // Why it works, the way a bartender would say it: what it's built on (the named reference and
  // who made it), what the prayer changed, at most one twist of the gods' own, what a missing
  // defining bottle makes it, one line of history, and its strength on the one scale.
  function whyLines(recipe, A, intent, { ref, mv, house, perGuest }) {
    const rd = recipe.explanation.reading;
    const out = [];
    const def = decap(firstSentences(rd.builtOn.definition || '', 1).replace(/\.$/, ''));
    const frame = (A.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const refText = refLabel(ref);
    // Only a bottle dropped outright is "without"; one swapped for another is a move, not a loss.
    // A bottle the reference can do without (its core's `spare`: a Lava Flow never needed its
    // banana) is never "missing".
    const spare = new Set((coreOf(ref.name || '') || {}).spare || []);
    const without = (mv.moves || []).filter(m => m.cause === 'structure' && m.id === null && m.replaced && !spare.has(m.replaced) && (ref.lines.find(l => l.id === m.replaced) || {}).oz >= 0.25).map(m => copy.say(m.replaced));
    out.push(`${canonWords(recipe, ref, { without }).why}: ${def || 'a proven classic'}.`);
    if (ref.coreLost) out.push(coreLine(ref));
    // Each move is credited to the word it serves ("For “bitter”: ¾ oz Campari added."), never to
    // every word in the prayer; a move no single word asked for is said plainly.
    const groups = new Map(), loose = [];
    for (const m of mv.moves.filter(x => x.cause === 'prayer').slice(0, 5)) {
      // The one heard word or reading the move serves best (the brunch's bubbles, not "low abv").
      const score = h => !h.credits ? 0 : m.id ? h.credits(m.id) : (m.replaced && h.word && h.word.negated ? copy.serves({ ...h.word, negated: false }, m.replaced) : 0) || ((/^less /.test(m.text) && /sweet|dry/.test((h.word || {}).label || '')) || (/^more /.test(m.text) && /tart/.test((h.word || {}).label || '')) ? 1 : 0);
      const ranked = rd.heard.map(h => ({ h, s: score(h) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
      const who = ranked.filter(x => x.s >= ranked[0]?.s - 0.01).slice(0, 2).map(x => `“${x.h.phrase}”`);
      if (!who.length) { loose.push(m.text); continue; }
      const k = list(who.slice(0, 2));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m.text);
    }
    for (const [k, ts] of groups) out.push(`For ${k}: ${ts.join('; ')}.`);
    if (loose.length) out.push(`${cap(loose.join('; '))}.`);
    const twist = mv.moves.find(m => m.cause === 'novelty');
    if (twist) out.push(`The twist: ${twist.text}.`);
    if (mv.cousin) out.push(`${cap(mv.cousin)}.`);
    const tree = familyTree(recipe, A, ref);
    if (tree) out.push(tree);
    out.push(strengthCopy(recipe.stats, { method: recipe.method.method, house, archetypeId: A.id, perGuest }).why);
    return out.map(polish);
  }
  const refLabel = ref => `${ref.name}${ref.credit || ref.edition ? ` (${[ref.credit, ref.edition].filter(Boolean).join('; ')})` : ''}`;
  // An archetype's definition, for the guest: its description, with the service it names made
  // true of this drink (a Jet Pilot in a skull mug isn't "in a double old fashioned"). Its rule
  // sentences ("Without both coconut and pineapple it is not a colada.") are for authors.
  const RULE = /\b(must|never|non-negotiable|should|is not a|it is not|isn'?t a|only good when|stays intact|which is why|it is never)\b/i;
  const defSentences = A => String(A.definition || '').split(/(?<=[.])\s+(?=[A-Z])/).filter(Boolean);
  const guestDefinition = (A, facts) => defSentences(A).filter(x => !RULE.test(x)).map(x => copy.trueService(x, facts)).join(' ');
  const ruleSentences = A => defSentences(A).filter(x => RULE.test(x)).join(' ');
  // The canon state in the card's own words (see canonOf): what "Built on" says, and the first
  // line of the Why. Never a stamp the drink doesn't earn, never a spec named below 0.4 sameness,
  // never "riff" on a drink that moved nothing.
  function canonWords(recipe, ref, opts = {}) {
    const w = canonWords0(recipe, ref, opts);
    // Praying again on a named drink brought its sibling: said, so the guest knows why.
    const sib = recipe.canon && recipe.canon.siblingOf;
    return sib ? { built: `${w.built}, a sibling of the ${sib} you named`, why: `${w.why}, a sibling of the ${sib} you named` } : w;
  }
  function canonWords0(recipe, ref, { without = [] } = {}) {
    const cn = recipe.canon || { state: 'cousin', kin: 'the tiki canon', unsaid: [], waived: [], service: [] };
    const refText = refLabel(ref);
    if (cn.state === 'cousin') return { built: `a cousin of ${cn.kin}`, why: `A cousin of ${cn.kin}` };
    const date = cn.year ? ` in ${cn.year}` : '';
    const asked = cn.waived.length ? `, ${list(cn.waived)}` : '';
    if (cn.state === 'as-written') {
      const named = recipe.classic && !recipe.classic.recognized;
      return { built: `the ${refText}, poured as written${date}${asked}${named ? ': you named it, so the gods poured it straight' : ''}`, why: `It's the ${refText}, poured as written${date}${asked}` };
    }
    const lost = without.length ? `, here without its ${list(without)}` : '';
    const credit = ref.credit || ref.edition ? ` (${[ref.credit, ref.edition].filter(Boolean).join('; ')})` : '';
    const linesOf = `the ${ref.name}'s lines${credit}`;
    // The edition's lines with only the service changed (batched for a bowl, poured for a dish
    // the guest named): no "riff", just what's different.
    const linesOnly = cn.batched || !cn.changes.some(c => !cn.service.includes(c) && !cn.waived.includes(c));
    const how = cn.unsaid.length ? `, ${list(cn.unsaid)}` : '';
    if (linesOnly) return { built: `${linesOf}${how}`, why: `${cap(linesOf)}${how}${lost}` };
    const unsaid = cn.unsaid.length ? `: ${list(cn.unsaid)}` : '';
    return { built: `a house riff on the ${refText}${unsaid}`, why: `A house riff on the ${refText}${lost}${unsaid}` };
  }
  // A named drink that lost its identity core says what it became.
  function coreLine(ref) {
    const c = ref.coreLost;
    const of = c.of || c.drink;
    return normName(of) !== normName(ref.name) ? `Without ${list(c.what)} it isn't ${/^[aeiou]/i.test(of) ? 'an' : 'a'} ${of}: it's the ${ref.name}.` : `Without ${list(c.what)} it isn't ${/^[aeiou]/i.test(of) ? 'an' : 'a'} ${of}.`;
  }
  // "The family tree runs back to X" only when X is older than the drink on the card, and both
  // dates are known; a root centuries younger is a modern cousin (the Bombo's Kingston Negroni).
  function familyTree(recipe, A, ref) {
    const o = A.origin;
    if (!o || !o.text || recipe.classic || o.text === ref.credit) return '';
    const cousin = recipe.canon && recipe.canon.state === 'cousin';
    if (!cousin && normName(o.drink) === normName(ref.name)) return '';
    const mine = cousin ? null : (ref.origin || {}).year || null;
    if (!o.year) return '';
    if (!mine || o.year < mine) return `The family tree runs back to the ${o.drink} (${o.text}).`;
    if (o.year - mine >= 50) return `Its modern cousin is the ${o.drink} (${o.text}).`;
    return '';
  }

  // How the gods heard you: what each part of the prayer meant (a reading said back only if this
  // drink keeps its promises, else what was poured for it), what the drink is built on, what
  // the prayer changed, any twist of the gods' own, and anything they didn't catch.
  function readPrayer(intent, A, notes, recipe, { facts, ref, mv }) {
    // Each phrase once, quoted as the guest typed it ("Havana 1957"), in the reading's own voice;
    // a word inside a phrase already heard ("bananas" in "bananas foster", "beach" in "at the
    // beach") is part of that reading, not a line of its own; a word is answered with what was
    // poured for it, never echoed ("coffee" → coffee).
    const heard = [];
    const seenPhrase = new Set();
    const words = p => normName(p).split(' ').filter(Boolean);
    const inside = p => heard.some(h => { const w = words(h.key); const v = words(p); return v.every(x => w.some(y => y === x || y.startsWith(x) || x.startsWith(y))); });
    const quote = x => x.said || rawSpan(intent.raw || '', x.phrase);
    for (const r of intent.readings) {
      if (seenPhrase.has(r.phrase)) continue;
      seenPhrase.add(r.phrase);
      const label = r.concept.replace(/-/g, ' ');
      heard.push({ key: r.phrase, phrase: quote(r), concept: r.concept, meaning: r.negated ? `not ${label}` : r.reading ? copy.hear(r.reading, conceptById.get(r.concept), facts) : label });
    }
    for (const m of intent.matched) {
      if (seenPhrase.has(m.phrase) || (m.kind === 'concept')) continue;
      seenPhrase.add(m.phrase);
      if (inside(m.phrase)) continue;
      heard.push({ key: m.phrase, phrase: quote(m), word: m, meaning: copy.answer(m, facts) });
    }
    for (const h of heard) h.credits = id => h.word ? copy.serves(h.word, id) : copy.serves({ kind: 'concept' }, id, conceptById.get(h.concept));
    // The canon contract in the guest's own words: a drink named and poured as written is no riff.
    if (recipe.canon && recipe.canon.state === 'as-written') for (const h of heard) if (h.word && h.word.kind === 'riff' && /^riff on\b/i.test(h.meaning)) h.meaning = `the ${recipe.canon.of}, poured as written`;
    const frame = (A.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const refText = refLabel(ref);
    void refText;
    const base = canonWords(recipe, ref).built;
    const moves = mv.moves.filter(m => m.cause === 'prayer').map(m => m.text);
    const twist = mv.moves.find(m => m.cause === 'novelty');
    if (twist) moves.push(`the twist: ${twist.text}`);
    if (mv.cousin) moves.push(mv.cousin);
    const waived = (recipe.check && recipe.check.waived) || [];
    return {
      heard,
      builtOn: { archetype: frame, definition: guestDefinition(A, facts), rules: ruleSentences(A), spec: ref.name || null, text: polish(`Built on ${base}.`) },
      moves: [...new Set(moves)].slice(0, 6).map(polish),
      waived: waived.length ? `You ruled out the ${waived.join(' and ')}, so this is a cousin of the ${frame} rather than the real thing.` : '',
      unheard: intent.unheard || [],
    };
  }

  function targetsForArchetype(A, famId, intent, svc) {
    const base = targetsFor(famId, intent, svc.method, svc.ice);
    const r = A.ratios || {};
    if (r.abvAfterDilution && !intent.style.zeroProof) {
      const [lo, hi] = r.abvAfterDilution;
      const mid = (lo + hi) / 2 + (intent.strength || 0) * (hi - lo) / 4;
      base.abv = mid; base.abvBand = [Math.max(lo, mid - (hi - lo) / 3), Math.min(hi, mid + (hi - lo) / 3)];
    }
    if (r.sugarToAcid && base.acid) {
      const [lo, hi] = r.sugarToAcid;
      const ratio = (lo + hi) / 2 * (1 + 0.12 * (intent.sweetness || 0) - 0.1 * (intent.tartness || 0));
      base.sugar = base.acid * Math.max(lo * 0.85, Math.min(hi * 1.15, ratio));
    }
    return base;
  }

  // ---------- garnish ----------
  // The card's garnish comes from a controlled vocabulary: concrete things a bartender puts on a
  // drink and the drawing can show (web/lib/artspec.js reads the same phrases). Each entry says
  // what it competes with (one mint, one cherry, one flower, one dust...), which poured
  // ingredient a fruit garnish needs to tell the truth (`fruit`), what refusing it sounds like
  // (`tags`), and where it can go: `up` fits a stemmed glass (a rim wheel, a peel, a pick, a
  // dust), `hot` fits a hot drink, `aroma` is smelled on every sip, `heap` needs a crushed-ice
  // dome, `only` names the archetypes it belongs to. Without `fruit` it is decorative: cherries,
  // umbrellas, mint, flowers and spice need no matching bottle.
  const ORANGE_OIL = ['orange', 'orange-curacao', 'triple-sec', 'blue-curacao', 'orange-bitters'];
  const LIME = ['lime', 'lime-cordial'], PINE = ['pineapple-juice', 'rum-pineapple', 'pineapple-syrup'];
  const GV = {
    'mint sprig': { keys: ['mint'], tags: ['mint'], aroma: 1 },
    'mint bouquet': { keys: ['mint'], tags: ['mint'], aroma: 1, heap: 1 },
    'basil sprig': { keys: ['herb'], fruit: ['basil'], tags: ['basil'], aroma: 1 },
    'freshly grated nutmeg': { keys: ['dust'], tags: ['nutmeg'], aroma: 1, up: 1, hot: 1 },
    'heavy nutmeg cap': { keys: ['dust'], tags: ['nutmeg'], aroma: 1, hot: 1, only: ['painkiller'] },
    'a dusting of cinnamon': { keys: ['dust'], tags: ['cinnamon'], aroma: 1, up: 1, hot: 1 },
    'grated chocolate': { keys: ['dust'], fruit: ['creme-de-cacao', 'white-creme-de-cacao'], tags: ['chocolate'], up: 1, hot: 1 },
    'toasted coconut flakes': { keys: ['dust'], fruit: ['coconut-cream', 'coconut-milk', 'coconut-water', 'coconut-rum'], tags: ['coconut'], up: 1 },
    'cinnamon stick': { keys: ['cinnamon'], tags: ['cinnamon'], aroma: 1, hot: 1 },
    'expressed orange peel': { keys: ['orange'], fruit: ORANGE_OIL, tags: ['orange'], aroma: 1, up: 1, hot: 1 },
    'expressed lemon peel': { keys: ['lemon'], fruit: ['lemon'], tags: ['lemon'], aroma: 1, up: 1, hot: 1 },
    'expressed lime peel': { keys: ['lime'], fruit: LIME, tags: ['lime'], aroma: 1, up: 1 },
    'grapefruit twist': { keys: ['grapefruit'], fruit: ['grapefruit', 'dons-mix', 'grapefruit-soda'], tags: ['grapefruit'], aroma: 1, up: 1 },
    'long orange-peel spiral': { keys: ['orange'], fruit: ORANGE_OIL, tags: ['orange'], aroma: 1, clear: 1 },
    'clove-studded lemon wheel': { keys: ['lemon'], fruit: ['lemon'], tags: ['lemon', 'clove'], aroma: 1, hot: 1, hotOnly: 1 },
    'clove-studded orange peel': { keys: ['orange'], fruit: ORANGE_OIL, tags: ['orange', 'clove'], aroma: 1, hot: 1, hotOnly: 1 },
    'lemon-peel ring around a cherry': { keys: ['lemon', 'cherry'], fruit: ['lemon'], tags: ['lemon', 'cherry'], aroma: 1, up: 1 },
    'spent lime shell': { keys: ['lime'], fruit: ['lime'], tags: ['lime'], aroma: 1 },
    'flaming lime shell': { keys: ['lime', 'fire'], fruit: ['lime'], tags: ['lime'], fire: 1 },
    'lime wheel': { keys: ['lime'], fruit: LIME, tags: ['lime'], up: 1 },
    'lime wedge': { keys: ['lime'], fruit: LIME, tags: ['lime'] },
    'lime coin in the glass': { keys: ['lime'], fruit: ['lime'], tags: ['lime'], only: ['ti-punch'] },
    'lime wedges in the glass': { keys: ['lime'], fruit: ['lime'], tags: ['lime'], only: ['caipirinha'] },
    'lemon wheel': { keys: ['lemon'], fruit: ['lemon'], tags: ['lemon'], up: 1 },
    'orange wheel': { keys: ['orange'], fruit: ['orange'], tags: ['orange'], up: 1 },
    // One raft of floating wheels on a punch bowl, of one fruit.
    'lime wheels floating': { keys: ['lime', 'raft'], fruit: LIME, tags: ['lime'] },
    'lemon wheels floating': { keys: ['lemon', 'raft'], fruit: ['lemon'], tags: ['lemon'] },
    'orange wheels floating': { keys: ['orange', 'raft'], fruit: ['orange'], tags: ['orange'] },
    'orange slice and cherry flag': { keys: ['orange', 'cherry'], fruit: ['orange'], tags: ['orange', 'cherry'] },
    'pineapple wedge': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple wedge and fronds': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple frond': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple spear': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple chunk and cherry on a pick': { keys: ['pineapple', 'cherry'], fruit: PINE, tags: ['pineapple', 'cherry'], up: 1 },
    'banana coin on a pick': { keys: ['banana'], fruit: ['banana', 'banana-liqueur'], tags: ['banana'], up: 1 },
    // Bananas Foster's own: a banana coin, sugared and torched, dusted with cinnamon.
    'brûléed banana coin on a pick': { keys: ['banana'], fruit: ['banana', 'banana-liqueur'], tags: ['banana'], up: 1 },
    'strawberry on the rim': { keys: ['strawberry'], fruit: ['strawberry'], tags: ['strawberry'], up: 1 },
    'passion fruit half': { keys: ['passion'], fruit: ['passion-fruit-juice', 'passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola'], tags: ['passion-fruit'] },
    'mango slice': { keys: ['mango'], fruit: ['mango-nectar'], tags: ['mango'], up: 1 },
    'cucumber ribbon': { keys: ['cucumber'], fruit: ['cucumber'], tags: ['cucumber'] },
    'candied ginger on a pick': { keys: ['ginger'], fruit: ['ginger-beer', 'ginger-ale', 'ginger-syrup', 'ginger-liqueur', 'ginger-fresh'], tags: ['ginger'], up: 1 },
    'three coffee beans': { keys: ['coffee'], fruit: ['coffee', 'coffee-liqueur'], tags: ['coffee'], up: 1, hot: 1 },
    // Decorative: no bottle needed, but never one the guest refused.
    'cherry on a pick': { keys: ['cherry'], tags: ['cherry'], up: 1 },
    cherry: { keys: ['cherry'], tags: ['cherry'] },
    // The Morse pick (· · · —) is the Three Dots' identity; Don's pineapple chunk is decorative there.
    'three cherries and a pineapple chunk on a pick': { keys: ['cherry', 'pineapple'], tags: ['cherry', 'pineapple'], up: 1, only: ['beachcomber-spice-sour'] },
    'paper umbrella': { keys: ['umbrella'] },
    orchid: { keys: ['flower'], flower: 1 },
    gardenia: { keys: ['flower'], tags: ['floral'], flower: 1 },
    // The tiare is Tahiti's own gardenia (Gardenia taitensis).
    'tiare gardenia': { keys: ['flower'], tags: ['floral'], flower: 1 },
    // A small edible flower floats on an up drink as well as on ice.
    'edible flower': { keys: ['flower'], tags: ['floral'], flower: 1, up: 1 },
    'swizzle stick left in': { keys: ['stick'] },
    'stir stick': { keys: ['stick'] },
    'sugar-cane stick': { keys: ['stick'], only: ['hawaiian-mai-tai'] },
    'bamboo back-scratcher': { keys: ['stick'], only: ['tropical-itch'] },
    'whipped cream': { keys: ['cream'], only: ['bushwacker'] },
    'pineapple crown lid': { keys: ['lid'], tags: ['pineapple'] },
    // Service the card names: the Navy Grog's cone, the Beachcomber's Gold shell, a bowl's straws.
    'straw through the ice cone': { keys: ['cone'], service: 1 },
    'shaved-ice shell lining the glass': { keys: ['shell-ice'], up: 1 },
  };
  // Free text (research notes, prayer ideas) read into the vocabulary, first match wins.
  // A function resolves against the drink: "citrus twist" becomes the peel of a citrus that's in it.
  const READ = [
    [/three cherr|morse|three dots/, 'three cherries and a pineapple chunk on a pick'],
    [/flaming|crater/, 'flaming lime shell'],
    [/ice cone|cone of/, 'straw through the ice cone'],
    [/ice shell|lined with|lining the/, 'shaved-ice shell lining the glass'],
    [/crown lid|hollowed pineapple/, 'pineapple crown lid'],
    [/back-?scratcher/, 'bamboo back-scratcher'],
    [/spiral|horse'?s neck|peel snake/, 'long orange-peel spiral'],
    [/ring around a cherry|saturn|lemon-peel ring/, 'lemon-peel ring around a cherry'],
    [/clove/, s => (/lemon/.test(s) ? 'clove-studded lemon wheel' : 'clove-studded orange peel')],
    [/lime (half[- ]?)?shell|spent (lime )?(half[- ]?)?shell|lime hull/, 'spent lime shell'],
    [/\bflag\b|orange (wheel|slice|half[- ]?wheel)\b.*cherr|cherr.*orange (wheel|slice)/, 'orange slice and cherry flag'],
    [/mint (bouquet|bunch|crown|sprigs)|bouquet|big .*mint/, 'mint bouquet'],
    [/mint/, 'mint sprig'],
    [/basil/, 'basil sprig'],
    [/pineapple (stick|chunk|cube).*cherr|cherr.*pineapple (stick|chunk)/, 'pineapple chunk and cherry on a pick'],
    [/pineapple (wedge|slice|crescent).*frond/, 'pineapple wedge and fronds'],
    [/pineapple (wedge|slice|crescent)|^(a )?pineapple$/, 'pineapple wedge'],
    [/pineapple (frond|leaf|leaves|crown)/, 'pineapple frond'],
    [/pineapple (spear|stick|chunk)/, 'pineapple spear'],
    [/nutmeg/, 'freshly grated nutmeg'],
    [/cinnamon (stick|quill)/, 'cinnamon stick'],
    [/cinnamon/, 'a dusting of cinnamon'],
    [/chocolate|cocoa/, 'grated chocolate'],
    [/coconut/, 'toasted coconut flakes'],
    [/tiare/, 'tiare gardenia'],
    [/gardenia/, 'gardenia'],
    [/orchid|dendrobium/, 'orchid'],
    [/edible flower|hibiscus flower|plumeria|\bflowers?\b|petal|borage|viola/, 'edible flower'],
    [/umbrella|parasol/, 'paper umbrella'],
    [/swizzle stick|bois l/, 'swizzle stick left in'],
    [/stir stick|stirrer/, 'stir stick'],
    [/sugar[- ]?cane/, 'sugar-cane stick'],
    [/whipped cream/, 'whipped cream'],
    [/coffee bean/, 'three coffee beans'],
    [/candied ginger|ginger coin/, 'candied ginger on a pick'],
    [/br[uû]l[eé]e|caramel+i[sz]ed banana|foster/, 'brûléed banana coin on a pick'],
    [/banana/, 'banana coin on a pick'],
    [/strawberr/, 'strawberry on the rim'],
    [/passion/, 'passion fruit half'],
    [/mango/, 'mango slice'],
    [/cucumber/, 'cucumber ribbon'],
    [/lime coin/, 'lime coin in the glass'],
    [/lime wedges? (stay|in the glass|muddled)/, 'lime wedges in the glass'],
    [/lime (wheel|slice|disc)|dehydrated lime/, 'lime wheel'],
    [/(orange|lemon|lime|grapefruit|citrus)( zest)? (twist|peel|zest)|twist|expressed|\bpeel\b|\bzest\b/, (s, has) => {
      const named = ['orange', 'lemon', 'lime', 'grapefruit'].filter(c => s.includes(c));
      const PEEL = { orange: 'expressed orange peel', lemon: 'expressed lemon peel', lime: 'expressed lime peel', grapefruit: 'grapefruit twist' };
      // "citrus twist": the peel of a citrus that is in the drink
      const c = named.find(x => GV[PEEL[x]].fruit.some(has)) || named[0] || ['orange', 'lemon', 'lime', 'grapefruit'].find(x => GV[PEEL[x]].fruit.some(has)) || 'orange';
      return PEEL[c];
    }],
    [/lime (wedge|crescent)|^(a )?lime$/, 'lime wedge'],
    [/lemon (wheel|slice)s?/, 'lemon wheel'],
    [/orange (wheel|slice|half[- ]?wheel|half)|^(an )?orange$/, 'orange wheel'],
    [/grapefruit/, 'grapefruit twist'],
    [/cherr/, 'cherry on a pick'],
  ];
  // Never on a card: rims, ice blocks (the steps handle ice), novelties, "none", vague fruit.
  const NOT_GARNISH = /\b(none|no garnish|seasonal|salt|salted rim|sugar rim|sugared|crumb|li hing|glitter|monkey|napkin|glow|gummy|lantern|envelope|skull|foil|lei)\b|cinnamon[- ](sugar )?rim|ice (block|cube)|block of ice|large .*ice/;
  // Research notes read like "citrus twist (orange or lime), expressed", "grated nutmeg or an
  // Angostura top" or "pineapple stick + cherry (Honi Honi)"; each becomes plain vocabulary
  // phrases: the first alternative that reads, every part of a combination. Placeholders resolve
  // to real things: "the named fruit" to the fruit that's poured, "full tiki garnish" to a mint
  // bouquet, an orchid and a frond fan (each still checked against the glass).
  function cleanGarnish(t, has = () => false) {
    const s = String(t || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || NOT_GARNISH.test(s)) return [];
    if (/full tiki/.test(s)) return ['mint bouquet', 'orchid', 'pineapple frond'];
    if (/the (named )?fruit|named fruit/.test(s)) {
      const named = [[['banana', 'banana-liqueur'], 'banana coin on a pick'], [['strawberry'], 'strawberry on the rim'], [GV['passion fruit half'].fruit, 'passion fruit half'], [['mango-nectar'], 'mango slice'], [PINE, 'pineapple wedge']].find(([ids]) => ids.some(has));
      return named ? [named[1]] : [];
    }
    const read = x => { const hit = READ.find(([re]) => re.test(x)); return hit ? (typeof hit[1] === 'function' ? hit[1](x, has) : hit[1]) : null; };
    // A combination the vocabulary names whole (a flag, the Morse pick, a wedge with its fronds).
    const whole = read(s);
    if (whole && /(\band\b|\+)/.test(s) && /and|on a pick/.test(whole)) return [whole];
    for (const alt of s.split(/\s+or\s+|\s*\/\s*/)) {
      const got = alt.split(/\s*(?:,|\+|;|:|\band\b)\s*/).map(read).filter(Boolean);
      if (got.length) return [...new Set(got)];
    }
    return [];
  }
  // The family conventions (technique.md §4.2), in vocabulary words. `never` is matched as words.
  const GARNISH_RULES = {
    'mai-tai': { required: ['spent lime shell', 'mint sprig'], never: ['cherry', 'flag', 'umbrella'] },
    zombie: { required: ['mint sprig'], typical: ['cherry on a pick', 'pineapple frond'], never: ['umbrella', 'whipped cream'] },
    grog: { typical: ['spent lime shell', 'mint sprig'], never: ['umbrella', 'orchid', 'flag'] },
    'beachcomber-sour': { typical: ['mint sprig', 'cherry on a pick', 'gardenia'], never: ['umbrella', 'cream'] },
    swizzle: { required: ['mint sprig'], typical: ['swizzle stick left in'], never: ['umbrella', 'flag', 'cherry'] },
    daiquiri: { typical: ['lime wheel', 'grapefruit twist'], never: ['bouquet', 'umbrella', 'pineapple wedge'] },
    'orgeat-punch': { typical: ['gardenia', 'orchid', 'mint sprig'], never: ['whipped cream'] },
    colada: { required: ['pineapple wedge'], typical: ['cherry on a pick', 'paper umbrella', 'orchid'], never: ['bouquet', 'swizzle'] },
    'resort-punch': { typical: ['paper umbrella', 'orchid', 'pineapple wedge', 'cherry on a pick', 'orange wheel'] },
    punch: { typical: ['freshly grated nutmeg', 'lime wheel', 'mint sprig', 'orange wheel'] },
    buck: { required: ['lime wheel'], typical: ['candied ginger on a pick', 'mint sprig'], never: ['umbrella', 'nutmeg', 'cherry'] },
    'bitter-tiki': { typical: ['pineapple wedge and fronds', 'orchid', 'mint sprig'], never: ['whipped cream', 'nutmeg'] },
    stirred: { required: ['expressed orange peel'], typical: ['cherry on a pick'], never: ['mint', 'umbrella'] },
    hot: { required: ['freshly grated nutmeg'], typical: ['cinnamon stick', 'clove-studded lemon wheel'], never: ['umbrella', 'mint', 'pineapple', 'lime', 'cherry', 'orchid'] },
  };
  // The signature serves (presentation.md §2.1): the canonical garnish of a classic, in order.
  // Each item is still checked against the glass (no frond on a Zombie without pineapple).
  function canonicalGarnish(A, has) {
    switch (A.id) {
      case 'mai-tai': return ['spent lime shell', 'mint sprig'];
      case 'navy-grog': return ['straw through the ice cone', 'mint sprig', 'spent lime shell'];
      case 'painkiller': return ['heavy nutmeg cap', 'orange wheel', 'cherry'];
      case 'trinidad-swizzle': return ['mint sprig', 'swizzle stick left in'];
      case 'zombie': return ['mint sprig', 'pineapple frond', 'cherry on a pick'];
      // Three Dots and a Dash spells V in cherries and pineapple; the Nui Nui gets its long spiral.
      case 'beachcomber-spice-sour': return has('cinnamon-syrup') || has('dons-spices-2') ? ['long orange-peel spiral', 'mint sprig'] : ['three cherries and a pineapple chunk on a pick', 'mint sprig'];
      // Vic's Scorpion is "bedecked with gardenias"; the flame is optional theater in the steps.
      case 'scorpion': case 'scorpion-bowl': return ['gardenia', 'mint sprig'];
      // The crater burns: nothing leafy rings it, the flame is the garnish.
      case 'volcano-bowl': return ['flaming lime shell'];
      // The flag needs orange in the glass; Berry's lemon-and-passion Hurricane gets a lemon wheel.
      case 'hurricane': return has('orange') ? ['orange slice and cherry flag'] : ['lemon wheel', 'paper umbrella', 'cherry on a pick'];
      case 'hot-buttered-rum': return ['cinnamon stick', 'freshly grated nutmeg'];
      case 'tom-and-jerry': return ['freshly grated nutmeg'];
      case 'hot-grog': return ['clove-studded lemon wheel', 'cinnamon stick', 'freshly grated nutmeg'];
      case 'hot-rum-punch': return ['expressed lemon peel', 'freshly grated nutmeg'];
      default: return null;
    }
  }
  // Prayers that ask for restraint get one garnish: elegance, precision, a first date.
  const RESTRAINED = new Set(['sophisticated', 'first-date', 'boss-client', 'minimalist', 'japan-tokyo', 'robot', 'bamboo', 'cuba-havana']);
  // Fire needs a wide, fire-safe vessel: a bowl or a wide mug, never a narrow glass or a coupe.
  // Unasked, only the Volcano Bowl's crater burns (it is named for the flame).
  const FIRE_VESSELS = new Set(['ku-mug', 'moai-mug', 'skull-mug', 'barrel-mug', 'fog-cutter-mug', 'tiki-bowl', 'volcano-bowl', 'scorpion-bowl', 'coconut', 'pineapple', 'snifter', 'goblet']);
  const FIRE_BOWLS = new Set(['volcano-bowl', 'tiki-bowl', 'scorpion-bowl']);
  const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const numberWord = k => NUMBER[k] || String(k);
  // Garnish, the way the research says an aficionado wants it: aroma first, then one moment of
  // theater, and it never lies. Candidates: the classic's own garnish, or the archetype's and the
  // family's required ones; the aromatics the drink is built around; the prayer's ideas; then
  // the typical ones. Every candidate is a vocabulary phrase checked against the glass, the
  // guest's refusals and the service, and the count fits it: an up drink holds exactly one rim,
  // peel, pick or dust; rocks one; crushed-ice tiki up to three with one aromatic; a shared
  // bowl up to four including a straw per guest; hot drinks spice and peel; a restrained prayer one.
  // Garnish the reading or the name promises: a flower for a floral prayer, the tiare (Tahiti's
  // gardenia) for Tahiti, the brûléed banana of a Bananas Foster, an orchid on a drink named for one.
  const CONCEPT_GARNISH = { tahiti: 'tiare gardenia', 'bananas-foster': 'brûléed banana coin on a pick', 'tropical-flowers': 'orchid', 'pearl-anniversary': 'gardenia' };
  function garnishPromises(intent, name = '') {
    const out = [];
    for (const c of intent.concepts || []) if (CONCEPT_GARNISH[c]) out.push(CONCEPT_GARNISH[c]);
    if ((intent.tags.floral || 0) - ((intent.conceptTags || {}).floral || 0) >= 1.5) out.push('edible flower');
    const n = String(name || '').toLowerCase();
    if (/\borchid/.test(n)) out.push('orchid');
    if (/\b(gardenia|tiare)/.test(n)) out.push('gardenia');
    if (/\b(sakura|blossom|blooming|bloom|flower|petal)/.test(n)) out.push('edible flower');
    return [...new Set(out)];
  }
  function chooseGarnish(A, intent, lines, flavorTop, svc, vessel, { rng = null, promised = [] } = {}) {
    const g = A.garnish || {};
    const fam = GARNISH_RULES[A.family] || {};
    const poured = new Set(lines.filter(l => !l.garnish || l.muddled || l.role === 'aromatic').map(l => l.id));
    const has = id => poured.has(id);
    const vid = vessel ? vessel.id : '';
    const n = intent.servings > 1 ? intent.servings : 1;
    const bowl = !!(vessel && vessel.serve.includes('bowl'));
    const punchBowl = vid === 'punch-bowl';
    const upGlass = !!svc.up || !!(vessel && vessel.serve.includes('up'));
    const heaped = ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(svc.ice) || ['flash-blend', 'swizzle'].includes(svc.method);
    const frozen = svc.method === 'blend' || svc.ice === 'blended';
    const service = upGlass ? 'up' : svc.method === 'hot' ? 'hot' : bowl ? 'bowl' : ['coconut', 'pineapple'].includes(vid) ? 'fruit-vessel'
      : frozen ? 'frozen' : heaped ? 'crushed' : vessel && vessel.kind !== 'glass' ? 'mug' : vessel && vessel.capacity >= 10 && !['dof', 'rocks'].includes(vid) ? 'tall' : 'rocks';
    const restrained = (intent.concepts || []).some(c => RESTRAINED.has(c));
    const straws = bowl && !punchBowl && n > 1 ? `${numberWord(n)} long straws` : null;
    const max = (restrained ? 1 : { up: 1, rocks: 1, crushed: 3, frozen: 3, tall: 3, mug: 3, 'fruit-vessel': 3, bowl: 4, hot: 2 }[service]) - (straws && !restrained ? 1 : 0);
    const never = [...(g.never || []), ...(fam.never || [])].map(x => x.toLowerCase().replace(/\s*\(.*?\)/g, '').trim());
    // Refused: the guest said no to what it is ("no pineapple" rules out the frond too).
    const CITRUS = ['lime', 'lemon', 'orange', 'grapefruit'];
    const refused = E => [...(E.tags || []), ...(E.keys.some(k => CITRUS.includes(k)) ? ['citrus'] : [])].some(t => (intent.avoidTags[t] || 0) >= 1)
      || !!(E.fruit && intent.avoidIngs.has(E.fruit[0]));
    const rich = lines.some(l => ['coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'vanilla-ice-cream', 'egg-white', 'whole-egg', 'banana', 'irish-cream'].includes(l.id));
    const opaque = OPAQUE_VESSELS.has(vid) || (vessel && vessel.kind !== 'glass');
    // Fire: asked for, or the Volcano Bowl's own crater; on a crushed or frozen cap in a vessel that can take it.
    const fireSafe = FIRE_VESSELS.has(vid) && !never.some(x => /fire|flam/.test(x)) && (heaped || frozen || bowl) && service !== 'hot';
    const fireOk = fireSafe && (intent.style.flaming || (A.id === 'volcano-bowl' && FIRE_BOWLS.has(vid)));
    const sink = lines.some(l => l.sink);
    const ok = x => {
      const E = GV[x];
      if (!E || refused(E)) return false;
      if (E.only && !E.only.includes(A.id)) return false;
      if (never.some(w => w && (x.includes(w) || (!w.includes(' ') && x.split(/[\s-]/).includes(w))))) return false;
      // Truth: a fruit garnish shows only fruit that is poured. An expressed orange peel on a
      // stirred drink is the classic seasoning itself (its oil is the point), not a promise.
      if (E.fruit && !E.fruit.some(has) && !(A.family === 'stirred' && x === 'expressed orange peel')) return false;
      if (service === 'up') { if (!E.up || (/nutmeg|cinnamon/.test(x) && !rich)) return false; }
      if (service === 'hot' ? !E.hot : E.hotOnly) return false;
      if (E.heap && !['crushed', 'frozen', 'bowl', 'fruit-vessel'].includes(service)) return false;
      if (E.clear && opaque) return false;
      if (E.fire && !fireOk) return false;
      if (x === 'paper umbrella' && (['rocks', 'hot', 'up'].includes(service) || svc.method === 'stir')) return false;
      if (x === 'straw through the ice cone' && svc.ice !== 'ice-cone') return false;
      if (x === 'shaved-ice shell lining the glass' && !(upGlass && svc.ice === 'shaved')) return false;
      if (x === 'pineapple crown lid' && vid !== 'pineapple') return false;
      if (x === 'swizzle stick left in' && svc.method !== 'swizzle' && A.id !== 'ti-punch') return false;
      if (x === 'stir stick' && !sink) return false;
      // A ladled punch bowl takes what floats or dusts: no picks, rims, sticks or straws.
      if (punchBowl && !(/floating|nutmeg|dusting|grated|toasted|mint|orchid|gardenia|edible flower|back-scratcher/.test(x))) return false;
      return true;
    };
    const out = [], kept = new Set();
    const counted = () => out.filter(x => !GV[x].service).length;
    const add = (x, keep = false) => {
      if (punchBowl && /^(lime|lemon|orange) wheel$/.test(x)) x = `${x}s floating`;
      if (!ok(x) || out.includes(x) || out.some(o => GV[o].keys.some(k => GV[x].keys.includes(k)))) return;
      if (!GV[x].service && counted() >= max) return;
      out.push(x);
      if (keep) kept.add(x);
    };
    const addAll = (list, keep) => { for (const t of list) for (const x of cleanGarnish(t, has)) add(x, keep); };
    if (svc.ice === 'ice-cone') add('straw through the ice cone', true);
    const canon = canonicalGarnish(A, has);
    if (canon) for (const x of canon) add(x, true);
    // A promise takes the place of what it competes with (the brûléed banana for the plain
    // banana coin) or of the last thing that isn't the drink's own, and is kept.
    const promise = x => {
      if (!ok(x) || out.includes(x)) return;
      const rival = out.findIndex(o => GV[o].keys.some(k => GV[x].keys.includes(k)));
      if (rival >= 0) { if (canon && canon.includes(out[rival])) return; out.splice(rival, 1); }
      if (!GV[x].service && counted() >= max) {
        const drop = [...out].reverse().find(o => !GV[o].service && !kept.has(o));
        if (!drop) return;
        out.splice(out.indexOf(drop), 1);
      }
      add(x, true);
    };
    for (const x of [...garnishPromises(intent), ...promised]) promise(x);
    if (!canon) addAll([...(g.required || []), ...(fam.required || [])], true);
    // Aromatics the drink is built around (mint on a Mai Tai, nutmeg on a Painkiller).
    const AROMA_WORD = { mint: 'mint sprig', nutmeg: 'freshly grated nutmeg', cinnamon: 'cinnamon stick', basil: 'basil sprig', cucumber: 'cucumber ribbon', clove: 'clove-studded lemon wheel' };
    // Mint poured into the drink, against a sprig the archetype merely likes on top.
    const pouredMint = lines.some(l => l.id === 'mint' && (l.muddled || !l.garnish));
    const mintRequired = [...(g.required || []), ...(fam.required || [])].some(t => /\bmint\b/i.test(t));
    if (!canon) for (const l of lines) if (l.role === 'aromatic' && !l.muddled && AROMA_WORD[l.id] && (l.id !== 'mint' || mintRequired)) add(AROMA_WORD[l.id]);
    if (fireOk) add('flaming lime shell', true);
    // The prayer's own ideas, except on a hot classic: its spice is the whole point.
    // A concept's mint is filler unless the prayer is about mint or mint is poured: the aromatic
    // below is chosen for the drink instead.
    if (!(canon && service === 'hot')) addAll((intent.garnishIdeas || []).filter(t => !/\bmint\b/i.test(t) || pouredMint || (intent.tags.mint || 0) >= 0.8));
    // The archetype's typical garnishes, taken in turn from a point the pour picks, so a battery
    // of the same frame doesn't wear the same thing every time.
    if (!canon) {
      const typ = [...(g.typical || []), ...(fam.typical || [])];
      const at = rng && typ.length ? Math.floor(rng() * typ.length) : 0;
      // Mint among them is the aromatic's job (below), chosen for the drink.
      addAll([...typ.slice(at), ...typ.slice(0, at)].filter(t => !/\bmint\b/i.test(t) || pouredMint));
    }
    if (!counted()) addAll(garnishFor(A.family, intent, lines, flavorTop));
    // Crushed-ice tiki carries one aromatic, next to the straw where the nose goes: the one the
    // drink is built for (the peel of its citrus, nutmeg on a spiced or creamy drink, mint where
    // mint is poured or the family wears it), not mint by reflex.
    const spiced = lines.some(l => ['allspice-dram', 'cinnamon-syrup', 'velvet-falernum', 'nutmeg', 'dons-spices-2', 'pimento-dram', 'angostura'].includes(l.id));
    const fitAroma = {
      'mint sprig': (pouredMint ? 3 : (A.aromatics || []).includes('mint') ? 0.6 : 0) + (['swizzle', 'mai-tai', 'zombie', 'grog'].includes(A.family) ? 0.6 : 0) + 0.2,
      'grapefruit twist': ['grapefruit', 'dons-mix', 'grapefruit-soda'].some(has) ? 1.3 : 0,
      'expressed orange peel': ORANGE_OIL.some(has) ? 1.1 : 0,
      'expressed lemon peel': has('lemon') ? 1.0 : 0,
      'expressed lime peel': has('lime') ? 0.6 : 0,
      'freshly grated nutmeg': (spiced ? 0.9 : 0) + (rich ? 0.8 : 0),
    };
    const aromas = Object.keys(fitAroma).map(a => ({ a, s: fitAroma[a] + (rng ? rng() * 0.6 : 0) })).sort((x, y) => y.s - x.s).map(x => x.a);
    // (A coconut or a pineapple packed with crushed ice is a crushed-ice drink too.)
    if ((['crushed', 'bowl'].includes(service) || (service === 'fruit-vessel' && heaped)) && !punchBowl && max > 1 && !out.some(x => GV[x].aroma)) {
      for (const a of aromas) {
        if (!ok(a)) continue;
        // full: make room by dropping the last thing that isn't the archetype's own
        const drop = counted() >= max ? [...out].reverse().find(x => !GV[x].service && !kept.has(x)) || [...out].reverse().find(x => !GV[x].service) : null;
        const at = drop ? out.indexOf(drop) : -1;
        if (drop) out.splice(at, 1);
        const before = out.length;
        add(a);
        if (out.length > before) break;
        if (drop) out.splice(at, 0, drop);
      }
    }
    // Nothing that burns near the flame: no umbrella or flower within reach, no mint bouquet; and
    // round a burning crater (a fire bowl) nothing leafy at all: an expressed peel instead.
    if (out.includes('flaming lime shell') || (fireSafe && intent.style.flaming)) {
      for (const x of [...out]) if (x === 'paper umbrella' || GV[x].flower) out.splice(out.indexOf(x), 1);
      if (out.includes('mint bouquet')) out.splice(out.indexOf('mint bouquet'), 1, 'mint sprig');
      if (FIRE_BOWLS.has(vid) && out.includes('mint sprig')) {
        out.splice(out.indexOf('mint sprig'), 1);
        for (const a of aromas.filter(a => a !== 'mint sprig')) { const before = out.length; add(a); if (out.length > before) break; }
      }
    }
    // A stemmed glass always gets its one small thing.
    if (service === 'up' && !counted()) for (const x of ['lime wheel', 'lemon wheel', 'orange wheel', 'expressed orange peel', 'expressed lemon peel', 'grapefruit twist', 'cherry on a pick']) add(x);
    if (straws) out.push(straws);
    return out;
  }

  function tagline(recipe, intent) {
    const fam = famById[recipe.family.id];
    const fl = recipe.flavor.slice(0, 3).map(t => t.replace('-', ' '));
    const strength = recipe.stats.abv >= 18 ? 'potent' : recipe.stats.abv <= 9 ? 'easygoing' : '';
    const bits = [strength, fl.join(', ')].filter(Boolean).join(', ');
    const famWord = { punch: 'punch', grog: 'grog', daiquiri: 'sour', swizzle: 'swizzle', zombie: 'Beachcomber-style heavyweight', 'beachcomber-sour': 'spiced tropical sour', 'mai-tai': 'Mai Tai cousin', 'orgeat-punch': 'orgeat punch', colada: 'colada', buck: 'highball', 'resort-punch': 'tropical punch', 'bitter-tiki': 'bitter tiki sour', stirred: 'spirit-forward sipper', hot: 'hot drink' }[fam.id];
    const phrase = `${bits ? bits + ' ' : ''}${famWord}${intent.style.zeroProof ? ', zero-proof' : ''}`;
    return `${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}.`;
  }

  function pickMetrics(m) {
    const pick = q => q ? { p25: q.p25, median: q.median, p75: q.p75 } : null;
    return { abv: pick(m.abv), sugarConc: pick(m.sugarConc), acidConc: pick(m.acidConc), sweetSour: pick(m.sweetSour), volOz: pick(m.volOz) };
  }

  function describeDrink(id) {
    const d = drinkById[id];
    if (!d) return null;
    const nb = neighbors(drinkVec[id], { exclude: new Set([id]), n: 5 });
    const children = drinks.filter(x => (x.parent_ids || []).includes(id)).map(x => x.id);
    return {
      drink: d,
      facts: model.drinks[id],
      family: famById[d.family],
      parents: (d.parent_ids || []).map(p => drinkById[p]).filter(Boolean),
      children: children.map(c => drinkById[c]),
      neighbors: nb.map(x => ({ ...drinkById[x.id], similarity: round(x.s, 2) })),
      lines: d.ingredients.map(l => ({ ...l, name: ingMap.has(l.id) ? displayName(l.id) : l.id })),
    };
  }

  // How every archetype scores for a prayer, best first (for review tooling and tests).
  const scoreArchetypes = prompt => {
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
    return archetypes.map(a => composer.scoreArchetype(a, intent, ctx)).map(x => ({ id: x.a.id, s: x.s, why: x.why })).sort((a, b) => b.s - a.s);
  };
  // Whether a prayer names a frame itself (a drink, a family word, a concept's answer, a reading
  // that names one of its classics): such a frame is the prayer's own, not a battery's habit.
  const namesFrame = (prompt, id) => {
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
    const a = composer.byId[id];
    if (!a) return false;
    if (intent.riffOf && drinkById[intent.riffOf] && (archetypeForDrink(drinkById[intent.riffOf]) || {}).id === id) return true;
    const text = ` ${prompt.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ')} `;
    const hit = classicIndex.find(c => text.includes(` ${c.key} `));
    if (hit) intent.namedClassic = hit;
    return namedFrame(a, intent);
  };
  return { scoreArchetypes, generate, describeDrink, namesFrame, parse: p => parsePrompt(p, { nameIndex, concepts: conceptIndex }), ingMap, famById, drinkById, archetypes, composer, archetypeForDrink };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
function firstSentences(text, n) {
  const parts = (text || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return parts.slice(0, n).join('').trim();
}

export { amountString };
