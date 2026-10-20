// Kadam Taal (कदमताल, "marching in step"): a floor rhythm game. Notes travel down projected lanes to
// big pads at the near edge; step on the pad as a note arrives. Little-feet mode (2–3 years): the note
// waits at its pad until stepped on and every step is a little party. Grown-up mode: notes on a beat,
// Perfect / Good / Miss, streak bonuses, and it speeds up. Feet come from the camera; keys, clicks and
// the phone work too.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { loadCharacters } from '../../kit/characters.js';
import { setSpeechMuted } from '../../kit/speech.js';
import { spawnFx, stepFx } from '../../kit/fx.js';
import { rotateCorners180 } from '../../kit/warp.js';
import { createVision } from '../../kit/vision/vision.js';
import { GROWN, KID, heldCatches, newGrown, newKid, pressGrown, pressKid, stepGrown, stepKid } from './chart.js';
import { boardLayout, padAt, stompsFrom } from './pads.js';
import { HELP_KEYS, KEYS, MODES, MODE_LABEL, padLayout } from './controls.js';
import { LANE_COLORS, drawFloor } from './render.js';

const KEY = 'kadam-taal';
const PENTATONIC = Object.freeze([523, 659, 784, 1047]); // a happy note per pad (C, E, G, high C)
const FLASH_S = 0.35;
const POPUP_S = 0.9;
const CHEER_EVERY = 5; // little feet: a bigger party every few steps

const stage = createStage({ key: KEY });
const hud = createHud({ title: 'Kadam Taal 👣', keys: HELP_KEYS, footer: 'Step on the pads!' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const vision = createVision({ stage, key: KEY, hud });

// ---- state (replaced, never mutated) ----------------------------------------------------------
const prefs = loadJson(`${KEY}:prefs`) ?? {};
let mode = MODES.includes(prefs.mode) ? prefs.mode : 'kid';
let kid = newKid();
let grown = newGrown();
let running = false; // grown-up mode waits for Space
let flashes = [];
let popups = [];
let particles = [];
let feetOn = new Map(); // lane -> seconds since a foot was last seen on that pad
let feet = [];
let art = {};

const lanesOf = (m) => (m === 'kid' ? KID.lanes : GROWN.lanes);
let layout = boardLayout(stage.size, lanesOf(mode));

function popup(text, lane, color, size = 72) {
  const pad = layout.pads[lane];
  popups = [...popups, { text, x: pad.cx, y: pad.y - 30, color, size, life: POPUP_S, max: POPUP_S }];
}

function flash(lane) {
  flashes = layout.pads.map((_, i) => (i === lane ? FLASH_S : flashes[i] ?? 0));
}

// ---- actions ----------------------------------------------------------------------------------
function pressKidLane(lane) {
  const r = pressKid(kid, lane);
  kid = r.state;
  flash(lane);
  const pad = layout.pads[lane];
  sound.tone(PENTATONIC[lane]);
  particles = [...particles, ...spawnFx('sparkle', pad.cx, pad.cy)];
  if (r.result !== 'hit') return;
  particles = [...particles, ...spawnFx('crumbs', pad.cx, pad.cy - 60, Math.random, ['apple', 'banana', 'orange'][lane])];
  sound.play('crunch');
  if (kid.hits % CHEER_EVERY === 0) {
    particles = [...particles, ...layout.pads.flatMap((p) => spawnFx('hearts', p.cx, p.cy))];
    sound.play('trumpet');
  }
}

function pressGrownLane(lane) {
  if (!running) return;
  const r = pressGrown(grown, lane);
  grown = r.state;
  flash(lane);
  if (r.result === 'stray') return;
  sound.play(r.result);
  popup(r.result === 'perfect' ? 'PERFECT' : 'GOOD', lane, r.result === 'perfect' ? '#5cf27c' : '#3ec8ff');
  const pad = layout.pads[lane];
  particles = [...particles, ...spawnFx('sparkle', pad.cx, pad.cy)];
  if (r.bonus) {
    popup(`+${r.bonus} STREAK`, Math.min(1, layout.pads.length - 1), '#ffd23e', 90);
    sound.play('chime');
  }
}

function press(lane) {
  if (mode === 'kid') pressKidLane(Math.min(lane, KID.lanes - 1));
  else if (lane < GROWN.lanes) pressGrownLane(lane);
}

function setMode(next) {
  mode = next;
  saveJson(`${KEY}:prefs`, { mode });
  layout = boardLayout(stage.size, lanesOf(mode));
  kid = newKid();
  grown = newGrown();
  running = false;
  flashes = [];
  popups = [];
  particles = [];
  feetOn = new Map();
  remote.setLayout(padLayout(lanesOf(mode)));
  hud.toast(MODE_LABEL[mode]);
}

function startOrPause() {
  if (mode !== 'grown') return;
  running = !running;
  hud.toast(running ? '▶️ Go!' : '⏸ Paused');
}

const ACTIONS = {
  ...Object.fromEntries([0, 1, 2, 3].map((i) => [`lane-${i}`, () => press(i)])),
  mode: () => setMode(mode === 'kid' ? 'grown' : 'kid'),
  start: startOrPause,
  restart: () => setMode(mode),
  camera: () => vision.toggle(), calibrate: () => vision.calibrate(), mirror: () => vision.toggleMirror(), inspect: () => vision.toggleDebug(),
  turn: () => { stage.setCorners(rotateCorners180(stage.corners)); hud.toast('🔄 Picture turned around'); },
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
  if (e.metaKey || e.ctrlKey || e.repeat) return;
  const key = e.key.toLowerCase();
  sound.unlock();
  if (editor.handleKey(key)) return;
  if (vision.calibrating) return;
  const id = KEYS[key];
  if (!id) return;
  e.preventDefault();
  act(id);
});

// A click or tap on a pad is a step too (handy without a camera, and for grown-ups at a screen).
window.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (editor.active || vision.calibrating) return;
  const lane = padAt(layout, stage.toStage({ x: e.clientX, y: e.clientY }));
  if (lane >= 0) press(lane);
});

