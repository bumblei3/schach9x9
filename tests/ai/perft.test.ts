import { describe, test, expect } from 'vitest';
import { getAllLegalMoves, makeMove, undoMove } from '../../js/ai/MoveGenerator.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  COLOR_WHITE,
  COLOR_BLACK,
  WHITE_KING,
  BLACK_KING,
  WHITE_ROOK,
  BLACK_ROOK,
  WHITE_KNIGHT,
  PIECE_PAWN,
} from '../../js/ai/BoardDefinitions.js';

const rc = (r: number, c: number) => r * 9 + c;

/**
 * Perft: counts the number of leaf nodes in the move tree to a given depth.
 * A single wrong/missing move anywhere in generation, make/unmake, or legality
 * filtering changes the count, so exact perft numbers are the gold-standard
 * regression test for a move generator.
 *
 * The reference numbers below are locked from the current (verified) generator.
 * Shallow values (d1/d2) are additionally provable by hand; the symmetry tests
 * give an independent check that does not depend on trusting a magic number.
 */
function perft(board: Int8Array, depth: number, color: number): number {
  if (depth === 0) return 1;
  const moves = getAllLegalMoves(board, color === COLOR_WHITE ? 'white' : 'black');
  let nodes = 0;
  for (const move of moves) {
    const undo = makeMove(board, move);
    nodes += perft(board, depth - 1, color === COLOR_WHITE ? COLOR_BLACK : COLOR_WHITE);
    undoMove(board, undo);
  }
  return nodes;
}

function emptyBoard(): Int8Array {
  return new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
}

describe('Perft — exact reference counts', () => {
  test('two kings (8,4)/(0,4): d1=5, d2=25, d3=170', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    expect(perft(b, 1, COLOR_WHITE)).toBe(5);
    expect(perft(b, 2, COLOR_WHITE)).toBe(25);
    expect(perft(b, 3, COLOR_WHITE)).toBe(170);
  });

  test('king+rook vs king+rook: d1=16, d2=238', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    b[rc(8, 0)] = WHITE_ROOK;
    b[rc(0, 8)] = BLACK_ROOK;
    // King (5) + Rook on empty back rank/file: 16 moves total for white.
    expect(perft(b, 1, COLOR_WHITE)).toBe(16);
    expect(perft(b, 2, COLOR_WHITE)).toBe(238);
  });

  test('king+knight vs king: d1=13, d2=61', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    b[rc(4, 4)] = WHITE_KNIGHT; // 8 knight jumps + 5 king moves = 13
    expect(perft(b, 1, COLOR_WHITE)).toBe(13);
    expect(perft(b, 2, COLOR_WHITE)).toBe(61);
  });
});

describe('Perft — provable shallow counts', () => {
  test('d1 for two kings equals the king move count by hand', () => {
    // White king at (8,4): flight squares (8,3)(8,5)(7,3)(7,4)(7,5) = 5.
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    expect(perft(b, 1, COLOR_WHITE)).toBe(5);
    expect(getAllLegalMoves(b, 'white')).toHaveLength(5);
  });

  test('d2 equals white replies times black replies (5 x 5) for the symmetric KK position', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    expect(perft(b, 2, COLOR_WHITE)).toBe(25);
  });
});

describe('Perft — symmetry invariants (independent of magic numbers)', () => {
  // For a position that is mirror-symmetric between the two colours, the number
  // of leaf nodes must be identical whether White or Black moves first.
  test('mirror-symmetric KK position: white-to-move perft == black-to-move perft', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    for (const d of [1, 2, 3]) {
      expect(perft(b, d, COLOR_WHITE)).toBe(perft(b, d, COLOR_BLACK));
    }
  });

  test('mirror-symmetric KR vs KR position: colour-swapped perft is equal', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    b[rc(8, 0)] = WHITE_ROOK;
    b[rc(0, 8)] = BLACK_ROOK; // mirror of the white rook through the board center
    for (const d of [1, 2]) {
      expect(perft(b, d, COLOR_WHITE)).toBe(perft(b, d, COLOR_BLACK));
    }
  });
});

describe('Perft — make/unmake integrity', () => {
  test('the board is fully restored after a perft traversal', () => {
    const b = emptyBoard();
    b[rc(8, 4)] = WHITE_KING;
    b[rc(0, 4)] = BLACK_KING;
    b[rc(7, 4)] = PIECE_PAWN | COLOR_WHITE;
    const before = Array.from(b);
    perft(b, 3, COLOR_WHITE);
    expect(Array.from(b)).toEqual(before); // make/unmake left no residue
  });
});
