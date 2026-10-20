// Visiting friends who cross the wall once: the elephant walks and sways ("Ek Mota Hathi"),
// the monkey swings across the top in big arcs, the mouse dashes along the floor with the puppy chasing,
// the penguin waddles.
// Pure and immutable; a friend is removed once it has left the stage.

export const FRIEND_KINDS = Object.freeze({
  elephant: { size: 450, speed: 95, sound: 'trumpet', onGround: true },
  monkey: { size: 290, speed: 260, sound: 'monkey', onGround: false },
  mouse: { size: 170, speed: 360, sound: 'squeak', onGround: true },
  penguin: { size: 260, speed: 120, sound: 'honk', onGround: true },
});

let counter = 0;

/** Enters from a random side. */
export function spawnFriend(kind, stage, groundY, rng = Math.random) {
  const spec = FRIEND_KINDS[kind];
  if (!spec) return null;
  counter += 1;
  const dir = rng() < 0.5 ? 1 : -1;
  const x = dir === 1 ? -spec.size : stage.w + spec.size;
  return { id: `friend-${counter}`, kind, dir, x, y: groundY, baseY: groundY, t: 0, size: spec.size, onGround: spec.onGround, pause: 0 };
}

function stepMouse(f, dt, rng) {
  // Dart, freeze, dart again: more fun to chase.
  if (f.pause > 0) return { ...f, pause: f.pause - dt, t: f.t + dt };
  const pause = rng() < dt * 0.6 ? 0.4 + rng() * 0.6 : 0;
  return { ...f, x: f.x + f.dir * FRIEND_KINDS.mouse.speed * dt, pause, t: f.t + dt };
}

function stepMonkey(f, dt, stageHeight) {
  const t = f.t + dt;
  const swingTop = stageHeight * 0.12;
  const swingDepth = stageHeight * 0.22;
  return { ...f, t, x: f.x + f.dir * FRIEND_KINDS.monkey.speed * dt, y: swingTop + swingDepth * Math.abs(Math.sin(t * 2.2)) + f.size };
}

function stepFriend(f, dt, stage, rng) {
  if (f.kind === 'mouse') return stepMouse(f, dt, rng);
  if (f.kind === 'monkey') return stepMonkey(f, dt, stage.h);
  return { ...f, t: f.t + dt, x: f.x + f.dir * FRIEND_KINDS[f.kind].speed * dt };
}

const onStage = (f, stage) => f.x > -f.size * 1.5 && f.x < stage.w + f.size * 1.5;

export function stepFriends(friends, dt, stage, rng = Math.random) {
  return friends.map((f) => stepFriend(f, dt, stage, rng)).filter((f) => onStage(f, stage));
}
