// The puppy's behaviour as a pure state machine: updatePet(state, world, dt, rng) and
// petEvent(state, name, world) return a NEW state plus a list of effects (sounds, particles, eating)
// for main.js to carry out. No DOM here, so it is unit-tested.
import { GROUND_ID, clampToLedge, findRoute, ledgeBelow, planHop, yAt } from '../../kit/ledges.js';

export const PET = Object.freeze({
  walkSpeed: 230, runSpeed: 430, idleMin: 1.5, idleMax: 4.5, sleepAfter: 50,
  happyDur: 1.3, eatDur: 2.4, sitDur: 4, barkDur: 0.6, followGap: 320, chaseGap: 110,
});
const BITES_AT = [0.4, 1.1, 1.8];
const ATTENTION_DELAY = 0.15; // s; stops re-planning every single frame

/** @typedef {{ kind: 'walk', x: number, speed: number } | { kind: 'hop', to: string, landing: {x:number,y:number} } | { kind: 'eat', fruitId: string }} Step */
/** @typedef {{ mode: string, x: number, y: number, ledgeId: string, facing: number, modeT: number, plan: Step[],
 *   hop: object|null, idleFor: number, nextDecision: number, stride: number, target: string|null }} PetState */

const byId = (world, id) => world.ledges.find((l) => l.id === id);
const ground = (world) => byId(world, GROUND_ID);

/** @returns {PetState} */
export function createPet(world, x) {
  const g = ground(world);
  return { mode: 'idle', x, y: yAt(g, x), ledgeId: GROUND_ID, facing: 1, modeT: 0, plan: [], hop: null,
    idleFor: 0, nextDecision: 1, stride: 0, target: null };
}

const enter = (state, mode, extra = {}) => ({ ...state, mode, modeT: 0, ...extra });

/** Walk/hop steps from the pet's position to x on ledge `toId`, or null if it can't get there. */
export function routeTo(state, world, toId, x, speed = PET.walkSpeed) {
  const route = findRoute(world.ledges, state.ledgeId, toId, state.x);
  if (!route) return null;
  const steps = [];
  let atX = state.x;
  for (let i = 1; i < route.length; i += 1) {
    const hop = planHop(byId(world, route[i - 1]), byId(world, route[i]), atX);
    steps.push({ kind: 'walk', x: hop.takeoff.x, speed }, { kind: 'hop', to: route[i], landing: hop.landing });
    atX = hop.landing.x;
  }
  steps.push({ kind: 'walk', x: clampToLedge(byId(world, toId), x, 30), speed });
  return steps;
}

/** Starts the first step of the plan, or goes idle when the plan is empty. */
function advance(state, world, rng) {
  const [step, ...rest] = state.plan;
  if (!step) return enter(state, 'idle', { plan: [], target: null, nextDecision: PET.idleMin + rng() * (PET.idleMax - PET.idleMin) });
  if (step.kind === 'walk') return enter(state, 'walk');
  if (step.kind === 'eat') {
    const fruit = world.fruits.find((f) => f.id === step.fruitId);
    return fruit?.resting ? enter(state, 'eat', { facing: fruit.x >= state.x ? 1 : -1 }) : advance({ ...state, plan: rest }, world, rng);
  }
  const from = { x: state.x, y: state.y };
  const dist = Math.hypot(step.landing.x - from.x, step.landing.y - from.y);
  const hop = { from, to: step.landing, ledgeId: step.to, dur: 0.45 + dist / 1600, arc: Math.max(90, from.y - step.landing.y + 110) };
  return enter(state, 'hop', { hop, facing: step.landing.x >= from.x ? 1 : -1 });
}

function withPlan(state, world, steps, rng, target = null) {
  return steps ? advance({ ...state, plan: steps, target }, world, rng) : state;
}

// ---- per-mode updates -----------------------------------------------------------------------

function updateWalk(state, world, dt, rng) {
  const step = state.plan[0];
  const ledge = byId(world, state.ledgeId);
  const dx = step.x - state.x;
  const move = Math.min(Math.abs(dx), step.speed * dt);
  const x = state.x + Math.sign(dx) * move;
  const next = { ...state, x, y: yAt(ledge, x), facing: dx === 0 ? state.facing : Math.sign(dx), stride: state.stride + move };
  return { state: Math.abs(step.x - x) < 0.5 ? advance({ ...next, plan: state.plan.slice(1) }, world, rng) : next, effects: [] };
}

