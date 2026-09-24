import { createEngine } from './lib/engine.js';
import { amountString, fracString } from './lib/format.js';
import { markdownToHtml } from './lib/markdown.js';

const EXAMPLES = [
  'smoky and spicy for a cold night',
  'like a Painkiller but less sweet',
  'tequila tiki with passion fruit',
  'something blue for a pool party',
  'strong and funky, three rums',
  'bitter and refreshing',
  'frozen banana for the beach',
  'Mai Tai with mezcal',
  'hot buttered rum for Christmas',
  'zero-proof and tropical',
  'gin, honey and grapefruit',
  'a punch bowl for 6, no coconut',
];
const ROLE_LABEL = {
  base: 'spirit', sour: 'sour', sweet: 'sweetener', modifier: 'liqueur / modifier', juice: 'juice',
  rich: 'rich', accent: 'accent', lengthener: 'lengthener', aromatic: 'aromatic',
};
const ERA_LABEL = {
  colonial: 'Colonial (before 1900)', 'pre-tiki': 'Pre-tiki (1900–1933)', golden: 'Golden age (1934–1959)',
  'late-classic': 'Late classic (1960–1979)', decline: 'Decline (1980–1997)', revival: 'Revival (1998–2009)', craft: 'Craft (2010–)',
};

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('tiki-god:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('tiki-god:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

async function loadData() {
  if (window.__TIKI_DATA__) return window.__TIKI_DATA__;
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const text = p => fetch(p).then(r => (r.ok ? r.text() : '')).catch(() => '');
  const [vocab, families, drinks, model, timeline, history, concepts, methodology] = await Promise.all([
    get('../data/ingredients.json'), get('../data/families.json'), get('../data/drinks.json'), get('../data/model.json'),
    get('../docs/timeline.json').catch(() => []), text('../docs/history.md'), text('../docs/concepts.md'), text('../docs/methodology.md'),
  ]);
  return { vocab, families, drinks, model, timeline, docs: { history: markdownToHtml(history), concepts: markdownToHtml(concepts), methodology: markdownToHtml(methodology) } };
}

const state = { units: store.get('units', 'oz'), seed: 0, prompt: '', current: null, canonSel: null };
let data, engine;

// ---------------- mix ----------------
function mix(prompt, seed = 0) {
  state.prompt = prompt;
  state.seed = seed;
  state.current = engine.generate(prompt, { seed });
  renderResult(state.current);
  const recent = store.get('recent', []).filter(r => !(r.prompt === prompt && r.seed === seed));
  recent.unshift({ prompt, seed, name: state.current.name });
  store.set('recent', recent.slice(0, 8));
  renderRecent();
}

function lineAmount(l) {
  if (l.garnish) return '<span class="amt g">garnish</span>';
  return `<span class="amt">${esc(amountString(l, state.units))}</span>`;
}

function subText(l) {
  const ing = engine.ingMap.get(l.id);
  const bits = [];
  if (ing.cat === 'rum' || ing.cat === 'spirit' || ing.avail === 'specialty') bits.push(ing.examples.slice(0, 2).join(', '));
  if (ing.avail === 'homemade' && !['simple-syrup', 'rich-simple', 'saline'].includes(ing.id)) bits.push('make at home');
  if (l.garnish) bits.push('on top');
  return bits.filter(Boolean).join(' · ');
}

function meter(label, value, fam, unit, digits = 1) {
  if (value === null || value === undefined || !fam) return '';
  const lo = Math.max(0, Math.min(fam.p25, value) * 0.7);
  const hi = Math.max(fam.p75, value) * 1.25 || 1;
  const pos = x => `${(((x - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const width = `${(((fam.p75 - fam.p25) / (hi - lo)) * 100).toFixed(1)}%`;
  return `<div class="meter">
    <div class="meter-top"><span>${esc(label)}</span><b>${value.toFixed(digits)}${unit}</b></div>
    <div class="track" role="img" aria-label="${esc(label)} ${value.toFixed(digits)}${unit}; family range ${fam.p25} to ${fam.p75}">
      <div class="band" style="left:${pos(fam.p25)};width:${width}"></div>
      <div class="median" style="left:${pos(fam.median)}"></div>
      <div class="marker" style="left:${pos(value)}"></div>
    </div>
    <div class="meter-foot">Family middle half: ${(+fam.p25).toFixed(digits)}–${(+fam.p75).toFixed(digits)}${unit}</div>
  </div>`;
}

function renderResult(r) {
  const el = $('#result');
  const roles = [...new Set(r.lines.map(l => l.role))];
  const fam = r.stats.family;
  const infl = r.explanation.influences.map(i => `
    <button type="button" class="inf" data-drink="${esc(i.id)}">
      <span class="yr">${i.year ? (i.circa ? 'c. ' : '') + i.year : 'undated'}</span>
      <span class="nm">${esc(i.name)}</span>
      <span class="by">${esc([i.variant, i.creator, i.venue].filter(Boolean).slice(0, 2).join(' · '))}</span>
      <span class="sh">Shares ${esc(i.shared.slice(0, 4).join(', ') || 'its structure')}</span>
    </button>`).join('');
  el.innerHTML = `
    <div class="spec-head">
      <div class="eyebrow">${esc(r.family.name)}${r.riffOf ? ` · riff on the ${esc(r.riffOf.name)}` : ''}${r.servings > 1 ? ` · batch for ${r.servings}` : ''}</div>
      <h1 class="drink-name">${esc(r.name)}</h1>
      <p class="tagline">${esc(r.tagline)}</p>
      ${r.heard.length ? `<div class="heard-row"><span class="lbl">Heard:</span>${r.heard.map(h => `<span class="tag heard">${esc(h)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="spec-body">
      <div>
        <h2>Recipe${r.servings > 1 ? ' (per drink)' : ''}</h2>
        <ul class="recipe">
          ${r.lines.map(l => `<li>
            ${lineAmount(l)}
            <span class="dot role-${l.role}" title="${esc(ROLE_LABEL[l.role])}"></span>
            <span><span class="ing-name">${esc(l.name)}</span>${l.float ? '<span class="flag">float</span>' : ''}<span class="ing-sub">${esc(subText(l))}</span></span>
          </li>`).join('')}
        </ul>
        <div class="legend">${roles.map(ro => `<span><i class="role-${ro}"></i>${esc(ROLE_LABEL[ro])}</span>`).join('')}</div>
      </div>
      <div>
        <h2>Build</h2>
        <ol class="steps">${r.method.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <dl class="service">
          <dt>Glass</dt><dd>${esc(r.method.glass)}</dd>
          <dt>Ice</dt><dd>${esc(r.method.ice)}</dd>
          <dt>Garnish</dt><dd>${esc(r.garnish.join(', '))}</dd>
          <dt>Yield</dt><dd>about ${esc(fracString(Math.round(r.stats.finalOz * 4) / 4))} oz after dilution</dd>
        </dl>
        <div class="spec-tools">
          <button type="button" class="btn small" id="copy-btn">Copy recipe</button>
          <button type="button" class="btn small" id="again-inline">Shake again</button>
        </div>
      </div>
    </div>
    <section class="section">
      <h2>Balance against the ${esc(r.family.name)} family</h2>
      <div class="meters">
        ${meter('Strength (ABV after dilution)', r.stats.abv, fam.abv, '%')}
        ${meter('Sugar (g per 100 ml)', r.stats.sugarConc, fam.sugarConc, ' g')}
        ${meter('Acid (g per 100 ml)', r.stats.acidConc, fam.acidConc, ' g', 2)}
        ${r.stats.sweetSour !== null ? meter('Sugar : acid', r.stats.sweetSour, fam.sweetSour, '', 1) : ''}
      </div>
      <div class="flavor-row">${r.flavor.map(t => `<span class="tag">${esc(t.replace('-', ' '))}</span>`).join('')}</div>
      ${r.explanation.tasting ? `<p class="tasting">${esc(r.explanation.tasting)}</p>` : ''}
    </section>
    <section class="section">
      <h2>Lineage</h2>
      <div class="prose">${r.explanation.lineage.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      ${infl ? `<h3 class="mini" style="margin-top:14px">Closest relatives in the canon</h3><div class="influences">${infl}</div>` : ''}
    </section>
    <section class="section">
      <h2>Why it works</h2>
      <ul class="why">${r.explanation.whyItWorks.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    </section>
    ${r.explanation.ingredientNotes.length ? `<section class="section"><h2>Before you shake</h2><ul class="notes-list">${r.explanation.ingredientNotes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
  `;
  el.classList.remove('fresh');
  void el.offsetWidth;
  el.classList.add('fresh');
  $('#copy-btn').addEventListener('click', e => copyRecipe(r, e.currentTarget));
  $('#again-inline').addEventListener('click', () => mix(state.prompt, state.seed + 1));
  el.querySelectorAll('[data-drink]').forEach(b => b.addEventListener('click', () => openDrink(b.dataset.drink)));
}

function recipeText(r) {
  const lines = r.lines.map(l => `${l.garnish ? 'Garnish:' : amountString(l, state.units)} ${l.name}${l.float ? ' (float)' : ''}`);
  return [`${r.name}`, r.tagline, '', ...lines, '', ...r.method.steps.map((s, i) => `${i + 1}. ${s}`), '', `Glass: ${r.method.glass}`, `Garnish: ${r.garnish.join(', ')}`, '', `Mixed by Tiki God from: "${r.prompt}"`].join('\n');
}

function copyRecipe(r, btn) {
  const text = recipeText(r);
  const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy recipe'; }, 1600); };
  try {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, btn));
  } catch { fallbackCopy(text, btn); }
}
function fallbackCopy(text, btn) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  btn.textContent = ok ? 'Copied' : 'Select and copy manually';
  setTimeout(() => { btn.textContent = 'Copy recipe'; }, 2000);
}

function renderRecent() {
  const recent = store.get('recent', []);
  $('#recent-wrap').hidden = !recent.length;
  $('#recent').innerHTML = recent.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.name)}<span>${esc(r.prompt)}${r.seed ? ` · roll ${r.seed + 1}` : ''}</span></button></li>`).join('');
  $('#recent').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const r = recent[+b.dataset.i];
    $('#prompt').value = r.prompt;
    mix(r.prompt, r.seed);
  }));
}

// ---------------- canon ----------------
function origAmount(l) {
  const u = l.unit;
  if (u === 'garnish') return 'garnish';
  if (u === 'top') return l.amount ? `top (${fracString(l.amount)} oz)` : 'top';
  if (u === 'oz') return amountString({ amount: l.amount, unit: 'oz', oz: l.amount }, state.units);
  if (u === 'ml') return state.units === 'ml' ? `${l.amount} ml` : `${fracString(l.amount / 29.57)} oz`;
  if (u === 'tsp' || u === 'barspoon' || u === 'tbsp') return `${fracString(l.amount)} ${u}`;
  if (u === 'piece') return fracString(l.amount);
  const plural = { dash: 'dashes', drop: 'drops', sprig: 'sprigs', slice: 'slices', splash: 'splashes', scoop: 'scoops', cup: 'cups', pinch: 'pinches', rinse: 'rinse' };
  if (l.amount === undefined || l.amount === null) return u === 'sprig' || u === 'leaves' ? 'garnish' : u;
  return `${l.amount} ${l.amount === 1 ? u : plural[u] || u}`;
}

function initCanon() {
  const fams = data.families.families;
  $('#canon-family').innerHTML = `<option value="">All families</option>${fams.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}`;
  $('#canon-era').innerHTML = `<option value="">All eras</option>${Object.entries(ERA_LABEL).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}`;
  for (const id of ['#canon-q', '#canon-family', '#canon-era', '#canon-sort']) $(id).addEventListener('input', renderCanon);
  renderCanon();
}

function renderCanon() {
  const q = $('#canon-q').value.trim().toLowerCase();
  const fam = $('#canon-family').value, era = $('#canon-era').value, sort = $('#canon-sort').value;
  let list = data.drinks.filter(d => (!fam || d.family === fam) && (!era || d.era === era));
  if (q) {
    list = list.filter(d => {
      const hay = [d.name, d.variant, d.creator, d.venue, d.location, ...(d.aka || []), ...d.ingredients.map(l => {
        const ing = engine.ingMap.get(l.id);
        return (ing ? ing.name : l.id) + ' ' + (l.orig || '');
      })].join(' ').toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    });
  }
  const abv = d => (data.model.drinks[d.id] || {}).abv || 0;
  const sorters = {
    year: (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name),
    pop: (a, b) => b.popularity - a.popularity || (a.year ?? 9999) - (b.year ?? 9999),
    name: (a, b) => a.name.localeCompare(b.name),
    abv: (a, b) => abv(b) - abv(a),
  };
  list.sort(sorters[sort]);
  $('#canon-count').textContent = `${list.length} of ${data.drinks.length} drinks`;
  $('#canon-list').innerHTML = list.map(d => `<li tabindex="0" data-id="${esc(d.id)}" class="${d.id === state.canonSel ? 'sel' : ''}">
      <span class="y">${d.year ? (d.circa ? '~' : '') + d.year : '—'}</span>
      <span class="n">${esc(d.name)}<small>${esc([d.variant, d.creator || d.venue].filter(Boolean).join(' · '))}</small></span>
      <span class="pop" title="Fame ${d.popularity} of 5">${'●'.repeat(d.popularity)}${'○'.repeat(5 - d.popularity)}</span>
    </li>`).join('');
  $('#canon-list').querySelectorAll('li').forEach(li => {
    const go = () => showDrink(li.dataset.id);
    li.addEventListener('click', go);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  if (!state.canonSel && list.length) showDrink(list.find(d => d.popularity === 5)?.id || list[0].id, false);
}

function drinkLink(d) {
  return `<button type="button" class="linkish" data-open="${esc(d.id)}">${esc(d.name)}${d.year ? ` (${d.year})` : ''}</button>`;
}

function showDrink(id, scroll = true) {
  const info = engine.describeDrink(id);
  if (!info) return;
  state.canonSel = id;
  document.querySelectorAll('#canon-list li').forEach(li => li.classList.toggle('sel', li.dataset.id === id));
  const d = info.drink, f = info.facts || {};
  $('#canon-detail').innerHTML = `<div class="spec">
    <div class="eyebrow">${esc(info.family.name)} · ${esc(ERA_LABEL[d.era] || d.era)}</div>
    <h1 class="drink-name">${esc(d.name)}</h1>
    <p class="tagline">${esc([d.variant, d.creator, d.venue, d.location].filter(Boolean).join(' · '))}${d.year ? ` · ${d.circa ? 'c. ' : ''}${d.year}` : ''}</p>
    <div class="facts">
      <div class="fact"><b>${f.abv ?? '—'}%</b><span>ABV diluted</span></div>
      <div class="fact"><b>${f.sugarConc ?? '—'}</b><span>sugar g/100 ml</span></div>
      <div class="fact"><b>${f.acidConc ?? '—'}</b><span>acid g/100 ml</span></div>
      <div class="fact"><b>${f.sweetSour ?? '—'}</b><span>sugar : acid</span></div>
    </div>
    <ul class="recipe">${info.lines.map(l => {
      const ing = engine.ingMap.get(l.id);
      return `<li><span class="amt${l.unit === 'garnish' ? ' g' : ''}">${esc(origAmount(l))}</span><span class="dot role-${l.garnish ? 'aromatic' : ing ? ing.role : 'base'}"></span><span><span class="ing-name">${esc(l.name)}</span>${l.float ? '<span class="flag">float</span>' : ''}${l.orig ? `<span class="ing-sub">originally: ${esc(l.orig)}</span>` : ''}</span></li>`;
    }).join('')}</ul>
    <dl class="service"><dt>Method</dt><dd>${esc(d.method)}${d.ice ? `, ${esc(d.ice)} ice` : ''}</dd>${d.glass ? `<dt>Glass</dt><dd>${esc(d.glass)}</dd>` : ''}${d.garnish && d.garnish.length ? `<dt>Garnish</dt><dd>${esc(d.garnish.join(', '))}</dd>` : ''}${d.servings > 1 ? `<dt>Serves</dt><dd>${d.servings}</dd>` : ''}</dl>
    ${d.notes ? `<p class="prose" style="margin-top:14px">${esc(d.notes)}</p>` : ''}
    <p class="conf ${esc(d.confidence)}">Confidence: ${esc(d.confidence)} · ${esc(d.source || 'source not recorded')}</p>
    ${info.parents.length ? `<p><b>Descends from:</b> ${info.parents.map(drinkLink).join(', ')}</p>` : ''}
    ${info.children.length ? `<p><b>Led to:</b> ${info.children.map(drinkLink).join(', ')}</p>` : ''}
    <p><b>Closest relatives:</b> ${info.neighbors.slice(0, 4).map(drinkLink).join(', ')}</p>
    <div class="spec-tools"><button type="button" class="btn small primary" id="riff-btn">Mix a riff on this</button></div>
  </div>`;
  $('#canon-detail').querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => showDrink(b.dataset.open)));
  $('#riff-btn').addEventListener('click', () => {
    $('#prompt').value = `a riff on the ${d.name}`;
    location.hash = 'mix';
    mix($('#prompt').value, 0);
  });
  if (scroll && window.matchMedia('(max-width: 900px)').matches) $('#canon-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDrink(id) {
  location.hash = 'canon';
  showDrink(id);
}

// ---------------- model ----------------
function q(qq, digits = 1) { return qq ? `${(+qq.median).toFixed(digits)} <span style="color:var(--muted)">(${(+qq.p25).toFixed(digits)}–${(+qq.p75).toFixed(digits)})</span>` : '—'; }

function renderModel() {
  const m = data.model, fams = data.families.families;
  const ingName = id => (engine.ingMap.get(id) || { name: id }).name;
  const dn = id => (engine.drinkById[id] || { name: id }).name;
  const top = Object.entries(m.ingredients).sort((a, b) => b[1].share - a[1].share).slice(0, 24);
  const maxShare = top[0] ? top[0][1].share : 1;
  const pairs = [];
  for (const a in m.pairs) for (const b in m.pairs[a]) if (a < b && m.pairs[a][b].n >= 4) pairs.push([a, b, m.pairs[a][b]]);
  pairs.sort((x, y) => y[2].pmi * Math.log(1 + y[2].n) - x[2].pmi * Math.log(1 + x[2].n));
  const pv = m.popularVsObscure;
  $('#model-body').innerHTML = `
    <h2>What ${m.nDrinks} drinks say</h2>
    <p>Every number below is computed from the catalogue, per serving and after dilution, with famous drinks weighted more heavily than obscure ones. These ranges are the targets the generator balances toward.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Family</th><th>Drinks</th><th>ABV %</th><th>Sugar g/100 ml</th><th>Acid g/100 ml</th><th>Sugar : acid</th><th>Volume oz (pre-ice)</th><th>Ingredients</th></tr></thead>
      <tbody>${fams.map(f => { const F = m.families[f.id]; if (!F || !F.n) return ''; const x = F.metrics; return `<tr><td><b>${esc(f.name)}</b><br><span style="color:var(--muted);font-size:12.5px">${esc(F.exemplars.slice(0, 3).map(dn).join(', '))}</span></td><td class="num">${F.n}</td><td class="num">${q(x.abv)}</td><td class="num">${q(x.sugarConc)}</td><td class="num">${q(x.acidConc, 2)}</td><td class="num">${q(x.sweetSour)}</td><td class="num">${q(x.volOz, 2)}</td><td class="num">${q(x.nIngredients, 0)}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <h2>The tiki pantry</h2>
    <p>How often each ingredient appears, weighted by fame. Lime is the default acid, and the rum shelf is spread across many styles instead of one "tiki rum".</p>
    <div class="bars">${top.map(([id, s]) => `<div class="bar"><span>${esc(ingName(id))}</span><div class="fill-track"><div class="fill" style="width:${((s.share / maxShare) * 100).toFixed(1)}%"></div></div><span class="v">${Math.round(s.share * 100)}%</span></div>`).join('')}</div>
    <h2>Pairings that recur</h2>
    <p>Pointwise mutual information: how much more often two ingredients meet than chance would predict. The generator uses these scores to choose companions for whatever you asked for.</p>
    <div class="table-wrap"><table><thead><tr><th>Pair</th><th>PMI</th><th>Drinks</th><th>For example</th></tr></thead><tbody>
      ${pairs.slice(0, 24).map(([a, b, p]) => `<tr><td>${esc(ingName(a))} + ${esc(ingName(b))}</td><td class="num">${p.pmi.toFixed(2)}</td><td class="num">${p.n}</td><td>${esc([...new Set(p.ex.map(dn))].join(', '))}</td></tr>`).join('')}
    </tbody></table></div>
    <h2>Rum blends</h2>
    <div class="table-wrap"><table><thead><tr><th>Rums</th><th>Drinks</th><th>For example</th></tr></thead><tbody>
      ${m.rumCombos.slice(0, 12).map(c => `<tr><td>${esc(c.rums.map(ingName).join(' + '))}</td><td class="num">${c.n}</td><td>${esc([...new Set(c.ex.map(dn))].slice(0, 3).join(', '))}</td></tr>`).join('')}
    </tbody></table></div>
    <h2>Famous vs. obscure</h2>
    <p>Medians for drinks rated 4–5 on fame against drinks rated 1–2.</p>
    <div class="table-wrap"><table><thead><tr><th>Measure</th><th>Famous (${pv.popular.n})</th><th>Obscure (${pv.obscure.n})</th></tr></thead><tbody>
      ${[['ABV %', 'abv', 1], ['Sugar g/100 ml', 'sugarConc', 1], ['Acid g/100 ml', 'acidConc', 2], ['Sugar : acid', 'sweetSour', 1], ['Volume oz', 'volOz', 2], ['Ingredients', 'nIngredients', 0], ['Spirits', 'nSpirits', 0]].map(([l, k, dg]) => `<tr><td>${l}</td><td class="num">${q(pv.popular[k], dg)}</td><td class="num">${q(pv.obscure[k], dg)}</td></tr>`).join('')}
    </tbody></table></div>
    ${data.docs.methodology ? `<div class="prose-wide md">${data.docs.methodology}</div>` : ''}
  `;
}

function renderHistory() {
  const t = data.timeline || [];
  $('#history-body').innerHTML = `
    <h2>Timeline</h2>
    <ol class="timeline">${t.map(e => `<li><span class="yr">${esc(e.year)}</span> <span class="ev">${esc(e.event)}</span><div class="sig">${esc(e.significance || '')}</div></li>`).join('')}</ol>
    ${data.docs.history ? `<div class="md">${data.docs.history}</div>` : ''}
    ${data.docs.concepts ? `<div class="md">${data.docs.concepts}</div>` : ''}
  `;
}

// ---------------- tabs ----------------
const rendered = {};
function showTab() {
  const tab = (location.hash || '#mix').slice(1);
  const valid = ['mix', 'canon', 'model', 'history'].includes(tab) ? tab : 'mix';
  for (const t of ['mix', 'canon', 'model', 'history']) $(`#tab-${t}`).hidden = t !== valid;
  document.querySelectorAll('.tabs a').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === valid) || a.setAttribute('aria-current', 'page'));
  document.querySelectorAll('.tabs a').forEach(a => { if (a.dataset.tab === valid) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (valid === 'canon' && !rendered.canon) { initCanon(); rendered.canon = true; }
  if (valid === 'model' && !rendered.model) { renderModel(); rendered.model = true; }
  if (valid === 'history' && !rendered.history) { renderHistory(); rendered.history = true; }
}

async function main() {
  data = await loadData();
  engine = createEngine(data);
  $('#strap').textContent = `A tiki drink generator built on ${data.drinks.length} catalogued recipes`;
  $('#examples').innerHTML = EXAMPLES.map(e => `<button type="button" class="chip">${esc(e)}</button>`).join('');
  $('#examples').querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('#prompt').value = c.textContent; mix(c.textContent, 0); }));
  $('#order-form').addEventListener('submit', e => { e.preventDefault(); const p = $('#prompt').value.trim(); if (p) mix(p, 0); });
  $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#order-form').requestSubmit(); } });
  $('#again-btn').addEventListener('click', () => mix($('#prompt').value.trim() || state.prompt, state.prompt === $('#prompt').value.trim() ? state.seed + 1 : 0));
  document.querySelectorAll('.unit').forEach(b => b.addEventListener('click', () => {
    state.units = b.dataset.units;
    store.set('units', state.units);
    document.querySelectorAll('.unit').forEach(x => x.classList.toggle('on', x === b));
    if (state.current) renderResult(state.current);
    if (state.canonSel && rendered.canon) showDrink(state.canonSel, false);
  }));
  document.querySelectorAll('.unit').forEach(x => x.classList.toggle('on', x.dataset.units === state.units));
  window.addEventListener('hashchange', showTab);
  showTab();
  mix($('#prompt').value.trim(), 0);
  renderRecent();
}

main().catch(err => {
  $('#result').innerHTML = `<p>Couldn't load the drink database (${esc(err.message)}). If you opened this file directly, serve the repo with <code>npx serve .</code> or <code>python3 -m http.server</code> and open /web/.</p>`;
});
