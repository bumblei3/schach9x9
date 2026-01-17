import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as TacticsDetector from '../../js/tutor/TacticsDetector.js';
import * as aiEngine from '../../js/aiEngine.js';

vi.mock('../../js/aiEngine.js', () => ({
  see: vi.fn(),
  isSquareAttacked: vi.fn(),
}));

describe('TacticsDetector Coverage', () => {
  let mockGame: any;
  let mockAnalyzer: any;

  beforeEach(() => {
    mockGame = {
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      getValidMoves: vi.fn().mockReturnValue([]),
      isSquareUnderAttack: vi.fn(),
      isInCheck: vi.fn(),
    };
    mockAnalyzer = {
      getPieceName: (t: any) => t,
    };

    vi.clearAllMocks();
  });

  describe('isTactical', () => {
    it('should return true if move captures a piece', () => {
      mockGame.board[0][0] = { type: 'p', color: 'black' };
      const move = { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } };

      const result = TacticsDetector.isTactical(mockGame, move);
      expect(result).toBe(true);
    });

    it('should return true if move is a promotion', () => {
      // White pawn to row 0
      mockGame.board[1][0] = { type: 'p', color: 'white' };
      const move = { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } };
      // Target empty

      const result = TacticsDetector.isTactical(mockGame, move);
      expect(result).toBe(true);
    });

    it('should return false for quiet move', () => {
      mockGame.board[2][0] = { type: 'p', color: 'white' };
      const move = { from: { r: 2, c: 0 }, to: { r: 1, c: 0 } };

      const result = TacticsDetector.isTactical(mockGame, move);
      expect(result).toBe(false);
    });
  });

  describe('detectTacticalPatterns', () => {
    it('should detect captures', () => {
      mockGame.board[0][0] = { type: 'p', color: 'black' };
      mockGame.board[1][0] = { type: 'r', color: 'white' };
      const move = { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } };

      vi.mocked(aiEngine.see).mockReturnValue(100); // Profitable

      const patterns = TacticsDetector.detectTacticalPatterns(mockGame, mockAnalyzer, move);
      expect(patterns).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'capture', severity: 'medium' })])
      );
    });

    it('should detect checks', () => {
      mockGame.board[1][0] = { type: 'r', color: 'white' };
      // Target square empty
      const move = { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } };

      // Simulation will move rook to 0,0.
      // Then detects check.
      (mockGame.isInCheck as any).mockReturnValue(true);

      const patterns = TacticsDetector.detectTacticalPatterns(mockGame, mockAnalyzer, move);
      expect(patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'check',
            explanation: expect.stringContaining('Schach'),
          }),
        ])
      );
    });
  });

  describe('detectBattery', () => {
    it('should detect orthogonal battery', () => {
      // Rook at 4,4. Queen at 4,5.
      mockGame.board[4][4] = { type: 'r', color: 'white' };
      mockGame.board[4][5] = { type: 'q', color: 'white' };

      const batteries = TacticsDetector.detectBattery(
        mockGame,
        mockAnalyzer,
        { r: 4, c: 4 },
        'white'
      );
      expect(batteries.length).toBeGreaterThan(0);
      expect(batteries[0].behindPos).toEqual({ r: 4, c: 5 });
    });
  });

  describe('canPieceMove', () => {
    it('should validate rook movement', () => {
      expect(TacticsDetector.canPieceMove('r', 1, 0)).toBe(true);
      expect(TacticsDetector.canPieceMove('r', 0, 1)).toBe(true);
      expect(TacticsDetector.canPieceMove('r', 1, 1)).toBe(false);
    });

    it('should validate bishop movement', () => {
      expect(TacticsDetector.canPieceMove('b', 1, 1)).toBe(true);
      expect(TacticsDetector.canPieceMove('b', 2, 2)).toBe(true);
      expect(TacticsDetector.canPieceMove('b', 1, 0)).toBe(false);
    });
  });
});
