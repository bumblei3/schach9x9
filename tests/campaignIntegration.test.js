import { jest } from '@jest/globals';

// Mock dependencies
const mockUI = {
  updateStatus: jest.fn(),
  renderBoard: jest.fn(),
  showModal: jest.fn(),
  updateShopUI: jest.fn(),
  updateStatistics: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  initBoardUI: jest.fn(),
};

jest.unstable_mockModule('../js/ui.js', () => mockUI);

const mockSoundManager = {
  init: jest.fn(),
  playGameOver: jest.fn(),
  playSuccess: jest.fn(),
};

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: mockSoundManager,
}));

jest.unstable_mockModule('../js/tutorial.js', () => ({
  Tutorial: class {
    constructor() {}
  },
}));

// Mock other dependencies of GameController
jest.unstable_mockModule('../js/gameEngine.js', () => ({
  Game: class {
    constructor() {
      this.board = [];
      this.capturedPieces = { white: [], black: [] };
    }
  },
  PHASES: { SETUP_WHITE_KING: 'setup_wk', PLAY: 'play', GAME_OVER: 'game_over' },
  AI_DELAY_MS: 0,
}));

// Real CampaignManager (but with mocked localStorage inside it? No, let's mock the module or use real one with mock storage)
// Let's use real CampaignManager logic but mock its persistence mechanism (localStorage)
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

// Import system under test
const { GameController } = await import('../js/gameController.js');
const { campaignManager } = await import('../js/campaign/CampaignManager.js');

describe('Campaign Integration', () => {
  let gameController;
  let game;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    campaignManager.resetProgress();

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
      isAI: true, // Campaign is vs AI usually
      calculateMaterialAdvantage: jest.fn(() => 0),
    };

    // Instantiate controller
    gameController = new GameController(game);
    // Mock methods that might throw or have side effects
    gameController.statisticsManager = { saveGame: jest.fn() };
    gameController.timeManager = { startClock: jest.fn() };
  });

  test('startCampaignLevel should initialize game with level configuration', () => {
    const levelId = 'tutorial_1'; // Known ID from campaignData
    const level = campaignManager.getLevel(levelId);

    gameController.startCampaignLevel(levelId);

    expect(game.campaignMode).toBe(true);
    expect(game.currentLevelId).toBe(levelId);
    expect(game.playerColor).toBe(level.playerColor);

    // Board should be loaded from FEN (check if board is populated)
    expect(game.board.length).toBe(9);
    // tutorial_1 FEN has King at d1 (row 8, col 3 in 0-indexed 9x9? No, FEN parsing logic needs verification if we care about exact placement)
    // But at least board should not be empty where pieces are expected.

    expect(mockUI.renderBoard).toHaveBeenCalled();
    expect(mockUI.showModal).toHaveBeenCalledWith(
      level.title,
      expect.any(String),
      expect.any(Array)
    );
  });

  test('handleGameEnd should complete level on victory', () => {
    const levelId = 'tutorial_1';
    gameController.startCampaignLevel(levelId); // Set context

    // Simulate winning
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelCompleted(levelId)).toBe(true);
    // Should verify it saved 3 stars or generic completion
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'schach9x9_campaign_progress',
      expect.stringContaining(levelId)
    );
  });

  test('handleGameEnd should NOT complete level on loss', () => {
    const levelId = 'tutorial_1';
    gameController.startCampaignLevel(levelId);

    // Simulate losing (white resigns or gets mated)
    gameController.handleGameEnd('loss', 'white'); // White result is loss

    expect(campaignManager.isLevelCompleted(levelId)).toBe(false);
  });

  test('handleGameEnd should unlock the next level', () => {
    const levelId = 'tutorial_1';
    const nextLevelId = 'skirmish_1';

    expect(campaignManager.isLevelUnlocked(nextLevelId)).toBe(false);

    gameController.startCampaignLevel(levelId);
    gameController.handleGameEnd('win', 'white');

    expect(campaignManager.isLevelUnlocked(nextLevelId)).toBe(true);
  });
});
