// The projected stage: a fixed-size logical canvas (default 1920x1080) on a black page, corner-pinned
// to the screen with a CSS matrix3d. A second, unwarped overlay canvas is used by the edit tools.
// Corners are saved per activity so each one remembers where it was fitted on the wall.
import { loadJson, saveJson } from './storage.js';
import { applyHomography, cssMatrix3d, defaultCorners, isWarpable, sanitizeCorners, warpMaps } from './warp.js';

const CURSOR_HIDE_MS = 2000;

/**
 * @param {{ key: string, width?: number, height?: number, context?: '2d' | 'webgl' }} opts
 * With context 'webgl' no 2D context is created; pass `canvas` to a WebGL renderer (e.g. Three.js).
 */
export function createStage({ key, width = 1920, height = 1080, context = '2d' }) {
  const size = { w: width, h: height };
  const host = document.createElement('div');
  host.className = 'pk-stage';
  Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: `${width}px`, height: `${height}px`, transformOrigin: '0 0' });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' });
  host.append(canvas);

  const overlay = document.createElement('canvas');
  overlay.className = 'pk-overlay';
  Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none' });
  document.body.append(host, overlay);

  const screenSize = () => ({ w: window.innerWidth, h: window.innerHeight });
  const storageKey = `${key}:corners`;
  let corners = sanitizeCorners(loadJson(storageKey));
  let customCorners = Boolean(corners);
  let maps = null;

  function apply() {
    if (!customCorners) corners = defaultCorners(screenSize(), size);
    maps = warpMaps(size, corners);
    host.style.transform = cssMatrix3d(maps.toScreen);
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(window.innerWidth * dpr);
    overlay.height = Math.round(window.innerHeight * dpr);
    overlay.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Ignores corner positions that would collapse the picture (3 corners in a line). */
  function setCorners(next, persist = true) {
    if (!isWarpable(next)) return;
    corners = next;
    customCorners = true;
    if (persist) saveJson(storageKey, corners);
    apply();
  }

  function resetCorners() {
    customCorners = false;
    saveJson(storageKey, null);
    apply();
  }

  // Hide the mouse pointer when idle so it never shows on the wall.
  let cursorTimer = 0;
  function showCursorBriefly() {
    document.body.style.cursor = '';
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => { document.body.style.cursor = 'none'; }, CURSOR_HIDE_MS);
  }
  window.addEventListener('pointermove', showCursorBriefly);
  window.addEventListener('resize', apply);
  apply();
  showCursorBriefly();

  function toggleFullscreen() {
    const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    req?.catch((err) => console.warn('fullscreen not available', err));
  }

  /** Runs fn(dt seconds, t seconds) every animation frame; dt is capped so a hidden tab can't explode physics. */
  function onFrame(fn) {
    let last = performance.now();
    let failures = 0;
    function tick(now) {
      requestAnimationFrame(tick); // schedule first so one bad frame can't freeze the projector
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        fn(dt, now / 1000);
      } catch (err) {
        failures += 1;
        if (failures <= 3) console.error('frame failed', err);
      }
    }
    requestAnimationFrame(tick);
  }

  return {
    size,
    canvas,
    host, // warped container: anything placed inside is corner-pinned with the picture
    ctx: context === '2d' ? canvas.getContext('2d') : null,
    overlay,
    octx: overlay.getContext('2d'),
    get corners() { return corners; },
    toStage: (p) => applyHomography(maps.toStage, p),
    toScreen: (p) => applyHomography(maps.toScreen, p),
    setCorners,
    resetCorners,
    toggleFullscreen,
    onFrame,
  };
}
