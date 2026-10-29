import * as THREE from 'three';
import { createCanvasTexture } from '../core/textures';

/*
 * Prozedurale Ersatztexturen, solange die Solar-System-Scope-Dateien fehlen.
 */

const W = 1024;
const H = 512;

function hex(c: number, alpha = 1): string {
  const col = new THREE.Color(c);
  return `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${alpha})`;
}

/** Gesteinsplanet: Grundfarbe mit Flecken/Kratern. */
export function rockyTexture(color: number, color2: number): THREE.Texture {
  return createCanvasTexture(W, H, (ctx, w, h) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const r = 2 + Math.random() * Math.random() * 40;
      ctx.fillStyle = hex(Math.random() < 0.6 ? color2 : 0xffffff, 0.06 + Math.random() * 0.12);
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Gasplanet: horizontale Bänder zwischen zwei Farben. */
export function bandedTexture(color: number, color2: number): THREE.Texture {
  return createCanvasTexture(W, H, (ctx, w, h) => {
    const a = new THREE.Color(color);
    const b = new THREE.Color(color2);
    const c = new THREE.Color();
    let y = 0;
    while (y < h) {
      const bandH = 4 + Math.random() * 26;
      c.copy(a).lerp(b, Math.random());
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(0, y, w, bandH + 1);
      y += bandH;
    }
    // Turbulente Wirbel
    for (let i = 0; i < 600; i++) {
      const r = 3 + Math.random() * 18;
      ctx.fillStyle = hex(Math.random() < 0.5 ? color : color2, 0.15);
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, r * 2.5, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Erde Tag: Ozeane mit grob verteilten Kontinenten und Polkappen. */
export function earthDayTexture(): THREE.Texture {
  return createCanvasTexture(W, H, (ctx, w, h) => {
    ctx.fillStyle = '#1d4f8c';
    ctx.fillRect(0, 0, w, h);
    drawContinents(ctx, w, h, (alpha) => (Math.random() < 0.5 ? `rgba(70,110,50,${alpha})` : `rgba(150,130,80,${alpha})`));
    ctx.fillStyle = 'rgba(240,245,250,0.95)';
    ctx.fillRect(0, 0, w, h * 0.05);
    ctx.fillRect(0, h * 0.95, w, h * 0.05);
  });
}

/** Erde Nacht: Lichtpunkte auf den Kontinenten. */
export function earthNightTexture(): THREE.Texture {
  return createCanvasTexture(W, H, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    drawContinents(ctx, w, h, () => 'rgba(0,0,0,0)', (x, y) => {
      ctx.fillStyle = `rgba(255,${190 + Math.random() * 50},120,${0.3 + Math.random() * 0.7})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    });
  });
}

/** Wolken: weiß auf schwarz, wird als Alpha-Map genutzt. */
export function earthCloudTexture(): THREE.Texture {
  return createCanvasTexture(
    W,
    H,
    (ctx, w, h) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      // Lockere, horizontal gestreckte Wolkenfelder (Gradient im gestreckten Raum)
      for (let i = 0; i < 450; i++) {
        const x = Math.random() * w;
        const y = h / 2 + (Math.random() - 0.5) * h * 0.95;
        const r = 6 + Math.random() * 26;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(2.2, 0.7);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
    },
    false,
  );
}

/** Ringtextur als 1D-Streifen (u = radial), Bänder mit Alpha. */
export function ringTexture(color: number, gaps: boolean): THREE.Texture {
  return createCanvasTexture(1024, 4, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const t = x / w;
      let alpha = gaps
        ? 0.25 + 0.6 * Math.abs(Math.sin(t * 40 + Math.sin(t * 13) * 2)) * (Math.random() * 0.3 + 0.7)
        : Math.random() < 0.06 ? 0.9 : 0.04; // Uranus: wenige schmale Ringe
      if (gaps && t > 0.62 && t < 0.67) alpha *= 0.08; // Cassini-Teilung
      ctx.fillStyle = hex(color, alpha);
      ctx.fillRect(x, 0, 1, h);
    }
  });
}

/** Zeichnet zufällige, zusammenhängende Landmassen (deterministisch genug). */
function drawContinents(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fill: (alpha: number) => string,
  dot?: (x: number, y: number) => void,
): void {
  const centers = [
    [0.22, 0.32], [0.28, 0.62], [0.52, 0.3], [0.55, 0.58], [0.72, 0.35], [0.82, 0.68], [0.12, 0.45],
  ];
  // Fester Zufallsstrom, damit Tag- und Nachttextur dieselben Kontinente haben
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [cx, cy] of centers) {
    for (let i = 0; i < 160; i++) {
      const x = (cx + (rand() - 0.5) * 0.16) * w;
      const y = (cy + (rand() - 0.5) * 0.2) * h;
      const r = 6 + rand() * 22;
      ctx.fillStyle = fill(0.85);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // Math.random statt rand(): der feste Strom muss für Tag/Nacht gleich bleiben
      if (dot) for (let k = 0; k < 6; k++) dot(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r * 2);
    }
  }
}
