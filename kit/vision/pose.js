// MediaPipe pose detection: body landmarks (for hands) plus a person mask (for the whole body) from
// one small model. People lying down (a parent on the sofa) are left out of both. Loads from vendor/ when `npm run setup` has been run, otherwise from the CDN.

import { fromFocus, isLyingDown } from './body-map.js';

const VERSION = '1.0.1';
const LOCAL = {
  bundle: new URL('../../vendor/mediapipe/vision_bundle.mjs', import.meta.url).href,
  wasm: new URL('../../vendor/mediapipe/wasm', import.meta.url).href,
  model: new URL('../../vendor/models/pose_landmarker_lite.task', import.meta.url).href,
};
const CDN = {
  bundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`,
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
  model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
};

async function hasLocalFiles() {
  try {
    const res = await fetch(LOCAL.model, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

async function createLandmarker(vision, paths, delegate) {
  const fileset = await vision.FilesetResolver.forVisionTasks(paths.wasm);
  return vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: paths.model, delegate },
    runningMode: 'VIDEO',
    numPoses: 3,
    outputSegmentationMasks: true,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/**
 * Combines the masks of the people who count into one (max), copying the data out and closing every
 * mask so MediaPipe can free its buffers. Masks come in the same order as the poses.
 */
function mergeMasks(masks, keep) {
  if (!masks?.length) return null;
  const { width, height } = masks[0];
  const data = new Float32Array(width * height);
  masks.forEach((m, i) => {
    if (keep[i] !== false) {
      const src = m.getAsFloat32Array();
      for (let j = 0; j < data.length; j += 1) if (src[j] > data[j]) data[j] = src[j];
    }
    m.close();
  });
  return { width, height, data };
}

/**
 * @returns {Promise<{ source: 'local'|'cdn', detect: (video: HTMLVideoElement, timeMs: number) => { poses: object[][], mask: object|null } | null }>}
 */
export async function createPoseDetector() {
  const source = (await hasLocalFiles()) ? 'local' : 'cdn';
  const paths = source === 'local' ? LOCAL : CDN;
  const vision = await import(paths.bundle);
  let landmarker;
  try {
    landmarker = await createLandmarker(vision, paths, 'GPU');
  } catch (err) {
    console.warn('GPU pose detection unavailable, using CPU', err);
    landmarker = await createLandmarker(vision, paths, 'CPU');
  }
  let lastVideoTime = -1;
  const crop = document.createElement('canvas');
  const cropCtx = crop.getContext('2d');

  /** The focus area of the frame, cut out so the model sees people bigger. */
  function cutOut(video, area) {
    const sx = area.x * video.videoWidth;
    const sy = area.y * video.videoHeight;
    const sw = Math.max(1, Math.round(area.w * video.videoWidth));
    const sh = Math.max(1, Math.round(area.h * video.videoHeight));
    if (crop.width !== sw || crop.height !== sh) {
      crop.width = sw;
      crop.height = sh;
    }
    cropCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return crop;
  }

  return {
    source,
    /** @param {{x:number,y:number,w:number,h:number}} [area] normalised part of the frame to look at */
    detect(video, timeMs, area = { x: 0, y: 0, w: 1, h: 1 }) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return null; // no new frame
      lastVideoTime = video.currentTime;
      const whole = area.w >= 1 && area.h >= 1;
      const result = landmarker.detectForVideo(whole ? video : cutOut(video, area), timeMs);
      const all = (result.landmarks ?? []).map((lm) => lm.map((p) => fromFocus(p, area)));
      const aspect = video.videoWidth / (video.videoHeight || 1);
      const keep = all.map((lm) => !isLyingDown(lm, aspect));
      const lying = keep.filter((k) => !k).length;
      const mask = mergeMasks(result.segmentationMasks, keep);
      return { poses: all.filter((_, i) => keep[i]), mask: mask && { ...mask, area }, seen: all.length, lying };
    },
  };
}
