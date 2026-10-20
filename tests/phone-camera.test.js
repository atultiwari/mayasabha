import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoneCamera, snapshotUrl } from '../kit/phone-camera.js';

test('accepts an IP Webcam address on the home network', () => {
  assert.deepEqual(parsePhoneCamera('http://192.168.1.24:8080'), { base: 'http://192.168.1.24:8080', rotate: 0 });
  assert.deepEqual(parsePhoneCamera('192.168.1.24:8080/', 90), { base: 'http://192.168.1.24:8080', rotate: 90 });
  assert.equal(parsePhoneCamera('http://10.0.0.7:8080').base, 'http://10.0.0.7:8080');
  assert.equal(parsePhoneCamera('http://172.20.1.2:8080').base, 'http://172.20.1.2:8080');
});

test('refuses anything outside the home network or with extras (so the server is never an open proxy)', () => {
  for (const bad of ['http://8.8.8.8:8080', 'http://example.com:8080', 'https://192.168.1.24:8080', 'http://localhost:5190',
    'http://127.0.0.1:8080', 'http://192.168.1.24:8080/../admin', 'http://user:pw@192.168.1.24:8080', 'file:///etc/passwd', '', null]) {
    assert.equal(parsePhoneCamera(bad), null, String(bad));
  }
  assert.equal(parsePhoneCamera('http://192.168.1.24:8080', 45).rotate, 0); // only quarter turns
});

test('snapshot URL is always the fixed IP Webcam photo path', () => {
  assert.equal(snapshotUrl({ base: 'http://192.168.1.24:8080', rotate: 0 }), 'http://192.168.1.24:8080/shot.jpg');
});
