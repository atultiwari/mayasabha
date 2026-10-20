import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUBBLE, fillBubbles, popTouched, spawnBubble, stepBubbles } from '../apps/bubbles/bubbles.js';
import { BUTTERFLY, populateButterflies, stepButterflies } from '../apps/bubbles/butterflies.js';
import { HANDS } from '../kit/vision/hand-tracker.js';

const STAGE = { w: 1920, h: 1080 };
const rng = () => 0.5;
const emptyGrid = { cols: 48, rows: 27, cellW: 40, cellH: 40, cells: new Uint8Array(48 * 27) };

test('bubbles rise and are replaced at the bottom when they float off the top', () => {
  let bubbles = [{ ...spawnBubble(STAGE, rng, true), y: -500 }];
  bubbles = stepBubbles(bubbles, 0.016, STAGE, rng);
  assert.ok(bubbles[0].y > STAGE.h, 'new bubble starts below the stage');
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
