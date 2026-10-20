// Scenes for the corner, built in metres around the corner (see corner-geometry.js). "Behind the
// walls" is z < 0 (left wall) and x > 0 (right wall); the room is x < 0, z > 0. Anything placed on a
// wall plane looks painted on the wall; behind it looks like a window; in front looks like it floats.
// Each scene: build(ctx) → { group, update(t, dt) }.
import * as THREE from '../../lib/three/three.module.js';
import { paradeAt } from './parade.js';

const TEX = '../../assets/space/';
const WALL_COLOUR = 0xd9d4dc; // close to a plain painted wall, so the start looks like nothing at all

function starSky(loader, radius = 60) {
  const map = loader.load(TEX + '2k_stars_milky_way.jpg');
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide }));
}

function lights(group) {
  group.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 4, 4);
  group.add(sun);
}

function planet(loader, file, r) {
  const map = loader.load(TEX + file);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), new THREE.MeshStandardMaterial({ map, roughness: 1 }));
}

/** Bricks covering one wall, flush with its surface. side: 'left' (plane z=0) or 'right' (plane x=0). */
function bricksFor(side, room, material) {
  const width = side === 'left' ? room.leftWidth : room.rightWidth;
  const bw = 0.24;
  const bh = 0.1;
  const bricks = [];
  for (let row = 0; row * bh < room.height; row += 1) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let u = -offset; u < width; u += bw) {
      const w = Math.min(bw, width - u) - 0.008;
      const start = Math.max(0, u);
      const ww = Math.min(u + bw, width) - start - 0.008;
      if (ww <= 0.01 || w <= 0.01) continue;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(side === 'left' ? ww : 0.04, bh - 0.008, side === 'left' ? 0.04 : ww), material);
      const along = start + ww / 2;
      const y = row * bh + bh / 2;
      if (side === 'left') mesh.position.set(-along, y, -0.02);
      else mesh.position.set(0.02, y, along);
      bricks.push({ mesh, along, y, side, delay: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
    }
  }
  return bricks;
}

/** Break the Wall: the corner looks like plain wall, then bricks tumble out and space appears behind. */
function wallBreak({ room, loader }) {
  const group = new THREE.Group();
  lights(group);
  group.add(starSky(loader));
  const earth = planet(loader, '2k_earth_daymap.jpg', 0.8);
  earth.position.set(1.4, room.height * 0.55, -1.6);
  group.add(earth);
  const moon = planet(loader, '2k_moon.jpg', 0.22);
  group.add(moon);
  const material = new THREE.MeshStandardMaterial({ color: WALL_COLOUR, roughness: 0.95 });
  const bricks = [...bricksFor('left', room, material), ...bricksFor('right', room, material)];
  const centre = { y: room.height * 0.55 };
  for (const b of bricks) {
    b.delay = 1.8 + Math.hypot(b.along, b.y - centre.y) * 3.2 + Math.random() * 0.6; // break spreads slowly from the corner
    const out = b.side === 'left' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(-1, 0, 0);
    b.vel.copy(out.multiplyScalar(0.6 + Math.random() * 0.8)).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random(), (Math.random() - 0.5) * 0.4));
    b.spin.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    b.home = b.mesh.position.clone();
    group.add(b.mesh);
  }
  let clock = 0;
  return {
    group,
    restart: () => {
      clock = 0;
      for (const b of bricks) {
        b.mesh.position.copy(b.home);
        b.mesh.rotation.set(0, 0, 0);
        b.mesh.visible = true;
      }
    },
    update(t, dt) {
      clock += dt;
      earth.rotation.y += dt * 0.3;
      moon.position.set(earth.position.x + Math.cos(t * 0.6) * 1.3, earth.position.y + 0.2, earth.position.z + Math.sin(t * 0.6) * 1.3);
      for (const b of bricks) {
        const age = clock - b.delay;
        if (age < 0) {
          // cracks: a tiny shiver just before each brick lets go
          if (age > -0.4) b.mesh.position.copy(b.home).add(new THREE.Vector3((Math.random() - 0.5) * 0.004, 0, (Math.random() - 0.5) * 0.004));
          continue;
        }
        b.mesh.position.set(b.home.x + b.vel.x * age, b.home.y + b.vel.y * age - 2.4 * age * age, b.home.z + b.vel.z * age); // a little floaty
        b.mesh.rotation.set(b.spin.x * age, b.spin.y * age, b.spin.z * age);
        b.mesh.visible = b.mesh.position.y > -3;
      }
    },
  };
}

