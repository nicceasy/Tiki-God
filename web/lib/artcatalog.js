// The closed catalog of drawable parts. Every illustration on the Shrine is built only from
// these (see artspec.js), in the spirit of json-render's guardrailed component catalogs.
// Each part returns local-space ink strokes, watercolor washes and ink dots:
//   { box: [w, h], strokes: [{ pts, tier }], washes: [{ pts, color, alpha?, soft? }], dots: [{ x, y, r, tier?, color? }] }
// tier 1 = contour, 2 = inner detail, 3 = faint detail (line hierarchy).
import { ell, rng, TAU } from './ink.js';

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
    washes: [{ pts: body, color: glaze, alpha: 0.05 }],
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

function monstera() {
  const leftEdge = [[100, 30], [70, 22], [38, 38], [20, 76], [22, 122], [44, 160], [78, 182], [100, 188]];
  const rightEdge = mirrorX(leftEdge, 100);
  const cuts = [[[21, 88], [58, 98]], [[27, 126], [64, 124]], [[50, 164], [76, 148]]];
  return {
    box: [200, 200],
    strokes: [
      { pts: leftEdge, tier: 1 }, { pts: rightEdge, tier: 1 },
      { pts: [[100, 30], [99, 80], [100, 130], [100, 186]], tier: 2 },
      ...cuts.map(c => ({ pts: c, tier: 1 })), ...cuts.map(c => ({ pts: mirrorX(c, 100), tier: 1 })),
      { pts: ell(80, 70, 5, 9, 0, TAU, 14), tier: 2 }, { pts: ell(122, 104, 5, 8, 0, TAU, 14), tier: 2 },
      { pts: [[99, 60], [62, 58]], tier: 3 }, { pts: [[100, 110], [140, 108]], tier: 3 }, { pts: [[100, 150], [128, 162]], tier: 3 },
      { pts: [[100, 30], [112, 14], [130, 4]], tier: 1 },
    ],
    washes: [{ pts: [...leftEdge, ...rightEdge.slice().reverse()], color: PALETTE.frond, alpha: 0.05 }],
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

// ---------------------------------------------------------------- garnishes
function mint({ big = false } = {}) {
  const k = big ? 1.25 : 1;
  const strokes = [{ pts: [[35, 90], [36, 62], [34, 30]], tier: 1 }], washes = [];
  [[36, 70, -2.6], [36, 66, -0.5], [35, 48, -2.4], [35, 44, -0.7], [34, 30, -1.6]].forEach(([x, y, a], i) => {
    const leaf = leafShape((24 - i * 1.5) * k, 7.5 * k, x, y, a);
    strokes.push({ pts: leaf, tier: 1 });
    strokes.push({ pts: [leaf[0], leaf[4]], tier: 3 });
    washes.push({ pts: leaf, color: PALETTE.mint, alpha: 0.07, soft: 0.5 });
  });
  return { box: [70, 92], strokes, washes };
}

function citrusWheel({ color = PALETTE.lime } = {}) {
  const strokes = [{ pts: ell(30, 30, 26, 26, 0.3, 0.3 + TAU * 1.03, 30), tier: 1 }, { pts: ell(30, 30, 21, 21, 0, TAU, 26), tier: 2 }];
  for (let i = 0; i < 8; i++) strokes.push({ pts: [[30, 30], polar(30, 30, 19, i * TAU / 8)], tier: 3 });
  return { box: [60, 60], strokes, washes: [{ pts: ell(30, 30, 25, 25, 0, TAU, 18), color, alpha: 0.08, soft: 0.4 }] };
}

function limeShell() {
  return {
    box: [60, 34],
    strokes: [{ pts: ell(30, 16, 24, 6, 0, TAU, 22), tier: 2 }, { pts: [[6, 16], [12, 26], [30, 31], [48, 26], [54, 16]], tier: 1 }],
    washes: [{ pts: [[6, 16], [12, 26], [30, 31], [48, 26], [54, 16]], color: PALETTE.lime, alpha: 0.09, soft: 0.4 }],
  };
}

function cherry() {
  return {
    box: [44, 62],
    strokes: [{ pts: ell(18, 48, 10, 10, -1.2, -1.2 + TAU * 1.04, 20), tier: 1 }, { pts: [[19, 38], [23, 20], [36, 6]], tier: 1 }],
    washes: [{ pts: ell(18, 48, 10, 10, 0, TAU, 14), color: PALETTE.cherry, alpha: 0.11, soft: 0.4 }],
    dots: [{ x: 14, y: 44, r: 2, color: PALETTE.paper }],
  };
}

function orchid() {
  const strokes = [], washes = [];
  for (let i = 0; i < 5; i++) {
    const t = -Math.PI / 2 + i * TAU / 5;
    const p = ell(30 + Math.cos(t) * 13, 30 + Math.sin(t) * 13, 12, 7, 0, TAU, 14, t);
    strokes.push({ pts: p, tier: 1 });
    washes.push({ pts: p, color: PALETTE.orchid, alpha: 0.07, soft: 0.5 });
  }
  return { box: [60, 60], strokes, washes, dots: [{ x: 30, y: 30, r: 3.5, color: PALETTE.butter }] };
}

function umbrella() {
  const tips = [[6, 36], [22, 32], [40, 37], [58, 32], [74, 36]];
  const top = [40, 10];
  const strokes = [
    { pts: [[6, 36], [18, 17], [40, 10], [62, 17], [74, 36]], tier: 1 },
    { pts: [[6, 36], [14, 31], [22, 34], [31, 31], [40, 37], [49, 31], [58, 34], [66, 31], [74, 36]], tier: 2 },
    ...tips.slice(1, -1).map(t => ({ pts: [top, t], tier: 3 })),
    { pts: [[40, 10], [42, 50], [45, 88]], tier: 1 },
  ];
  const cols = [PALETTE.hibiscus, PALETTE.butter, PALETTE.lagoon, PALETTE.orchid];
  const washes = [];
  for (let i = 0; i < tips.length - 1; i++) washes.push({ pts: [top, tips[i], tips[i + 1]], color: cols[i], alpha: 0.08, soft: 0.4 });
  return { box: [80, 90], strokes, washes };
}

function pineappleWedge() {
  const body = [[6, 22], [64, 22], [35, 58]];
  return {
    box: [70, 60],
    strokes: [{ pts: [[6, 22], [35, 58], [64, 22]], tier: 1 }, { pts: [[4, 20], [66, 20]], tier: 1, w: 3 }, { pts: [[30, 20], [24, 4]], tier: 2 }, { pts: [[36, 20], [40, 2]], tier: 2 }, { pts: [[42, 20], [52, 8]], tier: 2 }],
    washes: [{ pts: body, color: PALETTE.butter, alpha: 0.1, soft: 0.4 }, { pts: [[26, 20], [24, 4], [40, 2], [52, 8], [44, 20]], color: PALETTE.frond, alpha: 0.06, soft: 0.4 }],
  };
}

function cinnamon() {
  return {
    box: [24, 84],
    strokes: [{ pts: [[8, 4], [8, 80]], tier: 1 }, { pts: [[16, 4], [16, 80]], tier: 1 }, { pts: ell(12, 4, 4, 2, 0, TAU, 12), tier: 2 }],
    washes: [{ pts: [[8, 4], [16, 4], [16, 80], [8, 80]], color: PALETTE.wood, alpha: 0.08, soft: 0.3 }],
  };
}

function beans() {
  const strokes = [];
  [[10, 12], [26, 8], [42, 13]].forEach(([x, y]) => { strokes.push({ pts: ell(x, y, 6, 4, 0, TAU, 14, 0.3), tier: 1 }); strokes.push({ pts: [[x - 4, y], [x + 4, y]], tier: 2 }); });
  return { box: [52, 22], strokes, washes: [{ pts: [[4, 8], [48, 8], [48, 18], [4, 18]], color: PALETTE.wood, alpha: 0.05, soft: 0.5 }] };
}

function peel() {
  const pts = [];
  for (let i = 0; i < 26; i++) pts.push([12 + Math.cos(i * 0.5) * 8, 4 + i * 2.6]);
  return { box: [26, 74], strokes: [{ pts, tier: 1 }], washes: [{ pts: [[4, 4], [20, 4], [20, 70], [4, 70]], color: PALETTE.orange, alpha: 0.06, soft: 0.8 }] };
}

function straw({ len = 200 } = {}) {
  const washes = [];
  for (let y = 6; y < len - 10; y += 20) washes.push({ pts: [[2, y], [12, y + 4], [12, y + 12], [2, y + 8]], color: PALETTE.hibiscus, alpha: 0.12, soft: 0.2 });
  return { box: [14, len], strokes: [{ pts: [[2, 0], [2, len]], tier: 2 }, { pts: [[12, 0], [12, len]], tier: 2 }, { pts: ell(7, 0, 5, 1.6, 0, TAU, 10), tier: 3 }], washes };
}

function sparkle() {
  const strokes = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    strokes.push({ pts: [polar(30, 34, 12, a), polar(30, 34, 24, a)], tier: 1 });
  }
  return { box: [60, 40], strokes };
}

// ---------------------------------------------------------------- glassware
// Profiles in a 300 × 400 box: [y, half-width] from rim to bottom (shared with the liquid).
export const GLASS_PROFILES = {
  rocks: { pts: [[196, 72], [338, 62]], foot: 'slab', rimTilt: 0.16 },
  highball: { pts: [[96, 48], [346, 42]], foot: 'slab', rimTilt: 0.14 },
  pilsner: { pts: [[90, 58], [190, 46], [320, 28]], foot: 'stem', stemH: 16, footW: 42, rimTilt: 0.14 },
  hurricane: { pts: [[92, 54], [135, 48], [180, 38], [222, 48], [262, 57], [296, 44], [318, 24]], foot: 'stem', stemH: 24, footW: 48, rimTilt: 0.14 },
  coupe: { pts: [[170, 88], [188, 80], [210, 56], [228, 14]], foot: 'stem', stemH: 104, footW: 58, rimTilt: 0.2 },
  snifter: { pts: [[152, 50], [192, 70], [238, 80], [280, 68], [312, 34]], foot: 'stem', stemH: 22, footW: 52, rimTilt: 0.18 },
  bowl: { pts: [[214, 124], [252, 114], [292, 82], [316, 48]], foot: 'stem', stemH: 14, footW: 72, rimTilt: 0.16 },
  mug: { pts: [[150, 68], [346, 68]], foot: 'slab', rimTilt: 0.18 },
};

export function halfAt(G, y) {
  const p = G.pts;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [y0, w0] = p[i], [y1, w1] = p[i + 1];
    if (y >= y0 && y <= y1) return w0 + ((y - y0) / (y1 - y0)) * (w1 - w0);
  }
  return p[p.length - 1][1];
}

