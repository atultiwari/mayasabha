// Blowing out the candles (pure). A breath is a steady sound well above the room's own noise, held for
// half a second; a clap is too short to count. While someone blows, the flames flicker.

export const BLOW = Object.freeze({ ratio: 3, minLevel: 0.05, holdS: 0.5, follow: 0.02 });

export function initialBlow() {
  return { baseline: 0.01, held: 0, flicker: 0, out: false };
}

/** @param {number} level microphone loudness (RMS 0..1) */
export function feedBlow(s, level, dt) {
  const loud = level > Math.max(BLOW.minLevel, s.baseline * BLOW.ratio);
  const held = loud ? s.held + dt : Math.max(0, s.held - dt * 2);
  return {
    baseline: loud ? s.baseline : s.baseline + (level - s.baseline) * BLOW.follow,
    held,
    flicker: loud ? Math.min(1, held / BLOW.holdS) : s.flicker * 0.9,
    out: s.out || held >= BLOW.holdS,
  };
}
