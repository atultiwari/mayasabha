// Daraar (दरार, "crack"): a grown-ups' horror for the ceiling. Glowing cracks spread from one point and
// close into the outline of a hole (our ceiling has no frame of its own), the ceiling falls out in
// shards, a shaft crackling with electricity opens to a portal, a giant eye peers down, and a long-
// fingered hand reaches out at you. Bright neon throughout so it still shows in daylight.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { setSpeechMuted } from '../../kit/speech.js';
import { rotateCorners180 } from '../../kit/warp.js';
import { PHASES, TOTAL_S, cuesBetween, phaseAt, phaseStart } from './timeline.js';
import { framePath, holeRect, makeCracks, makeShards } from './cracks.js';
import { drawBreach, farOf } from './render.js';
import { HELP_KEYS, KEYS, LAYOUT } from './controls.js';

const KEY = 'daraar';
const STAGE_SIZE = Object.freeze({ width: 1600, height: 1200 }); // same shape as the Ceiling Window
const AUTO_PAUSE_S = 6;

// Same ceiling as the Ceiling Window: start from its fit if Daraar hasn't been fitted yet.
if (!loadJson(`${KEY}:corners`) && loadJson('ceiling-window:corners')) saveJson(`${KEY}:corners`, loadJson('ceiling-window:corners'));

const stage = createStage({ key: KEY, ...STAGE_SIZE });
const hud = createHud({ title: 'Daraar 👁️ (grown-ups)', keys: HELP_KEYS, footer: 'Space starts it. Not for little ones!' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });

const hole = holeRect(stage.size);
const far = farOf(hole);

// ---- state (replaced, never mutated) ----------------------------------------------------------
let clock = null; // seconds into the sequence, or null when idle
let auto = false;
let idle = 0;
let breach = freshBreach();

/** A new crack pattern each time, from a random point inside the hole. */
function freshBreach() {
  const origin = { x: hole.x + hole.w * (0.3 + Math.random() * 0.4), y: hole.y + hole.h * (0.3 + Math.random() * 0.4) };
  return { cracks: makeCracks(stage.size, origin, Math.random), frame: framePath(hole, Math.random), shards: makeShards(hole, Math.random) };
}

// ---- actions ----------------------------------------------------------------------------------
function start(at = 0) {
  breach = freshBreach();
  clock = at - 1e-6;
  hud.hideHelp();
}

function skip() {
  if (clock === null) return start();
  const now = phaseAt(clock).name;
  const i = PHASES.findIndex(([name]) => name === now);
  clock = i >= 0 && i + 1 < PHASES.length ? phaseStart(PHASES[i + 1][0]) - 1e-6 : null;
}

const ACTIONS = {
  start: () => start(),
  skip,
  reset: () => { clock = null; auto = false; },
  auto: () => {
    auto = !auto;
    hud.toast(auto ? `🔁 Repeats every ${Math.round(TOTAL_S + AUTO_PAUSE_S)} s` : '🔁 Repeat off');
    if (auto && clock === null) start();
  },
  'jump-cracks': () => start(phaseStart('cracks')),
  'jump-shaft': () => start(phaseStart('shaft')),
  'jump-eye': () => start(phaseStart('eye')),
  'jump-hand': () => start(phaseStart('hand')),
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
  const id = KEYS[key];
  if (!id) return;
  e.preventDefault();
  act(id);
});
window.addEventListener('pointerdown', () => sound.unlock());

connectRemote({ role: 'stage', layout: LAYOUT, onMessage: (msg) => msg.type === 'press' && act(msg.id) });

async function showRemoteAddress() {
  const info = await serverInfo();
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Space starts it. Grown-ups only!  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
}
showRemoteAddress();

// ---- loop ------------------------------------------------------------------------------------
function update(dt) {
  if (clock === null) {
    if (auto && (idle += dt) >= AUTO_PAUSE_S) {
      idle = 0;
      start();
    }
    return;
  }
  const next = clock + dt;
  for (const cue of cuesBetween(clock, next)) sound.play(cue.sound);
  clock = next;
  if (phaseAt(clock).name === 'done') {
    clock = null;
    idle = 0;
  }
}

stage.onFrame((dt, t) => {
  update(dt);
  const phase = clock === null ? { name: 'calm', k: 0, local: 0 } : phaseAt(clock);
  drawBreach(stage.ctx, { stage: stage.size, phase, t, hole, far, ...breach });
  editor.draw();
});
