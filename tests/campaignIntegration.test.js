// Mock dependencies
const mockUI = {
  updateStatus: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateShopUI: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  initBoardUI: vi.fn(),
  showCampaignVictoryModal: vi.fn(),
  showShop: vi.fn(),
  closeModal: vi.fn(),
  updatePointsUI: vi.fn(),
};

vi.mock('../js/ui.js', () => mockUI);

const mockSoundManager = {
  init: vi.fn(),
  playGameOver: vi.fn(),
  playSuccess: vi.fn(),
};

vi.mock('../js/sounds.js', () => ({
  soundManager: mockSoundManager,
}));

vi.mock('../js/tutorial.js', () => ({
  Tutorial: class {
    constructor() { }
  },
}));

// Mock other dependencies of GameController
vi.mock('../js/gameEngine.js', () => ({
  Game: class {
    constructor() {
      this.board = [];
      this.capturedPieces = { white: [], black: [] };
      this.stats = { totalMoves: 0, promotions: 0 };
    }
    calculateMaterialAdvantage() {
      return 0;
    }
  },
  PHASES: { SETUP_WHITE_KING: 'setup_wk', PLAY: 'play', GAME_OVER: 'game_over' },
  AI_DELAY_MS: 0,
}));

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

// Mock campaign data to ensure test stability and match IDs
const MOCK_CAMPAIGN_LEVELS = [
  {
    id: 'level_1',
    title: 'Aufstand', // Match expect string in test
    setupType: 'fixed',
    difficulty: 'easy',
    playerColor: 'white',
    fen: '8/8/8/8/8/8/8/8/4K3 w - - 0 1',
    winCondition: { type: 'checkmate' },
    unlocks: ['level_2'],
    goals: {}
  },
  {
    id: 'level_2',
    title: 'Level 2',
    setupType: 'fixed',
    difficulty: 'medium',
    playerColor: 'white',
    fen: '8/8/8/8/8/8/8/8/4K3 w - - 0 1',
    winCondition: { type: 'checkmate' },
    unlocks: ['level_3'],
    goals: {}
  },
  {
    id: 'level_3',
    title: 'Level 3',
    setupType: 'fixed',
    difficulty: 'hard',
    playerColor: 'white',
    fen: '8/8/8/8/8/8/8/8/4K3 w - - 0 1',
    winCondition: { type: 'checkmate' },
    unlocks: [],
    reward: 'angel', // Custom property for test
    goals: {}
  }
];

vi.mock('../js/campaign/campaignData.js', () => ({
  CAMPAIGN_LEVELS: MOCK_CAMPAIGN_LEVELS,
}));

// Import system under test
const { GameController } = await import('../js/gameController.js');
const { campaignManager } = await import('../js/campaign/CampaignManager.js');

describe('Campaign Integration', () => {
  let gameController;
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    campaignManager.resetState();

    // Setup minimal DOM
    document.body.innerHTML = `
          <div id="board-container">
            <div id="board"></div>
          </div>
        `;

    game = {
      board: [],
      turn: 'white',
      playerColor: 'white',
      capturedPieces: { white: [], black: [] },
      stats: { totalMoves: 0, promotions: 0 },
      isAI: true,
      calculateMaterialAdvantage: vi.fn(() => 0),
    };

    // Instantiate controller
    gameController = new GameController(game);
    gameController.statisticsManager = { saveGame: vi.fn() };
    gameController.timeManager = { startClock: vi.fn() };
  });

  test('startCampaignLevel should initialize level_1 (fixed)', () => {
    const levelId = 'level_1';
    gameController.startCampaignLevel(levelId);

    expect(game.campaignMode).toBe(true);
    expect(game.currentLevelId).toBe(levelId);
    expect(game.phase).toBe('PLAY'); // level_1 is fixed -> PLAY

    expect(mockUI.renderBoard).toHaveBeenCalled();
    expect(mockUI.showModal).toHaveBeenCalledWith(
      expect.stringContaining('Aufstand'),
      expect.any(String),
      expect.any(Array)
    );
  });

  test('handleGameEnd should complete level on victory', () => {
    const levelId = 'level_1';
    gameController.startCampaignLevel(levelId);

    // Simulate winning
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelCompleted(levelId)).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'schach_campaign_state',
      expect.stringContaining(levelId)
    );
  });

  test('handleGameEnd should unlock level_2 after level_1 win', () => {
    const level1 = 'level_1';
    const level2 = 'level_2';

    expect(campaignManager.isLevelUnlocked(level2)).toBe(false);

    gameController.startCampaignLevel(level1);
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelUnlocked(level2)).toBe(true);
  });

  test('should unlock level_3 after level_2 win and persistent rewards', () => {
    // 1. Level 1 win
    gameController.startCampaignLevel('level_1');
    gameController.handleGameEnd('win', 'white');

    // 2. Level 2 win
    gameController.startCampaignLevel('level_2');
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelUnlocked('level_3')).toBe(true);

    // 3. Level 3 win
    gameController.startCampaignLevel('level_3');
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelCompleted('level_3')).toBe(true);

    // Verify reward 'angel' is unlocked (concept reward in levels.ts)
    // Note: level_3 reward is 'Unlock: Angel (Concept)' in current levels.ts
    // In my logic I used 'angel' as the key.
    expect(campaignManager.isRewardUnlocked('angel')).toBe(true);
  });

  test('resetState should clear all progress for testing isolation', () => {
    gameController.startCampaignLevel('level_1');
    gameController.handleGameEnd('win', 'white');
    expect(campaignManager.isLevelCompleted('level_1')).toBe(true);

    campaignManager.resetState();
    expect(campaignManager.isLevelCompleted('level_1')).toBe(false);
    expect(campaignManager.isLevelUnlocked('level_2')).toBe(false);
  });
});
