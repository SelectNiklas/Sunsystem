import * as THREE from 'three';

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32), Werte in [0, 1). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _v = new THREE.Vector3();

/**
 * Unregelmäßiger Low-Poly-Gesteinsbrocken mit Radius ≈ 1. Die Verformung
 * hängt nur von der Richtung des Eckpunkts ab, daher bleiben die Kanten der
 * nicht indizierten Ikosaeder-Geometrie geschlossen. Flächennormalen ergeben
 * den kantigen Look.
 *
 * @param elongation   Streckung entlang X (1 = rundlich)
 * @param irregularity Stärke der Verformung (0 = Kugel, 1 = kantiger Brocken)
 */
export function createRockGeometry(seed: number, detail = 1, elongation = 1, irregularity = 1): THREE.BufferGeometry {
  const random = seededRandom(seed);
  // Summe der Amplituden < 0,4: die Oberfläche bleibt sternförmig, keine umgeklappten Flächen.
  const waves = Array.from({ length: 4 }, () => ({
    dir: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
    freq: 1 + random() * 1.5,
    phase: random() * Math.PI * 2,
    amp: (0.04 + random() * 0.06) * irregularity,
  }));

  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    for (const w of waves) r += w.amp * Math.sin(_v.dot(w.dir) * w.freq * Math.PI + w.phase);
    _v.multiplyScalar(r);
    pos.setXYZ(i, _v.x * elongation, _v.y, _v.z);
  }
  // Volumengleich zur Kugel mit Radius 1 (mittlerer Radius bleibt ≈ 1).
  const k = 1 / Math.cbrt(elongation);
  geometry.scale(k, k, k);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
