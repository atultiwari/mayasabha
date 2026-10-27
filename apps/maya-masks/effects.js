// The effects library. Each effect paints one traced shape. `clip: true` effects are clipped to the
// shape's outline (the object itself changes); the others sit on or around its edges (borders,
// diyas on top, garlands). env: { t, sceneT, art, chars, level (music 0..1), pointer, lang, bursts }.
import { bbox, centroid, outlinePoints, topEdgePoints, tracePath } from '../../kit/room/shapes.js';
import { rangoliPetals } from './rangoli.js';
import { FIREWORK, sparkAt } from './fireworks.js';

const GOLD = '#ffcf5a';
const seedOf = (s) => [...s.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7);

function img(ctx, image, x, y, size, alpha = 1) {
  if (!image) return;
  const w = size * (image.width / image.height);
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x - w / 2, y - size / 2, w, size);
  ctx.globalAlpha = 1;
}

function strokeShape(ctx, s, color, width, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  tracePath(ctx, s);
  ctx.stroke();
  ctx.restore();
}

function chase(ctx, s, t, colorAt) {
  const b = bbox(s);
  const n = Math.max(16, Math.round((b.w + b.h) / 45));
  outlinePoints(s, n).forEach((p, i) => {
    const on = 0.25 + 0.75 * Math.max(0, Math.sin(t * 5 - i * 0.6));
    ctx.fillStyle = colorAt(i, n);
    ctx.globalAlpha = on;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function flameGlow(ctx, x, y, r, t, seed) {
  const flicker = 0.8 + 0.2 * Math.sin(t * 13 + seed) * Math.sin(t * 7.3 + seed * 2);
  const g = ctx.createRadialGradient(x, y, 2, x, y, r * flicker);
  g.addColorStop(0, 'rgba(255,240,180,0.95)');
  g.addColorStop(0.35, 'rgba(255,170,60,0.45)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * flicker, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Diwali ---------------------------------------------------------------------------------------

function goldBorder(ctx, s, env) {
  const glow = 0.75 + 0.25 * Math.sin(env.t * 2 + seedOf(s));
  strokeShape(ctx, s, `rgba(255,207,90,${glow})`, 12, 34);
  strokeShape(ctx, s, '#fff4c8', 3, 0);
}

function diyaTop(ctx, s, env) {
  const b = bbox(s);
  const n = Math.max(1, Math.round(b.w / 150));
  const size = Math.min(86, (b.w / n) * 0.9); // small objects get fewer, smaller diyas
  topEdgePoints(s, n).forEach((p, i) => {
    flameGlow(ctx, p.x, p.y - size * 0.72, size * 0.8, env.t, i + seedOf(s));
    img(ctx, env.art.diya, p.x, p.y - size * 0.4, size);
  });
}

function diyaCenter(ctx, s, env) {
  const c = centroid(s);
  const b = bbox(s);
  const size = Math.min(b.w, b.h) * 0.6;
  flameGlow(ctx, c.x, c.y - size * 0.35, size * 0.8, env.t, seedOf(s));
  img(ctx, env.art.diya, c.x, c.y, size);
}

function fireworkWindow(ctx, s, env) {
  const b = bbox(s);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, '#05051c');
  g.addColorStop(1, '#1b0d3a');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  for (const burst of env.bursts.filter((x) => x.shapeId === s.id)) {
    const fade = 1 - burst.age / FIREWORK.life;
    ctx.fillStyle = `hsla(${burst.hue},100%,70%,${fade})`;
    for (const spark of burst.sparks) {
      const p = sparkAt(burst, spark);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5 * (b.w / 400 + 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function warmGlow(ctx, s, env) {
  const b = bbox(s);
  const flicker = 0.85 + 0.15 * Math.sin(env.t * 3);
  const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h, 10, b.x + b.w / 2, b.y + b.h * 0.6, Math.max(b.w, b.h));
  g.addColorStop(0, `rgba(255,190,90,${0.9 * flicker})`);
  g.addColorStop(0.6, 'rgba(255,110,40,0.35)');
  g.addColorStop(1, 'rgba(120,20,40,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function greeting(ctx, s, env) {
  const b = bbox(s);
  const hindi = Math.floor(env.t / 4) % 2 === 0;
  const lines = hindi ? ['शुभ', 'दीपावली'] : ['Happy', 'Diwali'];
  const size = Math.min(b.w * 0.24, b.h * 0.13);
  ctx.save();
  ctx.fillStyle = GOLD;
  ctx.shadowColor = '#ff9a3c';
  ctx.shadowBlur = 24;
  ctx.font = `800 ${size}px system-ui, "Noto Sans Devanagari", sans-serif`;
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, b.x + b.w / 2, b.y + b.h * 0.42 + i * size * 1.2));
  ctx.restore();
}

function toran(ctx, s, env) {
  const b = bbox(s);
  const swags = Math.max(2, Math.round(b.w / 160));
  const top = b.y + 6;
  for (let k = 0; k < swags; k += 1) {
    const x0 = b.x + (b.w * k) / swags;
    const x1 = b.x + (b.w * (k + 1)) / swags;
    const flowers = 7;
    for (let i = 0; i <= flowers; i += 1) {
      const u = i / flowers;
      const x = x0 + (x1 - x0) * u;
      const y = top + Math.sin(Math.PI * u) * b.h * 0.08 + Math.sin(env.t * 1.5 + k) * 2;
      ctx.fillStyle = i % 2 ? '#ffb000' : '#ff7a00';
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3fae49';
    const leafX = (x0 + x1) / 2;
    const leafY = top + b.h * 0.08 + 14;
    ctx.beginPath();
    ctx.ellipse(leafX, leafY + 22 + Math.sin(env.t * 2 + k) * 3, 10, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lantern(ctx, s, env) {
  const b = bbox(s);
  const c = centroid(s);
  const glow = 0.8 + 0.2 * Math.sin(env.t * 2.5 + seedOf(s));
  const g = ctx.createRadialGradient(c.x, c.y, 5, c.x, c.y, Math.max(b.w, b.h) * 0.7);
  g.addColorStop(0, `rgba(255,220,140,${glow})`);
  g.addColorStop(0.5, `rgba(255,90,60,${0.7 * glow})`);
  g.addColorStop(1, 'rgba(160,20,40,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  img(ctx, env.art.lantern, c.x, c.y, Math.min(b.w, b.h) * 0.75, 0.9);
}

function goldChase(ctx, s, env) {
  chase(ctx, s, env.t, () => GOLD);
}

function rangoli(ctx, s, env) {
  const b = bbox(s);
  const c = centroid(s);
  ctx.fillStyle = 'rgba(20,6,30,0.85)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const rx = b.w / 2;
  const ry = b.h / 2;
  const spin = env.sceneT > 22 ? (env.sceneT - 22) * 0.05 : 0;
  for (const p of rangoliPetals(env.sceneT / 20)) {
    const a = p.angle + spin * (p.ring % 2 ? -1 : 1);
    const x = c.x + Math.cos(a) * p.radius * rx;
    const y = c.y + Math.sin(a) * p.radius * ry;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.reveal;
    ctx.beginPath();
    const len = p.size * rx * p.reveal;
    ctx.ellipse(0, 0, len, len * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx * 0.06, ry * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Magic ----------------------------------------------------------------------------------------

const FISH = ['fish', 'tropical-fish', 'blowfish', 'fish', 'tropical-fish'];

function aquarium(ctx, s, env) {
  const b = bbox(s);
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, '#0a4f8a');
  g.addColorStop(1, '#1fb0c9');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const seed = seedOf(s);
  FISH.forEach((kind, i) => {
    const speed = 0.06 + ((seed + i * 7) % 5) * 0.015;
    const dir = (seed + i) % 2 ? 1 : -1;
    const u = ((env.t * speed + i / FISH.length + seed * 0.01) % 1.4) - 0.2;
    const x = b.x + (dir > 0 ? u : 1 - u) * b.w;
    const y = b.y + b.h * (0.2 + 0.6 * (((seed + i * 13) % 10) / 10)) + Math.sin(env.t * 1.5 + i) * 8;
    const size = Math.min(b.w, b.h) * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir > 0 ? -1 : 1, 1);
    img(ctx, env.art[kind], 0, 0, size);
    ctx.restore();
  });
}

function portal(ctx, s, env) {
  const b = bbox(s);
  const c = centroid(s);
  const R = Math.max(b.w, b.h);
  ctx.fillStyle = '#0d0420';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  for (let i = 0; i < 14; i += 1) {
    const r = R * (1 - i / 14);
    ctx.strokeStyle = `hsla(${260 + i * 8 + env.t * 30},90%,${45 + i * 3}%,0.8)`;
    ctx.lineWidth = R / 18;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.6, env.t * (1 + i * 0.15), env.t * (1 + i * 0.15) + Math.PI * 1.3);
    ctx.stroke();
  }
  const cycle = env.t % 9;
  if (cycle > 5 && env.chars?.pet?.img) {
    const k = Math.sin(((cycle - 5) / 4) * Math.PI);
    img(ctx, env.chars.pet.img, c.x, c.y, Math.min(b.w, b.h) * 0.7 * k);
  }
}

function googlyEyes(ctx, s, env) {
  const b = bbox(s);
  const c = centroid(s);
  const r = Math.min(b.w, b.h) * 0.22;
  const look = env.pointer ?? { x: c.x + Math.sin(env.t) * 300, y: c.y + 200 };
  const blink = (env.t + seedOf(s)) % 5 > 4.85;
  for (const side of [-1, 1]) {
    const ex = c.x + side * r * 1.15;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, c.y, r, blink ? r * 0.1 : r, 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink) continue;
    const a = Math.atan2(look.y - c.y, look.x - ex);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(ex + Math.cos(a) * r * 0.45, c.y + Math.sin(a) * r * 0.45, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function rainbowSpin(ctx, s, env) {
  const b = bbox(s);
  const c = centroid(s);
  const g = ctx.createConicGradient(env.t * 2, c.x, c.y);
  ['#ff4f6d', '#ffd23e', '#7be08a', '#3ec8ff', '#a77bff', '#ff4f6d'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function starfield(ctx, s, env) {
  const b = bbox(s);
  ctx.fillStyle = '#03031a';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const seed = seedOf(s);
  const n = Math.round((b.w * b.h) / 2500);
  ctx.fillStyle = '#fffbe8';
  for (let i = 0; i < n; i += 1) {
    const x = b.x + (((i * 7919 + seed) % 1000) / 1000) * b.w;
    const y = b.y + (((i * 104729 + seed * 3) % 1000) / 1000) * b.h;
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(env.t * 1.5 + i));
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function rainbowChase(ctx, s, env) {
  chase(ctx, s, env.t, (i, n) => `hsl(${(i / n) * 360 + env.t * 60},90%,65%)`);
}

// ---- Party ----------------------------------------------------------------------------------------

function beatFill(ctx, s, env) {
  const b = bbox(s);
  const hue = (seedOf(s) * 47 + env.t * 40) % 360;
  ctx.fillStyle = `hsla(${hue},95%,60%,${0.15 + env.level * 0.85})`;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

function confetti(ctx, s, env) {
  const b = bbox(s);
  const seed = seedOf(s);
  for (let i = 0; i < 40; i += 1) {
    const x = b.x + (((i * 7919 + seed) % 1000) / 1000) * b.w + Math.sin(env.t * 2 + i) * 15;
    const y = b.y + (((env.t * (60 + (i % 7) * 15) + i * 97) % (b.h + 40)) - 20);
    ctx.fillStyle = `hsl(${(i * 37) % 360},90%,60%)`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(env.t * 3 + i);
    ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  }
}

/** Marigold garland hung around the outside of a shape (for pictures: decorates without covering). */
function garland(ctx, s, env) {
  const b = bbox(s);
  const n = Math.max(20, Math.round((b.w + b.h) / 22));
  outlinePoints(s, n).forEach((p, i) => {
    const c = centroid(s);
    const out = 16;
    const len = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    const x = p.x + ((p.x - c.x) / len) * out;
    const y = p.y + ((p.y - c.y) / len) * out + Math.sin(env.t * 2 + i) * 1.5;
    ctx.fillStyle = i % 3 === 2 ? '#ffd23e' : '#ff8a00';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A ring of little diyas all round the outside of a shape, each with its own flickering flame. */
function diyaRing(ctx, s, env) {
  const b = bbox(s);
  const size = Math.max(38, Math.min(60, (b.w + b.h) / 14));
  const n = Math.max(10, Math.round((2 * (b.w + b.h)) / (size * 1.25)));
  const c = centroid(s);
  outlinePoints(s, n).forEach((p, i) => {
    const len = Math.hypot(p.x - c.x, p.y - c.y) || 1;
    const out = size * 0.75; // far enough out that no diya covers the picture
    const x = p.x + ((p.x - c.x) / len) * out;
    const y = p.y + ((p.y - c.y) / len) * out;
    flameGlow(ctx, x, y - size * 0.45, size * 0.9, env.t, i + seedOf(s));
    img(ctx, env.art?.diya, x, y, size);
  });
}

// ---- Align ----------------------------------------------------------------------------------------

function align(ctx, s) {
  const b = bbox(s);
  const c = centroid(s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#111';
  ctx.font = '800 28px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(s.tag, c.x, c.y + 10);
}

/** Outline only, for lining up pictures without shining over them. */
function alignOutline(ctx, s) {
  strokeShape(ctx, s, '#ffffff', 6, 0);
  const c = centroid(s);
  const b = bbox(s);
  ctx.fillStyle = '#fff';
  ctx.font = '800 26px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(s.tag, c.x, b.y - 14);
}

export const EFFECTS = Object.freeze({
  garland: { clip: false, draw: garland },
  'align-outline': { clip: false, draw: alignOutline },
  'gold-border': { clip: false, draw: goldBorder },
  'diya-top': { clip: false, draw: diyaTop },
  'diya-center': { clip: false, draw: diyaCenter },
  'diya-ring': { clip: false, draw: diyaRing },
  'firework-window': { clip: true, draw: fireworkWindow },
  'warm-glow': { clip: true, draw: warmGlow },
  greeting: { clip: true, draw: greeting },
  toran: { clip: true, draw: toran },
  lantern: { clip: true, draw: lantern },
  'gold-chase': { clip: false, draw: goldChase },
  rangoli: { clip: true, draw: rangoli },
  aquarium: { clip: true, draw: aquarium },
  portal: { clip: true, draw: portal },
  'googly-eyes': { clip: true, draw: googlyEyes },
  'rainbow-spin': { clip: true, draw: rainbowSpin },
  starfield: { clip: true, draw: starfield },
  'rainbow-chase': { clip: false, draw: rainbowChase },
  'beat-fill': { clip: true, draw: beatFill },
  confetti: { clip: true, draw: confetti },
  align: { clip: true, draw: align },
});

/** Paints one effect onto one shape, clipping when the effect belongs inside the object. */
export function paintEffect(ctx, name, shape, env) {
  const effect = EFFECTS[name];
  if (!effect) return;
  ctx.save();
  if (effect.clip) {
    ctx.beginPath();
    tracePath(ctx, shape);
    ctx.clip();
  }
  effect.draw(ctx, shape, env);
  ctx.restore();
}
