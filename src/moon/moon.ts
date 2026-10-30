import * as THREE from 'three';
import { MOON, PLANET_RENDER } from '../config/solarSystemData';
import { KeplerOrbit } from '../core/astro';
import type { ScaleState } from '../core/scale';
import type { TextureSet } from '../core/textures';
import { rockyTexture } from '../planets/fallbackTextures';
import { lodSpheres } from '../planets/planet';

const EL = MOON.orbit;
const EARTH_RADIUS_KM = 6371;
/** Bahnlinie neu berechnen, sobald Knoten/Perigäum spürbar gewandert sind. */
const ORBIT_LINE_REFRESH_DAYS = 2;

const _p = new THREE.Vector3();

/**
 * Der Erdmond. Liegt im Bezugssystem der Erde (Kind von earth.root, nur
 * verschoben, ekliptikal ausgerichtet). Gebundene Rotation: Die Vorderseite
 * (Nullmeridian = lokale +X-Achse der Kugel) zeigt stets zur Erde.
 */
export class Moon {
  readonly root = new THREE.Group();
  readonly surface = new THREE.LOD();
  readonly orbitLine: THREE.LineLoop;
  /** Geozentrische Position in km (Szenenachsen). */
  readonly geoKm = new THREE.Vector3();
  readonly radius: number;
  private readonly orbit: KeplerOrbit;
  private readonly spin = new THREE.Group();
  private lineDays = Number.NaN;

  constructor(
    textures: TextureSet,
    private readonly scale: ScaleState,
  ) {
    this.root.name = MOON.name;
    this.radius = MOON.sizeRelativeToEarth
      ? scale.bodyRadius(EARTH_RADIUS_KM) * (MOON.radiusKm / EARTH_RADIUS_KM)
      : scale.bodyRadius(MOON.radiusKm);

    const material = new THREE.MeshStandardMaterial({
      map: textures.get(MOON.textureKey) ?? rockyTexture(MOON.fallback.color, MOON.fallback.color2),
      roughness: 1,
      metalness: 0,
    });
    for (const geometry of lodSpheres()) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = MOON.name;
      this.surface.addLevel(mesh, 0);
    }
    const levels = this.surface.levels;
    for (let i = 0; i < levels.length; i++) {
      levels[i].distance = this.radius * PLANET_RENDER.lodDistanceFactors[i];
    }
    this.spin.scale.setScalar(this.radius);
    this.spin.add(this.surface);
    this.root.add(this.spin);

    this.orbit = new KeplerOrbit({
      a: EL.aKm,
      e: EL.e,
      i: EL.i,
      node: EL.node0,
      peri: EL.peri0 - EL.node0,
      M0: EL.M0,
      periodDays: EL.anomalisticMonthDays,
    });

    this.orbitLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(PLANET_RENDER.orbitSegments * 3), 3),
      ),
      new THREE.LineBasicMaterial({
        color: MOON.orbitColor,
        transparent: true,
        opacity: PLANET_RENDER.orbitOpacity,
        depthWrite: false,
      }),
    );
    this.orbitLine.name = `Orbit ${MOON.name}`;
    // Die Punkte ändern sich laufend; Culling anhand einer veralteten Hülle vermeiden.
    this.orbitLine.frustumCulled = false;
  }

  /** Abstand Erde–Mond in km. */
  get distanceKm(): number {
    return this.geoKm.length();
  }

  /** @param days Simulationszeit (Tage seit J2000) */
  update(days: number): void {
    const node = EL.node0 + EL.nodeRate * days;
    const peri = EL.peri0 + EL.periRate * days - node;
    this.orbit.setOrientation(EL.i, node, peri);
    this.orbit.positionAt(days, this.geoKm);
    this.scale.mapGeoPosition(this.root.position.copy(this.geoKm));

    // Gebundene Rotation: +X zur Erde (Rotation um Y bildet +X auf (cos θ, 0, −sin θ) ab).
    const p = this.root.position;
    this.spin.rotation.y = Math.atan2(p.z, -p.x);

    if (!(Math.abs(days - this.lineDays) < ORBIT_LINE_REFRESH_DAYS)) {
      this.lineDays = days;
      this.updateOrbitLine();
    }
  }

  private updateOrbitLine(): void {
    const attr = this.orbitLine.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      this.orbit.pointAtEccentricAnomaly((i / n) * Math.PI * 2, _p);
      this.scale.mapGeoPosition(_p);
      attr.setXYZ(i, _p.x, _p.y, _p.z);
    }
    attr.needsUpdate = true;
  }
}
