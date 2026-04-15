import * as THREE from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export type SceneBundle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  webglRenderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  resize: () => void;
  dispose: () => void;
};

export function createSceneBundle(
  canvas: HTMLCanvasElement,
  labelMount: HTMLElement,
): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030308);
  scene.fog = new THREE.FogExp2(0x030308, 0.045);

  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    200,
  );
  camera.position.set(0, 0.35, 11);
  camera.lookAt(0, -0.15, 0);

  const webglRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  webglRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
  webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  webglRenderer.toneMappingExposure = 1.05;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelMount.appendChild(labelRenderer.domElement);

  const ambient = new THREE.AmbientLight(0x9ca3af, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(4, 10, 6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xa78bfa, 0.45);
  rim.position.set(-8, 4, -6);
  scene.add(rim);

  const fill = new THREE.PointLight(0x22d3ee, 0.6, 40, 2);
  fill.position.set(6, 2, 4);
  scene.add(fill);

  const resize = () => {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    webglRenderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  };

  window.addEventListener("resize", resize);

  const dispose = () => {
    window.removeEventListener("resize", resize);
    labelMount.removeChild(labelRenderer.domElement);
    webglRenderer.dispose();
  };

  return { scene, camera, webglRenderer, labelRenderer, resize, dispose };
}
