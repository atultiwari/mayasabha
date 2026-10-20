// A rangoli that draws itself: rings of petals around a centre, appearing one by one like a
// hand-drawn kolam. Radii are fractions of the shape's half-size. Pure data.

export const RANGOLI = Object.freeze({
  rings: [
    { radius: 0.16, petals: 8, size: 0.12, color: '#ff4fa3' },
    { radius: 0.32, petals: 12, size: 0.13, color: '#ffd23e' },
    { radius: 0.5, petals: 16, size: 0.14, color: '#3ec8ff' },
    { radius: 0.68, petals: 20, size: 0.12, color: '#ff8a2e' },
    { radius: 0.86, petals: 28, size: 0.1, color: '#7be08a' },
  ],
});

const ALL = RANGOLI.rings.flatMap((ring, r) => Array.from({ length: ring.petals }, (_, i) => ({
  ring: r,
  index: i,
  angle: (i / ring.petals) * Math.PI * 2 + (r % 2 ? Math.PI / ring.petals : 0),
  radius: ring.radius,
  size: ring.size,
  color: ring.color,
})));

/** Petals visible at progress 0..1, each with its own grow-in amount (`reveal` 0..1). */
export function rangoliPetals(progress) {
  const shown = Math.max(0, Math.min(1, progress)) * ALL.length;
  return ALL.slice(0, Math.floor(shown)).map((p, i) => ({ ...p, reveal: Math.min(1, shown - i) }));
}
