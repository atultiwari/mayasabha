// Corner-pin warp: the stage (a fixed-size logical canvas, e.g. 1920x1080) is stretched so its four
// corners land on four screen points. This corrects keystone when the projector is tilted at the
// floor or ceiling, and lets you fit the picture to one part of the wall.
import { computeHomography, applyHomography } from './geometry.js';

/** @typedef {import('./geometry.js').Point} Point */
/** @typedef {{ w: number, h: number }} Size */

/** Corners of a w x h rectangle in TL, TR, BR, BL order. @param {Size} size @returns {Point[]} */
export function rectCorners({ w, h }) {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

/** Largest stage-shaped rectangle centred in the screen ("contain"). @returns {Point[]} */
export function defaultCorners(screen, stage) {
  const scale = Math.min(screen.w / stage.w, screen.h / stage.h);
  const w = stage.w * scale;
  const h = stage.h * scale;
  const x0 = (screen.w - w) / 2;
  const y0 = (screen.h - h) / 2;
  return [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];
}

/** Validates saved corners (from storage). @returns {Point[] | null} */
export function sanitizeCorners(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const ok = value.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!ok) return null;
  const corners = value.map(({ x, y }) => ({ x, y }));
  return isWarpable(corners) ? corners : null;
}

/** False when the quad is collapsed (3+ corners in a line), which has no perspective warp. */
export function isWarpable(corners) {
  try {
    const unit = rectCorners({ w: 1, h: 1 });
    // Both directions must solve: the stage → screen map and its inverse used for clicks.
    return [computeHomography(unit, corners), computeHomography(corners, unit)].every((H) => H.every(Number.isFinite));
  } catch {
    return false;
  }
}

/** @returns {{ toScreen: number[], toStage: number[] }} homographies in both directions */
export function warpMaps(stage, corners) {
  const rect = rectCorners(stage);
  return { toScreen: computeHomography(rect, corners), toStage: computeHomography(corners, rect) };
}

/** CSS matrix3d() for an element of the stage's size with transform-origin 0 0. */
export function cssMatrix3d(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  // CSS matrices are column-major 4x4; the z row/column stays identity.
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, i].join(',')})`;
}

/** Turns the picture upside-down on the same spot (TL↔BR, TR↔BL), returning a new array. */
export function rotateCorners180(corners) {
  return [corners[2], corners[3], corners[0], corners[1]].map(({ x, y }) => ({ x, y }));
}

/** Moves one corner, returning a new array. */
export function moveCorner(corners, index, point) {
  return corners.map((c, i) => (i === index ? { x: point.x, y: point.y } : c));
}

/** Index of the corner within `radius` of `point`, or -1. */
export function hitCorner(corners, point, radius) {
  let best = -1;
  let bestD = radius;
  corners.forEach((c, i) => {
    const d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export { applyHomography };
