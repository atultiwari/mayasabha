import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASES, phaseAt, phaseStart, nextShow } from '../apps/janamdin/show.js';
import { birthdayLayout, overlaps } from '../apps/janamdin/layout.js';
import { TUNE, tuneLength, notesBetween, lyric } from '../apps/janamdin/tune.js';
import { BLOW, feedBlow, initialBlow } from '../apps/janamdin/blow.js';

const STAGE = { w: 1920, h: 1080 };
// The living room as traced: the puja picture (protected) and the sofa back.
const ROOM = [
  { id: 'puja', kind: 'polygon', tag: 'picture', points: [{ x: 526, y: 181 }, { x: 942, y: 181 }, { x: 941, y: 509 }, { x: 521, y: 510 }] },
  { id: 'sofa-back', kind: 'rect', tag: 'shelf', x: 150, y: 1040, w: 1300, h: 30 },
];

test('the show runs: dim, frame, bunting, name, cake, wish, celebrate, balloons', () => {
  assert.deepEqual(PHASES.map(([n]) => n), ['dim', 'frame', 'bunting', 'name', 'cake', 'wish', 'celebrate', 'balloons']);
  assert.equal(phaseAt(0).name, 'dim');
  assert.equal(phaseAt(phaseStart('cake') + 0.1).name, 'cake');
});

test('the wish waits for the candles to be blown out (or a key), then the party starts', () => {
  let s = { t: phaseStart('wish') + 1, blown: false };
  s = nextShow(s, 30);
  assert.equal(phaseAt(s.t).name, 'wish', 'still waiting after 30 s: no rush');
  s = nextShow({ ...s, blown: true }, 0.1);
  assert.equal(phaseAt(s.t).name, 'celebrate');
  const end = nextShow({ t: phaseStart('balloons') + 1, blown: true }, 600);
  assert.equal(phaseAt(end.t).name, 'balloons', 'the balloons go on until someone stops the show');
});

test('everything is placed around the puja picture, never over it, and the cake sits on the sofa back', () => {
  const L = birthdayLayout(STAGE, ROOM);
  const picture = { x: 521, y: 181, w: 421, h: 329 };
  for (const [name, box] of Object.entries({ bunting: L.bunting, name: L.name, cake: L.cake, friends: L.friends })) {
    assert.equal(overlaps(box, picture), false, `${name} stays off the picture`);
  }
  assert.ok(Math.abs(L.cake.y + L.cake.h - 1040) < 1, 'cake stands on the sofa back');
  assert.ok(L.name.y >= picture.y + picture.h && L.name.y + L.name.h <= L.cake.y + 1, 'the name sits between the picture and the cake');
  assert.ok(L.bunting.y + L.bunting.h <= picture.y, 'bunting above the picture');
  assert.deepEqual(L.picture, ROOM[0]);
});

test('without a Room Map it still lays out sensibly', () => {
  const L = birthdayLayout(STAGE, []);
  assert.equal(L.picture, null);
  assert.ok(L.cake.y + L.cake.h <= STAGE.h && L.name.y > L.bunting.y);
});

test('the Happy Birthday tune: four lines, the third one sings the name', () => {
  assert.ok(TUNE.length >= 25);
  assert.ok(tuneLength() > 10 && tuneLength() < 20);
  assert.equal(notesBetween(-1, tuneLength()).length, TUNE.length);
  assert.deepEqual(notesBetween(0.5, 0.5), []);
  assert.match(lyric(tuneLength() * 0.6, 'Dadu', 'en'), /Dadu/);
  assert.match(lyric(0.2, 'Dadu', 'en'), /Happy birthday to you/i);
});

test('blowing the candles: a steady breath over the room noise puts them out; a clap does not', () => {
  let s = initialBlow();
  for (let i = 0; i < 60; i += 1) s = feedBlow(s, 0.01, 1 / 60); // quiet room
  let clap = s;
  for (let i = 0; i < 4; i += 1) clap = feedBlow(clap, 0.4, 1 / 60); // a sharp clap, 1/15 s
  for (let i = 0; i < 30; i += 1) clap = feedBlow(clap, 0.01, 1 / 60);
  assert.equal(clap.out, false);
  let blow = s;
  for (let i = 0; i < 60 * BLOW.holdS + 5; i += 1) blow = feedBlow(blow, 0.12, 1 / 60);
  assert.equal(blow.out, true);
  assert.ok(blow.flicker > 0, 'flames flicker while blowing');
});

