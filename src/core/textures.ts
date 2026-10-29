import * as THREE from 'three';
import { TEXTURES, type TextureKey, type TextureSpec } from '../config/solarSystemData';

export type TextureSet = ReadonlyMap<TextureKey, THREE.Texture>;

/**
 * Lädt alle Texturen aus public/textures/. Fehlende Dateien werden nicht als
 * Fehler behandelt: Die Map enthält dann keinen Eintrag, und die Module
 * nutzen ihre prozeduralen Fallbacks.
 */
export async function loadTextures(
  renderer: THREE.WebGLRenderer,
  onProgress: (fraction: number, label: string) => void,
): Promise<TextureSet> {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const entries = Object.entries(TEXTURES) as [TextureKey, TextureSpec][];
  const result = new Map<TextureKey, THREE.Texture>();
  const missing: string[] = [];
  let done = 0;

  onProgress(0, 'Lade Texturen …');

  await Promise.all(
    entries.map(async ([key, spec]) => {
      for (const file of [spec.file, ...(spec.alt ?? [])]) {
        try {
          const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/${file}`);
          tex.colorSpace = spec.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.anisotropy = anisotropy;
          result.set(key, tex);
          break;
        } catch {
          // nächste Ausweich-Datei versuchen
        }
      }
      if (!result.has(key)) missing.push(spec.file);
      done++;
      onProgress(done / entries.length, `Textur ${done}/${entries.length}: ${spec.file}`);
    }),
  );

  if (missing.length > 0) {
    console.info(
      `[textures] ${missing.length} Textur(en) fehlen, prozedurale Fallbacks aktiv (siehe README):\n  ` +
        missing.join('\n  '),
    );
  }
  return result;
}

/** Erzeugt eine CanvasTexture; `draw` zeichnet in den 2D-Kontext. */
export function createCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}
