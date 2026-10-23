// Roshandaan (रोशनदान, the old skylight-ventilator): a grown-ups' 3D horror on a ceiling light box. The
// box behaves like a light, flickers and dies, cracks and falls out towards you; behind it a deep shaft
// with a light flickering far up; hologram hands rise out of the dark, curl over the real frame, and
// lunge. Rendered in true 3D from the camera's spot (off-axis), so from there it looks like a real hole.
import { createStage } from '../../kit/stage.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { loadJson } from '../../kit/storage.js';
import { setSpeechMuted } from '../../kit/speech.js';
import { ceilingRect, projectorToMetric, sanitizeSetup, screenWall } from './setup.js';
import { PHASES, handAt, panelAt, phaseAt, phaseStart } from './timeline.js';
import { createCeilingRenderer } from './renderer.js';
import { buildWorld } from './scene.js';
import { makeHand } from './hand.js';
import { HELP_KEYS, KEYS, LAYOUT, cuesBetween } from './controls.js';

const KEY = 'roshandaan';
const SCREEN = { w: window.innerWidth || 1280, h: window.innerHeight || 720 };

// The stage is the projector itself, pixel for pixel: the setup's corners were measured in these pixels.
const stage = createStage({ key: KEY, width: SCREEN.w, height: SCREEN.h, context: 'webgl' });
const hud = createHud({ title: 'Roshandaan 👻 (grown-ups)', keys: HELP_KEYS, footer: 'Lights off. Space starts it.' });
const sound = createSound();

const setup = sanitizeSetup(loadJson(`${KEY}:setup`), SCREEN);
const toMetric = projectorToMetric(setup.panelCorners, setup.panelSize);
const rect = ceilingRect(toMetric, SCREEN);
const ceiling = createCeilingRenderer(stage.canvas, SCREEN);
ceiling.setCeiling(toMetric, rect, screenWall(rect));
const world = buildWorld({ rect, size: setup.panelSize, eye: setup.eye });
const half = setup.panelSize / 2;
const hands = [
  { hand: makeHand(1), place: { x: half - 0.07, y: -0.06 }, delay: 0 },
  { hand: makeHand(-1), place: { x: -half + 0.07, y: 0.07 }, delay: 0.6 },
];
for (const h of hands) world.scene.add(h.hand.object);

// ---- state ------------------------------------------------------------------------------------
let clock = null; // seconds into the story, or null when it's resting (box glowing like a light)
let auto = false;
let idle = 0;
const AUTO_PAUSE_S = 8;

function start(at = 0) {
  clock = at - 1e-6;
  hud.hideHelp();
}

function skip() {
  if (clock === null) return start();
  const i = PHASES.findIndex(([n]) => n === phaseAt(clock).name);
  clock = i >= 0 && i + 1 < PHASES.length ? phaseStart(PHASES[i + 1][0]) - 1e-6 : null;
}

const ACTIONS = {
  start: () => start(),
  skip,
  reset: () => { clock = null; auto = false; },
  auto: () => {
    auto = !auto;
    hud.toast(auto ? '🔁 Repeats on its own' : '🔁 Repeat off');
    if (auto && clock === null) start();
  },
  'jump-shaft': () => start(phaseStart('shatter')),
  'jump-hands': () => start(phaseStart('rise')),
  fullscreen: () => stage.toggleFullscreen(), help: () => hud.toggleHelp(),
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
  const id = KEYS[e.key.toLowerCase()];
  sound.unlock();
  if (!id) return;
  e.preventDefault();
  act(id);
});
window.addEventListener('pointerdown', () => sound.unlock());
connectRemote({ role: 'stage', layout: LAYOUT, onMessage: (msg) => msg.type === 'press' && act(msg.id) });

// ---- loop ------------------------------------------------------------------------------------
function advance(dt) {
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
  advance(dt);
  const time = clock ?? 0;
  const panel = clock === null ? { glow: 1, crack: 0, broken: false, shardT: 0 } : panelAt(time);
  const shaftLight = Math.random() < 0.08 ? 0.5 : 5 + Math.sin(t * 13) * 1.5; // a dying bulb far up the shaft
  world.update({ panel, t, shaftLight });
  for (const h of hands) h.hand.pose(clock === null ? { visible: false } : handAt(time - h.delay), h.place);
  ceiling.render(world.scene, setup.eye);
});
