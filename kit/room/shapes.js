// Mapping shapes: the outlines of real objects (picture frames, the door, balloons, the clock, a
// patch of floor), traced once in stage coordinates. Content is clipped to these shapes so the
// objects themselves seem to change. Pure geometry plus a canvas path helper; no other DOM.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ id: string, kind: 'rect'|'ellipse', tag: string, x: number, y: number, w: number, h: number }} BoxShape */
/** @typedef {{ id: string, kind: 'polygon', tag: string, points: Point[] }} PolygonShape */

// picture: a framed picture whose image must stay untouched (e.g. a puja picture): activities only
// decorate around it and never paint inside it or bounce things off it.
export const TAGS = Object.freeze(['frame', 'picture', 'door', 'shelf', 'balloon', 'clock', 'floor', 'other']);
const MIN_SIZE = 20;

export const nextTag = (tag) => TAGS[(TAGS.indexOf(tag) + 1) % TAGS.length];

function makeBox(kind, id, tag, a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return w < MIN_SIZE || h < MIN_SIZE ? null : { id, kind, tag, x, y, w, h };
}

export const makeRect = (id, tag, a, b) => makeBox('rect', id, tag, a, b);
export const makeEllipse = (id, tag, a, b) => makeBox('ellipse', id, tag, a, b);

function polygonArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function makePolygon(id, tag, points) {
  if (points.length < 3 || Math.abs(polygonArea(points)) < MIN_SIZE * MIN_SIZE) return null;
  return { id, kind: 'polygon', tag, points: points.map(({ x, y }) => ({ x, y })) };
}

export function bbox(s) {
  if (s.kind !== 'polygon') return { x: s.x, y: s.y, w: s.w, h: s.h };
  const xs = s.points.map((p) => p.x);
  const ys = s.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function centroid(s) {
  if (s.kind !== 'polygon') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const a = polygonArea(s.points);
  let cx = 0;
  let cy = 0;
  s.points.forEach((p, i) => {
    const q = s.points[(i + 1) % s.points.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  });
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function contains(s, p) {
  if (s.kind === 'rect') return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
  if (s.kind === 'ellipse') {
    const dx = (p.x - (s.x + s.w / 2)) / (s.w / 2);
    const dy = (p.y - (s.y + s.h / 2)) / (s.h / 2);
    return dx * dx + dy * dy <= 1;
  }
  let inside = false;
  const pts = s.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Highest point of the outline at column x (for placing things that sit on top of an object). */
function topAt(s, x) {
  const b = bbox(s);
  if (s.kind === 'rect') return s.y;
  if (s.kind === 'ellipse') {
    const k = (x - (s.x + s.w / 2)) / (s.w / 2);
    return s.y + s.h / 2 - (s.h / 2) * Math.sqrt(Math.max(0, 1 - k * k));
  }
  let best = Infinity;
  s.points.forEach((p, i) => {
    const q = s.points[(i + 1) % s.points.length];
    if ((p.x - x) * (q.x - x) > 0 || p.x === q.x) return;
    const y = p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y);
    best = Math.min(best, y);
  });
  return Number.isFinite(best) ? best : b.y;
}

/** n points spread along the top edge, inset from the corners. */
export function topEdgePoints(s, n) {
  const b = bbox(s);
  return Array.from({ length: n }, (_, i) => {
    const x = b.x + (b.w * (i + 1)) / (n + 1);
    return { x, y: topAt(s, x) };
  });
}

function boxOutline(s) {
  return [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
}

/** n points evenly spaced around the outline (chasing lights, garlands). */
export function outlinePoints(s, n) {
  if (s.kind === 'ellipse') {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: s.x + s.w / 2 + Math.cos(a) * (s.w / 2), y: s.y + s.h / 2 + Math.sin(a) * (s.h / 2) };
    });
  }
  const pts = s.kind === 'rect' ? boxOutline(s) : s.points;
  const edges = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  const lengths = edges.map(([p, q]) => Math.hypot(q.x - p.x, q.y - p.y));
  const total = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, i) => {
    let d = (i / n) * total;
    let e = 0;
    while (d > lengths[e] && e < edges.length - 1) {
      d -= lengths[e];
      e += 1;
    }
    const [p, q] = edges[e];
    const t = lengths[e] ? d / lengths[e] : 0;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  });
}

/** Draggable handles: two opposite corners for rect/ellipse, every point for a polygon. */
export function shapeHandles(s) {
  if (s.kind === 'polygon') return s.points.map(({ x, y }) => ({ x, y }));
  return [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y + s.h }];
}

export function moveHandle(s, index, p) {
  if (s.kind === 'polygon') return { ...s, points: s.points.map((q, i) => (i === index ? { x: p.x, y: p.y } : q)) };
  const [a, b] = shapeHandles(s);
  const moved = index === 0 ? makeBox(s.kind, s.id, s.tag, p, b) : makeBox(s.kind, s.id, s.tag, a, p);
  return moved ?? s;
}

export function translate(s, dx, dy) {
  if (s.kind === 'polygon') return { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  return { ...s, x: s.x + dx, y: s.y + dy };
}

/** Validates shapes loaded from storage. */
export function sanitizeShapes(value) {
  if (!Array.isArray(value)) return [];
  const finite = (...n) => n.every(Number.isFinite);
  return value.flatMap((s) => {
    if (!s || typeof s.id !== 'string') return [];
    const tag = TAGS.includes(s.tag) ? s.tag : 'other';
    if ((s.kind === 'rect' || s.kind === 'ellipse') && finite(s.x, s.y, s.w, s.h) && s.w > 0 && s.h > 0) {
      return [{ id: s.id, kind: s.kind, tag, x: s.x, y: s.y, w: s.w, h: s.h }];
    }
    if (s.kind === 'polygon' && Array.isArray(s.points) && s.points.length >= 3 && s.points.every((p) => p && finite(p.x, p.y))) {
      return [{ id: s.id, kind: 'polygon', tag, points: s.points.map(({ x, y }) => ({ x, y })) }];
    }
    return [];
  });
}

/** Adds the shape's outline to the current canvas path (call beginPath first). */
export function tracePath(ctx, s) {
  if (s.kind === 'rect') ctx.rect(s.x, s.y, s.w, s.h);
  else if (s.kind === 'ellipse') ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
  else s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
