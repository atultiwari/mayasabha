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

test('a body that stays still (a parent lying on the sofa) stops counting after a while; a moving child keeps counting', async () => {
  const { activeGrid } = await import('../kit/vision/body-map.js');
  const grid = (cells) => ({ cols: 3, rows: 1, cellW: 10, cellH: 10, cells: Uint8Array.from(cells) });
  let state = activeGrid(null, grid([1, 1, 0]), 0.5);
  assert.deepEqual([...state.grid.cells], [1, 1, 0]); // new arrivals count
  for (let i = 0; i < 4; i += 1) state = activeGrid(state.ages, grid([1, 0, 0]), 0.5);
  state = activeGrid(state.ages, grid([1, 0, 1]), 0.5);
  assert.deepEqual([...state.grid.cells], [0, 0, 1]); // cell 0 held still for 3 s; cell 2 just arrived
  state = activeGrid(state.ages, grid([0, 1, 1]), 0.5);
  assert.deepEqual([...state.grid.cells], [0, 1, 1]); // leaving and coming back counts again
  assert.equal(activeGrid(null, null, 0.5).grid, null);
});

test('someone lying on the sofa is left out; standing or sitting children are not', async () => {
  const { isLyingDown } = await import('../kit/vision/body-map.js');
  const person = (shoulders, hips) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    lm[11] = { ...shoulders[0], visibility: 0.9 }; lm[12] = { ...shoulders[1], visibility: 0.9 };
    lm[23] = { ...hips[0], visibility: 0.9 }; lm[24] = { ...hips[1], visibility: 0.9 };
    return lm;
  };
  const standing = person([{ x: 0.45, y: 0.4 }, { x: 0.5, y: 0.4 }], [{ x: 0.46, y: 0.55 }, { x: 0.49, y: 0.55 }]);
  const leaning = person([{ x: 0.5, y: 0.4 }, { x: 0.55, y: 0.4 }], [{ x: 0.42, y: 0.52 }, { x: 0.47, y: 0.52 }]);
  const lying = person([{ x: 0.7, y: 0.6 }, { x: 0.7, y: 0.64 }], [{ x: 0.5, y: 0.66 }, { x: 0.5, y: 0.7 }]);
  assert.equal(isLyingDown(standing), false);
  assert.equal(isLyingDown(leaning), false);
  assert.equal(isLyingDown(lying), true);
  const unsure = lying.map((p, i) => (i === 23 || i === 24 ? { ...p, visibility: 0.1 } : p));
  assert.equal(isLyingDown(unsure), false); // can't tell: keep them in the game
});

test('tracking looks only at the projected area (plus a margin), so a small child far away is big enough to find', async () => {
  const { focusArea, fromFocus } = await import('../kit/vision/body-map.js');
  const mapping = calibratedMapping(STAGE, [{ x: 0.34, y: 0.34 }, { x: 0.8, y: 0.34 }, { x: 0.8, y: 0.6 }, { x: 0.34, y: 0.6 }]);
  const area = focusArea(mapping, STAGE);
  assert.ok(area.x > 0.15 && area.x < 0.3 && area.x + area.w < 1 && area.w < 0.8, JSON.stringify(area));
  assert.ok(area.y > 0 && area.y + area.h <= 1, JSON.stringify(area));
  const full = focusArea(defaultMapping(STAGE, false), STAGE);
  assert.deepEqual(full, { x: 0, y: 0, w: 1, h: 1 });
  // Points found inside the zoomed area map back to the whole camera frame.
  const p = fromFocus({ x: 0.5, y: 0.5, visibility: 0.9 }, { x: 0.2, y: 0.1, w: 0.6, h: 0.5 });
  close(p.x, 0.5); close(p.y, 0.35); assert.equal(p.visibility, 0.9);
});

test('occupancy grid reads a mask that covers only the zoomed area', () => {
  const mask = { width: 2, height: 2, data: [1, 0, 0, 0], area: { x: 0, y: 0, w: 0.5, h: 0.5 } };
  const g = occupancyGrid(mask, defaultMapping({ w: 4, h: 4 }, false), { w: 4, h: 4 }, 4, 4);
  assert.deepEqual([...g.cells], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('a person whose outline is much wider than tall is lying down, even if the skeleton is fooled', async () => {
  const { isWideShape } = await import('../kit/vision/body-map.js');
  const mask = (w, h, box) => {
    const data = new Float32Array(w * h);
    for (let y = box.y; y < box.y + box.h; y += 1) for (let x = box.x; x < box.x + box.w; x += 1) data[y * w + x] = 1;
    return { width: w, height: h, data };
  };
  assert.equal(isWideShape(mask(100, 100, { x: 10, y: 40, w: 70, h: 20 })), true); // lying on the sofa
  assert.equal(isWideShape(mask(100, 100, { x: 40, y: 20, w: 20, h: 60 })), false); // standing child
  assert.equal(isWideShape(mask(100, 100, { x: 40, y: 30, w: 30, h: 30 })), false); // sitting up
  // Pixels aren't square when the tracked area isn't: 30x20 pixels of a 1:2 frame is tall.
  assert.equal(isWideShape(mask(100, 100, { x: 10, y: 40, w: 30, h: 20 }), 0.5), false);
  assert.equal(isWideShape(mask(10, 10, { x: 0, y: 0, w: 0, h: 0 })), false);
});
