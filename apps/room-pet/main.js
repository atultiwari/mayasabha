// Room Pet: a puppy that lives on the living-room wall. It walks along ledges you draw over real
// frames and shelves, eats fruit you drop from the phone, jumps when you clap, follows visiting
// friends (elephant, monkey, mouse) and falls asleep when left alone.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { startMic } from '../../kit/mic.js';
import { connectRemote } from '../../kit/remote-link.js';
import { serverInfo } from '../../kit/server-info.js';
import { loadJson, saveJson } from '../../kit/storage.js';
import { GROUND_ID, clampToLedge, makeGround, makeLedge, removeNearest, sanitizeLedges } from '../../kit/ledges.js';
import { ROOM_KEY, ledgesFromRoom, loadRoom } from '../../kit/room/room-map.js';
import { createPet, petEvent, updatePet } from './brain.js';
import { biteFruit, removeFruit, spawnFruit, stepFruits } from './fruit.js';
import { FRIEND_KINDS, spawnFriend, stepFriends } from './friends.js';
import { spawnFx, stepFx } from '../../kit/fx.js';
import { drawScene } from './render.js';
import { DEMO_SCRIPT, HELP_KEYS, KEYS } from './controls.js';
import { loadCharacters, remoteLayout, resolveCharacters } from '../../kit/characters.js';

const KEY = 'room-pet';
// Big by default: toddlers recognise characters far better when they are large on the wall.
const PET_SIZE = { min: 150, max: 700, step: 30, initial: 330 };
const MAX_FRUIT = 10; // phone-button spam can't pile up fruit forever

const stage = createStage({ key: ROOM_KEY }); // shared wall fit, so the Room Map lines up
const hud = createHud({ title: 'Room Pet 🐶', keys: HELP_KEYS, footer: 'Phone remote: open /remote/ on the same Wi-Fi' });
const sound = createSound();

// ---- world state (replaced, never mutated) ----------------------------------------------------
const saved = loadJson('room-pet:world') ?? {};
let groundY = Number.isFinite(saved.groundY) ? saved.groundY : stage.size.h - 60;
let userLedges = sanitizeLedges(saved.ledges);
let petSize = Number.isFinite(saved.petSize) ? saved.petSize : PET_SIZE.initial;
let fruits = [];
let friends = [];
let particles = [];
let showLedges = false;
let mic = null;
let micStarting = false;

// Ledges: the floor line, ones drawn here (E), and the tops of objects traced in the Room Map.
let roomLedges = ledgesFromRoom(loadRoom());
window.addEventListener('storage', (e) => {
  if (e.key?.endsWith('room:shapes')) roomLedges = ledgesFromRoom(loadRoom()); // traced in another tab
});
const ledges = () => [makeGround(stage.size.w, groundY), ...userLedges, ...roomLedges];
const world = () => ({ ledges: ledges(), fruits, friends, width: stage.size.w });
const persist = () => saveJson('room-pet:world', { groundY, ledges: userLedges, petSize });

let pet = createPet(world(), stage.size.w / 2);

// ---- effects from the pet's brain ----------------------------------------------------------------
function applyEffects(effects) {
  for (const e of effects) {
    if (e.type === 'sound') sound.play(e.name);
    else if (e.type === 'fx') {
      const kind = e.fruitId ? fruits.find((f) => f.id === e.fruitId)?.kind : null;
      // The brain reports where the puppy stands; hearts float above its head.
      const y = e.name === 'hearts' ? e.y - petSize * 1.1 : e.y;
      particles = [...particles, ...spawnFx(e.name, e.x, y, Math.random, kind)];
    } else if (e.type === 'bite') fruits = biteFruit(fruits, e.fruitId);
    else if (e.type === 'eat') fruits = removeFruit(fruits, e.fruitId);
  }
}

function petDo(name) {
  const result = petEvent(pet, name, world());
  pet = result.state;
  applyEffects(result.effects);
}

// ---- actions (keyboard, phone, demo) -------------------------------------------------------------
function dropFruit(kind) {
  if (fruits.length >= MAX_FRUIT) return;
  // Aim at a random ledge so fruit often lands on the real frames, not only the floor.
  const all = ledges();
  const target = all[Math.floor(Math.random() * all.length)];
  const x = clampToLedge(target, target.a.x + Math.random() * (target.b.x - target.a.x), 40);
  fruits = [...fruits, spawnFruit(kind, x)];
  particles = [...particles, ...spawnFx('sparkle', x, 40)];
  sound.play('whistle');
}

