// Keys, help text, phone buttons and the sample layout for Maya Masks.
import { makeEllipse, makePolygon, makeRect } from '../../kit/room/shapes.js';
import { SCENES, SCENE_ORDER } from './scenes.js';

export const KEYS = Object.freeze({
  1: 'scene-diwali', 2: 'scene-magic', 3: 'scene-party', 4: 'scene-align',
  ' ': 'firework', b: 'blackout', m: 'mic', t: 'trace', e: 'edit', l: 'language', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['T', 'trace your real objects (frames, door, balloons, clock, floor)'],
  ['1 2 3 4', 'Diwali / Magic / Party / Align (white shapes to line up)'],
  ['Space', 'fireworks!'],
  ['M', 'microphone: Party pulses to the music'],
  ['B', 'blackout on/off'],
  ['E', 'fit the 4 corners (whole picture)'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export function masksLayout(lang) {
  return {
    title: 'Maya Masks 🪔',
    buttons: [
      ...SCENE_ORDER.map((id) => ({ id: `scene-${id}`, label: SCENES[id].label[lang], icon: SCENES[id].icon })),
      { id: 'firework', label: lang === 'hi' ? 'आतिशबाज़ी' : 'Fireworks', icon: '🎆' },
      { id: 'blackout', label: lang === 'hi' ? 'अंधेरा' : 'Blackout', icon: '⚫' },
      { id: 'mic', label: lang === 'hi' ? 'माइक' : 'Mic', icon: '🎤' },
    ],
  };
}

/** Shown until you trace your own room: two frames, a door, a clock, balloons and a floor patch. */
export const SAMPLE_SHAPES = Object.freeze([
  makeRect('sample-frame-1', 'frame', { x: 170, y: 250 }, { x: 560, y: 640 }),
  makeRect('sample-frame-2', 'frame', { x: 1340, y: 230 }, { x: 1700, y: 560 }),
  makeRect('sample-door', 'door', { x: 760, y: 240 }, { x: 1150, y: 1000 }),
  makeEllipse('sample-clock', 'clock', { x: 1430, y: 640 }, { x: 1610, y: 820 }),
  makeEllipse('sample-balloon-1', 'balloon', { x: 1220, y: 90 }, { x: 1330, y: 230 }),
  makeEllipse('sample-balloon-2', 'balloon', { x: 1300, y: 40 }, { x: 1410, y: 180 }),
  makePolygon('sample-floor', 'floor', [{ x: 180, y: 760 }, { x: 640, y: 760 }, { x: 700, y: 1060 }, { x: 120, y: 1060 }]),
]);
