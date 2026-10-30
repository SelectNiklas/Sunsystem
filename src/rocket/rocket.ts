import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROCKET } from '../config/solarSystemData';
import type { Moon } from '../moon/moon';
import { createPickProxy } from '../satellites/satellites';
import { Exhaust } from './exhaust';

export type MissionPhase = 'launch' | 'coast' | 'orbit';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const DEG = Math.PI / 180;
/** Startort auf der Erde: Winkel in der Transferebene (vom Mond aus gesehen „unten hinten“). */
const LAUNCH_ANGLE = -70 * DEG;

const _u = new THREE.Vector3();
const _l = new THREE.Vector3();
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();
const _nozzle = new THREE.Vector3();

/**
 * Rakete Erde → Mond. Die Transferbahn ist eine kubische Bézierkurve in der
 * Ebene Erde–Mond, die jedes Frame aus der aktuellen Mondposition neu
 * aufgespannt wird und sich so mit dem Mond mitbewegt: Start an der
 * Erdoberfläche, weiter Bogen am Mond vorbei, Einschwenken von der
 * Mondrückseite in einen Mondorbit. Nach der Verweilzeit startet die Mission neu.
 *
 * Alle Positionen liegen im Bezugssystem der Erde (Kind von earth.root).
 */
export class Rocket {
  readonly group = new THREE.Group();
  /** Das Raumfahrzeug selbst (Modell, Klickfläche). */
  readonly object = new THREE.Group();
  readonly pickProxy: THREE.Mesh;
  readonly radius = ROCKET.length / 2;
  phase: MissionPhase = 'launch';
  /** Fortschritt des Transfers 0–1. */
  progress = 0;

  private readonly pathLine: THREE.Line;
  private readonly flownLine: THREE.Line;
  private readonly exhaust = new Exhaust();
  private readonly ctrl = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly velocity = new THREE.Vector3();
  private missionTime = 0;

  constructor(
    private readonly earthRadius: number,
    private readonly moon: Moon,
  ) {
    this.group.name = 'Mondmission';

    const model = new THREE.Mesh(createRocketGeometry(), [
      new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.6, metalness: 0.5 }),
    ]);
    model.scale.setScalar(ROCKET.length);
    model.raycast = () => {};
    this.pickProxy = createPickProxy(ROCKET.length);
    this.object.name = ROCKET.name;
    this.object.add(model, this.pickProxy);

    // Zwei Linien auf denselben Punkten: geplante Bahn (blass) und geflogener Teil.
    const positions = new THREE.BufferAttribute(new Float32Array(ROCKET.pathSegments * 3), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    this.pathLine = createPathLine(positions, ROCKET.pathOpacity);
    this.flownLine = createPathLine(positions, ROCKET.flownOpacity);

    this.group.add(this.pathLine, this.flownLine, this.exhaust.points, this.object);
  }

  /** Abstand zum Erdmittelpunkt in Szeneneinheiten. */
  get distanceUnits(): number {
    return this.object.position.length();
  }

  /**
   * @param spinDt Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   */
  update(spinDt: number): void {
    const total = ROCKET.flightSeconds + ROCKET.lunarOrbitSeconds;
    this.missionTime = (((this.missionTime + spinDt) % total) + total) % total;

    this.updateControlPoints();
    const [p0, p1, p2, p3] = this.ctrl;
    const b = ROCKET.burnFraction;
    let throttle = 0;

    if (this.missionTime < ROCKET.flightSeconds) {
      const u = this.missionTime / ROCKET.flightSeconds;
      this.progress = u;
      // Beschleunigen bis zum Brennschluss, danach gleichmäßiger Freiflug.
      const s = u < b ? (u * u) / (b * (2 - b)) : (2 * u - b) / (2 - b);
      bezier(p0, p1, p2, p3, s, this.object.position);
      bezierTangent(p0, p1, p2, p3, s, this.velocity);
      this.phase = u < b ? 'launch' : 'coast';
      throttle = u < b ? 1 : THREE.MathUtils.clamp(1 - (u - b) / (b * 0.4), 0, 1);
      this.setFlown(s);
    } else {
      // Mondorbit im Uhrzeigersinn der Transferebene, Geschwindigkeit stetig zur Ankunft.
      this.progress = 1;
      this.phase = 'orbit';
      const r = this.moon.radius * ROCKET.lunarOrbitFactor;
      const arrivalSpeed = (3 * p3.distanceTo(p2) * (2 / (2 - b))) / ROCKET.flightSeconds;
      const phi = -Math.PI / 2 - (arrivalSpeed / r) * (this.missionTime - ROCKET.flightSeconds);
      this.object.position
        .copy(this.moon.root.position)
        .addScaledVector(_u, r * Math.cos(phi))
        .addScaledVector(_l, r * Math.sin(phi));
      this.velocity.copy(_u).multiplyScalar(Math.sin(phi)).addScaledVector(_l, -Math.cos(phi));
      this.setFlown(1);
    }

    this.velocity.normalize();
    this.object.quaternion.setFromUnitVectors(FORWARD, this.velocity);

    _nozzle.copy(this.object.position).addScaledVector(this.velocity, -ROCKET.length * 0.45);
    this.exhaust.update(Math.abs(spinDt), _nozzle, this.velocity, spinDt > 0 ? throttle : 0);
  }

  setPathVisible(visible: boolean): void {
    this.pathLine.visible = visible;
    this.flownLine.visible = visible;
  }


  /**
   * Kontrollpunkte in der Basis û (Erde → Mond), ℓ (seitlich in der Ebene),
   * n̂ (≈ ekliptikal Nord). Bezugsgrößen: Mondabstand D, Mondorbitradius r.
   */
  private updateControlPoints(): void {
    const m = this.moon.root.position;
    const D = m.length();
    const r = this.moon.radius * ROCKET.lunarOrbitFactor;
    const re = this.earthRadius + ROCKET.length * 0.5;

    _u.copy(m).divideScalar(D);
    // ℓ zeigt entgegen der Bahnbewegung des Mondes; die Kurve (negative ℓ-Anteile)
    // liegt also auf der Seite, auf die der Mond zuläuft – die Rakete zielt voraus.
    _l.crossVectors(_u, UP).normalize();
    _n.crossVectors(_l, _u);

    const [p0, p1, p2, p3] = this.ctrl;
    point(p0, re * Math.cos(LAUNCH_ANGLE), re * Math.sin(LAUNCH_ANGLE), 0);
    point(p1, 0.35 * D, -0.75 * D, 0.12 * D);
    point(p2, 1.4 * D, -r, 0.08 * D);
    point(p3, D, -r, 0);

    const attr = this.pathLine.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      bezier(p0, p1, p2, p3, i / (n - 1), _v);
      attr.setXYZ(i, _v.x, _v.y, _v.z);
    }
    attr.needsUpdate = true;
  }

  private setFlown(s: number): void {
    this.flownLine.geometry.setDrawRange(0, Math.ceil(s * (ROCKET.pathSegments - 1)) + 1);
  }
}

