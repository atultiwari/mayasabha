// The party: balloons rising beside the puja picture (never across it), confetti, fireworks, and a
// sign on the sofa back. Balloon and confetti motion is pure; the draw functions paint them.
import { FIREWORK, sparkAt } from '../maya-masks/fireworks.js';

const BALLOON_COLORS = Object.freeze(['#ff5d8f', '#ffd23e', '#4cc9f0', '#7bd389', '#c77dff', '#ff9f1c', '#ff4d4d']);
const R = Object.freeze([38, 62]);
const SWAY = 18;
const GAP = 24;

/** x ranges balloons may rise in: either side of the picture (with room for the balloon and its sway). */
export function balloonZones(stage, picture) {
  if (!picture) return [[60, stage.w - 60]];
  const pad = R[1] + SWAY + GAP;
  return [[60, picture.x - pad], [picture.x + picture.w + pad, stage.w - 60]].filter(([a, b]) => b - a > 40);
}

export function spawnBalloon(stage, zones, rng, fromBelow = false) {
  const widths = zones.map(([a, b]) => b - a);
  let pick = rng() * widths.reduce((a, b) => a + b, 0);
  const zone = zones.find((_, i) => (pick -= widths[i]) < 0) ?? zones[0];
  const x0 = zone[0] + rng() * (zone[1] - zone[0]);
  return {
    x0,
    x: x0,
    y: fromBelow ? stage.h + 80 + rng() * 300 : stage.h * (0.2 + rng() * 0.8),
    r: R[0] + rng() * (R[1] - R[0]),
    vy: 60 + rng() * 70,
    phase: rng() * Math.PI * 2,
    color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)],
    age: 0,
  };
}

export function stepBalloons(balloons, dt, stage, zones, rng = Math.random) {
  return balloons.map((b) => {
    const y = b.y - b.vy * dt;
    if (y < -b.r * 3) return spawnBalloon(stage, zones, rng, true);
    const age = b.age + dt;
    return { ...b, y, age, x: b.x0 + Math.sin(age * 0.9 + b.phase) * SWAY };
  });
}

export function drawBalloons(ctx, balloons) {
  for (const b of balloons) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 1.15);
    ctx.quadraticCurveTo(b.x + 14, b.y + b.r * 2, b.x - 6, b.y + b.r * 3);
    ctx.stroke();
    const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.45, b.r * 0.1, b.x, b.y, b.r * 1.2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, b.color);
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x - 7, b.y + b.r * 1.22);
    ctx.lineTo(b.x + 7, b.y + b.r * 1.22);
    ctx.lineTo(b.x, b.y + b.r * 1.1);
    ctx.fill();
  }
}

/** Confetti pieces falling and fluttering from the top. */
export function spawnConfetti(stage, n, rng = Math.random) {
  return Array.from({ length: n }, () => ({
    x: rng() * stage.w, y: -rng() * stage.h * 0.6, vy: 120 + rng() * 160, spin: rng() * 6, phase: rng() * 6,
    color: BALLOON_COLORS[Math.floor(rng() * BALLOON_COLORS.length)], w: 10 + rng() * 10,
  }));
}

export function stepConfetti(pieces, dt, stage) {
  return pieces.map((p) => ({ ...p, y: p.y + p.vy * dt, phase: p.phase + dt * p.spin })).filter((p) => p.y < stage.h + 40);
}

export function drawConfetti(ctx, pieces) {
  for (const p of pieces) {
    ctx.save();
    ctx.translate(p.x + Math.sin(p.phase) * 20, p.y);
    ctx.rotate(p.phase);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.w * 0.3, p.w, p.w * 0.6 * Math.abs(Math.cos(p.phase)));
    ctx.restore();
  }
}

export function drawFireworks(ctx, bursts) {
  for (const b of bursts) {
    const fade = 1 - b.age / FIREWORK.life;
    ctx.fillStyle = `hsla(${b.hue},100%,65%,${fade})`;
    for (const s of b.sparks) {
      const p = sparkAt(b, s);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const POST = 90; // the sign stands on a post this tall, on the sofa back

const signLines = (sign) => (Array.isArray(sign) ? sign : [sign]).filter(Boolean).slice(0, 2);

/** Where the sign stands (board and post), for keeping the wandering friends off it. */
export function signBox(box, sign) {
  const signH = 60 + signLines(sign).length * 44;
  return { x: box.x + 10, y: box.y + box.h - POST - signH, w: box.w - 20, h: signH + POST };
}

/** A wooden sign on a post, rising up from behind the sofa back. sign: one or two lines. */
export function drawSign(ctx, box, appear, sign) {
  if (appear <= 0) return;
  const lines = signLines(sign);
  const area = signBox(box, sign);
  const signH = area.h - POST;
  const rise = (1 - Math.min(1, appear)) * area.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x - 20, area.y - 20, area.w + 40, area.h + 20);
  ctx.clip(); // it pops up from behind the sofa back
  ctx.translate(0, rise);
  // Projected light reads best as bright colour on black: a dark board, a glowing gold edge, and
  // golden and pink words (pale words on a light board wash out on the wall).
  ctx.fillStyle = '#ffcf5a';
  ctx.fillRect(area.x + area.w / 2 - 6, area.y + signH, 12, POST);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(area.x, area.y, area.w, signH, 16);
  ctx.fill();
  ctx.shadowColor = 'rgba(255,190,60,0.9)';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = '#ffcf5a';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? '900 44px system-ui, sans-serif' : '800 38px system-ui, sans-serif';
    ctx.fillStyle = i === 0 ? '#ffe14d' : '#ff7ab8';
    ctx.shadowColor = i === 0 ? 'rgba(255,200,60,0.9)' : 'rgba(255,90,170,0.9)';
    ctx.shadowBlur = 18;
    ctx.fillText(line, area.x + area.w / 2, area.y + 52 + i * 46, area.w - 30);
  });
  ctx.restore();
}
