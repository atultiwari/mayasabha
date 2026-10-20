// The Room Map: the objects on your wall, traced once (apps/room-map/) and shared by every wall
// activity. Stored in stage coordinates under the shared "room" corner fit, so all activities that
// use it must also use ROOM_KEY for their stage. Pure helpers turn shapes into what each activity
// needs: solid bodies (physics), ledges to walk on, shapes to light up.
import { bbox, outlinePoints, sanitizeShapes, topEdgePoints } from './shapes.js';

export const ROOM_KEY = 'room';
const SHAPES_KEY = 'room:shapes';
const LEGACY_KEY = 'maya-masks:shapes';

/** Things that block falling fruit or a running hero. Pictures are never touched; floor patches aren't walls. */
export const SOLID_TAGS = Object.freeze(['frame', 'door', 'shelf', 'clock', 'balloon', 'other']);
/** Things whose top edge can be walked on. */
export const LEDGE_TAGS = Object.freeze(['frame', 'door', 'shelf', 'other']);

/** Corner points of any shape as a polygon (ellipses become 24-sided). */
export function shapePolygon(s) {
  if (s.kind === 'polygon') return s.points.map(({ x, y }) => ({ x, y }));
  if (s.kind === 'ellipse') return outlinePoints(s, 24);
  return [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
}

/** @returns {{ id: string, points: {x:number,y:number}[] }[]} */
export function solidsFromRoom(shapes) {
  return shapes.filter((s) => SOLID_TAGS.includes(s.tag)).map((s) => ({ id: s.id, points: shapePolygon(s) }));
}

/** Top edges as walkable segments ({ id, a, b } like kit/ledges.js). */
export function ledgesFromRoom(shapes) {
  return shapes.filter((s) => LEDGE_TAGS.includes(s.tag)).map((s) => {
    const b = bbox(s);
    const [first, last] = [topEdgePoints(s, 9)[0], topEdgePoints(s, 9)[8]];
    const inset = Math.min(10, b.w * 0.05);
    return { id: `room-${s.id}`, a: { x: first.x - inset, y: first.y }, b: { x: last.x + inset, y: last.y } };
  });
}

/** Keeps an existing room map; otherwise adopts shapes traced earlier in Maya Masks. */
export function migrateShapes(room, legacy) {
  return room.length ? room : legacy;
}

// ---- storage (browser) --------------------------------------------------------------------------

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(`mayasabha:${key}`) ?? 'null');
  } catch (err) {
    console.warn(`room map: could not read ${key}`, err);
    return null;
  }
}

export function loadRoom() {
  return migrateShapes(sanitizeShapes(read(SHAPES_KEY)), sanitizeShapes(read(LEGACY_KEY)));
}

export function saveRoom(shapes) {
  try {
    window.localStorage.setItem(`mayasabha:${SHAPES_KEY}`, JSON.stringify(shapes));
  } catch (err) {
    console.warn('room map: could not save', err);
  }
}