function updateHop(state, world, rng, prevT) {
  const { hop } = state;
  const t = Math.min(1, state.modeT / hop.dur);
  const x = hop.from.x + (hop.to.x - hop.from.x) * t;
  const y = hop.from.y + (hop.to.y - hop.from.y) * t - Math.sin(Math.PI * t) * hop.arc;
  if (t < 1) return { state: { ...state, x, y }, effects: prevT === 0 ? [{ type: 'sound', name: 'boing' }] : [] };
  const landed = { ...state, x: hop.to.x, y: hop.to.y, ledgeId: hop.ledgeId, hop: null, plan: state.plan.slice(1) };
  const effects = [{ type: 'sound', name: 'land' }, { type: 'fx', name: 'dust', x: hop.to.x, y: hop.to.y }];
  return { state: advance(landed, world, rng), effects };
}

function updateEat(state, world, rng, prevT) {
  const fruitId = state.plan[0].fruitId;
  const effects = BITES_AT.filter((b) => prevT < b && state.modeT >= b).flatMap(() => [
    { type: 'bite', fruitId }, { type: 'sound', name: 'crunch' }, { type: 'fx', name: 'crumbs', x: state.x + state.facing * 60, y: state.y - 30, fruitId },
  ]);
  if (state.modeT < PET.eatDur) return { state, effects };
  const done = enter({ ...state, plan: [], target: null }, 'happy');
  return { state: done, effects: [...effects, { type: 'eat', fruitId }, { type: 'sound', name: 'yip' }, { type: 'fx', name: 'hearts', x: state.x, y: state.y }] };
}

function updateTimed(state, world, rng, duration) {
  return { state: state.modeT >= duration ? advance({ ...state, plan: [] }, world, rng) : state, effects: [] };
}

// ---- decisions ---------------------------------------------------------------------------------

function nearestFruit(state, world) {
  const resting = world.fruits.filter((f) => f.resting && f.ledgeId && findRoute(world.ledges, state.ledgeId, f.ledgeId, state.x));
  return resting.sort((a, b) => Math.hypot(a.x - state.x, a.y - state.y) - Math.hypot(b.x - state.x, b.y - state.y))[0];
}

function goEat(state, world, rng) {
  const fruit = nearestFruit(state, world);
  if (!fruit) return null;
  const standX = fruit.x - Math.sign(fruit.x - state.x || 1) * 70;
  const steps = routeTo(state, world, fruit.ledgeId, standX, PET.runSpeed);
  return steps ? withPlan(state, world, [...steps, { kind: 'eat', fruitId: fruit.id }], rng, fruit.id) : null;
}

/** Follow a visiting friend along the ground (chase the mouse, walk beside the elephant). */
function goFollow(state, world, rng) {
  const friend = world.friends.find((f) => f.onGround);
  if (!friend) return null;
  const chase = friend.kind === 'mouse';
  const gap = chase ? PET.chaseGap : PET.followGap;
  const x = friend.x - friend.dir * gap;
  if (state.ledgeId === GROUND_ID && Math.abs(x - state.x) < 20) {
    return enter(state, 'idle', { facing: friend.x >= state.x ? 1 : -1, nextDecision: 0.15 });
  }
  const steps = routeTo(state, world, GROUND_ID, x, chase ? PET.runSpeed : PET.walkSpeed);
  return steps ? withPlan(state, world, steps, rng) : null; // unreachable friend: carry on as before
}

function wander(state, world, rng) {
  const roll = rng();
  if (roll < 0.2) return enter(state, 'sit');
  if (roll < 0.5) {
    const others = world.ledges.filter((l) => l.id !== state.ledgeId);
    const pick = others[Math.floor(rng() * others.length)];
    const steps = pick && routeTo(state, world, pick.id, pick.a.x + rng() * (pick.b.x - pick.a.x));
    if (steps) return withPlan(state, world, steps, rng);
  }
  const ledge = byId(world, state.ledgeId);
  const x = ledge.a.x + rng() * (ledge.b.x - ledge.a.x);
  return withPlan(state, world, [{ kind: 'walk', x: clampToLedge(ledge, x, 40), speed: PET.walkSpeed }], rng);
}

