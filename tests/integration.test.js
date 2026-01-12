
import { Game } from '../js/gameEngine.js';
import { PHASES } from '../js/config.js';

// Mock dependencies
vi.mock('../js/ui.js', () => ({
  initBoardUI: vi.fn(),
  renderBoard: vi.fn(),
  showModal: vi.fn((title, message, buttons) => {
    const continueBtn = buttons.find(b => b.text === 'Fortfahren' || b.class === 'btn-primary');
    if (continueBtn && continueBtn.callback) {
      continueBtn.callback();
    }
  }),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  updateStatistics: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  showShop: vi.fn(),
  showPromotionUI: vi.fn(),
  showToast: vi.fn(),
  animateMove: vi.fn().mockResolvedValue(),
  animateCheck: vi.fn(),
  addMoveToHistory: vi.fn(),
  renderEvalGraph: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playMove: vi.fn(),
    playCapture: vi.fn(),
    playCheck: vi.fn(),
    playCheckmate: vi.fn(),
    playGameStart: vi.fn(),
    playGameOver: vi.fn(),
  },
}));

const { GameController } = await import('../js/gameController.js');
const { MoveController } = await import('../js/moveController.js');

describe('Integration Tests', () => {
  let game;
  let gameController;
  let moveController;

  beforeEach(() => {
    // Mock DOM elements
    global.document.getElementById = vi.fn(() => ({
      textContent: '',
      innerHTML: '',
      classList: { add: vi.fn(), remove: vi.fn() },
      style: {},
      disabled: false,
      appendChild: vi.fn(),
      value: '',
      checked: false,
      scrollTop: 0,
      scrollHeight: 100,
      addEventListener: vi.fn(),
    }));

    global.document.querySelector = vi.fn(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
      innerHTML: '',
      parentElement: {
        querySelector: vi.fn(() => ({ offsetWidth: 50 })),
      },
    }));

    global.document.querySelectorAll = vi.fn(() => []);
    global.document.createElement = vi.fn(() => ({
      classList: { add: vi.fn(), remove: vi.fn() },
      dataset: {},
      addEventListener: vi.fn(),
      appendChild: vi.fn(),
      innerHTML: '',
      style: {},
    }));

    // Mock window.confirm
    global.confirm = vi.fn(() => true);
    global.alert = vi.fn();

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

    // Initialize Game and Controllers
    game = new Game(15, 'setup');
    gameController = new GameController(game);
    moveController = new MoveController(game);

    game.gameController = gameController;
    game.moveController = moveController;

    // Initialize strategy
    gameController.initGame(15, 'setup');

    // Mock AI Engine if needed
    game.aiEngine = {
      makeMove: vi.fn(),
    };
  });

  describe('Full Game Setup Flow', () => {
    test('should complete full setup: white king → black king → pieces → play', async () => {
      // Phase 1: White King Placement
      expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);

      // Place white king in middle corridor
      gameController.placeKing(7, 4, 'white');
      expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
      expect(game.whiteCorridor).toBeDefined();

      // Phase 2: Black King Placement
      gameController.placeKing(1, 4, 'black');
      expect(game.phase).toBe(PHASES.SETUP_WHITE_PIECES);
      expect(game.blackCorridor).toBeDefined();

      // Phase 3: White Piece Setup
      gameController.selectShopPiece('p');
      gameController.placeShopPiece(6, 3);
      gameController.selectShopPiece('r');
      gameController.placeShopPiece(8, 3);
      gameController.finishSetupPhase();
      expect(game.phase).toBe(PHASES.SETUP_WHITE_UPGRADES);

      // Skip white upgrades and proceed to black setup
      gameController.finishSetupPhase();
      expect(game.phase).toBe(PHASES.SETUP_BLACK_PIECES);

      // Phase 4: Black Piece Setup
      gameController.selectShopPiece('p');
      gameController.placeShopPiece(2, 3);
      gameController.selectShopPiece('r');
      gameController.placeShopPiece(0, 3);
      gameController.finishSetupPhase();
      expect(game.phase).toBe(PHASES.SETUP_BLACK_UPGRADES);

      // Skip black upgrades (AI might do this automatically but we'll call it for consistency if needed)
      gameController.finishSetupPhase();

      // Should now be in PLAY phase
      expect(game.phase).toBe(PHASES.PLAY);
      expect(game.turn).toBe('white');
    });

    test('should handle classic mode initialization', () => {
      // Re-init with classic mode
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      moveController = new MoveController(game);
      game.gameController = gameController;
      game.moveController = moveController;

      // Classic mode should skip setup and go straight to PLAY
      // Note: Game constructor sets phase to PLAY for classic,
      // but GameController constructor handles initialization logic
      expect(game.phase).toBe(PHASES.PLAY);
      expect(game.board[8][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
      expect(game.board[0][4]).toEqual({ type: 'k', color: 'black', hasMoved: false });
    });
  });

  describe('Save/Load Round Trip', () => {
    test('should save and load game state correctly', async () => {
      // Setup classic game
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      moveController = new MoveController(game);
      game.gameController = gameController;
      game.moveController = moveController;

      // Make some moves
      const from = { r: 7, c: 4 }; // Pawn at 7,4
      const to = { r: 6, c: 4 }; // Move to 6,4
      await moveController.executeMove(from, to);

      // Save game
      gameController.saveGame();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'schach9x9_save_autosave',
        expect.any(String)
      );

      // Get saved data
      const savedData = localStorage.setItem.mock.calls[0][1];
      const parsedData = JSON.parse(savedData);

      // Verify save structure
      expect(parsedData).toHaveProperty('board');
      expect(parsedData).toHaveProperty('turn');
      expect(parsedData).toHaveProperty('phase');

      // Create new game and load
      const newGame = new Game(15, 'classic');
      const newGameController = new GameController(newGame);
      const newMoveController = new MoveController(newGame);
      newGame.gameController = newGameController;
      newGame.moveController = newMoveController;

      localStorage.getItem.mockReturnValue(savedData);
      newGameController.loadGame();

      // Verify loaded state matches
      expect(newGame.turn).toBe(game.turn);
      // Note: moveHistory might be handled differently in save/load depending on implementation
      // gameController.saveGame saves 'history' property, moveController uses 'moveHistory'
      // Let's check if board state is restored
      expect(newGame.board[6][4]).toEqual(expect.objectContaining({ type: 'p', color: 'white' }));
    });
  });

  describe('Move Execution and Undo', () => {
    test('should execute move → undo → redo correctly', async () => {
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      moveController = new MoveController(game);
      game.gameController = gameController;
      game.moveController = moveController;

      const from = { r: 7, c: 4 }; // Pawn at 7,4
      const to = { r: 6, c: 4 }; // Move to 6,4

      // Execute move
      await moveController.executeMove(from, to);
      expect(game.moveHistory).toHaveLength(1);
      expect(game.board[6][4].type).toBe('p');
      expect(game.board[7][4]).toBeNull();

      // Undo move
      moveController.undoMove();
      expect(game.moveHistory).toHaveLength(0);
      expect(game.board[7][4].type).toBe('p');
      expect(game.board[6][4]).toBeNull();

      // Redo move
      await moveController.redoMove();
      expect(game.moveHistory).toHaveLength(1);
      expect(game.board[6][4].type).toBe('p');
    });
  });

  describe('Game End Scenarios', () => {
    test('should handle resignation', () => {
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      game.gameController = gameController;
      game.phase = PHASES.PLAY;

      gameController.resign('white');

      expect(game.phase).toBe(PHASES.GAME_OVER);
      // Resignation doesn't set game.winner property directly in Game object usually,
      // but updates UI and logs. We check phase.
    });

    test('should handle draw offer and acceptance', () => {
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      game.gameController = gameController;
      game.phase = PHASES.PLAY;

      gameController.offerDraw('white');
      expect(game.drawOffered).toBe(true);
      expect(game.drawOfferedBy).toBe('white');

      gameController.acceptDraw();
      expect(game.phase).toBe(PHASES.GAME_OVER);
    });
  });

  describe('Time Control Integration', () => {
    test('should handle time running out', () => {
      game = new Game(15, 'classic');
      gameController = new GameController(game);
      game.gameController = gameController;

      gameController.setTimeControl('blitz3');
      game.clockEnabled = true;
      game.phase = PHASES.PLAY;

      // Simulate white time running out
      game.whiteTime = 0;
      gameController.tickClock();

      expect(game.phase).toBe(PHASES.GAME_OVER);
    });
  });

  describe('AI Integration', () => {
    test('should handle AI game setup', () => {
      game = new Game(15, 'setup');
      gameController = new GameController(game);
      game.gameController = gameController;

      game.isAI = true;

      // White (human) places king
      gameController.placeKing(7, 4, 'white');

      // AI setup is async (setTimeout), so we need to wait or use fake timers
      // But placeKing sets phase to SETUP_BLACK_KING immediately
      expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
    });
  });
});
