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

/** A new bubble; fresh ones are blown in mid-wall, never on top of a protected picture in `avoid`. */
export function spawnBubble(stage, rng, fresh, avoid = []) {
  for (let tries = 0; tries < 8; tries += 1) {
    const b = makeBubble(stage, rng, fresh);
    if (!avoid.some((box) => overlapsBox(b, box))) return b;
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
    phase: rng() * Math.PI * 2, hue: rng() * 360, age: fresh ? 0 : BUBBLE.appearS, slide: null,
    surprise: rng() < BUBBLE.surpriseChance ? SURPRISES[Math.floor(rng() * SURPRISES.length)] : null,
  };
}

// Protected pictures (the puja frame): a bubble that bumps into one dances sideways along its bottom
// edge to one side (its own pick), then carries on rising beside it. Bubbles never float over a picture.
export const DANCE = Object.freeze({ gap: 12, speed: 170, bounce: 16, bounceHz: 2.2, spread: [10, 130] });

const inLine = (x0, r, box) => x0 + r + BUBBLE.sway + DANCE.gap > box.x && x0 - r - BUBBLE.sway - DANCE.gap < box.x + box.w;
const overlapsBox = (b, box) => inLine(b.x0, b.r, box) && b.y + b.r > box.y && b.y - b.r < box.y + box.h + DANCE.gap;
const under = (box, r) => box.y + box.h + r + DANCE.gap;

/**
 * Where a bubble ends its dance: past one edge of the picture by its own little distance, so
 * dancers spread out (and never end exactly on the edge, which would count as touching it again).
 */
function danceTarget(r, box, phase) {
  const [near, far] = DANCE.spread;
  const reach = r + BUBBLE.sway + DANCE.gap + near + (phase / (Math.PI * 2)) * (far - near);
  // Each bubble picks its own side (half go left, half right), so bubbles appear on both sides.
  return Math.sin(phase * 7) < 0 ? box.x - reach : box.x + box.w + reach;
}

/** One step of a bubble dancing along the underside of a picture. */
function dance(b, box, dt, age) {
  const step = DANCE.speed * dt;
  const x0 = Math.abs(b.slide.to - b.x0) <= step ? b.slide.to : b.x0 + Math.sign(b.slide.to - b.x0) * step;
  const hop = Math.abs(Math.sin(age * Math.PI * DANCE.bounceHz)) * DANCE.bounce; // bumps along the frame
  const done = x0 === b.slide.to;
  return { ...b, age, x0, y: under(box, b.r) + hop, x: x0 + Math.sin(age * 0.8 + b.phase) * BUBBLE.sway, slide: done ? null : b.slide };
}

/**
 * Floats bubbles upward with a gentle sway; ones that leave the top are blown in again mid-wall.
 * `avoid` are boxes (protected pictures) that bubbles dance around instead of floating over.
 */
export function stepBubbles(bubbles, dt, stage, rng = Math.random, avoid = []) {
  return bubbles.map((b) => {
    const age = b.age + dt;
    if (b.slide && avoid[b.slide.box]) return dance(b, avoid[b.slide.box], dt, age);
    const y = b.y - b.vy * dt;
    if (y < -b.r) return spawnBubble(stage, rng, true, avoid);
    const hit = avoid.findIndex((box) => inLine(b.x0, b.r, box) && y - b.r < box.y + box.h + DANCE.gap && b.y > box.y + box.h);
    if (hit !== -1) {
      const box = avoid[hit];
      return dance({ ...b, slide: { box: hit, to: danceTarget(b.r, box, b.phase) } }, box, dt, age);
    }
    return { ...b, age, y, slide: null, x: b.x0 + Math.sin(age * 0.8 + b.phase) * BUBBLE.sway };
  });
}

/** Bubbles mode switched off: they keep floating up and vanish off the top, never replaced. */
export function driftAway(bubbles, dt, stage, avoid = []) {
  const leaving = bubbles
    .filter((b) => b.slide || b.y - b.vy * dt >= -b.r)
    .map((b) => ({ ...b, vy: Math.max(b.vy, 300) })); // hurry off so the mode change is quick
  return stepBubbles(leaving, dt, stage, Math.random, avoid);
}

/** Adds freshly blown bubbles until there are `count`. */
export function fillBubbles(bubbles, count, stage, rng = Math.random, avoid = []) {
  const missing = Math.max(0, count - bubbles.length);
  return [...bubbles, ...Array.from({ length: missing }, () => spawnBubble(stage, rng, true, avoid))];
}

function touched(b, { grid, hands }) {
  if (b.age < BUBBLE.appearS) return false;
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
