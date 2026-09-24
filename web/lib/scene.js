// The Shrine's backdrop, painted live on a canvas: striped sunset, stars, sea, palms,
// two carved idols and bamboo torches. Intro draws everything in ~2.5 s, then it idles
// (flames flicker, waves roll, fronds sway) until someone prays.

const TAU = Math.PI * 2;
const clamp01 = t => Math.min(1, Math.max(0, t));
const ease = t => 1 - Math.pow(1 - clamp01(t), 3);
const back = t => { const c = 1.9; const x = clamp01(t) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const seg = (t, a, b) => clamp01((t - a) / (b - a));
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const INTRO = 2.6; // seconds
const C = {
  night: '#120b27', silhouette: '#0c0718', ground: '#08050f',
  wood: '#7b4a2b', woodLight: '#a8683d', woodDark: '#4e2c16', groove: '#2b160b',
  eye: '#f5dfb3', pupil: '#1b0d06', mouth: '#2a0f08', teeth: '#f7e7c4', tongue: '#e0566b',
  bamboo: '#d8b066', bambooDark: '#8d6a2c',
};

export function createScene(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const R = rng(11);
  const stars = Array.from({ length: 120 }, () => ({ x: R(), y: R(), r: 0.4 + R() * 1.4, ph: R() * TAU, sp: 0.5 + R() * 2 }));
  const flies = Array.from({ length: 16 }, () => ({ x: R(), y: 0.55 + R() * 0.4, ph: R() * TAU, sp: 0.15 + R() * 0.35, r: 1 + R() * 1.6 }));
  let W = 0, H = 0, dpr = 1, L = null, skyGrad = null;
  let backLayer = null, frontLayer = null;
  let t0 = performance.now(), raf = 0, pulseAt = -1e9, running = true;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    layout();
    backLayer = frontLayer = null;
    if (reducedMotion) frame(performance.now());
  }

  function layout() {
    const compact = W < 760;
    const horizon = H * (compact ? 0.5 : 0.58);
    const idolH = compact ? Math.min(H * 0.22, 190) : Math.min(H * 0.42, 400);
    const idolW = idolH * 0.64;
    L = {
      compact, horizon,
      sun: { x: W * 0.5, r: Math.min(W, H) * (compact ? 0.24 : 0.18) },
      palms: [
        { x: W * (compact ? -0.02 : 0.05), base: H * 1.02, h: H * (compact ? 0.62 : 0.8), lean: 0.3, dir: 1, seed: 1 },
        { x: W * (compact ? 1.02 : 0.95), base: H * 1.02, h: H * (compact ? 0.56 : 0.74), lean: 0.32, dir: -1, seed: 2 },
      ],
      idols: [
        { x: compact ? idolW * 0.52 : W * 0.13, base: H * 0.985, w: idolW, h: idolH, v: 0 },
        { x: compact ? W - idolW * 0.56 : W * 0.87, base: H * 0.985, w: idolW * 1.12, h: idolH * 0.86, v: 1 },
      ],
      torches: compact
        ? [{ x: idolW * 1.2, base: H * 0.99, h: idolH * 1.25 }, { x: W - idolW * 1.25, base: H * 0.99, h: idolH * 1.2 }]
        : [{ x: W / 2 - Math.max(400, W * 0.3), base: H * 0.99, h: H * 0.5 }, { x: W / 2 + Math.max(400, W * 0.3), base: H * 0.99, h: H * 0.48 }],
    };
    skyGrad = null;
  }

  // ---------- sky, sun, stars, sea ----------
  function sky(c, p) {
    c.fillStyle = C.night;
    c.fillRect(0, 0, W, L.horizon + 1);
    if (!skyGrad) {
      skyGrad = c.createLinearGradient(0, 0, 0, L.horizon);
      skyGrad.addColorStop(0, '#120b27'); skyGrad.addColorStop(0.42, '#3a1a57'); skyGrad.addColorStop(0.7, '#9c3a63');
      skyGrad.addColorStop(0.88, '#f0784a'); skyGrad.addColorStop(1, '#ffc65c');
    }
    c.globalAlpha = ease(p);
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, L.horizon + 1);
    c.globalAlpha = 1;
  }

  function sun(c, p) {
    const { x, r } = L.sun;
    const y = L.horizon + r * 0.18 + (1 - ease(p)) * r * 1.2;
    c.save();
    c.beginPath(); c.rect(0, 0, W, L.horizon); c.clip();
    const g = c.createLinearGradient(0, y - r, 0, y + r * 0.2);
    g.addColorStop(0, '#ffe98a'); g.addColorStop(0.55, '#ffa24f'); g.addColorStop(1, '#ff5e62');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    // Mid-century stripes cut through the lower half, painted in the sky's own colors.
    c.fillStyle = skyGrad;
    for (let i = 0; i < 6; i++) {
      const sy = y - r * 0.08 + i * r * 0.13;
      c.fillRect(x - r - 2, sy, r * 2 + 4, 2 + i * 1.6);
    }
    c.restore();
  }

  function drawStars(c, time, p) {
    for (const s of stars) {
      const y = s.y * L.horizon * 0.72;
      const a = p * (0.45 + 0.55 * Math.sin(time * s.sp + s.ph)) * (1 - y / (L.horizon * 0.9));
      if (a <= 0.02) continue;
      c.fillStyle = `rgba(255,244,214,${a.toFixed(3)})`;
      c.beginPath(); c.arc(s.x * W, y, s.r, 0, TAU); c.fill();
    }
  }

  function sea(c, time, p) {
    const top = L.horizon;
    const g = c.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#34427f'); g.addColorStop(0.3, '#1d2c5c'); g.addColorStop(1, '#0b1330');
    c.fillStyle = g;
    c.fillRect(0, top, W, H - top);
    // Sunset glitter on the water.
    for (let i = 0; i < 24; i++) {
      const yy = top + 3 + i * i * 0.85;
      if (yy > H) break;
      const w = L.sun.r * 1.1 * (1 - i / 28) * (0.55 + 0.45 * Math.sin(time * 1.7 + i * 1.3));
      c.fillStyle = `rgba(255,190,100,${(0.6 * (1 - i / 24) * p).toFixed(3)})`;
      c.fillRect(L.sun.x - w / 2 + Math.sin(time * 1.1 + i) * 7, yy, w, 2);
    }
    c.lineWidth = 1.4;
    for (let k = 0; k < 8; k++) {
      const yy = top + 8 + k * k * 5.5 + k * 7;
      if (yy > H) break;
      c.strokeStyle = `rgba(150,205,235,${((0.12 + 0.035 * k) * p).toFixed(3)})`;
      c.beginPath();
      const reveal = W * ease(p * 1.2 - k * 0.05);
      for (let x = 0; x <= reveal; x += 14) {
        const y2 = yy + Math.sin(x * 0.018 + time * (0.7 + k * 0.12) + k) * (1.4 + k * 0.55);
        if (x === 0) c.moveTo(x, y2); else c.lineTo(x, y2);
      }
      c.stroke();
    }
  }

  // ---------- palms ----------
  function palm(c, P, p, time) {
    const { x, base, h, lean, dir } = P;
    const topX = x + dir * lean * h, topY = base - h;
    const ctrlX = x + dir * lean * h * 0.12, ctrlY = base - h * 0.55;
    const q = t => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrlX + t * t * topX, (1 - t) * (1 - t) * base + 2 * (1 - t) * t * ctrlY + t * t * topY];
    const grow = ease(seg(p, 0, 0.55));
    const N = 28;
    c.fillStyle = C.silhouette;
    for (let i = 0; i < Math.max(1, Math.floor(N * grow)); i++) {
      const a = i / N, b = (i + 1) / N;
      const [x0, y0] = q(a), [x1, y1] = q(b);
      const w0 = h * 0.042 * (1 - a * 0.5), w1 = h * 0.042 * (1 - b * 0.5);
      c.beginPath();
      c.moveTo(x0 - w0, y0); c.lineTo(x1 - w1 * 1.12, y1 + 1.5); c.lineTo(x1 + w1 * 1.12, y1 + 1.5); c.lineTo(x0 + w0, y0);
      c.closePath(); c.fill();
    }
    const fp = ease(seg(p, 0.45, 1));
    if (fp <= 0) return;
    const [cx, cy] = q(1);
    const sway = Math.sin(time * 0.7 + P.seed * 2) * 0.05;
    const angles = [-2.75, -2.25, -1.8, -1.35, -0.9, -0.45, 0.05, 0.45, -3.1];
    angles.forEach((a, i) => {
      const len = h * 0.36 * fp * (0.85 + ((i * 37) % 10) / 40);
      frond(c, cx, cy, a + sway * (1 + (i % 3) * 0.4), len, 0.35 + (i % 4) * 0.08);
    });
    c.fillStyle = '#1a0f0a';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cx + (i - 1) * h * 0.018, cy + h * 0.012 + (i % 2) * h * 0.01, h * 0.016 * fp, 0, TAU); c.fill(); }
  }

  function frond(c, x, y, ang, len, droop) {
    const tipX = x + Math.cos(ang) * len, tipY = y + Math.sin(ang) * len + droop * len;
    const mx = x + Math.cos(ang) * len * 0.55, my = y + Math.sin(ang) * len * 0.55 - len * 0.1;
    const P = t => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * tipX, (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * tipY];
    c.strokeStyle = C.silhouette; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, tipX, tipY); c.stroke();
    c.fillStyle = C.silhouette;
    for (let i = 1; i < 20; i++) {
      const t = i / 20;
      const [px, py] = P(t);
      const [qx, qy] = P(Math.min(1, t + 0.02));
      let tx = qx - px, ty = qy - py;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const leaf = len * 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25);
      for (const side of [-1, 1]) {
        let dx = -ty * side * 0.75 + tx * 0.45, dy = tx * side * 0.75 + ty * 0.45 + 0.55;
        const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        c.beginPath();
        c.moveTo(px - tx * 3, py - ty * 3); c.lineTo(px + dx * leaf, py + dy * leaf); c.lineTo(px + tx * 4, py + ty * 4);
        c.closePath(); c.fill();
      }
    }
  }

  // ---------- ground ----------
  function ground(c, p) {
    const a = ease(p);
    c.fillStyle = C.ground;
    c.beginPath();
    c.moveTo(0, H);
    const top = H - H * 0.07 * a;
    for (let x = 0; x <= W; x += 18) c.lineTo(x, top + Math.sin(x * 0.05) * 5 - ((x * 13) % 23) * 0.6 * a);
    c.lineTo(W, H); c.closePath(); c.fill();
    // Grass tufts and a few big leaves at the corners.
    for (let x = 0; x < W; x += 26) {
      const hgt = (14 + ((x * 7) % 19)) * a;
      c.beginPath(); c.moveTo(x - 6, top + 6); c.lineTo(x + 2, top - hgt); c.lineTo(x + 7, top + 6); c.closePath(); c.fill();
    }
    for (const [lx, dir] of [[0, 1], [W, -1]]) {
      for (let i = 0; i < 3; i++) {
        const len = (L.compact ? 90 : 150) * (0.8 + i * 0.25) * a;
        const ang = dir > 0 ? -0.35 - i * 0.45 : Math.PI + 0.35 + i * 0.45;
        c.save(); c.translate(lx, H - 4); c.rotate(ang);
        c.beginPath(); c.ellipse(len * 0.5, 0, len * 0.5, len * 0.2, 0, 0, TAU); c.fill();
        c.restore();
      }
    }
  }

  // ---------- idols ----------
  function idol(c, I, p, glow) {
    if (p <= 0) return;
    const { x, base, w, h, v } = I;
    const x0 = x - w / 2, y0 = base - h;
    const body = () => {
      c.beginPath();
      if (v === 0) {
        c.moveTo(x0 + w * 0.1, base);
        c.lineTo(x0 + w * 0.08, y0 + h * 0.3);
        c.quadraticCurveTo(x0 + w * 0.08, y0, x0 + w * 0.5, y0);
        c.quadraticCurveTo(x0 + w * 0.92, y0, x0 + w * 0.92, y0 + h * 0.3);
        c.lineTo(x0 + w * 0.9, base);
      } else {
        c.moveTo(x0 + w * 0.12, base);
        c.lineTo(x0 + w * 0.02, y0 + h * 0.2);
        c.quadraticCurveTo(x0 + w * 0.5, y0 - h * 0.08, x0 + w * 0.98, y0 + h * 0.2);
        c.lineTo(x0 + w * 0.88, base);
      }
      c.closePath();
    };
    // 1) outline carved in, 2) wood fills, 3) features pop in one by one.
    const outline = seg(p, 0, 0.35), fill = ease(seg(p, 0.25, 0.5));
    c.save();
    c.lineWidth = Math.max(2, w * 0.018);
    c.strokeStyle = C.bamboo;
    const perim = (w + h) * 2.4;
    c.setLineDash([perim, perim]); c.lineDashOffset = perim * (1 - outline);
    body(); c.stroke();
    c.setLineDash([]);
    if (fill > 0) {
      c.globalAlpha = fill;
      const g = c.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, C.woodDark); g.addColorStop(0.35, C.woodLight); g.addColorStop(0.7, C.wood); g.addColorStop(1, C.woodDark);
      c.fillStyle = g; body(); c.fill();
      c.globalAlpha = 1;
    }
    const pop = (a, b, cxp, cyp, fn) => {
      const k = seg(p, a, b);
      if (k <= 0) return;
      c.save();
      c.translate(cxp, cyp); c.scale(0.4 + 0.6 * back(k), 0.4 + 0.6 * back(k)); c.translate(-cxp, -cyp);
      c.globalAlpha = Math.min(1, k * 1.5);
      fn();
      c.restore();
    };
    c.fillStyle = C.groove; c.strokeStyle = C.groove; c.lineCap = 'round';
    if (v === 0) {
      // headband with zigzag
      pop(0.5, 0.62, x, y0 + h * 0.15, () => {
        c.lineWidth = w * 0.022;
        c.beginPath(); c.moveTo(x0 + w * 0.12, y0 + h * 0.1); c.lineTo(x0 + w * 0.88, y0 + h * 0.1); c.stroke();
        c.beginPath(); c.moveTo(x0 + w * 0.1, y0 + h * 0.2); c.lineTo(x0 + w * 0.9, y0 + h * 0.2); c.stroke();
        c.lineWidth = w * 0.014;
        c.beginPath();
        for (let i = 0; i <= 8; i++) { const zx = x0 + w * (0.14 + i * 0.09); c.lineTo(zx, y0 + h * (i % 2 ? 0.125 : 0.18)); }
        c.stroke();
      });
      eyes(c, [[x0 + w * 0.31, y0 + h * 0.36], [x0 + w * 0.69, y0 + h * 0.36]], w * 0.12, h * 0.065, glow, pop, 0.6, 0.74, false);
      pop(0.7, 0.84, x, y0 + h * 0.5, () => nose(c, x, y0 + h * 0.43, w * 0.34, h * 0.14));
      pop(0.8, 0.95, x, y0 + h * 0.68, () => mouth(c, x, y0 + h * 0.6, w * 0.62, h * 0.15, false));
      pop(0.9, 1, x, y0 + h * 0.88, () => {
        c.lineWidth = w * 0.02;
        c.beginPath(); c.moveTo(x0 + w * 0.14, y0 + h * 0.84); c.quadraticCurveTo(x, y0 + h * 0.93, x0 + w * 0.86, y0 + h * 0.84); c.stroke();
        c.beginPath(); c.moveTo(x0 + w * 0.2, y0 + h * 0.92); c.quadraticCurveTo(x, y0 + h * 0.99, x0 + w * 0.8, y0 + h * 0.92); c.stroke();
      });
    } else {
      pop(0.5, 0.62, x, y0 + h * 0.1, () => {
        c.lineWidth = w * 0.02;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x0 + w * (0.22 + i * 0.14), y0 + h * 0.12, w * 0.035, 0, TAU); c.stroke(); }
      });
      eyes(c, [[x0 + w * 0.3, y0 + h * 0.36], [x0 + w * 0.7, y0 + h * 0.36]], w * 0.13, w * 0.13, glow, pop, 0.6, 0.74, true);
      pop(0.7, 0.84, x, y0 + h * 0.52, () => nose(c, x, y0 + h * 0.45, w * 0.26, h * 0.13));
      pop(0.8, 0.95, x, y0 + h * 0.7, () => mouth(c, x, y0 + h * 0.62, w * 0.34, h * 0.18, true));
      pop(0.88, 1, x, y0 + h * 0.4, () => {
        c.lineWidth = w * 0.02;
        for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * w * 0.47, y0 + h * 0.45, w * 0.05, s > 0 ? -1.6 : 1.6, s > 0 ? 2.6 : -1.6 + TAU * 0.7); c.stroke(); }
      });
    }
    c.restore();
  }

  function eyes(c, centers, rx, ry, glow, pop, a, b, round) {
    for (const [ex, ey] of centers) {
      pop(a, b, ex, ey, () => {
        c.fillStyle = C.groove;
        c.beginPath(); c.ellipse(ex, ey, rx * 1.18, ry * 1.25, 0, 0, TAU); c.fill();
        c.fillStyle = C.eye;
        c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, 0, TAU); c.fill();
        c.fillStyle = C.pupil;
        const pr = Math.min(rx, ry) * (round ? 0.5 : 0.62);
        c.beginPath(); c.arc(ex, ey + ry * 0.08, pr, 0, TAU); c.fill();
        c.fillStyle = '#fff8e8';
        c.beginPath(); c.arc(ex - pr * 0.35, ey - pr * 0.3, pr * 0.28, 0, TAU); c.fill();
        if (glow > 0.02) {
          const g = c.createRadialGradient(ex, ey, 0, ex, ey, rx * 2.2);
          g.addColorStop(0, `rgba(255,170,60,${(0.55 * glow).toFixed(3)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
          c.fillStyle = g; c.beginPath(); c.arc(ex, ey, rx * 2.2, 0, TAU); c.fill();
        }
      });
    }
  }

  function nose(c, x, y, w, h) {
    c.fillStyle = C.woodLight;
    c.beginPath();
    c.moveTo(x - w * 0.18, y); c.lineTo(x + w * 0.18, y);
    c.quadraticCurveTo(x + w * 0.55, y + h * 0.75, x + w * 0.5, y + h);
    c.lineTo(x - w * 0.5, y + h);
    c.quadraticCurveTo(x - w * 0.55, y + h * 0.75, x - w * 0.18, y);
    c.fill();
    c.strokeStyle = C.groove; c.lineWidth = Math.max(2, w * 0.06);
    c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * w * 0.26, y + h * 0.78, w * 0.1, 0, TAU); c.fillStyle = C.groove; c.fill(); }
  }

  function mouth(c, x, y, w, h, round) {
    c.fillStyle = C.mouth;
    c.beginPath();
    if (round) c.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, TAU);
    else { c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.quadraticCurveTo(x + w / 2, y + h, x, y + h); c.quadraticCurveTo(x - w / 2, y + h, x - w / 2, y); }
    c.fill();
    c.fillStyle = C.tongue;
    c.beginPath(); c.ellipse(x, y + h * 0.78, w * 0.2, h * 0.18, 0, 0, TAU); c.fill();
    c.fillStyle = C.teeth;
    const n = round ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const tx = x - w * 0.38 + (i + 0.5) * (w * 0.76 / n);
      c.fillRect(tx - w * 0.035, y + h * (round ? 0.12 : 0.02), w * 0.07, h * 0.24);
    }
  }

  // ---------- torches ----------
  function torchPole(c, T, p) {
    const k = ease(p);
    const top = T.base - T.h * k;
    const pw = Math.max(8, T.h * 0.035);
    c.fillStyle = C.bamboo;
    c.fillRect(T.x - pw / 2, top, pw, T.base - top);
    c.fillStyle = C.bambooDark;
    for (let y = T.base - 30; y > top + 10; y -= T.h * 0.16) c.fillRect(T.x - pw / 2 - 1, y, pw + 2, 3);
    if (k >= 0.99) {
      // woven basket
      const bw = pw * 2.4, bh = pw * 1.8;
      c.fillStyle = '#6b4a1f';
      c.beginPath(); c.moveTo(T.x - bw / 2, top - bh); c.lineTo(T.x + bw / 2, top - bh); c.lineTo(T.x + pw * 0.6, top); c.lineTo(T.x - pw * 0.6, top); c.closePath(); c.fill();
      c.strokeStyle = '#3b2a10'; c.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(T.x - bw / 2 + i * bw / 4, top - bh); c.lineTo(T.x - pw * 0.6 + i * pw * 0.3, top); c.stroke(); }
    }
  }

  function flame(c, x, y, s, time, power, seed) {
    if (power <= 0.01) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const glowR = s * 5.5 * power;
    const g = c.createRadialGradient(x, y - s, 0, x, y - s, glowR);
    g.addColorStop(0, `rgba(255,150,50,${(0.33 * Math.min(1, power)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - s, glowR, 0, TAU); c.fill();
    const layers = [[1, 'rgba(255,80,30,0.85)'], [0.72, 'rgba(255,165,40,0.9)'], [0.42, 'rgba(255,238,170,0.95)']];
    layers.forEach(([k, col], i) => {
      const w = s * k * (0.62 + 0.06 * Math.sin(time * 11 + seed + i));
      const hh = s * k * power * (2.1 + 0.35 * Math.sin(time * 8.3 + seed * 2 + i * 1.7) + 0.2 * Math.sin(time * 17 + i));
      const lean = Math.sin(time * 3.1 + seed) * s * 0.18;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x + lean, y - hh);
      c.bezierCurveTo(x + w * 0.35 + lean, y - hh * 0.55, x + w, y - hh * 0.3, x + w * 0.62, y);
      c.quadraticCurveTo(x, y + w * 0.35, x - w * 0.62, y);
      c.bezierCurveTo(x - w, y - hh * 0.3, x - w * 0.35 + lean, y - hh * 0.55, x + lean, y - hh);
      c.fill();
    });
    c.restore();
  }

  function fireflies(c, time, p) {
    for (const f of flies) {
      const fx = f.x * W + Math.sin(time * f.sp + f.ph) * 40;
      const fy = f.y * H + Math.cos(time * f.sp * 1.3 + f.ph) * 22;
      const a = p * (0.35 + 0.65 * Math.max(0, Math.sin(time * 2.2 + f.ph)));
      c.fillStyle = `rgba(255,236,150,${(a * 0.9).toFixed(3)})`;
      c.beginPath(); c.arc(fx, fy, f.r, 0, TAU); c.fill();
    }
  }

  // ---------- composition ----------
  function paintBack(c, t) {
    sky(c, seg(t, 0, 0.7));
    sun(c, seg(t, 0.15, 1.3));
  }
  function paintFront(c, t, time) {
    ground(c, seg(t, 0.3, 0.9));
    L.idols.forEach((I, i) => idol(c, I, seg(t, 0.7 + i * 0.25, 2.0 + i * 0.25), 0));
    L.torches.forEach(T => torchPole(c, T, seg(t, 1.2, 1.7)));
  }

  function offscreen(paint) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width; cv.height = canvas.height;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(c);
    return cv;
  }

  function frame(now) {
    const t = reducedMotion ? INTRO + 1 : (now - t0) / 1000;
    const time = now / 1000;
    const settled = t > INTRO + 0.2;
    const pulse = Math.exp(-(now - pulseAt) / 900);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (settled) {
      if (!backLayer) backLayer = offscreen(c => paintBack(c, INTRO));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(backLayer, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      paintBack(ctx, t);
    }
    drawStars(ctx, time, seg(t, 0.5, 1.4) * (1 + pulse * 0.6));
    sea(ctx, time, seg(t, 0.2, 1.1));
    L.palms.forEach((P, i) => palm(ctx, P, seg(t, 0.35 + i * 0.12, 1.7 + i * 0.12), reducedMotion ? 0 : time));
    if (settled) {
      if (!frontLayer) frontLayer = offscreen(c => paintFront(c, INTRO + 1, time));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(frontLayer, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      paintFront(ctx, t, time);
    }
    // Eyes glow once the torches are lit, and blaze when a prayer lands.
    const lit = seg(t, 1.8, 2.4);
    const glow = lit * (0.25 + 0.12 * Math.sin(time * 2)) + pulse * 0.9;
    if (glow > 0.02) L.idols.forEach(I => eyeGlow(ctx, I, glow));
    L.torches.forEach((T, i) => {
      const top = T.base - T.h;
      const pw = Math.max(8, T.h * 0.035);
      flame(ctx, T.x, top - pw * 1.6, pw * 1.7, reducedMotion ? 0 : time, ease(lit) * (1 + pulse * 0.9), i * 3.1);
    });
    fireflies(ctx, time, seg(t, 2, 2.6));
    if (running && !reducedMotion) raf = requestAnimationFrame(frame);
  }

  function eyeGlow(c, I, glow) {
    const { x, base, w, h, v } = I;
    const x0 = x - w / 2, y0 = base - h;
    const pts = [[x0 + w * (v ? 0.3 : 0.31), y0 + h * 0.36], [x0 + w * (v ? 0.7 : 0.69), y0 + h * 0.36]];
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [ex, ey] of pts) {
      const r = w * 0.2;
      const g = c.createRadialGradient(ex, ey, 0, ex, ey, r);
      g.addColorStop(0, `rgba(255,190,90,${Math.min(0.85, glow * 0.7).toFixed(3)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fill();
    }
    c.restore();
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!reducedMotion) { running = true; raf = requestAnimationFrame(frame); }
  });
  resize();
  if (reducedMotion) frame(performance.now()); else raf = requestAnimationFrame(frame);

  return {
    pulse() { pulseAt = performance.now(); if (reducedMotion) frame(performance.now()); },
  };
}
