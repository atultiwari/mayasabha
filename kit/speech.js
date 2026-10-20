// Speaks short phrases in a friendly, higher voice ("Peek-a-boo!", a character's name), using the
// browser's built-in offline speech. Rate-limited so rapid events don't stack up a queue of words.

const MIN_GAP_MS = 1200;
let lastSpoken = 0;
let muted = false;

/** Best installed voice for a language ('en', 'hi', …), or null to use the default. */
function voiceFor(lang) {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang?.toLowerCase().startsWith(lang)) ?? null;
}

/**
 * @param {string} text
 * @param {{ force?: boolean, queue?: boolean, lang?: string }} [opts]
 *   force: interrupt whatever is being said; queue: wait for it (story narration); lang: 'en' | 'hi' …
 */
export function say(text, { force = false, queue = false, lang = null } = {}) {
  const now = performance.now();
  if (muted || (!force && !queue && now - lastSpoken < MIN_GAP_MS)) return;
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 1.5;
    u.rate = 0.9;
    if (lang) {
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      const voice = voiceFor(lang);
      if (voice) u.voice = voice;
    }
    if (force) window.speechSynthesis.cancel(); // a new narration replaces the old one
    window.speechSynthesis.speak(u);
    lastSpoken = now;
  } catch (err) {
    console.warn('speech unavailable', err);
  }
}

export function setSpeechMuted(value) {
  muted = value;
  if (value) window.speechSynthesis?.cancel();
}
