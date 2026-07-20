# Changelog

Alle nennenswerten Änderungen an Schach 9x9. Versionierung folgt [SemVer](https://semver.org/lang/de/).
Generiert aus den Git-Commits via `npm run changelog`.

## [1.6.2] – 2026-07-20

Changes since `v1.6.1`.

### Bug Fixes

- **analysis:** repair live analysis entry, arrow + remaining pipeline bugs (#153) (#153) (13c3d7e)
- **analysis:** repair live engine analysis pipeline (3 bugs) (#152) (113359d)
- **engine:** respect explicit search depth in benchmarks + add depth-aware harness (#148) (ac1391b)

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
