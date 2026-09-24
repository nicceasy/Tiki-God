// Flavor vectors: a bag of flavor tags weighted by how loudly each ingredient speaks.
import { lineOz, roleOf } from './chem.js';

// How much flavor one ounce of an ingredient contributes, by role.
const IMPACT = {
  base: 1, modifier: 1.5, sour: 1, sweet: 1.2, juice: 0.8, rich: 1.2, lengthener: 0.4,
};

export function lineImpact(line, ing, units, servings = 1) {
  const role = roleOf(line, ing);
  if (role === 'aromatic') return 0.4;
  const oz = lineOz(line, ing, units) / (servings || 1);
  if (role === 'accent') return Math.min(oz * 12, 1.5) || 0.3;
  return oz * (IMPACT[role] ?? 1);
}

export function flavorVector(lines, ingMap, units, servings = 1, chem = null) {
  const v = {};
  for (const line of lines) {
    const ing = ingMap.get(line.id);
    if (!ing) continue;
    const w = lineImpact(line, ing, units, servings);
    const tw = tagWeights(ing.flavors || []);
    for (const t in tw) v[t] = (v[t] || 0) + w * tw[t];
  }
  if (chem) {
    // Structural impressions that come from the balance rather than a single ingredient.
    if (chem.sugarConc > 9) v.sweet = (v.sweet || 0) + (chem.sugarConc - 9) * 0.15;
    if (chem.acidConc > 0.9) v.tart = (v.tart || 0) + (chem.acidConc - 0.9) * 1.5;
    if (chem.abv > 18) v.boozy = (v.boozy || 0) + (chem.abv - 18) * 0.1;
  }
  return v;
}

// The first-listed flavor of an ingredient is its dominant one; later tags fade.
export function tagWeights(tags) {
  const raw = tags.map((t, i) => [t, 1 / (1 + 0.5 * i)]);
  const n = Math.sqrt(raw.reduce((s, [, w]) => s + w * w, 0)) || 1;
  return Object.fromEntries(raw.map(([t, w]) => [t, w / n]));
}

export function normalize(v) {
  let s = 0;
  for (const k in v) s += v[k] * v[k];
  const n = Math.sqrt(s) || 1;
  const out = {};
  for (const k in v) out[k] = v[k] / n;
  return out;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
  for (const k in b) nb += b[k] * b[k];
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
}

export function topTags(v, n = 6) {
  return Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
