import { TIME } from '../config/solarSystemData';
import { dateToJ2000Days } from './astro';

/** Simulationszeit in Tagen seit J2000, startet beim aktuellen Datum. */
export class SimClock {
  days = dateToJ2000Days(new Date());
  /** Betrag der Geschwindigkeit in Tagen pro Sekunde. */
  speed: number = TIME.defaultSpeed;
  paused = false;
  reversed = false;

  /** 0 bei Pause, −1 rückwärts, sonst 1 (für die sichtbare Eigenrotation). */
  get direction(): number {
    return this.paused ? 0 : this.reversed ? -1 : 1;
  }

  tick(dtSeconds: number): void {
    if (this.paused) return;
    this.days += dtSeconds * this.speed * (this.reversed ? -1 : 1);
  }

  resetToNow(): void {
    this.days = dateToJ2000Days(new Date());
  }
}
