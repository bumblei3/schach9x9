# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.9.0] – 2026-08-23

Changes since `v1.8.0`.

### Engine

- **M1.1: Inkrementeller Zobrist-Hash + Quiesce-Negamax-Fix** (Fenster +
  Perspektive gekoppelt). Track B n=40 vs SF-1400 (d5 vs SF d8): 0.575 /
  Elo +52 → **~+230 Elo gegenüber der v1.8.0-Baseline**. (`f91e116`)
- NMP-Symmetrie + Maximizing-Handoff im rekursiven Suchpfad gefixt. (`5c07f0a`)

### Added

- **NNUE-Pipeline** (Datagen-Tool, NumPy-Trainer, JS-Inference, Eval-Blend-Hook
  default-off, Selfmatch-Wiring). (`9526e9e`…`e5b4e81`)
- **selfmatch.ts:** nativer 9×9-Selbstspiel-Match-Runner mit Elo + binomialem
  95%-CI — kalibriert d4-vs-d3 n=30: +280 Elo. (`7e9133a`)
- Eval-Knobs als `EvalConfig`-Optionen: bishopPairBonus, passedPawnEgMult;
  SearchKnobs (lmrBaseDepth, nullMoveR, probcutReduction). Defaults unverändert.
- NNUE v2-Netz (2×256 hidden, 39.5k Samples): 72.8% Agreement.

### Measured / Negative Results

- E1 bishopPairBonus 50: −47 [−185..+78] → keep 30. E2 passedPawnEgMult 2.5:
  −58 [−200..+65] → keep 2.0. S1 lmrBaseDepth 3: −280 → keep 4. S2 lmr5,
  S3 nmr2: neutral. MAX_SEARCH_TIME 10s: −44 → keep 8s. Alle nativ selfmatch
  n=30/40; Logs unter `bench/`.
- **NNUE-Gate NEGATIV:** blend w=0.3 n=80 d3 → −132 Elo [−223..−55] vs PST.
  Blend bleibt default-off, Track geparkt. (`473765c`)

### Fixed

- Datagen argv-Parsing-Bug (`--data=x` wurde nie erkannt). (`0bc36a2`)
- Lint: ungenutzter `readFileSync`-Import in evaluate.ts (CI-Gate). (`568f253`)

## [1.7.0] – 2026-08-20

Changes since `v1.6.2`.

### Engine

- **Static eval:** Läuferpaar (zentrale, unbelastete Paare), Freibauer-Endspiel
  (2.0×), Turm auf der 7. Reihe mit File-Scaling. (`59164cf`)
- **LMR_MAX_REDUCTION 2 → 3.** LMR=2 war auf d4 eine Regression (−53 cp vs
  +9 cp bei LMR=3, n=40). d3 innerhalb des Rauschens. (`8b84535` / `5cd2324`)
- **Track B (8×8 vs SF Elo 1400, d4 vs SF d8, n=20):** Release-Check 0–1–19 /
  0.025 / −636. Same-harness A/B danach: pre-eval `fbba0c8` 0.100 (−382),
  v1.7.0-Rerun 0.125 (−338). Die −200 cp vs. der August-Baseline sind
  **n=20-Rauschen**, kein Eval-Rückschritt. Logs unter `bench/sf_match_*.log`.

### Added

- **Interaktiver Post-Game-Replay-Overlay.** Partie nach dem Ende Zug für Zug
  nachspielen. (`d6f0b3f`)
- **Position teilen per Link.** (`f418f44`)

### Fixed

- TypeScript-Fehler im Replay-Overlay (`AnalysisUI.ts`). (`fbba0c8`)
- Lint: ungenutzte Replay-Handler-Parameter. (`ff07329`)

### Notes

- 8×8-Regel-Repair (Rochade, EP, Unterpromotion, size-aware Move-Gen) und
  Worker/Opening-Book für Standardschach sind im 1.6.2-Abschnitt dokumentiert
  (Commits nach dem 1.6.2-Tag, vor 1.7.0).
- d5-Diagnose (LMR=2, n=40): EloDiff −147 cp, avgMaxDepth 4.8 bei 8 s/Zug —
  Suche erreicht die angeforderte Tiefe nicht. Keine neuen Eval-Terme; n=20
  kann 200-cp-Claims nicht tragen (n≥40 für künftige Hebel).
- 9×9-Such-Hebel bleiben feature-complete / geparkt.

## [1.6.2] – 2026-07-20

Changes since `v1.6.1`.

### Bug Fixes

- **Standard 8×8 Solo-UX: AI geometry + opening book.** Workers now receive
  `setBoardVariant` (8×8 move-gen + castling/EP rules); `opening-book-8x8.json`
  shipped under `public/`; menu copy no longer claims “9×9 rules”. Main-thread
  book loader can switch files. (2026-08-02)
- **8x8 underpromotion (illegal-sf root cause).** Pawn promotions now generate
  all of q/r/b/n (queen first for ordering). Stockfish underpromotions such as
  `c7c8b` no longer void match games; n=20 SF Elo1400 re-run → 0 illegal-sf.
  (2026-08-02)
- **8x8 full standard rules on integer engine: castling + en passant +
  double-push + promotions.** `RuleState` (`setRules`/`getRules`) tracks
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
