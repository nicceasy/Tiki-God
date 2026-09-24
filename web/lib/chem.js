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
export function dilutionFactor(method, ice, abvFrac) {
  const a = Math.max(0, Math.min(abvFrac, 0.6));
  const shaken = -1.567 * a * a + 1.742 * a + 0.203;
  const stirred = -1.21 * a * a + 1.246 * a + 0.145;
  switch (method) {
    case 'hot': return 0;
    case 'blend': return 0.9;          // frozen: ice becomes part of the drink
    case 'stir': return stirred;
    case 'build': return ice === 'none' ? 0 : stirred * 0.8;
    case 'muddle-build': return stirred;
    case 'swizzle': return shaken * 1.2;
    case 'flash-blend': return shaken * 1.3;
    case 'shake':
    default: return ice === 'crushed' || ice === 'pebble' || ice === 'shaved' || ice === 'ice-cone' ? shaken * 1.15 : shaken;
  }
}

// Full chemistry for a list of lines. Returns per-serving values.
export function analyzeLines(lines, ingMap, units, { method = 'shake', ice = 'crushed', servings = 1 } = {}) {
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
  const dil = dilutionFactor(method, ice, abvPre);
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
