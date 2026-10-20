// Keys, help text, phone buttons and the demo script for the Ceiling Window.

export const PEEKERS = Object.freeze(['pet', 'elephant', 'penguin', 'monkey', 'mouse']);

export const KEYS = Object.freeze({
  1: 'scene-sky', 2: 'scene-water', 3: 'scene-night', 4: 'scene-peekaboo',
  p: 'peek', ' ': 'peek', n: 'bedtime',
  arrowleft: 'view-left', arrowright: 'view-right', arrowup: 'view-up', arrowdown: 'view-down',
  '[': 'shallower', ']': 'deeper',
  o: 'turn', e: 'edit', f: 'fullscreen', h: 'help', v: 'mute', d: 'demo',
});

export const HELP_KEYS = Object.freeze([
  ['1 2 3 4', 'sky / aquarium / starry night / peek-a-boo'],
  ['P or Space', 'someone peeks in!'],
  ['N', 'bedtime: night sky that fades to black (10 min)'],
  ['← → ↑ ↓', 'aim the depth at where your child lies'],
  ['[ ]', 'hole shallower / deeper'],
  ['O', 'turn picture around (faces upright for the viewer)'],
  ['E', 'edit: fit the 4 corners on the ceiling'],
  ['D', 'demo for filming'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

/** Phone buttons; peek buttons use the names of whoever plays each role. */
export function ceilingLayout(chars) {
  return {
    title: 'Ceiling Window 🪟',
    buttons: [
      { id: 'scene-sky', label: 'Sky', icon: '☁️' },
      { id: 'scene-water', label: 'Sea', icon: '🐠' },
      { id: 'scene-night', label: 'Stars', icon: '🌙' },
      { id: 'scene-peekaboo', label: 'Peek-a-boo', icon: '🙈' },
      ...PEEKERS.map((role) => ({ id: `peek-${role}`, label: chars[role].label, icon: chars[role].icon })),
      { id: 'bedtime', label: 'Bedtime', icon: '😴' },
      { id: 'demo', label: 'Demo', icon: '🎬' },
    ],
  };
}

/** [seconds, action] for filming. */
export const DEMO_SCRIPT = Object.freeze([
  [0, 'scene-sky'], [4, 'peek-pet'], [10, 'peek-elephant'], [16, 'scene-water'], [21, 'peek-penguin'],
  [28, 'scene-night'], [33, 'peek-monkey'], [40, 'scene-peekaboo'],
]);
