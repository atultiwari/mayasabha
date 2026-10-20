// Peek-a-boo: a character leans over one edge of the far opening, looks down at the child for a few
// seconds, then pulls back. Pure state: startPeek → stepPeek (returns null when finished).

export const PEEK = Object.freeze({ inS: 0.9, holdS: 3.6, outS: 0.8 });
export const EDGES = Object.freeze(['top', 'right', 'bottom', 'left']);
// Faces read best upright, so most peeks come over the bottom edge (upright on screen), some from the
// sides, none upside-down. Press O in the activity to turn the picture to match how the child lies.
const EDGE_WEIGHTS = Object.freeze([['bottom', 0.5], ['left', 0.25], ['right', 0.25]]);

/** Picks a peek edge from a 0..1 random number. */
export function pickEdge(r) {
  let acc = 0;
  for (const [edge, w] of EDGE_WEIGHTS) {
    acc += w;
    if (r < acc) return edge;
  }
  return 'bottom';
}

/** @param {string} role character role @param {string} edge @param {number} along 0..1 position on that edge */
export function startPeek(role, edge, along) {
  return { role, edge, along: Math.min(0.8, Math.max(0.2, along)), phase: 'in', t: 0, total: 0 };
}

const NEXT = { in: ['hold', PEEK.inS], hold: ['out', PEEK.holdS], out: [null, PEEK.outS] };

export function stepPeek(peek, dt) {
  const t = peek.t + dt;
  const [next, duration] = NEXT[peek.phase];
  if (t < duration) return { ...peek, t, total: peek.total + dt };
  return next ? { ...peek, phase: next, t: t - duration, total: peek.total + dt } : null;
}

const easeOutBack = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

/** How far the character is leaning in: 0 hidden … 1 fully in (eases in quickly, settles softly). */
export function peekReveal(peek) {
  if (peek.phase === 'hold') return 1;
  if (peek.phase === 'in') return Math.min(1, Math.max(0, easeOutBack(peek.t / PEEK.inS)));
  return 1 - (peek.t / PEEK.outS) ** 2;
}
