import { AU_KM, SUN } from '../config/solarSystemData';
import type { FocusTarget } from '../navigation/focusTargets';

const REFRESH_MS = 250;

/** Infopanel mit Kerndaten des ausgewählten Körpers. */
export class InfoPanel {
  private readonly root = document.createElement('aside');
  private readonly title = document.createElement('h2');
  private readonly rows = document.createElement('dl');
  private distanceEl: HTMLElement | null = null;
  private target: FocusTarget | null = null;
  private lastRefresh = 0;

  constructor() {
    this.root.id = 'info-panel';
    this.root.className = 'glass';

    const close = document.createElement('button');
    close.className = 'close';
    close.title = 'Schließen';
    close.textContent = '×';
    close.addEventListener('click', () => this.hide());

    this.root.append(close, this.title, this.rows);
    document.body.appendChild(this.root);
  }

  show(target: FocusTarget): void {
    this.target = target;
    this.title.textContent = target.name;
    this.rows.replaceChildren();
    this.distanceEl = null;

    const p = target.planet?.data;
    if (!p) {
      this.row('Durchmesser', `${fmt(SUN.info.diameterKm, 0)} km`);
      this.row('Rotation (Äquator)', `${fmt(SUN.rotationPeriodDays, 1)} Tage`);
      this.row('Achsneigung', `${fmt(SUN.axialTiltDeg, 2)}°`);
      this.row('Oberflächentemperatur', `${fmt(SUN.info.surfaceTempK, 0)} K`);
      this.row('Masse', '≈ 333.000 Erdmassen');
    } else {
      const retro = p.rotationPeriodHours < 0 ? ' (retrograd)' : '';
      this.row('Durchmesser', `${fmt(p.radiusKm * 2, 0)} km`);
      this.distanceEl = this.row('Abstand zur Sonne', '');
      this.row('Große Halbachse', `${fmt(p.orbit.a, 3)} AE`);
      this.row('Umlaufzeit', formatPeriod(p.orbit.periodDays));
      this.row('Tageslänge', formatHours(p.dayLengthHours));
      this.row('Rotation', formatHours(Math.abs(p.rotationPeriodHours)) + retro);
      this.row('Achsneigung', `${fmt(p.axialTiltDeg, 1)}°`);
      this.row('Monde', String(p.moons));
    }

    this.refreshDistance();
    this.root.classList.add('visible');
  }

  hide(): void {
    this.target = null;
    this.root.classList.remove('visible');
  }

  /** Jedes Frame aufrufen; der aktuelle Abstand wird gedrosselt aktualisiert. */
  update(now: number): void {
    if (!this.distanceEl || now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    this.refreshDistance();
  }

  private refreshDistance(): void {
    const planet = this.target?.planet;
    if (!planet || !this.distanceEl) return;
    const au = planet.helioAU.length();
    this.distanceEl.textContent = `${fmt(au, 3)} AE · ${fmt((au * AU_KM) / 1e6, 1)} Mio. km`;
  }

  private row(label: string, value: string): HTMLElement {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    this.rows.append(dt, dd);
    return dd;
  }
}

function fmt(v: number, digits: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPeriod(days: number): string {
  return days < 1000 ? `${fmt(days, 1)} Tage` : `${fmt(days / 365.25, 2)} Jahre`;
}

function formatHours(hours: number): string {
  return hours < 48 ? `${fmt(hours, 1)} h` : `${fmt(hours / 24, 1)} Tage`;
}
