// Geometry for Daraar (pure, stage px): where the hole goes, cracks that branch out from one point,
// the jagged crack that becomes the hole's frame, and the shards the ceiling breaks into.

const HOLE_MARGIN = Object.freeze({ x: 0.16, y: 0.16 });
const CRACK = Object.freeze({ mains: 7, step: 40, wiggle: 0.35, minLen: 320, maxLen: 720, branchesPerMain: 2 });
const FRAME = Object.freeze({ step: 36, jitter: 12 });
const SHARDS = Object.freeze({ cols: 6, rows: 5, jitter: 0.22 });

/** The hole: the middle of the ceiling picture, leaving room around it for cracks and the hand. */
export function holeRect(stage) {
  const x = stage.w * HOLE_MARGIN.x;
  const y = stage.h * HOLE_MARGIN.y;
  return { x, y, w: stage.w - 2 * x, h: stage.h - 2 * y };
}

const clampTo = (stage, p) => ({ x: Math.min(stage.w, Math.max(0, p.x)), y: Math.min(stage.h, Math.max(0, p.y)) });

function walk(stage, from, heading, length, rng) {
  const points = [from];
  let p = from;
  let h = heading;
  for (let d = 0; d < length; d += CRACK.step) {
    h += (rng() - 0.5) * 2 * CRACK.wiggle;
    p = clampTo(stage, { x: p.x + Math.cos(h) * CRACK.step, y: p.y + Math.sin(h) * CRACK.step });
    points.push(p);
  }
  return points;
}

/**
 * A network of cracks from `origin`. Each crack: { points, start } where start (0..1) is when, during
 * the cracks phase, it begins to grow (branches start once their parent has reached them).
 */
export function makeCracks(stage, origin, rng) {
  const cracks = [];
  for (let i = 0; i < CRACK.mains; i += 1) {
    const heading = (i / CRACK.mains) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const length = CRACK.minLen + rng() * (CRACK.maxLen - CRACK.minLen);
    const main = walk(stage, origin, heading, length, rng);
    cracks.push({ points: main, start: 0 });
    for (let b = 0; b < CRACK.branchesPerMain; b += 1) {
      const at = Math.floor(main.length * (0.25 + rng() * 0.5));
      const side = rng() < 0.5 ? -1 : 1;
      cracks.push({
        points: walk(stage, main[at], heading + side * (0.6 + rng() * 0.5), 100 + rng() * 160, rng),
        start: Math.min(0.95, at / (main.length - 1)), // the main crack reaches here at this point of its growth
      });
    }
  }
  return cracks;
}

/** A closed, jagged path running round the hole's edge (it starts and ends at the top-left corner). */
export function framePath(hole, rng) {
  const corners = [{ x: hole.x, y: hole.y }, { x: hole.x + hole.w, y: hole.y }, { x: hole.x + hole.w, y: hole.y + hole.h }, { x: hole.x, y: hole.y + hole.h }];
  const path = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / FRAME.step));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (let s = 0; s < n; s += 1) {
      const k = s / n;
      const j = s === 0 ? 0 : (rng() - 0.5) * 2 * FRAME.jitter;
      path.push({ x: a.x + (b.x - a.x) * k + nx * j, y: a.y + (b.y - a.y) * k + ny * j });
    }
  });
  path.push({ ...corners[0] });
  return path;
}

export function pathLength(points) {
  return points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
}

/** The first `k` (0..1) of a path, by length. */
export function partial(points, k) {
  if (k >= 1) return points;
  let left = Math.max(0, k) * pathLength(points);
  const out = [points[0]];
  for (let i = 1; i < points.length && left > 0; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg <= left) {
      out.push(b);
      left -= seg;
    } else {
      const f = left / seg;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
      left = 0;
    }
  }
  return out;
}

/** The hole's ceiling broken into triangles that tile it exactly (a jittered grid, two per cell). */
export function makeShards(hole, rng) {
  const { cols, rows, jitter } = SHARDS;
  const cw = hole.w / cols;
  const ch = hole.h / rows;
  const grid = Array.from({ length: rows + 1 }, (_, r) => Array.from({ length: cols + 1 }, (_, c) => {
    const inner = r > 0 && r < rows && c > 0 && c < cols;
    return {
      x: hole.x + c * cw + (inner ? (rng() - 0.5) * 2 * jitter * cw : 0),
      y: hole.y + r * ch + (inner ? (rng() - 0.5) * 2 * jitter * ch : 0),
    };
  }));
  const shards = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const [a, b, d, e] = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]];
      const flip = (r + c) % 2 === 0;
      const tris = flip ? [[a, b, d], [a, d, e]] : [[a, b, e], [b, d, e]];
      for (const points of tris) shards.push({ points, spin: (rng() - 0.5) * 6, delay: rng() * 0.4 });
    }
  }
  return shards;
}
