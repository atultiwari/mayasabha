import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_ID, makeGround, makeLedge } from '../kit/ledges.js';
import { PET, createPet, petEvent, routeTo, updatePet } from '../apps/room-pet/brain.js';
import { FRUIT, biteFruit, removeFruit, spawnFruit, stepFruits } from '../apps/room-pet/fruit.js';
import { spawnFriend, stepFriends } from '../apps/room-pet/friends.js';

const STAGE = { w: 1920, h: 1080 };
const ledges = [makeGround(1920, 1020), makeLedge('frame', { x: 300, y: 700 }, { x: 650, y: 700 })];
const world = (extra = {}) => ({ ledges, fruits: [], friends: [], width: 1920, ...extra });
const fixedRng = () => 0.42;

/** Runs the pet for `seconds` and collects every effect. */
function run(state, startWorld, seconds, dt = 1 / 60) {
  let s = state;
  let w = startWorld;
  const effects = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = updatePet(s, w, dt, fixedRng);
    s = r.state;
    effects.push(...r.effects);
    // Like main.js: eaten fruit disappears.
    for (const e of r.effects) if (e.type === 'eat') w = { ...w, fruits: removeFruit(w.fruits, e.fruitId) };
  }
  return { state: s, effects };
}

test('fruit falls, bounces and settles on the ledge under it', () => {
  let fruits = [spawnFruit('banana', 450)];
  for (let i = 0; i < 240; i += 1) fruits = stepFruits(fruits, ledges, 1 / 60, STAGE.h);
  assert.equal(fruits[0].resting, true);
  assert.equal(fruits[0].ledgeId, 'frame');
  assert.equal(fruits[0].y, 700);
});

test('fruit on a deleted ledge falls again to the ground', () => {
  let fruits = [{ ...spawnFruit('apple', 450), y: 700, resting: true, ledgeId: 'frame' }];
  for (let i = 0; i < 240; i += 1) fruits = stepFruits(fruits, [ledges[0]], 1 / 60, STAGE.h);
  assert.equal(fruits[0].ledgeId, GROUND_ID);
});

test('bites are capped and removeFruit does not mutate', () => {
  const fruits = [spawnFruit('orange', 10)];
  let bitten = fruits;
  for (let i = 0; i < 5; i += 1) bitten = biteFruit(bitten, fruits[0].id);
  assert.equal(bitten[0].bites, FRUIT.maxBites);
  assert.equal(fruits[0].bites, 0);
  assert.equal(removeFruit(bitten, fruits[0].id).length, 0);
});

test('routeTo builds walk → hop → walk to climb onto a frame', () => {
  const pet = createPet(world(), 1000);
  const steps = routeTo(pet, world(), 'frame', 500);
  assert.deepEqual(steps.map((s) => s.kind), ['walk', 'hop', 'walk']);
  assert.equal(steps[1].to, 'frame');
});

test('the puppy climbs to a banana on the frame and eats it', () => {
  const banana = { ...spawnFruit('banana', 500), y: 700, resting: true, ledgeId: 'frame' };
  const { state, effects } = run(createPet(world(), 1200), world({ fruits: [banana] }), 8);
  const types = effects.map((e) => e.type);
  assert.equal(types.filter((t) => t === 'bite').length, 3);
  assert.ok(effects.some((e) => e.type === 'eat' && e.fruitId === banana.id));
  assert.equal(state.ledgeId, 'frame');
});

test('a clap wakes a sleeping puppy and makes it happy', () => {
  const asleep = { ...createPet(world(), 900), mode: 'sleep' };
  const { state, effects } = petEvent(asleep, 'happy', world());
  assert.equal(state.mode, 'happy');
  assert.ok(effects.some((e) => e.type === 'sound' && e.name === 'yip'));
  assert.equal(asleep.mode, 'sleep');
});

