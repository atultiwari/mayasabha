// Cartoon drawing helpers: friendly planets with faces (big shiny eyes, a smile, rosy cheeks, or
// sleepy closed eyes for goodnight), soft starry space, and storm bubbles.

/** Friendly planet. bands: stripe colours; spot: Jupiter's red spot; mood: 'smile' | 'sleep' | 'wow'. */
export function drawCartoonPlanet(ctx, { x, y, r, base, shade, bands = [], spot = false, mood = 'smile', t = 0 }) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, base);
  g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  bands.forEach((color, i) => {
    const by = y - r + ((i + 1) / (bands.length + 1)) * 2 * r;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - r, by);
    for (let k = 0; k <= 20; k += 1) {
      const bx = x - r + (k / 20) * 2 * r;
      ctx.lineTo(bx, by + Math.sin(k * 0.9 + t * 0.6 + i) * r * 0.03);
    }
    ctx.lineTo(x + r, by + r * 0.12);
    ctx.lineTo(x - r, by + r * 0.12);
    ctx.fill();
  });
  if (spot) {
    ctx.fillStyle = '#c8553d';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.35, y + r * 0.45, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawFace(ctx, x, y - r * 0.05, r, mood, t);
}

function drawFace(ctx, x, y, r, mood, t) {
  const eyeDx = r * 0.28;
  const eyeY = y - r * 0.08;
  const blink = mood !== 'sleep' && (t % 4) > 3.85;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = x + side * eyeDx;
    if (mood === 'sleep' || blink) {
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.arc(ex, eyeY - r * 0.02, r * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    const er = mood === 'wow' ? r * 0.14 : r * 0.12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, er * 0.85, er, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1430';
    ctx.beginPath();
    ctx.arc(ex + r * 0.02, eyeY + r * 0.02, er * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - er * 0.15, eyeY - er * 0.3, er * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,120,150,0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.45, y + r * 0.12, r * 0.1, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  if (mood === 'wow') ctx.ellipse(x, y + r * 0.2, r * 0.07, r * 0.09, 0, 0, Math.PI * 2);
  else ctx.arc(x, y + r * 0.08, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** Deep space with twinkling stars. `stars` are { x, y, size, phase } in 0..1 coordinates. */
export function drawSpace(ctx, size, stars, t, { top = '#0b0f2e', bottom = '#2a1550', drift = 0 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, size.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.fillStyle = '#fffbe8';
  for (const s of stars) {
    const y = ((s.y + drift * (0.3 + s.size)) % 1) * size.h;
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.phase));
    ctx.beginPath();
    ctx.arc(s.x * size.w, y, 1.5 + s.size * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Speed streaks while travelling. */
export function drawStreaks(ctx, size, stars, t, speed) {
  ctx.strokeStyle = 'rgba(200,220,255,0.55)';
  ctx.lineCap = 'round';
  for (const s of stars) {
    const y = ((s.y + t * speed * (0.5 + s.size)) % 1) * size.h;
    ctx.lineWidth = 2 + s.size * 3;
    ctx.beginPath();
    ctx.moveTo(s.x * size.w, y);
    ctx.lineTo(s.x * size.w, y - 40 - s.size * 160);
    ctx.stroke();
  }
}

/** A swirly storm bubble for Jupiter. */
export function drawStormBubble(ctx, b, t) {
  const g = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r);
  g.addColorStop(0, 'rgba(255,190,120,0.15)');
  g.addColorStop(0.8, 'rgba(230,120,70,0.35)');
  g.addColorStop(1, 'rgba(255,220,180,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,220,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let k = 0; k < 40; k += 1) {
    const a = k * 0.45 + t * 2 + b.phase;
    const rr = (k / 40) * b.r * 0.8;
    ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
  }
  ctx.stroke();
}
