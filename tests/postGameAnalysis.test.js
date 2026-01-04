import { classifyMove, calculateAccuracy, MOVE_QUALITY } from '../js/tutor/PostGameAnalyzer.js';

describe('PostGameAnalyzer', () => {
  describe('classifyMove', () => {
    test('should classify as BEST when eval loss is 0', () => {
      expect(classifyMove(100, 100, 100)).toBe(MOVE_QUALITY.BEST);
    });

    test('should classify as BEST even with slight gain (anomaly)', () => {
      expect(classifyMove(100, 110, 100)).toBe(MOVE_QUALITY.BEST);
    });

    test('should classify as EXCELLENT for small loss (<25 cp)', () => {
      expect(classifyMove(100, 80, 100)).toBe(MOVE_QUALITY.EXCELLENT);
    });

    test('should classify as GOOD for loss < 60 cp', () => {
      expect(classifyMove(100, 50, 100)).toBe(MOVE_QUALITY.GOOD);
    });

    test('should classify as INACCURACY for loss < 150 cp', () => {
      expect(classifyMove(100, -20, 100)).toBe(MOVE_QUALITY.INACCURACY);
    });

    test('should classify as MISTAKE for loss < 300 cp', () => {
      expect(classifyMove(100, -150, 100)).toBe(MOVE_QUALITY.MISTAKE);
    });

    test('should classify as BLUNDER for loss > 300 cp', () => {
      expect(classifyMove(100, -300, 100)).toBe(MOVE_QUALITY.BLUNDER);
    });
  });

  describe('calculateAccuracy', () => {
    test('should return 100% for all BEST moves', () => {
      const moves = [MOVE_QUALITY.BEST, MOVE_QUALITY.BEST, MOVE_QUALITY.BEST];
      expect(calculateAccuracy(moves)).toBe(100);
    });

    test('should return 0% for all BLUNDERS', () => {
      const moves = [MOVE_QUALITY.BLUNDER, MOVE_QUALITY.BLUNDER];
      expect(calculateAccuracy(moves)).toBe(0);
    });

    test('should return roughly middle for mixed moves', () => {
      const moves = [
        MOVE_QUALITY.BEST, // 100
        MOVE_QUALITY.INACCURACY, // 50
        MOVE_QUALITY.BLUNDER, // 0
      ];
      // (100 + 50 + 0) / 3 = 50
      expect(calculateAccuracy(moves)).toBe(50);
    });

    test('should handle empty input', () => {
      expect(calculateAccuracy([])).toBe(0);
    });
  });
});
