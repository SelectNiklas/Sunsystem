import * as THREE from 'three';
import { SCALE } from '../config/solarSystemData';

const EARTH_RADIUS_KM = 6371;

/**
 * Darstellungsmaßstab (siehe SCALE): komprimierte Radien und Abstände,
 * Sonnengröße über einen eigenen, festen Faktor.
 */
export class ScaleState {
  readonly sunScale: number = SCALE.sunScale;

  /** Körperradius in km → Szeneneinheiten. */
  bodyRadius(radiusKm: number): number {
    const { earthUnits, exponent } = SCALE.radius;
    return earthUnits * Math.pow(radiusKm / EARTH_RADIUS_KM, exponent);
  }

  /** Sonnenabstand in AE → Szeneneinheiten. */
  distance(au: number): number {
    return SCALE.distance.factor * Math.log1p(au / SCALE.distance.refAU);
  }

  /** Bildet eine heliozentrische Position (AE) in place auf die Szene ab. */
  mapPosition(v: THREE.Vector3): THREE.Vector3 {
    const r = v.length();
    return r === 0 ? v : v.multiplyScalar(this.distance(r) / r);
  }

  /** Erdmittelpunktsabstand in km → Szeneneinheiten (siehe SCALE.earthSpace). */
  geoDistance(km: number): number {
    const { factor, exponent } = SCALE.earthSpace;
    const altitude = Math.max(km / EARTH_RADIUS_KM - 1, 0);
    return this.bodyRadius(EARTH_RADIUS_KM) * (1 + factor * Math.pow(altitude, exponent));
  }

  /** Umkehrung von geoDistance: Szeneneinheiten → Erdmittelpunktsabstand in km. */
  geoDistanceToKm(units: number): number {
    const { factor, exponent } = SCALE.earthSpace;
    const x = Math.max(units / this.bodyRadius(EARTH_RADIUS_KM) - 1, 0) / factor;
    return EARTH_RADIUS_KM * (1 + Math.pow(x, 1 / exponent));
  }

  /** Bildet eine geozentrische Position (km) in place auf die Szene ab. */
  mapGeoPosition(v: THREE.Vector3): THREE.Vector3 {
    const r = v.length();
    return r === 0 ? v : v.multiplyScalar(this.geoDistance(r) / r);
  }
}
