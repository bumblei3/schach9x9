/**
 * Focused invariant tests for js/ai/timeManagement.ts
 *
 * timeManagement drives how much thinking time + search depth the AI allocates
 * per move. It is pure (no DOM, no engine): it takes a params object and
 * returns an allocation. These tests assert the *invariants* of the allocation
 * logic rather than just that the calls resolve — so a future refactor that
 * breaks the time-budget contract fails loudly.
 */

import { describe, test, expect } from 'vitest';
import {
  calculateTimeAllocation,
  estimatePositionComplexity,
  detectTacticalComplexity,
  type TimeAllocationParams,
} from '../js/ai/timeManagement.js';

// Helper to build a minimal params object; every field has a sane default so
// each test only overrides what it actually exercises (self-documenting).
function baseParams(overrides: Partial<TimeAllocationParams> = {}): TimeAllocationParams {
  return {
    moveNumber: 30,
    whiteTime: 120,
    blackTime: 120,
    whiteIncrement: 2,
    blackIncrement: 2,
    isWhiteTurn: true,
    pieceCount: 20,
    isInCheck: false,
    hasTacticalComplexity: false,
    personality: 'balanced',
    baseMaxDepth: 8,
    maxTimeMs: 5000,
    ...overrides,
  };
}

describe('calculateTimeAllocation — time-budget invariants', () => {
  test('allocated time is always clamped within [500ms, maxTimeMs]', () => {
    // Huge remaining time + aggressive personality should still be capped.
    const r = calculateTimeAllocation(baseParams({
      whiteTime: 100000,
      personality: 'aggressive',
      maxTimeMs: 5000,
    }));
    expect(r.allocatedTimeMs).toBeGreaterThanOrEqual(500);
    expect(r.allocatedTimeMs).toBeLessThanOrEqual(5000);
  });

  test('allocated time never exceeds the hard ceiling even in panic', () => {
    // Emergency reserve case: very little time left.
    const r = calculateTimeAllocation(baseParams({ whiteTime: 3, maxTimeMs: 2000 }));
    expect(r.allocatedTimeMs).toBeLessThanOrEqual(2000);
    expect(r.allocatedTimeMs).toBeGreaterThanOrEqual(500);
  });

  test('target depth is always within [3, baseMaxDepth]', () => {
    for (const depth of [3, 6, 10, 20]) {
      const r = calculateTimeAllocation(baseParams({ baseMaxDepth: depth, whiteTime: 100000 }));
      expect(r.targetDepth).toBeGreaterThanOrEqual(3);
      expect(r.targetDepth).toBeLessThanOrEqual(depth);
    }
  });

  test('my time is selected by turn (white vs black)', () => {
    const asWhite = calculateTimeAllocation(baseParams({ whiteTime: 60, blackTime: 5, isWhiteTurn: true }));
    const asBlack = calculateTimeAllocation(baseParams({ whiteTime: 60, blackTime: 5, isWhiteTurn: false }));
    // White has far more time, so the white-to-move allocation should be larger.
    expect(asWhite.allocatedTimeMs).toBeGreaterThan(asBlack.allocatedTimeMs);
  });
});

describe('calculateTimeAllocation — panic / time-trouble behaviour', () => {
  test('emergency reserve triggers when my time < 10s', () => {
    const r = calculateTimeAllocation(baseParams({ whiteTime: 8 }));
    expect(r.timeBudgetInfo.emergencyReserve).toBe(true);
    // In panic, singular extensions are disabled.
    expect(r.searchParams.singularExtensionsEnabled).toBe(false);
    expect(r.searchParams.probCutEnabled).toBe(false);
  });

  test('no emergency when time >= 10s', () => {
    const r = calculateTimeAllocation(baseParams({ whiteTime: 10 }));
    expect(r.timeBudgetInfo.emergencyReserve).toBe(false);
    expect(r.searchParams.singularExtensionsEnabled).toBe(true);
  });

  test('time-trouble (<30s) yields a smaller budget than comfortable time', () => {
    const comfortable = calculateTimeAllocation(baseParams({ whiteTime: 90 }));
    const trouble = calculateTimeAllocation(baseParams({ whiteTime: 20 }));
    expect(trouble.allocatedTimeMs).toBeLessThan(comfortable.allocatedTimeMs);
  });

  test('opponent time pressure lets me play faster when I am comfortable', () => {
    const oppComfortable = calculateTimeAllocation(baseParams({ whiteTime: 90, blackTime: 90 }));
    const oppLow = calculateTimeAllocation(baseParams({ whiteTime: 90, blackTime: 10 }));
    expect(oppLow.allocatedTimeMs).toBeLessThan(oppComfortable.allocatedTimeMs);
  });
});

