import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farRect, shaftWalls, toFar, depthRings } from '../apps/ceiling-window/shaft.js';
import { PEEK, peekReveal, startPeek, stepPeek } from '../apps/ceiling-window/peek.js';
import { SCENES, populate, stepDrifters } from '../apps/ceiling-window/drifters.js';
import { bedtimeBrightness } from '../apps/ceiling-window/bedtime.js';

const STAGE = { w: 1600, h: 1200 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('farRect is centred and scaled by depth when the viewer is right below', () => {
  const r = farRect(STAGE, { depth: 0.5, offset: { x: 0, y: 0 } });
  close(r.w, 800);
  close(r.h, 600);
  close(r.x, 400);
  close(r.y, 300);
});

test('farRect follows the viewer offset but never leaves the hole', () => {
  const shifted = farRect(STAGE, { depth: 0.5, offset: { x: 0.1, y: 0 } });
  close(shifted.x, 560);
  const extreme = farRect(STAGE, { depth: 0.5, offset: { x: 5, y: -5 } });
  assert.ok(extreme.x + extreme.w <= STAGE.w && extreme.y >= 0);
  const clampedDepth = farRect(STAGE, { depth: 2, offset: { x: 0, y: 0 } });
  assert.ok(clampedDepth.w < STAGE.w);
});

test('shaft walls join the rim corners to the far corners', () => {
  const far = farRect(STAGE, { depth: 0.5, offset: { x: 0, y: 0 } });
  const walls = shaftWalls(STAGE, far);
  assert.deepEqual(Object.keys(walls), ['top', 'right', 'bottom', 'left']);
  assert.deepEqual(walls.top[0], { x: 0, y: 0 });
  assert.deepEqual(walls.top[2], { x: far.x + far.w, y: far.y });
  assert.deepEqual(walls.left[3], { x: far.x, y: far.y + far.h });
});

test('depth rings sit between rim and far opening, bunching up with distance', () => {
  const far = farRect(STAGE, { depth: 0.5, offset: { x: 0, y: 0 } });
  const rings = depthRings(STAGE, far, 3);
  assert.equal(rings.length, 3);
  assert.ok(rings.every((r, i) => i === 0 || r.w < rings[i - 1].w));
  assert.ok(rings[0].w - rings[1].w > rings[1].w - rings[2].w);
});

test('toFar maps 0..1 into the far opening', () => {
  const far = { x: 100, y: 50, w: 400, h: 200 };
  assert.deepEqual(toFar(far, 0.5, 1), { x: 300, y: 250 });
});

test('a peek slides in, holds, slides out and ends', () => {
  let p = startPeek('elephant', 'top', 0.3);
  assert.equal(peekReveal(p), 0);
  let seen = 0;
  for (let i = 0; i < 600 && p; i += 1) {
    p = stepPeek(p, 1 / 60);
    if (p) seen = Math.max(seen, peekReveal(p));
  }
  assert.equal(p, null);
  close(seen, 1, 1e-3);
  assert.ok(PEEK.inS + PEEK.holdS + PEEK.outS < 10);
});

test('every scene populates drifters that move and stay bounded', () => {
  for (const name of Object.keys(SCENES)) {
    let items = populate(name, () => 0.5);
    assert.ok(items.length > 0, name);
    for (let i = 0; i < 60 * 30; i += 1) items = stepDrifters(items, name, 1 / 60, () => 0.5);
    assert.ok(items.length > 0 && items.length < 80, `${name}: ${items.length}`);
    assert.ok(items.every((d) => d.x > -0.6 && d.x < 1.6), name);
  }
});

test('bedtime fades from full brightness to black and stays black', () => {
  close(bedtimeBrightness(0, 600), 1);
  assert.ok(bedtimeBrightness(300, 600) < 1 && bedtimeBrightness(300, 600) > 0);
  close(bedtimeBrightness(600, 600), 0);
  close(bedtimeBrightness(9999, 600), 0);
});

test('peeks never come in upside-down and mostly come from the bottom', async () => {
  const { pickEdge } = await import('../apps/ceiling-window/peek.js');
  const edges = Array.from({ length: 100 }, (_, i) => pickEdge(i / 100));
  assert.ok(!edges.includes('top'));
  assert.equal(edges.filter((e) => e === 'bottom').length, 50);
});

test('respawned bubbles are scattered, not lined up along one edge', async () => {
  const { spawn } = await import('../apps/ceiling-window/drifters.js');
  let seed = 0.13;
  const rng = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
  const ys = Array.from({ length: 20 }, () => spawn('bubble', rng, true).y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5);
});
