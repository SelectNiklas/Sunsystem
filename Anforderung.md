# Aufgabe: Interaktives 3D-Sonnensystem als Webseite

Erstelle eine Webanwendung, die unser Sonnensystem in 3D darstellt und frei navigierbar ist.

## Tech-Stack
- Vite + TypeScript + Three.js (aktuelle stabile Version)
- Keine schweren Frameworks; modulare Struktur (ein Modul pro Objekttyp: sun, planets, moon, asteroids, satellites, rocket, stars, ui, stats)
- Alle Konstanten (Radien, Bahnelemente, Perioden, Skalierungsfaktoren) zentral in `src/config/solarSystemData.ts`
- Postprocessing über `EffectComposer` (UnrealBloomPass für die Sonne)

## Maßstab
- Die Darstellung muss **nicht maßstabsgetreu** sein. Vorrang hat, dass **alle Planeten gut erkennbar** sind.
- **Planetengrößen** werden komprimiert: Kleine Planeten werden stärker vergrößert als große. Die Reihenfolge der Größen bleibt erhalten.
- Die **Abstände zur Sonne** werden separat komprimiert (z. B. logarithmisch). Die Reihenfolge der Bahnen bleibt erhalten, und die Planeten dürfen sich nicht überlappen.
- Die Sonne bekommt einen eigenen, festen Skalierungsfaktor von ×0,14 (bezogen auf den echten Radius) und bleibt der größte Körper. Im UI ist die Sonnengröße nicht einstellbar.
- Ein Umschalter auf einen realistischen Maßstab ist **nicht** erforderlich.
- Das Hinauszoomen ist begrenzt, sodass das gesamte System gerade noch mit etwas Rand ins Bild passt.

## Planeten
- Alle 8 Planeten plus Sonne und Erdmond.
- Realistisches Aussehen über Texturen (z. B. Solar System Scope Textures, CC BY 4.0 – Quelle im Footer nennen). Texturen lokal unter `public/textures/` ablegen; falls nicht vorhanden, dokumentiere in der README, welche Dateien heruntergeladen werden müssen, und nutze bis dahin prozedurale Fallback-Farben.
- Erde: Tag-Textur, Nachtseite mit Stadtlichtern, separate Wolkenschicht, leichter Atmosphären-Glow (Fresnel-Shader).
- Saturn mit Ringen (Alpha-Textur), Uranus mit schwachen Ringen.
- Korrekte Achsneigung (Uranus und Venus beachten).
- Die Eigenrotation muss nicht exakt sein: Sie läuft deutlich langsamer und unabhängig von der Simulationsgeschwindigkeit. Die Drehrichtung stimmt (Venus und Uranus drehen rückwärts).
- Die Sonne ist die Lichtquelle (PointLight), mit emissivem Material und Bloom.

## Bahnbewegung
- Bahnen über Kepler-Bahnelemente (große Halbachse, Exzentrizität, Inklination, Länge des aufsteigenden Knotens, Argument des Perihels, mittlere Anomalie zur Epoche J2000). Kepler-Gleichung numerisch lösen.
- Startzeitpunkt = aktuelles Datum, damit die Planetenpositionen ungefähr der Realität entsprechen.
- Zeitsteuerung im UI: Pause, Rückwärts, Geschwindigkeitsregler (z. B. 1 Tag/s bis 1 Jahr/s), Anzeige des simulierten Datums.
- Optional einblendbare Orbitlinien.

## Navigation
- OrbitControls als Basis (Zoom, Drehen, Verschieben).
- Klick auf einen Planeten → Kamera fliegt weich dorthin (Tweening) und folgt ihm.
- Planetenliste im UI zum schnellen Anspringen.
- Tastatur: Pfeiltasten/WASD für freies Fliegen, ESC zurück zur Gesamtansicht.
- Logarithmischer Tiefenpuffer (`logarithmicDepthBuffer: true`), um Z-Fighting bei großen Distanzen zu vermeiden.

## Asteroiden
- Asteroidengürtel zwischen Mars und Jupiter mit mehreren tausend Objekten über `InstancedMesh` (unregelmäßig verformte Low-Poly-Geometrie, zufällige Rotation).
- Zusätzlich einige einzelne Asteroiden, die frei durch den Raum fliegen.

## Sterne
- Sternenhimmel als Skybox/Skysphere (Milchstraßen-Textur) plus ein `Points`-Sternfeld mit unterschiedlicher Helligkeit und Farbtemperatur.

