// Follows hands from frame to frame so effects can tell a still, open hand (butterflies land on it)
// from a fast swipe (they scatter). Pure: trackHands(prev, detections, dt) returns new tracks.

export const HANDS = Object.freeze({ stillAfter: 0.6, stillSpeed: 80, forgetAfter: 0.4, matchRadius: 250, smoothing: 0.5 });

let counter = 0;

/** @typedef {{ id: string, x: number, y: number, vx: number, vy: number, speed: number, stillFor: number, missingFor: number }} HandTrack */

function follow(track, det, dt) {
  const x = track.x + (det.x - track.x) * HANDS.smoothing;
  const y = track.y + (det.y - track.y) * HANDS.smoothing;
  const vx = (x - track.x) / dt;
  const vy = (y - track.y) / dt;
  const speed = Math.hypot(vx, vy);
  return { ...track, x, y, vx, vy, speed, stillFor: speed < HANDS.stillSpeed ? track.stillFor + dt : 0, missingFor: 0 };
}

function newTrack(det) {
  counter += 1;
  return { id: `hand-${counter}`, x: det.x, y: det.y, vx: 0, vy: 0, speed: 0, stillFor: 0, missingFor: 0 };
}

/**
 * @param {HandTrack[]} prev @param {{x:number,y:number}[]} detections stage px @param {number} dt seconds
 * @returns {HandTrack[]}
 */
export function trackHands(prev, detections, dt) {
  const step = Math.max(dt, 1e-3);
  const unused = [...detections];
  const updated = prev.map((track) => {
    let best = -1;
    let bestD = HANDS.matchRadius;
    unused.forEach((d, i) => {
      const dist = Math.hypot(d.x - track.x, d.y - track.y);
      if (dist < bestD) {
        best = i;
        bestD = dist;
      }
    });
    if (best === -1) return { ...track, missingFor: track.missingFor + step, speed: 0 };
    const [det] = unused.splice(best, 1);
    return follow(track, det, step);
  });
  return [...updated.filter((t) => t.missingFor <= HANDS.forgetAfter), ...unused.map(newTrack)];
}
