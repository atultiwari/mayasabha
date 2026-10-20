// Rocket Ride to Chanda Mama: a bilingual bedtime story through the solar system where the child is
// the hero. Each chapter needs one small action (clap, wave, pop, count) from the mic, the camera,
// the mouse or the phone, and every action also finishes by itself, so nobody can fail.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { startMic } from '../../kit/mic.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { loadCharacters, resolveCharacters } from '../../kit/characters.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { spawnFx, stepFx, drawFx } from '../../kit/fx.js';
import { createVision } from '../../kit/vision/vision.js';
import { trackHands } from '../../kit/vision/hand-tracker.js';
import { popTouched } from '../bubbles/bubbles.js';
import { NUMBERS, STORY } from './story-data.js';
import { currentStep, startStory, storyEvent, updateStory } from './story.js';
import { drawStory } from './scenes.js';
import { HELP_KEYS, KEYS, rocketLayout } from './controls.js';

const KEY = 'rocket-ride';
const ART = ['rocket', 'astronaut', 'moon-face', 'earth-asia', 'robot', 'sunglasses', 'sun', 'ringed-planet', 'bed'];
const STORM_COUNT = 4;
const WAVE_PER_PIXEL = 1 / 4500; // mouse travel needed to "wave" the dust away
const FAST_HAND = 300; // px/s: a hand moving faster than this is waving
const rand = (seed) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

