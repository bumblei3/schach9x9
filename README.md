# ♟️ Schach 9x9

[![Deploy static content to Pages](https://github.com/bumblei3/schach9x9/actions/workflows/deploy.yml/badge.svg)](https://github.com/bumblei3/schach9x9/actions/workflows/deploy.yml)

Ein innovatives Schachspiel auf einem 9x9 Brett mit neuen Figuren, strategischer Tiefe und modernen Features.

## 🚀 Live Demo
Das Spiel ist live unter folgender Adresse verfügbar:
**[https://bumblei3.github.io/schach9x9/](https://bumblei3.github.io/schach9x9/)**

## 🌟 Features

- **9x9 Spielbrett**: Ein größeres Schlachtfeld für mehr strategische Möglichkeiten.
- **Neue Figuren**:
  - **Erzbischof**: Kombiniert die Zugmöglichkeiten von Läufer und Springer.
  - **Kanzler**: Kombiniert die Zugmöglichkeiten von Turm und Springer.
  - **Engel**: Eine mächtige Premium-Figur für fortgeschrittene Strategien.
- **Setup-Phase**: Platziere deinen König strategisch und stelle deine Armee mit einem Punktesystem (15 Punkte) zusammen.
- **Optimierte KI**: Leistungsstarker Gegner mit Alpha-Beta-Suche, Transposition Table und effizientem Move-Ordering.
- **Tutor-System**: Echtzeit-Analyse und Verbesserungsvorschläge während des Spiels.
- **3D-Schlachtmodus**: Flüssige 3D-Grafik mit Three.js, inklusive Kampfanimationen und anpassbaren Skins.
- **Progressive Web App (PWA)**: Installierbar auf Desktop und Mobile, unterstützt Offline-Spiel.
- **Detaillierte Statistiken**: Umfassendes Tracking von Gewinnraten, Zügen und Spielhistorie.

## 🧠 Technische Highlights

### KI-Engine (`js/aiEngine.js`)

- **Alpha-Beta Pruning**: Hocheffiziente Suche im Spielbaum.
- **Transposition Table**: Depth-preferred Replacement-Strategie zur Minimierung redundanter Berechnungen.
- **Move Ordering**: Optimiert durch Killer Moves, MVV-LVA (Most Valuable Victim - Least Valuable Attacker) und TT-Hits.
- **Evaluation**: Nuancierte Stellungsbewertung inklusive Figurenwerten, Positionsboni und Königssicherheit.

### 3D Rendering (`js/battleChess3D.js`)

- **Procedural Models**: Alle Schachfiguren werden prozedural generiert (`js/pieces3D.js`).
- **Skin-System**: Unterstützung für verschiedene Ästhetiken (Classic, Infernale, Neon).
- **Animationen**: Weiche Übergänge für Züge und Capture-Events durch integrierten `BattleAnimator`.

## 🧪 Qualitätssicherung & Testing

Das Projekt legt großen Wert auf Robustheit und Korrektheit. Mit über **530 automatisierten Tests** (Jest) wird eine hohe Stabilität gewährleistet. Jede Änderung wird durch eine CI-Pipeline (Linting, Formatting, Testing) verifiziert.

| Modul                | Coverage (Lines) | Beschreibung                                         |
| -------------------- | ---------------- | ---------------------------------------------------- |
| **AI Engine**        | ~89%             | Validierung von Suchalgorithmen und Bewertung.       |
| **3D Engine**        | ~96%             | Tests für Rendering-Initialisierung und Animationen. |
| **Piece Generation** | ~98%             | Verifizierung der prozeduralen Modellierung.         |
| **Core Logic**       | ~95%             | Spielregeln, Move-Validation und Game-State.         |
| **UI**               | ~61%             | Interaktionstests für Menüs, Shop und Overlays.      |

## 🚀 Installation & Start

### Voraussetzungen

- Node.js (v14+)
- NPM

### Schritte

1. **Repository klonen:** `git clone https://github.com/bumblei3/schach9x9.git`
2. **Abhängigkeiten installieren:** `npm install`
3. **Spiel starten:** `npm run dev` (Vite dev server)
4. **Build für Produktion:** `npm run build`

## 🛠️ Entwicklung & CI

Das Projekt nutzt einen modernen Entwicklungs-Workflow:

- **Tests ausführen:** `npm test`
- **Linting (ESLint):** `npm run lint` (überprüft Code-Qualität)
- **Formatting (Prettier):** `npm run format` (stellt konsistenten Stil sicher)
- **CI-Check:** `npm run format:check` && `npm run lint` && `npm test`

## 📄 Lizenz

Dieses Projekt ist unter der MIT Lizenz veröffentlicht.
