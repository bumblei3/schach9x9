import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PHASES } from '../../js/config.js';

// Mock dependencies (same as upgradeMode.test.js)
vi.mock('../../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn((title, content, actions) => {
    if (actions) {
      const confirm = actions.find(a => a.text === 'Fortfahren');
      if (confirm && confirm.callback) confirm.callback();
    }
  }),
  closeModal: vi.fn(),
  showToast: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  initBoardUI: vi.fn(),
  showShop: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatistics: vi.fn(),
  renderEvalGraph: vi.fn(),
  animateCheckmate: vi.fn(),
  animateCheck: vi.fn(),
}));

vi.mock('../../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playMove: vi.fn(),
    playGameStart: vi.fn(),
    playGameOver: vi.fn(),
    playSound: vi.fn(),
    playCheck: vi.fn(),
  },
}));

vi.mock('../../js/campaign/CampaignManager.js', () => ({
  campaignManager: {
    isRewardUnlocked: vi.fn(() => true),
    getLevel: vi.fn(),
  },
}));

vi.mock('../../js/TimeManager.js', () => ({
  TimeManager: class {
    constructor() {}
    setTimeControl() {}
    updateClockVisibility() {}
    startClock() {}
    stopClock() {}
  },
}));
vi.mock('../../js/tutorial.js', () => ({ Tutorial: class {} }));
vi.mock('../../js/AnalysisController.js', () => ({
  AnalysisController: class {
    constructor() {}
    enterAnalysisMode() {}
    exitAnalysisMode() {}
  },
}));
vi.mock('../../js/ui/AnalysisUI.js', () => ({
  AnalysisUI: class {
    constructor() {}
  },
}));
vi.mock('../../js/ui/PuzzleMenu.js', () => ({
  PuzzleMenu: class {
    constructor() {}
  },
}));

import { GameController } from '../../js/gameController.js';
import { Game } from '../../js/gameEngine.js';

describe('8x8 Upgrade Mode', () => {
  let game;
  let controller;

  beforeEach(async () => {
    game = new Game(0, 'upgrade8x8');
    game.log = vi.fn();
    controller = new GameController(game);
    game.gameController = controller;
    await controller.initGame(0, 'upgrade8x8');
    game.log = vi.fn();
  });

  test('Initial State should have 15 points and 8x8 setup', () => {
    expect(game.mode).toBe('upgrade8x8');
    expect(game.points).toBe(15);
    expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);

    // Check 8x8 board setup
    // White Pawns at Row 6 (index)
    expect(game.board[6][4].type).toBe('p');
    // Black Pawns at Row 1
    expect(game.board[1][4].type).toBe('p');

    // Row 7 (index) should be White Pieces (index 0 to 7)
    expect(game.board[7][4].type).toBe('k'); // King column

    // Row 8 should be undefined or empty in 9x9 array used for 8x8?
    // Wait, typical 9x9 board array. setupStandard8x8Board uses indices 0-7.
    // Row 8 should NOT have pieces.
    expect(game.board[8][0]).toBeNull();
  });

  test('Transitions correctly using 15 points', () => {
    controller.finishSetupPhase(); // To Black
    expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
    expect(game.points).toBe(15);
    expect(game.log).toHaveBeenCalledWith('Weiß fertig. Schwarz rüstet auf.');
  });
});
