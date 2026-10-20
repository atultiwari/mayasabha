import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUBBLE, driftAway, fillBubbles, popTouched, spawnBubble, stepBubbles } from '../apps/bubbles/bubbles.js';
import { BUTTERFLY, populateButterflies, stepButterflies } from '../apps/bubbles/butterflies.js';
import { HANDS } from '../kit/vision/hand-tracker.js';

const STAGE = { w: 1920, h: 1080 };
const rng = () => 0.5;
const emptyGrid = { cols: 48, rows: 27, cellW: 40, cellH: 40, cells: new Uint8Array(48 * 27) };

test('bubbles rise, and new ones are blown in mid-wall within reach (not under their feet)', () => {
  let bubbles = [{ ...spawnBubble(STAGE, rng, true), y: -500 }];
  bubbles = stepBubbles(bubbles, 0.016, STAGE, rng);
  const [lo, hi] = BUBBLE.appearBand.map((f) => f * STAGE.h);
  assert.ok(bubbles[0].y >= lo && bubbles[0].y <= hi, `new bubble at ${bubbles[0].y}`);
  const before = bubbles[0].y;
  bubbles = stepBubbles(bubbles, 1, STAGE, rng);
  assert.ok(bubbles[0].y < before);
});

test('fillBubbles tops up to the wanted count without touching existing ones', () => {
  const one = [spawnBubble(STAGE, rng, false)];
  const filled = fillBubbles(one, 5, STAGE, rng);
  assert.equal(filled.length, 5);
  assert.equal(filled[0], one[0]);
});

test('a hand or the body pops the bubble it touches', () => {
  const b = { ...spawnBubble(STAGE, rng, false), x: 500, y: 500, r: 100 };
  const far = { ...b, id: 'far', x: 1500 };
  const byHand = popTouched([b, far], { grid: null, hands: [{ x: 540, y: 520 }] });
  assert.deepEqual(byHand.popped.map((p) => p.id), [b.id]);
  assert.equal(byHand.kept.length, 1);
  const cells = new Uint8Array(48 * 27);
  cells[12 * 48 + 12] = 1; // cell containing (500, 500)
  const byBody = popTouched([b, far], { grid: { ...emptyGrid, cells }, hands: [] });
  assert.deepEqual(byBody.popped.map((p) => p.id), [b.id]);
  assert.equal(popTouched([b], { grid: emptyGrid, hands: [] }).popped.length, 0);
});

test('some bubbles carry a surprise inside', () => {
  let seq = 0;
  const cycling = () => { seq = (seq + 0.137) % 1; return seq; };
  const bubbles = Array.from({ length: 40 }, () => spawnBubble(STAGE, cycling, false));
  const withSurprise = bubbles.filter((b) => b.surprise).length;
  assert.ok(withSurprise > 0 && withSurprise < 40);
  assert.ok(bubbles.every((b) => b.r >= BUBBLE.rMin && b.r <= BUBBLE.rMax));
});

const stillHand = (x, y) => ({ id: 'h1', x, y, vx: 0, vy: 0, speed: 0, stillFor: HANDS.stillAfter + 0.5, missingFor: 0 });

test('butterflies come and land on a hand that is held still', () => {
  let flock = populateButterflies(STAGE, rng).slice(0, 3);
  const hand = stillHand(900, 500);
  for (let i = 0; i < 60 * 12; i += 1) flock = stepButterflies(flock, [hand], 1 / 60, STAGE, rng);
  assert.ok(flock.every((b) => b.state === 'landed'), flock.map((b) => b.state).join());
  assert.ok(flock.every((b) => Math.hypot(b.x - 900, b.y - 500) < BUTTERFLY.landRingMax + 5));
});

test('a fast swipe nearby scares butterflies away', () => {
  const flock = [{ ...populateButterflies(STAGE, rng)[0], x: 1000, y: 500, state: 'landed', handId: 'h1' }];
  const swipe = { ...stillHand(1000, 520), speed: BUTTERFLY.scareSpeed + 100, stillFor: 0, vx: 900 };
  const [b] = stepButterflies(flock, [swipe], 1 / 60, STAGE, rng);
  assert.equal(b.state, 'flee');
});

test('flying butterflies stay on the stage', () => {
  let flock = populateButterflies(STAGE, Math.random);
  for (let i = 0; i < 60 * 20; i += 1) flock = stepButterflies(flock, [], 1 / 60, STAGE, Math.random);
  assert.ok(flock.every((b) => b.x > -150 && b.x < STAGE.w + 150 && b.y > -150 && b.y < STAGE.h + 150));
});

