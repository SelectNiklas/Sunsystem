import './style.css';
import { AsteroidBelt } from './asteroids/belt';
import { FreeAsteroids } from './asteroids/freeAsteroids';
import { AdaptiveQuality } from './core/adaptiveQuality';
import { createSceneContext } from './core/sceneContext';
import { ScaleState } from './core/scale';
import { SimClock } from './core/simClock';
import { loadTextures } from './core/textures';
import { CameraController } from './navigation/cameraController';
import { createFocusTargets, type FocusTarget } from './navigation/focusTargets';
import { Picker } from './navigation/picker';
import { Moon } from './moon/moon';
import { PlanetSystem } from './planets/planets';
import { Rocket } from './rocket/rocket';
import { SatelliteSystem } from './satellites/satellites';
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

  // --- Erdsystem: Mond, Satelliten, Rakete hängen am (nur verschobenen) Erd-Root ---
  const earth = planets.get('earth');
  const moon = new Moon(textures, scale);
  const satellites = new SatelliteSystem(earth, scale);
  const rocket = new Rocket(earth.radius, moon);
  earth.root.add(moon.root, moon.orbitLine, satellites.frame, rocket.group);

  // --- Asteroiden: Gürtel (GPU) und einzelne Asteroiden ---
  const belt = new AsteroidBelt(clock.days);
  const asteroids = new FreeAsteroids(scale);
  scene.add(belt.group, asteroids.group, asteroids.orbitGroup);

  const panel = new ControlPanel({
    clock,
    onToggleOrbits: (visible) => {
      planets.setOrbitsVisible(visible);
      asteroids.setOrbitsVisible(visible);
      moon.orbitLine.visible = visible;
      satellites.setOrbitsVisible(visible);
      rocket.setPathVisible(visible);
    },
  });

  // --- Navigation: Fokusziele, Kameraflug, Picking, Liste, Infopanel ---
  const targets = createFocusTargets(sun, planets, moon, asteroids, satellites, rocket, scale);
  const nav = new CameraController(camera, controls);
  const infoPanel = new InfoPanel();
  const tooltip = new Tooltip();
  // Erneuter Klick auf das gerade verfolgte Objekt führt zurück zur Gesamtansicht.
  const toggleFocus = (t: FocusTarget) => (nav.target === t ? nav.overview() : nav.focus(t));
  const planetList = new PlanetList(targets, toggleFocus, () => nav.overview());

  let highlighted: FocusTarget | null = null;
  nav.onFocusChange((target) => {
    highlighted?.setHighlighted?.(false);
    target?.setHighlighted?.(true);
    highlighted = target;
    planetList.setActive(target?.id ?? null);
    if (target) infoPanel.show(target);
    else infoPanel.hide();
  });

  const picker = new Picker(renderer.domElement, camera, targets, {
    onHover: (target, x, y) => (target ? tooltip.show(target.name, x, y) : tooltip.hide()),
    onClick: toggleFocus,
  });

  const stats = new StatsBar(document.querySelector<HTMLElement>('#statusbar .stats')!, renderer, scene, camera, () => {
    const { pixelRatio, samples } = ctx.quality;
    return `${pixelRatio.toFixed(2)}×${samples > 0 ? ` · MSAA ${samples}×` : ''}`;
  });
  const adaptive = new AdaptiveQuality(ctx, (pr) => starfield.setPixelRatio(pr));

  window.addEventListener('resize', () => starfield.setPixelRatio(renderer.getPixelRatio()));

  // Erste Positionen setzen und Shader vorab kompilieren (kein Ruckeln im ersten Frame).
  planets.update(clock.days, 0);
  moon.update(clock.days);
  belt.update(clock.days, 0);
  asteroids.update(clock.days, 0, camera);
  satellites.update(0, camera);
  rocket.update(0);
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
    moon.update(clock.days);
    belt.update(clock.days, spinDt);
    asteroids.update(clock.days, spinDt, camera);
    // Satelliten und Rakete laufen wie die Eigenrotation in sichtbar skalierter Echtzeit.
    satellites.update(spinDt, camera);
    rocket.update(spinDt);

    nav.update(dt);
    controls.update();
    starfield.update(camera);
    picker.update();
    panel.update(timestamp);
    infoPanel.update(timestamp);

    ctx.render();
    stats.endFrame();
    adaptive.update(timestamp);
  });
}

init().catch((err) => {
  console.error(err);
  const label = document.querySelector('.loading-label');
  if (label) label.textContent = `Fehler: ${(err as Error).message}`;
});
