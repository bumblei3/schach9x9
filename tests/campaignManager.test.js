import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock dependencies
jest.unstable_mockModule('../js/storage.js', () => ({
  storageManager: {},
}));

const { CampaignManager } = await import('../js/campaign/CampaignManager.js');
const { CAMPAIGN_LEVELS } = await import('../js/campaign/campaignData.js');

describe('CampaignManager', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    manager = new CampaignManager();
  });

  test('should load initial levels correctly', () => {
    const levels = manager.getAllLevels();
    expect(levels.length).toBe(CAMPAIGN_LEVELS.length);
    // Level 1 should be unlocked by default
    expect(levels[0].unlocked).toBe(true);
    // Level 2 should be locked
    expect(levels[1].unlocked).toBe(false);
  });

  test('should complete level and unlock next', () => {
    const level1 = CAMPAIGN_LEVELS[0].id;
    const level2 = CAMPAIGN_LEVELS[1].id;

    // Complete Level 1 with stats for 1 star (slow)
    manager.completeLevel(level1, { moves: 100 });

    expect(manager.isLevelCompleted(level1)).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'schach9x9_campaign_progress',
      expect.stringContaining(level1)
    );

    // Check if Level 2 is now unlocked
    expect(manager.isLevelUnlocked(level2)).toBe(true);
  });

  test('should calculate stars correctly (moves goal)', () => {
    const level = CAMPAIGN_LEVELS[0].id; // tutorial_1 has goals: 2 stars <= 15 moves, 3 stars <= 10 moves

    // 1 Star (> 15 moves)
    manager.completeLevel(level, { moves: 16 });
    expect(manager.progress[level].stars).toBe(1);

    // 2 Stars (<= 15 moves)
    manager.completeLevel(level, { moves: 15 });
    expect(manager.progress[level].stars).toBe(2);

    // 3 Stars (<= 10 moves)
    manager.completeLevel(level, { moves: 10 });
    expect(manager.progress[level].stars).toBe(3);
  });

  test('should persist best star result', () => {
    const level1 = CAMPAIGN_LEVELS[0].id;

    // First run: 3 stars
    manager.completeLevel(level1, { moves: 5 });
    expect(manager.progress[level1].stars).toBe(3);

    // Second run: 1 star (worse)
    manager.completeLevel(level1, { moves: 20 });

    // Should keep 3 stars
    expect(manager.progress[level1].stars).toBe(3);
  });

  test('should not unlock level if parent not completed', () => {
    const level3 = CAMPAIGN_LEVELS[2].id;
    expect(manager.isLevelUnlocked(level3)).toBe(false);
  });

  test('resetProgress should lock everything except level 1', () => {
    const level1 = CAMPAIGN_LEVELS[0].id;
    manager.completeLevel(level1, 3);
    expect(manager.isLevelUnlocked(CAMPAIGN_LEVELS[1].id)).toBe(true);

    manager.resetProgress();
    expect(manager.progress).toEqual({});
    expect(manager.isLevelCompleted(level1)).toBe(false);
    expect(manager.isLevelUnlocked(CAMPAIGN_LEVELS[1].id)).toBe(false);
  });
});
