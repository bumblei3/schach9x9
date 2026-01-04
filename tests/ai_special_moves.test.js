import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  getPseudoLegalMoves,
} from '../js/ai/MoveGenerator.js';
import { Game } from '../js/gameEngine.js';

describe('AI Special Moves', () => {
  let game;

  beforeEach(() => {
    game = new Game('standard8x8');
    // Ensure board is 8x8 for this test (MoveGenerator relies on board.length)
    if (game.board.length !== 8) {
      game.board = game.board.slice(0, 8).map(row => row.slice(0, 8));
    }

    // Clear pieces
    const size = 8;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        game.board[r][c] = null;
      }
    }
  });

  /*
   * Helper to set pieces
   */
  function setPiece(r, c, type, color, hasMoved = false) {
    game.board[r][c] = { type, color, hasMoved };
  }

  test('Should generate kingside castling move for White', () => {
    // White King at e1, Rook at h1. Path clear.
    setPiece(7, 4, 'k', 'white', false); // e1 is 7,4
    setPiece(7, 7, 'r', 'white', false); // h1 is 7,7

    // Board size is 8. King at 7,4.
    // Castling kingside: King moves to 7,6 (g1).

    const moves = getAllLegalMoves(game.board, 'white');
    const castleMove = moves.find(
      m => m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 6
    );

    expect(castleMove).toBeDefined();
  });

  test('Should generate queenside castling move for White', () => {
    // White King at e1, Rook at a1. Path clear.
    setPiece(7, 4, 'k', 'white', false);
    setPiece(7, 0, 'r', 'white', false);

    // Castling queenside: King moves to 7,2 (c1).
    const moves = getAllLegalMoves(game.board, 'white');
    const castleMove = moves.find(
      m => m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 2
    );

    expect(castleMove).toBeDefined();
  });

  test('Should NOT castle if path is blocked', () => {
    setPiece(7, 4, 'k', 'white', false);
    setPiece(7, 7, 'r', 'white', false);
    setPiece(7, 5, 'b', 'white', false); // Block at f1

    const moves = getAllLegalMoves(game.board, 'white');
    const castleMove = moves.find(
      m => m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 6
    );

    expect(castleMove).toBeUndefined();
  });

  test('Should NOT castle if King moved', () => {
    setPiece(7, 4, 'k', 'white', true); // hasMoved = true
    setPiece(7, 7, 'r', 'white', false);

    const moves = getAllLegalMoves(game.board, 'white');
    const castleMove = moves.find(
      m => m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 6
    );

    expect(castleMove).toBeUndefined();
  });

  test('Should correctly execute castling (Move Rook)', () => {
    setPiece(7, 4, 'k', 'white', false);
    setPiece(7, 7, 'r', 'white', false);

    const move = { from: { r: 7, c: 4 }, to: { r: 7, c: 6 } };
    const undo = makeMove(game.board, move);

    // King moved
    expect(game.board[7][6].type).toBe('k');
    expect(game.board[7][4]).toBeNull();

    // Rook moved from 7,7 to 7,5 (f1)
    expect(game.board[7][5].type).toBe('r');
    expect(game.board[7][7]).toBeNull();

    // Undo
    undoMove(game.board, undo);
    expect(game.board[7][4].type).toBe('k');
    expect(game.board[7][7].type).toBe('r');
    expect(game.board[7][6]).toBeNull();
    expect(game.board[7][5]).toBeNull();
  });

  test('Should generate En Passant move', () => {
    // White pawn at e5 (3, 4). Black pawn moves d7 -> d5 (1,3 -> 3,3).
    // Note: in 0-indexed 8x8:
    // row 0 = black home, row 7 = white home.
    // row 3 is white's rank 5.
    // row 1 = black pawns start.
    // Black moves 1,3 -> 3,3.
    // White pawn is at 3,4.

    setPiece(3, 4, 'p', 'white', true);
    setPiece(3, 3, 'p', 'black', true); // Just arrived

    const lastMove = {
      from: { r: 1, c: 3 },
      to: { r: 3, c: 3 },
      piece: { type: 'p', color: 'black' },
    };

    const moves = getPseudoLegalMoves(game.board, 3, 4, game.board[3][4], false, lastMove);

    // Expect capture to 2,3 (row 3-1 = 2)
    const epMove = moves.find(
      m => m.from.r === 3 && m.from.c === 4 && m.to.r === 2 && m.to.c === 3
    );

    expect(epMove).toBeDefined();
  });

  test('Should execute En Passant capture', () => {
    setPiece(3, 4, 'p', 'white', true);
    setPiece(3, 3, 'p', 'black', true);

    const move = { from: { r: 3, c: 4 }, to: { r: 2, c: 3 } };

    // Setup precondition: we know it's EP because dest is empty but diagonal logic
    // But makeMove detects EP by checking if move is diagonal & dest empty & source is pawn.
    // ensure dest 2,3 is empty
    game.board[2][3] = null;

    const undo = makeMove(game.board, move);

    // White pawn moved
    expect(game.board[2][3].type).toBe('p');
    expect(game.board[3][4]).toBeNull();

    // Black pawn captured (at 3,3)
    expect(game.board[3][3]).toBeNull();

    // Undo
    undoMove(game.board, undo);
    expect(game.board[3][4].type).toBe('p');
    expect(game.board[3][3].type).toBe('p'); // Restored
    expect(game.board[2][3]).toBeNull();
  });
});
