# Sonnensystem 3D

Interaktives 3D-Sonnensystem mit Vite, TypeScript und Three.js.

> Stand: **Etappe 4** (Erdmond, Satelliten, Rakete Erde → Mond)

## Bedienung

| Eingabe                       | Wirkung                                         |
| ----------------------------- | ----------------------------------------------- |
| Maus über Objekt              | Name wird eingeblendet                          |
| Klick auf Objekt              | Kamera fliegt hin und folgt ihm, Infopanel      |
| Liste links                   | Himmelskörper, Satelliten und Rakete anspringen |
| Linke Maustaste ziehen        | Drehen (auch beim Verfolgen)                    |
| Mausrad                       | Zoomen                                          |
| Rechte Maustaste ziehen       | Verschieben                                     |
| W/A/S/D oder Pfeiltasten      | Frei fliegen (beendet das Verfolgen)            |
| Q / E                         | Runter / hoch fliegen                           |
| Shift (beim Fliegen)          | Schneller                                       |
| ESC                           | Zurück zur Gesamtansicht                        |
| Leertaste                     | Pause / Weiter                                  |
| Panel oben rechts             | Zeit, Geschwindigkeit, Orbitlinien              |

## Maßstab

Die Darstellung ist bewusst **nicht maßstabsgetreu**, sondern auf Erkennbarkeit optimiert:

- **Radien:** `r = 28 · (r_km / r_Erde)^0.3`. Kleine Planeten werden stark vergrößert, die Reihenfolge der Größen bleibt erhalten.
- **Sonne:** fester eigener Faktor (`sunScale` = 0,14 des echten Radius), bleibt der größte Körper.
- **Abstände:** `r = 500 · ln(1 + r_AE / 0,3)`. Die Reihenfolge bleibt erhalten, innere Planeten bekommen mehr Platz.
- **Erdnaher Raum** (Satelliten, Mond, Rakete): `r = R_Erde · (1 + 0,25 · (r / R_Erde − 1)^0,4)`.
  Erdnahe Bahnen liegen sichtbar über der Atmosphäre (ISS ≈ 1,08 R, GEO ≈ 1,5 R), der Mond bei ≈ 2,3 R –
  nah genug, dass er auch bei engster Venus-Begegnung nicht mit ihr überlappt.
Alle Faktoren stehen in `src/config/solarSystemData.ts` (`SCALE`).

## Bahnen und Rotation

- Kepler-Bahnelemente J2000 (JPL, Standish), Kepler-Gleichung per Newton-Iteration gelöst. Start ist das aktuelle Datum.
- Achsorientierung nach dem IAU-Modell (Pol in RA/Dec). Die Eigenrotation ist vereinfacht: langsamer, in Echtzeit und unabhängig vom Geschwindigkeitsregler (`VISUAL_ROTATION`). Die Drehrichtung stimmt weiterhin (Venus und Uranus retrograd).

## Mond, Satelliten, Rakete

- **Mond:** im echten Größenverhältnis zur Erde (≈ 27 %), mittlere Mondbahn nach Meeus mit präzedierendem Knoten und Perigäum (Simulationszeit),
  gebundene Rotation – die Vorderseite zeigt zur Erde. Die Mondphase ergibt sich aus der Beleuchtung.
- **Satelliten:** ISS, Hubble, Sentinel-2 (sonnensynchron, Bahnebene folgt der Sonne), GPS,
  Meteosat (geostationär) und Molniya (stark elliptisch). Bahnen im Äquatorsystem der Erde mit
  echten Umlaufzeiten; sie laufen wie die Eigenrotation in skalierter Echtzeit
  (`SATELLITES.minutesPerSecond`, ISS ≈ 9 s pro Umlauf). Aus der Ferne werden die Modelle mitvergrößert
  (`SATELLITES.apparentSize`), damit sie in der Erdansicht erkennbar bleiben.
- **Rakete:** kubische Bézier-Transferbahn, die jedes Frame aus der aktuellen Mondposition aufgespannt
  wird. Start an der Erdoberfläche mit Triebwerksflamme (Partikel), Freiflug, Einschwenken in einen
  Mondorbit, danach Neustart. Geplante Bahn blass, geflogener Teil kräftig;
  beide werden mit dem Schalter „Orbitlinien“ ausgeblendet.

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
Lade die folgenden Dateien (2K-Variante) herunter und lege sie unter `public/textures/` ab:

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
  moon/moon.ts                Erdmond (Bahn, gebundene Rotation, Orbitlinie)
  satellites/                 Satellitenbahnen und Low-Poly-Modelle
  rocket/                     Rakete (Transferbahn, Mondorbit) und Triebwerksflamme
  navigation/                 Fokusziele, Kameraflug/Verfolgen/freies Fliegen, Picking
  ui/controlPanel.ts          Steuerungspanel (Zeit, Ansicht)
  ui/planetList.ts            Objektliste (Himmelskörper, Raumfahrt)
  ui/infoPanel.ts             Infopanel mit Kerndaten
  ui/tooltip.ts               Name beim Überfahren mit der Maus
  stars/stars.ts              Milchstraßen-Skysphere + Points-Sternfeld
  stats/statsBar.ts           Leistungsanzeige (FPS, Draw Calls, Speicher …)
  ui/loadingScreen.ts         Ladebildschirm
  main.ts                     Einstiegspunkt, Render-Loop
```
