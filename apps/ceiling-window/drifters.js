// Things drifting past the far opening: clouds, birds and balloons; fish and bubbles; stars.
// Positions are normalised to the far opening (0..1). Balloons and bubbles shrink as they rise away,
// which sells the depth. Pure: populate() and stepDrifters() return new arrays.

/** Scene recipes: background colours, wall tint, and what drifts. */
export const SCENES = Object.freeze({
  sky: {
    sky: ['#4aa8ff', '#bfe6ff'], wall: '#7f8ea3',
    items: [
      { kind: 'sun', count: 1 }, { kind: 'cloud', count: 6 }, { kind: 'bird', count: 3 }, { kind: 'balloon', count: 3 },
    ],
  },
  water: {
    sky: ['#0a4f8a', '#1fb0c9'], wall: '#2b7088', rays: true,
    items: [
      { kind: 'fish', count: 3 }, { kind: 'tropical-fish', count: 3 }, { kind: 'blowfish', count: 1 },
      { kind: 'octopus', count: 1 }, { kind: 'turtle', count: 1 }, { kind: 'whale', count: 1 }, { kind: 'bubble', count: 16 },
    ],
  },
  night: {
    sky: ['#04051a', '#16224f'], wall: '#1b2242',
    items: [{ kind: 'moon', count: 1 }, { kind: 'twinkle', count: 45 }, { kind: 'star', count: 3 }, { kind: 'shooting', count: 1 }],
  },
});

/** Per-kind motion: size (fraction of far-opening height), speed range, and behaviour flags. */
const KINDS = {
  sun: { size: 0.28, speed: 0, fixed: { x: 0.82, y: 0.2 } },
  moon: { size: 0.3, speed: 0, fixed: { x: 0.78, y: 0.24 } },
  cloud: { size: [0.22, 0.38], speed: [0.012, 0.03] },
  bird: { size: [0.1, 0.14], speed: [0.06, 0.1], flap: true },
  balloon: { size: [0.16, 0.2], speed: [0.005, 0.02], rise: true },
  fish: { size: [0.14, 0.2], speed: [0.05, 0.1], wobble: true },
  'tropical-fish': { size: [0.14, 0.2], speed: [0.05, 0.1], wobble: true },
  blowfish: { size: [0.16, 0.2], speed: [0.03, 0.05], wobble: true },
  octopus: { size: [0.2, 0.24], speed: [0.02, 0.035], wobble: true },
  turtle: { size: [0.2, 0.24], speed: [0.02, 0.035], wobble: true },
  whale: { size: [0.45, 0.5], speed: [0.015, 0.025], wobble: true },
  bubble: { size: [0.015, 0.04], speed: [0, 0.01], rise: true, drawn: true },
  twinkle: { size: [0.004, 0.01], speed: 0, drawn: true, still: true },
  star: { size: [0.07, 0.1], speed: 0, still: true },
  shooting: { size: [0.25, 0.35], speed: [0.5, 0.7], drawn: true, life: 5 },
};

const pick = (range, rng) => (Array.isArray(range) ? range[0] + rng() * (range[1] - range[0]) : range);
let counter = 0;

/** One new drifter. `fresh` items enter from the side; initial ones are spread across the view. */
export function spawn(kind, rng, fresh = true) {
  const spec = KINDS[kind];
  counter += 1;
  const dir = rng() < 0.5 ? 1 : -1;
  const base = { id: `d${counter}`, kind, size: pick(spec.size, rng), age: 0, phase: rng() * Math.PI * 2, scale: 1, dir };
  if (spec.fixed) return { ...base, ...spec.fixed, vx: 0, vy: 0 };
  if (spec.still) return { ...base, x: rng(), y: rng(), vx: 0, vy: 0 };
  if (kind === 'shooting') return { ...base, x: rng(), y: rng() * 0.5, vx: dir * pick(spec.speed, rng), vy: pick(spec.speed, rng) * 0.4, age: -rng() * spec.life };
  // Seen from below, rising things recede into the distance: they appear anywhere and drift gently.
  if (spec.rise) return { ...base, x: rng(), y: rng(), vx: dir * pick(spec.speed, rng), vy: -0.01 - rng() * 0.02 };
  const x = fresh ? (dir === 1 ? -0.3 : 1.3) : rng() * 1.2 - 0.1;
  return { ...base, x, y: 0.1 + rng() * 0.8, vx: dir * pick(spec.speed, rng), vy: 0 };
}

export function populate(scene, rng = Math.random) {
  return SCENES[scene].items.flatMap(({ kind, count }) => Array.from({ length: count }, () => spawn(kind, rng, false)));
}

function stepOne(d, dt) {
  const spec = KINDS[d.kind];
  const age = d.age + dt;
  // Rising things recede: they shrink, so they look like they float up and away.
  const scale = spec.rise ? Math.max(0, d.scale - dt * (d.kind === 'bubble' ? 0.25 : 0.04)) : d.scale;
  if (age < 0) return { ...d, age }; // waiting for its turn (shooting stars), not visible yet
  return { ...d, age, scale, x: d.x + d.vx * dt, y: d.y + d.vy * dt };
}

function finished(d) {
  const spec = KINDS[d.kind];
  const gone = d.x > 1.35 || d.x < -0.35;
  if (spec.life) return d.age > spec.life || (d.age > 0 && gone);
  if (spec.rise) return d.scale <= 0.05;
  return (d.vx > 0 && d.x > 1.35) || (d.vx < 0 && d.x < -0.35);
}

/** Moves everything; anything that has left (or shrunk away) is replaced by a fresh one. */
export function stepDrifters(items, scene, dt, rng = Math.random) {
  return items.map((d) => {
    const next = stepOne(d, dt);
    return finished(next) ? spawn(d.kind, rng, true) : next;
  });
}

export const kindSpec = (kind) => KINDS[kind];
