// Keys, help text and phone buttons for Cushion Physics.

export const COLOR_ORDER = Object.freeze(['red', 'pink', 'orange', 'yellow', 'green', 'blue']);

export const KEYS = Object.freeze({
  1: 'mode-feed', 2: 'mode-marbles', ' ': 'drop', arrowleft: 'goal-left', arrowright: 'goal-right', r: 'clear',
  c: 'camera', k: 'calibrate', x: 'mirror', o: 'colour', i: 'inspect', w: 'surface',
  e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['1 2', 'Feed Hathi (fruit) / Marbles (music)'],
  ['Space', 'drop one more   R clear'],
  ['← →', 'move Hathi along the bottom'],
  ['C', 'camera: real red cushions become solid! (no camera: drag the red pillows)'],
  ['K', 'calibrate camera to the projection   X mirror'],
  ['O', 'cushion colour: red / pink / orange / yellow / green / blue'],
  ['W', 'floor / wall mode (wall: frames and shelves from the Room Map are solid too)'],
  ['I', 'show what the camera sees'],
  ['E', 'fit the 4 corners   F fullscreen   V mute   H hide'],
]);

export function cushionLayout(goalLabel) {
  return {
    title: 'Cushion Physics 🛋️',
    buttons: [
      { id: 'mode-feed', label: `Feed ${goalLabel}`.slice(0, 24), icon: '🍌' },
      { id: 'mode-marbles', label: 'Marbles', icon: '🎵' },
      { id: 'drop', label: 'Drop!', icon: '⬇️' },
      { id: 'goal-left', label: 'Move left', icon: '⬅️' },
      { id: 'goal-right', label: 'Move right', icon: '➡️' },
      { id: 'clear', label: 'Clear', icon: '🧹' },
      { id: 'camera', label: 'Camera', icon: '📷' },
      { id: 'colour', label: 'Colour', icon: '🎨' },
      { id: 'surface', label: 'Floor / Wall', icon: '🧱' },
    ],
  };
}