test('balloons rise beside the picture, never across it, and keep coming', async () => {
  const { balloonZones, spawnBalloon, stepBalloons } = await import('../apps/janamdin/party.js');
  const picture = { x: 521, y: 181, w: 421, h: 329 };
  const zones = balloonZones(STAGE, picture);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let balloons = Array.from({ length: 30 }, () => spawnBalloon(STAGE, zones, rand));
  for (let i = 0; i < 30 * 40; i += 1) {
    balloons = stepBalloons(balloons, 1 / 30, STAGE, zones, rand);
    for (const b of balloons) {
      const box = { x: b.x - b.r, y: b.y - b.r * 1.2, w: b.r * 2, h: b.r * 2.4 };
      assert.equal(overlaps(box, picture), false, `balloon at ${Math.round(b.x)},${Math.round(b.y)}`);
    }
  }
  assert.equal(balloons.length, 30);
  assert.equal(balloonZones(STAGE, null).length, 1, 'no picture: the whole wall');
});

import { spawnWalkers, stepWalkers, spawnFruit, stepFruits, WALKERS } from '../apps/janamdin/crowd.js';
import { balloonZones } from '../apps/janamdin/party.js';

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

test('the friends wander about but never walk over the picture or the cake', () => {
  const area = { x: 40, y: 220, w: 1840, h: 820 };
  const keepOut = [{ x: 526, y: 181, w: 420, h: 330 }, { x: 760, y: 700, w: 380, h: 340 }];
  const rng = seeded(7);
  let walkers = spawnWalkers(area, keepOut, rng);
  assert.equal(walkers.length, WALKERS.length);
  const starts = walkers.map((w) => `${w.x},${w.y}`);
  for (let i = 0; i < 3000; i += 1) {
    walkers = stepWalkers(walkers, 1 / 30, area, keepOut, rng);
    for (const w of walkers) {
      const body = { x: w.x - w.h * 0.4, y: w.y - w.h, w: w.h * 0.8, h: w.h };
      assert.ok(!keepOut.some((o) => overlaps(body, o)), `${w.role} stepped onto a keep-out box`);
    }
  }
  assert.ok(walkers.some((w, i) => `${w.x},${w.y}` !== starts[i]), 'somebody moved');
});

test('fruit floats up beside the picture, never across it', () => {
  const zones = balloonZones(STAGE, { x: 526, y: 181, w: 420, h: 330 });
  const rng = seeded(3);
  let fruits = Array.from({ length: 10 }, () => spawnFruit(STAGE, zones, rng, false));
  for (let i = 0; i < 2000; i += 1) {
    fruits = stepFruits(fruits, 1 / 30, STAGE, zones, rng);
    for (const f of fruits) assert.ok(f.x + f.size / 2 + 22 < 526 || f.x - f.size / 2 - 22 > 946, `${f.kind} drifted over the picture`);
  }
});

test('the bunting parts round the picture when the picture sits high on the wall', () => {
  const high = [{ id: 'puja', kind: 'polygon', tag: 'picture', points: [{ x: 740, y: 101 }, { x: 1079, y: 107 }, { x: 1070, y: 380 }, { x: 735, y: 377 }] }];
  const { bunting } = birthdayLayout(STAGE, high);
  assert.ok(bunting.gap, 'flags part round the picture');
  assert.ok(bunting.gap.x0 < 735 && bunting.gap.x1 > 1079);
  const low = [{ id: 'p', kind: 'rect', tag: 'picture', x: 700, y: 420, w: 300, h: 250 }];
  assert.equal(birthdayLayout(STAGE, low).bunting.gap, null, 'a lower picture leaves the bunting whole');
});
