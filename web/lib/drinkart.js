// Draws a generated drink: the right glass, a liquid colored by its actual ingredients,
// the right ice, fizz or steam, and the garnishes named in the recipe. Animated in ~2.2 s.

const TAU = Math.PI * 2;
const clamp01 = t => Math.min(1, Math.max(0, t));
const ease = t => 1 - Math.pow(1 - clamp01(t), 3);
const bounce = t => { const c = 2.2; const x = clamp01(t) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const seg = (t, a, b) => clamp01((t - a) / (b - a));
function rngFrom(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); let s = h >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// [r, g, b, tint] — tint is how strongly an ingredient colors the drink per ounce.
const COLOR = {
  'rum-white-column': [250, 244, 225, 0.2], 'rum-gold-column': [214, 150, 60, 1], 'rum-aged-column': [190, 110, 40, 1.2],
  'rum-blended-light': [245, 235, 205, 0.3], 'rum-barbados': [200, 120, 45, 1.2], 'rum-jamaican-aged': [185, 100, 35, 1.3],
  'rum-jamaican-dark': [105, 48, 18, 2.2], 'rum-jamaican-pot': [190, 120, 40, 1.2], 'rum-jamaican-white-overproof': [250, 248, 235, 0.2],
  'rum-demerara': [125, 58, 20, 2], 'rum-demerara-overproof': [115, 52, 18, 2.2], 'rum-black-blended': [55, 24, 10, 3],
  'rum-black-overproof': [60, 26, 10, 3], 'rum-agricole-blanc': [248, 244, 228, 0.2], 'rum-agricole-vieux': [200, 128, 50, 1.2],
  'rum-haitian': [210, 140, 60, 1], 'rum-navy': [118, 54, 20, 2], 'rum-overproof-white': [250, 248, 238, 0.2],
  'rum-spiced': [190, 110, 40, 1.2], 'rum-pineapple': [220, 160, 70, 1], 'rum-cachaca': [248, 244, 230, 0.2],
  bourbon: [190, 110, 45, 1.3], rye: [185, 105, 45, 1.3], 'scotch-blended': [205, 140, 60, 1.1], 'scotch-islay': [215, 160, 70, 1],
  brandy: [175, 95, 40, 1.3], applejack: [200, 130, 55, 1.1], 'tequila-reposado': [232, 196, 118, 0.7],
  lime: [212, 228, 160, 0.7], lemon: [246, 238, 160, 0.6], grapefruit: [248, 184, 160, 0.8], orange: [255, 160, 45, 1.3], 'yuzu-juice': [245, 235, 150, 0.6],
  'pineapple-juice': [255, 214, 88, 1.2], 'passion-fruit-juice': [255, 186, 50, 1.4], 'passion-fruit-nectar': [255, 180, 60, 1.3],
  'guava-nectar': [255, 140, 140, 1.4], 'mango-nectar': [255, 176, 45, 1.4], 'papaya-nectar': [255, 150, 90, 1.3], 'apricot-nectar': [255, 165, 70, 1.3],
  'cranberry-juice': [205, 30, 60, 2.2], 'pomegranate-juice': [150, 20, 50, 2.5], 'apple-juice': [230, 196, 110, 1], 'coconut-water': [245, 245, 235, 0.3],
  'watermelon-juice': [255, 105, 120, 1.4], banana: [246, 232, 170, 1.2], strawberry: [228, 45, 70, 2],
  'demerara-syrup': [200, 140, 70, 0.8], 'honey-syrup': [240, 190, 80, 0.8], 'cinnamon-syrup': [190, 110, 60, 0.8], 'vanilla-syrup': [230, 205, 165, 0.4],
  orgeat: [246, 240, 228, 0.9], 'passion-fruit-syrup': [252, 176, 45, 1.5], grenadine: [200, 18, 50, 3.5], 'falernum-syrup': [240, 228, 195, 0.4],
  'ginger-syrup': [232, 208, 150, 0.5], 'maple-syrup': [175, 95, 35, 1.2], 'agave-syrup': [240, 220, 160, 0.3], 'raspberry-syrup': [220, 35, 90, 3],
  'pineapple-syrup': [255, 220, 120, 0.8], 'hibiscus-syrup': [190, 25, 85, 3.5], 'guava-syrup': [255, 115, 140, 2], 'lychee-syrup': [250, 240, 235, 0.3],
  'lime-cordial': [196, 228, 110, 1], 'dons-mix': [242, 170, 140, 1], 'dons-spices-2': [205, 150, 100, 0.8], 'gardenia-mix': [242, 205, 130, 1.2],
  'hot-buttered-rum-batter': [200, 140, 70, 1.5], 'five-spice-syrup': [170, 90, 50, 1], 'li-hing-mui-syrup': [220, 120, 120, 1],
  'orange-curacao': [255, 170, 60, 1.1], 'blue-curacao': [25, 120, 235, 4], 'apricot-liqueur': [240, 150, 60, 1.1], 'peach-liqueur': [250, 180, 120, 0.9],
  'cherry-heering': [120, 12, 30, 3.5], 'banana-liqueur': [250, 222, 90, 1], 'blackberry-liqueur': [85, 12, 42, 3.5], 'raspberry-liqueur': [150, 12, 50, 3.5],
  'creme-de-cassis': [70, 0, 40, 4], 'coffee-liqueur': [45, 20, 10, 4], 'creme-de-cacao': [120, 60, 30, 1.5], galliano: [255, 225, 40, 2],
  benedictine: [210, 150, 60, 1.2], 'green-chartreuse': [140, 190, 60, 2.5], 'yellow-chartreuse': [240, 220, 80, 1.8], campari: [220, 18, 40, 4],
  aperol: [255, 95, 30, 3], amaro: [90, 40, 20, 2.5], cynar: [80, 50, 20, 2.5], fernet: [50, 30, 15, 3], drambuie: [210, 140, 50, 1.3],
  'allspice-dram': [120, 40, 20, 2.5], 'velvet-falernum': [246, 236, 200, 0.4], 'passion-fruit-liqueur': [250, 150, 40, 1.5], amaretto: [200, 120, 50, 1.4],
  'hazelnut-liqueur': [190, 130, 60, 1.2], 'licor-43': [250, 210, 60, 1.5], 'irish-cream': [215, 190, 160, 1.5], 'sloe-gin': [170, 20, 60, 3],
  'ancho-reyes': [160, 60, 30, 2], 'ginger-liqueur': [240, 210, 120, 0.8], 'melon-liqueur': [110, 220, 60, 3.5], 'swedish-punsch': [220, 180, 80, 1.2],
  'sweet-vermouth': [115, 28, 20, 2.5], 'amontillado-sherry': [210, 160, 90, 1], 'px-sherry': [70, 30, 15, 3], 'ruby-port': [140, 20, 40, 3],
  'lillet-blanc': [250, 225, 130, 0.8], 'sparkling-wine': [250, 240, 190, 0.4], 'white-wine': [245, 235, 170, 0.4],
  angostura: [140, 40, 20, 5], peychauds: [220, 30, 40, 5], 'orange-bitters': [230, 140, 40, 3], 'tiki-bitters': [150, 60, 30, 4], 'mole-bitters': [100, 40, 20, 4],
  'coconut-cream': [252, 250, 244, 1.6], 'coconut-milk': [250, 250, 244, 1.4], 'heavy-cream': [255, 253, 246, 1.6], 'half-and-half': [255, 253, 246, 1.3],
  'egg-white': [250, 250, 244, 0.6], 'vanilla-ice-cream': [255, 246, 226, 1.8], butter: [250, 225, 140, 0.6],
  'ginger-beer': [238, 218, 160, 0.4], 'ginger-ale': [232, 205, 145, 0.4], cola: [70, 30, 14, 3], coffee: [58, 32, 18, 3.5], 'black-tea': [170, 88, 38, 1.5],
};
const CAT_DEFAULT = { rum: [200, 130, 50, 1], spirit: [248, 246, 238, 0.2], liqueur: [240, 210, 150, 0.6], fortified: [210, 150, 90, 1], bitters: [140, 40, 20, 4], syrup: [250, 246, 238, 0.2], citrus: [225, 230, 170, 0.6], juice: [255, 205, 100, 1], cream: [252, 250, 245, 1.5], soda: [245, 245, 240, 0.1], aromatic: [0, 0, 0, 0] };
const CLOUDY = new Set(['pineapple-juice', 'orange', 'passion-fruit-juice', 'passion-fruit-nectar', 'guava-nectar', 'mango-nectar', 'papaya-nectar', 'apricot-nectar', 'banana', 'strawberry', 'coconut-cream', 'coconut-milk', 'heavy-cream', 'half-and-half', 'irish-cream', 'vanilla-ice-cream', 'orgeat', 'gardenia-mix', 'grapefruit', 'egg-white', 'hot-buttered-rum-batter']);
const FIZZ = new Set(['soda-water', 'ginger-beer', 'ginger-ale', 'cola', 'tonic', 'lemon-lime-soda', 'sparkling-wine']);

export function liquidColor(lines, ingMap) {
  let r = 0, g = 0, b = 0, w = 0, cloudy = 0, vol = 0;
  for (const l of lines) {
    if (l.garnish || l.float) continue;
    const ing = ingMap.get(l.id);
    if (!ing) continue;
    const c = COLOR[l.id] || CAT_DEFAULT[ing.cat] || [240, 230, 200, 0.5];
    const oz = Math.max(l.oz || 0, 0.02);
    const k = oz * c[3];
    r += c[0] * k; g += c[1] * k; b += c[2] * k; w += k; vol += oz;
    if (CLOUDY.has(l.id)) cloudy += oz;
  }
  if (!w) return { rgb: [240, 230, 200], cloud: 0 };
  const rgb = [r / w, g / w, b / w].map(v => v * 0.88 + 255 * 0.12);
  return { rgb, cloud: vol ? Math.min(1, (cloudy / vol) * 1.6) : 0 };
}

// Glass profiles in a 300 × 400 box: [y, half-width] from rim to bottom.
const GLASSES = {
  rocks: { pts: [[196, 76], [338, 64]], foot: { type: 'slab', h: 14 }, rimTilt: 0.16 },
  highball: { pts: [[92, 50], [346, 44]], foot: { type: 'slab', h: 12 }, rimTilt: 0.16 },
  pilsner: { pts: [[88, 60], [190, 48], [320, 30]], foot: { type: 'stem', h: 16, w: 44 }, rimTilt: 0.16 },
  hurricane: { pts: [[92, 56], [135, 50], [180, 40], [222, 50], [262, 60], [296, 46], [318, 26]], foot: { type: 'stem', h: 26, w: 50 }, rimTilt: 0.16 },
  coupe: { pts: [[168, 90], [186, 82], [208, 58], [226, 16]], foot: { type: 'stem', h: 108, w: 60 }, rimTilt: 0.22 },
  snifter: { pts: [[150, 52], [190, 72], [236, 82], [278, 70], [312, 36]], foot: { type: 'stem', h: 24, w: 54 }, rimTilt: 0.2 },
  tiki: { pts: [[122, 62], [232, 72], [346, 62]], foot: { type: 'slab', h: 8 }, opaque: 'tiki', rimTilt: 0.2 },
  mug: { pts: [[150, 70], [346, 70]], foot: { type: 'slab', h: 8 }, opaque: 'mug', rimTilt: 0.2 },
  bowl: { pts: [[210, 128], [250, 118], [292, 86], [316, 50]], foot: { type: 'stem', h: 16, w: 74 }, rimTilt: 0.18 },
};

export function pickGlass(text, method) {
  const t = (text || '').toLowerCase();
  if (method === 'hot') return 'mug';
  if (/bowl/.test(t)) return 'bowl';
  if (/tiki/.test(t)) return 'tiki';
  if (/coupe|cocktail glass|nick|martini/.test(t)) return 'coupe';
  if (/snifter/.test(t)) return 'snifter';
  if (/hurricane/.test(t)) return 'hurricane';
  if (/pilsner|footed/.test(t)) return 'pilsner';
  if (/chimney|zombie|collins|highball|tall|sling/.test(t)) return 'highball';
  if (/old fashioned|rocks|double|dof|lowball/.test(t)) return 'rocks';
  if (/mug|tin/.test(t)) return 'mug';
  if (method === 'blend') return 'hurricane';
  if (method === 'stir') return 'rocks';
  return 'highball';
}

function halfAt(G, y) {
  const p = G.pts;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 0; i < p.length - 1; i++) {
    const [y0, w0] = p[i], [y1, w1] = p[i + 1];
    if (y >= y0 && y <= y1) return w0 + ((y - y0) / (y1 - y0)) * (w1 - w0);
  }
  return p[p.length - 1][1];
}

