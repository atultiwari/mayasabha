// The Happy Birthday tune (the melody is public domain), as notes with start times, and the words of
// the line being sung at any moment. The third line sings the birthday person's name.

const BEAT = 0.5; // seconds
const F = Object.freeze({ G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784 });
const LINES = [
  [['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2]],
  [['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2]],
  [['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2]],
  [['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]],
];

/** [{ at, freq, line }] */
export const TUNE = Object.freeze((() => {
  const notes = [];
  let at = 0;
  LINES.forEach((line, i) => {
    for (const [note, beats] of line) {
      notes.push(Object.freeze({ at, freq: F[note], line: i }));
      at += beats * BEAT;
    }
  });
  return notes;
})());

const LINE_ENDS = LINES.map((_, i) => LINES.slice(0, i + 1).flat().reduce((sum, [, b]) => sum + b * BEAT, 0));

export const tuneLength = () => LINE_ENDS[LINE_ENDS.length - 1];

/** Notes starting in (from, to]. */
export function notesBetween(from, to) {
  return TUNE.filter((n) => n.at > from && n.at <= to);
}

const WORDS = {
  en: (name) => ['Happy birthday to you', 'Happy birthday to you', `Happy birthday dear ${name}`, 'Happy birthday to you'],
  hi: (name) => ['जन्मदिन मुबारक हो', 'जन्मदिन मुबारक हो', `जन्मदिन मुबारक ${name}`, 'जन्मदिन मुबारक हो'],
};

/** The line being sung at time t ('' before or after the song). */
export function lyric(t, name, lang = 'en') {
  if (t < 0 || t > tuneLength()) return '';
  const i = LINE_ENDS.findIndex((end) => t <= end);
  return (WORDS[lang] ?? WORDS.en)(name)[i];
}
