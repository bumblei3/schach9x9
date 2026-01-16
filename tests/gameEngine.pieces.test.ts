import { describe, expect, it } from 'vitest';
import { createEmptyBoard, Game } from '../js/gameEngine.js';

describe('getValidMoves - Pawn', () => {
  it('should allow white pawn to move forward one square', () => {
    const game = new Game();
    game.board = createEmptyBoard() as any;
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };
    const moves = game.getValidMoves(6, 4, game.board[6][4]!);
    expect(moves).toEqual(expect.arrayContaining([{ r: 5, c: 4 }]));
  });

  it('should allow black pawn to move forward one square', () => {
    const game = new Game();
    game.board = createEmptyBoard() as any;
    game.board[1][4] = { type: 'p', color: 'black', hasMoved: false };
    const moves = game.getValidMoves(1, 4, game.board[1][4]!);
    expect(moves).toEqual(expect.arrayContaining([{ r: 2, c: 4 }]));
  });

  it('should allow pawn to capture diagonally', () => {
    const game = new Game();
    game.board = createEmptyBoard() as any;
    game.board[6][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[5][3] = { type: 'n', color: 'black', hasMoved: false };
    game.board[5][5] = { type: 'b', color: 'black', hasMoved: false };
    const moves = game.getValidMoves(6, 4, game.board[6][4]!);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 5, c: 4 },
        { r: 5, c: 3 },
        { r: 5, c: 5 },
      ])
    );
  });
});

describe('getValidMoves - Rook', () => {
  it('should allow rook to move in straight lines', () => {
    const game = new Game();
    game.board = createEmptyBoard() as any;
    game.board[4][4] = { type: 'r', color: 'white', hasMoved: false };
    const moves = game.getValidMoves(4, 4, game.board[4][4]!);
    // Rook should have 16 moves on empty 9x9 board
    expect(moves.length).toBeGreaterThan(10);
  });
});
