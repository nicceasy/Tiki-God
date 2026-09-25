// Draws an art spec (artspec.js) with ink and watercolor: each element's strokes draw on in
// order at pen speed, then its washes bloom layer by layer, then the page goes still.
// Two stacked canvases: `base` keeps everything finished (washes accumulate there directly,
// since translucent layers are order-free); `live` holds only the strokes still being drawn.
import { ribbon, drawRibbon, makeWash, drawWashLayers, finishWash, makePaper, seedOf, INK, TAU } from './ink.js';
import { CATALOG } from './artcatalog.js';
import { validateSpec } from './artspec.js';

const TIER = { 1: { w: 2.3, a: 1 }, 2: { w: 1.35, a: 0.86 }, 3: { w: 0.95, a: 0.55 } };
const SPEED = 950;    // spec units per second
const LIFT = 0.035;   // pen lift between strokes, seconds
const BLOOM = 0.62;   // wash bloom, seconds

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
    return { rib, alpha: t.a };
  });
  const washes = (part.washes || []).map((w, j) => {
    const pts = w.pts.map(T);
    return { pts, color: w.color, alpha: w.alpha ?? 0.055, soft: w.soft ?? 1, seed: seedOf(`${seed}:${i}:w${j}`), verts: Math.max(6, Math.min(14, Math.round(perimeter(pts) / 30))), off: 1.5 + 2 * Math.min(1, s), wash: null, drawn: 0, done: false };
  });
  const dots = (part.dots || []).map(d => { const [x, y] = T([d.x, d.y]); return { x, y, r: d.r * Math.pow(s, 0.85), color: d.color || INK, alpha: d.color ? 1 : (TIER[d.tier || 1] || TIER[1]).a }; });
  return { strokes, washes, dots };
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
  if (!w.wash) w.wash = makeWash(w.pts, { seed: w.seed, layers: 22, soft: w.soft, verts: w.verts, off: w.off, depth: 3 });
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
  for (const e of items) {
    for (const s of e.strokes) drawRibbon(ctx, s.rib, 1, INK, s.alpha);
    drawDots(ctx, e.dots);
    for (const w of e.washes) {
      const W = ensureWash(w);
      drawWashLayers(ctx, W, 0, W.paths.length, w.color, w.alpha);
      finishWash(ctx, W, w.color, { paper: paper() });
    }
  }
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
    return elements.map((el, i) => ({ ...build(el, i, spec.seed ?? 1), maxDraw: el.part === 'ice' || el.part === 'fizz' ? 0.7 : 1.15 }));
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
            if (t >= s.t1) { drawRibbon(bctx, s.rib, 1, INK, s.alpha); s.done = true; }
            else if (t >= s.t0) drawRibbon(lctx, s.rib, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0), INK, s.alpha);
          }
          if (!e.dotsDone && t >= e.drawEnd) { drawDots(bctx, e.dots); e.dotsDone = true; }
          if (t >= e.washStart) for (const w of e.washes) {
            if (w.done) continue;
            const W = ensureWash(w);
            const n = Math.min(W.paths.length, Math.ceil(W.paths.length * Math.min(1, (t - e.washStart) / BLOOM)));
            if (n > w.drawn) { drawWashLayers(bctx, W, w.drawn, n, w.color, w.alpha); w.drawn = n; }
            if (n >= W.paths.length) { finishWash(bctx, W, w.color, { paper: paper() }); w.done = true; }
          }
        }
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
