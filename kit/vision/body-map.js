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

// Arm chains per side: shoulder, elbow, wrist, index finger.
const ARMS = [[11, 13, 15, 19], [12, 14, 16, 20]];
const NOSE = 0;

const seen = (p) => p && p.visibility >= VISIBLE;

/**
 * The child's shape in stage px, for butterflies to gather around: head, shoulders and arms (each
 * shoulder→elbow→wrist→finger, visible parts only). With several upright people it picks the
 * smallest (the child, not a grown-up walking past). Null when nobody's shoulders are seen.
 * @returns {{ head: {x,y}, shoulders: {x,y}[], arms: {x,y}[][], size: number } | null}
 */
export function bodyFromPose(poses, mapping) {
  const people = (poses ?? []).map((lm) => personShape(lm, mapping)).filter(Boolean);
  if (!people.length) return null;
  return people.reduce((a, b) => (b.size < a.size ? b : a));
}

function personShape(lm, mapping) {
  if (!seen(lm[11]) || !seen(lm[12])) return null;
  const at = (i) => mapping.toStage(lm[i]);
  const shoulders = [at(11), at(12)];
  const mid = { x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 };
  const width = Math.max(40, Math.hypot(shoulders[0].x - shoulders[1].x, shoulders[0].y - shoulders[1].y));
  const hips = seen(lm[23]) && seen(lm[24]) ? [at(23), at(24)] : null;
  const size = hips ? Math.hypot(mid.x - (hips[0].x + hips[1].x) / 2, mid.y - (hips[0].y + hips[1].y) / 2) : width * 1.6;
  const head = seen(lm[NOSE]) ? at(NOSE) : { x: mid.x, y: mid.y - width * 0.8 };
  const arms = ARMS.map((chain) => {
    const visible = [];
    for (const i of chain) {
      if (!seen(lm[i])) break; // an arm is only useful from the shoulder outwards
      visible.push(at(i));
    }
    return visible;
  }).filter((arm) => arm.length >= 2);
  return { head, shoulders, hips, arms, size };
}

const WIDE = 1.3; // a standing child, even with arms out, is about as wide as tall

/**
 * True when one person's outline (their own mask) is much wider than tall: someone lying on the
 * sofa, even when the skeleton is fitted onto raised knees and looks upright.
 * @param {number} pixelAspect width / height of one mask pixel in the real picture
 */
export function isWideShape(mask, pixelAspect = 1) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] > MASK_ON) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return false;
  return ((x1 - x0 + 1) * pixelAspect) / (y1 - y0 + 1) > WIDE;
}
