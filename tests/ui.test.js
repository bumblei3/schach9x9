import { jest } from '@jest/globals';
import { PHASES, BOARD_SIZE } from '../js/config.js';

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

jest.unstable_mockModule('../js/effects.js', () => ({
  particleSystem: {
    spawn: jest.fn()
  }
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
      clockEnabled: true,
      isAI: false,
      isAnimating: false,
      replayMode: false,
      getValidMoves: jest.fn(() => []),
      handleCellClick: jest.fn(),
      isSquareUnderAttack: jest.fn(() => false)
    };

    // Setup window globals
    window.PIECE_SVGS = {
      white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
      black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' }
    };
    window._svgCache = {};

    // Setup DOM with all required elements
    document.body.innerHTML = `
            <div id="board-wrapper">
                <div id="board"></div>
            </div>
            <div id="status-display"></div>
            <div id="move-history"></div>
            <div id="captured-white">
                <div class="material-advantage white-adv"></div>
            </div>
            <div id="captured-black">
                <div class="material-advantage black-adv"></div>
            </div>
            <div id="clock-white"></div>
            <div id="clock-black"></div>
            <div id="shop-panel" class="hidden"></div>
            <div id="points-display"></div>
            <div id="finish-setup-btn"></div>
            <div id="selected-piece-display"></div>
            <div id="tutor-overlay" class="hidden">
                 <div id="tutor-hints-body"></div>
            </div>
            <div id="promotion-overlay" class="hidden">
                <div id="promotion-options"></div>
            </div>
            <div id="replay-status" class="hidden"></div>
            <div id="replay-exit" class="hidden"></div>
            <div id="tutor-recommendations-section" class="hidden"></div>
            <div id="stats-overlay" class="hidden">
                 <div id="stat-moves"></div>
                 <div id="stat-captures"></div>
                 <div id="stat-accuracy"></div>
                 <div id="stat-best-moves"></div>
                 <div id="stat-material"></div>
            </div>
        `;

    jest.clearAllMocks();
  });

  describe('Board Rendering and Interactions', () => {
    test('should initialize board with coordinate labels', () => {
      UI.initBoardUI(game);
      const cells = document.querySelectorAll('.cell');
      expect(cells.length).toBe(BOARD_SIZE * BOARD_SIZE);
    });

    test('should highlight selectable corridors in setup phase', () => {
      game.phase = PHASES.SETUP_WHITE_KING;
      UI.initBoardUI(game);
      UI.renderBoard(game);
      const corridors = document.querySelectorAll('.selectable-corridor');
      expect(corridors.length).toBeGreaterThan(0);
    });

    test('should highlight threatened pieces', () => {
      game.phase = PHASES.PLAY;
      game.board[4][4] = { type: 'k', color: 'white' };
      // isSquareUnderAttack(r, c, attackerColor)
      game.isSquareUnderAttack = jest.fn((r, c, color) => color === 'black');

      UI.initBoardUI(game);
      UI.renderBoard(game);

      const kingCell = document.querySelector('.cell[data-r="4"][data-c="4"]');
      expect(kingCell.classList.contains('threatened')).toBe(true);
    });
  });

  describe('UI Updates', () => {
    test('should update status for all phases', () => {
      const statusEl = document.getElementById('status-display');
      game.phase = PHASES.SETUP_WHITE_PIECES;
      UI.updateStatus(game);
      expect(statusEl.textContent).toContain('Weiß');
    });

    test('should update material advantage', () => {
      // White has Queen (9), Black has nothing
      game.board[4][4] = { type: 'q', color: 'white' };
      UI.updateCapturedUI(game);
      const whiteAdv = document.querySelector('.material-advantage.white-adv');
      expect(whiteAdv.textContent).toBe('+9');
    });

    test('should update clock with active highlight', () => {
      game.turn = 'white';
      UI.updateClockUI(game);
      const whiteClock = document.getElementById('clock-white');
      expect(whiteClock.classList.contains('active')).toBe(true);
    });
  });

  describe('Special Overlays', () => {
    test('should show promotion UI and handle choice', () => {
      const callback = jest.fn();
      game.board[0][4] = { type: 'p', color: 'white' };
      UI.showPromotionUI(game, 0, 4, 'white', {}, callback);
      const overlay = document.getElementById('promotion-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);

      const firstOption = document.querySelector('.promotion-option');
      expect(firstOption).not.toBeNull();
      firstOption.click();
      expect(callback).toHaveBeenCalled();
      expect(overlay.classList.contains('hidden')).toBe(true);
    });

    test('should show tutor suggestions', () => {
      game.tutorController = {
        getTutorHints: jest.fn(() => [{
          move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
          analysis: {
            qualityLabel: 'Good',
            tacticalExplanations: ['Tactical'],
            strategicExplanations: ['Strategic']
          }
        }])
      };
      UI.showTutorSuggestions(game);
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);
    });

    test('should show statistics overlay', () => {
      UI.showStatisticsOverlay(game);
      const overlay = document.getElementById('stats-overlay');
      expect(overlay.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('stat-moves').textContent).toBe('0');
    });
  });

  describe('Animations', () => {
    test('should execute move animation', async () => {
      UI.initBoardUI(game);
      const from = { r: 6, c: 4 };
      const to = { r: 5, c: 4 };
      const piece = { type: 'p', color: 'white' };

      const fromCell = document.querySelector('.cell[data-r="6"][data-c="4"]');
      const toCell = document.querySelector('.cell[data-r="5"][data-c="4"]');
      fromCell.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 50 });
      toCell.getBoundingClientRect = () => ({ left: 50, top: 50, width: 50, height: 50 });

      jest.useFakeTimers();
      const animPromise = UI.animateMove(game, from, to, piece);
      jest.advanceTimersByTime(300);
      await animPromise;
      expect(game.isAnimating).toBe(false);
      jest.useRealTimers();
    });
  });
});
