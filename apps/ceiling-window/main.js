// Ceiling Window: a hole opens in the ceiling above the mattress. Look up into the sky, an aquarium
// or the stars, while friendly characters peek down over the edge. Bedtime mode fades to black.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { loadCharacters, resolveCharacters } from '../../kit/characters.js';
import { DEPTH_RANGE, OFFSET_RANGE, farRect } from './shaft.js';
import { SCENES, populate, stepDrifters } from './drifters.js';
import { pickEdge, startPeek, stepPeek } from './peek.js';
import { rotateCorners180 } from '../../kit/warp.js';
import { BEDTIME_OPTIONS_S, bedtimeBrightness } from './bedtime.js';
import { drawCeiling } from './render.js';
import { DEMO_SCRIPT, HELP_KEYS, KEYS, PEEKERS, ceilingLayout } from './controls.js';

const KEY = 'ceiling-window';
const ART_KINDS = ['sun', 'moon', 'cloud', 'bird', 'balloon', 'fish', 'tropical-fish', 'blowfish', 'octopus', 'turtle', 'whale', 'star'];
const FADE_S = 0.6; // scene change: fade to black and back
const AUTO_PEEK_S = [4, 7]; // peek-a-boo scene: someone peeks every 4–7 s
const VIEW_STEP = 0.02;
const DEPTH_STEP = 0.03;

