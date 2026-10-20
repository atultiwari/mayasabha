// Builds the Three.js solar system: starry sky, glowing Sun, textured planets with their tilt and
// spin, Earth's clouds, Saturn's rings, moons, faint orbit lines, and a "true sizes" line-up.
import * as THREE from '../../lib/three/three.module.js';
import { PLANETS, SUN } from './solar-data.js';
import { bodyRadius, moonOrbitRadius, orbitAngle, orbitRadius, planetPosition, sizeRowLayout, spinAngle } from './orbits.js';

const TEX = '../../assets/space/';
const SEGMENTS = 64;
const DEG = Math.PI / 180;
export const PHASES = Object.freeze(Object.fromEntries(PLANETS.map((p, i) => [p.id, i * 1.7 + 0.4])));

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d').createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.25, 'rgba(255,200,90,0.55)');
  g.addColorStop(0.6, 'rgba(255,140,40,0.12)');
  g.addColorStop(1, 'rgba(255,120,0,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function makeSun(loader) {
  const r = bodyRadius(SUN.radiusKm, 'storybook');
  const group = new THREE.Group();
  const map = loader.load(TEX + SUN.texture);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, SEGMENTS, SEGMENTS), new THREE.MeshBasicMaterial({ map }));
  const glowMat = (opacity) => new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const glow = new THREE.Sprite(glowMat(0.9));
  glow.scale.setScalar(r * 4.2);
  const halo = new THREE.Sprite(glowMat(0.35));
  halo.scale.setScalar(r * 9);
  group.add(mesh, glow, halo);
  return { group, mesh, glow, radius: r };
}

function texturedSphere(loader, file, radius, color) {
  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: color ?? 0xffffff });
  if (file) {
    const map = loader.load(TEX + file);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    material.map = map;
  }
  return new THREE.Mesh(new THREE.SphereGeometry(radius, SEGMENTS, SEGMENTS), material);
}

/** A flat ring whose texture runs from the inner edge (u=0) to the outer edge (u=1). */
function makeRings(loader, inner, outer, file) {
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const d = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (d - inner) / (outer - inner), 0.5);
  }
  const alpha = loader.load(TEX + file);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd8c39a, alphaMap: alpha, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function orbitLine(radius, opacity = 0.18) {
  const pts = Array.from({ length: 256 }, (_, i) => {
    const a = (i / 256) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  });
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fa6ff, transparent: true, opacity }));
}

function makeMoon(loader, moon, planetR, index) {
  const r = bodyRadius(moon.radiusKm, 'storybook');
  const mesh = texturedSphere(loader, moon.texture, r, moon.texture ? null : new THREE.Color(moon.color));
  return { data: moon, mesh, radius: r, distance: moonOrbitRadius(planetR, index), phase: index * 2.1 };
}

function makePlanet(loader, planet) {
  const r = bodyRadius(planet.radiusKm, 'storybook');
  const anchor = new THREE.Group(); // moves along the orbit
  const tilt = new THREE.Group(); // holds the axial tilt
  tilt.rotation.z = planet.tiltDeg * DEG;
  const mesh = texturedSphere(loader, planet.texture, r);
  tilt.add(mesh);
  let clouds = null;
  if (planet.clouds) {
    const alphaMap = loader.load(TEX + planet.clouds);
    clouds = new THREE.Mesh(new THREE.SphereGeometry(r * 1.015, SEGMENTS, SEGMENTS),
      new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap, transparent: true, depthWrite: false, roughness: 1 }));
    tilt.add(clouds);
  }
  if (planet.rings) tilt.add(makeRings(loader, r * 1.24, r * 2.27, planet.rings));
  anchor.add(tilt);
  const moons = planet.moons.map((m, i) => makeMoon(loader, m, r, i));
  moons.forEach((m) => anchor.add(m.mesh));
  return { data: planet, anchor, mesh, clouds, moons, radius: r, orbit: orbitLine(orbitRadius(planet.au)) };
}

function makeSizeRow(loader) {
  const group = new THREE.Group();
  const layout = sizeRowLayout(PLANETS);
  group.userData.layout = layout;
  // Its own light: the Sun's light lives in the (hidden) orbit view. Lit from the Sun's side, a little from the front.
  const light = new THREE.DirectionalLight(0xfff1dd, 2.6);
  light.position.set(-60, 10, 40);
  group.add(light);
  for (const item of layout) {
    const planet = PLANETS.find((p) => p.id === item.id);
    const tilt = new THREE.Group();
    tilt.rotation.z = planet.tiltDeg * DEG;
    const mesh = texturedSphere(loader, planet.texture, item.r);
    tilt.add(mesh);
    if (planet.rings) tilt.add(makeRings(loader, item.r * 1.24, item.r * 2.27, planet.rings));
    tilt.position.x = item.x;
    group.add(tilt);
  }
  // The Sun at true size dwarfs everything: only its edge fits, on the left.
  const sunR = (SUN.radiusKm / 69911) * 6;
  const sunMap = loader.load(TEX + SUN.texture);
  sunMap.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(sunR, 128, 128), new THREE.MeshBasicMaterial({ map: sunMap }));
  sun.position.x = -sunR - 3;
  group.add(sun);
  group.visible = false;
  return group;
}

/** Creates everything and returns handles the main loop updates every frame. */
export function buildSolarSystem(renderer) {
  const scene = new THREE.Scene();
  const loader = new THREE.TextureLoader();
  const sky = loader.load(TEX + '2k_stars_milky_way.jpg');
  sky.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 64, 64), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, color: 0x9999aa })));

  const system = new THREE.Group();
  const sun = makeSun(loader);
  system.add(sun.group);
  system.add(new THREE.PointLight(0xfff1dd, 3.2, 0, 0)); // no falloff: outer planets stay visible
  scene.add(new THREE.AmbientLight(0x404a66, 0.35)); // a hint of the night side
  const planets = PLANETS.map((p) => makePlanet(loader, p));
  for (const p of planets) system.add(p.anchor, p.orbit);
  scene.add(system);

  const sizeRow = makeSizeRow(loader);
  scene.add(sizeRow);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return { scene, system, sun, planets, sizeRow };
}

/** Moves every body to where it is at day `tDays`. */
export function updateSolarSystem(world, tDays) {
  world.sun.mesh.rotation.y = spinAngle(tDays, SUN.dayHours);
  for (const p of world.planets) {
    const pos = planetPosition(p.data, tDays, PHASES[p.data.id]);
    p.anchor.position.set(pos.x, pos.y, pos.z);
    p.mesh.rotation.y = spinAngle(tDays, p.data.dayHours);
    if (p.clouds) p.clouds.rotation.y = p.mesh.rotation.y * 1.15;
    for (const m of p.moons) {
      const a = orbitAngle(tDays, m.data.periodDays, m.phase);
      m.mesh.position.set(Math.cos(a) * m.distance, 0, -Math.sin(a) * m.distance);
    }
  }
}

/** World position of a body ('sun', a planet id or a moon id). */
export function bodyWorld(world, id) {
  if (id === 'sun') return { pos: new THREE.Vector3(), radius: world.sun.radius, reach: world.sun.radius };
  for (const p of world.planets) {
    const reach = p.moons.length ? p.moons[p.moons.length - 1].distance + p.radius : p.radius * (p.data.rings ? 2.4 : 1);
    if (p.data.id === id) return { pos: p.anchor.position.clone(), radius: p.radius, reach };
    const moon = p.moons.find((m) => m.data.id === id);
    if (moon) return { pos: p.anchor.position.clone().add(moon.mesh.position), radius: moon.radius, reach: moon.radius };
  }
  return null;
}

export { THREE };
