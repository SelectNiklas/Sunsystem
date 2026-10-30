import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERA, RENDER } from '../config/solarSystemData';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  render(): void;
  /** Aktuelle Pixel-Ratio und MSAA-Samples. */
  readonly quality: { pixelRatio: number; samples: number };
  /** Senkt/hebt die Render-Qualität (Pixel-Ratio wird zusätzlich durch das Gerät begrenzt). */
  setQuality(pixelRatio: number, samples: number): void;
}

/** Erzeugt Renderer, Szene, Kamera, Controls und die Postprocessing-Kette. */
export function createSceneContext(container: HTMLElement): SceneContext {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio);
  const samples = pixelRatio > RENDER.msaaMaxPixelRatio ? 0 : RENDER.msaaSamples;
  // Obergrenze aus der automatischen Qualitätsanpassung.
  let pixelRatioCap = Infinity;

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
    samples,
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

  const quality = { pixelRatio, samples };

  const applySize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, RENDER.maxPixelRatio, pixelRatioCap);
    quality.pixelRatio = pr;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
  };
  window.addEventListener('resize', applySize);

  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    bloomPass,
    render: () => composer.render(),
    quality,
    setQuality(pr: number, msaa: number) {
      if (msaa !== quality.samples) {
        quality.samples = msaa;
        // Die Render-Targets werden mit der neuen Sample-Zahl neu angelegt.
        for (const target of [composer.renderTarget1, composer.renderTarget2]) {
          target.samples = msaa;
          target.dispose();
        }
      }
      pixelRatioCap = pr;
      applySize();
    },
  };
}
