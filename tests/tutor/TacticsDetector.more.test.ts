/**
 * Additional coverage for js/tutor/TacticsDetector.ts — the simple piece-level
 * helpers (getThreatenedPieces, getDefendedPieces) and the move-simulation
 * threat detector (detectThreatsAfterMove) that were not exercised by the
 * earlier coverage suites.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as TacticsDetector from '../../js/tutor/TacticsDetector.js';

vi.mock('../../js/aiEngine.js', () => ({
  getAllThreats: vi.fn(() => []),
  COLOR_BLACK: 32,
  COLOR_WHITE: 16,
  PIECE_PAWN: 1,
  PIECE_KNIGHT: 2,
  PIECE_BISHOP: 3,
  PIECE_ROOK: 4,
  PIECE_QUEEN: 5,
  PIECE_KING: 6,
  PIECE_ARCHBISHOP: 7,
  PIECE_CHANCELLOR: 8,
  PIECE_ANGEL: 9,
  PIECE_NIGHTRIDER: 10,
  see: vi.fn(),
  isSquareAttacked: vi.fn(),
}));

const { getAllThreats } = await import('../../js/aiEngine.js');

describe('TacticsDetector additional coverage', () => {
  let mockGame: any;
  let mockAnalyzer: any;

  beforeEach(() => {
    mockGame = {
      board: Array(9).fill(null).map(() => Array(9).fill(null)),
      getValidMoves: vi.fn().mockReturnValue([]),
      isSquareUnderAttack: vi.fn().mockReturnValue(false),
      isInCheck: vi.fn(),
    };
    mockAnalyzer = {
      getPieceName: (t: any) => t,
    };
    vi.clearAllMocks();
  });

  describe('getThreatenedPieces', () => {
    test('returns [] when no piece is on the square', () => {
      const result = TacticsDetector.getThreatenedPieces(mockGame, mockAnalyzer, { r: 0, c: 0 }, 'white');
      expect(result).toEqual([]);
    });

    test('returns pieces it can capture (enemy color only)', () => {
      mockGame.board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      mockGame.board[4][6] = { type: 'p', color: 'black', hasMoved: false };
      mockGame.board[6][4] = { type: 'n', color: 'white', hasMoved: false }; // own piece, ignored
      mockGame.getValidMoves.mockReturnValue([
        { r: 4, c: 6 },
        { r: 6, c: 4 },
      ]);
      const result = TacticsDetector.getThreatenedPieces(mockGame, mockAnalyzer, { r: 4, c: 4 }, 'white');
      expect(result).toHaveLength(1);
      expect(result[0].pos).toEqual({ r: 4, c: 6 });
      expect(result[0].type).toBe('p');
    });
  });

  describe('getDefendedPieces', () => {
    test('returns [] when no piece is on the square', () => {
      const result = TacticsDetector.getDefendedPieces(mockGame, mockAnalyzer, { r: 0, c: 0 }, 'white');
      expect(result).toEqual([]);
    });

    test('returns same-color pieces it defends, with threat flag', () => {
      mockGame.board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      mockGame.board[4][6] = { type: 'p', color: 'white', hasMoved: false }; // defended ally
      mockGame.board[4][2] = { type: 'p', color: 'black', hasMoved: false }; // enemy, ignored
      mockGame.getValidMoves.mockReturnValue([
        { r: 4, c: 6 },
        { r: 4, c: 2 },
      ]);
      mockGame.isSquareUnderAttack.mockImplementation((r: number, _c: number, _color: string) => r === 4);
      const result = TacticsDetector.getDefendedPieces(mockGame, mockAnalyzer, { r: 4, c: 4 }, 'white');
      expect(result).toHaveLength(1);
      expect(result[0].pos).toEqual({ r: 4, c: 6 });
      expect(result[0].wasThreatened).toBe(true);
    });
  });

  describe('detectThreatsAfterMove', () => {
    test('returns [] when the from-square is empty', () => {
      const result = TacticsDetector.detectThreatsAfterMove(
        mockGame,
        mockAnalyzer,
        { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }
      );
      expect(result).toEqual([]);
    });

    test('simulates the move and reports opponent threats', () => {
      mockGame.board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      (getAllThreats as any).mockReturnValue([
        { isDirect: true, sq: 40, type: 'p' },
        { isDirect: false, sq: 20, type: 'q' }, // x-ray
      ]);
      const result = TacticsDetector.detectThreatsAfterMove(
        mockGame,
        mockAnalyzer,
        { from: { r: 4, c: 4 }, to: { r: 4, c: 6 } }
      );
      // The board must be restored after simulation.
      expect(mockGame.board[4][4]).toEqual({ type: 'r', color: 'white', hasMoved: false });
      expect(mockGame.board[4][6]).toBeNull();
      expect(getAllThreats).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
