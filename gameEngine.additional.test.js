// gameEngine.additional.test.js
// Additional tests for core game engine functions beyond the basic knight tests.
import { createEmptyBoard, Game } from './gameEngine.js';

describe('Game Engine Additional Tests', () => {
  let game;

  beforeEach(() => {
    game = new Game();
    game.board = createEmptyBoard();
  });

  test('white pawn forward move and double step from starting row', () => {
    game.board[6][4] = { type: 'p', color: 'white' };
    const moves = game.getValidMoves(6, 4, game.board[6][4]);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 5, c: 4 },
        { r: 4, c: 4 },
      ])
    );
    expect(moves.length).toBe(2);
  });

  test('black pawn forward move and double step from starting row', () => {
    game.board[1][4] = { type: 'p', color: 'black' };
    const moves = game.getValidMoves(1, 4, game.board[1][4]);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 2, c: 4 },
        { r: 3, c: 4 },
      ])
    );
    expect(moves.length).toBe(2);
  });

  test('pawn captures diagonally when opponent pieces present', () => {
    game.board[6][4] = { type: 'p', color: 'white' };
    game.board[5][3] = { type: 'n', color: 'black' };
    game.board[5][5] = { type: 'b', color: 'black' };
    const moves = game.getValidMoves(6, 4, game.board[6][4]);
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
    game.board[4][4] = { type: 'a', color: 'white' };
    const moves = game.getValidMoves(4, 4, game.board[4][4]);
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
    game.board[4][4] = { type: 'c', color: 'white' };
    const moves = game.getValidMoves(4, 4, game.board[4][4]);
    // Should include at least 4 orthogonal moves and 8 knight moves (total >=12)
    expect(moves.length).toBeGreaterThanOrEqual(12);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 4, c: 5 }, // rook right
        { r: 5, c: 4 }, // rook down
        { r: 2, c: 3 }, // knight move
        { r: 6, c: 5 }, // knight move
      ])
    );
  });
});
