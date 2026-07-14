# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.4.1] – 2026-07-14

Bugfix: Engine-Such-Asymmetrie (Null-Move-Pruning Perspektiven-Bug).

### Suche / Correctness

- `search.ts` Null-Move-Pruning: Perspektive beim Null-Move-Sub-Search
  korrigiert (`maximizing` → `!maximizing`). Vorher wurde die Null-Move-
  Bewertung aus der falschen Seiten-Perspektive genommen.
- `search.ts` Transposition-Table: Seite am Zug (`sideToMove`) in den
  Zobrist-Hash aufgenommen, damit Stellungen mit unterschiedlicher
  Zugpflicht nicht verwechselt werden.

### Symptom (vorher)

- Bei längerer Bedenkzeit (≥ 8s) dominierte in Engine-vs-Engine-Selbsttests
  eine Farbe systematisch (20:3 bei identischen Engines). Die Engine war bei
  kurzer Suche (3s) symmetrisch, wurde bei tiefer Suche aber einseitig.
- Nach dem Fix: Selbsttests bei 8s wieder symmetrisch (~21/24 Remis),
  keine messbare Regression bei 3s.

### Tests

- `tests/search.symmetry.test.ts`: Spiegel-Symmetrie-Guard (Position und
  gespiegeltes Pendant müssen gegensätzlich bewertet werden, Toleranz 100cp).
  Hinweis: der kritische Asymmetrie-Bug zeigt sich erst bei zeitgesteuerter
  Tiefsuche (8s-Match) und nicht bei fester Tiefe — der Match bleibt der
  autoritative Beweis.

> Hinweis: Dieser Abschnitt wird von Hand gepflegt (nicht via
> `npm run changelog`, da dieses Skript die gesamte Datei überschreibt
> und die Historie zerstören würde).

## [1.4.0] – 2026-07-14

Engine-Stärkung (Solo-Gegner) + Tooling. Keine neuen Spielfeatures,
keine Breaking Changes.

### Suche / Performance

- `search.ts`: IIR-Tiefen-Skip aktiviert (war toter Code) — bei extrem
  stabilen Bewertungen wird eine Tiefe übersprungen, um Budget für
  tiefere/wichtigere Stellungen zu sparen.
- `search.ts`: LMR-Skala 1.75 → 2.0 — präzisere Spätzug-Reduktionen
  (weniger zu aggressive Reduktion späterer Züge).

### Tools

- `engineMatch.ts`: Bugfix — Spielergebnisse wurden nicht in `this.results`
  gesammelt, die Summary zeigte immer 0 Games. Jetzt korrekt gepusht.
- `tools/match-harness.ts` (neu): Headless-Regression-Harness für
  Engine-vs-Engine-Matches (konfigurierbare Persönlichkeiten/Anzahl),
  nutzt `engineMatch.runEngineMatch`.

### Bekannt / Offen

- **Asymmetrie-Bug bei längerer Suche:** Erhöhung von `MAX_SEARCH_TIME`
  (aktuell 3000ms) über ~5s triggert bei Engine-vs-Engine-Matches
  asymmetrisches Verhalten (Schwarz dominiert 20:3 bei identischen
  Engines + alternierenden Farben). Ursache unklar (vermutet: TT/Eval-
  Farbenfehler bei tiefen Linien). **H3 (Zeit-Erhöhung) daher bewusst
  NICHT in diesem Release** — wird als eigenes Foundation-Thema verfolgt.

## [1.3.0] – 2026-07-14

Qualitäts- und Foundation-Release: schließt die Foundation-first-Härtungsrunde
ab (alle kritischen Logik-Module jetzt mit echten Assertions abgedeckt) und
rüstet die E2E-Abdeckung auf 25 Browser-Specs aus. Keine neuen Spielfeatures,
keine Breaking Changes — reines Robustheits- und Wartungs-Release.

### Foundation-Tests (Vitest, Logik-Module mit echten Assertions)

