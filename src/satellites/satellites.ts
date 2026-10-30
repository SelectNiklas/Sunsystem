import * as THREE from 'three';
import { SATELLITES, type SatelliteData } from '../config/solarSystemData';
import { KeplerOrbit } from '../core/astro';
import type { ScaleState } from '../core/scale';
import type { Planet } from '../planets/planet';
import { createSatelliteMesh } from './models';

const DEG = Math.PI / 180;
/** Knotenänderung (Grad), ab der eine sonnensynchrone Bahnlinie neu berechnet wird. */
const NODE_REFRESH_DEG = 0.5;

const _p = new THREE.Vector3();
const _r = new THREE.Vector3();
const _t = new THREE.Vector3();
const _h = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _w = new THREE.Vector3();

let pickSphere: THREE.SphereGeometry | null = null;

/** Unsichtbare Kugel als vergrößerte Klickfläche (Raycasting ignoriert `visible`). */
export function createPickProxy(radius: number): THREE.Mesh {
  pickSphere ??= new THREE.SphereGeometry(1, 8, 6);
  const proxy = new THREE.Mesh(pickSphere, new THREE.MeshBasicMaterial());
  proxy.scale.setScalar(radius);
  proxy.visible = false;
  return proxy;
}

export class Satellite {
  readonly object = new THREE.Group();
  readonly pickProxy: THREE.Mesh;
  readonly orbit: KeplerOrbit;
  readonly orbitLine: THREE.LineLoop;
  /** Geozentrische Position in km (Äquatorsystem der Erde). */
  readonly positionKm = new THREE.Vector3();
  readonly radius = SATELLITES.modelSize / 2;
  /** Aktueller Knoten (Grad), bei sonnensynchronen Bahnen veränderlich. */
  node: number;
  lineNode = Number.NaN;

  constructor(readonly data: SatelliteData) {
    this.node = data.node;
    // Zeiteinheit Minuten: periodDays nimmt hier die Umlaufzeit in Minuten auf.
    this.orbit = new KeplerOrbit({
      a: data.aKm,
      e: data.e,
      i: data.i,
      node: data.node,
      peri: data.peri,
      M0: data.M0,
      periodDays: data.periodMin,
    });

    this.object.name = data.name;
    // Modell und Klickfläche in Einheiten von modelSize; die Gruppe
    // wird je nach Kameraabstand skaliert (siehe SatelliteSystem.update).
    const mesh = createSatelliteMesh(data.model, data.color);
    mesh.raycast = () => {};
    this.pickProxy = createPickProxy(SATELLITES.pickRadius);
    this.object.add(mesh, this.pickProxy);

    this.orbitLine = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(SATELLITES.orbitSegments * 3), 3),
      ),
      new THREE.LineBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: SATELLITES.orbitOpacity,
        depthWrite: false,
      }),
    );
    this.orbitLine.name = `Orbit ${data.name}`;
  }

  /** Aktuelle Höhe über der Erdoberfläche in km. */
  get altitudeKm(): number {
    return this.positionKm.length() - 6371;
  }
}

/**
 * Satelliten im Äquatorsystem der Erde: Der Rahmen hängt an earth.root und
 * übernimmt die Polorientierung der Erde (ohne Eigenrotation und Skalierung).
 * Die Bahnbewegung läuft in einer eigenen, sichtbar skalierten Zeit.
 */
export class SatelliteSystem {
  readonly frame = new THREE.Group();
  readonly orbitGroup = new THREE.Group();
  readonly satellites: Satellite[];
  /** Satellitenzeit in Minuten. */
  private minutes = 0;

  constructor(
    private readonly earth: Planet,
    private readonly scale: ScaleState,
  ) {
    this.frame.name = 'Satelliten';
    this.frame.quaternion.copy(earth.tilt.quaternion);
    this.orbitGroup.name = 'Satellitenbahnen';
    this.frame.add(this.orbitGroup);

    this.satellites = SATELLITES.list.map((data) => new Satellite(data));
    for (const sat of this.satellites) {
      this.frame.add(sat.object);
      this.orbitGroup.add(sat.orbitLine);
    }
  }

  /**
   * @param spinDt Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   * @param camera Für die abstandsabhängige Modellgröße
   */
  update(spinDt: number, camera: THREE.Camera): void {
    this.minutes += spinDt * SATELLITES.minutesPerSecond;
    const sunRa = this.sunRightAscension();

    for (const sat of this.satellites) {
      const { ltanHours } = sat.data;
      if (ltanHours !== undefined) {
        sat.node = sunRa + (ltanHours - 12) * 15;
        sat.orbit.setOrientation(sat.data.i, sat.node, sat.data.peri);
      }
      if (!(Math.abs(sat.node - sat.lineNode) < NODE_REFRESH_DEG)) this.updateOrbitLine(sat);

      sat.orbit.positionAt(this.minutes, sat.positionKm);
      this.scale.mapGeoPosition(sat.object.position.copy(sat.positionKm));
      orient(sat);

      const distance = sat.object.getWorldPosition(_w).distanceTo(camera.position);
      const size = THREE.MathUtils.clamp(distance * SATELLITES.apparentSize, SATELLITES.modelSize, SATELLITES.maxSize);
      sat.object.scale.setScalar(size);
    }
  }

  setOrbitsVisible(visible: boolean): void {
    this.orbitGroup.visible = visible;
  }

  /** Richtung der Sonne in der Äquatorebene (Grad, bezogen auf die lokale X-Achse des Rahmens). */
  private sunRightAscension(): number {
    _p.copy(this.earth.helioAU).negate().applyQuaternion(_q.copy(this.frame.quaternion).invert());
    // Bezugsebene X/Y ↔ Szenenachsen (x, −z), siehe KeplerOrbit
    return Math.atan2(-_p.z, _p.x) / DEG;
  }

  private updateOrbitLine(sat: Satellite): void {
    sat.lineNode = sat.node;
    const attr = sat.orbitLine.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      sat.orbit.pointAtEccentricAnomaly((i / n) * Math.PI * 2, _p);
      this.scale.mapGeoPosition(_p);
      attr.setXYZ(i, _p.x, _p.y, _p.z);
    }
    attr.needsUpdate = true;
    sat.orbitLine.geometry.computeBoundingSphere();
  }
}

/** +Y radial nach außen, +Z in Flugrichtung, Panels (X) senkrecht zur Bahnebene. */
function orient(sat: Satellite): void {
  _r.copy(sat.positionKm).normalize();
  sat.orbit.normal(_h);
  _t.crossVectors(_h, _r).normalize();
  _x.crossVectors(_r, _t);
  _m.makeBasis(_x, _r, _t);
  sat.object.quaternion.setFromRotationMatrix(_m);
}
