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
function clearGlass(kind) {
  const G = GLASS_PROFILES[kind], cx = 150;
  const rimY = G.pts[0][0], rw = G.pts[0][1], bottom = G.pts[G.pts.length - 1];
  const side = s => G.pts.map(([y, w]) => [cx + s * w, y]);
  const strokes = [{ pts: side(-1), tier: 1 }, { pts: side(1), tier: 1 }, ...rimStrokes(cx, rimY, rw, G.rimTilt)];
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
      { pts: bodyPoly(left), color: glaze, alpha: 0.034 },
      { pts: [[108, 316], [192, 316], [180, 336], [150, 346], [120, 336]], color: PALETTE.hibiscusDeep, alpha: 0.06, soft: 0.4 },
    ],
    dots: [{ x: 124, y: 252, r: 6 }, { x: 176, y: 252, r: 6 }, { x: 122, y: 249, r: 1.8, color: PALETTE.paper }, { x: 174, y: 249, r: 1.8, color: PALETTE.paper }],
  };
}

function skullMugVessel() {
  const left = [[98, 262], [80, 284], [70, 322], [74, 360], [90, 386], [100, 404], [104, 426], [120, 438], [150, 440]];
  const bone = '#E6D9BD';
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
      { pts: bodyPoly(left), color: bone, alpha: 0.05 },
      { pts: [[222, 292], [258, 316], [261, 346], [236, 388], [214, 392], [238, 374], [248, 330]], color: bone, alpha: 0.05, soft: 0.4 },
      { pts: ell(126, 334, 17, 13, 0, TAU, 14), color: PALETTE.wood, alpha: 0.09, soft: 0.4 },
      { pts: ell(174, 334, 17, 13, 0, TAU, 14), color: PALETTE.wood, alpha: 0.09, soft: 0.4 },
      { pts: [[150, 356], [142, 374], [158, 374]], color: PALETTE.wood, alpha: 0.08, soft: 0.3 },
    ],
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

// Trader Vic's Fog Cutter mug: tall, handleless, slightly waisted, sand glaze, with island scenes
// in low relief. The front shows the hula girl under a palm; the ukulele player and the beach
// bum wrap round the back.
function fogCutterVessel() {
  const left = [[93, 117], [99, 200], [101, 280], [98, 360], [93, 436]];
  const sand = '#D8C29B';
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 57, 9), ...rimStrokes(150, 117, 57, 0.18),
      frontArc(150, 134, 56, 10, 3), frontArc(150, 412, 56, 10, 3),
      // palm leaning over her
      { pts: [[190, 408], [186, 330], [176, 250], [168, 196]], tier: 2 },
      ...[-2.8, -2.1, -1.2, -0.4].map(a => ({ pts: [[168, 196], [168 + Math.cos(a) * 20, 196 + Math.sin(a) * 11 - 2], [168 + Math.cos(a) * 36, 196 + Math.sin(a) * 4 + 12]], tier: 2 })),
      // hula girl: head, hair, raised arms, lei, grass skirt, legs
      { pts: ell(136, 250, 12, 13, 0, TAU * 1.04, 18), tier: 1 },
      { pts: [[124, 244], [117, 270], [122, 290]], tier: 2 },
      { pts: [[128, 272], [104, 256], [96, 232]], tier: 1 }, { pts: [[144, 272], [166, 262], [176, 240]], tier: 1 },
      { pts: [[128, 268], [136, 276], [144, 268]], tier: 2 },
      { pts: [[130, 270], [127, 318], [137, 328], [146, 318], [143, 270]], tier: 1 },
      { pts: [[116, 326], [158, 326]], tier: 2 },
      ...[118, 125, 132, 139, 146, 153].map((x, i) => ({ pts: [[x, 327], [x - 6 + i * 2.2, 370]], tier: 2 })),
      { pts: [[130, 370], [126, 398], [118, 408]], tier: 1 }, { pts: [[144, 370], [148, 398], [158, 408]], tier: 1 },
      // the ukulele player's shoulder at the left edge
      { pts: [[100, 292], [112, 286], [116, 324], [104, 346]], tier: 3 }, { pts: ell(110, 316, 6, 9, 0, TAU, 12), tier: 3 },
    ],
    washes: [
      { pts: bodyPoly(left), color: sand, alpha: 0.05 },
      { pts: [[116, 326], [158, 326], [162, 370], [112, 370]], color: PALETTE.frond, alpha: 0.07, soft: 0.4 },
      { pts: [[128, 268], [144, 268], [142, 320], [130, 320]], color: PALETTE.wood, alpha: 0.05, soft: 0.4 },
      { pts: [[128, 268], [136, 278], [144, 268]], color: PALETTE.hibiscus, alpha: 0.1, soft: 0.3 },
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
      { pts: body, color: glaze, alpha: 0.04 },
      { pts: [[68, 290], [60, 270], [68, 252], [88, 246], [104, 256], [104, 280]], color: glaze, alpha: 0.04, soft: 0.6 },
      { pts: [[62, 262], [36, 270], [62, 276]], color: PALETTE.butter, alpha: 0.12, soft: 0.3 },
      { pts: [[240, 322], [286, 282], [294, 310], [282, 342], [250, 350]], color: PALETTE.hibiscus, alpha: 0.06, soft: 0.5 },
    ],
    dots: [{ x: 82, y: 262, r: 3.6 }, { x: 81, y: 261, r: 1.1, color: PALETTE.paper }],
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

