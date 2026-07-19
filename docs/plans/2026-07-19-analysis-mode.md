# Live Analysis Mode — Investigation & Partial Fix (2026-07-19)

## What this turned out to be

The initial idea ("build a standalone analysis mode") was wrong: an analysis
mode ALREADY exists (AnalysisController + AnalysisUI + worker `analyze` +
`#analysis-mode-btn`). So the real work became: verify it works and fix it.

An E2E against the built app proved the LIVE analysis overlay was fully broken.
Three real bugs were found and fixed:

1. **Stale game reference** — `AnalysisController` cached `this.game =
   gameController.game` in its constructor. `App.startGame()` replaces
   `gameController.game` with a fresh `Game` each game, so `enterAnalysisMode()`
   was mutating a dead object. Fixed: `game` is now a live getter that reads
   `this.gameController.game`.

2. **Wrong board type to worker** — `aiController.analyzePosition()` sent an
   IntBoard (`convertBoardToInt`), but `aiEngine.analyzePosition()` /
   `getTopMoves()` expect a UiBoard (piece objects). The mismatch produced empty
   results. Fixed: send `this.game.board` (UiBoard).

3. **Wrong result shape from worker** — worker `case 'analyze'` returned a
   `SearchResult` (score/pv), but the UI (`AnalysisUI.update`) reads `topMoves[]`.
   Fixed: worker now runs `getTopMoves()` and returns a `{score, depth, nodes,
   topMoves[]}` payload.

## Still broken (documented, not yet fixed)

The **entry point** is not wired in the running app: in a real browser
`app.gameController.enterAnalysisMode` resolves to `undefined`, and clicking
`#analysis-mode-btn` never flips `game.analysisMode` to true, so the panel never
opens. The App / game / gameController / DOMHandler instance wiring needs
untangling before the flow works end to end.

The E2E (`e2e/analysis-live.spec.ts`) is committed as `test.skip` with this
explanation, so the next session has a ready failing-flow reproduction to un-skip
once the wiring is fixed. This is an honest record, not a green fake.

## Files touched

- `js/AnalysisController.ts` — game getter (fix #1)
- `js/aiController.ts` — UiBoard to worker (fix #2)
- `js/ai/aiWorker.ts` — topMoves payload (fix #3)
- `e2e/analysis-live.spec.ts` — skipped E2E documenting the remaining wiring bug
