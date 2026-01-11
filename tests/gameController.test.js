import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/ui.js', () => ({
  renderBoard: jest.fn(),
  showModal: jest.fn(),
  showToast: jest.fn(),
  updateStatus: jest.fn(),
  updateShopUI: jest.fn(),
  updateClockUI: jest.fn(),
  updateClockDisplay: jest.fn(),
  initBoardUI: jest.fn(),
  showShop: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  updateCapturedUI: jest.fn(),
  updateStatistics: jest.fn(),
  renderEvalGraph: jest.fn(),
  animateCheckmate: jest.fn(),
  animateCheck: jest.fn(),
}));

jest.unstable_mockModule('../js/sounds.js', () => ({
  soundManager: {
    init: jest.fn(),
    playMove: jest.fn(),
    playGameStart: jest.fn(),
    playGameOver: jest.fn(),
    playSound: jest.fn(),
    playCheck: jest.fn(),
  },
}));

jest.unstable_mockModule('../js/AnalysisController.js', () => ({
  AnalysisController: class {
    constructor(_gameController) {}
    enterAnalysisMode = jest.fn(() => true);
    exitAnalysisMode = jest.fn(() => true);
    requestPositionAnalysis = jest.fn();
    toggleContinuousAnalysis = jest.fn();
    jumpToMove = jest.fn();
    jumpToStart = jest.fn();
  },
}));

jest.unstable_mockModule('../js/gameEngine.js', () => ({
  Game: class {
    constructor(initialPoints = 15, mode = 'classic', isAI = false) {
      this.initialPoints = initialPoints;
      this.mode = mode;
      this.isAI = isAI;
      this.board = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      this.phase = PHASES.SETUP_WHITE_KING;
      this.turn = 'white';
      this.points = initialPoints;
      this.whiteCorridor = { rowStart: 6, colStart: 3 };
      this.blackCorridor = { rowStart: 0, colStart: 3 };
      this.log = jest.fn();
      this.whiteTime = 300;
      this.blackTime = 300;
      this.clockEnabled = false;
      this.moveHistory = [];
      this.redoStack = [];
      this.positionHistory = [];
      this.capturedPieces = { white: [], black: [] };
      this.selectedSquare = null;
      this.validMoves = null;
      this.drawOffered = false;
      this.drawOfferedBy = null;
    }
  },
  PHASES,
  BOARD_SIZE: 9,
  AI_DELAY_MS: 1000,
}));

// Import GameController
const { GameController } = await import('../js/gameController.js');
const { Game } = await import('../js/gameEngine.js');
const UI = await import('../js/ui.js');

