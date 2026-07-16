/**
 * Focused invariant tests for js/evaluate.ts (static board evaluation)
 *
 * evaluate(b, c, evalConfig) returns the score from side `c`'s perspective
 * (positive = good for c). These tests assert the *contract* of the eval:
 *   - material advantage is reflected with the correct sign per side
 *   - a symmetric position evaluates ~0 from either side's perspective
 *   - more material for the side to move => higher score
 *   - piece-square tables reward advanced pawns
 *   - EVAL_VALUES are internally consistent
 * Pure module (IntBoard + math), no DOM, no engine required.
 */

import { describe, test, expect } from 'vitest';
import { evaluate, EVAL_VALUES, buildCenteredPST, PSQT_CENTER } from '../js/evaluate.js';
import {
  WHITE_PAWN,
  WHITE_ROOK,
  WHITE_QUEEN,
  WHITE_KING,
  WHITE_KNIGHT,
  BLACK_PAWN,
  BLACK_ROOK,
  BLACK_KING,
  BLACK_KNIGHT,
  COLOR_WHITE,
  COLOR_BLACK,
  PIECE_PAWN,
  PIECE_KNIGHT,
  PIECE_BISHOP,
  PIECE_ROOK,
  PIECE_QUEEN,
  PIECE_KING,
  PIECE_NONE,
  TYPE_MASK,
} from '../js/ai/BoardDefinitions.js';

const idx = (r: number, c: number) => r * 9 + c;

function emptyBoard(): Int8Array {
  return new Int8Array(81).fill(PIECE_NONE);
}

describe('evaluate — material sign per side', () => {
  test('a white rook advantage scores positive for white, negative for black', () => {
    const b = emptyBoard();
    b[idx(4, 4)] = WHITE_KING;
    b[idx(4, 0)] = BLACK_KING;
    b[idx(2, 2)] = WHITE_ROOK; // extra white material

    const fromWhite = evaluate(b, COLOR_WHITE);
    const fromBlack = evaluate(b, COLOR_BLACK);
    expect(fromWhite).toBeGreaterThan(0);
    expect(fromBlack).toBeLessThan(0);
    // Opposite perspectives should be roughly negations.
    expect(fromBlack).toBeCloseTo(-fromWhite, -1);
  });

  test('more material for the side to move => higher score', () => {
    const bare = emptyBoard();
    bare[idx(4, 4)] = WHITE_KING;
    bare[idx(4, 0)] = BLACK_KING;

    const withQueen = emptyBoard();
    withQueen[idx(4, 4)] = WHITE_KING;
    withQueen[idx(4, 0)] = BLACK_KING;
    withQueen[idx(2, 2)] = WHITE_QUEEN;

    expect(evaluate(withQueen, COLOR_WHITE)).toBeGreaterThan(evaluate(bare, COLOR_WHITE));
    expect(evaluate(withQueen, COLOR_BLACK)).toBeLessThan(evaluate(bare, COLOR_BLACK));
  });
});

describe('evaluate — symmetric position is balanced', () => {
  test('a perfectly symmetric position evaluates ~0 from both sides', () => {
    const b = emptyBoard();
    // Mirror: white piece at (r,c) and identical black piece at (8-r, 8-c).
    const pieces: Array<[number, number, number]> = [
      [4, 4, WHITE_KING],
      [4, 0, BLACK_KING],
      [6, 1, WHITE_PAWN],
      [2, 7, BLACK_PAWN],
      [3, 3, WHITE_KNIGHT],
      [5, 5, BLACK_KNIGHT],
      [1, 2, WHITE_ROOK],
      [7, 6, BLACK_ROOK],
    ];
    for (const [r, c, p] of pieces) b[idx(r, c)] = p;

    const fromWhite = evaluate(b, COLOR_WHITE);
    const fromBlack = evaluate(b, COLOR_BLACK);
    // Material is balanced => both near 0, and opposite signs.
    expect(Math.abs(fromWhite)).toBeLessThan(50);
    expect(Math.abs(fromBlack)).toBeLessThan(50);
    expect(fromBlack).toBeCloseTo(-fromWhite, -1);
  });
});

describe('evaluate — H-P1 centered PSQT geometry', () => {
  test('buildCenteredPST peaks at the true 9x9 center (4,4)', () => {
    const t = buildCenteredPST(30, -10, 2);
    expect(t).toHaveLength(81);
    const centerIdx = PSQT_CENTER.r * 9 + PSQT_CENTER.c;
    expect(t[centerIdx]).toBe(30);
    // Corners are edges
    expect(t[0]).toBe(-10);
    expect(t[8]).toBe(-10);
    expect(t[72]).toBe(-10);
    expect(t[80]).toBe(-10);
    // Center strictly better than a near-edge square
    expect(t[centerIdx]).toBeGreaterThan(t[1 * 9 + 1]!);
  });

  test('a knight on e5 (center) outscores a knight in the corner (same material)', () => {
    const corner = emptyBoard();
    corner[idx(4, 0)] = BLACK_KING;
    corner[idx(8, 8)] = WHITE_KING;
    corner[idx(0, 0)] = WHITE_KNIGHT;

    const center = emptyBoard();
    center[idx(4, 0)] = BLACK_KING;
    center[idx(8, 8)] = WHITE_KING;
    center[idx(4, 4)] = WHITE_KNIGHT;

    expect(evaluate(center, COLOR_WHITE)).toBeGreaterThan(evaluate(corner, COLOR_WHITE));
  });
});

