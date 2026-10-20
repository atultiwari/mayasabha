// Renders a 3D scene for an inside corner: one off-axis camera per wall (image plane = that wall,
// eye = the viewer), each into its own texture; then a full-screen shader places each texture inside
// its quad of clicked points using the inverse homography per pixel, so the perspective is exact.
import * as THREE from '../../lib/three/three.module.js';
import { screenToWallHomographies, wallFrames, wallFrustum } from './corner-geometry.js';

const NEAR = 0.05;
const FAR = 200;
const TEXTURE_PX = 1400;

const VERTEX = `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// gl_FragCoord is bottom-left based; the homographies use top-left stage pixels.
const FRAGMENT = `
  uniform sampler2D texL;
  uniform sampler2D texR;
  uniform mat3 hL;
  uniform mat3 hR;
  uniform float stageH;
  vec2 wallUv(mat3 h, vec3 p) { vec3 q = h * p; return q.xy / q.z; }
  bool inside(vec2 uv) { return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0; }
  void main() {
    vec3 p = vec3(gl_FragCoord.x, stageH - gl_FragCoord.y, 1.0);
    vec2 l = wallUv(hL, p);
    vec2 r = wallUv(hR, p);
    if (inside(l)) gl_FragColor = texture2D(texL, l);
    else if (inside(r)) gl_FragColor = texture2D(texR, r);
    else gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

const toMatrix3 = (h) => new THREE.Matrix3().set(...h);

function wallCamera() {
  const cam = new THREE.PerspectiveCamera();
  cam.matrixAutoUpdate = true;
  return cam;
}

/** Points the camera from the eye at the wall with the exact off-axis frustum. */
function aimAtWall(cam, wall, eye) {
  const f = wallFrustum(wall, eye, NEAR);
  cam.position.set(eye.x, eye.y, eye.z);
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(f.basis.vr.x, f.basis.vr.y, f.basis.vr.z),
    new THREE.Vector3(f.basis.vu.x, f.basis.vu.y, f.basis.vu.z),
    new THREE.Vector3(f.basis.vn.x, f.basis.vn.y, f.basis.vn.z),
  );
  cam.quaternion.setFromRotationMatrix(m);
  cam.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, NEAR, FAR);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld(true);
}

/**
 * @param {HTMLCanvasElement} canvas stage canvas (1920x1080)
 * @param {{ w: number, h: number }} size stage size in px
 */
export function createCornerRenderer(canvas, size) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size.w, size.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const targets = { left: null, right: null };
  const cams = { left: wallCamera(), right: wallCamera() };

  const composite = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { texL: { value: null }, texR: { value: null }, hL: { value: new THREE.Matrix3() }, hR: { value: new THREE.Matrix3() }, stageH: { value: size.h } },
    depthTest: false,
  });
  const screenScene = new THREE.Scene();
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function makeTarget(aspect) {
    const w = aspect >= 1 ? TEXTURE_PX : Math.round(TEXTURE_PX * aspect);
    const h = aspect >= 1 ? Math.round(TEXTURE_PX / aspect) : TEXTURE_PX;
    const t = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    t.texture.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Call when the measurements change. */
  function setRoom(room) {
    targets.left?.dispose();
    targets.right?.dispose();
    targets.left = makeTarget(room.leftWidth / room.height);
    targets.right = makeTarget(room.rightWidth / room.height);
    composite.uniforms.texL.value = targets.left.texture;
    composite.uniforms.texR.value = targets.right.texture;
  }

  /** Call when the 6 corner points move (stage px). */
  function setPoints(points) {
    const h = screenToWallHomographies(points);
    composite.uniforms.hL.value = toMatrix3(h.left);
    composite.uniforms.hR.value = toMatrix3(h.right);
  }

  function render(scene, room, eye) {
    const walls = wallFrames(room);
    for (const side of ['left', 'right']) {
      aimAtWall(cams[side], walls[side], eye);
      renderer.setRenderTarget(targets[side]);
      renderer.render(scene, cams[side]);
    }
    renderer.setRenderTarget(null);
    renderer.render(screenScene, screenCam);
  }

  return { THREE, renderer, setRoom, setPoints, render };
}