test('left alone long enough, the puppy falls asleep', () => {
  const pet = { ...createPet(world(), 900), idleFor: PET.sleepAfter + 1, nextDecision: 0 };
  const { state } = updatePet(pet, world(), 1 / 60, fixedRng);
  assert.equal(state.mode, 'sleep');
});

test('come runs to the middle of the floor', () => {
  const pet = { ...createPet(world(), 100) };
  const { state } = petEvent(pet, 'come', world());
  assert.equal(state.mode, 'walk');
  assert.equal(state.plan.at(-1).x, 960);
});

test('the puppy chases a mouse along the floor', () => {
  const mouse = { ...spawnFriend('mouse', STAGE, 1020, () => 0.9), x: 1500, dir: -1 };
  const { state } = run(createPet(world(), 300), world({ friends: [mouse] }), 4);
  assert.ok(state.x > 1400, `pet at ${state.x}`);
});

test('deleting the ledge under the puppy makes it drop to the floor', () => {
  const onFrame = { ...createPet(world(), 400), ledgeId: 'frame', y: 700 };
  const { state } = run(onFrame, world({ ledges: [ledges[0]] }), 2);
  assert.equal(state.ledgeId, GROUND_ID);
});

test('friends cross the stage and then leave', () => {
  let friends = ['elephant', 'monkey', 'mouse', 'penguin'].map((k) => spawnFriend(k, STAGE, 1020, () => 0.1));
  assert.ok(friends.every((f) => f.dir === 1));
  for (let i = 0; i < 60 * 40; i += 1) friends = stepFriends(friends, 1 / 60, STAGE, () => 0.5);
  assert.equal(friends.length, 0);
  assert.equal(spawnFriend('dragon', STAGE, 1020), null);
});

test('food dropped mid-wander interrupts the stroll right away', () => {
  const strolling = { ...createPet(world(), 1500), mode: 'walk', modeT: 1, plan: [{ kind: 'walk', x: 1900, speed: PET.walkSpeed }] };
  const apple = { ...spawnFruit('apple', 200), y: 1020, resting: true, ledgeId: GROUND_ID };
  const { state } = updatePet(strolling, world({ fruits: [apple] }), 1 / 60, fixedRng);
  assert.equal(state.target, apple.id);
  assert.ok(state.plan.at(-1).kind === 'eat');
});

test('a puppy on a high ledge hops down to follow a visiting friend', () => {
  const island = makeLedge('island', { x: 800, y: 200 }, { x: 1000, y: 200 });
  const w = world({ ledges: [ledges[0], island], friends: [{ ...spawnFriend('elephant', STAGE, 1020, () => 0.1), x: 300 }] });
  const pet = { ...createPet(w, 900), ledgeId: 'island', y: 200, modeT: 1 };
  const { state } = run(pet, w, 3);
  assert.equal(state.ledgeId, GROUND_ID);
});

test('hop start plays a boing', () => {
  const pet = createPet(world(), 400);
  const steps = routeTo(pet, world(), 'frame', 500);
  let s = { ...pet, plan: steps.slice(1), mode: 'idle' };
  s = { ...s, x: steps[0].x };
  const started = updatePet({ ...s, mode: 'walk', plan: [{ kind: 'walk', x: s.x, speed: 1 }, ...steps.slice(1)] }, world(), 1 / 60, fixedRng);
  const first = updatePet(started.state, world(), 1 / 60, fixedRng);
  assert.equal(started.state.mode, 'hop');
  assert.ok(first.effects.some((e) => e.name === 'boing'));
});

test('a falling fruit is not eaten', () => {
  const falling = { ...spawnFruit('apple', 960), y: 500, resting: false, ledgeId: null };
  const pet = { ...createPet(world(), 960), mode: 'walk', target: falling.id, plan: [{ kind: 'walk', x: 960, speed: 1 }, { kind: 'eat', fruitId: falling.id }] };
  const { state } = updatePet(pet, world({ fruits: [falling] }), 1 / 60, fixedRng);
  assert.notEqual(state.mode, 'eat');
});
