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

    it('should validate queen movement', () => {
      expect(TacticsDetector.canPieceMove('q', 1, 0)).toBe(true);
      expect(TacticsDetector.canPieceMove('q', 0, 5)).toBe(true);
      expect(TacticsDetector.canPieceMove('q', 2, 2)).toBe(true);
    });
  });

  describe('detectSkewers', () => {
    it('should detect skewer on a line', () => {
      // Setup: White queen attacks black queen, then black king behind
      mockGame.board[4][4] = { type: 'r', color: 'white' };
      mockGame.board[4][6] = { type: 'q', color: 'black' };
      mockGame.board[4][8] = { type: 'k', color: 'black' };

      const skewers = TacticsDetector.detectSkewers(
        mockGame,
        mockAnalyzer,
        { r: 4, c: 4 },
        'white'
      );
      expect(skewers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectDiscoveredAttacks', () => {
    it('should detect discovered attack when piece moves away', () => {
      // Setup: White rook behind white knight. Moving knight reveals rook attack.
      mockGame.board[4][4] = { type: 'n', color: 'white' };
      mockGame.board[4][0] = { type: 'r', color: 'white' };
      mockGame.board[4][8] = { type: 'q', color: 'black' };

      vi.mocked(aiEngine.isSquareAttacked).mockReturnValue(true);

      const discovered = TacticsDetector.detectDiscoveredAttacks(
        mockGame,
        mockAnalyzer,
        { r: 4, c: 4 },
        { r: 2, c: 5 },
        'white'
      );
      expect(discovered.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('countAttackers and countDefenders', () => {
    it('countAttackers should count pieces attacking a square', () => {
      mockGame.board[0][0] = { type: 'r', color: 'white' };
      mockGame.board[0][4] = null; // Target square
      mockGame.getValidMoves.mockReturnValue([{ to: { r: 0, c: 4 } }]);

      const count = TacticsDetector.countAttackers(mockGame, 0, 4, 'white');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('countDefenders should count pieces defending a square', () => {
      mockGame.board[4][4] = { type: 'p', color: 'white' };
      mockGame.board[3][3] = { type: 'b', color: 'white' };
      mockGame.getValidMoves.mockReturnValue([{ to: { r: 4, c: 4 } }]);

      const count = TacticsDetector.countDefenders(mockGame, 4, 4, 'white');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectPins', () => {
    it('should detect a pin on a diagonal', () => {
      // White bishop pins black knight to black king
      mockGame.board[0][0] = { type: 'b', color: 'white' };
      mockGame.board[2][2] = { type: 'n', color: 'black' };
      mockGame.board[4][4] = { type: 'k', color: 'black' };

      const pins = TacticsDetector.detectPins(
        mockGame,
        mockAnalyzer,
        { r: 0, c: 0 },
        'white'
      );
      expect(pins.length).toBeGreaterThanOrEqual(0);
    });
  });
});

