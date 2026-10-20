// Keyboard keys, help text and the demo script. Phone buttons come from characters.js (remoteLayout).

/** Keyboard → action id. Edit-mode keys (G, R) are handled by the editor first. */
export const KEYS = Object.freeze({
  1: 'banana', 2: 'apple', 3: 'orange', 4: 'elephant', 5: 'monkey', 6: 'mouse', 7: 'penguin',
  ' ': 'happy', c: 'come', b: 'bark', s: 'sit', z: 'sleep',
  e: 'edit', l: 'ledges', f: 'fullscreen', h: 'help', m: 'mic', v: 'mute', d: 'demo', '[': 'smaller', ']': 'bigger',
});

export const HELP_KEYS = Object.freeze([
  ['1 2 3', 'drop banana / apple / orange'],
  ['4 5 6 7', 'visitors: elephant / monkey / mouse / penguin'],
  ['Space', 'jump for joy   (or clap with mic on)'],
  ['C B S Z', 'come / woof / sit / sleep'],
  ['M', 'microphone on/off (clap to make it jump)'],
  ['E', 'edit: fit corners + draw ledges on frames'],
  ['L', 'show ledges   [ ] puppy size'],
  ['D', 'demo sequence for filming'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

/** Timed script for filming a Reel: [seconds, action]. */
export const DEMO_SCRIPT = Object.freeze([
  [0, 'come'], [2.5, 'banana'], [8, 'happy'], [10, 'elephant'], [17, 'apple'],
  [23, 'mouse'], [29, 'orange'], [35, 'monkey'], [41, 'penguin'], [48, 'happy'], [51, 'sleep'],
]);
