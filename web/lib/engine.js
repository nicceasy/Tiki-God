// Tiki drink generator. Everything it knows comes from the database (data/drinks.json)
// via the statistics in data/model.json; this file turns a prompt into a balanced recipe
// and explains where each choice came from.
import { indexIngredients, analyzeLines, lineOz, roleOf, round } from './chem.js';
import { flavorVector, normalize, cosine, lineImpact, tagWeights } from './flavor.js';
import { parsePrompt, buildNameIndex, indexConcepts } from './prompt.js';
import { snap, amountString } from './format.js';
import { makeName } from './names.js';
import { serviceOf, SERVICE_FITS } from './vessels.js';
import { createComposer, doseCap } from './composer.js';
import { createCopywriter } from './copy.js';
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
    const upper = l => Math.min(doseCap(l.id, A.family, (intent.ings[l.id] || 0) >= 1), Math.max(0.25, l.oz0 * (frozenNow && !frozenRef ? 2 : 1.6)));
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
        for (const l of sour) { l.oz *= g; edge(l, l.oz0 * (tart > 0 ? 1 : 0.75), Math.max(l.oz0 * (tart > 0 ? 1.5 : 1.25), tart > 0 ? 1.25 : 0)); }
        if (snapOz() === before) break;
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
  const originOf = id => {
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
      const twin = body().find(x => x !== l && originOf(x.id) === originOf(l.id));
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
      const cap = bowlCup ? 2 : zombieLine ? Math.max(3, (B || [])[1] || 3) : Math.min(3, Math.max(2.5, (B || [])[1] || 2.5));
      const total = body().reduce((t, l) => t + l.oz, 0);
      if (total > cap + 0.05) { const k = cap / total; for (const l of body()) l.oz *= k; }
    }
    // Overproof is a seasoning: an ounce beside other spirits, an ounce and a half as the only
    // one (a Cobra's Fang), two if the guest asked for it by name.
    for (const l of body()) if (OVER(l.id)) {
      const cap = asked(l) ? 2 : body().length > 1 ? 1 : 1.5;
      if (l.oz > cap + 0.01) { const other = body().filter(x => x !== l && !OVER(x.id)).sort((x, y) => y.oz - x.oz)[0]; if (other) other.oz += Math.min(l.oz - cap, 0.5); l.oz = cap; }
    }
    // Hot drinks take citrus as a whisper: half an ounce at most (more splits the butter).
    if (svc.method === 'hot') for (const l of live().filter(l => l.role === 'sour' && l.oz > 0.5)) l.oz = 0.5;
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
      if (asked(l) || l.req || sole(l) || (l.role === 'sweet' && !kin)) { l.oz = floor; continue; }
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
      if (v.serve.includes('bowl')) return r > 1.12 ? 0 : 1;
      // A drink with no ice in it (up, hot) needs room at the rim; ice can mound above it.
      const noIce = service === 'hot' || (v.serve.includes('up') && service === 'shaken');
      if (r > (noIce ? 0.95 : 1.12)) return 0;
      let f = r >= 0.5 ? 1 : Math.pow(r / 0.5, 1.5);
      const range = fillRange(v.id);
      if (range) {
        const vol = chem.volOz * (bowl ? servings : 1);
        if (vol < range[0]) f *= Math.pow(vol / range[0], 3);
        else if (vol > range[1] * 1.15) f *= 0.15;
      }
      return f;
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
      if (bowl && v.id === 'volcano-bowl' && intent.style.flaming) w += 2;
      if (bowl && v.id === 'punch-bowl' && ['punch', 'stirred', 'buck'].includes(famId)) w += 0.5;
      if (bowl && v.id === 'tiki-bowl' && servings <= 3) w += 0.4;
      if (service === 'frozen' && ['hurricane', 'poco-grande', 'coconut', 'pineapple'].includes(v.id)) w += 0.15;
      scored.push({ item: v, s: Math.log(w * fit) });
    }
    if (!scored.length) return { v: vesselById[bowl ? 'punch-bowl' : 'collins'] || vesselList[0], why: 'fallback' };
    return { v: softPick(rng, scored, 0.7, greedy), why: 'family' };
  }

  function garnishFor(famId, intent, lines, flavorTop) {
    const g = [];
    const ids = lines.map(l => l.id);
    if (famId === 'mai-tai') g.push('spent lime shell', 'mint sprig');
    if (ids.includes('mint') || intent.tags.mint) g.push('big mint bouquet (spank it first)');
    if (famId === 'swizzle') g.push('mint sprig');
    if (ids.includes('nutmeg')) g.push('freshly grated nutmeg');
    if (ids.includes('cinnamon')) g.push('cinnamon stick');
    if (famId === 'colada' || flavorTop.includes('pineapple')) g.push('pineapple wedge and fronds');
    if (flavorTop.includes('floral') || intent.tags.floral) g.push('edible orchid');
    if (flavorTop.includes('berry') || flavorTop.includes('cherry')) g.push('brandied cherry');
    if (flavorTop.includes('coffee')) g.push('three coffee beans');
    if (famId === 'bitter-tiki') g.push('pineapple wedge and fronds');
    if (famId === 'stirred') g.push('expressed orange peel');
    if (famId === 'hot') g.push('cinnamon stick');
    if (!g.length) g.push(flavorTop.includes('orange') ? 'orange wheel' : 'lime wheel', 'mint sprig');
    return [...new Set(g)].slice(0, 3);
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
  // sink or crown the drink, the ice exactly as served, and the garnish last. A batch for a
  // group gives totals and a pitcher or bowl method instead of "multiply by eight".
  const ICE_WORD = { crushed: 'crushed ice', pebble: 'pebble ice', shaved: 'shaved ice', cubed: 'cubed ice', block: 'one large block', 'ice-cone': 'an ice cone', none: 'no ice', blended: 'ice' };
  function steps(svc, lines, intent, garnish = []) {
    const g = svc.glass;
    const aG = `${/^[aeiou]/i.test(g) && !/^(u|one)/i.test(g) ? 'an' : 'a'} ${g}`;
    const n = intent.servings > 1 ? intent.servings : 1;
    const batch = n > 1;
    const poured = lines.filter(l => l.role !== 'aromatic' && !l.garnish);
    const floats = poured.filter(l => l.float), sinks = poured.filter(l => l.sink);
    const crowns = poured.filter(l => l.crown || (svc.method === 'swizzle' && ingMap.get(l.id).cat === 'bitters' && !l.float));
    const fizz = poured.filter(l => !l.float && !l.sink && (l.role === 'lengthener' || ['sparkling-wine'].includes(l.id)) && !['hot-water', 'water', 'coffee', 'black-tea'].includes(l.id));
    const hotTop = svc.method === 'hot' ? poured.find(l => ['hot-water', 'coffee', 'black-tea', 'whole-milk'].includes(l.id)) : null;
    const held = [...floats, ...sinks, ...crowns, ...fizz, ...(hotTop ? [hotTop] : [])];
    const except = held.length ? ` except the ${list(held.map(l => displayName(l.id).toLowerCase()))}` : '';
    const egg = poured.some(l => EGG.has(l.id));
    const mint = lines.find(l => l.id === 'mint') && ['swizzle', 'muddle-build'].includes(svc.method);
    const up = svc.up || svc.ice === 'none';
    const out = [];
    const vessel = batch && intent.style.bowl ? aG : aG;
    // Where the drink ends up, in the ice it is actually served on.
    const serveOn = () => {
      if (svc.up) return `Double-strain into a chilled ${g}.`;
      switch (svc.ice) {
        case 'none': return `Double-strain into ${up ? `a chilled ${g}` : aG}.`;
        case 'cubed': return `Strain into ${aG} over fresh cubed ice.`;
        case 'block': return `Strain into ${aG} over one large cube or block.`;
        case 'shaved': return `Pack ${aG} with shaved ice and strain the drink over it; mound more shaved ice on top.`;
        case 'pebble': return `Open-pour, ice and all, into ${aG}; top with pebble ice to fill.`;
        case 'ice-cone': return `Strain into ${aG} over an ice cone (shaved ice packed around a chopstick in a pilsner glass, frozen and unmolded), or over one large cube if you have no cone.`;
        default: return `Open-pour, ice and all, into ${aG}; top with crushed ice to fill.`;
      }
    };
    if (batch) out.push(`For ${n}: combine the batch totals${except} in a pitcher${svc.method === 'blend' ? ' and blend in rounds' : ''}; ${['shake', 'flash-blend'].includes(svc.method) ? 'shake or flash-blend in rounds of two drinks' : 'stir well'}.`);
    if (mint) out.push(`Lightly press the mint in the bottom of ${aG}.`);
    switch (svc.method) {
      case 'flash-blend':
        if (!batch) out.push(`Add everything${except} to a blender cup with 6 oz of crushed ice.`);
        out.push('Flash-blend for 3–5 seconds (or shake very hard with crushed ice if you have no spindle mixer).');
        out.push(`Pour everything, ice and all, into ${vessel}; top with more crushed ice.`);
        break;
      case 'blend':
        if (!batch) out.push(`Add everything${except} to a blender with about 1 cup (8 oz) of ice.`);
        out.push(`Blend until smooth and thick, then pour into ${vessel}.`);
        break;
      case 'swizzle':
        out.push(`Add everything${except} to ${vessel}.`);
        out.push('Fill two-thirds with crushed ice and swizzle until the glass frosts over; pack with more crushed ice.');
        break;
      case 'stir':
        if (!batch) out.push(`Stir everything${except} with cubed ice for 20–30 seconds.`);
        out.push(svc.ice === 'none' || svc.up ? `Strain into a chilled ${g}.` : `Strain into ${aG} over one large cube.`);
        break;
      case 'build':
      case 'muddle-build':
        out.push(`Build everything${except} in ${vessel} over ${ICE_WORD[svc.ice] || 'ice'}${svc.ice === 'none' ? '' : ''}, and stir briefly.`);
        break;
      case 'hot': {
        const paste = poured.find(l => ['hot-buttered-rum-batter', 'butter', 'gardenia-mix', 'tom-and-jerry-batter'].includes(l.id));
        out.push(`Preheat ${aG} with boiling water, then empty it.`);
        if (paste) out.push(`Add the ${displayName(paste.id).toLowerCase()} with a splash of ${hotTop ? `the ${displayName(hotTop.id).toLowerCase().replace(/^hot /, 'hot ')}` : 'hot water'} and stir until it melts.`);
        out.push(`Add ${paste ? 'the rest' : 'everything'}${hotTop ? ` except the ${displayName(hotTop.id).toLowerCase()}` : ''} and stir.`);
        break;
      }
      default:
        if (egg) out.push(`Dry-shake everything${except} without ice for 10 seconds to whip the egg white.`);
        if (['cubed', 'none', 'block'].includes(svc.ice)) {
          out.push(`${egg ? 'Add cubed ice and shake' : `Shake everything${except} with cubed ice`} hard for 10–12 seconds.`);
          out.push(serveOn());
        } else {
          out.push(`${egg ? 'Add crushed ice and shake' : `Shake everything${except} with about 12 oz of crushed ice`} for 8–10 seconds.`);
          out.push(serveOn());
        }
    }
    if (svc.method === 'flash-blend' && ['ice-cone', 'shaved'].includes(svc.ice)) out.splice(out.length - 1, 1, serveOn());
    if (hotTop) out.push(`Top with ${hotTop.amount ? `${fracStr(hotTop.amount)} oz of ` : ''}steaming ${displayName(hotTop.id).toLowerCase()} and stir.`);
    for (const f of fizz) out.push(`Top with the ${displayName(f.id).toLowerCase()} and give one gentle lift with the spoon.`);
    for (const f of sinks) out.push(`Pour the ${displayName(f.id).toLowerCase()} slowly down the inside of the glass; it sinks and blushes upward. Don't stir: let the guest do it.`);
    for (const f of floats) out.push(`Float the ${displayName(f.id).toLowerCase()} on top: pour it gently over the back of a bar spoon.`);
    if (crowns.length) out.push(`Dash the ${list(crowns.map(b => displayName(b.id)))} over the top of the ice to form a crown.`);
    if (intent.style.flaming) out.push('Theatrics (optional, carefully): set a spent lime half on the ice, add a sugar cube soaked in lemon extract or 151 rum, and light it with a long lighter. Keep hair, sleeves and straws clear, never pour spirit near a flame, and put the fire out before anyone drinks.');
    if (garnish.length) out.push(`Garnish with ${list(garnish.map(x => x.replace(/\s*\(.*?\)/, '')))}.`);
    return out;
  }
  // A batch total a host can measure: cups past 8 oz, ounces below, dashes stay dashes.
  function batchAmount(l, n) {
    if (['dash', 'drop'].includes(l.unit)) return `${l.amount * n} ${l.unit === 'dash' ? 'dashes' : 'drops'}`;
    if (l.unit === 'piece') return `${fracStr(l.amount * n)}`;
    const oz = l.oz * n;
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
    intentMatch, compat, conflicts, softPick, ingVec, naSwap: NA_SWAP,
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
    const room = v.capacity * (noIce ? 0.95 : 1.05);
    const live = lines.filter(l => !l.garnish && !l.muddled && l.role !== 'aromatic' && l.oz > 0);
    const base = live.filter(l => l.role === 'base' && !l.float && !l.sink);
    const baseTotal = base.reduce((t, l) => t + l.oz, 0);
    // Too little for the glass the guest asked for: a little more of everything, up to a third.
    const range = fillRange(v.id);
    // Never for a heavyweight (a Zombie is already all the rum a guest should have); the spirit
    // and the accents keep their pours, the juices and sweeteners grow.
    const spirit = lines.filter(l => l.role === 'base' && !l.float && !l.sink).reduce((t, l) => t + (l.oz || 0), 0);
    if (needOf(c, v, service) <= room && range && c.volOz < range[0] * 0.95 && A.family !== 'zombie' && spirit <= 2.25) {
      const grow = lines.filter(l => !l.garnish && !l.muddled && ['juice', 'sour', 'sweet', 'rich', 'lengthener'].includes(l.role) && !POTENT.has(l.id) && !['dash', 'drop'].includes(l.unit));
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

  function generateOnce(prompt, { seed = 0, avoid = null } = {}) {
    swappedOut.clear();
    const intent = parsePrompt(prompt, { nameIndex, concepts: conceptIndex });
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
        const bare = !Object.keys(intent.tags).length && !intent.spirits.length && !Object.keys(intent.ings).length && !Object.keys(intent.style).filter(k => k !== 'bowl').length && !intent.concepts.length && !intent.color && !intent.diets.length && !intent.strength && !intent.sweetness && !intent.tartness;
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
          const lead = Object.entries(intent.tags).filter(([t]) => !['sweet', 'tart', 'light', 'rich', 'boozy', 'warm', 'fruity', 'tropical', 'citrus', 'creamy', 'effervescent', 'crisp', 'dry'].includes(t)).sort((a, b) => b[1] - a[1])[0];
          const near = ranked.filter(x => x.s >= best - 3.5 && (!lead || lead[1] < 1 || composer.carries(x.a, lead[0], intent, ctx)));
          const skip = new Set(near.slice(0, Math.min(seed, near.length - 1)).map(x => x.a));
          if (near.length > 1) { scored = near.filter(x => !skip.has(x.a)); skipped = skip; }
        }
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
      for (const l of lines) if ((ingMap.get(l.id) || {}).role === 'aromatic' && (A.signature || []).some(c => c.required && c.anyOf.includes(l.id))) {
        l.muddled = true; l.garnish = false; l.role = 'aromatic'; l.unit = 'leaves'; l.amount = l.unit === 'leaves' && l.amount >= 6 ? l.amount : 10;
      }
      // Aromatic garnishes the archetype calls for (mint on a Mai Tai, nutmeg on a Painkiller).
      for (const id of A.aromatics || []) if (!lines.some(l => l.id === id) && !forbidden(id, intent)) lines.push({ id, role: 'aromatic', garnish: true });
      for (const l of lines) if (intent.ings[l.id] || Object.entries(intent.tags).some(([t, w]) => w >= 1.4 && ((ingVec[l.id] || {})[t] || 0) >= 0.55)) l.req = true;

      // Service from the archetype, bent by the prayer where the archetype allows it.
      const methods = A.methods || ['shake'], ices = A.ice || ['crushed'];
      const svc = { method: methods[0], ice: ices[0], glass: '' };
      if (riffSrc && A === archetypeForDrink(riffSrc)) { svc.method = riffSrc.method; svc.ice = riffSrc.ice; }
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
      const ranked = archetypes.map(a => ({ a, s: scoreOf.get(a) })).filter(x => Number.isFinite(x.s) && x.a !== built.A && !skipped.has(x.a) && !(avoid && avoid.has(x.a.id)) && x.s >= (scoreOf.get(built.A) ?? 0) - 4).sort((x, y) => y.s - x.s);
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
    });
    const credit = d => [d.creator, d.venue].filter(Boolean).join(', ') + (d.year ? `${d.creator || d.venue ? ', ' : ''}${d.circa ? 'c. ' : ''}${d.year}` : '');
    const recipe = {
      name: classic ? classic.name : name,
      classic: classic ? { id: classic.id, name: classic.name, credit: classic.fromArchetype ? (classic.source || '').split(/;|\//)[0].trim() : credit(classic), creator: classic.creator || '', venue: classic.venue || '', year: classic.year || null, circa: !!classic.circa, source: classic.source || '' } : null,
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
    recipe.tagline = classic
      ? `The ${classic.name}${recipe.classic.credit ? ` (${recipe.classic.credit})` : ''}, poured as written. Pray again and the gods will riff on it.`
      : copy.tagline({ lines, archetype: A, intent, riffOf: riffSrc ? riffSrc.name : null, riffIds: riffSrc ? riffSrc.ingredients.map(l => l.id) : null, look, stats: recipe.stats, method: svc.method, ice: svc.ice, garnish, rng: rngFrom(`${prompt}::${seed}::tag`) });
    recipe.explanation = explain(recipe, profile, famId, intent, riffSrc, notes);
    recipe.stats.standardDrinks = round(chem.alcMl / 17.74, 1);
    recipe.explanation.tasting = copy.tastingNote({ lines, stats: recipe.stats, archetype: A, look, method: svc.method, ice: svc.ice, garnish, rng });
    recipe.explanation.prayer = intent.readings.filter(r => !r.negated).map(r => ({ phrase: r.phrase, reading: r.reading }));
    recipe.check = composer.satisfies(A, lines, intent.ings, id => forbidden(id, intent));
    recipe.explanation.reading = readPrayer(intent, A, notes, recipe);
    recipe.stats.standardDrinks = round(chem.alcMl / 17.74, 1);
    recipe.explanation.whyItWorks = whyLines(recipe, A, intent);
    return recipe;
  }

  // Why it works, the way a bartender would say it: what it's built on, what changed and how
  // that answers the prayer, one line of history, and its strength in standard drinks.
  function whyLines(recipe, A, intent) {
    const rd = recipe.explanation.reading;
    const out = [];
    const def = ((A.definition || '').split(/(?<=\.)\s/)[0] || '').replace(/^./, c => c.toLowerCase());
    const c = recipe.classic;
    if (c) out.push(`It's the ${c.name} as ${c.creator || 'the canon'} poured it${c.venue && c.venue !== c.creator ? ` at ${c.venue}` : ''}${c.year ? ` in ${c.circa ? 'about ' : ''}${c.year}` : ''}: ${def || 'a proven classic'}`);
    else if (recipe.riffOf) out.push(`Built on the ${recipe.riffOf.name}${A.name && A.name !== recipe.riffOf.name ? ` (the ${A.name} frame)` : ''}: ${def}`);
    else out.push(`Built on the ${A.name}${rd.builtOn.spec ? `, starting from the ${rd.builtOn.spec}` : ''}: ${def}`);
    const asked = rd.heard.filter(h => !/^riff on|^served in|family$/.test(h.meaning)).map(h => `“${h.phrase}”`).slice(0, 3);
    if (rd.moves.length) out.push(`${asked.length ? `For ${asked.join(', ')}: ` : 'The twist: '}${rd.moves.slice(0, 4).join('; ')}.`);
    const hist = (A.classics || []).find(c => /\(/.test(c));
    if (hist && !recipe.classic) out.push(`The family tree runs back to the ${hist.replace(/\s*\(/, ' (')}.`);
    const sd = recipe.stats.standardDrinks;
    if (sd !== undefined && recipe.stats.abv > 0.5) out.push(`About ${sd} US standard drink${sd === 1 ? '' : 's'} (${recipe.stats.abv}% ABV after dilution)${sd >= 2.5 ? '. Don the Beachcomber\'s rule applies: two per guest.' : '.'}`);
    else if (recipe.stats.abv <= 0.5) out.push('No alcohol at all, so anyone at the table can have one.');
    return out;
  }

  // How the gods heard you: what each part of the prayer meant, what the drink is built on,
  // what was done to answer it, and anything they didn't catch.
  function readPrayer(intent, A, notes, recipe) {
    const heard = [];
    const seenPhrase = new Set();
    for (const r of intent.readings) {
      if (seenPhrase.has(r.phrase)) continue;
      seenPhrase.add(r.phrase);
      heard.push({ phrase: r.phrase, meaning: r.negated ? `not ${r.concept.replace(/-/g, ' ')}` : r.reading || r.concept.replace(/-/g, ' ') });
    }
    for (const m of intent.matched) {
      if (seenPhrase.has(m.phrase)) continue;
      seenPhrase.add(m.phrase);
      heard.push({ phrase: m.phrase, meaning: m.label });
    }
    const moves = notes.filter(n => !/^spec:|^split-base$/.test(n)).map(n => n.replace(/^riff:/, '').replace(/, to make it more than an? .*$/, ''));
    const spec = (notes.find(n => n.startsWith('spec:')) || '').slice(5);
    const base = recipe.classic ? `the classic itself: you named the ${recipe.classic.name}, so the gods poured it straight` : recipe.riffOf ? `a riff on the ${recipe.riffOf.name}` : spec ? `the ${A.name} frame, starting from the ${spec}` : `the ${A.name} frame`;
    const waived = (recipe.check && recipe.check.waived) || [];
    return {
      heard,
      builtOn: { archetype: A.name, definition: A.definition || '', spec: spec || null, text: `Built on ${base}.` },
      moves: [...new Set(moves)].slice(0, 6),
      waived: waived.length ? `You ruled out the ${waived.join(' and ')}, so this is a cousin of the ${A.name} rather than the real thing.` : '',
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

  // Research garnish notes read like "flaming lime shell (later mug service)" or "orchid or
  // pineapple frond"; the menu gets one plain garnish per idea, nothing marked as later or optional.
  function cleanGarnish(t) {
    if (!t || /\b(later|optional|modern|sometimes|occasionally|if available|idea|when practical|nobody expects|in the shape of|for the guest|full tiki|the fruit|named fruit|garnish)\b/i.test(t.replace(/\(.*?\)/g, ''))) return null;
    const s = t.replace(/\s*\(.*?\)\s*/g, ' ').split(/\s+or\s+|\s*\/\s*|;|:|,/)[0].replace(/\s+/g, ' ').trim().toLowerCase();
    return s && s.length <= 48 && s.split(' ').length >= 2 || ['orchid', 'gardenia', 'cherry', 'umbrella'].includes(s) ? s : null;
  }
  const garnishKey = g => /peel|twist|zest/i.test(g) ? 'peel' : (g.match(/mint|pineapple|lime|orange|lemon|cherr|orchid|flower|gardenia|umbrella|cinnamon|nutmeg|coffee|banana|grapefruit|cucumber|basil|ginger|sugar cane|shell|straw/i) || [g])[0].toLowerCase();
  // Garnish, the way the research says an aficionado wants it: aroma first, then one moment of
  // theater, and it never lies. Candidates come from the archetype, the family's conventions and
  // the prayer; a fruit garnish only signals a fruit that's in the drink (decorative flags excepted
  // where convention allows), never one the guest refused; up drinks get one pick or peel, hot
  // drinks nothing from the ice world, and the count fits the vessel.
  const GARNISH_RULES = {
    mai: { required: ['spent lime shell', 'mint sprig'], never: ['cherry', 'flag', 'umbrella'] },
    family: {
      'mai-tai': { required: ['spent lime shell', 'mint sprig'], typical: ['orchid'], never: ['cherry', 'flag', 'umbrella'] },
      zombie: { required: ['mint sprig'], typical: ['cherry on a pick', 'pineapple frond'], never: ['sugar rim', 'salt rim', 'whipped cream'] },
      grog: { typical: ['spent lime shell', 'mint sprig'], never: ['umbrella', 'orchid', 'flag'] },
      'beachcomber-sour': { typical: ['mint sprig', 'cherry on a pick', 'orange-peel spiral'], never: ['umbrella'] },
      swizzle: { required: ['mint sprig'], typical: ['swizzle stick'], never: ['umbrella', 'flag', 'cherry'] },
      daiquiri: { typical: ['lime wheel', 'grapefruit twist'], never: ['mint bouquet', 'umbrella', 'pineapple wedge', 'sugar rim'] },
      'orgeat-punch': { typical: ['gardenia', 'orchid', 'mint sprig'], never: ['whipped cream'] },
      colada: { required: ['pineapple wedge'], typical: ['maraschino cherry', 'grated nutmeg', 'paper umbrella'], never: ['mint bouquet'] },
      'resort-punch': { typical: ['paper umbrella', 'orchid', 'pineapple wedge', 'maraschino cherry', 'orange half-wheel'] },
      punch: { typical: ['grated nutmeg', 'lime wheel', 'mint sprig', 'orange half-wheel'], never: ['sugar rim'] },
      buck: { required: ['lime wheel'], typical: ['candied ginger', 'mint sprig'], never: ['umbrella', 'nutmeg', 'cherry'] },
      'bitter-tiki': { typical: ['pineapple wedge', 'orchid', 'mint sprig'], never: ['whipped cream', 'nutmeg'] },
      stirred: { required: ['expressed orange peel'], typical: ['cherry on a pick'], never: ['mint bouquet', 'umbrella'] },
      hot: { required: ['freshly grated nutmeg'], typical: ['cinnamon stick', 'clove-studded lemon peel'], never: ['umbrella', 'mint', 'pineapple', 'lime wheel'] },
    },
  };
  // A fruit garnish says "this fruit is in the drink".
  const SIGNALS = [
    [/pineapple/i, ['pineapple-juice', 'rum-pineapple']], [/orange (wheel|half|slice)|orange-peel|orange peel|orange twist/i, ['orange', 'orange-curacao', 'triple-sec', 'blue-curacao']],
    [/lime (wheel|wedge)|spent lime|lime shell/i, ['lime', 'lime-cordial']], [/lemon/i, ['lemon']], [/grapefruit/i, ['grapefruit', 'dons-mix']],
    [/banana/i, ['banana', 'banana-liqueur']], [/strawberr/i, ['strawberry']], [/passion/i, ['passion-fruit-juice', 'passion-fruit-syrup', 'passion-fruit-nectar', 'passion-fruit-liqueur', 'fassionola']],
    [/coffee bean/i, ['coffee', 'coffee-liqueur']], [/cucumber/i, ['cucumber']], [/candied ginger|ginger/i, ['ginger-beer', 'ginger-syrup', 'ginger-liqueur', 'ginger-ale']],
  ];
  const DECORATIVE_OK = new Set(['punch', 'resort-punch', 'beachcomber-sour', 'zombie', 'colada', 'bitter-tiki']);
  const FIRE_VESSELS = new Set(['ku-mug', 'moai-mug', 'skull-mug', 'barrel-mug', 'fog-cutter-mug', 'tiki-bowl', 'volcano-bowl', 'scorpion-bowl', 'coconut', 'pineapple', 'snifter']);
  function chooseGarnish(A, intent, lines, flavorTop, svc, vessel) {
    const g = A.garnish || {};
    const fam = GARNISH_RULES.family[A.family] || {};
    const ids = new Set(lines.filter(l => !l.garnish || l.muddled).map(l => l.id));
    const vid = vessel ? vessel.id : '';
    const service = svc.up ? 'up' : svc.method === 'hot' ? 'hot' : vessel && vessel.serve.includes('bowl') ? 'bowl'
      : ['coconut', 'pineapple'].includes(vid) ? 'fruit-vessel' : /mug/.test(vid) ? 'mug'
        : vessel && vessel.capacity >= 12 ? 'tall' : ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(svc.ice) ? 'short-crushed' : 'rocks';
    const max = { up: 1, rocks: 1, 'short-crushed': 2, tall: 3, mug: 3, 'fruit-vessel': 3, bowl: 4, hot: 2 }[service];
    const never = [...(g.never || []), ...(fam.never || [])].map(x => x.toLowerCase().replace(/\s*\(.*?\)/g, ''));
    const avoided = id => intent.avoidIngs.has(id) || Object.entries(intent.avoidTags).some(([t, w]) => w >= 1 && ((ingMap.get(id) || {}).flavors || []).includes(t));
    const ok = x => {
      if (!x) return false;
      if (never.some(n => n && (x.includes(n) || (n.split(' ').length === 1 && x.split(' ').includes(n))))) return false;
      for (const [re, sig] of SIGNALS) if (re.test(x)) {
        if (sig.some(avoided)) return false;
        const decorative = /frond|flag|cherry|pick/.test(x) && !/wedge|spear|chunk|slice|wheel/.test(x) && DECORATIVE_OK.has(A.family);
        if (!sig.some(id => ids.has(id)) && !decorative) return false;
      }
      if (service === 'up' && /bouquet|umbrella|wedge|flaming|straw|orchid|frond|ice cone/.test(x)) return false;
      if (service === 'hot' && /ice|mint|umbrella|pineapple|lime wheel|straw/.test(x)) return false;
      if (svc.ice !== 'ice-cone' && /ice cone/.test(x)) return false;
      if (/flaming/.test(x) && !(intent.style.flaming && FIRE_VESSELS.has(vid))) return false;
      return true;
    };
    const out = [];
    const add = x => { const c = cleanGarnish(x); if (ok(c) && out.length < max && !out.some(o => garnishKey(o) === garnishKey(c))) out.push(c); };
    if (svc.ice === 'ice-cone') add('straw through the ice cone');
    for (const r of [...(g.required || []), ...(fam.required || [])]) add(r);
    // Aromatics the drink is built around (mint on a Mai Tai, nutmeg on a Painkiller).
    const AROMA_WORD = { mint: 'mint sprig', nutmeg: 'freshly grated nutmeg', cinnamon: 'cinnamon stick', clove: 'clove-studded orange peel', basil: 'basil sprig', 'ginger-fresh': 'ginger coin' };
    for (const l of lines) if (l.role === 'aromatic' && !l.muddled && AROMA_WORD[l.id]) add(AROMA_WORD[l.id]);
    if (intent.style.flaming && FIRE_VESSELS.has(vid)) add('flaming lime shell');
    for (const idea of intent.garnishIdeas || []) if (DRAWABLE_GARNISH.test(idea)) add(idea);
    for (const t of [...(g.typical || []), ...(fam.typical || [])]) add(t);
    if (!out.length) for (const t of garnishFor(A.family, intent, lines, flavorTop)) add(t);
    if (!out.length && service === 'up') add(ids.has('lime') ? 'lime wheel' : ids.has('lemon') ? 'lemon twist' : 'orange twist');
    return out;
  }

  function garnishForArchetype(A, intent, lines, flavorTop) {
    const g = A.garnish || {};
    const never = (g.never || []).map(x => x.toLowerCase());
    const ok = x => x && !never.some(n => x.includes(n));
    const out = [];
    const add = x => { const c = cleanGarnish(x); if (ok(c) && out.length < 3 && !out.some(o => garnishKey(o) === garnishKey(c))) out.push(c); };
    for (const r of g.required || []) add(r);
    for (const idea of intent.garnishIdeas || []) if (DRAWABLE_GARNISH.test(idea)) add(idea);
    for (const t of g.typical || []) add(t);
    if (!out.length) for (const t of garnishFor(A.family, intent, lines, flavorTop)) add(t);
    return out;
  }
  const DRAWABLE_GARNISH = /mint|pineapple|lime|orange|cherr|orchid|flower|umbrella|cinnamon|nutmeg|coffee bean|peel|twist|shell/i;

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
