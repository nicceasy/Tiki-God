import { createEngine } from './lib/engine.js';
import { amountString } from './lib/format.js';
import { paperTexture } from './lib/ink.js';
import { drinkSpec, sceneSpec, idolSpec, frameSpec } from './lib/artspec.js';
import { createArtist } from './lib/artrender.js';

const PRAYERS = [
  'like a Painkiller, but less sweet',
  'mezcal and passion fruit',
  'something blue for the pool',
  'a punch bowl for 6',
  'bananas Foster in a glass',
  'zero-proof for the designated driver',
  'a Mai Tai with a twist',
  'bitter and refreshing',
];
const ORACLES = ['Your prayer was heard', 'The gods abide', 'Poured from the smoke', 'The idols have conferred', 'Written in the ice'];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const withArticle = n => `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;

async function loadData() {
  if (window.__TIKI_DATA__) return window.__TIKI_DATA__;
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const [vocab, families, drinks, model, vessels] = await Promise.all([
    get('../data/ingredients.json'), get('../data/families.json'), get('../data/drinks.json'), get('../data/model.json'), get('../data/vessels.json'),
  ]);
  return { vocab, families, drinks, model, vessels };
}

let engine, art, idolFrames = null, last = { prayer: '', seed: 0, recipe: null };

// ------------------------------------------------------------ drawings
function heroLayout() {
  const hero = $('#hero');
  const w = hero.clientWidth;
  const sides = (w - Math.min(560, w)) / 2 >= 150;
  hero.classList.toggle('banded', !sides);
  const hr = hero.getBoundingClientRect(), pr = $('#prayer-col').getBoundingClientRect();
  const text = { left: pr.left - hr.left - 12, right: pr.right - hr.left + 12, top: pr.top - hr.top, bottom: pr.bottom - hr.top };
  return sceneSpec(hero.clientWidth, hero.clientHeight, text);
}
const fieldSpec = () => { const f = $('#field'); return frameSpec(f.clientWidth, f.clientHeight); };
const idolBox = () => { const el = $('#idol-art'); return [el.clientWidth, el.clientHeight]; };

async function drawIntro() {
  const scene = art.hero.play(heroLayout());
  await art.field.play(fieldSpec());
  await art.idol.play(idolSpec(...idolBox(), false));
  cacheIdol();
  await scene;
}

function cacheIdol() {
  const open = art.idol.snapshot();
  art.idol.still(idolSpec(...idolBox(), true));
  const shut = art.idol.snapshot();
  art.idol.show(open);
  idolFrames = { open, shut };
}

function blink() {
  if (!idolFrames || reducedMotion) return;
  const { open, shut } = idolFrames;
  [[0, shut], [110, open], [230, shut], [330, open]].forEach(([ms, frame]) => setTimeout(() => art.idol.show(frame), ms));
}

let resizeTimer = 0, lastWidth = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    art.hero.still(heroLayout());
    art.field.still(fieldSpec());
    art.idol.still(idolSpec(...idolBox(), false));
    cacheIdol();
    if (last.recipe) art.drink.still(drinkSpec({ ...last.recipe, seed: last.seed }, engine.ingMap));
  }, 180);
}

// ------------------------------------------------------------ prayers
function pray(prayer, seed = 0, { announce = true } = {}) {
  const text = prayer.trim() || PRAYERS[Math.floor(Math.random() * PRAYERS.length)];
  const recipe = engine.generate(text, { seed });
  last = { prayer: text, seed, recipe };
  if (announce) blink();
  render(recipe, seed);
  const spec = drinkSpec({ ...recipe, seed }, engine.ingMap);
  art.drink.play(spec);
  const vessel = withArticle(recipe.vessel ? recipe.vessel.name : recipe.method.glass);
  $('#caption').textContent = `${recipe.name}, in ${vessel}`;
  $('#drink-art').setAttribute('aria-label', `Ink and watercolor drawing of the ${recipe.name} in ${vessel}`);
}

function subText(l) {
  const ing = engine.ingMap.get(l.id);
  if (!ing) return '';
  if (ing.cat === 'rum' || ing.cat === 'spirit' || ing.avail === 'specialty') return ing.examples.slice(0, 2).join(', ');
  if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'saline'].includes(ing.id)) return ing.examples[0] || 'make at home';
  return '';
}

function render(r, seed) {
  let d = 250;
  const at = (step = 70) => `style="--d:${(d += step)}ms"`;
  const lines = r.lines.map(l => `<li class="bleed" ${at(45)}><span class="amt${l.garnish ? ' g' : ''}">${l.garnish ? 'garnish' : esc(amountString(l, 'oz'))}</span><span class="ing"><b>${esc(l.name)}</b>${l.float ? '<small class="float">float on top</small>' : ''}${subText(l) ? `<small>${esc(subText(l))}</small>` : ''}</span></li>`).join('');
  const inf = r.explanation.influences.slice(0, 3);
  const lineage = [
    `Family: <b>${esc(r.family.name)}</b>`,
    r.riffOf ? `A riff on the <b>${esc(r.riffOf.name)}</b>` : '',
    ...inf.map(i => `<b>${esc(i.name)}</b>${i.year ? ` (${i.circa ? 'c. ' : ''}${i.year})` : ''}${i.creator ? `, ${esc(i.creator)}` : ''}: shares ${esc(i.shared.slice(0, 3).join(', ') || 'its structure')}`),
  ].filter(Boolean);
  const why = r.explanation.whyItWorks.filter(w => !/^Sugar-to-acid|^About \d/.test(w)).slice(0, 3);
  const meta = [esc(r.family.name), r.riffOf ? `riff on the ${esc(r.riffOf.name)}` : '', r.servings > 1 ? `batch for ${r.servings}, amounts per drink` : ''].filter(Boolean).join(' · ');
  $('#recipe').innerHTML = `
    <p class="oracle bleed" ${at(0)}>${esc(ORACLES[(r.name.length + seed) % ORACLES.length])}</p>
    <h2 class="name bleed" ${at()}>${esc(r.name)}</h2>
    <p class="tagline bleed" ${at()}>${esc(r.tagline)}</p>
    <p class="meta bleed" ${at()}>${meta}</p>
    <h3 class="bleed" ${at()}>The offering</h3>
    <ul class="lines">${lines}</ul>
    <h3 class="bleed" ${at()}>The ritual</h3>
    <ol class="steps">${r.method.steps.map(s => `<li class="bleed" ${at(55)}>${esc(s)}</li>`).join('')}</ol>
    ${r.vessel && r.vessel.story ? `<h3 class="bleed" ${at()}>The vessel</h3><p class="vessel-note bleed" ${at()}><b>${esc(withArticle(r.vessel.name).replace(/^./, c => c.toUpperCase()))}.</b> ${esc(r.vessel.story)}</p>` : ''}
    <p class="stats bleed" ${at()}><span>${r.stats.abv}% abv</span><span>sugar ${r.stats.sugarConc} g/100 ml</span><span>acid ${r.stats.acidConc} g/100 ml</span></p>
    <h3 class="bleed" ${at()}>How it tastes</h3>
    <p class="tasting bleed" ${at()}>${esc(r.explanation.tasting)}</p>
    <h3 class="bleed" ${at()}>Its ancestors</h3>
    <ul class="lineage">${lineage.map(x => `<li class="bleed" ${at(55)}>${x}</li>`).join('')}</ul>
    ${why.length ? `<h3 class="bleed" ${at()}>Why the gods approve</h3><ul class="why">${why.map(w => `<li class="bleed" ${at(55)}>${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="actions bleed" ${at(80)}>
      <button type="button" class="btn solid" id="again">Pray again</button>
      <button type="button" class="btn quiet" id="copy">Copy recipe</button>
    </div>`;
  $('#again').addEventListener('click', () => pray(last.prayer, last.seed + 1));
  $('#copy').addEventListener('click', e => copy(r, e.currentTarget));
}

function copy(r, btn) {
  const text = [r.name, r.tagline, '', ...r.lines.map(l => `${l.garnish ? 'Garnish:' : amountString(l, 'oz')} ${l.name}`), '', ...r.method.steps.map((s, i) => `${i + 1}. ${s}`), '', `Answered by the Tiki God shrine: "${last.prayer}"`].join('\n');
  const done = ok => { btn.textContent = ok ? 'Copied' : 'Select the text to copy'; setTimeout(() => { btn.textContent = 'Copy recipe'; }, 1800); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch { done(false); }
}

function submit() {
  const text = $('#prayer').value;
  pray(text, text.trim() === last.prayer ? last.seed + 1 : 0);
  $('#answer').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}

async function main() {
  try { document.body.style.backgroundImage = `url(${paperTexture(256, 3)})`; } catch { /* plain paper is fine */ }
  art = {
    hero: createArtist($('#hero-art'), { reducedMotion }),
    field: createArtist($('#field-art'), { reducedMotion }),
    idol: createArtist($('#idol-art'), { reducedMotion }),
    drink: createArtist($('#drink-art'), { reducedMotion }),
  };
  const data = await loadData();
  engine = createEngine(data);
  $('#foot-note').textContent = `Every recipe is balanced against ${data.drinks.length.toLocaleString('en-US')} catalogued drinks and built only from bottles you can buy today.`;
  $('#tries').innerHTML = PRAYERS.slice(0, 4).map(p => `<button type="button">${esc(p)}</button>`).join('');
  $('#tries').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('#prayer').value = b.textContent; submit(); }));
  $('#prayer-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
  // The page opens with tonight's first offering already answered.
  pray($('#prayer').value, 0, { announce: false });
  // Measure the prayer once the brush face has arrived, so nothing is drawn over the words.
  await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 900))]);
  lastWidth = window.innerWidth;
  window.addEventListener('resize', onResize);
  await drawIntro();
}

main().catch(err => {
  $('#recipe').innerHTML = `<p>The shrine couldn't load its recipes (${esc(err.message)}). Serve the repo with <code>python3 -m http.server</code> and open /web/shrine.html, or open dist/shrine.html.</p>`;
});
