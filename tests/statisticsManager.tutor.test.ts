import { describe, test, expect, beforeEach } from 'vitest';
import { StatisticsManager } from '../js/statisticsManager.js';

describe('StatisticsManager - Tutor Points', () => {
  let statsManager: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    statsManager = new StatisticsManager();
  });

  test('should return 0 tutor points by default', () => {
    expect(statsManager.getTutorPoints()).toBe(0);
  });

  test('should save and load tutor points', () => {
    statsManager.saveTutorPoints(150);
    expect(statsManager.getTutorPoints()).toBe(150);

    // Create new manager instance to simulate reload
    const newManager = new StatisticsManager();
    expect(newManager.getTutorPoints()).toBe(150);
  });

  test('should persist in default data structure', () => {
    // Force a clear/reset
    statsManager.clearHistory(true);
    expect(statsManager.getTutorPoints()).toBe(0); // Should be reset if whole data is reset
  });
});
