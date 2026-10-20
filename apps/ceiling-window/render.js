// Draws the ceiling window: the scene inside the far opening, a character peeking over its edge,
// then the shaft walls on top, shading from black at the rim (so the projection edge disappears
// into the real ceiling) to the scene's light at the far end.
import { depthRings, shaftWalls, toFar } from './shaft.js';
import { kindSpec } from './drifters.js';
import { peekReveal } from './peek.js';

const PEEK_SIZE = 0.95; // of the far-opening height
const PEEK_DEPTH = 0.55; // how much of the character leans in at full reveal
const WALL_SHADE = { top: 0.0, right: 0.18, bottom: 0.35, left: 0.1 }; // extra darkness per wall
const RING_COUNT = 5;

function clipTo(ctx, r) {
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

function drawBackground(ctx, far, recipe, t) {
  const g = ctx.createLinearGradient(0, far.y, 0, far.y + far.h);
  g.addColorStop(0, recipe.sky[0]);
  g.addColorStop(1, recipe.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(far.x, far.y, far.w, far.h);
  if (!recipe.rays) return;
  // Under water: slow swaying light rays.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i += 1) {
    const x = far.x + far.w * (0.1 + i * 0.2) + Math.sin(t * 0.4 + i) * far.w * 0.05;
    const ray = ctx.createLinearGradient(x, far.y, x, far.y + far.h);
    ray.addColorStop(0, 'rgba(180,255,255,0.18)');
    ray.addColorStop(1, 'rgba(180,255,255,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - far.w * 0.03, far.y);
    ctx.lineTo(x + far.w * 0.03, far.y);
    ctx.lineTo(x + far.w * 0.12, far.y + far.h);
    ctx.lineTo(x - far.w * 0.06, far.y + far.h);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawDrawn(ctx, d, far, px, size) {
  if (d.kind === 'twinkle') {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(d.age * 1.8 + d.phase));
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(px.x, px.y, Math.max(1.5, size), 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === 'bubble') {
    ctx.globalAlpha = 0.7 * d.scale + 0.2;
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = Math.max(1.5, size * 0.15);
    ctx.beginPath();
    ctx.arc(px.x + Math.sin(d.age * 3 + d.phase) * 6, px.y, size, 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.kind === 'shooting' && d.age >= 0) {
    const len = d.size * far.w;
    const speed = Math.hypot(d.vx, d.vy);
    const tail = { x: px.x - (d.vx / speed) * len, y: px.y - (d.vy / speed) * len };
    const g = ctx.createLinearGradient(px.x, px.y, tail.x, tail.y);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px.x, px.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawDrifter(ctx, d, far, art) {
  const spec = kindSpec(d.kind);
  const size = d.size * far.h * d.scale;
  const wobble = spec.wobble ? Math.sin(d.age * 2 + d.phase) * far.h * 0.012 : 0;
  const px = toFar(far, d.x, d.y);
  if (spec.drawn) return drawDrawn(ctx, d, far, { x: px.x, y: px.y + wobble }, size);
  const img = art[d.kind];
  if (!img) return undefined;
  const flap = spec.flap ? 0.7 + 0.3 * Math.abs(Math.sin(d.age * 9 + d.phase)) : 1;
  const bob = d.kind === 'star' ? 0.9 + 0.1 * Math.sin(d.age * 2 + d.phase) : 1;
  ctx.save();
  ctx.translate(px.x, px.y + wobble);
  ctx.rotate(spec.wobble ? Math.sin(d.age * 1.5 + d.phase) * 0.08 : 0);
  ctx.scale((d.vx > 0 ? -1 : 1) * bob, flap * bob); // emoji art faces left
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return undefined;
}

const EDGE_ANGLE = { bottom: 0, left: Math.PI / 2, top: Math.PI, right: -Math.PI / 2 };

function edgePoint(far, edge, along) {
  if (edge === 'top') return toFar(far, along, 0);
  if (edge === 'bottom') return toFar(far, along, 1);
  if (edge === 'left') return toFar(far, 0, along);
  return toFar(far, 1, along);
}

/** The character stands beyond the edge with its head leaning into the opening, looking down at us. */
function drawPeek(ctx, peek, far, chars) {
  const art = chars[peek.role];
  if (!art) return;
  const img = peek.phase !== 'in' && art.happyImg ? art.happyImg : art.img;
  const size = far.h * PEEK_SIZE * Math.min(1.3, art.scale);
  const width = size * (img.width / img.height);
  const visible = peekReveal(peek) * size * PEEK_DEPTH;
  const p = edgePoint(far, peek.edge, peek.along);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(EDGE_ANGLE[peek.edge] + Math.sin(peek.total * 1.7) * 0.1);
  ctx.drawImage(img, -width / 2, -visible, width, size);
  ctx.restore();
}

function fillPolygon(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function drawWalls(ctx, stage, far, tint) {
  const walls = shaftWalls(stage, far);
  for (const [name, [r0, r1, f1, f0]] of Object.entries(walls)) {
    const from = mid(r0, r1);
    const to = mid(f0, f1);
    const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    g.addColorStop(0, '#000');
    g.addColorStop(0.35, '#050505');
    g.addColorStop(1, tint);
    ctx.fillStyle = g;
    fillPolygon(ctx, [r0, r1, f1, f0]);
    ctx.fillStyle = `rgba(0,0,0,${WALL_SHADE[name]})`;
    fillPolygon(ctx, [r0, r1, f1, f0]);
  }
  // Faint depth rings and corner seams give the shaft its structure.
  ctx.lineWidth = 2;
  depthRings(stage, far, RING_COUNT).forEach((r, i) => {
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + 0.03 * (i / RING_COUNT)})`;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (const [, [r0, , , f0]] of Object.entries(walls)) {
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(f0.x, f0.y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; // light catching the far lip
  ctx.strokeRect(far.x, far.y, far.w, far.h);
}

/** One frame. `dim` (0..1) darkens everything for scene fades and bedtime. */
export function drawCeiling(ctx, { stage, far, recipe, drifters, art, chars, peek, t, dim }) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.w, stage.h);
  ctx.save();
  clipTo(ctx, far);
  drawBackground(ctx, far, recipe, t);
  for (const d of drifters) drawDrifter(ctx, d, far, art);
  if (peek) drawPeek(ctx, peek, far, chars);
  ctx.restore();
  drawWalls(ctx, stage, far, recipe.wall);
  if (dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dim)})`;
    ctx.fillRect(0, 0, stage.w, stage.h);
  }
}
