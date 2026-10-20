// Drawing the ceiling breach. Everything is bright and saturated: a projector can't show black, so in
// daylight only light colours read on the ceiling. The inside of the hole glows instead of going dark.
import { partial } from './cracks.js';
import { drawEye, drawHand } from './creatures-draw.js';

export const PALETTE = Object.freeze({
  crack: '#00f6ff', crackCore: '#ffffff', frame: '#ff2bd6', frameCore: '#fff0fb',
  wallNear: '#6a2cff', wallFar: '#ff4fd8', ring: '#00f6ff', boltA: '#ff2a2a', boltB: '#00f6ff',
  portal: ['#fff6a0', '#ff2bd6', '#7a2bff', '#00e5ff'],
});

const FAR_SCALE = 0.42; // the far opening, relative to the hole

/** The eye presses up close: most of the hole, not just the far opening. */
export function eyeRect(hole, far, k = 0.6) {
  return { x: far.x + (hole.x - far.x) * k, y: far.y + (hole.y - far.y) * k, w: far.w + (hole.w - far.w) * k, h: far.h + (hole.h - far.h) * k };
}

export function farOf(hole) {
  const w = hole.w * FAR_SCALE;
  const h = hole.h * FAR_SCALE;
  return { x: hole.x + (hole.w - w) / 2, y: hole.y + (hole.h - h) / 2, w, h };
}

const cornersOf = (r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];

function strokePath(ctx, points, width, color, core) {
  if (points.length < 2) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 3;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = core;
  ctx.lineWidth = width * 0.35;
  ctx.stroke();
  ctx.restore();
}

const finished = new WeakMap(); // cracks -> canvas with them fully drawn (glow is costly to redraw every frame)

function finishedCracks(cracks, size) {
  if (!finished.has(cracks)) {
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    paintCracks(canvas.getContext('2d'), cracks, 1, true);
    finished.set(cracks, canvas);
  }
  return finished.get(cracks);
}

/** Cracks grow during the cracks phase (k 0..1); each starts when its parent reaches it. */
export function drawCracks(ctx, cracks, k, flicker, size) {
  if (k >= 1 && size) ctx.drawImage(finishedCracks(cracks, size), 0, 0);
  else paintCracks(ctx, cracks, k, flicker);
}

function paintCracks(ctx, cracks, k, flicker) {
  for (const c of cracks) {
    const grow = (k - c.start) / (1 - c.start);
    if (grow <= 0) continue;
    strokePath(ctx, partial(c.points, Math.min(1, grow)), c.start === 0 ? 12 : 7, PALETTE.crack, flicker ? PALETTE.crackCore : '#b8fcff');
  }
}

/** The frame crack races round from the top-left corner in both directions at once. */
export function drawFrame(ctx, frame, k) {
  const half = Math.ceil(frame.length / 2);
  const cw = frame.slice(0, half + 1);
  const ccw = [...frame].reverse().slice(0, frame.length - half);
  strokePath(ctx, partial(cw, k), 14, PALETTE.frame, PALETTE.frameCore);
  strokePath(ctx, partial(ccw, k), 14, PALETTE.frame, PALETTE.frameCore);
}