function decide(state, world, rng) {
  const fed = goEat(state, world, rng);
  if (fed) return fed;
  const followed = goFollow(state, world, rng);
  if (followed) return followed;
  if (state.idleFor > PET.sleepAfter) return enter(state, 'sleep');
  return wander(state, world, rng);
}

/** Food it can reach, or a visitor on the floor, wakes a sleeping or idling puppy. */
function needsAttention(state, world) {
  if (world.friends.some((f) => f.onGround) && findRoute(world.ledges, state.ledgeId, GROUND_ID, state.x)) return true;
  return world.fruits.some((f) => f.resting && f.ledgeId && findRoute(world.ledges, state.ledgeId, f.ledgeId, state.x));
}

/** If the ledge under the pet was deleted in edit mode, drop to whatever is below. */
function checkFooting(state, world, rng) {
  if (state.mode === 'hop') return state;
  const ledge = byId(world, state.ledgeId);
  if (ledge) return { ...state, y: yAt(ledge, state.x) }; // follows the floor line if it is moved
  const below = ledgeBelow(world.ledges, { x: state.x, y: state.y }) ?? ground(world);
  const landing = { x: clampToLedge(below, state.x), y: yAt(below, clampToLedge(below, state.x)) };
  return advance({ ...state, plan: [{ kind: 'hop', to: below.id, landing }] }, world, rng);
}

/** Advances the pet by dt seconds. @returns {{ state: PetState, effects: object[] }} */
export function updatePet(prev, world, dt, rng = Math.random) {
  const footed = checkFooting(prev, world, rng);
  const state = { ...footed, modeT: footed.modeT + dt, idleFor: footed.idleFor + dt };
  const wantsAttention = needsAttention(state, world) && state.modeT > ATTENTION_DELAY;
  switch (state.mode) {
    // A plain stroll (no target) is dropped as soon as there is food or a visitor.
    case 'walk': return !state.target && wantsAttention ? { state: decide(state, world, rng), effects: [] } : updateWalk(state, world, dt, rng);
    case 'hop': return updateHop(state, world, rng, footed.modeT);
    case 'eat': return updateEat(state, world, rng, footed.modeT);
    case 'happy': return updateTimed(state, world, rng, PET.happyDur);
    case 'bark': return updateTimed(state, world, rng, PET.barkDur);
    case 'sit': return wantsAttention ? { state: decide(state, world, rng), effects: [] } : updateTimed(state, world, rng, PET.sitDur);
    case 'sleep': return needsAttention(state, world) ? { state: enter(state, 'happy', { idleFor: 0 }), effects: [{ type: 'sound', name: 'yip' }] } : { state, effects: [] };
    default:
      return { state: state.modeT >= state.nextDecision || wantsAttention ? decide(state, world, rng) : state, effects: [] };
  }
}

/** Reacts to a clap, a remote button or a key. @returns {{ state: PetState, effects: object[] }} */
export function petEvent(prev, name, world, rng = Math.random) {
  const state = { ...prev, idleFor: 0 };
  if (state.mode === 'hop' || state.mode === 'eat') return { state, effects: [] };
  const hearts = { type: 'fx', name: 'hearts', x: state.x, y: state.y };
  switch (name) {
    case 'happy':
      return { state: enter({ ...state, plan: [] }, 'happy'), effects: [{ type: 'sound', name: 'yip' }, hearts] };
    case 'bark':
      return { state: enter({ ...state, plan: [] }, 'bark'), effects: [{ type: 'sound', name: 'woof' }] };
    case 'sit':
      return { state: enter({ ...state, plan: [] }, 'sit'), effects: [] };
    case 'sleep':
      return { state: enter({ ...state, plan: [], idleFor: PET.sleepAfter }, 'sleep'), effects: [{ type: 'sound', name: 'snore' }] };
    case 'come': {
      const steps = routeTo(state, world, GROUND_ID, world.width / 2, PET.runSpeed);
      return { state: withPlan(state, world, steps, rng), effects: [{ type: 'sound', name: 'yip' }] };
    }
    default:
      return { state, effects: [] };
  }
}
