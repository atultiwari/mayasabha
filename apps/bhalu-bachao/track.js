// Where the railway runs (pure): along the longest traced ledge of the Room Map (the sofa back), so the
// train rides on the real furniture; low on the wall when there's no Room Map.
import { ledgesFromRoom } from '../../kit/room/room-map.js';

const DEFAULT_Y = 0.74; // of the stage height

/** @returns {{ y: number, x0: number, x1: number }} */
export function trackLine(shapes, stage) {
  const ledges = ledgesFromRoom(shapes ?? []);
  if (!ledges.length) return { y: stage.h * DEFAULT_Y, x0: 0, x1: stage.w };
  const longest = ledges.reduce((a, b) => (Math.abs(b.b.x - b.a.x) > Math.abs(a.b.x - a.a.x) ? b : a));
  return {
    y: (longest.a.y + longest.b.y) / 2,
    x0: Math.min(longest.a.x, longest.b.x),
    x1: Math.max(longest.a.x, longest.b.x),
  };
}
