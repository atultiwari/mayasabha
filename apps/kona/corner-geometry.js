// Geometry for the corner illusion (pure, metres). The inside corner is at the origin with the
// corner line along +y. Left wall: plane z = 0, x from -leftWidth to 0, facing +z. Right wall:
// plane x = 0, z from 0 to rightWidth, facing -x. The room (and the viewer) is the quadrant x < 0, z > 0.
// y = 0 is the bottom edge of the projected area.
//
// Each wall is rendered with a "generalised perspective projection" (Kooima, 2008): an off-axis
// camera at the viewer's eye whose image plane is exactly that wall. From the eye, the two images
// join into one 3D scene that seems to extend behind and in front of the walls.
import { computeHomography } from '../../kit/geometry.js';

/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/** @typedef {{ pa: Vec3, pb: Vec3, pc: Vec3 }} Wall  lower-left, lower-right, upper-left as seen from inside */

export const DEFAULT_ROOM = Object.freeze({
  leftWidth: 1.6, rightWidth: 1.2, height: 1.4, // projected area on each wall
  viewerDistance: 3.0, eyeHeight: 0.6, viewerAngle: 0, // where the illusion is perfect (e.g. the phone filming)
  rightGain: 1, // brightness boost for the right wall when the projector hits it at a steep angle (it looks dimmer)
});

const LIMITS = {
  leftWidth: [0.2, 10], rightWidth: [0.2, 10], height: [0.2, 5], viewerDistance: [0.5, 15], eyeHeight: [-2, 4], viewerAngle: [-40, 40], rightGain: [0.5, 3],
};

export function sanitizeRoom(value) {
  const out = { ...DEFAULT_ROOM };
  if (!value || typeof value !== 'object') return out;
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
    if (Number.isFinite(value[k])) out[k] = Math.min(hi, Math.max(lo, value[k]));
  }
  return out;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a) => scale(a, 1 / Math.hypot(a.x, a.y, a.z));

/** @returns {{ left: Wall, right: Wall }} */
export function wallFrames(room) {
  const h = room.height;
  return {
    left: { pa: { x: -room.leftWidth, y: 0, z: 0 }, pb: { x: 0, y: 0, z: 0 }, pc: { x: -room.leftWidth, y: h, z: 0 } },
    right: { pa: { x: 0, y: 0, z: 0 }, pb: { x: 0, y: 0, z: room.rightWidth }, pc: { x: 0, y: h, z: 0 } },
  };
}

/** The viewer stands on the corner's bisector (turned by viewerAngle), viewerDistance away. */
export function viewerPosition(room) {
  const a = (room.viewerAngle * Math.PI) / 180;
  const dir = { x: -Math.cos(Math.PI / 4 - a), z: Math.sin(Math.PI / 4 - a) };
  return { x: dir.x * room.viewerDistance, y: room.eyeHeight, z: dir.z * room.viewerDistance };
}

function basis(wall) {
  const vr = unit(sub(wall.pb, wall.pa));
  const vu = unit(sub(wall.pc, wall.pa));
  return { vr, vu, vn: unit(cross(vr, vu)) };
}

/** Where a 3D point appears on a wall from the eye, as wall coordinates u, v in 0..1. */
export function projectToWall(wall, eye, p) {
  const { vr, vu, vn } = basis(wall);
  const dir = sub(p, eye);
  const t = dot(sub(wall.pa, eye), vn) / dot(dir, vn);
  const hit = add(eye, scale(dir, t));
  const rel = sub(hit, wall.pa);
  const width = Math.hypot(...Object.values(sub(wall.pb, wall.pa)));
  const height = Math.hypot(...Object.values(sub(wall.pc, wall.pa)));
  return { u: dot(rel, vr) / width, v: dot(rel, vu) / height };
}

/**
 * Off-axis frustum for rendering one wall from the eye.
 * @returns {{ left: number, right: number, bottom: number, top: number, basis: { vr: Vec3, vu: Vec3, vn: Vec3 } }}
 */
export function wallFrustum(wall, eye, near) {
  const b = basis(wall);
  const va = sub(wall.pa, eye);
  const vb = sub(wall.pb, eye);
  const vc = sub(wall.pc, eye);
  const d = -dot(va, b.vn);
  return {
    left: (dot(b.vr, va) * near) / d,
    right: (dot(b.vr, vb) * near) / d,
    bottom: (dot(b.vu, va) * near) / d,
    top: (dot(b.vu, vc) * near) / d,
    basis: b,
  };
}

/** Starting positions for the 6 corner points (screen px), before you drag them onto the real walls. */
export function defaultPoints(screen) {
  const { w, h } = screen;
  return {
    leftTop: { x: w * 0.08, y: h * 0.12 }, cornerTop: { x: w * 0.56, y: h * 0.06 }, rightTop: { x: w * 0.93, y: h * 0.14 },
    leftBottom: { x: w * 0.08, y: h * 0.88 }, cornerBottom: { x: w * 0.56, y: h * 0.94 }, rightBottom: { x: w * 0.93, y: h * 0.86 },
  };
}

export const POINT_NAMES = Object.freeze(['leftTop', 'cornerTop', 'rightTop', 'leftBottom', 'cornerBottom', 'rightBottom']);

export function sanitizePoints(value) {
  if (!value || typeof value !== 'object') return null;
  const ok = POINT_NAMES.every((n) => value[n] && Number.isFinite(value[n].x) && Number.isFinite(value[n].y));
  return ok ? Object.fromEntries(POINT_NAMES.map((n) => [n, { x: value[n].x, y: value[n].y }])) : null;
}

/** Homographies from screen pixels to each wall's (u, v), with v = 0 at the bottom. */
export function screenToWallHomographies(p) {
  const unitSquare = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
  return {
    left: computeHomography([p.leftTop, p.cornerTop, p.cornerBottom, p.leftBottom], unitSquare),
    right: computeHomography([p.cornerTop, p.rightTop, p.rightBottom, p.cornerBottom], unitSquare),
  };
}
