// Drawing Daraar's creatures in bright, daylight-friendly colours: the eye that peers down the shaft
// and the long-fingered hand that reaches out of it. Motion comes from creatures.js.
import { eyeAt, handAt } from './creatures.js';

const EYE = Object.freeze({ sclera: '#fbffd0', scleraEdge: '#ffc58a', vein: '#ff2a4a', iris: ['#f2ff4a', '#5dff3a', '#00a84a'], pupil: '#9b0020', lid: '#b44dff', lidLine: '#ff2bd6' });
const HAND = Object.freeze({ skin: '#eafff6', outline: '#00ffa8', nail: '#ff2bd6', crease: '#7fd9c0', orb: ['#ffffff', '#7ff6ff', '#ff2bd6'] });

function almond(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.quadraticCurveTo(cx, cy - h, cx + w / 2, cy);
  ctx.quadraticCurveTo(cx, cy + h, cx - w / 2, cy);
  ctx.closePath();
}

/** The eye fills the far opening; k: 0..1 through the eye phase. */
export function drawEye(ctx, far, k, t) {
  const { open, look, pupil } = eyeAt(k);
  const cx = far.x + far.w / 2;
  const cy = far.y + far.h / 2;
  const w = far.w * 0.92;
  const h = far.h * 0.62 * open;
  ctx.save();
  ctx.fillStyle = EYE.lid;
  ctx.fillRect(far.x, far.y, far.w, far.h);
  if (h > 2) {
    almond(ctx, cx, cy, w, h);
    ctx.save();
    ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    g.addColorStop(0, EYE.sclera);
    g.addColorStop(1, EYE.scleraEdge);
    ctx.fillStyle = g;
    ctx.fillRect(cx - w / 2, cy - h, w, h * 2);
    ctx.strokeStyle = EYE.vein;
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.5, cy + Math.sin(a) * h);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * w * 0.32, cy + Math.sin(a + 0.4) * h * 0.6, cx + Math.cos(a) * w * 0.22, cy + Math.sin(a) * h * 0.4);
      ctx.stroke();
    }
    const r = far.h * 0.25;
    const ix = cx + look.x * w * 0.22;
    const iy = cy + look.y * far.h * 0.12;
    const ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, r);
    EYE.iris.forEach((c, i) => ig.addColorStop(i / (EYE.iris.length - 1), c));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ix, iy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EYE.pupil;
    ctx.beginPath();
    ctx.ellipse(ix, iy, r * 0.32 * pupil, r * 0.85, 0, 0, Math.PI * 2); // a slit, like a cat's: creepier than round
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ix - r * 0.35, iy - r * 0.4, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = EYE.lidLine;
  ctx.lineWidth = 10;
  ctx.shadowColor = EYE.lidLine;
  ctx.shadowBlur = 20 + Math.sin(t * 6) * 8;
  if (h > 2) almond(ctx, cx, cy, w, h);
  else {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy);
    ctx.lineTo(cx + w / 2, cy);
  }
  ctx.stroke();
  ctx.restore();
}

function outlined(ctx, draw, outlineWidth) {
  draw();
  ctx.fillStyle = HAND.skin;
  ctx.fill();
  ctx.strokeStyle = HAND.outline;
  ctx.lineWidth = outlineWidth;
  ctx.stroke();
}

/** A tapered segment from a (width wa) to b (width wb). */
function bone(ctx, a, b, wa, wb, line) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  outlined(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa / 2, a.y + ny * wa / 2);
    ctx.lineTo(b.x + nx * wb / 2, b.y + ny * wb / 2);
    ctx.lineTo(b.x - nx * wb / 2, b.y - ny * wb / 2);
    ctx.lineTo(a.x - nx * wa / 2, a.y - ny * wa / 2);
    ctx.closePath();
  }, line);
}

