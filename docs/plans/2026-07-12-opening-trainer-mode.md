# Eröffnungs-Trainer (Opening Trainer Mode) — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a new solo game mode "Eröffnungs-Trainer" where the player is shown an
opening position from the trained book and must find the engine-endorsed book move;
progress (solved lines, accuracy) is persisted in localStorage.

**Architecture:** Reuse the existing `OpeningBook` (js/ai/OpeningBook.ts) as the source
of truth for the "correct" move (it already stores weighted engine-self-play results),
the trained book data in `public/opening-book.json`, and `StorageManager`
(js/storage.ts) for progress. Mirror the `PuzzleMenu` + `puzzleManager` pattern: a
`OpeningTrainerManager` (pure logic, fully unit-tested) plus an `OpeningTrainerMenu`
(thin DOM/card UI). Register the mode in `App.init(mode)` like the puzzle mode. No new
engine code, no new HTML screens beyond a small overlay reusing the puzzle-menu styles.

**Tech Stack:** TypeScript (strict), Vitest (unit tests), ESLint + Prettier (already
enforced), existing DOM overlay pattern from PuzzleMenu.

**Scope guard (YAGNI):** No spaced-repetition scheduling, no ratings graph, no ELO
adjustment. Just: present position → player picks move → correct/incorrect feedback →
advance → persist streak + accuracy. Keep it bite-sized; target a clean v1.1.0.

---

## Exploration already done (context)

- `js/ai/OpeningBook.ts`: `class OpeningBook` with `load(data)`, `getMove(board, turn)`
  → returns `{from,to} | null`, `getBoardHash(board, turn)`, `data: BookData`
  (`{positions: Record<string, {moves: BookMove[], seenCount: number}>}`).
  BookMove = `{from: Square; to: Square; weight: number; games: number}`.
  The book's `getMove` already does weighted-random selection, so it is a valid
  "correct answer" source.
- `public/opening-book.json`: real trained book data exists (positions keyed by hash).
  `js/ai/OpeningBook.ts` hash format is `getBoardHash(board, turn)`; the stored book
  positions use the SAME hash the trainer builds, so a position loaded into a `Game`
  board can be looked up directly.
- `js/puzzleManager.ts` + `js/ui/PuzzleMenu.ts`: the pattern to copy. `puzzleManager`
  exposes `getPuzzles()`, `isSolved(id)`, `loadPuzzle(id)`; `PuzzleMenu` renders cards
  and calls `gameController.loadPuzzle(id)`.
- `js/storage.ts`: `storageManager` singleton with `localStorage`. Add a small
  `OpeningTrainerProgress` key namespace (do NOT reuse `saveGame` — that is for full
  game snapshots).
- `js/App.ts:54` `init(initialPoints, mode='setup')` branches on mode string. A new
  `'opening-trainer'` branch is needed. Check how `mode === 'puzzle'` is dispatched
  and mirror it (grep `App.ts` for puzzle wiring before Task 6).

---

## Task 1: OpeningTrainerManager — data model + load book

**Objective:** A pure, framework-free manager that loads the book and can pick a
training position (a position hash + the expected move).

**Files:**

- Create: `js/openingTrainer.ts`
- Test: `tests/openingTrainer.test.ts`

**Step 1: Write failing test**

```ts
import { describe, test, expect } from 'vitest';
import { OpeningTrainerManager } from '../js/openingTrainer.js';
import { OpeningBook } from '../js/ai/OpeningBook.js';

describe('OpeningTrainerManager', () => {
  test('loads book data and exposes at least one trainable position', () => {
    const book = new OpeningBook();
    book.load({
      positions: {
        h1: {
          moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
          seenCount: 1,
        },
      },
    });
    const mgr = new OpeningTrainerManager(book);
    const pos = mgr.getNextPosition();
    expect(pos).not.toBeNull();
    expect(pos!.expectedMove).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
  });
});
```

**Step 2: Run to verify failure**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: FAIL — `Cannot find module '../js/openingTrainer.js'`

**Step 3: Minimal implementation** (`js/openingTrainer.ts`)

```ts
import { OpeningBook } from './ai/OpeningBook.js';
import { getBoardHash } from './move/MoveValidator.js';
import type { Square } from './gameEngine.js';

export interface TrainerPosition {
  hash: string;
  expectedMove: { from: Square; to: Square };
  seenCount: number;
}

export class OpeningTrainerManager {
  constructor(private book: OpeningBook) {}

  listPositions(): TrainerPosition[] {
    const out: TrainerPosition[] = [];
    for (const [hash, pos] of Object.entries(this.book.data.positions)) {
      if (pos.moves.length === 0) continue;
      // highest-weight move is the canonical "correct" answer
      const best = pos.moves.reduce((a, b) => (b.weight > a.weight ? b : a));
      out.push({ hash, expectedMove: { from: best.from, to: best.to }, seenCount: pos.seenCount });
    }
    return out;
  }

  getNextPosition(): TrainerPosition | null {
    const all = this.listPositions();
    return all.length ? all[Math.floor(Math.random() * all.length)] : null;
  }
}
```

