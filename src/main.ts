import './style.css';
import { createSceneContext } from './core/sceneContext';
import { ScaleState } from './core/scale';
import { SimClock } from './core/simClock';
import { loadTextures } from './core/textures';
import { CameraController } from './navigation/cameraController';
import { createFocusTargets } from './navigation/focusTargets';
import { Picker } from './navigation/picker';
import { PlanetSystem } from './planets/planets';
import { Starfield } from './stars/stars';
import { StatsBar } from './stats/statsBar';
import { Sun } from './sun/sun';
import { ControlPanel } from './ui/controlPanel';
import { InfoPanel } from './ui/infoPanel';
import { LoadingScreen } from './ui/loadingScreen';
import { PlanetList } from './ui/planetList';
import { Tooltip } from './ui/tooltip';

async function init(): Promise<void> {
  const loading = new LoadingScreen();
  const ctx = createSceneContext(document.getElementById('app')!);
  const { renderer, scene, camera, controls } = ctx;

  const textures = await loadTextures(renderer, (p, label) => loading.setProgress(p * 0.9, label));
  loading.setProgress(0.95, 'Baue Szene auf …');

  const scale = new ScaleState();
  const clock = new SimClock();

  const starfield = new Starfield(textures, renderer.getPixelRatio());
  scene.add(starfield.group);

  const sun = new Sun(textures, scale.sunScale);
  scene.add(sun.group);

  const planets = new PlanetSystem(textures, scale);
  scene.add(planets.group, planets.orbitGroup);


  const panel = new ControlPanel({
    clock,
    onToggleOrbits: (visible) => planets.setOrbitsVisible(visible),
    onToggleLabels: (visible) => {
      ctx.labelRenderer.domElement.style.display = visible ? '' : 'none';
    },
  });

  // --- Navigation: Fokusziele, Kameraflug, Picking, Liste, Infopanel ---
  const targets = createFocusTargets(sun, planets);
  const nav = new CameraController(camera, controls);
  const infoPanel = new InfoPanel();
  const tooltip = new Tooltip();
  const planetList = new PlanetList(
    targets,
    (t) => nav.focus(t),
    () => nav.overview(),
  );

  nav.onFocusChange((target) => {
    planetList.setActive(target?.id ?? null);
    for (const t of targets) t.label.element.classList.toggle('active', t === target);
    if (target) infoPanel.show(target);
    else infoPanel.hide();
  });

  const picker = new Picker(renderer.domElement, camera, targets, {
    onHover: (target, x, y) => (target ? tooltip.show(target.name, x, y) : tooltip.hide()),
    onClick: (target) => nav.focus(target),
  });

  // Labels sind anklickbar – hilfreich für kleine, weit entfernte Körper.
  for (const t of targets) t.label.element.addEventListener('click', () => nav.focus(t));

  const stats = new StatsBar(document.querySelector<HTMLElement>('#statusbar .stats')!, renderer, scene, camera);

  window.addEventListener('resize', () => starfield.setPixelRatio(renderer.getPixelRatio()));

  // Erste Positionen setzen und Shader vorab kompilieren (kein Ruckeln im ersten Frame).
  planets.update(clock.days, 0);
  renderer.compile(scene, camera);
  loading.setProgress(1, 'Fertig');
  loading.hide();

  let lastTime = performance.now();

  renderer.setAnimationLoop((timestamp: number) => {
    stats.beginFrame();
    // Delta begrenzen: kein Zeitsprung nach Tab-Wechsel, nie negativ
    // (der rAF-Zeitstempel kann vor performance.now() liegen).
    const dt = Math.min(Math.max((timestamp - lastTime) / 1000, 0), 0.1);
    lastTime = timestamp;

    clock.tick(dt);
    // Eigenrotation läuft in Echtzeit (unabhängig von der Simulationsgeschwindigkeit)
    const spinDt = dt * clock.direction;
    sun.update(spinDt);
    planets.update(clock.days, spinDt);

    nav.update(dt);
    controls.update();
    starfield.update(camera);
    picker.update();
    panel.update(timestamp);
    infoPanel.update(timestamp);

    ctx.render();
    stats.endFrame();
  });
}

init().catch((err) => {
  console.error(err);
  const label = document.querySelector('.loading-label');
  if (label) label.textContent = `Fehler: ${(err as Error).message}`;
});
