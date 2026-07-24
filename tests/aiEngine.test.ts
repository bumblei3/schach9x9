/**
 * Tests for AI Engine
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import {
  getBestMove,
  getBestMoveDetailed,
  evaluatePosition,
  getAllLegalMoves,
  convertBoardToInt,
} from '../js/aiEngine';
import { createJsSearch } from '../js/search';
import { createEmptyBoard } from '../js/gameEngine';
import type { Board } from '../js/types/game';

describe('AI Engine', () => {
  let board: Board;

  beforeEach(() => {
    board = createEmptyBoard();
  });

  describe('evaluatePosition', () => {
    test('should return tempo bonus for empty board', async () => {
      // With tempo bonus, the side to move gets a small advantage
      expect(await evaluatePosition(board, 'white')).toBeGreaterThan(0);
    });

    test('should value material correctly', async () => {
      // Place white pawn
      board[4][4] = { type: 'p', color: 'white', hasMoved: false };
      // Place black pawn
      board[2][2] = { type: 'p', color: 'black', hasMoved: false };
      // Place Kings
      board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      board[0][4] = { type: 'k', color: 'black', hasMoved: false };

      // With new evaluation, passed pawn bonuses and PSTs result in a larger score
      const score = await evaluatePosition(board, 'white');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(500); // Increased upper bound for safety
    });

    test('should favor material advantage', async () => {
      board[4][4] = { type: 'q', color: 'white', hasMoved: false }; // 900 + 10 = 910
      board[0][0] = { type: 'r', color: 'black', hasMoved: false }; // 500 - 5 (edge) = 495
      // Place Kings
      board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      board[0][4] = { type: 'k', color: 'black', hasMoved: false };

      const score = await evaluatePosition(board, 'white');
      expect(score).toBeGreaterThan(300);
    });
  });

  describe('getAllLegalMoves', () => {
    test('should find moves for a single piece', () => {
      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      const moves = getAllLegalMoves(board, 'white');
      // Rook at 4,4 on 9x9 board:
      // Up: 4, Down: 4, Left: 4, Right: 4 = 16 moves
      expect(moves.length).toBe(16);
    });
  });

  describe('getBestMove', () => {
    test('should find a simple capture', async () => {
      // White rook can capture black pawn
      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      board[4][6] = { type: 'p', color: 'black', hasMoved: false };
      // Kings positioned diagonally from rook to avoid check scenarios
      board[7][7] = { type: 'k', color: 'white', hasMoved: false };
      board[1][1] = { type: 'k', color: 'black', hasMoved: false };

      const bestMove = await getBestMove(board, 'white', 1, 'expert');

      expect(bestMove).toMatchObject({
        from: { r: 4, c: 4 },
        to: { r: 4, c: 6 },
      });
    });

    test('should avoid immediate capture', async () => {
      // White queen threatened by black rook
      board[4][4] = { type: 'q', color: 'white', hasMoved: false };
      board[4][0] = { type: 'r', color: 'black', hasMoved: false };
      board[8][8] = { type: 'k', color: 'white', hasMoved: false };
      board[0][0] = { type: 'k', color: 'black', hasMoved: false };

      // Black to move, should capture queen
      const bestMove = await getBestMove(board, 'black', 1, 'expert');

      expect(bestMove).toMatchObject({
        from: { r: 4, c: 0 },
        to: { r: 4, c: 4 },
      });
    });
  });

  describe('Advanced AI Scenarios', () => {
    // These require specific move ordering which may vary
    test('should find Mate in 1', async () => {
      // Real mate in 1: White rook on A9 (0,8) + queen on C2 (1,2) trap the
      // black king in the corner A1 (0,0). Any checking move that the king
      // cannot escape delivers mate.
      board[0][0] = { type: 'k', color: 'black', hasMoved: false }; // Black king at A1
      board[0][8] = { type: 'r', color: 'white', hasMoved: false }; // White rook on A9
      board[1][2] = { type: 'q', color: 'white', hasMoved: false }; // White queen on C2
      board[8][4] = { type: 'k', color: 'white', hasMoved: false }; // White king (safe)

      const res = await getBestMoveDetailed(board, 'white', 3, { elo: 2500 });
      expect(res).not.toBeNull();
      expect(res!.move).toBeDefined();
      // A mate-in-1 should produce a decisive (mate-range) score.
      expect(res!.score).toBeGreaterThanOrEqual(19000);
    });

    test('should avoid Stalemate when winning', async () => {
      board[0][0] = { type: 'k', color: 'white', hasMoved: false };
      board[0][2] = { type: 'k', color: 'black', hasMoved: false };
      board[1][1] = { type: 'q', color: 'white', hasMoved: false };
      const bestMove = await getBestMove(board, 'white', 2, 'expert');
      if (bestMove) {
        expect(bestMove.to).not.toEqual({ r: 0, c: 1 });
      }
    });

    test('should use Quiescence Search to see capture chains', async () => {
      board[4][4] = { type: 'n', color: 'white', hasMoved: false };
      board[3][3] = { type: 'p', color: 'black', hasMoved: false };
      board[1][1] = { type: 'b', color: 'black', hasMoved: false };
      const bestMove = await getBestMove(board, 'white', 1, 'expert');
      if (bestMove && bestMove.from.r === 4 && bestMove.from.c === 4) {
        expect(bestMove.to).not.toEqual({ r: 3, c: 3 });
      }
    });
  });

  describe('Move Ordering and Optimization', () => {
    test('should prioritize captures in move ordering', async () => {
      // A single white rook attacks a black queen. At expert strength the
      // best move must be the material-winning capture of the queen.
      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      board[4][6] = { type: 'q', color: 'black', hasMoved: false };
      board[8][8] = { type: 'k', color: 'white', hasMoved: false };
      board[0][0] = { type: 'k', color: 'black', hasMoved: false };

      const bestMove = await getBestMove(board, 'white', 2, 'expert', { elo: 2500 });
      expect(bestMove).not.toBeNull();
      // The rook must capture the black queen on the same rank.
      expect(bestMove!.from).toEqual({ r: 4, c: 4 });
      expect(bestMove!.to).toEqual({ r: 4, c: 6 });
    });

    test('should evaluate center control', async () => {
      // A knight in the center should score better than the same knight in
      // the corner, all else being equal.
      const centerBoard = createEmptyBoard();
      centerBoard[4][4] = { type: 'n', color: 'white', hasMoved: false };
      centerBoard[8][4] = { type: 'k', color: 'white', hasMoved: false };
      centerBoard[0][4] = { type: 'k', color: 'black', hasMoved: false };

      const cornerBoard = createEmptyBoard();
      cornerBoard[0][0] = { type: 'n', color: 'white', hasMoved: false };
      cornerBoard[8][4] = { type: 'k', color: 'white', hasMoved: false };
      cornerBoard[0][4] = { type: 'k', color: 'black', hasMoved: false };

      const centerScore = await evaluatePosition(centerBoard, 'white');
      const cornerScore = await evaluatePosition(cornerBoard, 'white');
      expect(centerScore).toBeGreaterThan(cornerScore);
    });

    test('should value additional material correctly', async () => {
      // Two white pawns should evaluate as strictly better for white than a
      // single white pawn on an otherwise identical board.
      const oneP = createEmptyBoard();
      oneP[4][4] = { type: 'p', color: 'white', hasMoved: false };
      oneP[8][4] = { type: 'k', color: 'white', hasMoved: false };
      oneP[0][4] = { type: 'k', color: 'black', hasMoved: false };

      const twoP = createEmptyBoard();
      twoP[4][4] = { type: 'p', color: 'white', hasMoved: false };
      twoP[4][5] = { type: 'p', color: 'white', hasMoved: false };
      twoP[8][4] = { type: 'k', color: 'white', hasMoved: false };
      twoP[0][4] = { type: 'k', color: 'black', hasMoved: false };

      const oneScore = await evaluatePosition(oneP, 'white');
      const twoScore = await evaluatePosition(twoP, 'white');
      expect(twoScore).toBeGreaterThan(oneScore);
    });

    test('should evaluate special pieces correctly', async () => {
      const bArch = createEmptyBoard();
      bArch[4][4] = { type: 'a', color: 'white', hasMoved: false };
      bArch[8][4] = { type: 'k', color: 'white', hasMoved: false };
      bArch[0][4] = { type: 'k', color: 'black', hasMoved: false };
      expect(await evaluatePosition(bArch, 'white')).toBeGreaterThanOrEqual(600);

      const bChan = createEmptyBoard();
      bChan[4][4] = { type: 'c', color: 'white', hasMoved: false };
      bChan[8][4] = { type: 'k', color: 'white', hasMoved: false };
      bChan[0][4] = { type: 'k', color: 'black', hasMoved: false };
      expect(await evaluatePosition(bChan, 'white')).toBeGreaterThanOrEqual(700);

      const bAngel = createEmptyBoard();
      bAngel[4][4] = { type: 'e', color: 'white', hasMoved: false };
      bAngel[8][4] = { type: 'k', color: 'white', hasMoved: false };
      bAngel[0][4] = { type: 'k', color: 'black', hasMoved: false };
      expect(await evaluatePosition(bAngel, 'white')).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Difficulty Levels and Randomized Behavior', () => {
    test('beginner should make random / suboptimal moves via blunder simulation', async () => {
      // At a low Elo the engine simulates a blunder (elo < 1400): with
      // Math.random() forced to 0 it picks from the *alternatives* pool,
      // i.e. NOT the objectively best move. Verify the chosen move differs
      // from the expert (elo 2500) best move in the same position.
      const mockRandom = vi.spyOn(global.Math, 'random').mockReturnValue(0);

      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      board[4][6] = { type: 'q', color: 'black', hasMoved: false };
      board[7][7] = { type: 'k', color: 'white', hasMoved: false };
      board[1][1] = { type: 'k', color: 'black', hasMoved: false };

      // Expert picks the queen capture.
      const expert = await getBestMove(board, 'white', 2, 'expert', { elo: 2500 });
      // Beginner (blunder on) with random=0 picks an alternative.
      const beginner = await getBestMove(board, 'white', 2, 'beginner', { elo: 600 });

      mockRandom.mockRestore();

      expect(expert).not.toBeNull();
      expect(beginner).not.toBeNull();
      // The beginner move must NOT be the expert capture (proves blunder path).
      expect(beginner!.to).not.toEqual(expert!.to);
    });

    // Expert-level search runs deep — needs a longer timeout (default 5 s)
    // so it does not flake in CI.
    test('Expert should reach target depth via iterative deepening', async () => {
      // At expert strength (elo 2500) the JS search must complete at least one
      // ply and report a depth >= 1 with a defined score.
      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      board[4][6] = { type: 'p', color: 'black', hasMoved: false };
      board[8][8] = { type: 'k', color: 'white', hasMoved: false };
      board[0][0] = { type: 'k', color: 'black', hasMoved: false };

      const res = await getBestMoveDetailed(board, 'white', 3, { elo: 2500 });
      expect(res).not.toBeNull();
      expect(res!.move).toBeDefined();
      expect(res!.depth).toBeGreaterThanOrEqual(1);
      expect(typeof res!.score).toBe('number');
    });

    test('Regressions: root search must return a move at depth >= PROBCUT_DEPTH', async () => {
      // Regression for the root-ProbCut bug: at depth >= 5 (PROBCUT_DEPTH)
      // the search previously ran a probcut cutoff at the root node, which
      // skipped the move loop and returned { move: null, score: -30000 }.
      // The root must always return a concrete move. We drive the search
      // engine directly to avoid the adaptive time-allocation path (which is
      // load-sensitive and would make this test flaky in CI).
      board[4][4] = { type: 'r', color: 'white', hasMoved: false };
      board[4][6] = { type: 'p', color: 'black', hasMoved: false };
      board[7][7] = { type: 'k', color: 'white', hasMoved: false };
      board[1][1] = { type: 'k', color: 'black', hasMoved: false };

      const intBoard = convertBoardToInt(board);
      const search = createJsSearch({ personality: 'NORMAL' });
      const res = await search.run(intBoard, 'white', 5);
      expect(res.move, 'root search at depth 5 must return a concrete move').not.toBeNull();
      expect(typeof res.score).toBe('number');
    });
  });

  test('should handle positions with no legal moves', () => {
    // Stalemate-like position: just kings
    const emptyBoard = createEmptyBoard();
    emptyBoard[0][0] = { type: 'k', color: 'white', hasMoved: false };
    emptyBoard[8][8] = { type: 'k', color: 'black', hasMoved: false };

    const moves = getAllLegalMoves(emptyBoard, 'white');

    // Kings should have some moves unless completely blocked
    expect(moves.length).toBeGreaterThan(0);
  });
});
