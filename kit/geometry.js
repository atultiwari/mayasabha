// Homography maths, copied from sticky-bounce/src/geometry.js.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {number[]} Homography  row-major 3x3, length 9 */

/**
 * Solves the 3x3 perspective transform mapping 4 src points onto 4 dst points
 * (same maths as cv.getPerspectiveTransform). Used for projector calibration.
 * @param {Point[]} src @param {Point[]} dst
 * @returns {Homography}
 */
export function computeHomography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) throw new Error('computeHomography needs exactly 4 point pairs');
  const rows = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const h = solveLinear(rows);
  return [...h, 1];
}

/** Gaussian elimination with partial pivoting on an augmented n x (n+1) matrix. */
function solveLinear(augmented) {
  const m = augmented.map((row) => [...row]);
  const n = m.length;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) throw new Error('computeHomography: degenerate points (3 or more collinear)');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c += 1) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** @param {Homography} H @param {Point} p @returns {Point} */
export function applyHomography(H, { x, y }) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}
