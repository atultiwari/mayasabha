// Keys, help text, phone buttons and sound cues for Roshandaan.
import { phaseStart } from './timeline.js';

export const KEYS = Object.freeze({
  ' ': 'start', n: 'skip', r: 'reset', a: 'auto', 1: 'jump-shaft', 2: 'jump-hands',
  f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['Space', 'start (the light flickers, dies, and breaks open)'],
  ['N', 'skip to the next part   R stop'],
  ['1 2', 'jump to the shaft / the hands'],
  ['A', 'repeat on its own'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export const LAYOUT = Object.freeze({
  title: 'Roshandaan 👻',
  buttons: [
    { id: 'start', label: 'Start', icon: '▶️' },
    { id: 'skip', label: 'Next part', icon: '⏭️' },
    { id: 'jump-hands', label: 'The hands', icon: '🖐️' },
    { id: 'auto', label: 'Repeat', icon: '🔁' },
    { id: 'reset', label: 'Stop', icon: '⏹️' },
  ],
});

const every = (from, gap, count, sound) => Array.from({ length: count }, (_, i) => ({ at: from + i * gap, sound }));

export const CUES = Object.freeze([
  ...every(phaseStart('flicker'), 0.45, 6, 'crackle'),
  { at: phaseStart('dark'), sound: 'rumble' },
  { at: phaseStart('dark') + 0.6, sound: 'land' },
  ...every(phaseStart('crack'), 0.7, 4, 'crackle'),
  { at: phaseStart('shatter'), sound: 'shatter' },
  { at: phaseStart('shaft'), sound: 'drone' },
  ...every(phaseStart('rise') + 0.5, 1.1, 7, 'heartbeat'),
  { at: phaseStart('grip'), sound: 'sting' },
  { at: phaseStart('lunge'), sound: 'whoosh' },
  { at: phaseStart('lunge') + 0.9, sound: 'shatter' },
].sort((a, b) => a.at - b.at));

export function cuesBetween(from, to) {
  return CUES.filter((c) => c.at > from && c.at <= to);
}
