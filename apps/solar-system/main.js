// Antariksh: the solar system on your ceiling or wall. Real textures, true orbit speeds (sped up),
// tilts and spins, famous moons, Saturn's rings. Fly to any body and hear its name and a fact in
// English or Hindi; compare true sizes; take a guided tour.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { say, setSpeechMuted } from '../../kit/speech.js';
import { THREE, bodyWorld, buildSolarSystem, updateSolarSystem } from './scene.js';
import { PLANETS, SUN, UI_TEXT } from './solar-data.js';
import { SPEEDS, followCamera } from './orbits.js';
import { viewTarget } from './view.js';
import { createOverlay } from './overlay.js';
import { HELP_KEYS, KEYS, TOUR, TOUR_STOP_S, solarLayout } from './controls.js';

const KEY = 'solar-system';
const CAPTION_S = 9;
const BODIES = [SUN, ...PLANETS.flatMap((p) => [p, ...p.moons])];
const LABELLED = new Set(['sun', ...PLANETS.map((p) => p.id), 'moon']);

const stage = createStage({ key: KEY, context: 'webgl' });
const hud = createHud({ title: 'Antariksh 🪐', keys: HELP_KEYS, footer: 'Lie down and look up: press T for the view from above.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const overlay = createOverlay(stage.host, BODIES.filter((b) => LABELLED.has(b.id)));

const renderer = new THREE.WebGLRenderer({ canvas: stage.canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(stage.size.w, stage.size.h, false);
const camera = new THREE.PerspectiveCamera(45, stage.size.w / stage.size.h, 0.05, 2000);
const world = buildSolarSystem(renderer);

// ---- state (replaced, never mutated) ----------------------------------------------------------
const saved = loadJson(`${KEY}:prefs`) ?? {};
let lang = saved.lang === 'hi' ? 'hi' : 'en';
let speedIndex = 1;
let paused = false;
let tDays = 0;
let view = { mode: 'overview' };
let showNames = true;
let showOrbits = true;
let cam = { pos: { x: 0, y: 140, z: 160 }, look: { x: 0, y: 0, z: 0 } };
let captionLeft = 0;
let tour = null; // { index, left }

const bodyById = (id) => BODIES.find((b) => b.id === id);
const persist = () => saveJson(`${KEY}:prefs`, { lang });

// ---- actions --------------------------------------------------------------------------------------
function narrate(id) {
  const body = bodyById(id);
  if (!body) return;
  const fact = body.fact?.[lang] ?? '';
  overlay.showCaption(body.name[lang], fact);
  captionLeft = CAPTION_S;
  say(`${body.name[lang]}. ${fact}`, { force: true, lang });
}

function goTo(id, { fromTour = false } = {}) {
  if (!fromTour) tour = null;
  view = { mode: 'focus', id };
  sound.play('whistle');
  narrate(id);
}

function setView(mode) {
  tour = null;
  view = { mode };
  const text = mode === 'sizes' ? UI_TEXT.sizes[lang] : UI_TEXT.overview[lang];
  overlay.showCaption(text, '');
  captionLeft = 4;
  say(text, { force: true, lang });
}

function startTour() {
  tour = { index: 0, left: TOUR_STOP_S };
  goTo(TOUR[0], { fromTour: true });
  hud.hideHelp();
}

function setLanguage(next) {
  lang = next;
  persist();
  remote.setLayout(solarLayout(lang));
  hud.toast(lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
  if (view.mode === 'focus') narrate(view.id);
}

function changeSpeed(delta) {
  speedIndex = Math.min(SPEEDS.length - 1, Math.max(0, speedIndex + delta));
  paused = false;
  hud.toast(`⏱ ${SPEEDS[speedIndex].label}`);
}

const ACTIONS = {
  ...Object.fromEntries(BODIES.map((b) => [`go-${b.id}`, () => goTo(b.id)])),
  overview: () => setView('overview'), top: () => setView('top'), sizes: () => setView('sizes'), tour: startTour,
  language: () => setLanguage(lang === 'en' ? 'hi' : 'en'),
  names: () => { showNames = !showNames; },
  orbits: () => { showOrbits = !showOrbits; },
  slower: () => changeSpeed(-1), faster: () => changeSpeed(1),
  pause: () => { paused = !paused; hud.toast(paused ? '⏸ Time paused' : '▶ Time running'); },
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

const remote = connectRemote({ role: 'stage', layout: solarLayout(lang), onMessage: (msg) => msg.type === 'press' && act(msg.id) });
serverInfo().then((info) => {
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(`Lie down and look up: press T for the view from above.  ${url ? `📱 ${url}` : '(online version: keyboard only)'}`);
});

// ---- loop -----------------------------------------------------------------------------------------
/** Labels under the true-size line-up. */
function sizeLabelPositions() {
  const positions = new Map();
  const v = new THREE.Vector3();
  world.sizeRow.userData.layout.forEach((item, i) => {
    // Tiny neighbours (Mercury…Mars) alternate above / below so their names don't collide.
    const above = item.r < 1 && i % 2 === 1;
    v.set(item.x, above ? item.r * 1.15 + 1.1 : -item.r * 1.15 - 0.4, 0).project(camera);
    positions.set(item.id, { x: (v.x + 1) / 2 * stage.size.w, y: (1 - v.y) / 2 * stage.size.h + 10, visible: v.z < 1, text: bodyById(item.id).name[lang] });
  });
  return positions;
}

function labelPositions() {
  if (view.mode === 'sizes') return sizeLabelPositions();
  const positions = new Map();
  const v = new THREE.Vector3();
  for (const id of LABELLED) {
    const body = bodyWorld(world, id);
    if (!body) continue;
    v.set(body.pos.x, body.pos.y - body.radius * 1.15, body.pos.z).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !(id === 'moon' && view.id !== 'earth' && view.id !== 'moon');
    positions.set(id, { x: (v.x + 1) / 2 * stage.size.w, y: (1 - v.y) / 2 * stage.size.h + 10, visible, text: bodyById(id).name[lang] });
  }
  return positions;
}

function advanceTour(dt) {
  if (!tour) return;
  const left = tour.left - dt;
  if (left > 0) {
    tour = { ...tour, left };
    return;
  }
  const index = tour.index + 1;
  if (index >= TOUR.length) {
    tour = null;
    setView('overview');
    return;
  }
  tour = { index, left: TOUR_STOP_S };
  goTo(TOUR[index], { fromTour: true });
}

stage.onFrame((dt, t) => {
  if (!paused) tDays += dt * SPEEDS[speedIndex].daysPerSecond;
  updateSolarSystem(world, tDays);
  world.system.visible = view.mode !== 'sizes';
  world.sizeRow.visible = view.mode === 'sizes';
  for (const p of world.planets) p.orbit.visible = showOrbits;
  const target = viewTarget(view, world, t);
  cam = followCamera(cam, target, dt, view.mode === 'focus' ? 2.2 : 1.2);
  camera.up.set(target.up.x, target.up.y, target.up.z);
  camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
  camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
  renderer.render(world.scene, camera);
  overlay.updateLabels(labelPositions(), showNames);
  captionLeft -= dt;
  if (captionLeft <= 0) overlay.hideCaption();
  advanceTour(dt);
  editor.draw();
});
