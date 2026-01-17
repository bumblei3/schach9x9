import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Game, PHASES } from '../js/gameEngine.js';
import { GameController } from '../js/gameController.js';

// Mock UI and sounds
vi.mock('../js/ui.js', () => ({
  initBoardUI: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  renderBoard: vi.fn(),
  updateStatistics: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  showShop: vi.fn(),
  initClockUI: vi.fn(),
  updateCapturedUI: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playGameStart: vi.fn(),
    playMove: vi.fn(),
  },
}));

// Mock Tutorial
vi.mock('../js/tutorial.js', () => ({
  Tutorial: vi.fn().mockImplementation(function () {
    return {
      init: vi.fn(),
      show: vi.fn(),
    };
  }),
}));

// Mock logger
vi.mock('../js/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock AudioContext for JSDOM
const mockAudioContext = vi.fn().mockImplementation(function () {
  return {
    createOscillator: vi.fn(),
    createGain: vi.fn(),
    destination: {},
  };
});
vi.stubGlobal('AudioContext', mockAudioContext);
vi.stubGlobal('webkitAudioContext', mockAudioContext);

describe('Setup Phase Integration', () => {
  let game: any;
  let controller: any;

  beforeEach(() => {
    // Mock DOM for initGame
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="info-tabs-container"></div>
      <div id="quick-actions"></div>
      <div id="status"></div>
      <div id="shop-container"></div>
      <div id="log-panel"></div>
      <div id="tutorial-overlay"></div>
      <div id="tutorial-steps"></div>
      <div id="tutorial-current-step"></div>
      <div id="tutorial-total-steps"></div>
      <button id="tutorial-prev"></button>
      <button id="tutorial-next"></button>
      <button id="tutorial-close"></button>
    `;

    game = new Game(20, 'setup'); // 20 points
    controller = new GameController(game);
    controller.initGame(20, 'setup');
    vi.clearAllMocks();
  });

  test('should initialize setup phase correctly', () => {
    controller.initGame(20, 'setup');
    expect(game.points).toBe(20);
    expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);
  });

  test('should deduct points when placing pieces', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.points = 20;

    controller.selectShopPiece('q');
    game.whiteCorridor = 6;
    controller.placeShopPiece(7, 7);

    expect(game.points).toBe(11); // 20 - 9 = 11
    expect(game.board[7][7]).toBeDefined();
    expect(game.board[7][7].type).toBe('q');
  });

  test('should prevent placing pieces without enough points', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.points = 5;

    controller.selectShopPiece('q'); // 9 points
    controller.placeShopPiece(7, 7);

    expect(game.points).toBe(5);
    expect(game.board[7][7]).toBeNull();
  });

  test('should transition to next phase after setup', () => {
    game.phase = PHASES.SETUP_WHITE_PIECES;
    game.points = 0;

    controller.finishSetupPhase();

    expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);

    // Transition through upgrades to black pieces
    controller.finishSetupPhase();
    expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);
    expect(game.points).toBe(20); // Reset for black
  });
});
