# Sonnensystem 3D

Interaktives 3D-Sonnensystem mit Vite, TypeScript und Three.js.

> Stand: **Etappe 6** (Anpassung für Mobilgeräte)

## Bedienung

| Eingabe                       | Wirkung                                         |
| ----------------------------- | ----------------------------------------------- |
| Maus über Objekt              | Name wird eingeblendet                          |
| Klick auf Objekt              | Kamera fliegt hin und folgt ihm, Infopanel (auch einzelne Asteroiden) |
| Erneuter Klick auf das Objekt | Zurück zur Gesamtansicht                        |
| Liste links                   | Satelliten und Rakete anspringen                |
| Linke Maustaste ziehen        | Drehen (auch beim Verfolgen)                    |
| Mausrad                       | Zoomen                                          |
| Rechte Maustaste ziehen       | Verschieben                                     |
| W/A/S/D oder Pfeiltasten      | Frei fliegen (beendet das Verfolgen)            |
| Q / E                         | Runter / hoch fliegen                           |
| Shift (beim Fliegen)          | Schneller                                       |
| ESC                           | Zurück zur Gesamtansicht                        |
| Leertaste                     | Pause / Weiter                                  |
| Panel oben rechts             | Zeit, Geschwindigkeit, Orbitlinien (⚙ klappt ein/aus) |

### Smartphone / Tablet

| Geste                         | Wirkung                                         |
| ----------------------------- | ----------------------------------------------- |
| 1 Finger ziehen               | Drehen                                          |
| 2 Finger (zusammen/auseinander, ziehen) | Zoomen und Verschieben                |
| Tippen auf Körper             | Kamera fliegt hin und folgt ihm, Infoleiste unten (kleine Körper zählen auch, wenn man knapp daneben tippt) |
| Erneutes Tippen auf den Körper | Zurück zur Gesamtansicht                       |
| „Raumfahrt“                   | Klappt eine waagerecht scrollbare Leiste mit Satelliten und Rakete auf |
| „Gesamtansicht“               | Ersetzt ESC                                     |
| ⚙ oben rechts                 | Steuerung (Zeit, Geschwindigkeit, Orbitlinien)  |

Freies Fliegen (WASD) gibt es auf Touch-Geräten nicht; Drehen, Zoomen und Verschieben decken die Navigation ab.

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
- **Auswahl:** Ein ausgewähltes Raumfahrzeug bekommt einen leichten Lichthof und etwas Eigenleuchten,
  damit es auch auf der Nachtseite erkennbar bleibt (`HIGHLIGHT`).

## Asteroiden

- **Hauptgürtel:** 5000 Objekte in drei `InstancedMesh`es (drei Gesteinsformen, also drei Draw Calls).
  Jedes Objekt hat eigene Kepler-Elemente (a = 2,15–3,3 AE ohne die Kirkwood-Lücken, kleine
  Exzentrizität und Inklination). Bahnposition, Abstandsabbildung und Taumeln berechnet der
  Vertex-Shader, die CPU hat damit pro Frame keine Arbeit. Der Periheldistand ist auf 1,85 AE
  begrenzt, damit der Gürtel in der komprimierten Darstellung nicht in die Marsbahn ragt.
- **Einzelne Asteroiden:** Ceres, Vesta, Eros, Apophis, Bennu, Ryugu, Phaethon und Ikarus auf
  ihren (gerundeten) echten Bahnen, mit eigener Orbitlinie, anklickbar und mit Infopanel. Die
  mittlere Anomalie ist geschätzt, die Position auf der Bahn stimmt daher nur ungefähr.
  Größen folgen der Radienformel; aus der Ferne werden die Modelle mitvergrößert
  (`FREE_ASTEROIDS.apparentSize`).
- Die Gesteinsformen sind verformte Ikosaeder mit flacher Schattierung (`asteroids/rock.ts`),
  reproduzierbar über einen festen Zufalls-Seed.

## Leistung

- Pixel-Ratio höchstens 2; auf hochauflösenden Displays (Pixel-Ratio > 1,5) ohne MSAA.
- **Automatische Qualitätsanpassung** (`RENDER.adaptive`): Liegt die Bildrate nach dem Start unter
  ca. 56 FPS, wird erst MSAA abgeschaltet und dann die Pixel-Ratio in 0,25er-Schritten bis 1 gesenkt.
  Bringt ein Schritt keine Verbesserung (z. B. weil der Akkubetrieb die Bildrate begrenzt), wird er
  zurückgenommen. Die aktuelle Stufe steht in der Statusleiste unter „Auflösung“.

## Mobilgeräte

