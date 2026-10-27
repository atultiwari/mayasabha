// Keys, help text, phone buttons and the words for Janamdin.

export const KEYS = Object.freeze({
  ' ': 'start', b: 'blow', m: 'mic', l: 'language', s: 'song',
  e: 'edit', f: 'fullscreen', h: 'help', v: 'mute',
});

export const HELP_KEYS = Object.freeze([
  ['Space', 'start the birthday show (again)'],
  ['M', 'microphone: blow out the candles for real'],
  ['B', 'blow the candles out (if the breath is too small)'],
  ['S', 'sing the song again   L English / हिन्दी'],
  ['?name=…&candles=…&sign=…', 'in the address: whose birthday, how many candles, the sign'],
  ['E', 'edit: fit the 4 corners on the wall'],
  ['F', 'fullscreen   V mute   H hide this'],
]);

export const LAYOUT = Object.freeze({
  title: 'Happy Birthday 🎂',
  buttons: [
    { id: 'start', label: 'Start', icon: '▶️' },
    { id: 'blow', label: 'Blow!', icon: '🌬️' },
    { id: 'song', label: 'Sing again', icon: '🎵' },
    { id: 'mic', label: 'Mic', icon: '🎤' },
  ],
});

export const WORDS = Object.freeze({
  en: { name: 'Dadu', sign: (n) => `Love you, ${n}! ❤️`, blow: '🌬️ Make a wish… and blow!' },
  hi: { name: 'दादू', sign: (n) => `${n}, बहुत सारा प्यार! ❤️`, blow: '🌬️ कुछ माँगो… और फूँक मारो!' },
});
