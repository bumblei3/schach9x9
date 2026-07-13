import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Tests for TimeManager
 */

// TimeManager.handleTimeout calls soundManager.playGameOver, which constructs
// an AudioContext in the real module. Mock it so the timeout tests run headless.
vi.mock('../js/sounds.js', () => ({
  soundManager: { playGameOver: vi.fn() },
}));

import { TimeManager } from '../js/TimeManager.js';
import { PHASES } from '../js/config.js';

describe('TimeManager', () => {
  let mockGame: any;
  let mockController: any;
  let timeManager: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockGame = {
      phase: PHASES.PLAY,
      turn: 'white',
      timeControl: { base: 300, increment: 3 },
      whiteTime: 300,
      blackTime: 300,
      clockEnabled: true,
      lastMoveTime: Date.now(),
      log: () => {},
    };

    mockController = {
      updateClockDisplay: vi.fn(),
      saveGameToStatistics: vi.fn(),
    };

    // Mock document elements
    (global as any).document = {
      getElementById: vi.fn(() => ({
        classList: { add: vi.fn(), remove: vi.fn() },
        textContent: '',
        innerHTML: '',
      })),
    };

    timeManager = new TimeManager(mockGame, mockController);
  });

  afterEach(() => {
    timeManager.stopClock();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    test('should initialize with game and controller', () => {
      expect(timeManager.game).toBe(mockGame);
      expect(timeManager.gameController).toBe(mockController);
    });

    test('should have null clockInterval initially', () => {
      expect(timeManager.clockInterval).toBeNull();
    });
  });

  describe('setTimeControl', () => {
    test('should set blitz5 time control', () => {
      timeManager.setTimeControl('blitz5');

      expect(mockGame.whiteTime).toBe(300);
      expect(mockGame.blackTime).toBe(300);
    });

    test('should set rapid10 time control', () => {
      timeManager.setTimeControl('rapid10');

      expect(mockGame.whiteTime).toBe(600);
      expect(mockGame.blackTime).toBe(600);
    });

    test('should default to blitz5 for unknown control', () => {
      timeManager.setTimeControl('unknown');

      expect(mockGame.whiteTime).toBe(300);
    });
  });

  describe('startClock', () => {
    test('should not start if clock not enabled', () => {
      mockGame.clockEnabled = false;

      timeManager.startClock();

      expect(timeManager.clockInterval).toBeNull();
    });

    test('should start clock interval when enabled', () => {
      mockGame.clockEnabled = true;
      mockGame.phase = PHASES.PLAY;

      timeManager.startClock();

      expect(timeManager.clockInterval).not.toBeNull();
    });
  });

  describe('stopClock', () => {
    test('should clear clock interval', () => {
      timeManager.startClock();
      timeManager.stopClock();

      expect(timeManager.clockInterval).toBeNull();
    });
  });

  describe('tickClock — countdown + timeout', () => {
    test('subtracts elapsed time from the side to move', () => {
      mockGame.turn = 'white';
      mockGame.whiteTime = 300;
      mockGame.lastMoveTime = Date.now();
      // Advance fake time by 2s before ticking.
      vi.advanceTimersByTime(2000);
      timeManager.tickClock();
      // ~2s elapsed -> white time drops to ~298 (use a tolerance band).
      expect(mockGame.whiteTime).toBeLessThan(300);
      expect(mockGame.whiteTime).toBeGreaterThan(297);
    });

    test('black timeout ends the game and reports white as winner', () => {
      mockGame.turn = 'black';
      mockGame.blackTime = 0.5; // already (nearly) expired
      mockGame.lastMoveTime = Date.now();
      vi.advanceTimersByTime(1000); // > blackTime -> drops to <= 0

      timeManager.tickClock();

      // Game ends, phase flipped, and the controller is told who lost.
      expect((mockGame as any).phase).toBe(PHASES.GAME_OVER);
      expect(mockController.saveGameToStatistics).toHaveBeenCalledWith('loss', 'black');
      // Clock is stopped after timeout.
      expect(timeManager.clockInterval).toBeNull();
    });

    test('white timeout reports black as winner', () => {
      mockGame.turn = 'white';
      mockGame.whiteTime = 0.5;
      mockGame.lastMoveTime = Date.now();
      vi.advanceTimersByTime(1000);

      timeManager.tickClock();

      expect((mockGame as any).phase).toBe(PHASES.GAME_OVER);
      expect(mockController.saveGameToStatistics).toHaveBeenCalledWith('loss', 'white');
    });
  });

  describe('handleTimeout', () => {
    test('declares the correct winner and notifies the controller', () => {
      // Drive handleTimeout directly to lock the winner-mapping invariant
      // (the private method is reached via tickClock above, but asserting the
      // mapping explicitly guards against a swapped color bug).
      (timeManager as any).handleTimeout('white');
      expect(mockController.saveGameToStatistics).toHaveBeenCalledWith('loss', 'white');
      expect((mockGame as any).phase).toBe(PHASES.GAME_OVER);

      mockController.saveGameToStatistics.mockClear();
      (timeManager as any).handleTimeout('black');
      expect(mockController.saveGameToStatistics).toHaveBeenCalledWith('loss', 'black');
    });
  });

  describe('updateClockVisibility', () => {
    test('hides the clock element when clock is disabled', () => {
      mockGame.clockEnabled = false;
      const clockEl = {
        classList: { add: vi.fn(), remove: vi.fn() },
      };
      (global as any).document = { getElementById: vi.fn(() => clockEl) };

      timeManager.updateClockVisibility();

      expect((global as any).document.getElementById).toHaveBeenCalledWith('chess-clock');
      expect(clockEl.classList.add).toHaveBeenCalledWith('hidden');
    });

    test('shows the clock element when clock is enabled', () => {
      mockGame.clockEnabled = true;
      const clockEl = {
        classList: { add: vi.fn(), remove: vi.fn() },
      };
      (global as any).document = { getElementById: vi.fn(() => clockEl) };

      timeManager.updateClockVisibility();

      expect(clockEl.classList.remove).toHaveBeenCalledWith('hidden');
    });
  });
});
