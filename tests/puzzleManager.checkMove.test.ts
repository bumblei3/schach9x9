import { describe, expect, test } from 'vitest';
import { PuzzleManager } from '../js/puzzleManager.js';
import type { GameLike, PieceType } from '../js/types/game.js';

// `PuzzleManager.checkMove` is DOM-free pure logic: it compares a played
// move against the current expected solution step (read from
// `this.puzzles[this.currentPuzzleIndex].solution`) and advances the
// puzzle state. The remaining uncovered branches in the file
// (localStorage, procedural generation, board-string setup) need a
// DOM/browser env, so we isolate just the move-validation core here.

type MoveResult = {
  from: { r: number; c: number };
  to: { r: number; c: number };
  promotion?: PieceType | null;
  piece?: PieceType;
};

const m = (fr: number, fc: number, tr: number, tc: number): MoveResult => ({
  from: { r: fr, c: fc },
  to: { r: tr, c: tc },
});

function makeGame(currentIndex = 0): any {
  return {
    puzzleState: {
      id: 'test',
      active: true,
      currentMoveIndex: currentIndex,
      puzzleId: 'test',
      solved: false,
      failed: false,
      solution: [] as any[],
    },
  } as GameLike;
}

function registerPuzzle(pm: PuzzleManager, solution: MoveResult[]) {
  // Overwrite the manager's puzzle list so checkMove reads OUR solution.
  (pm as any).puzzles = [
    {
      id: 'test',
      title: 'test',
      description: '',
      difficulty: 'Einfach',
      solution,
    },
  ];
  pm.currentPuzzleIndex = 0;
}

describe('PuzzleManager.checkMove — solution validation', () => {
  test('a correct move that is not the last step returns "continue" and advances', () => {
    const pm = new PuzzleManager();
    const solution = [m(0, 0, 0, 1), m(0, 1, 0, 2)];
    registerPuzzle(pm, solution);
    const game = makeGame(0);
    const result = pm.checkMove(game, m(0, 0, 0, 1));
    expect(result).toBe('continue');
    expect(game.puzzleState.currentMoveIndex).toBe(1);
    expect(game.puzzleState.solved).toBe(false);
  });

  test('a correct move on the final step returns "solved" and deactivates', () => {
    const pm = new PuzzleManager();
    const solution = [m(0, 0, 0, 1), m(0, 1, 0, 2)];
    registerPuzzle(pm, solution);
    const game = makeGame(1); // about to play the last step
    const result = pm.checkMove(game, m(0, 1, 0, 2));
    expect(result).toBe('solved');
    expect(game.puzzleState.currentMoveIndex).toBe(2);
    expect(game.puzzleState.solved).toBe(true);
    expect(game.puzzleState.active).toBe(false);
  });

  test('a wrong move returns "wrong" and does not advance', () => {
    const pm = new PuzzleManager();
    const solution = [m(0, 0, 0, 1), m(0, 1, 0, 2)];
    registerPuzzle(pm, solution);
    const game = makeGame(0);
    const result = pm.checkMove(game, m(0, 0, 0, 7)); // wrong destination
    expect(result).toBe('wrong');
    expect(game.puzzleState.currentMoveIndex).toBe(0); // unchanged
    expect(game.puzzleState.solved).toBe(false);
  });

  test('checkMove returns false when no active puzzle state exists', () => {
    const pm = new PuzzleManager();
    registerPuzzle(pm, [m(0, 0, 0, 1)]);
    const game = { puzzleState: null } as unknown as GameLike;
    expect(pm.checkMove(game, m(0, 0, 0, 1))).toBe(false);
  });

  test('getPuzzle finds a registered puzzle by id', () => {
    const pm = new PuzzleManager();
    const found = pm.getPuzzle('mate-in-1-001');
    expect(found).toBeDefined();
    expect(found!.solution.length).toBeGreaterThan(0);
  });
});