- #92 `chore(foundation)`: Stale Debug-Artefakte entfernt, E2E im echten
  Browser verifiziert.
- #93–#95 `test`: Foundation-Coverage-Lücken geschlossen — `MoveExecutor`
  (Turn-Wechsel, Promotion, Castling, En-Passant, Game-Over) +
  `OpeningBookTrainer` (CLI-Parser, Stats, Special-Piece-Mappings).
- #97 `test`: `AnalysisManager` (root) Piece-Values + Arrow-Guard.
- #98 `test`: Engine-Smoke-Tests für `search.ts` (Alpha-Beta-Kern).
- #99 `test`: `DailyPuzzle` Index-Rotation, Streak, Solved-Tracking.
- #100 `test`: `TacticsDetector`-Primitiven (`canPieceMove`, Threat/Defence).
- #101 `test`: `gameController` Game-End-State-Machine + `placeKing`.
- #102 `test`: `aiWorker` Message-Protokoll (`self.onmessage`-Handler).
- #103 `test`: `MoveExecutor` Kern (Turn-Switch, Promotion, Castling,
  En-Passant, Game-Over).
- #104 `test(e2e)`: schnelle Smoke-Suite für App-Boot + Board-Render pro Modus.
- #105 `chore`: Tech-Debt-Sweep — flaky Search-Invariant, eslint, prettier.
- #106 `test`: `MoveController` Kern (Material-Value, Play-Click, Redo/Undo-UI).

### E2E-Tests (Playwright, Browser-Specs)

- #84 `e2e/cross` + `e2e/daily-puzzle`: Cross-Modus + Tägliches-Puzzle Specs.
- #85 `e2e/post-game-analysis`: Post-Game-Analyse (Blunder/Accuracy) verifiziert
  im echten Browser.
- #104 `e2e/smoke`: App-Boot + Per-Mode-Board-Render.
- Gesamte E2E-Suite: **25 Specs** (Playwright, Chromium) — u.a. neu:
  `3d_toggle`, `accessibility`, `shop`, `standard8x8`, `tutorial`,
  `upgrade_modes`.

### Dependencies (Maintenance)

- #86 `chore(deps)`: development-dependencies group — 9 Updates
  (u.a. eslint 10.5→10.7, @typescript-eslint 8.61→8.63, globals 17.6→17.7).
- #87/#89 `chore(deps)`: runtime-dependencies group — 4 Updates
  (three 0.184→0.185.1, @types/three 0.182→0.185.1, vite 8.0.16→8.1.4,
  prettier 3.8.4→3.9.5). Ursprünglicher Dependabot-PR #87 hatte einen
  Merge-Konflikt mit #86; sauber als #89 neu aufgesetzt.