function quad(ctx, pts, fill) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** The glowing portal at the far end: bright rings and turning spiral arms. */
export function drawPortal(ctx, far, t, strength = 1) {
  const cx = far.x + far.w / 2;
  const cy = far.y + far.h / 2;
  const r = Math.hypot(far.w, far.h) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(far.x, far.y, far.w, far.h);
  ctx.clip();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  PALETTE.portal.forEach((c, i) => g.addColorStop(i / (PALETTE.portal.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(far.x, far.y, far.w, far.h);
  ctx.globalAlpha = 0.7 * strength;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  for (let arm = 0; arm < 5; arm += 1) {
    ctx.beginPath();
    for (let s = 0; s <= 40; s += 1) {
      const a = t * 1.4 + (arm / 5) * Math.PI * 2 + s * 0.16;
      const rr = (s / 40) * r;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (s) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function bolt(ctx, a, b, color, t, seed) {
  const pts = [];
  const n = 14;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len; // wobble across the edge, like lightning, not along it
  const ny = (b.x - a.x) / len;
  for (let i = 0; i <= n; i += 1) {
    const k = i / n;
    const j = i === 0 || i === n ? 0 : (Math.sin(t * 43 + seed * 7 + i * 2.3) + Math.sin(t * 71 + i * 5.7)) * 11;
    pts.push({ x: a.x + (b.x - a.x) * k + nx * j, y: a.y + (b.y - a.y) * k + ny * j });
  }
  strokePath(ctx, pts, 8, color, '#ffffff');
}

/** The shaft: four bright walls from the hole's rim to the far opening, rings, and racing bolts. */
export function drawShaft(ctx, hole, far, t, open) {
  const rim = cornersOf(hole);
  const end = cornersOf(far);
  for (let i = 0; i < 4; i += 1) {
    const a = rim[i];
    const b = rim[(i + 1) % 4];
    const g = ctx.createLinearGradient((a.x + b.x) / 2, (a.y + b.y) / 2, (end[i].x + end[(i + 1) % 4].x) / 2, (end[i].y + end[(i + 1) % 4].y) / 2);
    g.addColorStop(0, PALETTE.wallNear);
    g.addColorStop(1, PALETTE.wallFar);
    quad(ctx, [a, b, end[(i + 1) % 4], end[i]], g);
  }
  // depth rings, moving towards you
  ctx.save();
  ctx.strokeStyle = PALETTE.ring;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.8;
  for (let s = 0; s < 5; s += 1) {
    const k = ((s + t * 0.6) % 5) / 5;
    const f = k * k;
    const r = {
      x: far.x + (hole.x - far.x) * f, y: far.y + (hole.y - far.y) * f,
      w: far.w + (hole.w - far.w) * f, h: far.h + (hole.h - far.h) * f,
    };
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
  // electricity racing down the four edges
  for (let i = 0; i < 4; i += 1) {
    const reach = Math.min(1, open * 1.5 - i * 0.1);
    if (reach <= 0) continue;
    const from = rim[i];
    const to = { x: from.x + (end[i].x - from.x) * reach, y: from.y + (end[i].y - from.y) * reach };
    bolt(ctx, from, to, i % 2 ? PALETTE.boltB : PALETTE.boltA, t, i);
  }
}

/** Shards of ceiling falling towards you: they grow, spin and fade. */
export function drawShards(ctx, shards, hole, k) {
  const cx = hole.x + hole.w / 2;
  const cy = hole.y + hole.h / 2;
  for (const s of shards) {
    const f = Math.max(0, Math.min(1, (k - s.delay) / (1 - s.delay)));
    const mx = (s.points[0].x + s.points[1].x + s.points[2].x) / 3;
    const my = (s.points[0].y + s.points[1].y + s.points[2].y) / 3;
    ctx.save();
    ctx.globalAlpha = 1 - f;
    ctx.translate(mx + (mx - cx) * f * 1.6, my + (my - cy) * f * 1.6);
    ctx.rotate(s.spin * f);
    ctx.scale(1 + f * 1.8, 1 + f * 1.8);
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x - mx, p.y - my) : ctx.moveTo(p.x - mx, p.y - my)));
    ctx.closePath();
    ctx.fillStyle = '#d9d4dc';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = PALETTE.crack;
    ctx.stroke();
    ctx.restore();
  }
}

/** One frame. v: { stage, phase: { name, k, local }, t, hole, far, cracks, frame, shards } */
export function drawBreach(ctx, v) {
  const { stage, phase, t, hole, far } = v;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.w, stage.h);
  const { name, k } = phase;
  const flicker = Math.sin(t * 37) > -0.2;
  const after = (p) => ['cracks', 'frame', 'break', 'shaft', 'eye', 'hand'].indexOf(name) >= ['cracks', 'frame', 'break', 'shaft', 'eye', 'hand'].indexOf(p);
  if (name === 'calm' || name === 'done') return;
  if (name === 'snap') {
    ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
    ctx.fillRect(0, 0, stage.w, stage.h);
    return;
  }
  const opened = after('break');
  if (opened) {
    const open = name === 'break' ? k : 1;
    drawShaft(ctx, hole, far, t, name === 'break' ? 0 : Math.min(1, (name === 'shaft' ? k : 1) * 1.2));
    drawPortal(ctx, far, t, open);
    if (name === 'eye') drawEye(ctx, eyeRect(hole, far), phase.k, t);
    if (name === 'break') drawShards(ctx, v.shards, hole, k);
  }
  ctx.save();
  if (opened) {
    // the ceiling inside the hole has fallen out: cracks remain only on the ceiling around it
    ctx.beginPath();
    ctx.rect(0, 0, stage.w, stage.h);
    ctx.rect(hole.x, hole.y + hole.h, hole.w, -hole.h); // opposite winding cuts the hole out
    ctx.clip('evenodd');
  }
  drawCracks(ctx, v.cracks, name === 'cracks' ? k : 1, flicker, stage);
  ctx.restore();
  if (after('frame')) drawFrame(ctx, v.frame, name === 'frame' ? k : 1);
  if (name === 'hand') drawHand(ctx, hole, far, phase.k, t);
}
