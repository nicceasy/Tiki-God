// The closed catalog of drawable parts. Every illustration on the Shrine is built only from
// these (see artspec.js), in the spirit of json-render's guardrailed component catalogs.
// Each part returns local-space ink strokes, watercolor washes and ink dots:
//   { box: [w, h], strokes: [{ pts, tier }], washes: [{ pts, color, alpha?, soft? }], dots: [{ x, y, r, tier?, color? }] }
// tier 1 = contour, 2 = inner detail, 3 = faint detail (line hierarchy).
import { ell, rng, TAU, spline, mixHex } from './ink.js';

export const PALETTE = {
  hibiscus: '#E4574A', hibiscusDeep: '#B8325A', butter: '#F2C14E', lagoon: '#2D9B94', frond: '#5E8F4C', mint: '#7FB069',
  wood: '#B06A34', woodPale: '#C98B55', orchid: '#EE8FB0', blush: '#F29A9A', lime: '#A9C95A', orange: '#F39A3B', cherry: '#C8203A',
  ochre: '#D9A441', paper: '#F6F4EF', ice: '#9CC9D6',
};

const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
const mirrorX = (pts, cx) => pts.map(([x, y]) => [2 * cx - x, y]);

// A pointed leaf outline along +x from the origin, then placed.
function leafShape(len, wid, x, y, ang) {
  const L = [[0, 0], [len * 0.2, -wid * 0.8], [len * 0.5, -wid], [len * 0.8, -wid * 0.6], [len, 0], [len * 0.8, wid * 0.6], [len * 0.5, wid], [len * 0.2, wid * 0.8], [0, 0]];
  return L.map(([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]);
}

// ---------------------------------------------------------------- decorative subjects
function moaiMug({ glaze = PALETTE.wood } = {}) {
  const left = [[33, 36], [29, 80], [30, 130], [34, 180], [41, 214]];
  const right = mirrorX(left, 80);
  const base = [[41, 214], [60, 221], [80, 223], [100, 221], [119, 214]];
  const body = [...left, ...base.slice(1, -1), ...right.slice().reverse()];
  return {
    box: [160, 230],
    strokes: [
      { pts: left, tier: 1 }, { pts: right, tier: 1 }, { pts: base, tier: 1 },
      { pts: ell(80, 36, 47, 9, 0.05, Math.PI - 0.05, 20), tier: 1 },
      { pts: ell(80, 36, 47, 9, Math.PI + 0.05, TAU - 0.05, 20), tier: 3 },
      { pts: [[40, 84], [58, 77], [80, 79], [102, 77], [120, 84]], tier: 1, w: 3.2 },
      { pts: [[50, 97], [58, 101], [67, 97]], tier: 2 }, { pts: [[93, 97], [102, 101], [110, 97]], tier: 2 },
      { pts: [[73, 88], [70, 114], [63, 140]], tier: 1 }, { pts: [[87, 88], [90, 114], [97, 140]], tier: 1 },
      { pts: [[61, 140], [67, 146], [75, 143]], tier: 2 }, { pts: [[85, 143], [93, 146], [99, 140]], tier: 2 },
      { pts: [[64, 166], [73, 161], [80, 163], [87, 161], [96, 166]], tier: 1 },
      { pts: [[68, 170], [80, 176], [92, 170]], tier: 2 },
      { pts: [[52, 197], [80, 204], [108, 197]], tier: 3 },
      { pts: [[34, 96], [22, 104], [21, 140], [31, 152]], tier: 1 }, { pts: [[126, 96], [138, 104], [139, 140], [129, 152]], tier: 1 },
    ],
    washes: [{ pts: body, color: glaze, alpha: 0.036 }],
    rim: { cx: 80, cy: 36, rx: 47, ry: 9 },
  };
}

function kuIdol({ blink = false } = {}) {
  const eyes = blink
    ? [{ pts: [[45, 100], [62, 107], [79, 100]], tier: 1 }, { pts: [[91, 100], [108, 107], [125, 100]], tier: 1 }]
    : [{ pts: ell(62, 98, 17, 17, -1.3, -1.3 + TAU * 1.04, 26), tier: 1 }, { pts: ell(108, 98, 17, 17, -1.3, -1.3 + TAU * 1.04, 26), tier: 1 }];
  return {
    box: [170, 214],
    strokes: [
      { pts: [[34, 208], [28, 70], [38, 30], [85, 18], [132, 30], [142, 70], [136, 208]], tier: 1 },
      { pts: [[36, 52], [134, 52]], tier: 2 }, { pts: [[35, 66], [135, 66]], tier: 2 },
      { pts: [[40, 64], [50, 55], [60, 64], [70, 55], [80, 64], [90, 55], [100, 64], [110, 55], [120, 64], [130, 55]], tier: 3 },
      ...eyes,
      { pts: [[79, 112], [72, 131], [98, 131], [91, 112]], tier: 2 },
      { pts: [[48, 149], [122, 149]], tier: 1 },
      { pts: [[48, 149], [60, 169], [85, 179], [110, 169], [122, 149]], tier: 1 },
      ...[62, 74, 85, 96, 108].map(x => ({ pts: [[x, 150], [x, 158 + (x === 85 ? 2 : 0)]], tier: 2 })),
      { pts: [[50, 192], [85, 200], [120, 192]], tier: 3 },
    ],
    washes: [
      { pts: [[34, 206], [28, 70], [38, 30], [85, 18], [132, 30], [142, 70], [136, 206]], color: PALETTE.woodPale, alpha: 0.045 },
      { pts: ell(85, 168, 16, 8, 0, TAU, 14), color: PALETTE.hibiscus, alpha: 0.07, soft: 0.5 },
      { pts: ell(42, 128, 11, 9, 0, TAU, 12), color: PALETTE.blush, alpha: 0.07, soft: 0.6 },
      { pts: ell(128, 128, 11, 9, 0, TAU, 12), color: PALETTE.blush, alpha: 0.07, soft: 0.6 },
    ],
    dots: blink ? [] : [{ x: 62, y: 100, r: 6 }, { x: 108, y: 100, r: 6 }, { x: 60, y: 97, r: 1.8, color: PALETTE.paper }, { x: 106, y: 97, r: 1.8, color: PALETTE.paper }],
  };
}

function hibiscus({ seed = 1 } = {}) {
  const r = rng(seed), cx = 100, cy = 100, strokes = [], washes = [];
  for (let i = 0; i < 5; i++) {
    const t = -Math.PI / 2 + i * TAU / 5 + (r() - 0.5) * 0.18;
    const edge = [polar(cx, cy, 40, t - 0.56), polar(cx, cy, 70, t - 0.52), polar(cx, cy, 80, t - 0.3), polar(cx, cy, 73, t - 0.12), polar(cx, cy, 82, t + 0.06), polar(cx, cy, 74, t + 0.24), polar(cx, cy, 78, t + 0.42), polar(cx, cy, 69, t + 0.56), polar(cx, cy, 38, t + 0.56)];
    const petal = [polar(cx, cy, 8, t - 0.35), ...edge, polar(cx, cy, 8, t + 0.35)];
    strokes.push({ pts: edge, tier: 1 });
    strokes.push({ pts: [polar(cx, cy, 14, t - 0.08), polar(cx, cy, 50, t - 0.16)], tier: 3 });
    strokes.push({ pts: [polar(cx, cy, 14, t + 0.1), polar(cx, cy, 46, t + 0.2)], tier: 3 });
    washes.push({ pts: petal, color: PALETTE.hibiscus, alpha: 0.05 });
  }
  washes.push({ pts: ell(cx, cy, 20, 20, 0, TAU, 14), color: PALETTE.hibiscusDeep, alpha: 0.07, soft: 0.5 });
  strokes.push({ pts: [[cx, cy], [cx + 18, cy - 13], [cx + 34, cy - 28], [cx + 46, cy - 44]], tier: 1 });
  const tip = [cx + 46, cy - 44];
  const dots = Array.from({ length: 6 }, (_, k) => ({ x: tip[0] + Math.cos(k * 1.05) * 6, y: tip[1] + Math.sin(k * 1.05) * 6, r: 2 }));
  washes.push({ pts: ell(tip[0], tip[1], 9, 9, 0, TAU, 10), color: PALETTE.butter, alpha: 0.09, soft: 0.5 });
  return { box: [200, 200], strokes, washes, dots };
}

function plumeria({ seed = 2 } = {}) {
  const r = rng(seed), cx = 75, cy = 75, strokes = [], washes = [];
  for (let i = 0; i < 5; i++) {
    const t = i * TAU / 5 + r() * 0.2;
    const petal = [polar(cx, cy, 6, t - 0.2), polar(cx, cy, 30, t - 0.46), polar(cx, cy, 52, t - 0.26), polar(cx, cy, 57, t + 0.04), polar(cx, cy, 49, t + 0.3), polar(cx, cy, 24, t + 0.24), polar(cx, cy, 7, t + 0.16)];
    strokes.push({ pts: petal, tier: 1 });
    washes.push({ pts: petal, color: PALETTE.orchid, alpha: 0.018, soft: 0.8 });
  }
  washes.push({ pts: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => polar(cx, cy, k % 2 ? 9 : 22, k * TAU / 10)), color: PALETTE.butter, alpha: 0.09, soft: 0.7 });
  return { box: [150, 150], strokes, washes };
}

// A monstera leaf, tip up: a heart with its notch at the stem. The slits are part of the
// outline, so the ink traces them and the wash leaves them as paper.
function monstera() {
  const ctrl = [[100, 158], [70, 180], [34, 168], [14, 130], [14, 86], [34, 44], [66, 18], [100, 10]];
  const left = [ctrl[0]];
  for (let k = 1; k < ctrl.length; k++) {
    const [a, b] = [ctrl[k - 1], ctrl[k]];
    if (k >= 2 && k <= 6) {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      const g = [dx / l * 4, dy / l * 4], depth = k === 6 ? 0.45 : 0.62;
      const inner = [m[0] + (100 - m[0]) * depth, m[1] + (Math.min(150, Math.max(24, m[1] - 8)) - m[1]) * depth];
      left.push([m[0] - g[0], m[1] - g[1]], inner, [m[0] + g[0], m[1] + g[1]]);
    }
    left.push(b);
  }
  const right = mirrorX(left, 100);
  return {
    box: [200, 200],
    strokes: [
      { pts: left, tier: 1 }, { pts: right, tier: 1 },
      { pts: [[100, 158], [99, 110], [100, 60], [100, 16]], tier: 2 },
      { pts: [[100, 158], [103, 180], [112, 198]], tier: 1 },
      { pts: ell(84, 118, 3.5, 7, 0, TAU, 12, 0.5), tier: 2 }, { pts: ell(117, 80, 3.5, 6, 0, TAU, 12, -0.5), tier: 2 },
    ],
    // The wash follows the whole leaf, slits and all; watercolor that ignores a cut reads as life.
    washes: [{ pts: [...ctrl, ...mirrorX(ctrl, 100).reverse().slice(1)], color: PALETTE.frond, alpha: 0.05, soft: 0.7 }],
  };
}

function pineapple() {
  const cx = 70, cy = 150, rx = 44, ry = 58;
  const strokes = [{ pts: ell(cx, cy, rx, ry, -Math.PI / 2 + 0.2, -Math.PI / 2 + TAU * 1.02, 34), tier: 1 }];
  // Diamond crosshatch clipped to the body.
  for (const dir of [1, -1]) for (let c = -120; c <= 120; c += 18) {
    const pts = [];
    for (let s = -80; s <= 80; s += 4) {
      const x = cx + s, y = cy + dir * s * 0.9 + c;
      if (((x - cx) / (rx - 4)) ** 2 + ((y - cy) / (ry - 4)) ** 2 <= 1) pts.push([x, y]);
    }
    if (pts.length > 3) strokes.push({ pts: [pts[0], pts[pts.length - 1]], tier: 3 });
  }
  const crown = [];
  [-2.1, -1.8, -1.55, -1.3, -1.05].forEach((a, i) => {
    const len = 44 + (i === 2 ? 18 : 0) - Math.abs(i - 2) * 4;
    const leaf = leafShape(len, 7, cx + (i - 2) * 5, 96, a);
    crown.push(leaf);
    strokes.push({ pts: leaf, tier: 1 });
  });
  return {
    box: [140, 214],
    strokes,
    washes: [{ pts: ell(cx, cy, rx, ry, 0, TAU, 24), color: PALETTE.ochre, alpha: 0.05 }, ...crown.map(l => ({ pts: l, color: PALETTE.frond, alpha: 0.06, soft: 0.6 }))],
  };
}

// A glass fishing float in its rope net: a nautical object for the decorative frame, where a
// carved figure would make a mascot of something sacred (presentation.md §6.2).
function glassFloat() {
  const cx = 90, cy = 110, r = 72, strokes = [{ pts: ell(cx, cy, r, r, -1.2, -1.2 + TAU * 1.03, 40), tier: 1 }];
  for (const s of [0.4, 0.8]) strokes.push({ pts: ell(cx, cy, r * s, r * 0.98, -Math.PI / 2, Math.PI / 2, 22), tier: 3 }, { pts: ell(cx, cy, r * s, r * 0.98, Math.PI / 2, Math.PI * 1.5, 22), tier: 3 });
  for (const y of [-0.55, 0, 0.55]) strokes.push({ pts: ell(cx, cy + y * r, r * Math.sqrt(1 - y * y), r * 0.12, 0.05, Math.PI - 0.05, 18), tier: 3 });
  strokes.push({ pts: ell(cx - 28, cy - 34, 22, 26, Math.PI + 0.3, Math.PI + 1.2, 10), tier: 3 });
  strokes.push({ pts: ell(cx, cy - r - 8, 10, 7, 0, TAU, 14), tier: 1 }, { pts: [[cx + 8, cy - r - 12], [cx + 34, cy - r - 30], [cx + 52, cy - r - 26]], tier: 2 });
  return { box: [180, 200], strokes, washes: [{ pts: ell(cx, cy, r - 2, r - 2, 0, TAU, 24), color: PALETTE.lagoon, alpha: 0.03 }, { pts: ell(cx + 18, cy + 22, r * 0.55, r * 0.5, 0, TAU, 16), color: PALETTE.lagoon, alpha: 0.025, soft: 0.6 }] };
}

// ---------------------------------------------------------------- garnishes
// Garnishes are drawn at their real size, 38 units to the inch like the vessels (docs/vessels.md):
// a cherry is about 32 units across, a lime shell 80, an orange wheel 110. Each has its origin
// at the point that touches the drink, so a spec places it at s ≈ 1. A part may also carry
// `cover` polygons, the area it hides: the renderer keeps anything drawn before it out of them,
// so a wheel slotted on the rim sits in front of the glass and mint in front of the straw.
export const PER_INCH = 38;

const turn = (pts, a, ox = 0, oy = 0) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [ox + x * c - y * s, oy + x * s + y * c]); };
const circle = (cx, cy, r, n = 22) => ell(cx, cy, r, r, 0, TAU, n);
const NUTMEG = '#7A4A26', BAMBOO = '#D2AC63', PEEL = { orange: PALETTE.orange, lemon: PALETTE.butter, lime: PALETTE.lime, grapefruit: '#F2A08A' };

// Several drawings ({ strokes, washes, dots, cover }) as one.
function merge(...parts) {
  const out = { strokes: [], washes: [], dots: [], cover: [] };
  for (const p of parts) for (const k of Object.keys(out)) if (p && p[k]) out[k].push(...p[k]);
  return out;
}
// A drawing turned by `a` about its origin, then moved by (dx, dy).
function moved(part, dx, dy, a = 0) {
  const T = pts => turn(pts, a, dx, dy);
  return {
    strokes: (part.strokes || []).map(s => ({ ...s, pts: T(s.pts) })),
    washes: (part.washes || []).map(w => ({ ...w, pts: T(w.pts) })),
    dots: (part.dots || []).map(d => { const [[x, y]] = T([[d.x, d.y]]); return { ...d, x, y }; }),
    cover: (part.cover || []).map(T),
  };
}

// A leaf along +x from the origin, widest about a third of the way out; `teeth` serrates it.
function leaf(len, wid, { teeth = false, n = 14, round = 0.72 } = {}) {
  const up = [], dn = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let w = wid * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, round))), 0.85);
    if (teeth && i > 1 && i < n - 1 && i % 2) w *= 1.11;
    up.push([u * len, -w]); dn.push([u * len, w]);
  }
  return [...up, ...dn.reverse().slice(1)];
}

// Mint: a garnish sprig is the top of the stem, a bushy crown of serrated leaves about an inch
// long. Pairs alternate at right angles up the stem, so every other pair is seen end-on,
// shorter and more upright; three young leaves make the tip.
function mintSprig(h, lean, k = 1, seed = 1) {
  const r = rng(seed), strokes = [], washes = [], cover = [];
  const ax = Math.sin(lean), ay = -Math.cos(lean), dir = Math.atan2(ay, ax);
  const at = u => [ax * h * u + Math.sin(u * Math.PI) * 2.5, ay * h * u];
  strokes.push({ pts: [0, 0.25, 0.5, 0.75, 0.96].map(at), tier: 1 });
  const addLeaf = (x, y, ang, len, wid, color) => {
    len *= k; wid *= k;
    const L = turn(leaf(len, wid, { teeth: true, n: 16 }), ang, x, y);
    const p = (u, v) => [x + Math.cos(ang) * len * u - Math.sin(ang) * wid * v, y + Math.sin(ang) * len * u + Math.cos(ang) * wid * v];
    strokes.push({ pts: L, tier: 2 }, { pts: [p(0.06, 0), p(0.84, 0)], tier: 3 });
    if (len > 20) strokes.push({ pts: [p(0.28, 0), p(0.5, -0.6)], tier: 3 }, { pts: [p(0.28, 0), p(0.5, 0.6)], tier: 3 });
    washes.push({ pts: L, color, alpha: 0.075, soft: 0.5 });
    cover.push(L);
  };
  // [height up the stem, leaf length, width, spread from the stem, seen end-on]
  const nodes = [[0.3, 36, 15, 1.38, false], [0.48, 24, 12, 0.5, true], [0.62, 31, 13.5, 1.08, false], [0.78, 19, 10, 0.42, true]];
  for (const [u, len, wid, spread, endOn] of nodes) {
    const [x, y] = at(u), droop = endOn ? 0 : 0.14;
    addLeaf(x, y, dir - spread + droop, len, wid, mixHex(PALETTE.mint, PALETTE.frond, 0.1 + r() * 0.35));
    addLeaf(x, y, dir + spread - droop, len * 0.95, wid, mixHex(PALETTE.mint, PALETTE.frond, 0.1 + r() * 0.35));
  }
  const [tx, ty] = at(0.96);
  [-0.45, 0.02, 0.48].forEach((d, i) => addLeaf(tx, ty, dir + d, i === 1 ? 19 : 15, i === 1 ? 8 : 7, PALETTE.mint));
  return { strokes, washes, cover };
}
function mint({ big = false, h = 110 } = {}) {
  const part = big
    ? merge(mintSprig(h * 0.8, -0.4, 0.9, 2), mintSprig(h * 0.86, 0.38, 0.9, 3), mintSprig(h, 0.02, 1, 4))
    : mintSprig(h, 0.04, 1, 5);
  return { box: [140, h + 24], ...part };
}
// Basil, rosemary or geranium: the mint drawing with the herb's own leaf.
function herbSprig({ herb = 'basil', h = 100 } = {}) {
  if (herb !== 'rosemary') {
    const p = mintSprig(h, 0.05, 1.08);
    return { box: [120, h + 20], ...p, washes: p.washes.map(w => ({ ...w, color: herb === 'basil' ? '#4F8F3A' : PALETTE.frond })) };
  }
  const strokes = [{ pts: [[0, 0], [3, -h * 0.5], [6, -h]], tier: 1 }], washes = [];
  for (let i = 0; i < 16; i++) {
    const u = 0.2 + i * 0.05, x = 3 * u * 2, y = -h * u, a = -Math.PI / 2 + (i % 2 ? 0.9 : -0.9);
    const L = turn(leaf(16, 2.4), a, x, y);
    strokes.push({ pts: L, tier: 2 });
    washes.push({ pts: L, color: '#5C7F5A', alpha: 0.08, soft: 0.4 });
  }
  return { box: [60, h + 10], strokes, washes };
}

// The spent lime half. Dome up, it floats skin-up on the ice like an island (the Mai Tai); cup
// up, its cut face makes a little boat for a flaming crouton.
function limeShell({ orientation = 'dome-up', seed = 3 } = {}) {
  const r = rng(seed), rx = 40;
  const pores = (ry, up) => Array.from({ length: 16 }, () => {
    const a = Math.PI + 0.25 + r() * (Math.PI - 0.5), k = 0.25 + r() * 0.65;
    return { x: Math.cos(a) * rx * k, y: (up ? -1 : 1) * Math.abs(Math.sin(a)) * ry * k, r: 0.75, tier: 3 };
  });
  if (orientation === 'cup-up') {
    const ry = 11, skin = ell(0, 0, rx, 24, 0, Math.PI, 18);
    const outline = [...ell(0, 0, rx, ry, Math.PI, TAU, 16), ...skin.slice(1)];
    return {
      box: [84, 60],
      strokes: [
        { pts: ell(0, 0, rx, ry, 0, TAU * 1.02, 26), tier: 1 }, { pts: ell(0, 1.5, rx - 7, ry - 3.5, 0, TAU, 22), tier: 2 },
        { pts: skin, tier: 1 },
        // a sugar cube soaked in lemon extract, sitting in the hollow
        { pts: [[-8, 1], [-8, -10], [7, -11], [8, 0]], tier: 2 }, { pts: [[-8, -10], [-3, -14], [11, -15], [7, -11]], tier: 3 },
      ],
      washes: [{ pts: outline, color: PALETTE.lime, alpha: 0.12, soft: 0.35 }, { pts: ell(0, 1.5, rx - 8, ry - 4, 0, TAU, 14), color: '#E6EBC0', alpha: 0.07, soft: 0.4 }, { pts: [[-8, 0], [-8, -10], [7, -11], [8, 0]], color: PALETTE.butter, alpha: 0.12, soft: 0.3 }],
      dots: pores(20, false).map(d => ({ ...d, y: Math.abs(d.y) + 6 })),
      cover: [outline],
    };
  }
  const ry = 25, dome = ell(0, 0, rx, ry, Math.PI, TAU, 26);
  const water = [];
  for (let x = -rx - 9; x <= rx + 9; x += 6) water.push([x, 2 + (r() - 0.5) * 3 + (Math.abs(x) > rx - 4 ? -2 : 0)]);
  return {
    box: [96, 40],
    strokes: [
      { pts: dome, tier: 1 }, { pts: water, tier: 3 },
      { pts: ell(3, -ry + 2.5, 3.4, 1.8, 0, TAU, 10), tier: 2 },
      { pts: ell(-8, -6, 22, 14, Math.PI + 0.5, Math.PI + 1.3, 8), tier: 3 },
    ],
    washes: [{ pts: [...dome, [rx, 1], [-rx, 1]], color: PALETTE.lime, alpha: 0.085, soft: 0.35 }, { pts: [...ell(0, 0, rx - 3, 9, Math.PI, TAU, 14), [rx - 3, 2], [-rx + 3, 2]], color: PALETTE.frond, alpha: 0.035, soft: 0.5 }],
    dots: pores(ry, true),
    cover: [[...dome, [rx, 2], [-rx, 2]]],
  };
}

