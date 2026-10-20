// Scenes say which effects each kind of object gets. Tags: frame, door, balloon, clock, floor, other.

export const SCENES = Object.freeze({
  diwali: {
    label: { en: 'Diwali', hi: 'दीपावली' }, icon: '🪔',
    frame: ['gold-border', 'firework-window', 'diya-top'],
    door: ['warm-glow', 'greeting', 'toran'],
    balloon: ['lantern'],
    clock: ['gold-border', 'diya-center'],
    floor: ['rangoli'],
    other: ['gold-chase'],
  },
  magic: {
    label: { en: 'Magic', hi: 'जादू' }, icon: '✨',
    frame: ['aquarium', 'rainbow-chase'],
    door: ['portal'],
    balloon: ['googly-eyes'],
    clock: ['rainbow-spin'],
    floor: ['starfield'],
    other: ['rainbow-chase'],
  },
  party: {
    label: { en: 'Party', hi: 'पार्टी' }, icon: '🎉',
    frame: ['beat-fill', 'rainbow-chase'],
    door: ['beat-fill', 'confetti'],
    balloon: ['beat-fill'],
    clock: ['beat-fill'],
    floor: ['beat-fill', 'confetti'],
    other: ['beat-fill'],
  },
  align: {
    label: { en: 'Align', hi: 'मिलान' }, icon: '📐',
    frame: ['align'], door: ['align'], balloon: ['align'], clock: ['align'], floor: ['align'], other: ['align'],
  },
});

export const SCENE_ORDER = Object.freeze(['diwali', 'magic', 'party', 'align']);

export function effectsFor(scene, tag) {
  const s = SCENES[scene] ?? SCENES.align;
  return s[tag] ?? s.other ?? [];
}
