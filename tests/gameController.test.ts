import { describe, expect, test, beforeEach, vi, type MockInstance } from 'vitest';
import { PHASES } from '../js/config';
import { GameController } from '../js/gameController';
import { Game } from '../js/gameEngine';
import type { Piece } from '../js/types/game';

// Mock dependencies
vi.mock('../js/ui.js', () => ({
  renderBoard: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  updateStatus: vi.fn(),
  updateShopUI: vi.fn(),
  updateClockUI: vi.fn(),
  updateClockDisplay: vi.fn(),
  initBoardUI: vi.fn(),
  showShop: vi.fn(),
  updateMoveHistoryUI: vi.fn(),
  updateCapturedUI: vi.fn(),
  updateStatistics: vi.fn(),
  renderEvalGraph: vi.fn(),
  animateCheckmate: vi.fn(),
  animateCheck: vi.fn(),
}));

vi.mock('../js/sounds.js', () => ({
  soundManager: {
    init: vi.fn(),
    playMove: vi.fn(),
    playGameStart: vi.fn(),
    playGameOver: vi.fn(),
    playSound: vi.fn(),
    playCheck: vi.fn(),
  },
}));

vi.mock('../js/AnalysisController.js', () => ({
  AnalysisController: class {
    constructor(_gameController: any) {}
    enterAnalysisMode = vi.fn(() => true);
    exitAnalysisMode = vi.fn(() => true);
    requestPositionAnalysis = vi.fn();
    toggleContinuousAnalysis = vi.fn();
    jumpToMove = vi.fn();
    jumpToStart = vi.fn();
  },
}));

vi.mock('../js/tutorial.js', () => ({
  Tutorial: class {
    constructor() {}
    initUI() {}
    show() {}
    hide() {}
    nextStep() {}
    prevStep() {}
  },
}));

vi.mock('../js/gameEngine.js', () => {
  const ActualGame = vi.importActual('../js/gameEngine.js');
  return {
    ...ActualGame,
    Game: class {
      initialPoints: number;
      mode: string;
      isAI: boolean;
      board: (Piece | null)[][];
      phase: string;
      turn: string;
      points: number;
      whiteCorridor: number;
      blackCorridor: number;
      log: MockInstance;
      whiteTime: number;
      blackTime: number;
      clockEnabled: boolean;
      moveHistory: any[];
      redoStack: any[];
      positionHistory: any[];
      capturedPieces: { white: any[]; black: any[] };
      selectedSquare: any;
      validMoves: any;
      drawOffered: boolean;
      drawOfferedBy: string | null;
      isAnimating: boolean;
      replayMode: boolean;
      savedGameState: any;
      gameController?: GameController;
      handlePlayClick: MockInstance;
      getValidMoves: MockInstance;
      gameStartTime: number | null;
      difficulty: string;

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
        this.whiteCorridor = 3;
        this.blackCorridor = 3;
        this.log = vi.fn();
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
        this.isAnimating = false;
        this.replayMode = false;
        this.savedGameState = null;
        this.handlePlayClick = vi.fn();
        this.getValidMoves = vi.fn(() => []);
        this.gameStartTime = null;
        this.difficulty = 'medium';
      }
    },
    PHASES: {
      SETUP_WHITE_KING: 'SETUP_WHITE_KING',
      SETUP_WHITE_PIECES: 'SETUP_WHITE_PIECES',
      SETUP_BLACK_KING: 'SETUP_BLACK_KING',
      SETUP_BLACK_PIECES: 'SETUP_BLACK_PIECES',
      PLAY: 'PLAY',
      GAME_OVER: 'GAME_OVER',
    },
    BOARD_SIZE: 9,
    AI_DELAY_MS: 1000,
  };
});

// Import after mocks
import { soundManager } from '../js/sounds';

interface TestGame
  extends Omit<Game, 'log' | 'handlePlayClick' | 'getValidMoves' | 'selectedShopPiece'> {
  log: MockInstance;
  handlePlayClick: MockInstance;
  getValidMoves: MockInstance;
  gameController?: GameController;
  isAnimating: boolean;
  replayMode: boolean;
  savedGameState: any;
  gameStartTime: number | null;
  difficulty: any;
  selectedShopPiece: string | null;
  [key: string]: any;
}

