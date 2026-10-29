import * as THREE from 'three';
import type { RingData } from '../config/solarSystemData';
import type { TextureSet } from '../core/textures';
import { ringTexture } from './fallbackTextures';

/**
 * Ringsystem in der Äquatorebene, Maße in Einheiten des Planetenradius.
 * Die Ringtextur ist ein radialer Streifen: u läuft von innen nach außen.
 */
export function createRings(rings: RingData, planetRadiusKm: number, textures: TextureSet): THREE.Mesh {
  const inner = rings.innerKm / planetRadiusKm;
  const outer = rings.outerKm / planetRadiusKm;
  const geometry = new THREE.RingGeometry(inner, outer, 128, 1);

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  geometry.rotateX(-Math.PI / 2);

  const map = (rings.textureKey && textures.get(rings.textureKey)) || ringTexture(rings.color, rings.opacity >= 1);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map,
      color: rings.color,
      opacity: rings.opacity,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  );
  mesh.name = 'Ringe';
  mesh.raycast = () => {};
  return mesh;
}
