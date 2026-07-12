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
- **Optimierte KI mit adaptiver Zeitverwaltung**:
  - Alpha-Beta-Suche mit **LMR, Null-Move Pruning, ProbCut, Singular Extensions**
  - **Transposition Table** mit depth-preferred Replacement
  - **Move Ordering** mit MVV-LVA, Killer Moves, History Heuristic, **Threat Detection** (hängende Figuren, entdeckte Angriffe, X-Ray, Fesselungen, Königssicherheit)
  - **5 KI-Persönlichkeiten** (Ausgewogen, Aggressiv, Defensiv, Positionell, Der Fallensteller) mit individuellen Eval-Gewichten und Suchverhalten
  - **Adaptives Zeitmanagement**: dynamische Zeitallokation basierend auf Positions-Komplexität, Spielphase, Uhrzeit und Persönlichkeit
- **Engine Analyse Modus**: Echtzeit-Evaluation mit vertikaler Bar, Top-Züge inkl. PV-Varianten und Engine-Statistiken.
- **Zug-Qualitäts-Indikatoren**: Sofortiges Feedback auf Züge (Brilliant, Best, Blunder) mit visuellen Badges.
- **Tutor-System**: Echtzeit-Analyse und Verbesserungsvorschläge während des Spiels.
- **3D-Schlachtmodus**: Flüssige 3D-Grafik mit Three.js, inklusive Kampfanimationen und anpassbaren Skins.
- **PWA & Mobile Ready**: Installierbar, offline spielbar, **Touch-Drag-Support**, Safe-Area-Inset für Notched Devices, Touch-Targets ≥ 44×44px.
- **Detaillierte Statistiken**: Analyse von Gewinnraten, Zügen und Spieler-Genauigkeit.
- **TypeScript Strict Mode**: Das gesamte Projekt ist vollständig typisiert (0 `any`-Typen in Produktionscode).

## 🧠 Technische Highlights

### KI-Engine (`js/aiEngine.ts`)

- **Alpha-Beta Pruning** mit **LMR** (Late Move Reductions, log-Formel), **Null-Move Pruning** (R=2), **ProbCut** (depth≥5, β-150cp), **Singular Extensions** (depth≥6, margin=100cp)
- **Iterative Deepening** mit **Aspiration Windows** + **IIR** (Internal Iterative Reduction, adaptive 0.5×–2.0× Fenster)
- **Transposition Table** (Zobrist Hashing, 262k Einträge)
- **Move Ordering**: MVV-LVA + SEE, Killer Moves, History Heuristic, Counter Moves, **Threat-Bonus** (Checks, Angriffe, entdeckte Angriffe, X-Ray, Pin-Breaks, Königssicherheit)
- **Quiescence Search** mit SEE-basiertem Capture-Sorting
- **Opening Book** (PGN-Import, Merge-Strategien, Eröffnungsnamen-Anzeige)
- **JS-Suche als primäre Engine** (kein WASM-Backend nötig — läuft überall ohne native Build-Tools)

### Persönlichkeiten (`js/ai/personalities.ts`)

| Name                  | Stil                        | Aggression | Zeit-Faktor | Risiko | Interner Typ |
| --------------------- | --------------------------- | ---------- | ----------- | ------ | ------------ |
| **Ausgewogen**        | Universell                  | 1.0        | 1.0         | 0.5    | NORMAL       |
| **Aggressiv**         | Taktisch, angriffslustig    | 1.5        | 1.2         | 0.8    | AGGRESSIVE   |
| **Defensiv**          | Solide, prophylaktisch      | 0.6        | 1.1         | 0.2    | SOLID        |
| **Positionell**       | Strategisch, langfristig    | 0.8        | 1.0         | 0.3    | SOLID        |
| **Der Fallensteller** | Trickreich, opportunistisch | 1.3        | 1.3         | 0.9    | AGGRESSIVE   |

### Adaptives Zeitmanagement (`js/ai/timeManagement.ts`)

- Dynamische Allokation basierend auf: Positions-Komplexität (Schläge, Checks, forcierte Züge), Spielphase (Eröffnung/Mittelspiel/Endspiel), Restzeit, Inkrement
- Persönlichkeits-Faktor: Aggressiv = 20% mehr Zeit, Defensiv = sparsamer
- **Notfall-Reserve** bei < 10s Restzeit (max 30% der Zeit, 1s Reserve)
- Eröffnungsbuch-Phase (≤ Zug 20) = minimaler Search
- Gegner-Zeitdruck: Schneller spielen wenn Gegner in Zeitnot

### 3D Rendering (`js/battleChess3D.ts`)

- **Transparent Overlay**: Nahtlose Integration der 3D-Ansicht
- **Procedural Models**: Alle Schachfiguren werden prozedural generiert (`js/pieces3D.js`)
- **Skin-System**: Classic, Infernale, Frost, Neon
- **Animationen**: Weiche Übergänge, Capture-Effekte, Partikel-System

