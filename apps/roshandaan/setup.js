// Roshandaan geometry (pure). The ceiling is the 3D "screen": a plane at z = 0, in metres, centred on
// the light box, with +z pointing down into the room (where the viewer is). The light box's four
// corners (projector px, found by the camera calibration) tie projector pixels to real metres.
import { computeHomography } from '../../kit/geometry.js';

const MAX_SPAN = 8; // metres: never render more ceiling than this, whatever the projector reaches
const SIZE_RANGE = [0.2, 2];
const DEFAULT_EYE = Object.freeze({ x: 0, y: 0, z: 2.5 });

/** The light box's corners in metres: top-left, top-right, bottom-right, bottom-left (y up). */
export function metricCorners(size) {
  const h = size / 2;
  return [{ x: -h, y: h }, { x: h, y: h }, { x: h, y: -h }, { x: -h, y: -h }];
}

/** Homography from projector pixels to ceiling metres. */
export function projectorToMetric(panelCorners, size) {
  return computeHomography(panelCorners, metricCorners(size));
}

/** The patch of ceiling to render: wherever the projector reaches (clamped), always including the box. */
export function ceilingRect(H, screen) {
  const pts = [{ x: 0, y: 0 }, { x: screen.w, y: 0 }, { x: screen.w, y: screen.h }, { x: 0, y: screen.h }].map((p) => {
    const q = [H[0] * p.x + H[1] * p.y + H[2], H[3] * p.x + H[4] * p.y + H[5], H[6] * p.x + H[7] * p.y + H[8]];
    return { x: q[0] / q[2], y: q[1] / q[2] };
  });
  const clamp = (v) => Math.max(-MAX_SPAN / 2, Math.min(MAX_SPAN / 2, v));
  return {
    x0: clamp(Math.min(...pts.map((p) => p.x))), x1: clamp(Math.max(...pts.map((p) => p.x))),
    y0: clamp(Math.min(...pts.map((p) => p.y))), y1: clamp(Math.max(...pts.map((p) => p.y))),
  };
}

/** The ceiling patch as an off-axis "wall" (see kona/corner-geometry.js): lower-left, lower-right, upper-left. */
export function screenWall(rect) {
  return { pa: { x: rect.x0, y: rect.y0, z: 0 }, pb: { x: rect.x1, y: rect.y0, z: 0 }, pc: { x: rect.x0, y: rect.y1, z: 0 } };
}

const finite = (v) => Number.isFinite(v);

/** Validates a saved setup; anything missing or odd falls back to a box in the middle seen from below. */
export function sanitizeSetup(value, screen) {
  const v = value && typeof value === 'object' ? value : {};
  const cornersOk = Array.isArray(v.panelCorners) && v.panelCorners.length === 4 && v.panelCorners.every((p) => p && finite(p.x) && finite(p.y));
  const s = Math.min(screen.w, screen.h) * 0.3;
  const cx = screen.w / 2;
  const cy = screen.h / 2;
  const panelCorners = cornersOk
    ? v.panelCorners.map(({ x, y }) => ({ x, y }))
    : [{ x: cx - s, y: cy - s }, { x: cx + s, y: cy - s }, { x: cx + s, y: cy + s }, { x: cx - s, y: cy + s }];
  const panelSize = finite(v.panelSize) && v.panelSize >= SIZE_RANGE[0] && v.panelSize <= SIZE_RANGE[1] ? v.panelSize : 0.6;
  const e = v.eye ?? {};
  const eye = finite(e.x) && finite(e.y) && finite(e.z) && e.z > 0.5 && e.z < 20 ? { x: e.x, y: e.y, z: e.z } : { ...DEFAULT_EYE };
  return { panelCorners, panelSize, eye };
}
