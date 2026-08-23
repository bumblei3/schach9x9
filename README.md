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

### Engine-Version & Stärkungs-Hebel (v1.5.0)

Die Solo-KI wird kontinuierlich über isolierte, messbare Hebel gestärkt
(jeder Hebel ein eigener Branch + PR, gemessen durch einen Regression-Gate):

| Hebel                                 | Wirkung                                              | Status    |
| ------------------------------------- | ---------------------------------------------------- | --------- |
| **H3** – `MAX_SEARCH_TIME` 3s→5s      | tiefere Suche pro Zug (stärker, längere UI-Blockade) | ✅ v1.4.2 |
| **H-Q1** – Quiescence Delta-Pruning   | sound: schneidet aussichtslose QSearch-Zweige ab     | ✅ v1.5.0 |
| **H-Q2** – Quiescence Check-Extension | reverted: bei fester Zeit messbar schwächer (8:5 im Baseline-Match) | ↩️ revertiert |
| **H-P1** – PSQT für 9x9 zentrieren    | Center-(4,4)-PST — **schwächer** auf Taktik-FENs (5:10 vs v1.5.0) | ↩️ revertiert 2026-07-31 |

**Regression-Gates** (müssen alle grün sein, bevor ein Hebel gemergt wird):

- `js/asymmetryProbe.ts` – balanced-vs-balanced Self-Play mit alternierenden
  Farben; erkennt Color-Bias in TT/Eval/QSearch (eine Farbe >60% = Bug).
- `js/engineNode.ts` + `js/matchRefs.ts` – echter Stärke-Gate für die
  deterministische Engine: `NEW_REF` vs `OLD_REF` über zwei git-Worktrees
  (Self-Play ist wertlos, da beide Seiten identische Spiele replayen).
  `matchRefs` spielt mit `MATCH_FENS=1` echte 9×9-Taktik-FENs (Forks,
  Skewers, Back-Rank) und wertet bei Zeitablauf das **Material-Delta zur
  Ausgangsstellung** — nicht das absolute Brettmaterial. (Vor v1.6.0 baute
  `playGame` das Brett fälschlich aus der Startstellung, sodass Taktik-FENs
  nie wirklich gespielt wurden — der Gate war damals blind.)
- `npx vitest run` (2819 Tests), `npx tsc --noEmit`, eslint sauber.

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

Das Projekt legt großen Wert auf Robustheit und Korrektheit. Mit über **2.800 automatisierten Tests** (Vitest Unit/Integration + Playwright E2E) in 222 Unit-Testdateien plus 25 E2E-Specs wird eine extrem hohe Stabilität gewährleistet. Jede Änderung wird durch eine CI-Pipeline (Linting, Formatting, Testing, Strict Type Checking) verifiziert.

Das Projekt ist vollständig **TypeScript Strict Mode compliant** (0 Errors, 0 `any`-Typen).

| Modul             | Coverage (Lines) | Beschreibung                                                |
| ----------------- | ---------------- | ----------------------------------------------------------- |
| **Global**        | **> 92%**        | Gesamtheitliche Codeabdeckung (Branches > 82%)              |
| **AI Engine**     | > 90%            | Validierung von Suchalgorithmen, Bewertung, Time Management |
| **3D Engine**     | > 95%            | PieceManager3D und SceneManager3D                           |
| **Logic & Rules** | > 99%            | Spielregeln, Move-Validation, Game-State                    |
| **UI Components** | > 95%            | AnalysisUI, ShopManager, PuzzleMenu                         |

Test-Suite Highlights:

- 17 MoveOrdering-Tests (inkl. 5 Threat-Detection-Tests)
- 2818 Tests gesamt (Vitest Unit/Integration in 222 Dateien + 25 E2E-Specs via Playwright), alle grün
- Unit-, Integrations- und E2E-Tests (Playwright, Chromium)

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

## 🗺️ Roadmap / In Arbeit

Aktuelle Planung mit Milestones M0–M5: **[`docs/ROADMAP.md`](docs/ROADMAP.md)**.
Mess-Ist-Stand: [`STATUS.md`](STATUS.md). Nicht wiederholen: [`bench/NEGATIVE_RESULTS.md`](bench/NEGATIVE_RESULTS.md).

**Aktuell: v2.0.0** — M2 komplett (Kampagne Akt II Kap. 7–12, Fairy-Puzzles, Perks, Feen-Talente) + M3 Coach-Kern (Feenmuster-Detektion, Tutor spricht 9×9). NNUE-Track nach negativem Gate (−132 Elo, n=80) geparkt. Offen: M3-Rest (Auto-Hint, Lehrbuch).

**Bereits released (in v1.1.0–v1.3.0):**

- **Eröffnungs-Trainer (v1.1.0):** Solo-Spielmodus — eine Stellung aus dem
  trainierten Eröffnungsbuch wird gezeigt, der Spieler soll den engine-bewerteten
  Buch-Zug finden; Streak + Trefferquote werden gespeichert.
  _Status: in v1.1.0 released, aber bis **PR #122** effektiv kaputt (70/71
  Buchpositionen unlösbar — Start-Feld des erwarteten Zuges war leer). PR #122
  hat recordOpeningPosition + applyGameResult gefixt, die kaputte `.cjs`
  entfernt und das Buch neu generiert (jetzt 0 unlösbar)._
