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

const PHONE_FPS = 12;

/**
 * The phone (IP Webcam) as a camera: still photos fetched through the local server are drawn onto
 * a canvas (turned by `rotate` degrees) whose stream feeds a normal <video>, so every activity
 * works with it unchanged.
 * @returns {Promise<{ video: HTMLVideoElement, label: string, stop: () => void }>}
 */
export async function openPhoneSource({ rotate = 0 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let running = true;
  let failures = 0;

  async function grab() {
    const res = await fetch('/api/phone-camera/shot.jpg', { cache: 'no-store' });
    if (!res.ok) throw new Error('Phone camera not reachable: is IP Webcam running on the phone?');
    const bitmap = await createImageBitmap(await res.blob());
    const quarter = rotate === 90 || rotate === 270;
    const w = quarter ? bitmap.height : bitmap.width;
    const h = quarter ? bitmap.width : bitmap.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();
    bitmap.close();
  }

  await grab(); // fail early with a clear message if the phone isn't there
  (async function loop() {
    while (running) {
      const started = performance.now();
      try {
        await grab();
        failures = 0;
      } catch (err) {
        failures += 1;
        if (failures === 3) console.warn('phone camera hiccup', err);
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 1000 / PHONE_FPS - (performance.now() - started))));
    }
  })();

  const video = makeVideo();
  video.srcObject = canvas.captureStream(PHONE_FPS);
  await video.play();
  return { video, label: 'phone camera', stop: () => { running = false; video.srcObject?.getTracks().forEach((t) => t.stop()); } };
}