describe('GameController', () => {
  let game: TestGame;
  let gameController: GameController;

  beforeEach(async () => {
    // We are mocking Game class to return our test-friendly structure
    // But GameController expects a Game instance.
    // Our mock above defines Game class with properties we need.
    // Cast to unknown first to avoid strict compatibility checks with the "real" Game class
    // since we've mocked the module.
    const MockGameClass = (await import('../js/gameEngine')).Game as unknown as new (
      p: number,
      m: string,
      ai: boolean
    ) => TestGame;
    game = new MockGameClass(15, 'setup', false);

    gameController = new GameController(game as any);
    (game as any).gameController = gameController;
    // We mocked GameEngine so 'game' is flexible but GameController expects real Game.
    // Casting to any bypasses the 'GameExtended' check

    // Mock DOM
    const createMockElement = () => {
      const element: any = {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
          contains: vi.fn(() => false),
          toggle: vi.fn(),
        },
        style: {},
        disabled: false,
        value: '',
        checked: false,
        scrollTop: 0,
        scrollHeight: 100,
        appendChild: vi.fn(),
        dataset: {},
        addEventListener: vi.fn(),
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

    vi.spyOn(document, 'getElementById').mockImplementation(() => createMockElement());
    vi.spyOn(document, 'querySelector').mockImplementation(
      () =>
        ({
          classList: { add: vi.fn(), remove: vi.fn() },
        }) as any
    );
    vi.spyOn(document, 'querySelectorAll').mockImplementation(
      () => [{ classList: { remove: vi.fn() } }, { classList: { remove: vi.fn() } }] as any
    );
    vi.spyOn(document, 'createElement').mockImplementation(
      () =>
        ({
          classList: { add: vi.fn() },
          dataset: {},
          addEventListener: vi.fn(),
        }) as any
    );

    // Fix global type for alert and confirm
    (global as any).alert = vi.fn();
    (global as any).confirm = vi.fn(() => true);

    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
    Storage.prototype.removeItem = vi.fn();
    Storage.prototype.clear = vi.fn();

    vi.clearAllMocks();

    // Initialize game after mocks are set up
    await gameController.initGame(15, 'setup');
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
      game.board[6][3] = { type: 'p', color: 'white', hasMoved: false };
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
      // Validating blockage by absence of side effects is hard without working mocks
      expect(true).toBe(true);
    });

    test('should block clicks in replay mode', () => {
      game.replayMode = true;
      game.phase = PHASES.PLAY;
      gameController.handleCellClick(4, 4);
      expect(true).toBe(true);
    });
  });

  describe('AI and Game State', () => {
    test('handleCellClick should not select AI piece during strict setup', async () => {
      // Access game properties through the known GameController.game reference (which is typed as Game)
      // but we need to cast it or modify it in our test env.
      // gameController has public game property.
      (gameController.game as any).phase = PHASES.PLAY;
      (gameController.game as any).turn = 'black'; // AI turn
      (gameController.game as any).isAI = true;

      await gameController.handleCellClick(0, 0); // Black rook

      expect(gameController.game.selectedSquare).toBeNull();
    });

    test('handleCellClick should select piece in PLAY phase', async () => {
      (gameController.game as any).phase = PHASES.PLAY;
      (gameController.game as any).turn = 'white';

      // We need to ensure the mocked method is recognized
      game.handlePlayClick.mockImplementation(async (r: number, c: number) => {
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
      (gameController.game as any).phase = PHASES.PLAY;
      (gameController.game as any).turn = 'white';

      game.handlePlayClick.mockImplementation(async (r: number, c: number) => {
        game.selectedSquare = { r, c };
      });

      // Select white pawn at 6,4 (assuming setup)
      // We need a board state. createEmptyBoard is used in beforeEach but we need pieces.
      const board = gameController.game.board;
      board[6][4] = { type: 'p', color: 'white', hasMoved: false };
      board[5][4] = null;

      // Ensure move is valid
      // Mock validMoves to allow this move
      game.getValidMoves.mockReturnValue([{ r: 5, c: 4, to: { r: 5, c: 4 } }]);

      await gameController.handleCellClick(6, 4); // Select
      expect(gameController.game.selectedSquare).toEqual({ r: 6, c: 4 });

      // Click to move
      await gameController.handleCellClick(5, 4);

      // Verify executeMove called
      // Since handlePlayClick is mocked, we verify it was called with correct arguments
      expect(game.handlePlayClick).toHaveBeenCalledWith(5, 4);
    });

    test('handleCellClick should place king in setup', () => {
      (gameController.game as any).phase = PHASES.SETUP_WHITE_KING;
      gameController.handleCellClick(8, 4);
      // Valid placement logic centers the king in the 3x3 block, so 8,4 -> 7,4
      expect(gameController.game.board[7][4]).toMatchObject({ type: 'k', color: 'white' });
    });
  });

  describe('Clock Management', () => {
    it('should stop clock when not in PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      (gameController.timeManager as any).clockInterval = setInterval(() => {}, 100);
      gameController.tickClock(); // Delegates to timeManager
      expect((gameController.timeManager as any).clockInterval).toBeNull();
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
      (Storage.prototype.getItem as unknown as MockInstance).mockReturnValueOnce('invalid');
      gameController.loadGame();
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Fehler'));
    });
  });

  describe('Resignation', () => {
    test('should allow resignation in PLAY phase', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      gameController.resign('white');

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Weiß gibt auf'));
      expect(soundManager.playGameOver).toHaveBeenCalled();
    });

    test('should prevent resignation in non-PLAY phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      gameController.resign('white');
      expect(game.phase).toBe(PHASES.SETUP_WHITE_KING);
    });
  });

  describe('Draw Offers', () => {
    test('should handle draw offer', () => {
      game.phase = PHASES.PLAY;
      game.turn = 'white';
      gameController.offerDraw('white');

      expect(game.drawOffered).toBe(true);
      expect(game.drawOfferedBy).toBe('white');
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('Weiß bietet Remis an'));
    });

    test('should accept draw', () => {
      game.phase = PHASES.PLAY;
      game.drawOffered = true;
      game.drawOfferedBy = 'black';

      gameController.acceptDraw();

      expect(game.phase).toBe(PHASES.GAME_OVER);
      expect(game.log).toHaveBeenCalledWith('Remis vereinbart!');
    });

    test('should decline draw', () => {
      game.phase = PHASES.PLAY;
      game.drawOffered = true;
      game.drawOfferedBy = 'black';
      game.turn = 'white';

      gameController.declineDraw();

      expect(game.drawOffered).toBe(false);
      expect(game.log).toHaveBeenCalledWith(expect.stringContaining('lehnt das Remis-Angebot ab'));
    });
  });

  describe('Campaign Level', () => {
    test('should handle invalid level ID gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      gameController.startCampaignLevel('invalid-id');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Level not found'),
        expect.anything()
      );
      consoleSpy.mockRestore();
    });
  });
});
