import { describe, expect, test, beforeEach, vi } from 'vitest';
import { PHASES, BOARD_SIZE } from '../js/config.js';
import { setupJSDOM, createMockGame } from './test-utils.js';

// Mocks for ui.js dependencies are handled here
vi.mock('../js/chess-pieces.js', () => ({
  PIECE_SVGS: {
    white: { p: 'wp', r: 'wr', n: 'wn', b: 'wb', q: 'wq', k: 'wk', e: 'we', a: 'wa', c: 'wc' },
    black: { p: 'bp', r: 'br', n: 'bn', b: 'bb', q: 'bq', k: 'bk', e: 'be', a: 'ba', c: 'bc' },
  },
}));

vi.mock('../js/utils.js', () => ({
  formatTime: vi.fn(t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`),
  debounce: vi.fn(fn => fn),
}));

vi.mock('../js/effects.js', () => ({
  particleSystem: {
    spawn: vi.fn(),
  },
  floatingTextManager: {
    show: vi.fn(),
  },
  shakeScreen: vi.fn(),
  triggerVibration: vi.fn(),
  confettiSystem: { spawn: vi.fn() },
}));

// Import UI module
import * as UI from '../js/ui.js';

describe('UI Module', () => {
  let game: any;

  beforeEach(() => {
    setupJSDOM();
    game = createMockGame();
    game.boardSize = 9;
    vi.clearAllMocks();
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
      game.isSquareUnderAttack = vi.fn(
        (_r: number, _c: number, color: string) => color === 'black'
      );

      UI.initBoardUI(game);
      UI.renderBoard(game);

      const kingCell = document.querySelector('.cell[data-r="4"][data-c="4"]');
      expect(kingCell!.classList.contains('threatened')).toBe(true);
    });
  });

  describe('UI Updates', () => {
    test('should update status for all phases', () => {
      const statusEl = document.getElementById('status-display');
      game.phase = PHASES.SETUP_WHITE_PIECES;
      UI.updateStatus(game);
      expect(statusEl!.textContent).toContain('Weiß');
    });

    test('should update material advantage', () => {
      // White has Queen (9), Black has nothing
      game.board[4][4] = { type: 'q', color: 'white' };
      UI.updateCapturedUI(game);
      const whiteAdv = document.querySelector('.material-advantage.white-adv');
      expect(whiteAdv!.textContent).toBe('+9');
    });

    test('should update clock with active highlight', () => {
      game.turn = 'white';
      UI.updateClockUI(game);
      const whiteClock = document.getElementById('clock-white');
      expect(whiteClock!.classList.contains('active')).toBe(true);
    });
  });

  describe('Special Overlays', () => {
    test('should show promotion UI and handle choice', () => {
      const callback = vi.fn();
      game.board[0][4] = { type: 'p', color: 'white' };
      UI.showPromotionUI(game, 0, 4, 'white', {}, callback);
      const overlay = document.getElementById('promotion-overlay');
      expect(overlay!.classList.contains('hidden')).toBe(false);

      const firstOption = document.querySelector('.promotion-option') as HTMLElement;
      expect(firstOption).not.toBeNull();
      firstOption.click();
      expect(callback).toHaveBeenCalled();
      expect(overlay!.classList.contains('hidden')).toBe(true);
    });

    test('should show tutor suggestions', async () => {
      game.tutorController = {
        getTutorHints: vi.fn(() => [
          {
            move: { from: { r: 6, c: 4 }, to: { r: 5, c: 4 } },
            analysis: {
              category: 'excellent',
              qualityLabel: 'Good',
              tacticalExplanations: ['Tactical'],
              strategicExplanations: ['Strategic'],
            },
          },
        ]),
      };
      await UI.showTutorSuggestions(game);
      const overlay = document.getElementById('tutor-overlay');
      expect(overlay!.classList.contains('hidden')).toBe(false);
    });

    test('should show statistics overlay', () => {
      UI.showStatisticsOverlay(game);
      const overlay = document.getElementById('stats-overlay');
      expect(overlay!.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('stat-moves')).toBeNull(); // Old ID removed
      expect(statusElExists('stat-accuracy')).toBe(true);
      expect(statusElExists('stat-elo')).toBe(true);
    });

    function statusElExists(id: string) {
      return document.getElementById(id) !== null;
    }
  });

  describe('Animations', () => {
    test('should execute move animation', async () => {
      UI.initBoardUI(game);
      const from = { r: 6, c: 4 };
      const to = { r: 5, c: 4 };
      const piece = { type: 'p', color: 'white' };

      const fromCell = document.querySelector('.cell[data-r="6"][data-c="4"]') as HTMLElement;
      const toCell = document.querySelector('.cell[data-r="5"][data-c="4"]') as HTMLElement;
      fromCell.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 50,
        height: 50,
        bottom: 50,
        right: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      toCell.getBoundingClientRect = () => ({
        left: 50,
        top: 50,
        width: 50,
        height: 50,
        bottom: 100,
        right: 100,
        x: 50,
        y: 50,
        toJSON: () => {},
      });

      vi.useFakeTimers();
      const animPromise = UI.animateMove(game, from, to, piece as any);
      vi.advanceTimersByTime(300);
      await animPromise;
      expect(game.isAnimating).toBe(false);
      vi.useRealTimers();
    });
  });
});
