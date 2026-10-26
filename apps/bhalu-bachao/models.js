// Loading the 3D characters (your own GLB files in assets/custom/models, kept private) and sizing them
// in stage pixels: feet on the ground line, centred, a given height.
import * as THREE from '../../lib/three/three.module.js';
import { GLTFLoader } from '../../lib/three/addons/loaders/GLTFLoader.js';

export const MODELS_DIR = '../../assets/custom/models/';
const loader = new GLTFLoader();

/** @returns {Promise<{ scene: THREE.Group, animations: THREE.AnimationClip[] }>} */
export function loadModel(file) {
  return new Promise((resolve, reject) => {
    loader.load(MODELS_DIR + file, resolve, undefined, (err) => {
      const missing = /404|not found|fetch/i.test(String(err?.message ?? err));
      reject(new Error(missing ? `Missing model ${file}: put it in assets/custom/models/` : `Could not read ${file}: ${err?.message ?? err}`));
    });
  });
}

/**
 * Wraps a model so that its pivot is the middle of its feet and it stands `height` px tall.
 * yaw turns it to face the right way (models are made facing all sorts of directions).
 */
export function standUp(object, { height, yaw = 0 }) {
  const turned = new THREE.Group();
  object.rotation.y = yaw;
  turned.add(object);
  const box = new THREE.Box3().setFromObject(turned);
  const size = box.getSize(new THREE.Vector3());
  const k = height / size.y;
  const holder = new THREE.Group();
  turned.scale.setScalar(k);
  turned.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  holder.add(turned);
  holder.userData.size = { w: size.x * k, h: height, d: size.z * k };
  return holder;
}

/**
 * Lays a long model (the train) along x, `length` px long, with its bottom on the ground line and its
 * left end at the pivot, so position.x is the front when it drives left.
 */
export function layAlong(object, { length, yaw = 0 }) {
  const turned = new THREE.Group();
  object.rotation.y = yaw;
  turned.add(object);
  const box = new THREE.Box3().setFromObject(turned);
  const size = box.getSize(new THREE.Vector3());
  const k = length / size.x;
  const holder = new THREE.Group();
  turned.scale.setScalar(k);
  turned.position.set(-box.min.x * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  holder.add(turned);
  holder.userData.size = { w: length, h: size.y * k, d: size.z * k };
  return holder;
}

/**
 * Three.js no longer reads the old "specular-glossiness" materials, so such models load grey. Their
 * colours are still in the file: put each one back as a plain colour.
 */
export function restoreOldColours(gltf) {
  const json = gltf.parser.json;
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const index = gltf.parser.associations.get(node.material)?.materials;
    const diffuse = json.materials?.[index]?.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseFactor;
    if (!diffuse) return;
    node.material = node.material.clone();
    node.material.color.setRGB(diffuse[0], diffuse[1], diffuse[2]); // stored in linear light, as Three.js works
    node.material.roughness = 0.45;
    node.material.metalness = 0.1;
  });
  return gltf;
}
