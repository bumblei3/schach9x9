import { jest } from '@jest/globals';
import { PuzzleManager } from '../js/puzzleManager.js';
import { Game } from '../js/gameEngine.js';
import { PHASES, BOARD_SIZE } from '../js/gameEngine.js';

describe('PuzzleMode', () => {
  let puzzleManager;
  let game;

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
      to: { r: 0, c: 7 }
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
      to: { r: 1, c: 6 }
    };

    const result = puzzleManager.checkMove(game, move);
    expect(result).toBe('wrong');
    expect(game.puzzleState.solved).toBe(false);
  });

  test('should handle multi-step puzzles', () => {
    puzzleManager.loadPuzzle(game, 1); // Mate in 2

    // Move 1: R(6,4) -> R(1,4)
    const move1 = {
      from: { r: 6, c: 4 },
      to: { r: 1, c: 4 }
    };

    const result1 = puzzleManager.checkMove(game, move1);
    expect(result1).toBe('continue');
    expect(game.puzzleState.currentMoveIndex).toBe(1);

    // Move 2: R(2,0) -> R(0,0)
    const move2 = {
      from: { r: 2, c: 0 },
      to: { r: 0, c: 0 }
    };

    const result2 = puzzleManager.checkMove(game, move2);
    expect(result2).toBe('solved');
    expect(game.puzzleState.solved).toBe(true);
  });
});
