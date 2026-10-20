// Keys, help text and phone buttons for Daraar.

export const KEYS = Object.freeze({
  ' ': 'start', n: 'skip', a: 'auto', r: 'reset',
  1: 'jump-cracks', 2: 'jump-shaft', 3: 'jump-eye', 4: 'jump-hand',
  o: 'turn', e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['Space', 'start the breach (again)'],
  ['N', 'skip to the next part   R stop'],
  ['1 2 3 4', 'jump to cracks / shaft / eye / hand'],
  ['A', 'repeat on its own (for parties)'],
  ['O', 'turn picture around'],
  ['E', 'edit: fit the 4 corners on the ceiling'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export const LAYOUT = Object.freeze({
  title: 'Daraar 👁️',
  buttons: [
    { id: 'start', label: 'Start', icon: '▶️' },
    { id: 'skip', label: 'Next part', icon: '⏭️' },
    { id: 'jump-eye', label: 'The eye', icon: '👁️' },
    { id: 'jump-hand', label: 'The hand', icon: '🖐️' },
    { id: 'auto', label: 'Repeat on its own', icon: '🔁' },
    { id: 'reset', label: 'Stop', icon: '⏹️' },
  ],
});
