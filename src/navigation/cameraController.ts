import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, NAVIGATION } from '../config/solarSystemData';
import type { FocusTarget } from './focusTargets';

type Mode = 'free' | 'flying' | 'following';

const OVERVIEW_POSITION = new THREE.Vector3(...CAMERA.overviewPosition);
const ORIGIN = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const _goalPos = new THREE.Vector3();
const _goalTarget = new THREE.Vector3();
const _p = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

const MOVE_KEYS: Record<string, [forward: number, right: number, up: number]> = {
  KeyW: [1, 0, 0],
  ArrowUp: [1, 0, 0],
  KeyS: [-1, 0, 0],
  ArrowDown: [-1, 0, 0],
  KeyA: [0, -1, 0],
  ArrowLeft: [0, -1, 0],
  KeyD: [0, 1, 0],
  ArrowRight: [0, 1, 0],
  KeyE: [0, 0, 1],
  KeyQ: [0, 0, -1],
};

/**
 * Steuert die Kamera über den OrbitControls:
 * - focus(): weicher Flug (Tweening) zu einem Körper, danach Verfolgen
 * - overview(): Flug zurück zur Gesamtansicht (ESC)
 * - Pfeiltasten/WASD (+ Q/E): freies Fliegen, beendet das Verfolgen
 * Beim Verfolgen wird die Bewegung des Körpers auf Kamera und Ziel addiert,
 * Drehen/Zoomen per Maus funktioniert dabei weiter.
 */
export class CameraController {
  private mode: Mode = 'free';
  private focused: FocusTarget | null = null;
  private readonly lastFocusPos = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private boost = false;
  private readonly listeners: ((target: FocusTarget | null) => void)[] = [];

  private readonly flight = {
    t: 0,
    duration: 1,
    arcHeight: 0,
    fromPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    /** Kameraversatz zum Ziel am Flugende. */
    offset: new THREE.Vector3(),
  };

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Escape') {
        this.overview();
        return;
      }
      if (e.code in MOVE_KEYS) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      this.boost = e.shiftKey;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.boost = e.shiftKey;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  get target(): FocusTarget | null {
    return this.focused;
  }

  onFocusChange(fn: (target: FocusTarget | null) => void): void {
    this.listeners.push(fn);
  }

  /** Fliegt zu einem Körper und verfolgt ihn anschließend. */
  focus(target: FocusTarget): void {
    const f = this.flight;
    const p = target.object.position;

    // Blickrichtung: Mischung aus aktueller Richtung und Sonnenseite, damit
    // der Körper beim Ankommen überwiegend beleuchtet ist, die Tag-Nacht-
    // Grenze aber sichtbar bleibt.
    f.offset.subVectors(this.camera.position, p).normalize();
    if (p.lengthSq() > 0) f.offset.multiplyScalar(0.6).addScaledVector(_p.copy(p).normalize(), -0.4);
    f.offset.addScaledVector(UP, 0.25).normalize().multiplyScalar(target.viewDistance());

    this.startFlight(this.camera.position.distanceTo(_p.addVectors(p, f.offset)));
    this.controls.minDistance = CAMERA.minDistance;
    this.setFocused(target);
  }

  /** Fliegt zurück zur Gesamtansicht. */
  overview(): void {
    this.startFlight(this.camera.position.distanceTo(OVERVIEW_POSITION));
    this.controls.minDistance = CAMERA.minDistance;
    this.setFocused(null);
  }

  update(dt: number): void {
    switch (this.mode) {
      case 'flying':
        this.updateFlight(dt);
        break;
      case 'following':
        this.updateFollow();
        this.updateFreeFly(dt);
        break;
      case 'free':
        this.updateFreeFly(dt);
        break;
    }
  }

  private startFlight(distance: number): void {
    const f = this.flight;
    const { min, max } = NAVIGATION.flightDuration;
    f.t = 0;
    f.duration = THREE.MathUtils.clamp(0.6 + Math.log10(Math.max(distance, 1)) * 0.5, min, max);
    f.arcHeight = distance * NAVIGATION.arcFactor;
    f.fromPos.copy(this.camera.position);
    f.fromTarget.copy(this.controls.target);
    this.mode = 'flying';
    this.controls.enabled = false;
  }

  private updateFlight(dt: number): void {
    const f = this.flight;
    f.t = Math.min(f.t + dt / f.duration, 1);
    const e = easeInOutCubic(f.t);

    // Ziel live nachführen, da sich der Körper während des Flugs bewegt.
    if (this.focused) {
      _goalTarget.copy(this.focused.object.position);
      _goalPos.addVectors(_goalTarget, f.offset);
    } else {
      _goalTarget.copy(ORIGIN);
      _goalPos.copy(OVERVIEW_POSITION);
    }

    this.camera.position.lerpVectors(f.fromPos, _goalPos, e);
    this.camera.position.y += Math.sin(Math.PI * e) * f.arcHeight;
    this.controls.target.lerpVectors(f.fromTarget, _goalTarget, e);

    if (f.t >= 1) {
      this.controls.enabled = true;
      if (this.focused) {
        this.mode = 'following';
        this.lastFocusPos.copy(_goalTarget);
        this.controls.minDistance = this.focused.radius() * NAVIGATION.minDistanceFactor;
      } else {
        this.mode = 'free';
      }
    }
  }

  private updateFollow(): void {
    const p = this.focused!.object.position;
    _move.subVectors(p, this.lastFocusPos);
    this.camera.position.add(_move);
    this.controls.target.add(_move);
    this.lastFocusPos.copy(p);
  }

  private updateFreeFly(dt: number): void {
    if (this.keys.size === 0) return;

    let fwd = 0;
    let right = 0;
    let up = 0;
    for (const code of this.keys) {
      const [f, r, u] = MOVE_KEYS[code];
      fwd += f;
      right += r;
      up += u;
    }
    if (fwd === 0 && right === 0 && up === 0) return;

    // Freies Fliegen löst den Fokus.
    if (this.mode === 'following') {
      this.mode = 'free';
      this.controls.minDistance = CAMERA.minDistance;
      this.setFocused(null);
    }

    const dist = this.camera.position.distanceTo(this.controls.target);
    const speed =
      Math.max(dist * NAVIGATION.freeFlySpeed, NAVIGATION.freeFlyMinSpeed) * (this.boost ? NAVIGATION.freeFlyBoost : 1);

    this.camera.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, this.camera.up).normalize();
    _move
      .set(0, 0, 0)
      .addScaledVector(_fwd, fwd)
      .addScaledVector(_right, right)
      .addScaledVector(this.camera.up, up)
      .normalize()
      .multiplyScalar(speed * dt);

    this.camera.position.add(_move);
    this.controls.target.add(_move);
  }

  private setFocused(target: FocusTarget | null): void {
    if (this.focused === target) return;
    this.focused = target;
    for (const fn of this.listeners) fn(target);
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