describe('evaluate — piece-square table effects', () => {
  test('an advanced white pawn scores higher than a backward one (same file)', () => {
    const back = emptyBoard();
    back[idx(4, 4)] = WHITE_KING;
    back[idx(4, 0)] = BLACK_KING;
    back[idx(6, 3)] = WHITE_PAWN; // near home rank

    const adv = emptyBoard();
    adv[idx(4, 4)] = WHITE_KING;
    adv[idx(4, 0)] = BLACK_KING;
    adv[idx(1, 3)] = WHITE_PAWN; // near promotion rank

    // Advancing the pawn improves White's score.
    expect(evaluate(adv, COLOR_WHITE)).toBeGreaterThan(evaluate(back, COLOR_WHITE));
  });

  test('a pawn on the promotion rank (row 0) is worth more than on row 6', () => {
    const b1 = emptyBoard();
    b1[idx(4, 4)] = WHITE_KING;
    b1[idx(4, 0)] = BLACK_KING;
    b1[idx(0, 4)] = WHITE_PAWN;
    const s1 = evaluate(b1, COLOR_WHITE);

    const b2 = emptyBoard();
    b2[idx(4, 4)] = WHITE_KING;
    b2[idx(4, 0)] = BLACK_KING;
    b2[idx(6, 4)] = WHITE_PAWN;
    const s2 = evaluate(b2, COLOR_WHITE);

    expect(s1).toBeGreaterThan(s2);
  });
});

describe('evaluate — king placement / safety signal', () => {
  test('a king in the centre is scored differently than in the corner', () => {
    const centre = emptyBoard();
    centre[idx(4, 4)] = WHITE_KING;
    centre[idx(8, 8)] = BLACK_KING;

    const corner = emptyBoard();
    corner[idx(0, 0)] = WHITE_KING;
    corner[idx(8, 8)] = BLACK_KING;

    // Both kings present; the relative safety of White's king differs, so the
    // two positions must not evaluate identically from White's perspective.
    expect(evaluate(centre, COLOR_WHITE)).not.toBe(evaluate(corner, COLOR_WHITE));
  });
});

describe('evaluate — personality weights', () => {
  test('evaluation is deterministic and stable for a fixed position', () => {
    const b = emptyBoard();
    b[idx(4, 4)] = WHITE_KING;
    b[idx(4, 0)] = BLACK_KING;
    b[idx(2, 2)] = WHITE_ROOK;
    b[idx(6, 6)] = BLACK_ROOK;
    const a = evaluate(b, COLOR_WHITE);
    const c = evaluate(b, COLOR_WHITE);
    expect(c).toBe(a);
  });

  test('AGGRESSIVE and SOLID personalities weight attack vs safety oppositely', () => {
    // Imported indirectly via getPersonalityWeights is internal; verify the
    // observable contract: identical material but a position with an exposed
    // enemy king should differ between AGGRESSIVE (rewards attack) and SOLID.
    const b = emptyBoard();
    b[idx(4, 4)] = WHITE_KING;
    b[idx(0, 0)] = BLACK_KING; // black king exposed
    b[idx(2, 2)] = WHITE_ROOK;
    b[idx(6, 6)] = BLACK_ROOK;

    const aggressive = evaluate(b, COLOR_WHITE, { personality: 'AGGRESSIVE' });
    const solid = evaluate(b, COLOR_WHITE, { personality: 'SOLID' });
    // Both should still favour White (material + attack on exposed king);
    // they must not be identical because weights differ.
    expect(aggressive).toBeGreaterThan(0);
    expect(solid).toBeGreaterThan(0);
    expect(aggressive).not.toBe(solid);
  });
});

describe('EVAL_VALUES consistency', () => {
  test('values are strictly ordered by nominal piece strength', () => {
    const order = [
      PIECE_PAWN,
      PIECE_KNIGHT,
      PIECE_BISHOP,
      PIECE_ROOK,
      PIECE_QUEEN,
      PIECE_KING,
    ] as const;
    for (let i = 1; i < order.length; i++) {
      expect(EVAL_VALUES[order[i]]).toBeGreaterThan(EVAL_VALUES[order[i - 1]]);
    }
  });

  test('king value dominates all other pieces', () => {
    for (const t of [PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN]) {
      expect(EVAL_VALUES[PIECE_KING]).toBeGreaterThan(EVAL_VALUES[t]);
    }
  });

  test('every decoded piece type maps to a positive value', () => {
    const types = [PIECE_PAWN, PIECE_KNIGHT, PIECE_BISHOP, PIECE_ROOK, PIECE_QUEEN, PIECE_KING];
    for (const t of types) {
      expect(EVAL_VALUES[t]).toBeGreaterThan(0);
      // Sanity: TYPE_MASK extract produces a valid key.
      expect(t & TYPE_MASK).toBe(t);
    }
  });
});
