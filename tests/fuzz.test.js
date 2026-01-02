import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  renderBoard: jest.fn(),
  showModal: jest.fn(),
  updateStatus: jest.fn(),
  updateShopUI: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  updateStatistics: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  updateCapturedUI: jest.fn(),
  showShop: jest.fn(),
  showPromotionUI: jest.fn(),
  animateMove: jest.fn().mockResolvedValue(),
  animateCheck: jest.fn(),
  animateCheckmate: jest.fn(),
  addMoveToHistory: jest.fn(),
  initBoardUI: jest.fn(),
  renderEvalGraph: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playMove: jest.fn(),
    playCapture: jest.fn(),
    playCheck: jest.fn(),
    playCheckmate: jest.fn(),
    playGameStart: jest.fn(),
    playGameOver: jest.fn(),
  },
}));

// Setup window globals
global.window.PIECE_SVGS = {
  white: { p: 'p', r: 'r', n: 'n', b: 'b', q: 'q', k: 'k', a: 'a', c: 'c' },
  black: { p: 'p', r: 'r', n: 'n', b: 'b', q: 'q', k: 'k', a: 'a', c: 'c' },
};
global.window._svgCache = {};

const { Game } = await import('../js/gameEngine.js');
const { GameController } = await import('../js/gameController.js');
const { MoveController } = await import('../js/moveController.js');

describe('Randomized Fuzz Testing', () => {
  let game;
  let gameController;
  let moveController;

  beforeEach(() => {
    document.body.innerHTML = `
            <div id="board-wrapper"><div id="board"></div></div>
            <div id="status-display"></div>
            <div id="shop-panel" class="hidden"></div>
            <div id="points-display"></div>
            <div id="selected-piece-display"></div>
            <div id="game-over-overlay" class="hidden">
                <div id="winner-text"></div>
            </div>
            <div id="draw-offer-overlay" class="hidden">
                <div id="draw-offer-message"></div>
            </div>
            <div id="move-history"></div>
            <div id="captured-white"></div>
            <div id="captured-black"></div>
            <div id="clock-white"></div>
            <div id="clock-black"></div>
            <div id="chess-clock" class="hidden"></div>
            <div id="undo-btn"></div>
            <div id="redo-btn"></div>
            <div id="info-tabs-container" class="hidden"></div>
            <div id="quick-actions" class="hidden"></div>
            <div id="spinner-overlay" style="display:none"></div>
            <div id="ai-depth"></div>
            <div id="ai-nodes"></div>
            <div id="ai-best-move"></div>
            <div id="progress-fill"></div>
            <div id="eval-bar"></div>
            <div id="eval-score"></div>
            <div id="top-moves-content"></div>
        `;

    // Mock context/canvas for arrows if needed
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
    }));

    jest.clearAllMocks();
  });

  async function playRandomGame(iterations = 1, maxMoves = 50) {
    for (let i = 0; i < iterations; i++) {
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      moveController = new MoveController(game);
      game.gameController = gameController;
      game.moveController = moveController;

      let movesCount = 0;
      while (game.phase === PHASES.PLAY && movesCount < maxMoves) {
        const moves = game.getAllLegalMoves(game.turn);
        if (moves.length === 0) break;

        const move = moves[Math.floor(Math.random() * moves.length)];
        await moveController.executeMove(move.from, move.to);
        movesCount++;
      }

      expect([PHASES.PLAY, PHASES.GAME_OVER, PHASES.STALEMATE]).toContain(game.phase);
    }
  }

  test('should NOT crash over multiple randomized games (Classic Mode)', async () => {
    await playRandomGame(3, 30); // Reduce count for faster CI run
  });

  test('should NOT crash over randomized setup phase', async () => {
    game = new Game(15, 'setup');
    gameController = new GameController(game);
    moveController = new MoveController(game);
    game.gameController = gameController;
    game.moveController = moveController;

    // Random White King
    const wKingPos = { r: 7, c: 1 + Math.floor(Math.random() * 3) * 2 };
    gameController.placeKing(wKingPos.r, wKingPos.c, 'white');

    // Random Black King
    const bKingPos = { r: 1, c: 1 + Math.floor(Math.random() * 3) * 2 };
    gameController.placeKing(bKingPos.r, bKingPos.c, 'black');

    // Random White Pieces
    while (game.phase === PHASES.SETUP_WHITE_PIECES) {
      const pieces = ['p', 'r', 'n', 'b', 'q', 'a', 'c'];
      const piece = pieces[Math.floor(Math.random() * pieces.length)];
      gameController.selectShopPiece(piece);

      const empty = [];
      for (let r = 6; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (!game.board[r][c]) empty.push({ r, c });
        }
      }
      if (empty.length === 0) break;
      const spot = empty[Math.floor(Math.random() * empty.length)];
      gameController.placeShopPiece(spot.r, spot.c);

      if (Math.random() > 0.7) gameController.finishSetupPhase();
    }
    if (game.phase === PHASES.SETUP_WHITE_PIECES) gameController.finishSetupPhase();

    // Random Black Pieces
    while (game.phase === PHASES.SETUP_BLACK_PIECES) {
      const pieces = ['p', 'r', 'n', 'b', 'q', 'a', 'c'];
      const piece = pieces[Math.floor(Math.random() * pieces.length)];
      gameController.selectShopPiece(piece);

      const empty = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 9; c++) {
          if (!game.board[r][c]) empty.push({ r, c });
        }
      }
      if (empty.length === 0) break;
      const spot = empty[Math.floor(Math.random() * empty.length)];
      gameController.placeShopPiece(spot.r, spot.c);

      if (Math.random() > 0.7) gameController.finishSetupPhase();
    }
    if (game.phase === PHASES.SETUP_BLACK_PIECES) gameController.finishSetupPhase();

    expect(game.phase).toBe(PHASES.PLAY);
  });
});
