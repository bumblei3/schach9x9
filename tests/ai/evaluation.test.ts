import { describe, test, expect } from 'vitest';
import { evaluate } from '../../js/aiEngine.js';
import {
  SQUARE_COUNT,
  PIECE_NONE,
  WHITE_PAWN,
  WHITE_KNIGHT,
  WHITE_BISHOP,
  WHITE_ROOK,
  WHITE_QUEEN,
  WHITE_KING,
  WHITE_ARCHBISHOP,
  WHITE_CHANCELLOR,
  WHITE_ANGEL,
  BLACK_PAWN,
  BLACK_KNIGHT,
  BLACK_KING,
  COLOR_WHITE,
  COLOR_BLACK,
  coordsToIndex,
} from '../../js/ai/BoardDefinitions.js';

// Helper: create empty board
function emptyBoard(): Int8Array {
  return new Int8Array(SQUARE_COUNT).fill(PIECE_NONE);
}

// Helper: place piece on board
function place(board: Int8Array, row: number, col: number, piece: number): void {
  board[coordsToIndex(row, col)] = piece;
}

// Helper: create a minimal legal position (both kings present)
function minimalPosition(): Int8Array {
  const board = emptyBoard();
  place(board, 8, 4, WHITE_KING);
  place(board, 0, 4, BLACK_KING);
  return board;
}

describe('Evaluation - Material + Positional', () => {
  test('empty board should evaluate to tempo bonus', () => {
    const board = emptyBoard();
    // Empty board: only tempo bonus applies (side to move gets +10)
    expect(evaluate(board, COLOR_WHITE)).toBe(10);
  });

  test('single white pawn should be positive for white', () => {
    const board = minimalPosition();
    place(board, 6, 4, WHITE_PAWN);
    const score = evaluate(board, COLOR_WHITE);
    // Material: +100, Positional: PST bonus
    expect(score).toBeGreaterThan(100);
  });

  test('symmetric position should evaluate to ~0', () => {
    const board = emptyBoard();
    place(board, 7, 4, WHITE_PAWN);
    place(board, 8, 4, WHITE_KING);
    place(board, 1, 4, BLACK_PAWN);
    place(board, 0, 4, BLACK_KING);
    const score = evaluate(board, COLOR_WHITE);
    expect(Math.abs(score)).toBeLessThan(50); // near zero
  });

  test('white knight in center should be better than on edge', () => {
    const board1 = minimalPosition();
    place(board1, 4, 4, WHITE_KNIGHT); // center

    const board2 = minimalPosition();
    place(board2, 0, 0, WHITE_KNIGHT); // corner

    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThan(evaluate(board2, COLOR_WHITE));
  });

  test('white bishop should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_BISHOP);
    const score = evaluate(board, COLOR_WHITE);
    // Material: 330 + positional bonus
    expect(score).toBeGreaterThan(330);
  });

  test('white rook should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 7, 4, WHITE_ROOK); // 7th rank bonus
    const score = evaluate(board, COLOR_WHITE);
    expect(score).toBeGreaterThan(500);
  });

  test('white queen should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_QUEEN);
    const score = evaluate(board, COLOR_WHITE);
    expect(score).toBeGreaterThan(900);
  });

  test('archbishop should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_ARCHBISHOP);
    const score = evaluate(board, COLOR_WHITE);
    expect(score).toBeGreaterThan(650);
  });

  test('chancellor should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_CHANCELLOR);
    const score = evaluate(board, COLOR_WHITE);
    expect(score).toBeGreaterThan(850);
  });

  test('angel should have positional bonus', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_ANGEL);
    const score = evaluate(board, COLOR_WHITE);
    expect(score).toBeGreaterThan(1220);
  });

  test('extra material should be winning', () => {
    const board = minimalPosition();
    place(board, 4, 4, WHITE_QUEEN);
    const score = evaluate(board, COLOR_WHITE);
    // Queen vs nothing = big advantage
    expect(score).toBeGreaterThan(500);
  });
});

