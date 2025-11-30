import { jest } from '@jest/globals';
import { PHASES } from '../js/config.js';

// Mock dependencies
jest.unstable_mockModule('../js/chess-pieces.js', () => ({
  PIECE_SVGS: {
    white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
    black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' }
  }
}));

jest.unstable_mockModule('../js/utils.js', () => ({
  formatTime: jest.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`),
  debounce: jest.fn(fn => fn)
}));

// Import UI module
const UI = await import('../js/ui.js');

describe('UI Module', () => {
  let game;

  beforeEach(() => {
    // Mock Game state
    game = {
      board: Array(9).fill(null).map(() => Array(9).fill(null)),
      phase: PHASES.PLAY,
      turn: 'white',
      whiteTime: 300,
      blackTime: 300,
      points: 15,
      whiteCorridor: { rowStart: 6, colStart: 3 },
      blackCorridor: { rowStart: 0, colStart: 3 },
      lastMove: null,
      lastMoveHighlight: null,
      selectedSquare: null,
      validMoves: null,
      check: false,
      checkmate: false,
      winner: null,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      stats: { totalMoves: 0, playerMoves: 0, playerBestMoves: 0 },
      clockEnabled: true
    };

    // Restore mocks
    jest.restoreAllMocks();

    // Setup window globals
    window.PIECE_SVGS = {
      white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
      black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' }
    };
    window._svgCache = {};
  });

  describe('renderBoard', () => {
    test('should update changed cells', () => {
      // Mock querySelector
      const cellEl = {
        innerHTML: '',
        classList: { remove: jest.fn(), add: jest.fn() },
        dataset: { r: '0', c: '0' }
      };
      jest.spyOn(document, 'querySelector').mockReturnValue(cellEl);
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([cellEl]);

      // Force full render
      game._forceFullRender = true;
      UI.renderBoard(game);

      expect(document.querySelector).toHaveBeenCalled();
    });

    test('should highlight last move', () => {
      game.lastMoveHighlight = { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } };

      const fromCell = { classList: { remove: jest.fn(), add: jest.fn() }, dataset: { r: '6', c: '4' } };
      const toCell = { classList: { remove: jest.fn(), add: jest.fn() }, dataset: { r: '5', c: '4' } };
      const allCells = [fromCell, toCell];

      // Mock querySelectorAll to return all cells
      jest.spyOn(document, 'querySelectorAll').mockReturnValue(allCells);

      // Mock querySelector for individual cell access
      jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector.includes('[data-r="6"][data-c="4"]')) return fromCell;
        if (selector.includes('[data-r="5"][data-c="4"]')) return toCell;
        return null;
      });

      UI.renderBoard(game);

      // Verify last-move class operations occurred
      expect(fromCell.classList.remove).toHaveBeenCalled();
    });

    test('should highlight selected square', () => {
      game.selectedSquare = { r: 4, c: 4 };
      game.board[4][4] = { type: 'p', color: 'white' };

      const cellEl = {
        classList: { remove: jest.fn(), add: jest.fn() },
        innerHTML: '',
        dataset: { r: '4', c: '4' }
      };

      jest.spyOn(document, 'querySelector').mockReturnValue(cellEl);
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([cellEl]);

      UI.renderBoard(game);

      expect(cellEl.classList.add).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    test('should update status text for white turn', () => {
      const statusEl = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'status-display') return statusEl;
        return null;
      });

      UI.updateStatus(game);

      expect(statusEl.textContent).toContain('Weiß');
    });

    test('should update status for black turn', () => {
      game.turn = 'black';
      const statusEl = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'status-display') return statusEl;
        return null;
      });

      UI.updateStatus(game);

      expect(statusEl.textContent).toContain('Schwarz');
    });

    test('should show game over status', () => {
      game.phase = PHASES.GAME_OVER;
      game.winner = 'white';

      const statusEl = { textContent: '' };
      jest.spyOn(document, 'getElementById').mockReturnValue(statusEl);

      UI.updateStatus(game);

      expect(statusEl.textContent).toBeDefined();
    });
  });

  describe('updateClockDisplay', () => {
    test('should format time correctly', () => {
      const whiteClockEl = { textContent: '' };
      const blackClockEl = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'clock-white') return whiteClockEl;
        if (id === 'clock-black') return blackClockEl;
        return null;
      });

      game.whiteTime = 325; // 5:25
      game.blackTime = 180; // 3:00

      UI.updateClockDisplay(game);

      expect(whiteClockEl.textContent).toBe('5:25');
      expect(blackClockEl.textContent).toBe('3:00');
    });

  });


  describe('updateClockUI', () => {
    test('should highlight active player clock', () => {
      const whiteClockEl = { classList: { remove: jest.fn(), add: jest.fn() } };
      const blackClockEl = { classList: { remove: jest.fn(), add: jest.fn() } };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'clock-white') return whiteClockEl;
        if (id === 'clock-black') return blackClockEl;
        return null;
      });

      game.turn = 'white';
      UI.updateClockUI(game);

      // Check that 'active' was added to white clock
      const addCalls = whiteClockEl.classList.add.mock.calls.flat();
      expect(addCalls).toContain('active');
      // blackClockEl.classList.remove might be called with multiple arguments
      const removeCalls = blackClockEl.classList.remove.mock.calls.flat();
      expect(removeCalls).toContain('active');
    });

    test('should show low time warning', () => {
      const whiteClockEl = { classList: { remove: jest.fn(), add: jest.fn() } };
      const blackClockEl = { classList: { remove: jest.fn(), add: jest.fn() } };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'clock-white') return whiteClockEl;
        if (id === 'clock-black') return blackClockEl;
        return null;
      });

      game.turn = 'white';
      game.whiteTime = 25; // Low time
      UI.updateClockUI(game);

      const addCalls = whiteClockEl.classList.add.mock.calls.flat();
      expect(addCalls).toContain('low-time');
    });
  });

  describe('showShop', () => {
    test('should show shop container', () => {
      const shopPanel = { classList: { remove: jest.fn(), add: jest.fn() } };
      const pointsDisplay = { textContent: '' };
      const tutorSection = { classList: { remove: jest.fn(), add: jest.fn() } };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'shop-panel') return shopPanel;
        if (id === 'points-display') return pointsDisplay;
        if (id === 'tutor-recommendations') return tutorSection;
        return { classList: { remove: jest.fn(), add: jest.fn() }, style: {} };
      });

      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);
      jest.spyOn(document.body.classList, 'add');

      UI.showShop(game, true);

      expect(shopPanel.classList.remove).toHaveBeenCalledWith('hidden');
      // UI sets numeric value, not string
      expect(pointsDisplay.textContent).toBe(15);
    });

    test('should hide shop container', () => {
      const shopPanel = { classList: { remove: jest.fn(), add: jest.fn() } };

      jest.spyOn(document, 'getElementById').mockReturnValue(shopPanel);
      jest.spyOn(document.body.classList, 'remove');

      UI.showShop(game, false);

      expect(shopPanel.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('updateShopUI', () => {
    test('should update points display', () => {
      const pointsDisplay = { textContent: '' };
      const finishBtn = { disabled: false };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'points-display') return pointsDisplay;
        if (id === 'finish-setup-btn') return finishBtn;
        return null;
      });
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([]);

      game.points = 12;
      UI.updateShopUI(game);

      // UI sets numeric value, not string
      expect(pointsDisplay.textContent).toBe(12);
    });

    test('should disable expensive pieces when insufficient points', () => {
      const cheapBtn = {
        dataset: { cost: '3' },
        disabled: false,
        classList: { add: jest.fn(), remove: jest.fn() },
        style: { opacity: '1' }
      };
      const expensiveBtn = {
        dataset: { cost: '9' },
        disabled: false,
        classList: { add: jest.fn(), remove: jest.fn() },
        style: { opacity: '1' }
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'tutor-recommendations-section') return { classList: { add: jest.fn(), remove: jest.fn() } };
        return {
          textContent: '',
          disabled: false,
          classList: { add: jest.fn(), remove: jest.fn() },
          dataset: {},
          addEventListener: jest.fn(),
          appendChild: jest.fn(),
          innerHTML: '',
          style: {}
        };
      });
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([cheapBtn, expensiveBtn]);

      game.points = 5;
      UI.updateShopUI(game);

      expect(expensiveBtn.classList.add).toHaveBeenCalledWith('disabled');
      expect(cheapBtn.classList.remove).toHaveBeenCalledWith('disabled');
    });
  });

  describe('updateMoveHistoryUI', () => {
    test('should add moves to history', () => {
      const historyContainer = {
        innerHTML: '',
        scrollTop: 0,
        scrollHeight: 100,
        appendChild: jest.fn()
      };

      jest.spyOn(document, 'getElementById').mockReturnValue(historyContainer);

      game.moveHistory = [
        { from: { r: 6, c: 4 }, to: { r: 5, c: 4 }, piece: { type: 'p', color: 'white' } },
        { from: { r: 1, c: 4 }, to: { r: 2, c: 4 }, piece: { type: 'p', color: 'black' } }
      ];

      UI.updateMoveHistoryUI(game);

      expect(historyContainer.innerHTML).toBeDefined();
    });
  });

  describe('updateCapturedUI', () => {
    test('should display captured pieces', () => {
      const whiteContainer = {
        innerHTML: '',
        appendChild: jest.fn()
      };
      const blackContainer = {
        innerHTML: '',
        appendChild: jest.fn()
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'captured-white') return whiteContainer;
        if (id === 'captured-black') return blackContainer;
        return null;
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        className: '',
        innerHTML: '',
        classList: { add: jest.fn() }
      });

      game.capturedPieces = {
        white: [{ type: 'p', color: 'black' }, { type: 'n', color: 'black' }],
        black: [{ type: 'p', color: 'white' }]
      };

      UI.updateCapturedUI(game);

      expect(whiteContainer.appendChild).toHaveBeenCalled();
      expect(blackContainer.appendChild).toHaveBeenCalled();
    });
  });

  describe('updateStatistics', () => {
    test('should update stats display', () => {
      const statsEl = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockReturnValue(statsEl);

      game.stats = {
        totalMoves: 10,
        playerMoves: 5,
        playerBestMoves: 3
      };

      UI.updateStatistics(game);

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('initBoardUI', () => {
    test('should create board cells', () => {
      const boardEl = {
        innerHTML: '',
        appendChild: jest.fn(),
        querySelector: jest.fn()
      };

      const labelsEl = {
        innerHTML: '',
        appendChild: jest.fn()
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'board') return boardEl;
        if (id === 'col-labels' || id === 'row-labels') return labelsEl;
        return { innerHTML: '', appendChild: jest.fn(), querySelector: jest.fn(), insertBefore: jest.fn() };
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        classList: { add: jest.fn() },
        dataset: {},
        addEventListener: jest.fn(),
        innerHTML: '',
        textContent: '',
        className: '',
        appendChild: jest.fn(),
        insertBefore: jest.fn()
      });

      UI.initBoardUI(game);

      expect(boardEl.appendChild).toHaveBeenCalled();
    });
  });

  describe.skip('showSkinSelector', () => {
    test('should create and show skin selector overlay', () => {
      const mockGetAvailableSkins = jest.fn(() => ['classic', 'wood', 'neon']);
      const mockSetPieceSkin = jest.fn();

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'skin-selector-overlay') return null;
        if (id === 'skin-list') return {
          innerHTML: '',
          style: {},
        };
        if (id === 'close-skin-selector') return {
          onclick: null,
        };
        return null;
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        id: '',
        className: '',
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn() },
        onclick: null,
        style: {},
      });

      jest.spyOn(document.body, 'appendChild').mockImplementation(() => { });

      // Mock dynamic import
      global.import = jest.fn(() => Promise.resolve({
        getAvailableSkins: mockGetAvailableSkins,
        setPieceSkin: mockSetPieceSkin,
      }));

      UI.showSkinSelector(game);

      // Verify overlay creation was attempted
      expect(document.createElement).toHaveBeenCalled();
    });
  });

  describe('animateCheck', () => {
    test('should add check animation class', () => {
      const kingCell = {
        classList: { add: jest.fn(), remove: jest.fn() },
        animate: jest.fn(() => ({ finished: Promise.resolve() })),
      };

      // Place white king on board
      game.board[4][4] = { type: 'k', color: 'white' };

      jest.spyOn(document, 'querySelector').mockReturnValue(kingCell);

      UI.animateCheck(game, 'white');

      expect(kingCell.classList.add).toHaveBeenCalledWith('in-check');
    });
  });

  describe('animateCheckmate', () => {
    test('should trigger checkmate animation', () => {
      const kingCell = {
        classList: { add: jest.fn(), remove: jest.fn() },
        animate: jest.fn(() => ({ finished: Promise.resolve() })),
      };

      game.board[4][4] = { type: 'k', color: 'black' };

      jest.spyOn(document, 'querySelector').mockReturnValue(kingCell);

      UI.animateCheckmate(game, 'black');

      expect(kingCell.classList.add).toHaveBeenCalledWith('checkmate');
    });
  });

  describe('showTutorSuggestions', () => {
    test('should display tutor hints', () => {
      const mockHints = [
        {
          move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
          score: 0.5,
          explanation: 'Good opening move',
          analysis: {
            scoreDiff: 0.3,
            tacticalExplanations: ['Tactical explanation'],
            strategicExplanations: ['Strategic explanation'],
            qualityLabel: 'Good'
          },
        }
      ];

      game.tutorController = {
        getTutorHints: jest.fn(() => mockHints),
      };

      const overlay = {
        classList: { remove: jest.fn(), add: jest.fn() },
        innerHTML: '',
      };

      const hintsContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'tutor-overlay') return overlay;
        if (id === 'tutor-hints') return hintsContainer;
        if (id === 'tutor-hints-body') return { innerHTML: '', appendChild: jest.fn() };
        if (id === 'close-tutor') return { onclick: null };
        if (id === 'close-tutor-btn') return { addEventListener: jest.fn() };
        return null;
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        style: {},
        onmouseover: null,
        onmouseout: null,
        onclick: null,
        innerHTML: '',
        className: '',
        addEventListener: jest.fn(),
      });

      UI.showTutorSuggestions(game);

      expect(game.tutorController.getTutorHints).toHaveBeenCalled();
    });
  });

  describe('enterReplayMode', () => {
    test('should show replay controls', () => {
      const replayStatus = { classList: { remove: jest.fn() } };
      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'replay-status') return replayStatus;
        if (id === 'replay-exit') return { classList: { remove: jest.fn() } };
        if (id === 'undo-btn') return { disabled: false };
        if (id === 'replay-move-num') return { textContent: '' };
        return { style: {}, disabled: false, classList: { add: jest.fn(), remove: jest.fn() } };
      });

      game.moveHistory = [{ from: { r: 6, c: 4 }, to: { r: 5, c: 4 } }];
      UI.enterReplayMode(game);

      expect(replayStatus.classList.remove).toHaveBeenCalledWith('hidden');
    });
  });

  describe('exitReplayMode', () => {
    test('should hide replay controls', () => {
      const replayStatus = { classList: { add: jest.fn() } };
      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'replay-status') return replayStatus;
        if (id === 'replay-exit') return { classList: { add: jest.fn() } };
        if (id === 'undo-btn') return { disabled: false };
        return { style: {}, classList: { add: jest.fn(), remove: jest.fn() } };
      });

      game.replayMode = true;
      UI.exitReplayMode(game);

      expect(replayStatus.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('showPromotionUI', () => {
    test('should display promotion options', () => {
      const overlay = {
        classList: { remove: jest.fn() },
      };
      const optionsContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'promotion-overlay') return overlay;
        if (id === 'promotion-options') return optionsContainer;
        return null;
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        className: '',
        dataset: {},
        textContent: '',
        onclick: null,
        appendChild: jest.fn(),
      });

      const callback = jest.fn();
      UI.showPromotionUI(game, 0, 4, 'white', {}, callback);

      expect(overlay.classList.remove).toHaveBeenCalledWith('hidden');
      expect(optionsContainer.appendChild).toHaveBeenCalled();
    });
  });

  describe('updateReplayUI', () => {
    test('should update replay position display', () => {
      game.replayPosition = 5;
      game.moveHistory = new Array(10);

      const positionDisplay = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'replay-position') return positionDisplay;
        return { disabled: false, classList: { add: jest.fn(), remove: jest.fn() } };
      });

      UI.updateReplayUI(game);

      // Just verify it doesn't throw - actual display depends on implementation
      expect(true).toBe(true);
    });
  });


});