test('bubbles stay in the middle of the wall, away from the corners and sofa arms (safety)', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const [lo, hi] = BUBBLE.band.map((f) => f * STAGE.w);
  let bubbles = Array.from({ length: 60 }, () => spawnBubble(STAGE, rand, true));
  for (let i = 0; i < 300; i += 1) {
    bubbles = stepBubbles(bubbles, 0.1, STAGE, rand);
    for (const b of bubbles) assert.ok(b.x - b.r >= lo - 1 && b.x + b.r <= hi + 1, `bubble at ${b.x} r ${b.r}`);
  }
  const middle = bubbles.filter((b) => Math.abs(b.x - STAGE.w / 2) < (hi - lo) / 4).length;
  assert.ok(middle > bubbles.length / 2, 'most bubbles near the centre');
});

test('a bubble that is still appearing cannot pop yet, so a child standing there sees it first', () => {
  const b = { ...spawnBubble(STAGE, rng, true), x: 500, y: 500, r: 100 };
  const hand = { grid: null, hands: [{ x: 500, y: 500 }] };
  assert.equal(popTouched([b], hand).popped.length, 0);
  const grown = stepBubbles([b], BUBBLE.appearS + 0.1, STAGE, rng)[0];
  assert.equal(popTouched([{ ...grown, x: 500, y: 500 }], hand).popped.length, 1);
  assert.ok(spawnBubble(STAGE, rng, false).age >= BUBBLE.appearS, 'bubbles there at the start are ready');
});

test('bubbles never float over the puja picture', () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const puja = { x: 483, y: -13, w: 413, h: 355 };
  const overlaps = (b) => b.x + b.r > puja.x && b.x - b.r < puja.x + puja.w && b.y + b.r > puja.y && b.y - b.r < puja.y + puja.h;
  let bubbles = Array.from({ length: 30 }, () => spawnBubble(STAGE, rand, true, [puja]));
  let worst = 0;
  for (let i = 0; i < 900; i += 1) {
    bubbles = stepBubbles(bubbles, 1 / 30, STAGE, rand, [puja]);
    worst = Math.max(worst, bubbles.filter(overlaps).length);
  }
  assert.equal(worst, 0);
});

test('a bubble that bumps into the picture dances along its bottom edge, then carries on rising beside it', () => {
  const puja = { x: 483, y: -13, w: 413, h: 355 };
  let [b] = [{ ...spawnBubble(STAGE, rng, false), x0: 640, x: 640, y: 700, r: 90 }];
  let slid = false;
  for (let i = 0; i < 30 * 20 && b.y > -b.r; i += 1) {
    [b] = stepBubbles([b], 1 / 30, STAGE, rng, [puja]);
    if (b.slide) {
      slid = true;
      assert.ok(b.y - b.r >= puja.y + puja.h, 'stays under the frame while dancing');
    }
    if (slid && !b.slide && b.y < puja.y + puja.h) {
      assert.ok(b.x + b.r <= puja.x || b.x - b.r >= puja.x + puja.w, 'rises beside the frame');
      return;
    }
  }
  assert.fail(`never got past the frame (slid: ${slid})`);
});

test('no bubble gets stuck under the picture, and dancers spread out instead of piling up at one edge', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const puja = { x: 483, y: -13, w: 413, h: 355 };
  let bubbles = Array.from({ length: 12 }, () => spawnBubble(STAGE, rand, true, [puja]));
  const highest = new Map(); // id -> [lowest y so far, seconds without rising past it]
  const ends = [];
  for (let i = 0; i < 30 * 40; i += 1) {
    const before = new Map(bubbles.map((b) => [b.id, b]));
    bubbles = stepBubbles(bubbles, 1 / 30, STAGE, rand, [puja]);
    for (const b of bubbles) {
      const [top, stalled] = highest.get(b.id) ?? [Infinity, 0];
      highest.set(b.id, b.y < top - 0.5 ? [b.y, 0] : [top, stalled + 1 / 30]);
      assert.ok(highest.get(b.id)[1] < 6, `bubble ${b.id} stuck at y ${Math.round(b.y)}`);
      if (before.get(b.id)?.slide && !b.slide) ends.push(Math.round(b.x0));
    }
  }
  assert.ok(ends.length >= 4, `only ${ends.length} dances finished`);
  assert.ok(new Set(ends.map((x) => Math.round(x / 25))).size >= 3, `dancers all end at ${[...new Set(ends)]}`);
  const left = ends.filter((x) => x < puja.x).length;
  assert.ok(left >= ends.length * 0.3 && left <= ends.length * 0.7, `dancers leave on both sides: ${left} of ${ends.length} went left`);
});

test('switching to butterflies only: the bubbles hurry off the top within seconds and are gone for good', () => {
  let bubbles = Array.from({ length: 7 }, () => spawnBubble(STAGE, rng, false));
  for (let i = 0; i < 30 * 6 && bubbles.length; i += 1) bubbles = driftAway(bubbles, 1 / 30, STAGE);
  assert.equal(bubbles.length, 0);
});
