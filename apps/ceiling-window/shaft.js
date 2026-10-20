// Geometry of the "hole in the ceiling" as seen by someone lying below it. The projected rectangle is
// the hole's rim; a shaft of four walls runs up to a smaller far opening where the scene is. Moving
// the vanishing point towards the viewer's position makes the depth look right from where they lie.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

export const DEPTH_RANGE = Object.freeze([0.3, 0.8]); // far opening size as a fraction of the rim
export const OFFSET_RANGE = 0.3; // how far (fraction of the rim) the vanishing point can move

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * The far opening. depth = its size relative to the rim (smaller looks deeper);
 * offset = vanishing-point shift as a fraction of the rim size.
 * @returns {Rect}
 */
export function farRect(stage, { depth, offset }) {
  const k = clamp(depth, ...DEPTH_RANGE);
  const w = stage.w * k;
  const h = stage.h * k;
  const cx = stage.w / 2 + clamp(offset.x, -OFFSET_RANGE, OFFSET_RANGE) * stage.w;
  const cy = stage.h / 2 + clamp(offset.y, -OFFSET_RANGE, OFFSET_RANGE) * stage.h;
  return { x: clamp(cx - w / 2, 0, stage.w - w), y: clamp(cy - h / 2, 0, stage.h - h), w, h };
}

const corners = (r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

/** Four wall quads, each listed rim-start, rim-end, far-end, far-start. */
export function shaftWalls(stage, far) {
  const [a, b, c, d] = corners({ x: 0, y: 0, w: stage.w, h: stage.h });
  const [fa, fb, fc, fd] = corners(far);
  return { top: [a, b, fb, fa], right: [b, c, fc, fb], bottom: [c, d, fd, fc], left: [d, a, fa, fd] };
}

/**
 * Evenly spaced depth slices between rim and far opening, drawn as faint rings on the walls.
 * True perspective: equal steps in depth get closer together on screen.
 * @returns {Rect[]}
 */
export function depthRings(stage, far, count) {
  const k = far.w / stage.w;
  return Array.from({ length: count }, (_, i) => {
    const z = (i + 1) / (count + 1);
    const t = (1 - 1 / (1 + z * (1 / k - 1))) / (1 - k); // 0 at rim, 1 at far opening
    return {
      x: far.x * t,
      y: far.y * t,
      w: stage.w + (far.w - stage.w) * t,
      h: stage.h + (far.h - stage.h) * t,
    };
  });
}

/** Maps normalised (0..1) coordinates inside the far opening to stage pixels. */
export function toFar(far, u, v) {
  return { x: far.x + u * far.w, y: far.y + v * far.h };
}
