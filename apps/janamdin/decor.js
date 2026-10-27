// Drawing the birthday decorations: bunting that drops in and sways, the name in big golden letters
// that bounce in one by one, and the cake with candles (their flames flicker when someone blows, and
// smoke curls up once they're out). All in stage px on a 2D canvas.

const FLAG_COLORS = Object.freeze(['#ff5d8f', '#ffd23e', '#4cc9f0', '#7bd389', '#c77dff', '#ff9f1c']);
const BUNTING_TEXT = Object.freeze({ en: 'HAPPY BIRTHDAY', hi: 'जन्मदिन मुबारक' });
const DROP_S = 0.7;

const ease = (k) => 1 - (1 - k) ** 3;
/** A drop with a little bounce at the end. */
function bounce(k) {
  if (k >= 1) return 1;
  const e = ease(k);
  return e + Math.sin(k * Math.PI * 2.5) * 0.12 * (1 - k);
}

/** Letters (or Hindi syllables) of a text, kept whole so a matra stays with its letter. */
export function letters(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return [...text];
}

function drawFlags(ctx, items, first, seg, box, local, t) {
  const n = items.length;
  const step = seg.w / n;
  const sag = box.h * 0.22;
  const ropeY = (x) => box.y + 14 + sag * Math.sin(((x - seg.x) / seg.w) * Math.PI);
  ctx.strokeStyle = '#f5e6c8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = seg.x; x <= seg.x + seg.w; x += 20) (x === seg.x ? ctx.moveTo(x, ropeY(x)) : ctx.lineTo(x, ropeY(x)));
  ctx.stroke();
  items.forEach((ch, j) => {
    const i = first + j;
    const k = Math.min(1, Math.max(0, (local - i * 0.18) / DROP_S));
    if (k <= 0) return;
    const cx = seg.x + step * (j + 0.5);
    const top = ropeY(cx);
    const h = box.h - 30;
    const drop = (1 - bounce(k)) * -(top + h);
    const sway = Math.sin(t * 2 + i) * 0.06;
    ctx.save();
    ctx.translate(cx, top + drop);
    ctx.rotate(sway);
    if (ch.trim()) {
      ctx.fillStyle = FLAG_COLORS[i % FLAG_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(-step * 0.42, 0);
      ctx.lineTo(step * 0.42, 0);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(Math.min(h, step) * 0.4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, h * 0.33);
    }
    ctx.restore();
  });
}

/**
 * "Happy Birthday" flags on a rope across the top. If box.gap ({ x0, x1 }) is set, the rope stops short
 * of it: the first word hangs to its left and the rest to its right, so nothing hangs over the picture.
 */
export function drawBunting(ctx, box, local, t, lang) {
  const text = BUNTING_TEXT[lang] ?? BUNTING_TEXT.en;
  ctx.save();
  if (!box.gap) {
    drawFlags(ctx, letters(text), 0, { x: box.x, w: box.w }, box, local, t);
  } else {
    const [head, ...rest] = text.split(' ');
    const left = letters(head);
    const right = letters(rest.join(' '));
    drawFlags(ctx, left, 0, { x: box.x, w: box.gap.x0 - box.x }, box, local, t);
    drawFlags(ctx, right, left.length, { x: box.gap.x1, w: box.x + box.w - box.gap.x1 }, box, local, t);
  }
  ctx.restore();
}

export function drawName(ctx, box, local, t, name) {
  const items = letters(name);
  const size = Math.min(box.h * 0.95, (box.w / Math.max(3, items.length)) * 1.2);
  ctx.save();
  ctx.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const widths = items.map((c) => ctx.measureText(c).width);
  const gap = size * 0.08;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = box.x + (box.w - total) / 2;
  const base = box.y + box.h * 0.82;
  items.forEach((ch, i) => {
    const k = Math.min(1, Math.max(0, (local - i * 0.45) / DROP_S));
    if (k > 0) {
      const y = base - (1 - bounce(k)) * (base + size) + Math.sin(t * 2.4 + i) * 6 * k;
      const g = ctx.createLinearGradient(0, y - size, 0, y);
      g.addColorStop(0, '#fff6c2');
      g.addColorStop(0.5, '#ffcf3a');
      g.addColorStop(1, '#e08a00');
      ctx.shadowColor = 'rgba(255,190,60,0.85)';
      ctx.shadowBlur = 40;
      ctx.fillStyle = g;
      ctx.fillText(ch, x, y);
      ctx.shadowBlur = 0; // no outline: strokes draw stray shapes inside curved letters like "a"
    }
    x += widths[i] + gap;
  });
  ctx.restore();
}

function flame(ctx, x, y, t, i, blowing) {
  const lean = blowing * Math.sin(t * 30 + i) * 10;
  const h = 52 * (1 - blowing * 0.4) * (0.9 + 0.1 * Math.sin(t * 17 + i)); // big enough to see across the room
  const g = ctx.createRadialGradient(x + lean, y - h * 0.4, 1, x + lean, y - h * 0.4, h);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.4, 'rgba(255,190,60,0.9)');
  g.addColorStop(1, 'rgba(255,90,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + lean / 2, y - h * 0.45, h * 0.32, h * 0.62, lean * 0.02, 0, Math.PI * 2);
  ctx.fill();
}

function smoke(ctx, x, y, since, i) {
  for (let p = 0; p < 4; p += 1) {
    const k = (since * 0.6 + p * 0.25 + i * 0.1) % 1;
    ctx.fillStyle = `rgba(220,220,220,${0.35 * (1 - k) * Math.max(0, 1 - since / 6)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 6 + i) * 10, y - 20 - k * 120, 6 + k * 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The cake, grown in by `appear` (0..1). candles: { count, lit, blowing 0..1, outFor seconds }.
 */
export function drawCake(ctx, box, appear, t, candles) {
  if (appear <= 0) return;
  const k = ease(Math.min(1, appear));
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h);
  ctx.scale(0.6 + 0.4 * k, k);
  const w = box.w;
  const tiers = [{ w, h: box.h * 0.42, color: '#f7c6d9', icing: '#fff1f6' }, { w: w * 0.72, h: box.h * 0.34, color: '#c9a7f5', icing: '#f5ecff' }];
  let y = 0;
  for (const tier of tiers) {
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    ctx.roundRect(-tier.w / 2, y - tier.h, tier.w, tier.h, 18);
    ctx.fill();
    ctx.fillStyle = tier.icing; // icing with drips
    ctx.beginPath();
    ctx.moveTo(-tier.w / 2, y - tier.h + 10);
    for (let x = -tier.w / 2; x <= tier.w / 2; x += tier.w / 10) ctx.arc(x, y - tier.h + 18, tier.w / 26, 0, Math.PI);
    ctx.lineTo(tier.w / 2, y - tier.h);
    ctx.lineTo(-tier.w / 2, y - tier.h);
    ctx.fill();
    for (let s = 0; s < 14; s += 1) {
      ctx.fillStyle = FLAG_COLORS[s % FLAG_COLORS.length];
      ctx.fillRect(-tier.w / 2 + 14 + ((s * 37) % (tier.w - 28)), y - tier.h * (0.25 + ((s * 13) % 50) / 100), 10, 4);
    }
    y -= tier.h;
  }
  const n = candles.count;
  const top = y;
  for (let i = 0; i < n; i += 1) {
    const cx = -tiers[1].w * 0.36 + (tiers[1].w * 0.72 * (i + 0.5)) / n;
    ctx.fillStyle = FLAG_COLORS[i % FLAG_COLORS.length];
    ctx.fillRect(cx - 6, top - 52, 12, 52);
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 3; s += 1) ctx.fillRect(cx - 6, top - 46 + s * 16, 12, 5);
    if (candles.lit) flame(ctx, cx, top - 54, t, i, candles.blowing);
    else smoke(ctx, cx, top - 54, candles.outFor, i);
  }
  ctx.restore();
}
