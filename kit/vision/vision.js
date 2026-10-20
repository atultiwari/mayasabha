// Drop-in camera tracking for activities. Opens a camera (or a test video), runs pose detection,
// and every frame offers { grid, hands } in stage coordinates. Also owns the calibration panel
// (K: click the 4 projected targets in the camera view) and a debug view (I).
import { loadJson, saveJson } from '../storage.js';
import { openPhoneSource, openSource } from './camera.js';
import { serverInfo } from '../server-info.js';
import { createPoseDetector } from './pose.js';
import { calibratedMapping, defaultMapping, handsFromPose, occupancyGrid } from './body-map.js';
import { CALIBRATION_TARGETS, addCalibrationClick, sanitizeCalibration, startCalibration } from './calibration.js';

const GRID = { cols: 48, rows: 27 };
const PANEL_STYLE = 'position:fixed;z-index:20;background:#000;border:2px solid #3ee0ff;border-radius:12px;overflow:hidden;cursor:crosshair';
const ORDER = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function makePanel() {
  const panel = document.createElement('div');
  panel.style.cssText = `${PANEL_STYLE};display:none`;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.style.cssText = 'display:block;width:100%;height:auto';
  const label = document.createElement('div');
  label.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:8px 12px;background:rgba(0,0,0,.7);color:#fff;font:600 15px system-ui';
  panel.append(canvas, label);
  document.body.append(panel);
  return { panel, canvas, ctx: canvas.getContext('2d'), label };
}

function placePanel(panel, large) {
  const w = large ? Math.min(window.innerWidth * 0.6, 900, window.innerHeight * 0.75) : 280;
  Object.assign(panel.style, large
    ? { width: `${w}px`, left: `${(window.innerWidth - w) / 2}px`, top: '8vh', bottom: '' }
    : { width: `${w}px`, left: '16px', top: '', bottom: '16px' });
}

/**
 * @param {{ stage: ReturnType<import('../stage.js').createStage>, key: string, hud: object, pose?: boolean }} opts
 * pose: false skips body tracking (camera + calibration only, e.g. for colour detection).
 */
