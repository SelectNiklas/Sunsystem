import * as THREE from 'three';
import { PLANET_RENDER, type PlanetData } from '../config/solarSystemData';
import { initialRotation, KeplerOrbit, poleOrientation, visualRotationRate } from '../core/astro';
import type { ScaleState } from '../core/scale';

/** Gemeinsame Einheitskugeln für alle LOD-Stufen (eine Geometrie pro Stufe). */
let sharedSpheres: THREE.SphereGeometry[] | null = null;

export function lodSpheres(): THREE.SphereGeometry[] {
  sharedSpheres ??= PLANET_RENDER.lodSegments.map(([w, h]) => new THREE.SphereGeometry(1, w, h));
  return sharedSpheres;
}

/**
 * Ein Planet in der Szenenhierarchie:
 *   root  – heliozentrische Position (maßstabsabhängig)
 *   tilt  – Polorientierung (IAU), skaliert auf den Körperradius
 *   spin  – Eigenrotation um die lokale Y-Achse (Nullmeridian W)
 * Kinder von tilt/spin sind in Einheiten des Planetenradius modelliert.
 */
export class Planet {
  readonly root = new THREE.Group();
  readonly tilt = new THREE.Group();
  readonly spin = new THREE.Group();
  readonly surface = new THREE.LOD();
  readonly orbit: KeplerOrbit;
  /** Heliozentrische Position in AE (Szenenachsen). */
  readonly helioAU = new THREE.Vector3();
  radius = 0;
  /** Sichtbare Drehrate in rad/s (vereinfacht). */
  private readonly spinRate: number;

  constructor(
    readonly data: PlanetData,
    material: THREE.Material,
  ) {
    this.root.name = data.name;
    this.orbit = new KeplerOrbit(data.orbit);
    poleOrientation(data.rotation, this.tilt.quaternion);
    this.spin.rotation.y = initialRotation(data.rotation);
    this.spinRate = visualRotationRate(data.rotation);

    for (const geometry of lodSpheres()) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = data.name;
      mesh.userData.planetId = data.id;
      this.surface.addLevel(mesh, 0);
    }
    this.spin.add(this.surface);
    this.tilt.add(this.spin);
    this.root.add(this.tilt);
  }

  /** Kameraabstand für die Fokusansicht (Ringe brauchen mehr Platz). */
  get viewDistance(): number {
    return this.radius * (this.data.rings ? 7 : 4.5);
  }

  applyScale(scale: ScaleState): void {
    this.radius = scale.bodyRadius(this.data.radiusKm);
    this.tilt.scale.setScalar(this.radius);
    // LOD vergleicht Weltdistanzen → Schwellen mit dem Radius mitskalieren
    const levels = this.surface.levels;
    for (let i = 0; i < levels.length; i++) {
      levels[i].distance = this.radius * PLANET_RENDER.lodDistanceFactors[i];
    }
  }

  /**
   * @param days    Simulationszeit (Tage seit J2000) für die Bahnposition
   * @param spinDt  Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   */
  update(days: number, spinDt: number, scale: ScaleState): void {
    this.orbit.positionAt(days, this.helioAU);
    scale.mapPosition(this.root.position.copy(this.helioAU));
    this.spin.rotation.y = (this.spin.rotation.y + this.spinRate * spinDt) % (Math.PI * 2);
  }
}