- **Kompakte Oberfläche** auf allen Touch-Geräten ohne Maus (Handy, Tablet – unabhängig von der Größe) sowie bei schmalen (≤ 700 px) oder niedrigen (≤ 500 px) Fenstern (`COMPACT_UI_QUERY`):
  Steuerung und Raumfahrtliste starten eingeklappt; es ist immer höchstens eines aufgeklappt.
  Das Infopanel erscheint als Leiste vom unteren Rand, lange Werte brechen um statt abgeschnitten zu werden.
  Der Bildausschnitt rückt dabei weich nach oben, damit der verfolgte Körper nicht unter der Leiste liegt.
  Alle Touch-Ziele sind mindestens 40 px groß; Notch und Home-Indikator werden freigehalten.
- Statt der Statusleiste gibt es in der kompakten Ansicht nur eine kleine FPS-Anzeige unten links; die Texturquelle steht dann im Steuerungspanel.
- **Seitenverhältnis:** Im Hochformat ist der horizontale Bildwinkel der engere. Der Fokusabstand wächst
  deshalb mit `1 / Seitenverhältnis`, Gesamtansicht und Zoomgrenze rücken so weit weg, dass das ganze System in die Breite passt
  (`CAMERA.overviewAspect`).
- **Weniger Grafiklast** (`MOBILE` in `solarSystemData.ts`): Als Mobilgerät gilt ein Gerät mit Touch und ohne Maus.
  Pixel-Ratio höchstens 1,5, kein MSAA, schwächerer Bloom mit halber Auflösung, Texturen auf 1024 px verkleinert,
  halb so viele Sterne und Gürtel-Asteroiden, Panels ohne Weichzeichner. Die automatische Qualitätsanpassung zielt auf 45 FPS
  und darf bis Pixel-Ratio 0,75 heruntergehen.
- Zum Testen am Desktop: `?mobile=1` erzwingt die Mobil-Einstellungen, `?mobile=0` schaltet sie ab
  (das Layout richtet sich nach der Fenstergröße, z. B. Geräteemulation in den DevTools).

### Auf dem Handy öffnen (lokales Netz)

1. Rechner und Handy im selben WLAN.
2. Entwicklungsserver im Netz freigeben:
   ```bash
   npm run dev -- --host
   ```
3. Vite zeigt neben `Local` auch eine `Network`-Adresse, z. B. `http://192.168.178.23:5173/`. Diese im Handy-Browser öffnen.
4. Klappt es nicht, blockiert meist die Firewall: Unter Windows beim ersten Start den Zugriff für Node.js
   im **privaten** Netzwerk erlauben (oder Port 5173 freigeben).

Der Produktions-Build lässt sich genauso testen: `npm run build` und `npm run preview -- --host` (Port 4173).

## Voraussetzungen

- [Node.js](https://nodejs.org/) ≥ 20.19 (LTS empfohlen)

## Starten

```bash
npm install        # npm.cmd wenn Probleme mit dem Ausführen von Skripten
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
  core/device.ts              Mobilgerät-Erkennung, Grafikeinstellungen je Gerät, kompakte Oberfläche
  sun/sun.ts                  Sonne (emissiv, Korona, PointLight)
  planets/                    Planeten, Erde (Tag/Nacht, Wolken, Atmosphäre), Ringe, Orbitlinien
  moon/moon.ts                Erdmond (Bahn, gebundene Rotation, Orbitlinie)
  asteroids/                  Asteroidengürtel (Instancing + Shader), einzelne Asteroiden, Gesteinsformen
  satellites/                 Satellitenbahnen und Low-Poly-Modelle
  rocket/                     Rakete (Transferbahn, Mondorbit) und Triebwerksflamme
  navigation/                 Fokusziele, Kameraflug/Verfolgen/freies Fliegen, Picking
  ui/controlPanel.ts          Steuerungspanel (Zeit, Ansicht)
  ui/planetList.ts            Objektliste (Raumfahrt)
  ui/collapsible.ts           Ein-/Ausklappen der Panels
  ui/infoPanel.ts             Infopanel mit Kerndaten
  ui/tooltip.ts               Name beim Überfahren mit der Maus
  stars/stars.ts              Milchstraßen-Skysphere + Points-Sternfeld
  stats/statsBar.ts           Leistungsanzeige (FPS, Draw Calls, Speicher …)
  ui/loadingScreen.ts         Ladebildschirm
  main.ts                     Einstiegspunkt, Render-Loop
```

## GIT-Befehle

```
  git status            # prüfen, was alles geändert ist
  git add -A            # alles aufnehmen (neu, geändert, gelöscht)
  git status            # kontrollieren: alles unter "Changes to be committed"?
  git commit -m "..."
  git push
```