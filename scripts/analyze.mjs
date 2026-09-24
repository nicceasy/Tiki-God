#!/usr/bin/env node
// Analyze data/drinks.json and emit:
//   data/model.json    — statistics the generator uses (family skeletons, dose ranges, pairings, balance targets)
//   docs/analysis.md   — human-readable report of the same numbers
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexIngredients, analyzeLines, lineOz, roleOf, round } from '../web/lib/chem.js';
import { flavorVector, normalize, topTags } from '../web/lib/flavor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const vocab = read('data/ingredients.json');
const families = read('data/families.json').families;
const drinks = read('data/drinks.json');
const ingMap = indexIngredients(vocab);
const units = vocab.units;

// Popular drinks count more: "we know they are good."
const POP_W = { 1: 1, 2: 1.3, 3: 1.8, 4: 2.6, 5: 4 };
const CONF_W = { high: 1, medium: 0.85, low: 0.6 };
const weightOf = d => POP_W[d.popularity] * (CONF_W[d.confidence] ?? 0.8);
const ROLES = ['base', 'modifier', 'sour', 'sweet', 'juice', 'rich', 'accent', 'lengthener', 'aromatic'];

// ---------- per-drink facts ----------
const facts = drinks.map(d => {
  const servings = d.servings || 1;
  const chem = analyzeLines(d.ingredients, ingMap, units, { method: d.method, ice: d.ice, servings });
  const roleCount = {};
  const roleIds = {};
  const spirits = new Set();
  const rums = new Set();
  let baseOz = 0;
  for (const line of d.ingredients) {
    const ing = ingMap.get(line.id);
    if (!ing) continue;
    const role = roleOf(line, ing);
    (roleIds[role] ||= new Set()).add(line.id);
    const oz = lineOz(line, ing, units) / servings;
    if (role === 'base') {
      baseOz += oz;
      if (oz >= 0.2) spirits.add(line.id);
      if (ing.cat === 'rum' && oz >= 0.2) rums.add(line.id);
    }
  }
  for (const r in roleIds) roleCount[r] = roleIds[r].size;
  const nIngredients = new Set(d.ingredients.filter(l => !l.garnish).map(l => l.id)).size;
  const flavor = flavorVector(d.ingredients, ingMap, units, servings, chem);
  const roleFrac = {};
  for (const r of ROLES) roleFrac[r] = chem.volOz > 0 ? (chem.byRole[r] || 0) / chem.volOz : 0;
  return {
    d, w: weightOf(d), chem, roleCount, roleFrac, baseOz, nIngredients,
    nSpirits: spirits.size, nRums: rums.size, rumIds: [...rums], flavor,
    ids: [...new Set(d.ingredients.map(l => l.id))],
  };
});

// ---------- helpers ----------
function wQuantiles(pairs) { // pairs: [value, weight]
  const xs = pairs.filter(([v]) => v !== null && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  if (!xs.length) return null;
  const total = xs.reduce((s, [, w]) => s + w, 0);
  const q = p => {
    let acc = 0;
    for (const [v, w] of xs) { acc += w; if (acc >= p * total) return v; }
    return xs[xs.length - 1][0];
  };
  return {
    n: xs.length, min: round(xs[0][0]), p10: round(q(0.1)), p25: round(q(0.25)), median: round(q(0.5)),
    p75: round(q(0.75)), p90: round(q(0.9)), max: round(xs[xs.length - 1][0]),
    mean: round(xs.reduce((s, [v, w]) => s + v * w, 0) / total),
  };
}
const metricOf = {
  volOz: f => f.chem.volOz, finalOz: f => f.chem.finalOz, abv: f => f.chem.abv, abvPre: f => f.chem.abvPre,
  sugarConc: f => f.chem.sugarConc, acidConc: f => f.chem.acidConc, sweetSour: f => f.chem.sweetSour,
  sugarG: f => f.chem.sugarG, acidG: f => f.chem.acidG, alcMl: f => f.chem.alcMl,
  nIngredients: f => f.nIngredients, nSpirits: f => f.nSpirits, nRums: f => f.nRums, baseOz: f => f.baseOz,
};
function metrics(fs) {
  const out = {};
  for (const [k, fn] of Object.entries(metricOf)) out[k] = wQuantiles(fs.map(f => [fn(f), f.w]));
  return out;
}
function countTable(fs, keyFn) {
  const t = {};
  let total = 0;
  for (const f of fs) { const k = keyFn(f); if (k == null) continue; t[k] = (t[k] || 0) + f.w; total += f.w; }
  for (const k in t) t[k] = round(t[k] / total, 3);
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
}
function topStrings(list, n = 8) {
  const c = {};
  for (const s of list) { if (!s) continue; const k = s.toLowerCase().trim(); c[k] = (c[k] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ text: k, n: v }));
}

