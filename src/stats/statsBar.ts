import * as THREE from 'three';

interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

const UPDATE_INTERVAL_MS = 500;

/**
 * Schmale Leistungsanzeige am unteren Rand. Sammelt Frame-Zeiten laufend,
 * schreibt aber nur ~2× pro Sekunde ins DOM.
 */
export class StatsBar {
  private readonly el: HTMLElement;
  private readonly fields: Record<string, HTMLElement> = {};

  private frames = 0;
  private cpuTimeSum = 0;
  private frameStart = 0;
  private windowStart = performance.now();

  // Wiederverwendete Objekte für die Objektzählung
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();

  constructor(
    container: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    /** Aktuelle Render-Qualität (Pixel-Ratio, MSAA) als Kurztext. */
    private readonly quality: () => string,
  ) {
    this.el = container;
    const items: [string, string][] = [
      ['fps', 'FPS'],
      ['frame', 'Frame'],
      ['cpu', 'CPU'],
      ['calls', 'Draw Calls'],
      ['tris', 'Dreiecke'],
      ['geo', 'Geometrien'],
      ['tex', 'Texturen'],
      ['heap', 'JS-Heap'],
      ['objects', 'Objekte'],
      ['quality', 'Auflösung'],
    ];
    for (const [key, label] of items) {
      const item = document.createElement('span');
      item.className = 'stat';
      item.innerHTML = `<span class="stat-label">${label}</span> `;
      const value = document.createElement('span');
      value.className = 'stat-value';
      value.textContent = '–';
      item.appendChild(value);
      this.el.appendChild(item);
      this.fields[key] = value;
    }
  }

  /** Zu Beginn jedes Frames, vor update/render. */
  beginFrame(): void {
    this.frameStart = performance.now();
    this.renderer.info.reset();
  }

  /** Nach dem Rendern. */
  endFrame(): void {
    const now = performance.now();
    this.cpuTimeSum += now - this.frameStart;
    this.frames++;

    const elapsed = now - this.windowStart;
    if (elapsed < UPDATE_INTERVAL_MS) return;

    const fps = (this.frames * 1000) / elapsed;
    const info = this.renderer.info;
    const f = this.fields;
    f.fps.textContent = fps.toFixed(0);
    f.frame.textContent = `${(elapsed / this.frames).toFixed(1)} ms`;
    f.cpu.textContent = `${(this.cpuTimeSum / this.frames).toFixed(1)} ms`;
    f.calls.textContent = String(info.render.calls);
    f.tris.textContent = formatCount(info.render.triangles);
    f.geo.textContent = String(info.memory.geometries);
    f.tex.textContent = String(info.memory.textures);
    f.heap.textContent = heapText();
    f.objects.textContent = String(this.countRenderedObjects());
    f.quality.textContent = this.quality();

    this.frames = 0;
    this.cpuTimeSum = 0;
    this.windowStart = now;
  }

  /** Zählt sichtbare Mesh/Points/Line/Sprite-Objekte im Kamerafrustum. */
  private countRenderedObjects(): number {
    this.projScreen.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    let count = 0;
    this.scene.traverseVisible((obj) => {
      const o = obj as THREE.Mesh & THREE.Sprite & THREE.Points & THREE.Line;
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      if (!o.frustumCulled) {
        count++;
      } else if (o.isSprite ? this.frustum.intersectsSprite(o) : this.frustum.intersectsObject(o)) {
        count++;
      }
    });
    return count;
  }
}

function heapText(): string {
  const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
  if (!mem) return 'n/a';
  return `${(mem.usedJSHeapSize / 1048576).toFixed(0)} / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`;
}

function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} k`;
  return String(n);
}