**Step 4: Verify pass**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/openingTrainer.ts tests/openingTrainer.test.ts
git commit -m "feat(opening-trainer): manager loads book + picks position"
```

---

## Task 2: Move checking + progress tracking (pure)

**Objective:** Given a position and a player move, decide correct/incorrect; track
streak + accuracy in an in-memory + JSON-serializable model.

**Files:**

- Modify: `js/openingTrainer.ts`
- Modify: `tests/openingTrainer.test.ts`

**Step 1: Write failing test**

```ts
test('correct move increments streak and accuracy', () => {
  const book = new OpeningBook();
  book.load({
    positions: {
      h1: {
        moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
        seenCount: 1,
      },
    },
  });
  const mgr = new OpeningTrainerManager(book);
  const pos = mgr.getNextPosition()!;
  const res = mgr.submitMove(pos, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
  expect(res.correct).toBe(true);
  expect(mgr.progress.streak).toBe(1);
  expect(mgr.progress.accuracy).toBe(1);
});

test('wrong move resets streak but records attempt', () => {
  const book = new OpeningBook();
  book.load({
    positions: {
      h1: {
        moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
        seenCount: 1,
      },
    },
  });
  const mgr = new OpeningTrainerManager(book);
  const pos = mgr.getNextPosition()!;
  const res = mgr.submitMove(pos, { from: { r: 2, c: 2 }, to: { r: 3, c: 3 } });
  expect(res.correct).toBe(false);
  expect(res.expected).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
  expect(mgr.progress.streak).toBe(0);
});
```

**Step 2: Run to verify failure**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: FAIL — `mgr.submitMove is not a function`

**Step 3: Add to `js/openingTrainer.ts`**

```ts
export interface TrainerProgress {
  streak: number;
  attempts: number;
  correct: number;
  solvedHashes: string[];
}

export interface MoveResult {
  correct: boolean;
  expected: { from: Square; to: Square };
  progress: TrainerProgress;
}

export class OpeningTrainerManager {
  progress: TrainerProgress = { streak: 0, attempts: 0, correct: 0, solvedHashes: [] };

  constructor(private book: OpeningBook) {}

  // ... listPositions / getNextPosition from Task 1 ...

  submitMove(pos: TrainerPosition, move: { from: Square; to: Square }): MoveResult {
    const correct =
      pos.expectedMove.from.r === move.from.r &&
      pos.expectedMove.from.c === move.from.c &&
      pos.expectedMove.to.r === move.to.r &&
      pos.expectedMove.to.c === move.to.c;
    this.progress.attempts++;
    if (correct) {
      this.progress.streak++;
      this.progress.correct++;
      if (!this.progress.solvedHashes.includes(pos.hash)) {
        this.progress.solvedHashes.push(pos.hash);
      }
    } else {
      this.progress.streak = 0;
    }
    return { correct, expected: pos.expectedMove, progress: { ...this.progress } };
  }

  get accuracy(): number {
    return this.progress.attempts === 0 ? 0 : this.progress.correct / this.progress.attempts;
  }
}
```

**Step 4: Verify pass**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/openingTrainer.ts tests/openingTrainer.test.ts
git commit -m "feat(opening-trainer): move check + progress tracking"
```

---

## Task 3: Position hash -> board reconstruction

**Objective:** Turn a book position hash back into a `(Piece|null)[][]` board + turn so
it can be rendered on the existing board. The stored hash is produced by
`OpeningBook.getBoardHash(board, turn)`; we need to rebuild that board to display it.

**Files:**

- Modify: `js/openingTrainer.ts`
- Modify: `tests/openingTrainer.test.ts`

**Step 1: Write failing test**

```ts
test('reconstructBoard turns a hash back into a renderable board + turn', () => {
  const book = new OpeningBook();
  const board = createInitialBoard(); // from OpeningBookTrainer, or build minimal
  const hash = getBoardHash(board, 'white');
  book.load({
    positions: {
      [hash]: {
        moves: [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, weight: 100, games: 10 }],
        seenCount: 1,
      },
    },
  });
  const mgr = new OpeningTrainerManager(book);
  const pos = mgr.getNextPosition()!;
  const recon = mgr.reconstructBoard(pos.hash);
  expect(recon.board.length).toBe(9);
  expect(recon.turn).toBe('white');
  expect(recon.board[0][0]).not.toBeNull();
});
```

**Step 2: Run to verify failure**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: FAIL — `mgr.reconstructBoard is not a function`

**Step 3: Add `reconstructBoard(hash)`**
The OpeningBook hash encodes 81 squares × 2 chars (color + type) + 1 turn char, exactly
like `getBoardHash`. Reuse `boardToUi` (from js/utils/OpeningBookTrainer.js) inverse, or
add a decoder. Prefer decoding via the same BookData char→Piece map. Implement a small
decoder that maps the 2-char-per-square encoding back to `(Piece|null)[][]`.
Reuse `PIECE_SETS`/char tables from `js/assets/pieces/index.js` for type chars
(`p,n,b,r,q,k,a,c,e,j`) and color (`w`/`b`). Turn char is the final char (`w`/`b`).

```ts
import type { Piece } from './gameEngine.js';

export function reconstructBoardFromHash(hash: string): {
  board: (Piece | null)[][];
  turn: 'white' | 'black';
} {
  const turn = hash.endsWith('w') ? 'white' : 'black';
  const body = hash.slice(0, -1);
  const board: (Piece | null)[][] = [];
  for (let r = 0; r < 9; r++) {
    const row: (Piece | null)[] = [];
    for (let c = 0; c < 9; c++) {
      const i = (r * 9 + c) * 2;
      const colorChar = body[i];
      const typeChar = body[i + 1];
      if (colorChar === '.') {
        row.push(null);
        continue;
      }
      // map typeChar -> piece type, colorChar -> color
      row.push({
        type: CHAR_TO_TYPE[typeChar],
        color: colorChar === 'w' ? 'white' : 'black',
        hasMoved: true,
      } as Piece);
    }
    board.push(row);
  }
  return { board, turn };
}
```

Add `reconstructBoard(hash)` to the manager delegating to this function. Note: verify
`getBoardHash` uses `.` for empty squares — confirm by reading
`js/move/MoveValidator.ts:getBoardHash`. Adjust the empty-symbol check accordingly.

**Step 4: Verify pass**
Run: `npx vitest run tests/openingTrainer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/openingTrainer.ts tests/openingTrainer.test.ts
git commit -m "feat(opening-trainer): reconstruct board from book hash"
```

---

## Task 4: Persistence via StorageManager

**Objective:** Save/load `TrainerProgress` in localStorage so streaks survive reloads.

**Files:**

- Modify: `js/storage.ts` (add `saveOpeningTrainerProgress` / `loadOpeningTrainerProgress`)
- Modify: `tests/storage.test.ts` (or new `tests/openingTrainer.storage.test.ts`)

**Step 1: Write failing test**

```ts
test('opening trainer progress round-trips via storage', () => {
  const progress = { streak: 3, attempts: 5, correct: 4, solvedHashes: ['h1'] };
  storageManager.saveOpeningTrainerProgress(progress);
  const loaded = storageManager.loadOpeningTrainerProgress();
  expect(loaded).toEqual(progress);
});
```

**Step 2: Run to verify failure**
Expected: FAIL — method does not exist.

**Step 3: Implement in `js/storage.ts`**

```ts
private readonly trainerKey = 'schach9x9_opening_trainer_progress';

saveOpeningTrainerProgress(p: TrainerProgress): void {
  try { localStorage.setItem(this.trainerKey, JSON.stringify(p)); } catch { /* noop */ }
}

loadOpeningTrainerProgress(): TrainerProgress | null {
  try {
    const raw = localStorage.getItem(this.trainerKey);
    return raw ? (JSON.parse(raw) as TrainerProgress) : null;
  } catch { return null; }
}
```

Note: `TrainerProgress` type should be exported from `js/openingTrainer.ts` and imported
in `js/storage.ts` (or define a local structural type — prefer importing to keep one
source of truth).

**Step 4: Verify pass**
Run: `npx vitest run tests/openingTrainer.storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/storage.ts tests/openingTrainer.storage.test.ts
git commit -m "feat(opening-trainer): persist progress in storage"
```

---

## Task 5: OpeningTrainerMenu UI (thin DOM)

**Objective:** A menu that lists a "Start Training" entry and shows current streak /
accuracy, reusing the puzzle-menu overlay pattern.

**Files:**

- Create: `js/ui/OpeningTrainerMenu.ts`
- Modify: `index.html` (add `#opening-trainer-overlay` + `#opening-trainer-stats`,
  reuse `.puzzle-*` CSS classes)
- Test: `tests/ui/openingTrainerMenu.test.ts` (jsdom)

**Step 1: Write failing test**

```ts
test('menu renders streak + accuracy from progress', () => {
  const menu = new OpeningTrainerMenu(fakeGameController);
  menu.renderStats({ streak: 4, attempts: 6, correct: 5, solvedHashes: ['h1', 'h2'] });
  expect(document.getElementById('opening-trainer-stats')?.textContent).toContain('4');
});
```

**Step 2: Run to verify failure**
Expected: FAIL — module not found.

**Step 3: Implement `js/ui/OpeningTrainerMenu.ts`** mirroring `PuzzleMenu.ts`:

- constructor takes a `GameControllerInterface` (for `loadOpeningTrainerPosition(hash)`).
- `show()` / `hide()` toggle `#opening-trainer-overlay.hidden`.
- `renderStats(progress)` fills `#opening-trainer-stats`.
- A "Weiter" button calls `gameController.startNextTrainerPosition()`.

**Step 4: Verify pass**
Run: `npx vitest run tests/ui/openingTrainerMenu.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/ui/OpeningTrainerMenu.ts index.html tests/ui/openingTrainerMenu.test.ts
git commit -m "feat(opening-trainer): menu UI + overlay"
```

---

## Task 6: Wire the mode into App + GameController

**Objective:** Make `'opening-trainer'` a selectable mode that loads the book, shows the
first position, and handles the player's move.

**Files:**

- Modify: `js/App.ts` (mode branch)
- Modify: `js/gameController.ts` (load book, expose `startNextTrainerPosition()`,
  handle trainer move submission)
- Test: `tests/openingTrainer.flow.test.ts`

**Step 1: Write failing test**

```ts
test('GameController.startNextTrainerPosition loads a position + notifies UI', () => {
  const gc = makeGameController();
  gc.startNextTrainerPosition();
  expect(gc.currentTrainerPosition).not.toBeNull();
});
```

**Step 2: Run to verify failure**

**Step 3: Implement**

- In `App.init`, add `else if (mode === 'opening-trainer')` that constructs
  `OpeningBook`, loads `public/opening-book.json` (fetch), creates
  `OpeningTrainerManager`, shows `OpeningTrainerMenu`.
- `GameController.startNextTrainerPosition()`: pick `mgr.getNextPosition()`, reconstruct
  board via `reconstructBoard`, set `game.board` + `game.turn`, render.
- `GameController.submitTrainerMove(move)`: call `mgr.submitMove`, show feedback, update
  `storageManager` progress, then `startNextTrainerPosition()`.

**Step 4: Verify pass**
Run: `npx vitest run tests/openingTrainer.flow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add js/App.ts js/gameController.ts tests/openingTrainer.flow.test.ts
git commit -m "feat(opening-trainer): wire mode into App + GameController"
```

---

## Task 7: Full verification + release prep

**Objective:** Ensure the whole repo stays green and the feature is documented.

**Files:**

- Modify: `CHANGELOG.md` (add `[1.1.0]` section), `package.json` (1.0.4 → 1.1.0)
- Modify: `package-lock.json` (root version 1.0.4 → 1.1.0)

**Step 1: Run the full quality gate**

```bash
npx tsc --noEmit
npm run lint -- --max-warnings=0
npx prettier --check .
npm test
```

Expected: all pass (2624+ tests, plus new ones).

**Step 2: Bump version + CHANGELOG** (manual, NOT `npm run changelog` — it overwrites
history; follow the v1.0.x release flow used previously).

**Step 3: Commit, PR, merge, tag v1.1.0, `gh release create`** (squash-merge via
feature branch; main is branch-protected).

---

## Verification checklist (end-to-end)

- [ ] `OpeningTrainerManager` picks a position, checks moves, tracks progress (unit).
- [ ] Board reconstructs from hash and renders (unit + manual in browser).
- [ ] Progress persists across reload (storage unit test).
- [ ] Menu shows streak/accuracy and advances (DOM test + manual).
- [ ] `mode='opening-trainer'` launches from the main menu (manual smoke test).
- [ ] `tsc` clean, `lint --max-warnings=0` clean, `prettier` clean, full `npm test` green.
- [ ] Released as v1.1.0 (SemVer minor — new feature).

## Pitfalls

- `getBoardHash` empty-square symbol: confirm whether it uses `.` or `00` before writing
  `reconstructBoardFromHash` (Task 3). Mismatch => broken boards.
- Do NOT reuse `storageManager.saveGame` for trainer progress — that serializes a full
  `GameLike` and would collide with autosave. Use a dedicated key (Task 4).
- `public/opening-book.json` must be fetched at runtime (not imported) so it stays
  configurable; guard the fetch with a fallback to an empty book if missing.
- Keep `OpeningTrainerMenu` thin: all logic in `OpeningTrainerManager` (testable, no DOM).
