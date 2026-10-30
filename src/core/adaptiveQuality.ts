import { RENDER } from '../config/solarSystemData';
import type { SceneContext } from './sceneContext';

const A = RENDER.adaptive;

interface Level {
  pixelRatio: number;
  samples: number;
}

/**
 * Senkt die Render-Qualität stufenweise, solange die Bildrate unter dem Ziel
 * liegt: erst MSAA aus, dann kleinere Pixel-Ratio. Jeder Schritt wird im
 * nächsten Messfenster geprüft; bringt er nichts (Grenze liegt nicht bei der
 * Grafikkarte), wird er zurückgenommen und die Anpassung endet.
 * Die Qualität wird nie wieder angehoben, damit sie nicht hin und her springt.
 */
export class AdaptiveQuality {
  private readonly levels: Level[];
  private level = 0;
  private done = false;
  private frames = 0;
  private windowStart = -1;
  private readonly startTime = performance.now();
  /** Bildrate vor dem letzten Schritt (zur Erfolgskontrolle). */
  private fpsBefore: number | null = null;

  constructor(
    private readonly ctx: SceneContext,
    private readonly onChange: (pixelRatio: number) => void,
  ) {
    const { pixelRatio, samples } = ctx.quality;
    this.levels = [{ pixelRatio, samples }];
    if (samples > 0) this.levels.push({ pixelRatio, samples: 0 });
    for (let pr = pixelRatio - A.pixelRatioStep; pr >= A.minPixelRatio - 1e-6; pr -= A.pixelRatioStep) {
      this.levels.push({ pixelRatio: pr, samples: 0 });
    }
  }

  /** Einmal pro Frame mit dem rAF-Zeitstempel aufrufen. */
  update(timestamp: number): void {
    if (this.done || timestamp - this.startTime < A.warmupSeconds * 1000) return;
    if (this.windowStart < 0) this.windowStart = timestamp;
    this.frames++;

    const elapsed = timestamp - this.windowStart;
    if (elapsed < A.windowSeconds * 1000) return;
    const fps = (this.frames * 1000) / elapsed;
    this.frames = 0;
    this.windowStart = timestamp;

    if (this.fpsBefore !== null && fps < this.fpsBefore + A.minGainFps) {
      // Letzter Schritt hat nicht geholfen → zurücknehmen und aufhören.
      if (fps < A.targetFps) {
        this.apply(this.level - 1);
        this.done = true;
        return;
      }
    }
    this.fpsBefore = null;

    if (fps >= A.targetFps) return;
    if (this.level + 1 >= this.levels.length) {
      this.done = true;
      return;
    }
    this.fpsBefore = fps;
    this.apply(this.level + 1);
  }

  private apply(level: number): void {
    this.level = level;
    const { pixelRatio, samples } = this.levels[level];
    this.ctx.setQuality(pixelRatio, samples);
    this.onChange(this.ctx.quality.pixelRatio);
    // Das erste Fenster nach dem Umschalten enthält den Umbau → neu beginnen.
    this.frames = 0;
    this.windowStart = -1;
  }
}
