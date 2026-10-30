import * as THREE from 'three';
import { ASTEROID_BELT, SCALE } from '../config/solarSystemData';
import { KeplerOrbit } from '../core/astro';
import { createRockGeometry, seededRandom } from './rock';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/*
 * Pro Instanz:
 *   aOrbitP = P · a, aOrbitQ = Q · b (AE, Szenenachsen), aKepler = (e, M0, n),
 *   aSpin = (Drehachse, Rate in rad/s).
 * Die instanceMatrix trägt nur Größe und Grundorientierung; die Bahnposition
 * kommt im Shader hinzu (Kepler-Gleichung + logarithmische Abstandsabbildung
 * wie ScaleState.distance).
 */
const VERTEX_HEADER = /* glsl */ `
attribute vec3 aOrbitP;
attribute vec3 aOrbitQ;
attribute vec3 aKepler;
attribute vec4 aSpin;
uniform float uDays;
uniform float uSpinTime;
uniform vec2 uDistance;

vec3 rotateAxis(vec3 v, vec3 k, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

vec3 beltPosition() {
  float e = aKepler.x;
  float M = mod(aKepler.y + aKepler.z * uDays, 6.28318530718);
  float E = M + e * sin(M);
  for (int k = 0; k < 4; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  vec3 p = aOrbitP * (cos(E) - e) + aOrbitQ * sin(E);
  float r = length(p);
  return p * (uDistance.x * log(1.0 + r / uDistance.y) / r);
}
`;

/** Asteroidengürtel zwischen Mars und Jupiter: mehrere InstancedMeshes, Bewegung im Vertex-Shader. */
export class AsteroidBelt {
  readonly group = new THREE.Group();
  private readonly uniforms = {
    uDays: { value: 0 },
    uSpinTime: { value: 0 },
    uDistance: { value: new THREE.Vector2(SCALE.distance.factor, SCALE.distance.refAU) },
  };
  /** Bezugszeitpunkt: uDays ist relativ dazu klein (float32-Genauigkeit im Shader). */
  private readonly epochDays: number;

  constructor(startDays: number) {
    this.group.name = 'Asteroidengürtel';
    this.epochDays = startDays;

    const random = seededRandom(ASTEROID_BELT.seed);
    const material = this.createMaterial();
    const perShape = Math.ceil(ASTEROID_BELT.count / ASTEROID_BELT.shapes);

    for (let s = 0; s < ASTEROID_BELT.shapes; s++) {
      const count = Math.min(perShape, ASTEROID_BELT.count - s * perShape);
      const geometry = createRockGeometry(ASTEROID_BELT.seed + s * 101, 1, 1.15 + s * 0.35);
      this.fillInstanceAttributes(geometry, count, random);

      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `Asteroiden ${s + 1}`;
      // Positionen entstehen erst im Shader; die Hülle aus den Instanzmatrizen wäre falsch.
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      this.fillInstanceTransforms(mesh, random);
      this.group.add(mesh);
    }
  }

  /**
   * @param days   Simulationszeit (Tage seit J2000)
   * @param spinDt Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   */
  update(days: number, spinDt: number): void {
    this.uniforms.uDays.value = days - this.epochDays;
    this.uniforms.uSpinTime.value += spinDt;
  }

  private createMaterial(): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = (VERTEX_HEADER + shader.vertexShader)
        .replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\nobjectNormal = rotateAxis(objectNormal, aSpin.xyz, aSpin.w * uSpinTime);',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed = rotateAxis(transformed, aSpin.xyz, aSpin.w * uSpinTime);',
        )
        .replace(
          '#include <project_vertex>',
          /* glsl */ `
          vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
          mvPosition.xyz += beltPosition();
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`,
        );
    };
    return material;
  }

  /** Bahnelemente und Taumeln als Instanz-Attribute. */
  private fillInstanceAttributes(geometry: THREE.BufferGeometry, count: number, random: () => number): void {
    const P = new Float32Array(count * 3);
    const Q = new Float32Array(count * 3);
    const kepler = new Float32Array(count * 3);
    const spin = new Float32Array(count * 4);
    const p = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const { eMax, qMin, iSigma, iMax, spinDegPerSec } = ASTEROID_BELT;

    for (let k = 0; k < count; k++) {
      const a = sampleSemiMajorAxis(random);
      const e = random() * Math.min(eMax, 1 - qMin / a);
      const i = Math.min(Math.abs(gaussian(random)) * iSigma, iMax);
      const periodDays = 365.25 * Math.pow(a, 1.5);
      const n = TWO_PI / periodDays;
      // Zufällige mittlere Anomalie zur Bezugsepoche.
      const M0 = random() * TWO_PI;

      const orbit = new KeplerOrbit({ a, e, i, node: random() * 360, peri: random() * 360, M0: 0, periodDays });
      // P · a bzw. Q · b aus zwei Bahnpunkten gewinnen: E = 0 → a(1 − e)·P, E = π/2 → −a·e·P + b·Q.
      orbit.pointAtEccentricAnomaly(0, p).divideScalar(1 - e);
      P.set([p.x, p.y, p.z], k * 3);
      const px = p.x, py = p.y, pz = p.z;
      orbit.pointAtEccentricAnomaly(Math.PI / 2, p);
      Q.set([p.x + e * px, p.y + e * py, p.z + e * pz], k * 3);
      kepler.set([e, M0, n], k * 3);

      axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      const rate = THREE.MathUtils.lerp(spinDegPerSec.min, spinDegPerSec.max, random()) * DEG;
      spin.set([axis.x, axis.y, axis.z, random() < 0.5 ? rate : -rate], k * 4);
    }

    geometry.setAttribute('aOrbitP', new THREE.InstancedBufferAttribute(P, 3));
    geometry.setAttribute('aOrbitQ', new THREE.InstancedBufferAttribute(Q, 3));
    geometry.setAttribute('aKepler', new THREE.InstancedBufferAttribute(kepler, 3));
    geometry.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 4));
  }

  /** Größe (Potenzgesetz), Streckung, Grundorientierung und Farbe. */
  private fillInstanceTransforms(mesh: THREE.InstancedMesh, random: () => number): void {
    const { sizeMin, sizeMax, sizeExponent, colors } = ASTEROID_BELT;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    for (let k = 0; k < mesh.count; k++) {
      const size = Math.min(sizeMin * Math.pow(1 - random(), -1 / sizeExponent), sizeMax);
      scale.set(size, size * (0.7 + random() * 0.3), size * (0.7 + random() * 0.3));
      q.setFromEuler(euler.set(random() * TWO_PI, random() * TWO_PI, random() * TWO_PI));
      mesh.setMatrixAt(k, m.compose(_zero, q, scale));

      color.setHex(colors[Math.floor(random() * colors.length)]).multiplyScalar(0.8 + random() * 0.4);
      mesh.setColorAt(k, color);
    }
  }
}

const _zero = new THREE.Vector3();

/** Große Halbachse, gleichverteilt im Gürtel, ohne die Kirkwood-Lücken. */
function sampleSemiMajorAxis(random: () => number): number {
  const { aMin, aMax, kirkwoodGaps, gapHalfWidth } = ASTEROID_BELT;
  for (;;) {
    const a = aMin + random() * (aMax - aMin);
    if (!kirkwoodGaps.some((gap) => Math.abs(a - gap) < gapHalfWidth)) return a;
  }
}

/** Standardnormalverteilt (Box-Muller). */
function gaussian(random: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TWO_PI * random());
}
