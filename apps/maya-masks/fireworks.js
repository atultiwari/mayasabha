// Firework bursts: sparks fly out, fall with gravity and fade. Spark positions are computed from
// age, so state stays tiny. Pure.

export const FIREWORK = Object.freeze({ life: 2.2, gravity: 220, speed: [160, 420] });

/** @returns {{ x: number, y: number, hue: number, age: number, sparks: { vx: number, vy: number }[] }} */
export function spawnBurst(center, n, rng = Math.random, hue = rng() * 360) {
  const sparks = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rng() * 0.3;
    const v = FIREWORK.speed[0] + rng() * (FIREWORK.speed[1] - FIREWORK.speed[0]);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  });
  return { x: center.x, y: center.y, hue, age: 0, sparks };
}

export function stepBursts(bursts, dt) {
  return bursts.map((b) => ({ ...b, age: b.age + dt })).filter((b) => b.age < FIREWORK.life);
}

/** Where a spark is now (sparks slow down a little as they spread). */
export function sparkAt(burst, spark) {
  const t = burst.age;
  const drag = 1 - Math.min(0.6, t * 0.3);
  return { x: burst.x + spark.vx * t * drag, y: burst.y + spark.vy * t * drag + 0.5 * FIREWORK.gravity * t * t };
}
