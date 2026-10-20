// Orbit and scale maths for the solar system (pure, unit-tested). Scene units are arbitrary;
// Earth's storybook radius is 0.6.
//
// Real distances would make the planets invisible dots, so the default "storybook" scale keeps the
// true ORDER and orbit SPEEDS but compresses distances and squeezes sizes (radius^0.45).
// "true" sizes keep exact radius ratios for the size-comparison view.

/** @typedef {{ x: number, y: number, z: number }} Vec3 */

const EARTH_R = 0.6;
const EARTH_KM = 6371;
const SUN_STORYBOOK_R = 4;
const MIN_R = 0.08;
const SIZE_SQUEEZE = 0.45;

// Storybook orbit radius for each real distance (AU). Hand-tuned so nothing overlaps, even with moons.
const ORBIT_TABLE = [[0.39, 10], [0.72, 14], [1, 19], [1.52, 24], [5.2, 36], [9.58, 50], [19.2, 58], [30.1, 66]];

export const SPEEDS = Object.freeze([
  { id: 'slow', daysPerSecond: 1, label: '1 day / second' },
  { id: 'normal', daysPerSecond: 10, label: '10 days / second' },
  { id: 'fast', daysPerSecond: 60, label: '2 months / second' },
  { id: 'year', daysPerSecond: 365, label: '1 year / second' },
]);

/** Display radius for a body of `radiusKm` in the given scale mode ('storybook' | 'true'). */
export function bodyRadius(radiusKm, mode) {
  if (mode === 'true') return EARTH_R * (radiusKm / EARTH_KM);
  if (radiusKm > 100000) return SUN_STORYBOOK_R; // the Sun, shown far smaller than real so it fits
  return Math.max(MIN_R, EARTH_R * (radiusKm / EARTH_KM) ** SIZE_SQUEEZE);
}

/** Storybook orbit radius for a mean distance in AU (interpolated between the planets). */
export function orbitRadius(au) {
  if (au <= ORBIT_TABLE[0][0]) return ORBIT_TABLE[0][1] * (au / ORBIT_TABLE[0][0]);
  for (let i = 1; i < ORBIT_TABLE.length; i += 1) {
    const [a0, r0] = ORBIT_TABLE[i - 1];
    const [a1, r1] = ORBIT_TABLE[i];
    if (au <= a1) return r0 + ((au - a0) / (a1 - a0)) * (r1 - r0);
  }
  const [aLast, rLast] = ORBIT_TABLE[ORBIT_TABLE.length - 1];
  return rLast + (au - aLast) * 0.5;
}

/** Distance of the i-th moon from its planet (storybook). */
export function moonOrbitRadius(planetR, index) {
  return planetR * 1.6 + 0.35 + index * planetR * 0.6;
}

/** Orbit angle (radians) after `tDays`, starting at `phase`. */
export function orbitAngle(tDays, periodDays, phase) {
  return phase + (Math.PI * 2 * tDays) / periodDays;
}

/** Spin angle (radians) after `tDays`; negative day length spins backwards. */
export function spinAngle(tDays, dayHours) {
  return (Math.PI * 2 * tDays * 24) / dayHours;
}

/** Planet centre on its (flat, circular) storybook orbit. Counter-clockwise seen from above. @returns {Vec3} */
export function planetPosition(planet, tDays, phase) {
  const a = orbitAngle(tDays, planet.periodDays, phase);
  const r = orbitRadius(planet.au);
  return { x: r * Math.cos(a), y: 0, z: -r * Math.sin(a) };
}

/** True-size comparison: planets in a row (Jupiter's radius = 6 units), left to right. */
export function sizeRowLayout(planets, { jupiterR = 6, gap = 1.2 } = {}) {
  const scale = jupiterR / 69911;
  let cursor = 0;
  return planets.map((p) => {
    const r = p.radiusKm * scale;
    const x = cursor + r;
    cursor = x + r + gap;
    return { id: p.id, r, x };
  });
}

const lerp3 = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** Smoothly moves the camera (position + look-at point) towards a target that may itself be moving. */
export function followCamera(cam, target, dt, rate = 2.5) {
  const k = 1 - Math.exp(-rate * dt);
  return { pos: lerp3(cam.pos, target.pos, k), look: lerp3(cam.look, target.look, k) };
}