/** A long bony finger: three tapering joints with knuckles, bending inwards as the hand curls, and a claw. */
function finger(ctx, base, angle, length, width, curl, side, line) {
  const parts = [0.42, 0.32, 0.26];
  const widths = [width, width * 0.78, width * 0.58, width * 0.4];
  let a = angle;
  let p = base;
  parts.forEach((f, i) => {
    const q = { x: p.x + Math.cos(a) * length * f, y: p.y + Math.sin(a) * length * f };
    bone(ctx, p, q, widths[i], widths[i + 1], line);
    outlined(ctx, () => { ctx.beginPath(); ctx.arc(q.x, q.y, widths[i + 1] * 0.62, 0, Math.PI * 2); }, line); // knuckle
    p = q;
    a += (0.12 + curl * 0.9) * side;
  });
  const tipW = widths[3];
  const tip = { x: p.x + Math.cos(a) * tipW * 2.2, y: p.y + Math.sin(a) * tipW * 2.2 };
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(p.x + nx * tipW * 0.55, p.y + ny * tipW * 0.55);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(p.x - nx * tipW * 0.55, p.y - ny * tipW * 0.55);
  ctx.closePath();
  ctx.fillStyle = HAND.nail;
  ctx.fill();
  ctx.strokeStyle = HAND.outline;
  ctx.lineWidth = line * 0.6;
  ctx.stroke();
}

/** The hand reaches out of the far opening towards you, over the rim; k: 0..1 through the hand phase. */
export function drawHand(ctx, hole, far, k, t) {
  const { scale, reach, spread, curl } = handAt(k);
  const fc = { x: far.x + far.w / 2, y: far.y + far.h / 2 };
  const pw = far.w * 0.3 * scale; // palm width
  const palm = { x: fc.x, y: fc.y + hole.h * 0.14 * reach };
  const line = Math.max(2, pw * 0.035);
  const wrist = { x: palm.x, y: palm.y + pw * 0.62 };
  ctx.save();
  bone(ctx, { x: fc.x, y: fc.y + far.h * 0.1 }, wrist, pw * 0.25, pw * 0.42, line); // the arm, out of the far opening
  ctx.strokeStyle = HAND.crease;
  ctx.lineWidth = line;
  ctx.beginPath(); // veins
  ctx.moveTo(wrist.x - pw * 0.08, wrist.y);
  ctx.quadraticCurveTo(wrist.x - pw * 0.15, (wrist.y + fc.y) / 2, fc.x - pw * 0.04, fc.y + far.h * 0.15);
  ctx.moveTo(wrist.x + pw * 0.1, wrist.y);
  ctx.quadraticCurveTo(wrist.x + pw * 0.02, (wrist.y + fc.y) / 2, fc.x + pw * 0.06, fc.y + far.h * 0.15);
  ctx.stroke();
  // a bony palm: wide at the knuckles, narrow at the wrist
  const knuckleY = palm.y - pw * 0.42;
  outlined(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(palm.x - pw * 0.5, knuckleY);
    ctx.quadraticCurveTo(palm.x, knuckleY - pw * 0.12, palm.x + pw * 0.5, knuckleY);
    ctx.quadraticCurveTo(palm.x + pw * 0.48, palm.y + pw * 0.3, wrist.x + pw * 0.22, wrist.y);
    ctx.lineTo(wrist.x - pw * 0.22, wrist.y);
    ctx.quadraticCurveTo(palm.x - pw * 0.48, palm.y + pw * 0.3, palm.x - pw * 0.5, knuckleY);
    ctx.closePath();
  }, line);
  const fingerW = pw * 0.14;
  const length = pw * (1.5 - curl * 0.55);
  for (let i = 0; i < 4; i += 1) {
    const a = -Math.PI / 2 + (i - 1.5) * (0.16 + 0.24 * spread); // fingers fan out upwards, towards the rim
    const base = { x: palm.x + (i - 1.5) * pw * 0.27, y: knuckleY };
    finger(ctx, base, a, length * [0.82, 1, 0.95, 0.75][i], fingerW, curl, i < 2 ? 1 : -1, line);
  }
  finger(ctx, { x: palm.x - pw * 0.46, y: palm.y + pw * 0.05 }, Math.PI * 1.08 - spread * 0.45, length * 0.62, fingerW * 1.15, curl, 1, line);
  ctx.strokeStyle = HAND.crease;
  ctx.lineWidth = line;
  for (let i = 0; i < 2; i += 1) {
    ctx.beginPath();
    ctx.arc(palm.x, palm.y + pw * (0.05 + i * 0.16), pw * (0.32 - i * 0.06), Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // the orb in the palm
  const r = pw * 0.24 * (1 + 0.12 * Math.sin(t * 6));
  const g = ctx.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, r);
  HAND.orb.forEach((c, i) => g.addColorStop(i / (HAND.orb.length - 1), c));
  ctx.shadowColor = HAND.orb[1];
  ctx.shadowBlur = 40;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(palm.x, palm.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
