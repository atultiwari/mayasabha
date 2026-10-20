// Bubbles & Butterflies: giant bubbles float up the wall and pop when a child touches them (some
// hide a favourite character); butterflies land on a hand held still and scatter on a swipe.
// Tracking comes from the camera (MediaPipe pose + body mask); the mouse works as a hand too.
// Test without a camera: add ?video=<url> to use a video file as the camera.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadCharacters, resolveCharacters } from '../../kit/characters.js';
import { spawnFx, stepFx } from '../../kit/fx.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { createVision } from '../../kit/vision/vision.js';
import { activeGrid } from '../../kit/vision/body-map.js';
import { trackHands } from '../../kit/vision/hand-tracker.js';
import { BUBBLE, fillBubbles, popTouched, spawnBubble, stepBubbles } from './bubbles.js';
import { BUTTERFLY, populateButterflies, stepButterflies } from './butterflies.js';
import { drawWall } from './render.js';
import { HELP_KEYS, KEYS, wallLayout } from './controls.js';

const KEY = 'bubbles';
// A parked mouse pointer is hidden on the wall: it stops popping bubbles quickly, but stays a
// perch for butterflies much longer (holding still is exactly how they are invited to land).
const MOUSE_POP_IDLE_S = 2.5;
const MOUSE_PERCH_IDLE_S = 30;
const SURPRISE_LIFE_S = 2.2;
const BIG_BUBBLE_R = 190;
const COUNT_RANGE = { bubbles: [3, 14], butterflies: [3, 18] };

