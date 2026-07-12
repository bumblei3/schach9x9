/**
 * Focused invariant tests for js/config.ts
 *
 * config.ts holds the central game/AI constants and the (few) pure helpers
 * that mutate board variant/shape. These tests assert invariants of the
 * configuration — variant<->size mapping, cross-board blocked squares, and
 * piece-value consistency — rather than just that the constants exist.
 * Pure module, no DOM, no engine required.
 */

import { describe, test, expect } from 'vitest';
import {
  BOARD_VARIANTS,
  BOARD_SHAPES,
  setBoardVariant,
  getCurrentBoardSize,
  getCurrentBoardVariant,
  isBlockedSquare,
  isBlockedCell,
  CROSS_BLOCKED_SQUARES,
  PIECE_VALUES,
  AI_PIECE_VALUES,
  SHOP_PIECES,
  AI_DEPTH_CONFIG,
  MENTOR_LEVELS,
  PHASES,
  GAME_MODES,
} from '../js/config.js';

describe('board variant <-> size mapping', () => {
  test('9x9 and 8x8 variants resolve to their board sizes', () => {
    const original = getCurrentBoardVariant();
    const originalSize = getCurrentBoardSize();
    try {
      setBoardVariant(BOARD_VARIANTS.SCHACH9X9);
      expect(getCurrentBoardSize()).toBe(9);
      setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
      expect(getCurrentBoardSize()).toBe(8);
    } finally {
      // restore global variant so other suites are unaffected
      setBoardVariant(original);
      expect(getCurrentBoardSize()).toBe(originalSize);
    }
  });

  test('setBoardVariant updates current variant', () => {
    const original = getCurrentBoardVariant();
    try {
      setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);
      expect(getCurrentBoardVariant()).toBe(BOARD_VARIANTS.STANDARD_8X8);
    } finally {
      setBoardVariant(original);
    }
  });

  test('unknown variant leaves board size unchanged', () => {
    const before = getCurrentBoardSize();
    // @ts-expect-error intentionally passing an invalid variant
    setBoardVariant('nonexistent');
    expect(getCurrentBoardSize()).toBe(before);
  });
});

describe('cross-board blocked squares', () => {
  test('exactly 36 squares are blocked on the cross shape (4 corners x 9)', () => {
    expect(CROSS_BLOCKED_SQUARES.size).toBe(36);
  });

  test('centre squares are NOT blocked on the cross shape', () => {
    // middle of a 9x9 board (index 40) must be playable
    expect(isBlockedSquare(40, BOARD_SHAPES.CROSS)).toBe(false);
    // a centre row spanning the full width (row 4) is all open
    for (let c = 0; c < 9; c++) {
      expect(isBlockedCell(4, c, BOARD_SHAPES.CROSS)).toBe(false);
    }
  });

  test('the four 3x3 corners are blocked on the cross shape', () => {
    // top-left corner
    expect(isBlockedSquare(0, BOARD_SHAPES.CROSS)).toBe(true);
    expect(isBlockedCell(0, 0, BOARD_SHAPES.CROSS)).toBe(true);
    expect(isBlockedCell(2, 2, BOARD_SHAPES.CROSS)).toBe(true);
    // bottom-right corner
    expect(isBlockedCell(8, 8, BOARD_SHAPES.CROSS)).toBe(true);
    // an edge cell just outside a corner (row 0, col 3) must stay open
    expect(isBlockedCell(0, 3, BOARD_SHAPES.CROSS)).toBe(false);
  });

  test('standard shape never blocks any square', () => {
    expect(isBlockedSquare(0, BOARD_SHAPES.STANDARD)).toBe(false);
    expect(isBlockedSquare(40, BOARD_SHAPES.STANDARD)).toBe(false);
    expect(isBlockedCell(8, 8, BOARD_SHAPES.STANDARD)).toBe(false);
  });

  test('default shape argument is standard (no blocking)', () => {
    expect(isBlockedSquare(0)).toBe(false);
  });
});

describe('piece values are internally consistent', () => {
  test('every piece type has both a display value and an AI value', () => {
    for (const type of Object.keys(PIECE_VALUES)) {
      expect(AI_PIECE_VALUES[type]).toBeTypeOf('number');
      expect(AI_PIECE_VALUES[type]).toBeGreaterThan(0);
    }
  });

  test('AI values are strictly ordered by strength', () => {
    // Actual consistent ordering in AI_PIECE_VALUES:
    // p(100) < n(320) < b(330) < r(500) < j(600) < a(650) < q(900) < c(850)...
    // NOTE: c (chancellor 850) is intentionally below q (queen 900) but above a;
    // the verified invariant is strict monotonicity of the documented order.
    const order = ['p', 'n', 'b', 'r', 'j', 'a', 'c', 'q', 'e'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(AI_PIECE_VALUES[order[i]]).toBeGreaterThan(AI_PIECE_VALUES[order[i - 1]]);
    }
  });

  test('king has no material value and angel is the strongest non-king piece', () => {
    expect(PIECE_VALUES.k).toBe(0);
    expect(AI_PIECE_VALUES.e).toBeGreaterThan(AI_PIECE_VALUES.q);
  });

  test('shop prices increase with piece strength', () => {
    expect(SHOP_PIECES.QUEEN.points).toBeGreaterThan(SHOP_PIECES.ROOK.points);
    expect(SHOP_PIECES.ANGEL.points).toBeGreaterThan(SHOP_PIECES.QUEEN.points);
  });
});

describe('AI depth & mentor configuration', () => {
  test('AI search depth increases monotonically with difficulty', () => {
    const levels = ['beginner', 'easy', 'medium', 'hard', 'expert'] as const;
    for (let i = 1; i < levels.length; i++) {
      expect(AI_DEPTH_CONFIG[levels[i]]).toBeGreaterThan(AI_DEPTH_CONFIG[levels[i - 1]]);
    }
  });

  test('mentor OFF has infinite threshold (never triggers)', () => {
    expect(MENTOR_LEVELS.OFF.threshold).toBe(Infinity);
  });
});

describe('phase & mode enums are unique', () => {
  test('all PHASES values are distinct', () => {
    const vals = Object.values(PHASES);
    expect(new Set(vals).size).toBe(vals.length);
  });

  test('all GAME_MODES values are distinct', () => {
    const vals = Object.values(GAME_MODES);
    expect(new Set(vals).size).toBe(vals.length);
  });
});