/** Floating Cube: a glowing cube hovers out of the corner, with a neon grid running back into the walls. */
function floatingCube({ room }) {
  const group = new THREE.Group();
  const size = Math.min(room.leftWidth, room.rightWidth, room.height) * 0.38;
  const cube = new THREE.Group();
  const geo = new THREE.BoxGeometry(size, size, size);
  cube.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3ec8ff, transparent: true, opacity: 0.18 })));
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9ff0ff })));
  cube.position.set(-size * 1.1, room.height * 0.5, size * 1.1);
  group.add(cube);
  // A box "room" behind each wall: neon lines receding, so the walls look like openings.
  const depth = 1.5;
  const mat = new THREE.LineBasicMaterial({ color: 0xff4fd8 });
  const pts = [];
  const H = room.height;
  for (let i = 0; i <= 6; i += 1) {
    const x = -(room.leftWidth * i) / 6;
    pts.push(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, -depth), new THREE.Vector3(x, H, 0), new THREE.Vector3(x, H, -depth));
    const z = (room.rightWidth * i) / 6;
    pts.push(new THREE.Vector3(0, 0, z), new THREE.Vector3(depth, 0, z), new THREE.Vector3(0, H, z), new THREE.Vector3(depth, H, z));
  }
  for (let d = 0.25; d <= depth; d += 0.25) {
    pts.push(new THREE.Vector3(-room.leftWidth, 0, -d), new THREE.Vector3(d, 0, -d), new THREE.Vector3(-room.leftWidth, H, -d), new THREE.Vector3(d, H, -d));
    pts.push(new THREE.Vector3(d, 0, -d), new THREE.Vector3(d, 0, room.rightWidth), new THREE.Vector3(d, H, -d), new THREE.Vector3(d, H, room.rightWidth));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  return {
    group,
    restart: () => {},
    update(t) {
      cube.rotation.set(t * 0.5, t * 0.7, t * 0.3);
      cube.position.y = room.height * 0.5 + Math.sin(t * 1.4) * 0.08;
      mat.color.setHSL((t * 0.05) % 1, 0.9, 0.6);
    },
  };
}

/** Aquarium Corner: both walls become glass, fish swim in deep water behind them. */
function aquarium({ room, art }) {
  const group = new THREE.Group();
  const water = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 32), new THREE.MeshBasicMaterial({ color: 0x0b4f86, side: THREE.BackSide }));
  group.add(water);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x6f5f3a }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2; // seabed well below, so the walls show mostly deep water
  group.add(floor);
  const fish = [];
  const kinds = ['fish', 'tropical-fish', 'blowfish', 'whale', 'octopus', 'turtle', 'fish', 'tropical-fish'];
  kinds.forEach((kind, i) => {
    const img = art[kind];
    if (!img) return;
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    const s = kind === 'whale' ? 1.1 : 0.32;
    sprite.scale.set(s, s, 1);
    group.add(sprite);
    fish.push({ sprite, radius: 1 + (i % 4) * 0.5, speed: 0.15 + (i % 3) * 0.06, height: 0.15 + ((i * 0.37) % 1) * room.height, phase: i * 1.3, mat: sprite.material });
  });
  const bubbles = Array.from({ length: 40 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.015 + (i % 3) * 0.01, 8, 8), new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.6 }));
    m.userData = { x: 0.2 + (i % 7) * 0.25, z: -0.2 - (i % 5) * 0.3, speed: 0.15 + (i % 4) * 0.05 };
    group.add(m);
    return m;
  });
  return {
    group,
    restart: () => {},
    update(t) {
      for (const f of fish) {
        // Circle around a point behind the corner, always staying behind the glass.
        const a = t * f.speed + f.phase;
        const x = 0.9 + Math.cos(a) * f.radius;
        const z = -0.9 + Math.sin(a) * f.radius;
        f.sprite.position.set(Math.max(0.25, x), f.height + Math.sin(t + f.phase) * 0.05, Math.min(-0.25, z));
        f.mat.rotation = 0;
        f.sprite.scale.x = Math.abs(f.sprite.scale.x) * (Math.sin(a) > 0 ? -1 : 1);
      }
      for (const b of bubbles) {
        const y = ((t * b.userData.speed + b.userData.x) % 1.2) * room.height * 1.1 - 0.2;
        b.position.set(b.userData.x, y, b.userData.z);
      }
    },
  };
}

/** Saturn Rising: Saturn drifts out from behind the corner and hangs in the room in front of you. */
function saturnModel(loader, r = 0.32) {
  const saturn = new THREE.Group();
  const body = planet(loader, '2k_saturn.jpg', r);
  saturn.add(body);
  const inner = r * 1.25;
  const outer = r * 2.25;
  const ringGeo = new THREE.RingGeometry(inner, outer, 96, 1);
  const pos = ringGeo.attributes.position;
  const uv = ringGeo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xd8c39a, alphaMap: loader.load(TEX + '2k_saturn_ring_alpha.png'), transparent: true, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2.4;
  saturn.add(ring);
  return { saturn, body };
}