const stage = createStage({ key: KEY, width: 1600, height: 1200 });
const hud = createHud({ title: 'Ceiling Window 🪟', keys: HELP_KEYS, footer: 'Fan off! Lie on the mattress and look up.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });

// ---- state (replaced, never mutated) ----------------------------------------------------------
const savedView = loadJson(`${KEY}:view`) ?? {};
let view = {
  depth: Number.isFinite(savedView.depth) ? savedView.depth : 0.55,
  offset: { x: Number(savedView.offset?.x) || 0, y: Number(savedView.offset?.y) || 0 },
};
let scene = 'sky';
let autoPeek = false;
let drifters = populate('sky');
let peek = null;
let peekIndex = 0;
let nextAutoPeek = 2;
let transition = null; // { to, t }
let bedtime = null; // { elapsed, duration }
let chars = null;
let art = {};

const sceneKeyOf = (name) => (name === 'peekaboo' ? 'sky' : name); // peek-a-boo happens in the sky
const recipeOf = (name) => SCENES[sceneKeyOf(name)];

// ---- actions ----------------------------------------------------------------------------------
function peekIn(role) {
  if (peek || !chars) return;
  const who = role ?? PEEKERS[peekIndex % PEEKERS.length];
  peekIndex += 1;
  peek = startPeek(who, pickEdge(Math.random()), 0.25 + Math.random() * 0.5);
  sound.play('boing');
  setTimeout(() => say(`Peek-a-boo! ${chars[who].label}!`, { force: true }), 700);
}

function setScene(name, { keepBedtime = false } = {}) {
  if (!keepBedtime) bedtime = null;
  transition = { to: name, t: 0 };
  sound.play('chime');
}

function startBedtime() {
  setScene('night', { keepBedtime: true });
  bedtime = { elapsed: 0, duration: BEDTIME_OPTIONS_S[1] };
  hud.hideHelp();
  hud.toast('😴 Bedtime: the stars fade out over 10 minutes');
}

function nudgeView(dx, dy, dDepth = 0) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  view = {
    depth: clamp(view.depth + dDepth, ...DEPTH_RANGE),
    offset: { x: clamp(view.offset.x + dx, -OFFSET_RANGE, OFFSET_RANGE), y: clamp(view.offset.y + dy, -OFFSET_RANGE, OFFSET_RANGE) },
  };
  saveJson(`${KEY}:view`, view);
}

let demoTimers = [];
function runDemo() {
  demoTimers.forEach(clearTimeout);
  hud.hideHelp();
  demoTimers = DEMO_SCRIPT.map(([s, id]) => setTimeout(() => act(id), s * 1000));
}

const ACTIONS = {
  'scene-sky': () => setScene('sky'), 'scene-water': () => setScene('water'),
  'scene-night': () => setScene('night'), 'scene-peekaboo': () => setScene('peekaboo'),
  peek: () => peekIn(), bedtime: startBedtime, demo: runDemo,
  'view-left': () => nudgeView(-VIEW_STEP, 0), 'view-right': () => nudgeView(VIEW_STEP, 0),
  'view-up': () => nudgeView(0, -VIEW_STEP), 'view-down': () => nudgeView(0, VIEW_STEP),
  shallower: () => nudgeView(0, 0, DEPTH_STEP), deeper: () => nudgeView(0, 0, -DEPTH_STEP),
  turn: () => { stage.setCorners(rotateCorners180(stage.corners)); hud.toast('🔄 Picture turned around'); },
  edit: () => editor.toggle(), fullscreen: () => stage.toggleFullscreen(), help: () => hud.toggleHelp(),
  mute: () => {
    const muted = sound.toggleMute();
    setSpeechMuted(muted);
    hud.toast(muted ? '🔇 Muted' : '🔊 Sound on');
  },
  ...Object.fromEntries(PEEKERS.map((role) => [`peek-${role}`, () => peekIn(role)])),
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
window.addEventListener('pointerdown', () => sound.unlock());

const remote = connectRemote({ role: 'stage', layout: ceilingLayout(resolveCharacters({})), onMessage: (msg) => msg.type === 'press' && act(msg.id) });

async function showRemoteAddress() {
  const info = await serverInfo();
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Fan off! Lie down and look up.  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
}
showRemoteAddress();

// ---- loop ------------------------------------------------------------------------------------
function updateTransition(dt) {
  if (!transition) return 0;
  const t = transition.t + dt;
  if (transition.t < FADE_S && t >= FADE_S) {
    scene = transition.to;
    autoPeek = scene === 'peekaboo';
    drifters = populate(sceneKeyOf(scene));
  }
  transition = t >= FADE_S * 2 ? null : { ...transition, t };
  return transition ? 1 - Math.abs(transition.t - FADE_S) / FADE_S : 0;
}

function update(dt) {
  const fade = updateTransition(dt);
  drifters = stepDrifters(drifters, sceneKeyOf(scene), dt);
  if (peek) peek = stepPeek(peek, dt);
  if (autoPeek && !peek) {
    nextAutoPeek -= dt;
    if (nextAutoPeek <= 0) {
      peekIn();
      nextAutoPeek = AUTO_PEEK_S[0] + Math.random() * (AUTO_PEEK_S[1] - AUTO_PEEK_S[0]);
    }
  }
  if (bedtime) bedtime = { ...bedtime, elapsed: bedtime.elapsed + dt };
  const bedtimeDim = bedtime ? 1 - bedtimeBrightness(bedtime.elapsed, bedtime.duration) : 0;
  return Math.max(fade, bedtimeDim);
}

async function loadArt() {
  const load = (kind) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([kind, img]);
    img.onerror = () => reject(new Error(`could not load ${kind}`));
    img.src = `../../assets/noto/3d-${kind}.png`;
  });
  return Object.fromEntries(await Promise.all(ART_KINDS.map(load)));
}

async function start() {
  try {
    const [loaded, sceneArt] = await Promise.all([loadCharacters(), loadArt()]);
    chars = loaded.chars;
    art = sceneArt;
    remote.setLayout(ceilingLayout(chars));
    if (loaded.problems.length) hud.toast(`⚠️ Using built-in art for ${loaded.problems.join(', ')}`, 6000);
  } catch (err) {
    console.error(err);
    hud.toast(`⚠️ ${err.message}. Is the MayaSabha server running?`, 10000);
    return;
  }
  stage.onFrame((dt, t) => {
    const dim = update(dt);
    const far = farRect(stage.size, view);
    drawCeiling(stage.ctx, { stage: stage.size, far, recipe: recipeOf(scene), drifters, art, chars, peek, t, dim });
    editor.draw();
  });
}

start();
