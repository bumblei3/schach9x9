import { createEmptyBoard, Game } from '../js/gameEngine.js';

describe('getValidMoves', () => {
  it('should return valid knight moves in the center', () => {
    const game = new Game();
    game.board = createEmptyBoard();
    game.board[4][4] = { type: 'n', color: 'white' };
    const moves = game.getValidMoves(4, 4, game.board[4][4]);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 2, c: 3 },
        { r: 2, c: 5 },
        { r: 3, c: 2 },
        { r: 3, c: 6 },
        { r: 5, c: 2 },
        { r: 5, c: 6 },
        { r: 6, c: 3 },
        { r: 6, c: 5 },
      ])
    );
  });

  it('should not allow moves off the board', () => {
    const game = new Game();
    game.board = createEmptyBoard();
    game.board[0][0] = { type: 'n', color: 'white' };
    const moves = game.getValidMoves(0, 0, game.board[0][0]);
    expect(moves).toEqual(
      expect.arrayContaining([
        { r: 1, c: 2 },
        { r: 2, c: 1 },
      ])
    );
    expect(moves.length).toBe(2);
  });
});
