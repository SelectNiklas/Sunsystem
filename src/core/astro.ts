import * as THREE from 'three';
import {
  J2000_JD,
  OBLIQUITY_J2000_DEG,
  UNIX_EPOCH_JD,
  VISUAL_ROTATION,
  type OrbitalElements,
  type RotationModel,
} from '../config/solarSystemData';

/*
 * Koordinaten: Ekliptikal J2000 (x → Frühlingspunkt, z → ekliptikaler Nordpol)
 * wird auf das Y-up-System von Three.js abgebildet: (x, y, z)_ekl → (x, z, −y).
 */

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Zeit
// ---------------------------------------------------------------------------

/** Tage seit J2000.0 für ein Datum (UTC ≈ TT, Abweichung ~1 min). */
export function dateToJ2000Days(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD - J2000_JD;
}

export function j2000DaysToDate(days: number): Date {
  return new Date((days + J2000_JD - UNIX_EPOCH_JD) * MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Kepler-Bahn
// ---------------------------------------------------------------------------

/** Löst M = E − e·sin E per Newton-Iteration nach E auf. */
export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 20; k++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return E;
}

/**
 * Kepler-Bahn mit vorberechneten Orientierungsvektoren P (→ Perihel) und
 * Q (90° weiter in Bahnrichtung), allokationsfrei im Render-Loop.
 * Längen- und Zeiteinheit folgen den Elementen (AE/Tage für Planeten,
 * km/Minuten für Satelliten); die Bezugsebene wird auf die XZ-Ebene abgebildet.
 */
export class KeplerOrbit {
  readonly a: number;
  readonly e: number;
  private readonly b: number;
  private readonly M0: number;
  private readonly n: number;
  private readonly P = new THREE.Vector3();
  private readonly Q = new THREE.Vector3();

  constructor(el: OrbitalElements) {
    this.a = el.a;
    this.e = el.e;
    this.b = el.a * Math.sqrt(1 - el.e * el.e);
    this.M0 = el.M0 * DEG;
    this.n = TWO_PI / el.periodDays;
    this.setOrientation(el.i, el.node, el.peri);
  }

  /** Bahnlage neu setzen (Grad), z. B. für präzedierende Knoten. */
  setOrientation(i: number, node: number, peri: number): void {
    const cw = Math.cos(peri * DEG);
    const sw = Math.sin(peri * DEG);
    const cO = Math.cos(node * DEG);
    const sO = Math.sin(node * DEG);
    const ci = Math.cos(i * DEG);
    const si = Math.sin(i * DEG);

    // Ekliptikal → Three.js (x, z, −y)
    this.P.set(cw * cO - sw * sO * ci, sw * si, -(cw * sO + sw * cO * ci));
    this.Q.set(-sw * cO - cw * sO * ci, cw * si, -(-sw * sO + cw * cO * ci));
  }

  /** Einheitsvektor der Bahnnormalen (Drehimpulsrichtung). */
  normal(out: THREE.Vector3): THREE.Vector3 {
    return out.crossVectors(this.P, this.Q);
  }

  /** Heliozentrische Position in AE zum Zeitpunkt d (Tage seit J2000). */
  positionAt(days: number, out: THREE.Vector3): THREE.Vector3 {
    let M = (this.M0 + this.n * days) % TWO_PI;
    if (M > Math.PI) M -= TWO_PI;
    else if (M < -Math.PI) M += TWO_PI;
    return this.pointAtEccentricAnomaly(solveKepler(M, this.e), out);
  }

  /** Bahnpunkt für eine exzentrische Anomalie E (für Orbitlinien). */
  pointAtEccentricAnomaly(E: number, out: THREE.Vector3): THREE.Vector3 {
    const x = this.a * (Math.cos(E) - this.e);
    const y = this.b * Math.sin(E);
    return out.copy(this.P).multiplyScalar(x).addScaledVector(this.Q, y);
  }
}

// ---------------------------------------------------------------------------
// Rotation (IAU-Modell)
// ---------------------------------------------------------------------------

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Äquatorial J2000 (ICRF) → Three.js-Szenenkoordinaten. */
function equatorialToScene(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  const eps = OBLIQUITY_J2000_DEG * DEG;
  const ce = Math.cos(eps);
  const se = Math.sin(eps);
  const ye = y * ce + z * se;
  const ze = -y * se + z * ce;
  return out.set(x, ze, -ye);
}

/**
 * Orientierung eines Körpers ohne Eigenrotation: lokale +Y-Achse = Nordpol,
 * lokale +X-Achse = aufsteigender Knoten des Körperäquators auf dem
 * Erdäquator (Bezugsrichtung des IAU-Nullmeridians W).
 */
export function poleOrientation(rot: RotationModel, out: THREE.Quaternion): THREE.Quaternion {
  const a = rot.poleRa * DEG;
  const d = rot.poleDec * DEG;
  equatorialToScene(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d), _y);
  equatorialToScene(-Math.sin(a), Math.cos(a), 0, _x);
  _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/** Startwinkel des Nullmeridians (W0) in Radiant. */
export function initialRotation(rot: RotationModel): number {
  return rot.W0 * DEG;
}

/**
 * Vereinfachte, sichtbare Drehrate in Radiant pro Echtzeit-Sekunde
 * (siehe VISUAL_ROTATION). Das Vorzeichen folgt der echten Drehrichtung.
 */
export function visualRotationRate(rot: RotationModel): number {
  const { factor, minDegPerSec, maxDegPerSec } = VISUAL_ROTATION;
  const deg = THREE.MathUtils.clamp(Math.abs(rot.rate) * factor, minDegPerSec, maxDegPerSec);
  return Math.sign(rot.rate) * deg * DEG;
}
