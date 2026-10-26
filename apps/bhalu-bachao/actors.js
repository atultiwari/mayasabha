// Turns the story state into what everyone is doing: Bear waving for help and tugging his stuck leg,
// hopping clear when freed; Masha running in to cheer; the train rolling, wheels spinning, smoke puffing,
// the Penguin driver waving. Bones are turned from their rest pose each frame, so nothing drifts.
import * as THREE from '../../lib/three/three.module.js';
import { SIZES, bubble, toWorld } from './world.js';

// Which way each rig's shoulders turn to raise the arm out of its T-pose (found by trying each axis).
const BEAR_ARMS = { left: ['L_Shoulder_037', 'x', -1], right: ['R_Shoulder_055', 'x', 1] };
const MASHA_ARMS = { left: ['Masha_lf_upArm_jnt_01_08', 'x', 1], right: ['Masha_rt_upArm_jnt_089_065', 'x', -1] };
const ARMS_DOWN = -1.2; // radians from the T-pose: arms resting at the sides
const HINT_TEXT = Object.freeze({ touch: '👆 Touch Bear!', red: '🟥 Show red: STOP!', arms: '🙌 Hands up: STOP!', clap: '👏 Clap to help!' });
const HOP_BACK = 260; // how far back Bear hops, off the track (world depth)

function rig(root, arms, extra = []) {
  const bones = {};
  for (const [name] of [...Object.values(arms), ...extra.map((n) => [n])]) {
    const b = root.getObjectByName(name);
    if (b) bones[name] = { bone: b, rest: b.rotation.clone() };
  }
  return {
    arms(left, right) {
      for (const [side, lift] of [['left', left], ['right', right]]) {
        const [name, axis, sign] = arms[side];
        const b = bones[name];
        if (b) b.bone.rotation[axis] = b.rest[axis] + sign * lift;
      }
    },
    turn(name, axis, angle) {
      const b = bones[name];
      if (b) b.bone.rotation[axis] = b.rest[axis] + angle;
    },
  };
}

/** A soft round puff, drawn once (a plain sprite would be a square). */
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(240,240,240,0.7)');
  grad.addColorStop(1, 'rgba(230,230,230,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function smoke() {
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, opacity: 0.8, depthWrite: false });
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(mat.clone());
    s.userData.age = i / 14;
    group.add(s);
    return s;
  });
  return { group, puffs };
}

export function createActors(world, stage, track) {
  const bear = rig(world.bearRig, BEAR_ARMS, ['Hips_02', 'Jaw_017', 'R_Thigh_09', 'Head_016']);
  const masha = rig(world.mashaRig, MASHA_ARMS, ['Masha_head_a_jnt_055_033']);
  const puff = smoke();
  world.scene.add(puff.group);
  const hints = Object.fromEntries(Object.entries(HINT_TEXT).map(([k, text]) => {
    const s = bubble(text);
    s.visible = false;
    world.scene.add(s);
    return [k, s];
  }));
  const free = bubble('🎉 Bear is safe!');
  free.visible = false;
  world.scene.add(free);

  function poseBear(s, t) {
    const stuck = s.phase === 'stuck' || s.phase === 'approach' || s.phase === 'wait';
    const hop = s.bear.off;
    const arc = Math.sin(Math.min(1, hop) * Math.PI) * 120;
    world.bear.position.copy(toWorld(stage, s.bear.x - hop * 120, track.y - arc, -hop * HOP_BACK));
    world.bear.rotation.y = s.phase === 'arrive' ? Math.PI / 2 : 0; // walks in sideways, then faces you
    if (stuck) {
      bear.arms(0.3 + Math.abs(Math.sin(t * 5)) * 1.1, 0.3 + Math.abs(Math.cos(t * 5)) * 1.1); // waving for help
      bear.turn('Hips_02', 'y', Math.sin(t * 7) * 0.25); // tugging at the stuck leg
      bear.turn('Jaw_017', 'x', Math.max(0, Math.sin(t * 6)) * 0.35); // calling out
    } else if (s.phase === 'freed' || s.phase === 'pass' || s.phase === 'cheer') {
      const wave = Math.sin(t * 8) * 0.3;
      bear.arms(1.1 + wave, 1.1 - wave);
      bear.turn('Hips_02', 'y', 0);
      bear.turn('Jaw_017', 'x', 0.25);
    } else {
      const swing = Math.sin(t * 6) * 0.25;
      bear.arms(ARMS_DOWN + swing, ARMS_DOWN - swing); // walking
      bear.turn('Jaw_017', 'x', 0);
    }
  }

  function poseMasha(s, t) {
    const show = s.phase === 'freed' || s.phase === 'pass' || s.phase === 'cheer';
    world.masha.visible = show;
    if (!show) return;
    const runIn = s.phase === 'freed' ? Math.min(1, s.t / 0.9) : 1;
    const x = track.x0 - 160 + (s.bear.targetX - 300 - (track.x0 - 160)) * runIn;
    const jump = runIn === 1 ? Math.abs(Math.sin(t * 7)) * 50 : Math.abs(Math.sin(t * 14)) * 12;
    world.masha.position.copy(toWorld(stage, x, track.y - jump, -HOP_BACK)); // back off the track, like Bear
    world.masha.rotation.y = runIn < 1 ? Math.PI / 2 : 0;
    const wave = Math.sin(t * 9) * 0.35;
    masha.arms(runIn < 1 ? ARMS_DOWN : 1.2 + wave, runIn < 1 ? ARMS_DOWN : 1.2 - wave);
  }

  function poseTrain(s, t, dt) {
    const visible = s.phase !== 'arrive' && s.phase !== 'stuck';
    world.train.object.visible = visible;
    world.train.object.position.copy(toWorld(stage, s.train.x, track.y - 6));
    world.train.mixer.update(dt * (s.train.v / 90)); // wheels turn with the speed
    const driver = world.train.object.userData.driver;
    if (driver) driver.position.y = world.train.object.userData.size.h * 0.95 + (s.phase === 'pass' ? Math.abs(Math.sin(t * 10)) * 18 : 0);
    const chimney = new THREE.Vector3(s.train.x + SIZES.train * 0.11, track.y - world.train.object.userData.size.h * 1.05, 10);
    for (const p of puff.puffs) {
      p.userData.age = (p.userData.age + dt * (0.35 + s.train.v / 400)) % 1;
      const k = p.userData.age;
      p.visible = visible && s.train.v > 5;
      p.position.copy(toWorld(stage, chimney.x + k * 120, chimney.y - k * 160, 10));
      p.scale.setScalar(30 + k * 70);
      p.material.opacity = 0.75 * (1 - k);
    }
  }

  function showHint(s) {
    const asking = s.phase === 'stuck' || s.phase === 'approach' || s.phase === 'wait';
    for (const [k, sprite] of Object.entries(hints)) {
      sprite.visible = asking && k === s.hint;
      sprite.position.copy(toWorld(stage, s.bear.targetX, track.y - SIZES.bear - 110));
    }
    free.visible = s.phase === 'freed' || s.phase === 'cheer';
    free.position.copy(toWorld(stage, s.bear.targetX - 150, track.y - SIZES.bear - 110));
  }

  return {
    world,
    update(s, t, dt) {
      poseBear(s, t);
      poseMasha(s, t);
      poseTrain(s, t, dt);
      showHint(s);
    },
    /** Bear's box on the stage (px), for "touch Bear". */
    bearBox: (s) => ({ x: s.bear.x, y: track.y - SIZES.bear / 2, w: SIZES.bear * 0.8, h: SIZES.bear }),
  };
}
