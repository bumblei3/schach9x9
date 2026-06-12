/**
 * SetupModeStrategy Branch Coverage Tests
 * Target: 80%+ branch coverage for js/modes/strategies/SetupMode.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SetupModeStrategy } from '../../js/modes/strategies/SetupMode';
import { PHASES, AI_DELAY_MS } from '../../js/config';
import * as UI from '../../js/ui';
import { soundManager } from '../../js/sounds';

const mockLogger = vi.mock('../../js/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock dependencies
vi.mock('../../js/ui', () => ({
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateStatistics: vi.fn(),
  log: vi.fn(),
}));

vi.mock('../../js/sounds', () => ({
  soundManager: {
    playGameStart: vi.fn(),
  },
}));

vi.mock('../../js/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SetupModeStrategy - Branch Coverage', () => {
  let strategy: SetupModeStrategy;
  let game: any;
  let controller: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    strategy = new SetupModeStrategy();

    game = {
      mode: 'setup',
      phase: PHASES.SETUP_WHITE_KING,
      points: 20,
      initialPoints: 20,
      board: Array(9).fill(null).map(() => Array(9).fill(null)),
      isAI: false,
      campaignMode: false,
      log: vi.fn(),
      aiSetupPieces: vi.fn(),
      aiSetupUpgrades: vi.fn(),
      selectedShopPiece: null,
      updateBestMoves: vi.fn(),
    };

    controller = {
      showShop: vi.fn(),
      placeKing: vi.fn(),
      placeShopPiece: vi.fn(),
      upgradePiece: vi.fn(),
      finishSetupPhase: vi.fn(),
      updateShopUI: vi.fn(),
      autoSave: vi.fn(),
      startClock: vi.fn(),
      gameStartTime: 0,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ============================================================
  // init() Tests - missing branches
  // ============================================================

  describe('init() - missing branches', () => {
    it('should initialize for upgrade8x8 mode with WHITE_UPGRADES phase', () => {
      game.mode = 'upgrade8x8';
      strategy.init(game, controller, 30);

      expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
      expect(game.points).toBe(30);
    });

    it('should initialize for classic mode with default points', () => {
      game.mode = 'classic';
      strategy.init(game, controller, 15);

      expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);
      expect(game.points).toBe(15);
    });

    it('should set points from parameter regardless of mode', () => {
      strategy.init(game, controller, 42);
      expect(game.points).toBe(42);
    });

    it('should always show shop and render board', () => {
      strategy.init(game, controller, 20);
      expect(controller.showShop).toHaveBeenCalledWith(true);
      expect(UI.renderBoard).toHaveBeenCalled();
      expect(UI.updateShopUI).toHaveBeenCalled();
      expect(UI.updateStatus).toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleInteraction() - missing phase branches
  // ============================================================

  describe('handleInteraction() - missing phase branches', () => {
    beforeEach(() => {
      // Setup basic mocks
      controller.placeKing.mockReturnValue(undefined);
      controller.placeShopPiece.mockReturnValue(undefined);
      controller.upgradePiece.mockReturnValue(undefined);
      game.handlePlayClick = vi.fn().mockResolvedValue(true);
    });

    it('should handle SETUP_BLACK_KING phase', async () => {
      game.phase = PHASES.SETUP_BLACK_KING;
      const result = await strategy.handleInteraction(game, controller, 0, 4);

      expect(result).toBe(true);
      expect(controller.placeKing).toHaveBeenCalledWith(0, 4, 'black');
    });

    it('should handle SETUP_BLACK_PIECES phase', async () => {
      game.phase = PHASES.SETUP_BLACK_PIECES;
      const result = await strategy.handleInteraction(game, controller, 3, 4);

      expect(result).toBe(true);
      expect(controller.placeShopPiece).toHaveBeenCalledWith(3, 4);
    });

    it('should handle SETUP_BLACK_UPGRADES phase', async () => {
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      const result = await strategy.handleInteraction(game, controller, 4, 4);

      expect(result).toBe(true);
      expect(controller.upgradePiece).toHaveBeenCalledWith(4, 4);
    });

    it('should handle PLAY phase via handlePlayClick', async () => {
      game.phase = PHASES.PLAY;
      game.handlePlayClick = vi.fn().mockResolvedValue(true);

      const result = await strategy.handleInteraction(game, controller, 4, 4);

      expect(result).toBe(true);
      expect(game.handlePlayClick).toHaveBeenCalledWith(4, 4);
    });

    it('should handle ANALYSIS phase via handlePlayClick', async () => {
      game.phase = PHASES.ANALYSIS;
      game.handlePlayClick = vi.fn().mockResolvedValue(true);

      const result = await strategy.handleInteraction(game, controller, 2, 2);

      expect(result).toBe(true);
      expect(game.handlePlayClick).toHaveBeenCalledWith(2, 2);
    });

    it('should return false for unhandled phase', async () => {
      game.phase = 'UNKNOWN_PHASE' as any;
      const result = await strategy.handleInteraction(game, controller, 0, 0);

      expect(result).toBe(false);
    });

    it('should return false if no handlePlayClick in PLAY phase', async () => {
      game.phase = PHASES.PLAY;
      delete game.handlePlayClick;
      
      const result = await strategy.handleInteraction(game, controller, 4, 4);
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // onPhaseEnd() - missing branches
  // ============================================================

  describe('onPhaseEnd() - missing branches', () => {
    beforeEach(() => {
      game.points = 0; // Default: no points modal
      controller.updateShopUI.mockClear();
      controller.autoSave.mockClear();
    });

    it('should transition BLACK_PIECES -> BLACK_UPGRADES', () => {
      game.phase = PHASES.SETUP_BLACK_PIECES;
      
      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      expect(game.selectedShopPiece).toBeNull();
      expect(controller.updateShopUI).toHaveBeenCalled();
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Upgrades möglich'));
    });

    it('should trigger AI upgrades for black in non-campaign mode', () => {
      game.isAI = true;
      game.phase = PHASES.SETUP_BLACK_PIECES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      vi.runAllTimers();
      expect(game.aiSetupUpgrades).toHaveBeenCalled();
      expect(controller.finishSetupPhase).toHaveBeenCalled();
    });

    it('should transition BLACK_UPGRADES -> PLAY', () => {
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      
      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.PLAY);
    });

    it('should handle campaign mode - white upgrades ends game', () => {
      game.campaignMode = true;
      game.mode = 'campaign';
      game.phase = PHASES.SETUP_WHITE_UPGRADES;
      game.points = 0;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.PLAY);
      expect(controller.showShop).toHaveBeenCalledWith(false);
    });

    it('should start game in campaign mode after white upgrades', () => {
      game.campaignMode = true;
      game.phase = PHASES.SETUP_WHITE_UPGRADES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.PLAY);
      expect(controller.startClock).toHaveBeenCalled();
    });

    it('should upgrade mode transition to black upgrades', () => {
      game.mode = 'upgrade';
      game.phase = PHASES.SETUP_WHITE_UPGRADES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      expect(game.points).toBe(game.initialPoints);
    });

    it('should upgrade8x8 mode transition to black upgrades', () => {
      game.mode = 'upgrade8x8';
      game.phase = PHASES.SETUP_WHITE_UPGRADES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      expect(game.points).toBe(game.initialPoints);
    });

    it('should AI trigger for upgrade mode black upgrades', () => {
      game.isAI = true;
      game.mode = 'upgrade';
      game.phase = PHASES.SETUP_WHITE_UPGRADES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      vi.runAllTimers();
      expect(game.aiSetupUpgrades).toHaveBeenCalled();
      expect(controller.finishSetupPhase).toHaveBeenCalled();
    });

    it('should handle AI black setup skip modal', () => {
      game.isAI = true;
      game.phase = PHASES.SETUP_BLACK_PIECES;
      game.points = 5; // points remaining but should be ignored

      strategy.onPhaseEnd(game, controller);

      // Should transition directly without modal
      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
      expect(UI.showModal).not.toHaveBeenCalled();
    });

    it('should handle AI black upgrades skip modal', () => {
      game.isAI = true;
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      game.points = 5;

      strategy.onPhaseEnd(game, controller);

      // Should transition directly without modal
      expect(game.phase).toBe(PHASES.PLAY);
      expect(UI.showModal).not.toHaveBeenCalled();
    });

    it('should show modal when points > 0 and not AI black setup', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.points = 3;
      game.isAI = false;

      strategy.onPhaseEnd(game, controller);

      expect(UI.showModal).toHaveBeenCalledWith(
        'Ungenutzte Punkte',
        expect.stringContaining('3 Punkte übrig'),
        expect.any(Array)
      );
      // Phase should NOT change (waiting for callback)
      expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);
    });

    it('should show modal for black pieces with points', () => {
      game.phase = PHASES.SETUP_BLACK_PIECES;
      game.points = 2;
      game.isAI = false;

      strategy.onPhaseEnd(game, controller);

      expect(UI.showModal).toHaveBeenCalled();
      expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);
    });

    it('should show modal for black upgrades with points', () => {
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      game.points = 1;
      game.isAI = false;

      strategy.onPhaseEnd(game, controller);

      expect(UI.showModal).toHaveBeenCalled();
      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);
    });
  });

  // ============================================================
  // startGame() - direct test
  // ============================================================

  describe('startGame() - direct test', () => {
    beforeEach(() => {
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      game.points = 0;
    });

    it('should set phase to PLAY', () => {
      strategy.startGame(game, controller);
      expect(game.phase).toBe(PHASES.PLAY);
    });

    it('should hide shop', () => {
      strategy.startGame(game, controller);
      expect(controller.showShop).toHaveBeenCalledWith(false);
    });

    it('should set gameStartTime', () => {
      strategy.startGame(game, controller);
      expect(controller.gameStartTime).toBeGreaterThan(0);
    });

    it('should remove corridor highlighting', () => {
      const cell = document.createElement('div');
      cell.classList.add('cell', 'selectable-corridor');
      document.body.appendChild(cell);

      strategy.startGame(game, controller);

      expect(cell.classList.contains('selectable-corridor')).toBe(false);
      document.body.removeChild(cell);
    });

    it('should show action bar', () => {
      const actionBar = document.createElement('div');
      actionBar.classList.add('action-bar', 'hidden');
      document.body.appendChild(actionBar);

      strategy.startGame(game, controller);

      expect(actionBar.classList.contains('hidden')).toBe(false);
      document.body.removeChild(actionBar);
    });

    it('should log game start', () => {
      strategy.startGame(game, controller);
      expect(game.log).toHaveBeenCalledWith('Spiel beginnt! Weiß ist am Zug.');
    });

    it('should update best moves', () => {
      strategy.startGame(game, controller);
      expect(game.updateBestMoves).toHaveBeenCalled();
    });

    it('should start clock', () => {
      strategy.startGame(game, controller);
      expect(controller.startClock).toHaveBeenCalled();
    });

    it('should update statistics', () => {
      strategy.startGame(game, controller);
      expect(UI.updateStatistics).toHaveBeenCalledWith(game);
    });

    it('should play game start sound', () => {
      strategy.startGame(game, controller);
      expect(soundManager.playGameStart).toHaveBeenCalled();
    });

    it('should auto save', () => {
      strategy.startGame(game, controller);
      expect(controller.autoSave).toHaveBeenCalled();
    });
  });

  // ============================================================
  // init() upgrade8x8 mode test
  // ============================================================

  describe('init() - upgrade8x8 mode', () => {
    it('should set phase to SETUP_WHITE_UPGRADES for upgrade8x8', () => {
      game.mode = 'upgrade8x8';
      strategy.init(game, controller, 30);

      expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
    });
  });

  // ============================================================
  // handleInteraction() - edge cases
  // ============================================================

  describe('handleInteraction() - edge cases', () => {
    it('should handle SETUP_WHITE_KING with controller error', async () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      controller.placeKing.mockImplementation(() => { throw new Error('King placement failed'); });

      await expect(strategy.handleInteraction(game, controller, 8, 4)).rejects.toThrow();
    });

    it('should return true for valid SETUP_WHITE_PIECES placement', async () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      const result = await strategy.handleInteraction(game, controller, 7, 4);
      expect(result).toBe(true);
    });

    it('should handle upgrade phase with valid coordinates', async () => {
      game.phase = PHASES.SETUP_WHITE_UPGRADES;
      const result = await strategy.handleInteraction(game, controller, 6, 4);
      expect(result).toBe(true);
    });
  });
});