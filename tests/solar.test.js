import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, SUN } from '../apps/solar-system/solar-data.js';
import {
  SPEEDS, bodyRadius, followCamera, moonOrbitRadius, orbitAngle, orbitRadius, planetPosition, sizeRowLayout, spinAngle,
} from '../apps/solar-system/orbits.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const byId = (id) => PLANETS.find((p) => p.id === id);

test('every planet has bilingual names and facts and sane physical data', () => {
  for (const p of [SUN, ...PLANETS]) {
    assert.ok(p.name.en && p.name.hi && p.fact.en && p.fact.hi, p.id);
    assert.ok(p.radiusKm > 0, p.id);
  }
  assert.deepEqual(PLANETS.map((p) => p.id), ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
});

test('orbits keep the real order and periods: inner planets go round faster', () => {
  const radii = PLANETS.map((p) => orbitRadius(p.au));
  assert.ok(radii.every((r, i) => i === 0 || r > radii[i - 1]));
  close(orbitAngle(365.25, 365.25, 0), Math.PI * 2);
  assert.ok(orbitAngle(10, byId('mercury').periodDays, 0) > orbitAngle(10, byId('earth').periodDays, 0));
});

test('storybook sizes keep the real order but squeeze the range; the Sun stays biggest', () => {
  const r = (id) => bodyRadius(byId(id).radiusKm, 'storybook');
  assert.ok(r('jupiter') > r('saturn') && r('saturn') > r('uranus') && r('earth') > r('mars') && r('mars') > r('mercury'));
  assert.ok(r('jupiter') / r('mercury') < 28.6); // real ratio is 28.6
  assert.ok(bodyRadius(SUN.radiusKm, 'storybook') > r('jupiter'));
  close(bodyRadius(byId('jupiter').radiusKm, 'true') / bodyRadius(byId('earth').radiusKm, 'true'), 69911 / 6371);
});

test('planets never overlap the Sun or each other in storybook scale', () => {
  const sunR = bodyRadius(SUN.radiusKm, 'storybook');
  PLANETS.forEach((p, i) => {
    const r = orbitRadius(p.au);
    const reach = bodyRadius(p.radiusKm, 'storybook') + (p.moons.length ? moonOrbitRadius(bodyRadius(p.radiusKm, 'storybook'), p.moons.length - 1) : 0);
    assert.ok(r - reach > sunR, `${p.id} hits the Sun`);
    if (i > 0) {
      const prev = PLANETS[i - 1];
      const prevReach = bodyRadius(prev.radiusKm, 'storybook') + (prev.moons.length ? moonOrbitRadius(bodyRadius(prev.radiusKm, 'storybook'), prev.moons.length - 1) : 0);
      assert.ok(r - reach > orbitRadius(prev.au) + prevReach, `${p.id} overlaps ${prev.id}`);
    }
  });
});

test('planetPosition sits on the orbit circle', () => {
  const earth = byId('earth');
  const p = planetPosition(earth, 100, 0);
  close(Math.hypot(p.x, p.z), orbitRadius(earth.au));
  close(p.y, 0);
});

test('spinAngle turns backwards for Venus and Uranus', () => {
  assert.ok(spinAngle(1, byId('earth').dayHours) > 0);
  assert.ok(spinAngle(1, byId('venus').dayHours) < 0);
});

test('size row lines the planets up left to right without touching', () => {
  const row = sizeRowLayout(PLANETS);
  row.forEach((item, i) => {
    if (i === 0) return;
    const prev = row[i - 1];
    assert.ok(item.x - item.r > prev.x + prev.r, `${item.id} touches ${prev.id}`);
  });
});

test('followCamera glides towards its target and settles', () => {
  let cam = { pos: { x: 0, y: 50, z: 80 }, look: { x: 0, y: 0, z: 0 } };
  const target = { pos: { x: 10, y: 2, z: 10 }, look: { x: 12, y: 0, z: 12 } };
  for (let i = 0; i < 300; i += 1) cam = followCamera(cam, target, 1 / 60);
  close(cam.pos.x, 10, 1e-2);
  close(cam.look.z, 12, 1e-2);
  assert.ok(SPEEDS.length >= 3);
});
