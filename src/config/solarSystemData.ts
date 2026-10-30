/**
 * Zentrale Konstanten des Sonnensystems.
 *
 * Die Darstellung ist nicht maßstabsgetreu: Radien, Sonnengröße und
 * Abstände werden getrennt komprimiert, damit alle Körper gut erkennbar
 * sind (siehe SCALE). Physikalische Werte (km, AE, Tage) bleiben echt und
 * werden für Bahnberechnung und Infoanzeige genutzt.
 */

// ---------------------------------------------------------------------------
// Grundeinheiten
// ---------------------------------------------------------------------------

/** Kilometer pro Szeneneinheit (Bezug für den Sonnen-Skalierungsfaktor). */
export const KM_PER_UNIT = 1000;

/** Astronomische Einheit in km (IAU 2012). */
export const AU_KM = 149_597_870.7;

/** Julianisches Datum der Epoche J2000.0 (2000-01-01 12:00 TT). */
export const J2000_JD = 2_451_545.0;

/** Julianisches Datum der Unix-Epoche (1970-01-01 00:00 UTC). */
export const UNIX_EPOCH_JD = 2_440_587.5;

/** Schiefe der Ekliptik zur Epoche J2000 in Grad. */
export const OBLIQUITY_J2000_DEG = 23.43928;

// ---------------------------------------------------------------------------
// Maßstab
// ---------------------------------------------------------------------------

/**
 * Darstellungsmaßstab, auf Erkennbarkeit optimiert statt auf exakte
 * Verhältnisse.
 */
export const SCALE = {
  /**
   * Radien: r = earthUnits · (r_km / r_Erde)^exponent. Der kleine Exponent
   * vergrößert kleine Planeten stark; die Reihenfolge der Größen bleibt.
   */
  radius: { earthUnits: 28, exponent: 0.3 },

  /** Sonne: fester eigener Faktor auf den echten Radius, bleibt größter Körper. */
  sunScale: 0.14,

  /**
   * Abstandskompression:
   * r_szene = factor · ln(1 + r_AE / refAU). Monoton, daher bleibt die
   * Reihenfolge erhalten; innere Planeten bekommen mehr Platz.
   */
  distance: { factor: 500, refAU: 0.3 },

  /**
   * Erdnaher Raum (Satelliten, Mond, Rakete), in Erdradien:
   * r_szene = R_Erde,szene · (1 + factor · (r / R_Erde − 1)^exponent).
   * Die Potenz hebt erdnahe Bahnen sichtbar über die Atmosphäre und holt den
   * Mond so nah heran, dass er auch bei engster Venus- bzw. Marsbegegnung
   * (Mittelpunktsabstand 115 bzw. 127 Einheiten) frei bleibt.
   * Ergebnis: ISS ≈ 1,08 R, GPS ≈ 1,40 R, GEO ≈ 1,50 R, Mond ≈ 2,3 R.
   */
  earthSpace: { factor: 0.25, exponent: 0.4 },
} as const;

/**
 * Sichtbare Eigenrotation: bewusst langsamer und unabhängig von der
 * Simulationsgeschwindigkeit. IAU-Rate (Grad/Tag) · factor = Grad pro
 * Echtzeit-Sekunde, begrenzt auf [min, max]. Die Drehrichtung bleibt
 * erhalten (Venus, Uranus retrograd).
 */
export const VISUAL_ROTATION = {
  factor: 0.05,
  minDegPerSec: 2,
  maxDegPerSec: 25,
} as const;

// ---------------------------------------------------------------------------
// Simulationszeit
// ---------------------------------------------------------------------------

export const TIME = {
  /** Geschwindigkeit in simulierten Tagen pro Sekunde. */
  minSpeed: 1,
  maxSpeed: 365.25,
  defaultSpeed: 1,
} as const;

// ---------------------------------------------------------------------------
// Rotationsmodell (IAU WGCCRE): Pol in RA/Dec (J2000, Grad),
// Nullmeridian W = W0 + rate · d (Grad, d = Tage seit J2000).
// Ein negativer rate bedeutet retrograde Rotation (Venus, Uranus).
// ---------------------------------------------------------------------------

export interface RotationModel {
  poleRa: number;
  poleDec: number;
  W0: number;
  rate: number;
}

// ---------------------------------------------------------------------------
// Sonne
// ---------------------------------------------------------------------------

