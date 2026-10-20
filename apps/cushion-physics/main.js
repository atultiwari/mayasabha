// Cushion Physics: real red cushions on the floor (seen by a camera) become solid in a physics
// world. Fruit tumbles down and bounces off them; move a cushion to steer it into Hathi's trunk.
// Marbles mode plays a note on every bounce. Without a camera, drag the virtual pillows.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { loadCharacters, resolveCharacters } from '../../kit/characters.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { drawFx, spawnFx, stepFx } from '../../kit/fx.js';
import { createVision } from '../../kit/vision/vision.js';
import { COLOR_PRESETS, blobOutlines } from '../../kit/vision/color-blobs.js';
import { GAME, cushionAt, defaultCushions, goalRect, moveCushion, noteFor, spawnX, syncTracked, tickSpawner, virtualPoints } from './game.js';
import { createPhysics } from './physics.js';
import { drawField } from './render.js';
import { COLOR_ORDER, HELP_KEYS, KEYS, cushionLayout } from './controls.js';

const KEY = 'cushion-physics';
const DETECT_MS = 150;
const SAMPLE = { w: 160, h: 120 };
const FRUIT = ['banana', 'apple', 'orange'];
const HAPPY_S = 1.4;

const stage = createStage({ key: KEY });
const hud = createHud({ title: 'Cushion Physics 🛋️', keys: HELP_KEYS, footer: 'Drag the red pillows, or press C to use real cushions.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const vision = createVision({ stage, key: KEY, hud, pose: false });
const testVideo = new URLSearchParams(location.search).get('video'); // test without a camera: ?video=<url>
const physics = createPhysics(window.Matter, {
  onHit: (id, strength) => onHit(id, strength),
  onGoal: () => onGoal(),
});

// ---- state ----------------------------------------------------------------------------------------
const prefs = loadJson(`${KEY}:prefs`) ?? {};
let mode = prefs.mode === 'marbles' ? 'marbles' : 'feed';
let colour = COLOR_PRESETS[prefs.colour] ? prefs.colour : 'red';
let goalSpot = 1;
let score = 0;
let happy = 0;
let spawner = { next: 0.5 };
let virtual = defaultCushions(stage.size);
let tracked = [];
let flash = new Map();
let particles = [];
let dragging = null; // { id, last }
let chars = resolveCharacters({});
let art = {};
const sampler = document.createElement('canvas');
sampler.width = SAMPLE.w;
sampler.height = SAMPLE.h;
const sctx = sampler.getContext('2d', { willReadFrequently: true });

const persist = () => saveJson(`${KEY}:prefs`, { mode, colour });
const usingCamera = () => vision.on;
const hueOf = (id) => [...id].reduce((a, ch) => a + ch.charCodeAt(0) * 37, 0) % 360;

/** Current cushions as polygons in stage px, from the camera or the virtual pillows. */
function cushionShapes() {
  if (usingCamera()) {
    return tracked.map((t) => ({ id: t.id, version: t.version, points: t.outline.points.map((p) => vision.mapping.toStage(p)), hue: hueOf(t.id) }));
  }
  return virtual.map((c) => ({ id: c.id, version: c.version, points: virtualPoints(c), hue: hueOf(c.id) }));
}

// ---- physics events ---------------------------------------------------------------------------------
function onHit(id, strength) {
  flash = new Map(flash).set(id, 1);
  if (strength < 0.15) return;
  if (mode === 'marbles') {
    const index = cushionShapes().findIndex((c) => c.id === id);
    playNote(noteFor(index * 2 + Math.round(strength * 3)));
  } else {
    sound.play('boing');
  }
}

function onGoal() {
  score += 1;
  happy = HAPPY_S;
  sound.play(mode === 'feed' ? 'trumpet' : 'chime');
  if (mode === 'feed' && score % 5 === 0) say(`${score}! ${chars.elephant.label} is happy!`, { force: true });
}

function playNote(freq) {
  sound.tone?.(freq);
}

// ---- actions ------------------------------------------------------------------------------------------
function dropOne() {
  const x = spawnX(performance.now() / 1000, stage.size.w);
  const kind = mode === 'feed' ? 'fruit' : 'marble';
  const look = FRUIT[Math.floor(Math.random() * FRUIT.length)];
  physics.drop({ kind, look, hue: Math.floor(Math.random() * 360) }, x, -60);
}

function setMode(next) {
  mode = next;
  physics.clear();
  persist();
  hud.toast(next === 'feed' ? `🍌 Feed ${chars.elephant.label}!` : '🎵 Marbles: every cushion plays a note');
}

function moveGoal(delta) {
  goalSpot = Math.max(0, Math.min(GAME.goalSpots.length - 1, goalSpot + delta));
  physics.setGoal(goalRect(stage.size, goalSpot));
}

function nextColour() {
  colour = COLOR_ORDER[(COLOR_ORDER.indexOf(colour) + 1) % COLOR_ORDER.length];
  tracked = [];
  persist();
  hud.toast(`🎨 Looking for ${colour} objects`);
}

const ACTIONS = {
  'mode-feed': () => setMode('feed'), 'mode-marbles': () => setMode('marbles'),
  drop: dropOne, 'goal-left': () => moveGoal(-1), 'goal-right': () => moveGoal(1),
  clear: () => { physics.clear(); score = 0; },
  camera: () => vision.toggle({ videoUrl: testVideo }), calibrate: () => vision.calibrate(), mirror: () => vision.toggleMirror(),
  inspect: () => vision.toggleDebug(), colour: nextColour,
  edit: () => editor.toggle(), fullscreen: () => stage.toggleFullscreen(), help: () => hud.toggleHelp(),
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

// Drag the virtual pillows (mouse or touch screen).
window.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (editor.active || vision.calibrating || usingCamera()) return;
  const p = stage.toStage({ x: e.clientX, y: e.clientY });
  const hit = cushionAt(virtual, p);
  if (hit) dragging = { id: hit.id, last: p };
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = stage.toStage({ x: e.clientX, y: e.clientY });
  virtual = moveCushion(virtual, dragging.id, p.x - dragging.last.x, p.y - dragging.last.y);
  dragging = { ...dragging, last: p };
});
window.addEventListener('pointerup', () => { dragging = null; });

const remote = connectRemote({ role: 'stage', layout: cushionLayout(chars.elephant.label), onMessage: (msg) => msg.type === 'press' && act(msg.id) });
serverInfo().then((info) => {
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Drag the red pillows, or press C to use real cushions.  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
});

// ---- camera detection ---------------------------------------------------------------------------------
let lastDetect = 0;
function detect(now) {
  if (!usingCamera() || !vision.video || now - lastDetect < DETECT_MS) return;
  lastDetect = now;
  try {
    sctx.drawImage(vision.video, 0, 0, SAMPLE.w, SAMPLE.h);
    const { data } = sctx.getImageData(0, 0, SAMPLE.w, SAMPLE.h);
    tracked = syncTracked(tracked, blobOutlines(data, SAMPLE.w, SAMPLE.h, COLOR_PRESETS[colour], { minArea: 25 }));
  } catch (err) {
    console.error('cushion detection failed', err);
  }
}

// ---- loop ---------------------------------------------------------------------------------------------
function update(dt, t) {
  vision.update(t * 1000);
  detect(t * 1000);
  const shapes = cushionShapes();
  physics.syncCushions(shapes);
  const r = tickSpawner(spawner, dt, physics.items().length);
  spawner = r.state;
  if (r.drop) dropOne();
  physics.step(dt * 1000);
  for (const p of physics.cull(stage.size, dt)) particles = [...particles, ...spawnFx('sparkle', p.x, p.y)];
  particles = stepFx(particles, dt);
  happy = Math.max(0, happy - dt);
  flash = new Map([...flash].map(([id, f]) => [id, Math.max(0, f - dt * 2.5)]));
  return shapes;
}

async function boot() {
  try {
    chars = (await loadCharacters()).chars;
    remote.setLayout(cushionLayout(chars.elephant.label));
  } catch (err) {
    console.error(err);
  }
  art = { banana: chars.banana.img, apple: chars.apple.img, orange: chars.orange.img, elephant: chars.elephant.img };
  physics.setBounds(stage.size);
  physics.setGoal(goalRect(stage.size, goalSpot));
  stage.onFrame((dt, t) => {
    const shapes = update(dt, t);
    drawField(stage.ctx, {
      size: stage.size, t, cushions: shapes, virtual: !usingCamera(), flash, items: physics.items(), art,
      goal: goalRect(stage.size, goalSpot), happy, mode, score, dropX: spawnX(t, stage.size.w),
    });
    drawFx(stage.ctx, particles);
    vision.drawStage(stage.ctx);
    editor.draw();
  });
}

boot();
