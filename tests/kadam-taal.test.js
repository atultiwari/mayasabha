import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROWN, JUDGE, KID, bpmFor, heldCatches, newGrown, newKid, pressGrown, pressKid, progressOf, stepGrown, stepKid,
} from '../apps/kadam-taal/chart.js';
import { boardLayout, padAt, stompsFrom } from '../apps/kadam-taal/pads.js';

const STAGE = { w: 1920, h: 1080 };
const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };

// ---- kid mode: nothing is ever missed ---------------------------------------------------------------

test('kid mode: a note floats down and then waits at its pad for as long as it takes', () => {
  let s = newKid();
  for (let i = 0; i < 60 * 30; i += 1) s = stepKid(s, 1 / 60, seq([0.1, 0.5, 0.9])).state;
  assert.ok(s.notes.length >= 1 && s.notes.length <= KID.lanes, 'at most one per pad');
  assert.ok(s.notes.every((n) => n.progress <= 1), 'never falls past the pad');
  assert.ok(s.notes.some((n) => n.progress === 1), 'waiting at the pad');
});

test('kid mode: stepping on a pad with a note waiting is a hit; on an empty pad it still sparkles', () => {
  let s = newKid();
  for (let i = 0; i < 60 * 10; i += 1) s = stepKid(s, 1 / 60, () => 0.2).state;
  const lane = s.notes[0].lane;
  const hit = pressKid(s, lane);
  assert.equal(hit.result, 'hit');
  assert.equal(hit.state.notes.some((n) => n.lane === lane), false);
  assert.equal(hit.state.hits, 1);
  const empty = pressKid(hit.state, lane); // that pad is empty now

  assert.equal(empty.result, 'sparkle');
  assert.equal(empty.state.hits, 1);
});

test('kid mode: a note still on its way can be caught once it is most of the way down', () => {
  const s = { ...newKid(), notes: [{ id: 'n1', lane: 0, progress: 0.75 }] };
  assert.equal(pressKid(s, 0).result, 'hit');
  const early = { ...newKid(), notes: [{ id: 'n1', lane: 0, progress: 0.3 }] };
  assert.equal(pressKid(early, 0).result, 'sparkle');
});

// ---- grown-up mode: timing, streaks, speed ------------------------------------------------------------

const firstNote = (s) => s.notes.reduce((a, n) => (n.time < a.time ? n : a));

test('grown-up mode: notes are scheduled on the beat, ahead of time, so they can travel down', () => {
  let s = newGrown();
  s = stepGrown(s, 0.016, () => 0.3).state;
  assert.equal(s.notes.length, 0, 'a quiet count-in first');
  s = stepGrown(s, 1.5, () => 0.3).state;
  assert.ok(s.notes.length > 0);
  const beat = 60 / s.bpm;
  for (const n of s.notes) {
    assert.ok(n.lane >= 0 && n.lane < GROWN.lanes);
    const beats = (n.time - GROWN.leadInS) / beat;
    assert.ok(Math.abs(beats * 2 - Math.round(beats * 2)) < 1e-6, 'on a beat or half beat');
  }
  assert.ok(Math.max(...s.notes.map((n) => n.time)) <= s.time + GROWN.travelS + 1e-6);
});

test('grown-up mode: perfect, good, and miss by timing; a press with no note nearby costs nothing', () => {
  let s = newGrown();
  s = stepGrown(s, 1.5, () => 0.3).state;
  const n = firstNote(s);
  const at = (dt) => ({ ...s, time: n.time + dt });
  assert.equal(pressGrown(at(0.02), n.lane).result, 'perfect');
  assert.equal(pressGrown(at(-JUDGE.goodS + 0.01), n.lane).result, 'good');
  assert.equal(pressGrown(at(JUDGE.goodS + 0.2), n.lane).result, 'stray');
  const wrongLane = pressGrown(at(0), (n.lane + 1) % GROWN.lanes);
  assert.ok(['stray', 'perfect'].includes(wrongLane.result)); // another lane may have its own note
  // Let it pass by: a miss breaks the streak.
  const streaky = { ...s, streak: 7 };
  const passed = stepGrown({ ...streaky, time: n.time + JUDGE.goodS - 0.001 }, 0.01, () => 0.3);
  assert.ok(passed.events.some((e) => e.type === 'miss' && e.lane === n.lane));
  assert.equal(passed.state.streak, 0);
});

