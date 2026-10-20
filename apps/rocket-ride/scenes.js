// One draw function per chapter of the rocket story, plus the rocket itself and the travel scene.
// `v` is a read-only view model built by main.js every frame (see buildView there).
import { drawCartoonPlanet, drawSpace, drawStormBubble, drawStreaks } from './cartoon.js';

const ROCKET = 440;
const MARS = { base: '#f08a5d', shade: '#a8442a', bands: ['rgba(150,60,30,0.35)', 'rgba(255,190,150,0.25)'] };
const JUPITER = { base: '#f3dcc0', shade: '#b8875a', bands: ['#e3bf94', '#c99a6b', '#f1dfc2', '#b8875a', '#e9d2b0'] };
const MOON_GREY = { base: '#e6e6ee', shade: '#8d8d9c' };

function img(ctx, image, x, y, size, { rot = 0, alpha = 1, flip = false } = {}) {
  if (!image) return;
  const w = size * (image.width / image.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -w / 2, -size / 2, w, size);
  ctx.restore();
}

function porthole(ctx, image, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1d2d5a';
  ctx.fill();
  ctx.clip();
  if (image) img(ctx, image, x, y + r * 0.15, r * 2.3);
  ctx.restore();
}

function flame(ctx, x, y, size, t, power) {
  if (power <= 0) return;
  for (let i = 0; i < 3; i += 1) {
    const len = size * (0.35 + 0.25 * power) * (1 + 0.15 * Math.sin(t * 30 + i * 2));
    const w = size * (0.16 - i * 0.04);
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, i === 2 ? '#fff6c8' : '#ffd23e');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + len * 1.2, x + w, y);
    ctx.fill();
  }
}

/** The rocket, pointing up, with the child and the co-pilot in two portholes. */
export function drawRocket(ctx, v, x, y, { size = ROCKET, power = 0, wobble = 0, shades = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wobble);
  flame(ctx, 0, size * 0.43, size, v.t, power);
  img(ctx, v.art.rocket, 0, 0, size, { rot: -Math.PI / 4 });
  porthole(ctx, shades ? v.art.sunglasses : v.art.astronaut, size * 0.02, -size * 0.12, size * 0.125);
  porthole(ctx, v.pilot?.img, size * 0.02, size * 0.15, size * 0.1);
  ctx.restore();
}

