// Bedtime: the night sky dims so gradually that nobody notices, then stays black (projector shows
// nothing). Brightness follows a smooth ease from 1 to 0 over the chosen duration.

export const BEDTIME_OPTIONS_S = Object.freeze([5 * 60, 10 * 60, 20 * 60]);

/** @param {number} elapsedS seconds since bedtime started @param {number} durationS @returns {number} 1..0 */
export function bedtimeBrightness(elapsedS, durationS) {
  const t = Math.min(1, Math.max(0, elapsedS / durationS));
  return 1 - t * t * (3 - 2 * t);
}
