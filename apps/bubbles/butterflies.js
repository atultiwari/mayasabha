// Butterflies that flutter around the wall, come and settle on a hand held still, ride along if it
// moves slowly, and scatter when something swipes past. Pure and immutable.
import { HANDS } from '../../kit/vision/hand-tracker.js';

export const BUTTERFLY = Object.freeze({
  count: 9, speed: 130, approachSpeed: 230, fleeSpeed: 460, fleeFor: 1.2,
  scareSpeed: 500, scareRadius: 300, landRadius: 1100, landRingMin: 40, landRingMax: 110,
  wander: 2.5, margin: 140, size: [55, 80], palettes: 5,
});

let counter = 0;

export function spawnButterfly(stage, rng) {
  counter += 1;
  return {
    id: `f${counter}`, x: BUTTERFLY.margin + rng() * (stage.w - 2 * BUTTERFLY.margin),
    y: BUTTERFLY.margin + rng() * (stage.h - 2 * BUTTERFLY.margin),
    heading: rng() * Math.PI * 2, state: 'fly', handId: null, fleeT: 0, phase: rng() * 10,
    ringAngle: rng() * Math.PI * 2, ringDist: BUTTERFLY.landRingMin + rng() * (BUTTERFLY.landRingMax - BUTTERFLY.landRingMin),
    size: BUTTERFLY.size[0] + rng() * (BUTTERFLY.size[1] - BUTTERFLY.size[0]),
    palette: Math.floor(rng() * BUTTERFLY.palettes),
  };
}

export function populateButterflies(stage, rng = Math.random, count = BUTTERFLY.count) {
  return Array.from({ length: count }, () => spawnButterfly(stage, rng));
}

const perch = (b, hand) => ({ x: hand.x + Math.cos(b.ringAngle) * b.ringDist, y: hand.y + Math.sin(b.ringAngle) * b.ringDist });
const isStill = (h) => h.stillFor >= HANDS.stillAfter;

function turnToward(heading, target, rate) {
  const diff = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
  return heading + Math.max(-rate, Math.min(rate, diff));
}

function move(b, speed, dt) {
  return { ...b, x: b.x + Math.cos(b.heading) * speed * dt, y: b.y + Math.sin(b.heading) * speed * dt };
}

function scare(b, hands) {
  const swipe = hands.find((h) => h.speed > BUTTERFLY.scareSpeed && Math.hypot(h.x - b.x, h.y - b.y) < BUTTERFLY.scareRadius);
  if (!swipe) return null;
  return { ...b, state: 'flee', handId: null, fleeT: BUTTERFLY.fleeFor, heading: Math.atan2(b.y - swipe.y, b.x - swipe.x) };
}

function fly(b, hands, dt, stage, rng) {
  const hand = hands.find((h) => isStill(h) && Math.hypot(h.x - b.x, h.y - b.y) < BUTTERFLY.landRadius);
  if (hand) return { ...b, state: 'approach', handId: hand.id };
  let heading = b.heading + (rng() - 0.5) * BUTTERFLY.wander * dt * 2;
  const m = BUTTERFLY.margin;
  if (b.x < m || b.x > stage.w - m || b.y < m || b.y > stage.h - m) {
    heading = turnToward(heading, Math.atan2(stage.h / 2 - b.y, stage.w / 2 - b.x), 3 * dt);
  }
  return move({ ...b, heading }, BUTTERFLY.speed, dt);
}

function approach(b, hand, dt) {
  if (!hand || !isStill(hand)) return { ...b, state: 'fly', handId: null };
  const target = perch(b, hand);
  const dist = Math.hypot(target.x - b.x, target.y - b.y);
  if (dist < 12) return { ...b, ...target, state: 'landed' };
  const heading = Math.atan2(target.y - b.y, target.x - b.x);
  return move({ ...b, heading }, Math.min(BUTTERFLY.approachSpeed, dist * 3), dt);
}

function landed(b, hand, dt) {
  if (!hand) return { ...b, state: 'flee', handId: null, fleeT: BUTTERFLY.fleeFor * 0.6 };
  const target = perch(b, hand);
  const k = Math.min(1, dt * 10); // ride along with a slowly moving hand
  return { ...b, x: b.x + (target.x - b.x) * k, y: b.y + (target.y - b.y) * k };
}

function stepOne(b, hands, dt, stage, rng) {
  const flap = { phase: b.phase + dt * (b.state === 'landed' ? 3 : 14) };
  const scared = b.state !== 'flee' ? scare(b, hands) : null;
  if (scared) return { ...scared, ...flap };
  const hand = hands.find((h) => h.id === b.handId);
  switch (b.state) {
    case 'flee': {
      const fleeT = b.fleeT - dt;
      const moved = move(b, BUTTERFLY.fleeSpeed * Math.max(0.3, fleeT / BUTTERFLY.fleeFor), dt);
      return { ...moved, ...flap, fleeT, state: fleeT > 0 ? 'flee' : 'fly' };
    }
    case 'approach': return { ...approach(b, hand, dt), ...flap };
    case 'landed': return { ...landed(b, hand, dt), ...flap };
    default: return { ...fly(b, hands, dt, stage, rng), ...flap };
  }
}

/** Moves every butterfly. `hands` are hand tracks from kit/vision/hand-tracker.js (stage px). */
export function stepButterflies(flock, hands, dt, stage, rng = Math.random) {
  return flock.map((b) => stepOne(b, hands, dt, stage, rng));
}