// Fire for a flaming crouton or a volcano crater: three tongues, butter at the heart.
function flame({ h = 56 } = {}) {
  const k = h / 56;
  const outer = [[-15, 0], [-20, -14], [-13, -29], [-15, -42], [-5, -33], [0, -56], [6, -37], [15, -46], [13, -28], [19, -13], [15, 0]].map(([x, y]) => [x * k, y * k]);
  const inner = [[-8, -2], [-9, -13], [-3, -23], [0, -34], [4, -23], [9, -13], [8, -2]].map(([x, y]) => [x * k, y * k]);
  return {
    box: [44, 60],
    strokes: [{ pts: outer, tier: 1 }, { pts: inner, tier: 2 }],
    washes: [{ pts: outer, color: PALETTE.orange, alpha: 0.12, soft: 0.4 }, { pts: inner, color: PALETTE.butter, alpha: 0.16, soft: 0.3 }, { pts: [[-14, -30], [0, -56], [14, -44], [6, -30]].map(([x, y]) => [x * k, y * k]), color: PALETTE.hibiscus, alpha: 0.06, soft: 0.6 }],
    cover: [outer],
  };
}

// A cocktail cherry, 0.85 in across, with its stem (or pitted, for a pick).
function cherryBody(cx, cy, rr = 16, stem = true) {
  const body = [];
  for (let i = 0; i <= 26; i++) {
    const a = -Math.PI / 2 + 0.28 + (i / 26) * (TAU - 0.56);
    body.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.95]);
  }
  const top = [cx, cy - rr * 0.95 + 3.5], closed = [...body, top];
  const strokes = [{ pts: body, tier: 1 }, { pts: [body[body.length - 1], top, body[0]], tier: 2 }];
  if (stem) strokes.push({ pts: [top, [cx + 2, cy - rr - 12], [cx + 8, cy - rr - 28], [cx + 18, cy - rr - 40]], tier: 2 });
  return {
    strokes,
    washes: [{ pts: closed, color: PALETTE.cherry, alpha: 0.17, soft: 0.3 }, { pts: ell(cx + 4, cy + 4, rr * 0.68, rr * 0.6, 0, TAU, 12), color: PALETTE.hibiscusDeep, alpha: 0.08, soft: 0.4 }],
    dots: [{ x: cx - rr * 0.38, y: cy - rr * 0.36, r: rr * 0.2, color: PALETTE.paper, top: true }, { x: cx - rr * 0.1, y: cy - rr * 0.58, r: rr * 0.08, color: PALETTE.paper, top: true }],
    cover: [closed],
  };
}
function cherry({ stem = true } = {}) { return { box: [44, 76], ...cherryBody(0, -16, 16, stem) }; }

// A band of rind between radii r0 and r1 from angle a0 to a1, as a few short arcs so each wash
// keeps its curve (one ring-shaped polygon would not survive the watercolor's wander).
function rindBands(r0, r1, a0, a1, sq = p => p, n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const b0 = a0 + (a1 - a0) * (i / n) - 0.03, b1 = a0 + (a1 - a0) * ((i + 1) / n) + 0.03;
    out.push(sq([...ell(0, 0, r1, r1, b0, b1, 5), ...ell(0, 0, r0, r0, b1, b0, 5)]));
  }
  return out;
}

// A citrus wheel (or half-wheel), upright and slotted onto the rim, or lying flat on a hot
// drink (`flat` squashes it). Origin at the center; the slot runs up from the bottom edge.
function citrusWheel({ r = 38, color = PALETTE.lime, rind = PALETTE.frond, half = false, flat = 1, slot = true, cloves = false } = {}) {
  const sq = pts => pts.map(([x, y]) => [x, y * flat]);
  const outer = half ? [...ell(0, 0, r, r, Math.PI, TAU, 20), [0, 0.5], [-r, 0]] : ell(0, 0, r, r, 0.3, 0.3 + TAU * 1.02, 30);
  const strokes = [{ pts: sq(outer), tier: 1 }, { pts: sq(half ? ell(0, 0, r * 0.86, r * 0.86, Math.PI + 0.02, TAU - 0.02, 18) : circle(0, 0, r * 0.86, 26)), tier: 2 }];
  const n = 10, washes = [];
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + 0.15;
    if (half && Math.sin(a) > -0.05) continue;
    strokes.push({ pts: sq([polar(0, 0, r * 0.13, a), polar(0, 0, r * 0.8, a)]), tier: 3 });
    // each segment a little juicier at its heart
    const b = a + TAU / n;
    if (!half || Math.sin(b) < 0.05) washes.push({ pts: sq([polar(0, 0, r * 0.18, a + 0.1), polar(0, 0, r * 0.76, a + 0.08), polar(0, 0, r * 0.78, (a + b) / 2), polar(0, 0, r * 0.76, b - 0.08), polar(0, 0, r * 0.18, b - 0.1)]), color, alpha: 0.05, soft: 0.4 });
  }
  if (!half) strokes.push({ pts: sq(circle(0, 0, r * 0.1, 10)), tier: 3 });
  if (slot) strokes.push({ pts: half ? [[0, 0], [0, -r * 0.42]] : [[0, r * 0.98], [0, r * 0.5]], tier: 2 });
  const fill = sq(half ? ell(0, 0, r * 0.84, r * 0.84, Math.PI, TAU, 16) : circle(0, 0, r * 0.84, 18));
  washes.unshift({ pts: fill, color, alpha: 0.045, soft: 0.5 });
  for (const b of rindBands(r * 0.86, r, half ? Math.PI : 0, half ? TAU : TAU, sq, half ? 4 : 8)) washes.push({ pts: b, color: rind, alpha: 0.07, soft: 0.3 });
  const dots = cloves ? Array.from({ length: 6 }, (_, i) => { const [x, y] = polar(0, 0, r * 0.55, i * TAU / 6 + 0.4); return { x, y: y * flat, r: 2.6, color: '#3B2416' }; }) : [];
  return {
    box: [r * 2, r * 2],
    strokes,
    washes,
    dots,
    cover: [sq(half ? [...ell(0, 0, r, r, Math.PI, TAU, 20), [r, 1], [-r, 1]] : circle(0, 0, r, 24))],
  };
}

// A citrus wedge seen from the side: flesh edge on top, rind arc below, slotted at the middle.
function citrusWedge({ len = 66, color = PALETTE.lime, rind = PALETTE.frond, slot = true } = {}) {
  const h = len * 0.36;
  const top = [[-len / 2, 0], [-len / 4, -3], [0, -4], [len / 4, -3], [len / 2, 0]];
  const skin = ell(0, 0, len / 2, h, 0, Math.PI, 18), pith = ell(0, 0, len / 2 - 4, h - 4, 0.14, Math.PI - 0.14, 16);
  const outline = [...top, ...skin.slice(1)];
  const strokes = [{ pts: top, tier: 2 }, { pts: skin, tier: 1 }, { pts: pith, tier: 3 }];
  for (const f of [-0.3, -0.1, 0.1, 0.3]) strokes.push({ pts: [[f * len, -2], [f * len * 1.1, h * 0.55]], tier: 3 });
  if (slot) strokes.push({ pts: [[0, -4], [0, h * 0.45]], tier: 2 });
  const band = [];
  for (let i = 0; i < 4; i++) { const a0 = 0.05 + i * (Math.PI - 0.1) / 4, a1 = a0 + (Math.PI - 0.1) / 4 + 0.03; band.push([...ell(0, 0, len / 2, h, a0, a1, 5), ...ell(0, 0, len / 2 - 4.5, h - 4.5, a1, a0, 5)]); }
  return {
    box: [len, h + 6],
    strokes,
    washes: [{ pts: outline, color, alpha: 0.06, soft: 0.5 }, ...band.map(pts => ({ pts, color: rind, alpha: 0.08, soft: 0.3 }))],
    cover: [outline],
  };
}

// A pineapple wedge with its rind, slotted onto the rim: about 2.75 in long, pale fibrous
// flesh, the core edge on top, and the rind's diamond eyes along the curve.
function pineappleWedge({ len = 104 } = {}) {
  const h = 38;
  const top = [[-len / 2, 0], [-len / 4, -2.5], [0, -3], [len / 4, -2.5], [len / 2, 0]];
  const outer = ell(0, 0, len / 2, h, 0, Math.PI, 24), inner = ell(0, 0, len / 2 - 8, h - 10, 0.1, Math.PI - 0.1, 20);
  const outline = [...top, ...outer.slice(1)];
  const strokes = [{ pts: top, tier: 2 }, { pts: [[-len / 2 + 6, 5], [len / 2 - 6, 5]], tier: 3 }, { pts: outer, tier: 1 }, { pts: inner, tier: 2 }, { pts: [[0, -3], [0, 13]], tier: 2 }];
  // the rind's eyes: a crosshatch of short diagonals between the two arcs
  for (let a = 0.22; a < Math.PI - 0.18; a += 0.2) {
    const m = [Math.cos(a) * (len / 2 - 4), Math.sin(a) * (h - 5)], t = [-Math.sin(a) * 4, Math.cos(a) * 4], n = [Math.cos(a) * 3.2, Math.sin(a) * 3.2];
    strokes.push({ pts: [[m[0] - t[0] - n[0], m[1] - t[1] - n[1]], [m[0] + t[0] + n[0], m[1] + t[1] + n[1]]], tier: 3 }, { pts: [[m[0] + t[0] - n[0], m[1] + t[1] - n[1]], [m[0] - t[0] + n[0], m[1] - t[1] + n[1]]], tier: 3 });
  }
  for (const f of [-0.32, -0.16, 0.16, 0.32]) strokes.push({ pts: [[f * len, 6], [f * len * 1.12, h * 0.55]], tier: 3 });
  const band = [];
  for (let i = 0; i < 5; i++) { const a0 = 0.04 + i * (Math.PI - 0.08) / 5, a1 = a0 + (Math.PI - 0.08) / 5 + 0.03; band.push([...ell(0, 0, len / 2, h, a0, a1, 5), ...ell(0, 0, len / 2 - 8, h - 10, a1, a0, 5)]); }
  return {
    box: [len, h + 6],
    strokes,
    washes: [{ pts: outline, color: PALETTE.butter, alpha: 0.06, soft: 0.5 }, { pts: [[-len / 2 + 4, 0], [len / 2 - 4, 0], [len / 2 - 8, 6], [-len / 2 + 8, 6]], color: PALETTE.butter, alpha: 0.07, soft: 0.3 }, ...band.map(pts => ({ pts, color: '#9A8A3A', alpha: 0.085, soft: 0.3 }))],
    cover: [outline],
  };
}

// A pineapple spear: a long baton with a strip of rind, standing in the ice.
function pineappleSpear({ len = 150 } = {}) {
  const outline = [[-9, 0], [-9, -len + 6], [-2, -len], [9, -len + 3], [9, 0]];
  const strokes = [{ pts: outline, tier: 1 }, { pts: [[4, -2], [4, -len + 4]], tier: 2 }];
  for (let y = -12; y > -len + 12; y -= 10) strokes.push({ pts: [[4.5, y + 3], [8, y], [4.5, y - 3]], tier: 3 });
  for (const y of [-len * 0.3, -len * 0.55, -len * 0.8]) strokes.push({ pts: [[-6, y], [1, y - 6]], tier: 3 });
  return {
    box: [22, len],
    strokes,
    washes: [{ pts: outline, color: PALETTE.butter, alpha: 0.07, soft: 0.4 }, { pts: [[4, 0], [4, -len + 4], [9, -len + 3], [9, 0]], color: '#9A8A3A', alpha: 0.09, soft: 0.3 }],
    cover: [outline],
  };
}

// A long, narrow, gently curved blade along +x (a pineapple leaf), with a few spines.
function blade(len, wid, bend) {
  const n = 12, up = [], dn = [], mid = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, w = wid * Math.pow(1 - u, 0.85) + 0.4, x = u * len, y = bend * len * u * u;
    up.push([x, y - w]); dn.push([x, y + w]); mid.push([x, y]);
  }
  const spines = [];
  for (let i = 2; i < n - 1; i += 3) spines.push({ pts: [up[i], [up[i][0] + 4, up[i][1] - 2.2]], tier: 3 }, { pts: [dn[i + 1], [dn[i + 1][0] + 4, dn[i + 1][1] + 2.2]], tier: 3 });
  return { outline: [...up, ...dn.reverse()], mid, spines };
}
function pineappleFronds({ h = 150 } = {}) {
  const out = { strokes: [], washes: [], cover: [] };
  for (const [off, lf, bend] of [[-0.34, 0.84, 0.06], [0.04, 1, -0.03], [0.36, 0.76, -0.07]]) {
    const b = blade(h * lf, 7.5, bend), a = -Math.PI / 2 + off;
    const O = turn(b.outline, a);
    out.strokes.push({ pts: O, tier: 2 }, { pts: turn(b.mid.slice(1, -2), a), tier: 3 }, ...b.spines.map(s => ({ ...s, pts: turn(s.pts, a) })));
    out.washes.push({ pts: O, color: '#5E9A6E', alpha: 0.075, soft: 0.4 });
    out.cover.push(O);
  }
  return { box: [120, h], ...out };
}

// A small bamboo pick skewering fruit in order along +x, the pick showing past both ends.
// Items: 'cherry', 'chunk' (a rectangle of pineapple with its rind), 'ginger' (a candied cube).
function pickWith(items, { gap = 4, lead = 0 } = {}) {
  const W = { cherry: 32, chunk: 46, ginger: 28, ring: 62 };
  const parts = [], spans = [];
  let x = 16 + lead;
  for (const it of items) {
    const w = W[it] || 30, cx = x + w / 2;
    if (it === 'cherry') parts.push(cherryBody(cx, 0, 16, false));
    else if (it === 'chunk') {
      const box = [[cx - 23, -9], [cx + 23, -10], [cx + 23, 9], [cx - 23, 10]];
      const ticks = [];
      for (let t = cx - 19; t < cx + 20; t += 7) ticks.push({ pts: [[t, 6], [t + 3, 9], [t + 6, 6]], tier: 3 });
      parts.push({ strokes: [{ pts: [...box, box[0]], tier: 1 }, { pts: [[cx - 23, 4.5], [cx + 23, 4]], tier: 2 }, ...ticks, { pts: [[cx - 12, -8], [cx - 10, 3]], tier: 3 }, { pts: [[cx + 8, -9], [cx + 10, 3]], tier: 3 }], washes: [{ pts: box, color: PALETTE.butter, alpha: 0.07, soft: 0.3 }, { pts: [[cx - 23, 4.5], [cx + 23, 4], [cx + 23, 9], [cx - 23, 10]], color: '#9A8A3A', alpha: 0.09, soft: 0.3 }], cover: [box] });
    } else if (it === 'ginger') {
      const box = [[cx - 13, -12], [cx + 13, -13], [cx + 14, 12], [cx - 12, 13]];
      parts.push({ strokes: [{ pts: [...box, box[0]], tier: 1 }, { pts: [[cx - 13, -12], [cx - 7, -17], [cx + 18, -17], [cx + 13, -13]], tier: 2 }], washes: [{ pts: box, color: PALETTE.ochre, alpha: 0.13, soft: 0.3 }], dots: Array.from({ length: 7 }, (_, k) => ({ x: cx - 9 + (k * 5.3) % 19, y: -8 + (k * 7.1) % 17, r: 0.9, color: PALETTE.paper, top: true })), cover: [box] });
    } else if (it === 'ring') parts.push(saturnRing(cx, 0));
    spans.push([x, x + w]);
    x += w + gap;
  }
  const end = x + 10;
  // The pick shows only between and beyond the fruit; a knotted end on the left.
  const strokes = [];
  const cuts = [-4, ...spans.flat(), end];
  for (let i = 0; i < cuts.length; i += 2) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    if (b - a > 1) strokes.push({ pts: [[a, -1.4], [b, -1.4]], tier: 2 }, { pts: [[a, 1.4], [b, 1.4]], tier: 2 });
  }
  if (!lead) strokes.push({ pts: ell(-8, 0, 4.5, 3.2, 0, TAU, 10), tier: 2 });
  return merge({ strokes, washes: [{ pts: [[-4, -1.6], [end, -1.6], [end, 1.6], [-4, 1.6]], color: BAMBOO, alpha: 0.1, soft: 0.2 }] }, ...parts);
}
// Fruit on a pick, laid along +x (the spec turns it). Origin at the pick's middle, or with
// `lead` at its bare end, `lead` units of pick before the first fruit (to stand in the ice).
function fruitPick({ items = ['cherry'], lead = 0 } = {}) {
  const p = pickWith(items, { lead });
  const xs = p.strokes.flatMap(s => s.pts.map(q => q[0]));
  const at = lead ? Math.min(...xs) : (Math.min(...xs) + Math.max(...xs)) / 2;
  return { box: [Math.max(...xs) - Math.min(...xs), 40], ...moved(p, -at, 0) };
}
// Three Dots and a Dash: Morse V, · · · —, three cherries then a pineapple chunk.
const morsePick = () => fruitPick({ items: ['cherry', 'cherry', 'cherry', 'chunk'] });

// Saturn: a thin lemon-peel band around a cherry, a planet and its ring.
function saturnRing(cx, cy) {
  const tilt = -0.35, ring = (rx, ry, a0, a1) => turn(ell(0, 0, rx, ry, a0, a1, 18), tilt, cx, cy);
  const c = cherryBody(cx, cy + 14, 15, false);
  const band = (a0, a1) => [...ring(34, 11, a0, a1), ...ring(26, 6.5, a1, a0)];
  return merge(
    { strokes: [{ pts: ring(34, 11, Math.PI + 0.2, TAU - 0.2), tier: 2 }, { pts: ring(26, 6.5, Math.PI + 0.3, TAU - 0.3), tier: 3 }], washes: [{ pts: band(Math.PI + 0.2, TAU - 0.2), color: PALETTE.butter, alpha: 0.1, soft: 0.3 }] },
    moved(c, 0, -14),
    { strokes: [{ pts: ring(34, 11, -0.2, Math.PI + 0.2), tier: 1 }, { pts: ring(26, 6.5, -0.15, Math.PI + 0.15), tier: 2 }], washes: [{ pts: band(-0.2, Math.PI / 2), color: PALETTE.butter, alpha: 0.18, soft: 0.3 }, { pts: band(Math.PI / 2, Math.PI + 0.2), color: PALETTE.butter, alpha: 0.18, soft: 0.3 }], cover: [band(-0.2, Math.PI / 2), band(Math.PI / 2, Math.PI + 0.2)] },
  );
}
const peelRing = () => fruitPick({ items: ['ring'] });

// A hurricane-style flag: a half orange wheel standing on the rim, a cherry in its crook and a
// pick through both. Origin where the wheel meets the rim.
function orangeFlag() {
  const w = citrusWheel({ r: 54, color: PALETTE.orange, rind: '#D9792A', half: true, slot: false });
  const flipped = moved(w, 0, 0, Math.PI);
  const c = cherryBody(0, -8, 16, true);
  const pick = { strokes: [{ pts: [[-66, -14], [66, -22]], tier: 2 }, { pts: ell(-70, -14, 4, 3, 0, TAU, 10), tier: 2 }] };
  return { box: [140, 100], ...moved(merge(flipped, pick, c), 0, -46) };
}

// A floating flower, seen from the side: Dendrobium orchid.
function orchid({ size = 1 } = {}) {
  const strokes = [], washes = [], cover = [];
  const seg = (ang, len, wid, color = PALETTE.orchid) => {
    const L = turn(leaf(len * size, wid * size, { round: 0.6 }), ang);
    strokes.push({ pts: L, tier: 1 });
    washes.push({ pts: L, color, alpha: 0.1, soft: 0.45 });
    cover.push(L);
  };
  seg(-Math.PI / 2, 33, 7.5);
  seg(-Math.PI / 2 + 2.3, 31, 7.5);
  seg(-Math.PI / 2 - 2.3, 31, 7.5);
  seg(-Math.PI / 2 + 1.1, 34, 12.5);
  seg(-Math.PI / 2 - 1.1, 34, 12.5);
  const lip = ell(0, 9 * size, 10 * size, 12 * size, 0, TAU, 18);
  strokes.push({ pts: lip, tier: 1 }, { pts: ell(0, 6 * size, 4.5 * size, 5.5 * size, 0, TAU, 12), tier: 2 });
  washes.push({ pts: lip, color: PALETTE.hibiscusDeep, alpha: 0.11, soft: 0.4 });
  cover.push(lip);
  return { box: [80, 80], strokes, washes, cover, dots: [{ x: 0, y: -1, r: 2.6 * size, color: PALETTE.butter, top: true }] };
}

// A gardenia floating on a bowl: a waxy white spiral of petals on two glossy leaves.
function gardenia({ r = 54, tilt = 0.55 } = {}) {
  const sq = pts => pts.map(([x, y]) => [x, y * tilt]);
  const lobes = (R, n, a0) => { const pts = []; for (let i = 0; i <= n * 8; i++) { const a = a0 + (i / (n * 8)) * TAU; pts.push(polar(0, 0, R * (0.78 + 0.22 * Math.sqrt(Math.abs(Math.cos((a - a0) * n / 2)))), a)); } return pts; };
  const L1 = sq(turn(leaf(r * 1.2, r * 0.3), Math.PI - 0.3)), L2 = sq(turn(leaf(r * 1.1, r * 0.28), 0.25));
  const outer = sq(lobes(r, 6, 0.2)), inner = sq(lobes(r * 0.6, 5, 0.6));
  const strokes = [{ pts: L1, tier: 1 }, { pts: L2, tier: 1 }, { pts: outer, tier: 1 }, { pts: inner, tier: 2 }, { pts: sq(ell(0, 0, r * 0.2, r * 0.2, 0, TAU * 0.85, 14)), tier: 2 }];
  for (let i = 0; i < 6; i++) { const a = 0.2 + (i + 0.5) * TAU / 6; strokes.push({ pts: sq([polar(0, 0, r * 0.62, a), polar(0, 0, r * 0.9, a)]), tier: 3 }); }
  return {
    box: [r * 3, r * 1.6],
    strokes,
    washes: [{ pts: L1, color: PALETTE.frond, alpha: 0.1, soft: 0.4 }, { pts: L2, color: PALETTE.frond, alpha: 0.1, soft: 0.4 }, { pts: outer, color: '#EDE3C4', alpha: 0.05, soft: 0.5 }, { pts: sq(circle(0, 0, r * 0.24, 12)), color: PALETTE.butter, alpha: 0.07, soft: 0.5 }],
    cover: [outer],
  };
}

// A small edible flower (borage, viola): five round petals.
function edibleFlower() {
  const strokes = [], washes = [], cover = [];
  for (let i = 0; i < 5; i++) {
    const L = turn(leaf(17, 7, { round: 0.5 }), -Math.PI / 2 + i * TAU / 5);
    strokes.push({ pts: L, tier: 1 }); washes.push({ pts: L, color: '#7E8FD8', alpha: 0.1, soft: 0.4 }); cover.push(L);
  }
  return { box: [40, 40], strokes, washes, cover, dots: [{ x: 0, y: 0, r: 2.4, color: PALETTE.butter, top: true }] };
}

