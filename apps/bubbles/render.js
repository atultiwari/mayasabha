// Draws iridescent soap bubbles (with a surprise floating inside some), popped surprises, and
// glowing, flapping butterflies on a black stage.
import { drawFx } from '../../kit/fx.js';
import { BUBBLE, DANCE } from './bubbles.js';

const PALETTES = [
  ['#ff9a2e', '#ffd23e'], ['#3ec8ff', '#8a7dff'], ['#ff5fa2', '#ffd1e8'], ['#7be08a', '#e8ff6a'], ['#c084fc', '#ff9ad5'],
];
const SURPRISE_SIZE = 280;

function drawImageFit(ctx, img, cx, cy, height, alpha = 1) {
  const width = height * (img.width / img.height);
  const before = ctx.globalAlpha; // keep any fade already applied
  ctx.globalAlpha = before * alpha;
  ctx.drawImage(img, cx - width / 2, cy - height / 2, width, height);
  ctx.globalAlpha = before;
}

function drawBubble(ctx, b, chars) {
  const grow = Math.min(1, b.age / BUBBLE.appearS); // blown in: fades and swells into view
  if (grow < 1) {
    ctx.save();
    ctx.globalAlpha = grow;
    drawBubble(ctx, { ...b, r: b.r * (0.4 + 0.6 * grow), age: BUBBLE.appearS }, chars);
    ctx.restore();
    return;
  }
  if (b.slide) {
    // Dancing under a picture: squashed flat against it at each bump, round again in between.
    const press = 1 - Math.abs(Math.sin(b.age * Math.PI * DANCE.bounceHz));
    ctx.save();
    ctx.translate(b.x, b.y - b.r);
    ctx.scale(1 + 0.12 * press, 1 - 0.12 * press);
    ctx.translate(-b.x, -(b.y - b.r));
    drawBubble(ctx, { ...b, slide: null }, chars);
    ctx.restore();
    return;
  }
  const hue = b.hue + b.age * 35;
  if (b.surprise && chars[b.surprise]) {
    drawImageFit(ctx, chars[b.surprise].img, b.x, b.y + Math.sin(b.age * 2) * 6, b.r * 1.25, 0.9);
  }
  const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, `hsla(${hue},90%,70%,0.05)`);
  g.addColorStop(0.92, `hsla(${hue + 70},95%,70%,0.32)`);
  g.addColorStop(1, `hsla(${hue + 140},95%,82%,0.75)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue + 200},90%,78%,0.55)`;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Window-light highlights.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(3, b.r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(b.x - b.r * 0.12, b.y - b.r * 0.12, b.r * 0.68, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(b.x + b.r * 0.42, b.y + b.r * 0.38, b.r * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

const easeOutBack = (x) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;

function drawSurprise(ctx, s, chars) {
  const art = chars[s.role];
  if (!art) return;
  const grow = easeOutBack(Math.min(1, s.age / 0.35));
  const alpha = s.age < 1.4 ? 1 : Math.max(0, 1 - (s.age - 1.4) / 0.8);
  drawImageFit(ctx, art.happyImg ?? art.img, s.x, s.y - s.age * 40, SURPRISE_SIZE * art.scale * grow, alpha);
}

function wing(ctx, cx, cy, rx, ry, rot, colors, size) {
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, colors[1]);
  g.addColorStop(1, colors[0]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(cx + rx * 0.3, cy - ry * 0.1, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawButterfly(ctx, b) {
  const s = b.size;
  const colors = PALETTES[b.palette % PALETTES.length];
  const flap = 0.2 + 0.8 * Math.abs(Math.cos(b.phase));
  const angle = b.state === 'landed' ? Math.sin(b.phase * 0.4) * 0.2 : b.heading + Math.PI / 2;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  ctx.shadowColor = colors[0];
  ctx.shadowBlur = 18;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * flap, 1);
    wing(ctx, s * 0.42, -s * 0.22, s * 0.48, s * 0.36, -0.5, colors, s);
    wing(ctx, s * 0.32, s * 0.26, s * 0.32, s * 0.26, 0.45, colors, s);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#3a2416';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.42);
  ctx.lineTo(0, s * 0.42);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f4e1c8';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.quadraticCurveTo(side * s * 0.12, -s * 0.7, side * s * 0.25, -s * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

/** One frame. `overlay(ctx)` lets the vision kit draw calibration targets / debug on the stage. */
export function drawWall(ctx, { size, bubbles, flock, surprises, particles, chars, overlay }) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size.w, size.h);
  for (const b of bubbles) drawBubble(ctx, b, chars);
  for (const s of surprises) drawSurprise(ctx, s, chars);
  for (const b of flock) drawButterfly(ctx, b);
  drawFx(ctx, particles);
  overlay(ctx);
}