const stage = createStage({ key: KEY });
const hud = createHud({ title: 'Rocket Ride 🚀', keys: HELP_KEYS, footer: 'Space to start. Lie back and enjoy the ride!' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const vision = createVision({ stage, key: KEY, hud });

// ---- state (replaced, never mutated) -------------------------------------------------------------
const prefs = loadJson(`${KEY}:prefs`) ?? {};
let lang = prefs.lang === 'hi' ? 'hi' : 'en';
let childName = typeof prefs.name === 'string' ? prefs.name.slice(0, 30) : '';
let chars = resolveCharacters({});
let art = {};
let story = null;
let caption = '';
let big = null; // { text, age }
let particles = [];
let storms = [];
let moonFx = { jumps: [], footprints: [] };
let tracks = [];
let mouse = null;
let mic = null;
let lastChapter = -1;
const r = rand(7);
const stars = Array.from({ length: 140 }, () => ({ x: r(), y: r(), size: r(), phase: r() * 6 }));
const dust = Array.from({ length: 90 }, () => ({ x: r() * 1.2, y: r(), r: 6 + r() * 26, speed: 0.05 + r() * 0.12 }));

const ctxFor = () => ({ lang, name: childName, pilot: chars.pet.label });
const persist = () => saveJson(`${KEY}:prefs`, { lang, name: childName });

// ---- story effects ------------------------------------------------------------------------------------
function applyEffects(effects) {
  for (const e of effects) {
    if (e.type === 'say' || e.type === 'praise') {
      caption = e.text;
      say(e.text, { queue: true, lang });
    }
    if (e.type === 'praise') particles = [...particles, ...spawnFx('sparkle', stage.size.w / 2, stage.size.h * 0.4), ...spawnFx('hearts', stage.size.w / 2, stage.size.h * 0.45)];
    if (e.type === 'sound') sound.play(e.name);
    if (e.type === 'count') countEffect(e.n);
  }
}

function countEffect(n) {
  const chapter = STORY[story.state.chapter].id;
  const step = currentStep(story.state);
  if (chapter === 'launch') {
    const left = step.needed - n + 1; // countdown: 3, 2, 1
    big = { text: String(left), age: 0 };
    say(NUMBERS[lang][left - 1], { queue: true, lang });
  } else if (chapter === 'saturn') {
    big = { text: String(n), age: 0 };
  } else if (chapter === 'moon') {
    moonFx = { jumps: [...moonFx.jumps, performance.now() / 1000], footprints: [...moonFx.footprints, { x: stage.size.w * 0.5 + moonFx.footprints.length * 110 }] };
  }
}

function send(ev) {
  if (!story) return;
  const result = storyEvent(story.state, ev, ctxFor());
  story = { state: result.state };
  applyEffects(result.effects);
}

function start() {
  window.speechSynthesis?.cancel();
  const result = startStory(ctxFor());
  story = { state: result.state };
  applyEffects(result.effects);
  hud.hideHelp();
}

// ---- actions -------------------------------------------------------------------------------------------
async function toggleMic() {
  if (mic) {
    mic.stop();
    mic = null;
    hud.toast('🎤 Mic off');
    return;
  }
  try {
    mic = await startMic({ onClap: () => (story ? send({ type: 'clap' }) : start()) });
    hud.toast('🎤 Mic on: real claps count!');
  } catch (err) {
    console.error('microphone failed', err);
    hud.toast(`🎤 ${err.message || 'Microphone blocked'}`, 5000);
  }
}

function popOne() {
  const [first, ...rest] = storms;
  if (!first) return;
  storms = rest;
  particles = [...particles, ...spawnFx('sparkle', first.x, first.y)];
  send({ type: 'pop' });
}

function setName() {
  const answer = window.prompt(lang === 'hi' ? 'बच्चे का नाम?' : "Your child's name? (stays in this browser)", childName);
  if (answer === null) return;
  childName = answer.trim().slice(0, 30);
  persist();
  hud.toast(childName ? `🚀 Hero: ${childName}` : '🚀 Hero: little astronaut');
}

const ACTIONS = {
  clap: () => (story && !story.state.finished ? send({ type: 'clap' }) : start()),
  wave: () => send({ type: 'help' }), pop: popOne, help: () => send({ type: 'help' }),
  'next-chapter': () => (story ? send({ type: 'next-chapter' }) : start()), 'prev-chapter': () => send({ type: 'prev-chapter' }),
  restart: start, name: setName, mic: toggleMic,
  language: () => {
    lang = lang === 'en' ? 'hi' : 'en';
    persist();
    remote.setLayout(rocketLayout(lang));
    hud.toast(lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
  },
  camera: () => vision.toggle(), calibrate: () => vision.calibrate(), inspect: () => vision.toggleDebug(),
  edit: () => editor.toggle(), fullscreen: () => stage.toggleFullscreen(), 'help-panel': () => hud.toggleHelp(),
  mute: () => {
    const muted = sound.toggleMute();
    setSpeechMuted(muted);
    hud.toast(muted ? '🔇 Muted' : '🔊 Sound on');
  },
};

function act(id) {
  sound.unlock();
  ACTIONS[id]?.();
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  sound.unlock();
  if (editor.handleKey(key)) return;
  const id = KEYS[key];
  if (!id) return;
  e.preventDefault();
  act(id);
});
window.addEventListener('pointermove', (e) => {
  if (editor.active || vision.calibrating) return;
  const p = stage.toStage({ x: e.clientX, y: e.clientY });
  const step = story && currentStep(story.state);
  if (mouse && step?.kind === 'act' && step.action === 'wave') send({ type: 'wave', amount: Math.hypot(p.x - mouse.x, p.y - mouse.y) * WAVE_PER_PIXEL });
  mouse = { ...p, idle: 0 };
});

const remote = connectRemote({ role: 'stage', layout: rocketLayout(lang), onMessage: (msg) => msg.type === 'press' && act(msg.id) });
serverInfo().then((info) => {
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Space to start. Lie back and enjoy the ride!  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
});

// ---- per-chapter extras --------------------------------------------------------------------------------
function updateStorms(dt, seen, detections) {
  const step = currentStep(story.state);
  const active = STORY[story.state.chapter].id === 'jupiter' && step.kind === 'act';
  if (!active) {
    storms = [];
    return;
  }
  // New storm bubbles appear within reach right away (no waiting for them to float up).
  const missing = STORM_COUNT - storms.length;
  const fresh = Array.from({ length: Math.max(0, missing) }, () => ({
    id: `s${Math.random()}`, x: stage.size.w * (0.08 + Math.random() * 0.5), y: stage.size.h * (0.45 + Math.random() * 0.4), r: 90 + Math.random() * 50, phase: Math.random() * 6, vy: 60 + Math.random() * 50,
  }));
  storms = [...storms, ...fresh].map((b) => ({ ...b, y: b.y < -b.r ? stage.size.h + b.r : b.y - b.vy * dt }));
  const { kept, popped } = popTouched(storms, { grid: seen.grid, hands: detections });
  storms = kept;
  popped.forEach((b) => {
    particles = [...particles, ...spawnFx('sparkle', b.x, b.y)];
    send({ type: 'pop' });
  });
}

function updateWaving(dt) {
  const step = story && currentStep(story.state);
  if (step?.kind !== 'act' || step.action !== 'wave') return;
  const waving = tracks.filter((t) => t.speed > FAST_HAND).length;
  if (waving) send({ type: 'wave', amount: waving * dt * 0.6 });
}

function chapterChanged() {
  if (story.state.chapter === lastChapter) return;
  lastChapter = story.state.chapter;
  moonFx = { jumps: [], footprints: [] };
}

// ---- view model --------------------------------------------------------------------------------------
function buildView(t) {
  const base = { size: stage.size, t, art, pilot: chars.pet, stars, lang, started: Boolean(story), caption, big, dust };
  if (!story) return base;
  const s = story.state;
  const chapter = STORY[s.chapter];
  const step = currentStep(s) ?? chapter.steps[chapter.steps.length - 1];
  const actIndex = chapter.steps.findIndex((x) => x.kind === 'act');
  const pastAct = actIndex >= 0 && s.step > actIndex;
  const progress = step.kind === 'act' ? (step.action === 'wave' ? s.wave : s.count) / step.needed : pastAct ? 1 : 0;
  const now = performance.now() / 1000;
  const jump = Math.max(0, ...moonFx.jumps.map((j) => (now - j < 1.6 ? Math.sin((Math.PI * (now - j)) / 1.6) * 320 : 0)));
  const sayDur = s.duration ?? 1;
  const goodnight = chapter.id === 'home' ? (s.step === 0 ? 0 : s.step === 1 ? Math.min(4, Math.ceil((s.t / sayDur) * 4)) : 4) : 0;
  return {
    ...base,
    chapterId: chapter.id,
    stepKind: step.kind,
    nextId: STORY[s.chapter + 1]?.id,
    travel: step.kind === 'travel' ? Math.min(1, s.t / step.seconds) : 0,
    liftoff: chapter.id === 'launch' && s.step === 3 ? Math.min(1, s.t / sayDur) : 0,
    progress,
    cleared: Math.min(1, progress),
    waving: chapter.id === 'sun' && progress > 0,
    counted: chapter.id === 'saturn' ? (pastAct ? 5 : step.kind === 'act' ? s.count : 0) : 0,
    footprints: moonFx.footprints,
    astronautX: stage.size.w * 0.5 + moonFx.footprints.length * 110,
    jump,
    storms,
    goodnightShown: goodnight,
    goodnightAsleep: chapter.id === 'home' ? (s.step >= 2 ? 4 : Math.max(0, goodnight - 1)) : 0,
    fade: s.finished ? 1 : step.kind === 'end' ? s.t / step.seconds : 0,
  };
}

// ---- loop --------------------------------------------------------------------------------------------
function update(dt, t) {
  const seen = vision.update(t * 1000);
  mouse = mouse ? { ...mouse, idle: mouse.idle + dt } : null;
  const mouseHands = mouse && mouse.idle < 2.5 ? [{ x: mouse.x, y: mouse.y }] : [];
  tracks = trackHands(tracks, [...seen.hands, ...mouseHands], dt);
  big = big ? (big.age > 1.3 ? null : { ...big, age: big.age + dt }) : null;
  particles = stepFx(particles, dt);
  if (!story) return;
  const result = updateStory(story.state, dt, ctxFor());
  story = { state: result.state };
  applyEffects(result.effects);
  chapterChanged();
  updateStorms(dt, seen, [...seen.hands, ...mouseHands]);
  updateWaving(dt);
}

async function boot() {
  try {
    const loaded = await loadCharacters();
    chars = loaded.chars;
  } catch (err) {
    console.error(err);
  }
  const load = (name) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve([name, image]);
    image.onerror = () => resolve([name, null]);
    image.src = `../../assets/noto/3d-${name}.png`;
  });
  art = Object.fromEntries(await Promise.all(ART.map(load)));
  stage.onFrame((dt, t) => {
    update(dt, t);
    drawStory(stage.ctx, buildView(t));
    drawFx(stage.ctx, particles);
    vision.drawStage(stage.ctx);
    editor.draw();
  });
}

boot();
