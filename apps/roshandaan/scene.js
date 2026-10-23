// The 3D world above (and just below) the light box, in metres. The ceiling is z = 0; the shaft runs up
// into negative z; the room and the viewer are at positive z. Depth cues on purpose: a shaft whose
// seams crowd together with distance, fog that darkens with depth, a flickering light far up inside,
// drifting dust, shards that fall towards you, and shadows cast on the ceiling around the box.
import * as THREE from '../../lib/three/three.module.js';
import { makeCracks, makeShards, partial } from '../daraar/cracks.js';

const SHAFT_DEPTH = 5; // from ~3 m below, a 5 m shaft's far end looks a third the size of the opening
const CRACK_PX = 1024;

function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Stained concrete with a seam every 50 cm: the seams bunch up with depth, which the eye reads as distance. */
function concrete(widthM, depthM, depthAlongU = false) {
  const tex = canvasTexture(512, 1024, (g, w, h) => {
    g.fillStyle = '#6d6a64';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i += 1) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,18,16' : '200,195,185'},${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 2 + Math.random() * 8);
    }
    const seams = Math.round(depthM / 0.5);
    g.fillStyle = 'rgba(15,12,10,0.8)';
    for (let s = 1; s < seams; s += 1) g.fillRect(0, (s / seams) * h - 3, w, 6);
    for (let i = 0; i < 9; i += 1) {
      const x = Math.random() * w;
      const grad = g.createLinearGradient(x, 0, x, h * 0.6);
      grad.addColorStop(0, 'rgba(40,25,15,0.5)');
      grad.addColorStop(1, 'rgba(40,25,15,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 6 + Math.random() * 18, h * (0.2 + Math.random() * 0.5));
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (depthAlongU) {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2; // the wall's depth runs along u: turn the seams to cross it
    tex.repeat.set(1, widthM / 0.6);
  } else {
    tex.repeat.set(widthM / 0.6, 1);
  }
  return tex;
}

/** The four walls of the shaft behind the light box, and its far end. */
function shaft(size) {
  const group = new THREE.Group();
  const h = size / 2;
  // Top and bottom walls: width along x, depth along local y (-> z). Side walls: depth along local x (-> z).
  const walls = [
    { pos: [0, h, -SHAFT_DEPTH / 2], rot: [Math.PI / 2, 0, 0], side: false },
    { pos: [0, -h, -SHAFT_DEPTH / 2], rot: [-Math.PI / 2, 0, 0], side: false },
    { pos: [h, 0, -SHAFT_DEPTH / 2], rot: [0, -Math.PI / 2, 0], side: true },
    { pos: [-h, 0, -SHAFT_DEPTH / 2], rot: [0, Math.PI / 2, 0], side: true },
  ];
  for (const w of walls) {
    const mat = new THREE.MeshStandardMaterial({ map: concrete(size, SHAFT_DEPTH, w.side), roughness: 0.95, side: THREE.DoubleSide });
    const geo = w.side ? new THREE.PlaneGeometry(SHAFT_DEPTH, size) : new THREE.PlaneGeometry(size, SHAFT_DEPTH);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...w.pos);
    mesh.rotation.set(...w.rot);
    group.add(mesh);
  }
  const end = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0x1a0f0c, roughness: 1 }));
  end.position.z = -SHAFT_DEPTH;
  group.add(end);
  return group;
}

