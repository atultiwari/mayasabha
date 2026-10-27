// The birthday card shown inside the picture frame (the frame is dark in a dark room, so it becomes a
// bright card instead). It takes turns: a gift box that shakes, pops open and lets out hearts and stars;
// a big beating heart with the name in it; and, if you've added any, your own photos (kept private in
// assets/custom/, listed in janamdin.json as "photos"). Clipped to the frame's exact outline.
import { bbox, tracePath } from '../../kit/room/shapes.js';

export const SCENE_S = 7;
const PHOTO_PATTERN = /^[\w-][\w.-]{0,80}\.(png|webp|jpe?g)$/i;
const MAX_PHOTOS = 12;
const COLORS = Object.freeze(['#ff5d8f', '#ffd23e', '#4cc9f0', '#7bd389', '#c77dff', '#ff9f1c']);

/** Safe photo file names from janamdin.json ({ "photos": ["dadu-1.jpg", …] }); anything else is dropped. */
export function photoFiles(settings) {
  const list = Array.isArray(settings?.photos) ? settings.photos : [];
  return list.filter((f) => typeof f === 'string' && PHOTO_PATTERN.test(f)).slice(0, MAX_PHOTOS);
}

/** Which scene is showing at time t: 'gift', 'heart' or a photo index ({ photo: i }). */
export function cardScene(t, photoCount) {
  const scenes = ['gift', 'heart', ...Array.from({ length: photoCount }, (_, i) => ({ photo: i }))];
  const i = Math.floor(Math.max(0, t) / SCENE_S) % scenes.length;
  return { scene: scenes[i], local: Math.max(0, t) % SCENE_S };
}

const ease = (k) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

function heartPath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.4, cy, cx - r * 0.9, cy - r * 1.1, cx, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 1.1, cx + r * 1.4, cy, cx, cy + r * 0.9);
  ctx.closePath();
}

function star(ctx, x, y, r, turn) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = turn + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.sin(a) * rr, y - Math.cos(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function caption(ctx, text, b, y, size) {
  ctx.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = 'rgba(120,20,60,0.85)';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, b.x + b.w / 2, y, b.w * 0.92);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, b.x + b.w / 2, y, b.w * 0.92);
}

function drawGift(ctx, b, u, t, words) {
  const s = Math.min(b.w, b.h);
  const cx = b.x + b.w / 2;
  const floor = b.y + b.h * 0.9;
  const bw = s * 0.46;
  const bh = s * 0.34;
  const shake = u < 1.6 ? Math.sin(u * 40) * 0.06 * Math.min(1, u) : 0;
  const open = ease((u - 1.6) / 0.5);
  // hearts and stars bursting out
  if (u > 1.7) {
    for (let i = 0; i < 16; i += 1) {
      const k = ((u - 1.7) * 0.45 + i / 16) % 1;
      const a = -Math.PI / 2 + Math.sin(i * 2.4) * 1.1;
      const d = k * s * 0.75;
      const x = cx + Math.cos(a) * d;
      const y = floor - bh - Math.sin(-a) * d;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = COLORS[i % COLORS.length];
      if (i % 2) star(ctx, x, y, s * 0.05, t * 2 + i);
      else { heartPath(ctx, x, y, s * 0.05); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(cx, floor);
  ctx.rotate(shake);
  ctx.fillStyle = '#ff4d7e';
  ctx.fillRect(-bw / 2, -bh, bw, bh);
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-bw * 0.08, -bh, bw * 0.16, bh); // ribbon
  ctx.save(); // the lid lifts and tips off
  ctx.translate(-bw * 0.55 * open, -bh - open * s * 0.25);
  ctx.rotate(-open * 0.6);
  ctx.fillStyle = '#ff7aa0';
  ctx.fillRect(-bw * 0.56, -bh * 0.26, bw * 1.12, bh * 0.26);
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-bw * 0.08, -bh * 0.26, bw * 0.16, bh * 0.26);
  ctx.beginPath(); // bow
  ctx.ellipse(-bw * 0.13, -bh * 0.36, bw * 0.13, bh * 0.12, -0.5, 0, Math.PI * 2);
  ctx.ellipse(bw * 0.13, -bh * 0.36, bw * 0.13, bh * 0.12, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  const k = ease((u - 1.9) / 0.6);
  if (k > 0) caption(ctx, words.top, b, b.y + b.h * 0.2, s * 0.17 * (0.6 + 0.4 * k));
}

function drawHeart(ctx, b, u, t, words) {
  const s = Math.min(b.w, b.h);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h * 0.55;
  const beat = 1 + 0.08 * Math.max(0, Math.sin(t * 6)) ** 4;
  const r = s * 0.36 * ease(u / 0.8) * beat;
  ctx.save();
  ctx.shadowColor = 'rgba(255,60,110,0.9)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff3d6e';
  heartPath(ctx, cx, cy, r);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 8; i += 1) { // little stars twinkling round it
    const a = (i / 8) * Math.PI * 2 + t * 0.4;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i);
    ctx.fillStyle = COLORS[i % COLORS.length];
    star(ctx, cx + Math.cos(a) * s * 0.44, cy + Math.sin(a) * s * 0.4, s * 0.035, t + i);
  }
  ctx.globalAlpha = 1;
  if (u > 0.6) caption(ctx, words.name, { ...b, w: b.w * 0.8, x: b.x + b.w * 0.1 }, cy - r * 0.05, s * 0.2);
  caption(ctx, words.top, b, b.y + b.h * 0.13, s * 0.13);
}

function drawPhoto(ctx, b, u, img) {
  if (!img) return;
  const zoom = 1.04 + 0.08 * (u / SCENE_S); // a slow drift in
  const scale = Math.max(b.w / img.width, b.h / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.globalAlpha = ease(u / 0.6);
  ctx.drawImage(img, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

/**
 * Paints the card inside the frame shape. appear: 0..1 fade-in. words: { top, name }. photos: images.
 */
export function drawFrameCard(ctx, shape, cardT, t, appear, words, photos) {
  if (!shape || appear <= 0) return;
  const b = bbox(shape);
  const { scene, local } = cardScene(cardT, photos.length);
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear);
  ctx.beginPath();
  tracePath(ctx, shape);
  ctx.clip();
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.5, '#ffd1e3');
  g.addColorStop(1, '#c9e7ff');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (scene === 'gift') drawGift(ctx, b, local, t, words);
  else if (scene === 'heart') drawHeart(ctx, b, local, t, words);
  else drawPhoto(ctx, b, local, photos[scene.photo]);
  ctx.restore();
}
