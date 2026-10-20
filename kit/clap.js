// Clap / shout detection from microphone loudness. The pure detector keeps a slow-moving baseline of
// room noise and fires when the level jumps well above it; a refractory gap stops one clap firing twice.

/** @typedef {{ baseline: number, lastFire: number }} ClapState */
/** @typedef {{ ratio: number, minLevel: number, refractoryS: number, follow: number }} ClapConfig */

export const DEFAULT_CLAP = Object.freeze({ ratio: 3.2, minLevel: 0.06, refractoryS: 0.45, follow: 0.02 });

export function initialClap() {
  return { baseline: 0.01, lastFire: -Infinity };
}

/**
 * @param {ClapState} state @param {number} level RMS 0..1 @param {number} t seconds
 * @returns {{ state: ClapState, fired: boolean }}
 */
export function feedClap(state, level, t, cfg = DEFAULT_CLAP) {
  const threshold = Math.max(cfg.minLevel, state.baseline * cfg.ratio);
  const fired = level > threshold && t - state.lastFire >= cfg.refractoryS;
  // Loud peaks barely move the baseline so a burst of claps doesn't raise the bar.
  const k = level > threshold ? cfg.follow * 0.1 : cfg.follow;
  const baseline = state.baseline + (level - state.baseline) * k;
  return { state: { baseline, lastFire: fired ? t : state.lastFire }, fired };
}

/** Root-mean-square of a time-domain buffer of floats in -1..1. */
export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}
