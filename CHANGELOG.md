# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.6.2] – 2026-07-20

Changes since `v1.6.1`.

### Bug Fixes

- **8x8 full standard rules on integer engine: castling + en passant +
  double-push + auto-queen.** `RuleState` (`setRules`/`getRules`) tracks
  castling rights + EP square; `makeMove`/`undoMove` update and restore them.
  9×9 default remains rights=0 (no behaviour change without opt-in). Double-push
  ranks size-aware. (2026-08-02)
- **8x8 pawn double-push + auto-queen promotion (Integer-Engine).**
  Doppelzug-Startreihen waren hardcodiert (weiß rank 6 / schwarz rank 2) und
  passten nicht zu `gameEngine` (weiß `size-2`, schwarz rank 1) — nach e2e4
  hatte Schwarz nur 12 statt 20 legale Züge. Jetzt size-aware (+ Legacy 6/2
  für alte 9×9-Testbretter). Bauern auf der letzten Reihe promoten Auto-Dame;
  `makeMove`/`undoMove` wenden Promotion korrekt an. (2026-08-02)
- **8x8-Modus repariert — Move-Generierung size-aware (gemessen, 2936 Tests grün).**
  Der `standard8x8`-Modus war fundamental broken: `genLegalInt`/MoveGenerator war
  hart auf 9x9 codiert (SQUARE_COUNT=81, fixe Offsets UP=-9, isValidSquare ohne
  Wrap-Schutz, indexToRow/Col mit /9) → `getAllLegalMoves` auf 8x8 lieferte 19/38
  out-of-range Züge, Engine konnte nicht legal ziehen. Repair: Offsets +
  SQUARE_COUNT + isValidSquare (Spalten-Wrap) + indexToRow/Col aus
  `getCurrentBoardSize()` abgeleitet (lazy, nicht beim Modul-Laden — sonst
  Load-Order-Crash via circular import). Bei size=9 exakt No-Op (keine 9x9-
  Regression). 8x8 liefert jetzt korrekte 20 Startzüge, 0 out-of-range. Der
  absolute Stockfish-Match (README-Lücke) ist damit wieder möglich. (2026-08-02)
- **analysis:** repair live analysis entry, arrow + remaining pipeline bugs (#153) (#153) (13c3d7e)
- **analysis:** repair live engine analysis pipeline (3 bugs) (#152) (113359d)
- **engine:** respect explicit search depth in benchmarks + add depth-aware harness (#148) (ac1391b)

### Tools

- **Absolute strength vs Stockfish (8×8):** `tools/stockfish-match.ts` +
  `npm run match:stockfish`. Headless Child-Process UCI gegen `stockfish@18`
  (lite-single). Symmetrische Regeln (keine Rochade/EP, Auto-Dame). Baseline
  in `bench/ABSOLUTE_STRENGTH_BASELINE.md`. (2026-08-02)

### Documentation

- **Absolute Stockfish baseline** dokumentiert (Track B 8×8 + Track A 9×9 refs).
  STATUS.md: nächster Hebel = Rochade/EP, nicht weitere 9×9-Search-Knobs.
- **8x8-Modus repariert (siehe Bug Fixes).** Vorheriger Eintrag "8x8-Modus broken
  — absoluter Stockfish-Match gescheitert" wird hiermit durch den erfolgreichen
  Repair ersetzt: die Move-Generierung ist jetzt size-aware, der `standard8x8`-
  Modus funktional. (2026-08-02)

### Performance

- **search:** raise MAX_SEARCH_TIME 5s -> 8s (H3, deeper search) (#149) (3b00581)

### Documentation

- reflect verified reality — engine feature-complete/parked, book-eval measured (#156) (#157) (a54e277)

### Chores

- chore(deps-dev)(deps-dev): bump vite from 8.1.4 to 8.1.5 in the runtime-dependencies group (#155) (316ebfa)
- chore(deps-dev)(deps-dev): bump the development-dependencies group with 3 updates (#154) (6b37dd7)
- **bench:** document negative engine-tuning results (mobility lever rejected) (#151) (7061f42)
- **tests:** delete dead _repro debug files (0-assertion scratch) (#147) (442d44a)
- **tools:** opening-book quality evaluator (#156) (842b262)
- **tools:** benchmark + analysis tooling and documented baselines (#150) (db99ed9)

### Notes (verified reality)

- **Engine-Stärkung: feature-complete / geparkt.** Alle Such-Hebel (H3 8s,
  H-Q1 Delta-Pruning, LMR 2.0, IIR-Skip, H4 time-probe, H-P1 PSQT) sind
  gemergt, aber bei fester Zeit/Depth nicht messbar stärker (40 Partien
  15:15 equal). **Mobility-Lever abgelehnt** (#151, negative Tuning-Messung),
  **NNUE geparkt** (2026-07-17).
- **Eröffnungsbuch-Qualität gemessen (#156):** `tools/book-eval.ts` verglich
  den Buch-Zug mit den Engine-Top-Moves (depth 6, 200 Stichproben) →
  **Top-1 16%, Top-3 42.5%, Top-5 62%, Eval-Loss 16.1cp.** Bewusstes
  **Vielfalt-Buch** (kein Engine-Optimum); Stärkungs-Nachbesserung würde den
  Vielfalt-Zweck (#146) torpedieren → ⏸️ geparkt.
