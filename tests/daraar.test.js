import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUES, PHASES, TOTAL_S, cuesBetween, phaseAt, phaseStart } from '../apps/daraar/timeline.js';
import { framePath, holeRect, makeCracks, makeShards, partial, pathLength } from '../apps/daraar/cracks.js';

const STAGE = { w: 1600, h: 1200 };
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('the sequence runs calm → cracks → frame → break → shaft → eye → hand → snap', () => {
  assert.deepEqual(PHASES.map(([name]) => name), ['calm', 'cracks', 'frame', 'break', 'shaft', 'eye', 'hand', 'snap']);
  assert.equal(phaseAt(0).name, 'calm');
  assert.equal(phaseAt(phaseStart('eye') + 0.01).name, 'eye');
  const mid = phaseAt(phaseStart('cracks') + PHASES[1][1] / 2);
  assert.equal(mid.name, 'cracks');
  assert.ok(Math.abs(mid.k - 0.5) < 1e-9);
  assert.equal(phaseAt(TOTAL_S + 5).name, 'done');
});

test('sound cues fire once each, as time passes them', () => {
  const all = cuesBetween(-1, TOTAL_S);
  assert.equal(all.length, CUES.length);
  const first = cuesBetween(-1, phaseStart('cracks') + 0.01).map((c) => c.sound);
  assert.ok(first.includes('crackle'));
  assert.deepEqual(cuesBetween(3, 3), []);
  assert.ok(cuesBetween(phaseStart('break') - 0.01, phaseStart('break') + 0.01).some((c) => c.sound === 'shatter'));
});

test('the hole sits in the middle of the ceiling picture with a margin', () => {
  const r = holeRect(STAGE);
  assert.ok(r.x > 0 && r.y > 0 && r.x + r.w < STAGE.w && r.y + r.h < STAGE.h);
  assert.ok(r.w > STAGE.w * 0.6);
});

test('cracks branch out from one point and stay on the picture; same seed, same cracks', () => {
  const hole = holeRect(STAGE);
  const origin = { x: hole.x + hole.w * 0.4, y: hole.y + hole.h * 0.45 };
  const a = makeCracks(STAGE, origin, seeded(7));
  const b = makeCracks(STAGE, origin, seeded(7));
  assert.deepEqual(a, b);
  assert.ok(a.length >= 8, 'main cracks plus branches');
  assert.ok(a.filter((c) => c.start === 0).every((c) => c.points[0].x === origin.x && c.points[0].y === origin.y));
  for (const c of a) {
    assert.ok(c.start >= 0 && c.start < 1);
    for (const p of c.points) assert.ok(p.x >= 0 && p.x <= STAGE.w && p.y >= 0 && p.y <= STAGE.h);
  }
});

test('the frame crack closes into the shape of the hole (the ceiling has no frame of its own)', () => {
  const hole = holeRect(STAGE);
  const path = framePath(hole, seeded(3));
  const first = path[0];
  const last = path[path.length - 1];
  assert.ok(Math.hypot(first.x - last.x, first.y - last.y) < 1e-9, 'closed');
  for (const p of path) {
    const toEdge = Math.min(Math.abs(p.x - hole.x), Math.abs(p.x - hole.x - hole.w), Math.abs(p.y - hole.y), Math.abs(p.y - hole.y - hole.h));
    assert.ok(toEdge < 30, 'jagged, but along the hole edge');
  }
  assert.ok(pathLength(path) > 2 * (hole.w + hole.h));
});

test('a crack grows along its length: part of a path by fraction', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(partial(line, 0), [{ x: 0, y: 0 }]);
  assert.deepEqual(partial(line, 0.25), [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  assert.deepEqual(partial(line, 0.75), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  assert.deepEqual(partial(line, 1), line);
});

test('the broken ceiling falls out as shards that cover the hole', () => {
  const hole = holeRect(STAGE);
  const shards = makeShards(hole, seeded(5));
  assert.ok(shards.length >= 20);
  for (const s of shards) {
    assert.equal(s.points.length, 3);
    for (const p of s.points) assert.ok(p.x >= hole.x - 1 && p.x <= hole.x + hole.w + 1 && p.y >= hole.y - 1 && p.y <= hole.y + hole.h + 1);
  }
  const area = shards.reduce((sum, s) => {
    const [a, b, c] = s.points;
    return sum + Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }, 0);
  assert.ok(Math.abs(area - hole.w * hole.h) / (hole.w * hole.h) < 0.01, 'no gaps, no overlaps');
});

test('the eye opens, blinks, looks around, then stares straight at you', async () => {
  const { eyeAt } = await import('../apps/daraar/creatures.js');
  assert.equal(eyeAt(0).open, 0);
  assert.equal(eyeAt(0.25).open, 1);
  const blink = [0.3, 0.32, 0.34, 0.36, 0.38, 0.4].map((k) => eyeAt(k).open);
  assert.ok(Math.min(...blink) < 0.2, 'blinks');
  const roaming = [0.2, 0.3, 0.45, 0.55].map((k) => Math.hypot(eyeAt(k).look.x, eyeAt(k).look.y));
  assert.ok(Math.max(...roaming) > 0.4, 'looks around');
  const stare = eyeAt(0.95);
  assert.ok(Math.hypot(stare.look.x, stare.look.y) < 0.05, 'stares at you');
  assert.ok(stare.pupil < eyeAt(0.3).pupil, 'pupil narrows');
});

test('the hand grows as it reaches out of the hole, then curls its fingers', async () => {
  const { handAt } = await import('../apps/daraar/creatures.js');
  assert.ok(handAt(0).scale < handAt(0.5).scale && handAt(0.5).scale < handAt(0.8).scale);
  assert.ok(handAt(0.8).scale > 1.5, 'reaches beyond the hole');
  assert.ok(handAt(0.5).spread > handAt(0).spread);
  assert.ok(handAt(0.98).curl > 0.6 && handAt(0.5).curl < 0.1);
});

test('a branch crack only starts once its main crack has grown to it', () => {
  const hole = holeRect(STAGE);
  const cracks = makeCracks(STAGE, { x: 700, y: 600 }, seeded(11));
  const mains = cracks.filter((c) => c.start === 0);
  for (const br of cracks.filter((c) => c.start > 0)) {
    const parent = mains.find((m) => m.points.some((p) => p.x === br.points[0].x && p.y === br.points[0].y));
    const at = parent.points.findIndex((p) => p.x === br.points[0].x && p.y === br.points[0].y);
    assert.ok(br.start >= at / (parent.points.length - 1) - 1e-9, 'branch waits for its parent');
  }
  assert.ok(hole.w > 0);
});
