/**
 * Tests for Puzzle Manager
 */

import { PuzzleManager, puzzleManager as _puzzleManager } from '../js/puzzleManager.js';
import { PuzzleGenerator } from '../js/puzzleGenerator.js';
import { ProceduralGenerator } from '../js/puzzle/ProceduralGenerator.js';

import { BOARD_SIZE } from '../js/config.js';

describe('PuzzleManager', () => {
  let game;
  let manager;

  beforeEach(() => {
    vi.spyOn(ProceduralGenerator, 'generatePuzzle').mockReturnValue({
      id: 'proc-mock',
      title: 'Mock Puzzle',
      setupStr: '..'.repeat(81) + 'w',
      solution: [],
    });

    game = {
      phase: 'PLAY',
      turn: 'white',
      board: Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null)),
      moveHistory: [],
      points: 0,
      mode: null,
      puzzleState: null,
      capturedPieces: { white: [], black: [] },
      _forceFullRender: false,
    };

    manager = new PuzzleManager();
  });

  describe('getPuzzle', () => {
    test('should return puzzle by id', () => {
      const puzzle = manager.getPuzzle('mate-in-1-001');
      expect(puzzle).toBeDefined();
      expect(puzzle.id).toBe('mate-in-1-001');
      expect(puzzle.title).toContain('Puzzle 1');
    });

    test('should return undefined for non-existent id', () => {
      const puzzle = manager.getPuzzle('non-existent-puzzle');
      expect(puzzle).toBeUndefined();
    });
  });

  describe('loadPuzzle', () => {
    test('should load puzzle at index 0', () => {
      const puzzle = manager.loadPuzzle(game, 0);

      expect(puzzle).toBeDefined();
      expect(game.mode).toBe('puzzle');
      expect(game.puzzleState.active).toBe(true);
      expect(game.puzzleState.currentMoveIndex).toBe(0);
    });

    test('should return false for invalid index', () => {
      expect(manager.loadPuzzle(game, -1)).toBe(false);
      // Index 1000 is now valid and triggers infinite generation (even indices are 'easy')
      const puzzle = manager.loadPuzzle(game, 1000);
      expect(puzzle).not.toBe(false);
      expect(puzzle.id).toMatch(/^proc-/);
    });

    test('should set up board from setupStr', () => {
      manager.loadPuzzle(game, 0);

      // Board should have pieces
      let pieceCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (game.board[r][c]) pieceCount++;
        }
      }
      expect(pieceCount).toBeGreaterThan(0);
    });

    test('should reset game state', () => {
      game.moveHistory = [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }];
      game.points = 100;

      manager.loadPuzzle(game, 0);

      expect(game.moveHistory).toEqual([]);
      expect(game.points).toBe(0);
      expect(game._forceFullRender).toBe(true);
    });
  });

  describe('checkMove', () => {
    beforeEach(() => {
      manager.loadPuzzle(game, 0);
    });

    test('should return false if puzzle not active', () => {
      game.puzzleState.active = false;
      const result = manager.checkMove(game, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
      expect(result).toBe(false);
    });

    test('should return "wrong" for incorrect move', () => {
      const wrongMove = { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } };
      const result = manager.checkMove(game, wrongMove);
      expect(result).toBe('wrong');
    });

    test('should return "solved" for correct final move', () => {
      // Get the expected solution move
      const puzzle = manager.getPuzzle('mate-in-1-001');
      const correctMove = puzzle.solution[0];

      const result = manager.checkMove(game, correctMove);
      expect(result).toBe('solved');
      expect(game.puzzleState.solved).toBe(true);
      expect(game.puzzleState.active).toBe(false);
    });
  });

  describe('nextPuzzle', () => {
    test('should load next puzzle', () => {
      manager.loadPuzzle(game, 0);
      const next = manager.nextPuzzle(game);

      expect(next).toBeDefined();
      expect(manager.currentPuzzleIndex).toBe(1);
    });

    test('should generate new puzzle when no more static puzzles', () => {
      // Mock the heavy generator to avoid 4s wait
      const mockPuzzle = {
        id: 'proc-mock',
        title: 'Mock Puzzle',
        setupStr: '..'.repeat(81) + 'w',
        solution: [],
      };
      const genSpy = vi.spyOn(ProceduralGenerator, 'generatePuzzle').mockReturnValue(mockPuzzle);

      // Load the last puzzle
      const lastIndex = manager.puzzles.length - 1;
      manager.loadPuzzle(game, lastIndex);

      const next = manager.nextPuzzle(game);
      expect(next).not.toBeNull();
      expect(next.id).toBe('proc-mock'); // Check for our mock ID

      genSpy.mockRestore();
    });
  });

  describe('Specific Puzzles', () => {
    test('Puzzle 4 should have valid setup and solution', () => {
      const p4Index = manager.puzzles.findIndex(p => p.id === 'mate-in-1-queen-001');
      expect(p4Index).not.toBe(-1);

      manager.loadPuzzle(game, p4Index);

      // Verify Setup: BK(0,0), WK(2,1), WQ(1,5)
      expect(game.board[0][0]).toEqual(expect.objectContaining({ type: 'k', color: 'black' }));
      expect(game.board[2][1]).toEqual(expect.objectContaining({ type: 'k', color: 'white' }));
      expect(game.board[1][5]).toEqual(expect.objectContaining({ type: 'q', color: 'white' }));

      // Verify Solution
      const sol = manager.getPuzzle('mate-in-1-queen-001').solution[0];
      const result = manager.checkMove(game, sol);
      expect(result).toBe('solved');
    });
  });
});

describe('PuzzleGenerator', () => {
  describe('stringToBoard', () => {
    test('should parse board string correctly', () => {
      // Create a simple board string with a white king at (8,4)
      const whiteKingPos = 8 * 9 + 4; // row 8, col 4
      let str = '';
      for (let i = 0; i < 81; i++) {
        if (i === whiteKingPos) {
          str += 'wk';
        } else {
          str += '..';
        }
      }
      str += 'w'; // White to move

      const { board, turn } = PuzzleGenerator.stringToBoard(str);

      expect(turn).toBe('white');
      expect(board[8][4]).toEqual({ type: 'k', color: 'white', hasMoved: true });
    });

    test('should handle black pieces', () => {
      const str = 'bk' + '..'.repeat(80) + 'b'; // Black king at 0,0

      const { board, turn } = PuzzleGenerator.stringToBoard(str);

      expect(turn).toBe('black');
      expect(board[0][0]).toEqual({ type: 'k', color: 'black', hasMoved: true });
    });
  });

  describe('boardToString', () => {
    test('should convert board to string', () => {
      const board = Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null));
      board[4][4] = { type: 'k', color: 'white' };

      const str = PuzzleGenerator.boardToString(board, 'white');

      expect(str).toContain('wk');
      expect(str.endsWith('w')).toBe(true);
      expect(str.length).toBe(81 * 2 + 1); // 81 cells * 2 chars + turn
    });
  });
});