function pineappleVessel() {
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
  // the crown, set down beside it like a lid
  const crown = [];
  [-2.2, -1.95, -1.7, -1.45, -1.2].forEach((a, i) => {
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
    washes: [{ pts: bodyPoly(left), color: glaze, alpha: 0.04 }],
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

// Pusser's white enamel mug: rolled rim, navy lip, a chip or two.
function enamelVessel() {
  const left = [[86, 307], [86, 436]];
  return {
    strokes: [{ pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 64, 10), ...rimStrokes(150, 307, 64, 0.2), frontArc(150, 312, 64, 13, 2), ...handle(214, 324, 400, 34)],
    washes: [{ pts: [...ell(150, 307, 66, 13, 0, Math.PI, 16), ...ell(150, 316, 66, 13, Math.PI, 0, 16)], color: '#23346B', alpha: 0.1, soft: 0.25 }],
    dots: [{ x: 112, y: 366, r: 1.8 }, { x: 186, y: 404, r: 1.4 }, { x: 128, y: 420, r: 1 }],
  };
}

// The Scorpion bowl on three kneeling hula girls, island scenes in relief round the body.
function scorpionBowlVessel({ glaze = PALETTE.wood } = {}) {
  const left = [[18, 282], [24, 314], [48, 350], [84, 378], [120, 390]];
  const palm = (x, y, lean) => {
    const top = [x + lean, y];
    return [
      { pts: [[x - lean * 0.2, y + 44], [x + lean * 0.4, y + 22], top], tier: 2 },
      ...[-2.9, -2.3, -1.6, -0.9, -0.3].map(a => ({ pts: [top, [top[0] + Math.cos(a) * 14, top[1] + Math.sin(a) * 9 - 3], [top[0] + Math.cos(a) * 24, top[1] + Math.sin(a) * 4 + 7]], tier: 2 })),
    ];
  };
  // a kneeling girl holding the bowl up: head, raised arms, body, folded knees
  const kneeler = x => [
    { pts: ell(x, 402, 6, 6.5, 0, TAU * 1.04, 12), tier: 2 },
    { pts: [[x - 6, 398], [x - 12, 390]], tier: 2 }, { pts: [[x + 6, 398], [x + 12, 390]], tier: 2 },
    { pts: [[x - 6, 409], [x - 9, 426], [x + 9, 426], [x + 6, 409]], tier: 2 },
    { pts: [[x - 12, 436], [x - 10, 426], [x + 10, 426], [x + 14, 436]], tier: 2 },
  ];
  const band = [];
  for (let x = 34; x <= 266; x += 6) band.push([x, 312 + Math.pow((x - 150) / 116, 2) * 10]);
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 390, 30, 5, 2), ...rimStrokes(150, 282, 132, 0.15),
      { pts: band, tier: 3 }, ...palm(92, 318, 8), ...palm(208, 318, -8),
      ...kneeler(110), ...kneeler(150), ...kneeler(190),
    ],
    washes: [
      { pts: bodyPoly(left), color: glaze, alpha: 0.036 },
      ...[110, 150, 190].map(x => ({ pts: [[x - 10, 396], [x + 10, 396], [x + 14, 436], [x - 12, 436]], color: PALETTE.woodPale, alpha: 0.05, soft: 0.4 })),
      ...[110, 150, 190].map(x => ({ pts: [[x - 10, 416], [x + 10, 416], [x + 12, 430], [x - 11, 430]], color: PALETTE.frond, alpha: 0.06, soft: 0.3 })),
    ],
  };
}

