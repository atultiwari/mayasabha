import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROOM, defaultPoints, projectToWall, sanitizeRoom, screenToWallHomographies, viewerPosition, wallFrames, wallFrustum,
} from '../apps/kona/corner-geometry.js';
import { applyHomography } from '../kit/geometry.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('the two walls meet at the corner line and are the measured sizes', () => {
  const { left, right } = wallFrames(DEFAULT_ROOM);
  // Each wall: pa lower-left, pb lower-right, pc upper-left (as seen from inside the room).
  assert.deepEqual(left.pb, { x: 0, y: 0, z: 0 });
  assert.deepEqual(right.pa, { x: 0, y: 0, z: 0 });
  close(Math.hypot(left.pb.x - left.pa.x, left.pb.z - left.pa.z), DEFAULT_ROOM.leftWidth);
  close(Math.hypot(right.pb.x - right.pa.x, right.pb.z - right.pa.z), DEFAULT_ROOM.rightWidth);
  close(left.pc.y - left.pa.y, DEFAULT_ROOM.height);
});

test('the viewer stands inside the room, in front of the corner', () => {
  const v = viewerPosition(DEFAULT_ROOM);
  assert.ok(v.x < 0 && v.z > 0, JSON.stringify(v));
  close(v.y, DEFAULT_ROOM.eyeHeight);
});

test('a point on a wall projects onto itself (the illusion is exact on the wall surface)', () => {
  const { left } = wallFrames(DEFAULT_ROOM);
  const eye = viewerPosition(DEFAULT_ROOM);
  const mid = { x: (left.pa.x + left.pb.x) / 2, y: 0.5, z: 0 };
  const uv = projectToWall(left, eye, mid);
  close(uv.u, 0.5, 1e-9);
  close(uv.v, 0.5 / DEFAULT_ROOM.height, 1e-9);
});

test('a point behind the wall lands further from the eye line than one in front', () => {
  const { left } = wallFrames(DEFAULT_ROOM);
  const eye = { x: (left.pa.x + left.pb.x) / 2, y: 0.75, z: 3 }; // straight in front of the left wall
  const behind = projectToWall(left, eye, { x: eye.x + 0.5, y: 0.75, z: -1 });
  const front = projectToWall(left, eye, { x: eye.x + 0.5, y: 0.75, z: 1 });
  assert.ok(Math.abs(behind.u - 0.5) < Math.abs(front.u - 0.5));
});

test('the frustum is symmetric when the eye is centred in front of a wall, skewed otherwise', () => {
  const { left } = wallFrames(DEFAULT_ROOM);
  const centred = wallFrustum(left, { x: (left.pa.x + left.pb.x) / 2, y: DEFAULT_ROOM.height / 2, z: 2 }, 0.1);
  close(centred.left, -centred.right, 1e-9);
  close(centred.bottom, -centred.top, 1e-9);
  const skewed = wallFrustum(left, { x: left.pb.x, y: DEFAULT_ROOM.height / 2, z: 2 }, 0.1);
  assert.ok(Math.abs(skewed.left) > Math.abs(skewed.right));
});

test('screen homographies send the clicked points to the wall corners', () => {
  const pts = defaultPoints({ w: 1920, h: 1080 });
  const { left, right } = screenToWallHomographies(pts);
  const uvLT = applyHomography(left, pts.leftTop);
  close(uvLT.x, 0, 1e-9);
  close(uvLT.y, 1, 1e-9);
  const uvRB = applyHomography(right, pts.rightBottom);
  close(uvRB.x, 1, 1e-9);
  close(uvRB.y, 0, 1e-9);
  const corner = applyHomography(right, pts.cornerTop);
  close(corner.x, 0, 1e-9);
});

test('saved room settings are validated and clamped', () => {
  assert.deepEqual(sanitizeRoom(null), DEFAULT_ROOM);
  const r = sanitizeRoom({ leftWidth: -3, rightWidth: 99, height: 'x', viewerDistance: 2.5, eyeHeight: 0.4, viewerAngle: 10 });
  assert.ok(r.leftWidth > 0 && r.rightWidth <= 10);
  assert.equal(r.height, DEFAULT_ROOM.height);
  assert.equal(r.viewerDistance, 2.5);
});

test('a wall lit at a steep angle can be brightened to match the other (default: no change)', () => {
  assert.equal(DEFAULT_ROOM.rightGain, 1);
  assert.equal(sanitizeRoom({ rightGain: 1.8 }).rightGain, 1.8);
  assert.equal(sanitizeRoom({ rightGain: 50 }).rightGain, 3);
  assert.equal(sanitizeRoom({ rightGain: 0 }).rightGain, 0.5);
});
