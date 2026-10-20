// Butterflies that flutter around the wall. When a child is in view they gather into his shape (most
// along his arms and hands, a few around his head) and follow him; without one they come and settle
// on a hand held still (the mouse), and scatter when something swipes past. Pure and immutable.
import { HANDS } from '../../kit/vision/hand-tracker.js';

export const BUTTERFLY = Object.freeze({
  count: 14, speed: 190, approachSpeed: 230, gatherSpeed: 420, armShare: 0.65, fleeSpeed: 460, fleeFor: 1.2,
  scareSpeed: 500, scareRadius: 300, landRadius: 1100, landRingMin: 40, landRingMax: 110,
  wander: 3.5, margin: 140, size: [55, 80], palettes: 5,
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

/** A point `t` (0..1) of the way along a polyline. */
function along(points, t) {
  const lengths = points.slice(1).map((q, i) => Math.hypot(q.x - points[i].x, q.y - points[i].y));
  let left = t * lengths.reduce((a, l) => a + l, 0);
  for (let i = 0; i < lengths.length; i += 1) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? Math.min(1, left / lengths[i]) : 0;
      const [a, b] = [points[i], points[i + 1]];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: b.x - a.x, dy: b.y - a.y };
    }
    left -= lengths[i];
  }
  return { ...points[0], dx: 0, dy: 1 };
}

function armSlots(arms, n) {
  return Array.from({ length: n }, (_, k) => {
    const arm = arms[k % arms.length];
    const j = Math.floor(k / arms.length);
    const perArm = Math.ceil(n / arms.length);
    const p = along(arm, 0.3 + 0.7 * ((j + 0.5) / perArm)); // from upper arm out to the hand
    const len = Math.hypot(p.dx, p.dy) || 1;
    const side = (j % 2 ? 1 : -1) * (24 + 12 * (j % 3));
    return { x: p.x - (p.dy / len) * side, y: p.y + (p.dx / len) * side };
  });
}

function bodySlots(body, n) {
  const [l, r] = body.shoulders;
  const width = Math.max(60, Math.hypot(l.x - r.x, l.y - r.y));
  const ring = (angle, k) => ({ x: body.head.x + Math.cos(angle) * width * k, y: body.head.y + Math.sin(angle) * width * k });
  const around = [-90, -135, -45, -170, -10].map((deg) => (deg * Math.PI) / 180);
  return Array.from({ length: n }, (_, k) => ring(around[k % around.length], 0.75 + 0.3 * Math.floor(k / around.length)));
}

/** Where each butterfly hovers on the child: `armShare` of them along the arms and hands, the rest around the head. */
export function formationSlots(body, count) {
  const onArms = body.arms.length ? Math.round(count * BUTTERFLY.armShare) : 0;
  return [...armSlots(body.arms, onArms), ...bodySlots(body, count - onArms)];
}

function gather(b, slot, dt) {
  const target = { x: slot.x + Math.cos(b.phase * 0.7) * 14, y: slot.y + Math.sin(b.phase * 1.1) * 10 }; // a little flutter
  const dist = Math.hypot(target.x - b.x, target.y - b.y);
  const heading = dist > 1 ? Math.atan2(target.y - b.y, target.x - b.x) : b.heading;
  return move({ ...b, heading, state: 'gather', handId: null }, Math.min(BUTTERFLY.gatherSpeed, dist * 4), dt);
}

function stepOne(b, hands, dt, stage, rng, slot) {
  const flap = { phase: b.phase + dt * (b.state === 'landed' ? 3 : 14) };
  const scared = b.state !== 'flee' ? scare(b, hands) : null;
  if (scared) return { ...scared, ...flap };
  if (slot && b.state !== 'flee') return { ...gather(b, slot, dt), ...flap };
  if (b.state === 'gather') return { ...b, ...flap, state: 'fly' };
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

/**
 * Moves every butterfly. `hands` are hand tracks from kit/vision/hand-tracker.js (stage px); `body`
 * is the child's shape from bodyFromPose (null when nobody is in view).
 */
export function stepButterflies(flock, hands, dt, stage, rng = Math.random, body = null) {
  const slots = body ? formationSlots(body, flock.length) : [];
  return flock.map((b, i) => stepOne(b, hands, dt, stage, rng, slots[i]));
}