// A paper parasol: canopy about 3 in across on a 4 in stick, standing in the ice.
function umbrella() {
  const H = 150, cw = 58, apex = [0, -H], n = 8, tips = [];
  for (let i = 0; i <= n; i++) { const x = -cw + i * (2 * cw / n); tips.push([x, -H + 30 + (1 - (x / cw) ** 2) * 7]); }
  const edge = [];
  for (let i = 0; i < n; i++) edge.push(tips[i], [(tips[i][0] + tips[i + 1][0]) / 2, (tips[i][1] + tips[i + 1][1]) / 2 - 3.5]);
  edge.push(tips[n]);
  const canopy = [[-cw, tips[0][1]], [-cw * 0.55, -H + 11], apex, [cw * 0.55, -H + 11], [cw, tips[n][1]]];
  const strokes = [{ pts: canopy, tier: 1 }, { pts: edge, tier: 2 }, { pts: [[0, 0], [0, -H]], tier: 2 }];
  for (let i = 1; i < n; i++) strokes.push({ pts: [apex, tips[i]], tier: 3 });
  for (let i = 1; i < n; i += 2) strokes.push({ pts: [[0, -H + 48], tips[i]], tier: 3 });
  const cols = [PALETTE.hibiscus, PALETTE.butter, PALETTE.lagoon, PALETTE.orchid];
  const washes = [];
  for (let i = 0; i < n; i++) washes.push({ pts: [apex, tips[i], tips[i + 1]], color: cols[i % 4], alpha: 0.1, soft: 0.35 });
  washes.push({ pts: [[-1.5, 0], [-1.5, -H], [1.5, -H], [1.5, 0]], color: PALETTE.wood, alpha: 0.08, soft: 0.2 });
  return { box: [120, H + 6], strokes, washes, cover: [[...canopy, ...edge.slice().reverse()]] };
}

// A cinnamon quill: rolled bark with its scroll showing at the top.
function cinnamon({ len = 132 } = {}) {
  const L = [[-7, 0], [-7.5, -len * 0.5], [-7, -len]], Rt = [[7, 0], [7.5, -len * 0.5], [7, -len]];
  return {
    box: [20, len + 6],
    strokes: [{ pts: L, tier: 1 }, { pts: Rt, tier: 1 }, { pts: ell(0, -len, 7, 3, 0, TAU, 14), tier: 2 }, { pts: ell(1.5, -len + 0.5, 3.5, 1.5, 0, TAU * 0.8, 10), tier: 3 }, { pts: [[2, -6], [2.5, -len + 4]], tier: 3 }, { pts: [[-3, -len * 0.3], [-3, -len * 0.62]], tier: 3 }],
    washes: [{ pts: [...L, ...Rt.slice().reverse()], color: PALETTE.wood, alpha: 0.085, soft: 0.3 }],
    cover: [[...L, ...Rt.slice().reverse()]],
  };
}

// A bamboo rod with node rings every couple of inches (back-scratcher, swizzle stick, cane).
function rod(len, w, color, nodes = 70) {
  const strokes = [{ pts: [[-w / 2, 0], [-w / 2, -len]], tier: 1 }, { pts: [[w / 2, 0], [w / 2, -len]], tier: 1 }];
  for (let y = -nodes * 0.6; y > -len + 10; y -= nodes) strokes.push({ pts: [[-w / 2 - 0.8, y], [w / 2 + 0.8, y - 1]], tier: 2 });
  return { strokes, washes: [{ pts: [[-w / 2, 0], [-w / 2, -len], [w / 2, -len], [w / 2, 0]], color, alpha: 0.075, soft: 0.25 }], cover: [[[-w / 2, 0], [-w / 2, -len], [w / 2, -len], [w / 2, 0]]] };
}
// Harry Yee's Tropical Itch: a bamboo back-scratcher, a little cupped hand carved at the top,
// its five fingers side by side with the tips curled over toward you.
function backScratcher({ len = 300 } = {}) {
  const top = -len, strokes = [], washes = [], cover = [];
  const palm = [[-4, top + 2], [-12, top - 6], [-14, top - 18], [14, top - 18], [12, top - 6], [4, top + 2]];
  strokes.push({ pts: palm, tier: 1 });
  washes.push({ pts: [...palm, [-14, top - 18]], color: BAMBOO, alpha: 0.09, soft: 0.3 });
  cover.push(palm);
  [-11.2, -5.6, 0, 5.6, 11.2].forEach((x, i) => {
    const h = i === 0 ? 11 : i === 4 ? 12 : 16 - Math.abs(i - 2) * 1.5, y0 = top - 18, w = 2.6;
    const f = [[x - w, y0], [x - w, y0 - h], [x - w + 0.5, y0 - h - 2.6], [x, y0 - h - 3.8], [x + w - 0.5, y0 - h - 2.6], [x + w, y0 - h], [x + w, y0]];
    strokes.push({ pts: f, tier: 2 }, { pts: [[x - w + 0.6, y0 - h + 1.5], [x + w - 0.6, y0 - h + 1.5]], tier: 3 });
    washes.push({ pts: f, color: BAMBOO, alpha: 0.08, soft: 0.3 });
    cover.push(f);
  });
  return { box: [40, len + 40], ...merge(rod(len, 7, BAMBOO, 64), { strokes, washes, cover }) };
}
// A bois lélé: a twig with a whorl of short prongs at the foot. `plain` is a stir stick.
function swizzleStick({ len = 300, plain = false } = {}) {
  if (plain) {
    const paddle = [[-5, -len], [-5, -len - 20], [0, -len - 23], [5, -len - 20], [5, -len]];
    return { box: [16, len + 24], ...merge(rod(len, 3.5, PALETTE.hibiscus, 9999), { strokes: [{ pts: paddle, tier: 1 }], washes: [{ pts: paddle, color: PALETTE.hibiscus, alpha: 0.1, soft: 0.3 }] }) };
  }
  const prongs = [-2.4, -1.4, -0.5, 0.5, 1.4].map(a => ({ pts: [[0, -2], [Math.sin(a) * 18, -2 + Math.cos(a) * 4 - 1]], tier: 2 }));
  return { box: [40, len + 6], ...merge(rod(len, 4.5, PALETTE.woodPale, 90), { strokes: prongs }) };
}
function sugarcane({ len = 230 } = {}) {
  return { box: [20, len], ...rod(len, 11, '#B9C77A', 56) };
}

// A citrus twist: a strip of peel with one twist in it, hooked over the rim. `cloves` studs it.
function peel({ citrus = 'orange', cloves = false } = {}) {
  const c = [[0, 0], [8, -14], [22, -20], [34, -14], [40, 4], [38, 28], [32, 46]];
  const S = spline(c, 4), left = [], right = [];
  S.forEach(([x, y], i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const u = i / (S.length - 1), w = 8 * Math.abs(Math.cos(u * Math.PI * 1.15 + 0.3)) + 1.2;
    left.push([x - dy / l * w, y + dx / l * w]); right.push([x + dy / l * w, y - dx / l * w]);
  });
  const color = PEEL[citrus] || PALETTE.orange, outline = [...left, ...right.slice().reverse()];
  const dots = cloves ? [8, 18, 28].map(i => { const p = S[Math.min(S.length - 1, i)]; return { x: p[0], y: p[1], r: 2.4, color: '#3B2416' }; }) : [];
  return { box: [52, 70], strokes: [{ pts: left, tier: 1 }, { pts: right, tier: 1 }], washes: [{ pts: outline, color, alpha: 0.13, soft: 0.3 }], dots, cover: [outline] };
}

// A coin of lime peel resting at the bottom of a Ti' Punch.
function limeCoin() {
  const o = ell(0, 0, 21, 8, 0, TAU, 20);
  return { box: [44, 18], strokes: [{ pts: o, tier: 1 }, { pts: ell(0, -1, 16, 5, 0, TAU, 16), tier: 3 }], washes: [{ pts: o, color: PALETTE.lime, alpha: 0.13, soft: 0.3 }] };
}

// Fruit slices on the rim: banana, strawberry, a passion-fruit half, mango, cucumber, ginger.
function fruitSlice({ fruit = 'banana' } = {}) {
  if (fruit === 'strawberry') {
    const berry = [[0, 4], [-15, -10], [-18, -26], [-10, -38], [0, -40], [10, -38], [18, -26], [15, -10], [0, 4]];
    const calyx = [-1.1, -0.5, 0.1, 0.7, 1.3].map(a => ({ pts: [[0, -39], [Math.sin(a) * 14, -39 - Math.cos(a) * 7 + 2]], tier: 2 }));
    const seeds = [];
    for (let i = 0; i < 12; i++) seeds.push({ x: -10 + (i * 7.3) % 20, y: -32 + (i * 11.7) % 30, r: 0.9, color: PALETTE.butter, top: true });
    return { box: [40, 48], strokes: [{ pts: berry, tier: 1 }, ...calyx, { pts: [[0, 4], [0, -8]], tier: 2 }], washes: [{ pts: berry, color: PALETTE.cherry, alpha: 0.15, soft: 0.35 }, { pts: ell(0, -40, 12, 4, 0, TAU, 10), color: PALETTE.frond, alpha: 0.1, soft: 0.3 }], dots: seeds, cover: [berry] };
  }
  if (fruit === 'passion-fruit') {
    const skin = ell(0, 0, 26, 18, 0, Math.PI, 16), face = ell(0, 0, 26, 8, 0, TAU, 20);
    const seeds = Array.from({ length: 9 }, (_, i) => ({ x: -16 + (i * 9.1) % 32, y: -3 + (i * 5.3) % 6, r: 1.4, color: '#2A1A14' }));
    return { box: [56, 30], strokes: [{ pts: face, tier: 1 }, { pts: skin, tier: 1 }, { pts: ell(0, 0, 21, 6, 0, TAU, 18), tier: 3 }], washes: [{ pts: [...skin, ...ell(0, 0, 26, 8, Math.PI, TAU, 10)], color: '#7A3A6A', alpha: 0.12, soft: 0.3 }, { pts: ell(0, 0, 21, 6, 0, TAU, 14), color: PALETTE.butter, alpha: 0.14, soft: 0.3 }], dots: seeds, cover: [[...skin, ...ell(0, 0, 26, 8, Math.PI, TAU, 10)]] };
  }
  const spec = {
    banana: { r: 17, color: '#F3E3B0', rind: PALETTE.butter, seeds: true },
    mango: { r: 26, color: PALETTE.orange, rind: PALETTE.ochre },
    cucumber: { r: 22, color: '#CFE3A8', rind: PALETTE.frond, seeds: true },
    ginger: { r: 15, color: '#E9D3A0', rind: PALETTE.woodPale },
    apple: { r: 28, color: '#F4EBC8', rind: PALETTE.hibiscus },
    grapefruit: { r: 44, color: '#F2A08A', rind: '#E7B05A' },
  }[fruit] || { r: 20, color: PALETTE.butter, rind: PALETTE.ochre };
  const w = citrusWheel({ r: spec.r, color: spec.color, rind: spec.rind });
  if (spec.seeds) w.dots = Array.from({ length: 6 }, (_, i) => { const [x, y] = polar(0, 0, spec.r * 0.35, i * TAU / 6); return { x, y, r: 1, tier: 2 }; });
  return w;
}

// Whipped cream: a soft piped swirl in three tiers, warm white with a faint cocoa shadow under
// each tier (glazed exactly, so it stays cream and never drifts to celery or lemon).
function whippedCream() {
  const tier = (w, y, n) => { const pts = []; for (let i = 0; i <= n * 6; i++) { const u = i / (n * 6), x = -w + u * 2 * w; pts.push([x, y - Math.abs(Math.sin(u * n * Math.PI)) * 5 - Math.sqrt(Math.max(0, 1 - (x / w) ** 2)) * 4]); } return pts; };
  const t1 = tier(28, 0, 4), t2 = tier(20, -11, 3), t3 = tier(11, -21, 2), peak = [[-6, -24], [0, -36], [5, -26]];
  const outline = [[-28, 0], ...ell(0, -8, 28, 30, Math.PI, Math.PI * 1.5, 8), [0, -36], ...ell(0, -8, 28, 30, Math.PI * 1.5, TAU, 8), [28, 0]];
  return { box: [60, 40], strokes: [{ pts: t1, tier: 1 }, { pts: t2, tier: 2 }, { pts: t3, tier: 2 }, { pts: peak, tier: 1 }, { pts: [[-28, 0], [-24, -12], [-14, -26], [0, -36]], tier: 3 }, { pts: [[28, 0], [22, -14], [12, -27]], tier: 3 }], washes: whipWashes(outline, [t1, t2, t3]), cover: [outline], glazed: true };
}

const WHIP = '#FBF6EC', WHIP_SHADE = '#EDE1D2';
function whipWashes(outline, tiers) {
  const out = [], coat = (pts, target, under, alpha, soft) => { const g = glaze(target, under, alpha); out.push({ pts, color: g.color, alpha: g.alpha, soft, grain: 0.05, layers: GLAZE_LAYERS }); };
  coat(outline, WHIP, '#FFFFFF', 0.03, 0.5);
  // the shadow tucked under each tier's scallops, and down the shaded right flank
  const lo = tiers[0].map(([x, y]) => [x, y + 1]);
  coat([...lo, ...lo.slice().reverse().map(([x, y]) => [x * 0.94, y - 4])], WHIP_SHADE, WHIP, 0.03, 0.4);
  coat([[14, -26], [21, -16], [27, -3], [21, -3], [16, -14]], WHIP_SHADE, WHIP, 0.03, 0.5);
  return out;
}

// Three coffee beans floated on a cream or foam top, each about half an inch.
function beans() {
  const strokes = [];
  [[-17, 1], [0, -3], [17, 2]].forEach(([x, y], i) => { strokes.push({ pts: ell(x, y, 8.5, 5.5, 0, TAU, 14, 0.3 - i * 0.25), tier: 1 }); strokes.push({ pts: turn([[-5.5, 0], [-1, 1], [5.5, 0]], 0.3 - i * 0.25, x, y), tier: 2 }); });
  return { box: [52, 16], strokes, washes: [{ pts: ell(0, 0, 26, 7, 0, TAU, 14), color: PALETTE.wood, alpha: 0.09, soft: 0.4 }] };
}

