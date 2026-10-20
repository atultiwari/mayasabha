// Giant soap bubbles that float up the wall and pop wherever a hand or the body touches them.
// Some carry a surprise (a favourite character or a fruit) that pops out. Pure and immutable.
import { gridAt } from '../../kit/vision/body-map.js';

export const BUBBLE = Object.freeze({ rMin: 70, rMax: 130, speed: [45, 95], sway: 30, surpriseChance: 0.3, count: 7,
  // Safety: only the middle of the wall, so a child reaching for bubbles stays away from corners
  // and sofa arms. More bubbles near the centre than at the band's edges.
  band: [0.25, 0.75],
  // New bubbles are blown in mid-wall at a child's reach rather than rising from the floor, where the
  // child stands and would pop them unseen. They can't pop while appearing.
  appearBand: [0.4, 0.8], appearS: 1 });
export const SURPRISES = Object.freeze(['pet', 'elephant', 'monkey', 'mouse', 'penguin', 'banana', 'apple', 'orange']);
const RING = 8; // body samples around each bubble
const HAND_REACH = 0.95; // of the radius

let counter = 0;

/** A new bubble; fresh ones are blown in mid-wall, never right under a protected picture in `avoid`. */
export function spawnBubble(stage, rng, fresh, avoid = []) {
  for (let tries = 0; tries < 8; tries += 1) {
    const b = makeBubble(stage, rng, fresh);
    if (!avoid.some((box) => nearBelow(b.y, b.r, box) && inLine(b.x0, b.r, box))) return b;
  }
  return { ...makeBubble(stage, rng, fresh), y: stage.h * BUBBLE.appearBand[1] };
}

function makeBubble(stage, rng, fresh) {
  counter += 1;
  const r = BUBBLE.rMin + rng() * (BUBBLE.rMax - BUBBLE.rMin);
  const lo = BUBBLE.band[0] * stage.w + r + BUBBLE.sway;
  const hi = BUBBLE.band[1] * stage.w - r - BUBBLE.sway;
  const x0 = lo + ((rng() + rng()) / 2) * Math.max(0, hi - lo);
  return {
    id: `b${counter}`, r, x0, x: x0,
    y: fresh ? stage.h * (BUBBLE.appearBand[0] + rng() * (BUBBLE.appearBand[1] - BUBBLE.appearBand[0])) : r + rng() * (stage.h - r),
    vy: BUBBLE.speed[0] + rng() * (BUBBLE.speed[1] - BUBBLE.speed[0]),
    phase: rng() * Math.PI * 2, hue: rng() * 360, age: fresh ? 0 : BUBBLE.appearS, fade: 1,
    surprise: rng() < BUBBLE.surpriseChance ? SURPRISES[Math.floor(rng() * SURPRISES.length)] : null,
  };
}

// Protected pictures (the puja frame): a bubble only slightly in line nudges aside; one heading
// straight in fades away below it, so bubbles stay spread out at the child's height.
const AVOID = Object.freeze({ gap: 20, zone: 130, nudge: 0.6, nudgeSpeed: 200, fadeS: 0.8 });

const inLine = (x0, r, box) => x0 + r + BUBBLE.sway + AVOID.gap > box.x && x0 - r - BUBBLE.sway - AVOID.gap < box.x + box.w;
const nearBelow = (y, r, box) => y + r > box.y && y - r < box.y + box.h + AVOID.zone;

/** Sideways step that clears `box` when the bubble is only slightly in line with it; null if too far in. */
function nudge(b, box, stage) {
  const reach = b.r + BUBBLE.sway + AVOID.gap;
  const lo = BUBBLE.band[0] * stage.w + b.r + BUBBLE.sway;
  const hi = BUBBLE.band[1] * stage.w - b.r - BUBBLE.sway;
  const options = [box.x - reach, box.x + box.w + reach].filter((x) => x >= lo && x <= hi && Math.abs(x - b.x0) <= b.r * AVOID.nudge);
  return options.length ? options.reduce((a, x) => (Math.abs(x - b.x0) < Math.abs(a - b.x0) ? x : a)) : null;
}

/**
 * Floats bubbles upward with a gentle sway; ones that leave the top (or fade out under a picture)
 * are blown in again mid-wall. `avoid` are boxes bubbles never float over.
 */
export function stepBubbles(bubbles, dt, stage, rng = Math.random, avoid = []) {
  return bubbles.map((b) => {
    const age = b.age + dt;
    const y = b.y - b.vy * dt;
    if (y < -b.r) return spawnBubble(stage, rng, true, avoid);
    let { x0, fade = 1 } = b;
    let leaving = fade < 1;
    for (const box of avoid) {
      if (leaving || !nearBelow(y, b.r, box) || !inLine(x0, b.r, box)) continue;
      const target = nudge({ ...b, x0 }, box, stage);
      if (target === null) leaving = true;
      else x0 += Math.sign(target - x0) * Math.min(Math.abs(target - x0), AVOID.nudgeSpeed * dt);
    }
    if (leaving) fade -= dt / AVOID.fadeS;
    if (fade <= 0) return spawnBubble(stage, rng, true, avoid);
    return { ...b, age, y, x0, fade, x: x0 + Math.sin(age * 0.8 + b.phase) * BUBBLE.sway };
  });
}

/** Adds freshly blown bubbles until there are `count`. */
export function fillBubbles(bubbles, count, stage, rng = Math.random, avoid = []) {
  const missing = Math.max(0, count - bubbles.length);
  return [...bubbles, ...Array.from({ length: missing }, () => spawnBubble(stage, rng, true, avoid))];
}

function touched(b, { grid, hands }) {
  if (b.age < BUBBLE.appearS || (b.fade ?? 1) < 1) return false;
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
