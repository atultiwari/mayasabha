// Keys, help text and phone buttons for the rocket story.

export const KEYS = Object.freeze({
  ' ': 'clap', w: 'wave', b: 'pop', enter: 'help',
  arrowright: 'next-chapter', arrowleft: 'prev-chapter', r: 'restart',
  n: 'name', l: 'language', m: 'mic', c: 'camera', k: 'calibrate', i: 'inspect',
  e: 'edit', f: 'fullscreen', h: 'help-panel', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['Space', 'start / clap (or turn on the mic with M and really clap!)'],
  ['W  B', 'wave / pop a storm bubble (or move the mouse, or use the camera: C)'],
  ['Enter', 'help the little one finish the step'],
  ['← →', 'previous / next chapter   R restart'],
  ['N', "set your child's name (kept only in this browser)"],
  ['L', 'language: English / हिन्दी'],
  ['E', 'edit: fit the 4 corners on the wall or ceiling'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export function rocketLayout(lang) {
  const hi = lang === 'hi';
  return {
    title: hi ? 'रॉकेट की सैर 🚀' : 'Rocket Ride 🚀',
    buttons: [
      { id: 'clap', label: hi ? 'ताली / शुरू' : 'Clap / Start', icon: '👏' },
      { id: 'wave', label: hi ? 'हाथ हिलाओ' : 'Wave', icon: '👋' },
      { id: 'pop', label: hi ? 'फोड़ो' : 'Pop', icon: '🫧' },
      { id: 'help', label: hi ? 'मदद' : 'Help', icon: '🙋' },
      { id: 'prev-chapter', label: hi ? 'पीछे' : 'Back', icon: '⏮' },
      { id: 'next-chapter', label: hi ? 'आगे' : 'Next', icon: '⏭' },
      { id: 'restart', label: hi ? 'फिर से' : 'Restart', icon: '🔁' },
      { id: 'language', label: hi ? 'English' : 'हिन्दी', icon: '🔤' },
      { id: 'mic', label: hi ? 'माइक' : 'Mic', icon: '🎤' },
    ],
  };
}
