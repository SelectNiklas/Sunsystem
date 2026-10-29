import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CAMERA, RENDER } from '../config/solarSystemData';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  labelRenderer: CSS2DRenderer;
  render(): void;
}

/** Erzeugt Renderer, Szene, Kamera, Controls und die Postprocessing-Kette. */
export function createSceneContext(container: HTMLElement): SceneContext {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio);

  // Antialiasing übernimmt MSAA im Composer-Render-Target.
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER.toneMappingExposure;
  // Statistik über alle Passes eines Frames sammeln (Reset in StatsBar.beginFrame).
  renderer.info.autoReset = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const ambient = new THREE.AmbientLight(RENDER.ambientLight.color, RENDER.ambientLight.intensity);
  scene.add(ambient);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, width / height, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.overviewPosition);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = CAMERA.minDistance;
  controls.maxDistance = CAMERA.maxDistance;
  controls.zoomSpeed = 1.2;

  const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: RENDER.msaaSamples,
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    RENDER.bloom.strength,
    RENDER.bloom.radius,
    RENDER.bloom.threshold,
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  // Labels als DOM-Overlay; Maus-Events gehen durch zum Canvas (CSS).
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.id = 'labels';
  container.appendChild(labelRenderer.domElement);

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
  });

  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    bloomPass,
    labelRenderer,
    render: () => {
      composer.render();
      if (labelRenderer.domElement.style.display !== 'none') labelRenderer.render(scene, camera);
    },
  };
}
