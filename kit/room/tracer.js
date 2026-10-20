// Trace mode (T): outline the real objects on the wall. Tools: 1 rectangle, 2 ellipse, 3 polygon
// (click points, Enter or click the first point to close). Click a shape to select it; drag its
// handles to reshape or its body to move; Tab changes its tag; Delete removes it.
import { contains, makeEllipse, makePolygon, makeRect, moveHandle, nextTag, outlinePoints, shapeHandles, centroid, translate } from './shapes.js';

const HANDLE_PX = 16;
const COLORS = {
  frame: '#ffd23e', picture: '#ffffff', door: '#ff7ad9', shelf: '#a0e0ff', balloon: '#3ec8ff', clock: '#7be08a', floor: '#ff9a3c', other: '#c0b8ff',
};
const TOOLS = { 1: 'rect', 2: 'ellipse', 3: 'polygon' };

/**
 * @param {{ stage: object, getShapes: () => object[], setShapes: (s: object[]) => void, onToast: (msg: string) => void }} opts
 */
export function createTracer({ stage, getShapes, setShapes, onToast }) {
  const { overlay, octx } = stage;
  let active = false;
  let tool = 'rect';
  let tag = 'frame';
  let selected = null; // shape id
  let drag = null; // { kind: 'new', a, b } | { kind: 'handle', index } | { kind: 'move', last }
  let polygon = []; // points being placed (stage coords)
  let pointer = { x: 0, y: 0 };

  const newId = () => `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  const shapes = () => getShapes();
  const find = (id) => shapes().find((s) => s.id === id);
  const replace = (shape) => setShapes(shapes().map((s) => (s.id === shape.id ? shape : s)));
  const screenToStage = (e) => stage.toStage({ x: e.clientX, y: e.clientY });

  function setActive(on) {
    active = on;
    overlay.style.pointerEvents = on ? 'auto' : 'none';
    overlay.style.cursor = on ? 'crosshair' : '';
    polygon = [];
    drag = null;
    if (!on) octx.clearRect(0, 0, overlay.width, overlay.height);
  }

  function handleAt(p) {
    const shape = selected && find(selected);
    if (!shape) return -1;
    const screen = stage.toScreen(p);
    return shapeHandles(shape).findIndex((h) => {
      const s = stage.toScreen(h);
      return Math.hypot(s.x - screen.x, s.y - screen.y) < HANDLE_PX;
    });
  }

  function addShape(shape) {
    if (!shape) return onToast('Too small: drag a bigger outline');
    setShapes([...shapes(), shape]);
    selected = shape.id;
    return undefined;
  }

  function closePolygon() {
    addShape(makePolygon(newId(), tag, polygon));
    polygon = [];
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (!active) return;
    const p = screenToStage(e);
    overlay.setPointerCapture(e.pointerId);
    const h = handleAt(p);
    if (h >= 0) {
      drag = { kind: 'handle', index: h };
      return;
    }
    if (tool === 'polygon') {
      const first = polygon[0] && stage.toScreen(polygon[0]);
      if (first && polygon.length >= 3 && Math.hypot(first.x - e.clientX, first.y - e.clientY) < HANDLE_PX) closePolygon();
      else polygon = [...polygon, p];
      return;
    }
    const hit = [...shapes()].reverse().find((s) => contains(s, p));
    if (hit) {
      selected = hit.id;
      drag = { kind: 'move', last: p };
      return;
    }
    selected = null;
    drag = { kind: 'new', a: p, b: p };
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!active) return;
    pointer = screenToStage(e);
    const shape = selected && find(selected);
    if (drag?.kind === 'new') drag = { ...drag, b: pointer };
    if (drag?.kind === 'handle' && shape) replace(moveHandle(shape, drag.index, pointer));
    if (drag?.kind === 'move' && shape) {
      replace(translate(shape, pointer.x - drag.last.x, pointer.y - drag.last.y));
      drag = { ...drag, last: pointer };
    }
  });

  overlay.addEventListener('pointerup', () => {
    if (drag?.kind === 'new') addShape((tool === 'ellipse' ? makeEllipse : makeRect)(newId(), tag, drag.a, drag.b));
    drag = null;
  });

  /** Returns true when the key was used by trace mode. */
  function handleKey(key) {
    if (!active) return false;
    if (TOOLS[key]) {
      tool = TOOLS[key];
      polygon = [];
      onToast(`Tool: ${tool}`);
    } else if (key === 'tab') {
      const shape = selected && find(selected);
      if (shape) replace({ ...shape, tag: nextTag(shape.tag) });
      else tag = nextTag(tag);
    } else if (key === 'delete' || key === 'backspace') {
      if (polygon.length) polygon = polygon.slice(0, -1);
      else if (selected) {
        setShapes(shapes().filter((s) => s.id !== selected));
        selected = null;
      }
    } else if (key === 'enter' && polygon.length >= 3) closePolygon();
    else if (key === 'escape') {
      polygon = [];
      selected = null;
    } else return false;
    return true;
  }

  // ---- drawing (screen space, so it lines up with the warped picture) ----------------------------
  function outlineOnScreen(s) {
    const pts = s.kind === 'ellipse' ? outlinePoints(s, 72) : s.kind === 'rect'
      ? [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }]
      : s.points;
    return pts.map((p) => stage.toScreen(p));
  }

  function polyline(points, close) {
    octx.beginPath();
    points.forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)));
    if (close) octx.closePath();
  }

  function drawShape(s) {
    const color = COLORS[s.tag] ?? '#fff';
    const isSel = s.id === selected;
    polyline(outlineOnScreen(s), true);
    octx.fillStyle = `${color}33`;
    octx.fill();
    octx.strokeStyle = color;
    octx.lineWidth = isSel ? 4 : 2;
    octx.stroke();
    const c = stage.toScreen(centroid(s));
    octx.fillStyle = color;
    octx.font = '700 15px system-ui';
    octx.textAlign = 'center';
    octx.fillText(s.tag, c.x, c.y);
    if (!isSel) return;
    for (const h of shapeHandles(s)) {
      const p = stage.toScreen(h);
      octx.fillStyle = '#fff';
      octx.fillRect(p.x - 7, p.y - 7, 14, 14);
    }
  }

  function drawDrafts() {
    if (drag?.kind === 'new') {
      const draft = (tool === 'ellipse' ? makeEllipse : makeRect)('draft', tag, drag.a, drag.b);
      if (draft) {
        polyline(outlineOnScreen(draft), true);
        octx.strokeStyle = '#ffffff';
        octx.setLineDash([8, 6]);
        octx.stroke();
        octx.setLineDash([]);
      }
    }
    if (polygon.length) {
      polyline([...polygon, pointer].map((p) => stage.toScreen(p)), false);
      octx.strokeStyle = '#ffffff';
      octx.lineWidth = 2;
      octx.stroke();
    }
  }

  function drawHelp() {
    const lines = [
      `TRACE MODE (T to finish)   tool: ${tool}   new tag: ${tag}`,
      '1 rectangle  2 ellipse  3 polygon (click points, Enter to close)',
      'Drag over a real object to outline it; drag white squares to adjust',
      'Click a shape to select · drag to move · Tab change tag · Delete remove',
      'Tags: frame · picture (never painted over) · door · shelf · balloon · clock · floor · other',
    ];
    octx.font = '600 15px system-ui';
    octx.textAlign = 'left';
    octx.fillStyle = 'rgba(0,0,0,0.7)';
    octx.fillRect(16, 16, 560, lines.length * 22 + 16);
    octx.fillStyle = '#fff';
    lines.forEach((t, i) => octx.fillText(t, 28, 38 + i * 22));
  }

  function draw() {
    if (!active) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    shapes().forEach(drawShape);
    drawDrafts();
    drawHelp();
  }

  return { get active() { return active; }, setActive, toggle: () => setActive(!active), handleKey, draw };
}