function point(out: THREE.Vector3, a: number, b: number, c: number): void {
  out.copy(_u).multiplyScalar(a).addScaledVector(_l, b).addScaledVector(_n, c);
}

function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const k = 1 - t;
  return out
    .copy(p0)
    .multiplyScalar(k * k * k)
    .addScaledVector(p1, 3 * k * k * t)
    .addScaledVector(p2, 3 * k * t * t)
    .addScaledVector(p3, t * t * t);
}

/** Ableitung nach t (Richtung genügt). */
function bezierTangent(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const k = 1 - t;
  return out
    .copy(p0)
    .multiplyScalar(-k * k)
    .addScaledVector(p1, k * k - 2 * k * t)
    .addScaledVector(p2, 2 * k * t - t * t)
    .addScaledVector(p3, t * t);
}

function createPathLine(positions: THREE.BufferAttribute, opacity: number): THREE.Line {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', positions),
    new THREE.LineBasicMaterial({ color: ROCKET.pathColor, transparent: true, opacity, depthWrite: false }),
  );
  line.name = 'Flugbahn';
  line.frustumCulled = false;
  line.raycast = () => {};
  return line;
}

/** Low-Poly-Rakete entlang +Z (Spitze vorn), Länge ≈ 1. Gruppe 0 = Hülle, 1 = Details. */
function createRocketGeometry(): THREE.BufferGeometry {
  const alongZ = (g: THREE.BufferGeometry, z: number) => g.rotateX(Math.PI / 2).translate(0, 0, z);
  const hull = [
    alongZ(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 14), 0),
    alongZ(new THREE.ConeGeometry(0.07, 0.24, 14), 0.43),
  ];
  const details = [
    alongZ(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 14), 0.12),
    alongZ(new THREE.CylinderGeometry(0.04, 0.066, 0.1, 12), -0.36),
  ];
  for (let i = 0; i < 3; i++) {
    details.push(
      new THREE.BoxGeometry(0.008, 0.09, 0.16)
        .translate(0, 0.1, -0.23)
        .rotateZ((i * 2 * Math.PI) / 3),
    );
  }
  const geometry = mergeGeometries([mergeGeometries(hull), mergeGeometries(details)], true);
  for (const g of [...hull, ...details]) g.dispose();
  return geometry;
}
