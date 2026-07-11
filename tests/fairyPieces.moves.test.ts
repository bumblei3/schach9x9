/**
 * Focused move-generation tests for the 9x9 fairy pieces.
 *
 * schach9x9 adds three compound pieces on top of standard chess:
 *   - Archbishop (a) = Bishop + Knight
 *   - Chancellor (c) = Rook   + Knight
 *   - Angel      (e) = Queen  + Knight   (Queen = Rook + Bishop)
 *
 * These pieces are the defining feature of the variant, yet had no dedicated
 * move-count tests. This suite locks their exact generation on an empty board
 * and verifies the compound identities (archbishop = bishop + knight, etc.)
 * directly from getAllLegalMoves, so any regression in the fairy-piece move
 * offsets is caught immediately.
 *
 * Setup: the friendly king sits at (1,0) — deliberately NOT on row 4, column 4,
 * or any diagonal through the tested center square (4,4) — so it never blocks
 * or extends the tested piece's rays. The king contributes exactly 5 of its own
 * moves from (1,0), which we subtract to isolate the piece under test.
 */

import { describe, test, expect } from 'vitest';
import { getAllLegalMoves } from '../js/ai/MoveGenerator.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_KING,
  WHITE_BISHOP,
  WHITE_ROOK,
  WHITE_KNIGHT,
  WHITE_QUEEN,
  WHITE_ARCHBISHOP,
  WHITE_CHANCELLOR,
  WHITE_ANGEL,
} from '../js/ai/BoardDefinitions.js';

const rc = (r: number, c: number) => r * 9 + c;
const KING_SQ = rc(1, 0); // off every line/diagonal through (4, 4)
const CENTER = rc(4, 4);
const KING_MOVES = 5; // king's own moves from (1,0), verified empirically

function emptyBoard(): Int8Array {
  return new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
}

/** Legal-move count of a single white piece at (4,4), excluding the king's moves. */
function pieceMoves(piece: number): number {
  const b = emptyBoard();
  b[KING_SQ] = WHITE_KING;
  b[CENTER] = piece;
  return getAllLegalMoves(b, 'white').length - KING_MOVES;
}

describe('fairy piece move counts on an empty 9x9 board (piece at center)', () => {
  // Baselines for the standard components.
  test('bishop from the center reaches 16 squares (4 per diagonal)', () => {
    expect(pieceMoves(WHITE_BISHOP)).toBe(16);
  });

  test('rook from the center reaches 16 squares (8 per axis)', () => {
    expect(pieceMoves(WHITE_ROOK)).toBe(16);
  });

  test('knight from the center has all 8 L-jumps', () => {
    expect(pieceMoves(WHITE_KNIGHT)).toBe(8);
  });

  test('queen from the center reaches 32 squares (rook + bishop)', () => {
    expect(pieceMoves(WHITE_QUEEN)).toBe(32);
  });

  // Fairy pieces — exact counts.
  test('archbishop from the center has 24 moves', () => {
    expect(pieceMoves(WHITE_ARCHBISHOP)).toBe(24);
  });

  test('chancellor from the center has 24 moves', () => {
    expect(pieceMoves(WHITE_CHANCELLOR)).toBe(24);
  });

  test('angel from the center has 40 moves', () => {
    expect(pieceMoves(WHITE_ANGEL)).toBe(40);
  });
});

describe('compound-piece identities (derived from move generation)', () => {
  test('archbishop = bishop + knight', () => {
    expect(pieceMoves(WHITE_ARCHBISHOP)).toBe(pieceMoves(WHITE_BISHOP) + pieceMoves(WHITE_KNIGHT));
  });

  test('chancellor = rook + knight', () => {
    expect(pieceMoves(WHITE_CHANCELLOR)).toBe(pieceMoves(WHITE_ROOK) + pieceMoves(WHITE_KNIGHT));
  });

  test('angel = queen + knight', () => {
    expect(pieceMoves(WHITE_ANGEL)).toBe(pieceMoves(WHITE_QUEEN) + pieceMoves(WHITE_KNIGHT));
  });

  test('angel is the strongest piece (most moves) at the center', () => {
    const others = [
      WHITE_BISHOP, WHITE_ROOK, WHITE_KNIGHT, WHITE_QUEEN,
      WHITE_ARCHBISHOP, WHITE_CHANCELLOR,
    ].map(pieceMoves);
    const angel = pieceMoves(WHITE_ANGEL);
    for (const n of others) expect(angel).toBeGreaterThan(n);
  });
});
