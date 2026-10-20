// Turns what the camera sees into stage coordinates: where the body is (a coarse occupancy grid
// from the person mask) and where the hands are (from pose landmarks). Pure functions; camera points
// are normalised (0..1 of the frame), stage points are in stage pixels.
import { applyHomography, computeHomography } from '../geometry.js';
import { CALIBRATION_TARGETS } from './calibration.js';

const VISIBLE = 0.5;
const MASK_ON = 0.5;
// MediaPipe pose landmark indices: [wrist, index finger] for left and right.
const HAND_POINTS = [[15, 19], [16, 20]];

/**
 * Before calibration: assume the camera frame covers the stage. `mirror` for a camera that faces
 * the players (selfie view) rather than the wall.
 */
export function defaultMapping(stage, mirror) {
  return {
    kind: 'default',
    toStage: ({ x, y }) => ({ x: (mirror ? 1 - x : x) * stage.w, y: y * stage.h }),
    toCamera: ({ x, y }) => ({ x: mirror ? 1 - x / stage.w : x / stage.w, y: y / stage.h }),
  };
}

/** After calibration: the 4 clicked camera points map exactly onto the 4 projected targets. */
export function calibratedMapping(stage, cameraPoints) {
  const targets = CALIBRATION_TARGETS.map((t) => ({ x: t.x * stage.w, y: t.y * stage.h }));
  const toStageH = computeHomography(cameraPoints, targets);
  const toCameraH = computeHomography(targets, cameraPoints);
  return {
    kind: 'calibrated',
    toStage: (p) => applyHomography(toStageH, p),
    toCamera: (p) => applyHomography(toCameraH, p),
  };
}

// Margins around the projected area (fractions of its size): a little to the sides and above, more
// below so the bodies of people standing in front of the wall are in view too.
const FOCUS_MARGIN = { side: 0.05, top: 0.1, bottom: 0.4 };
const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * The part of the camera frame worth tracking: the projected stage plus a margin. Zooming in on it
 * makes a small child far from the camera big enough for the pose model. Whole frame when uncalibrated.
 * @returns {{ x: number, y: number, w: number, h: number }} normalised camera rectangle
 */
export function focusArea(mapping, stage) {
  if (mapping.kind !== 'calibrated') return { ...FULL };
  const corners = [{ x: 0, y: 0 }, { x: stage.w, y: 0 }, { x: stage.w, y: stage.h }, { x: 0, y: stage.h }].map(mapping.toCamera);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const x0 = clamp01(Math.min(...xs) - w * FOCUS_MARGIN.side);
  const x1 = clamp01(Math.max(...xs) + w * FOCUS_MARGIN.side);
  const y0 = clamp01(Math.min(...ys) - h * FOCUS_MARGIN.top);
  const y1 = clamp01(Math.max(...ys) + h * FOCUS_MARGIN.bottom);
  return x1 - x0 < 0.05 || y1 - y0 < 0.05 ? { ...FULL } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A point found inside the focus area, back in whole-frame camera coordinates. */
export function fromFocus(p, area = FULL) {
  return { ...p, x: area.x + p.x * area.w, y: area.y + p.y * area.h };
}

function toFocus(p, area = FULL) {
  return { x: (p.x - area.x) / area.w, y: (p.y - area.y) / area.h };
}

const SHOULDERS = [11, 12];
const HIPS = [23, 24];

function midpoint(lm, [a, b]) {
  const p = lm[a];
  const q = lm[b];
  if (!p || !q || p.visibility < VISIBLE || q.visibility < VISIBLE) return null;
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/**
 * True when a person's torso (shoulders to hips) is closer to flat than upright: a grown-up lying
 * on the sofa, who shouldn't pop the child's bubbles. Unsure (hidden hips) counts as upright.
 * @param {number} aspect camera frame width / height (landmarks are normalised per axis)
 */
export function isLyingDown(lm, aspect = 1) {
  const s = midpoint(lm ?? [], SHOULDERS);
  const h = midpoint(lm ?? [], HIPS);
  if (!s || !h) return false;
  return Math.abs((s.x - h.x) * aspect) > Math.abs(s.y - h.y);
}

/**
 * Samples the person mask at the centre of each stage cell.
 * @param {{ width: number, height: number, data: Float32Array | number[] }} mask
 * @returns {{ cols: number, rows: number, cellW: number, cellH: number, cells: Uint8Array }}
 */
export function occupancyGrid(mask, mapping, stage, cols, rows) {
  const cellW = stage.w / cols;
  const cellH = stage.h / rows;
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cam = toFocus(mapping.toCamera({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH }), mask.area);
      const mx = Math.floor(cam.x * mask.width);
      const my = Math.floor(cam.y * mask.height);
      if (mx >= 0 && my >= 0 && mx < mask.width && my < mask.height && mask.data[my * mask.width + mx] > MASK_ON) {
        cells[r * cols + c] = 1;
      }
    }
  }
  return { cols, rows, cellW, cellH, cells };
}

const STILL_S = 2;

/**
 * Keeps only body cells that arrived recently, so someone sitting or lying still (a parent on the
 * sofa) stops popping things while a moving child keeps playing. `ages` is how long each cell has
 * been covered without a break; pass the returned ages back in next frame.
 * @returns {{ ages: Float32Array | null, grid: object | null }}
 */
export function activeGrid(ages, grid, dt, stillS = STILL_S) {
  if (!grid) return { ages: null, grid: null };
  const prev = ages && ages.length === grid.cells.length ? ages : new Float32Array(grid.cells.length);
  const next = new Float32Array(grid.cells.length);
  const cells = new Uint8Array(grid.cells.length);
  grid.cells.forEach((on, i) => {
    next[i] = on ? prev[i] + dt : 0;
    cells[i] = on && next[i] <= stillS ? 1 : 0;
  });
  return { ages: next, grid: { ...grid, cells } };
}

/** 1 if the body covers stage point p, else 0. */
export function gridAt(grid, p) {
  if (!grid) return 0;
  const c = Math.floor(p.x / grid.cellW);
  const r = Math.floor(p.y / grid.cellH);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return 0;
  return grid.cells[r * grid.cols + c];
}

/** Hand positions (stage px) from every detected pose: midway between wrist and index finger. */
export function handsFromPose(poses, mapping) {
  const hands = [];
  for (const lm of poses ?? []) {
    for (const [wristI, indexI] of HAND_POINTS) {
      const wrist = lm[wristI];
      const index = lm[indexI];
      if (!wrist || wrist.visibility < VISIBLE) continue;
      const p = index && index.visibility >= VISIBLE ? { x: (wrist.x + index.x) / 2, y: (wrist.y + index.y) / 2 } : wrist;
      hands.push(mapping.toStage(p));
    }
  }
  return hands;
}
