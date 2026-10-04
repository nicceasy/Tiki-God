// Drink chemistry shared by the analysis scripts (Node) and the generator (browser).
// Units: volumes in US fl oz; sugar/acid in grams; concentrations in g/100 ml; abv in %.

export const ML_PER_OZ = 29.5735;
export const TOP_DEFAULT_OZ = 2;

export function indexIngredients(vocab) {
  const map = new Map();
  for (const ing of vocab.ingredients) map.set(ing.id, ing);
  return map;
}

// Volume in oz for one ingredient line. Zero-volume units (garnish, sprig...) return 0.
export function lineOz(line, ing, units) {
  const u = line.unit;
  if (u === 'top') return typeof line.amount === 'number' && line.amount > 0 ? line.amount : TOP_DEFAULT_OZ;
  if (u === 'piece') return (line.amount || 1) * ((ing && ing.oz_per_piece) || 0);
  const factor = units[u];
  if (factor === undefined || factor === null) return 0;
  return (line.amount || 0) * factor;
}

// Dilution fraction (water added / pre-dilution volume) from pre-dilution ABV (0..1).
// Shaken/stirred curves are Dave Arnold's (Liquid Intelligence); crushed-ice methods
// are scaled up because tiki drinks are shaken with and served over crushed ice.
export function dilutionFactor(method, ice, abvFrac, { lean = false } = {}) {
  const a = Math.max(0, Math.min(abvFrac, 0.6));
  const shaken = -1.567 * a * a + 1.742 * a + 0.203;
  const stirred = -1.21 * a * a + 1.246 * a + 0.145;
  switch (method) {
    case 'hot': return 0;
    // frozen: ice becomes part of the drink. A less-sweet frozen drink is blended with about a
    // quarter less ice, so it reaches the frozen sugar floor with less dilution, not more sugar.
    case 'blend': return lean ? 0.65 : 0.9;
    case 'stir': return stirred;
    // Built over a punch bowl's block, the batch gets cold water standing in for the dilution a
    // shake would give (about a fifth of the mix: engine steps()), and the block melts on top.
    case 'build': return ice === 'none' ? 0 : ice === 'block' ? stirred * 0.8 + 0.2 : stirred * 0.8;
    case 'muddle-build': return stirred;
    case 'swizzle': return shaken * 1.2;
    case 'flash-blend': return shaken * 1.3;
    case 'shake':
    default: return ice === 'crushed' || ice === 'pebble' || ice === 'shaved' || ice === 'ice-cone' ? shaken * 1.15 : shaken;
  }
}

// Full chemistry for a list of lines. Returns per-serving values.
export function analyzeLines(lines, ingMap, units, { method = 'shake', ice = 'crushed', servings = 1, lean = false } = {}) {
  let vol = 0, alc = 0, sugar = 0, acid = 0;
  const byRole = {};
  const byId = {};
  for (const line of lines) {
    const ing = ingMap.get(line.id);
    if (!ing) continue;
    const oz = lineOz(line, ing, units) / (servings || 1);
    const ml = oz * ML_PER_OZ;
    vol += oz;
    alc += ml * (ing.abv || 0) / 100;          // ml ethanol
    sugar += ml * (ing.sugar || 0) / 100;      // g
    acid += ml * (ing.acid || 0) / 100;        // g
    const role = roleOf(line, ing);
    byRole[role] = (byRole[role] || 0) + oz;
    byId[line.id] = (byId[line.id] || 0) + oz;
  }
  const volMl = vol * ML_PER_OZ;
  const abvPre = volMl > 0 ? alc / volMl : 0;
  let dil = dilutionFactor(method, ice, abvPre, { lean });
  // Over a punch bowl's block, a water line already is (part of) the batch's cold water.
  if (method === 'build' && ice === 'block' && vol > 0) dil -= Math.min(0.2, (byId.water || 0) / vol);
  const finalMl = volMl * (1 + dil);
  return {
    volOz: vol,
    finalOz: finalMl / ML_PER_OZ,
    alcMl: alc,
    sugarG: sugar,
    acidG: acid,
    abvPre: abvPre * 100,
    abv: finalMl > 0 ? (alc / finalMl) * 100 : 0,
    sugarConc: finalMl > 0 ? (sugar / finalMl) * 100 : 0,
    acidConc: finalMl > 0 ? (acid / finalMl) * 100 : 0,
    sweetSour: acid > 0.05 ? sugar / acid : null,
    dilution: dil,
    byRole,
    byId,
  };
}

// Role of an ingredient as used in a specific line. Tiny doses of potent things act as accents.
export function roleOf(line, ing) {
  if (line.garnish) return 'aromatic';
  if (ing.role === 'base' && line.float) return 'base';
  return ing.role;
}

export function round(x, d = 2) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

