import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOR_PRESETS, blobOutlines, colorMask, convexHull, labelBlobs, matches, presetFromSample, rgbToHsv, simplifyHull, sameOutline,
} from '../kit/vision/color-blobs.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

/** Builds an RGBA image filled with `bg`, with rectangles painted on it. */
function image(w, h, bg, rects) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const r = rects.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      const [cr, cg, cb] = r ? r.color : bg;
      data.set([cr, cg, cb, 255], (y * w + x) * 4);
    }
  }
  return data;
}

const RED = [200, 30, 50];
const ORANGE = [240, 140, 30];
const FLOOR = [230, 228, 220];

test('rgbToHsv gives hue in degrees and saturation/value in 0..1', () => {
  const red = rgbToHsv(255, 0, 0);
  close(red.h, 0);
  close(red.s, 1);
  close(red.v, 1);
  close(rgbToHsv(0, 0, 255).h, 240);
  close(rgbToHsv(128, 128, 128).s, 0);
});

test('the red preset matches cushion red (hue wraps past 0) but not floor tiles or orange', () => {
  assert.equal(matches(rgbToHsv(...RED), COLOR_PRESETS.red), true);
  assert.equal(matches(rgbToHsv(220, 20, 25), COLOR_PRESETS.red), true);
  assert.equal(matches(rgbToHsv(...FLOOR), COLOR_PRESETS.red), false);
  assert.equal(matches(rgbToHsv(...ORANGE), COLOR_PRESETS.red), false);
});

test('a sampled colour becomes a preset that matches itself', () => {
  const p = presetFromSample(rgbToHsv(...ORANGE));
  assert.equal(matches(rgbToHsv(...ORANGE), p), true);
  assert.equal(matches(rgbToHsv(...RED), p), false);
});

test('two red cushions on the floor become two blobs; specks are ignored', () => {
  const w = 40;
  const h = 20;
  const data = image(w, h, FLOOR, [
    { x: 3, y: 4, w: 8, h: 6, color: RED },
    { x: 25, y: 8, w: 10, h: 7, color: RED },
    { x: 18, y: 2, w: 1, h: 1, color: RED }, // speck
    { x: 15, y: 14, w: 5, h: 4, color: ORANGE },
  ]);
  const mask = colorMask(data, w, h, COLOR_PRESETS.red);
  const blobs = labelBlobs(mask, w, h, 4);
  assert.equal(blobs.length, 2);
  assert.deepEqual(blobs.map((b) => b.area).sort((a, b) => a - b), [48, 70]);
});

test('convex hull and simplification', () => {
  const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 }, { x: 2, y: 0 }];
  const hull = convexHull(pts);
  assert.equal(hull.length, 4);
  const circle = Array.from({ length: 40 }, (_, i) => ({ x: Math.cos((i / 40) * 6.283) * 10, y: Math.sin((i / 40) * 6.283) * 10 }));
  assert.ok(simplifyHull(convexHull(circle), 10).length <= 10);
});

test('blob outlines come back in normalised camera coordinates covering the blob', () => {
  const w = 40;
  const h = 20;
  const data = image(w, h, FLOOR, [{ x: 10, y: 5, w: 10, h: 10, color: RED }]);
  const [outline] = blobOutlines(data, w, h, COLOR_PRESETS.red, { minArea: 4, maxPoints: 12 });
  const xs = outline.points.map((p) => p.x);
  const ys = outline.points.map((p) => p.y);
  close(Math.min(...xs), 10 / w);
  close(Math.max(...xs), 20 / w);
  close(Math.min(...ys), 5 / h);
  close(Math.max(...ys), 15 / h);
  close(outline.center.x, 15 / w);
});

test('sameOutline ignores camera jitter but notices a moved cushion', () => {
  const a = { center: { x: 0.5, y: 0.5 }, size: { w: 0.2, h: 0.1 } };
  assert.equal(sameOutline(a, { center: { x: 0.505, y: 0.498 }, size: { w: 0.202, h: 0.1 } }), true);
  assert.equal(sameOutline(a, { center: { x: 0.6, y: 0.5 }, size: { w: 0.2, h: 0.1 } }), false);
});