## Satelliten um die Erde
- 5–6 Satelliten auf unterschiedlichen Umlaufbahnen, jeweils mit eigener Orbitlinie und Label:
  - ISS (LEO, ca. 51,6° Inklination)
  - Sonnensynchroner Erdbeobachtungssatellit (polar)
  - GPS-Satellit (MEO, 55°)
  - Geostationärer Satellit (Äquator)
  - Molniya-Bahn (stark elliptisch)
- Einfache Low-Poly-Modelle (Körper + Solarpanels). Umlaufzeiten relativ zueinander korrekt, für die Sichtbarkeit aber visuell skaliert.

## Rakete Erde → Mond
- Eine Rakete fliegt auf einer plausiblen Transferbahn von der Erde zum Mond (z. B. Bezier- oder Free-Return-ähnliche Kurve, die sich mit dem Mond mitbewegt).
- Triebwerksflamme als Partikeleffekt, Flugbahn als Linie.
- Nach der Ankunft startet die Mission neu.
- Klick auf die Rakete → Kamera folgt ihr.

## Leistungsanzeige
- Am unteren Bildschirmrand eine schmale Statusleiste mit:
  - FPS und Frame-Time (ms)
  - Draw Calls, Dreiecke, Geometrien, Texturen (aus `renderer.info`)
  - JS-Heap-Speicher (`performance.memory`, falls der Browser es unterstützt, sonst „n/a“)
  - Anzahl gerenderter Objekte
- Halbtransparent, dezent, aktualisiert ca. 2× pro Sekunde.

## UI / Design
- Dunkles, minimalistisches Overlay (Glassmorphism-Panel oben rechts für Steuerung, Planetenliste links).
- Beim Hover über ein Objekt: Name; beim Klick: Infopanel mit Kerndaten (Durchmesser, Abstand, Umlaufzeit, Tageslänge, Anzahl Monde).
- Ladebildschirm mit Fortschritt, solange Texturen laden.
- Responsiv, Resize-Handling.

## Performance
- Ziel: stabile 60 FPS auf einem normalen Laptop mit integrierter Grafik.
- Instancing, LOD für Planeten (weniger Segmente aus großer Entfernung), keine unnötigen Allokationen im Render-Loop.
- Pixel-Ratio auf max. 2 begrenzen.

## Mobile Anwendung
- Die Seite ist auf Smartphones im Hoch- und Querformat voll bedienbar.
- Touch-Steuerung: Drehen mit einem Finger, Zoomen und Verschieben mit zwei Fingern, Tippen auf einen Körper oder ein Label fokussiert ihn.
- Die Panels verdecken die Szene höchstens teilweise:
  - Steuerung und Planetenliste sind einklappbar (kleine Buttons). Die Planetenliste kann z. B. eine waagerecht scrollbare Leiste sein.
  - Das Infopanel erscheint als Leiste vom unteren Rand. Kein Wert wird abgeschnitten.
- Die Statusleiste zeigt auf kleinen Bildschirmen nur die wichtigsten Werte (z. B. FPS, Frame-Time, Draw Calls).
- Der Kameraabstand beim Fokus berücksichtigt das Seitenverhältnis, damit ein Planet auch im Hochformat vollständig ins Bild passt.
- Ersatz für die Tastatursteuerung: Die Gesamtansicht ist per Button erreichbar. Freies Fliegen ist optional, z. B. über einen virtuellen Joystick.
- Ausreichend große Touch-Ziele (mindestens ca. 40 px).
- Weniger Grafiklast auf Mobilgeräten: z. B. niedrigere Pixel-Ratio, kein oder reduziertes MSAA, schwächerer Bloom, kleinere Texturen. Ziel: flüssige Darstellung (≥ 30 FPS) auf aktuellen Mittelklasse-Smartphones.
- Die README beschreibt, wie man die Seite im lokalen Netz auf dem Handy öffnet (`npm run dev -- --host`).

## Vorgehen
Arbeite in Etappen und stoppe nach jeder Etappe, damit ich prüfen kann:
1. Projekt-Setup, Szene, Kamera, Sternenhimmel, Sonne, Statusleiste
2. Planeten mit Texturen, Maßstabslogik, Kepler-Bahnen, Zeitsteuerung
3. Navigation (Fokus, Kamera-Flug, Planetenliste, Infopanel)
4. Erdmond, Satelliten, Rakete
5. Asteroidengürtel, freie Asteroiden, Bloom, Feinschliff, README
6. Anpassung für Mobilgeräte (siehe Abschnitt „Mobile Anwendung“)

Erkläre am Ende jeder Etappe kurz, was umgesetzt wurde.