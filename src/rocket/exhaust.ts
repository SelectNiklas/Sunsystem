import * as THREE from 'three';
import { ROCKET } from '../config/solarSystemData';
import { createCanvasTexture } from '../core/textures';

const CFG = ROCKET.exhaust;

const HOT = new THREE.Color(1.7, 1.35, 0.8);
const COOL = new THREE.Color(1.3, 0.42, 0.08);
const _c = new THREE.Color();

/**
 * Triebwerksflamme als Partikelsystem (Points, additiv, ein Draw Call).
 * Feste Puffergröße als Ringpuffer – keine Allokationen im Render-Loop.
 * Die Partikel leben im Bezugssystem der Rakete-Gruppe und bleiben daher als
 * Spur hinter der Rakete zurück.
 */
export class Exhaust {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities = new Float32Array(CFG.count * 3);
  private readonly ages = new Float32Array(CFG.count).fill(Infinity);
  private readonly lives = new Float32Array(CFG.count);
  private next = 0;
  private spawnCarry = 0;
  /** Mindestens ein Partikel lebt (sonst entfällt das Update samt Upload). */
  private active = false;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(CFG.count * 3);
    this.colors = new Float32Array(CFG.count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));

    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: CFG.size,
        map: createSoftDot(),
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.name = 'Triebwerksflamme';
    // Partikel bewegen sich frei; die Bounding Sphere wäre ständig veraltet.
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
  }

  /**
   * @param dt       Echtzeit-Delta in s (≥ 0)
   * @param nozzle   Austrittspunkt im Bezugssystem der Gruppe
   * @param dir      Flugrichtung (Einheitsvektor); die Partikel strömen entgegen
   * @param throttle Schub 0–1
   */
  update(dt: number, nozzle: THREE.Vector3, dir: THREE.Vector3, throttle: number): void {
    if (dt <= 0 || (!this.active && throttle <= 0)) return;
    const { positions: pos, velocities: vel, colors: col, ages, lives } = this;

    this.spawnCarry += CFG.rate * throttle * dt;
    while (this.spawnCarry >= 1) {
      this.spawnCarry -= 1;
      const i = this.next;
      this.next = (this.next + 1) % CFG.count;
      const k = i * 3;
      const speed = CFG.speed * (0.7 + Math.random() * 0.6);
      vel[k] = -dir.x * speed + (Math.random() - 0.5) * CFG.spread;
      vel[k + 1] = -dir.y * speed + (Math.random() - 0.5) * CFG.spread;
      vel[k + 2] = -dir.z * speed + (Math.random() - 0.5) * CFG.spread;
      // Zufälliger Startversatz entlang des Strahls glättet die Emission.
      const j = Math.random() * dt;
      pos[k] = nozzle.x + vel[k] * j;
      pos[k + 1] = nozzle.y + vel[k + 1] * j;
      pos[k + 2] = nozzle.z + vel[k + 2] * j;
      ages[i] = 0;
      lives[i] = CFG.life * (0.6 + Math.random() * 0.4);
    }

    let alive = 0;
    for (let i = 0; i < CFG.count; i++) {
      const k = i * 3;
      if (ages[i] >= lives[i]) {
        col[k] = col[k + 1] = col[k + 2] = 0;
        continue;
      }
      alive++;
      ages[i] += dt;
      pos[k] += vel[k] * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;
      const t = Math.min(ages[i] / lives[i], 1);
      const fade = Math.pow(1 - t, 1.5);
      _c.lerpColors(HOT, COOL, Math.min(t * 2.5, 1)).multiplyScalar(fade);
      col[k] = _c.r;
      col[k + 1] = _c.g;
      col[k + 2] = _c.b;
    }

    this.active = alive > 0;
    const geometry = this.points.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
}

function createSoftDot(): THREE.Texture {
  return createCanvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
