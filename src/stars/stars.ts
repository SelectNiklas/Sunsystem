import * as THREE from 'three';
import { STARFIELD } from '../config/solarSystemData';
import { createCanvasTexture, type TextureSet } from '../core/textures';

/**
 * Sternenhimmel: Milchstraßen-Skysphere + Points-Sternfeld.
 * Beides hängt an einer Gruppe, die jedem Frame der Kamera folgt, damit der
 * Himmel unabhängig vom Maßstab immer "unendlich weit" weg wirkt. Gezeichnet
 * wird ohne Tiefentest als Erstes (renderOrder), alles andere liegt davor.
 */
export class Starfield {
  readonly group = new THREE.Group();
  private readonly pointsMaterial: THREE.ShaderMaterial;

  constructor(textures: TextureSet, pixelRatio: number) {
    this.group.name = 'Sternenhimmel';
    // Galaktische Ebene ist ~60° gegen die Ekliptik geneigt.
    this.group.rotation.x = THREE.MathUtils.degToRad(STARFIELD.galacticTiltDeg);

    this.group.add(this.createSkySphere(textures.get('stars')));

    this.pointsMaterial = createStarMaterial(pixelRatio);
    this.group.add(this.createPoints());
  }

  /** Muss nach Kamerabewegung aufgerufen werden. */
  update(camera: THREE.Camera): void {
    this.group.position.copy(camera.position);
  }

  setPixelRatio(pixelRatio: number): void {
    this.pointsMaterial.uniforms.uPixelRatio.value = pixelRatio;
  }

  private createSkySphere(texture: THREE.Texture | undefined): THREE.Mesh {
    const map = texture ?? createMilkyWayFallback();
    const b = STARFIELD.skyBrightness;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(STARFIELD.skyRadius, 64, 32),
      new THREE.MeshBasicMaterial({
        map,
        color: new THREE.Color(b, b, b),
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.name = 'Milchstraße';
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    return mesh;
  }

  private createPoints(): THREE.Points {
    const { count, radius, pointSize, temperatureK } = STARFIELD;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Gleichverteilt auf der Kugeloberfläche
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = radius * s * Math.cos(phi);
      positions[i * 3 + 1] = radius * u;
      positions[i * 3 + 2] = radius * s * Math.sin(phi);

      // Kühle Sterne sind deutlich häufiger als heiße
      const t = temperatureK.min + (temperatureK.max - temperatureK.min) * Math.pow(Math.random(), 3.5);
      kelvinToColor(t, color);

      // Helligkeitsverteilung: wenige helle, viele schwache Sterne
      const brightness = 0.4 + 0.6 * Math.pow(Math.random(), 3);
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
      sizes[i] = pointSize.min + (pointSize.max - pointSize.min) * Math.pow(brightness, 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const points = new THREE.Points(geometry, this.pointsMaterial);
    points.name = 'Sternfeld';
    points.renderOrder = -99;
    points.frustumCulled = false;
    return points;
  }
}

function createStarMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a, 1.0);
      }
    `,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * Näherung der Schwarzkörperfarbe (nach Tanner Helland), Ergebnis linear.
 */
function kelvinToColor(kelvin: number, target: THREE.Color): THREE.Color {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const clamp = (v: number) => THREE.MathUtils.clamp(v, 0, 255) / 255;
  return target.setRGB(clamp(r), clamp(g), clamp(b), THREE.SRGBColorSpace);
}

/** Prozedurales Milchstraßenband, falls die Textur fehlt. */
function createMilkyWayFallback(): THREE.Texture {
  return createCanvasTexture(2048, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#000003';
    ctx.fillRect(0, 0, w, h);

    // Diffuses Band entlang des Äquators der Textur
    const band = ctx.createLinearGradient(0, 0, 0, h);
    band.addColorStop(0.0, 'rgba(0,0,0,0)');
    band.addColorStop(0.4, 'rgba(60,55,80,0.18)');
    band.addColorStop(0.5, 'rgba(140,120,110,0.35)');
    band.addColorStop(0.6, 'rgba(60,55,80,0.18)');
    band.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h);

    // Wolkige Struktur und Staubbahnen
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * w;
      const y = h / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * h * 0.12;
      const r = 4 + Math.random() * 40;
      const dark = Math.random() < 0.25;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, dark ? 'rgba(0,0,0,0.25)' : 'rgba(200,180,160,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Feine Hintergrundsterne
    for (let i = 0; i < 6000; i++) {
      const y = h / 2 + (Math.random() - 0.5) * h * (Math.random() < 0.6 ? 0.3 : 1);
      const a = Math.random() * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(Math.random() * w, y, 1, 1);
    }
  });
}
