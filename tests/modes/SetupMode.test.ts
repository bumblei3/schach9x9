import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SetupModeStrategy } from '../../js/modes/strategies/SetupMode';
import { PHASES } from '../../js/config';
import * as UI from '../../js/ui';

// Mock dependencies
vi.mock('../../js/ui', () => ({
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  updateStatistics: vi.fn(),
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

describe('SetupModeStrategy', () => {
  let strategy: SetupModeStrategy;
  let game: any;
  let controller: any;

  beforeEach(() => {
    vi.useFakeTimers();
    strategy = new SetupModeStrategy();

    // minimal game mock
    game = {
      mode: 'setup',
      phase: PHASES.SETUP_WHITE_KING,
      points: 20,
      initialPoints: 20,
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      isAI: false,
      log: vi.fn(),
      aiSetupPieces: vi.fn(),
      aiSetupUpgrades: vi.fn(),
    };

    // minimal controller mock
    controller = {
      showShop: vi.fn(),
      placeKing: vi.fn(),
      placeShopPiece: vi.fn(),
      upgradePiece: vi.fn(),
      finishSetupPhase: vi.fn(),
      updateShopUI: vi.fn(),
      autoSave: vi.fn(),
      startClock: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize correctly for setup mode', () => {
    strategy.init(game, controller, 25);

    expect(game.points).toBe(25);
    expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);
    expect(controller.showShop).toHaveBeenCalledWith(true);
    expect(UI.updateShopUI).toHaveBeenCalled();
  });

  it('should initialize correctly for upgrade mode', () => {
    game.mode = 'upgrade';
    strategy.init(game, controller, 15);

    expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
  });

  it('should handle king placement interaction', async () => {
    game.phase = PHASES.SETUP_WHITE_KING;
    const result = await strategy.handleInteraction(game, controller, 8, 4);

    expect(result).toBe(true);
    expect(controller.placeKing).toHaveBeenCalledWith(8, 4, 'white');
  });

  it('should handle shop piece placement', async () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    const result = await strategy.handleInteraction(game, controller, 6, 4);

    expect(result).toBe(true);
    expect(controller.placeShopPiece).toHaveBeenCalledWith(6, 4);
  });

  it('should handle upgrade interaction', async () => {
    game.phase = PHASES.SETUP_WHITE_UPGRADES;
    const result = await strategy.handleInteraction(game, controller, 6, 4);

    expect(result).toBe(true);
    expect(controller.upgradePiece).toHaveBeenCalledWith(6, 4);
  });

  describe('onPhaseEnd transitions', () => {
    it('should transition from white pieces to white upgrades', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.points = 0; // Ensure no modal
      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);
      expect(game.selectedShopPiece).toBeNull();
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Upgrades möglich'));
    });

    it('should show warning modal if points remain', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.points = 5; // Points remaining

      strategy.onPhaseEnd(game, controller);

      expect(UI.showModal).toHaveBeenCalledWith(
        'Ungenutzte Punkte',
        expect.stringContaining('5 Punkte übrig'),
        expect.any(Array)
      );
      // Phase should NOT change yet (waiting for callback)
      expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);
    });

    it('should transition to black setup after white upgrades', () => {
      game.phase = PHASES.SETUP_WHITE_UPGRADES;
      game.points = 0; // Ensure no modal
      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);
      expect(game.points).toBe(20); // Reset to initial
      expect(controller.autoSave).toHaveBeenCalled();
    });

    it('should start game after black upgrades', () => {
      game.phase = PHASES.SETUP_BLACK_UPGRADES;
      game.points = 0; // Ensure no modal
      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.PLAY);
      expect(controller.showShop).toHaveBeenCalledWith(false);
      expect(controller.startClock).toHaveBeenCalled();
    });
  });

  describe('AI Integration', () => {
    it('should trigger AI setup pieces after white finishes', () => {
      game.isAI = true;
      game.phase = PHASES.SETUP_WHITE_UPGRADES;
      game.points = 0;

      strategy.onPhaseEnd(game, controller);

      // Timer should be set
      expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);

      // Fast forward
      vi.runAllTimers();

      expect(game.aiSetupPieces).toHaveBeenCalled();
    });

    it('should trigger AI upgrades after black pieces finish', () => {
      game.isAI = true;
      game.phase = PHASES.SETUP_BLACK_PIECES;

      strategy.onPhaseEnd(game, controller);

      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);

      vi.runAllTimers();

      expect(game.aiSetupUpgrades).toHaveBeenCalled();
      expect(controller.finishSetupPhase).toHaveBeenCalled();
    });
  });
});
