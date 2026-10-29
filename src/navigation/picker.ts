import * as THREE from 'three';
import { NAVIGATION } from '../config/solarSystemData';
import type { FocusTarget } from './focusTargets';

export interface PickerEvents {
  onHover(target: FocusTarget | null, clientX: number, clientY: number): void;
  onClick(target: FocusTarget): void;
}

/**
 * Raycasting auf die Körper. Hover wird höchstens einmal pro Frame
 * ausgewertet (update), Klick nur, wenn die Maus nicht gezogen wurde.
 */
export class Picker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly pickables: THREE.Object3D[];
  private readonly hits: THREE.Intersection[] = [];
  private clientX = 0;
  private clientY = 0;
  private inside = false;
  private dirty = false;
  private downX = 0;
  private downY = 0;
  private hovered: FocusTarget | null = null;

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly targets: readonly FocusTarget[],
    private readonly events: PickerEvents,
  ) {
    this.pickables = targets.map((t) => t.pickable);

    dom.addEventListener('pointermove', (e) => {
      this.clientX = e.clientX;
      this.clientY = e.clientY;
      this.inside = true;
      this.dirty = true;
    });
    dom.addEventListener('pointerleave', () => {
      this.inside = false;
      this.dirty = true;
    });
    dom.addEventListener('pointerdown', (e) => {
      this.downX = e.clientX;
      this.downY = e.clientY;
    });
    dom.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (moved > NAVIGATION.clickTolerancePx) return;
      const target = this.pick(e.clientX, e.clientY);
      if (target) this.events.onClick(target);
    });
  }

  /** Einmal pro Frame aufrufen (nach Positions-Update der Körper). */
  update(): void {
    // Auch ohne Mausbewegung neu prüfen, wenn ein Körper unter dem Cursor wegzieht.
    if (!this.inside) {
      if (this.dirty) this.setHovered(null);
      this.dirty = false;
      return;
    }
    this.dirty = false;
    this.setHovered(this.pick(this.clientX, this.clientY));
  }

  private pick(clientX: number, clientY: number): FocusTarget | null {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.hits.length = 0;
    // Nicht rekursiv: LOD.raycast prüft selbst nur die aktive Stufe.
    this.raycaster.intersectObjects(this.pickables, false, this.hits);
    if (this.hits.length === 0) return null;
    return this.targetOf(this.hits[0].object);
  }

  private targetOf(obj: THREE.Object3D | null): FocusTarget | null {
    for (let o = obj; o; o = o.parent) {
      const idx = this.pickables.indexOf(o);
      if (idx >= 0) return this.targets[idx];
    }
    return null;
  }

  private setHovered(target: FocusTarget | null): void {
    if (target !== this.hovered) this.dom.style.cursor = target ? 'pointer' : '';
    this.hovered = target;
    this.events.onHover(target, this.clientX, this.clientY);
  }
}
