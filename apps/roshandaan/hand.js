// A glowing hologram hand built from jointed capsules (no model file to license). In its own frame the
// wrist is the origin, the fingers point along +y, the palm faces +z and the arm runs down -y. Bending
// the wrist and curling the fingers both rotate about local x, towards the palm side.
import * as THREE from '../../lib/three/three.module.js';

const FINGERS = Object.freeze([
  // x across the palm, length (long and creepy), splay angle
  { x: -0.034, len: 0.15, splay: 0.16 },
  { x: -0.012, len: 0.17, splay: 0.05 },
  { x: 0.012, len: 0.165, splay: -0.05 },
  { x: 0.034, len: 0.13, splay: -0.16 },
]);
const SEGMENTS = Object.freeze([0.45, 0.32, 0.23]);
const RADIUS = 0.0095;

function materials() {
  return {
    // solid and shaded (lit from the room side), so it reads as a real 3D hand, with a faint hologram mesh over it
    glow: new THREE.MeshStandardMaterial({ color: 0xbfeeff, emissive: 0x0b3d4d, roughness: 0.55, metalness: 0.1 }),
    wire: new THREE.MeshBasicMaterial({ color: 0x7fe9ff, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false }),
  };
}

/** A mesh drawn twice: a soft glow and a wireframe over it, like the reference's hologram. Casts a shadow. */
function holo(geometry, mats) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(geometry, mats.glow);
  body.castShadow = true;
  group.add(body, new THREE.Mesh(geometry, mats.wire));
  return group;
}

function finger(spec, mats, scale) {
  const base = new THREE.Group();
  base.position.set(spec.x, 0.1, 0);
  base.rotation.z = spec.splay;
  const joints = [];
  let parent = base;
  for (const f of SEGMENTS) {
    const len = spec.len * f * scale;
    const joint = new THREE.Group();
    const bone = holo(new THREE.CapsuleGeometry(RADIUS * (1.15 - joints.length * 0.15), len, 4, 8), mats);
    bone.position.y = len / 2;
    joint.add(bone);
    const knuckle = holo(new THREE.SphereGeometry(RADIUS * 1.25, 10, 8), mats);
    knuckle.position.y = len;
    joint.add(knuckle);
    parent.add(joint);
    joints.push(joint);
    const next = new THREE.Group();
    next.position.y = len;
    joint.add(next);
    parent = next;
    joint.userData.child = next;
  }
  return { base, joints };
}

/**
 * @param {1 | -1} side which frame edge it grips: +1 the +x edge, -1 the -x edge
 * @returns {{ object: THREE.Group, pose: (state: object, place: { x: number, y: number }) => void }}
 */
export function makeHand(side, scale = 1.25) {
  const mats = materials();
  const object = new THREE.Group();
  // local +y (fingers) -> world +z (down at you); local +z (palm) -> world +x * side (towards the edge)
  const x = new THREE.Vector3(0, side, 0);
  const y = new THREE.Vector3(0, 0, 1);
  const z = new THREE.Vector3(side, 0, 0);
  object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));

  const arm = holo(new THREE.CylinderGeometry(0.03, 0.045, 1.8, 12, 6), mats);
  arm.position.y = -0.9;
  object.add(arm);
  const wrist = new THREE.Group();
  object.add(wrist);
  const palm = holo(new THREE.BoxGeometry(0.09 * scale, 0.11 * scale, 0.028, 3, 3, 1), mats);
  palm.position.y = 0.05 * scale;
  wrist.add(palm);
  const fingers = FINGERS.map((f) => finger({ ...f, x: f.x * scale }, mats, scale));
  for (const f of fingers) {
    f.base.position.y *= scale;
    wrist.add(f.base);
  }
  const thumb = finger({ x: -0.048 * scale, len: 0.1, splay: 0.9 }, mats, scale);
  thumb.base.position.y = 0.03 * scale;
  wrist.add(thumb.base);

  function pose(state, place) {
    object.visible = state.visible;
    if (!state.visible) return;
    object.position.set(place.x, place.y, state.z);
    wrist.rotation.x = state.bend * (Math.PI / 2); // fingers turn from "at you" to "over the edge"
    for (const f of [...fingers, thumb]) {
      f.base.rotation.z = (f === thumb ? 0.9 : FINGERS[fingers.indexOf(f)].splay) * (0.4 + state.spread * 0.6);
      f.joints.forEach((j, i) => { j.rotation.x = state.curl * [0.7, 0.9, 0.8][i]; });
    }
    mats.wire.opacity = 0.18 + Math.random() * 0.12; // the hologram mesh shimmers
  }
  return { object, pose };
}
