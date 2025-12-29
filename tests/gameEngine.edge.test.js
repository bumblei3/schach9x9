import { createEmptyBoard, Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

describe('Game Engine Edge Cases', () => {
  let game;

  beforeEach(() => {
    game = new Game();
    game.board = createEmptyBoard();
    game.phase = PHASES.PLAY;
  });

  describe('isCheckmate', () => {
    test('should detect basic Fool\'s Mate (White)', () => {
      // Setup a position where White is checkmated
      // 9x9 board, soFool's mate is slightly different but same principle
      // Let's use a simpler one: King in corner, trapped by Rook and Queen
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[1][2] = { type: 'r', color: 'black' }; // Cuts off row 1
      game.board[2][1] = { type: 'r', color: 'black' }; // Cuts off col 1
      game.board[1][1] = { type: 'q', color: 'black' }; // Attacks corner or just helps

      // Wait, let's do a more precise one
      game.board = createEmptyBoard();
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[0][1] = { type: 'r', color: 'black' };
      game.board[1][0] = { type: 'r', color: 'black' };
      game.board[1][1] = { type: 'q', color: 'black' }; // Protects both rooks and attacks 1,1
      // King at 0,0 is attacked by both and has no escape

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(true);
    });

    test('should not detect checkmate if king can escape', () => {
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[0][1] = { type: 'r', color: 'black' };
      // King can move to 1,0 or 1,1

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(false);
    });

    test('should not detect checkmate if attacker can be captured', () => {
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[0][1] = { type: 'r', color: 'black' };
      game.board[1][0] = { type: 'r', color: 'black' };
      game.board[2][1] = { type: 'q', color: 'white' }; // Can capture rook at 0,1

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(false);
    });
  });

  describe('isStalemate', () => {
    test('should detect basic stalemate', () => {
      // King in corner, not in check, but no legal moves
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[1][2] = { type: 'r', color: 'black' }; // Cuts off row 1
      game.board[2][1] = { type: 'r', color: 'black' }; // Cuts off col 1
      // 0,0 is safe, but 0,1, 1,0 and 1,1 are attacked

      expect(game.isInCheck('white')).toBe(false);
      expect(game.isStalemate('white')).toBe(true);
    });

    test('should not detect stalemate if other pieces have moves', () => {
      game.board[0][0] = { type: 'k', color: 'white' };
      game.board[1][2] = { type: 'r', color: 'black' };
      game.board[2][1] = { type: 'r', color: 'black' };
      game.board[8][8] = { type: 'p', color: 'white' }; // Pawn can move

      expect(game.isStalemate('white')).toBe(false);
    });
  });

  describe('Special Pieces', () => {
    test('Archbishop should have jumping and sliding moves', () => {
      game.board[4][4] = { type: 'a', color: 'white' };
      const moves = game.getValidMoves(4, 4, game.board[4][4]);

      // Check for some knight jumps
      expect(moves).toEqual(expect.arrayContaining([
        { r: 2, c: 3 }, { r: 6, c: 5 }
      ]));
      // Check for some bishop slides
      expect(moves).toEqual(expect.arrayContaining([
        { r: 5, c: 5 }, { r: 3, c: 3 }
      ]));
    });

    test('Chancellor should have jumping and sliding moves', () => {
      game.board[4][4] = { type: 'c', color: 'white' };
      const moves = game.getValidMoves(4, 4, game.board[4][4]);

      // Check for some knight jumps
      expect(moves).toEqual(expect.arrayContaining([
        { r: 2, c: 3 }, { r: 6, c: 5 }
      ]));
      // Check for some rook slides
      expect(moves).toEqual(expect.arrayContaining([
        { r: 4, c: 5 }, { r: 5, c: 4 }
      ]));
    });
  });
});
