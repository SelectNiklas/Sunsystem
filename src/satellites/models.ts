import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SatelliteModel } from '../config/solarSystemData';

/**
 * Low-Poly-Satellitenmodelle, normiert auf Spannweite ≈ 1.
 * Achsen: +Y radial nach außen, +Z in Flugrichtung, Solarpanels entlang X
 * (senkrecht zur Bahnebene). Alle Teile einer Materialart werden zu einer
 * Geometrie verschmolzen → 2 Draw Calls pro Satellit.
 */

const panelMaterial = new THREE.MeshStandardMaterial({
  color: 0x22356e,
  emissive: 0x0b1430,
  roughness: 0.35,
  metalness: 0.6,
});

const bodyMaterials = new Map<number, THREE.MeshStandardMaterial>();

function bodyMaterial(color: number): THREE.MeshStandardMaterial {
  let m = bodyMaterials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5 });
    bodyMaterials.set(color, m);
  }
  return m;
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function cylinderX(r: number, len: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r, r, len, 10).rotateZ(Math.PI / 2).translate(x, y, z);
}

function cylinderZ(r: number, len: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(r, r, len, 10).rotateX(Math.PI / 2).translate(x, y, z);
}

interface Parts {
  body: THREE.BufferGeometry[];
  panels: THREE.BufferGeometry[];
}

function issParts(): Parts {
  // Hauptträger quer zur Flugrichtung, Module entlang der Flugrichtung
  const body = [box(1, 0.04, 0.05), cylinderZ(0.06, 0.55), cylinderX(0.05, 0.22, 0, 0, 0.18), box(0.08, 0.08, 0.18, 0, 0.08, -0.05)];
  const panels: THREE.BufferGeometry[] = [];
  for (const x of [-0.42, -0.3, 0.3, 0.42]) {
    panels.push(box(0.1, 0.01, 0.42, x, 0, 0.24), box(0.1, 0.01, 0.42, x, 0, -0.24));
  }
  // Radiatoren
  body.push(box(0.05, 0.005, 0.16, -0.12, 0, -0.14), box(0.05, 0.005, 0.16, 0.12, 0, -0.14));
  return { body, panels };
}

function panelSatParts(): Parts {
  return {
    body: [box(0.2, 0.22, 0.2), cylinderX(0.012, 0.16, -0.17), cylinderX(0.012, 0.16, 0.17), box(0.06, 0.08, 0.06, 0, 0.14)],
    panels: [box(0.38, 0.01, 0.16, -0.43), box(0.38, 0.01, 0.16, 0.43)],
  };
}

function dishSatParts(): Parts {
  const dish = new THREE.SphereGeometry(0.13, 12, 4, 0, Math.PI * 2, 0, Math.PI / 3)
    .scale(1, 0.45, 1)
    .rotateX(Math.PI)
    .translate(0, -0.08, 0.02);
  return {
    // Antenne zur Erde (−Y)
    body: [box(0.22, 0.26, 0.22), dish, cylinderX(0.012, 0.12, -0.17), cylinderX(0.012, 0.12, 0.17)],
    panels: [box(0.36, 0.01, 0.18, -0.41), box(0.36, 0.01, 0.18, 0.41)],
  };
}

const PART_BUILDERS: Record<SatelliteModel, () => Parts> = {
  iss: issParts,
  panels: panelSatParts,
  dish: dishSatParts,
};

const geometryCache = new Map<SatelliteModel, THREE.BufferGeometry>();

function modelGeometry(model: SatelliteModel): THREE.BufferGeometry {
  let geometry = geometryCache.get(model);
  if (!geometry) {
    const parts = PART_BUILDERS[model]();
    geometry = mergeGeometries([mergeGeometries(parts.body), mergeGeometries(parts.panels)], true);
    for (const g of [...parts.body, ...parts.panels]) g.dispose();
    geometryCache.set(model, geometry);
  }
  return geometry;
}

/** Erzeugt ein Satellitenmodell (Gruppe 0 = Körper, Gruppe 1 = Solarpanels). */
export function createSatelliteMesh(model: SatelliteModel, color: number): THREE.Mesh {
  return new THREE.Mesh(modelGeometry(model), [bodyMaterial(color), panelMaterial]);
}
