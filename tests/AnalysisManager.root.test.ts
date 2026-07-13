/**
 * Focused tests for js/AnalysisManager.ts (root) — piece-value lookup and
 * arrow-rendering early-return guard.
 *
 * The root AnalysisManager had NO dedicated test file before this. The riskiest
 * untested pure logic is getPieceValue (the custom 9x9 piece-value table, incl.
 * the angel/e=12 and fallback-0 branches) and the updateArrows guard that bails
 * out when no arrowRenderer is wired up. Both are exercised directly with a
 * minimal Game stub; the tactical-detection paths are not isolated here (they
 * pull in TacticsDetector/aiEngine.SEE and a full board) — out of scope.
 */

import { describe, test, expect, vi } from 'vitest';

vi.mock('../js/logger.js', () => ({
  logger: { context: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

const { AnalysisManager } = await import('../js/AnalysisManager.js');

// Minimal Game stub: only `arrowRenderer` and `boardSize` are touched by the
// methods under test (getPieceValue, updateArrows early-return).
function gameWith(over: any = {}): any {
  return { boardSize: 9, arrowRenderer: undefined, ...over } as any;
}

describe('AnalysisManager.getPieceValue', () => {
  const am = new AnalysisManager(gameWith());

  test('returns the standard pawn value of 1', () => {
    expect(am.getPieceValue('p')).toBe(1);
  });

  test('returns the knight/bishop value of 3', () => {
    expect(am.getPieceValue('n')).toBe(3);
    expect(am.getPieceValue('b')).toBe(3);
  });

  test('returns rook/queen values', () => {
    expect(am.getPieceValue('r')).toBe(5);
    expect(am.getPieceValue('q')).toBe(9);
  });

  test('returns the custom-piece values (archbishop 7, chancellor 8, angel 12)', () => {
    expect(am.getPieceValue('a')).toBe(7);
    expect(am.getPieceValue('c')).toBe(8);
    expect(am.getPieceValue('e')).toBe(12);
  });

  test('king has value 0', () => {
    expect(am.getPieceValue('k')).toBe(0);
  });

  test('unknown piece type falls back to 0', () => {
    expect(am.getPieceValue('z')).toBe(0);
    expect(am.getPieceValue('')).toBe(0);
  });
});

describe('AnalysisManager.updateArrows — render guard', () => {
  test('early-returns (no highlight call) when arrowRenderer is absent', () => {
    const game = gameWith({ arrowRenderer: undefined });
    const am = new AnalysisManager(game);
    // With no renderer, updateArrows must bail before touching highlightMoves.
    expect(() => am.updateArrows()).not.toThrow();
  });

  test('delegates to arrowRenderer.highlightMoves when a renderer is present', () => {
    const highlight = vi.fn();
    const game = gameWith({ arrowRenderer: { highlightMoves: highlight } });
    const am = new AnalysisManager(game);
    am.updateArrows();
    expect(highlight).toHaveBeenCalledTimes(1);
    // No toggles enabled -> empty arrow list passed through.
    expect(highlight).toHaveBeenCalledWith([]);
  });
});

describe('AnalysisManager toggle flags', () => {
  test('toggleThreats flips the flag and returns the new state', () => {
    const am = new AnalysisManager(gameWith());
    const before = am.showThreats;
    const after = am.toggleThreats();
    expect(after).toBe(!before);
    expect(am.showThreats).toBe(after);
  });

  test('toggleOpportunities flips the flag and returns the new state', () => {
    const am = new AnalysisManager(gameWith());
    const after = am.toggleOpportunities();
    expect(after).toBe(am.showOpportunities);
  });

  test('toggleBestMove flips the flag and returns the new state', () => {
    const am = new AnalysisManager(gameWith());
    const after = am.toggleBestMove();
    expect(after).toBe(am.showBestMove);
  });
});
