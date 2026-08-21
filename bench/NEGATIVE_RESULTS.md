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

## Eval-Term experiments (n=40 vs SF-1400, 2026-08-21) — do NOT re-attempt
- mobilityWeight 1.0→1.2 → score 0.063 (≈ −470). Reverted.
- pawn=110 → score 0.100 (≈ −382). Reverted.
- TEMPO_BONUS 10→20 → score 0.125 (≈ −338), n.s. Reverted.
- eg passed-pawn 2.5× → not better than 2.0×. Reverted.

## Search-knob experiments (d5, n=40, 2026-08-21)
- LMR_MAX_REDUCTION 3→2 → score 0.125, same as untuned d5. Keep 3.
- PROBCUT_REDUCTION 3→2 → score 0.150 vs 0.163 (LMR4 winner). Keep 3.
- Pure depth 5 without search retune → 0.125, *worse* than d4 0.138.

## Keepers (for v1.8 freeze, see docs/ROADMAP.md M0)
- LMR_BASE_DEPTH=4 → 0.163 / ≈ −285
- NULL_MOVE_R=1 (with LMR4) → **0.175 / ≈ −269** (best Track B)

## What this means
Cheap eval terms and extra pruning knobs are exhausted. Remaining strength
gains are structural: incremental Zobrist (full 81-square rehash per node
today) and actually reaching depth 5. H-P1 is closed as a negative result
(same class as Mobility). Do not add eval terms until avgMaxDepth ≥ 5.0.
