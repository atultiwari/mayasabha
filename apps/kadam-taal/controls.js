// Keys, help text and phone buttons for Kadam Taal.

export const MODES = Object.freeze(['kid', 'grown']);
export const MODE_LABEL = Object.freeze({ kid: 'Little feet 👣', grown: 'Grown-ups 🔥' });

export const KEYS = Object.freeze({
  1: 'lane-0', 2: 'lane-1', 3: 'lane-2', 4: 'lane-3',
  arrowleft: 'lane-0', arrowdown: 'lane-1', arrowup: 'lane-2', arrowright: 'lane-3',
  m: 'mode', ' ': 'start', r: 'restart',
  c: 'camera', k: 'calibrate', x: 'mirror', i: 'inspect',
  o: 'turn', e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['M', 'little feet (2–3 years) / grown-ups'],
  ['Space', 'start / pause (grown-ups)   R restart'],
  ['1 2 3 4 or ← ↓ ↑ →', 'step on a pad (or click / tap it)'],
  ['C', 'camera: real feet step on the pads'],
  ['K', 'calibrate camera to the projection   X mirror   I show what it sees'],
  ['O', 'turn picture around (pads at the end where you stand)'],
  ['E', 'edit: fit the 4 corners on the floor'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

const PAD_ICONS = ['🔴', '🟡', '🟢', '🔵'];

/** Phone buttons: one per pad, plus start and mode. */
export function padLayout(lanes) {
  return {
    title: 'Kadam Taal 👣',
    buttons: [
      ...Array.from({ length: lanes }, (_, i) => ({ id: `lane-${i}`, label: `Pad ${i + 1}`, icon: PAD_ICONS[i] })),
      { id: 'start', label: 'Start / pause', icon: '▶️' },
      { id: 'mode', label: 'Little / grown-up', icon: '🔁' },
      { id: 'restart', label: 'Restart', icon: '🔄' },
    ],
  };
}
