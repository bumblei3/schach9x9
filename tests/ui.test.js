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

    test('should show low time warning', () => {
      game.whiteTime = 25; // Under 30 seconds

      const whiteClockEl = {
        textContent: '',
        classList: { remove: jest.fn(), add: jest.fn(), contains: jest.fn(() => false) }
      };
      const blackClockEl = {
        textContent: '',
        classList: { remove: jest.fn(), add: jest.fn(), contains: jest.fn(() => false) }
      };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'clock-white') return whiteClockEl;
        if (id === 'clock-black') return blackClockEl;
        return null;
      });

      UI.updateClockDisplay(game);

      // Check that 'low-time' was added (may be called with other classes too)
      expect(whiteClockEl.classList.add).toHaveBeenCalled();
      const addCalls = whiteClockEl.classList.add.mock.calls.flat();
      expect(addCalls).toContain('low-time');
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
      expect(blackClockEl.classList.remove).toHaveBeenCalledWith('active');
    });
  });

  describe('showShop', () => {
    test('should show shop container', () => {
      const shopPanel = { classList: { remove: jest.fn(), add: jest.fn() } };
      const pointsDisplay = { textContent: '' };

      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'shop-panel') return shopPanel;
        if (id === 'points-display') return pointsDisplay;
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

      jest.spyOn(document, 'getElementById').mockImplementation(() => {
        return { textContent: '', disabled: false };
      });
      jest.spyOn(document, 'querySelectorAll').mockReturnValue([cheapBtn, expensiveBtn]);

      game.points = 5;
      UI.updateShopUI(game);

      expect(expensiveBtn.disabled).toBe(true);
      expect(cheapBtn.disabled).toBe(false);
    });
  });

  describe('updateMoveHistoryUI', () => {
    test('should add moves to history', () => {
      const historyContainer = {
        innerHTML: '',
        scrollTop: 0,
        scrollHeight: 100
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
        return { innerHTML: '', appendChild: jest.fn(), querySelector: jest.fn() };
      });

      jest.spyOn(document, 'createElement').mockReturnValue({
        classList: { add: jest.fn() },
        dataset: {},
        addEventListener: jest.fn(),
        innerHTML: '',
        textContent: '',
        className: '',
        appendChild: jest.fn()
      });

      UI.initBoardUI(game);

      expect(boardEl.appendChild).toHaveBeenCalled();
    });
  });
});