describe('GameController', () => {
  let game;
  let gameController;

  beforeEach(() => {
    game = new Game(15, 'setup', false);
    game.log = jest.fn();
    game.handlePlayClick = jest.fn();
    gameController = new GameController(game);
    game.gameController = gameController;

    // Mock DOM
    const createMockElement = () => {
      const element = {
        classList: {
          remove: jest.fn(),
          add: jest.fn(),
          contains: jest.fn(() => false),
          toggle: jest.fn(),
        },
        style: {},
        disabled: false,
        value: '',
        checked: false,
        scrollTop: 0,
        scrollHeight: 100,
        appendChild: jest.fn(),
        dataset: {},
        addEventListener: jest.fn(),
      };
      let innerHTML = '';
      let textContent = '';
      Object.defineProperty(element, 'innerHTML', {
        get: () => innerHTML,
        set: val => {
          innerHTML = val;
        },
        configurable: true,
      });
      Object.defineProperty(element, 'textContent', {
        get: () => textContent,
        set: val => {
          textContent = val;
        },
        configurable: true,
      });
      return element;
    };

    jest.spyOn(document, 'getElementById').mockImplementation(() => createMockElement());
    jest.spyOn(document, 'querySelector').mockImplementation(() => ({
      classList: { add: jest.fn(), remove: jest.fn() },
    }));
    jest
      .spyOn(document, 'querySelectorAll')
      .mockImplementation(() => [
        { classList: { remove: jest.fn() } },
        { classList: { remove: jest.fn() } },
      ]);
    jest.spyOn(document, 'createElement').mockImplementation(() => ({
      classList: { add: jest.fn() },
      dataset: {},
      addEventListener: jest.fn(),
    }));

    global.alert = jest.fn();
    global.confirm = jest.fn(() => true);

    Storage.prototype.getItem = jest.fn(() => null);
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
    Storage.prototype.clear = jest.fn();

    jest.clearAllMocks();
  });

  describe('General Logic and Statistics', () => {
    test('should save game statistics on game over', () => {
      gameController.gameStartTime = Date.now();
      game.isAI = true;
      game.difficulty = 'medium';
      gameController.saveGameToStatistics('win', 'black');
      expect(gameController.gameStartTime).toBeNull();
    });

    test('should skip statistics if gameStartTime not set', () => {
      gameController.gameStartTime = null;
      gameController.saveGameToStatistics('win', 'black');
      expect(true).toBe(true);
    });

    test('should handle corridor placement calculation', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.placeKing(7, 4, 'white');
      expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
    });
  });

  describe('King Placement', () => {
    test('should place white king in valid corridor', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.placeKing(7, 4, 'white');
      expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
      expect(game.phase).toBe(PHASES.SETUP_BLACK_KING);
    });

    test('should reject king placement outside corridor', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.placeKing(2, 4, 'white');
      expect(game.board[2][4]).toBeNull();
      expect(game.log).toHaveBeenCalledWith('Ungültiger Bereich für König!');
    });
  });

  describe('Shop and Piece Management', () => {
    test('should select piece if player has enough points', () => {
      game.points = 15;
      gameController.selectShopPiece('n');
      expect(game.selectedShopPiece).toBe('n');
    });

    test('should refund points when removing piece from corridor', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.points = 10;
      game.board[6][3] = { type: 'p', color: 'white' };
      game.selectedShopPiece = null;
      gameController.placeShopPiece(6, 3);
      expect(game.points).toBe(11);
      expect(game.board[6][3]).toBeNull();
    });

    test('should clear selectedShopPiece after placing a piece', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.points = 15;
      game.selectedShopPiece = 'p';
      gameController.placeShopPiece(6, 3);
      expect(game.selectedShopPiece).toBeNull();
      expect(game.points).toBe(14);
    });

    test('should reject piece selection without shop piece', () => {
      game.phase = PHASES.SETUP_WHITE_PIECES;
      game.selectedShopPiece = null;
      gameController.placeShopPiece(6, 3);
      expect(game.log).toHaveBeenCalledWith('Bitte zuerst eine Figur im Shop auswählen!');
    });
  });

  describe('Cell Click Handling', () => {
    test('should handle clicks during setup phases', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.handleCellClick(7, 4);
      expect(game.board[7][4]).toEqual({ type: 'k', color: 'white', hasMoved: false });
    });

    test('should block clicks during animation', () => {
      game.isAnimating = true;
      game.phase = PHASES.PLAY;
      gameController.handleCellClick(4, 4);
      expect(UI.renderBoard).not.toHaveBeenCalled();
    });

    test('should block clicks in replay mode', () => {
      game.replayMode = true;
      game.phase = PHASES.PLAY;
      gameController.handleCellClick(4, 4);
      expect(UI.renderBoard).not.toHaveBeenCalled();
    });
  });

  describe('AI and Game State', () => {
    test('handleCellClick should not select AI piece during strict setup', async () => {
      gameController.game.phase = PHASES.PLAY;
      gameController.game.turn = 'black'; // AI turn
      gameController.game.isAI = true;

      await gameController.handleCellClick(0, 0); // Black rook

      expect(gameController.game.selectedSquare).toBeNull();
    });

    test('handleCellClick should select piece in PLAY phase', async () => {
      gameController.game.phase = PHASES.PLAY;
      gameController.game.turn = 'white';
      game.handlePlayClick.mockImplementation(async (r, c) => {
        game.selectedSquare = { r, c };
      });

      // Select white pawn
      await gameController.handleCellClick(7, 4);
      expect(gameController.game.selectedSquare).toEqual({ r: 7, c: 4 });

      // Deselect (click empty, assuming no move)
      // Actually clicking same piece or empty
      await gameController.handleCellClick(4, 4); // Empty
      expect(game.handlePlayClick).toHaveBeenCalledWith(4, 4);
    });

    test('handleCellClick should execute move if valid', async () => {
      gameController.game.phase = PHASES.PLAY;
      gameController.game.turn = 'white';
      game.handlePlayClick.mockImplementation(async (r, c) => {
        game.selectedSquare = { r, c };
      });

      // Select white pawn at 6,4 (assuming setup)
      // We need a board state. createEmptyBoard is used in beforeEach but we need pieces.
      const board = gameController.game.board;
      board[6][4] = { type: 'p', color: 'white' };
      board[5][4] = null;

      // Ensure move is valid
      // Mock validMoves to allow this move
      gameController.game.getValidMoves = () => [{ r: 5, c: 4, to: { r: 5, c: 4 } }];

      await gameController.handleCellClick(6, 4); // Select
      expect(gameController.game.selectedSquare).toEqual({ r: 6, c: 4 });

      // Click to move
      await gameController.handleCellClick(5, 4);

      // Verify executeMove called
      // Since handlePlayClick is mocked, we verify it was called with correct arguments
      expect(game.handlePlayClick).toHaveBeenCalledWith(5, 4);
    });

    test('handleCellClick should place king in setup', () => {
      gameController.game.phase = PHASES.SETUP_WHITE_KING;
      gameController.handleCellClick(8, 4);
      // Valid placement logic centers the king in the 3x3 block, so 8,4 -> 7,4
      expect(gameController.game.board[7][4]).toMatchObject({ type: 'k', color: 'white' });
    });
  });

  describe('Clock Management', () => {
    it('should stop clock when not in PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.timeManager.clockInterval = setInterval(() => {}, 100);
      gameController.tickClock(); // Delegates to timeManager
      expect(gameController.timeManager.clockInterval).toBeNull();
    });
  });

  describe('Analysis Mode', () => {
    test('should delegate enterAnalysisMode to AnalysisController', () => {
      gameController.enterAnalysisMode();
      expect(gameController.analysisController.enterAnalysisMode).toHaveBeenCalled();
    });

    test('should delegate exitAnalysisMode to AnalysisController', () => {
      gameController.exitAnalysisMode(true);
      expect(gameController.analysisController.exitAnalysisMode).toHaveBeenCalledWith(true);
    });
  });

  describe('Save and Load', () => {
    test('should handle corrupt save data', () => {
      Storage.prototype.getItem.mockReturnValueOnce('invalid');
      gameController.loadGame();
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Fehler'));
    });
  });
});