// Trader Vic's Tiki Bowl: an earthen bowl held up by three standing tikis.
function tikiBowlVessel({ glaze = PALETTE.wood } = {}) {
  const left = [[46, 300], [52, 328], [72, 360], [104, 382], [126, 388]];
  const tiki = x => [
    { pts: [[x - 11, 388], [x - 12, 436], [x + 12, 436], [x + 11, 388]], tier: 1 },
    { pts: [[x - 10, 398], [x + 10, 398]], tier: 3 },
    { pts: ell(x - 5, 406, 3.5, 3.5, 0, TAU, 10), tier: 2 }, { pts: ell(x + 5, 406, 3.5, 3.5, 0, TAU, 10), tier: 2 },
    { pts: [[x - 6, 418], [x + 6, 418]], tier: 2 }, { pts: [[x - 6, 418], [x, 424], [x + 6, 418]], tier: 3 },
  ];
  return {
    strokes: [
      { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, ...rimStrokes(150, 300, 104, 0.16),
      frontArc(150, 316, 102, 16, 3), ...tiki(104), ...tiki(150), ...tiki(196),
    ],
    washes: [
      { pts: bodyPoly(left), color: glaze, alpha: 0.04 },
      ...[104, 150, 196].map(x => ({ pts: [[x - 11, 388], [x + 11, 388], [x + 12, 436], [x - 12, 436]], color: PALETTE.wood, alpha: 0.05, soft: 0.3 })),
    ],
  };
}

// Volcano bowl: dark glaze with red-orange drips, a cone rising from the middle to just above
// the rim, rum burning in its crater.
function volcanoBowlVessel({ flaming = false } = {}) {
  const left = [[22, 330], [30, 360], [58, 388], [92, 404], [96, 420], [92, 436]];
  const lava = '#4A3B35';
  const strokes = [
    { pts: left, tier: 1 }, { pts: mir(left), tier: 1 }, frontArc(150, 436, 58, 7), ...rimStrokes(150, 330, 128, 0.15),
    { pts: [[110, 336], [126, 306], [140, 284]], tier: 1 }, { pts: [[160, 284], [174, 306], [190, 336]], tier: 1 },
    { pts: ell(150, 284, 11, 4, 0, TAU, 14), tier: 2 },
    { pts: [[60, 352], [62, 370]], tier: 3 }, { pts: [[98, 362], [99, 384]], tier: 3 }, { pts: [[206, 360], [205, 380]], tier: 3 }, { pts: [[242, 350], [240, 366]], tier: 3 },
  ];
  const washes = [
    { pts: bodyPoly(left), color: lava, alpha: 0.04 },
    { pts: [[110, 336], [140, 284], [160, 284], [190, 336]], color: lava, alpha: 0.05, soft: 0.5 },
    { pts: [[140, 284], [146, 306], [152, 296], [160, 284]], color: PALETTE.hibiscus, alpha: 0.1, soft: 0.3 },
    ...[[60, 346, 372], [98, 356, 386], [206, 354, 382], [240, 344, 368]].map(([x, y0, y1]) => ({ pts: [[x - 4, y0], [x + 4, y0], [x + 3, y1], [x - 2, y1]], color: PALETTE.orange, alpha: 0.12, soft: 0.2 })),
  ];
  if (flaming) {
    strokes.push({ pts: [[141, 280], [135, 258], [147, 240], [150, 222], [156, 242], [166, 258], [159, 280]], tier: 1 });
    washes.push({ pts: [[141, 280], [135, 258], [150, 222], [166, 258], [159, 280]], color: PALETTE.orange, alpha: 0.1, soft: 0.4 }, { pts: [[145, 278], [143, 262], [150, 248], [157, 262], [155, 278]], color: PALETTE.butter, alpha: 0.12, soft: 0.3 });
  }
  return { strokes, washes };
}

const OPAQUE_ART = {
  'ku-mug': kuMugVessel, 'skull-mug': skullMugVessel, 'barrel-mug': barrelMugVessel, 'fog-cutter-mug': fogCutterVessel,
  'bird-mug': birdVessel, coconut: coconutVessel, pineapple: pineappleVessel, 'clay-cup': clayCupVessel, 'hot-mug': hotMugVessel,
  'julep-cup': julepVessel, 'copper-mug': copperVessel, 'enamel-tin': enamelVessel, 'scorpion-bowl': scorpionBowlVessel, 'tiki-bowl': tikiBowlVessel, 'volcano-bowl': volcanoBowlVessel,
  'moai-mug': ({ glaze }) => { const m = fitPart(moaiMug({ glaze }), MOAI_FIT); return { strokes: m.strokes, washes: m.washes.map(w => ({ ...w, alpha: 0.028 })) }; },
};

export const VESSEL_IDS = Object.keys(GLASS_PROFILES);

function glass({ kind = 'collins', glaze, flaming = false } = {}) {
  if (!GLASS_PROFILES[kind]) kind = 'collins';
  if (OPAQUE_ART[kind]) {
    const art = OPAQUE_ART[kind]({ glaze, flaming });
    return { box: [300, 460], strokes: art.strokes, washes: art.washes || [], dots: art.dots || [] };
  }
  return clearGlass(kind);
}

// The drink itself: a wash inside the glass up to the fill line, a glaze of depth near the
// bottom, an optional crown (float or bitters) and the surface line. Opaque mugs show only
// the surface at the rim. `frozen` heaps a soft dome above the rim.
function liquid({ kind = 'collins', fill = 0.84, color = PALETTE.butter, crown = null, frozen = false } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind);
  const strokes = [], washes = [];
  if (G.opaque) {
    washes.push({ pts: ell(R.cx, R.y + 1, R.hw - 8, (R.hw - 8) * R.tilt, 0, TAU, 18), color, alpha: 0.08, soft: 0.5 });
  } else {
    const top = frozen ? R.y + 2 : levelOf(kind, fill);
    const ys = [];
    for (let y = top; y < R.bottom; y += 14) ys.push(y);
    ys.push(R.bottom - 2);
    const inset = y => halfAt(G, y) - 4;
    const body = [...ys.map(y => [R.cx - inset(y), y]), ...ys.slice().reverse().map(y => [R.cx + inset(y), y])];
    washes.push({ pts: body, color, alpha: 0.06 });
    const deep = ys.filter(y => y > top + (R.bottom - top) * 0.5);
    if (deep.length > 1) washes.push({ pts: [...deep.map(y => [R.cx - inset(y) + 4, y]), ...deep.slice().reverse().map(y => [R.cx + inset(y) - 4, y])], color, alpha: 0.04, soft: 0.7 });
    if (crown) {
      const band = [top, top + 12, top + 24];
      washes.push({ pts: [...band.map(y => [R.cx - inset(y), y]), ...band.slice().reverse().map(y => [R.cx + inset(y), y])], color: crown, alpha: 0.09, soft: 0.6 });
    }
    if (!frozen) strokes.push({ pts: ell(R.cx, top, inset(top), inset(top) * G.rimTilt, 0.15, Math.PI - 0.15, 20), tier: 3 });
  }
  if (frozen) {
    const dome = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, x = R.cx - R.hw * 0.96 + u * R.hw * 1.92;
      dome.push([x, R.y - Math.sin(Math.PI * u) * 34 - (i % 2 ? 4 : 0)]);
    }
    strokes.push({ pts: dome, tier: 2 });
    washes.push({ pts: [...dome, [R.cx + R.hw * 0.9, R.y + 6], [R.cx - R.hw * 0.9, R.y + 6]], color, alpha: 0.05, soft: 0.6 });
  }
  return { box: [300, 460], strokes, washes };
}

