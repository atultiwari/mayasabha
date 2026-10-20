// MediaPipe pose detection: body landmarks (for hands) plus a person mask (for the whole body) from
// one small model. Loads from vendor/ when `npm run setup` has been run, otherwise from the CDN.

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
    numPoses: 2,
    outputSegmentationMasks: true,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Combines the per-person masks into one (max), copying the data out so MediaPipe can free its buffers. */
function mergeMasks(masks) {
  if (!masks?.length) return null;
  const { width, height } = masks[0];
  const data = new Float32Array(width * height);
  for (const m of masks) {
    const src = m.getAsFloat32Array();
    for (let i = 0; i < data.length; i += 1) if (src[i] > data[i]) data[i] = src[i];
    m.close();
  }
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
  return {
    source,
    detect(video, timeMs) {
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return null; // no new frame
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, timeMs);
      return { poses: result.landmarks ?? [], mask: mergeMasks(result.segmentationMasks) };
    },
  };
}
