// Roshandaan's story (pure): the light box behaves like a light, flickers and dies, cracks, falls out,
// and something climbs up out of the dark shaft behind it. Each function maps time to what to show.

export const PHASES = Object.freeze([
  ['light', 3], // the box glows like the ordinary light it is
  ['flicker', 3], // it flickers
  ['dark', 1.5], // it dies; a thud from above
  ['crack', 3], // cracks spread across the panel
  ['shatter', 2.5], // the panel falls out in pieces, towards you
  ['shaft', 3], // a deep, dark shaft; a light flickers far up inside
  ['rise', 4], // a hand rises out of the dark
  ['grip', 5], // its fingers curl over the frame, just below the ceiling
  ['lunge', 1.2], // it lunges at you
  ['black', 2], // blackout
].map((p) => Object.freeze(p)));

export const TOTAL_S = PHASES.reduce((sum, [, s]) => sum + s, 0);

export function phaseStart(name) {
  let t = 0;
  for (const [n, s] of PHASES) {
    if (n === name) return t;
    t += s;
  }
  return TOTAL_S;
}

/** @returns {{ name: string, k: number }} k: 0..1 through the phase ('done' after the end) */
export function phaseAt(t) {
  let start = 0;
  for (const [name, s] of PHASES) {
    if (t < start + s) return { name, k: Math.max(0, (t - start) / s) };
    start += s;
  }
  return { name: 'done', k: 1 };
}

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const after = (t, name) => t >= phaseStart(name);

/** Deterministic flicker: on/off bursts that get worse towards the end. */
function flickerAt(local, length) {
  const k = local / length;
  const wave = Math.sin(local * 31) * Math.sin(local * 7.3 + 1) + Math.sin(local * 53);
  return wave > -0.4 + k * 1.2 ? 1 : 0.05;
}

/** @returns {{ glow: number, crack: number, broken: boolean, shardT: number }} */
export function panelAt(t) {
  const { name } = phaseAt(t);
  let glow = 0;
  if (name === 'light') glow = 1;
  else if (name === 'flicker') glow = flickerAt(t - phaseStart('flicker'), PHASES[1][1]);
  const crack = after(t, 'crack') ? clamp01((t - phaseStart('crack')) / PHASES[3][1]) : 0;
  const broken = after(t, 'shatter');
  return { glow, crack, broken, shardT: broken ? t - phaseStart('shatter') : 0 };
}

/**
 * The hand. z is its height in metres (0 = the ceiling, negative = up inside the shaft, positive =
 * down in the room towards the camera); bend 0..1 turns the wrist so the fingers go out over the frame edge, and curl 0..1 bends them back up
 * against the ceiling.
 * @returns {{ visible: boolean, z: number, curl: number, spread: number, lunge: number, bend: number }}
 */
export function handAt(t) {
  if (!after(t, 'rise') || after(t, 'black')) return { visible: false, z: -3, curl: 0, spread: 0, lunge: 0, bend: 0 };
  if (!after(t, 'grip')) {
    const k = smooth(clamp01((t - phaseStart('rise')) / PHASES[6][1]));
    return { visible: true, z: -2.4 + k * 2.6, curl: 0, spread: k, lunge: 0, bend: 0 };
  }
  if (!after(t, 'lunge')) {
    const k = smooth(clamp01((t - phaseStart('grip')) / 1.2));
    const tremble = Math.sin(t * 23) * 0.004;
    return { visible: true, z: 0.2 - k * 0.12 + tremble, curl: 0.2 + k * 0.7, spread: 1, lunge: 0, bend: k }; // up against the frame
  }
  const k = clamp01((t - phaseStart('lunge')) / PHASES[8][1]);
  return { visible: true, z: 0.08 + k * k * 2.7, curl: 0.9 - k * 0.8, spread: 1, lunge: k, bend: 1 - smooth(Math.min(1, k * 3)) };
}
