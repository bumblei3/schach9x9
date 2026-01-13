// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock data for testing
const MOCK_LEVELS = [
  { id: 'tutorial_1', reward: null }, // Matches default in CampaignManager
  { id: 'level_2', reward: null },
  { id: 'level_3', reward: 'angel' },
];

vi.mock('../js/campaign/campaignData.js', () => ({
  CAMPAIGN_LEVELS: MOCK_LEVELS,
}));

// Mock dependencies
vi.mock('../js/storage.js', () => ({
  storageManager: {},
}));

const { CampaignManager } = await import('../js/campaign/CampaignManager.js');
const { CAMPAIGN_LEVELS } = await import('../js/campaign/campaignData.js');

describe('CampaignManager', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    manager = new CampaignManager();
  });

  test('should load initial levels correctly', () => {
    const levels = manager.getAllLevels();
    expect(levels.length).toBe(CAMPAIGN_LEVELS.length);

    // Level 1 should be unlocked by default
    expect(manager.isLevelUnlocked('tutorial_1')).toBe(true);
    // Level 2 should be locked
    expect(manager.isLevelUnlocked('level_2')).toBe(false);
  });

  test('should complete level and unlock next', () => {
    const level1 = 'tutorial_1'; // Was level_1
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
    // Level 3 has a reward in levels.ts
    const level3 = 'level_3';

    // We need to complete level 1 and 2 first to "unlock" 3,
    // but completeLevel allows completing any level (logic-wise in the manager)
    manager.completeLevel(level3);

    expect(manager.isLevelCompleted(level3)).toBe(true);
    // level_3 in levels.ts has reward: 'angel'
    expect(manager.isRewardUnlocked('angel')).toBe(true);
  });

  test('should persist state to localStorage', () => {
    manager.completeLevel('tutorial_1');

    // Create a new instance
    const newManager = new CampaignManager();
    expect(newManager.isLevelCompleted('tutorial_1')).toBe(true);
    expect(newManager.isLevelUnlocked('level_2')).toBe(true);
  });

  test('isRewardUnlocked should work correctly', () => {
    expect(manager.isRewardUnlocked('some_reward')).toBe(false);

    // Simulate completing a level with a reward
    // We'll mock a level with a reward for testing
    const mockLevel = { id: 'mock', reward: 'medal' };
    vi.spyOn(manager, 'getLevel').mockReturnValue(mockLevel);

    manager.completeLevel('mock');
    expect(manager.isRewardUnlocked('medal')).toBe(true);
  });
});
