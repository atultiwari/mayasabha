// Giant soap bubbles that float up the wall and pop wherever a hand or the body touches them.
// Some carry a surprise (a favourite character or a fruit) that pops out. Pure and immutable.
import { gridAt } from '../../kit/vision/body-map.js';

export const BUBBLE = Object.freeze({ rMin: 70, rMax: 130, speed: [45, 95], sway: 30, surpriseChance: 0.3, count: 7,
  // Safety: only the middle of the wall, so a child reaching for bubbles stays away from corners
  // and sofa arms. More bubbles near the centre than at the band's edges.
  band: [0.25, 0.75] });
export const SURPRISES = Object.freeze(['pet', 'elephant', 'monkey', 'mouse', 'penguin', 'banana', 'apple', 'orange']);
const RING = 8; // body samples around each bubble
const HAND_REACH = 0.95; // of the radius

let counter = 0;

export function spawnBubble(stage, rng, fresh) {
  counter += 1;
  const r = BUBBLE.rMin + rng() * (BUBBLE.rMax - BUBBLE.rMin);
  const lo = BUBBLE.band[0] * stage.w + r + BUBBLE.sway;
  const hi = BUBBLE.band[1] * stage.w - r - BUBBLE.sway;
  const x0 = lo + ((rng() + rng()) / 2) * Math.max(0, hi - lo);
  return {
    id: `b${counter}`, r, x0, x: x0,
    y: fresh ? stage.h + r + rng() * 200 : r + rng() * (stage.h - r),
    vy: BUBBLE.speed[0] + rng() * (BUBBLE.speed[1] - BUBBLE.speed[0]),
    phase: rng() * Math.PI * 2, hue: rng() * 360, age: 0,
    surprise: rng() < BUBBLE.surpriseChance ? SURPRISES[Math.floor(rng() * SURPRISES.length)] : null,
  };
}

/** Floats bubbles upward with a gentle sway; ones that leave the top come back at the bottom. */
export function stepBubbles(bubbles, dt, stage, rng = Math.random) {
  return bubbles.map((b) => {
    const age = b.age + dt;
    const y = b.y - b.vy * dt;
    if (y < -b.r) return spawnBubble(stage, rng, true);
    return { ...b, age, y, x: b.x0 + Math.sin(age * 0.8 + b.phase) * BUBBLE.sway };
  });
}

/** Adds fresh bubbles (rising from below) until there are `count`. */
export function fillBubbles(bubbles, count, stage, rng = Math.random) {
  const missing = Math.max(0, count - bubbles.length);
  return [...bubbles, ...Array.from({ length: missing }, () => spawnBubble(stage, rng, true))];
}

function touched(b, { grid, hands }) {
  if (hands.some((h) => Math.hypot(h.x - b.x, h.y - b.y) < b.r * HAND_REACH)) return true;
  if (!grid) return false;
  if (gridAt(grid, b)) return true;
  for (let i = 0; i < RING; i += 1) {
    const a = (i / RING) * Math.PI * 2;
    if (gridAt(grid, { x: b.x + Math.cos(a) * b.r * 0.7, y: b.y + Math.sin(a) * b.r * 0.7 })) return true;
  }
  return false;
}

/** Splits bubbles into the ones still floating and the ones just popped. */
export function popTouched(bubbles, body) {
  const kept = [];
  const popped = [];
  for (const b of bubbles) (touched(b, body) ? popped : kept).push(b);
  return { kept, popped };
}
