// Tiki drink generator. Everything it knows comes from the database (data/drinks.json)
// via the statistics in data/model.json; this file turns a prompt into a balanced recipe
// and explains where each choice came from.
import { indexIngredients, analyzeLines, lineOz, roleOf, round } from './chem.js';
import { flavorVector, normalize, cosine, lineImpact, tagWeights } from './flavor.js';
import { parsePrompt, buildNameIndex, indexConcepts } from './prompt.js';
import { snap, amountString, pieceName } from './format.js';
import { makeName, polynesianPrayer } from './names.js';
import { serviceOf, SERVICE_FITS } from './vessels.js';
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

  function chemOf(lines, method, ice) {
    return analyzeLines(lines.map(l => ({ id: l.id, amount: l.oz, unit: 'oz', garnish: l.role === 'aromatic' })), ingMap, units, { method, ice });
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
    const sweetAll = live.filter(l => l.role === 'sweet' && I(l).sugar >= 20 && !l.sink && !l.float);
    const sweetening = live.filter(l => !l.sink && !l.float && l.role !== 'base' && I(l).sugar >= 20 && (l.role === 'sweet' || l.role === 'rich' || l.role === 'modifier'));
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
        const floor = l.role === 'sour' ? 0.25 : stirred ? 1 / 12 : 0.25;
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
    gold: { id: 'passion-fruit-syrup', oz: 0.5 }, orange: { id: 'orange', oz: 1 }, dark: { id: 'rum-black-blended', oz: 0.5, float: true },
    green: { id: 'melon-liqueur', oz: 0.75 }, purple: { id: 'creme-de-violette', oz: 0.5 },
  };
  function colorPass(lines, A, intent, svc, notes) {
    const color = intent.color;
    if (!COLOR_TEST[color]) return true;
    const lookOf = L => { const c = chemOf(L, svc.method, svc.ice); return drinkLook(L, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: c.finalOz - c.volOz }); };
    if (showsColor(lookOf(lines), color)) return true;
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
    // A dark float over a light color is mud on top: drop it.
    for (const l of lines.filter(l => (l.float || l.sink) && !l.req && !isCarrier(l.id) && !['dark', 'red', 'pink'].includes(color))) {
      tries.push({ why: `no ${prose(l.id)} ${l.float ? 'float' : 'sink'}, so the color stays true`, edit: L => { const x = L[lines.indexOf(l)]; if (x) x.drop = true; }, muddy: true });
    }
    const lr = LAST_RESORT[color];
    if (lr && ok(lr.id) && !lines.some(x => x.id === lr.id)) {
      tries.push({ why: lr.sink ? `${prose(lr.id)} sunk to the bottom for the color` : lr.float ? `a ${prose(lr.id)} float for the color` : `${prose(lr.id)} for the color`, edit: L => { L.push({ id: lr.id, role: ingMap.get(lr.id).role, oz: lr.oz, sink: !!lr.sink, float: !!lr.float, req: true, slot: 'color' }); } });
    }
    if (typeof process !== "undefined" && process.env && process.env.DEBUG_COLOR) console.log("colorPass", color, lines.map(l => `${l.id}${l.req ? "*" : ""}:${l.slot}`).join(" "), "tries:", tries.map(t => t.why).join(" / "));
    const clone = () => lines.map(l => ({ ...l }));
    // Single moves first, then a muddy fix paired with each color move.
    const plans = [...tries.filter(t => !t.muddy).map(t => [t]), ...tries.filter(t => t.muddy).flatMap(m => [[m], ...tries.filter(t => !t.muddy).map(t => [m, t])])];
    for (const plan of plans) {
      let L = clone();
      plan.forEach(t => t.edit(L));
      L = L.filter(x => !x.drop);
      finalizeAmounts(L);
      if (showsColor(lookOf(L), color)) {
        lines.splice(0, lines.length, ...L);
        plan.forEach(t => notes.push(t.why));
        return true;
      }
    }
    notes.push(`couldn't make it ${color} without wrecking it`);
    return false;
  }

  // A color the prayer only leans toward (a dragon leans red, a promotion gold, a floral prayer
  // pink) is a preference, never a demand: the same moves as colorPass, judged softly. A move
  // stays only if the drink gets visibly closer to the leaning, keeps its balance, its strength,
  // its size and its frame; otherwise the drink is poured as built. Carriers are real bottles of
  // that color (passion fruit and mango for gold, grenadine and hibiscus for red, guava and
  // pitaya for pink, violette for purple), never a loud blue or green the prayer didn't ask for.
  const LEAN_CARRIERS = {
    gold: ['passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-juice', 'passion-fruit-liqueur', 'mango-nectar', 'pineapple-juice', 'pineapple-syrup', 'galliano', 'yellow-chartreuse', 'licor-43', 'banana-liqueur', 'honey-syrup'],
    orange: ['passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-juice', 'passion-fruit-liqueur', 'mango-nectar', 'apricot-nectar', 'papaya-nectar', 'orange', 'aperol', 'apricot-liqueur', 'guava-nectar'],
    red: ['grenadine', 'hibiscus-syrup', 'raspberry-syrup', 'fassionola', 'strawberry', 'pomegranate-juice', 'cranberry-juice', 'campari', 'cherry-heering', 'raspberry-liqueur', 'sloe-gin', 'watermelon-juice'],
    pink: ['guava-syrup', 'guava-nectar', 'hibiscus-syrup', 'raspberry-syrup', 'pitaya-puree', 'strawberry', 'watermelon-juice', 'grenadine', 'li-hing-mui-syrup'],
    purple: ['creme-de-violette', 'butterfly-pea-tea', 'blackberry-liqueur', 'creme-de-cassis'],
    green: ['melon-liqueur', 'green-chartreuse', 'lime-cordial'],
    blue: ['blue-curacao', 'butterfly-pea-tea'],
  };
  // The hue, saturation and lightness each leaning aims at.
  const LEAN_AIM = { gold: [50, 0.85, 0.6], orange: [28, 0.85, 0.58], red: [356, 0.72, 0.45], pink: [340, 0.65, 0.68], purple: [285, 0.45, 0.5], green: [100, 0.5, 0.55], blue: [200, 0.6, 0.55] };
  const LEAN_WHY = { gold: 'for a golden glow', orange: 'for a sunset-orange glow', red: 'for a ruby blush', pink: 'for a pink blush', purple: 'for a violet tint', green: 'for a green glint', blue: 'for a blue glint' };
  // A leaning from the prayer's own moods when no concept gave one: a floral prayer leans pink,
  // a berry one red, a tropical one gold.
  function hueLean(intent, open = null) {
    if (intent.colorLean) return LEAN_AIM[intent.colorLean] ? intent.colorLean : null;
    // "Surprise me" is an invitation: the gods pick a color too.
    if (open) { const pal = ['pink', 'gold', 'red', 'orange']; return pal[Math.floor(open() * pal.length)]; }
    const t = intent.tags || {};
    const w = (...ks) => Math.max(0, ...ks.map(k => t[k] || 0));
    // Only moods lean: a fruit the guest named (passion fruit, cherry) is poured anyway and brings its own color.
    const cands = [['pink', w('floral') * 0.9], ['red', w('berry')], ['gold', w('tropical') * 0.85]].filter(x => x[1] >= 0.75).sort((a, b) => b[1] - a[1]);
    return cands.length ? cands[0][0] : null;
  }
  function ownLean(lines, A) {
    let best = null, bw = 0;
    for (const l of lines) {
      if (l.garnish || l.float || l.sink || l.crown) continue;
      for (const lean of ['gold', 'orange', 'red', 'pink']) {
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
        } else if (role === 'juice' && mainJuice && !stirredish && fits(id, lines)) {
          const oz = Math.min(1, Math.max(0.5, Math.round(mainJuice.oz / 3 * 4) / 4));
          tries.push({ on: mainJuice, id, cost: 0.03, why: `${oz} oz of the ${prose(mainJuice.id)} traded for ${prose(id)}, ${why}`, edit: L => { const x = L[lines.indexOf(mainJuice)]; if (!x) return; x.oz -= oz; if (x.range) x.range = [Math.min(x.range[0], x.oz), x.range[1]]; L.push({ id, role, oz, oz0: oz, slot: 'color', range: null }); } });
        } else if (role === 'modifier' && fits(id, lines) && !(ingMap.get(id).color === 'blue' || ingMap.get(id).color === 'green') && !stirredish
          // A liqueur joins only a drink it belongs in (no Galliano in a Mai Tai).
          && compat(id, lines.filter(l => !l.garnish).map(l => l.id)) >= 0.15 && intentMatch(id, intent) >= 0) {
          tries.push({ on: 'modifier', id, cost: 0.06, why: `½ oz of ${prose(id)} ${why}`, edit: L => { L.push({ id, role, oz: 0.5, oz0: 0.5, slot: 'color', range: null }); } });
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
      if (['red', 'pink'].includes(lean) && !['hot', 'blend'].includes(svc.method) && !lines.some(l => l.sink)) {
        for (const id of ['grenadine', 'hibiscus-syrup']) if (ok(id) && fits(id, lines)) {
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
    const W = famWin(A.family).sugarToAcid, maxN = Math.min(famWin(A.family).maxComponents || 11, 11);
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
      const rej = err(ratio(L)) > Math.max(0.12, e0 + 0.04) && !mended || out > out0 + 0.01 ? 'balance'
        : count(L) > Math.max(maxN, count(lines)) ? 'too many bottles'
        // A Zombie or a Mai Tai that reads red is grenadine abuse.
        : ['zombie', 'mai-tai'].includes(A.family) && (COLOR_TEST.red(body) || COLOR_TEST.pink(body)) ? 'red zombie'
        : !intent.style.zeroProof && c.abv < c0.abv * 0.85 ? 'abv' : c.volOz > c0.volOz * 1.15 + 0.25 ? 'volume'
        : !composer.satisfies(A, L, intent.ings, id => forbidden(id, intent)).ok ? 'frame' : null;
      const s = leanScore(look, lean) + plan.reduce((a, t) => a + t.cost, 0) + (plan.length - 1) * 0.05;
      if (DBG) console.log(`  lean ${lean} ${A.id}: ${plan.map(t => t.why).join(' + ')} ${rej || ''} ${s.toFixed(2)} vs ${s0.toFixed(2)} ${look.body.hex}`);
      if (plan.length === 1) tried.set(plan[0], { s, rej });
      if (rej) continue;
      if (s < s0 - 0.045 && (!best || s < best.s)) best = { s, L, plan };
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
  function gentle(lines, A, intent, svc, notes) {
    const T = 6.8;
    let c = chemOf(lines, svc.method, svc.ice);
    if (c.abv <= T) return;
    for (const l of lines) if (l.role === 'lengthener' && (ingMap.get(l.id).abv || 0) > 0 && l.oz > 2) l.oz = 2;
    for (const l of lines) if (l.role === 'modifier' && (ingMap.get(l.id).abv || 0) >= 15 && l.oz > 0.5) l.oz = Math.max(0.5, l.oz * 0.6);
    c = chemOf(lines, svc.method, svc.ice);
    const bases = lines.filter(l => l.role === 'base' && !l.float && !l.sink);
    for (let i = 0; i < 12 && c.abv > T; i++) {
      const total = bases.reduce((t, l) => t + l.oz, 0);
      if (total <= 0.8) break;
      for (const b of bases) b.oz = Math.max(bases.length > 1 ? 0.5 : 0.75, b.oz * 0.9);
      c = chemOf(lines, svc.method, svc.ice);
    }
    if (c.abv > T && !['hot', 'stir'].includes(svc.method)) {
      let top = svc.method !== 'blend' && lines.find(l => l.role === 'lengthener' && !(ingMap.get(l.id).abv > 0) && !l.float && !l.sink)
        || lines.filter(l => l.role === 'juice' && !l.sink && !l.float).sort((x, y) => y.oz - x.oz)[0];
      if (!top && svc.method !== 'blend' && !forbidden('soda-water', intent)) { top = { id: 'soda-water', role: 'lengthener', oz: 1, slot: 'top', req: true }; lines.push(top); }
      for (let i = 0; top && i < 10 && c.abv > T; i++) { top.oz += 0.5; c = chemOf(lines, svc.method, svc.ice); }
    }
    notes.push(`kept gentle: about ${Math.round(c.abv)}% ABV`);
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
  function structure(lines, A, intent, notes) {
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
    // A batter already is the butter and the sugar.
    const batter = lines.find(l => ['hot-buttered-rum-batter', 'tom-and-jerry-batter'].includes(l.id));
    if (batter) for (const l of lines.filter(l => l.id === 'butter' || PLAIN.has(l.id))) { lines.splice(lines.indexOf(l), 1); batter.oz = Math.min(1, batter.oz + l.oz * 0.5); notes.push(`no separate ${prose(l.id)}: the batter is the butter and the sugar`); }
    // One overproof in the body; a second is the same job twice.
    const hot = body().filter(l => OVER(l.id));
    for (const l of hot.slice(1).filter(l => !asked(l))) fold(l, hot[0], `one overproof (${prose(hot[0].id)}), not two`);
    // Three spirits at most: Don layered three rums, never five.
    while (body().length > 3) {
      const b = body().sort((x, y) => x.oz - y.oz);
      const victim = b.find(l => !asked(l) && !sole(l));
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
    // A float is a float: a half-ounce of overproof, three-quarters of anything else. The
    // Dark 'n Stormy's cloud is its whole pour of black rum, never an overproof one.
    for (const l of lines.filter(l => l.float && l.role === 'base')) {
      if (A.id === 'dark-n-stormy') {
        if (OVER(l.id) && !asked(l) && ingMap.has('rum-black-blended') && !forbidden('rum-black-blended', intent)) { notes.push(`black rum, not ${prose(l.id)}, for the cloud`); l.id = 'rum-black-blended'; }
        continue;
      }
      const cap = OVER(l.id) ? 0.5 : 0.75;
      if (l.oz > cap) {
        const lead = body().sort((x, y) => y.oz - x.oz)[0];
        if (lead && !OVER(l.id)) lead.oz += l.oz - cap;
        l.oz = cap; l.oz0 = cap;
      }
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
      const cap = party ? 1.75 : bowlCup ? 2 : zombieLine ? Math.max(3, (B || [])[1] || 3) : Math.min(3, Math.max(2.5, (B || [])[1] || 2.5));
      const total = body().reduce((t, l) => t + l.oz, 0);
      if (total > cap + 0.05) { const k = cap / total; for (const l of body()) l.oz *= k; }
    }
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
    // A stirred drink takes its syrup by the barspoon: half an ounce at most.
    if (A.family === 'stirred' || svc.method === 'stir') for (const l of live().filter(l => l.role === 'sweet' && l.oz > 0.5 && !asked(l))) l.oz = 0.5;
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
      if (asked(l) || l.req || l.twist || sole(l) || (l.role === 'sweet' && !kin)) { l.oz = floor; continue; }
      if (kin && PLAIN.has(l.id) && (l.role === 'sweet' || l.role === 'sour')) { kin.oz += l.oz; lines.splice(lines.indexOf(l), 1); continue; }
      lines.splice(lines.indexOf(l), 1);
      notes.push(`left out the ${prose(l.id)}: too little to taste`);
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
  function service(famId, intent, lines, src = null) {
    const fam = famById[famId];
    const F = model.families[famId];
    let method = src ? src.method : Object.keys(F.methods || {})[0] || fam.method;
    let ice = src ? src.ice : Object.keys(F.ice || {})[0] || fam.ice;
    let glass = src && src.glass ? src.glass : fam.glass;
    if (method === 'hot') ice = 'none';
    if (intent.style.frozen) { method = 'blend'; ice = 'blended'; glass = 'hurricane or tall tiki glass'; }
    if (intent.style.hot) { method = 'hot'; ice = 'none'; glass = 'preheated mug'; }
    if (intent.style.stirred && famId !== 'stirred') { method = 'stir'; ice = 'block'; glass = 'double old fashioned'; }
    const hasLong = lines.some(l => l.role === 'lengthener' && !['hot-water', 'coffee', 'black-tea'].includes(l.id));
    if (hasLong && method === 'shake' && famId !== 'grog' && !src) glass = 'highball or collins';
    if (intent.style.bowl) glass = `punch bowl with ${intent.servings > 1 ? intent.servings : 'several'} long straws`;
    return { method, ice, glass };
  }

  // ---------- vessel ----------
  // Every drink gets one specific vessel. Asked-for beats riff source beats the family's habits;
  // the vessel must take the drink's service (up, rocks, crushed, frozen, hot, bowl) and hold it.
  const CONF = { high: 3, medium: 2, low: 1 };
  const OPAQUE_VESSELS = new Set(['ku-mug', 'moai-mug', 'skull-mug', 'barrel-mug', 'fog-cutter-mug', 'bird-mug', 'coconut', 'pineapple', 'clay-cup', 'hot-mug', 'enamel-tin', 'copper-mug', 'julep-cup', 'tiki-bowl', 'volcano-bowl', 'scorpion-bowl']);
  function chooseVessel(famId, intent, svc, chem, src, rng, greedy, A = null, layers = []) {
    if (!vesselList.length) return null;
    const service = serviceOf(svc.method, svc.ice);
    const servings = intent.servings || 1;
    const bowl = (!!intent.style.bowl && servings >= 2) || servings >= 3;
    // A punch bowl is for a crowd; the tiki, volcano and Scorpion bowls are for two to six.
    const bowlFor = v => v.id === 'punch-bowl' ? servings >= 6 : servings <= 6;
    // A swizzle stick needs straight sides to spin: no pinched hurricane, no stem, no snifter.
    const swizzleOk = v => svc.method !== 'swizzle' || ['collins', 'highball', 'footed-pilsner', 'julep-cup', 'dof', 'chimney'].includes(v.id);
    const takes = v => (v.serve.includes('bowl') ? bowl && bowlFor(v) : !bowl && SERVICE_FITS[service].some(x => v.serve.includes(x))) && swizzleOk(v);
    const needFor = v => {
      const base = chem.finalOz * (bowl ? servings : 1);
      if (service === 'crushed') return base * 1.5;
      if (service === 'frozen') return base * 1.1;
      return v.serve.includes('up') && service === 'shaken' ? base : service === 'hot' ? base : base * 1.35;
    };
    const fitOf = v => {
      const r = needFor(v) / v.capacity;
      // A drink with no ice in it (up, hot) needs room at the rim; ice can mound above it.
      const noIce = service === 'hot' || (v.serve.includes('up') && service === 'shaken');
      if (noIce && r > 0.95) return 0;
      // The research's fill ranges (liquid before ice) are the measure where we have them: a
      // Zombie's six ounces belong in a chimney. The finished drink still has to fit: a blended
      // drink is its ice, and on crushed ice the liquid sits between the chips.
      const range = fillRange(v.id);
      const fin = chem.finalOz * (bowl ? servings : 1);
      if (!v.serve.includes('bowl') && fin * (service === 'frozen' ? 1.05 : service === 'crushed' ? 0.9 : 1.2) > v.capacity * (service === 'crushed' ? 1 : 1.05)) return 0;
      if (range) {
        const vol = chem.volOz * (bowl ? servings : 1);
        if (vol > range[1] * 1.12) return 0;
        return vol >= range[0] ? 1 : Math.pow(vol / range[0], 3);
      }
      if (v.serve.includes('bowl')) return r > 1.12 ? 0 : 1;
      if (r > 1.12) return 0;
      return r >= 0.5 ? 1 : Math.pow(r / 0.5, 1.5);
    };
    const asked = intent.vessel && vesselById[intent.vessel];
    if (asked) return { v: asked, why: 'asked' };
    // A color, a sink, a float or a crown has to be seen: no opaque mug, tin or shell for it.
    const showy = !!(intent.color || intent.style.layered || (layers || []).length);
    // A riff keeps its source's vessel, or failing that the vessel of another spec of the same
    // drink that suits this serving (a single Scorpion rather than the bowl).
    if (src && famId === src.family) {
      const sameName = drinks.filter(d => d.name === src.name && d.vessel).sort((a, b) => (b.popularity - a.popularity) || ((CONF[b.confidence] || 0) - (CONF[a.confidence] || 0)));
      for (const d of [src, ...sameName]) {
        const v = vesselById[d.vessel];
        if (v && takes(v) && fitOf(v) && !(showy && OPAQUE_VESSELS.has(v.id))) return { v, why: 'riff' };
      }
    }
    const F = (model.families[famId] || {}).vessels || {};
    // The archetype's own glassware first (a Hemingway goes up in a coupe, never in a rocks
    // glass); anything else only if none of its vessels can take this service and size.
    const own = A && A.vessels && A.vessels.length ? new Set(A.vessels) : null;
    if (own && svc.wantUp) for (const id of ['coupe', 'nick-nora']) own.add(id);
    const pool = vesselList.filter(v => takes(v) && fitOf(v) && !(showy && OPAQUE_VESSELS.has(v.id)));
    const ownPool = own ? pool.filter(v => own.has(v.id)) : [];
    // Nothing holds it: the biggest vessel of the right kind, and the drink is scaled to fit.
    const biggest = () => { const t = vesselList.filter(v => takes(v) && (!own || own.has(v.id))); const u = t.length ? t : vesselList.filter(takes); return u.length ? [u.sort((a, b) => b.capacity - a.capacity)[0]] : []; };
    const candidates = ownPool.length ? ownPool : pool.length ? pool : vesselList.filter(v => takes(v) && fitOf(v)).length ? vesselList.filter(v => takes(v) && fitOf(v)) : biggest();
    const scored = [];
    for (const v of candidates) {
      const fit = fitOf(v) || 0.5;
      let w = (F[v.id] || 0) + 0.3 * ((v.families || {})[famId] || 0) + 0.004;
      if (A && A.vessels) { const i = A.vessels.indexOf(v.id); if (i >= 0) w += 0.6 / (1 + i); }
      w += 0.5 * ((intent.vesselAffinity || {})[v.id] || 0);
      if (svc.wantUp && v.serve.includes('up')) w += 3;
      // Fire wants a wide ceramic vessel that can take it, never a thin glass.
      if ((intent.askedStyle || {}).flaming) w *= (((rules || {}).garnish || {}).fire || {}).allowedVessels?.includes(v.id) ? 2.5 : 0.4;
      if (bowl && v.id === 'volcano-bowl' && intent.style.flaming) w += 2;
      if (bowl && v.id === 'punch-bowl' && ['punch', 'stirred', 'buck'].includes(famId)) w += 0.5;
      if (bowl && v.id === 'tiki-bowl' && servings <= 3) w += 0.4;
      if (service === 'frozen' && ['hurricane', 'poco-grande', 'coconut', 'pineapple'].includes(v.id)) w += 0.15;
      scored.push({ item: v, s: Math.log(w * fit) });
    }
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
    g.push(flavorTop.includes('orange') ? 'orange wheel' : 'lime wheel', 'lemon wheel', 'expressed orange peel', 'expressed lemon peel', 'cherry on a pick', 'mint sprig');
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
  const blendIce = oz => oz * 1.1; // frozen: ice about 1–1¼× the liquid, or it overflows or turns to soup
  const flashIce = oz => Math.max(6, oz * 1.1); // flash-blend: about 6 oz for one drink, more for a big build
  // The wall a sink runs down, named for what the vessel is (a tin mug is not a glass).
  const wallOf = v => (!v || v.kind === 'glass' ? 'glass' : v.serve.includes('bowl') ? 'bowl' : v.id === 'coconut' ? 'shell' : v.id === 'pineapple' ? 'pineapple' : /cup/.test(v.name) ? 'cup' : 'mug');
  // How each card phrase reads in a sentence.
  const SAY = {
    'heavy nutmeg cap': 'a heavy cap of freshly grated nutmeg', 'swizzle stick left in': 'the swizzle stick left standing in the ice',
    'straw through the ice cone': 'a straw run down through the cone', 'stir stick': 'a stir stick for the guest',
    'lime coin in the glass': 'the lime coin dropped into the glass', 'lime wedges in the glass': 'the lime wedges left in the glass',
    'pineapple crown lid': "the pineapple's own crown set on as a lid", 'candied ginger on a pick': 'a piece of candied ginger on a pick',
    'pineapple wedge and fronds': 'a pineapple wedge with its fronds', 'lime wheels floating': 'lime wheels floated on top', 'lemon wheels floating': 'lemon wheels floated on top', 'orange wheels floating': 'orange wheels floated on top',
  };
  const sayGarnish = (x, all) => (x === 'cherry' ? (all.some(o => /wheel/.test(o)) ? 'a cherry tucked against the wheel' : 'a cherry') : SAY[x] || (/^(a |an |the |three |freshly |grated |toasted |whipped )/.test(x) ? x : an(x)));
  // Fire, done right (technique.md §2.19): a lime shell boat, lemon extract, a long lighter,
  // nothing that burns within reach, and out before anyone drinks.
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
    const floats = poured.filter(l => l.float), sinks = poured.filter(l => l.sink);
    const crowns = poured.filter(l => !l.float && !l.sink && (l.crown || (svc.method === 'swizzle' && ingMap.get(l.id).cat === 'bitters')));
    const fizz = poured.filter(l => !l.float && !l.sink && FIZZY.has(l.id));
    const hotTop = svc.method === 'hot' ? poured.find(l => HOT_TOPS.includes(l.id) && !l.float) : null;
    const held = [...floats, ...sinks, ...crowns, ...fizz, ...(hotTop ? [hotTop] : [])];
    const name = l => displayName(l.id).toLowerCase();
    const except = held.length ? ` except the ${list(held.map(name))}` : '';
    const mixOz = poured.filter(l => !held.includes(l)).reduce((t, l) => t + (l.oz || 0), 0); // one drink's worth into the tin
    const egg = poured.some(l => EGG.has(l.id));
    const mint = lines.find(l => l.id === 'mint') && ['swizzle', 'muddle-build'].includes(svc.method);
    const heap = ['crushed', 'pebble', 'shaved'].includes(svc.ice) || (svc.method === 'swizzle' && svc.ice !== 'ice-cone');
    const iceKind = ['pebble', 'shaved'].includes(svc.ice) ? svc.ice : 'crushed';
    const room = fizz.length > 0 && heap && !upGlass; // leave room for the topper, then crown with ice
    // Rounds a tin can hold: two drinks, or one at a time for a big drink; a blender takes two.
    const per = svc.method === 'blend' || mixOz * 2 <= 12 ? Math.min(2, n) : 1;
    const rounds = Math.ceil(n / per), perRound = mixOz * per, eachTime = rounds > 1 ? ' each time' : '';
    const inRounds = rounds > 1 ? `in ${rounds} rounds of ${numberWord(per)} drink${per > 1 ? 's' : ''} (about ${ozOf(perRound)} of the mix each round)` : `all at once (about ${ozOf(perRound)} of the mix)`;
    const out = [];
    let cups = 0;
    const paste = svc.method === 'hot' ? poured.find(l => PASTES.includes(l.id)) : null;
    const hotSteps = (where, many) => {
      out.push(`${many ? `For ${n}: preheat` : 'Preheat'} ${where} with boiling water, then empty ${many ? 'them' : 'it'}.`);
      if (paste) out.push(`${many ? `Divide the ${name(paste)} between them, add a splash of hot water to each` : `Add the ${name(paste)} with a splash of ${hotTop ? `the ${name(hotTop)}` : 'hot water'}`} and stir until it melts.`);
      out.push(`${many ? 'Divide' : 'Add'} ${paste ? 'the rest' : many ? 'the batch totals' : 'everything'}${hotTop ? ` except the ${name(hotTop)}` : ''}${many ? ` between the ${gs}` : ''} and stir.`);
    };
    // Where a single drink ends up, in the ice it is actually served on.
    const serveOn = () => {
      if (upGlass && svc.ice === 'shaved') return `Press shaved ice into ${aG} to line it like a shell (freeze it a few minutes if you can), then strain the drink into the hollow.`;
      if (svc.up || svc.ice === 'none' || (upGlass && svc.ice === 'cubed')) return `Double-strain into a chilled ${g}.`;
      switch (svc.ice) {
        case 'cubed': return `Strain into ${aG} over fresh cubed ice.`;
        case 'block': return `Strain into ${aG} over one large cube or block.`;
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
      const pour = `Pour ${rounds > 1 ? 'each round' : 'it'}, ice and all, into the ${g}${punchBowl ? ' over the block' : ' over a bed of fresh crushed ice'}${room ? ', leaving room at the top.' : punchBowl ? '.' : '; finish with a mound of crushed ice.'}`;
      if (punchBowl) out.unshift('The night before, freeze a block of ice: fill a quart container with water and freeze it.');
      switch (svc.method) {
        case 'blend':
          out.push(`Blend ${inRounds} with about ${measure(blendIce(perRound))} of ice${eachTime}, until smooth and thick; pour into the ${g}.`);
          break;
        case 'flash-blend':
          out.push(`Flash-blend ${inRounds} with about ${measure(flashIce(perRound))} of crushed ice${eachTime}, for 3–5 seconds (or shake hard in a tin full of crushed ice).`);
          out.push(pour);
          break;
        case 'build': case 'muddle-build': case 'swizzle': case 'stir':
          out.push(`Fill the ${g} two-thirds with crushed ice, pour in the mix and ${svc.method === 'swizzle' ? 'swizzle' : 'stir'} until the outside of the bowl is cold${room ? ', leaving room at the top.' : '; mound more crushed ice on top.'}`);
          break;
        default:
          if (egg) out.push('Dry-shake each round without ice for 10 seconds to whip the egg white.');
          out.push(`Shake ${inRounds}, ${rounds > 1 ? 'each in a tin' : 'in a tin'} filled with about 2 cups of crushed ice, for 8–10 seconds.`);
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
          out.push(`Divide the mix between ${n} ${gs}, fill each two-thirds with crushed ice and swizzle until the ${wall} frosts over${room ? ', leaving room at the top.' : '; pack with more crushed ice.'}`);
          break;
        case 'blend':
          out.push(`Blend ${inRounds} with about ${measure(blendIce(perRound))} of ice${eachTime}, until smooth and thick; pour into ${n} ${gs}.`);
          break;
        case 'flash-blend':
          out.push(`Flash-blend ${inRounds} with about ${measure(flashIce(perRound))} of crushed ice${eachTime}, for 3–5 seconds (or shake hard with crushed ice).`);
          out.push(['ice-cone', 'shaved'].includes(svc.ice) || upGlass ? serveMany() : `Pour the drinks, ice and all, into ${n} ${gs}${room ? ', leaving room at the top.' : '; top each with more crushed ice.'}`);
          break;
        default: {
          const cubed = ['cubed', 'none', 'block'].includes(svc.ice);
          if (egg) out.push('Dry-shake each round without ice for 10 seconds to whip the egg white.');
          out.push(`Shake ${inRounds} with ${cubed ? 'cubed ice, hard, for 10–12 seconds' : 'about 2 cups of crushed ice for 8–10 seconds'}.`);
          out.push(serveMany());
        }
      }
    } else {
      if (mint) out.push(`Lightly press the mint in the bottom of ${aG}.`);
      switch (svc.method) {
        case 'flash-blend':
          out.push(`Add everything${except} to a blender cup with about ${measure(flashIce(mixOz))} of crushed ice.`);
          out.push('Flash-blend for 3–5 seconds (or shake very hard with crushed ice if you have no spindle mixer).');
          out.push(['ice-cone', 'shaved'].includes(svc.ice) || upGlass ? serveOn() : `Pour everything, ice and all, into ${aG}${room ? ', leaving room at the top.' : '; top with more crushed ice.'}`);
          break;
        case 'blend':
          out.push(`Add everything${except} to a blender with about ${measure(blendIce(mixOz))} of ice.`);
          out.push(`Blend until smooth and thick, then pour into ${aG}.`);
          break;
        case 'swizzle':
          out.push(`Add everything${except} to ${aG}.`);
          out.push(`Fill two-thirds with crushed ice and swizzle until the ${wall} frosts over${room ? ', leaving room at the top.' : '; pack with more crushed ice.'}`);
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
          if (['cubed', 'none', 'block'].includes(svc.ice)) out.push(`${egg ? 'Add cubed ice and shake' : `Shake everything${except} with cubed ice`} hard for 10–12 seconds.`);
          else out.push(`${egg ? 'Add crushed ice and shake' : `Shake everything${except} with about 12 oz of crushed ice`} for 8–10 seconds.`);
          out.push(serveOn());
      }
    }

    // What was held back goes in last: the hot water, the topper (then the last of the ice), the
    // sink down the wall, the float over a spoon, the bitters crown on the ice.
    if (hotTop && !punchBowl) out.push(each ? `Top each with ${ozOf(hotTop.oz)} of steaming ${name(hotTop)} and stir.` : `Top with ${hotTop.amount ? `${fracStr(hotTop.amount)} oz of ` : ''}steaming ${name(hotTop)} and stir.`);
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
    if (cups) out.push(`Ladle into punch cups, 4–5 oz each: about ${cups} cups.`);
    const flame = garnish.find(x => /flaming/.test(x));
    const straws = garnish.find(x => /long straws$/.test(x));
    const dress = garnish.filter(x => x !== flame && x !== straws);
    if (dress.length) out.push(`Garnish ${bowl ? 'the bowl ' : each ? 'each ' : ''}with ${list(dress.map(x => sayGarnish(x, dress)))}.`);
    if (straws) out.push(`Serve with ${straws}, one per guest (about ${ozOf(poured.reduce((t, l) => t + (l.oz || 0), 0))} of the mix each).`);
    // Fire: a flaming garnish always brings its lighting and safety step; a fire-safe bowl of
    // crushed ice, or a prayer that asked for fire in a vessel that can take it, may have it as theater.
    const citrus = poured.some(l => l.id === 'lime') || !poured.some(l => l.id === 'lemon') ? 'lime' : 'lemon';
    if (flame || (intent.style.flaming && FIRE_VESSELS.has(svc.vessel) && (heap || svc.method === 'blend' || bowl) && svc.method !== 'hot')) out.push(fireStep(true, citrus, svc.vessel));
    else if (svc.method === 'hot' && intent.style.flaming) out.push('Theater, if you like (optional, and carefully): warm a spoonful of the rum in a ladle, light it away from guests and anything that burns, let it flicker a few seconds, then blow it out and stir it in. Never pour spirit from the bottle toward a flame.');
    else if (heap && bowl && FIRE_BOWLS.has(svc.vessel)) out.push(fireStep(false, citrus, svc.vessel));
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
        family: d.family, similarity: round(x.s, 2),
        shared: shared.map(id => prose(id)),
      };
    }).filter(x => !riffSrc || x.id !== riffSrc.id).slice(0, 4);

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
    const F = model.families[famId].metrics;
    const sweet = stats.sugarConc > (F.sugarConc ? F.sugarConc.p75 : 9) ? 'lush' : stats.sugarConc < (F.sugarConc ? F.sugarConc.p25 : 5) ? 'dry' : 'balanced';
    const strength = stats.abv >= 18 ? 'It drinks strong; the ice is doing a lot of work.' : stats.abv >= 13 ? 'Assertive, but the dilution keeps it easy.' : stats.abv >= 8 ? 'Moderate strength, built for sipping through a straw.' : stats.abv > 0.5 ? 'Gentle enough for a long afternoon.' : 'No alcohol at all.';
    const bits = [];
    if (open.length) bits.push(`It opens on ${list(open)}`);
    if (body.length) bits.push(`${bits.length ? 'then' : 'It'} settles into ${list(body)}`);
    if (finish.length) bits.push(`and finishes with ${list(finish)}`);
    const balanceLine = sweet === 'dry' ? 'Dry rather than sweet.' : sweet === 'lush' ? 'Lush rather than tart.' : 'Balanced, neither sweet nor tart.';
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

  // Layered presentation: the prayer asked for it, or the archetype traditionally floats or sinks.
  function addLayer(lines, A, intent, notes) {
    if (lines.some(l => l.float || l.sink || l.crown)) return;
    if (!intent.style.layered) return;
    const rumBased = lines.some(l => (ingMap.get(l.id) || {}).cat === 'rum');
    const avoid = id => forbidden(id, intent) || lines.some(l => l.id === id) || (A.forbidden || []).includes(id);
    const red = !lines.some(l => ['blue-curacao'].includes(l.id));
    if (red && !avoid('grenadine') && !intent.style.creamy) {
      lines.push({ id: 'grenadine', role: 'sweet', oz: 0.5, sink: true, slot: 'sink', req: true });
      notes.push('grenadine poured last so it sinks into a sunrise');
    } else if (rumBased && !avoid('rum-jamaican-dark') && !['blue', 'green', 'purple', 'white', 'clear'].includes(intent.color)) {
      lines.push({ id: 'rum-jamaican-dark', role: 'base', oz: 0.5, float: true, slot: 'float', req: true });
      notes.push('a dark rum float for a layered top');
    }
  }

  // A drink scaled to the vessel it must go in: every line in proportion, the spirit kept to a
  // real pour (an ounce and a half) while the juices and cream give way.
  function needOf(c, v, service) {
    if (service === 'crushed') return c.finalOz * 1.5;
    if (service === 'frozen') return c.finalOz * 1.1;
    return (v.serve.includes('up') && service === 'shaken') || service === 'hot' ? c.finalOz : c.finalOz * 1.35;
  }
  function fitVessel(lines, svc, v, notes, A = {}) {
    const service = serviceOf(svc.method, svc.ice);
    let c = chemOf(lines, svc.method, svc.ice);
    const noIce = service === 'hot' || (v.serve.includes('up') && service === 'shaken');
    const range0 = fillRange(v.id);
    // Room is the fill range's top where the research gives one (expressed as the same need).
    const room = noIce ? v.capacity * 0.95 : range0 ? needOf(c, v, service) * (range0[1] * 1.1 / Math.max(c.volOz, 0.1)) : v.capacity * 1.05;
    const live = lines.filter(l => !l.garnish && !l.muddled && l.role !== 'aromatic' && l.oz > 0);
    const base = live.filter(l => l.role === 'base' && !l.float && !l.sink);
    const baseTotal = base.reduce((t, l) => t + l.oz, 0);
    // Too little for the glass the guest asked for: a little more of everything, up to a third.
    const range = fillRange(v.id);
    // Never for a heavyweight (a Zombie is already all the rum a guest should have); the spirit
    // and the accents keep their pours, the juices and sweeteners grow.
    const spirit = lines.filter(l => l.role === 'base' && !l.float && !l.sink).reduce((t, l) => t + (l.oz || 0), 0);
    if (needOf(c, v, service) <= room && range && c.volOz < range[0] * 0.95 && A.family !== 'zombie' && spirit <= 2.25) {
      // A juice cut for the color (the Blue Hawaii's pineapple) stays cut.
      const grow = lines.filter(l => !l.garnish && !l.muddled && !l.held && ['juice', 'sour', 'sweet', 'rich', 'lengthener'].includes(l.role) && !POTENT.has(l.id) && !['dash', 'drop'].includes(l.unit));
      const growOz = grow.reduce((t, l) => t + l.oz, 0);
      const k = growOz > 0 ? Math.min(1.5, 1 + (range[0] - c.volOz) / growOz) : 1;
      for (const l of grow) l.oz *= k;
      finalizeAmounts(lines);
      notes.push(`a bigger pour so it fills ${/^[aeiou]/i.test(v.name) ? 'an' : 'a'} ${v.name}`);
      return true;
    }
    if (needOf(c, v, service) <= room) return false;
    for (let i = 0; i < 30 && needOf(c, v, service) > room; i++) {
      const k = Math.max(0.85, Math.min(0.97, room / needOf(c, v, service)));
      const baseNow = base.reduce((t, l) => t + l.oz, 0);
      for (const l of live) {
        if (l.role === 'base' && !l.float && !l.sink && baseNow * k < Math.min(1.5, baseTotal)) continue;
        if (ingMap.get(l.id).cat === 'bitters' || ['dash', 'drop'].includes(l.unit)) continue;
        l.oz *= k;
      }
      c = chemOf(lines, svc.method, svc.ice);
    }
    finalizeAmounts(lines);
    notes.push(`scaled to fit ${/^[aeiou]/i.test(v.name) ? 'an' : 'a'} ${v.name}`);
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
  function generate(prompt, opts = {}) {
    // Praying again brings a different idea: the frames the earlier seeds served are known.
    const seed = opts.seed || 0;
    if (seed > 0 && !opts.prior) {
      const prior = new Set();
      for (let s0 = 0; s0 < Math.min(seed, 3); s0++) prior.add(generate(prompt, { ...opts, seed: s0, prior: new Set() }).archetype.id);
      opts = { ...opts, prior };
    }
    const first = generateOnce(prompt, opts);
    if (!linter || first.classic) return first;
    const fatal = r => { try { return linter.lint(r, { intent: parsePrompt(prompt, { nameIndex, concepts: conceptIndex }) }).filter(f => f.sev === 'fatal'); } catch { return []; } };
    let best = first, bestF = fatal(first);
    const avoid = new Set([first.archetype.id]);
    for (let i = 0; bestF.length && i < 3; i++) {
      const t = generateOnce(prompt, { ...opts, avoid });
      if (avoid.has(t.archetype.id)) break;
      avoid.add(t.archetype.id);
      const f = fatal(t);
      if (f.length < bestF.length) { best = t; bestF = f; }
    }
    best.critic = { fatal: bestF.map(f => f.id), rebuilt: best !== first };
    return best;
  }

  function generateOnce(prompt, { seed = 0, avoid = null, prior = null } = {}) {
    swappedOut.clear();
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
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
          return { id: l.id, role: roleOf(l, ing), oz: lineOz(l, ing, units) / (riffSrc.servings || 1), unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, garnish: !!l.garnish || ing.role === 'aromatic', fromSpec: riffSrc.name };
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
          const branch = (A.canonicalSpecs || []).filter(sp => named.every(n => sp.lines.some(x => x.id === n.id)));
          lines = seed > 0 && branch.length > 1 ? composer.compose(A, intent, ctx, rng, greedy, notes, null, seed) : composer.compose(A, intent, ctx, rng, greedy, notes, { lines: srcLines });
          // Bare names and repeat prayers get one signed change of their own.
          if (bare || seed > 0) { const v = composer.twist(A, lines, intent, ctx, rng, false) || composer.vary(A, lines, intent, ctx, rng, false); if (v) notes.push(v); }
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
          lines = sp.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, role: ingMap.get(l.id).role, oz: l.oz, unit: l.unit, amount: l.amount, float: !!l.float, sink: !!l.sink, garnish: ingMap.get(l.id).role === 'aromatic', slot: composer.slotOf(A, l.id), req: true, fromSpec: sp.name }));
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
        // An open prayer with nothing to steer it still never repeats the frame an earlier seed served.
        if (blank && prior && prior.size && scored.some(x => !prior.has(x.a.id))) scored = scored.filter(x => !prior.has(x.a.id));
        A = forced || softPick(rng, scored.map(x => ({ item: x.a, s: x.s })), blank ? 2.5 : 0.8, (greedy || seed > 0) && !blank)
          // Nothing can be built as asked (every archetype needs something the guest ruled out):
          // fall back to the most forgiving frame, a planter's punch.
          || composer.byId['planters-punch'] || archetypes[0];
        if ((A.methods || [])[0] === 'blend') blenderContext = true;
        lines = composer.compose(A, intent, ctx, rng, greedy, notes, null, seed);
        // A repeat prayer on the same frame still makes one signed change of its own.
        if (seed > 0 && (A === firstChoice || (A.canonicalSpecs || []).length <= 1)) { const v = composer.twist(A, lines, intent, ctx, rng, false) || composer.vary(A, lines, intent, ctx, rng, false); if (v) notes.push(v); }
        if (blank) intent.complexity = Math.max(intent.complexity, 0.4);
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
      // Aromatic garnishes the archetype calls for (mint on a Mai Tai, nutmeg on a Painkiller).
      for (const id of A.aromatics || []) if (!lines.some(l => l.id === id) && !forbidden(id, intent)) lines.push({ id, role: 'aromatic', garnish: true });
      for (const l of lines) if (intent.ings[l.id] || Object.entries(intent.tags).some(([t, w]) => w >= 1.4 && ((ingVec[l.id] || {})[t] || 0) >= 0.55)) l.req = true;

      // Service from the archetype, bent by the prayer where the archetype allows it.
      const methods = A.methods || ['shake'], ices = A.ice || ['crushed'];
      const svc = { method: methods[0], ice: ices[0], glass: '' };
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

      fixTechnique(svc, lines, notes);
      // Bitters dashed over a swizzle's crushed ice sit on top as a crown (the Queen's Park's rust cap).
      if (svc.method === 'swizzle') for (const l of lines) if (ingMap.get(l.id).cat === 'bitters' && !l.float && !l.sink && (l.oz || 0) < 0.3) l.crown = true;
      // Doses: the composer set them inside the archetype's ranges; balance pulls sugar, acid and
      // strength onto the archetype's targets without leaving those ranges.
      initialDoses(lines, famId, intent);
      const specName = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
      const spec = specName && (A.canonicalSpecs || []).find(sp => sp.name === specName);
      const ref = riffSrc ? linesOf(riffSrc).filter(l => !l.garnish) : spec ? spec.lines.filter(l => ingMap.has(l.id)).map(l => ({ id: l.id, oz: l.oz, role: ingMap.get(l.id).role })) : null;
      if (!classic) structure(lines, A, intent, notes);
      const refMethod = riffSrc ? riffSrc.method : spec ? (spec.method || (A.methods || [])[0]) : null;
      const target = classic ? null : balanceTo(lines, ref, A, intent, svc, notes, refMethod);
      if (!classic && (intent.strength || 0) <= -1.5 && !intent.style.zeroProof) gentle(lines, A, intent, svc, notes);
      if (!classic) {
        // Balance and color moves never push an accent past its cap (2 oz of blue curaçao is dye, not a drink).
        for (const l of lines) { const cap = doseCap(l.id, A.family, (intent.ings[l.id] || 0) >= 1); if (l.oz > cap && !(l.fromSpec && l.oz <= (l.oz0 || 0) + 0.01)) l.oz = cap; }
        floors(lines, A, intent, svc, notes);
      }
      finalizeAmounts(lines);
      if (!classic) settle(lines, target, A, intent, svc);
      const colorOk = intent.color ? colorPass(lines, A, intent, svc, notes) : true;
      if (!intent.color && !classic && !(riffSrc && !intent.colorLean && !hueLean(intent))) {
        if (intent.hueLean) leanPass(lines, A, intent, svc, notes, target, intent.hueLean);
        // No leaning at all: the drink's own color carrier (its passion fruit, its grenadine) may
        // sing a little louder, inside its range and its balance.
        else if (!riffSrc) { const own = ownLean(lines, A); if (own) leanPass(lines, A, intent, svc, notes, target, own, true); }
      }
      const c = chemOf(lines, svc.method, svc.ice);
      const colorMiss = colorOk ? 0 : colorDistance(drinkLook(lines, ingMap, { method: svc.method, ice: svc.ice, dilutionOz: c.finalOz - c.volOz }), intent.color);
      const broken = promisesBroken(lines, svc, A);
      return { A, lines, notes, svc, colorOk, colorMiss, broken, score: (scoreOf.get(A) ?? -Infinity), servings: intent.servings, bowl: intent.style.bowl };
    };
    // How well a build keeps the prayer: the color it demanded, and each reading's promise.
    const promisesBroken = (lines, svc, A) => (intent.promises || []).filter(pr => {
      if (pr.ids.length && pr.ids.some(id => lines.some(l => l.id === id))) return false;
      if (pr.up && svc.wantUp) return false;
      if (pr.flaming && (intent.style.flaming || A.flaming)) return false;
      if (pr.layered && lines.some(l => l.float || l.sink || l.crown)) return false;
      // A promise with nothing this pantry can pour (or the guest ruled it out) can't be broken.
      return pr.ids.some(id => ingMap.has(id) && !forbidden(id, intent)) || pr.up;
    }).length;
    const scoreOf = new Map(archetypes.map(a => { const x = composer.scoreArchetype(a, intent, ctx); return [a, x.s]; }));
    let built = attempt(null);
    const worse = (t, b) => (t.colorOk ? 0 : 1) * 10 + t.colorMiss + t.broken * 2 >= (b.colorOk ? 0 : 1) * 10 + b.colorMiss + b.broken * 2 - 0.05;
    if ((!built.colorOk || built.broken) && !riffSrc && !classic && !intent.namedClassic) {
      const ranked = archetypes.map(a => ({ a, s: scoreOf.get(a) })).filter(x => Number.isFinite(x.s) && x.a !== built.A && !skipped.has(x.a) && !(avoid && avoid.has(x.a.id)) && x.s >= (scoreOf.get(built.A) ?? 0) - (built.colorOk ? 4 : 9)).sort((x, y) => y.s - x.s);
      for (const x of ranked.slice(0, 8)) {
        const t = attempt(x.a);
        if (!worse(t, built)) built = t;
        if (built.colorOk && !built.broken) break;
      }
    }
    const { A, notes, svc } = built;
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

    // A drink too big for every glass of its kind is shortened in its lengthener (a hot punch
    // gets less boiling water), never moved into a glass that can't take its service.
    {
      const service = serviceOf(svc.method, svc.ice);
      const fits = vesselList.filter(v => !v.serve.includes('bowl') && SERVICE_FITS[service].some(x => v.serve.includes(x)));
      const cap = fits.length ? Math.max(...fits.map(v => v.capacity)) : 0;
      const need = c => c.finalOz * (service === 'crushed' ? 1.5 : service === 'frozen' ? 1.1 : service === 'hot' ? 1 : 1.35);
      let c0 = chemOf(lines, svc.method, svc.ice);
      const longs = lines.filter(l => l.role === 'lengthener' && !l.float && !l.sink && l.oz > 1);
      if (cap && (intent.servings || 1) < 3 && need(c0) > cap * 1.05 && longs.length) {
        for (let i = 0; i < 12 && need(c0) > cap; i++) { for (const l of longs) l.oz = Math.max(1, l.oz - 0.5); c0 = chemOf(lines, svc.method, svc.ice); }
        finalizeAmounts(lines);
        notes.push(`less ${displayName(longs[0].id).toLowerCase()} so it fits ${/^[aeiou]/i.test(fits[0].name) ? 'an' : 'a'} ${fits.sort((a, b) => b.capacity - a.capacity)[0].name}`);
      }
    }
    let chem = chemOf(lines, svc.method, svc.ice);
    const profile = profileOf(lines.map(l => ({ id: l.id, amount: l.oz, unit: 'oz', garnish: l.role === 'aromatic' })), 1, svc.method, svc.ice);
    const flavorTop = copy.named(copy.presence(lines.filter(l => l.role !== 'aromatic' || l.muddled))).map(x => x.tag).slice(0, 5);
    const pick = chooseVessel(famId, intent, svc, chem, riffSrc, rngFrom(`${prompt}::${seed}::vessel`), greedy, A, lines.filter(l => l.float || l.sink || l.crown));
    if (pick) { svc.glass = pick.v.name; svc.vessel = pick.v.id; svc.up = pick.v.serve.includes('up') && serviceOf(svc.method, svc.ice) === 'shaken'; }
    // A punch bowl is built over a block and ladled, whatever the single serve would be.
    if (pick && pick.v.id === 'punch-bowl' && svc.method !== 'hot') { svc.ice = 'block'; if (['shake', 'flash-blend', 'swizzle', 'blend'].includes(svc.method)) svc.method = 'build'; chem = chemOf(lines, svc.method, svc.ice); }
    // A vessel the guest asked for (a coconut holds twelve ounces) gets a drink scaled to fit it.
    if (pick && !pick.v.serve.includes('bowl') && (!classic || pick.why === 'asked') && fitVessel(lines, svc, pick.v, notes, A)) chem = chemOf(lines, svc.method, svc.ice);
    const garnish = chooseGarnish(A, intent, lines, flavorTop, svc, pick ? pick.v : null);
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
      facts: nameFacts({ lines, A, intent, svc, vessel: pick ? pick.v : null, garnish, riffSrc }),
    });
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
        id: l.id, name: displayName(l.id), role: l.role, oz: round(l.oz, 3), amount: l.amount, unit: l.unit, float: !!l.float, sink: !!l.sink,
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
    recipe.notes = notes.filter(n => n !== 'split-base').map(n => n.replace(/^riff:/, ''));
    recipe.stats.standardDrinks = round(chem.alcMl / 17.74, 1);
    recipe.check = composer.satisfies(A, lines, intent.ings, id => forbidden(id, intent));
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
  const fromSpec = (sp, A) => {
    const name = sp.drink || sp.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const o = sp.origin || originOf(name) || (A && A.origin && normName(A.origin.drink) === normName(name) ? A.origin : null);
    return { kind: 'spec', id: `${A ? A.id : ''}:${sp.name}`, specName: sp.name, name, lines: specLines(sp), origin: o, credit: creditText(o), edition: sp.edition || '', archetype: A ? A.id : null };
  };
  const fromDrink = d => { const o = originOf(d); return { kind: 'drink', id: d.id, name: d.name, lines: asPoured(linesOf(d)), origin: o, credit: creditText(o), edition: '', popularity: d.popularity }; };
  // Every proven spec a finished drink could turn out to be: the archetypes' canonical specs and
  // the catalogue's better-known drinks (a templated zero-proof spec is no classic).
  let refPool = null;
  const pool = () => refPool || (refPool = [
    ...archetypes.filter(a => a.id !== 'zero-proof-tiki').flatMap(a => (a.canonicalSpecs || []).map(sp => fromSpec(sp, a))),
    ...drinks.filter(d => d.popularity >= 2).map(fromDrink),
  ].filter(r => r.lines.length));
  // The named reference a card anchors to: the drink the guest named; else the nearest proven
  // spec of this archetype or catalogue drink of its family (a strawberry colada is a Lava Flow,
  // not a Blue Hawaiian with its blue taken out). The spec the build started from wins a tie.
  // Rare bottles say more about which drink this is than lime and simple syrup do: each bottle is
  // weighted by how few proven specs pour it.
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
    if (riffSrc) { const r = fromDrink(riffSrc); return { ...r, similarity: copy.sameness(lines, r.lines) }; }
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
    let best = null;
    for (const c of cands) {
      const score = copy.kinship(lines, c.lines, rarity) + c.bonus;
      if (!best || score > best.score) best = { ...c, score };
    }
    if (best) { best.similarity = copy.sameness(lines, best.lines); delete best.score; }
    return best || { kind: 'frame', name: A.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), lines: [], origin: A.origin || null, credit: creditText(A.origin), edition: '', similarity: 0 };
  }
  // A drink 95% the same as a proven spec is that drink, and the card says so.
  function exactClassic(lines) {
    let best = null;
    for (const c of pool()) { const s = copy.sameness(lines, c.lines); if (s >= 0.95 && (!best || s > best.similarity + 1e-9 || (Math.abs(s - best.similarity) < 1e-9 && c.kind === 'spec' && best.kind !== 'spec'))) best = { ...c, similarity: s }; }
    return best;
  }
  function classicRecord(c) {
    const sp = c.fromArchetype;
    const name = sp ? (sp.drink || c.name) : c.name;
    const o = (sp && sp.origin) || originOf(sp ? name : c) || {};
    return { id: c.id, name, credit: creditText(o), edition: sp ? sp.edition || '' : '', origin: o, creator: o.who || c.creator || '', venue: c.venue || '', year: o.year || c.year || null, circa: !!c.circa, source: c.source || (sp && sp.source) || '' };
  }
  // What the name generator needs to keep its words true of the build.
  const SPIRIT_NAME = { bourbon: 'Bourbon', rye: 'Rye', mezcal: 'Mezcal', 'tequila-blanco': 'Tequila', 'tequila-reposado': 'Reposado', gin: 'Gin', pisco: 'Pisco', 'rum-cachaca': 'Cachaça', 'rum-agricole-blanc': 'Agricole', 'rum-agricole-vieux': 'Agricole', 'scotch-islay': 'Islay', brandy: 'Brandy', vodka: 'Vodka', 'japanese-whisky': 'Whisky', aquavit: 'Aquavit', 'batavia-arrack': 'Arrack' };
  function nameFacts({ lines, A, intent, svc, vessel, garnish, riffSrc }) {
    const poured = lines.filter(l => !l.garnish || l.muddled);
    const ozOf = ids => poured.filter(l => ids.includes(l.id)).reduce((t, l) => t + (l.oz || 0), 0);
    const srcIds = riffSrc ? new Set(riffSrc.ingredients.map(l => l.id)) : null;
    const swapped = srcIds && poured.find(l => l.role === 'base' && !srcIds.has(l.id) && SPIRIT_NAME[l.id] && (intent.spirits.includes(l.id) || (intent.ings[l.id] || 0) >= 1));
    return {
      vessel: vessel ? vessel.id : '', bowl: !!(vessel && vessel.serve.includes('bowl')), method: svc.method, hot: svc.method === 'hot',
      flaming: garnish.some(g => /flaming/.test(g)) || (!!intent.style.flaming && FIRE_VESSELS.has(vessel ? vessel.id : '')),
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
    if (!classic && !riffSrc) {
      const ex = exactClassic(lines);
      if (ex) {
        if (normName(ex.name) !== normName(recipe.name)) recipe.nickname = recipe.name;
        recipe.name = ex.name;
        recipe.classic = { id: ex.id, name: ex.name, credit: ex.credit, edition: ex.edition, origin: ex.origin, creator: (ex.origin || {}).who || '', venue: '', year: (ex.origin || {}).year || null, circa: false, source: '', recognized: true };
        ref = ex;
      }
    }
    if (classic) { recipe.classic.credit = ref.credit || recipe.classic.credit; recipe.name = recipe.classic.name; }
    recipe.reference = { kind: ref.kind, id: ref.id || null, name: ref.name, credit: ref.credit || '', edition: ref.edition || '', similarity: round(ref.similarity || 0, 2), year: (ref.origin || {}).year ?? null };
    const origin = ref.origin || A.origin || null;
    const perGuest = (intent.servings || 1) > 1;
    const facts = copy.drinkFacts({ lines, stats: recipe.stats, look, method: svc.method, ice: svc.ice, up: svc.up, vessel, garnish, archetype: A, prayer: prompt, concepts: intent.concepts, riffOf: riffSrc ? riffSrc.name : '', origin, servings: intent.servings || 1, steps: recipe.method.steps, polynesian: polynesianPrayer(prompt, intent.concepts), intent });
    const same = classic || (recipe.classic && ref.similarity >= 0.999);
    const mv = same ? { moves: [], cousin: '', lost: [] } : copy.netMoves({ ref: ref.lines, lines, archetype: A, intent, notes, slotOf: id => composer.slotOf(A, id), refName: ref.name });
    recipe.explanation.reading = readPrayer(intent, A, notes, recipe, { facts, ref, mv });
    const house = (origin || {}).house || null;
    if (recipe.classic) {
      const mood = (intent.taglineWords || []).find(m => copy.moodOk(m, facts));
      recipe.tagline = copy.classicTagline({ name: recipe.classic.name, credit: recipe.classic.credit, asWritten: !!classic, mood, facts });
    } else {
      recipe.tagline = copy.tagline({ lines, archetype: A, intent, riffOf: riffSrc ? riffSrc.name : null, riffIds: riffSrc ? riffSrc.ingredients.map(l => l.id) : null, look, stats: recipe.stats, method: svc.method, ice: svc.ice, garnish, rng: rngFrom(`${prompt}::${recipe.seed}::tag`), facts, cousin: mv.cousin ? `${ref.name} cousin` : null });
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
    const def = decap(firstSentences(A.definition || '', 1).replace(/\.$/, ''));
    const frame = (A.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const refText = refLabel(ref);
    // Only a bottle dropped outright is "without"; one swapped for another is a move, not a loss.
    const without = (mv.moves || []).filter(m => m.cause === 'structure' && m.id === null && m.replaced && (ref.lines.find(l => l.id === m.replaced) || {}).oz >= 0.25).map(m => copy.say(m.replaced));
    if (recipe.classic && !recipe.classic.recognized) out.push(`It's the ${refText}, poured as written: ${def || 'a proven classic'}.`);
    else if (recipe.classic) out.push(`It's the ${refText}, as the gods pour it: ${def || 'a proven classic'}.`);
    else out.push(`Built on the ${refText}${recipe.riffOf && normName(frame) !== normName(ref.name) ? `, in the ${frame} frame` : ''}${without.length ? `, here without its ${list(without)}` : ''}: ${def}.`);
    const asked = rd.heard.filter(h => !/^riff on|^served in|family$/.test(h.meaning)).map(h => `“${h.phrase}”`).slice(0, 3);
    const prayerMoves = mv.moves.filter(m => m.cause === 'prayer').map(m => m.text);
    if (prayerMoves.length) out.push(asked.length ? `For ${asked.join(', ')}: ${prayerMoves.slice(0, 4).join('; ')}.` : `${cap(prayerMoves.slice(0, 4).join('; '))}.`);
    const twist = mv.moves.find(m => m.cause === 'novelty');
    if (twist) out.push(`The twist: ${twist.text}.`);
    if (mv.cousin) out.push(`${cap(mv.cousin)}.`);
    const o = A.origin;
    if (o && o.text && !recipe.classic && normName(o.drink) !== normName(ref.name) && o.text !== ref.credit) out.push(`The family tree runs back to the ${o.drink} (${o.text}).`);
    out.push(strengthCopy(recipe.stats, { method: recipe.method.method, house, archetypeId: A.id, perGuest }).why);
    return out.map(polish);
  }
  const refLabel = ref => `${ref.name}${ref.credit || ref.edition ? ` (${[ref.credit, ref.edition].filter(Boolean).join('; ')})` : ''}`;

  // How the gods heard you: what each part of the prayer meant (a reading said back only if this
  // drink keeps its promises, else what was poured for it), what the drink is built on, what
  // the prayer changed, any twist of the gods' own, and anything they didn't catch.
  function readPrayer(intent, A, notes, recipe, { facts, ref, mv }) {
    const heard = [];
    const seenPhrase = new Set();
    for (const r of intent.readings) {
      if (seenPhrase.has(r.phrase)) continue;
      seenPhrase.add(r.phrase);
      const label = r.concept.replace(/-/g, ' ');
      heard.push({ phrase: r.phrase, meaning: r.negated ? `not ${label}` : r.reading ? copy.hear(r.reading, conceptById.get(r.concept), facts) : label });
    }
    for (const m of intent.matched) {
      if (seenPhrase.has(m.phrase)) continue;
      seenPhrase.add(m.phrase);
      heard.push({ phrase: m.phrase, meaning: copy.heardLabel(m.label, facts) });
    }
    const frame = (A.name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const refText = refLabel(ref);
    const base = recipe.classic && !recipe.classic.recognized ? `the classic itself: you named the ${recipe.classic.name}, so the gods poured it straight`
      : recipe.classic ? `the ${refText}, poured as the canon has it`
        : recipe.riffOf ? `a riff on the ${refText}`
          : `the ${refText}${normName(frame) !== normName(ref.name) ? `, in the ${frame} frame` : ''}`;
    const moves = mv.moves.filter(m => m.cause === 'prayer').map(m => m.text);
    const twist = mv.moves.find(m => m.cause === 'novelty');
    if (twist) moves.push(`the twist: ${twist.text}`);
    if (mv.cousin) moves.push(mv.cousin);
    const waived = (recipe.check && recipe.check.waived) || [];
    return {
      heard,
      builtOn: { archetype: frame, definition: A.definition || '', spec: ref.name || null, text: polish(`Built on ${base}.`) },
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
    'lime wheels floating': { keys: ['lime'], fruit: LIME, tags: ['lime'] },
    'lemon wheels floating': { keys: ['lemon'], fruit: ['lemon'], tags: ['lemon'] },
    'orange wheels floating': { keys: ['orange'], fruit: ['orange'], tags: ['orange'] },
    'orange slice and cherry flag': { keys: ['orange', 'cherry'], fruit: ['orange'], tags: ['orange', 'cherry'] },
    'pineapple wedge': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple wedge and fronds': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple frond': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple spear': { keys: ['pineapple'], fruit: PINE, tags: ['pineapple'] },
    'pineapple chunk and cherry on a pick': { keys: ['pineapple', 'cherry'], fruit: PINE, tags: ['pineapple', 'cherry'], up: 1 },
    'banana coin on a pick': { keys: ['banana'], fruit: ['banana', 'banana-liqueur'], tags: ['banana'], up: 1 },
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
    'edible flower': { keys: ['flower'], tags: ['floral'], flower: 1 },
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
      case 'volcano-bowl': return ['flaming lime shell', 'mint sprig'];
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
  function chooseGarnish(A, intent, lines, flavorTop, svc, vessel) {
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
      if (punchBowl && !(/floating|nutmeg|dusting|grated|toasted|mint|orchid|gardenia|edible flower/.test(x))) return false;
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
    else addAll([...(g.required || []), ...(fam.required || [])], true);
    // Aromatics the drink is built around (mint on a Mai Tai, nutmeg on a Painkiller).
    const AROMA_WORD = { mint: 'mint sprig', nutmeg: 'freshly grated nutmeg', cinnamon: 'cinnamon stick', basil: 'basil sprig', cucumber: 'cucumber ribbon', clove: 'clove-studded lemon wheel' };
    if (!canon) for (const l of lines) if (l.role === 'aromatic' && !l.muddled && AROMA_WORD[l.id]) add(AROMA_WORD[l.id]);
    if (fireOk) add('flaming lime shell', true);
    // The prayer's own ideas, except on a hot classic: its spice is the whole point.
    if (!(canon && service === 'hot')) addAll(intent.garnishIdeas || []);
    if (!canon) addAll([...(g.typical || []), ...(fam.typical || [])]);
    if (!counted()) addAll(garnishFor(A.family, intent, lines, flavorTop));
    // Crushed-ice tiki carries one aromatic, next to the straw where the nose goes.
    if (['crushed', 'bowl'].includes(service) && !punchBowl && max > 1 && !out.some(x => GV[x].aroma)) {
      for (const a of ['mint sprig', 'expressed orange peel', 'expressed lemon peel', 'expressed lime peel', 'grapefruit twist', 'freshly grated nutmeg']) {
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
    // Nothing that burns near the flame: no umbrella or flower within reach, no mint bouquet.
    if (out.includes('flaming lime shell') || (fireSafe && intent.style.flaming)) {
      for (const x of [...out]) if (x === 'paper umbrella' || GV[x].flower) out.splice(out.indexOf(x), 1);
      if (out.includes('mint bouquet')) out.splice(out.indexOf('mint bouquet'), 1, 'mint sprig');
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
  return { scoreArchetypes, generate, describeDrink, parse: p => parsePrompt(p, { nameIndex, concepts: conceptIndex }), ingMap, famById, drinkById, archetypes, composer, archetypeForDrink };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
function firstSentences(text, n) {
  const parts = (text || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return parts.slice(0, n).join('').trim();
}

export { amountString };
