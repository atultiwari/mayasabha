// Planet Parade timing (pure): one heavenly body at a time comes out of the corner, floats in the
// room, and goes back in. The Moon (a favourite) comes every other turn.

export const PARADE = Object.freeze({
  order: Object.freeze(['moon', 'earth', 'moon', 'jupiter', 'moon', 'saturn', 'moon', 'sun']),
  slotS: 9, // seconds per turn
  comeS: 3, // coming out
  goS: 2.5, // going back in
});

const ease = (k) => k * k * (3 - 2 * k);

/** @returns {{ turn: number, name: string, out: number }} out: 0 deep in the corner … 1 floating in the room */
export function paradeAt(t) {
  const turn = Math.floor(Math.max(0, t) / PARADE.slotS);
  const local = Math.max(0, t) - turn * PARADE.slotS;
  const name = PARADE.order[turn % PARADE.order.length];
  const coming = Math.min(1, local / PARADE.comeS);
  const going = Math.min(1, Math.max(0, (PARADE.slotS - local) / PARADE.goS));
  return { turn, name, out: ease(Math.min(coming, going)) };
}
