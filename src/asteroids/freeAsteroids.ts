import * as THREE from 'three';
import { FREE_ASTEROIDS, PLANET_RENDER, type FreeAsteroidData } from '../config/solarSystemData';
import { KeplerOrbit } from '../core/astro';
import type { ScaleState } from '../core/scale';
import { createPickProxy } from '../satellites/satellites';
import { createRockGeometry, seededRandom } from './rock';

const DEG = Math.PI / 180;

const _w = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Ein einzelner Asteroid auf eigener Kepler-Bahn, taumelnd. */
export class FreeAsteroid {
  readonly object = new THREE.Group();
  readonly pickProxy: THREE.Mesh;
  readonly orbit: KeplerOrbit;
  readonly orbitLine: THREE.LineLoop;
  /** Heliozentrische Position in AE (Szenenachsen). */
  readonly helioAU = new THREE.Vector3();
  /** Dargestellter Radius aus der Nähe (Szeneneinheiten). */
  readonly radius: number;
  private readonly rock: THREE.Mesh;
  private readonly spinAxis = new THREE.Vector3();
  private readonly spinRate: number;

  constructor(
    readonly data: FreeAsteroidData,
    seed: number,
    scale: ScaleState,
  ) {
    this.radius = scale.bodyRadius(data.radiusKm);
    this.orbit = new KeplerOrbit(data.orbit);

    const random = seededRandom(seed);
    this.rock = new THREE.Mesh(
      createRockGeometry(seed, FREE_ASTEROIDS.detail, data.elongation, data.irregularity),
      new THREE.MeshStandardMaterial({ color: data.color, roughness: 1, metalness: 0, flatShading: true }),
    );
    this.rock.name = data.name;
    this.rock.raycast = () => {};
    this.spinAxis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    this.spinRate = (10 + random() * 25) * DEG;

    // Modell und Klickfläche in Einheiten des Radius; die Gruppe wird je nach Kameraabstand skaliert.
    this.pickProxy = createPickProxy(FREE_ASTEROIDS.pickRadius);
    this.object.name = data.name;
    this.object.add(this.rock, this.pickProxy);

    this.orbitLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(PLANET_RENDER.orbitSegments * 3), 3),
      ),
      new THREE.LineBasicMaterial({
        color: FREE_ASTEROIDS.orbitColor,
        transparent: true,
        opacity: FREE_ASTEROIDS.orbitOpacity,
        depthWrite: false,
      }),
    );
    this.orbitLine.name = `Orbit ${data.name}`;
    const attr = this.orbitLine.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      this.orbit.pointAtEccentricAnomaly((i / attr.count) * Math.PI * 2, _p);
      scale.mapPosition(_p);
      attr.setXYZ(i, _p.x, _p.y, _p.z);
    }
    this.orbitLine.geometry.computeBoundingSphere();
  }

  update(days: number, spinDt: number, scale: ScaleState, camera: THREE.Camera): void {
    this.orbit.positionAt(days, this.helioAU);
    scale.mapPosition(this.object.position.copy(this.helioAU));
    this.rock.rotateOnAxis(this.spinAxis, this.spinRate * spinDt);

    const distance = this.object.getWorldPosition(_w).distanceTo(camera.position);
    const size = THREE.MathUtils.clamp(distance * FREE_ASTEROIDS.apparentSize, this.radius, Math.max(this.radius, FREE_ASTEROIDS.maxRadius));
    this.object.scale.setScalar(size);
  }
}

/** Die einzeln dargestellten Asteroiden samt Orbitlinien. */
export class FreeAsteroids {
  readonly group = new THREE.Group();
  readonly orbitGroup = new THREE.Group();
  readonly asteroids: FreeAsteroid[];

  constructor(private readonly scale: ScaleState) {
    this.group.name = 'Einzelne Asteroiden';
    this.orbitGroup.name = 'Asteroidenbahnen';
    this.asteroids = FREE_ASTEROIDS.list.map((data, i) => new FreeAsteroid(data, 7_000 + i * 31, scale));
    for (const asteroid of this.asteroids) {
      this.group.add(asteroid.object);
      this.orbitGroup.add(asteroid.orbitLine);
    }
  }

  /**
   * @param days   Simulationszeit (Tage seit J2000)
   * @param spinDt Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   * @param camera Für die abstandsabhängige Modellgröße
   */
  update(days: number, spinDt: number, camera: THREE.Camera): void {
    for (const asteroid of this.asteroids) asteroid.update(days, spinDt, this.scale, camera);
  }

  setOrbitsVisible(visible: boolean): void {
    this.orbitGroup.visible = visible;
  }
}
