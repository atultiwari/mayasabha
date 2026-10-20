// Cushion Physics game rules (pure): where fruit drops, where Hathi waits, which detected cushion is
// which (so a cushion that hasn't moved isn't rebuilt every frame), virtual cushions for playing
// without a camera, and a note per cushion for the musical Marbles mode.
import { sameOutline } from '../../kit/vision/color-blobs.js';
import { contains } from '../../kit/room/shapes.js';

export const GAME = Object.freeze({ dropEvery: 1.3, maxItems: 18, goalW: 300, goalH: 120, goalSpots: [0.18, 0.5, 0.82] });

// C major pentatonic, two octaves: any order of bounces sounds pleasant.
export const NOTES = Object.freeze([262, 294, 330, 392, 440, 523, 587, 659, 784, 880]);
export const noteFor = (index) => NOTES[((index % NOTES.length) + NOTES.length) % NOTES.length];

/** The drop point sweeps slowly back and forth across the top. */
export function spawnX(t, width) {
  return width * (0.5 + 0.38 * Math.sin(t * 0.55) * Math.cos(t * 0.17));
}

/** @returns {{ state: { next: number }, drop: boolean }} */
export function tickSpawner(state, dt, itemCount) {
  const next = state.next - dt;
  if (next > 0) return { state: { next }, drop: false };
  if (itemCount >= GAME.maxItems) return { state: { next: 0 }, drop: false };
  return { state: { next: GAME.dropEvery }, drop: true };
}

/** Hathi's spot at the bottom: 0 left, 1 middle, 2 right. */
export function goalRect(stage, spot) {
  const i = Math.max(0, Math.min(GAME.goalSpots.length - 1, spot));
  return { x: stage.w * GAME.goalSpots[i] - GAME.goalW / 2, y: stage.h - GAME.goalH - 10, w: GAME.goalW, h: GAME.goalH };
}

let counter = 0;

/**
 * Matches fresh detections to known cushions. Unmoved cushions keep id and version; moved ones
 * get a new version (so physics rebuilds just them); vanished ones drop out.
 */
export function syncTracked(tracked, outlines) {
  const unused = [...tracked];
  return outlines.map((o) => {
    const i = unused.findIndex((t) => sameOutline(t.outline, o, 0.05));
    if (i === -1) {
      counter += 1;
      return { id: `c${counter}`, version: 1, outline: o };
    }
    const [match] = unused.splice(i, 1);
    return sameOutline(match.outline, o) ? match : { ...match, version: match.version + 1, outline: o };
  });
}

/** Three draggable cushions (rounded rectangles in stage px) for playing without a camera. */
export function defaultCushions(stage) {
  const w = 300;
  const h = 110;
  return [
    { id: 'v1', version: 1, x: stage.w * 0.22 - w / 2, y: stage.h * 0.35, w, h, angle: 0.25 },
    { id: 'v2', version: 1, x: stage.w * 0.55 - w / 2, y: stage.h * 0.55, w, h, angle: -0.2 },
    { id: 'v3', version: 1, x: stage.w * 0.78 - w / 2, y: stage.h * 0.3, w, h, angle: 0.1 },
  ];
}

export function cushionAt(cushions, p) {
  return [...cushions].reverse().find((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) ?? null;
}

export function moveCushion(cushions, id, dx, dy) {
  return cushions.map((c) => (c.id === id ? { ...c, x: c.x + dx, y: c.y + dy, version: c.version + 1 } : c));
}

/** Corner points of a (rotated) virtual cushion. */
export function virtualPoints(c) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const dx = (sx * c.w) / 2;
    const dy = (sy * c.h) / 2;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/** Top of a polygon at column x (null when x is outside it). */
function topAtX(points, x) {
  let best = null;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    if ((p.x - x) * (q.x - x) > 0 || p.x === q.x) return;
    const y = p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y);
    best = best === null ? y : Math.min(best, y);
  });
  return best;
}

/**
 * Wall mode: Hathi stands on the lowest real surface under his spot (e.g. the sofa backrest),
 * so fruit can actually reach him instead of piling up on a surface above his head.
 */
export function goalOnSurface(stage, spot, solids) {
  const base = goalRect(stage, spot);
  const cx = base.x + base.w / 2;
  const tops = solids.map((s) => topAtX(s.points, cx)).filter((y) => y !== null && y < base.y + base.h);
  if (!tops.length) return base;
  return { ...base, y: Math.max(...tops) - base.h };
}

const middle = (points) => ({
  x: points.reduce((a, p) => a + p.x, 0) / points.length,
  y: points.reduce((a, p) => a + p.y, 0) / points.length,
});

/** Drops detected blobs sitting inside protected pictures (a red puja frame is not a cushion). */
export function outsidePictures(shapes, pictures) {
  return shapes.filter((s) => !pictures.some((pic) => contains(pic, middle(s.points))));
}
