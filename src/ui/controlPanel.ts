import { TIME } from '../config/solarSystemData';
import { j2000DaysToDate } from '../core/astro';
import type { SimClock } from '../core/simClock';

export interface ControlPanelOptions {
  clock: SimClock;
  onToggleOrbits(visible: boolean): void;
}

const SLIDER_STEPS = 1000;
const DATE_REFRESH_MS = 100;

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Glassmorphism-Panel oben rechts: Zeitsteuerung und Ansicht. */
export class ControlPanel {
  private readonly root: HTMLElement;
  private readonly dateEl: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly reverseBtn: HTMLButtonElement;
  private readonly speedLabel: HTMLElement;
  private lastDateRefresh = 0;

  constructor(private readonly opts: ControlPanelOptions) {
    const { clock } = opts;
    this.root = document.createElement('div');
    this.root.id = 'control-panel';
    this.root.className = 'glass';
    this.root.innerHTML = /* html */ `
      <section>
        <h3>Zeit</h3>
        <div class="sim-date"></div>
        <div class="btn-row">
          <button data-action="reverse" title="Rückwärts">◀◀&#xFE0E;</button>
          <button data-action="play" title="Pause / Weiter"></button>
          <button data-action="now" title="Auf aktuelles Datum setzen">Jetzt</button>
        </div>
        <label class="slider-label">Geschwindigkeit <span class="speed-value"></span></label>
        <input type="range" class="speed" min="0" max="${SLIDER_STEPS}" step="1" />
      </section>
      <section>
        <h3>Ansicht</h3>
        <label class="toggle"><input type="checkbox" class="orbits" checked /> Orbitlinien</label>
      </section>
    `;
    document.body.appendChild(this.root);

    const q = <T extends HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!;
    this.dateEl = q('.sim-date');
    this.playBtn = q('[data-action="play"]');
    this.reverseBtn = q('[data-action="reverse"]');
    this.speedLabel = q('.speed-value');

    this.playBtn.addEventListener('click', () => {
      clock.paused = !clock.paused;
      this.refreshButtons();
    });
    this.reverseBtn.addEventListener('click', () => {
      clock.reversed = !clock.reversed;
      this.refreshButtons();
    });
    q('[data-action="now"]').addEventListener('click', () => clock.resetToNow());

    const speed = q<HTMLInputElement>('.speed');
    speed.value = String(toSlider(clock.speed, TIME.minSpeed, TIME.maxSpeed));
    speed.addEventListener('input', () => {
      clock.speed = fromSlider(Number(speed.value), TIME.minSpeed, TIME.maxSpeed);
      this.speedLabel.textContent = formatSpeed(clock.speed);
    });
    this.speedLabel.textContent = formatSpeed(clock.speed);

    q<HTMLInputElement>('.orbits').addEventListener('change', (e) =>
      opts.onToggleOrbits((e.target as HTMLInputElement).checked),
    );

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        this.playBtn.click();
      }
    });

    this.refreshButtons();
  }

  /** Jedes Frame aufrufen; das DOM wird gedrosselt aktualisiert. */
  update(now: number): void {
    if (now - this.lastDateRefresh < DATE_REFRESH_MS) return;
    this.lastDateRefresh = now;
    this.dateEl.textContent = dateFormat.format(j2000DaysToDate(this.opts.clock.days));
  }

  private refreshButtons(): void {
    const { clock } = this.opts;
    // U+FE0E erzwingt Textdarstellung statt Emoji
    this.playBtn.textContent = clock.paused ? '▶︎' : '❚❚';
    this.playBtn.classList.toggle('active', clock.paused);
    this.reverseBtn.classList.toggle('active', clock.reversed);
  }
}

/** Logarithmische Abbildung Slider ↔ Wert. */
function fromSlider(step: number, min: number, max: number): number {
  return min * Math.pow(max / min, step / SLIDER_STEPS);
}

function toSlider(value: number, min: number, max: number): number {
  return Math.round((Math.log(value / min) / Math.log(max / min)) * SLIDER_STEPS);
}

function formatSpeed(daysPerSecond: number): string {
  if (daysPerSecond >= 365) return '1 Jahr/s';
  if (daysPerSecond >= 60) return `${num(daysPerSecond / 30.44, 1)} Monate/s`;
  if (daysPerSecond >= 14) return `${num(daysPerSecond / 7, 1)} Wochen/s`;
  if (daysPerSecond < 1.05) return '1 Tag/s';
  return `${num(daysPerSecond, daysPerSecond < 10 ? 1 : 0)} Tage/s`;
}

function num(v: number, digits: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
