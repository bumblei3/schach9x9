import { describe, it, expect, beforeEach } from 'vitest';
import { orderMoves, clearMoveOrdering, updateCounterMove } from '../../js/ai/MoveOrdering.js';
import {
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  COLOR_WHITE,
  COLOR_BLACK,
} from '../../js/ai/BoardDefinitions.js';

describe('MoveOrdering - Comprehensive Tests', () => {
  beforeEach(() => {
    clearMoveOrdering();
  });

  describe('clearMoveOrdering', () => {
    it('should clear counter move table', () => {
      updateCounterMove({ from: 10, to: 20 }, { from: 30, to: 40 });
      clearMoveOrdering();
      const moves = [
        { from: 30, to: 40 },
        { from: 50, to: 60 },
      ];
      const board = new Int8Array(81).fill(PIECE_NONE);
      const ordered = orderMoves(board, moves, null, null, null, { from: 10, to: 20 });
      expect(ordered.length).toBe(2);
    });
  });

  describe('updateCounterMove', () => {
    it('should store counter moves for later retrieval', () => {
      const prevMove = { from: 0, to: 10 };
      const bestMove = { from: 40, to: 50 };
      updateCounterMove(prevMove, bestMove);

      const board = new Int8Array(81).fill(PIECE_NONE);
      const moves = [
        { from: 1, to: 2 },
        { from: 40, to: 50 },
        { from: 3, to: 4 },
      ];

      const ordered = orderMoves(board, moves, null, null, null, prevMove);
      expect(ordered[0]).toEqual(bestMove);
    });

    it('should handle null moves gracefully', () => {
      expect(() => updateCounterMove(null, { from: 1, to: 2 })).not.toThrow();
      expect(() => updateCounterMove({ from: 1, to: 2 }, null)).not.toThrow();
      expect(() => updateCounterMove(null, null)).not.toThrow();
    });
  });

  describe('orderMoves', () => {
    let board: Int8Array;

    beforeEach(() => {
      board = new Int8Array(81).fill(PIECE_NONE);
    });

    it('should prioritize TT (hash) moves', () => {
      const ttMove = { from: 10, to: 20 };
      const moves = [
        { from: 1, to: 2 },
        { from: 10, to: 20 },
        { from: 3, to: 4 },
      ];

      const ordered = orderMoves(board, moves, ttMove, null, null, null);
      expect(ordered[0]).toEqual(ttMove);
    });

    it('should prioritize captures with MVV-LVA', () => {
      board[10] = PIECE_PAWN | COLOR_WHITE;
      board[20] = PIECE_QUEEN | COLOR_BLACK;
      board[30] = PIECE_KNIGHT | COLOR_BLACK;

      const moves = [
        { from: 1, to: 2 },
        { from: 10, to: 20 },
        { from: 10, to: 30 },
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      expect(ordered[0]).toEqual({ from: 10, to: 20 });
      expect(ordered[1]).toEqual({ from: 10, to: 30 });
    });

    it('should prioritize killer moves for quiet moves', () => {
      const killers = [
        { from: 10, to: 20 },
        { from: 30, to: 40 },
      ];

      const moves = [
        { from: 1, to: 2 },
        { from: 30, to: 40 },
        { from: 10, to: 20 },
        { from: 5, to: 6 },
      ];

      const ordered = orderMoves(board, moves, null, killers, null, null);
      expect(ordered[0]).toEqual({ from: 10, to: 20 });
      expect(ordered[1]).toEqual({ from: 30, to: 40 });
    });

    it('should apply history heuristic scores', () => {
      const history = new Int32Array(81 * 81);
      history[10 * 81 + 20] = 50000;

      const moves = [
        { from: 1, to: 2 },
        { from: 10, to: 20 },
        { from: 3, to: 4 },
      ];

      const ordered = orderMoves(board, moves, null, null, history, null);
      expect(ordered[0]).toEqual({ from: 10, to: 20 });
    });

    it('should cap history scores at maximum', () => {
      const history = new Int32Array(81 * 81);
      history[10 * 81 + 20] = 999999;

      const moves = [{ from: 10, to: 20 }];
      const ordered = orderMoves(board, moves, null, null, history, null);
      expect(ordered.length).toBe(1);
    });

    it('should handle empty move list', () => {
      const ordered = orderMoves(board, [], null, null, null, null);
      expect(ordered).toEqual([]);
    });

    it('should maintain order for equal-scored moves', () => {
      const moves = [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 5, to: 6 },
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      expect(ordered.length).toBe(3);
    });

    it('should prioritize counter moves', () => {
      const prevMove = { from: 0, to: 10 };
      const counterMove = { from: 40, to: 50 };
      updateCounterMove(prevMove, counterMove);

      const moves = [
        { from: 1, to: 2 },
        { from: 40, to: 50 },
        { from: 3, to: 4 },
      ];

      const ordered = orderMoves(board, moves, null, null, null, prevMove);
      expect(ordered[0]).toEqual(counterMove);
    });

    it('should handle combined ordering heuristics', () => {
      board[20] = PIECE_KNIGHT | COLOR_BLACK;
      board[10] = PIECE_PAWN | COLOR_WHITE;

      const killers = [{ from: 30, to: 40 }, null];
      const history = new Int32Array(81 * 81);
      history[50 * 81 + 60] = 10000;

      const moves = [
        { from: 50, to: 60 },
        { from: 30, to: 40 },
        { from: 10, to: 20 },
        { from: 1, to: 2 },
      ];

      const ordered = orderMoves(board, moves, null, killers, history, null);
      expect(ordered[0]).toEqual({ from: 10, to: 20 });
    });
  });

  describe('Threat Detection', () => {
    let board: Int8Array;

    beforeEach(() => {
      board = new Int8Array(81).fill(PIECE_NONE);
    });

    it('should prioritize non-captures that attack high-value enemy pieces', () => {
      // White queen on e4 (4*9+4=40), black rook on e7 (7*9+4=67) - queen attacks rook along file
      board[40] = PIECE_QUEEN | COLOR_WHITE; // e4
      board[67] = PIECE_ROOK | COLOR_BLACK; // e7

      const moves = [
        { from: 40, to: 49 }, // Qe4-e5 (attacks rook on e7 along file)
        { from: 1, to: 2 }, // random quiet move
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      // Qe4-e5 should be prioritized because it attacks the rook
      expect(ordered[0]).toEqual({ from: 40, to: 49 });
    });

    it('should prioritize moves giving check', () => {
      // White queen on h5 (5*9+7=52), black king on g8 (0*9+6=6) - Qh5-g6# gives check
      board[52] = PIECE_QUEEN | COLOR_WHITE; // h5
      board[6] = PIECE_KING | COLOR_BLACK; // g8 (row 0, col 6)
      // Queen on h5 attacks g6 (4*9+6=42) which gives check to king on g8
      board[15] = PIECE_PAWN | COLOR_WHITE; // f2 pawn (not necessary but safe)

      const moves = [
        { from: 15, to: 24 }, // f2-f3 (quiet)
        { from: 52, to: 42 }, // Qh5-g6 (check)
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      expect(ordered[0]).toEqual({ from: 52, to: 42 });
    });

    it('should prioritize captures of hanging (undefended) pieces', () => {
      // White knight on d4 (4*9+3=39), black queen on e5 (5*9+4=49) - queen is undefended
      board[39] = PIECE_KNIGHT | COLOR_WHITE; // d4
      board[49] = PIECE_QUEEN | COLOR_BLACK; // e5

      const moves = [
        { from: 39, to: 49 }, // Nd4xe5 (capture hanging queen)
        { from: 1, to: 2 }, // random quiet move
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      expect(ordered[0]).toEqual({ from: 39, to: 49 });
    });

    it('should deprioritize moves exposing own king to attack', () => {
      // White king on e1 (8*9+4=76), black rook on e8 (1*9+4=13)
      // White bishop on e2 (7*9+4=67) blocks rook's attack on king
      // Moving bishop from e2 to f3 exposes king to check
      board[76] = PIECE_KING | COLOR_WHITE; // e1
      board[13] = PIECE_ROOK | COLOR_BLACK; // e8
      board[67] = PIECE_BISHOP | COLOR_WHITE; // e2

      const moves = [
        { from: 67, to: 59 }, // Be2-f3 (exposes king on e1 to rook on e8)
        { from: 1, to: 2 }, // random quiet move
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      // The move exposing the king should be deprioritized
      expect(ordered[1]).toEqual({ from: 67, to: 59 });
    });

    it('should prioritize discovered attacks (X-ray through own piece)', () => {
      // White rook on a1 (8*9+0=72), white bishop on b2 (7*9+1=64), black queen on c3 (6*9+2=56)
      // Moving bishop from b2 discovers rook's attack on queen along diagonal
      board[72] = PIECE_ROOK | COLOR_WHITE; // a1
      board[64] = PIECE_BISHOP | COLOR_WHITE; // b2
      board[56] = PIECE_QUEEN | COLOR_BLACK; // c3

      const moves = [
        { from: 64, to: 55 }, // Bb2-a3 (discovers Ra1-c3 attack on queen)
        { from: 1, to: 2 }, // random quiet move
      ];

      const ordered = orderMoves(board, moves, null, null, null, null);
      // The discovered attack move should be prioritized
      expect(ordered[0]).toEqual({ from: 64, to: 55 });
    });
  });
});
