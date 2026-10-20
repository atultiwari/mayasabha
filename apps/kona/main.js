// Kona (कोना): a 3D illusion on an inside corner. Two walls, measured and marked once, become one
// 3D scene seen from a chosen spot: the corner breaks open into space, a cube floats out of it,
// fish swim behind glass, Saturn drifts into the room. Perfect from that spot (film it from there).
import { createStage } from '../../kit/stage.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { POINT_NAMES, defaultPoints, sanitizePoints, sanitizeRoom, viewerPosition } from './corner-geometry.js';
import { createCornerRenderer } from './corner-renderer.js';
import { CORNER_SCENES, SCENE_ORDER, THREE } from './corner-scenes.js';

const KEY = 'kona';
const HANDLE_PX = 18;
const FISH = ['fish', 'tropical-fish', 'blowfish', 'whale', 'octopus', 'turtle'];

const stage = createStage({ key: KEY, context: 'webgl' });
const hud = createHud({
  title: 'Kona: corner illusion 🧊',
  keys: [
    ['K', 'mark the corner: drag the 6 dots onto the real wall edges'],
    ['M', 'measurements: left width, right width, height (metres)'],
    ['P', 'viewer spot: distance from corner, eye height, angle'],
    ['1–4', 'Break the Wall / Floating Cube / Aquarium / Saturn'],
    ['G', 'line-up grid (10 cm squares on both walls)'],
    ['Space', 'play the scene again'],
    ['F', 'fullscreen   H hide this'],
  ],
  footer: 'The illusion is perfect from the viewer spot: stand (or film) there.',
});
const sound = createSound();
const corner = createCornerRenderer(stage.canvas, stage.size);

// ---- state ----------------------------------------------------------------------------------------
const saved = loadJson(`${KEY}:setup`) ?? {};
let room = sanitizeRoom(saved.room);
let points = sanitizePoints(saved.points) ?? defaultPoints(stage.size);
let sceneId = CORNER_SCENES[saved.scene] ? saved.scene : 'wall-break';
let marking = false;
let dragging = null;
let current = null;
let art = {};
const loader = new THREE.TextureLoader();

const persist = () => saveJson(`${KEY}:setup`, { room, points, scene: sceneId });

function buildScene() {
  const scene = new THREE.Scene();
  const built = CORNER_SCENES[sceneId].build({ room, loader, art });
  scene.add(built.group);
  current = { scene, ...built };
}

function setScene(id) {
  sceneId = id;
  persist();
  buildScene();
  sound.play('whistle');
  hud.toast(`${CORNER_SCENES[id].icon} ${CORNER_SCENES[id].label}`);
}

function askNumbers(message, keys) {
  const now = keys.map((k) => room[k]).join(', ');
  const answer = window.prompt(message, now);
  if (answer === null) return;
  const values = answer.split(/[,\s]+/).map(Number);
  const next = { ...room };
  keys.forEach((k, i) => { if (Number.isFinite(values[i])) next[k] = values[i]; });
  room = sanitizeRoom(next);
  persist();
  corner.setRoom(room);
  buildScene();
}

// ---- marking the 6 corner points (on the unwarped overlay, in screen px) -------------------------
const { overlay, octx } = stage;
const toScreen = (p) => stage.toScreen(p);

function setMarking(on) {
  marking = on;
  overlay.style.pointerEvents = on ? 'auto' : 'none';
  if (!on) octx.clearRect(0, 0, overlay.width, overlay.height);
  if (on) setScene('grid');
}

overlay.addEventListener('pointerdown', (e) => {
  if (!marking) return;
  const hit = POINT_NAMES.find((n) => {
    const s = toScreen(points[n]);
    return Math.hypot(s.x - e.clientX, s.y - e.clientY) < HANDLE_PX;
  });
  if (hit) {
    dragging = hit;
    overlay.setPointerCapture(e.pointerId);
  }
});
overlay.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  points = { ...points, [dragging]: stage.toStage({ x: e.clientX, y: e.clientY }) };
  corner.setPoints(points);
});
overlay.addEventListener('pointerup', () => {
  if (dragging) persist();
  dragging = null;
});

function drawMarks() {
  if (!marking) return;
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const s = Object.fromEntries(POINT_NAMES.map((n) => [n, toScreen(points[n])]));
  const quad = (a, b, c, d, color) => {
    octx.strokeStyle = color;
    octx.lineWidth = 2;
    octx.beginPath();
    [a, b, c, d].forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)));
    octx.closePath();
    octx.stroke();
  };
  quad(s.leftTop, s.cornerTop, s.cornerBottom, s.leftBottom, '#3ec8ff');
  quad(s.cornerTop, s.rightTop, s.rightBottom, s.cornerBottom, '#ff7ad9');
  for (const n of POINT_NAMES) {
    octx.fillStyle = n.startsWith('corner') ? '#ffd23e' : '#ffffff';
    octx.beginPath();
    octx.arc(s[n].x, s[n].y, 12, 0, Math.PI * 2);
    octx.fill();
  }
  octx.fillStyle = 'rgba(0,0,0,0.7)';
  octx.fillRect(16, 16, 640, 92);
  octx.fillStyle = '#fff';
  octx.font = '600 16px system-ui';
  octx.textAlign = 'left';
  ['MARK THE CORNER (K to finish)', 'Yellow dots: top and bottom of the corner line where the walls meet.', 'White dots: outer top and bottom edge of each wall. Grid squares = 10 cm.']
    .forEach((line, i) => octx.fillText(line, 28, 40 + i * 24));
}

// ---- controls -------------------------------------------------------------------------------------
const ACTIONS = {
  k: () => setMarking(!marking),
  m: () => askNumbers('Projected area, in metres: left wall width, right wall width, height', ['leftWidth', 'rightWidth', 'height']),
  p: () => askNumbers('Viewer spot: distance from the corner (m), eye height above the bottom of the picture (m), angle (°, + towards the right wall)', ['viewerDistance', 'eyeHeight', 'viewerAngle']),
  g: () => setScene('grid'),
  ' ': () => current?.restart(),
  f: () => stage.toggleFullscreen(),
  h: () => hud.toggleHelp(),
  ...Object.fromEntries(SCENE_ORDER.slice(0, 4).map((id, i) => [String(i + 1), () => setScene(id)])),
};

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const fn = ACTIONS[e.key.toLowerCase()];
  if (!fn) return;
  e.preventDefault();
  sound.unlock();
  fn();
});

connectRemote({
  role: 'stage',
  layout: {
    title: 'Kona 🧊',
    buttons: [
      ...SCENE_ORDER.map((id) => ({ id: `scene-${id}`, label: CORNER_SCENES[id].label, icon: CORNER_SCENES[id].icon })),
      { id: 'replay', label: 'Play again', icon: '🔁' },
    ],
  },
  onMessage: (msg) => {
    if (msg.type !== 'press') return;
    if (msg.id === 'replay') current?.restart();
    else if (msg.id.startsWith('scene-')) setScene(msg.id.slice(6));
  },
});

// ---- boot -----------------------------------------------------------------------------------------
async function boot() {
  const load = (name) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve([name, image]);
    image.onerror = () => resolve([name, null]);
    image.src = `../../assets/noto/3d-${name}.png`;
  });
  art = Object.fromEntries(await Promise.all(FISH.map(load)));
  corner.setRoom(room);
  corner.setPoints(points);
  buildScene();
  stage.onFrame((dt, t) => {
    current.update(t, dt);
    corner.render(current.scene, room, viewerPosition(room));
    drawMarks();
  });
}

boot();
