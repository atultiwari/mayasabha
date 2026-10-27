// Janamdin's running order (pure). The wish waits for as long as it takes: the show moves on only
// when the candles are blown out (or a grown-up presses a key). The balloons then go on until stopped.

export const PHASES = Object.freeze([
  ['dim', 2], // the room goes quiet
  ['frame', 3], // a ring of diyas and a golden glow appear round the picture
  ['bunting', 4], // "Happy Birthday" flags drop in across the top
  ['name', 4], // DADU bounces in, letter by letter
  ['cake', 3], // the cake appears on the sofa back
  ['wish', 16], // candles burn; blowing (or B) starts the fireworks
  ['celebrate', 7], // fireworks and confetti
  ['balloons', Infinity], // balloons rise, friends cheer, until someone stops the show
].map((p) => Object.freeze(p)));

export function phaseStart(name) {
  let t = 0;
  for (const [n, s] of PHASES) {
    if (n === name) return t;
    t += s;
  }
  return t;
}

/** @returns {{ name: string, k: number, local: number }} */
export function phaseAt(t) {
  let start = 0;
  for (const [name, s] of PHASES) {
    if (t < start + s) return { name, k: Number.isFinite(s) ? (t - start) / s : 0, local: t - start };
    start += s;
  }
  return { name: 'balloons', k: 0, local: t - start };
}

const WISH_END = phaseStart('wish') + PHASES[5][1];

/** Advances the show. s: { t, blown }. */
export function nextShow(s, dt) {
  const t = s.t + dt;
  const inWish = phaseAt(s.t).name === 'wish';
  if (inWish && s.blown) return { ...s, t: phaseStart('celebrate') };
  if (inWish && t >= WISH_END) return { ...s, t: WISH_END - 0.001 }; // keep waiting for the wish
  return { ...s, t };
}