/** The lit ceiling around the box, brightest near it and fading out so the projection's edge never shows. */
function ceilingFill(rect, size) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const shape = new THREE.Shape([
    new THREE.Vector2(rect.x0, rect.y0), new THREE.Vector2(rect.x1, rect.y0),
    new THREE.Vector2(rect.x1, rect.y1), new THREE.Vector2(rect.x0, rect.y1),
  ]);
  const s = size / 2;
  shape.holes.push(new THREE.Path([new THREE.Vector2(-s, -s), new THREE.Vector2(-s, s), new THREE.Vector2(s, s), new THREE.Vector2(s, -s)]));
  const geo = new THREE.ShapeGeometry(shape);
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (pos.getX(i) - rect.x0) / w, (pos.getY(i) - rect.y0) / h);
  const fade = canvasTexture(512, 512, (g, cw, ch) => {
    const cx = (-rect.x0 / w) * cw;
    const cy = (1 - -rect.y0 / h) * ch;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cw, ch) * 0.55);
    // bright around the box (so the hole and the shadows read as darker), fading out at the far edges
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#e9e4da');
    grad.addColorStop(0.8, '#7a756c');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
  });
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: fade, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** The light box's diffuser: a canvas we draw the glow and the cracks onto. */
function panel(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CRACK_PX;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.z = 0.002;
  const stage = { w: CRACK_PX, h: CRACK_PX };
  const cracks = makeCracks(stage, { x: CRACK_PX * 0.55, y: CRACK_PX * 0.45 }, Math.random);
  function paint(glow, crack) {
    const g = canvas.getContext('2d');
    const v = Math.round(125 + glow * 130); // a dead panel still glows faintly, so the cracks show on it
    g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 6)})`;
    g.fillRect(0, 0, CRACK_PX, CRACK_PX);
    g.lineCap = 'round';
    for (const c of cracks) {
      const grow = (crack - c.start) / (1 - c.start);
      if (grow <= 0) continue;
      const pts = partial(c.points, Math.min(1, grow));
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.strokeStyle = '#0a0806'; // a dark gap with light glinting along it
      g.lineWidth = c.start === 0 ? 24 : 13;
      g.stroke();
      g.strokeStyle = '#ffe9c4';
      g.lineWidth = c.start === 0 ? 6 : 3.5;
      g.stroke();
    }
    tex.needsUpdate = true;
  }
  return { mesh, paint };
}

/** The panel broken into triangles that fall out towards you, spinning. */
function shards(size) {
  const group = new THREE.Group();
  const px = 1000;
  const list = makeShards({ x: 0, y: 0, w: px, h: px }, Math.random).map((s) => {
    const pts = s.points.map((p) => new THREE.Vector2((p.x / px - 0.5) * size, (0.5 - p.y / px) * size));
    const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
    const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x - cx, p.y - cy))));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.8, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.userData = { home: new THREE.Vector3(cx, cy, 0.003), drift: new THREE.Vector3(cx * 0.8, cy * 0.8, 0), spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4), delay: s.delay };
    group.add(mesh);
    return mesh;
  });
  function place(t) {
    for (const m of list) {
      const k = Math.max(0, t - m.userData.delay);
      m.position.copy(m.userData.home).addScaledVector(m.userData.drift, k).add(new THREE.Vector3(0, 0, 4.9 * k * k));
      m.rotation.set(m.userData.spin.x * k, m.userData.spin.y * k, m.userData.spin.z * k);
      m.visible = m.position.z < 2.6; // gone past the camera
    }
  }
  return { group, place };
}

function dust(size) {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    pos[i * 3] = (Math.random() - 0.5) * size;
    pos[i * 3 + 1] = (Math.random() - 0.5) * size;
    pos[i * 3 + 2] = -Math.random() * SHAFT_DEPTH;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd9a8, size: 0.012, transparent: true, opacity: 0.6, depthWrite: false }));
  return points;
}

/** Builds the world. Returns the scene and an update(state) to animate it. */
export function buildWorld({ rect, size, eye }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, eye.z + 0.4, eye.z + SHAFT_DEPTH * 0.95);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12)); // little ambient: shadows stay properly dark
  const roomLight = new THREE.DirectionalLight(0xffffff, 3.2); // light from the room side, so things cast shadows on the ceiling
  roomLight.position.set(eye.x + 1.2, eye.y - 0.9, eye.z);
  roomLight.castShadow = true;
  roomLight.shadow.mapSize.set(2048, 2048);
  Object.assign(roomLight.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 8 });
  scene.add(roomLight);
  // Room light spilling a little way up the shaft: walls bright at the rim, fading to black up inside.
  const spill = new THREE.PointLight(0xfff0dc, 2.5, 1.6, 1.6);
  spill.position.set(eye.x * 0.05, eye.y * 0.05, -0.12);
  scene.add(spill);
  const deepLight = new THREE.PointLight(0xff8a3c, 6, 4, 1.6);
  deepLight.position.set(0.1, -0.15, -2.2);
  scene.add(deepLight);

  const fill = ceilingFill(rect, size);
  const box = panel(size);
  const inside = shaft(size);
  const fall = shards(size);
  const motes = dust(size);
  scene.add(fill, box.mesh, inside, fall.group, motes);

  function update({ panel: p, t, shaftLight, showFill = false }) {
    fill.visible = showFill; // off: only the box and what comes out of it are lit; on: shadows fall on a lit ceiling
    box.mesh.visible = !p.broken;
    box.paint(p.glow, p.crack);
    inside.visible = p.broken;
    motes.visible = p.broken;
    fall.group.visible = p.broken && p.shardT < 3;
    if (fall.group.visible) fall.place(p.shardT);
    deepLight.intensity = p.broken ? shaftLight : 0;
    spill.intensity = p.broken ? 2.5 : 0;
    motes.rotation.z = t * 0.02;
  }
  return { scene, update };
}
