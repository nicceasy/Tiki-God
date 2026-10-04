// Draws an art spec (artspec.js) with ink and watercolor: each element's strokes draw on in
// order at pen speed, then its washes bloom layer by layer, then the page goes still.
// Two stacked canvases: `base` keeps everything finished (washes accumulate there directly,
// since translucent layers are order-free); `live` holds only the strokes still being drawn.
// Occlusion: a part may name `cover` polygons, the area it hides. Everything an earlier element
// draws, whenever it draws it, is clipped out of the covers of the elements after it, so a lime
// wheel slotted on the rim hides the glass behind it and the ice heap hides the back of the rim.
import { ribbon, drawRibbon, makeWash, drawWashLayers, finishWash, makePaper, seedOf, INK, TAU } from './ink.js';
import { CATALOG } from './artcatalog.js';
import { validateSpec } from './artspec.js';

const TIER = { 1: { w: 2.3, a: 1 }, 2: { w: 1.35, a: 0.86 }, 3: { w: 0.95, a: 0.55 } };
const SPEED = 950;    // spec units per second
const LIFT = 0.035;   // pen lift between strokes, seconds
const BLOOM = 0.62;   // wash bloom, seconds
// The longest any one element takes to draw on: the vessel and drink get the most, garnish less,
// and finishing touches (the front of the rim, frost, a dusting of nutmeg) go on quickly.
const QUICK = new Set(['glass.front', 'glass.frost', 'glass.condensation', 'fizz', 'steam', 'sparkle', 'garnish.bitters-crown', 'garnish.nutmeg', 'garnish.dust']);
const QUICK_DRAW = 0.3;
const drawTime = part => QUICK.has(part) ? QUICK_DRAW : part === 'ice' ? 0.7 : part === 'straw' ? 0.45 : part.startsWith('garnish.') ? 0.8 : 1.15;

let PAPER = null;
const paper = () => PAPER || (PAPER = makePaper(192, 7));

function placer(el) {
  const s = el.s ?? 1, rot = el.rot ?? 0, [ax, ay] = el.anchor || [0, 0], c = Math.cos(rot), sn = Math.sin(rot);
  return ([px, py]) => [el.x + ((px - ax) * c - (py - ay) * sn) * s, el.y + ((px - ax) * sn + (py - ay) * c) * s];
}

function perimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; p += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return p;
}

// Resolve one element to drawable ink and pigment in spec space.
function build(el, i, seed) {
  const part = CATALOG[el.part](el.params || {});
  const T = placer(el), s = el.s ?? 1, k = Math.pow(s, 0.6);
  const strokes = part.strokes.map((st, j) => {
    const t = TIER[st.tier] || TIER[1];
    const w = (st.w ? (st.w / 2.3) * t.w : t.w) * k;
    const rib = ribbon(st.pts.map(T), { w, seed: seedOf(`${seed}:${i}:${j}`), wobble: 0.45 * Math.min(1.4, s), taperIn: 0.12, taperOut: st.tier === 1 ? 0.3 : 0.4, swell: st.tier === 1 ? 0.18 : 0.1 });
    // (a stroke may name its own color and strength: a block of ice inked in the drink's own
    // deeper tone, a cool highlight laid over the drink; otherwise it is the pen's ink)
    return { rib, alpha: st.alpha ?? t.a, color: st.color || INK };
  });
  const washes = (part.washes || []).map((w, j) => {
    const pts = w.pts.map(T);
    const clip = (w.clip || []).filter(c => c.length > 2).map(c => c.map(T));
    return { pts, color: w.color, alpha: w.alpha ?? 0.055, soft: w.soft ?? 1, grain: w.grain ?? 0.28, layers: w.layers ?? 22, seed: seedOf(`${seed}:${i}:w${j}`), verts: Math.max(6, Math.min(14, Math.round(perimeter(pts) / 30))), off: 1.5 + 2 * Math.min(1, s), clip, wash: null, drawn: 0, done: false };
  });
  const all = (part.dots || []).map(d => { const [x, y] = T([d.x, d.y]); return { x, y, r: d.r * Math.pow(s, 0.85), color: d.color || INK, alpha: d.color ? 1 : (TIER[d.tier || 1] || TIER[1]).a, top: !!d.top }; });
  // Highlights and flecks marked `top` (a glint on a cherry, frost) go on after every wash.
  const dots = all.filter(d => !d.top), topDots = all.filter(d => d.top);
  const covers = (part.cover || []).filter(c => c.length > 2).map(c => c.map(T));
  // `clip`: the area the part's washes may stain (the inside of the glass), so a wash wandering
  // past it stops at the wall like paint at a masking line instead of bleeding onto the page.
  const clip = (part.clip || []).filter(c => c.length > 2).map(c => c.map(T));
  return { strokes, washes, dots, topDots, covers, clip, glazed: !!part.glazed && washes.length > 0, layer: null };
}

