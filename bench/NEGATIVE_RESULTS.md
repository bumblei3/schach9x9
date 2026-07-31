# Engine Tuning — Negative Results (do NOT re-attempt)

These levers were measured via `tools/benchmark.ts` (8s self-play, 40 games,
alternate colors) and found to NOT improve the engine. Recorded so future
sessions don't waste time re-testing them.

## Mobility weight (WIDERLEGT)
- Test: AGGRESSIVE (mobilityWeight 1.3) vs SOLID (mobilityWeight 0.9) @ 8s.
- Result: SOLID won 23:8 (D=9), implied Elo diff -137 (less mobility = stronger).
- File: `bench/mobility_hyp_agg_vs_solid.txt`
- Conclusion: at 9x9, HIGHER mobility weight makes the engine WEAKER. The
  default NORMAL/SOLID config (mobility 0.9–1.0) is already correct. Do not
  raise mobilityWeight.

## Search time / depth (ALREADY MERGED — H3)
- Raising MAX_SEARCH_TIME 5s -> 8s gave +999 Elo (40:0 sweep). See PR #149.
- Further raises (10s) also swept 5s 40:0, but 8s is the chosen UI/UX trade-off.

## Levers confirmed neutral / saturated
- More pure depth alone, without more time, does not help once time-limited
  (the 5s budget caps effective depth ~7). Time is the lever, not depth param.
- Opening-book asymmetry (38:2 white-skew) is the normal first-move advantage
  amplified by the book — NOT an engine defect (see `bench/remis_study_nobook.txt`:
  without book, balanced-vs-balanced is symmetric, eloDiff 0, ~85% draws — a
  9x9 board property).

## H-P1 centered PSQT (REVERTED 2026-07-31)
- Geometric `buildCenteredPST` tables (peak at 4,4) for N/B/R/Q/A/C/E.
- matchRefs tactical FENs, elo 1600, maxMoves 40:
  - main(H-P1) vs v1.5.0 → **5:10** (n=24) — main weaker
  - main(H-P1) vs pre-H-P1 → **5:8** (n=20) — H-P1 cluster weaker
  - hand-tuned vs H-P1 → **6:5** (n=20) — hand-tuned wins
- Conclusion: do **not** wire production tables to `buildCenteredPST`.
  Helper may stay exported for experiments. Hand-tuned tables restored.

## What this means
The engine is well-calibrated at the current eval weights. Remaining strength
gains would require structural eval changes (king-safety/endgame rework) with
NO guaranteed Elo payoff — treat as speculative, gate behind a real benchmark.
H-P1 is closed as a negative result (same class as Mobility).
