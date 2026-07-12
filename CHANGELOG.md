# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

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