const stage = createStage({ key: KEY });
const hud = createHud({ title: 'Bubbles & Butterflies 🫧', keys: HELP_KEYS, footer: 'Touch the bubbles! Hold a hand still for butterflies.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const vision = createVision({ stage, key: KEY, hud });
const testVideo = new URLSearchParams(location.search).get('video');
// ?debug exposes live state for automated checks (never needed to play).
if (new URLSearchParams(location.search).has('debug')) {
  window.mayasabhaDebug = () => ({ mode, tracks, flock: flock.map((b) => b.state), bubbles: bubbles.length, mouse });
}

// ---- state (replaced, never mutated) -------------------------------------------------------------
let mode = 'bubbles';
let bubbleCount = BUBBLE.count;
let flockCount = BUTTERFLY.count;
let bubbles = fillBubbles([], bubbleCount, stage.size).map((b) => ({ ...b, y: b.y - stage.size.h * Math.random() }));
let flock = [];
let surprises = [];
let particles = [];
let tracks = [];
let mouse = null; // { x, y, idle }
let chars = resolveCharacters({});

const showBubbles = () => mode !== 'butterflies';
const showButterflies = () => mode !== 'bubbles';

// ---- actions ------------------------------------------------------------------------------------
function setMode(next) {
  mode = next;
  if (showButterflies() && flock.length === 0) flock = populateButterflies(stage.size, Math.random, flockCount);
  if (!showButterflies()) flock = [];
  sound.play('chime');
}

function bigBubble(role) {
  const roles = ['pet', 'elephant', 'penguin', 'monkey', 'mouse', 'banana', 'apple', 'orange'];
  const surprise = role ?? roles[Math.floor(Math.random() * roles.length)];
  const b = spawnBubble(stage.size, Math.random, true);
  bubbles = [...bubbles, { ...b, r: BIG_BUBBLE_R, x0: stage.size.w / 2, x: stage.size.w / 2, vy: 60, surprise }];
  if (!showBubbles()) setMode('both');
}

function changeCount(delta) {
  if (showBubbles()) bubbleCount = Math.min(COUNT_RANGE.bubbles[1], Math.max(COUNT_RANGE.bubbles[0], bubbleCount + delta));
  if (showButterflies()) {
    flockCount = Math.min(COUNT_RANGE.butterflies[1], Math.max(COUNT_RANGE.butterflies[0], flockCount + delta));
    flock = flock.length > flockCount ? flock.slice(0, flockCount) : [...flock, ...populateButterflies(stage.size, Math.random, flockCount - flock.length)];
  }
}

const ACTIONS = {
  'mode-bubbles': () => setMode('bubbles'), 'mode-butterflies': () => setMode('butterflies'), 'mode-both': () => setMode('both'),
  'big-bubble': () => bigBubble(), more: () => changeCount(1), fewer: () => changeCount(-1),
  camera: () => vision.toggle({ videoUrl: testVideo }), calibrate: () => vision.calibrate(),
  mirror: () => vision.toggleMirror(), inspect: () => vision.toggleDebug(),
  edit: () => editor.toggle(), fullscreen: () => stage.toggleFullscreen(), help: () => hud.toggleHelp(),
  mute: () => {
    const muted = sound.toggleMute();
    setSpeechMuted(muted);
    hud.toast(muted ? '🔇 Muted' : '🔊 Sound on');
  },
  ...Object.fromEntries(['pet', 'elephant', 'penguin', 'monkey', 'mouse', 'banana', 'apple', 'orange'].map((r) => [`bubble-${r}`, () => bigBubble(r)])),
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

// The mouse (or a touch screen) is a hand too: handy for testing and for grown-ups joining in.
window.addEventListener('pointermove', (e) => {
  if (editor.active || vision.calibrating) return;
  mouse = { ...stage.toStage({ x: e.clientX, y: e.clientY }), idle: 0 };
});
window.addEventListener('pointerdown', () => sound.unlock());

const remote = connectRemote({ role: 'stage', layout: wallLayout(chars), onMessage: (msg) => msg.type === 'press' && act(msg.id) });

async function showRemoteAddress() {
  const info = await serverInfo();
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Touch the bubbles! Hold a hand still for butterflies.  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
}
showRemoteAddress();

// ---- loop -----------------------------------------------------------------------------------------
function onPop(popped) {
  for (const b of popped) {
    sound.play('pop');
    particles = [...particles, ...spawnFx('sparkle', b.x, b.y), ...spawnFx('dust', b.x, b.y + b.r * 0.5)];
    if (b.surprise) {
      surprises = [...surprises, { role: b.surprise, x: b.x, y: b.y, age: 0 }];
      sound.play('chime');
      say(`${chars[b.surprise]?.label ?? ''}!`);
    }
  }
}

let bodyAges = null;

function update(dt, timeMs) {
  const seen = vision.update(timeMs);
  const active = activeGrid(bodyAges, seen.grid, dt);
  bodyAges = active.ages;
  mouse = mouse ? { ...mouse, idle: mouse.idle + dt } : null;
  const mouseAt = (limit) => (mouse && mouse.idle < limit ? [{ x: mouse.x, y: mouse.y }] : []);
  const detections = [...seen.hands, ...mouseAt(MOUSE_POP_IDLE_S)];
  tracks = trackHands(tracks, [...seen.hands, ...mouseAt(MOUSE_PERCH_IDLE_S)], dt);

  if (showBubbles()) {
    const { kept, popped } = popTouched(bubbles, { grid: active.grid, hands: detections });
    if (popped.length) onPop(popped);
    bubbles = fillBubbles(stepBubbles(kept, dt, stage.size), bubbleCount, stage.size);
  } else {
    bubbles = stepBubbles(bubbles, dt, stage.size).filter((b) => b.y > -b.r); // let the last ones drift away
  }
  if (showButterflies()) {
    const before = flock.filter((b) => b.state === 'landed').length;
    flock = stepButterflies(flock, tracks, dt, stage.size);
    if (flock.filter((b) => b.state === 'landed').length > before) sound.play('tinkle');
  }
  surprises = surprises.map((s) => ({ ...s, age: s.age + dt })).filter((s) => s.age < SURPRISE_LIFE_S);
  particles = stepFx(particles, dt);
}

async function start() {
  try {
    const loaded = await loadCharacters();
    chars = loaded.chars;
    remote.setLayout(wallLayout(chars));
  } catch (err) {
    console.error(err);
    hud.toast(`⚠️ ${err.message}`, 8000);
  }
  if (testVideo) hud.toast('🎬 Test video ready: press C to start tracking it', 5000);
  stage.onFrame((dt, t) => {
    update(dt, t * 1000);
    drawWall(stage.ctx, { size: stage.size, bubbles, flock, surprises, particles, chars, overlay: vision.drawStage });
    editor.draw();
  });
}

start();
