import type * as THREE from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { NAVIGATION, SUN } from '../config/solarSystemData';
import type { Planet } from '../planets/planet';
import type { PlanetSystem } from '../planets/planets';
import type { Sun } from '../sun/sun';

/** Ein anfliegbares Objekt (Sonne oder Planet). */
export interface FocusTarget {
  id: string;
  name: string;
  color: number;
  /** Objekt, dessen Position verfolgt wird (Eltern liegen im Ursprung). */
  object: THREE.Object3D;
  /** Objekte für das Raycasting. */
  pickable: THREE.Object3D;
  label: CSS2DObject;
  radius(): number;
  viewDistance(): number;
  planet?: Planet;
}

export function createFocusTargets(sun: Sun, planets: PlanetSystem): FocusTarget[] {
  const targets: FocusTarget[] = [
    {
      id: 'sun',
      name: SUN.name,
      color: SUN.fallbackColor,
      object: sun.group,
      pickable: sun.mesh,
      label: sun.label,
      radius: () => sun.radius,
      viewDistance: () => sun.radius * NAVIGATION.sunViewFactor,
    },
  ];
  for (const planet of planets.planets) {
    targets.push({
      id: planet.data.id,
      name: planet.data.name,
      color: planet.data.orbitColor,
      object: planet.root,
      pickable: planet.surface,
      label: planet.label,
      radius: () => planet.radius,
      viewDistance: () => planet.viewDistance,
      planet,
    });
  }
  return targets;
}
