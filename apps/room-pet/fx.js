// Little particle bursts: hearts when happy, dust puffs on landing, crumbs while eating.
// Pure spawn/step functions plus one draw function.

const FRUIT_COLORS = { banana: '#ffd84a', apple: '#ff4d4d', orange: '#ff9a2e' };

function particle(kind, x, y, vx, vy, life, size, color) {
  return { kind, x, y, vx, vy, life, max: life, size, color, rot: 0 };
}

/** @returns {object[]} new particles */
export function spawnFx(name, x, y, rng = Math.random, fruitKind = null) {
  const n = { hearts: 6, dust: 8, crumbs: 7, sparkle: 10 }[name] ?? 0;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rng();
    if (name === 'hearts') return particle('heart', x + (rng() - 0.5) * 80, y, (rng() - 0.5) * 90, -140 - rng() * 120, 1.4, 26 + rng() * 18, '#ff5fa2');
    if (name === 'dust') return particle('dot', x, y - 6, Math.cos(a) * 160, -Math.abs(Math.sin(a)) * 60, 0.5, 10 + rng() * 8, 'rgba(230,230,255,0.8)');
    if (name === 'sparkle') return particle('star', x, y, Math.cos(a) * 220, Math.sin(a) * 220, 0.7, 14, '#fff6a8');
    return particle('dot', x, y, (rng() - 0.5) * 220, -120 - rng() * 160, 0.8, 7 + rng() * 5, FRUIT_COLORS[fruitKind] ?? '#ffd84a');
  });
}

export function stepFx(particles, dt) {
  return particles
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + (p.kind === 'heart' ? -20 : 600) * dt, life: p.life - dt }))
    .filter((p) => p.life > 0);
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.95, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.fill();
}

function starPath(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const r = i % 2 ? s * 0.4 : s;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.fill();
}

export function drawFx(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
    ctx.fillStyle = p.color;
    if (p.kind === 'heart') heartPath(ctx, p.x, p.y, p.size);
    else if (p.kind === 'star') starPath(ctx, p.x, p.y, p.size);
    else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
