import type * as THREE from 'three';
import type { FreeAsteroid, FreeAsteroids } from '../asteroids/freeAsteroids';
import { AU_KM, MOON, NAVIGATION, ROCKET, SUN } from '../config/solarSystemData';
import type { ScaleState } from '../core/scale';
import type { Moon } from '../moon/moon';
import type { Planet } from '../planets/planet';
import type { PlanetSystem } from '../planets/planets';
import type { MissionPhase, Rocket } from '../rocket/rocket';
import type { Satellite, SatelliteSystem } from '../satellites/satellites';
import type { Sun } from '../sun/sun';
import { fmt, formatHours, formatKm, formatMinutes, formatPeriod } from '../ui/format';

export type TargetKind = 'sun' | 'planet' | 'moon' | 'asteroid' | 'satellite' | 'rocket';

/** Zeile im Infopanel; eine Funktion als Wert wird laufend aktualisiert. */
export interface InfoRow {
  label: string;
  value: string | (() => string);
}

/** Ein anfliegbares Objekt (Himmelskörper oder Raumfahrzeug). */
export interface FocusTarget {
  id: string;
  name: string;
  kind: TargetKind;
  color: number;
  /** Objekt, dessen Weltposition verfolgt wird. */
  object: THREE.Object3D;
  /** Objekt für das Raycasting (nicht rekursiv geprüft). */
  pickable: THREE.Object3D;
  radius(): number;
  viewDistance(): number;
  info(): InfoRow[];
  /** Optionale Hervorhebung bei Auswahl (Raumfahrzeuge). */
  setHighlighted?(on: boolean): void;
}

export function createFocusTargets(
  sun: Sun,
  planets: PlanetSystem,
  moon: Moon,
  asteroids: FreeAsteroids,
  satellites: SatelliteSystem,
  rocket: Rocket,
  scale: ScaleState,
): FocusTarget[] {
  const targets: FocusTarget[] = [
    {
      id: 'sun',
      name: SUN.name,
      kind: 'sun',
      color: SUN.fallbackColor,
      object: sun.group,
      pickable: sun.mesh,
        radius: () => sun.radius,
      viewDistance: () => sun.radius * NAVIGATION.sunViewFactor,
      info: () => [
        { label: 'Durchmesser', value: formatKm(SUN.info.diameterKm) },
        { label: 'Rotation (Äquator)', value: `${fmt(SUN.rotationPeriodDays, 1)} Tage` },
        { label: 'Achsneigung', value: `${fmt(SUN.axialTiltDeg, 2)}°` },
        { label: 'Oberflächentemperatur', value: `${fmt(SUN.info.surfaceTempK, 0)} K` },
        { label: 'Masse', value: '≈ 333.000 Erdmassen' },
      ],
    },
  ];

  for (const planet of planets.planets) {
    targets.push(planetTarget(planet));
    if (planet.data.id === 'earth') targets.push(moonTarget(moon));
  }
  for (const asteroid of asteroids.asteroids) targets.push(asteroidTarget(asteroid));
  for (const sat of satellites.satellites) targets.push(satelliteTarget(sat));
  targets.push(rocketTarget(rocket, scale));
  return targets;
}

function planetTarget(planet: Planet): FocusTarget {
  const p = planet.data;
  return {
    id: p.id,
    name: p.name,
    kind: 'planet',
    color: p.orbitColor,
    object: planet.root,
    pickable: planet.surface,
    radius: () => planet.radius,
    viewDistance: () => planet.viewDistance,
    info: () => {
      const retro = p.rotationPeriodHours < 0 ? ' (retrograd)' : '';
      return [
        { label: 'Durchmesser', value: formatKm(p.radiusKm * 2) },
        {
          label: 'Abstand zur Sonne',
          value: () => {
            const au = planet.helioAU.length();
            return `${fmt(au, 3)} AE · ${fmt((au * AU_KM) / 1e6, 1)} Mio. km`;
          },
        },
        { label: 'Große Halbachse', value: `${fmt(p.orbit.a, 3)} AE` },
        { label: 'Umlaufzeit', value: formatPeriod(p.orbit.periodDays) },
        { label: 'Tageslänge', value: formatHours(p.dayLengthHours) },
        { label: 'Rotation', value: formatHours(Math.abs(p.rotationPeriodHours)) + retro },
        { label: 'Achsneigung', value: `${fmt(p.axialTiltDeg, 1)}°` },
        { label: 'Monde', value: String(p.moons) },
      ];
    },
  };
}