function ground(ctx, size, y, top, bottom, rocks = []) {
  const g = ctx.createLinearGradient(0, y, 0, size.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, y + 40);
  ctx.quadraticCurveTo(size.w / 2, y - 60, size.w, y + 40);
  ctx.lineTo(size.w, size.h);
  ctx.lineTo(0, size.h);
  ctx.fill();
  for (const r of rocks) {
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.ellipse(r.x * size.w, y + r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CRATERS = [
  { x: 0.12, y: 120, rx: 110, ry: 26, color: 'rgba(90,90,105,0.5)' }, { x: 0.4, y: 200, rx: 70, ry: 18, color: 'rgba(90,90,105,0.5)' },
  { x: 0.78, y: 140, rx: 140, ry: 30, color: 'rgba(90,90,105,0.5)' }, { x: 0.93, y: 260, rx: 60, ry: 14, color: 'rgba(90,90,105,0.5)' },
];
const MARS_ROCKS = [
  { x: 0.1, y: 110, rx: 50, ry: 22, color: '#7a3220' }, { x: 0.33, y: 230, rx: 30, ry: 14, color: '#8a3a24' },
  { x: 0.83, y: 160, rx: 70, ry: 28, color: '#7a3220' },
];

function sceneLaunch(ctx, v) {
  const { size } = v;
  const rise = v.liftoff ** 2 * size.h * 1.2;
  drawSpace(ctx, size, v.stars, v.t, { top: '#0b1550', bottom: '#4a7bd0' });
  img(ctx, v.art['earth-asia'], size.w / 2, size.h + 820 + rise * 0.6, 2300);
  drawRocket(ctx, v, size.w / 2, size.h - 560 - rise, { power: v.liftoff > 0 ? 1 : 0.15, wobble: v.liftoff > 0 ? Math.sin(v.t * 20) * 0.02 : 0 });
}

function sceneMoon(ctx, v) {
  const { size } = v;
  const groundY = size.h * 0.68;
  drawSpace(ctx, size, v.stars, v.t, { top: '#020214', bottom: '#11112a' });
  img(ctx, v.art['earth-asia'], size.w * 0.82, size.h * 0.2, 220);
  ground(ctx, size, groundY, MOON_GREY.base, MOON_GREY.shade, CRATERS);
  drawRocket(ctx, v, size.w * 0.22, groundY - 170, { size: 360 });
  for (const f of v.footprints) {
    ctx.fillStyle = 'rgba(70,70,85,0.7)';
    ctx.beginPath();
    ctx.ellipse(f.x - 18, groundY + 70, 14, 26, -0.2, 0, Math.PI * 2);
    ctx.ellipse(f.x + 18, groundY + 80, 14, 26, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  img(ctx, v.art.astronaut, v.astronautX, groundY - 80 - v.jump, 280);
}

function sceneMars(ctx, v) {
  const { size } = v;
  const groundY = size.h * 0.66;
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#d98a78');
  sky.addColorStop(1, '#f2c3a0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size.w, size.h);
  ground(ctx, size, groundY, '#c4552f', '#7e2e18', MARS_ROCKS);
  drawRocket(ctx, v, size.w * 0.22, groundY - 170, { size: 360 });
  const clear = v.cleared;
  img(ctx, v.art.robot, size.w * 0.64, groundY - 40, 280, { rot: clear > 0.9 ? Math.sin(v.t * 6) * 0.15 : 0, alpha: 0.25 + 0.75 * clear });
  ctx.fillStyle = '#9b5a3c';
  for (const d of v.dust) {
    ctx.globalAlpha = (1 - clear) * 0.55;
    ctx.beginPath();
    ctx.arc(((d.x + v.t * d.speed) % 1.2 - 0.1) * size.w, d.y * size.h, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = (1 - clear) * 0.45;
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.globalAlpha = 1;
}

function sceneJupiter(ctx, v) {
  const { size } = v;
  drawSpace(ctx, size, v.stars, v.t);
  drawCartoonPlanet(ctx, { x: size.w * 0.74, y: size.h * 0.55, r: 520, ...JUPITER, spot: true, mood: v.progress > 0 ? 'wow' : 'smile', t: v.t });
  drawRocket(ctx, v, size.w * 0.16, size.h * 0.5 + Math.sin(v.t * 2) * 20, { size: 340, power: 0.4, wobble: Math.sin(v.t * 1.5) * 0.05 });
  for (const b of v.storms) drawStormBubble(ctx, b, v.t);
}

function sceneSaturn(ctx, v) {
  const { size } = v;
  drawSpace(ctx, size, v.stars, v.t);
  img(ctx, v.art['ringed-planet'], size.w / 2, size.h * 0.55, 820);
  const a = v.t * 0.7;
  const behind = Math.sin(a) < 0;
  const rocketAt = { x: size.w / 2 + Math.cos(a) * 720, y: size.h * 0.55 + Math.sin(a) * 150 };
  const s = 230 * (behind ? 0.75 : 1);
  if (behind) ctx.globalAlpha = 0.7;
  drawRocket(ctx, v, rocketAt.x, rocketAt.y, { size: s, power: 0.5, wobble: Math.cos(a) * 0.4 });
  ctx.globalAlpha = 1;
  for (let i = 0; i < v.counted; i += 1) {
    const x = size.w / 2 + (i - 2) * 230;
    const bob = Math.sin(v.t * 3 + i) * 10;
    drawCartoonPlanet(ctx, { x, y: 150 + bob, r: 70, ...MOON_GREY, mood: 'smile', t: v.t + i });
    ctx.fillStyle = '#ffe08a';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, 290 + bob);
  }
}

function sceneSun(ctx, v) {
  const { size } = v;
  const g = ctx.createRadialGradient(size.w / 2, 0, 50, size.w / 2, 0, size.w * 0.8);
  g.addColorStop(0, '#ffe9a0');
  g.addColorStop(0.4, '#ff9a3c');
  g.addColorStop(1, '#5a1a2a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size.w, size.h);
  img(ctx, v.art.sun, size.w / 2, size.h * 0.3, 680, { rot: v.waving ? Math.sin(v.t * 5) * 0.12 : 0 });
  ctx.strokeStyle = 'rgba(255,240,200,0.25)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 6; i += 1) {
    const y = size.h * 0.62 + i * 55;
    ctx.beginPath();
    for (let k = 0; k <= 24; k += 1) ctx.lineTo((k / 24) * size.w, y + Math.sin(k * 0.8 + v.t * 4 + i) * 10);
    ctx.stroke();
  }
  drawRocket(ctx, v, size.w * 0.5, size.h * 0.78, { size: 330, power: 0.5, shades: true, wobble: Math.sin(v.t * 2) * 0.04 });
}

const GOODNIGHT = [
  (ctx, v, x, y, mood) => drawCartoonPlanet(ctx, { x, y, r: 85, ...MOON_GREY, mood, t: v.t }),
  (ctx, v, x, y, mood) => drawCartoonPlanet(ctx, { x, y, r: 75, ...MARS, mood, t: v.t }),
  (ctx, v, x, y, mood) => drawCartoonPlanet(ctx, { x, y, r: 115, ...JUPITER, spot: true, mood, t: v.t }),
  (ctx, v, x, y) => img(ctx, v.art['ringed-planet'], x, y, 230),
];

function sceneHome(ctx, v) {
  const { size } = v;
  drawSpace(ctx, size, v.stars, v.t, { top: '#03031a', bottom: '#14143a' });
  img(ctx, v.art['earth-asia'], size.w / 2, size.h + 760, 2100);
  img(ctx, v.art.bed, size.w / 2, size.h * 0.66, 380);
  img(ctx, v.art.astronaut, size.w / 2 - 40, size.h * 0.6, 200, { rot: -Math.PI / 2 });
  img(ctx, v.pilot?.img, size.w / 2 + 140, size.h * 0.6, 150);
  GOODNIGHT.forEach((draw, i) => {
    if (i >= v.goodnightShown) return;
    draw(ctx, v, size.w * (0.2 + i * 0.2), size.h * 0.2, i < v.goodnightAsleep ? 'sleep' : 'smile');
  });
}

const DESTINATION = {
  moon: (ctx, v, x, y, s) => img(ctx, v.art['moon-face'], x, y, s),
  mars: (ctx, v, x, y, s) => drawCartoonPlanet(ctx, { x, y, r: s / 2, ...MARS, t: v.t }),
  jupiter: (ctx, v, x, y, s) => drawCartoonPlanet(ctx, { x, y, r: s / 2, ...JUPITER, spot: true, t: v.t }),
  saturn: (ctx, v, x, y, s) => img(ctx, v.art['ringed-planet'], x, y, s * 1.3),
  sun: (ctx, v, x, y, s) => img(ctx, v.art.sun, x, y, s),
  home: (ctx, v, x, y, s) => img(ctx, v.art['earth-asia'], x, y, s),
};

function sceneTravel(ctx, v) {
  const { size } = v;
  drawSpace(ctx, size, v.stars, v.t, { top: '#050520', bottom: '#1d0f3a' });
  drawStreaks(ctx, size, v.stars, v.t, 0.9);
  const grow = Math.max(0, (v.travel - 0.45) / 0.55);
  if (grow > 0 && DESTINATION[v.nextId]) DESTINATION[v.nextId](ctx, v, size.w / 2, size.h * 0.22, 40 + grow ** 2 * 520);
  drawRocket(ctx, v, size.w / 2, size.h * 0.68, { power: 1, wobble: Math.sin(v.t * 3) * 0.06 });
}

const SCENES = { launch: sceneLaunch, moon: sceneMoon, mars: sceneMars, jupiter: sceneJupiter, saturn: sceneSaturn, sun: sceneSun, home: sceneHome };

function drawCaption(ctx, size, text) {
  if (!text) return;
  ctx.font = '700 56px system-ui, "Noto Sans Devanagari", sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > 1500 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  lines.push(line);
  const h = lines.length * 72 + 40;
  const y0 = size.h - h - 40;
  ctx.fillStyle = 'rgba(5,5,25,0.62)';
  ctx.beginPath();
  ctx.roundRect(size.w / 2 - 820, y0, 1640, h, 36);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, size.w / 2, y0 + 22 + i * 72));
  ctx.textBaseline = 'alphabetic';
}

function drawBigNumber(ctx, size, big) {
  if (!big) return;
  const k = Math.min(1, big.age / 0.25);
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, big.age - 0.8) / 0.5);
  ctx.fillStyle = '#ffe08a';
  ctx.font = `900 ${Math.round(260 * (0.6 + 0.4 * k))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(big.text, size.w * 0.25, size.h * 0.45); // left third: clear of the rocket and planets
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, v) {
  const { size } = v;
  drawSpace(ctx, size, v.stars, v.t);
  img(ctx, v.art['moon-face'], size.w * 0.8, size.h * 0.25, 300);
  drawRocket(ctx, v, size.w * 0.12, size.h * 0.5 + Math.sin(v.t * 2) * 25, { power: 0.6, wobble: Math.sin(v.t) * 0.08 });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe08a';
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.fillText(v.lang === 'hi' ? 'चंदा मामा तक रॉकेट की सैर' : 'Rocket Ride to Chanda Mama', size.w * 0.58, size.h * 0.55);
  ctx.fillStyle = '#fff';
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(v.lang === 'hi' ? 'शुरू करने के लिए Space दबाएँ या फ़ोन पर ▶' : 'Press Space, or ▶ on the phone, to start', size.w * 0.58, size.h * 0.66);
}

/** One frame of the story. */
export function drawStory(ctx, v) {
  if (!v.started) {
    drawTitle(ctx, v);
    return;
  }
  if (v.stepKind === 'travel') sceneTravel(ctx, v);
  else (SCENES[v.chapterId] ?? sceneLaunch)(ctx, v);
  drawBigNumber(ctx, v.size, v.big);
  drawCaption(ctx, v.size, v.caption);
  if (v.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, v.fade)})`;
    ctx.fillRect(0, 0, v.size.w, v.size.h);
  }
}
