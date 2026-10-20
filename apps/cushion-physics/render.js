// Draws the Cushion Physics stage. Real cushions get light painted onto them (they glow and flash
// when hit); virtual cushions are drawn as soft red pillows. Fruit spins as it tumbles; marbles
// glow; Hathi waits at the bottom with his trunk up.

function polygon(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function drawCushion(ctx, c, flash, t, isVirtual) {
  polygon(ctx, c.points);
  if (c.room) {
    // A real object from the Room Map: just a soft gold outline that flashes when hit.
    ctx.save();
    ctx.strokeStyle = `rgba(255,207,90,${0.35 + flash * 0.65})`;
    ctx.shadowColor = '#ffcf5a';
    ctx.shadowBlur = 10 + flash * 30;
    ctx.lineWidth = 4 + flash * 6;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (isVirtual) {
    const g = ctx.createLinearGradient(c.points[0].x, c.points[0].y, c.points[2].x, c.points[2].y);
    g.addColorStop(0, '#e2264f');
    g.addColorStop(1, '#8e1030');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.fillStyle = `hsla(${(t * 40 + c.hue) % 360},95%,65%,${0.12 + flash * 0.6})`;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = `hsl(${(t * 40 + c.hue) % 360},95%,65%)`;
  ctx.shadowBlur = 20 + flash * 40;
  ctx.strokeStyle = `hsla(${(t * 40 + c.hue) % 360},95%,75%,${0.7 + flash * 0.3})`;
  ctx.lineWidth = 6 + flash * 8;
  ctx.stroke();
  ctx.restore();
}

function drawItem(ctx, body, art) {
  const { kind, look, hue } = body.plugin;
  const { x, y } = body.position;
  const r = body.circleRadius;
  if (kind === 'marble') {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, `hsl(${hue},95%,70%)`);
    g.addColorStop(1, `hsl(${hue},90%,40%)`);
    ctx.save();
    ctx.shadowColor = `hsl(${hue},95%,60%)`;
    ctx.shadowBlur = 24;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const image = art[look];
  if (!image) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.drawImage(image, -r * 1.25, -r * 1.25, r * 2.5, r * 2.5);
  ctx.restore();
}

function drawGoal(ctx, goal, art, happy, t, mode) {
  const cx = goal.x + goal.w / 2;
  const bounce = happy > 0 ? Math.abs(Math.sin(t * 12)) * 18 : 0;
  const size = goal.w * 1.05;
  if (mode === 'feed' && art.elephant) {
    ctx.save();
    ctx.translate(cx, goal.y + goal.h - size / 2 + 20 - bounce);
    ctx.rotate(happy > 0 ? Math.sin(t * 10) * 0.08 : 0);
    ctx.drawImage(art.elephant, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.strokeStyle = `hsl(${(t * 60) % 360},90%,65%)`;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 25;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(goal.x, goal.y);
  ctx.quadraticCurveTo(cx, goal.y + goal.h * 1.6, goal.x + goal.w, goal.y);
  ctx.stroke();
  ctx.restore();
}

function drawDropper(ctx, x, t) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(x, 26, 14 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawScore(ctx, size, score, mode, art) {
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe08a';
  ctx.fillText(String(score), size.w - 40, 90);
  const icon = mode === 'feed' ? art.banana : null;
  if (icon) ctx.drawImage(icon, size.w - 150 - ctx.measureText(String(score)).width, 30, 80, 80);
}

/** One frame. */
export function drawField(ctx, v) {
  const { size } = v;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size.w, size.h);
  v.cushions.forEach((c) => drawCushion(ctx, c, v.flash.get(c.id) ?? 0, v.t, v.virtual));
  drawGoal(ctx, v.goal, v.art, v.happy, v.t, v.mode);
  v.items.forEach((b) => drawItem(ctx, b, v.art));
  drawDropper(ctx, v.dropX, v.t);
  drawScore(ctx, size, v.score, v.mode, v.art);
}
