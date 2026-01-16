// gameEngine.additional.test.ts
// Additional tests for core game engine functions beyond the basic knight tests.
import { describe, expect, test, beforeEach } from 'vitest';
import { createEmptyBoard, Game } from '../js/gameEngine.js';

describe('Game Engine Additional Tests', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
    game.board = createEmptyBoard() as any;
  });

  test('white pawn forward move and double step from starting row', () => {
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };
    const moves = game.getValidMoves(6, 4, game.board[6][4]!);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 5, c: 4 },
        { r: 4, c: 4 },
      ])
    );
    expect(moves.length).toBe(2);
  });

  test('black pawn forward move and double step from starting row', () => {
    game.board[1][4] = { type: 'p', color: 'black', hasMoved: false };
    const moves = game.getValidMoves(1, 4, game.board[1][4]!);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 2, c: 4 },
        { r: 3, c: 4 },
      ])
    );
    expect(moves.length).toBe(2);
  });

  test('pawn captures diagonally when opponent pieces present', () => {
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[5][3] = { type: 'n', color: 'black', hasMoved: false };
    game.board[5][5] = { type: 'b', color: 'black', hasMoved: false };
    const moves = game.getValidMoves(6, 4, game.board[6][4]!);
    const expected = [
      { r: 5, c: 4 },
      { r: 5, c: 3 },
      { r: 5, c: 5 },
      { r: 4, c: 4 },
    ];
    expect(moves).toEqual(expect.arrayContaining(expected));
    expect(moves.length).toBe(4);
  });

  test('archbishop (bishop + knight) combines moves correctly', () => {
    game.board[4][4] = { type: 'a', color: 'white', hasMoved: false };
    const moves = game.getValidMoves(4, 4, game.board[4][4]!);
    // Should include at least 4 diagonal moves and 8 knight moves (total >=12)
    expect(moves.length).toBeGreaterThanOrEqual(12);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 3, c: 3 }, // bishop diagonal
        { r: 5, c: 5 }, // bishop diagonal
        { r: 2, c: 3 }, // knight move
        { r: 6, c: 5 }, // knight move
      ])
    );
  });

  test('chancellor (rook + knight) combines moves correctly', () => {
    game.board[4][4] = { type: 'c', color: 'white', hasMoved: false };
    const moves = game.getValidMoves(4, 4, game.board[4][4]!);
    // Should include at least 4 orthogonal moves and 8 knight moves (total >=12)
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 4, c: 5 }, // rook right
        { r: 5, c: 4 }, // rook down
        { r: 2, c: 3 }, // knight move
        { r: 6, c: 5 }, // knight move
      ])
    );
  });

  describe('Elo Estimation', () => {
    test('should return default 600 if no accuracies recorded', () => {
      // Use any to bypass read-only or type restrictions on stats if necessary
      (game as any).stats = { accuracies: [] };
      expect(game.getEstimatedElo()).toBe(600);
    });

    test('should calculate elo based on midgame accuracies', () => {
      // Provide enough moves to trigger slicing (> 5)
      // 100% accuracy = 2400
      (game as any).stats = { accuracies: [100, 100, 100, 100, 100, 100, 100] };
      const elo = game.getEstimatedElo();
      expect(elo).toBe(2400);
    });

    test('should fallback to all accuracies if midgame is not reached', () => {
      // < 5 moves, so all are used
      (game as any).stats = { accuracies: [50, 50] }; // 50% = 800
      expect(game.getEstimatedElo()).toBe(800);
    });

    test('should cap Elo at min 400 and max 2800', () => {
      (game as any).stats = { accuracies: [0, 0, 0, 0, 0, 0] }; // 0% = 400 (capped)
      expect(game.getEstimatedElo()).toBe(400);

      // Hypothetical >100% accuracy? Logic uses linear mapping.
      // 800 + (100 - 50) * 32 = 800 + 1600 = 2400.
      (game as any).stats = { accuracies: [120, 120, 120, 120, 120, 120] };
      expect(game.getEstimatedElo()).toBe(2800);
    });
  });
});