// A glazed part (the drink, a glazed mug) is painted as graded glazes that each multiply exactly
// onto the tone under them (artcatalog.js pigment/glaze). On the shared transparent canvas a pale
// glaze would partly paint itself instead, building alpha and shifting the hue of what is under
// it, so its washes are composited on a private sheet of white paper first, then lifted off as
// one translucent layer ("unmultiplied" against white: alpha = how dark, color = what remains),
// which multiplies onto the drawing (and shows the same over the paper whether or not the page
// blends the art layer). The layers themselves are multiplied in floating point, as optical
// density summed per channel: on an 8-bit canvas each faint layer rounds by up to half a level,
// a different share of its change in each channel, and over a stack of layers a pale cream
// drifts to lemon and a café au lait to salmon. (Rims and granulation, texture, stay 8-bit.)
function glazeLayer(e, ctx) {
  if (e.layer) return e.layer;
  const src = ctx.canvas, W0 = src.width, H0 = src.height, M = ctx.getTransform();
  const c = document.createElement('canvas');
  c.width = W0; c.height = H0;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W0, H0);
  g.setTransform(M);
  for (const w of e.washes) within(g, w.clip, () => finishWash(g, ensureWash(w), w.color, { paper: paper(), grain: w.grain }));
  // How many of a wash's layers cover each pixel: each layer adds `inc` to the alpha of a
  // scratch sheet ('lighter'), so antialiased edges count as part of a layer.
  const dens = new Float32Array(W0 * H0 * 3);
  const sc = document.createElement('canvas');
  sc.width = W0; sc.height = H0;
  const sg = sc.getContext('2d', { willReadFrequently: true });
  for (const w of e.washes) {
    const W = ensureWash(w), inc = Math.max(1, Math.floor(255 / Math.max(1, W.paths.length)));
    const [bx, by, bw, bh] = W.box, xs = [], ys = [];
    for (const [px, py] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) { xs.push(M.a * px + M.c * py + M.e); ys.push(M.b * px + M.d * py + M.f); }
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const x1 = Math.min(W0, Math.ceil(Math.max(...xs))), y1 = Math.min(H0, Math.ceil(Math.max(...ys))), bwPx = x1 - x0, bhPx = y1 - y0;
    if (bwPx <= 0 || bhPx <= 0) continue;
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(x0, y0, bwPx, bhPx);
    sg.setTransform(M); sg.globalCompositeOperation = 'lighter'; sg.globalAlpha = inc / 255; sg.fillStyle = '#fff';
    within(sg, w.clip, () => {
      for (const L of W.paths) {
        sg.beginPath(); sg.moveTo(L[0].x, L[0].y);
        for (let j = 1; j < L.length; j++) sg.lineTo(L[j].x, L[j].y);
        sg.closePath(); sg.fill();
      }
    });
    const cov = sg.getImageData(x0, y0, bwPx, bhPx).data, n = parseInt(w.color.slice(1), 16);
    const lf = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => -Math.log(Math.max(1e-6, 1 - w.alpha * (1 - v / 255))) / inc);
    for (let yy = 0; yy < bhPx; yy++) {
      let o = ((y0 + yy) * W0 + x0) * 3, q = yy * bwPx * 4 + 3;
      for (let xx = 0; xx < bwPx; xx++, o += 3, q += 4) {
        const A = cov[q];
        if (A) { dens[o] += A * lf[0]; dens[o + 1] += A * lf[1]; dens[o + 2] += A * lf[2]; }
      }
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, W0, H0), d = img.data;
  for (let i = 0, o = 0; i < d.length; i += 4, o += 3) {
    if (dens[o] || dens[o + 1] || dens[o + 2]) { d[i] *= Math.exp(-dens[o]); d[i + 1] *= Math.exp(-dens[o + 1]); d[i + 2] *= Math.exp(-dens[o + 2]); }
    const m = Math.min(d[i], d[i + 1], d[i + 2]), a = 255 - m;
    if (a <= 0) { d[i + 3] = 0; continue; }
    d[i] = Math.round((d[i] - m) * 255 / a); d[i + 1] = Math.round((d[i + 1] - m) * 255 / a); d[i + 2] = Math.round((d[i + 2] - m) * 255 / a); d[i + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return (e.layer = c);
}
function drawLayer(ctx, layer, alpha = 1, clip = null) {
  ctx.save(); clipTo(ctx, clip); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = alpha;
  ctx.drawImage(layer, 0, 0); ctx.restore();
}
// Clip to the first polygon (spec space), less each of the others: holes, such as the window of
// an ice cube in a dark drink, each cut out on its own so two holes that overlap stay holes.
// Nothing to clip to leaves the context as it was.
function clipTo(ctx, polys) {
  if (!polys || !polys.length) return;
  const path = P => { ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath(); };
  ctx.beginPath(); path(polys[0]); ctx.clip();
  for (const P of polys.slice(1)) { ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4); path(P); ctx.clip('evenodd'); }
}
function within(ctx, polys, fn) {
  if (!polys || !polys.length) { fn(); return; }
  ctx.save(); clipTo(ctx, polys); fn(); ctx.restore();
}