- **Tägliches Puzzle (v1.2.0):** Solo-Spielmodus — ein jeden Tag rotierendes
  Schachtaktik-Puzzle (reuse `puzzleManager`).
- **Post-Game-Analyse (E2E, v1.3.0):** Browser-Spec verifiziert Blunder/Accuracy-
  Auswertung im echten Browser (`e2e/post-game-analysis.spec.ts`).

**Phase A (Solo-UX):**

- [✅] **Quick-Start Tutorial** — 3 Screens (Feenfiguren, Setup, Shop)
- [✅] **Daily-Puzzle-Streak** — Serie + Best auf der Menükarte / nach dem Lösen
- [✅] **Opening-Trainer-Feedback** — algebraisch, deutsch, Serie/Treffer
- [✅] **Tutor-Hints via Worker** — kein Main-Thread-Freeze bei getTopMoves

**UI-A (Interface):**

- [✅] **Action-Bar Primary + Mehr-Overflow**
- [✅] **Menü Empfohlen / Mehr Modi**
- [✅] **Deutsche Microcopy + Streak-Look + Last-Move-Highlight**

**UI-B (Mobile & Flow, Unreleased):**

- [✅] **Bottom-Sheets** (Shop + Mehr-Menü mobil + Backdrop)
- [✅] **Compact Header** mit Header-Uhren
- [✅] **Landscape-Layout**
- [✅] **Menü-Cards als Buttons** (`data-init-mode`, kein inline onclick)

**Solo-Analyse (v1.6.0):**

- [✅] **Variant-Tree Panel** — Top-Engine-Kandidaten + Best-Reply-Fortsetzung
  nach Solo-Spielende (`buildVariantTree` + `#variant-tree`, PR #144)

**Nächste Schritte (offen) — Details in [`docs/ROADMAP.md`](docs/ROADMAP.md):**

- **Engine-Stärkung (Such-*parameter*):** feature-complete / geparkt.
  H3, H-Q1, LMR-Skala, IIR-Skip, H4, H-P1 (revertiert). Eval-Terme
  (mobility/pawn/tempo/eg-passpawn) auf n=40 **verworfen**.
  _Offen ist nicht „noch ein Knob“, sondern **M1 Suche skaliert**
  (inkrementeller Zobrist) und **M0 Freeze** der Gewinner
  `LMR_BASE_DEPTH=4` + `NULL_MOVE_R=1`._
  - **Absolute Stärke (Track B):** vs SF Elo 1400 gemessen. Best: Score
    0.175 / ≈ −269 (d5, LMR4, NMP R=1, n=40). Nicht mehr „unbekannt“.
  - **Mobility-Lever:** ❌ **abgelehnt** (chore #151).
  - **NNUE:** ⏸️ **geparkt** (2026-07-17).
- **H-P1 — PSQT für 9x9 zentrieren:** ↩️ **reverted 2026-07-31.**
  `buildCenteredPST` blieb als Experiment-Helper, Produktion nutzt wieder
  handgetunte Tabellen. Gate: `bench/ABSOLUTE_STRENGTH_BASELINE.md`
  (main+H-P1 5:10 vs v1.5.0; hand-tuned 6:5 vs H-P1).
- **Eröffnungsbuch erweitern** — ✅ v1.6.1: 71→2604 Positionen
  (Multi-Persönlichkeit + Elo-1100 Blunder-RNG; Trainer-Weiß: 1271 Positionen).
  - **Buch-Qualität gemessen (2026-07-20, #156):** `tools/book-eval.ts`
    verglich den Buch-Zug jeder Position mit den Engine-Top-Moves (depth 6,
    200 Stichproben) → **Top-1 16%, Top-3 42.5%, Top-5 62%, Eval-Loss 16.1cp.**
    Das Buch ist ein bewusstes **Vielfalt-Buch** (kein Engine-Optimum); nur
    16% Engine-Erstwahl sind erwartbar und designbedingt. ⏸️ **Geparkt:**
    eine Stärkungs-Nachbesserung würde den Vielfalt-Zweck (#146) torpedieren.
- **Daily Puzzle v1.1.0: Engine-Zugvorschläge + Varianten** — ✅ verifiziert
  (PR #121, E2E im echten Browser). Tutor-System liefert Top-Züge + PV-
  Varianten; im Puzzle-Modus via Hint-Button/`h` verfügbar.
- **Coverage:** war 82% Branches (Ziel 85%). Bei Projektumfang (7277 Branches)
  ist 85% mit vertretbarem Aufwand nicht erreichbar — _diminishing returns,
  daher kein hartes Ziel mehr. Gezielte Branch-Tests für gameController/
  aiController landed in v1.5.x (Branch 82.27%)._

## 📌 Bekannte Einschränkungen / Offen

- **TypeScript 7:** aktuell auf `^6.0.3` fixiert — `typescript-eslint` v8
  (latest) unterstützt nur `typescript <6.1.0`. TS 7 erst nach Release von
  `typescript-eslint` v9 einsetzen.
- **Multiplayer:** bewusst nicht geplant (Solo-Fokus).

## 📄 Lizenz

WTFPL – Do What The F*** You Want To Public License. Siehe [LICENSE](./LICENSE).