export function createVision({ stage, key, hud, pose = true }) {
  const storageKey = `${key}:camera`;
  const saved = loadJson(storageKey) ?? {};
  let mirror = Boolean(saved.mirror);
  let points = sanitizeCalibration(saved.points);
  let mapping = points ? calibratedMapping(stage.size, points) : defaultMapping(stage.size, mirror);
  let source = null;
  let detector = null;
  let starting = false;
  let calibration = null;
  let debug = false;
  let latest = { grid: null, hands: [], mask: null, poses: [] };
  const ui = makePanel();

  const persist = () => saveJson(storageKey, { mirror, points });

  async function start({ videoUrl } = {}) {
    if (source || starting) return;
    starting = true;
    try {
      hud.toast('📷 Starting camera…', 4000);
      // A phone set up on the home page (IP Webcam) is preferred over the laptop's own camera.
      const phone = videoUrl ? null : (await serverInfo())?.phoneCamera;
      source = phone ? await openPhoneSource({ rotate: phone.rotate }) : await openSource({ videoUrl });
      if (pose) {
        hud.toast('🧠 Loading body tracking (first time can take a moment)…', 8000);
        detector = detector ?? (await createPoseDetector());
      }
      hud.toast(`📷 Tracking on (${source.label})${points ? '' : ', press K to calibrate'}`, 4000);
    } catch (err) {
      console.error('camera start failed', err);
      hud.toast(`📷 ${err.message || 'Camera blocked'}`, 6000);
      source?.stop();
      source = null;
    } finally {
      starting = false;
    }
  }

  function stop() {
    source?.stop();
    source = null;
    latest = { grid: null, hands: [], mask: null, poses: [] };
    hud.toast('📷 Camera off');
  }

  function refreshPanel() {
    const show = Boolean(source) && (calibration || debug);
    ui.panel.style.display = show ? 'block' : 'none';
    if (show) placePanel(ui.panel, Boolean(calibration));
  }

  function beginCalibration() {
    if (!source) return hud.toast('📷 Turn the camera on first (C)');
    calibration = startCalibration();
    refreshPanel();
    return undefined;
  }

  ui.canvas.addEventListener('pointerdown', (e) => {
    if (!calibration) return;
    const r = ui.canvas.getBoundingClientRect();
    calibration = addCalibrationClick(calibration, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    if (!calibration.done) return;
    points = calibration.points;
    mapping = calibratedMapping(stage.size, points);
    persist();
    calibration = null;
    refreshPanel();
    hud.toast('🎯 Calibrated: the wall and camera are lined up');
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && calibration) {
      calibration = null;
      refreshPanel();
    }
  });

  function drawPanel() {
    if (ui.panel.style.display === 'none' || !source) return;
    const { ctx, canvas } = ui;
    const { videoWidth, videoHeight } = source.video;
    if (videoWidth && (canvas.width !== videoWidth || canvas.height !== videoHeight)) {
      canvas.width = videoWidth; // keep the camera's own shape (portrait phones, 4:3 webcams…)
      canvas.height = videoHeight;
    }
    ctx.drawImage(source.video, 0, 0, canvas.width, canvas.height);
    if (latest.mask && debug && !calibration) drawMask(ctx, latest.mask, canvas);
    for (const lm of latest.poses) {
      ctx.fillStyle = '#ffd23e';
      for (const p of lm) ctx.fillRect(p.x * canvas.width - 3, p.y * canvas.height - 3, 6, 6);
    }
    if (calibration) {
      ctx.fillStyle = '#ff7ad9';
      calibration.points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(String(i + 1), p.x * canvas.width + 14, p.y * canvas.height);
      });
      ui.label.textContent = `Click target ${calibration.points.length + 1} (${ORDER[calibration.points.length]}) where you see it in this camera view · Esc cancels`;
    } else {
      ui.label.textContent = `${source.label} · ${mapping.kind === 'calibrated' ? 'calibrated' : 'not calibrated (K)'} · I hides`;
    }
  }

  function drawMask(ctx, mask, canvas) {
    const img = ctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.data.length; i += 1) {
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = mask.data[i] > 0.5 ? 110 : 0;
    }
    const tmp = new OffscreenCanvas(mask.width, mask.height);
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }

  /** Runs detection on the newest frame. @returns {{ grid: object|null, hands: {x:number,y:number}[] }} */
  function update(timeMs) {
    if (source && detector) {
      try {
        const res = detector.detect(source.video, timeMs);
        if (res) {
          latest = {
            poses: res.poses,
            mask: res.mask,
            grid: res.mask ? occupancyGrid(res.mask, mapping, stage.size, GRID.cols, GRID.rows) : null,
            hands: handsFromPose(res.poses, mapping),
          };
        }
      } catch (err) {
        console.error('pose detection failed', err);
      }
    }
    drawPanel();
    return { grid: latest.grid, hands: latest.hands };
  }

  /** Draws calibration targets (and, in debug, what the camera thinks) onto the stage. */
  function drawStage(ctx) {
    if (calibration) {
      CALIBRATION_TARGETS.forEach((t, i) => {
        const x = t.x * stage.size.w;
        const y = t.y * stage.size.h;
        const done = i < calibration.points.length;
        ctx.fillStyle = done ? '#444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = '800 36px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 2);
      });
      return;
    }
    if (!debug || !latest.grid) return;
    const g = latest.grid;
    ctx.fillStyle = 'rgba(80,140,255,0.25)';
    for (let i = 0; i < g.cells.length; i += 1) {
      if (g.cells[i]) ctx.fillRect((i % g.cols) * g.cellW, Math.floor(i / g.cols) * g.cellH, g.cellW, g.cellH);
    }
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 6;
    for (const h of latest.hands) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return {
    get on() { return Boolean(source); },
    get video() { return source?.video ?? null; },
    get mapping() { return mapping; },
    get calibrating() { return Boolean(calibration); },
    toggle: (opts) => (source ? stop() : start(opts)),
    calibrate: beginCalibration,
    toggleMirror() {
      mirror = !mirror;
      if (!points) mapping = defaultMapping(stage.size, mirror);
      persist();
      hud.toast(mirror ? '🪞 Mirror on (camera faces the players)' : '🪞 Mirror off (camera faces the wall)');
    },
    toggleDebug() {
      debug = !debug;
      refreshPanel();
    },
    resetCalibration() {
      points = null;
      mapping = defaultMapping(stage.size, mirror);
      persist();
    },
    update,
    drawStage,
  };
}
