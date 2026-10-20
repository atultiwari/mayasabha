// One-time setup for camera activities: copies MediaPipe's browser files out of node_modules and
// downloads the pose model, so everything runs offline from vendor/ (git-ignored).
// Usage: npm run setup
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const OUT = join(ROOT, 'vendor');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
const MODEL_FILE = join(OUT, 'models', 'pose_landmarker_lite.task');

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function copyMediaPipe() {
  if (!(await exists(join(PKG, 'vision_bundle.mjs')))) {
    throw new Error('MediaPipe is not installed. Run `npm install` first.');
  }
  await mkdir(join(OUT, 'mediapipe', 'wasm'), { recursive: true });
  await copyFile(join(PKG, 'vision_bundle.mjs'), join(OUT, 'mediapipe', 'vision_bundle.mjs'));
  for (const file of await readdir(join(PKG, 'wasm'))) {
    await copyFile(join(PKG, 'wasm', file), join(OUT, 'mediapipe', 'wasm', file));
  }
  console.log('✓ MediaPipe copied to vendor/mediapipe');
}

async function downloadModel() {
  if (await exists(MODEL_FILE)) {
    console.log('✓ Pose model already present');
    return;
  }
  await mkdir(join(OUT, 'models'), { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(MODEL_FILE, bytes);
  console.log(`✓ Pose model downloaded (${(bytes.length / 1e6).toFixed(1)} MB)`);
}

try {
  await copyMediaPipe();
  await downloadModel();
  console.log('Camera activities are ready to run offline.');
} catch (err) {
  console.error(`Setup failed: ${err.message}`);
  process.exit(1);
}
