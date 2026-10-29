import * as THREE from 'three';
import { KM_PER_UNIT, SUN } from '../config/solarSystemData';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { initialRotation, poleOrientation, visualRotationRate } from '../core/astro';
import { createCanvasTexture, type TextureSet } from '../core/textures';
import { createLabel } from '../ui/labels';

/**
 * Die Sonne: emissive Kugel (Bloom), additives Korona-Sprite und die
 * PointLight, die das gesamte System beleuchtet.
 */
export class Sun {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  private readonly corona: THREE.Sprite;
  readonly label: CSS2DObject;
  private readonly spinRate = visualRotationRate(SUN.rotation);
  private readonly realRadiusUnits = SUN.radiusKm / KM_PER_UNIT;
  private radiusUnits = 0;

  constructor(textures: TextureSet, sunScale: number) {
    this.group.name = SUN.name;

    const map = textures.get('sun') ?? createSunFallback();
    const boost = SUN.emissiveBoost;
    // Basis-Radius 1, Größe über scale → Skalierung ohne neue Geometrie.
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 32),
      new THREE.MeshBasicMaterial({ map, color: new THREE.Color(boost, boost * 0.92, boost * 0.8) }),
    );
    this.mesh.name = SUN.name;
    this.mesh.rotation.y = initialRotation(SUN.rotation);
    const tilt = new THREE.Group();
    poleOrientation(SUN.rotation, tilt.quaternion);
    tilt.add(this.mesh);
    this.group.add(tilt);

    this.corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createCoronaTexture(),
        color: 0xffc46b,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.corona.name = 'Korona';
    this.corona.raycast = () => {}; // nicht anklickbar
    this.group.add(this.corona);

    // Konstante Intensität über alle Distanzen (decay = 0), sonst wären
    // die äußeren Planeten bei komprimiertem Maßstab unnatürlich dunkel.
    this.light = new THREE.PointLight(SUN.light.color, SUN.light.intensity, 0, 0);
    this.light.name = 'Sonnenlicht';
    this.group.add(this.light);

    this.label = createLabel(SUN.name);
    this.group.add(this.label);

    this.setScale(sunScale);
  }

  get radius(): number {
    return this.radiusUnits;
  }

  /** Setzt den Sonnen-Skalierungsfaktor (1 = echter Radius). */
  private setScale(sunScale: number): void {
    this.radiusUnits = this.realRadiusUnits * sunScale;
    this.mesh.scale.setScalar(this.radiusUnits);
    this.corona.scale.setScalar(this.radiusUnits * SUN.coronaScale);
    this.label.position.set(0, this.radiusUnits * 1.25, 0);
  }

  /** @param spinDt Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung */
  update(spinDt: number): void {
    this.mesh.rotation.y = (this.mesh.rotation.y + this.spinRate * spinDt) % (Math.PI * 2);
  }
}

function createSunFallback(): THREE.Texture {
  return createCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffae3c';
    ctx.fillRect(0, 0, w, h);
    // Granulation
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 5;
      const light = Math.random() < 0.5;
      ctx.fillStyle = light ? 'rgba(255,230,140,0.35)' : 'rgba(200,90,20,0.3)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function createCoronaTexture(): THREE.Texture {
  return createCanvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0.0, 'rgba(255,240,200,1)');
    g.addColorStop(0.22, 'rgba(255,200,120,0.55)');
    g.addColorStop(0.4, 'rgba(255,150,60,0.18)');
    g.addColorStop(0.7, 'rgba(255,120,40,0.05)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
