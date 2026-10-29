import * as THREE from 'three';
import { PLANET_RENDER, PLANETS, type PlanetData } from '../config/solarSystemData';
import type { ScaleState } from '../core/scale';
import type { TextureSet } from '../core/textures';
import { addEarthLayers, createEarthMaterial, type EarthLayers } from './earth';
import { bandedTexture, rockyTexture } from './fallbackTextures';
import { Planet } from './planet';
import { createRings } from './rings';

const _p = new THREE.Vector3();

/** Alle acht Planeten samt Orbitlinien. */
export class PlanetSystem {
  readonly group = new THREE.Group();
  readonly orbitGroup = new THREE.Group();
  readonly planets: Planet[] = [];
  private readonly orbitLines: THREE.LineLoop[] = [];
  private readonly earthLayers: EarthLayers;

  constructor(
    textures: TextureSet,
    private readonly scale: ScaleState,
  ) {
    this.group.name = 'Planeten';
    this.orbitGroup.name = 'Orbitlinien';

    let earthLayers: EarthLayers | undefined;
    for (const data of PLANETS) {
      const material = data.id === 'earth' ? createEarthMaterial(textures) : createPlanetMaterial(data, textures);
      const planet = new Planet(data, material);
      if (data.id === 'earth') earthLayers = addEarthLayers(planet, textures);
      if (data.rings) planet.tilt.add(createRings(data.rings, data.radiusKm, textures));

      this.planets.push(planet);
      this.group.add(planet.root);
      this.orbitLines.push(this.createOrbitLine(data));
    }
    this.earthLayers = earthLayers!;
    this.applyScale();
  }

  get(id: PlanetData['id']): Planet {
    return this.planets.find((p) => p.data.id === id)!;
  }

  /**
   * @param days    Simulationszeit (Tage seit J2000)
   * @param spinDt  Echtzeit-Delta in s mit Vorzeichen der Zeitrichtung
   */
  update(days: number, spinDt: number): void {
    for (const planet of this.planets) planet.update(days, spinDt, this.scale);
    this.earthLayers.update(spinDt);
  }

  /** Radien, LOD-Schwellen, Labels und Orbitlinien aus dem Maßstab setzen. */
  private applyScale(): void {
    for (let i = 0; i < this.planets.length; i++) {
      const planet = this.planets[i];
      planet.applyScale(this.scale);
      this.updateOrbitLine(planet, this.orbitLines[i]);
    }
  }

  setOrbitsVisible(visible: boolean): void {
    this.orbitGroup.visible = visible;
  }

  private createOrbitLine(data: PlanetData): THREE.LineLoop {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(PLANET_RENDER.orbitSegments * 3), 3),
    );
    const line = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({
        color: data.orbitColor,
        transparent: true,
        opacity: PLANET_RENDER.orbitOpacity,
        depthWrite: false,
      }),
    );
    line.name = `Orbit ${data.name}`;
    this.orbitGroup.add(line);
    return line;
  }

  /** Tastet die Bahn gleichmäßig in E ab und bildet sie wie die Planeten ab. */
  private updateOrbitLine(planet: Planet, line: THREE.LineLoop): void {
    const attr = line.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      planet.orbit.pointAtEccentricAnomaly((i / n) * Math.PI * 2, _p);
      this.scale.mapPosition(_p);
      attr.setXYZ(i, _p.x, _p.y, _p.z);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }
}

function createPlanetMaterial(data: PlanetData, textures: TextureSet): THREE.MeshStandardMaterial {
  const { color, color2, banded } = data.fallback;
  return new THREE.MeshStandardMaterial({
    map: textures.get(data.textureKey) ?? (banded ? bandedTexture(color, color2) : rockyTexture(color, color2)),
    roughness: 0.95,
    metalness: 0,
  });
}
