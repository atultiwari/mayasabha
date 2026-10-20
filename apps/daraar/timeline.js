// Daraar's sequence (pure): how long each phase lasts and which sound plays when.

export const PHASES = Object.freeze([
  ['calm', 2.5], // a plain ceiling
  ['cracks', 6], // glowing cracks spread from one point
  ['frame', 3], // a crack races round and closes into the hole's outline (the ceiling has no frame)
  ['break', 2.2], // the ceiling inside falls out in shards
  ['shaft', 6], // a deep shaft with electricity racing down its edges, a portal at the far end
  ['eye', 8], // a giant eye peers down, looks around, then stares at you
  ['hand', 6.5], // a long-fingered hand reaches down out of the hole, an orb glowing in its palm
  ['snap', 1.3], // white flash, and it's gone
].map((p) => Object.freeze(p)));

export const TOTAL_S = PHASES.reduce((sum, [, s]) => sum + s, 0);

/** Seconds from the start of the sequence to the start of a phase. */
export function phaseStart(name) {
  let t = 0;
  for (const [n, s] of PHASES) {
    if (n === name) return t;
    t += s;
  }
  return TOTAL_S;
}

/** @returns {{ name: string, k: number, local: number }} k: 0..1 through the phase; 'done' after the end. */
export function phaseAt(t) {
  let start = 0;
  for (const [name, s] of PHASES) {
    if (t < start + s) return { name, k: Math.max(0, (t - start) / s), local: Math.max(0, t - start) };
    start += s;
  }
  return { name: 'done', k: 1, local: t - TOTAL_S };
}

const every = (from, gap, count, sound) => Array.from({ length: count }, (_, i) => ({ at: from + i * gap, sound }));

export const CUES = Object.freeze([
  ...every(phaseStart('cracks'), 0.8, 8, 'crackle'),
  { at: phaseStart('frame'), sound: 'whoosh' },
  { at: phaseStart('frame') + 1, sound: 'crackle' },
  { at: phaseStart('break'), sound: 'shatter' },
  { at: phaseStart('break'), sound: 'rumble' },
  { at: phaseStart('shaft'), sound: 'drone' },
  { at: phaseStart('shaft') + 3, sound: 'whoosh' },
  ...every(phaseStart('eye') + 0.5, 1.2, 6, 'heartbeat'),
  { at: phaseStart('hand'), sound: 'sting' },
  { at: phaseStart('hand') + 2.5, sound: 'rumble' },
  { at: phaseStart('snap'), sound: 'whoosh' },
].sort((a, b) => a.at - b.at));

/** Cues whose time falls in (from, to]. */
export function cuesBetween(from, to) {
  return CUES.filter((c) => c.at > from && c.at <= to);
}
