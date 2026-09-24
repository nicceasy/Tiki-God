#!/usr/bin/env node
// Validate drink files against data/ingredients.json and data/families.json.
// Usage: node scripts/validate.mjs [file ...]   (defaults to data/drinks.json)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vocab = JSON.parse(readFileSync(join(root, 'data/ingredients.json'), 'utf8'));
const families = JSON.parse(readFileSync(join(root, 'data/families.json'), 'utf8'));

// Proposed-but-unmerged ingredients may live next to a slice file.
function loadProposals(file) {
  const p = file.replace(/\.json$/, '.new-ingredients.json');
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return []; }
}

const ERAS = ['colonial', 'pre-tiki', 'golden', 'late-classic', 'decline', 'revival', 'craft'];
const METHODS = ['shake', 'flash-blend', 'blend', 'swizzle', 'build', 'stir', 'hot', 'muddle-build'];
const ICE = ['crushed', 'cubed', 'pebble', 'shaved', 'block', 'none', 'blended', 'ice-cone'];
const CONF = ['high', 'medium', 'low'];
const UNITS = Object.keys(vocab.units);
const familyIds = new Set(families.families.map(f => f.id));

export function validateDrinks(drinks, extraIngredientIds = []) {
  const ingIds = new Set([...vocab.ingredients.map(i => i.id), ...extraIngredientIds]);
  const errors = [];
  const warnings = [];
  const seen = new Set();
  if (!Array.isArray(drinks)) return { errors: ['top level must be an array'], warnings };
  drinks.forEach((d, i) => {
    const where = `#${i} ${d && d.id ? d.id : '(no id)'}`;
    const err = m => errors.push(`${where}: ${m}`);
    const warn = m => warnings.push(`${where}: ${m}`);
    if (!d || typeof d !== 'object') return err('not an object');
    if (!d.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) err('id must be kebab-case');
    if (seen.has(d.id)) err('duplicate id');
    seen.add(d.id);
    if (!d.name) err('missing name');
    if (!familyIds.has(d.family)) err(`unknown family "${d.family}"`);
    for (const f of d.families_secondary || []) if (!familyIds.has(f)) err(`unknown secondary family "${f}"`);
    if (!ERAS.includes(d.era)) err(`bad era "${d.era}"`);
    if (d.year !== null && d.year !== undefined && !Number.isInteger(d.year)) err('year must be integer or null');
    if (!Number.isInteger(d.popularity) || d.popularity < 1 || d.popularity > 5) err('popularity must be 1..5');
    if (!METHODS.includes(d.method)) err(`bad method "${d.method}"`);
    if (!ICE.includes(d.ice)) err(`bad ice "${d.ice}"`);
    if (!CONF.includes(d.confidence)) err(`bad confidence "${d.confidence}"`);
    if (!d.source) warn('no source');
    if (d.servings !== undefined && !(d.servings >= 1)) err('servings must be >= 1');
    if (!Array.isArray(d.ingredients) || d.ingredients.length < 2) return err('needs >= 2 ingredients');
    let volume = 0;
    for (const ing of d.ingredients) {
      if (!ingIds.has(ing.id)) err(`unknown ingredient "${ing.id}"`);
      if (!UNITS.includes(ing.unit)) err(`bad unit "${ing.unit}" for ${ing.id}`);
      const needsAmount = !['top', 'garnish', 'leaves', 'sprig', 'slice', 'pinch'].includes(ing.unit);
      if (needsAmount && !(typeof ing.amount === 'number' && ing.amount > 0)) err(`bad amount for ${ing.id}`);
      if (ing.unit === 'oz') volume += ing.amount;
    }
    const perServing = volume / (d.servings || 1);
    if (perServing > 12) warn(`large volume per serving (${perServing.toFixed(1)} oz) — set servings?`);
  });
  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) files.push(join(root, 'data/drinks.json'));
  let bad = 0;
  for (const file of files) {
    const drinks = JSON.parse(readFileSync(file, 'utf8'));
    const extra = loadProposals(file).map(p => p.id);
    const { errors, warnings } = validateDrinks(drinks, extra);
    console.log(`${file}: ${Array.isArray(drinks) ? drinks.length : 0} drinks, ${errors.length} errors, ${warnings.length} warnings`);
    for (const e of errors) console.log('  ERROR ' + e);
    for (const w of warnings) console.log('  warn  ' + w);
    if (errors.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