function inviteFriend(kind) {
  if (friends.some((f) => f.kind === kind)) return;
  const friend = spawnFriend(kind, stage.size, groundY);
  friends = [...friends, friend];
  sound.play(FRIEND_KINDS[kind].sound);
}

async function toggleMic() {
  if (mic) {
    mic.stop();
    mic = null;
    hud.toast('🎤 Mic off');
    return;
  }
  if (micStarting) return;
  micStarting = true;
  try {
    mic = await startMic({ onClap: () => petDo('happy') });
    hud.toast('🎤 Mic on: clap to make the puppy jump!');
  } catch (err) {
    console.error('microphone failed', err);
    hud.toast(`🎤 ${err.message || 'Microphone blocked'}`, 4000);
  } finally {
    micStarting = false;
  }
}

let demoTimers = [];
function runDemo() {
  demoTimers.forEach(clearTimeout);
  hud.hideHelp();
  demoTimers = DEMO_SCRIPT.map(([s, id]) => setTimeout(() => act(id), s * 1000));
}

function resize(delta) {
  petSize = Math.min(PET_SIZE.max, Math.max(PET_SIZE.min, petSize + delta));
  persist();
}

const ACTIONS = {
  banana: () => dropFruit('banana'), apple: () => dropFruit('apple'), orange: () => dropFruit('orange'),
  elephant: () => inviteFriend('elephant'), monkey: () => inviteFriend('monkey'), mouse: () => inviteFriend('mouse'),
  penguin: () => inviteFriend('penguin'),
  happy: () => petDo('happy'), come: () => petDo('come'), bark: () => petDo('bark'), sit: () => petDo('sit'), sleep: () => petDo('sleep'),
  edit: () => editor.toggle(), ledges: () => { showLedges = !showLedges; }, fullscreen: () => stage.toggleFullscreen(),
  help: () => hud.toggleHelp(), mic: toggleMic, mute: () => hud.toast(sound.toggleMute() ? '🔇 Muted' : '🔊 Sound on'),
  demo: runDemo, smaller: () => resize(-PET_SIZE.step), bigger: () => resize(PET_SIZE.step),
};

function act(id) {
  sound.unlock();
  ACTIONS[id]?.();
}

// ---- edit mode -----------------------------------------------------------------------------------
const editor = createEditor({
  stage,
  getLedges: ledges,
  onAddLedge: (a, b) => {
    const ledge = makeLedge(`ledge-${Date.now()}`, a, b);
    if (!ledge) return hud.toast('Too short or too steep for a ledge');
    userLedges = [...userLedges, ledge];
    persist();
  },
  onDeleteNear: (p) => {
    userLedges = removeNearest(userLedges, p, 40).filter((l) => l.id !== GROUND_ID);
    persist();
  },
  onSetGround: (y) => {
    groundY = Math.min(stage.size.h - 10, Math.max(200, y));
    friends = friends.map((f) => (f.onGround ? { ...f, y: groundY, baseY: groundY } : f));
    persist();
  },
});

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

async function showRemoteAddress() {
  const info = await serverInfo();
  const [url] = info?.remoteUrls ?? [];
  hud.setFooter(url ? `📱 Phone remote: ${url}` : 'Online version: keyboard only (run it locally for the phone remote)');
}
showRemoteAddress();

const remote = connectRemote({ role: 'stage', layout: remoteLayout(resolveCharacters({})), onMessage: (msg) => msg.type === 'press' && act(msg.id) });

// ---- main loop -----------------------------------------------------------------------------------
function update(dt) {
  fruits = stepFruits(fruits, ledges(), dt, stage.size.h);
  friends = stepFriends(friends, dt, stage.size);
  const result = updatePet(pet, world(), dt);
  pet = result.state;
  applyEffects(result.effects);
  particles = stepFx(particles, dt);
}

async function start() {
  let chars;
  try {
    const loaded = await loadCharacters();
    chars = loaded.chars;
    remote.setLayout(remoteLayout(chars));
    if (loaded.problems.length) hud.toast(`⚠️ Using built-in art for ${loaded.problems.join(', ')}`, 6000);
  } catch (err) {
    console.error(err);
    hud.toast(`⚠️ ${err.message}. Is the kit server running?`, 10000);
    return;
  }
  stage.onFrame((dt, t) => {
    update(dt);
    drawScene(stage.ctx, { size: stage.size, pet, fruits, friends, particles, chars, petSize, t, showLedges: showLedges || editor.active, ledges: ledges() });
    editor.draw();
  });
}

start();
