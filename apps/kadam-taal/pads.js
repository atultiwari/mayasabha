// The floor board (pure): lanes running from the far edge down to a row of big pads at the near edge,
// where the player stands. Feet (stage px) on pads become stomps when they arrive on a pad.

const BOARD = Object.freeze({ side: 0.12, top: 0.04, bottom: 0.04, padHeight: 0.24, padInset: 0.08, reach: 0.12 });

/** @returns {{ board: object, pads: { x: number, y: number, w: number, h: number, cx: number, cy: number }[], laneX: number[] }} */
export function boardLayout(stage, lanes) {
  const board = { x: stage.w * BOARD.side, y: stage.h * BOARD.top, w: stage.w * (1 - 2 * BOARD.side), h: stage.h * (1 - BOARD.top - BOARD.bottom) };
  const laneW = board.w / lanes;
  const padH = stage.h * BOARD.padHeight;
  const pads = Array.from({ length: lanes }, (_, i) => {
    const x = board.x + i * laneW + laneW * BOARD.padInset;
    const w = laneW * (1 - 2 * BOARD.padInset);
    const y = board.y + board.h - padH;
    return { x, y, w, h: padH, cx: x + w / 2, cy: y + padH / 2 };
  });
  return { board, pads, laneX: pads.map((p) => p.cx) };
}

/** Lane of the pad under point p (a little forgiving around the edges), or -1. */
export function padAt(layout, p) {
  return layout.pads.findIndex((pad) => {
    const mx = pad.w * BOARD.reach;
    const my = pad.h * BOARD.reach;
    return p.x >= pad.x - mx && p.x <= pad.x + pad.w + mx && p.y >= pad.y - my && p.y <= pad.y + pad.h + my;
  });
}

const RELEASE_S = 0.2; // a foot must be off a pad this long before stepping back on counts again

/**
 * Which pads have a foot on them, and which were just stepped on. A foot that stays on a pad doesn't
 * count again until it has left it, and a foot the camera loses for a moment hasn't left.
 * @param {Map<number, number>} prevOn lane -> seconds since a foot was last seen on it
 * @returns {{ on: Map<number, number>, held: Set<number>, stomps: number[] }}
 */
export function stompsFrom(prevOn, feet, layout, dt) {
  const held = new Set(feet.map((f) => padAt(layout, f)).filter((lane) => lane >= 0));
  const on = new Map([...held].map((lane) => [lane, 0]));
  for (const [lane, away] of prevOn) {
    if (!held.has(lane) && away + dt < RELEASE_S) on.set(lane, away + dt);
  }
  return { on, held, stomps: [...held].filter((lane) => !prevOn.has(lane)) };
}
