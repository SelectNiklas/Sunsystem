import * as THREE from 'three';
import { HIGHLIGHT } from '../config/solarSystemData';
import { createCanvasTexture } from './textures';

let glowTexture: THREE.Texture | null = null;

/**
 * Hervorhebung eines ausgewählten Objekts: additiver Lichthof (Sprite) und
 * leichtes Eigenleuchten der Materialien. Die Materialien dürfen nicht mit
 * anderen Objekten geteilt sein.
 */
export class Highlight {
  private readonly glow: THREE.Sprite;
  private readonly baseEmissive: THREE.Color[];

  /**
   * @param parent Objekt, an dem der Lichthof hängt (wird mit ihm skaliert)
   * @param size Modellgröße im lokalen System von `parent`
   */
  constructor(
    parent: THREE.Object3D,
    size: number,
    private readonly materials: THREE.MeshStandardMaterial[],
  ) {
    glowTexture ??= createGlowTexture();
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: HIGHLIGHT.color,
        opacity: HIGHLIGHT.glowOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.glow.name = 'Auswahl-Schein';
    this.glow.scale.setScalar(size * HIGHLIGHT.glowSize);
    this.glow.raycast = () => {};
    this.glow.visible = false;
    parent.add(this.glow);
    this.baseEmissive = materials.map((m) => m.emissive.clone());
  }

  set(on: boolean): void {
    this.glow.visible = on;
    this.materials.forEach((m, i) => {
      m.emissive.copy(this.baseEmissive[i]);
      if (on) m.emissive.add(_c.copy(m.color).multiplyScalar(HIGHLIGHT.emissive));
    });
  }
}

const _c = new THREE.Color();

function createGlowTexture(): THREE.Texture {
  return createCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
