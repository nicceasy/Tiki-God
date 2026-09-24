// Ink and watercolor on paper. See docs/art-direction.md for the research behind these choices.
//  - paper: a cold-press height map (value noise), shown faintly and reused for granulation
//  - ink:   pressure ribbons (perfect-freehand-style outline around a spline) that draw on
//  - wash:  Tyler Hobbs' stacked, recursively deformed polygons, multiplied, with a darker
//           rim (Curtis et al.'s edge darkening) and granulation keyed to the paper

export const TAU = Math.PI * 2;
export const INK = '#1D1A22';

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function gauss(r) {
  const u = Math.max(1e-9, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- paper
function valueNoise(size, cells, r) {
  const g = Array.from({ length: (cells + 1) * (cells + 1) }, () => r());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let u = fx - ix, v = fy - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const at = (i, j) => g[((j % cells) * (cells + 1)) + (i % cells)];
    out[y * size + x] = (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
  }
  return out;
}

// A tileable cold-press sheet: `height` in 0..1 and a speckle tile used for granulation.
export function makePaper(size = 192, seed = 7) {
  const r = rng(seed);
  const a = valueNoise(size, 8, r), b = valueNoise(size, 24, r), c = valueNoise(size, 64, r);
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) height[i] = 0.5 * a[i] + 0.32 * b[i] + 0.18 * c[i];
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < height.length; i++) {
    // Valleys (low height) catch pigment; speckles are dark where the paper dips.
    const valley = clamp((0.46 - height[i]) * 6, 0, 1) * (0.55 + 0.45 * r());
    img.data[i * 4] = 60; img.data[i * 4 + 1] = 50; img.data[i * 4 + 2] = 45;
    img.data[i * 4 + 3] = Math.round(valley * 255);
  }
  ctx.putImageData(img, 0, 0);
  return { size, height, canvas };
}

// Faint visible tooth for the page background, as a data URL.
export function paperTexture(size = 256, seed = 3) {
  const r = rng(seed);
  const a = valueNoise(size, 16, r), b = valueNoise(size, 48, r);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const h = 0.6 * a[i] + 0.4 * b[i];
    const shadeV = (h - 0.5) * 2;
    const fleck = r() < 0.0025 ? 1 : 0;
    img.data[i * 4] = shadeV > 0 ? 255 : 90; img.data[i * 4 + 1] = shadeV > 0 ? 255 : 80; img.data[i * 4 + 2] = shadeV > 0 ? 255 : 70;
    img.data[i * 4 + 3] = Math.round(Math.min(255, Math.abs(shadeV) * 26 + fleck * 40));
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

// ---------------------------------------------------------------- splines & ribbons
export function spline(pts, step = 2.5, closed = false) {
  if (pts.length < 2) return pts.slice();
  const n = pts.length, out = [];
  const P = i => closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(closed ? pts[0].slice() : pts[n - 1].slice());
  return out;
}

// A brush-pen stroke: tapers in and out, swells a little mid-stroke, wanders a hair.
export function ribbon(points, { w = 2.4, taperIn = 0.14, taperOut = 0.28, swell = 0.16, seed = 1, wobble = 0.5 } = {}) {
  const pts = spline(points, 2);
  const r = rng(seed);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1] || 1;
  const widths = [], left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const u = lens[i] / total;
    const inn = Math.min(1, u / Math.max(0.01, taperIn)), out = Math.min(1, (1 - u) / Math.max(0.01, taperOut));
    const press = Math.pow(inn, 0.55) * Math.pow(out, 0.7) * (1 + swell * Math.sin(Math.PI * u)) * (1 + 0.07 * Math.sin(lens[i] * 0.09 + ph[0]));
    widths.push(Math.max(0.35, w * press));
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const off = wobble * (Math.sin(lens[i] * 0.035 + ph[1]) * 0.6 + Math.sin(lens[i] * 0.11 + ph[2]) * 0.4);
    const px = pts[i][0] + nx * off, py = pts[i][1] + ny * off, hw = widths[i] / 2;
    left.push([px + nx * hw, py + ny * hw]); right.push([px - nx * hw, py - ny * hw]);
  }
  return { pts, lens, total, widths, left, right };
}

