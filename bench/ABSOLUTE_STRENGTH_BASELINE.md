# Absolute Strength Baseline — 2026-07-31

## Why not Stockfish?
Schach9x9 uses fairy pieces (Archbishop, Chancellor, Engel) on a 9×9 board.
Stockfish (and other 8×8 engines) cannot be a fair external reference.
The honest substitute is **frozen git refs** via `js/matchRefs.ts`
(`NEW_REF` / `OLD_REF` worktrees + tactical FENs).

## Protocol
```bash
git worktree add -f /tmp/s9-new HEAD
git worktree add -f /tmp/s9-old v1.5.0
ln -sfn "$(pwd)/node_modules" /tmp/s9-new/node_modules
ln -sfn "$(pwd)/node_modules" /tmp/s9-old/node_modules

cd /tmp/s9-new
NEW_REF=/tmp/s9-new OLD_REF=/tmp/s9-old \
  MATCH_GAMES=6 MATCH_FENS=1 MATCH_ELO=1600 MATCH_MAXMOVES=40 \
  npx tsx js/matchRefs.ts
```

## Result 1 — main+H-P1 (c9862ec) vs v1.5.0
| File | NEW | OLD | D | n | Verdict |
|------|-----|-----|---|---|---------|
| `match_main_vs_v1.5.0_fens.txt` | 2 | 5 | 5 | 12 | NEW weaker |
| `match_main_vs_v1.5.0_fens_n24.txt` | 5 | 10 | 9 | 24 | NEW weaker (confirmed) |

## Isolation matches
| Match | NEW | OLD | D | n | Reading |
|-------|-----|-----|---|---|---------|
| main vs pre-H-P1 (`78b6536`) | 5 | 8 | 7 | 20 | H-P1+H3+H4 cluster weaker |
| pre-H-P1 vs v1.5.0 | 5 | 6 | 9 | 20 | H-Q2 revert ~neutral / slight loss |
| **hand-tuned PSQT** vs H-P1 main | **6** | 5 | 9 | 20 | hand-tuned stronger → **H-P1 rejected** |
| hand-tuned PSQT vs v1.5.0 | 5 | 7 | 12 | 24 | closer to parity; residual gap ≈ H-Q2 era |

### What changed since v1.5.0 (engine)
- H3: `MAX_SEARCH_TIME` 5s → 8s (#149)
- H4: time-probe 1000 → 256 (#135)
- H-P1: centered PSQT (#ad1b658) — **reverted 2026-07-31** (hand-tuned restored)
- H-Q2: check-extension **still off** (#130) — re-open only with a fresh gate

### Action taken
1. Restored hand-tuned PSQT tables in `js/evaluate.ts` (H-P1 no longer production).
2. `buildCenteredPST` kept exported for experiments only.
3. Documented in `bench/NEGATIVE_RESULTS.md`.

## UX shipped in parallel
Share-Position (`?fen=` deep link + menu button) — independent of engine strength.
