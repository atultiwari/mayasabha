// The 3D world for Bhalu Bachao, laid out in stage pixels: the plane z = 0 is the wall, and a camera
// placed just so maps it pixel for pixel onto the stage. The railway runs along the traced sofa back,
// out of a stone tunnel at the edge of the picture.
import * as THREE from '../../lib/three/three.module.js';
import { layAlong, loadModel, restoreOldColours, standUp } from './models.js';

const FOV = 30;
export const SIZES = Object.freeze({ bear: 300, masha: 210, train: 900, penguin: 110 });

/** World point for a stage pixel (y down) at depth z. */
export const toWorld = (stage, x, y, z = 0) => new THREE.Vector3(x - stage.w / 2, stage.h / 2 - y, z);

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
}

function railway(stage, track) {
  const group = new THREE.Group();
  const from = track.x0 - 120;
  const to = stage.w + 40;
  const length = to - from;
  for (let x = from; x < to; x += 46) {
    const sleeper = box(18, 9, 60, 0x7a4a26);
    sleeper.position.copy(toWorld(stage, x, track.y + 4));
    group.add(sleeper);
  }
  for (const z of [-18, 18]) {
    const rail = box(length, 7, 6, 0xb8bcc4);
    rail.material.metalness = 0.6;
    rail.position.copy(toWorld(stage, from + length / 2, track.y - 5, z));
    group.add(rail);
  }
  return group;
}

/** A stone arch at the right edge: the train comes out of the dark through it. */
function tunnel(stage, track) {
  const w = 360;
  const h = 360;
  const hole = 270;
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)]);
  const arch = new THREE.Path();
  arch.moveTo(-hole / 2, 0);
  arch.lineTo(-hole / 2, hole * 0.55);
  arch.absarc(0, hole * 0.55, hole / 2, Math.PI, 0, true);
  arch.lineTo(hole / 2, 0);
  shape.holes.push(arch);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 60, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x8c8378, roughness: 0.95 }));
  mesh.position.copy(toWorld(stage, stage.w - w / 2 + 20, track.y, 70));
  return mesh;
}

/** Text in a speech bubble, drawn once onto a sprite. */
export function bubble(text) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(10, 10, 620, 150, 60);
  g.moveTo(290, 158);
  g.lineTo(320, 196);
  g.lineTo(350, 158);
  g.fill();
  g.fillStyle = '#2a1a10';
  g.font = '800 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 320, 88);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(420, 131, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function imageSprite(img, size) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(size * (img.width / img.height), size, 1);
  return sprite;
}

async function loadTrain(penguinImg) {
  const gltf = restoreOldColours(await loadModel('toy_train.glb'));
  gltf.scene.getObjectByName('Rail')?.removeFromParent(); // the set comes with an oval track; we lay our own
  const train = layAlong(gltf.scene, { length: SIZES.train });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const spin = gltf.animations[0] ? mixer.clipAction(gltf.animations[0]) : null;
  spin?.play();
  if (penguinImg) {
    const driver = imageSprite(penguinImg, SIZES.penguin);
    driver.position.set(SIZES.train * 0.3, train.userData.size.h * 0.95, 0);
    train.add(driver);
    train.userData.driver = driver;
  }
  return { object: train, mixer, spin };
}

/** Builds the scene. Returns everything the actors need. */
export async function buildWorld(canvas, stage, track, chars) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(stage.w, stage.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const camera = new THREE.PerspectiveCamera(FOV, stage.w / stage.h, 10, 10000);
  camera.position.z = stage.h / 2 / Math.tan((FOV / 2) * (Math.PI / 180));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4636, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-500, 700, 1200);
  scene.add(sun);
  scene.add(railway(stage, track), tunnel(stage, track));

  const [bearGltf, mashaGltf, train] = await Promise.all([loadModel('bear.glb'), loadModel('masha_rig.glb'), loadTrain(chars?.penguin?.img)]);
  const bear = standUp(bearGltf.scene, { height: SIZES.bear });
  const masha = standUp(mashaGltf.scene, { height: SIZES.masha });
  scene.add(bear, masha, train.object);
  return { renderer, scene, camera, bear, masha, train, bearRig: bearGltf.scene, mashaRig: mashaGltf.scene };
}
