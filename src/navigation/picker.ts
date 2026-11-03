import * as THREE from 'three';
import { NAVIGATION } from '../config/solarSystemData';
import type { FocusTarget } from './focusTargets';

export interface PickerEvents {
  onHover(target: FocusTarget | null, clientX: number, clientY: number): void;
  onClick(target: FocusTarget): void;
}

const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/**
 * Raycasting auf die Körper. Hover (nur Maus) wird höchstens einmal pro Frame
 * ausgewertet (update), Klick/Tippen nur, wenn nicht gezogen wurde. Beim
 * Tippen zählt auch ein Treffer knapp neben kleinen Körpern; Gesten mit
 * zwei Fingern (Zoomen/Verschieben) lösen nie eine Auswahl aus.
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
  /** Aktive Zeiger (Finger); bei mehreren ist die Geste kein Tippen. */
  private readonly pointers = new Set<number>();
  private multiTouch = false;

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly targets: readonly FocusTarget[],
    private readonly events: PickerEvents,
  ) {
    this.pickables = targets.map((t) => t.pickable);

    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
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
      this.pointers.add(e.pointerId);
      if (this.pointers.size > 1) this.multiTouch = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
    });
    dom.addEventListener('pointercancel', (e) => this.releasePointer(e.pointerId));
    dom.addEventListener('pointerup', (e) => {
      const wasMulti = this.releasePointer(e.pointerId);
      if (e.button !== 0 || wasMulti) return;
      const touch = e.pointerType !== 'mouse';
      const tolerance = touch ? NAVIGATION.tapTolerancePx : NAVIGATION.clickTolerancePx;
      if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > tolerance) return;
      const target = this.pick(e.clientX, e.clientY) ?? (touch ? this.pickNear(e.clientX, e.clientY) : null);
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

  /** Gibt zurück, ob die Geste mehrere Finger hatte; setzt den Zustand nach dem letzten Finger zurück. */
  private releasePointer(id: number): boolean {
    this.pointers.delete(id);
    const wasMulti = this.multiTouch;
    if (this.pointers.size === 0) this.multiTouch = false;
    return wasMulti;
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

  /**
   * Körper, dessen Bildschirmscheibe dem Tippunkt am nächsten liegt
   * (höchstens NAVIGATION.tapRadiusPx entfernt). Große Körper gewinnen
   * gegenüber kleinen in ihrer Nähe, z. B. die Erde gegenüber Satelliten.
   */
  private pickNear(clientX: number, clientY: number): FocusTarget | null {
    const rect = this.dom.getBoundingClientRect();
    const pxPerUnitAt1 = rect.height / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    let best: FocusTarget | null = null;
    let bestScore: number = NAVIGATION.tapRadiusPx;

    for (const target of this.targets) {
      if (!isVisible(target.object)) continue;
      target.object.getWorldPosition(_world);
      const depth = _world.distanceTo(this.camera.position);
      _ndc.copy(_world).project(this.camera);
      if (_ndc.z < -1 || _ndc.z > 1) continue;
      const x = rect.left + ((_ndc.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - _ndc.y) / 2) * rect.height;
      const radiusPx = (target.radius() / depth) * pxPerUnitAt1;
      const score = Math.max(0, Math.hypot(x - clientX, y - clientY) - radiusPx);
      if (score < bestScore) {
        bestScore = score;
        best = target;
      }
    }
    return best;
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

function isVisible(obj: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}