export const SUN = {
  name: 'Sonne',
  radiusKm: 695_700,
  /** Siderische Rotationsperiode am Äquator in Tagen. */
  rotationPeriodDays: 25.38,
  /** Neigung der Rotationsachse gegen die Ekliptik in Grad. */
  axialTiltDeg: 7.25,
  rotation: { poleRa: 286.13, poleDec: 63.87, W0: 84.176, rate: 14.1844 } satisfies RotationModel,
  textureKey: 'sun',
  fallbackColor: 0xffb347,
  /** Farbverstärkung des emissiven Materials (> 1 → überschreitet Bloom-Schwelle). */
  emissiveBoost: 1.6,
  /** Größe des Korona-Sprites relativ zum Sonnenradius. */
  coronaScale: 4.2,
  light: {
    color: 0xfff4e6,
    intensity: 3.0,
  },
  info: {
    diameterKm: 1_391_400,
    massKg: 1.989e30,
    surfaceTempK: 5772,
  },
} as const;

// ---------------------------------------------------------------------------
// Planeten
// ---------------------------------------------------------------------------

/**
 * Kepler-Bahnelemente zur Epoche J2000, bezogen auf Ekliptik und Äquinoktium
 * J2000 (abgeleitet aus JPL "Approximate Positions of the Planets",
 * Standish: ω = ϖ − Ω, M0 = L − ϖ).
 */
export interface OrbitalElements {
  /** Große Halbachse in AE. */
  a: number;
  /** Exzentrizität. */
  e: number;
  /** Inklination in Grad. */
  i: number;
  /** Länge des aufsteigenden Knotens Ω in Grad. */
  node: number;
  /** Argument des Perihels ω in Grad. */
  peri: number;
  /** Mittlere Anomalie zur Epoche J2000 in Grad. */
  M0: number;
  /** Siderische Umlaufzeit in Tagen. */
  periodDays: number;
}

export interface RingData {
  innerKm: number;
  outerKm: number;
  textureKey?: TextureKey;
  color: number;
  opacity: number;
}

export type PlanetId = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface PlanetData {
  id: PlanetId;
  name: string;
  /** Mittlerer Radius in km. */
  radiusKm: number;
  textureKey: TextureKey;
  /** Farben für die prozedurale Ersatztextur. */
  fallback: { color: number; color2: number; banded: boolean };
  orbitColor: number;
  /** Achsneigung gegen die eigene Bahnebene in Grad (Info). */
  axialTiltDeg: number;
  /** Siderische Rotationsperiode in Stunden, negativ = retrograd (Info). */
  rotationPeriodHours: number;
  /** Mittlere Sonnentag-Länge in Stunden (Info). */
  dayLengthHours: number;
  rotation: RotationModel;
  orbit: OrbitalElements;
  /** Anzahl bekannter Monde (Stand 2025). */
  moons: number;
  rings?: RingData;
}

