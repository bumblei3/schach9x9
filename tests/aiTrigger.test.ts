import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Game, PHASES } from '../js/gameEngine.js';
import { GameController } from '../js/gameController.js';
import { MoveController } from '../js/moveController.js';
import * as UI from '../js/ui.js';

// Mock UI
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  initBoardUI: vi.fn(),
  animateMove: vi.fn((_g: any, _f: any, _t: any, _p: any, cb?: any) => cb && cb()),
  highlightLastMove: vi.fn(),
  clearHighlights: vi.fn(),
  getPieceSymbol: vi.fn(() => 'X'),
  getPieceText: vi.fn(() => 'X'),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  showShop: vi.fn(),
  updateStatistics: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  showModal: vi.fn(),
  showPromotionUI: vi.fn(),
  showToast: vi.fn(),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playGameOver: vi.fn(),
    playGameStart: vi.fn(),
    playError: vi.fn(),
    playSuccess: vi.fn(),
  },
}));

describe('AI Trigger Integration', () => {
  let game: any;
  let controller: any;
  let moveController: any;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id=\"tutorial-overlay\"></div>
      <div id=\"tutorial-steps\"></div>
      <button id=\"tutorial-prev\"></button>
      <button id=\"tutorial-next\"></button>
      <button id=\"tutorial-close\"></button>
      <span id=\"tutorial-current-step\"></span>
      <span id=\"tutorial-total-steps\"></span>
      <div id=\"status-display\"></div>
      <div id=\"shop-panel\"></div>
      <div id=\"shop-items\"></div>
      <div id=\"points-display\"></div>
      <div id=\"selected-piece-display\"></div>
      <div id=\"board-wrapper\"><div id=\"board\"></div></div>
      <div id=\"game-over-overlay\" class=\"hidden\"></div>
      <div id=\"winner-text\"></div>
    `;

    game = new Game(10, 'classic');
    controller = new GameController(game);
    moveController = new MoveController(game);

    game.gameController = controller;
    game.moveController = moveController;
    game.aiMove = vi.fn();

    controller.moveController = moveController;
    controller.shopManager = { updateShopUI: vi.fn() };
    controller.statisticsManager = { updateStats: vi.fn(), recordGameStart: vi.fn() };
    controller.timeManager = { startClock: vi.fn(), stopClock: vi.fn(), switchTurn: vi.fn() };

    controller.initGame(10, 'classic');
  });

  test('AI move is triggered after player move in classic mode', async () => {
    vi.useFakeTimers();

    expect(game.phase).toBe(PHASES.PLAY);
    expect(game.turn).toBe('white');

    // Setup: Place a white pawn that can move
    game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };
    game.getValidMoves = vi.fn(() => [{ r: 6, c: 4 }]);

    // Player selects pawn
    game.selectedSquare = { r: 7, c: 4 };
    game.validMoves = [{ r: 6, c: 4 }];

    // Player clicks destination
    await moveController.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });

    // Turn should now be black
    expect(game.turn).toBe('black');

    // AI move should NOT have been called yet (it's in setTimeout)
    expect(game.aiMove).not.toHaveBeenCalled();

    // Advance timers to trigger the setTimeout
    vi.runAllTimers();

    // NOW aiMove should have been called
    expect(game.aiMove).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('AI move is NOT triggered when isAI is false', async () => {
    vi.useFakeTimers();

    game.isAI = false;
    game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };
    game.getValidMoves = vi.fn(() => [{ r: 6, c: 4 }]);

    game.selectedSquare = { r: 7, c: 4 };
    game.validMoves = [{ r: 6, c: 4 }];

    await moveController.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });

    vi.runAllTimers();

    expect(game.aiMove).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
