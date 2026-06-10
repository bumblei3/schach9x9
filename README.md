# ♟️ Schach 9x9

[![CI Status](https://github.com/bumblei3/schach9x9/actions/workflows/ci.yml/badge.svg)](https://github.com/bumblei3/schach9x9/actions/workflows/ci.yml)

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
- **Kampagnen-Modus**: Spiele durch verschiedene Level, sammle XP für deine Figuren und schalte mächtige Talente frei.
- **Talentbaum**: Individualisiere deine Armee mit spezialisierten Fähigkeiten (z.B. Veteran, Plünderer, Unaufhaltsam).
- **Setup-Phase & Upgrade-Modus**: Platziere deinen König strategisch und verbessere deine Armee dynamisch.
- **Optimierte KI**: Leistungsstarker Gegner mit Alpha-Beta-Suche, Transposition Table und effizientem Move-Ordering.
- **Engine Analyse Modus**: Echtzeit-Evaluation mit vertikaler Bar, Top-Züge inkl. PV-Varianten und Engine-Statistiken.
- **Zug-Qualitäts-Indikatoren**: Sofortiges Feedback auf Züge (Brilliant, Best, Blunder) mit visuellen Badges.
- **Tutor-System**: Echtzeit-Analyse und Verbesserungsvorschläge während des Spiels.
- **3D-Schlachtmodus**: Flüssige 3D-Grafik mit Three.js, inklusive Kampfanimationen und anpassbaren Skins.
- **PWA & Mobile Ready**: Installierbar und offline spielbar dank Service Worker.
- **Detaillierte Statistiken**: Analyse von Gewinnraten, Zügen und Spieler-Genauigkeit.
- **TypeScript Strict Mode**: Das gesamte Projekt ist vollständig typisiert (0 `any`-Typen in Produktionscode).

## 🧠 Technische Highlights

### KI-Engine (`js/aiEngine.js`)

- **Alpha-Beta Pruning**: Hocheffiziente Suche im Spielbaum.
- **Transposition Table**: Depth-preferred Replacement-Strategie zur Minimierung redundanter Berechnungen.
- **Move Ordering**: Optimiert durch Killer Moves, MVV-LVA (Most Valuable Victim - Least Valuable Attacker) und TT-Hits.
- **Evaluation**: Nuancierte Stellungsbewertung inklusive Figurenwerten, Positionsboni und Königssicherheit.
- **Opening Book**: Erweitertes Eröffnungsbuch mit PGN-Unterstützung und intelligenter Zugauswahl (Merge-Strategien, Gewichtung).

### 3D Rendering (`js/battleChess3D.js`)

- **Transparent Overlay**: Nahtlose Integration der 3D-Ansicht über das neue "Deep Space" UI.
- **Procedural Models**: Alle Schachfiguren werden prozedural generiert (`js/pieces3D.js`).
- **Skin-System**: Unterstützung für verschiedene Ästhetiken (Classic, Infernale, Neon).
- **Animationen**: Weiche Übergänge für Züge und Capture-Events durch integrierten `BattleAnimator`.

### Architektur (`js/App.ts`)

- **Modulare Struktur**: Klare Trennung von Verantwortlichkeiten.
  - **App**: Lifecycle-Management und Initialisierung.
  - **Game** (`gameEngine.ts`): Zentrale Spiellogik, Board-State, Phasen.
  - **GameController** (`gameController.ts`): Spiele-Steuerung, Setup, Shop, Clock.
  - **MoveController** (`moveController.ts`): Zug-Ausführung, Validierung, Undo/Redo.
  - **AIController** (`aiController.ts`): KI-Steuerung, Analyse-Modus.
  - **DOMHandler** (`ui/DOMHandler.ts`): DOM-Zugriff und Event-Listener.
  - **Vollständig typisiert**: 0 `any`-Typen im Produktionscode.

## 🧪 Qualitätssicherung & Testing

Das Projekt legt großen Wert auf Robustheit und Korrektheit. Mit über **1.500 automatisierten Tests** (Vitest) wird eine extrem hohe Stabilität gewährleistet. Jede Änderung wird durch eine CI-Pipeline (Linting, Formatting, Testing, Strict Type Checking) verifiziert.

Das Projekt ist vollständig **TypeScript Strict Mode compliant** (0 Errors, 0 `any`-Typen).

| Modul             | Coverage (Lines) | Beschreibung                                      |
| ----------------- | ---------------- | ------------------------------------------------- |
| **Global**        | **> 88%**        | Gesamtheitliche Codeabdeckung.                    |
| **AI Engine**     | > 90%            | Validierung von Suchalgorithmen und Bewertung.    |
| **3D Engine**     | > 95%            | PieceManager3D und SceneManager3D Abdeckung.      |
| **Logic & Rules** | > 99%            | Spielregeln, Move-Validation und Game-State.      |
| **UI Components** | > 95%            | AnalysisUI, ShopManager und PuzzleMenu Abdeckung. |

## 📁 Projektstruktur

schach9x9/
├── css/ # Styling (Modularisiert nach Komponenten)
├── js/
│   ├── ai/ # KI-Logik (Suche, Bewertung, Opening Book, WASM Bridge)
│   ├── assets/ # Statische Assets (Figuren SVGs)
│   ├── campaign/ # Kampagnen-System (Manager, BoardFactory)
│   ├── input/ # Eingabe-Handler (KeyboardManager)
│   ├── modes/ # Spielmodi-Strategien (Classic, Setup, Campaign)
│   ├── move/ # Zugvalidierung und Ausführung
│   ├── effects/ # Visuelle Effekte (Partikel, Animationen)
│   ├── tutor/ # Tutor-System und Analyse
│   ├── ui/ # UI-Komponenten und Renderer
│   │   └── 3d/ # 3D-Engine Module (Scene, Piece, Input)
│   ├── utils/ # Hilfsfunktionen (PGN, ErrorManager)
│   ├── gameEngine.ts # Kern-Spiellogik (Game-Klasse)
│   ├── gameController.ts # Spiele-Steuerung (Controller)
│   ├── moveController.ts # Zug-Steuerung
│   ├── aiController.ts # KI-Steuerung
│   ├── App.ts # Hauptanwendungsklasse
│   └── battleChess3D.ts # 3D-Fassade
├── tests/ # Test-Suite (Unit & Integration)
│   ├── ai/ KI-Tests
│   ├── campaign/ # Kampagnen-Logik Tests
│   ├── modes/ # Spielmodi Tests
│   ├── ui/ # UI Tests
│   └── ...
├── engine-wasm/ # Rust KI-Engine Quellcode
└── index.html # Einstiegspunkt

```

## 🚀 Installation & Start

### Voraussetzungen

- Node.js (v18+)
- NPM
- **Rust & wasm-pack** (für KI-Engine Performance-Optimierung)

### Schritte

1. **Repository klonen:** `git clone https://github.com/bumblei3/schach9x9.git`
2. **Abhängigkeiten installieren:** `npm install`
3. **Spiel starten:** `npm run dev` (Vite dev server)
4. **Wasm Engine bauen (optional aber empfohlen):** `npm run wasm:build`
5. **Build für Produktion:** `npm run build`

## 🛠️ Entwicklung & CI

Das Projekt nutzt einen modernen Entwicklungs-Workflow:

- **Tests ausführen:** `npm test`
- **Linting (ESLint):** `npm run lint` (überprüft Code-Qualität)
- **Formatting (Prettier):** `npm run format` (stellt konsistenten Stil sicher)
- **CI-Check:** `npm run format:check` && `npm run lint` && `npm test`

## 📄 Lizenz

Dieses Projekt ist unter der MIT Lizenz veröffentlicht.
```