test('grown-up mode: every 10 in a row pays a streak bonus (+600 at 10, like the reference)', () => {
  let s = newGrown();
  s = stepGrown(s, 1.5, () => 0.3).state;
  const n = firstNote(s);
  const r = pressGrown({ ...s, time: n.time, streak: 9, score: 0 }, n.lane);
  assert.equal(r.result, 'perfect');
  assert.equal(r.state.streak, 10);
  assert.equal(r.bonus, 600);
  assert.equal(r.state.score, JUDGE.perfectPoints + 600);
  const plain = pressGrown({ ...s, time: n.time, streak: 3, score: 0 }, n.lane);
  assert.equal(plain.bonus, 0);
});

test('grown-up mode: the beat speeds up as you keep hitting, up to a limit', () => {
  assert.equal(bpmFor(0), GROWN.bpm);
  assert.ok(bpmFor(40) > bpmFor(0));
  assert.equal(bpmFor(100000), GROWN.maxBpm);
});

test('note position: 0 when it appears at the top, 1 when it reaches the pad', () => {
  assert.equal(progressOf({ time: 10 }, 10 - GROWN.travelS), 0);
  assert.equal(progressOf({ time: 10 }, 10), 1);
  assert.ok(progressOf({ time: 10 }, 10.1) > 1);
});

// ---- the board and feet ---------------------------------------------------------------------------------

test('the board has a row of big pads along the near edge, one per lane', () => {
  const b = boardLayout(STAGE, 3);
  assert.equal(b.pads.length, 3);
  for (const p of b.pads) {
    assert.ok(p.y + p.h <= STAGE.h && p.y > STAGE.h * 0.5, 'near edge');
    assert.ok(p.w >= 200, 'big enough for a small foot');
  }
  assert.equal(padAt(b, { x: b.pads[1].x + 10, y: b.pads[1].y + 10 }), 1);
  assert.equal(padAt(b, { x: 5, y: 5 }), -1);
});

test('a stomp is a foot arriving on a pad, not a foot that stays there', () => {
  const b = boardLayout(STAGE, 4);
  const on = (i) => ({ x: b.pads[i].x + b.pads[i].w / 2, y: b.pads[i].y + b.pads[i].h / 2 });
  const first = stompsFrom(new Map(), [on(0), on(2)], b, 1 / 30);
  assert.deepEqual([...first.stomps].sort(), [0, 2]);
  const still = stompsFrom(first.on, [on(0), on(2)], b, 1 / 30);
  assert.deepEqual(still.stomps, []);
  let lifted = still;
  for (let i = 0; i < 10; i += 1) lifted = stompsFrom(lifted.on, [on(2)], b, 1 / 30); // a third of a second off the pad
  const again = stompsFrom(lifted.on, [on(0), on(2)], b, 1 / 30);
  assert.deepEqual(again.stomps, [0]);
});

test('a foot the camera loses for a moment is not a new step when it comes back', () => {
  const b = boardLayout(STAGE, 4);
  const foot = { x: b.pads[1].cx, y: b.pads[1].cy };
  const first = stompsFrom(new Map(), [foot], b, 1 / 30);
  const lost = stompsFrom(first.on, [], b, 1 / 30); // one dropped frame
  const back = stompsFrom(lost.on, [foot], b, 1 / 30);
  assert.deepEqual(back.stomps, []);
});

test('little feet: a child already standing on a pad catches the fruit as it arrives there', () => {
  const s = { ...newKid(), notes: [{ id: 'a', lane: 1, progress: 0.9 }, { id: 'b', lane: 2, progress: 0.2 }] };
  assert.deepEqual(heldCatches(s, new Set([1, 2])), [1]);
  assert.deepEqual(heldCatches(s, new Set()), []);
});

test('grown-ups: the drum beat stays on the notes when the tempo speeds up', () => {
  let s = newGrown();
  const beats = [];
  for (let i = 0; i < 60 * 20; i += 1) {
    if (i === 60 * 6) s = { ...s, hits: GROWN.speedUpEvery * 3, bpm: bpmFor(GROWN.speedUpEvery * 3) }; // a big speed-up
    const before = s.time;
    const r = stepGrown(s, 1 / 60, () => 0.3);
    s = r.state;
    if (r.events.some((e) => e.type === 'beat')) beats.push(before);
  }
  const slots = s.slotTimes; // every slot scheduled so far
  for (const b of beats) assert.ok(slots.some((x) => x > b - 1e-9 && x <= b + 1 / 60 + 1e-9), `beat at ${b} not on the note grid`);
});