// Grated spice on the cap: a freckle field over `region` (a polygon), denser toward its middle,
// never a ring. Nutmeg is a warm brown, cinnamon redder, cocoa dark; toasted coconut is flakes.
function dust({ region = ell(0, 0, 40, 8, 0, TAU, 16), spice = 'nutmeg', density = 0.6, seed = 11 } = {}) {
  const r = rng(seed);
  const xs = region.map(p => p[0]), ys = region.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 || 1, hy = (y1 - y0) / 2 || 1;
  const inside = (x, y) => { let c = false; for (let i = 0, j = region.length - 1; i < region.length; j = i++) { const [xi, yi] = region[i], [xj, yj] = region[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const color = { nutmeg: NUTMEG, cinnamon: '#A2552C', cocoa: '#4A2C1C', coconut: PALETTE.ochre }[spice] || NUTMEG;
  const n = Math.round((spice === 'coconut' ? 26 : 45) + density * 110 * Math.min(1.6, hx / 50));
  const dots = [], strokes = [];
  // a few clumps where the grater lingered
  const clumps = Array.from({ length: 3 }, () => [cx + (r() - 0.5) * hx * 0.9, cy + (r() - 0.5) * hy * 0.7]);
  for (let tries = 0; dots.length + strokes.length < n && tries < n * 30; tries++) {
    let x, y;
    if (r() < 0.25) { const c = clumps[Math.floor(r() * 3)]; x = c[0] + (r() - 0.5) * 10; y = c[1] + (r() - 0.5) * 5; } else { x = cx + (r() * 2 - 1) * hx; y = cy + (r() * 2 - 1) * hy; }
    const d = Math.hypot((x - cx) / hx, (y - cy) / hy);
    if (!inside(x, y) || r() > (1 - d * d) * (0.55 + density * 0.45) + 0.08) continue;
    if (spice === 'coconut') { const a = r() * Math.PI; strokes.push({ pts: [[x - Math.cos(a) * 3, y - Math.sin(a) * 1.5], [x, y - 1], [x + Math.cos(a) * 3, y + Math.sin(a) * 1.5]], tier: 3 }); }
    else dots.push({ x, y, r: 0.7 + r() * r() * 1.5, color });
  }
  const core = region.map(([x, y]) => [cx + (x - cx) * 0.6, cy + (y - cy) * 0.6]);
  return { box: [hx * 2, hy * 2], strokes, dots, washes: [{ pts: core, color, alpha: spice === 'coconut' ? 0.03 : 0.025 + density * 0.012, soft: 0.8 }] };
}
const nutmeg = p => dust({ ...p, spice: 'nutmeg' });

function straw({ len = 200, w = 11, color = PALETTE.hibiscus } = {}) {
  const washes = [];
  for (let y = 6; y < len - 10; y += 18) washes.push({ pts: [[1.5, y], [w - 1.5, y + 5], [w - 1.5, y + 11], [1.5, y + 6]], color, alpha: 0.12, soft: 0.2 });
  return { box: [w + 2, len], strokes: [{ pts: [[1.5, 0], [1.5, len]], tier: 2 }, { pts: [[w - 1.5, 0], [w - 1.5, len]], tier: 2 }, { pts: ell(w / 2, 0, w / 2 - 1.5, 1.6, 0, TAU, 10), tier: 3 }], washes };
}

// Cinnamon sparks above a flame: short ticks and a few motes.
function sparkle() {
  const strokes = [], dots = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.42;
    strokes.push({ pts: [polar(30, 40, 14 + (i % 2) * 6, a), polar(30, 40, 22 + (i % 2) * 8, a)], tier: 2 });
    dots.push({ x: polar(30, 40, 30 + (i % 3) * 5, a + 0.2)[0], y: polar(30, 40, 30 + (i % 3) * 5, a + 0.2)[1], r: 1.1, color: '#A2552C' });
  }
  return { box: [60, 44], strokes, dots };
}

// ---------------------------------------------------------------- vessels
// One drawing per vessel in data/vessels.json, in a 300 × 460 box standing on y = 440, all at one
// scale (about 38 units to the inch) so a coupe reads small beside a hurricane. Clear glasses are
// profiles: [y, half-width] pairs from rim to the bottom of the bowl, shared with the liquid and
// ice. Opaque vessels (ceramics, metal, fruit) show the drink only at the rim.
const BASE = 440;
export const GLASS_PROFILES = {
  // Proportions from docs/vessels.md (Libbey catalogue sizes where known).
  coupe: { pts: [[222, 80], [236, 76], [256, 58], [274, 14]], foot: 'stem', footW: 56, rimTilt: 0.2 },
  'nick-nora': { pts: [[193, 55], [213, 54], [243, 50], [271, 40], [293, 24], [304, 8]], foot: 'stem', footW: 48, rimTilt: 0.2 },
  'cocktail-glass': { pts: [[193, 81], [298, 5]], foot: 'stem', footW: 54, rimTilt: 0.18 },
  rocks: { pts: [[307, 62], [436, 58]], foot: 'slab', rimTilt: 0.18 },
  dof: { pts: [[288, 68], [436, 62]], foot: 'slab', rimTilt: 0.17 },
  highball: { pts: [[222, 55], [436, 52]], foot: 'slab', rimTilt: 0.16 },
  collins: { pts: [[202, 50], [436, 48]], foot: 'slab', rimTilt: 0.15 },
  chimney: { pts: [[174, 46], [418, 42]], foot: 'heavy', rimTilt: 0.15 },
  hurricane: { pts: [[128, 54], [170, 48], [220, 36], [270, 48], [320, 60], [360, 47], [392, 22]], foot: 'stem', footW: 50, rimTilt: 0.15 },
  'poco-grande': { pts: [[180, 62], [202, 54], [230, 44], [262, 46], [296, 54], [326, 48], [350, 28], [362, 10]], foot: 'stem', footW: 48, rimTilt: 0.16 },
  'footed-pilsner': { pts: [[193, 57], [280, 46], [392, 28]], foot: 'stem', footW: 52, rimTilt: 0.15 },
  // A stemless footed tumbler: ribbed column below, flaring into a coupe-like bowl.
  'pearl-diver': { pts: [[288, 66], [300, 64], [318, 57], [340, 42], [362, 31], [396, 29], [426, 31]], foot: 'slab', rimTilt: 0.18, flutes: [364, 428] },
  snifter: { pts: [[214, 56], [252, 76], [300, 88], [348, 78], [388, 40]], foot: 'stem', footW: 56, rimTilt: 0.18 },
  tulip: { pts: [[145, 47], [190, 45], [245, 51], [300, 49], [345, 36], [380, 16]], foot: 'stem', footW: 50, rimTilt: 0.16 },
  goblet: { pts: [[232, 60], [270, 64], [310, 58], [340, 40], [356, 12]], foot: 'stem', footW: 50, rimTilt: 0.18 },
  flute: { pts: [[120, 34], [190, 37], [260, 33], [300, 22], [318, 8]], foot: 'stem', footW: 42, rimTilt: 0.2 },
  'irish-coffee': { pts: [[222, 54], [362, 50]], foot: 'stem', footW: 50, rimTilt: 0.18, handle: [240, 336] },
  'punch-bowl': { pts: [[300, 132], [330, 128], [366, 108], [394, 74], [410, 36]], foot: 'stem', footW: 70, rimTilt: 0.14 },
  // opaque
  'julep-cup': { pts: [[297, 62], [428, 52]], opaque: true, rimTilt: 0.2 },
  'copper-mug': { pts: [[290, 54], [436, 54]], opaque: true, rimTilt: 0.18 },
  'enamel-tin': { pts: [[307, 64], [436, 64]], opaque: true, rimTilt: 0.2 },
  'ku-mug': { pts: [[180, 60], [436, 56]], opaque: true, rimTilt: 0.18 },
  'moai-mug': { pts: [[155.5, 70.5], [436, 62]], opaque: true, rimTilt: 0.19 },
  'skull-mug': { pts: [[262, 52], [436, 50]], opaque: true, rimTilt: 0.2 },
  'barrel-mug': { pts: [[250, 58], [436, 58]], opaque: true, rimTilt: 0.2 },
  'fog-cutter-mug': { pts: [[117, 57], [436, 57]], opaque: true, rimTilt: 0.18 },
  'bird-mug': { pts: [[304, 40], [430, 40]], opaque: true, rimTilt: 0.24, cx: 164 },
  coconut: { pts: [[296, 60], [436, 40]], opaque: true, rimTilt: 0.26 },
  pineapple: { pts: [[262, 51], [436, 30]], opaque: true, rimTilt: 0.24 },
  'clay-cup': { pts: [[356, 50], [436, 38]], opaque: true, rimTilt: 0.2 },
  'hot-mug': { pts: [[290, 60], [436, 60]], opaque: true, rimTilt: 0.18 },
  'scorpion-bowl': { pts: [[282, 132], [390, 64]], opaque: true, rimTilt: 0.15 },
  'tiki-bowl': { pts: [[300, 104], [388, 60]], opaque: true, rimTilt: 0.16 },
  'volcano-bowl': { pts: [[330, 128], [412, 70]], opaque: true, rimTilt: 0.15 },
};
const MOAI_FIT = { s: 1.5, x: 30, y: 101.5 };

export function halfAt(G, y) {
  const p = G.pts;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [y0, w0] = p[i], [y1, w1] = p[i + 1];
    if (y >= y0 && y <= y1) return w0 + ((y - y0) / (y1 - y0)) * (w1 - w0);
  }
  return p[p.length - 1][1];
}
export const rimOf = kind => { const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins; return { cx: G.cx ?? 150, y: G.pts[0][0], hw: G.pts[0][1], bottom: G.pts[G.pts.length - 1][0], tilt: G.rimTilt }; };
export const levelOf = (kind, fill) => { const r = rimOf(kind); return r.bottom - (r.bottom - r.y) * fill; };

const fitPart = (part, { s, x, y }) => ({
  ...part,
  strokes: part.strokes.map(st => ({ ...st, pts: st.pts.map(([px, py]) => [x + px * s, y + py * s]) })),
  washes: (part.washes || []).map(w => ({ ...w, pts: w.pts.map(([px, py]) => [x + px * s, y + py * s]) })),
  dots: (part.dots || []).map(d => ({ ...d, x: x + d.x * s, y: y + d.y * s, r: d.r * s })),
});
const mir = (pts, cx = 150) => pts.map(([x, y]) => [2 * cx - x, y]);
const rimStrokes = (cx, y, hw, tilt) => [
  { pts: ell(cx, y, hw, hw * tilt, 0.04, Math.PI - 0.04, 24), tier: 1 },
  { pts: ell(cx, y, hw, hw * tilt, Math.PI + 0.04, TAU - 0.04, 24), tier: 3 },
];
const frontArc = (cx, y, hw, ry, tier = 1) => ({ pts: ell(cx, y, hw, ry, 0.06, Math.PI - 0.06, 20), tier });
// A C-shaped handle on the right side between y0 and y1, `out` units proud of the wall.
function handle(x, y0, y1, out, tier = 1) {
  const m = (y0 + y1) / 2, h = (y1 - y0) / 2;
  return [
    { pts: [[x, y0], [x + out * 0.8, y0 + 2], [x + out, m - h * 0.35], [x + out, m + h * 0.35], [x + out * 0.8, y1 - 2], [x, y1]], tier },
    { pts: [[x, y0 + 14], [x + out * 0.5, y0 + 17], [x + out * 0.62, m], [x + out * 0.5, y1 - 17], [x, y1 - 14]], tier: tier + 1 },
  ];
}
const bodyPoly = (left) => [...left, ...mir(left).reverse()];

// Clear glass from its profile: sides, rim, and the right foot.
// `front`: 'with' draws everything; 'without' leaves out the front of the rim, which a separate
// 'glass.front' ('only') draws after what sits inside the glass, so the rim passes in front of it.
function clearGlass(kind, front = 'with') {
  const G = GLASS_PROFILES[kind], cx = 150;
  const rimY = G.pts[0][0], rw = G.pts[0][1], bottom = G.pts[G.pts.length - 1];
  const [rimFront, rimBack] = rimStrokes(cx, rimY, rw, G.rimTilt);
  if (front === 'only') return { box: [300, 460], strokes: [rimFront], washes: [] };
  const side = s => G.pts.map(([y, w]) => [cx + s * w, y]);
  const strokes = [{ pts: side(-1), tier: 1 }, { pts: side(1), tier: 1 }, ...(front === 'without' ? [rimBack] : [rimFront, rimBack])];
  if (G.foot === 'slab') {
    strokes.push(frontArc(cx, bottom[0], bottom[1], bottom[1] * 0.14));
    strokes.push({ pts: ell(cx, bottom[0] - 10, bottom[1] * 0.96, bottom[1] * 0.12, 0.2, Math.PI - 0.2, 16), tier: 3 });
  } else if (G.foot === 'heavy') {
    // The chimney's thick, heavy base: the side walls run down past the glass floor.
    strokes.push({ pts: [[cx - bottom[1], bottom[0]], [cx - bottom[1], BASE - 4]], tier: 1 }, { pts: [[cx + bottom[1], bottom[0]], [cx + bottom[1], BASE - 4]], tier: 1 });
    strokes.push(frontArc(cx, BASE - 4, bottom[1], bottom[1] * 0.14));
    strokes.push(frontArc(cx, bottom[0], bottom[1] * 0.94, bottom[1] * 0.12, 2));
  } else if (G.foot === 'stem') {
    const stemTop = bottom[0], footY = BASE - 6, sw = kind === 'punch-bowl' ? 18 : kind === 'hurricane' || kind === 'poco-grande' ? 7 : 4;
    strokes.push({ pts: [[cx - sw, stemTop], [cx - sw + 1, footY - 3]], tier: 2 }, { pts: [[cx + sw, stemTop], [cx + sw - 1, footY - 3]], tier: 2 });
    strokes.push({ pts: ell(cx, footY, G.footW, 6, 0, TAU, 26), tier: 1 });
  }
  if (G.flutes) {
    // The Pearl Diver glass's fluted lower bowl.
    for (const k of [-0.6, -0.2, 0.2, 0.6]) strokes.push({ pts: [[cx + k * halfAt(G, G.flutes[0]), G.flutes[0]], [cx + k * halfAt(G, 350) * 1.05, 350], [cx + k * halfAt(G, G.flutes[1] - 6), G.flutes[1] - 6]], tier: 3 });
  }
  if (G.handle) strokes.push(...handle(cx + halfAt(G, G.handle[0]) - 1, G.handle[0], G.handle[1], 38));
  if (kind === 'punch-bowl') {
    // A ladle resting in the bowl and one punch cup in front.
    strokes.push({ pts: [[176, 330], [214, 288], [246, 254], [258, 246], [262, 252]], tier: 1 });
    strokes.push({ pts: ell(62, 402, 26, 5, 0, TAU, 18), tier: 1 }, { pts: [[36, 402], [40, 434], [84, 434], [88, 402]], tier: 1 });
    strokes.push({ pts: [[36, 410], [22, 412], [20, 424], [38, 428]], tier: 2 });
  }
  // A single highlight flick, like a pen lifting off.
  if (!['cocktail-glass', 'punch-bowl'].includes(kind)) strokes.push({ pts: [[cx - halfAt(G, rimY + 26) * 0.7, rimY + 26], [cx - halfAt(G, rimY + 70) * 0.72, rimY + 70]], tier: 3 });
  return { box: [300, 460], strokes, washes: [] };
}

// ---- opaque vessels, each authored by hand
// Mid-century tiki glazes (Bauer, Otagiri, Orchids of Hawaii): what a ceramic mug or bowl wears.
// (ebony is a black glaze with turquoise run down from the rim in drips, ceramicCoat below)
export const TIKI_GLAZES = { turquoise: '#3FA9A8', oxblood: '#A3352F', cobalt: '#3F6CBC', jade: '#4F9C6C', mustard: '#D8A62E', seafoam: '#86C7AE', coral: '#D9694F', ebony: '#4A4752' };
const isGlaze = c => Object.values(TIKI_GLAZES).includes(c);
// Glazes that read as one color across a shelf: turquoise, jade and sea-foam are all the green-teal
// family, so two of them side by side read as a pair, not a spread.
const GLAZE_FAMILY = { turquoise: 'teal', jade: 'teal', seafoam: 'teal', oxblood: 'red', cobalt: 'blue', mustard: 'ochre', coral: 'coral', ebony: 'black' };
export const glazeFamily = c => { const k = Object.keys(TIKI_GLAZES).find(n => TIKI_GLAZES[n] === c); return k ? GLAZE_FAMILY[k] : null; };
// The families a glaze shows (ebony shows its turquoise drips too).
export const glazeFamilies = c => { const f = glazeFamily(c); return !f ? [] : f === 'black' ? ['black', 'teal'] : [f]; };
// Clip a polygon to the side of a line where f(p) >= 0 (f linear).
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out.length >= 3 ? out : null;
}
const clipX = (poly, x0, x1) => { const p = clipHalf(poly, q => q[0] - x0); return p && clipHalf(p, q => x1 - q[0]); };
// A glazed ceramic body: a pale coat of the glaze, the glaze itself laid over all but a sheen
// down the lit side, deeper on the shadow side and pooled at the foot where glaze runs thick.
// Composited as exact glazes (the part is `glazed`, artrender.js), so the glaze keeps its hue.
function ceramicCoat(poly, glazeHex, { sheen = true, pool = true } = {}) {
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys), w = x1 - x0, hgt = y1 - Math.min(...ys);
  if (glazeHex === TIKI_GLAZES.ebony) return ebonyCoat(poly, { drips: sheen && pool });
  glazeHex = mixHex(glazeHex, '#FFFFFF', 0.12);
  const [h, s, l] = hexHsl(glazeHex);
  const light = hslHex(h, s * 0.8, l + (1 - l) * 0.55), deep = hslHex(h, Math.min(0.95, s + 0.06), l * 0.8);
  const out = [], coat = (pts, target, under, alpha, soft = 0.8) => { if (pts) { const g = glaze(target, under, alpha); out.push({ pts, color: g.color, alpha: g.alpha, soft, grain: 0.14, layers: GLAZE_LAYERS }); } };
  coat(poly, light, '#FFFFFF', 0.06, 0.6);
  if (sheen) { coat(clipX(poly, x0 - 1, x0 + w * 0.14), glazeHex, light, 0.06); coat(clipX(poly, x0 + w * 0.3, x1 + 1), glazeHex, light, 0.06); }
  else coat(poly, glazeHex, light, 0.06);
  coat(clipX(poly, x0 + w * 0.74, x1 + 1), deep, glazeHex, 0.05, 0.9);
  if (pool) coat(clipHalf(poly, q => q[1] - (y1 - hgt * 0.14)), deep, glazeHex, 0.05, 0.9);
  return out;
}
// A black glaze with turquoise flowed over the rim and run down in drips (the turquoise laid
// first, the black after it below the drip line, so the drips are the turquoise left showing).
// The black is one wash: the body's outline, finely resampled, with every point above the drip
// line brought down onto it, so its top edge is the drip line itself; it is laid as its own black
// (not as the glaze that turns turquoise black, a ratio that is mostly red). A lighter charcoal
// sheen runs down the lit side. Small parts (a handle, a foot) are plain black.
function ebonyCoat(poly, { drips = true } = {}) {
  const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), yt = Math.min(...ys), w = x1 - x0, hgt = Math.max(...ys) - yt;
  const TQ = TIKI_GLAZES.turquoise, BLACK = TIKI_GLAZES.ebony, SHEEN = '#6E6B78', PALE = hslHex(hexHsl(TQ)[0], 0.5, 0.78);
  const out = [], coat = (pts, target, under, alpha, soft = 0.8) => { if (pts) { const g = glaze(target, under, alpha); out.push({ pts, color: g.color, alpha: g.alpha, soft, grain: 0.14, layers: GLAZE_LAYERS }); } };
  if (!drips) { coat(poly, BLACK, '#FFFFFF', 0.07, 0.6); return out; }
  coat(poly, PALE, '#FFFFFF', 0.06, 0.6);
  coat(clipHalf(poly, q => yt + hgt * 0.62 - q[1]), TQ, PALE, 0.06, 0.6);
  // the drip line: a wavy collar a little under the rim, and five tongues of glaze of different
  // lengths hanging from it, rounded at the ends
  const tongues = [[0.14, 0.07, 0.3], [0.33, 0.05, 0.16], [0.52, 0.08, 0.42], [0.7, 0.05, 0.22], [0.87, 0.06, 0.34]];
  const edge = x => {
    const u = (x - x0) / w;
    let y = yt + hgt * (0.13 + 0.015 * Math.sin(u * 19));
    for (const [c, hw, len] of tongues) { const d = (u - c) / hw; if (Math.abs(d) < 1) y = Math.max(y, yt + hgt * (0.13 + len * Math.sqrt(1 - d * d))); }
    return y;
  };
  const fine = [];
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2.5)); for (let k = 0; k < n; k++) fine.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); });
  const black = fine.map(([x, y]) => [x, Math.max(y, edge(x))]);
  coat(clipX(black, x0 - 1, x0 + w * 0.16 + 1), BLACK, '#FFFFFF', 0.07, 0.35);
  coat(clipX(black, x0 + w * 0.16, x0 + w * 0.3), SHEEN, '#FFFFFF', 0.07, 0.35);
  coat(clipX(black, x0 + w * 0.3 - 1, x1 + 1), BLACK, '#FFFFFF', 0.07, 0.35);
  return out;
}
// A body seen from just above the rim, less the front half of the drink's surface (which the
// glaze must not darken): the polygon's top edge follows the near side of the rim's ellipse.
const rimCut = (poly, cx, y, hw, tilt) => [...poly, ...ell(cx, y, hw - 6, (hw - 6) * tilt, 0, Math.PI, 16)];
// The body's washes: a ceramic glaze, or a plain wash of a natural material (wood, sand, bone).
const bodyCoat = (poly, glazeHex, alpha, opts) => isGlaze(glazeHex) ? ceramicCoat(poly, glazeHex, opts) : [{ pts: poly, color: glazeHex, alpha }];
function kuMugVessel({ glaze = PALETTE.wood } = {}) {
  const left = [[90, 180], [92, 310], [94, 436]];
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 56, 7), ...rimStrokes(150, 180, 60, 0.18),
      { pts: [[94, 212], [206, 212]], tier: 2 }, { pts: [[96, 222], [204, 222]], tier: 3 },
      { pts: ell(124, 250, 17, 17, -1.2, -1.2 + TAU * 1.04, 24), tier: 1 }, { pts: ell(176, 250, 17, 17, -1.2, -1.2 + TAU * 1.04, 24), tier: 1 },
      { pts: [[142, 266], [134, 292], [166, 292], [158, 266]], tier: 2 },
      { pts: [[106, 314], [194, 314]], tier: 1 }, { pts: [[106, 314], [120, 338], [150, 348], [180, 338], [194, 314]], tier: 1 },
      ...[122, 136, 150, 164, 178].map(x => ({ pts: [[x, 315], [x, 325]], tier: 2 })),
      { pts: [[90, 244], [78, 252], [78, 288], [91, 298]], tier: 1 }, { pts: [[210, 244], [222, 252], [222, 288], [209, 298]], tier: 1 },
      // stubby arms bent at the elbow, hands meeting on the belly; squatting legs at the base
      { pts: [[94, 364], [112, 384], [140, 380]], tier: 2 }, { pts: [[206, 364], [188, 384], [160, 380]], tier: 2 },
      { pts: [[104, 432], [110, 410], [134, 406], [140, 432]], tier: 2 }, { pts: [[196, 432], [190, 410], [166, 406], [160, 432]], tier: 2 },
    ],
    washes: [
      ...bodyCoat(rimCut(bodyPoly(left), 150, 180, 60, 0.18), glaze, 0.034),
      { pts: [[108, 316], [192, 316], [180, 336], [150, 346], [120, 336]], color: PALETTE.hibiscusDeep, alpha: 0.06, soft: 0.4 },
    ],
    glazed: isGlaze(glaze),
    dots: [{ x: 124, y: 252, r: 6 }, { x: 176, y: 252, r: 6 }, { x: 122, y: 249, r: 1.8, color: PALETTE.paper }, { x: 174, y: 249, r: 1.8, color: PALETTE.paper }],
  };
}

function skullMugVessel({ glaze: g = '#E6D9BD' } = {}) {
  const left = [[98, 262], [80, 284], [70, 322], [74, 360], [90, 386], [100, 404], [104, 426], [120, 438], [150, 440]];
  const bone = isGlaze(g) ? g : '#E6D9BD', hollow = isGlaze(g) ? hslHex(hexHsl(g)[0], 0.5, 0.28) : PALETTE.wood;
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, ...rimStrokes(150, 262, 52, 0.2),
      { pts: ell(126, 334, 19, 15, 0, TAU * 1.03, 20, -0.15), tier: 1 }, { pts: ell(174, 334, 19, 15, 0, TAU * 1.03, 20, 0.15), tier: 1 },
      { pts: [[150, 354], [141, 374], [150, 379], [159, 374], [150, 354]], tier: 1 },
      { pts: [[116, 398], [184, 398]], tier: 2 }, { pts: [[118, 416], [182, 416]], tier: 3 },
      ...[128, 139, 150, 161, 172].map(x => ({ pts: [[x, 398], [x, 416]], tier: 2 })),
      { pts: [[112, 286], [121, 298], [116, 312]], tier: 3 }, { pts: [[188, 292], [182, 304]], tier: 3 },
      { pts: [[84, 364], [96, 372]], tier: 3 }, { pts: [[216, 364], [204, 372]], tier: 3 },
      // bone handle: a shaft with knuckled ends, standing off the back of the skull
      { pts: [[222, 292], [244, 294], [258, 316], [261, 346], [253, 372], [236, 388], [214, 392]], tier: 1 },
      { pts: [[226, 304], [242, 308], [248, 330], [248, 356], [238, 374], [222, 380]], tier: 2 },
      { pts: ell(244, 292, 7, 6, 0, TAU, 12), tier: 2 }, { pts: ell(236, 390, 7, 6, 0, TAU, 12), tier: 2 },
    ],
    washes: [
      ...bodyCoat(rimCut(bodyPoly(left), 150, 262, 52, 0.2), bone, 0.05),
      ...bodyCoat([[222, 292], [244, 294], [258, 316], [261, 346], [253, 372], [236, 388], [214, 392], [222, 380], [238, 374], [248, 356], [248, 330], [242, 308], [226, 304]], bone, 0.05, { sheen: false, pool: false }),
      { pts: ell(126, 334, 17, 13, 0, TAU, 14), color: hollow, alpha: 0.09, soft: 0.4 },
      { pts: ell(174, 334, 17, 13, 0, TAU, 14), color: hollow, alpha: 0.09, soft: 0.4 },
      { pts: [[150, 356], [142, 374], [158, 374]], color: hollow, alpha: 0.08, soft: 0.3 },
    ],
    glazed: isGlaze(g),
  };
}

function barrelMugVessel() {
  const left = [[92, 250], [82, 296], [79, 344], [82, 392], [92, 436]];
  const hw = y => 150 - (y < 344 ? 92 - (92 - 79) * Math.sin(((y - 250) / 94) * Math.PI / 2) : 79 + (92 - 79) * (1 - Math.cos(((y - 344) / 92) * Math.PI / 2)));
  const hoop = y => frontArc(150, y, hw(y), hw(y) * 0.2);
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 58, 9), ...rimStrokes(150, 250, 58, 0.2),
      hoop(270), { ...hoop(282), tier: 2 }, hoop(404), { ...hoop(416), tier: 2 },
      ...[-40, -14, 14, 40].map(o => ({ pts: [[150 + o * 0.86, 286], [150 + o * 1.02, 344], [150 + o * 0.86, 400]], tier: 3 })),
    ],
    washes: [
      { pts: bodyPoly(left), color: PALETTE.wood, alpha: 0.04 },
      { pts: [[84, 266], [216, 266], [216, 286], [84, 286]], color: PALETTE.wood, alpha: 0.05, soft: 0.3 },
      { pts: [[84, 400], [216, 400], [216, 420], [84, 420]], color: PALETTE.wood, alpha: 0.05, soft: 0.3 },
    ],
  };
}

// Trader Vic's Fog Cutter mug: tall, handleless, slightly waisted, sand glaze, with an island
// scene in low relief. Drawn as landscape only (a palm over a small island, a sailboat, waves):
// no figures as décor (presentation.md §6.2).
function fogCutterVessel() {
  const left = [[93, 117], [99, 200], [101, 280], [98, 360], [93, 436]];
  const sand = '#D8C29B';
  const wave = y => { const pts = []; for (let x = 104; x <= 196; x += 4) pts.push([x, y + Math.sin((x - 104) / 9) * 2.4]); return pts; };
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 57, 9), ...rimStrokes(150, 117, 57, 0.18),
      frontArc(150, 134, 56, 10, 3), frontArc(150, 412, 56, 10, 3),
      // a palm leaning over a little island
      { pts: [[166, 352], [164, 300], [156, 250], [146, 214]], tier: 2 },
      ...[-2.9, -2.3, -1.6, -0.9, -0.3].map(a => ({ pts: [[146, 214], [146 + Math.cos(a) * 20, 214 + Math.sin(a) * 11 - 2], [146 + Math.cos(a) * 36, 214 + Math.sin(a) * 4 + 12]], tier: 2 })),
      { pts: [[112, 356], [134, 342], [168, 340], [192, 354]], tier: 2 },
      // a sailboat on the horizon, the sea, a couple of birds
      { pts: [[112, 300], [128, 300], [124, 306], [114, 306], [112, 300]], tier: 2 }, { pts: [[120, 300], [120, 272], [130, 298]], tier: 2 },
      { pts: wave(366), tier: 2 }, { pts: wave(380), tier: 3 }, { pts: wave(394), tier: 3 },
      { pts: [[176, 236], [181, 232], [186, 236]], tier: 3 }, { pts: [[186, 250], [190, 247], [194, 250]], tier: 3 },
    ],
    washes: [
      { pts: bodyPoly(left), color: sand, alpha: 0.05 },
      { pts: [[112, 356], [134, 342], [168, 340], [192, 354]], color: PALETTE.ochre, alpha: 0.07, soft: 0.4 },
      { pts: [[104, 362], [196, 362], [196, 400], [104, 400]], color: PALETTE.lagoon, alpha: 0.05, soft: 0.5 },
      { pts: [[121, 274], [121, 298], [129, 297]], color: PALETTE.paper, alpha: 0.05, soft: 0.3 },
      { pts: [...ell(150, 117, 58, 10, 0, Math.PI, 12), ...ell(150, 131, 58, 10, Math.PI, 0, 12)], color: PALETTE.wood, alpha: 0.06, soft: 0.3 },
    ],
  };
}

