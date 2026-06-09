import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Game, PHASES } from '../js/gameEngine.js';
import { GameController } from '../js/gameController.js';
import { MoveController } from '../js/moveController.js';
import { AIController } from '../js/aiController.js';
import * as UI from '../js/ui.js';

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

describe('Full AI Flow - player move triggers AI move execution', () => {
  let game: any;
  let gameController: any;
  let moveController: any;
  let aiController: any;

  beforeEach(async () => {
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
      <div id=\"spinner-overlay\" class=\"hidden\"></div>
      <div id=\"ai-best-move\"></div>
      <div id=\"ai-depth\"></div>
      <div id=\"ai-nodes\"></div>
      <div id=\"progress-fill\"></div>
    `;

    game = new Game(10, 'classic');
    gameController = new GameController(game);
    moveController = new MoveController(game);
    aiController = new AIController(game);

    game.gameController = gameController;
    game.moveController = moveController;
    game.aiController = aiController;
    game.aiMove = vi.fn();

    // Simulate applyDelegates
    game.handlePlayClick = (r: number, c: number) => moveController.handlePlayClick(r, c);
    game.finishMove = () => moveController.finishMove();

    gameController.moveController = moveController;
    gameController.shopManager = { updateShopUI: vi.fn(), selectShopPiece: vi.fn(), placeShopPiece: vi.fn() };
    gameController.statisticsManager = { updateStats: vi.fn(), recordGameStart: vi.fn() };
    gameController.timeManager = { startClock: vi.fn(), stopClock: vi.fn(), switchTurn: vi.fn(), setTimeControl: vi.fn(), updateClockVisibility: vi.fn(), tickClock: vi.fn(), updateClockDisplay: vi.fn(), updateClockUI: vi.fn() };

    gameController.initGame(10, 'classic');
  });

  test('After player move, aiMove is called via setTimeout', async () => {
    vi.useFakeTimers();

    expect(game.phase).toBe(PHASES.PLAY);
    expect(game.turn).toBe('white');

    // Place a movable white pawn
    game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.getValidMoves = vi.fn(() => [{ r: 6, c: 4 }]);

    // Player selects and moves
    game.selectedSquare = { r: 7, c: 4 };
    game.validMoves = [{ r: 6, c: 4 }];

    await moveController.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });

    expect(game.turn).toBe('black');
    expect(game.aiMove).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(game.aiMove).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  test('Game flow: player move -> AI trigger -> turn back to white', async () => {
    vi.useFakeTimers();

    // Track the full flow
    const moveLog: string[] = [];
    game.aiMove = vi.fn(() => {
      moveLog.push('aiMove called');
      // Simulate AI making a move
      const blackMoves = game.getAllLegalMoves('black');
      if (blackMoves.length > 0) {
        const move = blackMoves[0];
        game.executeMove(move.from, move.to);
        moveLog.push(`AI moved: ${move.from.r},${move.from.c} -> ${move.to.r},${move.to.c}`);
      }
    });

    // Place white pawn
    game.board[7][4] = { type: 'p', color: 'white', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    game.getValidMoves = vi.fn(() => [{ r: 6, c: 4 }]);

    // Player moves
    game.selectedSquare = { r: 7, c: 4 };
    game.validMoves = [{ r: 6, c: 4 }];

    await moveController.executeMove({ r: 7, c: 4 }, { r: 6, c: 4 });

    expect(game.turn).toBe('black');

    // Trigger AI
    vi.runAllTimers();

    expect(game.aiMove).toHaveBeenCalledTimes(1);
    expect(moveLog).toContain('aiMove called');
    expect(game.turn).toBe('white'); // After AI move, turn back to white

    vi.useRealTimers();
  });
});
