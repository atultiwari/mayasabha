// Finds coloured objects (red cushions, sticky notes…) in a camera frame without OpenCV:
// colour mask → connected blobs → convex outlines in normalised (0..1) camera coordinates.
// Pure functions over RGBA pixel arrays; the caller samples a small video frame (e.g. 160x120).

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ hue: number, hueTol: number, sMin: number, vMin: number }} ColorPreset  hue in degrees */

export const COLOR_PRESETS = Object.freeze({
  red: { hue: 355, hueTol: 16, sMin: 0.45, vMin: 0.2 },
  pink: { hue: 330, hueTol: 16, sMin: 0.35, vMin: 0.35 },
  orange: { hue: 28, hueTol: 12, sMin: 0.5, vMin: 0.4 },
  yellow: { hue: 52, hueTol: 12, sMin: 0.45, vMin: 0.45 },
  green: { hue: 120, hueTol: 30, sMin: 0.35, vMin: 0.2 },
  blue: { hue: 215, hueTol: 25, sMin: 0.4, vMin: 0.2 },
});

/** @returns {{ h: number, s: number, v: number }} h 0..360, s and v 0..1 */
export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d > 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export function matches(hsv, preset) {
  return hsv.s >= preset.sMin && hsv.v >= preset.vMin && hueDistance(hsv.h, preset.hue) <= preset.hueTol;
}

/** A preset built around one sampled colour (click on the object in the camera view). */
export function presetFromSample(hsv) {
  return { hue: hsv.h, hueTol: 14, sMin: Math.max(0.25, hsv.s * 0.6), vMin: Math.max(0.15, hsv.v * 0.5) };
}

/** 1 where the pixel matches the preset. */
export function colorMask(data, w, h, preset) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    if (matches(rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]), preset)) mask[i] = 1;
  }
  return mask;
}

/** 4-connected blobs with at least `minArea` pixels. @returns {{ area: number, cells: Point[] }[]} */
export function labelBlobs(mask, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const blobs = [];
  for (let start = 0; start < w * h; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const cells = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      cells.push({ x, y });
      const around = [x > 0 && i - 1, x < w - 1 && i + 1, y > 0 && i - w, y < h - 1 && i + w];
      for (const j of around) {
        if (j !== false && mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (cells.length >= minArea) blobs.push({ area: cells.length, cells });
  }
  return blobs;
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Andrew's monotone chain. Returns the hull counter-clockwise without repeating the first point. */
export function convexHull(points) {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const build = (list) => list.reduce((hull, p) => {
    const next = [...hull];
    while (next.length >= 2 && cross(next[next.length - 2], next[next.length - 1], p) <= 0) next.pop();
    next.push(p);
    return next;
  }, []);
  const lower = build(pts);
  const upper = build([...pts].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Drops the least important corners (smallest triangle) until at most `max` remain. */
export function simplifyHull(hull, max) {
  let pts = [...hull];
  while (pts.length > max) {
    let worst = 0;
    let worstArea = Infinity;
    pts.forEach((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[(i + 1) % pts.length];
      const area = Math.abs(cross(a, p, b));
      if (area < worstArea) {
        worst = i;
        worstArea = area;
      }
    });
    pts = pts.filter((_, i) => i !== worst);
  }
  return pts;
}

/**
 * Outlines of every matching object, in normalised camera coordinates.
 * @returns {{ points: Point[], center: Point, size: { w: number, h: number }, area: number }[]}
 */
export function blobOutlines(data, w, h, preset, { minArea = 30, maxPoints = 12 } = {}) {
  const blobs = labelBlobs(colorMask(data, w, h, preset), w, h, minArea);
  return blobs.map((blob) => {
    const corners = blob.cells.flatMap(({ x, y }) => [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]);
    const points = simplifyHull(convexHull(corners), maxPoints).map((p) => ({ x: p.x / w, y: p.y / h }));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const size = { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const center = { x: blob.cells.reduce((s, c) => s + c.x + 0.5, 0) / blob.area / w, y: blob.cells.reduce((s, c) => s + c.y + 0.5, 0) / blob.area / h };
    return { points, center, size, area: blob.area / (w * h) };
  });
}

/** True when two detections are the same, unmoved object (small camera jitter is ignored). */
export function sameOutline(a, b, tol = 0.02) {
  return Math.abs(a.center.x - b.center.x) < tol && Math.abs(a.center.y - b.center.y) < tol
    && Math.abs(a.size.w - b.size.w) < tol * 2 && Math.abs(a.size.h - b.size.h) < tol * 2;
}