describe('calculateTimeAllocation — opening phase', () => {
  test('opening moves cap allocated time to ~2000ms factor and lower complexity', () => {
    const opening = calculateTimeAllocation(baseParams({
      moveNumber: 5,
      maxTimeMs: 5000,
      personality: 'balanced',
    }));
    expect(opening.allocatedTimeMs).toBeLessThanOrEqual(2000); // 2000 * timeFactor(1.0)
    expect(opening.timeBudgetInfo.reason).toContain('opening');
  });

  test('opening complexity is reduced vs a midgame position with same pieces', () => {
    const openC = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: false, moveNumber: 5 });
    const midC = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: false, moveNumber: 30 });
    expect(openC.score).toBeLessThan(midC.score);
  });
});

describe('estimatePositionComplexity — bounds & monotonic factors', () => {
  test('score is always within [0,1]', () => {
    const cases = [
      { pieceCount: 32, isInCheck: true, hasTacticalComplexity: true, moveNumber: 1 },
      { pieceCount: 2, isInCheck: false, hasTacticalComplexity: false, moveNumber: 80 },
      { pieceCount: 20, isInCheck: true, hasTacticalComplexity: true, moveNumber: 40 },
    ];
    for (const c of cases) {
      const s = estimatePositionComplexity(c).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  test('being in check raises complexity', () => {
    const none = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: false, moveNumber: 30 });
    const check = estimatePositionComplexity({ pieceCount: 20, isInCheck: true, hasTacticalComplexity: false, moveNumber: 30 });
    expect(check.score).toBeGreaterThan(none.score);
    expect(check.reason).toContain('in-check');
  });

  test('tactical complexity raises score', () => {
    const base = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: false, moveNumber: 30 });
    const tactical = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: true, moveNumber: 30 });
    expect(tactical.score).toBeGreaterThan(base.score);
  });

  // Regression guard: endgame must score at least as complex as midgame.
  // Previously midgame (+0.3) was weighted higher than endgame (+0.2), which
  // contradicted the "endgame can be very complex" intent — fixed by raising
  // the endgame bonus to +0.35.
  test('endgame (few pieces) raises complexity at least as much as midgame', () => {
    const mid = estimatePositionComplexity({ pieceCount: 20, isInCheck: false, hasTacticalComplexity: false, moveNumber: 30 });
    const end = estimatePositionComplexity({ pieceCount: 10, isInCheck: false, hasTacticalComplexity: false, moveNumber: 30 });
    expect(mid.reason).toContain('midgame');
    expect(end.reason).toContain('endgame');
    expect(end.score).toBeGreaterThan(mid.score);
  });
});

describe('calculateTimeAllocation — personality differences', () => {
  test('aggressive enables probCut; defensive does not', () => {
    const agg = calculateTimeAllocation(baseParams({ personality: 'aggressive' }));
    const def = calculateTimeAllocation(baseParams({ personality: 'defensive' }));
    expect(agg.searchParams.probCutEnabled).toBe(true);
    expect(def.searchParams.probCutEnabled).toBe(false);
  });

  test('aggressive has a tighter aspiration window than defensive', () => {
    const agg = calculateTimeAllocation(baseParams({ personality: 'aggressive' }));
    const def = calculateTimeAllocation(baseParams({ personality: 'defensive' }));
    expect(agg.searchParams.aspirationMultiplier).toBeLessThan(def.searchParams.aspirationMultiplier);
  });

  test('unknown personality falls back to balanced without throwing', () => {
    const r = calculateTimeAllocation(baseParams({ personality: 'does-not-exist' as unknown as string }));
    expect(r.allocatedTimeMs).toBeGreaterThanOrEqual(500);
    expect(r.targetDepth).toBeGreaterThanOrEqual(3);
  });
});

describe('detectTacticalComplexity — tactical signal', () => {
  // Minimal 1-D board helpers (9x9 flat arrays). Piece codes per MoveGenerator
  // convention: 16=white, 32=black; +type. King=6, pawn=1, etc.
  const EMPTY = () => Array(81).fill(0);
  // A board where white has many capturing moves should read as complex.
  test('returns a boolean and does not throw on a normal board', () => {
    const b = EMPTY();
    const result = detectTacticalComplexity(b, 16, () => [], () => false);
    expect(typeof result).toBe('boolean');
  });

  test('many legal moves (>40) is flagged complex', () => {
    const b = EMPTY();
    b[40] = 16 + 2; // a white knight in the middle has up to 8 moves; use many
    const manyMoves = Array.from({ length: 50 }, (_, i) => ({ from: 40, to: (i % 81) }));
    const result = detectTacticalComplexity(b, 16, () => manyMoves, () => false);
    expect(result).toBe(true);
  });

  test('few quiet moves is not flagged complex', () => {
    const b = EMPTY();
    b[40] = 16 + 2; // white knight
    const fewMoves = [{ from: 40, to: 41 }];
    const result = detectTacticalComplexity(b, 16, () => fewMoves, () => false);
    expect(result).toBe(false);
  });
});
