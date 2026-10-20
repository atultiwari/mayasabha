// Where the camera should be for each view: a slow overview orbit, straight-down (best on a
// ceiling), close to one body (lit side, slightly from above), or framing the true-size line-up.
import { PLANETS } from './solar-data.js';
import { sizeRowLayout } from './orbits.js';
import { bodyWorld } from './scene.js';

const OVERVIEW = { radius: 95, height: 58, spin: 0.03 };
const TOP_HEIGHT = 150;
const FOCUS_SIDE_ANGLE = 0.7;

const ROW = sizeRowLayout(PLANETS);
const ROW_END = ROW[ROW.length - 1].x + ROW[ROW.length - 1].r;

const v = (x, y, z) => ({ x, y, z });

function focusTarget(world, id) {
  const body = bodyWorld(world, id);
  if (!body) return null;
  if (id === 'sun') return { pos: v(0, body.radius * 1.3, body.radius * 4.5), look: v(0, 0, 0) };
  const dist = Math.max(body.reach * 2.6, body.radius * 5, 2.5);
  const len = Math.hypot(body.pos.x, body.pos.z) || 1;
  const toSun = { x: -body.pos.x / len, z: -body.pos.z / len };
  const c = Math.cos(FOCUS_SIDE_ANGLE);
  const s = Math.sin(FOCUS_SIDE_ANGLE);
  const side = { x: toSun.x * c - toSun.z * s, z: toSun.x * s + toSun.z * c };
  return {
    pos: v(body.pos.x + side.x * dist, body.pos.y + dist * 0.35, body.pos.z + side.z * dist),
    look: v(body.pos.x, body.pos.y, body.pos.z),
  };
}

/** @param {{ mode: 'overview'|'top'|'focus'|'sizes', id?: string }} view @returns {{ pos, look, up }} */
export function viewTarget(view, world, tSeconds) {
  const up = v(0, 1, 0);
  if (view.mode === 'top') return { pos: v(0, TOP_HEIGHT, 0.001), look: v(0, 0, 0), up: v(0, 0, -1) };
  if (view.mode === 'sizes') return { pos: v(ROW_END / 2 - 4, 5, ROW_END * 0.95), look: v(ROW_END / 2 - 4, 0, 0), up };
  if (view.mode === 'focus') {
    const t = focusTarget(world, view.id);
    if (t) return { ...t, up };
  }
  const a = tSeconds * OVERVIEW.spin;
  return { pos: v(Math.cos(a) * OVERVIEW.radius, OVERVIEW.height, Math.sin(a) * OVERVIEW.radius), look: v(0, 0, 0), up };
}
