import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';

describe('Game Engine Rules', () => {
  let Game, PHASES, BOARD_SIZE, createEmptyBoard;
  let game;

  beforeAll(async () => {
    // Import the module dynamically
    const mod = await import('../js/gameEngine.js');
    Game = mod.Game;
    PHASES = mod.PHASES;
    BOARD_SIZE = mod.BOARD_SIZE;
    createEmptyBoard = mod.createEmptyBoard;
  });

  beforeEach(() => {
    game = new Game();
    // Manually set up a board for testing
    game.board = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));
    game.phase = PHASES.PLAY;
  });

  describe('Basic Movement', () => {
    test('should return valid knight moves in the center', () => {
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

    test('should not allow moves off the board', () => {
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

    test('should detect checkmate with a Queen and Rook', () => {
      game = new Game();
      game.board = createEmptyBoard();
      // White King at i1 (8, 8)
      game.board[8][8] = { type: 'k', color: 'white', hasMoved: false };
      // Black Queen at h2 (7, 7)
      game.board[7][7] = { type: 'q', color: 'black', hasMoved: false };
      // Black Rook at h8 (1, 7) protecting the Queen
      game.board[1][7] = { type: 'r', color: 'black', hasMoved: false };

      game.getAllLegalMoves('white');
      // console.log('Legal moves for white:', JSON.stringify(moves, null, 2));

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(true);
    });

    test('should NOT be checkmate if king can move to a safe square', () => {
      game = new Game();
      game.board = createEmptyBoard();
      // White King at h1 (8, 7)
      game.board[8][7] = { type: 'k', color: 'white', hasMoved: false };
      // Black Queen at g2 (7, 6)
      game.board[7][6] = { type: 'q', color: 'black', hasMoved: false };
      // No Rook at h8, so king can move to g1 (8, 6)
      game.board[8][6] = null; // Ensure g1 is empty

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(false);
    });

    test('should NOT be checkmate if a piece can capture the checking piece', () => {
      game = new Game();
      game.board = createEmptyBoard();
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
      // Black Rook at e8 (1, 4) checking
      game.board[1][4] = { type: 'r', color: 'black', hasMoved: false };
      // White Rook at a4 (5, 0) can capture the black rook
      game.board[5][0] = { type: 'r', color: 'white', hasMoved: false };

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(false);
    });

    test('should detect checkmate by double check (cannot block or capture)', () => {
      game = new Game();
      game.board = createEmptyBoard();
      // White King at e1 (8, 4)
      game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

      // Black Rook at e8 (1, 4)
      game.board[1][4] = { type: 'r', color: 'black', hasMoved: false };

      // Black Knight at d3 (6, 3)
      game.board[6][3] = { type: 'n', color: 'black', hasMoved: false };

      // White Rook at a1 (8, 0) - could capture Knight but not Rook
      game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

      // In double check, King MUST move. If he can't, it's mate.
      // Block squares around King
      game.board[8][3] = { type: 'p', color: 'white' };
      game.board[8][5] = { type: 'p', color: 'white' };
      game.board[7][3] = { type: 'p', color: 'white' };
      game.board[7][4] = { type: 'p', color: 'white' };
      game.board[7][5] = { type: 'p', color: 'white' };

      expect(game.isInCheck('white')).toBe(true);
      expect(game.isCheckmate('white')).toBe(true);
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

  describe('Stalemate', () => {
    test('should detect stalemate', () => {
      game = new Game();
      game.board = createEmptyBoard();
      game.turn = 'black';

      // Black King at h8 (0, 8)
      game.board[0][8] = { type: 'k', color: 'black', hasMoved: true };

      // White Queen at g7 (2, 7) - confines King
      game.board[2][7] = { type: 'q', color: 'white', hasMoved: true };

      // White King at g7 (1, 6) - protects Queen and cuts off escape
      game.board[1][6] = { type: 'k', color: 'white', hasMoved: true };

      // Black King has no moves, but is NOT in check
      expect(game.isInCheck('black')).toBe(false);
      const legalMoves = game.getAllLegalMoves('black');
      if (legalMoves.length > 0) {
        console.log('Legal moves for black:', JSON.stringify(legalMoves, null, 2));
      }
      expect(legalMoves.length).toBe(0);
      expect(game.isStalemate('black')).toBe(true);
    });
  });
});
