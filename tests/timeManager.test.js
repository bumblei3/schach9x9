/**
 * Tests for TimeManager
 */

import { TimeManager } from '../js/TimeManager.js';
import { PHASES } from '../js/config.js';

describe('TimeManager', () => {
  let mockGame;
  let mockController;
  let timeManager;

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
    global.document = {
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

  describe('tickClock', () => {
    test('should stop clock if phase is not PLAY', () => {
      mockGame.phase = PHASES.GAME_OVER;
      timeManager.startClock();

      timeManager.tickClock();

      expect(timeManager.clockInterval).toBeNull();
    });
  });
});