function birdVessel({ glaze = PALETTE.lagoon } = {}) {
  const body = [[74, 330], [84, 306], [122, 292], [164, 290], [208, 298], [240, 322], [250, 352], [236, 388], [200, 410], [156, 416], [112, 406], [84, 384], [72, 356], [74, 330]];
  return {
    strokes: [
      { pts: body, tier: 1 }, ...rimStrokes(164, 304, 40, 0.24),
      { pts: [[84, 316], [68, 292], [60, 272], [68, 252], [88, 246], [104, 256], [106, 276], [98, 296]], tier: 1 },
      { pts: [[62, 262], [34, 270], [62, 276]], tier: 1 },
      { pts: [[240, 322], [272, 296], [286, 282]], tier: 1 }, { pts: [[246, 336], [280, 318], [294, 310]], tier: 1 }, { pts: [[250, 350], [282, 342]], tier: 1 },
      { pts: [[124, 350], [156, 334], [194, 340], [220, 364]], tier: 2 }, { pts: [[148, 356], [184, 356]], tier: 3 }, { pts: [[158, 370], [198, 372]], tier: 3 },
      { pts: [[138, 416], [134, 432]], tier: 2 }, { pts: [[174, 416], [178, 432]], tier: 2 }, { pts: ell(156, 434, 56, 6, 0, TAU, 22), tier: 1 },
    ],
    washes: [
      ...bodyCoat(isGlaze(glaze) ? [[74, 330], [84, 306], [124, 306], ...ell(164, 304, 34, 34 * 0.24, Math.PI, 0, 12), [204, 306], [240, 322], [250, 352], [236, 388], [200, 410], [156, 416], [112, 406], [84, 384], [72, 356]] : body, glaze, 0.04),
      ...bodyCoat([[68, 290], [60, 270], [68, 252], [88, 246], [104, 256], [104, 280]], glaze, 0.04, { pool: false }),
      { pts: [[62, 262], [36, 270], [62, 276]], color: PALETTE.butter, alpha: 0.12, soft: 0.3 },
      { pts: [[240, 322], [286, 282], [294, 310], [282, 342], [250, 350]], color: PALETTE.hibiscus, alpha: 0.06, soft: 0.5 },
    ],
    dots: [{ x: 82, y: 262, r: 3.6 }, { x: 81, y: 261, r: 1.1, color: PALETTE.paper }],
    glazed: isGlaze(glaze),
  };
}

function coconutVessel() {
  const left = [[90, 296], [74, 326], [70, 366], [84, 404], [114, 428], [150, 436]];
  const r = rng(41), strokes = [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, ...rimStrokes(150, 296, 60, 0.26)];
  strokes.push({ pts: ell(150, 297, 52, 52 * 0.26, 0.2, Math.PI - 0.2, 18), tier: 3 });
  for (let i = 0; i < 14; i++) {
    const a = 0.3 + r() * (Math.PI - 0.6), rx = 70 + r() * 6, ry = 64 + r() * 6, x = 150 - Math.cos(a) * rx, y = 366 + Math.sin(a) * ry * 0.95 - 30 + r() * 20;
    strokes.push({ pts: [[x, y], [x + (r() - 0.5) * 10, y + 6 + r() * 6]], tier: 3 });
  }
  return { strokes, washes: [{ pts: bodyPoly(left), color: PALETTE.wood, alpha: 0.045 }, { pts: ell(150, 297, 54, 12, 0, TAU, 14), color: PALETTE.paper, alpha: 0.2, soft: 0.3 }] };
}

function pineappleVessel({ lid = false } = {}) {
  const cx = 150, cy = 336, rx = 76, ry = 100, strokes = [], cut = 262;
  const t0 = Math.asin((cut - cy) / ry);
  strokes.push({ pts: ell(cx, cy, rx, ry, t0, Math.PI - t0, 36), tier: 1 });
  strokes.push(...rimStrokes(cx, cut, 51, 0.24));
  // jagged cut along the front of the rim
  const jag = [];
  for (let i = 0; i <= 12; i++) { const a = 0.1 + (i / 12) * (Math.PI - 0.2); jag.push([cx + Math.cos(a) * 51, cut + Math.sin(a) * 12 + (i % 2 ? 4 : 0)]); }
  strokes.push({ pts: jag, tier: 3 });
  for (const dir of [1, -1]) for (let c = -150; c <= 150; c += 22) {
    const pts = [];
    for (let s = -110; s <= 110; s += 4) {
      const x = cx + s, y = cy + dir * s * 0.9 + c;
      if (((x - cx) / (rx - 6)) ** 2 + ((y - cy) / (ry - 6)) ** 2 <= 1 && y > cut + 16) pts.push([x, y]);
    }
    if (pts.length > 3) strokes.push({ pts: [pts[0], pts[pts.length - 1]], tier: 3 });
  }
  // the crown, set down beside it (unless it sits back on top as a lid: garnish.pineapple-crown-lid)
  const crown = [];
  if (!lid) [-2.2, -1.95, -1.7, -1.45, -1.2].forEach((a, i) => {
    const leaf = leafShape(58 + (i === 2 ? 18 : 0) - Math.abs(i - 2) * 6, 7, 246 + (i - 2) * 4, 436, a + 0.35);
    crown.push(leaf); strokes.push({ pts: leaf, tier: 1 });
  });
  return {
    strokes,
    washes: [{ pts: ell(cx, cy + 8, rx, ry - 8, 0, TAU, 24).filter(p => p[1] > cut), color: PALETTE.ochre, alpha: 0.045 }, ...crown.map(l => ({ pts: l, color: PALETTE.frond, alpha: 0.06, soft: 0.5 }))],
  };
}

function clayCupVessel() {
  const left = [[100, 356], [102, 392], [112, 436]];
  return {
    strokes: [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 38, 6), ...rimStrokes(150, 356, 50, 0.2), frontArc(150, 364, 49, 9, 3), { pts: [[114, 398], [120, 402]], tier: 3 }, { pts: [[178, 410], [184, 406]], tier: 3 }],
    washes: [{ pts: bodyPoly(left), color: '#C0643C', alpha: 0.05 }],
  };
}

function hotMugVessel({ glaze = PALETTE.lagoon } = {}) {
  const left = [[90, 290], [90, 436]];
  return {
    strokes: [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 60, 9), ...rimStrokes(150, 290, 60, 0.18), ...handle(210, 308, 404, 36), frontArc(150, 306, 59, 11, 3)],
    washes: bodyCoat(rimCut(bodyPoly(left), 150, 290, 60, 0.18), glaze, 0.04),
    glazed: isGlaze(glaze),
  };
}

function julepVessel() {
  const left = [[88, 297], [94, 380], [98, 426], [96, 436]];
  const r = rng(17), dots = [];
  for (let i = 0; i < 30; i++) dots.push({ x: 102 + r() * 96, y: 316 + r() * 104, r: 0.8 + r() * 1.1, tier: 3 });
  return {
    strokes: [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 54, 7), frontArc(150, 426, 52, 6, 2), ...rimStrokes(150, 297, 62, 0.2), frontArc(150, 305, 61, 12, 2), { pts: [[118, 330], [117, 358]], tier: 3 }, { pts: [[178, 340], [179, 374]], tier: 3 }],
    washes: [{ pts: bodyPoly(left), color: '#A7B0B6', alpha: 0.035 }],
    dots,
  };
}

function copperVessel() {
  const left = [[96, 290], [92, 330], [92, 400], [96, 436]];
  const strokes = [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 54, 8), ...rimStrokes(150, 290, 54, 0.18), frontArc(150, 304, 55, 10, 2), ...handle(206, 312, 404, 34)];
  const r = rng(23);
  for (let i = 0; i < 9; i++) { const x = 104 + r() * 90, y = 320 + r() * 100; strokes.push({ pts: ell(x, y, 5, 3, 3.6, 5.8, 6), tier: 3 }); }
  return { strokes, washes: [{ pts: bodyPoly(left), color: '#C8733A', alpha: 0.05 }], dots: [{ x: 214, y: 318, r: 2 }, { x: 214, y: 398, r: 2 }] };
}

// Pusser's white enamel mug: white enamel shaded cool down its turned side, a cobalt rolled rim
// (the band round the lip and the ring of it seen inside), and a few chips knocked to the black
// iron, each ringed in cobalt where the enamel broke away.
const ENAMEL_BAND = '#2D57A8', ENAMEL_IRON = '#2A2C35';
function enamelVessel() {
  const left = [[86, 307], [86, 436]];
  const out = [], coat = (pts, target, under, alpha, soft = 0.6) => { const g = glaze(target, under, alpha); out.push({ pts, color: g.color, alpha: g.alpha, soft, grain: 0.06, layers: GLAZE_LAYERS }); };
  // the rolled rim: a cobalt band round the outside of the lip and the ring of it at the back
  coat([...ell(150, 307, 65, 13.5, 0, Math.PI, 18), ...ell(150, 317, 65, 13.5, Math.PI, 0, 18)], ENAMEL_BAND, '#FFFFFF', 0.06, 0.3);
  coat([...ell(150, 307, 65, 13.5, Math.PI, TAU, 18), ...ell(150, 307.5, 58, 11, TAU, Math.PI, 18)], ENAMEL_BAND, '#FFFFFF', 0.06, 0.3);
  // chips: the iron showing, ringed in cobalt
  const chips = [[112, 366, 5.5, 0.3], [187, 404, 4.5, 1.2], [130, 323, 3.6, 2], [200, 340, 3, 0.7]];
  const strokes = [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 64, 10), ...rimStrokes(150, 307, 64, 0.2), frontArc(150, 317, 64, 13, 2), ...handle(214, 324, 400, 34)];
  // the turned side of the mug in shadow: a few faint pen strokes, the enamel left white
  for (const x of [200, 205, 209]) strokes.push({ pts: [[x, 330 + (x - 200) * 2], [x + 0.5, 420 - (x - 200)]], tier: 3 });
  for (const [x, y, rr, a] of chips) {
    const P = [0, 1, 2, 3, 4, 5, 6].map(i => { const t = a + (i / 7) * TAU, k = i % 2 ? 0.72 : 1; return [x + Math.cos(t) * rr * k, y + Math.sin(t) * rr * 0.8 * k]; });
    coat(P.map(([px, py]) => [x + (px - x) * 1.5, y + (py - y) * 1.5]), ENAMEL_BAND, '#FFFFFF', 0.05, 0.3);
    coat(P, ENAMEL_IRON, ENAMEL_BAND, 0.08, 0.2);
    strokes.push({ pts: [...P, P[0]], tier: 3 });
  }
  return { strokes, washes: out, glazed: true };
}

// The Scorpion bowl on three short carved feet, palms in relief round the body. (The original
// stands on kneeling figures; drawn here as plain feet, presentation.md §6.2.)
function scorpionBowlVessel({ glaze = PALETTE.wood } = {}) {
  const left = [[18, 282], [24, 314], [48, 350], [84, 378], [120, 390]];
  const palm = (x, y, lean) => {
    const top = [x + lean, y];
    return [
      { pts: [[x - lean * 0.2, y + 44], [x + lean * 0.4, y + 22], top], tier: 2 },
      ...[-2.9, -2.3, -1.6, -0.9, -0.3].map(a => ({ pts: [top, [top[0] + Math.cos(a) * 14, top[1] + Math.sin(a) * 9 - 3], [top[0] + Math.cos(a) * 24, top[1] + Math.sin(a) * 4 + 7]], tier: 2 })),
    ];
  };
  // a short carved foot: a tapered block with a chevron band
  const foot = x => [
    { pts: [[x - 9, 392], [x - 13, 436], [x + 13, 436], [x + 9, 392]], tier: 2 },
    { pts: [[x - 10, 410], [x - 5, 416], [x, 410], [x + 5, 416], [x + 10, 410]], tier: 3 },
  ];
  const band = [];
  for (let x = 34; x <= 266; x += 6) band.push([x, 312 + Math.pow((x - 150) / 116, 2) * 10]);
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 390, 30, 5, 2), ...rimStrokes(150, 282, 132, 0.15),
      { pts: band, tier: 3 }, ...palm(92, 318, 8), ...palm(208, 318, -8),
      ...foot(110), ...foot(150), ...foot(190),
    ],
    washes: [
      ...bodyCoat(rimCut(bodyPoly(left), 150, 282, 132, 0.15), glaze, 0.036),
      ...[110, 150, 190].flatMap(x => bodyCoat([[x - 9, 392], [x + 9, 392], [x + 13, 436], [x - 13, 436]], isGlaze(glaze) ? glaze : PALETTE.woodPale, 0.05, { sheen: false }).map(w => ({ ...w, soft: 0.4 }))),
    ],
    glazed: isGlaze(glaze),
  };
}

// Trader Vic's Tiki Bowl: an earthen bowl on three carved posts (generic chevron carving rather
// than faces, presentation.md §6.2).
function tikiBowlVessel({ glaze = PALETTE.wood } = {}) {
  const left = [[46, 300], [52, 328], [72, 360], [104, 382], [126, 388]];
  const post = x => [
    { pts: [[x - 11, 388], [x - 12, 436], [x + 12, 436], [x + 11, 388]], tier: 1 },
    { pts: [[x - 10, 398], [x + 10, 398]], tier: 3 },
    { pts: [[x - 10, 404], [x - 5, 410], [x, 404], [x + 5, 410], [x + 10, 404]], tier: 2 },
    { pts: [[x - 10, 416], [x - 5, 422], [x, 416], [x + 5, 422], [x + 10, 416]], tier: 3 },
  ];
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, ...rimStrokes(150, 300, 104, 0.16),
      frontArc(150, 316, 102, 16, 3), ...post(104), ...post(150), ...post(196),
    ],
    washes: [
      ...bodyCoat(rimCut(bodyPoly(left), 150, 300, 104, 0.16), glaze, 0.04),
      ...[104, 150, 196].flatMap(x => bodyCoat([[x - 11, 388], [x + 11, 388], [x + 12, 436], [x - 12, 436]], isGlaze(glaze) ? glaze : PALETTE.wood, 0.05, { sheen: false }).map(w => ({ ...w, soft: 0.3 }))),
    ],
    glazed: isGlaze(glaze),
  };
}

// Volcano bowl: black glaze with red-orange lava drips running from the rim, a cone rising from
// the middle to just above the rim with lava down its face, rum burning in its crater. The black
// is laid around the drips (a multiplied wash can't paint bright over dark), so the lava glows.
function volcanoBowlVessel({ flaming = false } = {}) {
  const left = [[22, 330], [30, 360], [58, 388], [92, 404], [96, 420], [92, 436]];
  const black = '#3B3538', sheen = '#A49C9E', lava = '#E4492A', core = '#F7A33A';
  const strokes = [
    { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 58, 7), ...rimStrokes(150, 330, 128, 0.15),
    { pts: [[110, 336], [126, 306], [140, 284]], tier: 1 }, { pts: [[160, 284], [174, 306], [190, 336]], tier: 1 },
    { pts: ell(150, 284, 11, 4, 0, TAU, 14), tier: 2 },
  ];
  // the drips: x, the foot of the run, its half-width
  const drips = [[48, 362, 7], [96, 392, 8], [132, 370, 6], [186, 386, 8], [228, 372, 7]];
  const tongue = (dx, top, foot, w) => [[dx + w, top], [dx + w * 0.75, top + (foot - top) * 0.55], [dx + w * 0.95, foot - 4], [dx + w * 0.5, foot + 3], [dx, foot + 5], [dx - w * 0.5, foot + 3], [dx - w * 0.95, foot - 4], [dx - w * 0.75, top + (foot - top) * 0.55], [dx - w, top]];
  // the glaze: one coat whose top edge follows the near side of the rim and runs down round
  // each drip, so the lava is left as paper and painted red-orange
  const rx = 122, ry = rx * 0.15, arcY = xx => 330 + ry * Math.sqrt(Math.max(0, 1 - ((xx - 150) / rx) ** 2));
  const rimEdge = [];
  for (let xx = 150 + rx; xx >= 150 - rx; xx -= 4) {
    const d = drips.find(([dx, , w]) => xx <= dx + w && xx > dx - w);
    if (d && !rimEdge.d?.includes(d)) { (rimEdge.d = rimEdge.d || []).push(d); rimEdge.push(...tongue(d[0], arcY(d[0]) + 1, d[1], d[2])); }
    else if (!d) rimEdge.push([xx, arcY(xx)]);
  }
  const body = [...bodyPoly(left), [150 + 128, 330], ...rimEdge, [150 - 128, 330]];
  const cone = [[110, 336], [126, 306], [140, 284], [145, 285], [147, 312], [148, 336], [152, 336], [153, 312], [155, 285], [160, 284], [174, 306], [190, 336]];
  const out = [], coat = (pts, target, under, alpha, soft = 0.7) => { if (pts) { const g = glaze(target, under, alpha); out.push({ pts, color: g.color, alpha: g.alpha, soft, grain: 0.16, layers: GLAZE_LAYERS }); } };
  // a gray sheen down the lit side, the black glaze everywhere else
  coat(body, sheen, '#FFFFFF', 0.08, 0.6);
  coat(clipX(body, 0, 46), black, sheen, 0.1, 0.4);
  coat(clipX(body, 66, 300), black, sheen, 0.1, 0.4);
  coat(cone, black, '#FFFFFF', 0.12, 0.5);
  // the lava: red-orange runs with a hot core, a glowing channel down the cone
  for (const [dx, foot, w] of drips) {
    const top = arcY(dx) - 2;
    coat(tongue(dx, top, foot, w + 1.5), lava, '#FFFFFF', 0.08, 0.4);
    coat([[dx - w * 0.3, top + 2], [dx + w * 0.3, top + 2], [dx + w * 0.2, foot - 6], [dx - w * 0.2, foot - 6]], core, lava, 0.08, 0.3);
  }
  coat([[143, 286], [157, 286], [154, 336], [146, 336]], lava, '#FFFFFF', 0.08, 0.4);
  coat([[147.5, 288], [152.5, 288], [151, 328], [149, 328]], core, lava, 0.08, 0.3);
  if (flaming) {
    strokes.push({ pts: [[141, 280], [135, 258], [147, 240], [150, 222], [156, 242], [166, 258], [159, 280]], tier: 1 });
    out.push({ pts: [[141, 280], [135, 258], [150, 222], [166, 258], [159, 280]], color: PALETTE.orange, alpha: 0.1, soft: 0.4 }, { pts: [[145, 278], [143, 262], [150, 248], [157, 262], [155, 278]], color: PALETTE.butter, alpha: 0.12, soft: 0.3 });
  }
  return { strokes, washes: out, glazed: true };
}

const OPAQUE_ART = {
  'ku-mug': kuMugVessel, 'skull-mug': skullMugVessel, 'barrel-mug': barrelMugVessel, 'fog-cutter-mug': fogCutterVessel,
  'bird-mug': birdVessel, coconut: coconutVessel, pineapple: pineappleVessel, 'clay-cup': clayCupVessel, 'hot-mug': hotMugVessel,
  'julep-cup': julepVessel, 'copper-mug': copperVessel, 'enamel-tin': enamelVessel, 'scorpion-bowl': scorpionBowlVessel, 'tiki-bowl': tikiBowlVessel, 'volcano-bowl': volcanoBowlVessel,
  'moai-mug': ({ glaze }) => { const m = fitPart(moaiMug({ glaze }), MOAI_FIT); return { strokes: m.strokes, washes: isGlaze(glaze) ? ceramicCoat(rimCut(m.washes[0].pts, 150, 155.5, 70.5, 0.19), glaze) : m.washes.map(w => ({ ...w, alpha: 0.028 })), glazed: isGlaze(glaze) }; },
};

export const VESSEL_IDS = Object.keys(GLASS_PROFILES);

function glass({ kind = 'collins', glaze, flaming = false, lid = false, front = 'with' } = {}) {
  if (!GLASS_PROFILES[kind]) kind = 'collins';
  if (OPAQUE_ART[kind]) {
    if (front === 'only') return { box: [300, 460], strokes: [], washes: [] };
    const art = OPAQUE_ART[kind]({ glaze, flaming, lid });
    return { box: [300, 460], strokes: art.strokes, washes: art.washes || [], dots: art.dots || [], ...(art.glazed ? { glazed: true } : {}) };
  }
  return clearGlass(kind, front);
}

// ---------------------------------------------------------------- the drink
const UP_KINDS = ['coupe', 'nick-nora', 'cocktail-glass', 'flute'];
const HEAP = ['crushed', 'pebble', 'shaved'];

// The heap of ice standing above the rim: its top edge, left to right, and the polygon it
// covers, closed along a front arc just inside the rim (so a sliver of drink shows between ice
// and rim in a mug). Ice, a crown soaked into the cap and the garnish resting on it share it.
export function capMound(kind, seed = 5, style = 'crushed') {
  const R = rimOf(kind), r = rng(((seed >>> 0) % 9973) * 7 + 3);
  const lift = UP_KINDS.includes(kind) ? 0 : R.hw > 100 ? 18 : 22;
  const top = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, k = style === 'shaved' ? 1 : 0.8 + r() * 0.4;
    top.push([R.cx - R.hw * 0.92 + u * R.hw * 1.84, R.y + 2 - Math.pow(Math.sin(Math.PI * u), 0.8) * lift * k]);
  }
  return { top, poly: [...top, ...ell(R.cx, R.y + 2, R.hw * 0.92, R.hw * 0.92 * R.tilt, 0, Math.PI, 16)], lift };
}
// The height of a heap's top edge at x.
export function capYAt(top, x) {
  if (x <= top[0][0]) return top[0][1];
  for (let i = 1; i < top.length; i++) if (x <= top[i][0]) { const [x0, y0] = top[i - 1], [x1, y1] = top[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return top[top.length - 1][1];
}

const okHex = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const lum = h => { const n = parseInt(h.slice(1), 16); return (0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255; };

// ---------------------------------------------------------------- pigment
// The look (optics.js) is the color of the drink in the glass; a painter lays it as pigment on
// white paper, and a tiki menu painter pushes it: more saturated, the mid-darks lifted so an
// amber glows like honey or copper rather than mud, a near-black kept as a deep garnet or
// molasses with color in it. The hue stays the drink's own; only the surface, the depths and
// the blooms lean a little (toward gold where light comes through, away from it in the depths),
// so a one-color drink still has life. Creams stay cream (a touch warmer), clear drinks stay a
// cool sparkle, and nothing turns neon unless the drink already is.
const hexHsl = hex => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d < 1e-6) return [0, 0, l];
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
};
const hslHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};
export { hexHsl, hslHex };
const GOLD = 46;
// Lean a hue toward gold (light coming through) or away from it (the depths), by up to d degrees.
const lean = (h, d) => {
  const gap = ((GOLD - h + 540) % 360) - 180;
  return d >= 0 ? h + Math.sign(gap) * Math.min(d, Math.abs(gap)) : h - (gap >= 0 ? 1 : -1) * -d;
};

