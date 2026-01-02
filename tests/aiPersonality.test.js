/**
 * Tests for AI Personality System
 */

import { evaluatePosition } from '../js/ai/Evaluation.js';
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
  describe('evaluatePosition with config', () => {
    let board;

    beforeEach(() => {
      board = createEmptyBoard();
      // Basic setup: kings on both sides
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
    });

    test('should accept config parameter', () => {
      const config = { mobilityWeight: 1.0, safetyWeight: 1.0 };
      expect(() => evaluatePosition(board, 'white', config)).not.toThrow();
    });

    test('should work without config (defaults)', () => {
      expect(() => evaluatePosition(board, 'white')).not.toThrow();
    });

    test('should work with null config', () => {
      expect(() => evaluatePosition(board, 'white', null)).not.toThrow();
    });

    test('should return different scores for different personalities', () => {
      // Add pieces to make evaluation meaningful
      placePiece(board, 7, 0, 'r', 'white');
      placePiece(board, 7, 8, 'r', 'white');
      placePiece(board, 1, 0, 'r', 'black');
      placePiece(board, 6, 4, 'p', 'white');
      placePiece(board, 2, 4, 'p', 'black');

      const balancedConfig = {
        mobilityWeight: 1.0,
        safetyWeight: 1.0,
        pawnStructureWeight: 1.0,
        centerControlWeight: 1.0,
      };

      const aggressiveConfig = {
        mobilityWeight: 1.2,
        safetyWeight: 0.8,
        pawnStructureWeight: 0.9,
        centerControlWeight: 1.2,
      };

      const defensiveConfig = {
        mobilityWeight: 0.8,
        safetyWeight: 1.5,
        pawnStructureWeight: 1.2,
        centerControlWeight: 1.0,
      };

      const balancedScore = evaluatePosition(board, 'white', balancedConfig);
      const aggressiveScore = evaluatePosition(board, 'white', aggressiveConfig);
      const defensiveScore = evaluatePosition(board, 'white', defensiveConfig);

      // Scores should be different (not necessarily inequal, but at least calculated)
      expect(typeof balancedScore).toBe('number');
      expect(typeof aggressiveScore).toBe('number');
      expect(typeof defensiveScore).toBe('number');

      // With more mobility weight, aggressive should value open positions differently
      expect(aggressiveScore !== balancedScore || defensiveScore !== balancedScore).toBe(true);
    });
  });

  describe('Mobility Weight', () => {
    test('should increase score with higher mobility weight', () => {
      const board = createEmptyBoard();
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
      placePiece(board, 4, 4, 'n', 'white'); // Knight in center - high mobility

      const lowMobility = evaluatePosition(board, 'white', { mobilityWeight: 0.5 });
      const highMobility = evaluatePosition(board, 'white', { mobilityWeight: 2.0 });

      // Higher mobility weight should value the knight's position more
      expect(highMobility).toBeGreaterThanOrEqual(lowMobility);
    });
  });

  describe('Safety Weight', () => {
    test('should penalize exposed king with high safety weight', () => {
      const board = createEmptyBoard();
      // White king in center (exposed)
      placePiece(board, 4, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
      placePiece(board, 0, 0, 'r', 'black'); // Threatening rook

      const lowSafety = evaluatePosition(board, 'white', { safetyWeight: 0.5 });
      const highSafety = evaluatePosition(board, 'white', { safetyWeight: 2.0 });

      // High safety weight should penalize the exposed king more
      expect(lowSafety).toBeGreaterThanOrEqual(highSafety);
    });
  });

  describe('Pawn Structure Weight', () => {
    test('should calculate different scores for different pawn weights', () => {
      const board = createEmptyBoard();
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
      // Doubled pawns on column 4
      placePiece(board, 6, 4, 'p', 'white');
      placePiece(board, 5, 4, 'p', 'white');

      const lowPawnWeight = evaluatePosition(board, 'white', { pawnStructureWeight: 0.5 });
      const highPawnWeight = evaluatePosition(board, 'white', { pawnStructureWeight: 2.0 });

      // Scores should differ when weights are different
      expect(lowPawnWeight).not.toBe(highPawnWeight);
    });

    test('should reward passed pawns', () => {
      const board = createEmptyBoard();
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
      // Passed pawn on rank 3 (advanced)
      placePiece(board, 2, 2, 'p', 'white');

      const score = evaluatePosition(board, 'white');
      expect(score).toBeGreaterThan(0); // Should be positive for white
    });
  });

  describe('Center Control Weight', () => {
    test('should reward pieces in center with high center weight', () => {
      const board = createEmptyBoard();
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');
      placePiece(board, 4, 4, 'n', 'white'); // Knight in center

      const lowCenter = evaluatePosition(board, 'white', { centerControlWeight: 0.5 });
      const highCenter = evaluatePosition(board, 'white', { centerControlWeight: 2.0 });

      // Higher center weight should value the central knight more
      expect(highCenter).toBeGreaterThanOrEqual(lowCenter);
    });
  });

  describe('Personality Presets', () => {
    const PERSONALITIES = {
      balanced: {
        mobilityWeight: 1.0,
        safetyWeight: 1.0,
        pawnStructureWeight: 1.0,
        centerControlWeight: 1.0,
      },
      aggressive: {
        mobilityWeight: 1.2,
        safetyWeight: 0.8,
        pawnStructureWeight: 0.9,
        centerControlWeight: 1.2,
      },
      defensive: {
        mobilityWeight: 0.8,
        safetyWeight: 1.5,
        pawnStructureWeight: 1.2,
        centerControlWeight: 1.0,
      },
      positional: {
        mobilityWeight: 1.0,
        safetyWeight: 1.1,
        pawnStructureWeight: 1.5,
        centerControlWeight: 1.4,
      },
    };

    test('all personality presets should be valid configs', () => {
      const board = createEmptyBoard();
      placePiece(board, 8, 4, 'k', 'white');
      placePiece(board, 0, 4, 'k', 'black');

      Object.entries(PERSONALITIES).forEach(([name, config]) => {
        expect(() => evaluatePosition(board, 'white', config)).not.toThrow();
      });
    });

    test('personality configs should have all required weights', () => {
      const requiredWeights = [
        'mobilityWeight',
        'safetyWeight',
        'pawnStructureWeight',
        'centerControlWeight',
      ];

      Object.entries(PERSONALITIES).forEach(([name, config]) => {
        requiredWeights.forEach(weight => {
          expect(config).toHaveProperty(weight);
          expect(typeof config[weight]).toBe('number');
        });
      });
    });
  });
});
