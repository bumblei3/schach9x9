/**
 * Focused invariant tests for js/tutor/PostGameAnalyzer.ts
 *
 * Post-game analysis powers the learning feedback: it classifies each move by
 * how much evaluation was lost vs. the best move, and rolls that up into an
 * accuracy percentage. These tests lock the classification thresholds, the
 * accuracy weighting, and the per-player aggregation. Pure module, no DOM.
 */

import { describe, test, expect } from 'vitest';
import {
  classifyMove,
  calculateAccuracy,
  analyzeGame,
  MOVE_QUALITY,
  QUALITY_METADATA,
} from '../js/tutor/PostGameAnalyzer.js';

describe('classifyMove — threshold boundaries', () => {
  // classifyMove(prevEval, currentEval, bestEval): evalLoss = bestEval - currentEval.
  // <=0 BEST, <25 EXCELLENT, <60 GOOD, <150 INACCURACY, <300 MISTAKE, else BLUNDER.
  test('no loss (or better than best) is the best move', () => {
    expect(classifyMove(0, 100, 100)).toBe(MOVE_QUALITY.BEST);
    expect(classifyMove(0, 120, 100)).toBe(MOVE_QUALITY.BEST); // currentEval > bestEval => loss<0
  });

  test('each severity band maps to the documented quality', () => {
    // evalLoss chosen just inside each band.
    expect(classifyMove(0, 90, 100)).toBe(MOVE_QUALITY.EXCELLENT);   // loss 10  (<25)
    expect(classifyMove(0, 60, 100)).toBe(MOVE_QUALITY.GOOD);        // loss 40  (<60)
    expect(classifyMove(0, 0, 100)).toBe(MOVE_QUALITY.INACCURACY);   // loss 100 (<150)
    expect(classifyMove(0, -100, 100)).toBe(MOVE_QUALITY.MISTAKE);   // loss 200 (<300)
    expect(classifyMove(0, -250, 100)).toBe(MOVE_QUALITY.BLUNDER);   // loss 350 (>=300)
  });

  test('exact boundary values fall into the higher (better) band', () => {
    // A loss strictly below a threshold stays in the better band; hitting the
    // threshold exactly drops to the next band (comparisons use `<`).
    expect(classifyMove(0, 100 - 24, 100)).toBe(MOVE_QUALITY.EXCELLENT); // loss 24 (<25)
    expect(classifyMove(0, 100 - 25, 100)).toBe(MOVE_QUALITY.GOOD);      // loss 25 (not <25)
    expect(classifyMove(0, 100 - 60, 100)).toBe(MOVE_QUALITY.INACCURACY); // loss 60 (not <60)
  });

  test('monotonicity: more eval loss never yields a better classification', () => {
    const rank = [
      MOVE_QUALITY.BEST, MOVE_QUALITY.EXCELLENT, MOVE_QUALITY.GOOD,
      MOVE_QUALITY.INACCURACY, MOVE_QUALITY.MISTAKE, MOVE_QUALITY.BLUNDER,
    ];
    const rankOf = (q: string) => rank.indexOf(q as (typeof rank)[number]);
    let prev = -1;
    for (let loss = 0; loss <= 400; loss += 10) {
      const q = classifyMove(0, 100 - loss, 100);
      const r = rankOf(q);
      expect(r).toBeGreaterThanOrEqual(prev); // rank index never decreases
      prev = r;
    }
  });
});

describe('calculateAccuracy — weighting', () => {
  test('empty input yields 0', () => {
    expect(calculateAccuracy([])).toBe(0);
    // @ts-expect-error deliberately passing null to test the guard
    expect(calculateAccuracy(null)).toBe(0);
  });

  test('all best/excellent/book moves => 100% accuracy', () => {
    expect(calculateAccuracy([MOVE_QUALITY.BEST, MOVE_QUALITY.EXCELLENT, MOVE_QUALITY.BOOK])).toBe(100);
  });

  test('all blunders => 0% accuracy', () => {
    expect(calculateAccuracy([MOVE_QUALITY.BLUNDER, MOVE_QUALITY.BLUNDER])).toBe(0);
  });

  test('mixed qualities average their weights (100 + 20) / 2 = 60', () => {
    expect(calculateAccuracy([MOVE_QUALITY.BEST, MOVE_QUALITY.MISTAKE])).toBe(60);
  });

  test('accepts both plain strings and {quality} objects', () => {
    const asStrings = calculateAccuracy([MOVE_QUALITY.GOOD, MOVE_QUALITY.GOOD]);
    const asObjects = calculateAccuracy([{ quality: MOVE_QUALITY.GOOD }, { quality: MOVE_QUALITY.GOOD }]);
    expect(asStrings).toBe(asObjects);
    expect(asStrings).toBe(80);
  });

  test('accuracy is always within 0..100', () => {
    const all = Object.values(MOVE_QUALITY);
    const acc = calculateAccuracy(all);
    expect(acc).toBeGreaterThanOrEqual(0);
    expect(acc).toBeLessThanOrEqual(100);
  });
});

describe('analyzeGame — per-player aggregation', () => {
  const mv = (color: string, classification: string) =>
    ({ piece: { color }, classification }) as unknown as Parameters<typeof analyzeGame>[0][number];

  test('only counts moves of the requested player color', () => {
    const history = [
      mv('white', MOVE_QUALITY.BEST),
      mv('black', MOVE_QUALITY.BLUNDER),
      mv('white', MOVE_QUALITY.GOOD),
    ];
    const white = analyzeGame(history, 'white');
    expect(white.totalMoves).toBe(2);
    expect(white.counts[MOVE_QUALITY.BEST]).toBe(1);
    expect(white.counts[MOVE_QUALITY.GOOD]).toBe(1);
    expect(white.counts[MOVE_QUALITY.BLUNDER]).toBe(0); // black's blunder excluded
  });

  test('accuracy reflects only the player\'s own moves', () => {
    const history = [
      mv('white', MOVE_QUALITY.BEST),   // 100
      mv('white', MOVE_QUALITY.MISTAKE), // 20
      mv('black', MOVE_QUALITY.BLUNDER), // ignored for white
    ];
    expect(analyzeGame(history, 'white').accuracy).toBe(60);
  });

  test('empty history yields zeroed analysis', () => {
    const a = analyzeGame([], 'white');
    expect(a.totalMoves).toBe(0);
    expect(a.accuracy).toBe(0);
    for (const q of Object.values(MOVE_QUALITY)) {
      expect(a.counts[q]).toBe(0);
    }
  });
});

describe('QUALITY_METADATA completeness', () => {
  test('every move quality has display metadata', () => {
    for (const q of Object.values(MOVE_QUALITY)) {
      const meta = QUALITY_METADATA[q];
      expect(meta).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.symbol.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
