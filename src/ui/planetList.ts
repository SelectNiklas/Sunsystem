import * as THREE from 'three';
import type { FocusTarget } from '../navigation/focusTargets';

/** Liste links zum schnellen Anspringen der Raumfahrzeuge. */
export class PlanetList {
  private readonly items = new Map<string, HTMLButtonElement>();

  constructor(
    targets: readonly FocusTarget[],
    onSelect: (target: FocusTarget) => void,
    onOverview: () => void,
  ) {
    const root = document.createElement('nav');
    root.id = 'planet-list';
    root.className = 'glass';

    // Himmelskörper werden direkt in der Szene angeklickt; die Liste zeigt nur die Raumfahrt.
    const isCraft = (t: FocusTarget) => t.kind === 'satellite' || t.kind === 'rocket';
    this.addSection(root, 'Raumfahrt', targets.filter(isCraft), onSelect);

    const overview = document.createElement('button');
    overview.className = 'overview-btn';
    overview.textContent = 'Gesamtansicht';
    overview.title = 'ESC';
    overview.addEventListener('click', onOverview);
    root.appendChild(overview);

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = 'WASD / Pfeile: fliegen<br>Q / E: runter / hoch · Shift: schneller<br>ESC: Gesamtansicht';
    root.appendChild(hint);

    document.body.appendChild(root);
  }

  setActive(id: string | null): void {
    for (const [key, btn] of this.items) btn.classList.toggle('active', key === id);
  }

  private addSection(
    root: HTMLElement,
    heading: string,
    targets: readonly FocusTarget[],
    onSelect: (target: FocusTarget) => void,
  ): void {
    const title = document.createElement('h3');
    title.textContent = heading;
    root.appendChild(title);

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
    root.appendChild(list);
  }
}
