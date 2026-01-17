import { describe, expect, test, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock data for testing
const { mockLevels } = vi.hoisted(() => ({
  mockLevels: [
    { id: 'peasant_revolt', reward: null },
    { id: 'level_2', reward: null },
    { id: 'level_3', reward: 'angel' },
  ],
}));

vi.mock('../js/campaign/campaignData.js', importOriginal => ({
  ...importOriginal,
  CAMPAIGN_LEVELS: mockLevels,
  CAMPAIGN_PERKS: [
    { id: 'stabile_bauern', name: 'Stabile Bauern', cost: 150, icon: '🛡️' },
    { id: 'elite_garde', name: 'Elite-Garde', cost: 250, icon: '⚔️' },
  ],
}));

// Mock dependencies
vi.mock('../js/storage.js', () => ({
  storageManager: {},
}));

import { CampaignManager } from '../js/campaign/CampaignManager.js';
import { CAMPAIGN_LEVELS } from '../js/campaign/campaignData.js';

describe('CampaignManager', () => {
  let manager: CampaignManager;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new CampaignManager();
  });

  test('should load initial levels correctly', () => {
    const levels = manager.getAllLevels();
    expect(levels.length).toBe(CAMPAIGN_LEVELS.length);

    // Level 1 should be unlocked by default
    expect(manager.isLevelUnlocked('peasant_revolt')).toBe(true);
    // Level 2 should be locked
    expect(manager.isLevelUnlocked('level_2')).toBe(false);
  });

  test('should complete level and unlock next', () => {
    const level1 = 'peasant_revolt';
    const level2 = 'level_2';

    manager.completeLevel(level1);

    expect(manager.isLevelCompleted(level1)).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'schach_campaign_state',
      expect.stringContaining(level1)
    );

    // Check if Level 2 is now unlocked
    expect(manager.isLevelUnlocked(level2)).toBe(true);
  });

  test('should unlock rewards upon completion', () => {
    const level3 = 'level_3';
    manager.completeLevel(level3);

    expect(manager.isLevelCompleted(level3)).toBe(true);
    expect(manager.isRewardUnlocked('angel')).toBe(true);
  });

  test('should award gold and stars upon completion', () => {
    const mockLevel = {
      id: 'peasant_revolt',
      goldReward: 20,
      goals: { 2: { type: 'moves', value: 20 }, 3: { type: 'moves', value: 10 } },
    } as any;
    vi.spyOn(manager, 'getLevel').mockReturnValue(mockLevel);

    manager.completeLevel('peasant_revolt', 3);

    expect(manager.getGold()).toBe(20);
    expect(manager.getLevelStars('peasant_revolt')).toBe(3);
  });

  test('should award bonus gold for improving stars', () => {
    const mockLevel = {
      id: 'peasant_revolt',
      goldReward: 20,
      goals: { 2: { type: 'moves', value: 20 }, 3: { type: 'moves', value: 10 } },
    } as any;
    vi.spyOn(manager, 'getLevel').mockReturnValue(mockLevel);

    manager.completeLevel('peasant_revolt', 1);
    const initialGold = manager.getGold();
    expect(manager.getLevelStars('peasant_revolt')).toBe(1);

    manager.completeLevel('peasant_revolt', 3);
    expect(manager.getLevelStars('peasant_revolt')).toBe(3);
    expect(manager.getGold()).toBe(initialGold + 40);
  });

  test('should purchase perks correctly', () => {
    (manager as any).state.gold = 200;

    const cost = 150;
    const success = manager.spendGold(cost);

    expect(success).toBe(true);
    if (success) manager.unlockPerk('stabile_bauern');

    expect(manager.getGold()).toBe(50);
    expect(manager.isPerkUnlocked('stabile_bauern')).toBe(true);

    manager.spendGold(cost);
    (manager as any).state.gold = 10;
    const success3 = manager.spendGold(cost);
    expect(success3).toBe(false);
  });

  test('should persist state to localStorage', () => {
    manager.completeLevel('peasant_revolt');
    (manager as any).state.gold = 500;
    manager.saveGame();

    const newManager = new CampaignManager();
    expect(newManager.isLevelCompleted('peasant_revolt')).toBe(true);
    expect(newManager.getGold()).toBe(500);
  });

  test('isRewardUnlocked should work correctly', () => {
    expect(manager.isRewardUnlocked('some_reward')).toBe(false);
    (manager as any).state.unlockedRewards.push('some_reward');
    expect(manager.isRewardUnlocked('some_reward')).toBe(true);
  });

  describe('Unit XP System', () => {
    test('getUnitXp should return default XP object for new units', () => {
      const xp = manager.getUnitXp('p');
      expect(xp).toEqual({ xp: 0, level: 1, captures: 0 });
    });

    test('addUnitXp should increase XP and captures', () => {
      manager.addUnitXp('n', 10, 1);
      const xp = manager.getUnitXp('n');
      expect(xp.xp).toBe(10);
      expect(xp.captures).toBe(1);
      expect(xp.level).toBe(1);
    });

    test('addUnitXp should level up at 100 XP', () => {
      manager.addUnitXp('r', 100);
      const xp = manager.getUnitXp('r');
      expect(xp.level).toBe(2);
      expect(xp.xp).toBe(100);
    });

    test('addUnitXp should handle large XP gains', () => {
      manager.addUnitXp('q', 250);
      const xp = manager.getUnitXp('q');
      expect(xp.level).toBe(2);
      expect(xp.xp).toBe(250);
    });

    test('addUnitXp should accumulate across multiple calls', () => {
      manager.addUnitXp('b', 50, 1);
      manager.addUnitXp('b', 60, 1);
      const xp = manager.getUnitXp('b');
      expect(xp.xp).toBe(110);
      expect(xp.captures).toBe(2);
      expect(xp.level).toBe(2);
    });

    test('addUnitXp should persist state', () => {
      vi.clearAllMocks();
      manager.addUnitXp('p', 75);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'schach_campaign_state',
        expect.any(String)
      );
    });
  });

  describe('Champion System', () => {
    test('setChampion should set the champion type', () => {
      manager.setChampion('n');
      expect((manager as any).state.championType).toBe('n');
    });

    test('setChampion should allow clearing the champion', () => {
      manager.setChampion('r');
      manager.setChampion(null);
      expect((manager as any).state.championType).toBeNull();
    });

    test('setChampion should persist state', () => {
      manager.setChampion('q');
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('State Migration', () => {
    test('loadState should migrate old saves without unitXp', () => {
      const oldState = {
        currentLevelId: 'peasant_revolt',
        unlockedLevels: ['peasant_revolt'],
        completedLevels: [],
        unlockedRewards: [],
        gold: 100,
        unlockedPerks: [],
        levelStars: {},
      };
      (localStorage.getItem as any).mockReturnValueOnce(JSON.stringify(oldState));

      const newManager = new CampaignManager();

      expect((newManager as any).state).toBeDefined();
      expect((newManager as any).state.championType).toBeNull();
      expect(newManager.getGold()).toBe(100);
    });

    test('loadState should handle corrupted JSON gracefully', () => {
      (localStorage.getItem as any).mockReturnValueOnce('{corrupted:json}');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const newManager = new CampaignManager();

      expect(consoleSpy).toHaveBeenCalled();
      expect((newManager as any).state.currentLevelId).toBe('peasant_revolt');
      expect((newManager as any).state.gold).toBe(0);
      consoleSpy.mockRestore();
    });
  });

  describe('Talent System', () => {
    test('isTalentUnlocked should return false for non-existent talents', () => {
      expect(manager.isTalentUnlocked('non_existent_talent')).toBe(false);
    });

    test('unlockTalent should return false for invalid unit type', () => {
      (manager as any).state.gold = 1000;
      const result = manager.unlockTalent('invalid_unit', 'some_talent', 10);
      expect(result).toBe(false);
    });

    test('unlockTalent should return false for invalid talent id', () => {
      (manager as any).state.gold = 1000;
      const result = manager.unlockTalent('p', 'invalid_talent_id', 10);
      expect(result).toBe(false);
    });

    test('unlockTalent should return false when not enough gold', () => {
      (manager as any).state.gold = 5;
      const result = manager.unlockTalent('p', 'p_veteran', 100);
      expect(result).toBe(false);
    });

    test('unlockTalent should return true when already unlocked', () => {
      (manager as any).state.gold = 1000;
      (manager as any).state.unlockedTalentIds = ['p_veteran'];
      const result = manager.unlockTalent('p', 'p_veteran', 50);
      expect(result).toBe(true);
      expect((manager as any).state.gold).toBe(1000); // No gold deducted
    });
  });

  describe('Goal Checking', () => {
    test('checkGoal should handle unknown goal types', () => {
      const result = (manager as any).checkGoal({ type: 'unknown', value: 10 }, { moves: 5 });
      expect(result).toBe(false);
    });

    test('checkGoal should check material goal correctly', () => {
      const goal = { type: 'material', value: 5 };
      expect((manager as any).checkGoal(goal, { materialDiff: 10 })).toBe(true);
      expect((manager as any).checkGoal(goal, { materialDiff: 3 })).toBe(false);
    });

    test('checkGoal should check promotion goal correctly', () => {
      const goal = { type: 'promotion', value: 2 };
      expect((manager as any).checkGoal(goal, { promotedCount: 2 })).toBe(true);
      expect((manager as any).checkGoal(goal, { promotedCount: 1 })).toBe(false);
    });
  });

  describe('Misc Methods', () => {
    test('unlockAll should unlock all campaign levels', () => {
      manager.unlockAll();
      expect(manager.isLevelUnlocked('peasant_revolt')).toBe(true);
      expect(manager.isLevelUnlocked('level_2')).toBe(true);
      expect(manager.isLevelUnlocked('level_3')).toBe(true);
    });

    test('resetState should reset to initial values', () => {
      (manager as any).state.gold = 999;
      (manager as any).state.completedLevels = ['peasant_revolt'];
      manager.resetState();
      expect(manager.getGold()).toBe(0);
      expect(manager.isLevelCompleted('peasant_revolt')).toBe(false);
    });

    test('incrementUnitCaptures should increase captures count', () => {
      manager.incrementUnitCaptures('n');
      const xp = manager.getUnitXp('n');
      expect(xp.captures).toBe(1);
    });

    test('getChampion should return the current champion', () => {
      manager.setChampion('r');
      expect(manager.getChampion()).toBe('r');
      manager.setChampion(null);
      expect(manager.getChampion()).toBeNull();
    });
  });
});

