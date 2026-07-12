import { describe, expect, test, beforeEach } from 'vitest';
import { evaluatePosition } from '../js/aiEngine.js';
import { BOARD_SIZE, type Piece } from '../js/gameEngine.js';

// Helper to create empty board
function createEmptyBoard(): (Piece | null)[][] {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}

// Helper to place pieces
function placePiece(board: (Piece | null)[][], r: number, c: number, type: any, color: any) {
  board[r][c] = { type, color } as Piece;
}

describe('AI Personality System', () => {
  describe('evaluatePosition with personalities', () => {
    let board: (Piece | null)[][];

    beforeEach(() => {
      board = createEmptyBoard();
      // Basic setup: kings on both sides
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
    });

    test('should work with basic board', async () => {
      await expect(evaluatePosition(board as any, 'white')).resolves.not.toThrow();
    });

    test('should return a score', async () => {
      const score = await evaluatePosition(board as any, 'white');
      expect(typeof score).toBe('number');
    });

    test('should work for both colors', async () => {
      const whiteScore = await evaluatePosition(board as any, 'white');
      const blackScore = await evaluatePosition(board as any, 'black');
      expect(typeof whiteScore).toBe('number');
      expect(typeof blackScore).toBe('number');
    });

    test('should work with more pieces on board', async () => {
      placePiece(board, 7, 0, 'r', 'white');
      placePiece(board, 7, 8, 'r', 'white');
      placePiece(board, 1, 0, 'r', 'black');
      placePiece(board, 6, 4, 'p', 'white');
      placePiece(board, 2, 4, 'p', 'black');

      const score = await evaluatePosition(board as any, 'white');
      expect(typeof score).toBe('number');
    });
  });
});
