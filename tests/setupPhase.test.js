import { Game, PHASES } from '../js/gameEngine.js';
import { GameController } from '../js/gameController.js';
import { jest } from '@jest/globals';

// Mock UI and sounds
jest.mock('../js/ui.js', () => ({
  initBoardUI: jest.fn(),
  updateStatus: jest.fn(),
  updateShopUI: jest.fn(),
  renderBoard: jest.fn(),
  updateStatistics: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  showShop: jest.fn(),
  initClockUI: jest.fn(),
  updateCapturedUI: jest.fn(),
}));

jest.mock('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playGameStart: jest.fn(),
    playMove: jest.fn(),
  },
}));

// Mock Tutorial
jest.mock('../js/tutorial.js', () => ({
  Tutorial: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    show: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../js/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock AudioContext for JSDOM
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn(),
  createGain: jest.fn(),
  destination: {},
}));
global.webkitAudioContext = global.AudioContext;

describe('Setup Phase Integration', () => {
  let game;
  let controller;

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
    jest.clearAllMocks();
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

    expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);
    expect(game.points).toBe(20); // Reset for black
  });
});