// Clip out each later element's covers (successive clips intersect: outside all of them).
function clipOut(ctx, polys) {
  for (const P of polys) {
    ctx.beginPath();
    ctx.rect(-1e4, -1e4, 2e4, 2e4);
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.closePath();
    ctx.clip('evenodd');
  }
}
function occluded(ctx, e, fn) {
  if (!e.occ.length) { fn(); return; }
  ctx.save();
  clipOut(ctx, e.occ);
  fn();
  ctx.restore();
}

function schedule(items) {
  let t = 0.05;
  for (const e of items) {
    const raw = e.strokes.map(s => s.rib.total / SPEED + LIFT);
    const sum = raw.reduce((a, b) => a + b, 0);
    const draw = sum ? Math.min(sum, e.maxDraw) : 0;
    const k = sum ? draw / sum : 0;
    let c = e.start = t;
    e.strokes.forEach((s, j) => { s.t0 = c; s.t1 = c + (raw[j] - LIFT) * k; c += raw[j] * k; s.done = false; });
    e.drawEnd = e.start + draw;
    e.washStart = e.start + draw * 0.72;
    e.end = Math.max(e.drawEnd, e.washes.length ? e.washStart + BLOOM : 0);
    e.dotsDone = false;
    t = e.start + draw * 0.82;
  }
  return items.length ? Math.max(...items.map(e => e.end)) : 0;
}

function ensureWash(w) {
  if (!w.wash) w.wash = makeWash(w.pts, { seed: w.seed, layers: w.layers, soft: w.soft, verts: w.verts, off: w.off, depth: 3 });
  return w.wash;
}

