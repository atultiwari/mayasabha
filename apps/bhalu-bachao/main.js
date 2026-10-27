// Bhalu Bachao (भालू बचाओ, "save the Bear!"): Bear's leg is stuck on a railway that runs along the real
// sofa back, and a toy train driven by the Penguin is coming out of a tunnel. The child saves him:
// touching him, raising both arms, holding up something red, or clapping (any of them works). The train
// always stops in time and waits; nobody gets hurt. Then Masha runs in, and everyone cheers.
// The 3D characters are your own GLB files in assets/custom/models (kept private).
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { startMic } from '../../kit/mic.js';
import { loadCharacters } from '../../kit/characters.js';
import { ROOM_KEY, loadRoom } from '../../kit/room/room-map.js';
import { createVision } from '../../kit/vision/vision.js';
import { COLOR_PRESETS, blobOutlines } from '../../kit/vision/color-blobs.js';
import { newRescue, stepRescue, autoSaveDue } from './rescue.js';
import { trackLine } from './track.js';
import { armsUp, redSignal, startsHelping, touchedBear } from './inputs.js';
import { buildWorld } from './world.js';
import { createActors } from './actors.js';
import { HELP_KEYS, KEYS, LAYOUT, SOUNDS } from './controls.js';

const KEY = 'bhalu-bachao';
const RED_EVERY_MS = 200;
const SAMPLE = { w: 160, h: 120 };
const CHUG_PX = 140; // one chug for every this many px the train travels

// With a Room Map, share its fit and run the track along the traced sofa back.
const room = loadRoom();
const stage = createStage({ key: room.length ? ROOM_KEY : KEY, context: 'webgl' });
const hud = createHud({ title: 'Bhalu Bachao 🐻🚂', keys: HELP_KEYS, footer: 'Save Bear from the train!' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const vision = createVision({ stage, key: KEY, hud });
const track = trackLine(room, stage.size);

let rescue = newRescue(stage.size, track);
let pending = false; // a save waiting for the next frame
// Auto play: the story runs on its own, round after round (Bear is freed after the train waits a
// moment). On by default; A turns it off to wait for the child instead, or ?auto=0 in the address.
let auto = new URLSearchParams(location.search).get('auto') !== '0';
let mic = null;
let lastRed = 0;
let wasRed = false;
let cameraHelping = false; // was the camera seeing a rescue last frame?
let chugDistance = 0;
const sampler = document.createElement('canvas');
sampler.width = SAMPLE.w;
sampler.height = SAMPLE.h;
const sctx = sampler.getContext('2d', { willReadFrequently: true });

const save = () => { pending = true; };

async function toggleMic() {
  if (mic) {
    mic.stop();
    mic = null;
    hud.toast('🎤 Mic off');
    return;
  }
  try {
    mic = await startMic({ onClap: save });
    hud.toast('🎤 Mic on: a real clap saves Bear!');
  } catch (err) {
    console.error(err);
    hud.toast('⚠️ Could not use the microphone');
  }
}

const ACTIONS = {
  save,
  restart: () => { rescue = newRescue(stage.size, track); },
  auto: () => { auto = !auto; hud.toast(auto ? '▶️ Auto play: Bear is saved by himself' : '🧒 Waiting for you to save Bear'); },
  camera: () => vision.toggle(), calibrate: () => vision.calibrate(), mirror: () => vision.toggleMirror(), inspect: () => vision.toggleDebug(),
  mic: toggleMic,
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

let actors = null;
window.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (!actors || editor.active || vision.calibrating) return;
  if (touchedBear([stage.toStage({ x: e.clientX, y: e.clientY })], actors.bearBox(rescue))) save();
});

connectRemote({ role: 'stage', layout: LAYOUT, onMessage: (msg) => msg.type === 'press' && act(msg.id) });
serverInfo().then((info) => {
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Save Bear from the train!  ${url ? `📱 ${url}` : '(online version: keyboard and mouse)'}`);
});

// ---- the camera's ways to help ----------------------------------------------------------------
function seesRed(now) {
  if (!vision.on || !vision.video) return false;
  if (now - lastRed < RED_EVERY_MS) return wasRed;
  lastRed = now;
  try {
    sctx.drawImage(vision.video, 0, 0, SAMPLE.w, SAMPLE.h);
    const { data } = sctx.getImageData(0, 0, SAMPLE.w, SAMPLE.h);
    wasRed = redSignal(blobOutlines(data, SAMPLE.w, SAMPLE.h, COLOR_PRESETS.red, { minArea: 40 }));
    return wasRed;
  } catch (err) {
    console.error('red detection failed', err);
    return false;
  }
}

function cameraSaves(now) {
  const seen = vision.update(now);
  const helping = touchedBear(seen.hands, actors.bearBox(rescue)) || armsUp(seen.body) || seesRed(now);
  const fresh = startsHelping(cameraHelping, helping);
  cameraHelping = helping;
  return fresh;
}

// ---- loop ------------------------------------------------------------------------------------
function play(effects) {
  for (const e of effects) {
    for (const name of SOUNDS[e] ?? []) sound.play(name);
    if (e === 'help') say('Help! Help!');
    if (e === 'cheer') say('Hooray! Bear is safe!');
  }
}

function chug(dt) {
  chugDistance += rescue.train.v * dt;
  if (chugDistance < CHUG_PX) return;
  chugDistance = 0;
  sound.play('chug');
}

async function start() {
  let chars = null;
  try {
    chars = (await loadCharacters()).chars;
  } catch (err) {
    console.error(err);
  }
  try {
    actors = createActors(await buildWorld(stage.canvas, stage.size, track, chars), stage.size, track);
  } catch (err) {
    console.error(err);
    hud.toast(`⚠️ ${err.message}`, 30000);
    stage.onFrame(() => editor.draw()); // keep fitting the corners possible even without the models
    return;
  }
  const world = actors.world;
  stage.onFrame((dt, t) => {
    if (cameraSaves(t * 1000) || (auto && autoSaveDue(rescue))) save();
    if (pending && rescue.phase === 'arrive') sound.play('squeak'); // too early: Bear isn't stuck yet
    const r = stepRescue(rescue, dt, pending ? ['save'] : []);
    pending = false;
    rescue = r.state;
    play(r.effects);
    if (rescue.train.v > 5) chug(dt);
    actors.update(rescue, t, dt);
    world.renderer.render(world.scene, world.camera);
    editor.draw();
  });
}

start();
