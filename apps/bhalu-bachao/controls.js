// Keys, help text, phone buttons and which sound each story moment makes, for Bhalu Bachao.

export const KEYS = Object.freeze({
  ' ': 'save', enter: 'save', r: 'restart',
  c: 'camera', m: 'mic', k: 'calibrate', x: 'mirror', i: 'inspect',
  e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['Space / Enter', 'save Bear! (or touch him, raise both arms, show red, clap)'],
  ['C', 'camera: touch Bear, hands up, or hold up a red cushion'],
  ['M', 'microphone: a real clap saves him'],
  ['K', 'calibrate the camera to the projection   X mirror   I show what it sees'],
  ['R', 'start again'],
  ['E', 'edit: fit the 4 corners on the wall'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export const LAYOUT = Object.freeze({
  title: 'Bhalu Bachao 🐻🚂',
  buttons: [
    { id: 'save', label: 'Save Bear!', icon: '🛟' },
    { id: 'mic', label: 'Clap mic', icon: '🎤' },
    { id: 'camera', label: 'Camera', icon: '📷' },
    { id: 'restart', label: 'Start again', icon: '🔄' },
  ],
});

/** Story effect -> sounds from kit/sound.js. */
export const SOUNDS = Object.freeze({
  clunk: ['land'], help: ['groan'], whistle: ['steam'], pop: ['pop'], cheer: ['chime'], choo: ['steam', 'chug'], tada: ['trumpet'],
});