- #88/#90→#91 `typescript`: Major-Bump 6.0.3→7.0.2 (#90) brach die
  Lint-Stufe — `typescript-eslint` v8 kennt TS 7 nicht
  (`TypeError: ... reading 'Cjs'` in typescript-estree). Revertiert auf
  `^6.0.3` (#91). TS 7 erst wieder anfassen, wenn `typescript-eslint` v9
  (mit TS-7-Support) released ist.
- #107 `fix`: TS1149 Casing-Collision + alle restlichen `tsc`-Type-Errors in
  Tests bereinigt (`tsc --noEmit` → 0 Errors).
- #108 `chore`: Dependabot Auto-Merge abgestellt — künftige Dependency-PRs
  brauchen manuellen Review/Merge.
- Lockfile via `npm install --legacy-peer-deps` regeneriert (CI nutzt
  `npm ci --legacy-peer-deps`; der eslint-plugin-import ↔ eslint 10
  Peer-Konflikt ist bewusst toleriert).

### Tests / Coverage

- Neue `tests/dailyPuzzle.test.ts` (15 Tests): Index-Determinismus, lokales
  Datum-Format, Solved-Round-Trip, Streak, leeres Set.
- Gesamte Unit-Suite: **2818 Tests, 0 Regressionen** (222 Testdateien,
  Vitest) + 25 E2E-Specs (Playwright, Chromium).
- Coverage-Gate: **Lines 92.63% | Branches 82.12% | Functions 91.84%**.

## [1.2.0] – 2026-07-12

Neues Feature: **Tägliches Puzzle** — ein jeden Tag rotierendes Schachtaktik-Puzzle
(Solo, kein Multiplayer). Reuse der bestehenden `puzzleManager`-Infrastruktur.

### Feature

- `DailyPuzzleManager` (`js/dailyPuzzle.ts`): wählt deterministisch ein Puzzle pro
  Kalendertag (rotiert um lokale Mitternacht), trackt "heute gelöst" pro Tag
  (`localStorage['dailyPuzzle.solved.YYYY-MM-DD']`) und eine Siegesserie
  (`getStreak`, aufeinanderfolgende gelöste Tage).
- Neue Main-Menu-Karte "Tägliches Puzzle" (`data-mode="daily-puzzle"`) mit
  "Heute gelöst ✓"-Badge (aktualisiert beim App-Start + live nach dem Lösen).
- `gameController.startDailyPuzzleMode()` lädt das Tages-Puzzle über die
  bestehende `puzzleManager.loadPuzzle`-Pipeline; der Solve-Hook in
  `MoveExecutor` markiert den Tages-Status.
- `GameMode`-Union um `'daily-puzzle'` erweitert (inkl. `GAME_MODES.DAILY_PUZZLE`).

### Fixes (aus Code-Review)

- Puzzle-Index und Solved-Key nun beide auf lokaler Tagesbasis (zuvor rotierte
  der Index UTC-mitternachts → falscher "schon gelöst"-Status westlich von UTC).
- `getTodaysPuzzle`-Null-Guard für leere Puzzle-Sets korrekt getestet.

### Tests / Coverage

- Neue `tests/dailyPuzzle.test.ts` (15 Tests): Index-Determinismus, lokales
  Datum-Format, Solved-Round-Trip, Streak, leeres Set.
- Gesamte Unit-Suite: 2672 Tests, 0 Regressionen (209 Dateien).

## [1.1.2] – 2026-07-12

Bugfix-Release für den Eröffnungs-Trainer. Ein E2E-Browser-Check nach
v1.1.1 deckte einen kritischen Bug auf, den die Unit-Tests nicht fanden.

### Fixes

- **Trainer zeigte ein leeres Brett:** Das Hauptthread-`openingBook`-Singleton
  wurde nie mit Daten gefüllt — nur der isolierte AI-Worker-Kontext lud das
  Buch. `startOpeningTrainerMode` lädt `opening-book.json` jetzt idempotent
  via neue `ensureOpeningBookLoaded()` (nur wenn noch leer), bevor die erste
  Stellung gerendert wird.
- **E2E-Abdeckung:** `e2e/opening-trainer.spec.ts` bestätigt im Browser, dass
  das Brett mit echten Figuren rendert und der Zwei-Klick-Move-Flow Feedback
  auslöst.

### Tests / Coverage

- Neue E2E-Spec (2 Tests, Chromium) für den Trainer-Modus.
- Gesamte Unit-Suite: 2657 Tests, 0 Regressionen.

## [1.1.1] – 2026-07-12

Bugfix-Release für den Eröffnungs-Trainer (v1.1.0): der Play-Loop ließ sich
nicht korrekt bedienen.

### Fixes

- **Erste Stellung wurde nicht gerendert:** `startOpeningTrainerMode` lief vor
  `UI.initBoardUI`, sodass das erste Brett leer blieb. Render jetzt nach dem
  Board-Setup.
- **Klick-Fallthrough:** Ein Klick auf ein leeres/gegnerisches Feld fiel an
  `MoveController` durch und selektierte fremde Figuren. Der Trainer schluckt
  nun jeden In-Phase-Klick.
- **Stale Selektion:** `loadTrainerPosition` setzt `selectedSquare`/`validMoves`
  beim Laden einer neuen Stellung zurück (betraf den „Start"-Button-Pfad).

### Tests / Coverage

- Play-Loop-Tests von 7 auf 9 erweitert (Fehler-Zug-Feedback, Klick-Verschlucken).
- Gesamte Testsuite: 2654 Tests, 0 Regressionen.

## [1.1.0] – 2026-07-12

Neues Feature: **Eröffnungs-Trainer** (Solo-Spielmodus). Trainiere Eröffnungen aus dem
trainierten Eröffnungsbuch — eine Stellung wird auf das Brett gelegt, du findest den
buch-gelisteten Zug, bekommst sofortiges Feedback und dein Fortschritt (Trefferquote,
Streak, gelöste Linien) wird lokal gespeichert.

### Features

- **Eröffnungs-Trainer-Modus** (`js/openingTrainer.ts`): `OpeningTrainerManager` lädt
  das `OpeningBook`, wählt eine trainierbare Stellung, prüft den eingereichten Zug
  gegen den Buch-Zug und führt Streak/Accuracy/Trefferstatistik.
- **Stellungs-Rekonstruktion:** Buch-Positionen (Hash) werden via
  `reconstructBoardFromHash` zurück in ein renderbares Brett + Zugrecht gewandelt.
- **Fortschritt persistiert:** `localStorage` (Key `openingTrainer.progress`),
  isoliert vom Spiel-Autosave — auto-geladen beim Start, speicherbar nach jeder Runde.
- **Menü-Shell** (`js/ui/OpeningTrainerMenu.ts`): dünne DOM-Schicht mit Start-Button
  und Fortschrittsanzeige.
- **Modus-Verdrahtung:** `GameController.startOpeningTrainerMode()`, `GameMode`
  um `'opening-trainer'` erweitert, Hauptmenü-Karte + `#opening-trainer-container`
  in `index.html`.

### Tests / Coverage

- Neue Test-Suite `tests/openingTrainer*.test.ts` (21 Tests): Manager-Logik,
  Hash-Rekonstruktion (weiß/schwarz, multi-figurig), Persistence (Edge-Cases
  inkl. korruptem/partiellem JSON), Menü-Shell und Modus-Verdrahtung.
- Gesamte Testsuite: 2645 Tests, 0 Regressionen.

## [1.0.4] – 2026-07-12

Qualitäts-Release: Test-Basis für den Eröffnungs-Trainer geschärft. Keine neuen
Features, keine Breaking Changes.

### Tests / Coverage

- **coverage:** `js/chess-pieces.ts` (reines Re-Export-Barrel) aus dem Coverage-
  Report ausgeschlossen — v8 meldete fälschlich 0%, während das Zielmodul voll
  getestet ist. Gesamt-Coverage dadurch leicht gestiegen (#74)
- **OpeningBookTrainer:** Coverage von 67% → 81% Lines (Branch 69% → 80%) (#75)
  - CLI-Argument-Parser aus `main()` in exportierte pure Funktion `parseCliArgs()`
    extrahiert (testbar, ohne Laufzeitverhalten zu ändern)
  - neue Tests: CLI-Parser (8), `printStats()`-Ausgabe, Spezialfiguren-Mappings
    (Erzbischof/Chancellor/Engel/Nightrider) in `boardToUi` + `getBoardHashInt`

## [1.0.3] – 2026-07-12

Qualitäts-Release: Typsicherheit im Produktivcode geschärft. Keine neuen Features,
keine Breaking Changes.

### Refactoring / Typsicherheit

- **types:** neues `SavedGameState`-Interface; `savedGameState: unknown` → typisiert (#72)
- **GameStateManager:** 3 unterdrückte `as any`-Casts entfernt
  (`window.battleChess3D` bereits typisiert, `savedGameState`-Zugriff mit Null-Guard) (#72)
- **PieceManager3D:** `game as any` entfernt — `whiteCorridor`/`blackCorridor` sind
  echte `Game`-Properties (#72)
- **MoveExecutor:** `defenderData` `as any` → `as Piece` (konsistent mit `attackerData`) (#72)
- **eslint:** `@typescript-eslint/no-explicit-any` im src von `warn` → `error` gehärtet;
  verhindert künftige unbemerkte `any`-Einführung (#72)

## [1.0.2] – 2026-07-12

Wartungs-Release: Fokus auf Code-Qualität (ESLint/Prettier-Bereinigung, tests/
ins Linting aufgenommen) und Doku. Keine neuen Features, keine Breaking Changes.

### Chores / Code-Qualität

- **eslint:** generierten `coverage/`-Ordner + `docs/`, `engine-wasm/pkg/`, `build/`
  in die Flat-Config-`ignores` aufgenommen (behebt 7 False-Positive-Parse-Errors) (#68)
- **eslint:** veraltete `.eslintignore` entfernt (von Flat Config nicht unterstützt),
  Inhalte in `eslint.config.mjs` migriert (#68)
- **eslint:** `tests/` ins Linting aufgenommen mit test-tauglichem Regelsatz
  (`no-explicit-any` in Tests aus, unused-vars TS-aware als error) (#70)
- **prettier:** gesamtes Repository durchformatiert (`prettier --write .`) (#68)
- **docs:** Testzahlen in README aktualisiert (> 2.600 Tests / > 200 Testdateien) (#69)

## [1.0.1] – 2026-07-12

Maintenance-Release nach `v1.0.0-stable`. Schwerpunkt: umfangreiche
Test-Invarianten-Suiten (Coverage der Kernmodule deutlich erhöht), CI-Stabilität
und gezielte Bugfixes/UX-Verbesserungen. Keine neuen Features, keine Breaking Changes.

### Bug Fixes

- **PGNGenerator:** korrekte Rochaden-/Beförderungs-/Schach-/Disambiguierungs-Notation (#47)
- **aiController:** ausgewogener Fallback für unbekannte Gegner-Persönlichkeiten (#46)
- **tutor:** KI-Tutor tatsächlich stärker als die Gegner-KI machen (#36)
- **ai:** Root-Level-ProbCut deaktiviert, der KI-Züge ab Elo >= 1400 fallen ließ
- **ai:** JS-Search-Bugs nach WASM-Entfernung behoben
- **ui:** mobile Action-Bar-Overflow + Board-Tap-Verhalten
- **ui:** NotificationUI XSS-sicher, barrierefrei, gestapelt
- **ui:** 2D-Board sichtbar und klickbar (board-wrapper Opacity/Pointer-Events)
- **ui:** Shop-Panel am Desktop rechts angedockt (verdeckt das Brett nicht mehr)
- **ui:** PWN->Engel-Direkt-Upgrade in Upgrade-Modi erlaubt
- **e2e:** Tutorial-Seen-Flag seeden, damit First-Run-Overlay Klicks nicht blockiert

### Features

- **aiController:** `null` zurückgeben, wenn Hint-Worker-Pool leer ist
- **aiController:** Worker-Pool-Init mit Fallback-Fehlerbehandlung gehärtet
- **aiWorker:** Heartbeat-Selbstüberwachung gegen Deadlocks
- **ui:** AI-Denkzustand im Spinner-Overlay anzeigen
- **ui:** Tutorial nur beim ersten Start (localStorage) + fehlendes `show()` bei Auto-Start

### UX / Accessibility

- dynamische Viewport-Units, erweitertes focus-visible, High-Contrast- +
  Touch-Target-Guards (#60)

### Refactoring

- **ai:** WASM-Engine entfernt, JS-Search-Root-Move-Bug behoben, CI aufgeräumt
- **AI:** AI-Timeout-Konstanten in config.ts zentralisiert

### Tests

- Uber 40 neue fokussierte Invarianten-Suiten fur Kernmodule (u.a. MoveGenerator,
  RulesEngine, Evaluate, MoveController, MoveValidator, MoveExecutor, TranspositionTable,
  AIController, CampaignManager, StatisticsManager, PGN-Generator/-Parser,
  OpeningBook(…), PuzzleManager, TacticsDetector, MoveAnalyzer, OpeningBookTrainer,
  PostGameAnalyzer, HintGenerator, ErrorManager/logger, DOMHandler, TooltipManager,
  EvaluationBar, GameController, OpeningBookUI). Gesamt-Coverage: stmts ~92% /
  fn ~91% / br ~81%.

### CI / Automation

- WASM-Build-Trigger für Dependabot-PRs repariert (Rust-Cache, Change-Detection)
- E2E nicht-blockierend gemacht, Coverage-Thresholds erzwungen
- Bundle-Budget angehoben + Chunk-Breakdown-Report
- Dependabot-Auto-Merge + Dependency-Graph-Snapshot

[1.0.1]: https://github.com/bumblei3/schach9x9/compare/v1.0.0-stable...v1.0.1

## [1.0.0] – 2026-07-10

Changes since `v1.0.0-stable`.

### Features

- **aiController:** return null when hint worker pool is empty (6476cdf)
- **aiController:** harden worker pool init with fallback error handling (7d0d30d)
- **aiWorker:** add heartbeat self-monitoring for deadlock protection (429b7a8)
- **ui:** show AI thinking state in spinner-overlay (363a72f)

### Bug Fixes

- remove unused variables and constants in Rust engine (6fb805b)
- remove PIECE_SVGS from window interface to avoid TS2687 conflict (9519124)
- resolve PIECE_SVGS window type conflict (ecedca4)
- resolve PIECE_SVGS type errors in OverlayManager and pieces/index (eb2fd04)
- **ai:** disable root-level probcut that dropped AI moves at elo>=1400 (a415511)
- **ai:** heal JS search bugs found after WASM removal (6de0789)
- **ci:** consolidate Window global types into tracked js/global.d.ts (b30f022)
- **deps:** pin vulnerable transitive deps via overrides (225bf9b)

### Documentation

- add CHANGELOG.md generated from conventional commits (62cd1e3)

### Refactoring

- **ai:** remove WASM engine, fix JS search root move bug, clean up CI (8bc2a68)
- **AI:** centralize AI timeout constants in config.ts (6eb26f2)

### Tests

- raise AnalysisUI coverage to 99% lines / 82% branches (9b28225)
- raise coverage on weakest modules (opening db/ui, analysis, tactics) (c472927)
- **aiController:** guard empty pool in getHint() (925a2fb)

### CI / Automation

- make E2E non-blocking and enforce coverage thresholds (89a6ead)
- remove dependency-submission step (action unavailable in this GH setup) (ff8797f)
- fix dependency-submission action version (v4 -> v3) (b1e46e6)
- submit dependency graph snapshot to keep vuln dashboard in sync (296651d)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (f597c76)
- retrigger (60db38e)
- remove WASM change-detection, always build to fix Dependabot PRs (943ef94)
- retrigger CI after WASM build fix (c3c5a7c)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (13a24bc)
- increase bundle budget to 2500 KB and make non-blocking for PRs (6e54678)
- remove engine-wasm/target from Rust cache to fix missing WASM artifact (4e1b9e8)
- remove WASM change-detection, always build to fix Dependabot PRs (03c5502)
- trigger WASM build on package-lock.json changes (fix Dependabot PRs) (98ba861)
- clear eslint cache (35dc8d8)
- **deps:** bump actions/checkout from 6 to 7 (1d1c343)
- **deps:** bump actions/cache from 5 to 6 (25e8c2e)
- **deps:** bump actions/checkout from 6 to 7 (9364084)

### Chores

- chore(deps-dev)(deps-dev): bump @types/node from 25.9.3 to 26.0.0 (65a9582)
- chore(deps-dev)(deps-dev): bump the development-dependencies group with 7 updates (#22) (bf8206d)
- **deps:** prefer focused npm dependency PRs over large bundles in Dependabot (604eaef)
