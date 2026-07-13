/**
 * Focused tests for js/puzzleManager.ts — the puzzle state machine.
 *
 * puzzleManager had NO dedicated test file before this. The core invariants
 * of a puzzle — apply a setup, step through the solution move-by-move, and
 * detect solved / continue / wrong / inactive — were only exercised
 * indirectly through MoveExecutor wiring. This suite locks the PuzzleManager
 * API directly with real assertions:
 *   - loadPuzzle: setupStr board reconstruction + functional setup fallback
 *   - checkMove: 'continue' | 'solved' | 'wrong' | false(inactive) state machine
 *   - generateAndLoad: returns false when no mate sequence exists
 *   - markSolved / isSolved: localStorage round-trip (mocked) + error tolerance
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// jsdom-free: provide a minimal localStorage mock so markSolved/isSolved run.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
} as unknown as Storage);

const { PuzzleManager } = await import('../js/puzzleManager.js');

// A minimal GameLike stub — only the fields loadPuzzle/checkMove touch.
function makeGame() {
  return {
    phase: 'MENU' as string,
    mode: '' as string,
    turn: 'white' as 'white' | 'black',
    points: 0,
    capturedPieces: { white: [], black: [] } as any,
    moveHistory: [] as any[],
    board: null as any,
    puzzleState: null as any,
    _forceFullRender: false,
  } as any;
}

describe('PuzzleManager.loadPuzzle', () => {
  let pm: any;
  beforeEach(() => {
    pm = new PuzzleManager();
  });

  test('reconstructs a board from setupStr and arms the puzzle state', () => {
    const game = makeGame();
    const puzzle = pm.loadPuzzle(game, 0) as any;

    expect(puzzle.id).toBe('mate-in-1-001');
    // setupStr produced a concrete 9x9 board (not the stub null board).
    expect(Array.isArray(game.board)).toBe(true);
    expect(game.board.length).toBe(9);
    // The solution move from the puzzle is mirrored into the live puzzleState.
    expect(game.puzzleState.active).toBe(true);
    expect(game.puzzleState.currentMoveIndex).toBe(0);
    expect(game.puzzleState.solution.length).toBe(1);
    expect(game.puzzleState.solution[0]).toMatchObject({
      from: { r: 1, c: 7 },
      to: { r: 0, c: 7 },
    });
    expect(game.phase).toBe('PLAY');
    expect(game.mode).toBe('puzzle');
  });

  test('functional setup() is used when setupStr is absent', () => {
    const game = makeGame();
    // Inject a puzzle that uses setup() instead of setupStr.
    pm.puzzles.push({
      id: 'fn-setup',
      title: 'Fn setup',
      description: 'x',
      difficulty: 'Einfach',
      setup: (g: any) => {
        g.board = Array(9)
          .fill(null)
          .map(() => Array(9).fill(null));
        g.board[4][4] = { type: 'q', color: 'white' };
        g.turn = 'white';
      },
      solution: [{ from: { r: 4, c: 4 }, to: { r: 0, c: 0 } }],
    });
    const idx = pm.puzzles.length - 1;
    const puzzle = pm.loadPuzzle(game, idx) as any;

    expect(puzzle.id).toBe('fn-setup');
    expect(game.board[4][4]).toMatchObject({ type: 'q', color: 'white' });
  });
});

describe('PuzzleManager.checkMove — state machine', () => {
  let pm: any;
  let game: any;
  beforeEach(() => {
    pm = new PuzzleManager();
    game = makeGame();
    pm.loadPuzzle(game, 0); // mate-in-1: solution [{r1c7 -> r0c7}]
  });

  test('returns "solved" when the final (only) solution move is played', () => {
    const res = pm.checkMove(game, { from: { r: 1, c: 7 }, to: { r: 0, c: 7 } });
    expect(res).toBe('solved');
    expect(game.puzzleState.solved).toBe(true);
    expect(game.puzzleState.active).toBe(false);
  });

  test('returns "wrong" for a non-matching move', () => {
    const res = pm.checkMove(game, { from: { r: 1, c: 7 }, to: { r: 2, c: 7 } });
    expect(res).toBe('wrong');
    // Puzzle stays active, move index unchanged.
    expect(game.puzzleState.active).toBe(true);
    expect(game.puzzleState.currentMoveIndex).toBe(0);
  });

  test('returns "continue" then "solved" across a multi-move solution', () => {
    const g2 = makeGame();
    pm.loadPuzzle(g2, 4); // double-rook-mate: 3 moves (W, B, W)
    // Move 1 (white rook): correct -> continue
    expect(pm.checkMove(g2, { from: { r: 2, c: 0 }, to: { r: 1, c: 0 } })).toBe('continue');
    expect(g2.puzzleState.currentMoveIndex).toBe(1);
    // Move 2 (black king, forced): correct -> continue
    expect(pm.checkMove(g2, { from: { r: 0, c: 4 }, to: { r: 0, c: 3 } })).toBe('continue');
    expect(g2.puzzleState.currentMoveIndex).toBe(2);
    // Move 3 (white rook, mate): correct -> solved
    expect(pm.checkMove(g2, { from: { r: 3, c: 1 }, to: { r: 0, c: 1 } })).toBe('solved');
    expect(g2.puzzleState.solved).toBe(true);
  });

  test('returns false when no puzzle is active', () => {
    const g3 = makeGame();
    // Without loadPuzzle, puzzleState is null -> inactive.
    expect(pm.checkMove(g3, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } })).toBe(false);
  });
});

describe('PuzzleManager.generateAndLoad', () => {
  let pm: any;
  beforeEach(() => {
    pm = new PuzzleManager();
  });

  test('returns false when no mate sequence can be found', () => {
    // A board with only two lone kings cannot produce a forced mate.
    const game = makeGame();
    game.board = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    game.board[0][0] = { type: 'k', color: 'white' };
    game.board[8][8] = { type: 'k', color: 'black' };
    game.turn = 'white';

    const result = pm.generateAndLoad(game, 2);
    expect(result).toBe(false);
  });
});

describe('PuzzleManager.markSolved / isSolved (localStorage)', () => {
  let pm: any;
  beforeEach(() => {
    pm = new PuzzleManager();
    store.clear();
  });

  test('round-trips a solved marker and reports it', () => {
    expect(pm.isSolved('mate-in-1-001')).toBe(false);
    pm.markSolved('mate-in-1-001');
    expect(pm.isSolved('mate-in-1-001')).toBe(true);
    // Marking again is idempotent (no duplicate entries).
    pm.markSolved('mate-in-1-001');
    const raw = JSON.parse(store.get('schach_solved_puzzles') || '[]');
    expect(raw.filter((id: string) => id === 'mate-in-1-001')).toHaveLength(1);
  });

  test('isSolved tolerates corrupt localStorage without throwing', () => {
    store.set('schach_solved_puzzles', 'not json');
    expect(() => pm.isSolved('x')).not.toThrow();
    expect(pm.isSolved('x')).toBe(false);
  });
});