function pebble(x, y, s, r) {
  const n = 5 + Math.floor(r() * 2), a0 = r() * TAU, pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * TAU, k = i === n ? 1 : 0.75 + r() * 0.45;
    pts.push(i === n ? pts[0].slice() : [x + Math.cos(a) * s * k, y + Math.sin(a) * s * k * 0.85]);
  }
  return pts;
}

// Ice, drawn sparingly: a few outlines suggest the whole glassful.
function ice({ kind = 'collins', style = 'cubed', fill = 0.84, seed = 5 } = {}) {
  const G = GLASS_PROFILES[kind] || GLASS_PROFILES.collins, R = rimOf(kind), r = rng(seed);
  const strokes = [], washes = [];
  const top = levelOf(kind, fill);
  const heap = ['crushed', 'pebble', 'shaved', 'ice-cone'].includes(style);
  if (heap) {
    const lift = ['coupe', 'cocktail-glass', 'nick-nora', 'flute'].includes(kind) ? 0 : 22;
    if (lift) {
      const mound = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        mound.push([R.cx - R.hw * 0.92 + u * R.hw * 1.84, R.y + 2 - Math.sin(Math.PI * u) * lift * (0.8 + r() * 0.4)]);
      }
      strokes.push({ pts: mound, tier: 2 });
      washes.push({ pts: [...mound, [R.cx + R.hw * 0.9, R.y + 8], [R.cx - R.hw * 0.9, R.y + 8]], color: PALETTE.ice, alpha: 0.032, soft: 0.6 });
      for (let i = 0; i < 5; i++) {
        const u = 0.15 + r() * 0.7;
        strokes.push({ pts: pebble(R.cx - R.hw * 0.9 + u * R.hw * 1.8, R.y - Math.sin(Math.PI * u) * lift * 0.5, 5 + r() * 3, r), tier: 3 });
      }
    }
    if (!G.opaque) {
      const n = kind === 'punch-bowl' ? 12 : 9;
      for (let i = 0; i < n; i++) {
        const y = top + 8 + r() * (R.bottom - top - 22), hw = halfAt(G, y) - 12;
        strokes.push({ pts: pebble(R.cx + (r() * 2 - 1) * hw, y, 5 + r() * 4, r), tier: 3 });
      }
    }
    if (style === 'ice-cone' && !G.opaque) {
      const w0 = Math.min(26, R.hw * 0.5);
      strokes.push({ pts: [[R.cx - w0, R.y - 30], [R.cx - w0 * 0.8, R.bottom - 12]], tier: 2 }, { pts: [[R.cx + w0, R.y - 30], [R.cx + w0 * 0.8, R.bottom - 12]], tier: 2 });
      strokes.push({ pts: ell(R.cx, R.y - 30, w0, w0 * 0.25, 0, TAU, 16), tier: 2 });
      washes.push({ pts: [[R.cx - w0, R.y - 30], [R.cx + w0, R.y - 30], [R.cx + w0 * 0.8, R.bottom - 12], [R.cx - w0 * 0.8, R.bottom - 12]], color: PALETTE.ice, alpha: 0.05, soft: 0.4 });
    }
  } else if ((style === 'cubed' || style === 'block') && !G.opaque) {
    const cubes = style === 'block' ? 1 : kind === 'rocks' ? 2 : 3;
    for (let i = 0; i < cubes; i++) {
      const size = style === 'block' ? Math.min(R.hw * 1.3, 96) : Math.min(R.hw * 0.95, 44);
      const y = top + 6 + size / 2 + i * size * 0.95;
      if (y + size / 2 > R.bottom - 4) break;
      const x = R.cx + (i % 2 ? 1 : -1) * R.hw * 0.18 * (cubes > 1 ? 1 : 0), a = (r() - 0.5) * 0.5, h = size / 2;
      const c = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)]);
      strokes.push({ pts: c, tier: 2 });
      strokes.push({ pts: [[c[0][0] + (c[1][0] - c[0][0]) * 0.2 + 5, c[0][1] + (c[3][1] - c[0][1]) * 0.2 + 5], [c[0][0] + (c[1][0] - c[0][0]) * 0.2 + 5, c[0][1] + (c[3][1] - c[0][1]) * 0.45 + 5]], tier: 3 });
      washes.push({ pts: c.slice(0, 4), color: PALETTE.ice, alpha: 0.04, soft: 0.3 });
    }
  }
  return { box: [300, 460], strokes, washes };
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

function nutmeg({ rx = 40, ry = 6, seed = 11 } = {}) {
  const r = rng(seed), dots = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU, k = Math.sqrt(r());
    dots.push({ x: rx + Math.cos(a) * rx * 0.8 * k, y: ry + Math.sin(a) * ry * 0.8 * k, r: 0.7 + r() * 0.9, color: PALETTE.wood });
  }
  return { box: [rx * 2, ry * 2], strokes: [], dots };
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
  'fruit.pineapple': pineapple, glass, 'garnish.mint': mint, 'garnish.lime-wheel': p => citrusWheel({ color: PALETTE.lime, ...p }),
  'garnish.orange-wheel': p => citrusWheel({ color: PALETTE.orange, ...p }), 'garnish.lime-shell': limeShell, 'garnish.cherry': cherry,
  'garnish.orchid': orchid, 'garnish.umbrella': umbrella, 'garnish.pineapple-wedge': pineappleWedge, 'garnish.cinnamon': cinnamon,
  'garnish.beans': beans, 'garnish.peel': peel, 'garnish.nutmeg': nutmeg, straw, sparkle, liquid, ice, fizz, steam, frame,
};
