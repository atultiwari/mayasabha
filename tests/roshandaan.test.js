import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHomography } from '../kit/geometry.js';
import { ceilingRect, metricCorners, projectorToMetric, sanitizeSetup, screenWall } from '../apps/roshandaan/setup.js';
import { PHASES, TOTAL_S, handAt, panelAt, phaseAt, phaseStart } from '../apps/roshandaan/timeline.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const SCREEN = { w: 1280, h: 720 };
// The office light box, as found by the camera calibration (projector px, corners in order round the frame).
const CORNERS = [{ x: 365, y: 567 }, { x: 431, y: 262 }, { x: 742, y: 327 }, { x: 678, y: 633 }];

test('the light box corners map to a square of its real size on the ceiling (metres, centred on it)', () => {
  const H = projectorToMetric(CORNERS, 0.6);
  const m = metricCorners(0.6);
  CORNERS.forEach((c, i) => {
    const p = applyHomography(H, c);
    close(p.x, m[i].x);
    close(p.y, m[i].y);
  });
  const centre = applyHomography(H, { x: (365 + 742) / 2, y: (567 + 327) / 2 });
  assert.ok(Math.hypot(centre.x, centre.y) < 0.02, 'middle of the box is the origin');
});

test('the rendered ceiling area covers the whole projection around the light box, within a sensible size', () => {
  const H = projectorToMetric(CORNERS, 0.6);
  const r = ceilingRect(H, SCREEN);
  assert.ok(r.x0 < -0.3 && r.x1 > 0.3 && r.y0 < -0.3 && r.y1 > 0.3, 'contains the light box');
  for (const p of [{ x: 0, y: 0 }, { x: 1280, y: 0 }, { x: 1280, y: 720 }, { x: 0, y: 720 }]) {
    const q = applyHomography(H, p);
    assert.ok(q.x >= r.x0 - 1e-9 && q.x <= r.x1 + 1e-9 && q.y >= r.y0 - 1e-9 && q.y <= r.y1 + 1e-9, 'projection corner inside');
  }
  assert.ok(r.x1 - r.x0 <= 8 && r.y1 - r.y0 <= 8, 'clamped');
});

test('the ceiling is the 3D screen: a plane at z = 0 facing down into the room (+z)', () => {
  const w = screenWall({ x0: -1, y0: -0.5, x1: 1.5, y1: 0.8 });
  assert.deepEqual(w.pa, { x: -1, y: -0.5, z: 0 });
  assert.deepEqual(w.pb, { x: 1.5, y: -0.5, z: 0 });
  assert.deepEqual(w.pc, { x: -1, y: 0.8, z: 0 });
});

test('saved setup is checked: bad corners or eye fall back to safe defaults', () => {
  const ok = sanitizeSetup({ panelCorners: CORNERS, panelSize: 0.6, eye: { x: -0.2, y: 0.06, z: 2.97 } }, SCREEN);
  assert.equal(ok.panelSize, 0.6);
  assert.equal(ok.eye.z, 2.97);
  const bad = sanitizeSetup({ panelCorners: [{ x: 1 }], panelSize: -3, eye: { z: -1 } }, SCREEN);
  assert.equal(bad.panelCorners.length, 4);
  assert.ok(bad.panelSize > 0.2 && bad.panelSize <= 2);
  assert.ok(bad.eye.z > 0.5, 'the eye is below the ceiling');
});

test('the story: light on, flicker, dark, crack, shatter, the shaft, a hand rises, grips the frame, lunges', () => {
  assert.deepEqual(PHASES.map(([n]) => n), ['light', 'flicker', 'dark', 'crack', 'shatter', 'shaft', 'rise', 'grip', 'lunge', 'black']);
  assert.equal(phaseAt(0).name, 'light');
  assert.equal(phaseAt(TOTAL_S + 1).name, 'done');
  assert.equal(phaseAt(phaseStart('grip') + 0.01).name, 'grip');
});

test('the panel glows like a real light at first, flickers, goes dark, then cracks and breaks', () => {
  assert.equal(panelAt(0.5).glow, 1);
  const flicker = Array.from({ length: 30 }, (_, i) => panelAt(phaseStart('flicker') + i * 0.1).glow);
  assert.ok(Math.min(...flicker) < 0.2 && Math.max(...flicker) > 0.8, 'flickers');
  assert.equal(panelAt(phaseStart('dark') + 0.5).glow, 0);
  assert.ok(panelAt(phaseStart('crack') + 1).crack > 0 && panelAt(phaseStart('crack') + 1).crack < 1);
  assert.equal(panelAt(phaseStart('shatter') - 0.01).broken, false);
  assert.equal(panelAt(phaseStart('shatter') + 0.01).broken, true);
});

test('the hand rises from deep in the shaft, grips the frame below the ceiling, then lunges at you', () => {
  const deep = handAt(phaseStart('rise'));
  const gripping = handAt(phaseStart('grip') + 2);
  const lunging = handAt(phaseStart('lunge') + 1);
  assert.equal(handAt(phaseStart('shaft')).visible, false);
  assert.ok(deep.visible && deep.z < -1.5, 'starts deep up the shaft');
  assert.ok(gripping.z > 0 && gripping.z < 0.4, 'just below the ceiling, over the frame');
  assert.ok(gripping.curl > 0.6, 'fingers curled over the edge');
  assert.ok(lunging.z > 1, 'comes at the camera');
  assert.equal(handAt(phaseStart('rise') + 1).bend, 0, 'rising: fingers reach down at you');
  assert.ok(gripping.bend > 0.95, 'gripping: wrist bent so the fingers go over the edge');
  assert.ok(lunging.bend < gripping.bend, 'lunging: fingers point at you again');
});
