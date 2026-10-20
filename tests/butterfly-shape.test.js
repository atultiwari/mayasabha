import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTERFLY, formationSlots, populateButterflies, stepButterflies } from '../apps/bubbles/butterflies.js';
import { bodyFromPose } from '../kit/vision/body-map.js';

const STAGE = { w: 1920, h: 1080 };
const identity = { toStage: (p) => ({ x: p.x * STAGE.w, y: p.y * STAGE.h }) };

/** A standing person (normalised camera coords), arms out to the sides; `s` scales their size. */
function person(cx, top, s, visible = 0.9) {
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: top, visibility: 0 }));
  const set = (i, dx, dy) => { lm[i] = { x: cx + dx * s, y: top + dy * s, visibility: visible }; };
  set(0, 0, 0.03); // nose
  set(11, -0.04, 0.1); set(12, 0.04, 0.1); // shoulders
  set(13, -0.09, 0.12); set(14, 0.09, 0.12); // elbows
  set(15, -0.14, 0.1); set(16, 0.14, 0.1); // wrists
  set(19, -0.16, 0.1); set(20, 0.16, 0.1); // index fingers
  set(23, -0.03, 0.25); set(24, 0.03, 0.25); // hips
  return lm;
}

const near = (p, q, d) => Math.hypot(p.x - q.x, p.y - q.y) < d;

test('the body shape follows the child: the smaller of two standing people', () => {
  const grownUp = person(0.3, 0.2, 2);
  const child = person(0.7, 0.5, 1);
  const body = bodyFromPose([grownUp, child], identity);
  assert.ok(near(body.head, { x: 0.7 * STAGE.w, y: 0.53 * STAGE.h }, 2));
  assert.equal(body.arms.length, 2);
  assert.ok(near(body.arms[1].at(-1), { x: (0.7 + 0.16) * STAGE.w, y: 0.6 * STAGE.h }, 2), 'arm ends at the hand');
  assert.equal(bodyFromPose([], identity), null);
  assert.equal(bodyFromPose([person(0.5, 0.5, 1, 0.1)], identity), null, 'nobody clearly seen');
});

test('butterflies are shared out: most along the arms and hands, a few around the body', () => {
  const body = bodyFromPose([person(0.5, 0.4, 1.5)], identity);
  const slots = formationSlots(body, 14);
  assert.equal(slots.length, 14);
  const toSegment = (p, a, b) => {
    const t2 = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2)));
    return Math.hypot(p.x - (a.x + t2 * (b.x - a.x)), p.y - (a.y + t2 * (b.y - a.y)));
  };
  const toArms = (p) => Math.min(...body.arms.flatMap((arm) => arm.slice(1).map((q, i) => toSegment(p, arm[i], q))));
  const byArm = slots.filter((s) => toArms(s) < 80).length;
  assert.ok(byArm >= 8 && byArm <= 11, `${byArm} of 14 by the arms`);
  const one = formationSlots({ ...body, arms: [body.arms[0]] }, 6);
  assert.equal(one.length, 6);
  assert.equal(formationSlots({ ...body, arms: [] }, 5).length, 5, 'no arms seen: all around the body');
});

test('with no child in view butterflies fly about freely; when he comes they gather into his shape', () => {
  assert.ok(BUTTERFLY.count >= 12 && BUTTERFLY.speed >= 170, 'more and livelier than before');
  let flock = populateButterflies(STAGE, () => 0.5);
  flock = populateButterflies(STAGE, Math.random);
  const body = bodyFromPose([person(0.5, 0.35, 1.5)], identity);
  for (let i = 0; i < 60 * 6; i += 1) flock = stepButterflies(flock, [], 1 / 60, STAGE, Math.random, body);
  const slots = formationSlots(body, flock.length);
  assert.ok(flock.every((b, i) => near(b, slots[i], 60)), 'every butterfly hovers by its place on him');
  for (let i = 0; i < 60 * 6; i += 1) flock = stepButterflies(flock, [], 1 / 60, STAGE, Math.random, null);
  assert.ok(flock.every((b) => b.state !== 'gather'), 'back to flying when he leaves');
});
