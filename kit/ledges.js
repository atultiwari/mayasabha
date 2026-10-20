// Ledges: line segments (in stage coordinates) marking real surfaces on the wall that characters can
// stand on: the top of a picture frame, the door frame, the sofa back, the floor line. You draw them
// once in edit mode over the real objects. Characters hop between ledges that are close enough.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ id: string, a: Point, b: Point }} Ledge   a.x <= b.x */
/** @typedef {{ maxGap: number, maxRise: number, inset: number }} HopRules */

export const GROUND_ID = 'ground';
export const DEFAULT_HOP = Object.freeze({ maxGap: 420, maxRise: 380, inset: 50 });
const MIN_LENGTH = 40;
const MAX_SLOPE = 0.6;

/** Builds a normalised ledge, or null if it is too short or too steep to stand on. @returns {Ledge|null} */
export function makeLedge(id, p1, p2) {
  const [a, b] = p1.x <= p2.x ? [p1, p2] : [p2, p1];
  const dx = b.x - a.x;
  if (Math.hypot(dx, b.y - a.y) < MIN_LENGTH) return null;
  if (dx === 0 || Math.abs((b.y - a.y) / dx) > MAX_SLOPE) return null;
  return { id, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
}

/** The always-present floor line across the full stage width. */
export function makeGround(stageWidth, y) {
  return { id: GROUND_ID, a: { x: 0, y }, b: { x: stageWidth, y } };
}

/** Validates ledges loaded from storage. @returns {Ledge[]} */
export function sanitizeLedges(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l) => l && typeof l.id === 'string' && l.id !== GROUND_ID)
    .map((l) => makeLedge(l.id, l.a ?? {}, l.b ?? {}))
    .filter((l) => l && [l.a.x, l.a.y, l.b.x, l.b.y].every(Number.isFinite));
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Height of the ledge at x (clamped to its span). */
export function yAt(ledge, x) {
  const t = (clamp(x, ledge.a.x, ledge.b.x) - ledge.a.x) / (ledge.b.x - ledge.a.x);
  return ledge.a.y + t * (ledge.b.y - ledge.a.y);
}

export function clampToLedge(ledge, x, inset = 0) {
  const lo = ledge.a.x + inset;
  const hi = ledge.b.x - inset;
  return lo <= hi ? clamp(x, lo, hi) : (ledge.a.x + ledge.b.x) / 2;
}

/** Shortest distance from a point to the ledge segment. */
export function distanceTo(ledge, p) {
  const vx = ledge.b.x - ledge.a.x;
  const vy = ledge.b.y - ledge.a.y;
  const t = clamp(((p.x - ledge.a.x) * vx + (p.y - ledge.a.y) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(ledge.a.x + t * vx - p.x, ledge.a.y + t * vy - p.y);
}

/** Removes the user ledge nearest to `p` (within maxDist). The ground is never removed. */
export function removeNearest(ledges, p, maxDist) {
  let target = null;
  let best = maxDist;
  for (const l of ledges) {
    const d = distanceTo(l, p);
    if (l.id !== GROUND_ID && d <= best) {
      target = l.id;
      best = d;
    }
  }
  return target ? ledges.filter((l) => l.id !== target) : ledges;
}

/** First ledge at or below point p whose span contains p.x (what you'd land on if dropped). */
export function ledgeBelow(ledges, p) {
  let found = null;
  for (const l of ledges) {
    if (p.x < l.a.x || p.x > l.b.x) continue;
    const y = yAt(l, p.x);
    if (y >= p.y - 1 && (!found || y < yAt(found, p.x))) found = l;
  }
  return found;
}

/**
 * Can a character on `from` at x reach `to` in one hop? Up-hops are limited by maxRise, any hop by maxGap.
 * @returns {{ takeoff: Point, landing: Point } | null}
 */
export function planHop(from, to, x, rules = DEFAULT_HOP) {
  const targetX = clampToLedge(to, x, rules.inset);
  const takeoffX = clampToLedge(from, targetX, Math.min(rules.inset, (from.b.x - from.a.x) / 2));
  const landingX = clampToLedge(to, takeoffX, rules.inset);
  const takeoff = { x: takeoffX, y: yAt(from, takeoffX) };
  const landing = { x: landingX, y: yAt(to, landingX) };
  const gap = Math.abs(landing.x - takeoff.x);
  const rise = takeoff.y - landing.y;
  if (gap > rules.maxGap || rise > rules.maxRise) return null;
  return { takeoff, landing };
}

/** Breadth-first route of ledge ids from `fromId` to `toId` (inclusive), or null if unreachable. */
export function findRoute(ledges, fromId, toId, x, rules = DEFAULT_HOP) {
  if (fromId === toId) return [fromId];
  const byId = new Map(ledges.map((l) => [l.id, l]));
  if (!byId.has(fromId) || !byId.has(toId)) return null;
  const queue = [{ id: fromId, x, path: [fromId] }];
  const seen = new Set([fromId]);
  while (queue.length) {
    const { id, x: atX, path } = queue.shift();
    for (const next of ledges) {
      if (seen.has(next.id)) continue;
      const hop = planHop(byId.get(id), next, atX, rules);
      if (!hop) continue;
      if (next.id === toId) return [...path, next.id];
      seen.add(next.id);
      queue.push({ id: next.id, x: hop.landing.x, path: [...path, next.id] });
    }
  }
  return null;
}