function moonTarget(moon: Moon): FocusTarget {
  return {
    id: 'moon',
    name: MOON.name,
    kind: 'moon',
    color: MOON.orbitColor,
    object: moon.root,
    pickable: moon.surface,
    radius: () => moon.radius,
    viewDistance: () => moon.radius * 4.5,
    info: () => [
      { label: 'Durchmesser', value: formatKm(MOON.radiusKm * 2) },
      { label: 'Abstand zur Erde', value: () => formatKm(moon.distanceKm) },
      { label: 'Große Halbachse', value: formatKm(MOON.orbit.aKm) },
      { label: 'Umlaufzeit', value: `${fmt(MOON.info.siderealMonthDays, 1)} Tage` },
      { label: 'Tageslänge', value: `${fmt(MOON.info.synodicMonthDays, 1)} Tage (gebunden)` },
      { label: 'Achsneigung', value: `${fmt(MOON.info.axialTiltDeg, 2)}°` },
      { label: 'Monde', value: '0' },
    ],
  };
}

function asteroidTarget(asteroid: FreeAsteroid): FocusTarget {
  const d = asteroid.data;
  return {
    id: d.id,
    name: d.name,
    kind: 'asteroid',
    color: d.color,
    object: asteroid.object,
    pickable: asteroid.pickProxy,
    radius: () => asteroid.radius,
    viewDistance: () => asteroid.radius * 5,
    info: () => [
      { label: 'Typ', value: d.type },
      { label: 'Durchmesser', value: `≈ ${formatKm(d.radiusKm * 2)}` },
      {
        label: 'Abstand zur Sonne',
        value: () => {
          const au = asteroid.helioAU.length();
          return `${fmt(au, 3)} AE · ${fmt((au * AU_KM) / 1e6, 1)} Mio. km`;
        },
      },
      { label: 'Große Halbachse', value: `${fmt(d.orbit.a, 3)} AE` },
      { label: 'Exzentrizität', value: fmt(d.orbit.e, 3) },
      { label: 'Inklination', value: `${fmt(d.orbit.i, 1)}°` },
      { label: 'Umlaufzeit', value: formatPeriod(d.orbit.periodDays) },
    ],
  };
}

function satelliteTarget(sat: Satellite): FocusTarget {
  const d = sat.data;
  const perigee = d.aKm * (1 - d.e) - 6371;
  const apogee = d.aKm * (1 + d.e) - 6371;
  const height = d.e > 0.05 ? `${formatKm(perigee)} – ${formatKm(apogee)}` : `≈ ${formatKm((perigee + apogee) / 2)}`;
  return {
    id: d.id,
    name: d.name,
    kind: 'satellite',
    color: d.color,
    object: sat.object,
    pickable: sat.pickProxy,
    radius: () => sat.radius,
    viewDistance: () => sat.radius * 9,
    info: () => [
      { label: 'Bahn', value: d.orbitType },
      { label: 'Bahnhöhe', value: height },
      { label: 'Aktuelle Höhe', value: () => formatKm(sat.altitudeKm) },
      { label: 'Inklination', value: `${fmt(d.i, 1)}°` },
      { label: 'Exzentrizität', value: fmt(d.e, d.e > 0.05 ? 2 : 4) },
      { label: 'Umlaufzeit', value: formatMinutes(d.periodMin) },
    ],
    setHighlighted: (on) => sat.highlight.set(on),
  };
}

const PHASE_NAMES: Record<MissionPhase, string> = {
  launch: 'Start und Einschuss',
  coast: 'Freiflug zum Mond',
  orbit: 'Im Mondorbit',
};

function rocketTarget(rocket: Rocket, scale: ScaleState): FocusTarget {
  return {
    id: 'rocket',
    name: ROCKET.name,
    kind: 'rocket',
    color: ROCKET.pathColor,
    object: rocket.object,
    pickable: rocket.pickProxy,
    radius: () => rocket.radius,
    viewDistance: () => ROCKET.viewDistance,
    info: () => [
      { label: 'Mission', value: 'Erde → Mond (wiederholt)' },
      { label: 'Phase', value: () => PHASE_NAMES[rocket.phase] },
      { label: 'Transfer', value: () => `${fmt(rocket.progress * 100, 0)} %` },
      { label: 'Abstand zur Erde', value: () => `≈ ${formatKm(scale.geoDistanceToKm(rocket.distanceUnits))}` },
      { label: 'Reale Flugzeit', value: 'ca. 3 Tage' },
    ],
    setHighlighted: (on) => rocket.highlight.set(on),
  };
}
