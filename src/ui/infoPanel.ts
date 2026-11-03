import { isCompactUI } from '../core/device';
import type { FocusTarget } from '../navigation/focusTargets';

const REFRESH_MS = 250;

/**
 * Infopanel mit Kerndaten des ausgewählten Objekts. Auf kleinen Bildschirmen
 * erscheint es als Leiste vom unteren Rand (Layout in style.css).
 */
export class InfoPanel {
  private readonly root = document.createElement('aside');
  private readonly title = document.createElement('h2');
  private readonly rows = document.createElement('dl');
  /** Laufend aktualisierte Werte (z. B. aktueller Abstand). */
  private live: { el: HTMLElement; value: () => string }[] = [];
  private lastRefresh = 0;
  private visible = false;
  /** Gemessene Höhe inkl. Abstand zum unteren Rand (ResizeObserver, kein Layout im Render-Loop). */
  private coveredHeight = 0;

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

    // offsetHeight statt getBoundingClientRect: unabhängig von der Einblend-Transformation.
    new ResizeObserver(() => {
      this.coveredHeight = this.root.offsetHeight + (parseFloat(getComputedStyle(this.root).bottom) || 0);
    }).observe(this.root);
  }

  /** Unten verdeckter Bildschirmbereich in Pixeln (nur bei der Leiste auf kleinen Bildschirmen). */
  get bottomInset(): number {
    return this.visible && isCompactUI() ? this.coveredHeight : 0;
  }

  show(target: FocusTarget): void {
    this.title.textContent = target.name;
    this.rows.replaceChildren();
    this.live = [];

    for (const { label, value } of target.info()) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      if (typeof value === 'function') this.live.push({ el: dd, value });
      else dd.textContent = value;
      this.rows.append(dt, dd);
    }

    this.refreshLive();
    this.visible = true;
    this.root.classList.add('visible');
  }

  hide(): void {
    this.live = [];
    this.visible = false;
    this.root.classList.remove('visible');
  }

  /** Jedes Frame aufrufen; Live-Werte werden gedrosselt aktualisiert. */
  update(now: number): void {
    if (this.live.length === 0 || now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    this.refreshLive();
  }

  private refreshLive(): void {
    for (const { el, value } of this.live) el.textContent = value();
  }
}
