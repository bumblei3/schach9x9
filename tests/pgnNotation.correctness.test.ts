/**
 * moveToNotation correctness tests for js/utils/PGNGenerator.ts.
 *
 * PGN algebraic notation has strict rules the generator must honour:
 *   - castling is written "O-O" / "O-O-O", never as a king move "Kg1"
 *   - promotion is written "e8=Q" (or whichever piece), never just "e8"
 *   - a move giving check is suffixed "+", checkmate "#"
 *   - when two pieces of the same type can reach the destination, the move is
 *     disambiguated by file (or rank, or both)
 *
 * The previous generator read specialMove.type for castling/promotion, but
 * MoveHistoryEntry carries those as top-level flags (isCastling / promotion),
 * so the castling/promotion/check suffixes were silently dropped. These
 * tests lock the correct notation and act as the regression guard for the fix.
 */

import { describe, test, expect } from 'vitest';
import { moveToNotation } from '../js/utils/PGNGenerator.js';
import type { MoveHistoryEntry } from '../js/gameEngine.js';

type Piece = { type: string; color: 'white' | 'black'; hasMoved?: boolean };
type Board = (Piece | null)[][];

function emptyBoard(): Board {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));
}

function move(opts: {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured?: Piece | null;
  isCastling?: boolean;
  isCheck?: boolean;
  isCheckmate?: boolean;
  promotion?: string;
}): MoveHistoryEntry {
  return {
    from: { r: opts.from[0], c: opts.from[1] },
    to: { r: opts.to[0], c: opts.to[1] },
    piece: opts.piece,
    captured: opts.captured ?? null,
    isCastling: opts.isCastling,
    isCheck: opts.isCheck,
    isCheckmate: opts.isCheckmate,
    promotion: opts.promotion,
  } as MoveHistoryEntry;
}

describe('moveToNotation — castling', () => {
  test('kingside castling is written O-O, not a king move', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    const notation = moveToNotation(
      move({
        from: [8, 4],
        to: [8, 6],
        piece: board[8][4]!,
        isCastling: true,
      }),
      { board } as any
    );
    expect(notation).toBe('O-O');
  });

  test('queenside castling is written O-O-O', () => {
    const board = emptyBoard();
    board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    const notation = moveToNotation(
      move({
        from: [8, 4],
        to: [8, 2],
        piece: board[8][4]!,
        isCastling: true,
      }),
      { board } as any
    );
    expect(notation).toBe('O-O-O');
  });
});

describe('moveToNotation — promotion', () => {
  test('a promotion is written with =Q (or the chosen piece)', () => {
    const board = emptyBoard();
    board[1][0] = { type: 'p', color: 'white', hasMoved: true };
    const notation = moveToNotation(
      move({
        from: [1, 0],
        to: [0, 1],
        piece: board[1][0]!,
        captured: { type: 'r', color: 'black' },
        promotion: 'q',
      }),
      { board } as any
    );
    expect(notation).toBe('axb9=Q');
  });

  test('promotion to a fairy piece (archbishop) is written =A', () => {
    const board = emptyBoard();
    board[1][4] = { type: 'p', color: 'white', hasMoved: true };
    const notation = moveToNotation(
      move({
        from: [1, 4],
        to: [0, 4],
        piece: board[1][4]!,
        promotion: 'a',
      }),
      { board } as any
    );
    expect(notation).toBe('e9=A');
  });
});

describe('moveToNotation — check / checkmate suffixes', () => {
  test('a checking move is suffixed with +', () => {
    const board = emptyBoard();
    board[8][3] = { type: 'q', color: 'white', hasMoved: true };
    const notation = moveToNotation(
      move({
        from: [8, 3],
        to: [4, 3],
        piece: board[8][3]!,
        isCheck: true,
      }),
      { board } as any
    );
    expect(notation).toBe('Qd5+');
  });

  test('a checkmating move is suffixed with #', () => {
    const board = emptyBoard();
    board[8][3] = { type: 'q', color: 'white', hasMoved: true };
    const notation = moveToNotation(
      move({
        from: [8, 3],
        to: [4, 3],
        piece: board[8][3]!,
        isCheckmate: true,
      }),
      { board } as any
    );
    expect(notation).toBe('Qd5#');
  });
});

describe('moveToNotation — disambiguation', () => {
  test('two rooks that can both reach a square are disambiguated by file', () => {
    const board = emptyBoard();
    board[8][0] = { type: 'r', color: 'white', hasMoved: true }; // a1
    board[4][8] = { type: 'r', color: 'white', hasMoved: true }; // i5
    const aRook = moveToNotation(move({ from: [8, 0], to: [4, 0], piece: board[8][0]! }), {
      board,
    } as any);
    const iRook = moveToNotation(move({ from: [4, 8], to: [4, 0], piece: board[4][8]! }), {
      board,
    } as any);
    // both can reach a5; the moving rook's file is written out (Raa5 = rook
    // from file a to a5; Ria5 = rook from file i to a5).
    expect(aRook).toBe('Raa5');
    expect(iRook).toBe('Ria5');
  });

  test('two knights on DIFFERENT files that can both reach a square are disambiguated by file', () => {
    const board = emptyBoard();
    board[8][0] = { type: 'n', color: 'white', hasMoved: true }; // a1
    board[8][2] = { type: 'n', color: 'white', hasMoved: true }; // c1
    const nA = moveToNotation(move({ from: [8, 0], to: [6, 1], piece: board[8][0]! }), {
      board,
    } as any);
    const nC = moveToNotation(move({ from: [8, 2], to: [6, 1], piece: board[8][2]! }), {
      board,
    } as any);
    expect(nA).toBe('Nab3'); // a1 knight -> b3, file a
    expect(nC).toBe('Ncb3'); // c1 knight -> b3, file c
  });

  test('two knights on the SAME file need rank disambiguation', () => {
    const board = emptyBoard();
    board[8][0] = { type: 'n', color: 'white', hasMoved: true }; // a1 (rank 1)
    board[4][0] = { type: 'n', color: 'white', hasMoved: true }; // a5 (rank 5)
    const n1 = moveToNotation(move({ from: [8, 0], to: [6, 1], piece: board[8][0]! }), {
      board,
    } as any);
    const n5 = moveToNotation(move({ from: [4, 0], to: [6, 1], piece: board[4][0]! }), {
      board,
    } as any);
    expect(n1).toBe('N1b3'); // a1 knight -> b3, rank 1
    expect(n5).toBe('N5b3'); // a5 knight -> b3, rank 5
  });
});
