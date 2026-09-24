import { createEngine } from './lib/engine.js';
import { amountString } from './lib/format.js';
import { createScene } from './lib/scene.js';
import { drawDrink, pickGlass } from './lib/drinkart.js';

const PRAYERS = [
  'something smoky and spicy for a cold night',
  'like a Painkiller, but less sweet',
  'mezcal and passion fruit',
  'something blue for the pool',
  'the strongest drink you dare',
  'a punch bowl for 6',
  'bananas Foster in a glass',
  'zero-proof for the designated driver',
  'a Mai Tai with a twist',
  'bitter and refreshing',
];
const ORACLES = [
  'The torches flare. The gods abide.',
  'Your prayer was heard.',
  'From the smoke, a recipe.',
  'The idols have conferred.',
  'It is written in the ice.',
];
const GLASS_WORD = { rocks: 'a double old fashioned', highball: 'a tall glass', pilsner: 'a pilsner', hurricane: 'a hurricane glass', coupe: 'a chilled coupe', snifter: 'a snifter', tiki: 'a tiki mug', mug: 'a mug', bowl: 'a punch bowl' };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function loadData() {
  if (window.__TIKI_DATA__) return window.__TIKI_DATA__;
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const [vocab, families, drinks, model] = await Promise.all([
    get('../data/ingredients.json'), get('../data/families.json'), get('../data/drinks.json'), get('../data/model.json'),
  ]);
  return { vocab, families, drinks, model };
}

let engine, scene, last = { prayer: '', seed: 0, recipe: null };

function pray(prayer, seed = 0, { announce = true } = {}) {
  const text = prayer.trim() || PRAYERS[Math.floor(Math.random() * PRAYERS.length)];
  if (announce) scene.pulse();
  const recipe = engine.generate(text, { seed });
  last = { prayer: text, seed, recipe };
  render(recipe, seed);
  drawDrink($('#drink'), recipe, engine.ingMap, { reducedMotion });
  const glass = pickGlass(recipe.method.glass, recipe.method.method);
  $('#vessel-caption').textContent = `${recipe.name}, served in ${GLASS_WORD[glass] || 'a glass'}`;
  $('#drink').setAttribute('aria-label', `Illustration of ${recipe.name} in ${GLASS_WORD[glass] || 'a glass'}`);
}

function render(r, seed) {
  let d = 0;
  const step = 70;
  const ink = (html, tag = 'div', cls = '') => `<${tag} class="ink ${cls}" style="--d:${(d += step)}ms">${html}</${tag}>`;
  const lines = r.lines.map(l => `<li class="ink" style="--d:${(d += 55)}ms"><span class="amt${l.garnish ? ' g' : ''}">${l.garnish ? 'garnish' : esc(amountString(l, 'oz'))}</span><span class="ing"><b>${esc(l.name)}</b>${l.float ? ' <small>float on top</small>' : ''}${subText(l) ? `<small>${esc(subText(l))}</small>` : ''}</span></li>`).join('');
  const inf = r.explanation.influences.slice(0, 3);
  const lineage = [
    `<li>Family: <b>${esc(r.family.name)}</b></li>`,
    r.riffOf ? `<li>Riff on the <b>${esc(r.riffOf.name)}</b></li>` : '',
    ...inf.map(i => `<li><b>${esc(i.name)}</b>${i.year ? ` (${i.circa ? 'c. ' : ''}${i.year})` : ''}${i.creator ? `, ${esc(i.creator)}` : ''}: shares ${esc(i.shared.slice(0, 3).join(', ') || 'its structure')}</li>`),
  ].join('');
  const why = r.explanation.whyItWorks.filter(w => !/^Sugar-to-acid|^About \d/.test(w)).slice(0, 3);
  $('#tablet').innerHTML = `
    ${ink(esc(ORACLES[(r.name.length + seed) % ORACLES.length]), 'p', 'oracle')}
    ${ink(esc(r.name), 'h2', 'drink-name')}
    ${ink(esc(r.tagline), 'p', 'tagline')}
    ${ink(`${esc(r.family.name)}${r.riffOf ? ` · riff on the ${esc(r.riffOf.name)}` : ''}${r.servings > 1 ? ` · batch for ${r.servings} (amounts per drink)` : ''}`, 'p', 'family')}
    ${ink('The offering', 'h3')}
    <ul class="recipe">${lines}</ul>
    ${ink('The ritual', 'h3')}
    <ol class="steps">${r.method.steps.map(s => `<li class="ink" style="--d:${(d += 60)}ms">${esc(s)}</li>`).join('')}</ol>
    ${ink(`<span class="stat">${r.stats.abv}% ABV</span><span class="stat">sugar ${r.stats.sugarConc} g/100 ml</span><span class="stat">acid ${r.stats.acidConc} g/100 ml</span><span class="stat">${esc(r.garnish.join(', '))}</span>`, 'div', 'stats')}
    ${ink('How it tastes', 'h3')}
    ${ink(esc(r.explanation.tasting), 'p', 'tasting')}
    ${ink('Its ancestors', 'h3')}
    <ul class="lineage">${lineage.replace(/<li>/g, () => `<li class="ink" style="--d:${(d += 60)}ms">`)}</ul>
    ${why.length ? `${ink('Why the gods approve', 'h3')}<ul class="why">${why.map(w => `<li class="ink" style="--d:${(d += 60)}ms">${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="tablet-actions ink" style="--d:${(d += 80)}ms">
      <button type="button" class="ghost-btn" id="again">Pray again</button>
      <button type="button" class="ghost-btn" id="copy">Copy recipe</button>
    </div>`;
  $('#again').addEventListener('click', () => pray(last.prayer, last.seed + 1));
  $('#copy').addEventListener('click', e => copy(r, e.currentTarget));
}

function subText(l) {
  const ing = engine.ingMap.get(l.id);
  if (ing.cat === 'rum' || ing.cat === 'spirit' || ing.avail === 'specialty') return ing.examples.slice(0, 2).join(', ');
  if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'saline'].includes(ing.id)) return ing.examples[0] || 'make at home';
  return '';
}

function copy(r, btn) {
  const text = [r.name, r.tagline, '', ...r.lines.map(l => `${l.garnish ? 'Garnish:' : amountString(l, 'oz')} ${l.name}`), '', ...r.method.steps.map((s, i) => `${i + 1}. ${s}`), '', `Answered by the Tiki God shrine: "${last.prayer}"`].join('\n');
  const done = ok => { btn.textContent = ok ? 'Copied' : 'Select the text to copy'; setTimeout(() => { btn.textContent = 'Copy recipe'; }, 1800); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch { done(false); }
}

async function main() {
  scene = createScene($('#scene'), { reducedMotion });
  const data = await loadData();
  engine = createEngine(data);
  $('#offerings').innerHTML = PRAYERS.slice(0, 7).map(p => `<button type="button">${esc(p)}</button>`).join('');
  $('#offerings').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('#prayer').value = b.textContent; submit(); }));
  $('#prayer-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  // Tonight's first offering, so the page never opens empty.
  pray($('#prayer').value, 0, { announce: false });
}

function submit() {
  const text = $('#prayer').value;
  pray(text, text.trim() === last.prayer ? last.seed + 1 : 0);
  $('#revelation').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}

main().catch(err => {
  $('#tablet').innerHTML = `<p>The shrine couldn't load its recipes (${esc(err.message)}). Serve the repo with <code>python3 -m http.server</code> and open /web/shrine.html, or open dist/shrine.html.</p>`;
});
