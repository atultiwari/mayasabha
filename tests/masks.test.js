import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAGS, bbox, centroid, contains, makeEllipse, makePolygon, makeRect, moveHandle, nextTag, outlinePoints, sanitizeShapes, shapeHandles, topEdgePoints,
} from '../kit/room/shapes.js';
import { SCENES, effectsFor } from '../apps/maya-masks/scenes.js';
import { RANGOLI, rangoliPetals } from '../apps/maya-masks/rangoli.js';
import { spawnBurst, stepBursts } from '../apps/maya-masks/fireworks.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const square = makeRect('s', 'frame', { x: 100, y: 100 }, { x: 300, y: 250 });

test('rect, ellipse and polygon report bounding boxes and centres', () => {
  assert.deepEqual(bbox(square), { x: 100, y: 100, w: 200, h: 150 });
  const e = makeEllipse('e', 'balloon', { x: 500, y: 500 }, { x: 600, y: 560 });
  assert.deepEqual(bbox(e), { x: 500, y: 500, w: 100, h: 60 });
  assert.deepEqual(centroid(e), { x: 550, y: 530 });
  const tri = makePolygon('t', 'other', [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 0, y: 90 }]);
  assert.deepEqual(centroid(tri), { x: 30, y: 30 });
});

test('drawing the rect backwards normalises it; tiny shapes are rejected', () => {
  const r = makeRect('r', 'door', { x: 300, y: 250 }, { x: 100, y: 100 });
  assert.deepEqual(bbox(r), bbox(square));
  assert.equal(makeRect('x', 'door', { x: 0, y: 0 }, { x: 5, y: 5 }), null);
  assert.equal(makePolygon('p', 'other', [{ x: 0, y: 0 }, { x: 10, y: 0 }]), null);
});

test('contains works for every shape kind', () => {
  assert.equal(contains(square, { x: 200, y: 200 }), true);
  assert.equal(contains(square, { x: 50, y: 200 }), false);
  const e = makeEllipse('e', 'balloon', { x: 0, y: 0 }, { x: 200, y: 100 });
  assert.equal(contains(e, { x: 100, y: 50 }), true);
  assert.equal(contains(e, { x: 5, y: 5 }), false);
  const tri = makePolygon('t', 'other', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }]);
  assert.equal(contains(tri, { x: 20, y: 20 }), true);
  assert.equal(contains(tri, { x: 80, y: 80 }), false);
});

test('top edge points follow the real top of the shape (diyas sit on it)', () => {
  const pts = topEdgePoints(square, 5);
  assert.equal(pts.length, 5);
  assert.ok(pts.every((p) => p.y === 100));
  const e = makeEllipse('e', 'balloon', { x: 0, y: 0 }, { x: 200, y: 100 });
  const top = topEdgePoints(e, 3);
  close(top[1].y, 0); // middle point at the very top of the ellipse
  assert.ok(top[0].y > top[1].y);
});

test('outline points are spread evenly around the perimeter', () => {
  const pts = outlinePoints(square, 7);
  assert.equal(pts.length, 7);
  assert.ok(pts.every((p) => p.x >= 100 && p.x <= 300 && p.y >= 100 && p.y <= 250));
  const ring = outlinePoints(makeEllipse('e', 'balloon', { x: 0, y: 0 }, { x: 100, y: 100 }), 8);
  ring.forEach((p) => close(Math.hypot(p.x - 50, p.y - 50), 50, 1e-6));
});

test('handles let you drag a corner or a polygon point, returning a new shape', () => {
  const handles = shapeHandles(square);
  assert.equal(handles.length, 2);
  const moved = moveHandle(square, 1, { x: 400, y: 300 });
  assert.deepEqual(bbox(moved), { x: 100, y: 100, w: 300, h: 200 });
  assert.deepEqual(bbox(square), { x: 100, y: 100, w: 200, h: 150 });
  const tri = makePolygon('t', 'other', [{ x: 0, y: 0 }, { x: 90, y: 0 }, { x: 0, y: 90 }]);
  assert.equal(shapeHandles(tri).length, 3);
  assert.deepEqual(moveHandle(tri, 2, { x: 5, y: 120 }).points[2], { x: 5, y: 120 });
});

test('tags cycle and saved shapes are validated', () => {
  assert.equal(nextTag('frame'), TAGS[(TAGS.indexOf('frame') + 1) % TAGS.length]);
  const clean = sanitizeShapes([square, { id: 'bad', kind: 'rect' }, { ...square, id: 'x', tag: 'evil' }, 'nope']);
  assert.equal(clean.length, 2);
  assert.equal(clean[1].tag, 'other');
  assert.deepEqual(sanitizeShapes(null), []);
});

test('every scene gives every tag something to show', () => {
  for (const scene of Object.keys(SCENES)) {
    for (const tag of TAGS) assert.ok(effectsFor(scene, tag).length > 0, `${scene}/${tag}`);
  }
  assert.ok(SCENES.diwali && SCENES.align);
});

test('rangoli petals draw in progressively and stay symmetric', () => {
  const none = rangoliPetals(0);
  const all = rangoliPetals(1);
  assert.equal(none.length, 0);
  assert.ok(all.length >= RANGOLI.rings.reduce((n, r) => n + r.petals, 0) - 1);
  const half = rangoliPetals(0.5).length;
  assert.ok(half > 0 && half < all.length);
});

test('a firework burst expands, falls and fades out', () => {
  let bursts = [spawnBurst({ x: 500, y: 300 }, 40, () => 0.5)];
  assert.equal(bursts[0].sparks.length, 40);
  for (let i = 0; i < 60 * 4; i += 1) bursts = stepBursts(bursts, 1 / 60);
  assert.equal(bursts.length, 0);
});

test('every effect a scene asks for exists in the effects library', async () => {
  const { EFFECTS } = await import('../apps/maya-masks/effects.js');
  const { TAGS: tags } = await import('../kit/room/shapes.js');
  for (const scene of Object.keys(SCENES)) {
    for (const tag of tags) for (const name of effectsFor(scene, tag)) assert.ok(EFFECTS[name], `${scene}/${tag}: ${name}`);
  }
});

test('a "picture" is never painted over: every scene only decorates around it', async () => {
  const { EFFECTS } = await import('../apps/maya-masks/effects.js');
  for (const scene of Object.keys(SCENES)) {
    const names = effectsFor(scene, 'picture');
    assert.ok(names.length > 0, scene);
    for (const name of names) assert.equal(EFFECTS[name].clip, false, `${scene}: ${name} paints inside the picture`);
  }
});
