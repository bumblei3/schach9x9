/**
 * Focused invariant tests for js/ai/MoveGenerator.ts core predicates.
 *
 * findKing / isInCheck / isSquareAttacked are the foundation the whole engine
 * relies on: every legality check, every search node, every threat scan calls
 * them. The existing perft tests only exercise a king + one pawn at shallow
 * depth, so these tests lock the attack detection for each sliding/leaping
 * piece type and the exact move counts for isolated pieces on a 9x9 board.
 *
 * Board is an Int8Array of length 81, index = row * 9 + col (row 0 = top).
 */

import { describe, test, expect } from 'vitest';
import {
  getAllLegalMoves,
  isSquareAttacked,
  isInCheck,
  findKing,
} from '../js/ai/MoveGenerator.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
  WHITE_KING,
  BLACK_KING,
  WHITE_ROOK,
  WHITE_BISHOP,
  WHITE_KNIGHT,
  BLACK_ROOK,
} from '../js/ai/BoardDefinitions.js';

const rc = (r: number, c: number) => r * 9 + c;
function emptyBoard(): Int8Array {
  return new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
}

describe('findKing', () => {
  test('locates the king of the requested color', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    expect(findKing(b, COLOR_WHITE)).toBe(rc(8, 4));
    expect(findKing(b, COLOR_BLACK)).toBe(rc(0, 4));
  });

  test('returns -1 when the color has no king', () => {
    const b = emptyBoard();
    b[rc(0, 4)] = BLACK_KING;
    expect(findKing(b, COLOR_WHITE)).toBe(-1);
  });
});

describe('isSquareAttacked — per piece type', () => {
  test('a rook attacks along rank and file but not diagonally, and is blocked', () => {
    const b = emptyBoard();
    b[rc(4, 4)] = WHITE_ROOK;
    // same rank / file
    expect(isSquareAttacked(b, rc(4, 0), COLOR_WHITE)).toBe(true);
    expect(isSquareAttacked(b, rc(0, 4), COLOR_WHITE)).toBe(true);
    // diagonal — not attacked by a rook
    expect(isSquareAttacked(b, rc(6, 6), COLOR_WHITE)).toBe(false);
    // blocker stops the ray
    b[rc(4, 2)] = BLACK_ROOK;
    expect(isSquareAttacked(b, rc(4, 0), COLOR_WHITE)).toBe(false); // blocked at (4,2)
    expect(isSquareAttacked(b, rc(4, 2), COLOR_WHITE)).toBe(true);  // the blocker itself is attacked
  });

  test('a bishop attacks diagonally only', () => {
    const b = emptyBoard();
    b[rc(4, 4)] = WHITE_BISHOP;
    expect(isSquareAttacked(b, rc(6, 6), COLOR_WHITE)).toBe(true);  // diagonal
    expect(isSquareAttacked(b, rc(1, 1), COLOR_WHITE)).toBe(true);  // diagonal other way
    expect(isSquareAttacked(b, rc(4, 0), COLOR_WHITE)).toBe(false); // rank — no
    expect(isSquareAttacked(b, rc(0, 4), COLOR_WHITE)).toBe(false); // file — no
  });

  test('a knight attacks in its L-pattern, ignoring blockers', () => {
    const b = emptyBoard();
    b[rc(4, 4)] = WHITE_KNIGHT;
    expect(isSquareAttacked(b, rc(6, 5), COLOR_WHITE)).toBe(true);  // (+2,+1)
    expect(isSquareAttacked(b, rc(2, 3), COLOR_WHITE)).toBe(true);  // (-2,-1)
    expect(isSquareAttacked(b, rc(5, 5), COLOR_WHITE)).toBe(false); // diagonal neighbor — no
    expect(isSquareAttacked(b, rc(4, 6), COLOR_WHITE)).toBe(false); // same rank — no
  });

  test('color matters: a white piece is not an attacker for black', () => {
    const b = emptyBoard();
    b[rc(4, 4)] = WHITE_ROOK;
    expect(isSquareAttacked(b, rc(4, 0), COLOR_WHITE)).toBe(true);
    expect(isSquareAttacked(b, rc(4, 0), COLOR_BLACK)).toBe(false);
  });
});

describe('isInCheck', () => {
  test('king on an open file with an enemy rook is in check', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_ROOK; // same file, nothing in between
    expect(isInCheck(b, COLOR_WHITE)).toBe(true);
  });

  test('interposing a piece blocks the check', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_ROOK;
    b[rc(4, 4)] = WHITE_ROOK; // block the file
    expect(isInCheck(b, COLOR_WHITE)).toBe(false);
  });

  test('a lone king with no enemies is never in check', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 0)] = BLACK_KING;
    expect(isInCheck(b, COLOR_WHITE)).toBe(false);
  });
});

describe('exact move counts for isolated pieces (king always present)', () => {
  // A far-away friendly king is included so positions are legal; its own moves
  // are counted separately and subtracted where noted.
  function movesFor(setup: (b: Int8Array) => void): number {
    const b = emptyBoard();
    b[rc(0, 0)] = WHITE_KING; // corner king: 3 moves (right, down, down-right)
    setup(b);
    return getAllLegalMoves(b, 'white').length;
  }

  test('corner king alone has exactly 3 moves', () => {
    const b = emptyBoard();
    b[rc(0, 0)] = WHITE_KING;
    b[rc(8, 8)] = BLACK_KING; // far away, does not interfere
    expect(getAllLegalMoves(b, 'white').length).toBe(3);
  });

  test('a knight in the center adds exactly 8 moves', () => {
    const total = movesFor(b => {
      b[rc(4, 4)] = WHITE_KNIGHT; // center knight: 8 L-moves, none off-board
    });
    expect(total).toBe(3 + 8);
  });

  test('a knight in the corner adds exactly 2 moves', () => {
    const total = movesFor(b => {
      b[rc(8, 8)] = WHITE_KNIGHT; // opposite corner: only (6,7) and (7,6)
    });
    expect(total).toBe(3 + 2);
  });

  test('a rook on an otherwise empty 9x9 board adds exactly 16 moves', () => {
    const total = movesFor(b => {
      b[rc(4, 4)] = WHITE_ROOK; // 8 along the rank + 8 along the file
    });
    expect(total).toBe(3 + 16);
  });
});
