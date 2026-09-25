// Tiki drink generator. Everything it knows comes from the database (data/drinks.json)
// via the statistics in data/model.json; this file turns a prompt into a balanced recipe
// and explains where each choice came from.
import { indexIngredients, analyzeLines, lineOz, roleOf, round } from './chem.js';
import { flavorVector, normalize, cosine, lineImpact, tagWeights } from './flavor.js';
import { parsePrompt, buildNameIndex } from './prompt.js';
import { snap, amountString } from './format.js';
import { makeName } from './names.js';
import { serviceOf, SERVICE_FITS } from './vessels.js';

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

function softPick(rng, scored, temperature, greedy) {
  if (!scored.length) return null;
  scored.sort((a, b) => b.s - a.s);
  if (greedy) return scored[0].item;
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

export function createEngine({ vocab, families, drinks, model, vessels = { vessels: [] } }) {
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
    if (intent.color && ing.color) {
      const map = { blue: ['blue'], red: ['red'], pink: ['pink', 'red'], gold: ['yellow', 'orange'], green: ['green'], purple: [], dark: [] };
      if ((map[intent.color] || []).includes(ing.color)) s += 1.5;
    }
    if (intent.color === 'dark' && ['rum-black-blended', 'rum-jamaican-dark', 'rum-demerara', 'rum-black-overproof', 'coffee-liqueur'].includes(id)) s += 1;
    if (intent.ings[id]) s += intent.ings[id] * 1.5;
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
      const rl = lines.filter(l => l.role === role);
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
      if (l.req && ['modifier', 'sweet', 'juice'].includes(l.role)) l.oz = Math.max(l.oz, l.colorKey ? 0.75 : 0.5);
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
      const lo = l.req ? l.oz0 * 0.8 : l.role === 'sweet' ? Math.min(0.08, l.oz0) : l.oz0 * 0.4;
      const hi = Math.max(l.oz0 * 2.5, 0.5);
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

  function finalizeAmounts(lines) {
    for (const l of lines) {
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
  function chooseVessel(famId, intent, svc, chem, src, rng, greedy) {
    if (!vesselList.length) return null;
    const service = serviceOf(svc.method, svc.ice);
    const servings = intent.servings || 1;
    const bowl = !!intent.style.bowl || servings >= 3;
    const takes = v => v.serve.includes('bowl') ? bowl : !bowl && SERVICE_FITS[service].some(x => v.serve.includes(x));
    const needFor = v => {
      const base = chem.finalOz * (bowl ? servings : 1);
      if (service === 'crushed') return base * 1.5;
      if (service === 'frozen') return base * 1.1;
      return v.serve.includes('up') && service === 'shaken' ? base : service === 'hot' ? base : base * 1.35;
    };
    const fitOf = v => {
      const r = needFor(v) / v.capacity;
      if (r > 1.12) return 0;
      return r >= 0.5 ? 1 : Math.pow(r / 0.5, 1.5);
    };
    const asked = intent.vessel && vesselById[intent.vessel];
    if (asked) return { v: asked, why: 'asked' };
    // A riff keeps its source's vessel, or failing that the vessel of another spec of the same
    // drink that suits this serving (a single Scorpion rather than the bowl).
    if (src && famId === src.family) {
      const sameName = drinks.filter(d => d.name === src.name && d.vessel).sort((a, b) => (b.popularity - a.popularity) || ((CONF[b.confidence] || 0) - (CONF[a.confidence] || 0)));
      for (const d of [src, ...sameName]) {
        const v = vesselById[d.vessel];
        if (v && takes(v)) return { v, why: 'riff' };
      }
    }
    const F = (model.families[famId] || {}).vessels || {};
    const scored = [];
    for (const v of vesselList) {
      if (!takes(v)) continue;
      const fit = bowl ? 1 : fitOf(v);
      if (!fit) continue;
      let w = (F[v.id] || 0) + 0.3 * ((v.families || {})[famId] || 0) + 0.004;
      if (bowl && v.id === 'volcano-bowl' && intent.style.flaming) w += 2;
      if (bowl && v.id === 'punch-bowl' && ['punch', 'stirred', 'buck'].includes(famId)) w += 0.5;
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

  function steps(svc, lines, intent) {
    const g = svc.glass;
    const aG = `${/^[aeiou]/i.test(g) && !/^(u|one)/i.test(g) ? 'an' : 'a'} ${g}`;
    const floats = lines.filter(l => l.float);
    const lengthener = lines.find(l => l.role === 'lengthener');
    const bitters = lines.filter(l => ingMap.get(l.id).cat === 'bitters');
    const mint = lines.find(l => l.id === 'mint');
    const out = [];
    const main = lines.filter(l => !l.float && l.role !== 'aromatic' && l !== lengthener);
    const mul = intent.servings > 1 ? ` (multiply everything by ${intent.servings})` : '';
    switch (svc.method) {
      case 'flash-blend':
        out.push(`Add everything${lengthener ? ` except the ${displayName(lengthener.id)}` : ''} to a blender cup with 12 oz (1½ cups) of crushed ice${mul}.`);
        out.push('Flash-blend for 3–5 seconds — or shake very hard with crushed ice if you have no spindle mixer.');
        out.push(`Open-pour everything, ice and all, into ${aG}; top with more crushed ice.`);
        break;
      case 'blend':
        out.push(`Add everything to a blender with 1 cup (8 oz) of crushed ice${mul}.`);
        out.push(`Blend until smooth and thick, then pour into ${aG}.`);
        break;
      case 'swizzle':
        if (mint) out.push(`Lightly muddle the mint in the bottom of ${aG}.`);
        out.push(`Add the remaining ingredients${bitters.length ? ` except the ${bitters.map(b => displayName(b.id)).join(' and ')}` : ''}${mul}.`);
        out.push('Fill two-thirds with crushed ice and swizzle until the glass frosts over; pack with more ice.');
        if (bitters.length) out.push(`Dash the ${bitters.map(b => displayName(b.id)).join(' and ')} over the top to form a red crown.`);
        break;
      case 'stir':
        out.push(`Stir everything with ice for 20–30 seconds${mul}.`);
        out.push(svc.up ? `Strain into a chilled ${g}.` : `Strain into ${aG} over one large cube.`);
        break;
      case 'build':
      case 'muddle-build':
        out.push(`Build in ${aG} over ice${mul}.`);
        break;
      case 'hot':
        out.push(`Preheat ${aG} with boiling water, then empty it.`);
        out.push(`Add everything${lengthener ? ` except the ${displayName(lengthener.id)}` : ''} and stir to dissolve${mul}.`);
        break;
      default:
        if (svc.ice === 'cubed') {
          out.push(`Shake everything${lengthener ? ` except the ${displayName(lengthener.id)}` : ''} hard with cubed ice for 10–12 seconds${mul}.`);
          out.push(`Strain into a chilled ${g}${svc.up ?? /coupe|cocktail/.test(g) ? '' : ' over fresh ice'}.`);
        } else {
          out.push(`Shake everything${lengthener ? ` except the ${displayName(lengthener.id)}` : ''} with 12 oz of crushed ice for 8–10 seconds${mul}.`);
          out.push(`Open-pour, ice and all, into ${aG}; top with crushed ice to fill.`);
        }
    }
    if (lengthener) out.push(svc.method === 'hot' ? `Top with ${lengthener.amount} oz of steaming ${displayName(lengthener.id).toLowerCase()}.` : `Top with ${displayName(lengthener.id).toLowerCase()} and give one gentle stir.`);
    for (const f of floats) out.push(`Float the ${displayName(f.id)} on top.`);
    if (intent.style.flaming) out.push('Theatrics (optional, carefully): set a spent lime half on the ice, add a crouton or sugar cube soaked in lemon extract or 151 rum, and light it. Keep hair, sleeves and straws clear, and never pour spirit onto a flame.');
    return out;
  }

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
    return { tasting, influences, whyItWorks, lineage, ingredientNotes };
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
  function generate(prompt, { seed = 0 } = {}) {
    swappedOut.clear();
    const intent = parsePrompt(prompt, { nameIndex });
    const rng = rngFrom(`${prompt}::${seed}`);
    const greedy = seed === 0;
    const notes = [];
    const riffSrc = intent.riffOf ? drinkById[intent.riffOf] : null;
    // Asking for whole fruit (strawberries, a banana) means the blender.
    if (!intent.style.hot && Object.entries(intent.ings).some(([id, w]) => w >= 1.5 && (ingMap.get(id) || {}).oz_per_piece && id !== 'egg-white')) intent.style.frozen = true;
    blenderContext = !!intent.style.frozen || (riffSrc && riffSrc.method === 'blend');
    let famId;
    if (riffSrc && !(intent.style.hot && riffSrc.family !== 'hot')) famId = riffSrc.family;
    else {
      // No real signal ("surprise me")? Let the roll roam instead of always landing on the biggest family.
      const blank = !Object.keys(intent.tags).length && !intent.spirits.length && !Object.keys(intent.ings).length && !Object.keys(intent.style).length && !Object.keys(intent.fam).length;
      famId = softPick(rng, familyScores(intent), blank ? 2.5 : 0.9, greedy && !blank);
      if (blank) intent.complexity = Math.max(intent.complexity, 0.6);
    }

    blenderContext = blenderContext || Object.keys(model.families[famId].methods || {})[0] === 'blend';
    let lines = riffSrc && famId === riffSrc.family ? buildRiff(riffSrc, intent, rng, greedy, notes) : buildFresh(famId, intent, rng, greedy, notes);
    if (!riffSrc || famId !== riffSrc.family) {
      injectRequests(lines, model.families[famId], intent, rng, greedy, notes);
      // A fresh build that lands on top of an existing recipe isn't new: nudge it until it is.
      for (let tries = 0; tries < 3; tries++) {
        const twin = closestTwin(lines);
        if (!twin || twin.s < 0.8) break;
        const before = notes.length;
        varyOne(lines, model.families[famId], intent, rng, greedy && tries === 0, notes);
        if (notes.length === before) break;
        notes[notes.length - 1] = `${notes[notes.length - 1]} (to step away from the ${drinkById[twin.id].name})`;
      }
    }
    lines = lines.filter(l => ingMap.has(l.id));

    // Aromatic garnish that carries a requested or family-typical flavor.
    const F = model.families[famId];
    for (const id of ['mint', 'nutmeg', 'cinnamon']) {
      if (lines.some(l => l.id === id) || forbidden(id, intent)) continue;
      const tagAsk = intent.tags[id] || 0;
      const famUse = (F.ingredients[id] || {}).share || 0;
      if (tagAsk >= 1 || famUse >= 0.35) lines.push({ id, role: 'aromatic', garnish: true });
    }

    // Anything that carries an explicitly requested flavor (or color) is protected from the balancer.
    for (const l of lines) {
      const v = ingVec[l.id] || {};
      if (Object.entries(intent.tags).some(([t, w]) => w >= 1.4 && (v[t] || 0) >= 0.55)) l.req = true;
      const ing = ingMap.get(l.id);
      if (intent.color && ing && ing.color && ({ blue: ['blue'], red: ['red'], pink: ['pink', 'red'], gold: ['yellow'], green: ['green'] }[intent.color] || []).includes(ing.color)) { l.req = true; l.colorKey = true; }
    }
    ensureStructure(lines, famId, intent);
    const svc = service(famId, intent, lines, riffSrc && famId === riffSrc.family ? riffSrc : null);
    // Asked for a coconut or a coupe? Serve the drink the way that vessel holds it.
    const askedV = intent.vessel && vesselById[intent.vessel];
    if (askedV && !askedV.serve.includes('bowl') && !SERVICE_FITS[serviceOf(svc.method, svc.ice)].some(x => askedV.serve.includes(x))) {
      if (askedV.serve.includes('crushed')) { if (svc.method === 'blend' || svc.method === 'stir') svc.method = 'shake'; svc.ice = 'crushed'; }
      else if (askedV.serve.includes('frozen')) { svc.method = 'blend'; svc.ice = 'blended'; }
      else if (askedV.serve.includes('up')) { if (!['shake', 'stir'].includes(svc.method)) svc.method = 'shake'; svc.ice = 'cubed'; }
      else if (askedV.serve.includes('rocks')) { if (!['shake', 'stir', 'build'].includes(svc.method)) svc.method = 'shake'; svc.ice = 'cubed'; }
    }
    initialDoses(lines, famId, intent);
    const T = riffSrc && famId === riffSrc.family ? riffTargets(riffSrc, famId, intent, svc) : targetsFor(famId, intent, svc.method, svc.ice);
    balance(lines, T);
    finalizeAmounts(lines);
    // Aromatics & zero-volume lines are displayed as garnish-style lines.
    lines.sort((a, b) => ROLE_ORDER.concat(['aromatic']).indexOf(a.role) - ROLE_ORDER.concat(['aromatic']).indexOf(b.role) || b.oz - a.oz);

    const chem = chemOf(lines, svc.method, svc.ice);
    const profile = profileOf(lines.map(l => ({ id: l.id, amount: l.oz, unit: 'oz', garnish: l.role === 'aromatic' })), 1, svc.method, svc.ice);
    const flavorTop = Object.entries(profile.flavor).sort((a, b) => b[1] - a[1]).map(([t]) => t).filter(t => !['light', 'crisp', 'dry', 'sweet', 'citrus', 'tart'].includes(t)).slice(0, 5);
    const garnish = garnishFor(famId, intent, lines, flavorTop);
    const pick = chooseVessel(famId, intent, svc, chem, riffSrc, rngFrom(`${prompt}::${seed}::vessel`), greedy);
    if (pick) { svc.glass = pick.v.name; svc.vessel = pick.v.id; svc.up = pick.v.serve.includes('up') && serviceOf(svc.method, svc.ice) === 'shaken'; }
    const name = makeName(rng, {
      family: famId, flavorTags: [...Object.entries(intent.tags).sort((a, b) => b[1] - a[1]).map(([t]) => t), ...flavorTop], color: intent.color,
      baseIds: lines.filter(l => l.role === 'base').map(l => l.id), mood: intent.matched.some(m => m.label === 'spooky') ? 'spooky' : null, taken: takenNames,
    });
    const recipe = {
      name,
      prompt,
      seed,
      family: { id: famId, name: famById[famId].name },
      riffOf: riffSrc ? { id: riffSrc.id, name: riffSrc.name } : null,
      heard: intent.matched.map(m => m.label).concat(intent.diets),
      servings: intent.servings,
      lines: lines.map(l => ({
        id: l.id, name: displayName(l.id), role: l.role, oz: round(l.oz, 3), amount: l.amount, unit: l.unit, float: !!l.float,
        garnish: l.role === 'aromatic', examples: ingMap.get(l.id).examples || [], avail: ingMap.get(l.id).avail,
      })),
      method: { ...svc, steps: steps(svc, lines, intent) },
      vessel: pick ? { id: pick.v.id, name: pick.v.name, kind: pick.v.kind, story: pick.v.story || '', why: pick.why } : null,
      garnish,
      flavor: flavorTop,
      stats: {
        abv: round(chem.abv, 1), sugarConc: round(chem.sugarConc, 1), acidConc: round(chem.acidConc, 2),
        sweetSour: chem.sweetSour === null ? null : round(chem.sweetSour, 1), volOz: round(chem.volOz, 2), finalOz: round(chem.finalOz, 1),
        family: pickMetrics(model.families[famId].metrics),
      },
    };
    recipe.style = { ...intent.style };
    recipe.notes = notes.filter(n => n !== 'split-base').map(n => n.replace(/^riff:/, ''));
    recipe.tagline = tagline(recipe, intent);
    recipe.explanation = explain(recipe, profile, famId, intent, riffSrc, notes);
    return recipe;
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

  return { generate, describeDrink, parse: p => parsePrompt(p, { nameIndex }), ingMap, famById, drinkById };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
function firstSentences(text, n) {
  const parts = (text || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  return parts.slice(0, n).join('').trim();
}

export { amountString };
