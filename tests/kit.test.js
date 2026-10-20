import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHomography, cssMatrix3d, defaultCorners, hitCorner, moveCorner, sanitizeCorners, warpMaps } from '../kit/warp.js';
import { DEFAULT_CLAP, feedClap, initialClap, rms } from '../kit/clap.js';
import { parseClientMessage, parseServerMessage } from '../kit/protocol.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const STAGE = { w: 1920, h: 1080 };

test('defaultCorners letterboxes the stage inside a taller screen', () => {
  const c = defaultCorners({ w: 1920, h: 1200 }, STAGE);
  close(c[0].x, 0);
  close(c[0].y, 60);
  close(c[2].y, 1140);
});

test('warpMaps round-trips a point through a keystoned quad', () => {
  const corners = [{ x: 100, y: 50 }, { x: 1800, y: 0 }, { x: 1900, y: 1000 }, { x: 0, y: 1080 }];
  const { toScreen, toStage } = warpMaps(STAGE, corners);
  const corner = applyHomography(toScreen, { x: 1920, y: 1080 });
  close(corner.x, 1900);
  close(corner.y, 1000);
  const back = applyHomography(toStage, applyHomography(toScreen, { x: 700, y: 300 }));
  close(back.x, 700, 1e-4);
  close(back.y, 300, 1e-4);
});

test('cssMatrix3d lays out the homography column-major', () => {
  assert.equal(cssMatrix3d([1, 0, 5, 0, 1, 7, 0, 0, 1]), 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,5,7,0,1)');
});

test('sanitizeCorners rejects bad saved data', () => {
  assert.equal(sanitizeCorners(null), null);
  assert.equal(sanitizeCorners([{ x: 1, y: 2 }]), null);
  assert.equal(sanitizeCorners([{ x: 1, y: 2 }, { x: 1, y: NaN }, { x: 1, y: 2 }, { x: 1, y: 2 }]), null);
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.deepEqual(sanitizeCorners(square.map((p) => ({ ...p, extra: 1 }))), square);
});

test('hitCorner picks the nearest corner within radius, moveCorner copies', () => {
  const c = defaultCorners(STAGE, STAGE);
  assert.equal(hitCorner(c, { x: 1910, y: 10 }, 30), 1);
  assert.equal(hitCorner(c, { x: 900, y: 500 }, 30), -1);
  const moved = moveCorner(c, 1, { x: 5, y: 6 });
  assert.deepEqual(moved[1], { x: 5, y: 6 });
  assert.deepEqual(c[1], { x: 1920, y: 0 });
});

test('clap detector fires on a spike, respects the refractory gap, ignores steady noise', () => {
  let s = initialClap();
  let fired = 0;
  for (let i = 0; i < 100; i += 1) {
    const r = feedClap(s, 0.02, i * 0.016);
    s = r.state;
    fired += r.fired ? 1 : 0;
  }
  assert.equal(fired, 0);
  const a = feedClap(s, 0.5, 2);
  assert.equal(a.fired, true);
  const b = feedClap(a.state, 0.5, 2 + DEFAULT_CLAP.refractoryS / 2);
  assert.equal(b.fired, false);
  const c = feedClap(b.state, 0.5, 2 + DEFAULT_CLAP.refractoryS + 0.01);
  assert.equal(c.fired, true);
});

test('rms of a square wave is its amplitude', () => {
  close(rms(Float32Array.from([0.5, -0.5, 0.5, -0.5])), 0.5);
  assert.equal(rms([]), 0);
});

test('protocol accepts valid messages and drops junk', () => {
  assert.equal(parseClientMessage('not json'), null);
  assert.equal(parseClientMessage('{"type":"press","id":"BAD ID"}'), null);
  assert.deepEqual(parseClientMessage('{"type":"press","id":"banana"}'), { type: 'press', id: 'banana' });
  const hello = parseClientMessage(JSON.stringify({
    type: 'hello', role: 'stage', layout: { title: 'Pet', buttons: [{ id: 'ok', label: 'x'.repeat(50), icon: '🍌' }, { id: '<script>' }] },
  }));
  assert.equal(hello.layout.buttons.length, 1);
  assert.equal(hello.layout.buttons[0].label.length, 24);
  assert.equal(parseClientMessage('{"type":"hello","role":"admin"}'), null);
  assert.equal(parseServerMessage('{"type":"layout","layout":{"buttons":[]}}').type, 'layout');
  assert.equal(parseServerMessage('{"type":"nope"}'), null);
});

test('sanitizeCorners rejects a collapsed quad that cannot be warped', () => {
  assert.equal(sanitizeCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 100 }]), null);
});

test('lanAddresses prefers home Wi-Fi ranges and drops loopback, link-local and IPv6', async () => {
  const { lanAddresses, remoteUrls } = await import('../kit/network.js');
  const ifaces = {
    lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    utun: [{ address: '100.64.1.2', family: 'IPv4', internal: false }],
    en0: [{ address: '192.168.1.42', family: 'IPv4', internal: false }, { address: 'fe80::1', family: 'IPv6', internal: false }],
    bridge: [{ address: '169.254.3.3', family: 4, internal: false }, { address: '10.0.0.5', family: 4, internal: false }],
  };
  assert.deepEqual(lanAddresses(ifaces), ['192.168.1.42', '10.0.0.5', '100.64.1.2']);
  assert.deepEqual(lanAddresses(undefined), []);
  assert.deepEqual(remoteUrls(['192.168.1.42'], 5190), ['http://192.168.1.42:5190/remote/']);
});

test('rotateCorners180 swaps opposite corners without mutating', async () => {
  const { rotateCorners180 } = await import('../kit/warp.js');
  const c = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.deepEqual(rotateCorners180(c), [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(c[0], { x: 0, y: 0 });
});