function glass({ kind = 'highball' } = {}) {
  const G = GLASS_PROFILES[kind];
  const cx = 150, rimY = G.pts[0][0], bottom = G.pts[G.pts.length - 1];
  const side = s => G.pts.map(([y, w]) => [cx + s * w, y]);
  const rw = G.pts[0][1];
  const strokes = [
    { pts: side(-1), tier: 1 }, { pts: side(1), tier: 1 },
    { pts: ell(cx, rimY, rw, rw * G.rimTilt, 0.04, Math.PI - 0.04, 24), tier: 1 },
    { pts: ell(cx, rimY, rw, rw * G.rimTilt, Math.PI + 0.04, TAU - 0.04, 24), tier: 3 },
  ];
  if (G.foot === 'slab') {
    strokes.push({ pts: ell(cx, bottom[0], bottom[1], bottom[1] * 0.14, 0.05, Math.PI - 0.05, 20), tier: 1 });
    strokes.push({ pts: ell(cx, bottom[0] - 10, bottom[1] * 0.96, bottom[1] * 0.12, 0.2, Math.PI - 0.2, 16), tier: 3 });
  } else {
    strokes.push({ pts: [[cx - 4, bottom[0]], [cx - 3, bottom[0] + G.stemH]], tier: 2 }, { pts: [[cx + 4, bottom[0]], [cx + 3, bottom[0] + G.stemH]], tier: 2 });
    strokes.push({ pts: ell(cx, bottom[0] + G.stemH + 4, G.footW, 6, 0, TAU, 26), tier: 1 });
  }
  // A single highlight flick, like a pen lifting off.
  strokes.push({ pts: [[cx - halfAt(G, rimY + 26) * 0.7, rimY + 26], [cx - halfAt(G, rimY + 70) * 0.72, rimY + 70]], tier: 3 });
  return { box: [300, 400], strokes };
}

export const CATALOG = {
  'mug.moai': moaiMug, 'idol.ku': kuIdol, 'flower.hibiscus': hibiscus, 'flower.plumeria': plumeria, 'leaf.monstera': monstera,
  'fruit.pineapple': pineapple, glass, 'garnish.mint': mint, 'garnish.lime-wheel': p => citrusWheel({ color: PALETTE.lime, ...p }),
  'garnish.orange-wheel': p => citrusWheel({ color: PALETTE.orange, ...p }), 'garnish.lime-shell': limeShell, 'garnish.cherry': cherry,
  'garnish.orchid': orchid, 'garnish.umbrella': umbrella, 'garnish.pineapple-wedge': pineappleWedge, 'garnish.cinnamon': cinnamon,
  'garnish.beans': beans, 'garnish.peel': peel, straw, sparkle,
};
