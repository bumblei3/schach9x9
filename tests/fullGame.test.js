import { jest } from '@jest/globals';
import { setupJSDOM } from './test-utils.js';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  initBoardUI: jest.fn(),
  updateStatus: jest.fn(),
  updateShopUI: jest.fn(),
  renderBoard: jest.fn(),
  updateStatistics: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  showModal: jest.fn(),
  showPromotionUI: jest.fn(),
  showToast: jest.fn(),
  updateCapturedUI: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  addMoveToHistory: jest.fn(),
  highlightLastMove: jest.fn(),
  clearHighlights: jest.fn(),
  getSquareName: jest.fn((r, c) => `${String.fromCharCode(97 + c)}${9 - r}`),
  showShop: jest.fn(),
  animateMove: jest.fn(() => Promise.resolve()),
  renderEvalGraph: jest.fn(),
  animateCheck: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playMove: jest.fn(),
    playGameOver: jest.fn(),
    playGameStart: jest.fn(),
    playPiecePlace: jest.fn(),
    playCapture: jest.fn(),
  },
}));

// Import controllers
const { GameController } = await import('../js/gameController.js');
const { MoveController } = await import('../js/moveController.js');
const { Game } = await import('../js/gameEngine.js');

describe('Full-Game Integration Test', () => {
  let game, gc, mc;

  beforeEach(() => {
    setupJSDOM();
    game = new Game(15, 'setup');
    game.isAI = false;
    gc = new GameController(game);
    mc = new MoveController(game);
    game.handlePlayClick = mc.handlePlayClick.bind(mc);

    // Initialize strategy
    gc.initGame(15, 'setup');

    jest.clearAllMocks();
  });

  test('Setup phase transitions and initial move', async () => {
    // 1. SETUP PHASE - White King
    gc.handleCellClick(8, 4);
    expect(game.board[7][4]).toMatchObject({ type: 'k', color: 'white' });
    expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);

    // 2. SETUP PHASE - Black King
    gc.handleCellClick(0, 4);
    expect(game.board[1][4]).toMatchObject({ type: 'k', color: 'black' });
    expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);

    // 3. SETUP PHASE - White Pieces
    game.selectedShopPiece = 'p'; // Simulate shop selection
    gc.handleCellClick(6, 4);
    expect(game.board[6][4]).toMatchObject({ type: 'p', color: 'white' });

    gc.handleCellClick(6, 6);
    expect(game.board[6][6]).toBeNull(); // 6,6 is outside corridor!

    game.selectedShopPiece = 'p'; // Re-select
    gc.handleCellClick(6, 5);
    expect(game.board[6][5]).toMatchObject({ type: 'p', color: 'white' });

    // 4. Move to PLAY phase
    game.phase = PHASES.PLAY;
    game.turn = 'white';

    // Move the pawn: (6,4) to (5,4)
    game.selectedShopPiece = 'p'; // Simulate shop selection
    gc.handleCellClick(8, 4);
    expect(game.selectedSquare).toBeNull(); // Black king, but white turn

    // Select White Pawn
    gc.handleCellClick(6, 4);
    expect(game.selectedSquare).toEqual({ r: 6, c: 4 });
    expect(game.validMoves).toBeDefined();

    // Select different White Pawn
    gc.handleCellClick(6, 5);
    expect(game.selectedSquare).toEqual({ r: 6, c: 5 });

    // Execute Move (6,4 -> 5,4)
    gc.handleCellClick(6, 4); // Select
    // BUT gc.handleCellClick is sync. We'll wait a tick.
    await gc.handleCellClick(5, 4); // Move

    // Check post-move state
    // White pawn moved to 5,4
    expect(game.board[5][4]).toMatchObject({ type: 'p', color: 'white' });
    expect(game.board[6][4]).toBeNull();
    expect(game.turn).toBe('black');
  });

  test('Resignation flow in mid-game', () => {
    game.phase = PHASES.PLAY;
    gc.resign('white');
    expect(game.phase).toBe(PHASES.GAME_OVER);
    const winnerText = document.getElementById('winner-text').textContent;
    expect(winnerText).toContain('Schwarz gewinnt');
  });
});
