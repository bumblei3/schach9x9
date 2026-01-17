import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BOARD_SIZE } from '../js/gameEngine.js';

// Mock ProceduralGenerator BEFORE importing PuzzleManager
vi.mock('../js/puzzle/ProceduralGenerator.js', () => ({
  ProceduralGenerator: {
    generatePuzzle: vi.fn(() => ({
      id: 'proc-mock-123',
      title: 'Mock Generated Puzzle',
      description: 'Mock description',
      difficulty: 'Easy',
      setupStr:
        '..'.repeat(4) +
        'bk' +
        '..'.repeat(7) +
        'bpbpbp' +
        '..'.repeat(48) +
        'wr' +
        '..'.repeat(3) +
        'wk' +
        '..'.repeat(13) +
        'w',
      solution: [{ from: { r: 7, c: 0 }, to: { r: 0, c: 0 } }],
    })),
  },
}));

const { PuzzleManager } = await import('../js/puzzleManager.js');
const { Game } = await import('../js/gameEngine.js');

describe('PuzzleMode', () => {
  let puzzleManager: any;
  let game: any;

  beforeEach(() => {
    puzzleManager = new PuzzleManager();
    game = new Game(15, 'classic');
  });

  test('should load a puzzle correctly', () => {
    const puzzle = puzzleManager.loadPuzzle(game, 0); // Load first puzzle (Mate in 1)

    expect(puzzle).toBeDefined();
    expect(game.mode).toBe('puzzle');
    expect(game.puzzleState.active).toBe(true);

    // New Puzzle 1: White King at 2,2; Black King at 0,2; White Rook at 1,7
    expect(game.board[2][2].type).toBe('k');
    expect(game.board[0][2].type).toBe('k');
    expect(game.board[1][7].type).toBe('r');
  });

  test('should validate correct move', () => {
    puzzleManager.loadPuzzle(game, 0); // Mate in 1

    // Correct move: R(1,7) -> R(0,7)
    const move = {
      from: { r: 1, c: 7 },
      to: { r: 0, c: 7 },
    };

    const result = puzzleManager.checkMove(game, move);
    expect(result).toBe('solved');
    expect(game.puzzleState.solved).toBe(true);
  });

  test('should reject wrong move', () => {
    puzzleManager.loadPuzzle(game, 0);

    // Wrong move: R(1,7) -> R(1,6)
    const move = {
      from: { r: 1, c: 7 },
      to: { r: 1, c: 6 },
    };

    const result = puzzleManager.checkMove(game, move);
    expect(result).toBe('wrong');
    expect(game.puzzleState.solved).toBe(false);
  });

  test('should handle puzzle 2 (back-rank mate)', () => {
    puzzleManager.loadPuzzle(game, 1); // Mate in 1 (back-rank)

    // Correct move: R(7,0) -> R(0,0) for back-rank mate
    const move = {
      from: { r: 7, c: 0 },
      to: { r: 0, c: 0 },
    };

    const result = puzzleManager.checkMove(game, move);
    expect(result).toBe('solved');
    expect(game.puzzleState.solved).toBe(true);
  });

  test('should load Puzzle 3 (Archbishop)', () => {
    const puzzle = puzzleManager.loadPuzzle(game, 2);
    expect(puzzle.id).toBe('mate-in-1-arch');
    expect(game.board[2][2].type).toBe('a');
  });

  test('should navigate to next puzzle', () => {
    puzzleManager.loadPuzzle(game, 0);
    const next = puzzleManager.nextPuzzle(game);
    expect(next.id).toBe('mate-in-1-rook');
    expect(puzzleManager.currentPuzzleIndex).toBe(1);
  });

  test('should generate new puzzle when list exhausted', () => {
    // This will now trigger the mock
    puzzleManager.loadPuzzle(game, puzzleManager.puzzles.length - 1);
    const next = puzzleManager.nextPuzzle(game);
    expect(next).not.toBeNull();
    expect(next.id).toMatch(/^proc-/);
  });

  test('should find puzzle by id', () => {
    const p = puzzleManager.getPuzzle('mate-in-1-arch');
    expect(p).toBeDefined();
    expect(p.title).toContain('Erzbischof');
  });

  test('should generate and load a mate in 1 puzzle', () => {
    // Clear board
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    // Setup a simple mate in 1 on board
    game.board[0][0] = { type: 'k', color: 'black' };
    game.board[2][1] = { type: 'k', color: 'white' };
    game.board[1][7] = { type: 'r', color: 'white' };
    game.turn = 'white';

    const puzzle = puzzleManager.generateAndLoad(game, 1);
    expect(puzzle).not.toBeNull();
    expect(puzzle.id).toContain('gen-');
    expect(game.puzzleState.active).toBe(true);
    expect(puzzle.solution.length).toBe(1);
  });
});
