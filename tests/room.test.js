import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEllipse, makeRect } from '../kit/room/shapes.js';
import { ROOM_KEY, ledgesFromRoom, solidsFromRoom, migrateShapes } from '../kit/room/room-map.js';

const frame = makeRect('f1', 'frame', { x: 100, y: 200 }, { x: 400, y: 450 });
const puja = makeRect('p1', 'picture', { x: 600, y: 150 }, { x: 900, y: 400 });
const shelf = makeRect('s1', 'shelf', { x: 1300, y: 300 }, { x: 1700, y: 340 });
const floor = makeRect('fl', 'floor', { x: 0, y: 900 }, { x: 600, y: 1080 });
const balloon = makeEllipse('b1', 'balloon', { x: 1000, y: 100 }, { x: 1100, y: 220 });
const room = [frame, puja, shelf, floor, balloon];

test('solids skip pictures and floor patches; ellipses become polygons', () => {
  const solids = solidsFromRoom(room);
  assert.deepEqual(solids.map((s) => s.id).sort(), ['b1', 'f1', 's1']);
  const b = solids.find((s) => s.id === 'b1');
  assert.ok(b.points.length >= 12);
  assert.equal(solids.find((s) => s.id === 'f1').points.length, 4);
});

test('ledges run along the tops of frames, shelves and doors, never pictures', () => {
  const ledges = ledgesFromRoom(room);
  assert.deepEqual(ledges.map((l) => l.id).sort(), ['room-f1', 'room-s1']);
  const top = ledges.find((l) => l.id === 'room-f1');
  assert.equal(top.a.y, 200);
  assert.ok(top.a.x >= 100 && top.b.x <= 400);
});

test('an old Maya Masks tracing is carried over once, never over an existing room map', () => {
  assert.deepEqual(migrateShapes([], [frame]).map((s) => s.id), ['f1']);
  assert.deepEqual(migrateShapes([shelf], [frame]).map((s) => s.id), ['s1']);
  assert.equal(ROOM_KEY, 'room');
});
