// Janamdin (जन्मदिन): a birthday show on the living-room wall, made from the little one for Dadu. A
// garland and glow appear round the puja picture (never over it), "Happy Birthday" bunting drops in,
// the name bounces in, a cake appears on the real sofa back and the song plays. Blow the candles out
// (microphone, or B), and fireworks, confetti, balloons and Masha and Bear with a sign take over.
// In the address: ?name=Dadu&candles=7&sign=…&lang=hi
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { createSound } from '../../kit/sound.js';
import { connectRemote } from '../../kit/remote-link.js';
import { startMic } from '../../kit/mic.js';
import { setSpeechMuted } from '../../kit/speech.js';
import { loadCharacters } from '../../kit/characters.js';
import { ROOM_KEY, loadRoom } from '../../kit/room/room-map.js';
import { bbox } from '../../kit/room/shapes.js';
import { paintEffect } from '../maya-masks/effects.js';
import { spawnBurst, stepBursts } from '../maya-masks/fireworks.js';
import { nextShow, phaseAt, phaseStart } from './show.js';
import { birthdayLayout } from './layout.js';
import { lyric, notesBetween, tuneLength } from './tune.js';
import { feedBlow, initialBlow } from './blow.js';
import { drawBunting, drawCake, drawName } from './decor.js';
import { balloonZones, drawBalloons, drawConfetti, drawFireworks, drawFriends, spawnBalloon, spawnConfetti, stepBalloons, stepConfetti } from './party.js';
import { HELP_KEYS, KEYS, LAYOUT, WORDS } from './controls.js';

const KEY = 'janamdin';
const params = new URLSearchParams(location.search);
let lang = params.get('lang') === 'hi' ? 'hi' : 'en';
const nameOf = () => (params.get('name') || WORDS[lang].name).slice(0, 16);
const signOf = () => (params.get('sign') || WORDS[lang].sign(nameOf())).slice(0, 40);
const CANDLES = Math.min(12, Math.max(1, Number(params.get('candles')) || 5));
const BALLOONS = 16;

const room = loadRoom();
const stage = createStage({ key: room.length ? ROOM_KEY : KEY });
const hud = createHud({ title: 'Happy Birthday 🎂', keys: HELP_KEYS, footer: 'Space starts the show. M: blow the candles out for real.' });
const sound = createSound();
const editor = createEditor({ stage, ledges: false });
const layout = birthdayLayout(stage.size, room);
const zones = balloonZones(stage.size, layout.picture ? bbox(layout.picture) : null);

// ---- state (replaced, never mutated) ----------------------------------------------------------
let show = null; // { t, blown } once started
let blow = initialBlow();
let outFor = 0;
let songT = null; // seconds into the song, or null
let bursts = [];
let confetti = [];
let balloons = [];
let nextBurst = 0;
let micLevel = 0;
let mic = null;
let chars = null;

function start() {
  show = { t: 0, blown: false };
  blow = initialBlow();
  outFor = 0;
  songT = null;
  bursts = [];
  confetti = [];
  balloons = [];
  hud.hideHelp();
}

function blowOut() {
  if (!show || phaseAt(show.t).name !== 'wish') return;
  show = { ...show, blown: true };
}

async function toggleMic() {
  if (mic) {
    mic.stop();
    mic = null;
    hud.toast('🎤 Mic off');
    return;
  }
  try {
    mic = await startMic({ onClap: () => {}, onLevel: (level) => { micLevel = level; } });
    hud.toast('🎤 Mic on: blow the candles out!');
  } catch (err) {
    console.error(err);
    hud.toast('⚠️ Could not use the microphone. B blows the candles out instead.');
  }
}

const ACTIONS = {
  start, blow: blowOut, mic: toggleMic,
  song: () => { if (show) songT = 0; },
  language: () => { lang = lang === 'en' ? 'hi' : 'en'; hud.toast(lang === 'en' ? 'English' : 'हिन्दी'); },
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

// ---- loop ------------------------------------------------------------------------------------
function fireworkSpot() {
  const [a, b] = zones[Math.floor(Math.random() * zones.length)];
  return { x: a + Math.random() * (b - a), y: layout.bunting.y + layout.bunting.h + Math.random() * 260 };
}

function update(dt) {
  if (!show) return;
  const before = phaseAt(show.t).name;
  show = nextShow(show, dt);
  const phase = phaseAt(show.t).name;
  if (phase === 'wish' && before !== 'wish') songT = 0;
  if (songT !== null) {
    const next = songT + dt;
    for (const n of notesBetween(songT, next)) sound.tone(n.freq);
    songT = next > tuneLength() + 1 ? null : next;
  }
  if (phase === 'wish' && !show.blown) {
    blow = feedBlow(blow, mic ? micLevel : 0, dt);
    if (blow.out) blowOut();
  }
  if (phase === 'celebrate' && before === 'wish') {
    sound.play('chime');
    confetti = spawnConfetti(stage.size, 220);
    balloons = Array.from({ length: BALLOONS }, () => spawnBalloon(stage.size, zones, Math.random, true));
  }
  if (phase === 'celebrate' || phase === 'balloons') {
    outFor += dt;
    nextBurst -= dt;
    if (nextBurst <= 0) {
      bursts = [...bursts, spawnBurst(fireworkSpot(), 46)];
      sound.play('pop');
      nextBurst = phase === 'celebrate' ? 0.55 : 2.8;
    }
    if (phase === 'balloons' && confetti.length < 40) confetti = [...confetti, ...spawnConfetti(stage.size, 6)];
  }
  bursts = stepBursts(bursts, dt);
  confetti = stepConfetti(confetti, dt, stage.size);
  balloons = stepBalloons(balloons, dt, stage.size, zones);
}

function draw(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.size.w, stage.size.h);
  if (!show) return;
  const { name: phase } = phaseAt(show.t);
  const since = (p) => show.t - phaseStart(p);
  if (layout.picture && since('frame') > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, since('frame') / 2);
    for (const fx of ['gold-border', 'garland']) paintEffect(ctx, fx, layout.picture, { t, sceneT: show.t, lang });
    ctx.restore();
  }
  drawBalloons(ctx, balloons); // behind everything else
  if (since('bunting') > 0) drawBunting(ctx, layout.bunting, since('bunting'), t, lang);
  if (since('name') > 0) drawName(ctx, layout.name, since('name'), t, nameOf());
  if (since('cake') > 0) {
    const lit = !show.blown && phase !== 'celebrate' && phase !== 'balloons';
    drawCake(ctx, layout.cake, since('cake') / 1.5, t, { count: CANDLES, lit, blowing: blow.flicker, outFor });
  }
  if (since('balloons') > 0) drawFriends(ctx, layout.friends, since('balloons') / 1.2, t, chars, signOf());
  drawFireworks(ctx, bursts);
  drawConfetti(ctx, confetti);
  const words = songT !== null ? lyric(songT, nameOf(), lang) : phase === 'wish' ? WORDS[lang].blow : '';
  if (words) {
    ctx.save();
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,200,80,0.8)';
    ctx.shadowBlur = 16;
    ctx.fillText(words, layout.cake.x + layout.cake.w / 2, layout.cake.y - 24);
    ctx.restore();
  }
}

async function main() {
  try {
    chars = (await loadCharacters()).chars;
  } catch (err) {
    console.error(err);
    hud.toast('⚠️ Character pictures missing: Masha and Bear will be absent', 6000);
  }
  stage.onFrame((dt, t) => {
    update(dt);
    draw(stage.ctx, t);
    editor.draw();
  });
}

main();
