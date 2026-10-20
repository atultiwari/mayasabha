import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME, NOTES, defaultCushions, goalRect, moveCushion, noteFor, spawnX, syncTracked, cushionAt, tickSpawner,
} from '../apps/cushion-physics/game.js';

const STAGE = { w: 1920, h: 1080 };
const outline = (cx, cy, w = 0.2, h = 0.15) => ({
  center: { x: cx, y: cy }, size: { w, h },
  points: [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 }],
});

test('the spawner sweeps across the top and stays inside the stage', () => {
  const xs = Array.from({ length: 50 }, (_, i) => spawnX(i * 0.3, STAGE.w));
  assert.ok(Math.min(...xs) >= STAGE.w * 0.1 && Math.max(...xs) <= STAGE.w * 0.9);
  assert.ok(Math.max(...xs) - Math.min(...xs) > STAGE.w * 0.4);
});

test('the spawner drops on a rhythm and respects the item cap', () => {
  let s = { next: 0 };
  let drops = 0;
  for (let i = 0; i < 100; i += 1) {
    const r = tickSpawner(s, 0.1, 3);
    s = r.state;
    drops += r.drop ? 1 : 0;
  }
  assert.ok(drops >= 6 && drops <= 9, `drops ${drops}`);
  assert.equal(tickSpawner({ next: 0 }, 0.1, GAME.maxItems).drop, false);
});

test('Hathi waits at the bottom in one of three spots', () => {
  const left = goalRect(STAGE, 0);
  const right = goalRect(STAGE, 2);
  assert.ok(left.x < right.x);
  assert.ok(left.y + left.h <= STAGE.h);
  assert.equal(goalRect(STAGE, 5).x, right.x);
});

test('tracking keeps a cushion id while it sits still and bumps its version when moved', () => {
  let tracked = syncTracked([], [outline(0.3, 0.5), outline(0.7, 0.5)]);
  assert.equal(tracked.length, 2);
  const ids = tracked.map((t) => t.id);
  tracked = syncTracked(tracked, [outline(0.302, 0.501), outline(0.7, 0.5)]);
  assert.deepEqual(tracked.map((t) => t.id), ids);
  assert.ok(tracked.every((t) => t.version === 1));
  tracked = syncTracked(tracked, [outline(0.33, 0.5), outline(0.7, 0.5)]); // slid a little: same cushion, new shape
  assert.equal(tracked.find((t) => t.id === ids[0]).version, 2);
  tracked = syncTracked(tracked, [outline(0.7, 0.5)]);
  assert.equal(tracked.length, 1);
});

test('virtual cushions start in a sensible layout and can be dragged', () => {
  const cushions = defaultCushions(STAGE);
  assert.equal(cushions.length, 3);
  const hit = cushionAt(cushions, { x: cushions[1].x + 5, y: cushions[1].y + 5 });
  assert.equal(hit?.id, cushions[1].id);
  const moved = moveCushion(cushions, hit.id, 100, 50);
  assert.equal(moved[1].x, cushions[1].x + 100);
  assert.equal(moved[1].version, cushions[1].version + 1);
  assert.equal(cushions[1].x !== moved[1].x, true);
});

test('each cushion plays its own note from a happy scale', () => {
  assert.equal(noteFor(0), NOTES[0]);
  assert.equal(noteFor(NOTES.length), NOTES[0]);
  assert.ok(NOTES.every((f, i) => i === 0 || f > NOTES[i - 1]));
});
