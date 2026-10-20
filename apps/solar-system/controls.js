// Keys, help text, guided tour and phone buttons for Antariksh (the solar system).
import { PLANETS, SUN } from './solar-data.js';

export const PLANET_ICONS = Object.freeze({
  sun: '☀️', mercury: '⚫', venus: '🟡', earth: '🌍', moon: '🌙', mars: '🔴', jupiter: '🟠', saturn: '🪐', uranus: '🔵', neptune: '🌀',
});

export const KEYS = Object.freeze({
  s: 'go-sun', 1: 'go-mercury', 2: 'go-venus', 3: 'go-earth', 4: 'go-mars', 5: 'go-jupiter', 6: 'go-saturn', 7: 'go-uranus', 8: 'go-neptune',
  m: 'go-moon', ' ': 'overview', t: 'top', z: 'sizes', a: 'tour',
  l: 'language', n: 'names', o: 'orbits', '[': 'slower', ']': 'faster', p: 'pause',
  e: 'edit', f: 'fullscreen', h: 'help', v: 'mute', d: 'tour',
});

export const HELP_KEYS = Object.freeze([
  ['S 1–8 M', 'fly to the Sun, a planet, or the Moon'],
  ['Space', 'whole solar system   T  straight up (ceiling)'],
  ['Z', 'true sizes compared'],
  ['A', 'guided tour with narration'],
  ['L', 'language: English / हिन्दी'],
  ['[ ] P', 'slower / faster / pause time'],
  ['N O', 'names / orbit lines'],
  ['E', 'edit: fit the 4 corners'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

/** Tour order: the Sun, then outwards, with the Moon right after Earth. */
export const TOUR = Object.freeze(['sun', ...PLANETS.flatMap((p) => (p.id === 'earth' ? ['earth', 'moon'] : [p.id]))]);
export const TOUR_STOP_S = 13;

export function solarLayout(lang) {
  const name = (body) => body.name[lang];
  const moon = PLANETS.find((p) => p.id === 'earth').moons[0];
  return {
    title: lang === 'hi' ? 'अंतरिक्ष 🪐' : 'Antariksh 🪐',
    buttons: [
      { id: 'go-sun', label: name(SUN), icon: PLANET_ICONS.sun },
      ...PLANETS.map((p) => ({ id: `go-${p.id}`, label: name(p), icon: PLANET_ICONS[p.id] })),
      { id: 'go-moon', label: name(moon), icon: PLANET_ICONS.moon },
      { id: 'overview', label: lang === 'hi' ? 'सब ग्रह' : 'All planets', icon: '🌌' },
      { id: 'sizes', label: lang === 'hi' ? 'आकार' : 'Sizes', icon: '📏' },
      { id: 'tour', label: lang === 'hi' ? 'यात्रा' : 'Tour', icon: '🚀' },
      { id: 'language', label: lang === 'hi' ? 'English' : 'हिन्दी', icon: '🔤' },
      { id: 'slower', label: lang === 'hi' ? 'धीमा' : 'Slower', icon: '🐢' },
      { id: 'faster', label: lang === 'hi' ? 'तेज़' : 'Faster', icon: '🐇' },
    ],
  };
}
