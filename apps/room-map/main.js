// Room Map: set up the wall once for every wall activity. Fit the picture to the wall (E), trace the
// real objects (T) and tag them, then preview what the activities will use (P): white shapes for
// lining up, green tops that characters can walk on, red solids that fruit bounces off.
// Pictures (e.g. a puja picture) are only outlined and are never used as solids or ledges.
import { createStage } from '../../kit/stage.js';
import { createEditor } from '../../kit/editor.js';
import { createHud } from '../../kit/hud.js';
import { ROOM_KEY, ledgesFromRoom, loadRoom, saveRoom, solidsFromRoom } from '../../kit/room/room-map.js';
import { createTracer } from '../../kit/room/tracer.js';
import { paintEffect } from '../maya-masks/effects.js';
import { effectsFor } from '../maya-masks/scenes.js';

const VIEWS = ['align', 'ledges', 'solids'];
const VIEW_NAMES = { align: 'Line-up view (white shapes)', ledges: 'Walkable tops (Room Pet, Wall Hero)', solids: 'Solid objects (Cushion Physics)' };

const stage = createStage({ key: ROOM_KEY });
const hud = createHud({
  title: 'Room Map 🗺️  set up your wall once',
  keys: [
    ['E', '1st: drag the 4 corners so the picture covers the wall'],
    ['T', '2nd: trace each real object (1 rect · 2 ellipse · 3 polygon)'],
    ['Tab', 'set the tag of the shape you just drew'],
    ['', 'tag the puja picture as "picture": it is only ever outlined'],
    ['P', 'preview: line-up / walkable tops / solid objects'],
    ['F', 'fullscreen   H hide this'],
  ],
  footer: 'Room Pet, Maya Masks and Cushion Physics (wall mode) all use this map.',
});
const editor = createEditor({ stage, ledges: false });

let shapes = loadRoom();
let view = 'align';
const tracer = createTracer({
  stage,
  getShapes: () => shapes,
  setShapes: (next) => {
    shapes = next;
    saveRoom(shapes);
  },
  onToast: (msg) => hud.toast(msg),
});

const ACTIONS = {
  e: () => { tracer.setActive(false); editor.toggle(); },
  t: () => { editor.setActive(false); tracer.toggle(); },
  p: () => {
    view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
    hud.toast(VIEW_NAMES[view]);
  },
  f: () => stage.toggleFullscreen(),
  h: () => hud.toggleHelp(),
};

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (tracer.handleKey(key) || editor.handleKey(key)) {
    e.preventDefault();
    return;
  }
  if (!ACTIONS[key]) return;
  e.preventDefault();
  ACTIONS[key]();
});

function polyline(ctx, pts, close) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

function draw(t) {
  const { ctx, size } = stage;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size.w, size.h);
  // A faint grid helps to see the whole picture area while fitting the corners.
  ctx.strokeStyle = 'rgba(80,120,255,0.25)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= size.w; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke(); }
  for (let y = 0; y <= size.h; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke(); }
  if (view === 'align') {
    for (const s of shapes) for (const name of effectsFor('align', s.tag)) paintEffect(ctx, name, s, { t });
  } else if (view === 'ledges') {
    ctx.strokeStyle = '#5cf27c';
    ctx.lineWidth = 10;
    for (const l of ledgesFromRoom(shapes)) {
      polyline(ctx, [l.a, l.b], false);
      ctx.stroke();
    }
  } else {
    for (const s of solidsFromRoom(shapes)) {
      polyline(ctx, s.points, true);
      ctx.fillStyle = 'rgba(255,80,90,0.55)';
      ctx.fill();
    }
  }
  if (!shapes.length && !tracer.active) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 44px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No objects traced yet: press E to fit the wall, then T to trace', size.w / 2, size.h / 2);
  }
}

stage.onFrame((dt, t) => {
  draw(t);
  editor.draw();
  tracer.draw();
});