// ---------- ingredient stats ----------
const totalW = facts.reduce((s, f) => s + f.w, 0);
const ingStats = {};
for (const f of facts) {
  const servings = f.d.servings || 1;
  const seen = new Set();
  for (const line of f.d.ingredients) {
    const ing = ingMap.get(line.id);
    if (!ing) continue;
    const s = (ingStats[line.id] ||= { n: 0, w: 0, doses: [], units: {}, families: {}, roles: {}, floats: 0, garnish: 0 });
    const oz = lineOz(line, ing, units) / servings;
    if (!seen.has(line.id)) { s.n++; s.w += f.w; s.families[f.d.family] = (s.families[f.d.family] || 0) + f.w; seen.add(line.id); }
    if (oz > 0) s.doses.push([oz, f.w]);
    s.units[line.unit] = (s.units[line.unit] || 0) + 1;
    const role = roleOf(line, ing);
    s.roles[role] = (s.roles[role] || 0) + 1;
    if (line.float) s.floats++;
    if (line.garnish) s.garnish++;
  }
}
const ingredientsOut = {};
for (const [id, s] of Object.entries(ingStats)) {
  const dq = wQuantiles(s.doses);
  const famTotal = Object.values(s.families).reduce((a, b) => a + b, 0);
  ingredientsOut[id] = {
    n: s.n,
    share: round(s.w / totalW, 4),
    dose: dq ? dq.median : 0,
    doseQ: dq ? [dq.p25, dq.p75] : [0, 0],
    doseMax: dq ? dq.p90 : 0,
    unit: Object.entries(s.units).sort((a, b) => b[1] - a[1])[0][0],
    families: Object.fromEntries(Object.entries(s.families).map(([k, v]) => [k, round(v / famTotal, 3)]).sort((a, b) => b[1] - a[1])),
    floatShare: round(s.floats / s.n, 2),
  };
}

// ---------- pairings (PMI) ----------
const pairCount = {};
const pairEx = {};
const idW = {};
for (const f of facts) {
  const ids = f.ids.filter(id => ingMap.has(id));
  for (const a of ids) idW[a] = (idW[a] || 0) + f.w;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
    const k = a + '|' + b;
    pairCount[k] = (pairCount[k] || { n: 0, w: 0 });
    pairCount[k].n++; pairCount[k].w += f.w;
    (pairEx[k] ||= []).push(f);
  }
}
const pairs = {};
for (const [k, c] of Object.entries(pairCount)) {
  if (c.n < 2) continue;
  const [a, b] = k.split('|');
  const pmi = Math.log2((c.w * totalW) / (idW[a] * idW[b]));
  const ex = pairEx[k].sort((x, y) => y.d.popularity - x.d.popularity || (x.d.year ?? 9999) - (y.d.year ?? 9999)).slice(0, 3).map(x => x.d.id);
  const entry = { pmi: round(pmi, 2), n: c.n, ex };
  (pairs[a] ||= {})[b] = entry;
  (pairs[b] ||= {})[a] = entry;
}

// Tag-level affinity for ingredients with too little data.
const tagW = {};
const tagPairW = {};
for (const f of facts) {
  const tags = Object.entries(f.flavor).filter(([, v]) => v >= 0.25).map(([t]) => t).sort();
  for (const t of tags) tagW[t] = (tagW[t] || 0) + f.w;
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    const k = tags[i] + '|' + tags[j];
    tagPairW[k] = (tagPairW[k] || 0) + f.w;
  }
}
const tagPairs = {};
for (const [k, w] of Object.entries(tagPairW)) {
  const [a, b] = k.split('|');
  const pmi = round(Math.log2((w * totalW) / (tagW[a] * tagW[b])), 2);
  (tagPairs[a] ||= {})[b] = pmi;
  (tagPairs[b] ||= {})[a] = pmi;
}

// ---------- rum blends ----------
const combos = {};
for (const f of facts) {
  if (f.rumIds.length < 2) continue;
  const key = [...f.rumIds].sort().join('+');
  (combos[key] ||= { rums: key.split('+'), n: 0, w: 0, ex: [] });
  combos[key].n++; combos[key].w += f.w; combos[key].ex.push(f.d.id);
}
const rumCombos = Object.values(combos).sort((a, b) => b.w - a.w).slice(0, 40)
  .map(c => ({ rums: c.rums, n: c.n, ex: c.ex.slice(0, 4) }));