export function drawRibbon(ctx, rib, progress = 1, color = INK, alpha = 1) {
  if (progress <= 0) return;
  const end = rib.total * Math.min(1, progress);
  let k = rib.lens.findIndex(l => l > end);
  if (k === -1) k = rib.lens.length;
  if (k < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(rib.left[0][0], rib.left[0][1]);
  for (let i = 1; i < k; i++) ctx.lineTo(rib.left[i][0], rib.left[i][1]);
  for (let i = k - 1; i >= 0; i--) ctx.lineTo(rib.right[i][0], rib.right[i][1]);
  ctx.closePath();
  ctx.fill();
  // Rounded nib at the moving tip while drawing.
  if (progress < 1) {
    const i = k - 1;
    ctx.beginPath(); ctx.arc(rib.pts[i][0], rib.pts[i][1], rib.widths[i] / 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- watercolor (Hobbs)
function resample(poly, n) {
  const lens = [0];
  for (let i = 1; i <= poly.length; i++) {
    const a = poly[i - 1], b = poly[i % poly.length];
    lens.push(lens[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lens[lens.length - 1], out = [];
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    let i = lens.findIndex(l => l > d) - 1;
    if (i < 0) i = 0;
    const a = poly[i], b = poly[(i + 1) % poly.length], t = (d - lens[i]) / ((lens[i + 1] - lens[i]) || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function deform(verts, depth, r) {
  let cur = verts;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i], c = cur[(i + 1) % cur.length];
      next.push(a);
      const len = Math.hypot(c.x - a.x, c.y - a.y);
      const v = (a.v + c.v) / 2;
      const nx = -(c.y - a.y) / (len || 1), ny = (c.x - a.x) / (len || 1);
      const g1 = gauss(r) * len * v * 0.3, g2 = gauss(r) * len * v * 0.12;
      next.push({ x: (a.x + c.x) / 2 + nx * g1 + (c.x - a.x) / (len || 1) * g2, y: (a.y + c.y) / 2 + ny * g1 + (c.y - a.y) / (len || 1) * g2, v: v * (0.85 + r() * 0.3) });
    }
    cur = next;
  }
  return cur;
}

// Precompute the layered wash for a polygon. `soft` controls how far edges wander.
export function makeWash(poly, { seed = 1, layers = 22, soft = 1, verts = 12, off = 3 } = {}) {
  const r = rng(seed);
  const dx = (r() - 0.5) * 2 * off, dy = (r() - 0.5) * 2 * off;
  const base0 = resample(poly, verts).map(([x, y]) => ({ x: x + dx, y: y + dy, v: (0.35 + r() * 0.9) * soft }));
  const base = deform(base0, 4, r);
  const paths = [];
  for (let k = 0; k < layers; k++) paths.push(deform(base.map(p => ({ ...p })), 2, r));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const L of paths) for (const p of L) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { base, paths, box: [minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8] };
}

// Draw the first `progress` share of the layers (the bloom), then the rim and granulation.
export function drawWash(ctx, wash, progress, color, { alpha = 0.055, paper = null, rim = 0.16, grain = 0.28 } = {}) {
  if (progress <= 0) return;
  const k = Math.max(1, Math.round(wash.paths.length * Math.min(1, progress)));
  const fade = Math.min(1, progress * 1.4);
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * fade;
  for (let i = 0; i < k; i++) {
    const L = wash.paths[i];
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    for (let j = 1; j < L.length; j++) ctx.lineTo(L[j].x, L[j].y);
    ctx.closePath();
    ctx.fill();
  }
  if (progress >= 0.7) {
    const e = (progress - 0.7) / 0.3;
    const B = wash.base;
    ctx.beginPath(); ctx.moveTo(B[0].x, B[0].y); for (let j = 1; j < B.length; j++) ctx.lineTo(B[j].x, B[j].y); ctx.closePath();
    ctx.globalAlpha = rim * e; ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
    if (paper && grain > 0) {
      // Granulation: pigment settles into the paper's valleys, only where there is pigment.
      ctx.clip();
      ctx.globalAlpha = grain * e;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = paper.pattern || (paper.pattern = ctx.createPattern(paper.canvas, 'repeat'));
      const [x, y, w, h] = wash.box;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- small helpers for authoring shapes
export function ell(cx, cy, rx, ry, a0 = 0, a1 = TAU, n = 24, rot = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}
export function jitter(pts, amt, r) { return pts.map(([x, y]) => [x + (r() - 0.5) * amt, y + (r() - 0.5) * amt]); }
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${[16, 8, 0].map(s => m(s).toString(16).padStart(2, '0')).join('')}`;
}
