// Microphone → clap events. Needs a secure context (http://localhost or https) and a user gesture.
import { DEFAULT_CLAP, feedClap, initialClap, rms } from './clap.js';

/**
 * @param {{ onClap: () => void, onLevel?: (level: number) => void, config?: object }} opts
 * @returns {Promise<{ stop: () => void, setSensitivity: (ratio: number) => void }>}
 */
export async function startMic({ onClap, onLevel = () => {}, config = DEFAULT_CLAP }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone needs http://localhost or https. Open the page on the computer driving the projector.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);

  let cfg = { ...config };
  let state = initialClap();
  let running = true;

  function poll() {
    if (!running) return;
    analyser.getFloatTimeDomainData(buffer);
    const level = rms(buffer);
    const result = feedClap(state, level, ctx.currentTime, cfg);
    state = result.state;
    onLevel(level);
    if (result.fired) onClap();
    requestAnimationFrame(poll);
  }
  poll();

  return {
    stop() {
      running = false;
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
    setSensitivity(ratio) {
      cfg = { ...cfg, ratio };
    },
  };
}
