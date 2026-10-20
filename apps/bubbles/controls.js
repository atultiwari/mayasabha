// Keys, help text and phone buttons for Bubbles & Butterflies.

export const MODES = Object.freeze(['bubbles', 'butterflies', 'both']);
export const SURPRISE_BUTTONS = Object.freeze(['pet', 'elephant', 'penguin', 'banana']);

export const KEYS = Object.freeze({
  1: 'mode-bubbles', 2: 'mode-butterflies', 3: 'mode-both', ' ': 'big-bubble',
  '[': 'fewer', ']': 'more',
  c: 'camera', k: 'calibrate', x: 'mirror', i: 'inspect',
  e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['1 2 3', 'bubbles / butterflies / both'],
  ['Space', 'a big bubble with a surprise inside'],
  ['[ ]', 'fewer / more'],
  ['C', 'camera on/off (the mouse works as a hand too)'],
  ['K', 'calibrate: click the 4 projected dots in the camera view'],
  ['X', 'mirror (camera faces the players, not the wall)'],
  ['I', 'show what the camera sees'],
  ['E', 'edit: fit the 4 corners on the wall'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export function wallLayout(chars) {
  return {
    title: 'Bubbles & Butterflies 🫧',
    buttons: [
      { id: 'mode-bubbles', label: 'Bubbles', icon: '🫧' },
      { id: 'mode-butterflies', label: 'Butterflies', icon: '🦋' },
      { id: 'mode-both', label: 'Both', icon: '✨' },
      { id: 'big-bubble', label: 'Big bubble', icon: '🎁' },
      ...SURPRISE_BUTTONS.map((role) => ({ id: `bubble-${role}`, label: `${chars[role].label} bubble`.slice(0, 24), icon: chars[role].icon })),
      { id: 'more', label: 'More', icon: '➕' },
      { id: 'fewer', label: 'Fewer', icon: '➖' },
      { id: 'camera', label: 'Camera', icon: '📷' },
    ],
  };
}
