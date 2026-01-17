import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClassicModeStrategy } from '../../js/modes/strategies/ClassicMode';
import { PHASES } from '../../js/config';
import * as UI from '../../js/ui';

// Mock dependencies
vi.mock('../../js/ui', () => ({
  initBoardUI: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  renderBoard: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
}));

vi.mock('../../js/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('ClassicModeStrategy', () => {
  let strategy: ClassicModeStrategy;
  let game: any;
  let controller: any;

  beforeEach(() => {
    strategy = new ClassicModeStrategy();

    game = {
      phase: null,
      setupClassicBoard: vi.fn(),
      handlePlayClick: vi.fn(),
    };

    controller = {
      gameStartTime: null,
      startClock: vi.fn(),
      initArrowRenderer: vi.fn(),
    };

    // Mock DOM elements
    document.body.innerHTML = `
      <div id="info-tabs-container" class="hidden"></div>
      <div id="quick-actions" class="hidden"></div>
    `;

    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should initialize classic mode correctly', () => {
    strategy.init(game, controller);

    expect(game.phase).toBe(PHASES.PLAY);
    expect(game.setupClassicBoard).toHaveBeenCalled();

    // Check UI visibility
    const tabs = document.getElementById('info-tabs-container');
    const actions = document.getElementById('quick-actions');
    expect(tabs?.classList.contains('hidden')).toBe(false);
    expect(actions?.classList.contains('hidden')).toBe(false);

    // Check game start logic
    expect(controller.gameStartTime).toBeDefined();
    expect(controller.startClock).toHaveBeenCalled();
    expect(UI.renderBoard).toHaveBeenCalled();
  });

  it('should delegate interactions in PLAY phase', async () => {
    game.phase = PHASES.PLAY;
    const result = await strategy.handleInteraction(game, controller, 0, 0);

    expect(result).toBe(true);
    expect(game.handlePlayClick).toHaveBeenCalledWith(0, 0);
  });

  it('should delegate interactions in ANALYSIS phase', async () => {
    game.phase = 'ANALYSIS';
    const result = await strategy.handleInteraction(game, controller, 0, 0);

    expect(result).toBe(true);
    expect(game.handlePlayClick).toHaveBeenCalledWith(0, 0);
  });

  it('should ignore interactions in other phases', async () => {
    game.phase = 'SETUP_WHITE_PIECES';
    const result = await strategy.handleInteraction(game, controller, 0, 0);

    expect(result).toBe(false);
    expect(game.handlePlayClick).not.toHaveBeenCalled();
  });
});
