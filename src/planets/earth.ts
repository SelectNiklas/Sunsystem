import * as THREE from 'three';
import { PLANET_RENDER } from '../config/solarSystemData';
import type { TextureSet } from '../core/textures';
import { earthCloudTexture, earthDayTexture, earthNightTexture } from './fallbackTextures';
import { lodSpheres, type Planet } from './planet';

const CFG = PLANET_RENDER.earth;
const DEG = Math.PI / 180;

/**
 * Oberfläche: Tagtextur + Stadtlichter als Emissive-Map, die per
 * Shader-Patch nur auf der Nachtseite leuchten. Die Sonne sitzt im
 * Weltursprung, daher ist ihre View-Position viewMatrix · (0,0,0,1).
 */
export function createEarthMaterial(textures: TextureSet): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: textures.get('earthDay') ?? earthDayTexture(),
    emissiveMap: textures.get('earthNight') ?? earthNightTexture(),
    emissive: new THREE.Color(CFG.nightLightsColor),
    emissiveIntensity: CFG.nightLightsIntensity,
    roughness: 0.85,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      vec3 sunDirView = normalize((viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + vViewPosition);
      totalEmissiveRadiance *= smoothstep(0.1, -0.2, dot(normal, sunDirView));`,
    );
  };
  return material;
}

/** Fügt Wolkenschicht und Atmosphären-Glow hinzu. */
export function addEarthLayers(earth: Planet, textures: TextureSet): EarthLayers {
  // Feinste Stufe: Eine gröbere Hülle würde in der Mitte ihrer Flächen
  // unter die Oberfläche sinken und dort verdeckt werden.
  const geometry = lodSpheres()[0];

  const clouds = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: textures.get('earthClouds') ?? earthCloudTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  );
  clouds.name = 'Wolken';
  clouds.scale.setScalar(CFG.cloudScale);
  clouds.raycast = () => {};
  earth.spin.add(clouds);

  const atmosphere = new THREE.Mesh(geometry, createAtmosphereMaterial());
  atmosphere.name = 'Atmosphäre';
  atmosphere.scale.setScalar(CFG.atmosphereScale);
  atmosphere.raycast = () => {};
  earth.tilt.add(atmosphere);

  return new EarthLayers(clouds);
}

export class EarthLayers {
  constructor(private readonly clouds: THREE.Mesh) {}

  update(spinDt: number): void {
    this.clouds.rotation.y = (this.clouds.rotation.y + CFG.cloudDriftDegPerSec * DEG * spinDt) % (Math.PI * 2);
  }
}

/** Fresnel-Glow am Rand, nur auf der Tagseite. */
function createAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(CFG.atmosphereColor) },
      uIntensity: { value: CFG.atmosphereIntensity },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosW = worldPos.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 L = normalize(-vPosW);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        float day = smoothstep(-0.35, 0.4, dot(N, L));
        gl_FragColor = vec4(uColor * fresnel * day * uIntensity, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}