function saturnRising({ room, loader }) {
  const group = new THREE.Group();
  lights(group);
  group.add(starSky(loader));
  const { saturn, body } = saturnModel(loader);
  group.add(saturn);
  let clock = 0;
  return {
    group,
    restart: () => { clock = 0; },
    update(t, dt) {
      clock += dt;
      const k = Math.min(1, clock / 10); // 10 s journey from deep behind the corner into the room
      const ease = k * k * (3 - 2 * k);
      saturn.position.set(2.2 - ease * 2.7, room.height * 0.55 + Math.sin(t * 0.8) * 0.04, -2.2 + ease * 2.7);
      body.rotation.y += dt * 0.4;
      saturn.rotation.z = Math.sin(t * 0.3) * 0.1;
    },
  };
}

/** A soft round glow (for the Sun), drawn once onto a canvas. */
function glowSprite(colour, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, colour);
  grad.addColorStop(1, 'rgba(255,140,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function paradeBodies(loader) {
  const sun = new THREE.Group();
  const sunMap = loader.load(TEX + '2k_sun.jpg');
  sunMap.colorSpace = THREE.SRGBColorSpace;
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 64, 64), new THREE.MeshBasicMaterial({ map: sunMap }));
  sun.add(sunBall, glowSprite('rgba(255,200,80,0.7)', 0.62)); // glow fades out well inside a small corner
  const { saturn, body: saturnBody } = saturnModel(loader, 0.17);
  const ball = (file, r) => planet(loader, file, r);
  return {
    moon: { object: ball('2k_moon.jpg', 0.2), label: 'Moon! Chanda Mama!' },
    earth: { object: ball('2k_earth_daymap.jpg', 0.22), label: 'Earth! Our home!' },
    jupiter: { object: ball('2k_jupiter.jpg', 0.26), label: 'Jupiter! The biggest planet!' },
    saturn: { object: saturn, spin: saturnBody, label: 'Saturn, with its rings!' },
    sun: { object: sun, spin: sunBall, label: 'The Sun! So bright!' },
  };
}

/**
 * Planet Parade: the Moon, Earth, Jupiter, Saturn and the Sun take turns coming out of the corner
 * to float in the room, then go back in. The Moon comes every other turn.
 */
function planetParade({ room, loader, say }) {
  const group = new THREE.Group();
  lights(group);
  group.add(starSky(loader));
  const bodies = paradeBodies(loader);
  for (const b of Object.values(bodies)) {
    b.object.visible = false;
    group.add(b.object);
  }
  const deep = new THREE.Vector3(1.8, room.height * 0.55, -1.8); // far behind the corner
  // Floating in the room, a little towards the left wall: it usually faces the projector more squarely
  // (brighter), while the trip out of the corner still crosses both walls.
  const front = new THREE.Vector3(-0.34, room.height * 0.5, 0.22);
  let clock = 0;
  let lastTurn = -1;
  return {
    group,
    restart: () => { clock = 0; lastTurn = -1; },
    update(t, dt) {
      clock += dt;
      const now = paradeAt(clock);
      for (const [name, b] of Object.entries(bodies)) b.object.visible = name === now.name;
      const b = bodies[now.name];
      b.object.position.lerpVectors(deep, front, now.out);
      b.object.position.y += Math.sin(t * 0.9) * 0.03 * now.out; // a gentle bob once out
      (b.spin ?? b.object).rotation.y += dt * 0.35;
      if (now.turn !== lastTurn && now.out > 0) {
        lastTurn = now.turn;
        say?.(b.label);
      }
    },
  };
}

/** Line-up grid: 10 cm squares painted exactly on both walls, for checking the 6 points. */
function grid({ room }) {
  const group = new THREE.Group();
  const pts = [];
  for (let y = 0; y <= room.height + 1e-6; y += 0.1) {
    pts.push(new THREE.Vector3(-room.leftWidth, y, 0.001), new THREE.Vector3(0, y, 0.001), new THREE.Vector3(-0.001, y, 0), new THREE.Vector3(-0.001, y, room.rightWidth));
  }
  for (let x = 0; x <= room.leftWidth + 1e-6; x += 0.1) pts.push(new THREE.Vector3(-x, 0, 0.001), new THREE.Vector3(-x, room.height, 0.001));
  for (let z = 0; z <= room.rightWidth + 1e-6; z += 0.1) pts.push(new THREE.Vector3(-0.001, 0, z), new THREE.Vector3(-0.001, room.height, z));
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5cf27c })));
  return { group, restart: () => {}, update: () => {} };
}

export const CORNER_SCENES = Object.freeze({
  'wall-break': { label: 'Break the Wall', icon: '🧱', build: wallBreak },
  cube: { label: 'Floating Cube', icon: '🧊', build: floatingCube },
  aquarium: { label: 'Aquarium Corner', icon: '🐠', build: aquarium },
  saturn: { label: 'Saturn Rising', icon: '🪐', build: saturnRising },
  parade: { label: 'Planet Parade', icon: '🌙', build: planetParade },
  grid: { label: 'Line-up grid', icon: '📐', build: grid },
});
export const SCENE_ORDER = Object.freeze(['parade', 'wall-break', 'cube', 'aquarium', 'saturn', 'grid']);

export { THREE };
