// Speaks short phrases in a friendly, higher voice ("Peek-a-boo!", a character's name), using the
// browser's built-in offline speech. Rate-limited so rapid events don't stack up a queue of words.

const MIN_GAP_MS = 1200;
let lastSpoken = 0;
let muted = false;

export function say(text, { force = false } = {}) {
  const now = performance.now();
  if (muted || (!force && now - lastSpoken < MIN_GAP_MS)) return;
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 1.5;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    lastSpoken = now;
  } catch (err) {
    console.warn('speech unavailable', err);
  }
}

export function setSpeechMuted(value) {
  muted = value;
}