export const PLANETS: readonly PlanetData[] = [
  {
    id: 'mercury',
    name: 'Merkur',
    radiusKm: 2439.7,
    textureKey: 'mercury',
    fallback: { color: 0x9a9693, color2: 0x5e5b59, banded: false },
    orbitColor: 0x9a9693,
    axialTiltDeg: 0.034,
    rotationPeriodHours: 1407.6,
    dayLengthHours: 4222.6,
    rotation: { poleRa: 281.01, poleDec: 61.414, W0: 329.5469, rate: 6.1385025 },
    orbit: { a: 0.38709927, e: 0.20563593, i: 7.00497902, node: 48.33076593, peri: 29.12703035, M0: 174.79252722, periodDays: 87.969 },
    moons: 0,
  },
  {
    id: 'venus',
    name: 'Venus',
    radiusKm: 6051.8,
    textureKey: 'venus',
    fallback: { color: 0xe8c77a, color2: 0xc9a35a, banded: true },
    orbitColor: 0xe8c77a,
    axialTiltDeg: 177.36,
    rotationPeriodHours: -5832.5,
    dayLengthHours: 2802.0,
    rotation: { poleRa: 272.76, poleDec: 67.16, W0: 160.2, rate: -1.4813688 },
    orbit: { a: 0.72333566, e: 0.00677672, i: 3.39467605, node: 76.67984255, peri: 54.92262463, M0: 50.37663232, periodDays: 224.701 },
    moons: 0,
  },
  {
    id: 'earth',
    name: 'Erde',
    radiusKm: 6371.0,
    textureKey: 'earthDay',
    fallback: { color: 0x2a5fa8, color2: 0x3f7d3a, banded: false },
    orbitColor: 0x4f8fe0,
    axialTiltDeg: 23.44,
    rotationPeriodHours: 23.9345,
    dayLengthHours: 24.0,
    rotation: { poleRa: 0, poleDec: 90, W0: 190.147, rate: 360.9856235 },
    orbit: { a: 1.00000261, e: 0.01671123, i: -0.00001531, node: 0, peri: 102.93768193, M0: -2.47311027, periodDays: 365.256 },
    moons: 1,
  },
  {
    id: 'mars',
    name: 'Mars',
    radiusKm: 3389.5,
    textureKey: 'mars',
    fallback: { color: 0xc1440e, color2: 0x7a2f14, banded: false },
    orbitColor: 0xd0603a,
    axialTiltDeg: 25.19,
    rotationPeriodHours: 24.6229,
    dayLengthHours: 24.6597,
    rotation: { poleRa: 317.68143, poleDec: 52.8865, W0: 176.63, rate: 350.89198226 },
    orbit: { a: 1.52371034, e: 0.0933941, i: 1.84969142, node: 49.55953891, peri: -73.5031685, M0: 19.39019754, periodDays: 686.98 },
    moons: 2,
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    radiusKm: 69_911,
    textureKey: 'jupiter',
    fallback: { color: 0xd8b48a, color2: 0x9c6e48, banded: true },
    orbitColor: 0xd8b48a,
    axialTiltDeg: 3.13,
    rotationPeriodHours: 9.925,
    dayLengthHours: 9.9259,
    rotation: { poleRa: 268.056595, poleDec: 64.495303, W0: 284.95, rate: 870.536 },
    orbit: { a: 5.202887, e: 0.04838624, i: 1.30439695, node: 100.47390909, peri: -85.74542926, M0: 19.66796068, periodDays: 4332.59 },
    moons: 97,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    radiusKm: 58_232,
    textureKey: 'saturn',
    fallback: { color: 0xe3cf9c, color2: 0xb39563, banded: true },
    orbitColor: 0xe3cf9c,
    axialTiltDeg: 26.73,
    rotationPeriodHours: 10.656,
    dayLengthHours: 10.656,
    rotation: { poleRa: 40.589, poleDec: 83.537, W0: 38.9, rate: 810.7939024 },
    orbit: { a: 9.53667594, e: 0.05386179, i: 2.48599187, node: 113.66242448, peri: -21.06354617, M0: -42.64463408, periodDays: 10_759.22 },
    moons: 274,
    rings: { innerKm: 74_500, outerKm: 140_220, textureKey: 'saturnRing', color: 0xffffff, opacity: 1 },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    radiusKm: 25_362,
    textureKey: 'uranus',
    fallback: { color: 0x9fd8e0, color2: 0x7fbcc6, banded: true },
    orbitColor: 0x9fd8e0,
    axialTiltDeg: 97.77,
    rotationPeriodHours: -17.24,
    dayLengthHours: 17.24,
    rotation: { poleRa: 257.311, poleDec: -15.175, W0: 203.81, rate: -501.1600928 },
    orbit: { a: 19.18916464, e: 0.04725744, i: 0.77263783, node: 74.01692503, peri: 96.93735127, M0: 142.28382821, periodDays: 30_685.4 },
    moons: 29,
    rings: { innerKm: 38_000, outerKm: 51_150, color: 0xb8c4c8, opacity: 0.35 },
  },
  {
    id: 'neptune',
    name: 'Neptun',
    radiusKm: 24_622,
    textureKey: 'neptune',
    fallback: { color: 0x3f62d6, color2: 0x26409a, banded: true },
    orbitColor: 0x5a7ee8,
    axialTiltDeg: 28.32,
    rotationPeriodHours: 16.11,
    dayLengthHours: 16.11,
    rotation: { poleRa: 299.36, poleDec: 43.46, W0: 249.978, rate: 541.1397757 },
    orbit: { a: 30.06992276, e: 0.00859048, i: 1.77004347, node: 131.78422574, peri: -86.81946347, M0: -100.08479196, periodDays: 60_189 },
    moons: 16,
  },
];

