import { describe, test, expect } from 'vitest';
import {
  classifyMove,
  calculateAccuracy,
  analyzeGame,
  MOVE_QUALITY,
} from '../js/tutor/PostGameAnalyzer.js';

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
      expect(calculateAccuracy(null as any)).toBe(0);
    });

    test('should handle objects with quality property', () => {
      const moves = [{ quality: MOVE_QUALITY.BEST }, { quality: MOVE_QUALITY.GOOD }];
      expect(calculateAccuracy(moves)).toBe(90); // (100 + 80) / 2
    });

    test('should handle unknown quality strings by returning 0 points', () => {
      expect(calculateAccuracy(['invalid'])).toBe(0);
    });
  });

  describe('analyzeGame', () => {
    const mockHistory = [
      { piece: { color: 'white' }, classification: MOVE_QUALITY.BEST },
      { piece: { color: 'black' }, classification: MOVE_QUALITY.MISTAKE },
      { piece: { color: 'white' }, classification: MOVE_QUALITY.EXCELLENT },
      { piece: { color: 'black' }, classification: MOVE_QUALITY.BLUNDER },
      { piece: { color: 'white' }, classification: MOVE_QUALITY.BOOK },
    ];

    test('should summarize counts for a specific player', () => {
      const result = analyzeGame(mockHistory as any, 'white');
      expect(result.totalMoves).toBe(3);
      expect(result.counts[MOVE_QUALITY.BEST]).toBe(1);
      expect(result.counts[MOVE_QUALITY.EXCELLENT]).toBe(1);
      expect(result.counts[MOVE_QUALITY.BOOK]).toBe(1);
      expect(result.counts[MOVE_QUALITY.BLUNDER]).toBe(0);
      expect(result.accuracy).toBe(100);
    });

    test('should handle players with no moves', () => {
      const result = analyzeGame([], 'white');
      expect(result.totalMoves).toBe(0);
      expect(result.accuracy).toBe(0);
    });

    test('should handle moves without classification by defaulting to GOOD', () => {
      const history = [{ piece: { color: 'white' } }];
      const result = analyzeGame(history as any, 'white');
      expect(result.accuracy).toBe(80); // Default to GOOD
    });
  });
});
