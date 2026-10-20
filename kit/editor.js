// Edit mode (toggle with E): drag the 4 corner handles to fit the picture on the wall, then draw
// ledges by dragging along the tops of real objects (frames, door, shelf). Right-click (or Alt+click)
// a ledge to delete it, G sets the floor line at the pointer, R resets the corners.
// Activities without ledges (e.g. the ceiling) pass `ledges: false` for corners-only editing.
import { hitCorner, moveCorner } from './warp.js';

const HANDLE_RADIUS = 28;
const DELETE_RADIUS = 30;
const COLORS = { frame: '#3ee0ff', ledge: '#ffd23e', ground: '#5cf27c', draft: '#ff7ad9', text: '#ffffff' };

/**
 * @param {{ stage: ReturnType<import('./stage.js').createStage>,
 *           getLedges: () => import('./ledges.js').Ledge[],
 *           onAddLedge: (a: {x:number,y:number}, b: {x:number,y:number}) => void,
 *           onDeleteNear: (p: {x:number,y:number}) => void,
 *           onSetGround: (y: number) => void }} opts
 */
const NOOP = () => {};

export function createEditor({ stage, ledges: ledgeMode = true, getLedges = () => [], onAddLedge = NOOP, onDeleteNear = NOOP, onSetGround = NOOP }) {
  const { overlay, octx } = stage;
  let active = false;
  let drag = null; // { kind: 'corner', index } | { kind: 'ledge', start, end } in screen px
  let pointer = { x: 0, y: 0 };

  function setActive(on) {
    active = on;
    overlay.style.pointerEvents = on ? 'auto' : 'none';
    overlay.style.cursor = on ? 'crosshair' : '';
    if (!on) octx.clearRect(0, 0, overlay.width, overlay.height);
  }

  const toPoint = (e) => ({ x: e.clientX, y: e.clientY });

  overlay.addEventListener('pointerdown', (e) => {
    const p = toPoint(e);
    if (ledgeMode && (e.button === 2 || e.altKey)) {
      onDeleteNear(stage.toStage(p));
      return;
    }
    const index = hitCorner(stage.corners, p, HANDLE_RADIUS);
    if (index >= 0) drag = { kind: 'corner', index };
    else if (ledgeMode) drag = { kind: 'ledge', start: p, end: p };
    if (drag) overlay.setPointerCapture(e.pointerId);
  });
  overlay.addEventListener('pointermove', (e) => {
    pointer = toPoint(e);
    if (drag?.kind === 'corner') stage.setCorners(moveCorner(stage.corners, drag.index, pointer), false);
    if (drag?.kind === 'ledge') drag = { ...drag, end: pointer };
  });
  overlay.addEventListener('pointerup', () => {
    if (drag?.kind === 'corner') stage.setCorners(stage.corners, true);
    if (drag?.kind === 'ledge') onAddLedge(stage.toStage(drag.start), stage.toStage(drag.end));
    drag = null;
  });
  overlay.addEventListener('contextmenu', (e) => e.preventDefault());

  /** Handles edit-only keys; returns true if the key was used. */
  function handleKey(key) {
    if (!active) return false;
    if (key === 'g' && ledgeMode) onSetGround(stage.toStage(pointer).y);
    else if (key === 'r') stage.resetCorners();
    else return false;
    return true;
  }

  function line(a, b, color, width, dash = []) {
    octx.strokeStyle = color;
    octx.lineWidth = width;
    octx.setLineDash(dash);
    octx.beginPath();
    octx.moveTo(a.x, a.y);
    octx.lineTo(b.x, b.y);
    octx.stroke();
    octx.setLineDash([]);
  }

  function drawFrame() {
    const c = stage.corners;
    c.forEach((p, i) => line(p, c[(i + 1) % 4], COLORS.frame, 2, [10, 8]));
    c.forEach((p, i) => {
      octx.fillStyle = COLORS.frame;
      octx.beginPath();
      octx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      octx.fill();
      octx.fillStyle = '#000';
      octx.font = 'bold 14px system-ui';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(String(i + 1), p.x, p.y + 1);
    });
  }

  function drawLedges() {
    for (const l of getLedges()) {
      const a = stage.toScreen(l.a);
      const b = stage.toScreen(l.b);
      const ground = l.id === 'ground';
      line(a, b, ground ? COLORS.ground : COLORS.ledge, ground ? 3 : 6, ground ? [14, 10] : []);
    }
    if (drag?.kind === 'ledge') line(drag.start, drag.end, COLORS.draft, 4);
  }

  function drawHelp() {
    const lines = ledgeMode ? [
      'EDIT MODE  (E to finish)',
      'Drag the 4 numbered corners to fit the wall',
      'Drag along a frame top / shelf to add a ledge',
      'Right-click or Alt+click a ledge to delete it',
      'G = floor line at pointer   R = reset corners',
    ] : [
      'EDIT MODE  (E to finish)',
      'Drag the 4 numbered corners to fit the surface',
      'R = reset corners',
    ];
    octx.font = '600 16px system-ui';
    octx.textAlign = 'left';
    octx.textBaseline = 'top';
    octx.fillStyle = 'rgba(0,0,0,0.65)';
    octx.fillRect(16, 16, 420, lines.length * 24 + 16);
    octx.fillStyle = COLORS.text;
    lines.forEach((t, i) => octx.fillText(t, 28, 26 + i * 24));
  }

  function draw() {
    if (!active) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    drawFrame();
    drawLedges();
    drawHelp();
  }

  return { get active() { return active; }, setActive, toggle: () => setActive(!active), handleKey, draw };
}