function drawDots(ctx, dots) {
  for (const d of dots) {
    ctx.save(); ctx.globalAlpha = d.alpha; ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// Paint a whole spec at once (reduced motion, resizes, cached variants).
function paintAll(ctx, items) {
  for (const e of items) occluded(ctx, e, () => {
    for (const s of e.strokes) drawRibbon(ctx, s.rib, 1, s.color, s.alpha);
    drawDots(ctx, e.dots);
    if (e.glazed) { drawLayer(ctx, glazeLayer(e, ctx), 1, e.clip); return; }
    within(ctx, e.clip, () => {
      for (const w of e.washes) within(ctx, w.clip, () => {
        const W = ensureWash(w);
        drawWashLayers(ctx, W, 0, W.paths.length, w.color, w.alpha);
        finishWash(ctx, W, w.color, { paper: paper(), grain: w.grain });
      });
    });
  });
  for (const e of items) if (e.topDots.length) occluded(ctx, e, () => drawDots(ctx, e.topDots));
}

function makeCanvas(wrap, cls) {
  const c = document.createElement('canvas');
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  wrap.appendChild(c);
  return c;
}

export function createArtist(wrap, { reducedMotion = false } = {}) {
  const base = makeCanvas(wrap, 'ink-base'), live = makeCanvas(wrap, 'ink-live');
  const bctx = base.getContext('2d'), lctx = live.getContext('2d');
  let raf = 0, run = null;

  // `view` is the part of spec space to show. With spec.fit === 'content-y' the drawing is
  // cropped to its own height (full width, so every glass keeps the same scale) and the
  // wrapper takes that aspect ratio.
  function fit(spec, items) {
    let view = [0, 0, spec.box[0], spec.box[1]];
    if (spec.fit === 'content-y' && items.length) {
      let lo = Infinity, hi = -Infinity;
      for (const e of items) {
        for (const s of e.strokes) for (const p of s.rib.left) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
        for (const w of e.washes) for (const p of w.pts) { lo = Math.min(lo, p[1] - 6); hi = Math.max(hi, p[1] + 6); }
      }
      lo = Math.max(0, lo - 12); hi = Math.min(spec.box[1], hi + 10);
      view = [0, lo, spec.box[0], Math.max(40, hi - lo)];
      wrap.style.aspectRatio = `${view[2]} / ${view[3]}`;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = wrap.clientWidth || view[2], H = wrap.clientHeight || view[3];
    for (const c of [base, live]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const f = Math.min(W / view[2], H / view[3]);
    const ox = (W - view[2] * f) / 2 - view[0] * f, oy = (H - view[3] * f) / 2 - view[1] * f;
    for (const c of [bctx, lctx]) c.setTransform(dpr * f, 0, 0, dpr * f, dpr * ox, dpr * oy);
    bctx.save(); bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height); bctx.restore();
    lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, live.width, live.height); lctx.restore();
  }

  function prepare(spec) {
    const { elements, errors } = validateSpec(spec);
    if (errors.length && typeof console !== 'undefined') console.warn('art spec:', errors.join('; '));
    const items = elements.map((el, i) => ({ ...build(el, i, spec.seed ?? 1), maxDraw: drawTime(el.part) }));
    let later = [];
    for (let i = items.length - 1; i >= 0; i--) { items[i].occ = later; later = later.concat(items[i].covers); }
    return items;
  }

  function stop() { cancelAnimationFrame(raf); raf = 0; if (run) { run.resolve(); run = null; } }

  function still(spec) {
    stop();
    const items = prepare(spec);
    fit(spec, items);
    paintAll(bctx, items);
  }

  function play(spec) {
    if (reducedMotion) { still(spec); return Promise.resolve(); }
    stop();
    const items = prepare(spec);
    fit(spec, items);
    const total = schedule(items);
    let topDone = false;
    return new Promise(resolve => {
      run = { resolve };
      const t0 = performance.now();
      const frame = now => {
        const t = (now - t0) / 1000;
        lctx.save(); lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, live.width, live.height); lctx.restore();
        for (const e of items) {
          if (t < e.start) continue;
          for (const s of e.strokes) {
            if (s.done) continue;
            if (t >= s.t1) { occluded(bctx, e, () => drawRibbon(bctx, s.rib, 1, s.color, s.alpha)); s.done = true; }
            else if (t >= s.t0) occluded(lctx, e, () => drawRibbon(lctx, s.rib, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0), s.color, s.alpha));
          }
          if (!e.dotsDone && t >= e.drawEnd) { occluded(bctx, e, () => drawDots(bctx, e.dots)); e.dotsDone = true; }
          if (e.glazed && t >= e.washStart && !e.layerDone) {
            // the drink blooms in as one layer: on the live sheet while it comes up, then laid down
            const k = Math.min(1, (t - e.washStart) / BLOOM), L = glazeLayer(e, bctx);
            if (k < 1) occluded(lctx, e, () => drawLayer(lctx, L, 1 - Math.pow(1 - k, 2), e.clip));
            else { occluded(bctx, e, () => drawLayer(bctx, L, 1, e.clip)); e.layerDone = true; }
          }
          if (t >= e.washStart && !e.glazed) for (const w of e.washes) {
            if (w.done) continue;
            const W = ensureWash(w);
            const n = Math.min(W.paths.length, Math.ceil(W.paths.length * Math.min(1, (t - e.washStart) / BLOOM)));
            if (n > w.drawn) { occluded(bctx, e, () => within(bctx, e.clip, () => within(bctx, w.clip, () => drawWashLayers(bctx, W, w.drawn, n, w.color, w.alpha)))); w.drawn = n; }
            if (n >= W.paths.length) { occluded(bctx, e, () => within(bctx, e.clip, () => within(bctx, w.clip, () => finishWash(bctx, W, w.color, { paper: paper(), grain: w.grain })))); w.done = true; }
          }
        }
        if (!topDone && t >= total) { for (const e of items) if (e.topDots.length) occluded(bctx, e, () => drawDots(bctx, e.topDots)); topDone = true; }
        if (t < total + 0.05) raf = requestAnimationFrame(frame);
        else { raf = 0; const r = run; run = null; if (r) r.resolve(); }
      };
      raf = requestAnimationFrame(frame);
    });
  }

  // A finished copy of whatever is on the base canvas, for cheap swaps (the idol's blink).
  function snapshot() {
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    c.getContext('2d').drawImage(base, 0, 0);
    return c;
  }
  function show(bitmap) {
    stop();
    bctx.save(); bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height); bctx.drawImage(bitmap, 0, 0); bctx.restore();
  }

  return { play, still, stop, snapshot, show, canvas: base };
}
