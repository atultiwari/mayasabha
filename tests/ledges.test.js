import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUND_ID, distanceTo, findRoute, ledgeBelow, makeGround, makeLedge, planHop, removeNearest, sanitizeLedges, yAt,
} from '../kit/ledges.js';

const ground = makeGround(1920, 1040);
const frameLow = makeLedge('frame-low', { x: 300, y: 700 }, { x: 600, y: 700 });
const frameHigh = makeLedge('frame-high', { x: 700, y: 400 }, { x: 1000, y: 400 });
const faraway = makeLedge('far', { x: 1700, y: 150 }, { x: 1800, y: 150 });
const world = [ground, frameLow, frameHigh, faraway];

test('makeLedge normalises direction and rejects tiny or steep lines', () => {
  const l = makeLedge('a', { x: 500, y: 10 }, { x: 100, y: 20 });
  assert.equal(l.a.x, 100);
  assert.equal(makeLedge('b', { x: 0, y: 0 }, { x: 10, y: 0 }), null);
  assert.equal(makeLedge('c', { x: 0, y: 0 }, { x: 100, y: 300 }), null);
});

test('yAt interpolates and clamps', () => {
  const slope = makeLedge('s', { x: 0, y: 100 }, { x: 200, y: 140 });
  assert.equal(yAt(slope, 100), 120);
  assert.equal(yAt(slope, -50), 100);
});

test('ledgeBelow finds the first surface under a falling point', () => {
  assert.equal(ledgeBelow(world, { x: 450, y: 100 }).id, 'frame-low');
  assert.equal(ledgeBelow(world, { x: 450, y: 800 }).id, GROUND_ID);
  assert.equal(ledgeBelow(world, { x: 1200, y: 100 }).id, GROUND_ID);
});

test('planHop allows short up-hops and long drops but not big climbs', () => {
  assert.ok(planHop(ground, frameLow, 450));
  assert.ok(planHop(frameLow, frameHigh, 590));
  assert.ok(planHop(frameHigh, ground, 800));
  assert.equal(planHop(ground, frameHigh, 850), null); // 640px climb
});

test('findRoute climbs ground → low frame → high frame, and reports unreachable ledges', () => {
  assert.deepEqual(findRoute(world, GROUND_ID, 'frame-high', 100), [GROUND_ID, 'frame-low', 'frame-high']);
  assert.deepEqual(findRoute(world, 'frame-high', GROUND_ID, 800), ['frame-high', GROUND_ID]);
  assert.equal(findRoute(world, GROUND_ID, 'far', 100), null);
  assert.equal(findRoute(world, GROUND_ID, 'missing', 100), null);
});

test('removeNearest deletes a nearby ledge but never the ground', () => {
  assert.equal(removeNearest(world, { x: 450, y: 710 }, 30).length, 3);
  assert.equal(removeNearest(world, { x: 100, y: 1040 }, 30).length, 4);
  assert.ok(distanceTo(frameLow, { x: 450, y: 700 }) < 1e-9);
});

test('sanitizeLedges drops ground copies and malformed entries', () => {
  const out = sanitizeLedges([frameLow, { id: GROUND_ID, a: { x: 0, y: 0 }, b: { x: 99, y: 0 } }, { id: 'x' }, 7]);
  assert.deepEqual(out.map((l) => l.id), ['frame-low']);
  assert.deepEqual(sanitizeLedges('nope'), []);
});
