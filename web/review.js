// Dev-only review gallery: renders every battery prayer's drink as a finished drawing with its
// recipe, so a critic can judge recipes and art together. Built by `node scripts/build-site.mjs
// --review <dir>`; not part of the published site.
import { createEngine } from './lib/engine.js';
import { amountString } from './lib/format.js';
import { paperTexture } from './lib/ink.js';
import { drinkSpec } from './lib/artspec.js';
import { createArtist } from './lib/artrender.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = window.__TIKI_DATA__;
const { prompts, seeds } = window.__REVIEW__;
const engine = createEngine(data);
try { document.body.style.backgroundImage = `url(${paperTexture(256, 3)})`; } catch { /* plain */ }
const grid = document.getElementById('grid');
let i = 0;
// (Each drink is drawn on its own: a ceramic's glaze is a function of the drink and its vessel,
// artspec.js glazeFor, never of the cards beside it on the sheet.)
for (const p of prompts) for (const seed of seeds) {
  const r = engine.generate(p, { seed });
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `<div class="art" id="a${i}"></div>
    <div class="p">#${i} “${esc(p)}” · seed ${seed}</div>
    <h4>${esc(r.name)}</h4>
    <div class="t">${esc(r.tagline)}</div>
    <div>${esc(r.family.name)} · ${esc(r.vessel ? r.vessel.name : r.method.glass)} · ${esc(r.method.method)}/${esc(r.method.ice)}</div>
    <ul>${r.lines.map(l => `<li>${l.garnish ? 'garnish' : esc(amountString(l, 'oz'))} ${esc(l.name)}${l.float ? ' (float)' : ''}${l.sink ? ' (sink)' : ''}</li>`).join('')}</ul>
    <div>Garnish: ${esc(r.garnish.join(', '))}</div>
    ${r.look ? `<div class="look">Look: ${esc(typeof r.look === 'string' ? r.look : r.look.description || '')}</div>` : ''}`;
  grid.appendChild(card);
  const spec = drinkSpec({ ...r, seed }, engine.ingMap);
  createArtist(card.querySelector('.art'), { reducedMotion: true }).still(spec);
  i++;
}
document.body.dataset.ready = String(i);
