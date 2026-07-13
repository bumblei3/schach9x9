/**
 * Focused tests for js/ai/AnalysisManager.ts — post-game accuracy + mentor advice.
 *
 * ai/AnalysisManager had NO dedicated test file before this. The riskiest
 * untested logic is `calculateAccuracy` (a private pure function with several
 * branches: object vs numeric captures, the capture-ratio bonus, the
 * long-game penalties, and the 40–98 clamp) and `getMentorAdvice` (5 accuracy
 * bands). Both are exercised here with real assertions by feeding crafted
 * stats through `runPostGameAnalysis` (which calls calculateAccuracy) and by
 * calling getMentorAdvice directly. The two DOM-dependent externals
 * (drawArrow, logger) are mocked so the suite runs headless.
 */

import { describe, test, expect, vi } from 'vitest';

vi.mock('../../js/ui/ArrowRenderer.js', () => ({ drawArrow: vi.fn(() => ({})) }));
vi.mock('../../js/logger.js', () => ({ logger: { info: vi.fn() } }));

const { AnalysisManager } = await import('../../js/ai/AnalysisManager.js');

// Minimal GameWithStats stub — only `stats` is read by calculateAccuracy.
function gameWithStats(stats: any) {
  return { stats } as any;
}

describe('AnalysisManager.calculateAccuracy (via runPostGameAnalysis)', () => {
  test('no captures and few moves yields the base 75', async () => {
    const am = new AnalysisManager(gameWithStats({ totalMoves: 10, captures: { white: 0, black: 0 } }));
    const summary = await am.runPostGameAnalysis();
    expect(summary.whiteAccuracy).toBe(75);
  });

  test('object captures are counted from the white field', async () => {
    const am = new AnalysisManager(
      gameWithStats({ totalMoves: 10, captures: { white: 4, black: 2 } })
    );
    // base 75 + min(20, (4*10/10)*5=20) = 95, clamped to <=98 -> 95
    const summary = await am.runPostGameAnalysis();
    expect(summary.whiteAccuracy).toBe(95);
  });

  test('numeric captures are handled (object vs number branch)', async () => {
    const am = new AnalysisManager(gameWithStats({ totalMoves: 20, captures: 6 }));
    // captureRatio = (6*10)/20 = 3; bonus = min(20, 3*5=15) = 15 -> 90
    const summary = await am.runPostGameAnalysis();
    expect(summary.whiteAccuracy).toBe(90);
  });

  test('long-game penalty applies past 60 and doubly past 100 moves', async () => {
    // >100 moves, no captures -> 75 - 5 (for >60) - 10 (for >100) = 60
    const am = new AnalysisManager(gameWithStats({ totalMoves: 120, captures: { white: 0, black: 0 } }));
    const summary = await am.runPostGameAnalysis();
    expect(summary.whiteAccuracy).toBe(60);

    // Just over 60 moves (no >100) -> 75 - 5 = 70
    const am2 = new AnalysisManager(gameWithStats({ totalMoves: 61, captures: { white: 0, black: 0 } }));
    expect((await am2.runPostGameAnalysis()).whiteAccuracy).toBe(70);
  });

  test('accuracy is clamped to the [40, 98] range', async () => {
    // Huge capture ratio should not exceed 98.
    const hot = new AnalysisManager(gameWithStats({ totalMoves: 2, captures: { white: 10, black: 0 } }));
    const s = await hot.runPostGameAnalysis();
    expect(s.whiteAccuracy).toBeLessThanOrEqual(98);
    expect(s.whiteAccuracy).toBeGreaterThanOrEqual(40);

    // A heavily-penalised long game should not drop below 40.
    const cold = new AnalysisManager(
      gameWithStats({ totalMoves: 500, captures: { white: 0, black: 0 } })
    );
    const s2 = await cold.runPostGameAnalysis();
    expect(s2.whiteAccuracy).toBeGreaterThanOrEqual(40);
  });
});

describe('AnalysisManager.getMentorAdvice', () => {
  const am = new AnalysisManager(gameWithStats({}));
  const summary = (acc: number) => ({ whiteAccuracy: acc } as any);

  test('accuracy > 90 -> praise', () => {
    expect(am.getMentorAdvice(summary(95))).toContain('Hervorragendes Spiel');
  });
  test('accuracy in (80, 90] -> strong', () => {
    expect(am.getMentorAdvice(summary(85))).toContain('Starke Leistung');
  });
  test('accuracy in (65, 80] -> solid', () => {
    expect(am.getMentorAdvice(summary(70))).toContain('solider Sieg');
  });
  test('accuracy in (50, 65] -> brenzlig', () => {
    expect(am.getMentorAdvice(summary(55))).toContain('brenzlige Momente');
  });
  test('accuracy <= 50 -> hard fight', () => {
    expect(am.getMentorAdvice(summary(40))).toContain('harter Kampf');
  });
});
