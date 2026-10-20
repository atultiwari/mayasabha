// Camera calibration: four bright targets are projected at known stage positions; you click where
// each one appears in the camera preview. That links camera pixels to wall positions, so a hand
// touching the wall lines up with the bubble it touches.

/** Target positions as fractions of the stage, clicked in this order. */
export const CALIBRATION_TARGETS = Object.freeze([
  { x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }, { x: 0.85, y: 0.85 }, { x: 0.15, y: 0.85 },
]);

export function startCalibration() {
  return { points: [], done: false };
}

/** @param {{x:number,y:number}} cameraPoint normalised (0..1) position in the camera frame */
export function addCalibrationClick(state, cameraPoint) {
  const points = [...state.points, { x: cameraPoint.x, y: cameraPoint.y }];
  return { points, done: points.length === CALIBRATION_TARGETS.length };
}

/** Validates saved calibration points. */
export function sanitizeCalibration(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const ok = value.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -1 && p.x <= 2 && p.y >= -1 && p.y <= 2);
  return ok ? value.map(({ x, y }) => ({ x, y })) : null;
}
