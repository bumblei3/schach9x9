import { describe, it, expect } from 'vitest';
import { AnalysisManager } from '../../js/ai/AnalysisManager.js';

describe('AnalysisManager', () => {
  const mockGame = {
    stats: {
      totalMoves: 40,
      captures: { white: 10, black: 5 },
      promotions: 0,
    },
  };

  it('should calculate accuracy based on stats', async () => {
    const manager = new AnalysisManager(mockGame);
    const summary = await manager.runPostGameAnalysis();

    expect(summary.whiteAccuracy).toBeGreaterThan(50);
    expect(summary.whiteAccuracy).toBeLessThan(100);
  });

  it('should give better advice for higher accuracy', () => {
    const manager = new AnalysisManager(mockGame);

    const goodSummary = {
      whiteAccuracy: 95,
      blackAccuracy: 70,
      mistakes: 0,
      blunders: 0,
      keyMoments: [],
    };
    const badSummary = {
      whiteAccuracy: 40,
      blackAccuracy: 70,
      mistakes: 2,
      blunders: 1,
      keyMoments: [],
    };

    const goodAdvice = manager.getMentorAdvice(goodSummary);
    const badAdvice = manager.getMentorAdvice(badSummary);

    expect(goodAdvice).toContain('Hervorragend');
    expect(badAdvice).toContain('Taktik');
    expect(goodAdvice).not.toBe(badAdvice);
  });

  it('should penalize long games in accuracy', async () => {
    const longGame = {
      stats: { totalMoves: 120, captures: { white: 2, black: 2 } },
    };
    const shortGame = {
      stats: { totalMoves: 20, captures: { white: 8, black: 2 } },
    };

    const managerLong = new AnalysisManager(longGame);
    const managerShort = new AnalysisManager(shortGame);

    const summaryLong = await managerLong.runPostGameAnalysis();
    const summaryShort = await managerShort.runPostGameAnalysis();

    expect(summaryShort.whiteAccuracy).toBeGreaterThan(summaryLong.whiteAccuracy);
  });
});