// The look's own color word (optics.js colorWord) says what kind of paint the drink is: "creamy"
// is coconut or dairy (an opaque, gouache-like body), café au lait, tan and mocha are milky
// coffee and cocoa, a straw is a faint green-gold, and teal, turquoise, aqua and seafoam name a
// hue the painter keeps even when the mixed hex drifts toward green.
const WORD_HUE = [[/turquoise|\baqua\b/, 186], [/lagoon teal/, 176], [/teal-green/, 170], [/\bteal\b/, 176], [/seafoam|sea-foam/, 156]];
const bodyWord = w => String(w || '').toLowerCase().split(/ with | under /)[0].trim();
const toward = (h, at, k) => at + Math.max(-k, Math.min(k, ((h - at + 540) % 360) - 180));
export function pigment(hex, { opacity = 0.5, clarity = 0.5, layer = false, neon = false, word = '', shift = 0, creamy: cream = null, cafe: coffee = null } = {}) {
  if (!okHex(hex)) hex = PALETTE.butter;
  let [h, s, l] = hexHsl(hex);
  const s0 = s, w = bodyWord(word);
  const cafe = typeof coffee === 'boolean' ? coffee : /café|cafe|coffee|mocha|cocoa|chocolate|latte|\btan\b/.test(w);
  // A nearly colorless drink is a watery sparkle: a cool blue only when it is water-white; a
  // daiquiri's straw is a faint green-gold, and any other pale color keeps its own hue.
  if (lum(hex) > 0.9 && opacity < 0.3) {
    const [r, g, b] = rgbOf(hex), chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const waterWhite = w ? /water|crystal|colorless|^clear/.test(w) && !/straw|gold|green|amber|honey|yellow|pink|blush|rose|peach/.test(w) : chroma < 0.04;
    if (waterWhite) {
      const body = mixHex(hex, '#B4DCE2', 0.26);
      return finish('clear', { surf: body, body, deep: body, foot: mixHex(body, '#7CC3D2', 0.3) }, [mixHex(hex, '#F3E2A0', 0.35), mixHex(body, '#9FD8D0', 0.4)]);
    }
    const ch = /straw|green-gold/.test(w) || (!w && h >= 40 && h <= 75) ? 60 : h, cs = Math.max(0.42, Math.min(0.6, s0 * 1.4));
    const body = hslHex(ch, cs, 0.87);
    return finish('clear', { surf: body, body, deep: body, foot: hslHex(ch + 4, cs + 0.05, 0.82) }, [hslHex(ch - 12, cs, 0.86), hslHex(ch + 16, cs, 0.86)]);
  }
  if (s < 0.08) { h = 44; s = 0.4; }
  let kind = 'color', mahogany = false;
  // creamy: the color word says so, or (without one) an opaque, pale-to-mid warm drink
  const creamy = typeof cream === 'boolean' ? cream && opacity >= 0.6 : w ? /^creamy\b/.test(w) : opacity >= 0.85 && l >= 0.55 && h >= 18 && h <= 52;
  // (a named hue is held close: a turquoise that drifts past 195 reads cobalt)
  const named = WORD_HUE.find(([re]) => re.test(w));
  if (named) h = toward(h, named[1], 4);
  if (l >= 0.8 && !cafe) {
    // Cream and pale straw: warm butter-cream, never grey, mint or lemonade.
    kind = 'cream';
    if (h >= 18 && h <= 64) h += Math.max(-6, Math.min(6, 42 - h));
    s = Math.min(0.72, Math.max(0.55, s * 0.9));
    l = Math.min(l, 0.86) - 0.025;
    if (creamy) { const [hc, sc, lc] = hexHsl(mixHex(hslHex(h, s, l), '#FBF3E0', 0.1)); [h, s, l] = [hc, sc, lc]; }
  } else if (creamy || (cafe && l >= 0.4)) {
    // An opaque body, laid like gouache: lifted, even, a tint rather than a full hue. A Painkiller
    // is a warm orange-tan, coconut over blue curaçao a chalky aqua, a mocha a milky cocoa.
    kind = cafe ? 'cafe' : 'milky';
    const warm = h >= 15 && h <= 60, pink = h > 300 || h < 15;
    const cap = cafe ? 0.44 : warm ? 0.62 : pink ? 0.55 : 0.42;
    s = Math.min(cap, Math.max(s, cafe ? Math.min(cap, s0 * 1.12) : Math.min(cap, s0 * 1.25)));
    if (creamy || l >= 0.5) l = Math.max(l, cafe ? Math.min(0.74, l + 0.03) : warm ? 0.7 : 0.74);
    if (/seafoam/.test(w)) { s = Math.min(s, 0.4); l = Math.max(l, 0.76); }
  } else {
    // Seafoam is a pale, soft green even when the pulp makes it opaque.
    const foam = /seafoam/.test(w);
    // Greens, cyans and magentas turn to neon fast: only a drink that is neon (blue curaçao,
    // melon, butterfly pea, a prayer that asks for neon) gets the full push there, and even
    // then a named teal or turquoise keeps its hue (above).
    const electric = !neon && ((h >= 70 && h <= 200) || (h >= 285 && h <= 330));
    const cap = foam ? 0.42 : s0 > 0.72 ? 0.93 : electric ? 0.72 : 0.9;
    s = s + Math.max(0, cap - s) * (electric ? 0.45 : 0.7);
    if (foam) { s = Math.min(s, cap); l = Math.max(l, 0.76); }
    // (a mid-dark copper or amber is lifted half way to the light: it glows, never reads brown)
    if (l < 0.5) l += (0.5 - l) * (l < 0.3 ? 0.22 : 0.5);
    // a near-black stays dark: molasses, mahogany or garnet, with its color showing in the glow
    // (A layer is a band of one syrup or spirit seen edge-on: a grenadine sink stays ruby.)
    // A near-black purple-red (crème de cassis) is a plum-violet, a hibiscus a ruby, a
    // grenadine a garnet: each sink keeps its own color rather than one generic red.
    if (l < 0.36 && layer) {
      const l0 = hexHsl(hex)[2];
      if (h >= 290 && (h < 335 || (h <= 345 && l0 < 0.2))) { h = 318; s = 0.5; l = 0.26; }
      else if (h >= 325 && h <= 350) { h = 343; s = 0.8; l = 0.36; }
      else { s = Math.max(s, 0.78); l = Math.max(l, 0.34); }
    }
    else if (l < 0.36) { kind = 'dark'; s = Math.min(s, 0.62); l = Math.min(l, 0.3); }
    // A dark brown spirit (aged rum and coffee liqueur, a molasses-dark rum) is mahogany, not
    // wine: a browner hue, a little less chroma, and amber light where it runs thin (below).
    if (kind === 'dark' && h >= 4 && h <= 40 && !/oxblood|garnet|ruby|crimson|scarlet|wine|cherry|plum|\bred\b/.test(w)) { h = Math.max(h, 18); s = Math.min(s, 0.56); mahogany = true; }
    // The painter's hand: one amber leans honey, the next tangerine or copper (a few degrees).
    // (The spec may widen this to a deliberate tilt: red-copper or honey-gold, see artspec.js.)
    // A tilt never argues with the color word: an oxblood or a red is not turned gold, and a
    // honey or a gold only leans half as far toward copper.
    if (kind === 'color' && h >= 15 && h <= 55) {
      const redWord = /oxblood|garnet|ruby|crimson|scarlet|\bred\b/.test(w), goldWord = /gold|honey|yellow|butter|straw/.test(w);
      const t = Math.max(-13, Math.min(13, shift)) * (shift > 0 && redWord ? 0 : shift < 0 && goldWord ? 0.5 : 1);
      h = t > 0 ? Math.min(Math.max(h, 50), h + t) : h + t;
    }
  }
  const T = TONES[kind], S = x => Math.min(0.95, Math.max(0, x)), pale = kind === 'cream' || kind === 'milky' || kind === 'cafe';
  // The graded wash, top to bottom: lighter where light comes through the surface, deeper down
  // the glass, as a longer path through the drink is. A warm drink also turns a little: honey-gold
  // at the surface, red-copper at the foot (each zone a few degrees on, so the glazes between
  // them stay clean).
  const amberBand = kind !== 'cafe' && h >= 12 && h <= 58;
  const zl = amberBand ? T.zone : 0, up = d => Math.min(h + d, Math.max(h, 54));
  // (a pale honey or pale gold deepens less: at full depth it would turn tangerine at the foot)
  const soft = kind === 'color' && l >= 0.72 ? 0.6 : 1, dk = 1 - (1 - T.deep) * soft, fk = 1 - (1 - T.foot) * soft;
  // A named hue (turquoise, lagoon teal) keeps its tints and blooms within a few degrees of it,
  // greener toward the light, a shade bluer in the depths.
  const keep = named ? (x, k) => toward(x, h, k) : x => x;
  const tones = {
    surf: hslHex(up(zl), S(s * T.surfS), l + (1 - l) * T.lift),
    body: hslHex(h, s, l),
    deep: hslHex(h - zl * 0.6, S(s + 0.04), l * dk),
    foot: hslHex(h - zl, S(s + 0.06), l * dk * fk),
    // tints charged wet-in-wet: toward gold under the surface, the other way pooled at the foot
    glow: hslHex(keep(lean(h, T.lean), 6), S(s), Math.max(l, pale ? 0.8 : 0.62)),
    warm: hslHex(keep(lean(h, kind === 'dark' ? -5 : -T.lean), 4), S(s + (pale ? 0 : 0.05)), Math.max(0.28, Math.min(l, pale ? 0.8 : 0.55))),
  };
  // Mahogany: light through a dark spirit is amber where the path is short (at the meniscus and
  // down the walls of the glass), deep brown through the heart of it, never turning to wine.
  if (mahogany) Object.assign(tones, {
    surf: hslHex(h + 8, S(s * 1.25), l + (1 - l) * 0.17), deep: hslHex(h, S(s + 0.03), l * dk), foot: hslHex(h - 2, S(s + 0.05), l * dk * fk),
    glow: hslHex(h + 16, S(s * 1.2), 0.56), warm: hslHex(h + 2, S(s), Math.max(0.24, l * 0.9)),
  });
  // two analogous blooms, honey-gold and red-copper in a warm drink
  const bl = pale ? Math.max(l, 0.8) : Math.max(0.5, Math.min(0.7, l + 0.1));
  const spread = named ? Math.min(T.spread, 6) : T.spread;
  return finish(kind, tones, [hslHex(amberBand ? up(spread) : h - (named ? spread : -spread), s, bl), hslHex(h + (named ? spread * 0.6 : -spread), S(s + (pale ? 0 : 0.04)), pale ? bl : bl - 0.06)]);
}
// How each kind of drink is graded: how far the surface leans toward gold and lifts toward the
// light, how much deeper the depths and the foot go, the blooms' hue spread, the bloom strength
// and how much the pigment granulates, and how far a warm drink's zones turn (honey at the top,
// copper at the foot). A cream barely deepens (stacked cream turns to caramel); a creamy body is
// laid flat and even, like gouache; a dark spirit keeps an amber glow over garnet depths.
const TONES = {
  clear: { lean: 0, surfS: 1, lift: 0, deep: 1, foot: 1, spread: 0, tint: 0.5, grain: 0.1, zone: 0 },
  cream: { lean: 3, surfS: 0.9, lift: 0.45, deep: 0.965, foot: 0.97, spread: 6, tint: 0.2, grain: 0.07, zone: 0 },
  milky: { lean: 4, surfS: 0.95, lift: 0.3, deep: 0.95, foot: 0.96, spread: 6, tint: 0.25, grain: 0.08, zone: 2 },
  cafe: { lean: 3, surfS: 0.95, lift: 0.3, deep: 0.94, foot: 0.95, spread: 4, tint: 0.25, grain: 0.1, zone: 0 },
  color: { lean: 16, surfS: 0.95, lift: 0.42, deep: 0.82, foot: 0.86, spread: 18, tint: 0.7, grain: 0.13, zone: 7 },
  dark: { lean: 16, surfS: 0.95, lift: 0.2, deep: 0.8, foot: 0.85, spread: 12, tint: 0.4, grain: 0.15, zone: 4 },
};
const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => v / 255); };
const rgbHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
// OKLab (Björn Ottosson's perceptual space) and its polar form, for crossfades between two
// paints: a sink fading into a body of another hue walks round the hue circle the short way at
// full chroma (chartreuse, gold, tangerine, ruby: a sunrise) instead of mixing through brown.
const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toGam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
function okLch(hex) {
  const [r, g, b] = rgbOf(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function lchHex([L, C, H]) {
  const A = C * Math.cos(H), B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return rgbHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(toGam));
}
// t of the way from paint a to paint b, the short way round the hue circle (a grey end takes the
// other's hue). `lift` raises the lightness through the middle of the fade: a yellow or orange
// passed through at mid lightness is mustard, and lit it is gold and tangerine.
export function crossfade(a, b, t, lift = 0) {
  const A = okLch(a), B = okLch(b);
  if (A[1] < 0.02) A[2] = B[2];
  if (B[1] < 0.02) B[2] = A[2];
  let d = B[2] - A[2];
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return lchHex([A[0] + (B[0] - A[0]) * t + lift * Math.sin(Math.PI * t), A[1] + (B[1] - A[1]) * t, A[2] + d * t]);
}
// How far apart two paints' hues are, in degrees (0-180).
export const hueGap = (a, b) => { const d = Math.abs(hexHsl(a)[0] - hexHsl(b)[0]) % 360; return d > 180 ? 360 - d : d; };
// A wash is a stack of deformed layers multiplied onto white (artrender.js); where they all
// overlap, about 0.95 of them, each multiplies by 1 - alpha * (1 - c). A glaze over a tone is
// the ratio that turns it into the next tone, and the pigment to load is that ratio inverted per
// channel at the wash's alpha (raised when the ratio needs more pigment than the brush holds,
// so the tone is reached rather than clipped into another hue). The drink's glazes use fewer,
// stronger layers than the default 22: on an 8-bit canvas a glaze spread over 22 faint layers
// rounds away in its palest channels, and a cream turns lemon.
export const GLAZE_LAYERS = 9;
const OVERLAP = GLAZE_LAYERS * 0.95;
export function glaze(target, under, alpha) {
  const t = rgbOf(target), u = rgbOf(under);
  const k = t.map((c, i) => Math.pow(Math.max(1e-4, Math.min(1, u[i] > 0.004 ? c / u[i] : 1)), 1 / OVERLAP));
  const a = Math.min(0.5, Math.max(alpha, ...k.map(x => (1 - x) / 0.97)));
  return { color: rgbHex(k.map(x => 1 - (1 - x) / a)), alpha: a };
}
export const washFactor = (load, alpha) => rgbOf(load).map(c => Math.pow(1 - alpha * (1 - c), OVERLAP));
function finish(kind, tones, blooms) {
  const T = TONES[kind];
  return { kind, ...tones, blooms, glaze: { tint: T.tint, grain: T.grain } };
}

// Light crosses more drink where the glass is wide or tall: the same drink reads paler in a
// shallow coupe and deeper down a chimney or in the belly of a snifter (presentation.md §3.1).
const DEPTH = { coupe: 0.7, 'nick-nora': 0.7, 'cocktail-glass': 0.7, flute: 0.75 };
const BULGE = ['snifter', 'hurricane', 'poco-grande', 'goblet', 'tulip', 'punch-bowl', 'pearl-diver'];

// The paints one drink is laid with (liquid() below; also what the review tools measure): the
// body's graded pigment and each visible layer's own color. The spec may pass a `tilt`, the
// drink's own secondary colors (artspec.js paintTilt): a hue shift for an amber or copper body,
// toward red-copper or honey-gold, a `foot` paint (a grenadine or hibiscus garnet) charged into
// the depths and a `top` paint (passion-fruit gold) into the light under the surface, each with
// its strength (footK, topK). Without one the painter's hand turns a few degrees by seed.
export function drinkPaint({ color = PALETTE.butter, body = null, layers = [], frost = false, crownOnIce = false, seed = 7, neon = false, word = '', creamy = null, cafe = null, tilt = null } = {}) {
  const shift = tilt && Number.isFinite(tilt.shift) ? tilt.shift : ((((seed >>> 0) * 2654435761) >>> 0) % 13) - 6;
  const bodyHex = body && okHex(body.hex) ? body.hex : color;
  const bodyOp = body && Number.isFinite(body.opacity) ? body.opacity : 0.3;
  const P = pigment(bodyHex, { opacity: bodyOp, clarity: body && Number.isFinite(body.clarity) ? body.clarity : 0.5, neon, word, shift, creamy, cafe });
  // A warm drink's secondary colors: only in a drink that shows color through it (not a cream).
  // (a pale drink, a frappé or a pale honey, keeps its pale foot: a garnet there would be a sink)
  const [bh, , bl] = hexHsl(P.body), warm = (P.kind === 'color' || P.kind === 'dark') && (bh <= 72 || bh >= 340) && bl <= 0.7;
  if (tilt && warm) {
    const fk = Math.max(0, Math.min(0.7, tilt.footK || 0)), tk = Math.max(0, Math.min(0.7, tilt.topK || 0));
    if (okHex(tilt.foot) && fk) {
      P.foot = crossfade(P.foot, tilt.foot, fk); P.deep = crossfade(P.deep, tilt.foot, fk * 0.45);
      P.warm = crossfade(P.warm, tilt.foot, fk * 0.7); P.blooms = [P.blooms[0], crossfade(P.blooms[1], tilt.foot, fk * 0.5)];
    }
    if (okHex(tilt.top) && tk) {
      P.glow = crossfade(P.glow, tilt.top, tk); P.surf = crossfade(P.surf, tilt.top, tk * 0.4);
      P.blooms = [crossfade(P.blooms[0], tilt.top, tk * 0.6), P.blooms[1]];
    }
  }
  // A shaken, stirred or blended drink is one color in the glass: ¼ oz of grenadine shaken into
  // six ounces does not settle. Unless something has sunk, every tone stays within a few degrees
  // of the drink's own hue (the foot, the depths and the warm charge at most 8 degrees off it,
  // the light under the surface 6, the body itself 4, the blooms 10) and the glass gets its
  // depth from value and saturation instead: a copper's foot is a deeper copper or a
  // garnet-brown, never a scarlet; a honeyed amber in a coupe is a lighter amber, never lemon.
  const even = !layers.some(x => x.kind === 'sink');
  if (even && P.kind !== 'clear') {
    const h0 = hexHsl(pigment(bodyHex, { opacity: bodyOp, clarity: body && Number.isFinite(body.clarity) ? body.clarity : 0.5, neon, word, shift: 0, creamy, cafe }).body)[0];
    const near = (hex, k) => { const [h, s, l] = hexHsl(hex); return hslHex(toward(h, h0, k), s, l); };
    P.body = near(P.body, 4);
    for (const key of ['deep', 'foot', 'warm']) P[key] = near(P[key], 8);
    // (and a warm drink's depths never lean golder than its own hue: a gold or ochre taken dark
    // is olive-brown, where a copper taken dark is still a glowing garnet-brown)
    if (h0 >= 10 && h0 <= 60) for (const key of ['deep', 'foot', 'warm']) { const [h, s, l] = hexHsl(P[key]); if (((h - h0 + 540) % 360) - 180 > -2) P[key] = hslHex(h0 - 2, s, l); }
    // (a dark spirit's light is amber where it runs thin: its surface may turn further)
    for (const key of ['surf', 'glow']) P[key] = near(P[key], P.kind === 'dark' ? 16 : 6);
    P.blooms = P.blooms.map(b => near(b, 10));
    // A pale drink (ginger beer, a pale honey, a pale gold) stays pale all the way down: its
    // depths only a little deeper than its body, never a saturated tangerine at the foot; a
    // mid-light amber deepens a step, a copper or darker the full way.
    // (a red carrier shaken through a copper does not settle as a red foot: its depths go a
    // dark garnet-brown, the red showing only as warmth in the shadow)
    if (tilt && warm && okHex(tilt.foot) && tilt.footK) {
      const lb0 = hexHsl(P.body)[2];
      for (const [key, k, sMax] of [['foot', 0.6, 0.7], ['deep', 0.8, 0.78], ['warm', 0.88, 0.78]]) { const [h, s, l] = hexHsl(P[key]); P[key] = hslHex(h, Math.min(s, sMax), Math.min(l, lb0 * k)); }
    }
    const [, sb, lb] = hexHsl(P.body), pale = lb >= 0.7 || (lb >= 0.55 && /\bpale\b/.test(bodyWord(word)));
    const steps = pale ? [0.05, 0.08, 0.1] : lb >= 0.55 ? [0.08, 0.14, 0.12] : null;
    if (steps) ['deep', 'foot', 'warm'].forEach((key, k) => {
      const [h, s, l] = hexHsl(P[key]);
      P[key] = hslHex(pale ? toward(h, h0, 5) : h, Math.min(s, sb + (pale ? 0 : 0.03)), Math.max(l, lb - steps[k]));
    });
  }
  // A frosted glass veils the drink, a third less color showing.
  const vc = c => frost ? mixHex(c, PALETTE.paper, 0.3) : c;
  const shown = layers.filter(x => okHex(x.hex) && !(crownOnIce && x.kind === 'crown'))
    .map(x => ({ ...x, paint: vc(x.kind === 'foam' ? pigment(x.hex, { opacity: 1 }).surf : pigment(x.hex, { opacity: 1, layer: x.kind === 'sink' || x.kind === 'crown' }).body) }));
  return { P, shift, bodyOp, vc, shown };
}

// The drink itself, painted from its computed look (web/lib/optics.js) as a graded watercolor:
// a light, bright wash of the whole body (light through the drink), the body color glazed over
// it from a little under the surface, the depths glazed deeper and warmer toward the foot, and a
// couple of analogous blooms, all leaving a narrow streak of transmitted light where the glazes
// part. Whatever the build leaves in layers is then laid as a few overlapping washes of falling
// strength, so it bleeds into the body wet-in-wet: a float on top, a pale froth. A sink is its
// own layer of color: the body's glazes stop just above it, a short crossfade walks from the
// body's foot to the syrup round the hue circle, and plumes of it rise into the drink glazed
// toward it (never a dark syrup multiplied through a body of another hue, which is mud). Opaque
// mugs show only the surface. A bitters crown sits on the ice, so it is painted by its own part
// (garnish.bitters-crown) when there is a heap.
// A glaze step whose load sits far round the hue circle from its target (turning a scarlet into
// a garnet takes a blue load: the red channel must fall faster than the others) is exact only
// over the tone it was mixed for; where its edge wanders onto a lighter tone it stains violet or
// grey. Such a step is laid in the target's own hue instead, as strong as it takes to reach the
// target's lightness over the tone under it: a little more saturated than the exact glaze, never
// off-hue.
const lumOf = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function safeGlaze(target, under, alpha) {
  const g = glaze(target, under, alpha), [gh, gs] = hexHsl(g.color), [th, ts, tl] = hexHsl(target);
  const off = Math.abs(((gh - th + 540) % 360) - 180);
  if (!(gs > 0.25 && ts > 0.25 && off > 75 && lum(under) > lum(target))) return g;
  const load = hslHex(th, Math.min(0.92, ts + 0.05), Math.min(0.75, tl + (1 - tl) * 0.3)), u = rgbOf(under), want = lumOf(rgbOf(target));
  let lo = 0.004, hi = 0.5;
  for (let k = 0; k < 24; k++) { const a = (lo + hi) / 2, f = washFactor(load, a); if (lumOf(u.map((c, i) => c * f[i])) > want) lo = a; else hi = a; }
  return { color: load, alpha: (lo + hi) / 2 };
}

// The inside of a clear glass from just above the surface down to its floor: all the drink may
// stain. (The walls are the ink line's inner edge; the floor dips a little at the front.)
function interior(kind, y0, inward = 1.6, wob = null) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), ys = [];
  for (let y = y0; y < R.bottom; y += 6) ys.push(y);
  ys.push(R.bottom);
  const w = y => Math.max(1, halfAt(G, y) - inward - (wob ? wob(y) : 0)), wb = w(R.bottom);
  return [...ys.map(y => [R.cx - w(y), y]), ...ell(R.cx, R.bottom, wb, wb * 0.12, Math.PI, 0, 12).reverse().slice(1, -1).map(([x, y]) => [x, Math.max(R.bottom, y)]), ...ys.slice().reverse().map(y => [R.cx + w(y), y])];
}

