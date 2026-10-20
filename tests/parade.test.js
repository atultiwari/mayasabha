import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARADE, paradeAt } from '../apps/kona/parade.js';

test('the Moon comes first and returns every other turn (his favourite)', () => {
  assert.equal(PARADE.order[0], 'moon');
  assert.ok(PARADE.order.every((name, i) => (i % 2 === 0) === (name === 'moon')));
  for (const other of ['sun', 'earth', 'jupiter', 'saturn']) assert.ok(PARADE.order.includes(other), other);
});

test('each one comes out of the corner, floats in the room, then goes back for the next', () => {
  const start = paradeAt(0);
  assert.equal(start.name, 'moon');
  assert.equal(start.out, 0);
  assert.equal(paradeAt(PARADE.slotS / 2).out, 1, 'fully out in the middle of its turn');
  assert.ok(paradeAt(PARADE.slotS - 0.01).out < 0.05, 'back in the corner at the end');
  assert.equal(paradeAt(PARADE.slotS + 0.1).name, PARADE.order[1]);
  assert.equal(paradeAt(PARADE.slotS * PARADE.order.length + 0.1).name, 'moon', 'loops');
  assert.equal(paradeAt(0).turn, 0);
  assert.equal(paradeAt(PARADE.slotS * 3 + 1).turn, 3);
});