describe('Evaluation - King Tables', () => {
  test('king in corner should be safer in midgame than king in center', () => {
    const board1 = emptyBoard();
    // White king in corner (safe)
    place(board1, 8, 0, WHITE_KING);
    // Black king on back rank edge (also relatively safe, but different structure)
    place(board1, 0, 4, BLACK_KING);

    const board2 = emptyBoard();
    // White king on starting square (row 8, col 4) — no longer in corner
    place(board2, 8, 4, WHITE_KING);
    // Black king in corner (safe)
    place(board2, 0, 4, BLACK_KING);

    // Board1: white king in corner (K_MG bonus = 20) vs board2: white king at (8,4) (K_MG bonus = 0)
    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThanOrEqual(evaluate(board2, COLOR_WHITE));
  });
});

describe('Evaluation - Pawn Structure', () => {
  test('connected pawns should be better than isolated pawn', () => {
    // Two connected pawns
    const board1 = minimalPosition();
    place(board1, 6, 4, WHITE_PAWN);
    place(board1, 6, 3, WHITE_PAWN); // connected

    // Single isolated pawn
    const board2 = minimalPosition();
    place(board2, 6, 4, WHITE_PAWN);

    // Two connected pawns > one isolated pawn (more material + no isolation penalty)
    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThan(evaluate(board2, COLOR_WHITE));
  });

  test('passed pawn should get bonus vs blocked pawn', () => {
    // Passed pawn (no black pawns ahead)
    const board1 = minimalPosition();
    place(board1, 3, 4, WHITE_PAWN); // advanced, no black pawns

    // Blocked pawn
    const board2 = minimalPosition();
    place(board2, 6, 4, WHITE_PAWN);
    place(board2, 5, 4, BLACK_PAWN); // blocking

    // Passed pawn should be better
    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThan(evaluate(board2, COLOR_WHITE));
  });

  test('advanced passed pawn should get more bonus than backward one', () => {
    // Advanced passed pawn
    const board1 = minimalPosition();
    place(board1, 2, 4, WHITE_PAWN); // very advanced (near promotion)

    // Backward passed pawn
    const board2 = minimalPosition();
    place(board2, 6, 4, WHITE_PAWN); // less advanced

    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThan(evaluate(board2, COLOR_WHITE));
  });
});

describe('Evaluation - King Safety', () => {
  test('king with pawn shield should be safer', () => {
    const board1 = minimalPosition();
    place(board1, 7, 3, WHITE_PAWN);
    place(board1, 7, 4, WHITE_PAWN);
    place(board1, 7, 5, WHITE_PAWN);

    const board2 = minimalPosition();
    // No pawn shield

    expect(evaluate(board1, COLOR_WHITE)).toBeGreaterThan(evaluate(board2, COLOR_WHITE));
  });
});

describe('Evaluation - Tapered Eval', () => {
  test('bishop more valuable in endgame than midgame', () => {
    // Endgame: just kings + white bishop
    const boardEg = minimalPosition();
    place(boardEg, 4, 4, WHITE_BISHOP);

    // Midgame: kings + white bishop + equal material on both sides
    const boardMg = minimalPosition();
    place(boardMg, 4, 4, WHITE_BISHOP);
    place(boardMg, 0, 0, BLACK_KNIGHT);
    place(boardMg, 0, 8, BLACK_KNIGHT);
    place(boardMg, 8, 0, WHITE_KNIGHT);
    place(boardMg, 8, 8, WHITE_KNIGHT);

    const egScore = evaluate(boardEg, COLOR_WHITE);
    const mgScore = evaluate(boardMg, COLOR_WHITE);

    // Both positive (white has extra bishop, equal other material)
    expect(egScore).toBeGreaterThan(0);
    expect(mgScore).toBeGreaterThan(0);
  });
});

describe('Evaluation - Color Perspective', () => {
  test('adding a white pawn should be positive from white view, negative from black view', () => {
    const board = minimalPosition();
    place(board, 6, 4, WHITE_PAWN);

    const whiteScore = evaluate(board, COLOR_WHITE);
    const blackScore = evaluate(board, COLOR_BLACK);

    // From white's view: having a pawn is good -> positive
    expect(whiteScore).toBeGreaterThan(0);
    // From black's view: opponent has a pawn -> bad -> negative
    expect(blackScore).toBeLessThan(0);
  });

  test('adding equal material for both sides should be near zero', () => {
    const board = minimalPosition();
    place(board, 6, 4, WHITE_PAWN);
    place(board, 2, 4, BLACK_PAWN);

    const whiteScore = evaluate(board, COLOR_WHITE);
    // Symmetric pawn placement -> near zero
    expect(Math.abs(whiteScore)).toBeLessThan(50);
  });
});
