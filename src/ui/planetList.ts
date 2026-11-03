import * as THREE from 'three';
import { IS_MOBILE, isCompactUI } from '../core/device';
import type { FocusTarget } from '../navigation/focusTargets';
import { Collapsible } from './collapsible';

/**
 * Liste links zum schnellen Anspringen der Raumfahrzeuge (einklappbar).
 * Auf kleinen Bildschirmen eine waagerecht scrollbare Leiste oben.
 */
export class PlanetList {
  readonly collapsible: Collapsible;
  private readonly items = new Map<string, HTMLButtonElement>();

  constructor(
    targets: readonly FocusTarget[],
    onSelect: (target: FocusTarget) => void,
    onOverview: () => void,
  ) {
    const root = document.createElement('nav');
    root.id = 'planet-list';
    root.className = 'glass';

    // Die Überschrift ist zugleich der Knopf zum Ein-/Ausklappen.
    const toggle = document.createElement('button');
    toggle.className = 'panel-toggle list-toggle';
    toggle.title = 'Liste ein-/ausklappen';
    toggle.innerHTML = 'Raumfahrt <span class="chevron" aria-hidden="true">▾&#xFE0E;</span>';
    root.appendChild(toggle);

    // Himmelskörper werden direkt in der Szene angeklickt; die Liste zeigt nur die Raumfahrt.
    const isCraft = (t: FocusTarget) => t.kind === 'satellite' || t.kind === 'rocket';
    root.appendChild(this.createList(targets.filter(isCraft), onSelect));

    const overview = document.createElement('button');
    overview.className = 'overview-btn';
    overview.textContent = 'Gesamtansicht';
    overview.title = 'ESC';
    overview.addEventListener('click', onOverview);
    root.appendChild(overview);

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = IS_MOBILE
      ? '1 Finger: drehen<br>2 Finger: zoomen / verschieben<br>Tippen: Objekt verfolgen'
      : 'WASD / Pfeile: fliegen<br>Q / E: runter / hoch · Shift: schneller<br>ESC: Gesamtansicht';
    root.appendChild(hint);

    document.body.appendChild(root);
    this.collapsible = new Collapsible(root, toggle, isCompactUI());
  }

  setActive(id: string | null): void {
    for (const [key, btn] of this.items) btn.classList.toggle('active', key === id);
  }

  private createList(targets: readonly FocusTarget[], onSelect: (target: FocusTarget) => void): HTMLUListElement {
    const list = document.createElement('ul');
    for (const target of targets) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.innerHTML = `<span class="dot" style="background:#${new THREE.Color(target.color).getHexString()}"></span>`;
      btn.append(target.name);
      btn.addEventListener('click', () => onSelect(target));
      li.appendChild(btn);
      list.appendChild(li);
      this.items.set(target.id, btn);
    }
    return list;
  }
}