// ---------- absolute bands ----------
// A sugar-to-acid ratio alone can't tell a 26 g "punch" from a balanced one (26.4 / 1.38 is a
// fine ratio). These are the bands a pro pours to, in grams per 100 ml of the finished, diluted
// drink, by how the drink is made (data/technique-rules.json absoluteBands): a shaken sour 8–11,
// a frozen sour 8.5–12 with 0.55–0.85 acid, a punch over a block 9–11, a stirred drink under 10,
// a hot drink 3–7, and nothing that isn't dessert past about 13. A directional ask ("less
// sweet", "very tart") moves the band instead of being overridden by it.
export const DEFAULT_BANDS = {
  shakenSour: { sugar: [8, 11] },
  frozenSour: { sugar: [8.5, 12], acid: [0.55, 0.85] },
  frozenCreamy: { sugar: [8.5, 13] },
  punch: { sugar: [9, 11] },
  stirred: { sugar: [0, 10] },
  hot: { sugar: [3, 7] },
  hotCreamy: { sugar: [3, 10] },
  ceiling: 13, dessertCeiling: 15, acidCeiling: 1.2, acidCeilingTart: 1.45, fatalSugar: 16,
};
// kind: what the band is judged as. ctx: { method, ice, servings, punchBowl, sour, creamy,
// dessert, sweetness, tartness }.
export function bandKind({ method = 'shake', ice = '', servings = 1, punchBowl = false, sour = false, creamy = false } = {}) {
  if (method === 'hot') return creamy ? 'hotCreamy' : 'hot';
  if (method === 'blend') return sour && !creamy ? 'frozenSour' : 'frozenCreamy';
  if (punchBowl || ((servings || 1) >= 2 && method === 'build' && ice === 'block')) return 'punch';
  if (method === 'stir' || (method === 'build' && ice !== 'block' && !sour && !creamy)) return 'stirred';
  if (method === 'shake' && sour && !creamy) return 'shakenSour';
  return 'open';
}
export function sugarBand(ctx = {}, bands = DEFAULT_BANDS) {
  const B = { ...DEFAULT_BANDS, ...(bands || {}) };
  const kind = bandKind(ctx);
  const ceiling = ctx.dessert ? B.dessertCeiling : B.ceiling;
  const k = B[kind] || {};
  let [lo, hi] = k.sugar || [0, ceiling];
  hi = Math.min(hi, ceiling);
  let acid = k.acid ? [...k.acid] : [0, B.acidCeiling];
  const sweet = Math.max(-2, Math.min(2, ctx.sweetness || 0)), tart = Math.max(-2, Math.min(2, ctx.tartness || 0));
  // "Less sweet" lowers the whole band; "tart" lowers the floor and lifts the acid ceiling.
  // Cold mutes sugar, so a frozen drink gives less ground: "less sweet" frozen still clears 8 g.
  const frozen = kind === 'frozenSour' || kind === 'frozenCreamy';
  if (sweet < 0) { lo *= frozen ? Math.max(0.92, 1 - 0.03 * -sweet) : Math.max(0.4, 1 - 0.22 * -sweet); hi *= Math.max(0.7, 1 - 0.1 * -sweet); }
  if (tart > 0) { lo *= frozen ? Math.max(0.9, 1 - 0.05 * tart) : Math.max(0.4, 1 - 0.28 * tart); acid = [acid[0], Math.max(acid[1], kind === 'frozenSour' ? 1 : B.acidCeilingTart)]; }
  if (sweet > 0) { lo *= 1 + 0.06 * sweet; hi = Math.min(B.dessertCeiling, hi * (1 + 0.08 * sweet)); }
  return { kind, sugar: [lo, hi], acid };
}

// The balance word from absolute numbers, never from the ratio alone: over 12 g a drink is sweet
// whatever its acid; "tart and bracing" needs real acid (0.9 g) and restrained sugar (9 g); a
// frozen drink's words sit a gram higher (cold mutes sugar); a hot drink with no citrus is soft
// and round, not "barely tart".
export function balanceWord(stats = {}, { method = '', creamy = false, buttery = false, askedTart = false } = {}) {
  const sugar = stats.sugarConc || 0, acid = stats.acidConc || 0;
  const shift = method === 'blend' ? 1 : 0;
  if (method === 'hot' && acid < 0.2) return 'No citrus, soft and round.';
  if (sugar > 12) return acid >= 0.6 ? 'Sweet, with enough acid to keep it bright.' : 'Sweet and round.';
  if (acid < 0.2) return creamy || buttery ? 'Rich and round, barely tart.' : sugar > 6 ? 'Soft and round, with almost no sourness.' : 'Dry and spirit-forward.';
  if (creamy && acid < 0.4) return 'Rich and round, barely tart.';
  if (acid >= 0.9 && sugar <= 9 + shift) return 'Tart and bracing.';
  if (creamy) return 'Rich, with a citrus edge to cut it.';
  if ((acid >= 0.8 || (askedTart && acid >= 0.65)) && sugar <= 10 + shift) return 'Balanced, leaning tart.';
  if (sugar >= 10.5 + shift) return acid < 0.45 ? 'On the sweet side, barely tart.' : 'Balanced, leaning rich.';
  if (acid < 0.45 && sugar > 8 + shift) return 'On the sweet side, barely tart.';
  return 'Sweet and sour in balance.';
}
