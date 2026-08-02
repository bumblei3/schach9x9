/**
 * 8×8 integer move-gen invariants needed for absolute Stockfish matches.
 */
import { describe, expect, test, beforeEach } from 'vitest';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  type Move,
} from '../js/ai/MoveGenerator.js';
import {
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_PAWN,
  PIECE_KING,
  PIECE_QUEEN,
  PIECE_ROOK,
  PIECE_KNIGHT,
  PIECE_BISHOP,
} from '../js/ai/BoardDefinitions.js';

const SIZE = 8;

function emptyBoard(): Int8Array {
  return new Int8Array(SIZE * SIZE);
}

function startpos(): Int8Array {
  const b = emptyBoard();
  const back = [PIECE_ROOK, PIECE_KNIGHT, PIECE_BISHOP, PIECE_QUEEN, PIECE_KING, PIECE_BISHOP, PIECE_KNIGHT, PIECE_ROOK];
  for (let c = 0; c < SIZE; c++) {
    b[0 * SIZE + c] = COLOR_BLACK | back[c]!;
    b[1 * SIZE + c] = COLOR_BLACK | PIECE_PAWN;
    b[6 * SIZE + c] = COLOR_WHITE | PIECE_PAWN;
    b[7 * SIZE + c] = COLOR_WHITE | back[c]!;
  }
  return b;
}

describe('MoveGenerator 8x8', () => {
  beforeEach(() => {
    setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
  });

  test('start position has 20 legal moves for white', () => {
    const moves = getAllLegalMoves(startpos(), 'white');
    expect(moves.length).toBe(20);
  });

  test('after e2e4 black still has 20 legal moves (double-push rank 1)', () => {
    const b = startpos();
    // e2 = r6 c4 = 52; e4 = r4 c4 = 36
    const e2e4: Move = { from: 52, to: 36, flags: 'double' };
    makeMove(b, e2e4);
    const black = getAllLegalMoves(b, 'black');
    expect(black.length).toBe(20);
    // e7e5 must exist: e7 = r1 c4 = 12; e5 = r3 c4 = 28
    expect(black.some(m => m.from === 12 && m.to === 28)).toBe(true);
  });

  test('white pawn on 7th rank auto-promotes to queen', () => {
    const b = emptyBoard();
    b[1 * SIZE + 0] = COLOR_WHITE | PIECE_PAWN; // a7
    b[7 * SIZE + 4] = COLOR_WHITE | PIECE_KING;
    b[0 * SIZE + 4] = COLOR_BLACK | PIECE_KING;
    const moves = getAllLegalMoves(b, 'white');
    const a8 = moves.find(m => m.from === 8 && m.to === 0);
    expect(a8).toBeDefined();
    expect(a8!.promotion).toBe(PIECE_QUEEN);
    const undo = makeMove(b, a8!);
    expect(b[0] & 15).toBe(PIECE_QUEEN);
    expect(b[0] & COLOR_WHITE).toBe(COLOR_WHITE);
    undoMove(b, undo);
    expect(b[8]).toBe(COLOR_WHITE | PIECE_PAWN);
    expect(b[0]).toBe(0);
  });
});
