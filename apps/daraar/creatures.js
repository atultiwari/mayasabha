// Creature motion for Daraar (pure): what the eye and the hand are doing at each moment of their phase.

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const BLINKS = Object.freeze([0.34, 0.62]);
const BLINK_HALF = 0.03;
const STARE_FROM = 0.75;

/**
 * @param {number} k 0..1 through the eye phase
 * @returns {{ open: number, look: { x: number, y: number }, pupil: number }} look: -1..1 (0 = at you)
 */
export function eyeAt(k) {
  let open = smooth(clamp01(k / 0.12));
  for (const b of BLINKS) {
    const d = Math.abs(k - b);
    if (d < BLINK_HALF) open = Math.min(open, d / BLINK_HALF);
  }
  const roam = { x: Math.sin(k * 23) * 0.7, y: Math.cos(k * 17) * 0.5 };
  const toStare = smooth(clamp01((k - STARE_FROM + 0.1) / 0.1));
  const look = { x: roam.x * (1 - toStare), y: roam.y * (1 - toStare) };
  const pupil = 1 - 0.55 * smooth(clamp01((k - STARE_FROM) / 0.15));
  return { open: k >= STARE_FROM ? Math.max(open, 1) : open, look, pupil };
}

/**
 * @param {number} k 0..1 through the hand phase
 * @returns {{ scale: number, reach: number, spread: number, curl: number }}
 */
export function handAt(k) {
  const reach = smooth(clamp01(k / 0.8));
  return {
    reach,
    scale: 0.35 + reach * 2.3, // starts small at the far end, ends bigger than the hole
    spread: smooth(clamp01(k / 0.5)),
    curl: smooth(clamp01((k - 0.82) / 0.14)),
  };
}
