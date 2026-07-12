/**
 * Focused coverage tests for js/ai/AnalysisManager.ts — the post-game
 * analysis path (calculateAccuracy branches, getMentorAdvice tiers,
 * toggleBestMove / updateArrows guards). These branches were previously
 * below the file's coverage threshold.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// drawArrow touches the DOM; the updateArrows path early-returns before it
// when there is no topMovesContainer, but stub it to be safe.
vi.mock('../../js/ui/ArrowRenderer.js', () => ({
  drawArrow: vi.fn(() => document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
}));

const { AnalysisManager } = await import('../../js/ai/AnalysisManager.js');

function makeManager(stats: any) {
  return new AnalysisManager({ stats });
}

describe('AnalysisManager (post-game)', () => {
  describe('calculateAccuracy via runPostGameAnalysis', () => {
    test('captures as object uses white captures', async () => {
      const m = makeManager({ totalMoves: 40, captures: { white: 10, black: 5 } });
      const summary = await m.runPostGameAnalysis();
      // base 75 + min(20, (10*10/40)*5=12.5) = 87.5 -> 88
      expect(summary.whiteAccuracy).toBe(88);
      expect(summary.blackAccuracy).toBe(75);
      expect(summary.mistakes).toBe(0);
      expect(summary.blunders).toBe(0);
    });

    test('captures as number (legacy shape)', async () => {
      const m = makeManager({ totalMoves: 30, captures: 15 });
      const summary = await m.runPostGameAnalysis();
      // base 75 + min(20, (15*10/30)*5=25 -> capped 20) = 95 -> 95
      expect(summary.whiteAccuracy).toBe(95);
    });

    test('zero total moves yields base accuracy', async () => {
      const m = makeManager({ totalMoves: 0, captures: { white: 0, black: 0 } });
      const summary = await m.runPostGameAnalysis();
      expect(summary.whiteAccuracy).toBe(75);
    });

    test('long game penalty for >60 moves', async () => {
      const long = makeManager({ totalMoves: 80, captures: { white: 4, black: 2 } });
      const short = makeManager({ totalMoves: 40, captures: { white: 4, black: 2 } });
      const longSummary = await long.runPostGameAnalysis();
      const shortSummary = await short.runPostGameAnalysis();
      // 80 moves triggers the additional -5 long-game penalty versus 40 moves.
      expect(longSummary.whiteAccuracy).toBeLessThan(shortSummary.whiteAccuracy);
    });

    test('very long game penalty for >100 moves stacks the -10', async () => {
      const veryLong = makeManager({ totalMoves: 120, captures: { white: 2, black: 2 } });
      const summary = await veryLong.runPostGameAnalysis();
      // base 75 + (2*10/120*5=0.83) - 5 - 10 = 60 (rounded)
      expect(summary.whiteAccuracy).toBeLessThan(70);
    });

    test('accuracy is clamped to [40, 98]', async () => {
      // Extreme capture ratio but capped at 98.
      const m = makeManager({ totalMoves: 1, captures: { white: 100, black: 0 } });
      const summary = await m.runPostGameAnalysis();
      expect(summary.whiteAccuracy).toBeLessThanOrEqual(98);
      expect(summary.whiteAccuracy).toBeGreaterThanOrEqual(40);
    });
  });

  describe('getMentorAdvice tiers', () => {
    const summary = (acc: number) => ({
      whiteAccuracy: acc,
      blackAccuracy: 70,
      mistakes: 0,
      blunders: 0,
      keyMoments: [],
    });

    test('>90 excellent', () => {
      expect(
        new AnalysisManager({ stats: { totalMoves: 0 } }).getMentorAdvice(summary(95))
      ).toContain('Hervorragend');
    });
    test('80-90 strong', () => {
      const advice = new AnalysisManager({ stats: { totalMoves: 0 } }).getMentorAdvice(summary(85));
      expect(advice).toContain('Starke Leistung');
      expect(advice).not.toContain('Hervorragend');
    });
    test('65-80 solid', () => {
      expect(
        new AnalysisManager({ stats: { totalMoves: 0 } }).getMentorAdvice(summary(70))
      ).toContain('solider Sieg');
    });
    test('50-65 warning', () => {
      expect(
        new AnalysisManager({ stats: { totalMoves: 0 } }).getMentorAdvice(summary(55))
      ).toContain('brenzlige Momente');
    });
    test('<=50 harsh', () => {
      expect(
        new AnalysisManager({ stats: { totalMoves: 0 } }).getMentorAdvice(summary(40))
      ).toContain('Taktik');
    });
  });

  describe('toggleBestMove / updateArrows guards', () => {
    let manager: InstanceType<typeof AnalysisManager>;
    beforeEach(() => {
      manager = makeManager({ totalMoves: 10, captures: { white: 2, black: 1 } });
    });

    test('toggleBestMove flips the flag and returns it', () => {
      expect(manager.showBestMove).toBe(false);
      const after = manager.toggleBestMove();
      expect(after).toBe(true);
      expect(manager.showBestMove).toBe(true);
      expect(manager.toggleBestMove()).toBe(false);
    });

    test('updateArrows early-returns when showBestMove is off', () => {
      // No DOM container / top moves; must not throw.
      expect(() => manager.updateArrows()).not.toThrow();
    });

    test('updateArrows early-returns when no topMovesContainer present', () => {
      manager.toggleBestMove();
      const game = { stats: {}, aiController: { analysisUI: null } };
      const m2 = new AnalysisManager(game as any);
      m2.toggleBestMove();
      expect(() => m2.updateArrows()).not.toThrow();
    });

    test('updateArrows early-returns when no board-container in DOM', () => {
      manager.toggleBestMove();
      const game = {
        stats: {},
        aiController: {
          analysisUI: {
            topMovesContainer: document.createElement('div'),
          },
        },
      };
      const m2 = new AnalysisManager(game as any);
      m2.toggleBestMove();
      // No #board-container element exists -> early return.
      expect(() => m2.updateArrows()).not.toThrow();
    });
  });
});
