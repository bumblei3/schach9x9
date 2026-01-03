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
- **PWA & Mobile Ready**: Installierbar und offline spielbar dank Service Worker. Mit Touch-Support für Drag & Drop auf Tablets und Smartphones.
- **Detaillierte Statistiken**: Umfassendes Tracking von Gewinnraten, Zügen und Spielhistorie.
- **Anpassbare Designs**: Wähle zwischen Classic, Deep Blue und Forest Green Themes.

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

### Architektur (`js/App.js`)

- **Modulare Struktur**: Klare Trennung von Verantwortlichkeiten.
  - **App**: Lifecycle-Management und Initialisierung.
  - **RulesEngine**: Kapselt alle Regellogiken und Zugvalidierungen.
  - **TimeManager**: Verwaltet die Spieluhr sicher und präzise.

## 🧪 Qualitätssicherung & Testing

Das Projekt legt großen Wert auf Robustheit und Korrektheit. Mit über **530 automatisierten Tests** (Jest) wird eine hohe Stabilität gewährleistet. Jede Änderung wird durch eine CI-Pipeline (Linting, Formatting, Testing) verifiziert.

| Modul             | Coverage (Lines) | Beschreibung                                         |
| ----------------- | ---------------- | ---------------------------------------------------- |
| **Global**        | **> 90%**        | Gesamtheitliche Codeabdeckung.                       |
| **AI Engine**     | > 90%            | Validierung von Suchalgorithmen und Bewertung.       |
| **3D Engine**     | > 95%            | Tests für Rendering-Initialisierung und Animationen. |
| **Logic & Rules** | > 95%            | Spielregeln, Move-Validation und Game-State.         |
| **UI Components** | > 85%            | Interaktionstests für Menüs, Shop und Overlays.      |

## 📁 Projektstruktur

```
schach9x9/
├── css/                # Styling (Modularisiert nach Komponenten)
├── js/
│   ├── ai/             # KI-Logik (Suche, Bewertung, Opening Book)
│   ├── assets/         # Statische Assets (Figuren SVGs)
│   │   └── pieces/     # Modularisierte Schachfiguren-Sets
│   ├── move/           # Zugvalidierung und Ausführung
│   ├── tutor/          # Tutor-System und Analyse
│   ├── ui/             # UI-Komponenten und Renderer
│   │   └── 3d/         # 3D-Engine Module (Scene, Piece, Input)
│   ├── App.js          # Hauptanwendungsklasse
│   └── battleChess3D.js # 3D-Fassade
├── tests/              # Test-Suite (Unit & Integration)
└── index.html          # Einstiegspunkt
```

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