// ---------------------------------------------------------------------------
// Erdmond
// ---------------------------------------------------------------------------

/**
 * Mittlere Mondbahn (Meeus, „Astronomical Algorithms“, Kap. 47, ohne
 * Störungsterme): Ekliptik des Datums, Knoten und Perigäum präzedieren
 * linear. Genauigkeit einige Grad – Mondphase und Stellung stimmen grob.
 */
export const MOON = {
  name: 'Mond',
  radiusKm: 1737.4,
  textureKey: 'moon',
  fallback: { color: 0x9c9a96, color2: 0x5f5d5a },
  orbitColor: 0xb8b8c0,
  /**
   * Der Mond wird nicht über die Planeten-Formel komprimiert, sondern im
   * echten Größenverhältnis zur (dargestellten) Erde gezeigt: r = R_Erde · 0,273.
   */
  sizeRelativeToEarth: true,
  orbit: {
    aKm: 384_400,
    e: 0.0549,
    i: 5.145,
    /** Länge des aufsteigenden Knotens Ω = node0 + nodeRate · d (Grad). */
    node0: 125.0445,
    nodeRate: -0.0529538,
    /** Länge des Perigäums ϖ = peri0 + periRate · d (Grad), ω = ϖ − Ω. */
    peri0: 83.3532,
    periRate: 0.1114041,
    /** Mittlere Anomalie M = M0 + 360° · d / anomalisticMonth. */
    M0: 134.9634,
    anomalisticMonthDays: 27.554_550,
  },
  info: {
    siderealMonthDays: 27.321_661,
    synodicMonthDays: 29.530_589,
    /** Achsneigung gegen die eigene Bahnebene in Grad. */
    axialTiltDeg: 6.68,
  },
} as const;

// ---------------------------------------------------------------------------
// Satelliten (Bahnelemente bezogen auf den Erdäquator J2000)
// ---------------------------------------------------------------------------

export type SatelliteModel = 'iss' | 'panels' | 'dish';

export interface SatelliteData {
  id: string;
  name: string;
  /** Bahntyp für die Infoanzeige. */
  orbitType: string;
  model: SatelliteModel;
  color: number;
  /** Große Halbachse in km. */
  aKm: number;
  e: number;
  /** Inklination gegen den Erdäquator in Grad. */
  i: number;
  /** Länge des aufsteigenden Knotens in der Äquatorebene in Grad (Bezug: lokale X-Achse des Erdrahmens). */
  node: number;
  /** Argument des Perigäums in Grad. */
  peri: number;
  /** Mittlere Anomalie zum Start in Grad. */
  M0: number;
  /** Umlaufzeit in Minuten (echte Werte, relativ zueinander korrekt). */
  periodMin: number;
  /**
   * Sonnensynchron: Der Knoten folgt der Sonne, sodass die Bahnebene einen
   * festen Winkel zur Sonnenrichtung behält (Ortszeit des aufsteigenden
   * Knotens in Stunden). Ersetzt `node`.
   */
  ltanHours?: number;
}

