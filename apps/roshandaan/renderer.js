// Renders the 3D scene for one flat surface (the ceiling) from the viewer's eye: an off-axis camera
// whose image plane is exactly the ceiling patch (Kooima's generalised perspective, as in Kona), drawn
// into a texture; then a full-screen shader puts each projector pixel on its spot of the ceiling using
// the projector-to-metres homography. From the eye, the 3D looks real; anywhere else, it's skewed.
import * as THREE from '../../lib/three/three.module.js';
import { wallFrustum } from '../kona/corner-geometry.js';

const NEAR = 0.05;
const FAR = 60;
const TEXTURE_PX = 2048;

const VERTEX = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// gl_FragCoord is bottom-left based; the homography expects top-left projector pixels.
const FRAGMENT = `
  uniform sampler2D tex;
  uniform mat3 toMetric;
  uniform vec4 rect; // x0, y0, width, height in metres
  uniform float screenH;
  void main() {
    vec3 q = toMetric * vec3(gl_FragCoord.x, screenH - gl_FragCoord.y, 1.0);
    vec2 m = q.xy / q.z;
    vec2 uv = (m - rect.xy) / rect.zw;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    else gl_FragColor = texture2D(tex, uv);
  }
`;

function aim(cam, wall, eye) {
  const f = wallFrustum(wall, eye, NEAR);
  cam.position.set(eye.x, eye.y, eye.z);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(f.basis.vr.x, f.basis.vr.y, f.basis.vr.z),
    new THREE.Vector3(f.basis.vu.x, f.basis.vu.y, f.basis.vu.z),
    new THREE.Vector3(f.basis.vn.x, f.basis.vn.y, f.basis.vn.z),
  );
  cam.quaternion.setFromRotationMatrix(basis);
  cam.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, NEAR, FAR);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld(true);
}

/**
 * @param {HTMLCanvasElement} canvas the stage canvas (projector pixels)
 * @param {{ w: number, h: number }} screen
 */
export function createCeilingRenderer(canvas, screen) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(screen.w, screen.h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cam = new THREE.PerspectiveCamera();
  let target = null;
  let wall = null;

  const composite = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { tex: { value: null }, toMetric: { value: new THREE.Matrix3() }, rect: { value: new THREE.Vector4() }, screenH: { value: screen.h } },
    depthTest: false,
  });
  const screenScene = new THREE.Scene();
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite));
  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /** Call when the setup changes. toMetric: 9 numbers (projector px -> metres); rect: ceiling patch. */
  function setCeiling(toMetric, rect, nextWall) {
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    target?.dispose();
    const aspect = w / h;
    target = new THREE.WebGLRenderTarget(aspect >= 1 ? TEXTURE_PX : Math.round(TEXTURE_PX * aspect), aspect >= 1 ? Math.round(TEXTURE_PX / aspect) : TEXTURE_PX, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    composite.uniforms.tex.value = target.texture;
    composite.uniforms.toMetric.value = new THREE.Matrix3().set(...toMetric);
    composite.uniforms.rect.value.set(rect.x0, rect.y0, w, h);
    wall = nextWall;
  }

  function render(scene, eye) {
    aim(cam, wall, eye);
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.render(screenScene, screenCam);
  }

  return { renderer, setCeiling, render, camera: cam };
}

export { THREE };