function liquid({ kind = 'collins', fill = 0.84, color = PALETTE.butter, body = null, layers = [], frozen = false, frost = false, shell = 0, crushed = false, crownOnIce = false, froth = false, seed = 7, neon = false, word = '', creamy = null, cafe = null, tilt = null, block = false } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(((seed >>> 0) % 9973) * 13 + 5);
  const strokes = [], washes = [], cover = [];
  let clip = [];
  const { P, bodyOp, vc, shown } = drinkPaint({ color, body, layers, frost, crownOnIce, seed, neon, word, creamy, cafe, tilt });
  const [surf, mid, deep, foot, bloomA, bloomB] = [P.surf, P.body, P.deep, P.foot, ...P.blooms].map(vc);
  // one glaze wash: from the tone under it to this tone (see glaze(), safeGlaze()), optionally
  // held inside its own clip
  const glazed = (pts, target, under, alpha, soft = 1, wclip = null) => { if (pts) { const g = safeGlaze(target, under, alpha); washes.push({ pts, color: g.color, alpha: g.alpha, soft, grain, layers: GLAZE_LAYERS, ...(wclip ? { clip: wclip } : {}) }); } };
  const clearish = P.kind === 'clear' || (body && bodyOp < 0.15 && body.clarity > 0.85);
  const depth = DEPTH[kind] || 1;
  const alphaFor = op => clearish ? 0.034 : (0.05 + 0.03 * Math.min(1, op)) * depth;
  const A = alphaFor(bodyOp), Gz = P.glaze, grain = Gz.grain;
  const topLayer = shown.find(x => x.kind === 'float' || x.kind === 'crown');
  if (G.opaque) {
    // Looking down into a mug: the surface lit at the front, shadowed under the back of the rim.
    const rx = R.hw - 8, ry = rx * R.tilt;
    clip = [ell(R.cx, R.y + 1, R.hw - 3, (R.hw - 3) * R.tilt, 0, TAU, 28)];
    const surface = topLayer ? topLayer.paint : surf;
    if (topLayer) washes.push({ pts: ell(R.cx, R.y + 1, rx, ry, 0, TAU, 18), color: topLayer.paint, alpha: 0.085, soft: 0.5, grain, layers: GLAZE_LAYERS });
    else {
      glazed(ell(R.cx, R.y + 1, rx, ry, 0, TAU, 18), surf, PALETTE.paper, 0.09, 0.5);
      glazed([...ell(R.cx, R.y + 1, rx * 0.96, ry * 0.9, Math.PI, TAU, 12), ...ell(R.cx, R.y - ry * 0.1, rx * 0.8, ry * 0.4, TAU, Math.PI, 10)], mid, surf, 0.07, 0.6);
      washes.push({ pts: ell(R.cx + rx * 0.25, R.y + ry * 0.25, rx * 0.4, ry * 0.45, 0, TAU, 12), color: bloomA, alpha: 0.03, soft: 0.8, grain, layers: GLAZE_LAYERS });
    }
  } else {
    const top = frozen ? R.y + 2 : levelOf(kind, fill);
    const inset = y => Math.max(2, halfAt(G, y) - 4 - shell);
    const bottom = R.bottom - 2 - shell * 0.8;
    const ysFor = (y0, y1) => { const ys = []; for (let y = y0; y < y1; y += 12) ys.push(y); ys.push(y1); return ys; };
    const band = (y0, y1, shrink = 0) => {
      y0 = Math.max(top, y0); y1 = Math.min(bottom, y1);
      if (y1 - y0 < 3) return null;
      const ys = ysFor(y0, y1);
      return [...ys.map(y => [R.cx - inset(y) + shrink, y]), ...ys.slice().reverse().map(y => [R.cx + inset(y) - shrink, y])];
    };
    // A glaze that parts around the streak of transmitted light, a little left of center.
    const LX = -0.42, LW = 0.07;
    const parted = (y0, y1, shrink = 0) => {
      y0 = Math.max(top, y0); y1 = Math.min(bottom, y1);
      if (y1 - y0 < 3) return [];
      const ys = ysFor(y0, y1), gapL = y => R.cx + (LX - LW) * inset(y) - 2, gapR = y => R.cx + (LX + LW) * inset(y) + 2;
      const left = [...ys.map(y => [R.cx - inset(y) + shrink, y]), ...ys.slice().reverse().map(y => [Math.max(R.cx - inset(y) + shrink + 2, gapL(y)), y])];
      const right = [...ys.map(y => [gapR(y), y]), ...ys.slice().reverse().map(y => [R.cx + inset(y) - shrink, y])];
      return inset((y0 + y1) / 2) > 26 ? [left, right] : [band(y0, y1, shrink)];
    };
    const h = R.bottom - top;
    // A sink settles in its own color: the body is painted down to a floor just above it.
    const sink = shown.find(x => x.kind === 'sink');
    const sT = sink ? Math.min(0.4, Math.max(0.05, sink.frac || 0.08)) * h : 0, sX = sink ? Math.max(14, sT * 0.8) : 0;
    const floor = sink ? bottom - sT - sX : bottom;
    // A froth stands on the drink in its own pale color: the body is painted from just under it
    // (a glaze can only darken, so a cream head laid over a gold body would vanish into it).
    const foamL = frozen ? null : shown.find(x => x.kind === 'foam');
    const fT = foamL ? Math.max(14, Math.min(0.1, Math.max(0.05, foamL.frac || 0.06)) * h * 1.5) : 0, bt = top + fT;
    // (an opaque fruit body, pineapple and apricot shaken thick, is laid like a creamy one: flat
    // and even under its froth, not a see-through wash with a streak of light and blooms in it)
    const opaqueFruit = P.kind === 'color' && bodyOp >= 0.85 && !sink, tintK = opaqueFruit ? 0.4 : 1;
    // 1. light through the whole drink
    if (!clearish) {
      // 1. light through the whole drink; 2. the body color from just under the surface;
      // 3. the depths, deeper and warmer; 4. the foot
      // A creamy body is opaque: no light comes through it, so no streak; it is laid flat and
      // even, like gouache, with only a little shading toward the foot.
      const dark = P.kind === 'dark', flat = P.kind === 'milky' || P.kind === 'cafe' || (P.kind === 'cream' && bodyOp >= 0.85) || opaqueFruit;
      const part = flat ? (y0, y1, k) => [band(y0, y1, k)] : parted;
      const fall = UP_KINDS.includes(kind) || dark ? 0.08 : flat ? 0.06 : 0.16, deepFrom = dark ? 0.4 : flat ? 0.6 : BULGE.includes(kind) ? 0.45 : UP_KINDS.includes(kind) ? 0.4 : 0.55;
      const hb = floor - bt;
      glazed(band(bt, floor), surf, PALETTE.paper, A * (crushed ? 0.94 : 1));
      // (a dark spirit's heart stops short of the walls, where the light comes through it amber)
      // (laid as its own brown over the amber, not as the glaze that turns amber into brown:
      // that ratio is mostly blue, and where the wash wandered past the amber it showed violet)
      const wall = dark ? 5 : 0, fl = floor - wall;
      for (const pts of part(bt + hb * fall, fl, 1 + wall)) glazed(pts, mid, dark ? PALETTE.paper : surf, A * 0.6, 0.9);
      for (const pts of part(bt + hb * deepFrom, fl - wall * 0.5, 3 + wall * 1.6)) glazed(pts, deep, mid, A * 0.5, 0.9);
      glazed(band(floor - hb * 0.16, fl - wall, 5 + wall * 1.6), foot, deep, A * 0.4, 0.9);
      const up = band(bt, bt + hb * 0.4, 6), low = band(floor - hb * 0.32, floor, 6);
      if (up) washes.push({ pts: up, color: vc(P.glow), alpha: A * Gz.tint * tintK, soft: 1, grain, layers: GLAZE_LAYERS });
      if (low) washes.push({ pts: low, color: vc(P.warm), alpha: A * Gz.tint * 0.8 * tintK, soft: 1, grain, layers: GLAZE_LAYERS });
    } else {
      // a clear drink: a cool sparkle, a little deeper toward the foot
      glazed(band(bt, floor), mid, PALETTE.paper, A);
      glazed(band(bt + (floor - bt) * 0.5, floor, 4), foot, mid, 0.018, 0.9);
    }
    // 4. analogous blooms, wet into wet
    const nb = h < 60 ? 1 : 3;
    for (let i = 0; i < nb; i++) {
      const cy = top + h * (0.22 + 0.6 * ((i + r() * 0.8) / nb)), w = inset(cy);
      if (w < 10) continue;
      const cx = R.cx + (r() * 2 - 1) * w * 0.4, rx = w * (0.35 + r() * 0.25), ry = Math.min(h * 0.16, rx * (0.7 + r() * 0.5));
      const pts = ell(cx, cy, rx, ry, 0, TAU, 14).map(([x, y]) => { const yy = Math.max(bt + 3, Math.min(floor - 2, y)), ww = inset(yy) - 3; return [Math.max(R.cx - ww, Math.min(R.cx + ww, x)), yy]; });
      washes.push({ pts, color: i % 2 ? bloomB : bloomA, alpha: clearish ? 0.03 : A * Gz.tint * tintK, soft: 0.9, grain, layers: GLAZE_LAYERS });
    }
    for (const L of shown) {
      // A near-black float (black rum) reads as a dark, smoky cloud rather than ink.
      // A float is never thinner than a finger's width of dark rum (a thin one still shows), and
      // under a heap of crushed ice it shows below the cap, where it bleeds into the drink.
      const a = alphaFor(L.opacity) * (L.kind === 'float' ? (crushed ? 1.9 : 1.35) * (0.5 + 0.5 * lum(L.paint)) : 1.35);
      const t = (L.kind === 'float' ? Math.min(0.2, Math.max(crushed ? 0.15 : 0.11, L.frac || 0.08)) : Math.min(0.4, Math.max(0.05, L.frac || 0.08))) * h;
      if (L.kind === 'sink' && L === sink) {
        // The syrup on the floor of the glass, its own color on the paper: a short crossfade
        // from the body's foot (abutting strips, so no seam doubles up), the settled layer, and
        // its depths a shade darker at the very bottom.
        // The strips share wavy edges, so they interlock like wet paint running together rather
        // than stacking as stripes.
        // A syrup far round the hue circle from the body (a ruby hibiscus under a chartreuse
        // melon) passes through only one in-between color, thin and wet into wet, so the glass
        // never stacks as a flag of stripes; the ruby blooms up into it at its edge.
        const far = hueGap(foot, L.paint) > 75;
        const sa = Math.max(A, 0.06), n = far ? 2 : 4, y1 = bottom - sT, ph = r() * TAU;
        const edge = (yb, k) => {
          const amp = k === 0 ? 1 : Math.min(far ? 7 : 5, (y1 - floor) / n * 0.7), pts = [];
          for (let x = R.cx - inset(yb); x <= R.cx + inset(yb) + 0.1; x += Math.max(4, inset(yb) / 8)) {
            const y = Math.max(top, Math.min(bottom, yb + amp * (Math.sin((x - R.cx) * 0.085 + ph + k * 1.9) + 0.5 * Math.sin((x - R.cx) * 0.21 + ph * 1.3 + k * 2.7))));
            pts.push([Math.max(R.cx - inset(y), Math.min(R.cx + inset(y), x)), y]);
          }
          return pts;
        };
        const ys = far ? [floor, floor + (y1 - floor) * 0.5, y1 + 2] : [floor, ...[1, 2, 3].map(k => floor + (y1 - floor) * k / n), y1 + 2];
        // (where two deep strips meet they reach 3 units past the shared edge, since a wash wanders
        // a little and paper between them reads as a crack; where either is light they only just
        // meet, since a light yellow doubled over its neighbor darkens to olive. The first strip
        // carries the body's own foot down to meet the crossfade, so where it touches the body it
        // doubles a color with itself, never a complement.)
        const cols = [...[...Array(n).keys()].map(k => crossfade(foot, L.paint, k / n, 0.1)), L.paint];
        // (across the one wide step of a far sink, lime to gold, they do not overlap at all: the
        // two doubled are olive, and the wet edge closes the hairline between them)
        const lap = k => k > 0 && k <= n && lum(cols[k]) < 0.5 && lum(cols[k - 1]) < 0.5 ? 3 : far ? 0 : 0.5;
        const strip = (k, last) => { const a = edge(ys[k], k).map(([x, y]) => [x, y - (k ? lap(k) : 0)]), b = last ? [[R.cx + inset(bottom), bottom], [R.cx - inset(bottom), bottom]] : edge(ys[k + 1], k + 1).reverse().map(([x, y]) => [x, y + lap(k + 1)]); return [...a, ...b]; };
        for (let k = 0; k <= n; k++) glazed(strip(k, k === n), cols[k], PALETTE.paper, sa, far ? 0.95 : 0.7);
        if (far) {
          // the ruby blooming up into the in-between color: soft rounded tongues that stop short
          // of the body's own color (a ruby over a chartreuse would be olive)
          const reach = (y1 - ys[1]) * 0.9, tongue = crossfade(cols[1], L.paint, 0.5, 0.12);
          for (let i = 0; i < 4; i++) {
            const cx = R.cx + ((i + 0.5) / 4 - 0.5) * 1.3 * inset(y1) + (r() - 0.5) * 8, rw = 6 + r() * 6, lh = reach * (0.5 + r() * 0.5), pts = [];
            for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; pts.push([cx + Math.cos(a) * rw, y1 + 3 + Math.sin(a) * lh]); }
            // (laid as a plain wash of a red half way to the syrup: over the gold it is a lit
            // scarlet, over the ruby a deeper ruby, never the violet a glaze ratio would leave)
            washes.push({ pts: pts.map(([x, y]) => [Math.max(R.cx - inset(y) + 3, Math.min(R.cx + inset(y) - 3, x)), y]), color: tongue, alpha: sa * 0.45, soft: 0.8 });
          }
        }
        const [sh, ss, sl] = hexHsl(L.paint);
        glazed(band(bottom - sT * 0.45, bottom, 3), hslHex(sh, ss, sl * 0.82), L.paint, sa * 0.6, 0.8);
        // the mixing zone: plumes of the syrup rising and opening into the drink, glazed toward
        // the syrup only as far as stays within reach of the body's own hue (no mud)
        // (a syrup far round the hue circle from the body sends no plumes into it: a glaze can
        // only darken, and part way between two complements is olive or mud)
        const gap = hueGap(deep, L.paint), reachK = Math.min(0.55, 55 / Math.max(1, gap));
        for (let i = 0; i < (gap <= 75 ? 4 : 0); i++) {
          const y0 = floor + sX * 0.5, w0 = inset(y0), x0 = R.cx + ((i + 0.5) / 4 - 0.5) * 1.3 * w0, len = sX * 0.5 + t * (0.9 + r() * 0.8), Lp = [], Rp = [];
          for (let k = 0; k <= 6; k++) { const u = k / 6, y = y0 - u * len, w = 3 + 8 * Math.pow(u, 1.4), x = Math.max(R.cx - inset(y) + w, Math.min(R.cx + inset(y) - w, x0 + Math.sin(u * 4 + i * 2) * 5)); Lp.push([x - w, y]); Rp.push([x + w, y]); }
          const under = i % 2 ? deep : foot;
          glazed([...Lp, ...Rp.reverse()], crossfade(under, L.paint, reachK * (i % 2 ? 0.7 : 1)), under, A * 0.5, 0.7);
        }
      } else if (L.kind === 'float' || L.kind === 'crown') {
        // Strongest at the surface, bleeding down into the body.
        const reach = L.kind === 'crown' ? 1.8 : 1.5;
        [[top + t * reach, 0.3], [top + t, 0.6], [top + t * 0.55, 1]].forEach(([y1, k], i) => {
          const pts = band(top, y1, i * 2);
          if (pts) washes.push({ pts, color: L.paint, alpha: a * k * (frozen ? 0.6 : 1), soft: 0.8 });
        });
        // A float poured on a tall drink bleeds down in tendrils: the Dark 'n Stormy's storm.
        if (L.kind === 'float' && !frozen && ((L.frac || 0) >= 0.1 || crushed)) for (let i = 0; i < 4; i++) {
          const x0 = R.cx + ((i + 0.5) / 4 - 0.5) * 1.3 * inset(top + t), len = t * (0.9 + ((i * 37) % 10) / 12), Lp = [], Rp = [];
          for (let k = 0; k <= 6; k++) { const u = k / 6, y = top + t * 0.6 + u * len, w = 6 * (1 - u) + 1, x = x0 + Math.sin(u * 4 + i * 2) * 4; Lp.push([x - w, y]); Rp.push([x + w, y]); }
          washes.push({ pts: [...Lp, ...Rp.reverse()], color: L.paint, alpha: a * 0.7, soft: 0.6 });
        }
      } else if (L.kind === 'foam' && !frozen) {
        // A pale head on the paper, with a soft lower edge where it meets the drink: a little of
        // the drink's own light charged into its foot, wet into wet.
        glazed(band(top, bt + 2), mixHex(L.paint, surf, 0.12), PALETTE.paper, 0.04, 0.5);
        glazed(band(bt - 5, bt + 3), mixHex(L.paint, surf, 0.5), PALETTE.paper, 0.035, 0.6);
        strokes.push({ pts: ell(R.cx, bt, inset(bt) * 0.9, inset(bt) * G.rimTilt * 0.8, 0.3, Math.PI - 0.3, 16), tier: 3 });
      }
    }
    if (!frozen) strokes.push({ pts: ell(R.cx, top, inset(top), inset(top) * G.rimTilt, 0.15, Math.PI - 0.15, 20), tier: 3 });
    // A shaken drink served up wears a thin line of froth just under the surface.
    if (froth && !frozen && !shown.some(x => x.kind === 'foam')) strokes.push({ pts: ell(R.cx, top + 4, inset(top + 4) * 0.94, inset(top + 4) * G.rimTilt * 0.9, 0.35, Math.PI - 0.35, 16), tier: 3 });
  }
  if (frozen) {
    // A matte, slushy dome above the rim: no pebbles, lighter where the light catches its crown.
    const dome = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, x = R.cx - R.hw * 0.96 + u * R.hw * 1.92;
      dome.push([x, R.y - Math.sin(Math.PI * u) * 34 - (i % 2 ? 3 : 0)]);
    }
    const poly = [...dome, ...ell(R.cx, R.y + 2, R.hw * 0.94, R.hw * 0.94 * R.tilt, 0, Math.PI, 14)];
    strokes.push({ pts: dome, tier: 1 });
    // fine crystals in the slush
    for (let i = 0; i < 12; i++) { const u = 0.12 + ((i * 0.618) % 1) * 0.76, x = R.cx - R.hw * 0.96 + u * R.hw * 1.92; strokes.push({ pts: ell(x, R.y - Math.sin(Math.PI * u) * 34 * (0.3 + ((i * 0.37) % 1) * 0.55), 1.2, 0.9, 0, TAU, 6), tier: 3 }); }
    const ad = alphaFor(Math.max(bodyOp, 0.5)), am = alphaFor(bodyOp) * 0.4;
    glazed(poly, surf, PALETTE.paper, ad, 0.6);
    glazed([...ell(R.cx, R.y + 2, R.hw * 0.9, R.hw * 0.9 * R.tilt, 0, Math.PI, 10), ...dome.slice(2, 11).reverse().map(([x, y]) => [x, y + 16])], mid, surf, am, 0.8);
    cover.push(poly);
    // A float on a frozen drink pools on the dome and runs down its sides.
    const fl = shown.find(x => x.kind === 'float');
    if (fl) {
      const pool = dome.slice(3, 10).map(([x, y]) => [x, y + 2]);
      washes.push({ pts: [...pool, ...pool.slice().reverse().map(([x, y]) => [x, y + 12])], color: fl.paint, alpha: 0.07, soft: 0.6 });
      for (const k of [0.35, 0.62]) { const x = R.cx - R.hw + k * 2 * R.hw; washes.push({ pts: [[x - 4, R.y - 20], [x + 4, R.y - 20], [x + 1.5, R.y + 14], [x - 1, R.y + 14]], color: fl.paint, alpha: 0.06, soft: 0.4 }); }
    }
  }
  // glazed: the renderer composites these washes as exact glazes (artrender.js glazeLayer)
  return { box: [300, 460], strokes, washes: washes.filter(w => w.pts), cover, glazed: true };
}

function pebble(x, y, s, r, round = false) {
  const n = round ? 7 : 5 + Math.floor(r() * 2), a0 = r() * TAU, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * TAU, k = i === n ? 1 : round ? 0.92 + r() * 0.12 : 0.75 + r() * 0.45;
    pts.push(i === n ? pts[0].slice() : [x + Math.cos(a) * s * k, y + Math.sin(a) * s * k * 0.85]);
  }
  return pts;
}

// A cap soaked from above (a bitters crown, a dark float): strongest on top, mottled, with
// tendrils running down through the ice into the top of the drink.
function soakWashes(kind, M, hex, r, { cap = 0.07, reach = 0.18, tendrils = 5, opaque = false } = {}) {
  const R = rimOf(kind), G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, washes = [];
  if (M.lift) {
    washes.push({ pts: M.poly, color: hex, alpha: cap * 0.8, soft: 0.6 });
    const crest = M.top.slice(1, -1);
    washes.push({ pts: [...crest, ...crest.slice().reverse().map(([x, y]) => [x, Math.min(R.y + 2, y + 12)])], color: hex, alpha: cap, soft: 0.5 });
  }
  if (opaque || G.opaque) return washes;
  const h = R.bottom - R.y, depth = reach * h;
  const inset = y => halfAt(G, y) - 6;
  washes.push({ pts: [[R.cx - inset(R.y + 2), R.y + 2], [R.cx + inset(R.y + 2), R.y + 2], [R.cx + inset(R.y + depth * 0.5), R.y + depth * 0.5], [R.cx - inset(R.y + depth * 0.5), R.y + depth * 0.5]], color: hex, alpha: cap * 0.6, soft: 0.8 });
  for (let i = 0; i < tendrils; i++) {
    const y0 = R.y + 4, len = depth * (0.55 + r() * 0.6), x0 = R.cx + ((i + 0.5) / tendrils - 0.5) * 1.5 * inset(y0) + (r() - 0.5) * 8;
    const L = [], Rt = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6, y = y0 + u * len, w = 4.5 * (1 - u) + 0.8, x = x0 + Math.sin(u * 5 + i) * 3;
      L.push([x - w, y]); Rt.push([x + w, y]);
    }
    washes.push({ pts: [...L, ...Rt.reverse()], color: hex, alpha: cap * 0.85, soft: 0.5 });
  }
  return washes;
}

