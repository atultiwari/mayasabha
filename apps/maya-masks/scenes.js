// Scenes say which effects each kind of object gets. Tags: frame, picture, door, shelf, balloon, clock,
// floor, other. A "picture" only ever gets effects drawn around it (never clipped inside it).

export const SCENES = Object.freeze({
  diwali: {
    label: { en: 'Diwali', hi: 'दीपावली' }, icon: '🪔',
    frame: ['gold-border', 'firework-window', 'diya-top'],
    picture: ['gold-border', 'garland', 'diya-top'],
    door: ['warm-glow', 'greeting', 'toran'],
    shelf: ['gold-border', 'diya-top'],
    balloon: ['lantern'],
    clock: ['gold-border', 'diya-center'],
    floor: ['rangoli'],
    other: ['gold-chase'],
  },
  magic: {
    label: { en: 'Magic', hi: 'जादू' }, icon: '✨',
    frame: ['aquarium', 'rainbow-chase'],
    picture: ['rainbow-chase'],
    door: ['portal'],
    shelf: ['rainbow-chase'],
    balloon: ['googly-eyes'],
    clock: ['rainbow-spin'],
    floor: ['starfield'],
    other: ['rainbow-chase'],
  },
  party: {
    label: { en: 'Party', hi: 'पार्टी' }, icon: '🎉',
    frame: ['beat-fill', 'rainbow-chase'],
    picture: ['gold-chase'],
    door: ['beat-fill', 'confetti'],
    shelf: ['rainbow-chase'],
    balloon: ['beat-fill'],
    clock: ['beat-fill'],
    floor: ['beat-fill', 'confetti'],
    other: ['beat-fill'],
  },
  align: {
    label: { en: 'Align', hi: 'मिलान' }, icon: '📐',
    frame: ['align'], picture: ['align-outline'], door: ['align'], shelf: ['align'], balloon: ['align'], clock: ['align'], floor: ['align'], other: ['align'],
  },
});

export const SCENE_ORDER = Object.freeze(['diwali', 'magic', 'party', 'align']);

export function effectsFor(scene, tag) {
  const s = SCENES[scene] ?? SCENES.align;
  return s[tag] ?? s.other ?? [];
}
