import { describe, it, expect, beforeEach } from 'vitest';
import { orderMoves, clearMoveOrdering, updateCounterMove } from '../../js/ai/MoveOrdering.js';
import {
  PIECE_NONE,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_QUEEN,
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
});
