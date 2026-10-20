import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibratedMapping, defaultMapping, occupancyGrid, handsFromPose, gridAt } from '../kit/vision/body-map.js';
import { trackHands, HANDS } from '../kit/vision/hand-tracker.js';
import { CALIBRATION_TARGETS, addCalibrationClick, startCalibration } from '../kit/vision/calibration.js';

const STAGE = { w: 1920, h: 1080 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('default mapping stretches the camera over the stage and can mirror', () => {
  const plain = defaultMapping(STAGE, false);
  assert.deepEqual(plain.toStage({ x: 0.25, y: 0.5 }), { x: 480, y: 540 });
  const mirrored = defaultMapping(STAGE, true);
  assert.deepEqual(mirrored.toStage({ x: 0.25, y: 0.5 }), { x: 1440, y: 540 });
  const back = mirrored.toCamera({ x: 1440, y: 540 });
  close(back.x, 0.25);
});

test('calibrated mapping sends the clicked camera points onto the stage targets', () => {
  const cam = [{ x: 0.2, y: 0.25 }, { x: 0.75, y: 0.2 }, { x: 0.8, y: 0.7 }, { x: 0.25, y: 0.8 }];
  const map = calibratedMapping(STAGE, cam);
  const target = map.toStage(cam[2]);
  close(target.x, CALIBRATION_TARGETS[2].x * STAGE.w, 1e-6);
  close(target.y, CALIBRATION_TARGETS[2].y * STAGE.h, 1e-6);
  const round = map.toCamera(map.toStage({ x: 0.5, y: 0.5 }));
  close(round.x, 0.5, 1e-9);
});

test('occupancy grid marks the cells where the person mask is', () => {
  // 4x2 mask, person on the left half.
  const mask = { width: 4, height: 2, data: Float32Array.from([1, 1, 0, 0, 1, 1, 0, 0]) };
  const grid = occupancyGrid(mask, defaultMapping(STAGE, false), STAGE, 8, 4);
  assert.equal(grid.cells.length, 32);
  assert.equal(gridAt(grid, { x: 100, y: 500 }), 1);
  assert.equal(gridAt(grid, { x: 1800, y: 500 }), 0);
  assert.equal(gridAt(grid, { x: -50, y: 500 }), 0);
});

test('handsFromPose uses visible wrists and index fingers, skipping hidden ones', () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  lm[15] = { x: 0.2, y: 0.4, visibility: 0.9 };
  lm[19] = { x: 0.24, y: 0.36, visibility: 0.9 };
  const hands = handsFromPose([lm], defaultMapping(STAGE, false));
  assert.equal(hands.length, 1);
  close(hands[0].x, 0.22 * STAGE.w);
  close(hands[0].y, 0.38 * STAGE.h);
});

test('hand tracker keeps identity, measures speed and stillness, and forgets lost hands', () => {
  let tracks = trackHands([], [{ x: 100, y: 100 }], 0.1);
  const id = tracks[0].id;
  tracks = trackHands(tracks, [{ x: 110, y: 100 }], 0.1);
  assert.equal(tracks[0].id, id);
  assert.ok(tracks[0].speed > 0);
  for (let i = 0; i < 20; i += 1) tracks = trackHands(tracks, [{ x: 110, y: 100 }], 0.05);
  assert.ok(tracks[0].stillFor >= HANDS.stillAfter, `still ${tracks[0].stillFor}`);
  for (let i = 0; i < 20; i += 1) tracks = trackHands(tracks, [], 0.05);
  assert.equal(tracks.length, 0);
});

test('calibration collects 4 clicks, then produces a mapping', () => {
  let c = startCalibration();
  for (const p of [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }]) c = addCalibrationClick(c, p);
  assert.equal(c.done, false);
  c = addCalibrationClick(c, { x: 0.1, y: 0.9 });
  assert.equal(c.done, true);
  assert.equal(c.points.length, 4);
});