// Ice, drawn sparingly: a few outlines suggest the whole glassful. Crushed ice packs the glass
// as white chips with the drink tinting the spaces between them, and heaps above the rim;
// pebble ice is rounder; shaved ice is a smooth snowy dome; an ice cone stands in the middle.
// The one big stirred block in a clear glass: where it stands, its size and its angle, by seed
// (shared with the liquid, which lets the drink show through it as a lighter window). Two pours
// of one prayer get a different block: one squarer and smaller, the next larger and turned.
export function blockCube(kind, fill, seed) {
  const R = rimOf(kind), r = rng(seed), top = levelOf(kind, fill);
  const a = (r() - 0.5) * 0.7, grow = 0.88 + r() * 0.2, dx = (r() - 0.5) * R.hw * 0.16;
  const size = Math.min(R.hw * 1.3, 86) * grow, h = size / 2, x = R.cx + dx, y = top + 6 + h;
  if (y + h > R.bottom - 4) return null;
  const c = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]);
  return { x, y, size, a, c };
}
function ice({ kind = 'collins', style = 'cubed', fill = 0.84, seed = 5, soak = null, tint = null, sunk = false } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed);
  const strokes = [], washes = [], cover = [], dots = [];
  const top = levelOf(kind, fill);
  if (style === 'ice-shell') {
    // Beachcomber's Gold: shaved ice pressed into the bowl and frozen, the drink in the hollow.
    const ys = [];
    for (let y = R.y + 3; y < R.bottom - 2; y += 6) ys.push(y);
    const outerL = ys.map(y => [R.cx - halfAt(G, y) + 2, y]), innerL = ys.map(y => [R.cx - Math.max(0, halfAt(G, y) - 11), Math.min(y + 4, R.bottom - 9)]);
    const inner = [...innerL, ...mir(innerL, R.cx).reverse()];
    strokes.push({ pts: inner, tier: 2 });
    const lining = [...outerL, ...mir(outerL, R.cx).reverse(), ...inner.slice().reverse()];
    washes.push({ pts: [...outerL, ...mir(outerL, R.cx).reverse()], color: PALETTE.ice, alpha: 0.026, soft: 0.5 });
    for (let i = 0; i < 26; i++) { const y = R.y + 4 + r() * (R.bottom - R.y - 8), w = halfAt(G, y), side = r() < 0.5 ? -1 : 1; dots.push({ x: R.cx + side * (w - 3 - r() * 7), y, r: 0.6 + r() * 0.5, tier: 3 }); }
    cover.push(lining);
    return { box: [300, 460], strokes, washes, cover, dots };
  }
  if (style === 'ice-cone') {
    // Navy Grog: a cone of shaved ice frozen round the straw, rising an inch above the rim.
    const coneTop = R.y - 38, wt = Math.min(R.hw * 0.44, 30), foot = G.opaque ? R.y + 6 : R.bottom - 6;
    const wb = G.opaque ? wt * 1.12 : Math.min(R.hw * 0.66, halfAt(G, foot) - 10);
    const L = [[R.cx - wt, coneTop], [R.cx - wb, foot]], Rt = [[R.cx + wt, coneTop], [R.cx + wb, foot]];
    strokes.push({ pts: L, tier: 2 }, { pts: Rt, tier: 2 }, { pts: ell(R.cx, coneTop, wt, wt * 0.24, 0, TAU, 20), tier: 2 });
    if (!G.opaque) strokes.push({ pts: ell(R.cx, foot, wb, wb * G.rimTilt, 0.2, Math.PI - 0.2, 14), tier: 3 });
    const body = [...ell(R.cx, coneTop, wt, wt * 0.24, Math.PI, TAU, 10), [R.cx + wb, foot], [R.cx - wb, foot]];
    // packed snow: paper white, a few soft grain marks, no ice-cube edges
    for (let i = 0; i < 16; i++) { const u = r(), y = coneTop + 10 + u * (foot - coneTop - 16), w = wt + (wb - wt) * u - 6, x = R.cx + (r() * 2 - 1) * w; strokes.push({ pts: ell(x, y, 2.6, 1.1, 0.2, Math.PI - 0.2, 5), tier: 3 }); }
    cover.push(body);
    return { box: [300, 460], strokes, washes, cover, dots };
  }
  if (HEAP.includes(style)) {
    const M = capMound(kind, seed, style);
    if (M.lift) {
      strokes.push({ pts: M.top, tier: 2 });
      if (soak) washes.push(...soakWashes(kind, M, soak.hex, r, { cap: soak.alpha || 0.05, reach: soak.reach || 0.12, tendrils: 3 }));
      // crushed ice glows with the drink it is packed in, palest at the crest
      // (in a mug or bowl the heap is all of the drink there is to see: it takes the drink's own
      // color, with no ice-blue in it, which would grey a copper to mauve)
      else washes.push({ pts: M.poly, color: okHex(tint) ? (G.opaque ? tint : mixHex(tint, PALETTE.ice, 0.3)) : PALETTE.ice, alpha: okHex(tint) ? (G.opaque ? 0.045 : 0.03) : 0.026, soft: 0.6 });
      cover.push(M.poly);
      if (style === 'shaved') for (let i = 0; i < 10; i++) { const x = R.cx + (r() * 2 - 1) * R.hw * 0.75; strokes.push({ pts: ell(x, capYAt(M.top, x) + 5 + r() * Math.max(2, R.y - capYAt(M.top, x) - 4), 2.2, 1, 0, Math.PI, 5), tier: 3 }); }
      else for (let i = 0; i < 6; i++) { const x = R.cx + (r() * 2 - 1) * R.hw * 0.7, y0 = capYAt(M.top, x); strokes.push({ pts: pebble(x, y0 + 6 + r() * Math.max(2, R.y - y0 - 8), 5 + r() * 3, r, style === 'pebble'), tier: 3 }); }
    }
    // In an opaque drink (a colada, a cloudy copper punch) the ice is hidden like a sunk cube:
    // only the chips in the top sliver of the drink show, under the white heap.
    const zone = sunk ? 0.13 * (R.bottom - top) : R.bottom - top - 22;
    if (!G.opaque && style !== 'shaved') {
      // Chips packed down the glass, more toward the top; each keeps the paper white.
      const n0 = kind === 'punch-bowl' ? 16 : Math.round(9 + (R.bottom - top) / 13), n = sunk ? Math.min(5, Math.ceil(n0 * 0.3)) : n0;
      for (let i = 0; i < n; i++) {
        const y = top + 8 + Math.pow(r(), 1.3) * zone, hw = halfAt(G, y) - 13;
        if (hw < 6) continue;
        const P = pebble(R.cx + (r() * 2 - 1) * hw, y, style === 'pebble' ? 6 : 3.5 + r() * 4.5, r, style === 'pebble');
        // the pen catches only the lit edge of most chips
        const k = r();
        strokes.push({ pts: k < 0.35 ? P : P.slice(0, Math.max(3, Math.ceil(P.length * (0.45 + k * 0.3)))), tier: 3 });
        cover.push(P);
      }
    } else if (!G.opaque) {
      // shaved ice: a fine snowy matte with no pieces, a few white flecks in the drink
      for (let i = 0; i < (sunk ? 10 : 40); i++) { const y = top + 6 + r() * (sunk ? zone : R.bottom - top - 12); dots.push({ x: R.cx + (r() * 2 - 1) * (halfAt(G, y) - 8), y, r: 0.7 + r() * 0.9, color: PALETTE.paper, top: true }); }
    }
  } else if ((style === 'cubed' || style === 'block') && (G.opaque || sunk)) {
    // In a mug, a couple of cube corners break the surface; in an opaque or creamy drink the
    // cubes are sunk out of sight but for one corner at the surface.
    const y = G.opaque ? R.y + 2 : top + 2, w = G.opaque ? R.hw : halfAt(G, top) - 6;
    for (const k of style === 'block' ? [0] : sunk ? [0.36] : [-0.32, 0.3]) {
      const x = R.cx + k * w, s = style === 'block' ? (G.opaque ? 24 : Math.min(24, w * 0.4)) : 14;
      const P = [[x - s, y], [x - s * 0.2, y - s * 0.55], [x + s, y - s * 0.3], [x + s * 0.3, y + s * 0.35], [x - s, y]];
      strokes.push({ pts: P, tier: 2 });
      washes.push({ pts: P.slice(0, 4), color: PALETTE.ice, alpha: 0.03, soft: 0.3 });
      cover.push(P.slice(0, 4));
    }
  } else if (style === 'cubed' || style === 'block') {
    const cubes = style === 'block' ? 1 : kind === 'rocks' ? 2 : 3;
    for (let i = 0; i < cubes; i++) {
      const size = style === 'block' ? Math.min(R.hw * 1.3, 86) : Math.min(R.hw * 0.95, 44);
      const y = top + 6 + size / 2 + i * size * 0.95;
      if (y + size / 2 > R.bottom - 4) break;
      const x = R.cx + (i % 2 ? 1 : -1) * R.hw * 0.18 * (cubes > 1 ? 1 : 0), a = (r() - 0.5) * 0.5, h = size / 2;
      const B = style === 'block' ? blockCube(kind, fill, seed) : null;
      if (style === 'block' && !B) break;
      const c = B ? B.c : [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]);
      strokes.push({ pts: c, tier: 2 });
      strokes.push({ pts: [[c[0][0] + (c[1][0] - c[0][0]) * 0.2 + 5, c[0][1] + (c[3][1] - c[0][1]) * 0.2 + 5], [c[0][0] + (c[1][0] - c[0][0]) * 0.2 + 5, c[0][1] + (c[3][1] - c[0][1]) * (style === 'block' ? 0.7 : 0.45) + 5]], tier: 3 });
      // The cube is clear ice in front of the drink: it keeps the paper and only glows with the
      // drink's lightest tone, so the color around it stays vivid instead of greying under it.
      // (A big block in a spirit-forward drink just shows the drink through it.)
      if (style === 'cubed') {
        const inner = c.slice(0, 4);
        if (okHex(tint)) { washes.push({ pts: inner, color: tint, alpha: 0.055, soft: 0.4, grain: 0.08 }); cover.push(inner); }
        else washes.push({ pts: inner, color: PALETTE.ice, alpha: 0.04, soft: 0.3 });
      }
    }
  }
  return { box: [300, 460], strokes, washes, cover, dots };
}

// Angostura dashed over a swizzle: it soaks the ice cap rust-red and bleeds down through the
// top of the drink. With no heap (cubes, a drink served up) it is a band at the surface.
function bittersCrown({ kind = 'collins', hex = '#8c2814', fill = 0.9, seed = 5, style = 'crushed' } = {}) {
  const r = rng(seed * 3 + 1), R = rimOf(kind);
  const M = HEAP.includes(style) ? capMound(kind, seed, style) : { lift: 0, top: [], poly: [] };
  if (M.lift) return { box: [300, 460], strokes: [], washes: soakWashes(kind, M, hex, r, { cap: 0.036, reach: 0.2, tendrils: 6 }) };
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, level = G.opaque ? R.y : levelOf(kind, fill), w = (G.opaque ? R.hw - 8 : halfAt(G, level) - 5);
  return { box: [300, 460], strokes: [], washes: [{ pts: ell(R.cx, level, w, w * R.tilt + 6, 0, TAU, 18), color: hex, alpha: 0.08, soft: 0.6 }] };
}

// Mint pressed into the bottom of a swizzle or a Mojito: bright leaves among the ice.
// (`bits`: mint muddled and then shaken or blended through the drink, so what shows is a few
// torn dark-green fragments suspended in it, not whole leaves on the floor of the glass;
// `frozen` scatters finer flecks all through a blended drink)
function mintLeaves({ kind = 'collins', fill = 0.9, seed = 13, n = 7, zone = 0.22, bits = false, frozen = false } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed), top = levelOf(kind, fill);
  const strokes = [], washes = [];
  if (bits) {
    const y0 = (frozen ? R.y : top) + 14, y1 = R.bottom - 10;
    for (let i = 0; i < n; i++) {
      const y = y0 + ((i + r()) / n) * (y1 - y0), hw = Math.max(4, halfAt(G, y) - 14), x = R.cx + (r() * 2 - 1) * hw;
      const a = r() * TAU, len = frozen ? 4 + r() * 4 : 8 + r() * 5, wid = len * (0.45 + r() * 0.2);
      // a torn bit: half a leaf, its broken edge ragged
      const L = turn(leaf(len, wid, { teeth: !frozen, n: 8 }).map(([px, py], k) => [px, py + (k % 2 ? 0.8 : -0.4)]), a, x, y);
      washes.push({ pts: L, color: MINT_DEEP, alpha: frozen ? 0.1 : 0.09, soft: 0.25 });
      if (!frozen || i % 3 === 0) strokes.push({ pts: L, tier: 3 });
    }
    return { box: [300, 460], strokes, washes };
  }
  const y0 = R.bottom - zone * (R.bottom - top), y1 = R.bottom - 7;
  for (let i = 0; i < n; i++) {
    const y = y0 + 6 + r() * (y1 - y0 - 6), hw = Math.max(4, halfAt(G, y) - 18), x = R.cx + ((i + 0.5) / n * 2 - 1) * hw + (r() - 0.5) * 8;
    const a = r() * TAU, len = 18 + r() * 9, L = turn(leaf(len, 7 + r() * 3, { teeth: true }), a, x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2);
    strokes.push({ pts: L, tier: 2 });
    washes.push({ pts: L, color: PALETTE.mint, alpha: 0.06, soft: 0.4 });
  }
  const band = [[R.cx - halfAt(G, y0) + 5, y0], [R.cx + halfAt(G, y0) - 5, y0], [R.cx + halfAt(G, y1) - 5, y1], [R.cx - halfAt(G, y1) + 5, y1]];
  washes.push({ pts: band, color: PALETTE.mint, alpha: 0.025, soft: 0.6 });
  return { box: [300, 460], strokes, washes };
}

const MINT_DEEP = '#2E6B3C';

// A long citrus spiral lining the glass: front turns in firm ink, back turns faint, the end
// hooked over the rim.
function peelSpiral({ kind = 'collins', citrus = 'orange', turns = 2.5 } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind);
  const color = PEEL[citrus] || PALETTE.orange, y0 = R.bottom - 12, y1 = R.y + 10, w = 6.5, N = 96;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, th = Math.PI / 2 - (1 - u) * turns * TAU, y = y0 + (y1 - y0) * u, rx = halfAt(G, y) - 10;
    pts.push({ x: R.cx + rx * Math.sin(th), y, front: Math.cos(th) > 0 });
  }
  const strokes = [], washes = [];
  let seg = [pts[0]];
  const flush = () => {
    if (seg.length < 2) return;
    const up = seg.map(p => [p.x, p.y - w]), dn = seg.map(p => [p.x, p.y + w]), front = seg[1].front;
    strokes.push({ pts: up, tier: front ? 2 : 3 }, { pts: dn, tier: front ? 2 : 3 });
    washes.push({ pts: [...up, ...dn.reverse()], color, alpha: front ? 0.08 : 0.035, soft: 0.4 });
  };
  for (let i = 1; i < pts.length; i++) { seg.push(pts[i]); if (pts[i].front !== pts[i - 1].front || i === pts.length - 1) { flush(); seg = [pts[i]]; } }
  const e = pts[pts.length - 1], hx = R.cx + R.hw;
  const hook = [[e.x, e.y], [hx - 2, R.y - 6], [hx + 8, R.y - 4], [hx + 12, R.y + 16]];
  strokes.push({ pts: hook.map(([x, y]) => [x, y - w * 0.6]), tier: 1 }, { pts: hook.map(([x, y]) => [x + 5, y + w * 0.6]), tier: 1 });
  washes.push({ pts: [...hook.map(([x, y]) => [x, y - w * 0.6]), ...hook.slice().reverse().map(([x, y]) => [x + 5, y + w * 0.6])], color, alpha: 0.12, soft: 0.3 });
  return { box: [300, 460], strokes, washes };
}

// Frost on a swizzle glass or julep cup: a pale granular veil of white flecks over the outside.
function frost({ kind = 'collins', seed = 17, amount = 1 } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed), dots = [], strokes = [];
  const y0 = R.y + 6, y1 = (G.opaque ? 432 : R.bottom - 4);
  // denser toward the top, where the ice is packed hardest against the glass
  for (let i = 0; i < 170 * amount; i++) {
    const y = y0 + Math.pow(r(), 1.4) * (y1 - y0), w = (G.opaque ? R.hw : halfAt(G, y)) - 3;
    dots.push({ x: R.cx + (r() * 2 - 1) * w, y, r: 0.45 + r() * 0.6, color: PALETTE.paper, top: true });
  }
  // a finger mark wiped through the frost
  if (amount >= 1) { const x = R.cx - R.hw * 0.45, y = y0 + (y1 - y0) * 0.35; strokes.push({ pts: [[x, y], [x + 2, y + 26]], tier: 3 }, { pts: [[x + 7, y - 2], [x + 9, y + 24]], tier: 3 }); }
  return { box: [300, 460], strokes, washes: [], dots };
}

// Condensation beading on a chilled glass: a few droplets, some running, each with a glint.
function beads({ kind = 'coupe', seed = 19, n = 7 } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed), strokes = [], dots = [];
  for (let i = 0; i < n; i++) {
    const y = R.y + 12 + r() * (R.bottom - R.y - 18) * 0.8, w = halfAt(G, y) - 6, x = R.cx + (r() < 0.5 ? -1 : 1) * w * (0.55 + r() * 0.4), s = 1.4 + r() * 1.3;
    strokes.push({ pts: [[x, y - s * 2.2], [x - s, y], [x - s * 0.7, y + s * 0.8], [x, y + s * 1.1], [x + s * 0.7, y + s * 0.8], [x + s, y], [x, y - s * 2.2]], tier: 3 });
    if (i % 3 === 0) strokes.push({ pts: [[x, y - s * 2.6], [x + 0.6, y - s * 2.6 - 8 - r() * 8]], tier: 3 });
    dots.push({ x: x - s * 0.3, y: y - s * 0.2, r: s * 0.35, color: PALETTE.paper, top: true });
  }
  return { box: [300, 460], strokes, dots };
}

function fizz({ kind = 'collins', fill = 0.84, seed = 9 } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed), top = levelOf(kind, fill), strokes = [];
  if (G.opaque) return { box: [300, 460], strokes };
  for (let i = 0; i < 11; i++) {
    const y = top + 10 + r() * (R.bottom - top - 26), hw = halfAt(G, y) - 14, s = 1.6 + r() * 2.2;
    strokes.push({ pts: ell(R.cx + (r() * 2 - 1) * hw, y, s, s, 0, TAU * 1.05, 8), tier: 3 });
  }
  return { box: [300, 460], strokes };
}

function steam({ kind = 'hot-mug' } = {}) {
  const R = rimOf(kind), strokes = [];
  for (let i = 0; i < 3; i++) {
    const x = R.cx + (i - 1) * 22, pts = [];
    for (let k = 0; k <= 6; k++) pts.push([x + Math.sin(k * 1.1 + i) * 6, R.y - 14 - k * 11]);
    strokes.push({ pts, tier: 3 });
  }
  return { box: [300, 460], strokes };
}

// The hollowed pineapple's own leafy crown, set back on the cut top ajar.
function pineappleCrownLid() {
  const collar = [[-30, 0], [-29, -12], [29, -14], [30, -2]];
  const strokes = [{ pts: ell(0, 0, 30, 8, 0.1, Math.PI - 0.1, 16), tier: 1 }, { pts: ell(0, -13, 29, 8, 0, TAU, 20), tier: 2 }, { pts: [[-30, 0], [-29, -12]], tier: 1 }, { pts: [[30, -2], [29, -14]], tier: 1 }];
  const washes = [{ pts: collar, color: PALETTE.ochre, alpha: 0.1, soft: 0.3 }], cover = [[...collar, ...ell(0, 0, 30, 8, 0.1, Math.PI - 0.1, 10)]];
  [-1.1, -0.72, -0.36, 0, 0.34, 0.7, 1.05].forEach((d, i) => {
    const b = blade(64 + (3 - Math.abs(i - 3)) * 16, 6, d > 0 ? -0.05 : 0.05), a = -Math.PI / 2 + d;
    const O = turn(b.outline, a, (i - 3) * 3, -16);
    strokes.push({ pts: O, tier: 1 });
    washes.push({ pts: O, color: '#4E8F66', alpha: 0.08, soft: 0.4 });
    cover.push(O);
  });
  return { box: [130, 130], strokes, washes, cover };
}

// A hand-drawn rounded box, two strokes that overlap at the corners like a pen going round.
function frame({ w = 400, h = 56, r = 16 } = {}) {
  const o = 3;
  const topRight = [[r, 0], [w * 0.5, -1], [w - r, 0], [w - r * 0.3, r * 0.3], [w, r], [w + 1, h * 0.5], [w, h - r], [w - r * 0.3, h - r * 0.3], [w - r + 4, h]];
  const bottomLeft = [[w - r, h + 1], [w * 0.5, h], [r, h + 1], [r * 0.3, h - r * 0.3], [0, h - r], [-1, h * 0.5], [0, r], [r * 0.3, r * 0.3], [r + o * 4, -1]];
  return { box: [w, h], strokes: [{ pts: topRight, tier: 1 }, { pts: bottomLeft, tier: 1 }] };
}

export const CATALOG = {
  'mug.moai': moaiMug, 'idol.ku': kuIdol, 'flower.hibiscus': hibiscus, 'flower.plumeria': plumeria, 'leaf.monstera': monstera,
  'fruit.pineapple': pineapple, 'float.glass': glassFloat, glass, 'glass.front': p => glass({ ...p, front: 'only' }), liquid, ice, fizz, steam, frame, straw, sparkle,
  'glass.frost': frost, 'glass.condensation': beads,
  // garnishes, at real size (38 units to the inch)
  'garnish.mint': mint, 'garnish.herb-sprig': herbSprig, 'garnish.mint-leaves': mintLeaves,
  'garnish.lime-wheel': p => citrusWheel({ r: 38, color: PALETTE.lime, rind: PALETTE.frond, ...p }),
  'garnish.lemon-wheel': p => citrusWheel({ r: 42, color: PALETTE.butter, rind: PALETTE.ochre, ...p }),
  'garnish.orange-wheel': p => citrusWheel({ r: 55, color: PALETTE.orange, rind: '#D9792A', ...p }),
  'garnish.lime-wedge': p => citrusWedge({ len: 66, color: PALETTE.lime, rind: PALETTE.frond, ...p }),
  'garnish.lime-shell': limeShell, 'garnish.lime-coin': limeCoin, 'garnish.flame': flame,
  'garnish.cherry': cherry, 'garnish.pick': fruitPick, 'garnish.morse-pick': morsePick, 'garnish.peel-ring': peelRing, 'garnish.orange-flag': orangeFlag,
  'garnish.pineapple-wedge': pineappleWedge, 'garnish.pineapple-spear': pineappleSpear, 'garnish.pineapple-fronds': pineappleFronds, 'garnish.pineapple-crown-lid': pineappleCrownLid,
  'garnish.orchid': orchid, 'garnish.gardenia': gardenia, 'garnish.edible-flower': edibleFlower, 'garnish.umbrella': umbrella,
  'garnish.cinnamon': cinnamon, 'garnish.back-scratcher': backScratcher, 'garnish.swizzle-stick': swizzleStick, 'garnish.sugarcane': sugarcane,
  'garnish.peel': peel, 'garnish.peel-spiral': peelSpiral, 'garnish.fruit-slice': fruitSlice, 'garnish.whipped-cream': whippedCream,
  'garnish.beans': beans, 'garnish.nutmeg': nutmeg, 'garnish.dust': dust, 'garnish.bitters-crown': bittersCrown,
};
