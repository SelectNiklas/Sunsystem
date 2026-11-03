import { ASTEROID_BELT, COMPACT_UI_QUERY, MOBILE, RENDER, STARFIELD } from '../config/solarSystemData';

/**
 * Mobilgerät = Touch als primäre Eingabe und keine Maus (Smartphones, Tablets).
 * Zum Testen erzwingbar über `?mobile=1` bzw. `?mobile=0`.
 */
export const IS_MOBILE = (() => {
  const forced = new URLSearchParams(location.search).get('mobile');
  if (forced !== null) return forced !== '0';
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
})();

/** Grafikeinstellungen für das aktuelle Gerät. */
export const GRAPHICS = {
  maxPixelRatio: IS_MOBILE ? MOBILE.maxPixelRatio : RENDER.maxPixelRatio,
  msaaSamples: IS_MOBILE ? MOBILE.msaaSamples : RENDER.msaaSamples,
  bloomStrength: IS_MOBILE ? MOBILE.bloom.strength : RENDER.bloom.strength,
  bloomResolution: IS_MOBILE ? MOBILE.bloom.resolution : 1,
  maxTextureSize: IS_MOBILE ? MOBILE.maxTextureSize : Infinity,
  anisotropy: IS_MOBILE ? MOBILE.anisotropy : 8,
  starCount: IS_MOBILE ? MOBILE.starCount : STARFIELD.count,
  beltCount: IS_MOBILE ? MOBILE.beltCount : ASTEROID_BELT.count,
  adaptive: IS_MOBILE ? { ...RENDER.adaptive, ...MOBILE.adaptive } : RENDER.adaptive,
};

const compactQuery = matchMedia(COMPACT_UI_QUERY);

/** Kompakte Oberfläche (kleines Fenster oder Touch-Gerät), siehe COMPACT_UI_QUERY. */
export function isCompactUI(): boolean {
  return compactQuery.matches;
}

export function onCompactUIChange(fn: (compact: boolean) => void): void {
  compactQuery.addEventListener('change', (e) => fn(e.matches));
}