export const SATELLITES = {
  /**
   * Sichtbare Bahngeschwindigkeit: simulierte Minuten pro Echtzeit-Sekunde,
   * unabhängig vom Geschwindigkeitsregler (wie die Eigenrotation).
   * ISS ≈ 9 s pro Umlauf, GEO ≈ 2,4 min.
   */
  minutesPerSecond: 10,
  /** Größe der Modelle in Szeneneinheiten (Spannweite) aus der Nähe. */
  modelSize: 0.7,
  /**
   * Aus größerer Entfernung wachsen die Modelle mit, damit sie in der
   * Erdansicht erkennbar bleiben: Spannweite = Kameraabstand · apparentSize,
   * begrenzt auf [modelSize, maxSize].
   */
  apparentSize: 0.03,
  maxSize: 4,
  /** Radius der unsichtbaren Klickfläche, bezogen auf modelSize = 1. */
  pickRadius: 1.7,
  orbitSegments: 256,
  orbitOpacity: 0.5,
  list: [
    {
      id: 'iss',
      name: 'ISS',
      orbitType: 'LEO, bemannt',
      model: 'iss',
      color: 0xf2f2f2,
      aKm: 6_788,
      e: 0.0005,
      i: 51.64,
      node: 40,
      peri: 0,
      M0: 0,
      periodMin: 92.9,
    },
    {
      id: 'hubble',
      name: 'Hubble',
      orbitType: 'LEO, Weltraumteleskop',
      model: 'panels',
      color: 0xcfd3d8,
      aKm: 6_901,
      e: 0.0002,
      i: 28.47,
      node: 210,
      peri: 0,
      M0: 120,
      periodMin: 95.1,
    },
    {
      id: 'sentinel',
      name: 'Sentinel-2',
      orbitType: 'Sonnensynchron (polar)',
      model: 'panels',
      color: 0xd9b45a,
      aKm: 7_164,
      e: 0.0001,
      i: 98.57,
      node: 0,
      peri: 0,
      M0: 240,
      periodMin: 100.6,
      ltanHours: 22.5,
    },
    {
      id: 'gps',
      name: 'GPS',
      orbitType: 'MEO, Navigation',
      model: 'panels',
      color: 0xe0c070,
      aKm: 26_560,
      e: 0.01,
      i: 55,
      node: 120,
      peri: 0,
      M0: 60,
      periodMin: 717.97,
    },
    {
      id: 'geo',
      name: 'Meteosat',
      orbitType: 'Geostationär (GEO)',
      model: 'dish',
      color: 0xd8dde4,
      aKm: 42_164,
      e: 0,
      i: 0,
      node: 0,
      peri: 0,
      M0: 300,
      periodMin: 1436.07,
    },
    {
      id: 'molniya',
      name: 'Molniya',
      orbitType: 'Molniya (stark elliptisch)',
      model: 'dish',
      color: 0xc9a46a,
      aKm: 26_554,
      e: 0.72,
      i: 63.4,
      node: 300,
      /** 270° → Apogäum über der Nordhalbkugel. */
      peri: 270,
      M0: 180,
      periodMin: 717.7,
    },
  ] satisfies readonly SatelliteData[],
} as const;

// ---------------------------------------------------------------------------
// Rakete Erde → Mond
// ---------------------------------------------------------------------------

export const ROCKET = {
  name: 'Rakete',
  /** Länge des Modells in Szeneneinheiten. */
  length: 1.3,
  /** Dauer des Transfers in Echtzeit-Sekunden. */
  flightSeconds: 32,
  /** Verweildauer im Mondorbit, danach startet die Mission neu. */
  lunarOrbitSeconds: 14,
  /** Anteil des Flugs mit Beschleunigung (Start + Einschuss); danach Freiflug. */
  burnFraction: 0.14,
  /** Radius des Mondorbits als Vielfaches des (dargestellten) Mondradius. */
  lunarOrbitFactor: 1.6,
  /** Punkte der Flugbahn-Linie. */
  pathSegments: 120,
  pathColor: 0xff9a4a,
  pathOpacity: 0.35,
  flownOpacity: 0.9,
  exhaust: {
    count: 420,
    /** Lebensdauer der Partikel in Sekunden. */
    life: 0.9,
    /** Partikel pro Sekunde bei vollem Schub. */
    rate: 460,
    /** Austrittsgeschwindigkeit in Szeneneinheiten pro Sekunde. */
    speed: 2.6,
    spread: 0.55,
    size: 0.38,
  },
  viewDistance: 9,
} as const;

export const PLANET_RENDER = {
  /** LOD-Stufen: [Breiten-, Höhensegmente] der Kugel. */
  lodSegments: [
    [64, 32],
    [32, 16],
    [12, 8],
  ] as const,
  /** Umschaltdistanzen der LOD-Stufen als Vielfaches des Körperradius. */
  lodDistanceFactors: [0, 60, 250] as const,
  /** Punkte pro Orbitlinie. */
  orbitSegments: 512,
  orbitOpacity: 0.4,
  earth: {
    cloudScale: 1.01,
    atmosphereScale: 1.025,
    atmosphereColor: 0x5fa8ff,
    atmosphereIntensity: 1.3,
    nightLightsColor: 0xffd8a0,
    nightLightsIntensity: 1.6,
    /** Zusätzliche Wolkendrift relativ zur Erdrotation in Grad pro Sekunde. */
    cloudDriftDegPerSec: 1.5,
  },
} as const;

// ---------------------------------------------------------------------------
// Sternenhimmel
// ---------------------------------------------------------------------------