function profilePath(c, G, cx) {
  const p = G.pts;
  c.beginPath();
  c.moveTo(cx - p[0][1], p[0][0]);
  for (let i = 1; i < p.length; i++) {
    const [y0, w0] = p[i - 1], [y1, w1] = p[i];
    c.quadraticCurveTo(cx - w0, (y0 + y1) / 2, cx - (w0 + w1) / 2, (y0 + y1) / 2);
    c.lineTo(cx - w1, y1);
  }
  const last = p[p.length - 1];
  c.lineTo(cx + last[1], last[0]);
  for (let i = p.length - 1; i > 0; i--) {
    const [y0, w0] = p[i], [y1, w1] = p[i - 1];
    c.quadraticCurveTo(cx + w0, (y0 + y1) / 2, cx + (w0 + w1) / 2, (y0 + y1) / 2);
    c.lineTo(cx + w1, y1);
  }
  c.closePath();
}

const rgba = (rgb, a) => `rgba(${rgb.map(v => Math.round(Math.max(0, Math.min(255, v)))).join(',')},${a.toFixed(3)})`;
const shade = (rgb, k) => rgb.map(v => v * k);
const tintTo = (rgb, t, k) => rgb.map((v, i) => v + (t[i] - v) * k);

let active = null;

export function drawDrink(canvas, recipe, ingMap, { reducedMotion = false } = {}) {
  if (active) active.stop();
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 300, cssH = canvas.clientHeight || 400;
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  const scale = Math.min(cssW / 300, cssH / 400);
  const ox = (cssW - 300 * scale) / 2, oy = (cssH - 400 * scale) / 2;

  const rand = rngFrom(recipe.name + recipe.seed);
  const kind = pickGlass(recipe.method.glass, recipe.method.method);
  const G = GLASSES[kind];
  const cx = 150;
  const rimY = G.pts[0][0], bottomY = G.pts[G.pts.length - 1][0];
  const liquid = liquidColor(recipe.lines, ingMap);
  const floats = recipe.lines.filter(l => l.float && !l.garnish);
  const hasBitters = recipe.lines.some(l => (ingMap.get(l.id) || {}).cat === 'bitters');
  const crown = floats.length ? liquidColor(floats.map(f => ({ ...f, float: false })), ingMap).rgb
    : recipe.method.method === 'swizzle' && hasBitters ? [150, 40, 25] : null;
  const fizzy = recipe.lines.some(l => FIZZ.has(l.id));
  const hot = recipe.method.method === 'hot';
  const frozen = recipe.method.method === 'blend' || recipe.method.ice === 'blended';
  const ice = hot ? 'none' : frozen ? 'blended' : recipe.method.ice;
  const fill = kind === 'coupe' ? 0.9 : kind === 'bowl' ? 0.75 : 0.84;
  const levelY = bottomY - (bottomY - rimY) * fill;
  const garnishText = (recipe.garnish || []).join(' ').toLowerCase();
  const flaming = !!(recipe.style && recipe.style.flaming) || recipe.method.steps.some(s => /light it/i.test(s));
  const umbrella = /umbrella/.test(garnishText) || ['colada', 'resort-punch'].includes(recipe.family.id);
  const straw = !['coupe', 'mug', 'snifter'].includes(kind) && recipe.method.method !== 'stir';
  const glaze = ['#1f7a6d', '#6b3b1f', '#2b2b35', '#c7622a', '#3b5aa3', '#7a2f4f'][Math.floor(rand() * 6)];

  // Ice layout (deterministic per drink).
  const cubes = [];
  if (ice === 'crushed' || ice === 'pebble' || ice === 'shaved' || ice === 'ice-cone') {
    const n = kind === 'bowl' ? 70 : 46;
    for (let i = 0; i < n; i++) {
      const y = levelY - 10 + rand() * (bottomY - levelY + 10);
      const hw = halfAt(G, y) * 0.86;
      cubes.push({ x: cx + (rand() * 2 - 1) * hw, y, s: 5 + rand() * 7, rot: rand() * TAU, pts: 5 + Math.floor(rand() * 3), delay: rand() });
    }
    if (G.opaque || kind !== 'coupe') for (let i = 0; i < 16; i++) {
      const a = Math.PI + rand() * Math.PI;
      const r = rand();
      cubes.push({ x: cx + Math.cos(a) * halfAt(G, rimY) * 0.9 * r, y: rimY - Math.abs(Math.sin(a)) * 22 * (1 - r * 0.5), s: 5 + rand() * 6, rot: rand() * TAU, pts: 5, delay: 0.6 + rand() * 0.4 });
    }
  } else if (ice === 'cubed') {
    const n = kind === 'rocks' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const y = levelY + 18 + i * ((bottomY - levelY - 30) / n);
      cubes.push({ x: cx + (i % 2 ? 1 : -1) * halfAt(G, y) * 0.32, y, s: Math.min(34, halfAt(G, y) * 0.6), rot: (rand() - 0.5) * 0.6, cube: true, delay: i / n });
    }
  } else if (ice === 'block') {
    cubes.push({ x: cx, y: (levelY + bottomY) / 2 + 6, s: Math.min(58, halfAt(G, levelY) * 1.2), rot: 0.08, cube: true, delay: 0 });
  }

  const bubbles = Array.from({ length: fizzy ? 22 : 0 }, () => ({ x: (rand() * 2 - 1) * 0.8, y: rand(), s: 1 + rand() * 2.2, sp: 0.25 + rand() * 0.5 }));
  const steam = Array.from({ length: hot ? 4 : 0 }, (_, i) => ({ x: (i - 1.5) * 16, ph: rand() * TAU }));

  const start = performance.now();
  let raf = 0, stopped = false;

  function frame(now) {
    const t = reducedMotion ? 9 : (now - start) / 1000;
    const time = now / 1000;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    ctx.clearRect(-ox / scale, -oy / scale, cssW / scale, cssH / scale);
    // Soft pool of torchlight under the glass.
    const pool = ctx.createRadialGradient(cx, bottomY + 26, 4, cx, bottomY + 26, 150);
    pool.addColorStop(0, 'rgba(255,170,80,0.28)'); pool.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, bottomY - 60, 300, 140);

    const outline = seg(t, 0, 0.55), pour = ease(seg(t, 0.35, 1.25)), iceIn = seg(t, 0.9, 1.6), garn = seg(t, 1.4, 2.2);
    drawFoot(outline);
    if (G.opaque) drawOpaque(outline, pour, iceIn, time);
    else drawClear(outline, pour, iceIn, time);
    drawGarnish(garn, time);
    if (hot && pour > 0.8) drawSteam(time);
    if (!reducedMotion && !stopped) raf = requestAnimationFrame(frame);
  }

  function drawFoot(p) {
    const f = G.foot;
    const w = halfAt(G, bottomY);
    ctx.globalAlpha = ease(p);
    if (f.type === 'slab') {
      ctx.fillStyle = G.opaque ? shadeHex(glaze, 0.7) : 'rgba(215,235,245,0.35)';
      ctx.beginPath(); ctx.ellipse(cx, bottomY + f.h / 2, w, f.h * 0.9, 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(215,235,245,0.4)';
      ctx.fillRect(cx - 4, bottomY, 8, f.h);
      ctx.beginPath(); ctx.ellipse(cx, bottomY + f.h + 4, f.w, 7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(235,248,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawClear(outline, pour, iceIn, time) {
    // Liquid, clipped to the glass.
    ctx.save();
    profilePath(ctx, G, cx); ctx.clip();
    if (pour > 0) {
      const top = bottomY - (bottomY - levelY) * pour;
      const alpha = 0.62 + 0.33 * liquid.cloud;
      const g = ctx.createLinearGradient(0, top, 0, bottomY);
      g.addColorStop(0, rgba(tintTo(liquid.rgb, [255, 255, 255], 0.18), alpha));
      g.addColorStop(1, rgba(shade(liquid.rgb, 0.78), alpha + 0.05));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, top);
      for (let x = 0; x <= 300; x += 10) ctx.lineTo(x, top + Math.sin(x * 0.08 + time * 3) * 1.6 * (1 - pour * 0.6));
      ctx.lineTo(300, 400); ctx.lineTo(0, 400); ctx.closePath(); ctx.fill();
      if (crown && pour > 0.95) {
        const cg = ctx.createLinearGradient(0, top - 2, 0, top + 30);
        cg.addColorStop(0, rgba(crown, 0.95)); cg.addColorStop(1, rgba(crown, 0));
        ctx.fillStyle = cg; ctx.fillRect(0, top - 2, 300, 32);
      }
      if (frozen) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 90; i++) { const r = rngFrom(String(i)); ctx.fillRect(cx - 80 + r() * 160, top + r() * (bottomY - top), 2, 2); }
      }
      for (const b of bubbles) {
        const by = bottomY - ((b.y + time * b.sp) % 1) * (bottomY - top);
        const bx = cx + b.x * halfAt(G, by);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, by, b.s, 0, TAU); ctx.stroke();
      }
    }
    drawIce(iceIn, false);
    ctx.restore();
    if (frozen && pour > 0.9) drawSlushDome(seg(pour, 0.9, 1));
    drawIce(iceIn, true);
    if (ice === 'ice-cone') drawCone(iceIn);
    // Glass outline, drawn on like a pen stroke.
    const len = 1400;
    ctx.save();
    ctx.setLineDash([len, len]); ctx.lineDashOffset = len * (1 - ease(outline));
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(232,246,255,0.9)'; ctx.lineJoin = 'round';
    profilePath(ctx, G, cx); ctx.stroke();
    ctx.restore();
    if (outline > 0.8) {
      const hw = halfAt(G, rimY);
      ctx.strokeStyle = 'rgba(232,246,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, rimY, hw, hw * G.rimTilt, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - halfAt(G, rimY + 30) * 0.72, rimY + 30); ctx.lineTo(cx - halfAt(G, bottomY - 30) * 0.72, bottomY - 40); ctx.stroke();
      if (recipe.method.method === 'swizzle') {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 160; i++) { const r = rngFrom('frost' + i); const y = rimY + r() * (bottomY - rimY); const w = halfAt(G, y); ctx.fillRect(cx - w + r() * w * 2, y, 1.6, 1.6); }
      }
    }
  }

  function drawOpaque(outline, pour, iceIn, time) {
    const k = ease(outline);
    ctx.save();
    ctx.globalAlpha = k;
    const hw = halfAt(G, rimY);
    const g = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0);
    g.addColorStop(0, shadeHex(glaze, 0.55)); g.addColorStop(0.35, shadeHex(glaze, 1.25)); g.addColorStop(1, shadeHex(glaze, 0.6));
    ctx.fillStyle = g;
    profilePath(ctx, G, cx); ctx.fill();
    if (G.opaque === 'mug') {
      ctx.strokeStyle = shadeHex(glaze, 0.8); ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(cx + hw + 4, (rimY + bottomY) / 2, 40, -1.2, 1.2); ctx.stroke();
    } else {
      carveFace(seg(outline, 0.5, 1));
    }
    // Liquid surface at the rim.
    ctx.fillStyle = shadeHex(glaze, 0.45);
    ctx.beginPath(); ctx.ellipse(cx, rimY, hw, hw * G.rimTilt, 0, 0, TAU); ctx.fill();
    if (pour > 0) {
      ctx.fillStyle = rgba(liquid.rgb, 0.95 * pour);
      ctx.beginPath(); ctx.ellipse(cx, rimY + 3, hw * 0.9, hw * G.rimTilt * 0.85, 0, 0, TAU); ctx.fill();
      if (crown) { ctx.fillStyle = rgba(crown, 0.7 * pour); ctx.beginPath(); ctx.ellipse(cx, rimY + 3, hw * 0.6, hw * G.rimTilt * 0.55, 0, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    if (ice !== 'none' && ice !== 'blended') drawIce(iceIn, true);
    if (ice === 'ice-cone') drawCone(iceIn);
    if (frozen && pour > 0.9) drawSlushDome(seg(pour, 0.9, 1));
  }

  function carveFace(p) {
    if (p <= 0) return;
    const dark = shadeHex(glaze, 0.4);
    ctx.save();
    ctx.globalAlpha *= ease(p);
    ctx.fillStyle = dark; ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const ey = 200;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(cx + s * 26, ey, 17, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f5dfb3'; ctx.beginPath(); ctx.ellipse(cx + s * 26, ey, 12, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b0d06'; ctx.beginPath(); ctx.arc(cx + s * 26, ey + 1, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = dark;
    }
    ctx.beginPath(); ctx.moveTo(cx - 48, ey - 22); ctx.quadraticCurveTo(cx, ey - 34, cx + 48, ey - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, ey + 10); ctx.lineTo(cx - 16, ey + 40); ctx.lineTo(cx + 16, ey + 40); ctx.lineTo(cx + 8, ey + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 34, ey + 56); ctx.quadraticCurveTo(cx, ey + 92, cx + 34, ey + 56); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f7e7c4';
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - 24 + i * 10, ey + 58, 7, 9);
    ctx.fillStyle = '#e0566b'; ctx.beginPath(); ctx.ellipse(cx, ey + 76, 10, 5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawSlushDome(k) {
    const hw = halfAt(G, rimY) * (G.opaque ? 0.95 : 1);
    ctx.fillStyle = rgba(tintTo(liquid.rgb, [255, 255, 255], 0.35), 0.95);
    ctx.beginPath(); ctx.ellipse(cx, rimY, hw, 26 * ease(k), 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 26; i++) { const r = rngFrom('dome' + i); const a = Math.PI + r() * Math.PI; ctx.fillRect(cx + Math.cos(a) * hw * r(), rimY + Math.sin(a) * 22 * ease(k) * r(), 2, 2); }
  }

  function drawIce(p, aboveRim) {
    if (p <= 0 || !cubes.length) return;
    for (const cube of cubes) {
      const above = cube.y < rimY + 2;
      if (above !== aboveRim) continue;
      const k = seg(p, cube.delay * 0.5, cube.delay * 0.5 + 0.5);
      if (k <= 0) continue;
      const y = cube.y - (1 - ease(k)) * 160;
      ctx.save();
      ctx.translate(cube.x, y); ctx.rotate(cube.rot);
      if (cube.cube) {
        ctx.fillStyle = 'rgba(235,248,255,0.42)'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
        roundRect(ctx, -cube.s / 2, -cube.s / 2, cube.s, cube.s, cube.s * 0.18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-cube.s * 0.3, -cube.s * 0.32, cube.s * 0.18, cube.s * 0.5);
      } else {
        ctx.fillStyle = 'rgba(240,250,255,0.5)'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < cube.pts; i++) { const a = (i / cube.pts) * TAU; const rr = cube.s * (0.7 + 0.3 * Math.sin(i * 7 + cube.s)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawCone(k) {
    const h = 150 * ease(k);
    ctx.fillStyle = 'rgba(240,250,255,0.8)'; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 34, rimY + 60); ctx.lineTo(cx - 12, rimY + 60 - h); ctx.lineTo(cx + 12, rimY + 60 - h); ctx.lineTo(cx + 34, rimY + 60); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function drawGarnish(p, time) {
    if (p <= 0) return;
    const hw = halfAt(G, rimY);
    const pop = (a, b, x, y, fn) => { const k = seg(p, a, b); if (k <= 0) return; ctx.save(); ctx.translate(x, y); const s = bounce(k); ctx.scale(s, s); fn(); ctx.restore(); };
    if (straw) pop(0, 0.35, cx + hw * 0.35, rimY - 10, () => drawStraw());
    if (/mint/.test(garnishText)) pop(0.1, 0.5, cx - hw * 0.35, rimY - 8, () => drawMint(/bouquet/.test(garnishText) ? 1.3 : 1));
    if (/pineapple/.test(garnishText)) pop(0.2, 0.6, cx + hw * 0.95, rimY + 4, () => drawPineapple());
    if (/lime wheel/.test(garnishText)) pop(0.25, 0.6, cx - hw * 0.98, rimY + 6, () => drawWheel([150, 200, 60], [220, 240, 170]));
    if (/orange wheel/.test(garnishText)) pop(0.25, 0.6, cx - hw * 0.98, rimY + 6, () => drawWheel([255, 150, 30], [255, 205, 120]));
    if (/lime shell|spent lime/.test(garnishText) || flaming) pop(0.3, 0.7, cx - hw * 0.15, rimY - 14, () => drawShell());
    if (/cherry/.test(garnishText)) pop(0.4, 0.8, cx + hw * 0.55, rimY - 26, () => drawCherry());
    if (/orchid/.test(garnishText)) pop(0.45, 0.85, cx - hw * 0.55, rimY - 22, () => drawOrchid());
    if (/cinnamon/.test(garnishText)) pop(0.45, 0.85, cx + hw * 0.1, rimY - 30, () => drawStick());
    if (/coffee bean/.test(garnishText)) pop(0.5, 0.85, cx, rimY, () => drawBeans());
    if (/nutmeg/.test(garnishText)) pop(0.55, 0.9, cx, rimY, () => drawNutmeg(hw));
    if (/orange peel|twist/.test(garnishText)) pop(0.5, 0.9, cx + hw * 0.8, rimY - 4, () => drawPeel());
    if (umbrella) pop(0.6, 1, cx - hw * 0.1, rimY - 40, () => drawUmbrella());
    if (flaming && p > 0.8) flame(cx - hw * 0.15, rimY - 22, 9, time);
  }

  function drawStraw() {
    ctx.save(); ctx.rotate(0.28);
    const w = 7, top = -120, bot = 90;
    ctx.fillStyle = '#fff6e6'; ctx.fillRect(-w / 2, top, w, bot - top);
    ctx.fillStyle = '#e8465a';
    for (let y = top; y < bot; y += 14) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y + 6); ctx.lineTo(w / 2, y + 12); ctx.lineTo(-w / 2, y + 6); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function leaf(x, y, a, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -s, 0, s); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -s, s * 0.45, s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,70,30,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 1.8); ctx.stroke();
    ctx.restore();
  }
  function drawMint(k) {
    ctx.strokeStyle = '#3f7a2e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -40 * k); ctx.stroke();
    const col = ['#8fd460', '#3d9a3a'];
    [[-0.9, 0], [0.9, -6], [-0.6, -18], [0.6, -24], [-0.3, -34], [0.3, -38], [0, -46]].forEach(([a, y], i) => leaf(0, y * k, a, (13 - i) * k, col));
  }
  function drawPineapple() {
    for (let i = -2; i <= 2; i++) leaf(0, -18, i * 0.28, 24 - Math.abs(i) * 3, ['#7cc86a', '#2e7d45']);
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(26, -14); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8791f'; ctx.fillRect(-26, -18, 52, 6);
    ctx.strokeStyle = 'rgba(200,140,30,0.6)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -12); ctx.lineTo(0, 26); ctx.stroke(); }
  }
  function drawWheel(rind, flesh) {
    ctx.fillStyle = rgba(rind, 1); ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(flesh, 1); ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.stroke(); }
  }
  function drawShell() {
    ctx.fillStyle = '#5ea83a'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e6f2c8'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 6, 0, 0, TAU); ctx.fill();
  }
  function drawCherry() {
    ctx.strokeStyle = '#4b6b2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -20, 18, -30); ctx.stroke();
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#ff6b7d'); g.addColorStop(1, '#a3081f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
  }
  function drawOrchid() {
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate((i / 5) * TAU);
      const g = ctx.createLinearGradient(0, 0, 0, -18); g.addColorStop(0, '#f7a8e0'); g.addColorStop(1, '#b43fa0');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -10, 7, 12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  }
  function drawStick() {
    ctx.save(); ctx.rotate(-0.35);
    ctx.fillStyle = '#8a4b22'; roundRect(ctx, -5, -40, 10, 70, 4); ctx.fill();
    ctx.strokeStyle = '#5b2e12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, -38); ctx.lineTo(-2, 28); ctx.stroke();
    ctx.restore();
  }
  function drawBeans() {
    [[-14, 0], [0, -4], [14, 1]].forEach(([x, y]) => {
      ctx.fillStyle = '#3b2010'; ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1a0c05'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke();
    });
  }
  function drawNutmeg(hw) {
    ctx.fillStyle = 'rgba(120,70,30,0.85)';
    for (let i = 0; i < 40; i++) { const r = rngFrom('nut' + i); ctx.fillRect((r() * 2 - 1) * hw * 0.7, (r() * 2 - 1) * 5, 1.8, 1.8); }
  }
  function drawPeel() {
    ctx.strokeStyle = '#ff9a2e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.45; ctx.lineTo(Math.cos(a) * 7, i * 1.6 - 20); } ctx.stroke();
  }
  function drawUmbrella() {
    ctx.strokeStyle = '#d9b36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 70); ctx.stroke();
    const cols = ['#ff5d8f', '#ffd24a', '#3ecfc0', '#ff8a3d'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 8, 38, Math.PI + (i / 8) * Math.PI, Math.PI + ((i + 1) / 8) * Math.PI);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(0, -1, 3, 0, TAU); ctx.fill();
  }
  function flame(x, y, s, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[1, 'rgba(255,90,30,0.85)'], [0.7, 'rgba(255,170,40,0.9)'], [0.4, 'rgba(255,240,180,0.95)']].forEach(([k, col], i) => {
      const w = s * k, h = s * k * (2.3 + 0.4 * Math.sin(time * 9 + i));
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.3, x + w * 0.5, y); ctx.quadraticCurveTo(x, y + w * 0.3, x - w * 0.5, y); ctx.quadraticCurveTo(x - w, y - h * 0.3, x, y - h); ctx.fill();
    });
    ctx.restore();
  }
  function drawSteam(time) {
    ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const s of steam) {
      const a = 0.25 + 0.2 * Math.sin(time * 1.5 + s.ph);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const y = rimY - 10 - i * 4; const x = cx + s.x + Math.sin(i * 0.4 + time * 2 + s.ph) * 6; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  active = { stop() { stopped = true; cancelAnimationFrame(raf); } };
  if (reducedMotion) frame(performance.now()); else raf = requestAnimationFrame(frame);
  return active;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
