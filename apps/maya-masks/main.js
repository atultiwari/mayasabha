// Maya Masks: real projection mapping. Trace the objects in your room once (T), then every scene
// paints each object to its exact outline: Diwali frames full of fireworks with diyas on top, a
// marigold toran over the door, a rangoli on the floor, glowing lanterns… or Magic, or Party.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { startMic } from '../../kit/mic.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { loadCharacters, resolveCharacters } from '../../kit/characters.js';
import { sanitizeShapes, bbox } from './shapes.js';
import { SCENES, effectsFor } from './scenes.js';
import { spawnBurst, stepBursts } from './fireworks.js';
import { paintEffect } from './effects.js';
import { createTracer } from './tracer.js';
import { HELP_KEYS, KEYS, SAMPLE_SHAPES, masksLayout } from './controls.js';

const KEY = 'maya-masks';
const ART = ['diya', 'lantern', 'fish', 'tropical-fish', 'blowfish'];
const AUTO_BURST_S = [1.2, 2.6];
const SHOW_BURSTS = 3;

const stage = createStage({ key: KEY });
const hud = createHud({ title: 'Maya Masks 🪔', keys: HELP_KEYS, footer: 'Press T to trace the objects in your room.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });

// ---- state (replaced, never mutated) ----------------------------------------------------------
const prefs = loadJson(`${KEY}:prefs`) ?? {};
let shapes = sanitizeShapes(loadJson(`${KEY}:shapes`));
let lang = prefs.lang === 'hi' ? 'hi' : 'en';
let scene = SCENES[prefs.scene] ? prefs.scene : 'diwali';
let sceneT = 0;
let bursts = [];
let nextBurst = 1;
let blackout = false;
let level = 0;
let mic = null;
let pointer = null;
let art = {};
let chars = resolveCharacters({});

const usingSample = () => shapes.length === 0;
const visibleShapes = () => (usingSample() ? SAMPLE_SHAPES : shapes);
const persistPrefs = () => saveJson(`${KEY}:prefs`, { lang, scene });

const tracer = createTracer({
  stage,
  getShapes: () => shapes,
  setShapes: (next) => {
    shapes = next;
    saveJson(`${KEY}:shapes`, shapes);
  },
  onToast: (msg) => hud.toast(msg),
});

// ---- actions --------------------------------------------------------------------------------------
function setScene(next) {
  scene = next;
  sceneT = 0;
  bursts = [];
  blackout = false;
  persistPrefs();
  sound.play('chime');
  hud.toast(`${SCENES[next].icon} ${SCENES[next].label[lang]}`);
}

function burstIn(shape, size = 46) {
  const b = bbox(shape);
  const center = { x: b.x + b.w * (0.25 + Math.random() * 0.5), y: b.y + b.h * (0.25 + Math.random() * 0.4) };
  bursts = [...bursts, { ...spawnBurst(center, size), shapeId: shape.id }];
}

/** Fireworks in every frame, a few times in a row. */
function fireworkShow() {
  if (scene !== 'diwali') setScene('diwali');
  const frames = visibleShapes().filter((s) => effectsFor(scene, s.tag).includes('firework-window'));
  for (let k = 0; k < SHOW_BURSTS; k += 1) {
    setTimeout(() => {
      frames.forEach((f) => burstIn(f, 60));
      sound.play('pop');
    }, k * 450);
  }
}

async function toggleMic() {
  if (mic) {
    mic.stop();
    mic = null;
    level = 0;
    hud.toast('🎤 Mic off');
    return;
  }
  try {
    mic = await startMic({ onClap: () => {}, onLevel: (l) => { level = Math.max(level * 0.85, Math.min(1, l * 6)); } });
    hud.toast('🎤 Mic on: play some music in Party mode!');
  } catch (err) {
    console.error('microphone failed', err);
    hud.toast(`🎤 ${err.message || 'Microphone blocked'}`, 5000);
  }
}

const ACTIONS = {
  ...Object.fromEntries(Object.keys(SCENES).map((id) => [`scene-${id}`, () => setScene(id)])),
  firework: fireworkShow,
  blackout: () => { blackout = !blackout; },
  mic: toggleMic,
  trace: () => {
    editor.setActive(false);
    tracer.toggle();
    if (tracer.active && usingSample()) hud.toast('Outline your first object: the sample layout disappears once you do');
  },
  edit: () => {
    tracer.setActive(false);
    editor.toggle();
  },
  language: () => {
    lang = lang === 'en' ? 'hi' : 'en';
    persistPrefs();
    remote.setLayout(masksLayout(lang));
  },
  fullscreen: () => stage.toggleFullscreen(), help: () => hud.toggleHelp(),
  mute: () => hud.toast(sound.toggleMute() ? '🔇 Muted' : '🔊 Sound on'),
};

function act(id) {
  sound.unlock();
  ACTIONS[id]?.();
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  sound.unlock();
  if (tracer.handleKey(key) || editor.handleKey(key)) {
    e.preventDefault();
    return;
  }
  const id = KEYS[key];
  if (!id) return;
  e.preventDefault();
  act(id);
});
window.addEventListener('pointermove', (e) => {
  if (!tracer.active && !editor.active) pointer = stage.toStage({ x: e.clientX, y: e.clientY });
});

const remote = connectRemote({ role: 'stage', layout: masksLayout(lang), onMessage: (msg) => msg.type === 'press' && act(msg.id) });
serverInfo().then((info) => {
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Press T to trace the objects in your room.  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
});

// ---- loop ------------------------------------------------------------------------------------------
function autoFireworks(dt) {
  if (scene !== 'diwali') return;
  nextBurst -= dt;
  if (nextBurst > 0) return;
  nextBurst = AUTO_BURST_S[0] + Math.random() * (AUTO_BURST_S[1] - AUTO_BURST_S[0]);
  const frames = visibleShapes().filter((s) => effectsFor(scene, s.tag).includes('firework-window'));
  if (frames.length) burstIn(frames[Math.floor(Math.random() * frames.length)]);
}

function draw(t) {
  const { ctx, size } = stage;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size.w, size.h);
  if (blackout) return;
  const env = { t, sceneT, art, chars, level, pointer, lang, bursts };
  for (const s of visibleShapes()) {
    for (const name of effectsFor(scene, s.tag)) paintEffect(ctx, name, s, env);
  }
  if (usingSample() && !tracer.active) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 30px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Sample layout · press T to trace the objects in your room', size.w / 2, 50);
  }
}

async function boot() {
  try {
    chars = (await loadCharacters()).chars;
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
    sceneT += dt;
    bursts = stepBursts(bursts, dt);
    autoFireworks(dt);
    if (!mic) level = 0.5 + 0.5 * Math.sin(t * 4); // gentle pulse when the mic is off
    draw(t);
    editor.draw();
    tracer.draw();
  });
}

boot();
