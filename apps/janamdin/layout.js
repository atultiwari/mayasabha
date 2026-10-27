// Where everything goes on the wall (pure, stage px), fitted round the real room: bunting above the
// puja picture, the name between the picture and the cake, the cake standing on the sofa back, and
// Masha and Bear beside it. Nothing is ever placed over the picture.
import { bbox } from '../../kit/room/shapes.js';
import { ledgesFromRoom } from '../../kit/room/room-map.js';

const MARGIN = 60;
const CAKE = Object.freeze({ w: 380, h: 300 });
const FRIENDS_W = 420;
const DIYA_ROOM = 70; // the ring of diyas round the picture reaches this far out

export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function sofaLine(shapes, stage) {
  const ledges = ledgesFromRoom(shapes);
  if (!ledges.length) return { y: stage.h * 0.94, x0: MARGIN, x1: stage.w - MARGIN };
  const l = ledges.reduce((a, b) => (Math.abs(b.b.x - b.a.x) > Math.abs(a.b.x - a.a.x) ? b : a));
  return { y: (l.a.y + l.b.y) / 2, x0: Math.min(l.a.x, l.b.x), x1: Math.max(l.a.x, l.b.x) };
}

/** @returns {{ bunting, name, cake, friends: object, picture: object|null, ledge: { y, x0, x1 } }} boxes are { x, y, w, h } */
export function birthdayLayout(stage, shapes) {
  const picture = (shapes ?? []).find((s) => s.tag === 'picture') ?? null;
  const pb = picture ? bbox(picture) : null;
  const ledge = sofaLine(shapes ?? [], stage);
  const top = 20;
  const buntingH = Math.max(110, Math.min(200, (pb ? pb.y : stage.h * 0.22) - top - 10));
  // When the picture reaches up into the bunting, the flags part round it (and its ring of diyas).
  const gap = pb && pb.y < top + buntingH + DIYA_ROOM ? { x0: pb.x - DIYA_ROOM, x1: pb.x + pb.w + DIYA_ROOM } : null;
  const bunting = { x: MARGIN, y: top, w: stage.w - 2 * MARGIN, h: buntingH, gap };
  // Between the picture and the sofa back, share the wall: the name, then the song's words, then the
  // candles, then the cake standing on the sofa back.
  const nameTop = pb ? pb.y + pb.h + 16 : bunting.y + bunting.h + stage.h * 0.12;
  const NAME_MIN = 140;
  const WORDS_AND_CANDLES = 150; // 60 px for a line of the song + 90 px for candles and flames
  const cakeH = Math.min(CAKE.h, Math.max(160, ledge.y - nameTop - NAME_MIN - WORDS_AND_CANDLES));
  const cakeX = (ledge.x0 + ledge.x1) / 2 - CAKE.w / 2;
  const cake = { x: cakeX, y: ledge.y - cakeH, w: CAKE.w, h: cakeH };
  const name = { x: MARGIN, y: nameTop, w: stage.w - 2 * MARGIN, h: Math.max(100, Math.min(240, cake.y - nameTop - WORDS_AND_CANDLES)) };
  const friends = { x: Math.max(ledge.x0, cake.x - FRIENDS_W - 40), y: ledge.y - 280, w: FRIENDS_W, h: 280 };
  return { bunting, name, cake, friends, picture, ledge };
}
