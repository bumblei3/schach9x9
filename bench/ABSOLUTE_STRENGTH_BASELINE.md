# Absolute Strength Baseline

## Two measurement tracks

| Track | Board | Opponent | Purpose |
|-------|-------|----------|---------|
| **A. Relative (9×9)** | 9×9 fairy | frozen git ref via `js/matchRefs.ts` | Did a lever help/hurt vs previous build? |
| **B. Absolute (8×8)** | standard 8×8 | Stockfish WASM (`stockfish@18`) | How strong is the engine in absolute terms? |

9×9 cannot use Stockfish fairly (Archbishop / Chancellor / Engel). Absolute
Elo only makes sense after the **size-aware 8×8 move gen** repair (2026-08-02)
plus double-push/promotion fixes.

---

## Track B — Stockfish match (8×8)

### Tool

```bash
npm run match:stockfish -- --games=8 --depth=4 --sf-depth=8 --sf-elo=1400
# or
npx tsx tools/stockfish-match.ts --games=4 --depth=3 --sf-depth=4 --quiet
```

| Flag | Default | Meaning |
|------|---------|---------|
| `--games=N` | 4 | games with alternating colors |
| `--depth=N` | 3 | our fixed search depth |
| `--sf-depth=N` | 4 | Stockfish fixed depth |
| `--sf-elo=N` | (full) | UCI_LimitStrength + UCI_Elo |
| `--sf-engine=` | `lite-single` | WASM flavor under `stockfish/bin` |
| `--max-plies=N` | 200 | hard cap → draw |
| `--quiet` | off | less logging |

**Dependency:** `stockfish@18` (devDependency). Engine is spawned as a **Node
child process** (UCI over stdin/stdout). In-process `engine.print` hooks do not
work with the npm package — do not "fix" that.

### Rule set (standard 8×8)

Integer engine `RuleState` tracks castling rights + EP target. Both sides play
full standard chess:

- castling KQkq when rights remain
- en passant after double pushes
- auto-queen promotion

FEN sent to SF includes rights/EP from the same state. Residual illegal SF
moves (should be rare) are scored **draw / `illegal-sf`**, never as a free win.

### Baseline results (2026-08-02)

#### Canonical row (use this for regressions)

```bash
npm run match:stockfish -- --games=20 --depth=4 --sf-depth=8 --sf-elo=1400 --quiet
```

| Metric | Value |
|--------|--------|
| **Date** | 2026-08-02 (post underpromo fix) |
| **Rules** | full standard (castle + EP + **q/r/b/n promotions**) |
| **n** | **20** (alt. colors) |
| **W–D–L (ours)** | **0–3–17** |
| **Score** | **0.075** |
| **Elo vs SF≈1400** | **≈ −436** (95% CI rough: −1200 … −251) |
| **Terminations** | checkmate=17, max-plies=3, **illegal-sf=0** |

Raw one-liner:
`RESULT oursW=0 sfW=17 D=3 score=0.0750 elo=-436.4 depth=4 sfDepth=8`

**Reading:** At fixed depth 4 the engine scores ~7.5% against Stockfish-lite
UCI Elo 1400 (SF depth 8). Clear gap — the regression floor. Openings at d4
are shallow (flank pawn pushes common).

##### illegal-sf root cause (fixed)

Previous n=20 run (queen-only promo) had **2× illegal-sf**: SF underpromoted
(`c7c8b` on FEN `…/ppPbpppp/… w - -`) while we only generated `c7c8q`.
Move gen now emits all four promotion pieces; re-run shows **0 illegal-sf**.

#### Older / smoke rows

| Setup | n | W–D–L (ours) | Score | Elo vs SF≈ | Notes |
|-------|---|--------------|-------|------------|-------|
| depth=4 vs SF d8 Elo1400 (queen-only promo) | 20 | 0–4–16 | 0.10 | ≈−382 | 2 illegal-sf voids; superseded |
| depth=2 vs SF d2 full | 2 | 0–0–2 | 0.00 | ≲ −1200 | smoke |
| depth=3 vs SF d4 full | 6 | 0–0–6 | 0.00 | ≲ −1200 | full SF |

**Any claimed strength gain must beat the canonical n=20 row** (higher score
or Elo with same flags, ideally n≥20).

### Re-run checklist (before claiming a strength gain)

1. `npx vitest run` green
2. Sanity inside the tool: 20 legal start moves, 20 after e2e4
3. Same flags as the row you compare against
4. Prefer `n ≥ 20` and report W–D–L + score, not only Elo

---

## Track A — Relative refs (9×9) — unchanged protocol

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

### Historical relative results (2026-07-31)

| Match | NEW | OLD | D | n | Reading |
|-------|-----|-----|---|---|---------|
| main+H-P1 vs v1.5.0 | 5 | 10 | 9 | 24 | NEW weaker |
| main vs pre-H-P1 | 5 | 8 | 7 | 20 | H-P1 cluster weaker |
| hand-tuned PSQT vs H-P1 | 6 | 5 | 9 | 20 | H-P1 rejected |
| hand-tuned vs v1.5.0 | 5 | 7 | 12 | 24 | closer to parity |

H-P1 was reverted; see `bench/NEGATIVE_RESULTS.md`.

---

## Next levers (honest)

1. **Castling + en passant** on the int board (8×8) → fewer voids, fairer SF games
2. Re-baseline vs SF Elo 1400 / 1600 at fixed depth
3. Only then consider search/eval changes gated by this table
4. 9×9 remains feature-complete / parked for relative levers only