export const STARFIELD = {
  /** Anzahl der Punkt-Sterne. */
  count: 9000,
  /** Radius der Sternsphäre (folgt der Kamera, daher beliebig, < far). */
  radius: 90_000,
  /** Radius der Milchstraßen-Skysphere. */
  skyRadius: 100_000,
  /** Helligkeit der Skysphere-Textur (0–1). */
  skyBrightness: 0.7,
  /** Neigung der galaktischen Ebene gegen die Ekliptik in Grad. */
  galacticTiltDeg: 60.2,
  /** Punktgröße in Pixeln (min/max, vor Pixel-Ratio). */
  pointSize: { min: 1.4, max: 4.0 },
  /** Temperaturbereich der Sterne in Kelvin. */
  temperatureK: { min: 2800, max: 30000 },
} as const;

// ---------------------------------------------------------------------------
// Rendering / Kamera
// ---------------------------------------------------------------------------

export const RENDER = {
  maxPixelRatio: 2,
  /** MSAA-Samples der Composer-Render-Targets (0 = aus). */
  msaaSamples: 4,
  toneMappingExposure: 1.0,
  ambientLight: { color: 0x334466, intensity: 0.12 },
  bloom: {
    strength: 1.1,
    radius: 0.55,
    threshold: 0.82,
  },
} as const;

export const CAMERA = {
  fov: 50,
  near: 0.01,
  far: 1e6,
  /** Kameraposition der Gesamtansicht. */
  overviewPosition: [0, 1300, 2700] as const,
  minDistance: 0.05,
  /** Begrenzt das Hinauszoomen: knapp mehr als nötig für das ganze System. */
  maxDistance: 5000,
} as const;

export const NAVIGATION = {
  /** Dauer eines Kameraflugs in Sekunden (wächst mit der Strecke). */
  flightDuration: { min: 1.2, max: 2.6 },
  /** Bogenhöhe des Flugs relativ zur Flugstrecke (verhindert Flug durch die Sonne). */
  arcFactor: 0.2,
  /** Freies Fliegen: Geschwindigkeit als Anteil des Zielabstands pro Sekunde. */
  freeFlySpeed: 0.8,
  freeFlyMinSpeed: 40,
  /** Multiplikator mit gedrückter Umschalttaste. */
  freeFlyBoost: 3,
  /** Mindestabstand zum fokussierten Körper als Vielfaches seines Radius. */
  minDistanceFactor: 1.4,
  /** Kameraabstand zur Sonne beim Fokus als Vielfaches ihres Radius. */
  sunViewFactor: 3.5,
  /** Klick statt Ziehen: maximale Mausbewegung in Pixeln. */
  clickTolerancePx: 5,
} as const;

// ---------------------------------------------------------------------------
// Texturen (Solar System Scope, CC BY 4.0) – Dateien unter public/textures/
// ---------------------------------------------------------------------------

export interface TextureSpec {
  file: string;
  /** Ausweich-Dateien, falls `file` fehlt (in dieser Reihenfolge). */
  alt?: readonly string[];
  /** Farbtextur → sRGB; Daten-/Alpha-Textur → linear. */
  srgb: boolean;
}

export const TEXTURES = {
  stars: { file: '2k_stars_milky_way.jpg', alt: ['2k_stars.jpg'], srgb: true },
  sun: { file: '2k_sun.jpg', srgb: true },
  mercury: { file: '2k_mercury.jpg', srgb: true },
  venus: { file: '2k_venus_atmosphere.jpg', srgb: true },
  earthDay: { file: '2k_earth_daymap.jpg', srgb: true },
  earthNight: { file: '2k_earth_nightmap.jpg', srgb: true },
  earthClouds: { file: '2k_earth_clouds.jpg', srgb: false },
  moon: { file: '2k_moon.jpg', srgb: true },
  mars: { file: '2k_mars.jpg', srgb: true },
  jupiter: { file: '2k_jupiter.jpg', srgb: true },
  saturn: { file: '2k_saturn.jpg', srgb: true },
  saturnRing: { file: '2k_saturn_ring_alpha.png', srgb: true },
  uranus: { file: '2k_uranus.jpg', srgb: true },
  neptune: { file: '2k_neptune.jpg', srgb: true },
} as const satisfies Record<string, TextureSpec>;

export type TextureKey = keyof typeof TEXTURES;
