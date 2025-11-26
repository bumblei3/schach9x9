import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

describe('Game Engine Rules', () => {
  let Game, PHASES, BOARD_SIZE;
  let game;

  beforeAll(async () => {
    // Import the module dynamically
    const mod = await import('./gameEngine.js');
    Game = mod.Game;
    PHASES = mod.PHASES;
    BOARD_SIZE = mod.BOARD_SIZE;
  });

  beforeEach(() => {
    game = new Game();
    // Manually set up a board for testing
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game.phase = PHASES.PLAY;
  });

  describe('Check Detection', () => {
    test('should detect simple check from Rook', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // Black Rook at e8 (1, 4)
      game.board[1][4] = { type: 'r', color: 'black', hasMoved: false };

      expect(game.isInCheck('white')).toBe(true);
    });

    test('should NOT detect check if blocked', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // Black Rook at e8 (1, 4)
      game.board[1][4] = { type: 'r', color: 'black', hasMoved: false };
      // White Pawn at e2 (7, 4) blocking
      game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };

      expect(game.isInCheck('white')).toBe(false);
    });

    test('should detect Knight check', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // Black Knight at d3 (6, 3) attacking e1
      game.board[6][3] = { type: 'n', color: 'black', hasMoved: false };

      expect(game.isInCheck('white')).toBe(true);
    });
  });

  describe('Checkmate Detection', () => {
    test('should detect Back Rank Mate with two Rooks', () => {
      // White King at a1 (8, 0)
      game.board[8][0] = { type: 'k', color: 'white', hasMoved: false };

      // Black Rook at a8 (0, 0) controlling file a
      game.board[0][0] = { type: 'r', color: 'black', hasMoved: false };

      // Black Rook at b8 (0, 1) controlling file b
      game.board[0][1] = { type: 'r', color: 'black', hasMoved: false };

      // King is at (8,0).
      // Attacked by Rook at (0,0).
      // Escape squares:
      // (8,1) - attacked by Rook at (0,1)
      // (7,0) - attacked by Rook at (0,0)
      // (7,1) - attacked by Rook at (0,1) and (0,0)? No, (0,0) is file a.
      // (7,1) is attacked by Rook at (0,1).

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(true);
    });

    test('should NOT be checkmate if piece can block the check', () => {
      // White King at a1 (8, 0)
      game.board[8][0] = { type: 'k', color: 'white', hasMoved: false };

      // Black Rook at a8 (0, 0) checking down the a-file
      game.board[0][0] = { type: 'r', color: 'black', hasMoved: false };

      // White Rook at h5 (4, 7) can move to a5 (4, 0) to block
      game.board[4][7] = { type: 'r', color: 'white', hasMoved: false };

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(false);
    });
  });

  describe('Castling', () => {
    test('should allow kingside castling when conditions are met', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // White Rook at i1 (8, 8)
      game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };

      const moves = game.getValidMoves(8, 4, game.board[8][4]);
      const castlingMove = moves.find(m => m.r === 8 && m.c === 6); // King moves 2 squares right

      expect(castlingMove).toBeDefined();
    });

    test('should NOT allow castling if path is blocked', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // White Rook at i1 (8, 8)
      game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };
      // Blocking piece at f1 (8, 5)
      game.board[8][5] = { type: 'n', color: 'white', hasMoved: false };

      const moves = game.getValidMoves(8, 4, game.board[8][4]);
      const castlingMove = moves.find(m => m.r === 8 && m.c === 6);

      expect(castlingMove).toBeUndefined();
    });

    test('should NOT allow castling if king passes through check', () => {
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // White Rook at i1 (8, 8)
      game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };
      // Black Rook at f8 (0, 5) attacking f1
      game.board[0][5] = { type: 'r', color: 'black', hasMoved: false };

      const moves = game.getValidMoves(8, 4, game.board[8][4]);
      const castlingMove = moves.find(m => m.r === 8 && m.c === 6);

      expect(castlingMove).toBeUndefined();
    });
  });

  describe('En Passant', () => {
    test('should allow en passant capture after double pawn push', () => {
      // White pawn at e5 (3, 4)
      game.board[3][4] = { type: 'p', color: 'white', hasMoved: true };

      // Black pawn at d7 (1, 3) that just moved to d5 (3, 3)
      game.board[3][3] = { type: 'p', color: 'black', hasMoved: true };

      // Set lastMove to indicate black pawn just did a double push
      game.lastMove = {
        from: { r: 1, c: 3 },
        to: { r: 3, c: 3 },
        piece: { type: 'p', color: 'black' },
        isDoublePawnPush: true,
      };

      const moves = game.getValidMoves(3, 4, game.board[3][4]);
      const enPassantMove = moves.find(m => m.r === 2 && m.c === 3);

      expect(enPassantMove).toBeDefined();
    });
  });
});