const remote = connectRemote({ role: 'stage', layout: padLayout(lanesOf(mode)), onMessage: (msg) => msg.type === 'press' && act(msg.id) });

async function showRemoteAddress() {
  const info = await serverInfo();
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Step on the pads! M switches little / grown-up.  ${url ? `📱 ${url}` : '(online version: keyboard and mouse)'}`);
}
showRemoteAddress();

// ---- loop ------------------------------------------------------------------------------------
function onBeat(e) {
  sound.play(e.strong ? 'kick' : 'hat');
}

function update(dt, t) {
  const seen = vision.update(t * 1000);
  feet = seen.feet ?? [];
  const stomped = stompsFrom(feetOn, feet, layout, dt);
  feetOn = stomped.on;
  stomped.stomps.forEach(press);
  // A toddler standing still on a pad still catches the fruit that arrives there.
  if (mode === 'kid') heldCatches(kid, stomped.held).forEach(pressKidLane);

  if (mode === 'kid') {
    kid = stepKid(kid, dt).state;
  } else if (running) {
    const r = stepGrown(grown, dt);
    grown = r.state;
    for (const e of r.events) {
      if (e.type === 'beat') onBeat(e);
      else if (e.type === 'miss') {
        popup('MISS', e.lane, LANE_COLORS[0], 56);
        sound.play('miss');
      }
    }
  }
  flashes = flashes.map((f) => Math.max(0, f - dt));
  popups = popups.map((p) => ({ ...p, life: p.life - dt })).filter((p) => p.life > 0);
  particles = stepFx(particles, dt);
}

async function start() {
  try {
    const loaded = await loadCharacters();
    art = { chars: loaded.chars };
    if (loaded.problems.length) hud.toast(`⚠️ Using built-in art for ${loaded.problems.join(', ')}`, 6000);
  } catch (err) {
    console.error(err);
    hud.toast(`⚠️ ${err.message}. Pictures missing; the game still works.`, 8000);
  }
  stage.onFrame((dt, t) => {
    update(dt, t);
    drawFloor(stage.ctx, { stage: stage.size, layout, mode, kid, grown, running, flashes, popups, particles, art, feet, t });
    vision.drawStage(stage.ctx);
    editor.draw();
  });
}

start();
