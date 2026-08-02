/**
 * 8×8 integer move-gen invariants needed for absolute Stockfish matches.
 */
import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import {
  getAllLegalMoves,
  makeMove,
  undoMove,
  setRules,
  resetRules,
  getRules,
  CR_ALL,
  CR_WK,
  CR_WQ,
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
    resetRules();
  });

  afterEach(() => {
    // Do not leak 8×8 geometry into later suites (search.symmetry, etc.).
    setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
    resetRules();
  });

  test('start position has 20 legal moves for white', () => {
    setRules({ castling: CR_ALL, ep: -1 });
    const moves = getAllLegalMoves(startpos(), 'white');
    expect(moves.length).toBe(20);
  });

  test('after e2e4 black still has 20 legal moves (double-push rank 1)', () => {
    setRules({ castling: CR_ALL, ep: -1 });
    const b = startpos();
    // e2 = r6 c4 = 52; e4 = r4 c4 = 36
    const e2e4: Move = { from: 52, to: 36, flags: 'double' };
    makeMove(b, e2e4);
    expect(getRules().ep).toBe(44); // e3
    const black = getAllLegalMoves(b, 'black');
    expect(black.length).toBe(20);
    // e7e5 must exist: e7 = r1 c4 = 12; e5 = r3 c4 = 28
    expect(black.some(m => m.from === 12 && m.to === 28)).toBe(true);
  });

  test('white pawn on 7th rank generates all four promotions', () => {
    const b = emptyBoard();
    b[1 * SIZE + 0] = COLOR_WHITE | PIECE_PAWN; // a7
    b[7 * SIZE + 4] = COLOR_WHITE | PIECE_KING;
    b[0 * SIZE + 4] = COLOR_BLACK | PIECE_KING;
    const moves = getAllLegalMoves(b, 'white');
    const promos = moves.filter(m => m.from === 8 && m.to === 0);
    expect(promos.map(m => m.promotion).sort()).toEqual(
      [PIECE_QUEEN, PIECE_ROOK, PIECE_BISHOP, PIECE_KNIGHT].sort()
    );
    const toBishop = promos.find(m => m.promotion === PIECE_BISHOP)!;
    const undo = makeMove(b, toBishop);
    expect(b[0] & 15).toBe(PIECE_BISHOP);
    expect(b[0] & COLOR_WHITE).toBe(COLOR_WHITE);
    undoMove(b, undo);
    expect(b[8]).toBe(COLOR_WHITE | PIECE_PAWN);
    expect(b[0]).toBe(0);
  });

  test('kingside castling moves king and rook', () => {
    setRules({ castling: CR_WK | CR_WQ, ep: -1 });
    const b = emptyBoard();
    b[60] = COLOR_WHITE | PIECE_KING; // e1
    b[63] = COLOR_WHITE | PIECE_ROOK; // h1
    b[4] = COLOR_BLACK | PIECE_KING; // e8 (far)
    // path f1,g1 empty
    const moves = getAllLegalMoves(b, 'white');
    const oo = moves.find(m => m.flags === 'castle-k');
    expect(oo).toBeDefined();
    expect(oo!.from).toBe(60);
    expect(oo!.to).toBe(62);
    const undo = makeMove(b, oo!);
    expect(b[62] & 15).toBe(PIECE_KING);
    expect(b[61] & 15).toBe(PIECE_ROOK);
    expect(b[60]).toBe(0);
    expect(b[63]).toBe(0);
    expect(getRules().castling & (CR_WK | CR_WQ)).toBe(0);
    undoMove(b, undo);
    expect(b[60] & 15).toBe(PIECE_KING);
    expect(b[63] & 15).toBe(PIECE_ROOK);
    expect(b[62]).toBe(0);
    expect(b[61]).toBe(0);
    expect(getRules().castling & CR_WK).toBe(CR_WK);
  });

  test('en passant capture removes the double-pushed pawn', () => {
    setRules({ castling: 0, ep: -1 });
    const b = emptyBoard();
    b[7 * SIZE + 4] = COLOR_WHITE | PIECE_KING;
    b[0 * SIZE + 4] = COLOR_BLACK | PIECE_KING;
    // White pawn on e5 (row 3, col 4) = 28; black double-pushes d7-d5
    b[3 * SIZE + 4] = COLOR_WHITE | PIECE_PAWN; // e5
    b[1 * SIZE + 3] = COLOR_BLACK | PIECE_PAWN; // d7
    // Play black d7d5
    makeMove(b, { from: 1 * SIZE + 3, to: 3 * SIZE + 3, flags: 'double' });
    expect(getRules().ep).toBe(2 * SIZE + 3); // d6
    const epMoves = getAllLegalMoves(b, 'white').filter(m => m.flags === 'ep');
    expect(epMoves.length).toBe(1);
    expect(epMoves[0]!.from).toBe(28);
    expect(epMoves[0]!.to).toBe(2 * SIZE + 3);
    const undo = makeMove(b, epMoves[0]!);
    expect(b[2 * SIZE + 3] & 15).toBe(PIECE_PAWN); // white landed on d6
    expect(b[3 * SIZE + 3]).toBe(0); // black d5 gone
    undoMove(b, undo);
    expect(b[3 * SIZE + 3] & 15).toBe(PIECE_PAWN); // black restored
    expect(b[28] & 15).toBe(PIECE_PAWN);
  });
});
