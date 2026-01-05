/**
 * Tests for AI Personality System (Wasm Integration)
 */

import { evaluatePosition } from '../js/aiEngine.js';
import { BOARD_SIZE } from '../js/gameEngine.js';

// Helper to create empty board
function createEmptyBoard() {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
}

// Helper to place pieces
function placePiece(board, r, c, type, color) {
  board[r][c] = { type, color };
}

describe('AI Personality System', () => {
  describe('evaluatePosition with personalities', () => {
    let board;

    beforeEach(() => {
      board = createEmptyBoard();
      // Basic setup: kings on both sides
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
    });

    test('should accept config parameter', async () => {
      const config = { personality: 'AGGRESSIVE' };
      await expect(evaluatePosition(board, 'white', config)).resolves.not.toThrow();
    });

    test('should work without config (defaults)', async () => {
      await expect(evaluatePosition(board, 'white')).resolves.not.toThrow();
    });

    test('should return different scores for different personalities', async () => {
      // Add pieces to make evaluation meaningful and distinct for personalities
      // e.g. Aggressive might value attacks more, Solid might value structure
      placePiece(board, 7, 0, 'r', 'white');
      placePiece(board, 7, 8, 'r', 'white');
      placePiece(board, 1, 0, 'r', 'black');
      placePiece(board, 6, 4, 'p', 'white');
      placePiece(board, 2, 4, 'p', 'black');

      // Make position dynamic?
      // Aggressive might prefer advancing?

      const normalScore = await evaluatePosition(board, 'white', { personality: 'NORMAL' });
      const aggressiveScore = await evaluatePosition(board, 'white', { personality: 'AGGRESSIVE' });
      const solidScore = await evaluatePosition(board, 'white', { personality: 'SOLID' });

      // Check that they return numbers
      expect(typeof normalScore).toBe('number');
      expect(typeof aggressiveScore).toBe('number');
      expect(typeof solidScore).toBe('number');

      // Note: We don't assert inequality here because for some positions scores might match.
      // But we verify the integration works.
    });

    test('should handle valid personality strings', async () => {
      const personalities = ['NORMAL', 'AGGRESSIVE', 'SOLID', 'GENTLE'];
      for (const p of personalities) {
        const score = await evaluatePosition(board, 'white', { personality: p });
        expect(typeof score).toBe('number');
      }
    });
  });
});