// ---------- families ----------
const familiesOut = {};
for (const fam of families) {
  const fs = facts.filter(f => f.d.family === fam.id);
  if (!fs.length) { familiesOut[fam.id] = { n: 0 }; continue; }
  const roleOz = {}, roleFrac = {}, roleCount = {};
  for (const r of ROLES) {
    roleOz[r] = wQuantiles(fs.map(f => [f.chem.byRole[r] || 0, f.w]));
    roleFrac[r] = wQuantiles(fs.map(f => [f.roleFrac[r], f.w]));
    const hist = [0, 0, 0, 0];
    let tw = 0;
    for (const f of fs) { hist[Math.min(f.roleCount[r] || 0, 3)] += f.w; tw += f.w; }
    roleCount[r] = hist.map(x => round(x / tw, 3));
  }
  const famW = fs.reduce((s, f) => s + f.w, 0);
  const ing = {};
  for (const f of fs) for (const id of f.ids) ing[id] = (ing[id] || 0) + f.w;
  const doses = {};
  for (const f of fs) for (const line of f.d.ingredients) {
    const i = ingMap.get(line.id); if (!i) continue;
    const oz = lineOz(line, i, units) / (f.d.servings || 1);
    if (oz > 0) (doses[line.id] ||= []).push([oz, f.w]);
  }
  const ingredients = Object.fromEntries(Object.entries(ing).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id, w]) => {
    const q = wQuantiles(doses[id] || []);
    return [id, { share: round(w / famW, 3), dose: q ? q.median : 0, doseQ: q ? [q.p25, q.p75] : [0, 0] }];
  }));
  const centroid = {};
  for (const f of fs) { const nv = normalize(f.flavor); for (const t in nv) centroid[t] = (centroid[t] || 0) + nv[t] * f.w; }
  for (const t in centroid) centroid[t] = round(centroid[t] / famW, 3);
  familiesOut[fam.id] = {
    n: fs.length,
    weight: round(famW, 1),
    popularity: round(fs.reduce((s, f) => s + f.d.popularity, 0) / fs.length, 2),
    metrics: metrics(fs),
    roleOz, roleFrac, roleCount,
    ingredients,
    methods: countTable(fs, f => f.d.method),
    ice: countTable(fs, f => f.d.ice),
    glasses: topStrings(fs.map(f => f.d.glass)),
    garnishes: topStrings(fs.flatMap(f => f.d.garnish || []), 12),
    flavor: Object.fromEntries(Object.entries(centroid).sort((a, b) => b[1] - a[1]).slice(0, 20)),
    exemplars: fs.slice().sort((a, b) => b.d.popularity - a.d.popularity || b.w - a.w).slice(0, 8).map(f => f.d.id),
    eras: countTable(fs, f => f.d.era),
  };
}

// ---------- popular vs obscure ----------
const cmpKeys = ['abv', 'sugarConc', 'acidConc', 'sweetSour', 'volOz', 'nIngredients', 'nSpirits', 'baseOz'];
const popular = facts.filter(f => f.d.popularity >= 4);
const obscure = facts.filter(f => f.d.popularity <= 2);
const unweighted = fs => Object.fromEntries(cmpKeys.map(k => [k, wQuantiles(fs.map(f => [metricOf[k](f), 1]))]));
const popularVsObscure = { popular: { n: popular.length, ...unweighted(popular) }, obscure: { n: obscure.length, ...unweighted(obscure) } };

// ---------- per-drink summary (for the web DB view / neighbors) ----------
const drinkFacts = Object.fromEntries(facts.map(f => [f.d.id, {
  abv: round(f.chem.abv, 1), sugarConc: round(f.chem.sugarConc, 1), acidConc: round(f.chem.acidConc, 2),
  sweetSour: f.chem.sweetSour === null ? null : round(f.chem.sweetSour, 1), volOz: round(f.chem.volOz, 2),
  finalOz: round(f.chem.finalOz, 1), nIngredients: f.nIngredients, nRums: f.nRums,
  flavor: Object.fromEntries(Object.entries(normalize(f.flavor)).filter(([, v]) => v > 0.05).map(([k, v]) => [k, round(v, 3)])),
  top: topTags(f.flavor, 5),
}]));

const model = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  nDrinks: drinks.length,
  popWeights: POP_W,
  global: metrics(facts),
  families: familiesOut,
  ingredients: ingredientsOut,
  pairs,
  tagPairs,
  rumCombos,
  popularVsObscure,
  drinks: drinkFacts,
};
writeFileSync(join(root, 'data/model.json'), JSON.stringify(model) + '\n');

