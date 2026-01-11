import { jest } from '@jest/globals';

// Mock PHASES and other constants
jest.unstable_mockModule('../js/gameEngine.js', () => ({
  PHASES: {
    PLAY: 'PLAY',
    ANALYSIS: 'ANALYSIS',
    SETUP_WHITE_PIECES: 'SETUP_WHITE_PIECES',
    SETUP_BLACK_PIECES: 'SETUP_BLACK_PIECES',
  },
  BOARD_SIZE: 9,
}));

// Mock UI
jest.unstable_mockModule('../js/ui.js', () => ({
  updateCapturedUI: jest.fn(),
  updateStatus: jest.fn(),
  updateMoveHistoryUI: jest.fn(),
  updateStatistics: jest.fn(),
  renderBoard: jest.fn(),
  showShop: jest.fn(),
  updateShopUI: jest.fn(),
}));

const GameStateManager = await import('../js/move/GameStateManager.js');
const UI = await import('../js/ui.js');

describe('GameStateManager', () => {
  let game, moveController;
  let mockStore = {};

  beforeAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(key => mockStore[key] || null),
        setItem: jest.fn((key, value) => {
          mockStore[key] = value.toString();
        }),
        clear: jest.fn(() => {
          mockStore = {};
        }),
      },
      writable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};

    // DOM mocks
    document.body.innerHTML = `
            <div id="draw-offer-overlay" class="hidden"></div>
            <div id="draw-offer-message"></div>
            <div id="move-history-panel" class="hidden"></div>
            <div id="captured-pieces-panel" class="hidden"></div>
            <div id="tutor-recommendations-section" class="hidden"></div>
        `;

    game = {
      phase: 'PLAY',
      turn: 'white',
      moveHistory: [],
      board: Array(9)
        .fill(null)
        .map(() => Array(9).fill(null)),
      capturedPieces: { white: [], black: [] },
      positionHistory: [],
      stats: { totalMoves: 0 },
      log: jest.fn(),
      clockEnabled: true,
      startClock: jest.fn(),
      stopClock: jest.fn(),
      updateBestMoves: jest.fn(),
      analysisMode: false,
    };

    moveController = {
      redoStack: [],
      updateUndoRedoButtons: jest.fn(),
      updateReplayUI: jest.fn(),
    };

    global.confirm = jest.fn(() => true);

    // Mock 3D board
    window.battleChess3D = {
      enabled: true,
      updateFromGameState: jest.fn(),
    };

    // DOM mocks
    document.body.innerHTML = `
      <div id="undo-btn"></div>
      <div id="replay-status" class="hidden"></div>
      <div id="replay-exit" class="hidden"></div>
      <div id="draw-offer-overlay" class="hidden"></div>
      <div id="draw-offer-message"></div>
      <div id="move-history-panel" class="hidden"></div>
      <div id="captured-pieces-panel" class="hidden"></div>
      <div id="ai-toggle"></div>
      <div id="difficulty-select"></div>
    `;
  });

  describe('undoMove', () => {
    test('should return early if no history', () => {
      GameStateManager.undoMove(game, moveController);
      expect(game.moveHistory.length).toBe(0);
    });

    test('should undo a simple move', () => {
      game.moveHistory = [
        {
          from: { r: 8, c: 4 },
          to: { r: 6, c: 4 },
          piece: { type: 'p', color: 'white', hasMoved: false },
          capturedPiece: null,
          positionHistoryLength: 0,
          halfMoveClock: 0,
        },
      ];
      game.board[6][4] = { type: 'p', color: 'white', hasMoved: true };

      GameStateManager.undoMove(game, moveController);
      expect(game.board[8][4].type).toBe('p');
      expect(game.board[6][4]).toBeNull();
    });

    test('should restore captured piece', () => {
      game.moveHistory = [
        {
          from: { r: 8, c: 4 },
          to: { r: 6, c: 4 },
          piece: { type: 'p', color: 'white', hasMoved: true },
          captured: { type: 'p', color: 'black' },
          positionHistoryLength: 0,
          halfMoveClock: 0,
        },
      ];
      game.board[6][4] = { type: 'p', color: 'white', hasMoved: true };
      game.capturedPieces.white = [{ type: 'p', color: 'black' }];

      GameStateManager.undoMove(game, moveController);
      expect(game.board[6][4].color).toBe('black');
      expect(UI.updateCapturedUI).toHaveBeenCalled();
    });

    test('should undo en passant', () => {
      game.moveHistory = [
        {
          from: { r: 3, c: 4 },
          to: { r: 2, c: 5 },
          piece: { type: 'p', color: 'white' },
          specialMove: {
            type: 'enPassant',
            capturedPawnPos: { r: 3, c: 5 },
            capturedPawn: { color: 'black' },
          },
          positionHistoryLength: 0,
          halfMoveClock: 0,
        },
      ];
      game.board[2][5] = { type: 'p', color: 'white' };
      game.capturedPieces.white = [{ type: 'p', color: 'black' }];

      GameStateManager.undoMove(game, moveController);
      expect(game.board[3][5].color).toBe('black');
    });

    test('should undo castling', () => {
      game.moveHistory = [
        {
          from: { r: 8, c: 4 },
          to: { r: 8, c: 6 },
          piece: { type: 'k', color: 'white', hasMoved: false },
          specialMove: {
            type: 'castling',
            rookFrom: { r: 8, c: 8 },
            rookTo: { r: 8, c: 5 },
            rookHadMoved: false,
          },
          positionHistoryLength: 0,
          halfMoveClock: 0,
        },
      ];
      game.board[8][6] = { type: 'k', color: 'white', hasMoved: true };
      game.board[8][5] = { type: 'r', color: 'white', hasMoved: true };

      GameStateManager.undoMove(game, moveController);
      expect(game.board[8][4].type).toBe('k');
      expect(game.board[8][8].type).toBe('r');
      expect(game.board[8][8].hasMoved).toBe(false);
    });

    test('should undo castling with rookType', () => {
      game.moveHistory = [
        {
          from: { r: 8, c: 4 },
          to: { r: 8, c: 6 },
          piece: { type: 'k', color: 'white', hasMoved: false },
          specialMove: {
            type: 'castling',
            rookFrom: { r: 8, c: 8 },
            rookTo: { r: 8, c: 5 },
            rookHadMoved: false,
            rookType: 'c',
          },
          positionHistoryLength: 0,
          halfMoveClock: 0,
        },
      ];
      game.board[8][6] = { type: 'k', color: 'white', hasMoved: true };
      game.board[8][5] = { type: 'r', color: 'white', hasMoved: true };
      GameStateManager.undoMove(game, moveController);
      expect(game.board[8][8].type).toBe('c');
    });

    test('should pop position history until length match', () => {
      game.moveHistory = [
        {
          from: { r: 0, c: 0 },
          to: { r: 1, c: 1 },
          piece: { type: 'p', color: 'white' },
          positionHistoryLength: 1,
        },
      ];
      game.positionHistory = ['h1', 'h2', 'h3'];
      game.board[1][1] = { type: 'p', color: 'white' };
      GameStateManager.undoMove(game, moveController);
      expect(game.positionHistory.length).toBe(1);
    });

    test('should handle empty history for highlight', () => {
      game.moveHistory = [
        {
          from: { r: 8, c: 4 },
          to: { r: 6, c: 4 },
          piece: { type: 'p', color: 'white' },
          positionHistoryLength: 0,
        },
      ];
      game.board[6][4] = { type: 'p', color: 'white' };
      GameStateManager.undoMove(game, moveController);
      expect(game.lastMoveHighlight).toBeNull();
    });

    test('should set lastMoveHighlight after undo if history remains', () => {
      game.moveHistory = [
        { from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, piece: { type: 'p' } },
        {
          from: { r: 8, c: 4 },
          to: { r: 6, c: 4 },
          piece: { type: 'p' },
          positionHistoryLength: 0,
        },
      ];
      game.board[6][4] = { type: 'p', color: 'white' };
      GameStateManager.undoMove(game, moveController);
      expect(game.lastMoveHighlight).toEqual({ from: { r: 0, c: 0 }, to: { r: 1, c: 1 } });
    });

    test('should trigger analysis update if enabled', () => {
      game.moveHistory = [
        {
          from: { r: 0, c: 0 },
          to: { r: 1, c: 1 },
          piece: { type: 'p', color: 'white' },
          positionHistoryLength: 0,
        },
      ];
      game.board[1][1] = { type: 'p', color: 'white' };
      game.analysisMode = true;
      game.continuousAnalysis = true;
      game.gameController = { requestPositionAnalysis: jest.fn() };

      GameStateManager.undoMove(game, moveController);
      expect(game.gameController.requestPositionAnalysis).toHaveBeenCalled();
    });
  });

  describe('Replay Mode', () => {
    test('should manage replay mode lifecycle', () => {
      game.moveHistory = [{ from: { r: 0, c: 0 }, to: { r: 1, c: 1 }, piece: { type: 'p' } }];
      GameStateManager.enterReplayMode(game, moveController);
      expect(game.replayMode).toBe(true);

      GameStateManager.exitReplayMode(game);
      expect(game.replayMode).toBe(false);
      expect(game.startClock).toHaveBeenCalled();
    });

    test('should undo moves for replay', () => {
      const move = {
        from: { r: 1, c: 0 },
        to: { r: 0, c: 0 },
        piece: { type: 'p', color: 'white', hasMoved: true },
        specialMove: { type: 'promotion' },
      };
      game.board[0][0] = { type: 'q', color: 'white' };
      GameStateManager.undoMoveForReplay(game, move);
      expect(game.board[1][0].type).toBe('p');
    });

    test('should undo castling for replay', () => {
      const move = {
        from: { r: 8, c: 4 },
        to: { r: 8, c: 6 },
        piece: { type: 'k', color: 'white' },
        specialMove: {
          type: 'castling',
          rookFrom: { r: 8, c: 8 },
          rookTo: { r: 8, c: 5 },
        },
      };
      game.board[8][6] = { type: 'k', color: 'white' };
      game.board[8][5] = { type: 'r', color: 'white' };
      GameStateManager.undoMoveForReplay(game, move);
      expect(game.board[8][8].type).toBe('r');
    });

    test('should undo en passant for replay', () => {
      const move = {
        from: { r: 3, c: 4 },
        to: { r: 2, c: 5 },
        piece: { type: 'p', color: 'white' },
        specialMove: {
          type: 'enPassant',
          capturedPawnPos: { r: 3, c: 5 },
          capturedPawn: { color: 'black' },
        },
      };
      game.board[2][5] = { type: 'p', color: 'white' };
      GameStateManager.undoMoveForReplay(game, move);
      expect(game.board[3][5].type).toBe('p');
    });

    test('reconstructBoardAtMove with savedGameState', () => {
      game.savedGameState = {
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };
      game.moveHistory = [
        { from: { r: 0, c: 0 }, to: { r: 1, c: 0 }, piece: { type: 'p' } },
        { from: { r: 1, c: 0 }, to: { r: 2, c: 0 }, piece: { type: 'p' } },
      ];
      GameStateManager.reconstructBoardAtMove(game, 0);
      expect(game.lastMoveHighlight.from.r).toBe(0);
    });

    test('reconstructBoardAtMove with negative index', () => {
      game.moveHistory = [{ from: { r: 0, c: 0 }, to: { r: 1, c: 0 }, piece: { type: 'p' } }];
      GameStateManager.reconstructBoardAtMove(game, -1);
      expect(game.lastMoveHighlight).toBeNull();
    });
  });

  describe('Save/Load', () => {
    test('should save and load', () => {
      game.points = 20;
      GameStateManager.saveGame(game);

      const newGame = { ...game, log: jest.fn() };
      GameStateManager.loadGame(newGame);
      expect(newGame.points).toBe(20);
    });

    test('should load with draw offer', () => {
      const state = {
        phase: 'PLAY',
        drawOffered: true,
        drawOfferedBy: 'black',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };
      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(state));

      GameStateManager.loadGame(game);
      expect(game.drawOffered).toBe(true);
      expect(document.getElementById('draw-offer-overlay').classList.contains('hidden')).toBe(
        false
      );
      expect(document.getElementById('draw-offer-message').textContent).toContain(
        'Schwarz bietet Remis an'
      );
    });

    test('should load with white draw offer', () => {
      const state = {
        phase: 'PLAY',
        drawOffered: true,
        drawOfferedBy: 'white',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };
      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(state));

      GameStateManager.loadGame(game);
      expect(document.getElementById('draw-offer-message').textContent).toContain(
        'Weiß bietet Remis an'
      );
    });

    test('should load in play phase and update UI', () => {
      const state = {
        phase: 'PLAY',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };
      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(state));
      game.updateBestMoves = jest.fn();

      GameStateManager.loadGame(game);
      expect(document.getElementById('move-history-panel').classList.contains('hidden')).toBe(
        false
      );
      expect(game.updateBestMoves).toHaveBeenCalled();
    });

    test('should return false if no save found', () => {
      expect(GameStateManager.loadGame(game)).toBe(false);
    });

    test('should handle load error', () => {
      localStorage.setItem('schach9x9_save_autosave', 'invalid json');
      // Silence console.error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(GameStateManager.loadGame(game)).toBe(false);
      console.error.mockRestore();
    });

    test('should handle load in setup phase', () => {
      const state = {
        phase: 'SETUP_WHITE_PIECES',
        board: Array(9)
          .fill(null)
          .map(() => Array(9).fill(null)),
      };
      localStorage.setItem('schach9x9_save_autosave', JSON.stringify(state));

      GameStateManager.loadGame(game);
      expect(UI.showShop).toHaveBeenCalledWith(game, true);
    });
  });
});
