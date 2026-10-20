// Video sources for camera activities: a real camera, or a video file (handy for testing without
// anyone standing in front of the wall). Cameras need a secure page (localhost or https).

const CAMERA_SIZE = { width: { ideal: 640 }, height: { ideal: 480 } };

function makeVideo() {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  return video;
}

/** Lists cameras by label (labels appear only after permission has been granted once). */
export async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  } catch (err) {
    console.warn('could not list cameras', err);
    return [];
  }
}

/**
 * @param {{ deviceId?: string, videoUrl?: string }} opts
 * @returns {Promise<{ video: HTMLVideoElement, label: string, stop: () => void }>}
 */
export async function openSource({ deviceId, videoUrl } = {}) {
  const video = makeVideo();
  if (videoUrl) {
    video.loop = true;
    video.src = videoUrl;
    await video.play();
    return { video, label: `video: ${videoUrl.split('/').pop()}`, stop: () => video.pause() };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera needs http://localhost or https. Open the page on the computer with the camera.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { ...CAMERA_SIZE, deviceId: { exact: deviceId } } : CAMERA_SIZE,
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  const label = stream.getVideoTracks()[0]?.label ?? 'camera';
  return { video, label, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}
