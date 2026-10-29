# Sonnensystem 3D

Interaktives 3D-Sonnensystem mit Vite, TypeScript und Three.js.

> Stand: **Etappe 3** (Navigation: Kameraflug, Verfolgen, Planetenliste, Infopanel)

## Bedienung

| Eingabe                       | Wirkung                                         |
| ----------------------------- | ----------------------------------------------- |
| Klick auf Körper oder Label   | Kamera fliegt hin und folgt ihm, Infopanel      |
| Planetenliste links           | Körper direkt anspringen                        |
| Linke Maustaste ziehen        | Drehen (auch beim Verfolgen)                    |
| Mausrad                       | Zoomen                                          |
| Rechte Maustaste ziehen       | Verschieben                                     |
| W/A/S/D oder Pfeiltasten      | Frei fliegen (beendet das Verfolgen)            |
| Q / E                         | Runter / hoch fliegen                           |
| Shift (beim Fliegen)          | Schneller                                       |
| ESC                           | Zurück zur Gesamtansicht                        |
| Leertaste                     | Pause / Weiter                                  |
| Panel oben rechts           | Zeit, Geschwindigkeit, Orbitlinien, Beschriftungen |

## Maßstab

Die Darstellung ist bewusst **nicht maßstabsgetreu**, sondern auf Erkennbarkeit optimiert:

- **Radien:** `r = 28 · (r_km / r_Erde)^0.3`. Kleine Planeten werden stark vergrößert, die Reihenfolge der Größen bleibt erhalten.
- **Sonne:** fester eigener Faktor (`sunScale` = 0,14 des echten Radius), bleibt der größte Körper.
- **Abstände:** `r = 500 · ln(1 + r_AE / 0,3)`. Die Reihenfolge bleibt erhalten, innere Planeten bekommen mehr Platz.
Alle Faktoren stehen in `src/config/solarSystemData.ts` (`SCALE`).

## Bahnen und Rotation

- Kepler-Bahnelemente J2000 (JPL, Standish), Kepler-Gleichung per Newton-Iteration gelöst. Start ist das aktuelle Datum.
- Achsorientierung nach dem IAU-Modell (Pol in RA/Dec). Die Eigenrotation ist vereinfacht: langsamer, in Echtzeit und unabhängig vom Geschwindigkeitsregler (`VISUAL_ROTATION`). Die Drehrichtung stimmt weiterhin (Venus und Uranus retrograd).

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 20.19 (LTS empfohlen)

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

## Texturen

Die Texturen stammen von [Solar System Scope](https://www.solarsystemscope.com/textures/)
und stehen unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Sie sind **nicht** im Repository enthalten. Lade die folgenden Dateien (2K-Variante)
herunter und lege sie unter `public/textures/` ab:

| Datei                       | Verwendung                 |
| --------------------------- | -------------------------- |
| `2k_stars_milky_way.jpg`    | Milchstraßen-Skysphere (ersatzweise `2k_stars.jpg`) |
| `2k_sun.jpg`                | Sonne                      |
| `2k_mercury.jpg`            | Merkur                     |
| `2k_venus_atmosphere.jpg`   | Venus                      |
| `2k_earth_daymap.jpg`       | Erde (Tag)                 |
| `2k_earth_nightmap.jpg`     | Erde (Nacht, Stadtlichter) |
| `2k_earth_clouds.jpg`       | Erde (Wolkenschicht)       |
| `2k_moon.jpg`               | Mond                       |
| `2k_mars.jpg`               | Mars                       |
| `2k_jupiter.jpg`            | Jupiter                    |
| `2k_saturn.jpg`             | Saturn                     |
| `2k_saturn_ring_alpha.png`  | Saturnringe                |
| `2k_uranus.jpg`             | Uranus                     |
| `2k_neptune.jpg`            | Neptun                     |

Fehlt eine Datei, nutzt die Anwendung automatisch prozedurale Fallbacks
(Farben/Canvas-Texturen). In der Browser-Konsole wird aufgelistet, welche Dateien fehlen.

## Projektstruktur

```
src/
  config/solarSystemData.ts   Alle Konstanten (Radien, Bahnen, Maßstab, Rendering)
  core/sceneContext.ts        Renderer, Kamera, OrbitControls, EffectComposer + Bloom
  core/textures.ts            Textur-Loader mit Fortschritt und Fallback-Helfer
  core/astro.ts               Kepler-Löser, Bahnorientierung, IAU-Rotation, Datum
  core/scale.ts               Darstellungsmaßstab (Radien, Abstände, Sonnengröße)
  core/simClock.ts            Simulationsuhr
  sun/sun.ts                  Sonne (emissiv, Korona, PointLight)
  planets/                    Planeten, Erde (Tag/Nacht, Wolken, Atmosphäre), Ringe, Orbitlinien
  navigation/                 Fokusziele, Kameraflug/Verfolgen/freies Fliegen, Picking
  ui/controlPanel.ts          Steuerungspanel (Zeit, Ansicht)
  ui/planetList.ts            Planetenliste
  ui/infoPanel.ts             Infopanel mit Kerndaten
  ui/tooltip.ts, ui/labels.ts Hover-Name und Beschriftungen
  stars/stars.ts              Milchstraßen-Skysphere + Points-Sternfeld
  stats/statsBar.ts           Leistungsanzeige (FPS, Draw Calls, Speicher …)
  ui/loadingScreen.ts         Ladebildschirm
  main.ts                     Einstiegspunkt, Render-Loop
```
