import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Game, createEmptyBoard } from '../js/gameEngine.js';

// Mock UI and SoundManager modules
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  showPromotionModal: vi.fn(),
  showPromotionUI: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(undefined),
  animateCheck: vi.fn(),
  animateCheckmate: vi.fn(),
  updateStatistics: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatus: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateClockUI: vi.fn(),
  showShop: vi.fn(),
  updateShopUI: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playCheckmate: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

// Mock document functions used in MoveController
(global as any).document = {
  getElementById: vi.fn(
    () =>
      ({
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        appendChild: vi.fn(),
        scrollTop: 0,
        scrollHeight: 100,
        innerHTML: '',
      }) as any
  ),
} as any;

// Mock localStorage with proper jest functions
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as any;

// Mock alert
global.alert = vi.fn();

// Import MoveController AFTER mocking
const { MoveController } = await import('../js/moveController.js');

describe('Bug Reproduction: Rook transforming into King', () => {
  let game: any;
  let moveController: any;

  beforeEach(() => {
    game = new Game(15, 'classic'); // Use Classic Mode
    // Ensure board is set up for classic mode
    // Game constructor calls setupClassicBoard if mode is classic

    moveController = new MoveController(game as any);
    game.moveController = moveController;
    game.log = vi.fn();
    game.stopClock = vi.fn();
    game.startClock = vi.fn();
    game.updateBestMoves = vi.fn();

    vi.clearAllMocks();
  });

  test('should correctly undo kingside castling without transforming rook', async () => {
    // Clear board to set up specific castling scenario
    game.board = createEmptyBoard();

    // Place Black King to avoid game over
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    // White King at e1 (8, 4)
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    // White Rook at i1 (8, 8)
    game.board[8][8] = { type: 'r', color: 'white', hasMoved: false };

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 6 }; // Kingside castle

    // Execute castling
    await moveController.executeMove(from, to);

    // Verify castling happened
    expect(game.board[8][6].type).toBe('k'); // King moved
    expect(game.board[8][5].type).toBe('r'); // Rook moved
    expect(game.board[8][4]).toBeNull();
    expect(game.board[8][8]).toBeNull();

    // Undo castling
    moveController.undoMove();

    // Verify restoration
    expect(game.board[8][4]).not.toBeNull();
    expect(game.board[8][4].type).toBe('k'); // King back

    expect(game.board[8][8]).not.toBeNull();
    expect(game.board[8][8].type).toBe('r'); // Rook back - THIS IS THE CRITICAL CHECK

    expect(game.board[8][6]).toBeNull();
    expect(game.board[8][5]).toBeNull();
  });

  test('should correctly undo queenside castling without transforming rook', async () => {
    // Clear board
    game.board = createEmptyBoard();

    // Place Black King to avoid game over
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };

    // White King at e1 (8, 4)
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };
    // White Rook at a1 (8, 0)
    game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

    const from = { r: 8, c: 4 };
    const to = { r: 8, c: 2 }; // Queenside castle

    // Execute castling
    await moveController.executeMove(from, to);

    // Verify castling happened
    expect(game.board[8][2].type).toBe('k'); // King moved
    expect(game.board[8][3].type).toBe('r'); // Rook moved

    // Undo castling
    moveController.undoMove();

    // Verify restoration
    expect(game.board[8][4].type).toBe('k'); // King back
    expect(game.board[8][0].type).toBe('r'); // Rook back - CRITICAL CHECK
  });

  test('should correctly undo normal rook move', async () => {
    // Clear board
    game.board = createEmptyBoard();

    // Place Kings to avoid game over
    game.board[0][4] = { type: 'k', color: 'black', hasMoved: false };
    game.board[8][4] = { type: 'k', color: 'white', hasMoved: false };

    // White Rook at a1 (8, 0)
    game.board[8][0] = { type: 'r', color: 'white', hasMoved: false };

    const from = { r: 8, c: 0 };
    const to = { r: 7, c: 0 };

    // Execute move
    await moveController.executeMove(from, to);

    expect(game.board[7][0].type).toBe('r');

    // Undo move
    moveController.undoMove();

    expect(game.board[8][0].type).toBe('r');
    expect(game.board[7][0]).toBeNull();
  });
});
