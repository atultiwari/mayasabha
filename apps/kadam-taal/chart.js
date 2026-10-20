// Kadam Taal rules (pure, immutable). Two modes:
//  - kid (2–3 years): a few big pads; a note floats down and WAITS at its pad until stepped on.
//    Nothing is ever missed, and a step on an empty pad still sparkles.
//  - grown-up: notes on a generated beat; Perfect / Good / Miss by timing, streak bonuses, and the
//    beat speeds up as you keep hitting.

export const KID = Object.freeze({ lanes: 3, fallS: 3.5, spawnEveryS: 2.2, catchFrom: 0.6 });

export const GROWN = Object.freeze({
  lanes: 4, bpm: 96, maxBpm: 150, bpmStep: 6, speedUpEvery: 16,
  travelS: 2.2, // a note takes this long from the top of the board to the pads
  leadInS: 3, // quiet count-in before the first note
});

export const JUDGE = Object.freeze({ perfectS: 0.07, goodS: 0.15, perfectPoints: 300, goodPoints: 100, streakEvery: 10, streakBonus: 60 });

// ---- kid ----------------------------------------------------------------------------------------------

export function newKid() {
  return { notes: [], next: 0.5, hits: 0, count: 0 };
}

/** @returns {{ state: object, events: { type: 'arrive', lane: number }[] }} */
export function stepKid(state, dt, rng = Math.random) {
  const events = [];
  const notes = state.notes.map((n) => {
    const progress = Math.min(1, n.progress + dt / KID.fallS);
    if (n.progress < 1 && progress === 1) events.push({ type: 'arrive', lane: n.lane });
    return { ...n, progress };
  });
  let { next, count } = state;
  next -= dt;
  const free = Array.from({ length: KID.lanes }, (_, i) => i).filter((lane) => !notes.some((n) => n.lane === lane));
  if (next <= 0 && free.length) {
    count += 1;
    notes.push({ id: `k${count}`, lane: free[Math.floor(rng() * free.length) % free.length], progress: 0 });
    next = KID.spawnEveryS;
  }
  return { state: { ...state, notes, next: Math.max(next, 0), count }, events };
}

/** Pads a child is already standing on that now have a fruit to catch (no need to step off and on). */
export function heldCatches(state, onLanes) {
  return [...onLanes].filter((lane) => state.notes.some((n) => n.lane === lane && n.progress >= KID.catchFrom)).sort((a, b) => a - b);
}

/** @returns {{ state: object, result: 'hit' | 'sparkle', note?: object }} */
export function pressKid(state, lane) {
  const note = state.notes.find((n) => n.lane === lane && n.progress >= KID.catchFrom);
  if (!note) return { state, result: 'sparkle' };
  return { state: { ...state, notes: state.notes.filter((n) => n !== note), hits: state.hits + 1 }, result: 'hit', note };
}

// ---- grown-up --------------------------------------------------------------------------------------------

const SLOT_MEMORY = 400; // recent slot times kept (for checking the beat stays on the note grid)

export const bpmFor = (hits) => Math.min(GROWN.maxBpm, GROWN.bpm + Math.floor(hits / GROWN.speedUpEvery) * GROWN.bpmStep);

/** 0 when a note appears at the top of the board, 1 when it reaches the pads (beyond 1 once late). */
export const progressOf = (note, time) => 1 - (note.time - time) / GROWN.travelS;

export function newGrown() {
  return {
    time: 0, bpm: GROWN.bpm, notes: [], nextSlot: GROWN.leadInS, slot: 0, ticks: [], tick: 0, slotTimes: [],
    score: 0, streak: 0, best: 0, hits: 0, misses: 0, count: 0,
  };
}

/** Which notes go in one half-beat slot, harder as the level goes up. */
function slotNotes(state, slot, rng) {
  const level = Math.floor(state.hits / GROWN.speedUpEvery);
  const onBeat = slot % 2 === 0;
  const chance = onBeat ? Math.min(1, 0.55 + 0.15 * level) : (level >= 2 ? 0.25 : 0);
  if (rng() >= chance) return [];
  const lane = Math.floor(rng() * GROWN.lanes) % GROWN.lanes;
  const double = onBeat && level >= 3 && rng() < 0.15;
  return double ? [lane, (lane + 2) % GROWN.lanes] : [lane];
}

/** @returns {{ state: object, events: ({ type: 'miss', lane: number } | { type: 'beat', strong: boolean })[] }} */
export function stepGrown(state, dt, rng = Math.random) {
  const time = state.time + dt;
  const events = [];
  let { nextSlot, slot, tick, count } = state;
  // Beats are taken from the same slot clock as the notes, so a tempo change can't pull them apart.
  const ticks = [...state.ticks];
  const slotTimes = [...state.slotTimes];
  const notes = [];
  for (const n of state.notes) {
    if (time - n.time > JUDGE.goodS) events.push({ type: 'miss', lane: n.lane });
    else notes.push(n);
  }
  const half = 30 / state.bpm;
  while (nextSlot <= time + GROWN.travelS) {
    for (const lane of slotNotes(state, slot, rng)) {
      count += 1;
      notes.push({ id: `g${count}`, lane, time: nextSlot });
    }
    if (slot % 2 === 0) ticks.push(nextSlot);
    slotTimes.push(nextSlot);
    slot += 1;
    nextSlot += half;
  }
  while (ticks.length && ticks[0] <= time) {
    ticks.shift();
    events.push({ type: 'beat', strong: tick % 4 === 0 });
    tick += 1;
  }
  const misses = events.filter((e) => e.type === 'miss').length;
  return {
    state: { ...state, time, notes, nextSlot, slot, ticks, tick, slotTimes: slotTimes.slice(-SLOT_MEMORY), count, misses: state.misses + misses, streak: misses ? 0 : state.streak },
    events,
  };
}

/** @returns {{ state: object, result: 'perfect' | 'good' | 'stray', bonus: number, note?: object }} */
export function pressGrown(state, lane) {
  const near = state.notes
    .filter((n) => n.lane === lane && Math.abs(n.time - state.time) <= JUDGE.goodS)
    .sort((a, b) => Math.abs(a.time - state.time) - Math.abs(b.time - state.time));
  const note = near[0];
  if (!note) return { state, result: 'stray', bonus: 0 };
  const result = Math.abs(note.time - state.time) <= JUDGE.perfectS ? 'perfect' : 'good';
  const streak = state.streak + 1;
  const bonus = streak % JUDGE.streakEvery === 0 ? streak * JUDGE.streakBonus : 0;
  const hits = state.hits + 1;
  return {
    state: {
      ...state, notes: state.notes.filter((n) => n !== note), streak, best: Math.max(state.best, streak), hits, bpm: bpmFor(hits),
      score: state.score + (result === 'perfect' ? JUDGE.perfectPoints : JUDGE.goodPoints) + bonus,
    },
    result, bonus, note,
  };
}
