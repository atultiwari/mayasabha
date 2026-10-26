import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HINTS, RESCUE, newRescue, stepRescue } from '../apps/bhalu-bachao/rescue.js';
import { trackLine } from '../apps/bhalu-bachao/track.js';

const STAGE = { w: 1920, h: 1080 };

function run(state, seconds, events = () => [], dt = 1 / 30) {
  let s = state;
  const effects = [];
  const seen = [];
  for (let i = 0; i < seconds / dt; i += 1) {
    const r = stepRescue(s, dt, events(s, i));
    s = r.state;
    effects.push(...r.effects);
    seen.push(s);
  }
  return { state: s, effects, seen };
}

test('the train never reaches Bear while he is stuck: it stops at a safe distance and waits, whistling', () => {
  const start = newRescue(STAGE, { y: 800, x0: 100, x1: 1800 });
  const { state, effects, seen } = run(start, 60);
  const bearRight = start.bear.targetX + RESCUE.bearHalfWidth; // where Bear gets stuck
  for (const s of seen) assert.ok(s.train.x >= bearRight + RESCUE.safeGap - 1, `train front at ${s.train.x}`);
  assert.equal(state.phase, 'wait');
  assert.ok(Math.abs(state.train.v) < 1, 'standing still');
  assert.ok(effects.filter((e) => e === 'whistle').length >= 5, 'keeps whistling for help');
  assert.ok(effects.includes('help'), 'Bear calls for help');
});

test('the train brakes smoothly into its stop rather than slamming', () => {
  const { seen } = run(newRescue(STAGE, { y: 800, x0: 100, x1: 1800 }), 30);
  const moving = seen.filter((s) => s.phase === 'approach');
  const last = moving[moving.length - 1];
  assert.ok(last.train.v < 80, `still doing ${last.train.v} px/s just before stopping`);
});

test('a rescue frees Bear, he hops off, the train goes by, everyone cheers, and a new round starts', () => {
  let saved = false;
  const save = (s) => (!saved && s.phase === 'approach' ? (saved = true, ['save']) : []);
  const { state, effects, seen } = run(newRescue(STAGE, { y: 800, x0: 100, x1: 1800 }), 40, save);
  const phases = [...new Set(seen.map((s) => s.phase))];
  for (const p of ['arrive', 'stuck', 'approach', 'freed', 'pass', 'cheer']) assert.ok(phases.includes(p), `went through ${p}`);
  assert.ok(effects.includes('pop') && effects.includes('cheer'));
  assert.ok(state.round >= 1, 'next round');
  const passing = seen.filter((s) => s.phase === 'pass');
  assert.ok(passing.every((s) => s.bear.off === 1), 'Bear is safely off the track while the train passes');
  assert.ok(passing[passing.length - 1].train.x < 0, 'train drives off');
});

test('Bear can be saved before the train even shows up, and while it waits', () => {
  for (const when of ['stuck', 'wait']) {
    let done = false;
    const save = (s) => (!done && s.phase === when ? (done = true, ['save']) : []);
    const { seen } = run(newRescue(STAGE, { y: 800, x0: 100, x1: 1800 }), when === 'wait' ? 40 : 15, save);
    assert.ok(seen.some((s) => s.phase === 'freed'), `saved during ${when}`);
  }
});

test('extra presses while Bear walks in, or after he is free, do nothing', () => {
  const s = newRescue(STAGE, { y: 800, x0: 100, x1: 1800 });
  const r = stepRescue(s, 0.1, ['save']);
  assert.equal(r.state.phase, 'arrive');
  assert.deepEqual(r.effects.filter((e) => e === 'pop'), []);
});

test('each round suggests a different way to help (touch, red signal, arms up, clap)', () => {
  assert.deepEqual(HINTS, ['touch', 'red', 'arms', 'clap']);
  const a = newRescue(STAGE, { y: 800, x0: 100, x1: 1800 });
  const b = newRescue(STAGE, { y: 800, x0: 100, x1: 1800 }, 1);
  assert.notEqual(a.hint, b.hint);
});

test('the track runs along the longest traced ledge (the sofa back), or low on the wall without a Room Map', () => {
  const room = [
    { id: 'shelf-small', kind: 'rect', tag: 'shelf', x: 100, y: 300, w: 200, h: 20 },
    { id: 'sofa', kind: 'rect', tag: 'shelf', x: 200, y: 814, w: 1100, h: 10 },
    { id: 'puja', kind: 'rect', tag: 'picture', x: 500, y: 0, w: 400, h: 300 },
  ];
  const line = trackLine(room, STAGE);
  assert.equal(line.y, 814);
  assert.ok(line.x0 >= 200 && line.x0 <= 320 && line.x1 <= 1300 && line.x1 >= 1180, 'most of the sofa back (ledges stop short of the very ends)');
  const plain = trackLine([], STAGE);
  assert.ok(plain.y > STAGE.h * 0.6 && plain.x0 === 0 && plain.x1 === STAGE.w);
});

test('ways to help: a hand on Bear, both arms up, or a big red signal held up', async () => {
  const { armsUp, redSignal, touchedBear } = await import('../apps/bhalu-bachao/inputs.js');
  const bear = { x: 800, y: 700, w: 220, h: 300 };
  assert.equal(touchedBear([{ x: 820, y: 650 }], bear), true);
  assert.equal(touchedBear([{ x: 1400, y: 650 }], bear), false);
  assert.equal(touchedBear([], bear), false);
  const head = { x: 500, y: 300 };
  const up = { head, arms: [[{ x: 460, y: 380 }, { x: 440, y: 300 }, { x: 430, y: 220 }], [{ x: 540, y: 380 }, { x: 560, y: 300 }, { x: 570, y: 230 }]] };
  const down = { head, arms: [[{ x: 460, y: 380 }, { x: 440, y: 460 }, { x: 430, y: 540 }], [{ x: 540, y: 380 }, { x: 560, y: 300 }, { x: 570, y: 230 }]] };
  assert.equal(armsUp(up), true);
  assert.equal(armsUp(down), false, 'both arms, not one');
  assert.equal(armsUp(null), false);
  assert.equal(redSignal([{ size: { w: 0.2, h: 0.2 } }]), true, 'a cushion held up');
  assert.equal(redSignal([{ size: { w: 0.05, h: 0.04 } }]), false, 'a small red thing in the room');
  assert.equal(redSignal([]), false);
});

test('the camera counts the moment a child starts helping, not someone still holding a pose', async () => {
  const { startsHelping } = await import('../apps/bhalu-bachao/inputs.js');
  assert.equal(startsHelping(false, true), true, 'arms go up: that is a save');
  assert.equal(startsHelping(true, true), false, 'still up from last round: not again');
  assert.equal(startsHelping(true, false), false);
  assert.equal(startsHelping(false, false), false);
});