### Architektur (`js/App.ts`)

- **Modulare Struktur**: Klare Trennung von Verantwortlichkeiten
  - **App**: Lifecycle-Management und Initialisierung
  - **Game** (`gameEngine.ts`): Zentrale Spiellogik, Board-State, Phasen
  - **GameController** (`gameController.ts`): Spiele-Steuerung, Setup, Shop, Clock
  - **MoveController** (`moveController.ts`): Zug-Ausführung, Validierung, Undo/Redo
  - **AIController** (`aiController.ts`): KI-Steuerung, Analyse-Modus, Worker-Pool
  - **DOMHandler** (`ui/DOMHandler.ts`): DOM-Zugriff und Event-Listener
- **Vollständig typisiert**: 0 `any`-Typen im Produktionscode

## 🧪 Qualitätssicherung & Testing

Das Projekt legt großen Wert auf Robustheit und Korrektheit. Mit über **2.600 automatisierten Tests** (Vitest + Playwright) in mehr als 200 Testdateien wird eine extrem hohe Stabilität gewährleistet. Jede Änderung wird durch eine CI-Pipeline (Linting, Formatting, Testing, Strict Type Checking) verifiziert.

Das Projekt ist vollständig **TypeScript Strict Mode compliant** (0 Errors, 0 `any`-Typen).

| Modul             | Coverage (Lines) | Beschreibung                                                |
| ----------------- | ---------------- | ----------------------------------------------------------- |
| **Global**        | **> 86%**        | Gesamtheitliche Codeabdeckung                               |
| **AI Engine**     | > 90%            | Validierung von Suchalgorithmen, Bewertung, Time Management |
| **3D Engine**     | > 95%            | PieceManager3D und SceneManager3D                           |
| **Logic & Rules** | > 99%            | Spielregeln, Move-Validation, Game-State                    |
| **UI Components** | > 95%            | AnalysisUI, ShopManager, PuzzleMenu                         |

Test-Suite Highlights:

- 17 MoveOrdering-Tests (inkl. 5 Threat-Detection-Tests)
- > 2.600 Tests gesamt in > 200 Testdateien, alle grün
- Unit-, Integrations- und E2E-Tests (Playwright)

## 📁 Projektstruktur

```
schach9x9/
├── css/                    # Styling (Modular: base, themes, layout, board, components…)
├── js/
│   ├── ai/                 # KI-Logik
│   │   ├── personalities.ts    # Persönlichkeits-Definitionen (Shared)
│   │   ├── timeManagement.ts   # Adaptives Zeitmanagement
│   │   ├── OpeningBook.ts      # Eröffnungsbuch
│   │   ├── transpositionTable.ts
│   │   ├── MoveOrdering.ts     # Move-Ordering mit Threat-Detection
│   │   ├── search.ts           # JS Alpha-Beta mit LMR, NMP, ProbCut…
│   │   └── aiEngine.ts         # JS-Such-Engine (primär, kein WASM)
│   ├── assets/             # Statische Assets (Figuren SVGs)
│   ├── campaign/           # Kampagnen-System
│   ├── input/              # Eingabe-Handler
│   ├── modes/              # Spielmodi-Strategien
│   ├── move/               # Zugvalidierung und Ausführung
│   ├── effects/            # Visuelle Effekte
│   ├── tutor/              # Tutor-System und Analyse
│   ├── ui/                 # UI-Komponenten
│   │   ├── 3d/             # 3D-Engine
│   │   └── BoardRenderer.ts    # Board-Rendering + Touch-Support
│   ├── utils/              # Hilfsfunktionen (PGN, ErrorManager)
│   ├── gameEngine.ts       # Kern-Spiellogik
│   ├── gameController.ts   # Spiele-Steuerung
│   ├── moveController.ts   # Zug-Steuerung
│   ├── aiController.ts     # KI-Steuerung
│   ├── App.ts              # Hauptanwendungsklasse
│   └── evaluate.ts         # Zentrale Evaluation
├── tests/                  # Test-Suite (Unit, Integration, E2E)
└── index.html              # Einstiegspunkt
```

## 🚀 Installation & Start

### Voraussetzungen

- Node.js (v18+)
- NPM

### Schritte

1. **Repository klonen:** `git clone https://github.com/bumblei3/schach9x9.git`
2. **Abhängigkeiten installieren:** `npm install`
3. **Spiel starten:** `npm run dev` (Vite dev server)
4. **Build für Produktion:** `npm run build`

## 🛠️ Entwicklung & CI

Das Projekt nutzt einen modernen Entwicklungs-Workflow:

- **Tests ausführen:** `npm test`
- **Linting (ESLint):** `npm run lint`
- **Formatting (Prettier):** `npm run format`
- **CI-Check:** `npm run format:check && npm run lint && npm test`

## 📄 Lizenz

Dieses Projekt ist unter der MIT Lizenz veröffentlicht.
