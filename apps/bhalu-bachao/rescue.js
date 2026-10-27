// Bhalu Bachao story rules (pure, stage px). Bear walks onto the track and his leg gets stuck; a toy
// train comes out of a tunnel. The child saves him (touch, red signal, arms up or clap, any of them
// works). If nobody has helped yet, the train brakes smoothly and waits at a safe distance, whistling:
// it never reaches Bear. Freed, he hops off, the train goes by, everyone cheers, and a new round starts.

export const HINTS = Object.freeze(['touch', 'red', 'arms', 'clap']);

export const RESCUE = Object.freeze({
  walkS: 2.5, stuckS: 2.5, // Bear walks in, then gets stuck a while before the train shows up
  vMax: 260, brake: 120, // px/s and px/s²: brakes early and gently
  safeGap: 220, bearHalfWidth: 150, // the train stops this far from Bear's side (his waving arms included)
  whistleEvery: 3, helpEvery: 4,
  hopS: 1, freedHoldS: 1.6, // Bear hops off; the train waits until he's clear
  passAccel: 300, trainLength: 900, cheerS: 3,
});

const SAVEABLE = new Set(['stuck', 'approach', 'wait']);
export const AUTO_WAIT_S = 3; // in auto play, Bear is freed after the train has waited this long

/** Auto play (no one at the keys): true once the train has waited, whistling, long enough. */
export const autoSaveDue = (state, waitS = AUTO_WAIT_S) => state.phase === 'wait' && state.t >= waitS;

/** A new round. track: { y, x0, x1 } (stage px); round picks the suggested way to help. */
export function newRescue(stage, track, round = 0) {
  const targetX = track.x0 + (track.x1 - track.x0) * 0.42;
  return {
    phase: 'arrive', t: 0, round, hint: HINTS[round % HINTS.length], stage: { w: stage.w, h: stage.h }, track,
    bear: { x: track.x0 - 200, startX: track.x0 - 200, targetX, off: 0, stuck: false },
    train: { x: stage.w + 300, v: 0 },
    stopX: targetX + RESCUE.bearHalfWidth + RESCUE.safeGap,
    whistleIn: RESCUE.whistleEvery, helpIn: RESCUE.helpEvery,
  };
}

/** Repeating sound every `every` seconds while in a phase. */
function tick(state, key, every, name, dt, effects) {
  const left = state[key] - dt;
  if (left > 0) return { ...state, [key]: left };
  effects.push(name);
  return { ...state, [key]: every };
}

function stepPhase(s, dt, effects) {
  const t = s.t + dt;
  switch (s.phase) {
    case 'arrive': {
      const k = Math.min(1, t / RESCUE.walkS);
      const bear = { ...s.bear, x: s.bear.startX + (s.bear.targetX - s.bear.startX) * k };
      if (k < 1) return { ...s, t, bear };
      effects.push('clunk', 'help');
      return { ...s, phase: 'stuck', t: 0, bear: { ...bear, stuck: true }, helpIn: RESCUE.helpEvery };
    }
    case 'stuck': {
      const next = tick({ ...s, t }, 'helpIn', RESCUE.helpEvery, 'help', dt, effects);
      if (t < RESCUE.stuckS) return next;
      effects.push('whistle');
      return { ...next, phase: 'approach', t: 0, train: { ...s.train, v: RESCUE.vMax } };
    }
    case 'approach': {
      const dist = Math.max(0, s.train.x - s.stopX);
      const v = Math.min(RESCUE.vMax, Math.sqrt(2 * RESCUE.brake * dist)); // the speed from which it can still stop
      const x = Math.max(s.stopX, s.train.x - v * dt);
      if (x - s.stopX < 1) {
        effects.push('whistle');
        return { ...s, phase: 'wait', t: 0, train: { x: s.stopX, v: 0 }, whistleIn: RESCUE.whistleEvery };
      }
      return { ...s, t, train: { x, v } };
    }
    case 'wait': {
      const whistled = tick({ ...s, t }, 'whistleIn', RESCUE.whistleEvery, 'whistle', dt, effects);
      return tick(whistled, 'helpIn', RESCUE.helpEvery, 'help', dt, effects);
    }
    case 'freed': {
      const off = Math.min(1, t / RESCUE.hopS);
      const v = Math.max(0, s.train.v - RESCUE.brake * 2 * dt);
      const x = off < 1 ? Math.max(s.stopX, s.train.x - v * dt) : s.train.x - v * dt;
      const next = { ...s, t, bear: { ...s.bear, off }, train: { x, v } };
      if (t < RESCUE.freedHoldS) return next;
      effects.push('choo');
      return { ...next, phase: 'pass', t: 0 };
    }
    case 'pass': {
      const v = Math.min(RESCUE.vMax * 1.4, s.train.v + RESCUE.passAccel * dt);
      const x = s.train.x - v * dt;
      if (x > -RESCUE.trainLength) return { ...s, t, train: { x, v } };
      effects.push('tada');
      return { ...s, phase: 'cheer', t: 0, train: { x, v } };
    }
    case 'cheer':
      return t < RESCUE.cheerS ? { ...s, t } : newRescue(s.stage, s.track, s.round + 1);
    default:
      return s;
  }
}

/**
 * @param {string[]} events 'save' when the child helps (any way)
 * @returns {{ state: object, effects: string[] }} effects: sounds to play
 */
export function stepRescue(state, dt, events = []) {
  const effects = [];
  if (events.includes('save') && SAVEABLE.has(state.phase)) {
    effects.push('pop', 'cheer');
    return { state: { ...state, phase: 'freed', t: 0, bear: { ...state.bear, stuck: false } }, effects };
  }
  return { state: stepPhase(state, dt, effects), effects };
}
