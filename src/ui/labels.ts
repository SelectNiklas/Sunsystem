import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/** Namensschild über einem Körper (DOM-Element, gerendert vom CSS2DRenderer). */
export function createLabel(text: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = 'body-label';
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.center.set(0.5, 1);
  return label;
}
