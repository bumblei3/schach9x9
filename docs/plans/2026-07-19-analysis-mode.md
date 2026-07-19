# Live Analysis Mode — repaired end to end (2026-07-19)

## Summary

The "Analyse-Modus" overlay (AnalysisController + AnalysisUI + worker `analyze`
+ `#analysis-mode-btn`) was completely non-functional. Verified against the
built app with a real Playwright E2E (`e2e/analysis-live.spec.ts`) — no xvfb
shortcuts. After this work the flow works end to end:

- start classic game → `#analysis-mode-btn` opens the panel (`analysisMode:true`)
- `#continuous-analysis-btn` → worker returns ranked top moves →
  `#top-moves-content` fills with `.top-move-item`s
- best move is drawn on the board as a `.tutor-arrow`
- closing returns to normal play

## Bugs found and fixed (7)

1. **Stale game reference** — `AnalysisController` cached
   `this.game = gameController.game` in its constructor. `App.startGame()` swaps
   in a fresh `Game` each game, so `enterAnalysisMode()` mutated a dead object.
   Fixed: `game` is now a live getter reading `this.gameController.game`.
   (`js/AnalysisController.ts`)

2. **Wrong board type to worker** — `aiController.analyzePosition()` sent an
   IntBoard (`convertBoardToInt`), but `getTopMoves()` expects a UiBoard (piece
   objects). Fixed: send `this.game.board` (UiBoard). (`js/aiController.ts`)

3. **Wrong result shape from worker** — worker `case 'analyze'` returned a
   `SearchResult` (score/pv); the UI reads `topMoves[]`. Fixed: worker runs
   `getTopMoves()` and returns `{score, depth, nodes, topMoves[]}`.
   (`js/ai/aiWorker.ts`)

4. **Unbounded analysis search (worker never responded)** — the live overlay
   used `analysisDepth = 12` and `getBestMoveDetailed(board, color, depth, {})`
   with an EMPTY `timeParams` → an unbounded search that hangs on a 9x9 board,
   so the worker never posted `type:'analysis'` back. Fixed: the worker uses
   only the time-bounded `getTopMoves(board, color, topMovesCount, depth, 8000, 0)`
   for both the ranked candidates and the overall score. (`js/ai/aiWorker.ts`,
   `js/aiController.ts`)

5. **Live AnalysisUI never wired to AIController** — `DOMHandler`'s constructor
   tried `if (app.game && app.game.aiController) aiController.setAnalysisUI(...)`
   but `app.game` is `null` at construction time, so the bridge was skipped and
   `aiController.analysisUI` stayed `null` → the panel never rendered results.
   Fixed: bridge it in `App.ts` after the controllers exist. (`js/App.ts`)

6. **`analysisActive` never set** — `handleAnalysisResult()` did not set
   `this.analysisActive = true`, so the best-move arrow guard
   (`showBestMove || analysisActive`) never passed. Fixed: set the flag.
   (`js/aiController.ts`)

7. **Best-move arrow crash + wrong guard** — `AnalysisManager.updateArrows()`
   only drew the best move when `showBestMove` was toggled on (default off), so
   the live overlay never showed an arrow. Also `getBestMoveArrows()` read
   `best.from` / `best.to`, but `game.bestMoves` items are
   `{move:{from,to}, score, notation}` → `best.move` was `undefined` and the
   method threw. Fixed: draw when `game.analysisMode` is active, and read
   `best.move.from/to`. (`js/AnalysisManager.ts`)

## Also

- `js/ui/AnalysisUI.ts` — `updatePanel` lazily re-acquires
  `#top-moves-content` if the container was captured as `null` at construction
  (the live AnalysisUI is built before the panel exists in the DOM).

## Tests

- `e2e/analysis-live.spec.ts` — real end-to-end E2E (panel + top moves + arrow),
  un-skipped and GREEN.
- Worker / AnalysisManager unit tests updated to the new `getTopMoves`-based
  analysis contract (no more `getBestMoveDetailed` in the analyze path).

## Verification

- `npx vitest run` → 2927 passed
- `npx playwright test` → 81 passed, 1 skipped
- `npx tsc --noEmit` → 0 errors
