// The party crowd: Masha, Bear and their friends wander about the wall on their own, hopping from one
// random spot to the next, and fruit tumbles and floats among the balloons. Nobody ever walks or floats
// over the puja picture, the cake or the sign: a walk that would cross one is never chosen.
// Motion is pure (rng passed in); the draw functions paint it.
import { overlaps } from './layout.js';

export const WALKERS = Object.freeze([
  { role: 'pet', h: 230 }, // Masha
  { role: 'elephant', h: 270 }, // Bear
  { role: 'monkey', h: 170 },
  { role: 'mouse', h: 140 },
  { role: 'penguin', h: 170 },
].map((w) => Object.freeze(w)));
export const FRUITS = Object.freeze(['banana', 'apple', 'orange']);

const SPEED = Object.freeze([90, 170]); // px per second
const REST = Object.freeze([0.4, 1.8]); // seconds standing still between walks
const HOP = 26;
const TRIES = 30;
const PAD = 30;
const FRUIT_SIZE = Object.freeze([60, 95]);

const lerp = (a, b, k) => a + (b - a) * k;
const between = (rng, [a, b]) => lerp(a, b, rng());
const body = (x, y, h) => ({ x: x - h * 0.4, y: y - h, w: h * 0.8, h });
const grow = (b, p) => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });

/** True if a walker of height h can go in a straight line from a to b without touching a keep-out box. */
export function clearPath(a, b, h, keepOut) {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20));
  for (let i = 0; i <= steps; i += 1) {
    const k = i / steps;
    const box = body(lerp(a.x, b.x, k), lerp(a.y, b.y, k), h);
    if (keepOut.some((o) => overlaps(box, grow(o, PAD)))) return false;
  }
  return true;
}

/** A random spot (feet position) within the wall area that this walker can reach from `from`. */
function pickTarget(from, h, area, keepOut, rng) {
  for (let i = 0; i < TRIES; i += 1) {
    const to = { x: lerp(area.x + h * 0.4, area.x + area.w - h * 0.4, rng()), y: lerp(area.y + h, area.y + area.h, rng()) };
    if (clearPath(from, to, h, keepOut)) return to;
  }
  return null; // boxed in for now: stay put and try again after a rest
}

/** A random spot nobody's standing on a keep-out box at (no path needed: used to place a walker at the start). */
function freeSpot(h, area, keepOut, rng) {
  for (let i = 0; i < TRIES * 4; i += 1) {
    const at = { x: lerp(area.x + h * 0.4, area.x + area.w - h * 0.4, rng()), y: lerp(area.y + h, area.y + area.h, rng()) };
    if (clearPath(at, at, h, keepOut)) return at;
  }
  return null;
}

/** area: { x, y, w, h } where feet may go; keepOut: boxes nobody may cover. Walkers start along the bottom. */
export function spawnWalkers(area, keepOut, rng = Math.random) {
  return WALKERS.map((w, i) => {
    const start = { x: area.x + ((i + 0.5) / WALKERS.length) * area.w, y: area.y + area.h };
    const spot = clearPath(start, start, w.h, keepOut) ? start : freeSpot(w.h, area, keepOut, rng) ?? start;
    return { ...w, x: spot.x, y: spot.y, from: spot, to: null, k: 0, len: 0, rest: between(rng, REST) * i * 0.4, face: 1, t: 0 };
  });
}

function stepWalker(w, dt, area, keepOut, rng) {
  const t = w.t + dt;
  if (!w.to) {
    const rest = w.rest - dt;
    if (rest > 0) return { ...w, rest, t };
    const to = pickTarget(w, w.h, area, keepOut, rng);
    if (!to) return { ...w, rest: between(rng, REST), t };
    const len = Math.hypot(to.x - w.x, to.y - w.y);
    return { ...w, from: { x: w.x, y: w.y }, to, k: 0, len, speed: between(rng, SPEED), face: to.x >= w.x ? 1 : -1, t };
  }
  const k = Math.min(1, w.k + (w.speed * dt) / Math.max(1, w.len));
  const x = lerp(w.from.x, w.to.x, k);
  const y = lerp(w.from.y, w.to.y, k);
  if (k >= 1) return { ...w, x, y, to: null, k: 0, rest: between(rng, REST), t };
  return { ...w, x, y, k, t };
}

export function stepWalkers(walkers, dt, area, keepOut, rng = Math.random) {
  return walkers.map((w) => stepWalker(w, dt, area, keepOut, rng));
}

/** How high a walker is off the ground right now: little hops while walking, a bounce now and then at rest. */
export function hopOf(w) {
  if (w.to) return Math.abs(Math.sin(w.t * 9)) * HOP;
  return Math.max(0, Math.sin(w.t * 4)) * HOP * 0.35;
}

export function drawWalkers(ctx, walkers, chars, appear) {
  if (!chars || appear <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear);
  for (const w of [...walkers].sort((a, b) => a.y - b.y)) {
    const c = chars[w.role];
    const img = (w.to ? c?.happyImg : null) ?? c?.img;
    if (!img) continue;
    const h = w.h * (c.scale ?? 1) * Math.min(1, appear);
    const iw = h * (img.width / img.height);
    const flip = (c.facing ?? -1) !== w.face; // turn the art to face where it's going
    ctx.save();
    ctx.translate(w.x, w.y - hopOf(w));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -iw / 2, -h * (1 - (c.footPad ?? 0)), iw, h); // feet on the spot
    ctx.restore();
  }
  ctx.restore();
}

// ---- fruit -----------------------------------------------------------------------------------

/** A fruit floating up through the balloon zones (either side of the picture), turning slowly. */
export function spawnFruit(stage, zones, rng = Math.random, fromBelow = true) {
  const [a, b] = zones[Math.floor(rng() * zones.length)];
  const size = between(rng, FRUIT_SIZE);
  const x0 = a + size / 2 + rng() * Math.max(0, b - a - size);
  return {
    kind: FRUITS[Math.floor(rng() * FRUITS.length)],
    x0, x: x0,
    y: fromBelow ? stage.h + size + rng() * 400 : stage.h * (0.2 + rng() * 0.8),
    size, vy: 45 + rng() * 60, spin: (rng() - 0.5) * 2.4, phase: rng() * Math.PI * 2, age: 0,
  };
}

export function stepFruits(fruits, dt, stage, zones, rng = Math.random) {
  return fruits.map((f) => {
    const y = f.y - f.vy * dt;
    if (y < -f.size * 2) return spawnFruit(stage, zones, rng, true);
    const age = f.age + dt;
    return { ...f, y, age, x: f.x0 + Math.sin(age * 1.3 + f.phase) * 22 };
  });
}

export function drawFruits(ctx, fruits, chars) {
  if (!chars) return;
  for (const f of fruits) {
    const img = chars[f.kind]?.img;
    if (!img) continue;
    const w = f.size * (img.width / img.height);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.phase + f.age * f.spin);
    ctx.drawImage(img, -w / 2, -f.size / 2, w, f.size);
    ctx.restore();
  }
}
