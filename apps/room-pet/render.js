// Draws the room-pet scene on a black stage. Characters are flat images (Noto 3D emoji or your own) brought to
// life with "paper puppet" motion: squash and stretch, bobbing, tilting and flipping.
import { FRUIT } from './fruit.js';
import { drawFx } from '../../kit/fx.js';

/** Body pose for the puppy's current mode. Returns offsets in units of `size`. */
export function petPose(pet, t, size) {
  const m = pet.modeT;
  switch (pet.mode) {
    case 'walk': {
      const phase = (pet.stride / (size * 0.42)) * Math.PI;
      const s = Math.abs(Math.sin(phase));
      return { lift: s * 0.1, sx: 1 / (0.94 + 0.1 * s), sy: 0.94 + 0.1 * s, rot: 0.07 * Math.cos(phase) };
    }
    case 'hop': {
      const p = Math.min(1, m / pet.hop.dur);
      const st = 1 + 0.15 * Math.sin(Math.PI * p);
      return { lift: 0, sx: 1 / st, sy: st, rot: -0.3 * Math.cos(Math.PI * p) };
    }
    case 'happy': {
      const local = (m % 0.55) / 0.55;
      const up = Math.sin(Math.PI * local);
      return { lift: up * 0.35, sx: 1 / (0.9 + 0.2 * up), sy: 0.9 + 0.2 * up, rot: 0.15 * Math.sin(m * 9) };
    }
    case 'bark': return { lift: 0, sx: 1, sy: 1 + 0.08 * Math.abs(Math.sin(m * 22)), rot: -0.08 };
    case 'eat': return { lift: 0, sx: 1.03, sy: 0.97, rot: 0.22 * Math.abs(Math.sin(m * 7)) };
    case 'sit': return { lift: 0, sx: 1.06, sy: 0.9 + 0.012 * Math.sin(t * 3), rot: 0 };
    case 'sleep': return { lift: 0, sx: 1.12, sy: 0.8 + 0.025 * Math.sin(t * 1.6), rot: 0.06 };
    default: return { lift: 0, sx: 1, sy: 1 + 0.015 * Math.sin(t * 3), rot: 0 };
  }
}

/**
 * Draws a character standing on (x, y): `size` is its height (width follows the picture's shape),
 * scaled and rotated about its feet, and mirrored so it looks towards `facing` (-1 left, 1 right).
 */
function drawStanding(ctx, art, x, y, size, { sx = 1, sy = 1, rot = 0, facing = -1, alpha = 1, img = art.img }) {
  const width = size * (img.width / img.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + size * art.footPad * sy);
  ctx.scale(facing * art.facing * sx, sy);
  ctx.rotate(rot);
  ctx.drawImage(img, -width / 2, -size, width, size);
  ctx.restore();
}

function drawZzz(ctx, pet, t, size) {
  ctx.fillStyle = '#bfe3ff';
  ctx.textAlign = 'center';
  for (let k = 0; k < 3; k += 1) {
    const phase = (t * 0.45 + k / 3) % 1;
    ctx.globalAlpha = 1 - phase;
    ctx.font = `800 ${Math.round(size * 0.16 + phase * size * 0.18)}px system-ui, sans-serif`;
    ctx.fillText('Z', pet.x + pet.facing * size * 0.3 + phase * 50, pet.y - size * 0.8 - phase * 110);
  }
  ctx.globalAlpha = 1;
}

function drawPet(ctx, pet, art, t, baseSize) {
  const size = baseSize * art.scale;
  const pose = petPose(pet, t, size);
  const joyful = (pet.mode === 'happy' || pet.mode === 'bark') && art.happyImg;
  const img = joyful ? art.happyImg : art.img;
  drawStanding(ctx, art, pet.x, pet.y - pose.lift * size, size, { ...pose, facing: pet.facing, img });
  if (pet.mode === 'sleep') drawZzz(ctx, pet, t, size);
}

function drawFruit(ctx, fruit, chars) {
  const art = chars[fruit.kind];
  const size = FRUIT.size * art.scale * (1 - fruit.bites * 0.24);
  const width = size * (art.img.width / art.img.height);
  ctx.save();
  ctx.translate(fruit.x, fruit.y - size / 2 + size * 0.04);
  ctx.rotate(fruit.rot);
  ctx.drawImage(art.img, -width / 2, -size / 2, width, size);
  ctx.restore();
}

function drawFriend(ctx, f, chars) {
  const art = chars[f.kind];
  const size = f.size * art.scale;
  if (f.kind === 'monkey') {
    // A vine from the ceiling to the monkey's hands.
    ctx.strokeStyle = '#5fbf4a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(f.x - f.dir * 120, 0);
    ctx.quadraticCurveTo(f.x - f.dir * 40, (f.y - size) / 2, f.x, f.y - size * 0.85);
    ctx.stroke();
    drawStanding(ctx, art, f.x, f.y, size, { facing: f.dir, rot: 0.25 * Math.sin(f.t * 2.2) });
    return;
  }
  const MOTION = {
    elephant: { bob: Math.abs(Math.sin(f.t * 4)) * 12, sway: 0.07 * Math.sin(f.t * 2) },
    penguin: { bob: Math.abs(Math.sin(f.t * 8)) * 8, sway: 0.2 * Math.sin(f.t * 8) }, // waddle
    mouse: { bob: Math.abs(Math.sin(f.t * 18)) * 6, sway: 0 },
  };
  const { bob, sway } = MOTION[f.kind] ?? MOTION.mouse;
  drawStanding(ctx, art, f.x, f.y - bob, size, { facing: f.dir, rot: sway });
}

function drawLedges(ctx, ledges) {
  ctx.strokeStyle = 'rgba(62, 224, 255, 0.6)';
  ctx.lineWidth = 4;
  for (const l of ledges) {
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
  }
}

/** Draws one frame. */
export function drawScene(ctx, scene) {
  const { size, pet, fruits, friends, particles, chars, petSize, t, showLedges, ledges } = scene;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size.w, size.h);
  if (showLedges) drawLedges(ctx, ledges);
  for (const f of friends) drawFriend(ctx, f, chars);
  for (const fruit of fruits) drawFruit(ctx, fruit, chars);
  drawPet(ctx, pet, chars.pet, t, petSize);
  drawFx(ctx, particles);
}
