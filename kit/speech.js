// Speaks short phrases in a friendly, higher voice ("Peek-a-boo!", a character's name), using the
// browser's built-in offline speech. Rate-limited so rapid events don't stack up a queue of words.
// Off by default in every activity: the family switches it on from the homepage (saved per browser).
import { loadJson, saveJson } from './storage.js';

export const VOICE_KEY = 'voice';

/** Spoken words are on only when explicitly switched on. */
export const voiceOn = (stored) => stored === true;

let enabled = null; // read lazily, so this module also loads outside a browser (tests)
const isEnabled = () => (enabled ??= voiceOn(loadJson(VOICE_KEY)));

/** Homepage switch: turns spoken words on or off for all activities in this browser. */
export function setVoiceOn(value) {
  enabled = value === true;
  saveJson(VOICE_KEY, enabled);
  if (!enabled) window.speechSynthesis?.cancel();
}

export const isVoiceOn = () => isEnabled();

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
  if (muted || !isEnabled() || (!force && !queue && now - lastSpoken < MIN_GAP_MS)) return;
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
