// Drawing for Kadam Taal: a glowing lane board on the floor, notes travelling down to big pads at
// the near edge, and pop-up judgements ("PERFECT", "+600 STREAK"). Bright neon on black, so it reads
// on the floor even with some light in the room.
import { drawFx } from '../../kit/fx.js';
import { KID, progressOf } from './chart.js';

export const LANE_COLORS = Object.freeze(['#ff4d6d', '#ffd23e', '#5cf27c', '#3ec8ff']);
const KID_COLORS = Object.freeze(['#ff4d6d', '#ffd23e', '#3ec8ff']);
export const KID_FRIENDS = Object.freeze(['pet', 'elephant', 'monkey']);
export const KID_FRUIT = Object.freeze(['apple', 'banana', 'orange']);

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A picture, or a bright circle in its colour when the picture couldn't load (the game stays playable). */
function drawImageFit(ctx, img, cx, cy, height, fallback = '#ffffff') {
  if (!img) {
    ctx.save();
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(cx, cy, height * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const w = height * (img.width / img.height);
  ctx.drawImage(img, cx - w / 2, cy - height / 2, w, height);
}

function drawBoard(ctx, layout, colors) {
  const { board, pads } = layout;
  ctx.save();
  glow(ctx, '#a66bff', 24);
  ctx.strokeStyle = '#b48cff';
  ctx.lineWidth = 6;
  roundRect(ctx, board.x, board.y, board.w, board.h, 18);
  ctx.stroke();
  ctx.restore();
  // dotted guide down each lane, like the reference
  pads.forEach((pad, i) => {
    ctx.fillStyle = `${colors[i]}66`;
    for (let y = board.y + 30; y < pad.y - 20; y += 34) {
      ctx.beginPath();
      ctx.arc(pad.cx, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawPads(ctx, layout, colors, flashes, friends) {
  layout.pads.forEach((pad, i) => {
    const flash = flashes[i] ?? 0;
    const grow = 1 + flash * 0.06;
    const w = pad.w * grow;
    const h = pad.h * grow;
    ctx.save();
    glow(ctx, colors[i], 30 + flash * 40);
    ctx.fillStyle = `${colors[i]}${flash > 0 ? 'cc' : '55'}`;
    roundRect(ctx, pad.cx - w / 2, pad.cy - h / 2, w, h, 28);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = colors[i];
    ctx.stroke();
    ctx.restore();
    if (friends) drawImageFit(ctx, friends[i], pad.cx, pad.cy - flash * 30, h * 0.8, '#ffffff');
  });
}

function drawKidNotes(ctx, layout, notes, fruit, t) {
  const { board, pads } = layout;
  for (const n of notes) {
    const pad = pads[n.lane];
    const top = board.y + 60;
    const stop = pad.y - pad.h * 0.25;
    const y = top + (stop - top) * n.progress;
    const waiting = n.progress >= 1;
    const bob = waiting ? Math.sin(t * 5) * 10 : 0;
    if (waiting) {
      // "step here!" ring pulsing around the pad
      const k = (t * 1.2) % 1;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 10;
      roundRect(ctx, pad.x - 20 * k, pad.y - 20 * k, pad.w + 40 * k, pad.h + 40 * k, 34);
      ctx.stroke();
      ctx.restore();
    }
    drawImageFit(ctx, fruit[n.lane], pad.cx, y + bob, 150, KID_COLORS[n.lane]);
  }
}

function drawGrownNotes(ctx, layout, notes, time, colors) {
  const { board, pads } = layout;
  for (const n of notes) {
    const k = progressOf(n, time);
    if (k < 0) continue;
    const pad = pads[n.lane];
    const top = board.y + 40;
    const y = top + (pad.cy - top) * k;
    ctx.save();
    glow(ctx, colors[n.lane], 30);
    ctx.fillStyle = colors[n.lane];
    ctx.beginPath();
    ctx.arc(pad.cx, y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pad.cx, y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPopups(ctx, popups) {
  for (const p of popups) {
    const a = Math.max(0, Math.min(1, p.life / 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `900 ${p.size}px system-ui, sans-serif`;
    glow(ctx, p.color, 20);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - (1 - p.life / p.max) * 120);
    ctx.restore();
  }
}

function drawScore(ctx, stage, grown) {
  ctx.save();
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(String(grown.score), 40, 80);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(grown.streak > 1 ? `${grown.streak}×` : '', stage.w - 40, 80);
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillStyle = '#c7b3ff';
  ctx.fillText(`${grown.bpm} bpm · best ${grown.best}`, stage.w - 40, 124);
  ctx.restore();
}

function drawCentreText(ctx, stage, lines) {
  ctx.save();
  ctx.textAlign = 'center';
  lines.forEach(([text, size, color], i) => {
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    glow(ctx, color, 24);
    ctx.fillStyle = color;
    ctx.fillText(text, stage.w / 2, stage.h * 0.36 + i * (size + 24));
  });
  ctx.restore();
}

/** One frame. v: { stage, layout, mode, kid, grown, running, flashes, popups, particles, art, feet, t } */
export function drawFloor(ctx, v) {
  const { stage, layout, mode } = v;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stage.w, stage.h);
  const colors = mode === 'kid' ? KID_COLORS : LANE_COLORS;
  drawBoard(ctx, layout, colors);
  if (mode === 'kid') {
    drawPads(ctx, layout, colors, v.flashes, KID_FRIENDS.map((r) => v.art.chars?.[r]?.img ?? null));
    drawKidNotes(ctx, layout, v.kid.notes, KID_FRUIT.map((r) => v.art.chars?.[r]?.img), v.t);
  } else {
    drawPads(ctx, layout, colors, v.flashes, null);
    drawGrownNotes(ctx, layout, v.grown.notes, v.grown.time, colors);
    drawScore(ctx, stage, v.grown);
    if (!v.running) {
      drawCentreText(ctx, stage, [['KADAM TAAL', 120, '#ffd23e'], ['Space or ▶ to start', 54, '#ffffff']]);
    } else if (v.grown.time < 3) {
      drawCentreText(ctx, stage, [[String(3 - Math.floor(v.grown.time)), 200, '#5cf27c']]);
    }
  }
  drawPopups(ctx, v.popups);
  drawFx(ctx, v.particles);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const f of v.feet) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (mode === 'kid' && v.kid.hits === 0 && !v.kid.notes.some((n) => n.progress >= KID.catchFrom)) {
    drawCentreText(ctx, stage, [['👣', 120, '#ffffff']]);
  }
}