// ---------- report ----------
const fmt = q => q ? `${q.median} (${q.p25}–${q.p75})` : '—';
const nameOf = id => (ingMap.get(id) || {}).name || id;
const drinkName = id => { const d = drinks.find(x => x.id === id); return d ? d.name + (d.variant ? ` (${d.variant})` : '') : id; };
let md = `# Tiki database analysis\n\n_Auto-generated by \`scripts/analyze.mjs\` from ${drinks.length} drinks on ${model.generated}. Do not edit by hand._\n\n`;
md += `Numbers are popularity-weighted (iconic drinks weigh ${POP_W[5]}× an obscure one) and computed **per serving after dilution** unless marked "pre". Format: median (interquartile range).\n\n`;
md += `Chemistry model: sugar and acid in g/100 ml, ABV in %. Dilution follows Dave Arnold's shaken/stirred curves, scaled up for crushed-ice shaking (×1.15), swizzling (×1.2) and flash-blending (×1.3).\n\n`;
md += `## Whole database\n\n| metric | value |\n|---|---|\n`;
for (const k of ['abv', 'abvPre', 'sugarConc', 'acidConc', 'sweetSour', 'volOz', 'finalOz', 'nIngredients', 'nSpirits', 'nRums', 'baseOz']) md += `| ${k} | ${fmt(model.global[k])} |\n`;
md += `\n## Popular (4–5) vs obscure (1–2) drinks\n\nDoes popularity correlate with structure? Unweighted medians (IQR).\n\n| metric | popular (n=${popular.length}) | obscure (n=${obscure.length}) |\n|---|---|---|\n`;
for (const k of cmpKeys) md += `| ${k} | ${fmt(popularVsObscure.popular[k])} | ${fmt(popularVsObscure.obscure[k])} |\n`;
md += `\n## Families\n\n| family | n | ABV % | sugar g/100ml | acid g/100ml | sugar:acid | pre-dilution oz | ingredients | spirits |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const fam of families) {
  const F = familiesOut[fam.id];
  if (!F.n) { md += `| ${fam.name} | 0 | | | | | | | |\n`; continue; }
  const m = F.metrics;
  md += `| ${fam.name} | ${F.n} | ${fmt(m.abv)} | ${fmt(m.sugarConc)} | ${fmt(m.acidConc)} | ${fmt(m.sweetSour)} | ${fmt(m.volOz)} | ${fmt(m.nIngredients)} | ${fmt(m.nSpirits)} |\n`;
}
for (const fam of families) {
  const F = familiesOut[fam.id];
  if (!F.n) continue;
  md += `\n### ${fam.name} (${F.n} drinks)\n\n`;
  md += `Exemplars: ${F.exemplars.map(drinkName).join('; ')}\n\n`;
  md += `Role volumes (oz, median (IQR)): ` + ROLES.filter(r => F.roleOz[r] && F.roleOz[r].p75 > 0).map(r => `**${r}** ${fmt(F.roleOz[r])}`).join(' · ') + '\n\n';
  md += `| ingredient | used in | typical dose (oz) |\n|---|---|---|\n`;
  for (const [id, s] of Object.entries(F.ingredients).slice(0, 15)) md += `| ${nameOf(id)} | ${Math.round(s.share * 100)}% | ${s.dose} (${s.doseQ[0]}–${s.doseQ[1]}) |\n`;
  md += `\nMethods: ${Object.entries(F.methods).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')}. Flavor centroid: ${Object.keys(F.flavor).slice(0, 10).join(', ')}.\n`;
}
md += `\n## Most-used ingredients\n\n| ingredient | drinks | weighted share | typical dose (oz) |\n|---|---|---|---|\n`;
for (const [id, s] of Object.entries(ingredientsOut).sort((a, b) => b[1].share - a[1].share).slice(0, 50)) md += `| ${nameOf(id)} | ${s.n} | ${Math.round(s.share * 100)}% | ${s.dose} (${s.doseQ[0]}–${s.doseQ[1]}) |\n`;
md += `\n## Strongest pairings (PMI, ≥3 drinks)\n\nPMI > 0 means the two appear together more than chance.\n\n| pair | PMI | drinks | e.g. |\n|---|---|---|---|\n`;
const pairList = [];
for (const a in pairs) for (const b in pairs[a]) if (a < b && pairs[a][b].n >= 3) pairList.push([a, b, pairs[a][b]]);
pairList.sort((x, y) => y[2].pmi * Math.log(1 + y[2].n) - x[2].pmi * Math.log(1 + x[2].n));
for (const [a, b, p] of pairList.slice(0, 60)) md += `| ${nameOf(a)} + ${nameOf(b)} | ${p.pmi} | ${p.n} | ${p.ex.map(drinkName).slice(0, 2).join('; ')} |\n`;
md += `\n## Rum blends\n\n| rums | drinks | e.g. |\n|---|---|---|\n`;
for (const c of rumCombos.slice(0, 25)) md += `| ${c.rums.map(nameOf).join(' + ')} | ${c.n} | ${c.ex.map(drinkName).slice(0, 2).join('; ')} |\n`;
writeFileSync(join(root, 'docs/analysis.md'), md);
console.log(`analyzed ${drinks.length} drinks → data/model.json, docs/analysis.md`);
